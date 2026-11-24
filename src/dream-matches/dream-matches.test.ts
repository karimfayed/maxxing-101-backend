import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { LoggerService } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ApiError } from '../api-error';
import { AppModule } from '../app.module';
import { configureApp } from '../app-setup';
import { loadConfig, type AppConfig } from '../config';
import type { DreamMatcher } from './claude-matcher';
import { DREAM_MATCHER } from './dream-matches.service';
import type { ClaudeAnswer } from './match-rules';

const SKILL: ClaudeAnswer = {
  verdict: 'goal',
  categoryIds: ['skill'],
  exactDreamIds: [],
  closestDreamIds: [],
  notes: [],
};
const GUITAR = { text: 'learn guitar', area: 'fitness' };

class FakeMatcher implements DreamMatcher {
  readonly asked: string[] = [];
  respond: () => Promise<ClaudeAnswer> = async () => SKILL;

  ask(text: string): Promise<ClaudeAnswer> {
    this.asked.push(text);
    return this.respond();
  }
}

interface Server {
  matcher: FakeMatcher;
  logs: string[];
  warnings: string[];
  get(path: string): Promise<Response>;
  post(body: unknown, headers?: Record<string, string>): Promise<Response>;
  postRaw(body: string | undefined, headers?: Record<string, string>): Promise<Response>;
}

let running: NestExpressApplication | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function start(config: Partial<AppConfig> = {}, options: { realMatcher?: boolean } = {}): Promise<Server> {
  const matcher = new FakeMatcher();
  const logs: string[] = [];
  const warnings: string[] = [];
  const keep = (...parts: unknown[]): void => void logs.push(parts.map(String).join(' '));
  const logger: LoggerService = {
    log: keep,
    error: keep,
    debug: keep,
    verbose: keep,
    fatal: keep,
    warn: (...parts: unknown[]) => {
      keep(...parts);
      warnings.push(String(parts[0]));
    },
  };
  const full = { ...loadConfig({}), requestsPerMinute: 1000, requestsPerDay: 1000, ...config };
  const builder = Test.createTestingModule({ imports: [AppModule.forRoot(full)] }).setLogger(logger);
  if (!options.realMatcher) builder.overrideProvider(DREAM_MATCHER).useValue(matcher);
  const module = await builder.compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger });
  configureApp(app, full);
  await app.listen(0, '127.0.0.1');
  running = app;
  const { port } = app.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${port}`;
  const postRaw: Server['postRaw'] = (body, headers = {}) =>
    fetch(`${base}/v1/dream-matches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: body ?? null,
    });
  return {
    matcher,
    logs,
    warnings,
    get: (path) => fetch(base + path),
    post: (body, headers) => postRaw(JSON.stringify(body), headers),
    postRaw,
  };
}

async function assertError(response: Response, status: number, code: string): Promise<void> {
  assert.equal(response.status, status);
  assert.equal(await response.text(), `{"code":"${code}"}`);
}

test('a dream typed under the wrong area gets its own category', async () => {
  const server = await start();
  const response = await server.post(GUITAR);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    kind: 'no_plan',
    categoryId: 'skill',
    fitsArea: false,
    dreamId: null,
    closestDreamId: null,
    alternativeDreamIds: [],
    notes: [],
  });
  assert.deepEqual(server.matcher.asked, ['learn guitar']);
});

const REFUSED: [name: string, body: string | undefined][] = [
  ['broken JSON', '{"text": "zebra-words'],
  ['an array', '[]'],
  ['null', 'null'],
  ['no body', undefined],
  ['an empty object', '{}'],
  ['no text', '{"area":"fitness"}'],
  ['no area', '{"text":"zebra-words"}'],
  ['an unknown area', '{"text":"zebra-words","area":"sports"}'],
  ['an extra field', '{"text":"zebra-words","area":null,"user":"me"}'],
  ['a number for text', '{"text":5,"area":null}'],
  ['blank text', '{"text":"   ","area":null}'],
  ['only invisible characters', '{"text":"\\u200b\\u200e","area":null}'],
  ['invisible characters around spaces', '{"text":"\\u200b \\u200b","area":null}'],
  ['201 characters', JSON.stringify({ text: 'a'.repeat(201), area: null })],
  ['a 5 KB body', JSON.stringify({ text: 'a'.repeat(5 * 1024), area: null })],
];

for (const [name, body] of REFUSED) {
  test(`${name} is an invalid request and never reaches Claude`, async () => {
    const server = await start();
    await assertError(await server.postRaw(body), 400, 'invalid_request');
    assert.deepEqual(server.matcher.asked, []);
    assert.ok(!server.logs.join('\n').includes('zebra-words'));
  });
}

test('a body that is not JSON is an invalid request', async () => {
  const server = await start();
  await assertError(await server.postRaw('text=hi', { 'content-type': 'text/plain' }), 400, 'invalid_request');
});

const ACCEPTED: [name: string, text: string, asked: string][] = [
  ['exactly 200 characters', 'a'.repeat(200), 'a'.repeat(200)],
  ['200 emoji', '🎸'.repeat(200), '🎸'.repeat(200)],
  ['200 characters inside spaces', ` ${'a'.repeat(200)} `, 'a'.repeat(200)],
  ['Franco-Arabic, trimmed', ' a5es wazn ', 'a5es wazn'],
  ['Arabic', 'أتعلم الجيتار', 'أتعلم الجيتار'],
];

