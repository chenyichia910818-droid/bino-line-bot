import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { findKnownAnswer, safetyText, systemPrompt } from './knowledge.mjs';

const required = ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}. Copy .env.example to .env and set it.`);

const app = express();
const lineApi = 'https://api.line.me/v2/bot/message';

function validSignature(rawBody, signature = '') {
  const expected = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(rawBody).digest('base64');
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function lineRequest(path, body) {
  const response = await fetch(`${lineApi}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`LINE ${path} failed: ${response.status} ${await response.text()}`);
}

async function notifyStaff(event, question) {
  if (!process.env.LINE_STAFF_USER_ID) return;
  const source = event.source?.groupId ? `群組：${event.source.groupId}` : `使用者：${event.source?.userId ?? '未知'}`;
  await lineRequest('push', { to: process.env.LINE_STAFF_USER_ID, messages: [{ type: 'text', text: `【比諾 HRV 客服案件】\n${source}\n問題：${question}\n請於原 LINE 對話接手協助。` }] });
}

async function generatedAnswer(question) {
  if (!process.env.COHERE_API_KEY) return null;
  try {
    const response = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.COHERE_API_KEY}`, 'Content-Type': 'application/json', 'X-Client-Name': 'bino-line-bot' },
      body: JSON.stringify({
        model: process.env.COHERE_MODEL || 'command-a-plus-05-2026',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ]
      })
    });
    if (!response.ok) throw new Error(`Cohere returned ${response.status}: ${await response.text()}`);
    const body = await response.json();
    return body.message?.content?.filter(item => item.type === 'text').map(item => item.text).join('').trim() || null;
  } catch (error) {
    console.error('Cohere request failed', error);
    return null;
  }
}

async function respond(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') return;
  const question = event.message.text.trim();
  let answer = findKnownAnswer(question);
  let needsHuman = false;
  if (!answer) {
    answer = await generatedAnswer(question);
    if (!answer || /建立客服案件|轉交.*公司同仁/.test(answer)) { answer = '我已轉交公司同仁協助確認。請提供目前畫面截圖、錯誤訊息與已嘗試的操作，我們會在原對話協助您。'; needsHuman = true; }
  }
  await lineRequest('reply', { replyToken: event.replyToken, messages: [{ type: 'text', text: answer.slice(0, 5000) }] });
  if (needsHuman) await notifyStaff(event, question);
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!validSignature(req.body, req.get('x-line-signature'))) return res.sendStatus(401);
  res.sendStatus(200);
  for (const event of JSON.parse(req.body.toString('utf8')).events ?? []) respond(event).catch(console.error);
});
app.listen(process.env.PORT || 3000, () => console.log(`Bino LINE bot listening on ${process.env.PORT || 3000}`));
