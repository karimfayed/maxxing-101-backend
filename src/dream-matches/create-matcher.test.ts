import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { Logger } from '@nestjs/common';
import { ApiError } from '../api-error';
import { loadConfig } from '../config';
import { createMatcher } from './dream-matches.module';

const ENV = {
  ANTHROPIC_LOG: 'debug',
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:9/elsewhere',
  ANTHROPIC_AUTH_TOKEN: 'someone-elses',
};
const CONSOLE_METHODS = ['log', 'info', 'debug', 'warn', 'error'] as const;
const ANSWER = { verdict: 'unclear', categoryIds: [], exactDreamIds: [], closestDreamIds: [], notes: [] };

let sent: { url: string; headers: Headers }[] = [];
let printed: unknown[] = [];
let restore: (() => void)[] = [];

beforeEach(() => {
  sent = [];
  printed = [];
  for (const [name, value] of Object.entries(ENV)) {
    const old = process.env[name];
    restore.push(() => {
      if (old === undefined) delete process.env[name];
      else process.env[name] = old;
    });
    process.env[name] = value;
  }
  for (const method of CONSOLE_METHODS) {
    const old = console[method];
    restore.push(() => void (console[method] = old));
    console[method] = (...parts: unknown[]) => void printed.push(...parts);
  }
  const realFetch = globalThis.fetch;
  restore.push(() => void (globalThis.fetch = realFetch));
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), headers: new Headers(init?.headers) });
    return Response.json({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      stop_reason: 'end_turn',
      stop_sequence: null,
      content: [{ type: 'text', text: JSON.stringify(ANSWER), citations: null }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  };
  const ignore = (): void => undefined;
  Logger.overrideLogger({ log: ignore, warn: ignore, error: ignore });
});

afterEach(() => {
  for (const undo of restore.reverse()) undo();
  restore = [];
});

test("the machine's own SDK settings neither print the words nor send them elsewhere", async () => {
  const matcher = createMatcher(loadConfig({ ANTHROPIC_API_KEY: 'our-key' }));

  assert.deepEqual(await matcher.ask('zebra-words'), ANSWER);

  assert.equal(sent.length, 1);
  assert.equal(new URL(sent[0]?.url ?? '').host, 'api.anthropic.com');
  assert.equal(sent[0]?.headers.get('authorization'), 'Bearer our-key');
  assert.deepEqual(printed, []);
});

test('without a key nothing is sent with other credentials on the machine', async () => {
  const matcher = createMatcher(loadConfig({ ANTHROPIC_API_KEY: ' ' }));
  await assert.rejects(matcher.ask('zebra-words'), ApiError);
  assert.deepEqual(sent, []);
});
