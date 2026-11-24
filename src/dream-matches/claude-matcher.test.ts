import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { ApiError } from '../api-error';
import { ClaudeMatcher } from './claude-matcher';
import type { ClaudeAnswer } from './match-rules';

const MODEL = 'claude-opus-5-5';
const WORDS = 'zebra-words';
const ANSWER: ClaudeAnswer = {
  verdict: 'goal',
  categoryIds: ['skill'],
  exactDreamIds: [],
  closestDreamIds: ['tool'],
  notes: [],
};

type FakeFetch = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

function clientWith(fetch: FakeFetch): Anthropic {
  return new Anthropic({ apiKey: 'test', fetch });
}

function reply(text: string, stopReason = 'end_turn'): Response {
  return Response.json({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: MODEL,
    stop_reason: stopReason,
    stop_sequence: null,
    content: text === '' ? [] : [{ type: 'text', text, citations: null }],
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

function failure(status: number): Response {
  return Response.json({ type: 'error', error: { type: 'api_error', message: WORDS } }, { status });
}

const logged: unknown[] = [];
before(() => {
  const keep = (...parts: unknown[]): void => void logged.push(...parts);
  Logger.overrideLogger({ log: keep, warn: keep, error: keep, debug: keep, verbose: keep, fatal: keep });
});
after(() => {
  assert.ok(logged.length > 0, 'failures are logged');
  assert.ok(!JSON.stringify(logged).includes(WORDS), 'the words are never logged');
});

async function assertUnavailable(matcher: ClaudeMatcher): Promise<void> {
  await assert.rejects(matcher.ask(WORDS), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.deepEqual([error.status, error.code], [503, 'match_unavailable']);
    return true;
  });
}

test('sends one structured, low-effort request with the refusal fallback, and returns the answer', async () => {
  const requests: { url: string; headers: Headers; body: Record<string, any> }[] = [];
  const client = clientWith(async (url, init) => {
    requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return reply(JSON.stringify(ANSWER));
  });

  assert.deepEqual(await new ClaudeMatcher(client, MODEL).ask(WORDS), ANSWER);

  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.ok(request);
  assert.equal(request.body.model, MODEL);
  assert.equal(request.body.max_tokens, 2048);
  assert.equal(request.body.fallbacks, 'default');
  assert.equal(request.body.output_config.effort, 'low');
  assert.equal(request.body.output_config.format.type, 'json_schema');
  assert.deepEqual(request.body.messages, [{ role: 'user', content: `{"words":"${WORDS}"}` }]);
  assert.match(request.headers.get('anthropic-beta') ?? '', /server-side-fallback-2026-07-01/);
});

const BAD_REPLIES: [name: string, respond: () => Response][] = [
  ['a decline', () => reply('', 'refusal')],
  ['a decline that still carries text', () => reply(JSON.stringify(ANSWER), 'refusal')],
  ['a cut-off answer', () => reply('{"verdict":"go', 'max_tokens')],
  ['a whole answer that ran out of room', () => reply(JSON.stringify(ANSWER), 'max_tokens')],
  ['an id we do not have', () => reply(JSON.stringify({ ...ANSWER, categoryIds: ['cooking'] }))],
  ['an empty answer', () => reply('')],
  ['a rejected key', () => failure(401)],
  ['a rate limit', () => failure(429)],
  ['a server error', () => failure(500)],
];

for (const [name, respond] of BAD_REPLIES) {
  test(`${name} is unavailable, after one call`, async () => {
    let calls = 0;
    await assertUnavailable(
      new ClaudeMatcher(
        clientWith(async () => {
          calls += 1;
          return respond();
        }),
        MODEL,
      ),
    );
    assert.equal(calls, 1);
  });
}

test('a network error is unavailable', async () => {
  await assertUnavailable(
    new ClaudeMatcher(
      clientWith(async () => {
        throw new TypeError(WORDS);
      }),
      MODEL,
    ),
  );
});

test('a slow answer is aborted and unavailable', async () => {
  let aborted = false;
  const client = clientWith(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        const keepAlive = setTimeout(() => reject(new Error('never aborted')), 5_000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(keepAlive);
          aborted = true;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
  );
  const started = Date.now();
  await assertUnavailable(new ClaudeMatcher(client, MODEL, 50));
  assert.ok(aborted);
  assert.ok(Date.now() - started < 2_000);
});

test('with no key nothing is sent, even when the machine has other Claude credentials', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  process.env.ANTHROPIC_AUTH_TOKEN = 'someone-elses';
  globalThis.fetch = async () => {
    calls += 1;
    return failure(401);
  };
  try {
    await assertUnavailable(new ClaudeMatcher(null, MODEL));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  }
  assert.equal(calls, 0);
});