for (const [name, text, asked] of ACCEPTED) {
  test(`${name} is accepted`, async () => {
    const server = await start();
    const response = await server.post({ text, area: null });
    assert.equal(response.status, 200);
    assert.deepEqual(server.matcher.asked, [asked]);
  });
}

test('one IP gets its requests per minute and no more', async () => {
  const server = await start({ requestsPerMinute: 2 });
  assert.equal((await server.post(GUITAR)).status, 200);
  assert.equal((await server.post(GUITAR)).status, 200);
  await assertError(await server.post(GUITAR), 429, 'rate_limited');
  assert.equal(server.matcher.asked.length, 2);
});

test('one IP gets its requests per day and no more', async () => {
  const server = await start({ requestsPerDay: 3 });
  for (let i = 0; i < 3; i++) assert.equal((await server.post(GUITAR)).status, 200);
  await assertError(await server.post(GUITAR), 429, 'rate_limited');
});

test('the status page is never limited', async () => {
  const server = await start({ requestsPerMinute: 1, requestsPerDay: 1 });
  for (let i = 0; i < 4; i++) assert.equal((await server.get('/')).status, 200);
});

test('a made-up forwarded address does not get around the limit', async () => {
  const server = await start({ requestsPerMinute: 1, trustProxyHops: 0 });
  assert.equal((await server.post(GUITAR, { 'x-forwarded-for': '203.0.113.1' })).status, 200);
  assert.equal((await server.post(GUITAR, { 'x-forwarded-for': '203.0.113.2' })).status, 429);
});

test('behind one trusted proxy each forwarded address has its own limit', async () => {
  const server = await start({ requestsPerMinute: 1, trustProxyHops: 1 });
  assert.equal((await server.post(GUITAR, { 'x-forwarded-for': '203.0.113.1' })).status, 200);
  assert.equal((await server.post(GUITAR, { 'x-forwarded-for': '203.0.113.2' })).status, 200);
  assert.equal((await server.post(GUITAR, { 'x-forwarded-for': '203.0.113.2' })).status, 429);
  // Only the last address was added by our proxy; the caller can write anything before it.
  assert.equal((await server.post(GUITAR, { 'x-forwarded-for': '198.51.100.9, 203.0.113.2' })).status, 429);
});

test('no more Claude calls are made once the daily cap is reached', async () => {
  const server = await start({ claudeCallsPerDay: 1 });
  assert.equal((await server.post(GUITAR)).status, 200);
  await assertError(await server.post(GUITAR), 503, 'match_unavailable');
  assert.equal(server.matcher.asked.length, 1);
});

test('the daily cap holds for requests at the same moment', async () => {
  const server = await start({ claudeCallsPerDay: 2 });
  server.matcher.respond = () => new Promise((resolve) => setTimeout(() => resolve(SKILL), 30));
  const statuses = await Promise.all(Array.from({ length: 5 }, async () => (await server.post(GUITAR)).status));
  assert.deepEqual(statuses.sort(), [200, 200, 503, 503, 503]);
  assert.equal(server.matcher.asked.length, 2);
});

test('an invalid request does not use up the daily cap', async () => {
  const server = await start({ claudeCallsPerDay: 1 });
  assert.equal((await server.post({ text: '', area: null })).status, 400);
  assert.equal((await server.post(GUITAR)).status, 200);
});

test('Claude being unavailable is passed on', async () => {
  const server = await start();
  server.matcher.respond = async () => {
    throw new ApiError(503, 'match_unavailable');
  };
  await assertError(await server.post(GUITAR), 503, 'match_unavailable');
});

test('an unexpected error shows nothing about itself', async () => {
  const server = await start();
  server.matcher.respond = async () => {
    throw new Error('secret words');
  };
  await assertError(await server.post(GUITAR), 500, 'internal_error');
  assert.ok(server.logs.some((line) => line.includes('Unexpected error')));
  assert.ok(!server.logs.join('\n').includes('secret words'));
});

test('an unknown page is not found', async () => {
  const server = await start();
  await assertError(await server.get('/nope'), 404, 'not_found');
});

test('the words are never logged', async () => {
  const server = await start({ claudeCallsPerDay: 3 });
  const body = { text: 'zebra-words', area: null };
  assert.equal((await server.post(body)).status, 200);
  server.matcher.respond = async () => {
    throw new ApiError(503, 'match_unavailable');
  };
  assert.equal((await server.post(body)).status, 503);
  server.matcher.respond = async () => {
    throw new Error('zebra-words');
  };
  assert.equal((await server.post(body)).status, 500);
  assert.equal((await server.post(body)).status, 503);
  assert.ok(server.logs.length > 0);
  assert.ok(!server.logs.join('\n').includes('zebra-words'));
});

test('without an API key the server starts, warns once and answers unavailable', async () => {
  const server = await start({ anthropicApiKey: null }, { realMatcher: true });
  assert.deepEqual(server.warnings, ['ANTHROPIC_API_KEY is not set: every dream match will be unavailable']);
  await assertError(await server.post(GUITAR), 503, 'match_unavailable');
});
