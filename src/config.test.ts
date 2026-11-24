import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from './config';

test('an empty environment gives the defaults', () => {
  assert.deepEqual(loadConfig({}), {
    port: 3000,
    anthropicApiKey: null,
    claudeModel: 'claude-opus-5-5',
    requestsPerMinute: 30,
    requestsPerDay: 100,
    claudeCallsPerDay: 1000,
    trustProxyHops: 0,
  });
});

test('every setting can be set', () => {
  assert.deepEqual(
    loadConfig({
      PORT: '4000',
      ANTHROPIC_API_KEY: ' a-key ',
      CLAUDE_MODEL: 'claude-haiku-5-5',
      REQUESTS_PER_MINUTE: '1',
      REQUESTS_PER_DAY: '2',
      CLAUDE_CALLS_PER_DAY: '0',
      TRUST_PROXY_HOPS: '1',
    }),
    {
      port: 4000,
      anthropicApiKey: 'a-key',
      claudeModel: 'claude-haiku-5-5',
      requestsPerMinute: 1,
      requestsPerDay: 2,
      claudeCallsPerDay: 0,
      trustProxyHops: 1,
    },
  );
});

test('a blank API key counts as no key', () => {
  assert.equal(loadConfig({ ANTHROPIC_API_KEY: '  ' }).anthropicApiKey, null);
});

test('a blank number or model falls back to the default', () => {
  const config = loadConfig({ REQUESTS_PER_DAY: '', CLAUDE_MODEL: ' ' });
  assert.equal(config.requestsPerDay, 100);
  assert.equal(config.claudeModel, 'claude-opus-5-5');
});

for (const value of ['abc', '-1', '1.5']) {
  test(`REQUESTS_PER_DAY=${value} is refused by name, without showing the value`, () => {
    assert.throws(
      () => loadConfig({ REQUESTS_PER_DAY: value }),
      (error: Error) => error.message.includes('REQUESTS_PER_DAY') && !error.message.includes(value),
    );
  });
}
