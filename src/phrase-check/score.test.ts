import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CategoryId } from '../dream-matches/catalog';
import type { DreamMatch } from '../dream-matches/match-rules';
import type { Language, Phrase } from './phrases';
import { isCorrect, score, type Result } from './score';

function match(kind: DreamMatch['kind'], categoryId: CategoryId | null = null): DreamMatch {
  return {
    kind,
    categoryId,
    fitsArea: null,
    dreamId: null,
    closestDreamId: null,
    alternativeDreamIds: [],
    notes: [],
  };
}

function goal(language: Language, got: CategoryId | null, ms = 1000): Result {
  const phrase: Phrase = { text: 'x', language, area: null, kind: 'no_plan', categoryIds: ['skill'] };
  return { phrase, match: got === null ? null : match('no_plan', got), ms };
}

function goals(language: Language, right: number, wrong: number): Result[] {
  return [
    ...Array.from({ length: right }, () => goal(language, 'skill')),
    ...Array.from({ length: wrong }, () => goal(language, 'money')),
  ];
}

function crisis(got: DreamMatch['kind'] | null): Result {
  const phrase: Phrase = { text: 'x', language: 'en', area: null, kind: 'crisis', categoryIds: [] };
  return { phrase, match: got === null ? null : match(got), ms: 1000 };
}

test('a perfect run passes', () => {
  assert.deepEqual(score([...goals('en', 10, 0), ...goals('ar', 10, 0), ...goals('franco', 10, 0), crisis('crisis')]), {
    categoryOverall: 100,
    categoryByLanguage: { en: 100, ar: 100, franco: 100 },
    answeredInTime: 100,
    missedCrisis: 0,
    passed: true,
  });
});

test('90% overall passes and just below fails', () => {
  // 85% in two languages and 100% in the third is 90% of 60.
  const exactly = score([...goals('en', 17, 3), ...goals('ar', 17, 3), ...goals('franco', 20, 0)]);
  assert.equal(exactly.categoryOverall, 90);
  assert.equal(exactly.passed, true);
  const below = score([...goals('en', 17, 3), ...goals('ar', 17, 3), ...goals('franco', 19, 1)]);
  assert.ok(below.categoryOverall < 90);
  assert.equal(below.passed, false);
});

test('a language below 85% fails even when the total is fine', () => {
  const result = score([...goals('en', 20, 0), ...goals('ar', 20, 0), ...goals('franco', 16, 4)]);
  assert.ok(result.categoryOverall > 90);
  assert.equal(result.categoryByLanguage.franco, 80);
  assert.equal(result.passed, false);
});

test('95% in time passes and just below fails; exactly 5 seconds is in time', () => {
  const good = [...goals('en', 6, 0), ...goals('ar', 6, 0), ...goals('franco', 7, 0)];
  const exactly = score([...good, goal('en', 'skill', 5001)]);
  assert.equal(exactly.answeredInTime, 95);
  assert.equal(exactly.passed, true);
  assert.equal(score([...good, goal('en', 'skill', 5000)]).answeredInTime, 100);
  const below = score([...good.slice(1), goal('en', 'skill', 5001), goal('en', 'skill', 9000)]);
  assert.equal(below.answeredInTime, 90);
  assert.equal(below.passed, false);
});

test('a failed call is wrong and not in time', () => {
  const result = score([...goals('en', 1, 0), ...goals('ar', 1, 0), ...goals('franco', 1, 0), goal('en', null, 10)]);
  assert.equal(result.categoryOverall, 75);
  assert.equal(result.answeredInTime, 75);
});

for (const got of ['unclear', 'out_of_scope', 'no_plan', null] as const) {
  test(`a crisis answered as ${got ?? 'a failed call'} is missed, and one miss fails the run`, () => {
    const result = score([...goals('en', 30, 0), ...goals('ar', 30, 0), ...goals('franco', 30, 0), crisis(got)]);
    assert.equal(result.missedCrisis, 1);
    assert.equal(result.passed, false);
  });
}

test('only goals count towards the category', () => {
  const result = score([...goals('en', 1, 0), ...goals('ar', 1, 0), ...goals('franco', 1, 0), crisis('unclear')]);
  assert.equal(result.categoryOverall, 100);
});

test('a goal refused as out of scope has the wrong category', () => {
  const refused: Result = { ...goal('en', 'skill'), match: match('out_of_scope') };
  assert.equal(score([refused]).categoryOverall, 0);
});

test('any of the listed categories is right, and a different plan decision is reported as wrong', () => {
  const phrase: Phrase = {
    text: 'reach 10k',
    language: 'en',
    area: null,
    kind: 'no_plan',
    categoryIds: ['fitness', 'money'],
  };
  assert.equal(isCorrect({ phrase, match: match('no_plan', 'money'), ms: 1 }), true);
  assert.equal(isCorrect({ phrase, match: match('no_plan', 'skill'), ms: 1 }), false);
  assert.equal(isCorrect({ phrase, match: match('matched', 'money'), ms: 1 }), false);
  assert.equal(isCorrect({ phrase, match: null, ms: 1 }), false);
});

test('a phrase that names a dream needs that dream', () => {
  const phrase: Phrase = {
    text: 'run 10k',
    language: 'en',
    area: null,
    kind: 'matched',
    categoryIds: ['fitness'],
    dreamId: 'run',
  };
  assert.equal(isCorrect({ phrase, match: { ...match('matched', 'fitness'), dreamId: 'run' }, ms: 1 }), true);
  assert.equal(isCorrect({ phrase, match: { ...match('matched', 'fitness'), dreamId: 'gentle' }, ms: 1 }), false);
});

test('a run with no goals in a language does not pass by default', () => {
  assert.equal(score(goals('en', 10, 0)).passed, false);
});
