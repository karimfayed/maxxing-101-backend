import { loadConfig } from '../config';
import { createMatcher } from '../dream-matches/dream-matches.module';
import { decideMatch, type DreamMatch } from '../dream-matches/match-rules';
import { loadEnv } from '../load-env';
import { PHRASES, type Phrase } from './phrases';
import { isCorrect, score, type Result } from './score';

/** Checks the real model against our own phrases. Every phrase is a paid Claude call. */
async function main(): Promise<void> {
  if (!process.argv.includes('--spend-money')) {
    console.error('This makes 60 paid Claude calls. To run it: npm run check:phrases -- --spend-money');
    process.exitCode = 1;
    return;
  }
  const config = loadConfig(loadEnv());
  if (config.anthropicApiKey === null) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exitCode = 1;
    return;
  }

  const matcher = createMatcher(config);
  const results: Result[] = [];
  for (const phrase of PHRASES) {
    const started = performance.now();
    const match = await matcher.ask(phrase.text).then(
      (answer) => decideMatch(answer, phrase.area),
      () => null,
    );
    results.push({ phrase, match, ms: Math.round(performance.now() - started) });
  }

  for (const result of results.filter((candidate) => !isCorrect(candidate))) {
    console.log(`${result.phrase.text}\n  expected ${expected(result.phrase)}\n  got ${got(result.match)}`);
  }
  const times = results.map((result) => result.ms).sort((a, b) => a - b);
  console.log(`\n${config.claudeModel}: median ${times[Math.floor(times.length / 2)]} ms, slowest ${times.at(-1)} ms`);
  const total = score(results);
  console.log(total);
  if (!total.passed) process.exitCode = 1;
}

function expected(phrase: Phrase): string {
  return [phrase.kind, phrase.categoryIds.join(' or '), phrase.dreamId].filter(Boolean).join(', ');
}

function got(match: DreamMatch | null): string {
  if (match === null) return 'no answer';
  return [match.kind, match.categoryId, match.dreamId].filter(Boolean).join(', ');
}

void main();
