import test from 'node:test';
import assert from 'node:assert/strict';
import { findKnownAnswer } from './knowledge.mjs';

test('answers a low-signal question', () => {
  assert.match(findKnownAnswer('訊號只有 3% 怎麼辦？'), /重新定位夾子/);
});

test('answers the TP VLF combination', () => {
  assert.match(findKnownAnswer('TP、VLF 都低代表什麼？'), /恢復與放鬆狀態較弱/);
});

test('answers APG with a non-diagnostic explanation', () => {
  assert.match(findKnownAnswer('APG 血管彈性不好代表什麼？'), /不要由客服直接判定/);
});

test('leaves unknown questions for the model or human handoff', () => {
  assert.equal(findKnownAnswer('E900 錯誤碼怎麼處理？'), null);
});
