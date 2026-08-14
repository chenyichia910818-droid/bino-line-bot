import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import OpenAI from 'openai';
import { findKnownAnswer, safetyText, systemPrompt } from './knowledge.mjs';

const required = ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}. Copy .env.example to .env and set it.`);

const app = express();
const lineApi = 'https://api.line.me/v2/bot/message';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
  if (!openai) return null;
  const response = await openai.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5', store: false, instructions: systemPrompt, input: question });
  return response.output_text?.trim() || null;
}

async function respond(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') return;
  const question = event.message.text.trim();
  let answer = findKnownAnswer(question);
  let needsHuman = false;
  if (!answer) {
    answer = await generatedAnswer(question);
    if (!answer || /建立客服案件/.test(answer)) { answer = '我已建立客服案件，請提供目前畫面截圖、錯誤訊息與已嘗試的操作，林芳誼將於原對話接手協助。'; needsHuman = true; }
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
