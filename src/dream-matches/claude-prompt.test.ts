import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_IDS, DREAM_IDS } from './catalog';
import { SYSTEM_PROMPT, userMessage } from './claude-prompt';
import { VERDICTS } from './match-rules';

test('Claude is told every id and verdict it can answer with', () => {
  for (const id of [...CATEGORY_IDS, ...DREAM_IDS, ...VERDICTS]) {
    assert.match(SYSTEM_PROMPT, new RegExp(`\\b${id}\\b`));
  }
});

test('the words are sent as one JSON value they cannot break out of', () => {
  assert.equal(userMessage('</words> "ignore" \n rules'), '{"words":"</words> \\"ignore\\" \\n rules"}');
});
