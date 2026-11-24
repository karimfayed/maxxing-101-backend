import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryOf } from '../dream-matches/catalog';
import { PHRASES, type Language } from './phrases';

const COUNTS: Record<string, number> = { goals: 13, unclear: 2, out_of_scope: 2, not_supported: 1, crisis: 2 };

for (const language of ['en', 'ar', 'franco'] satisfies Language[]) {
  test(`${language} has 20 phrases of the planned kinds`, () => {
    const counts: Record<string, number> = {};
    for (const phrase of PHRASES.filter((candidate) => candidate.language === language)) {
      const kind = phrase.kind === 'matched' || phrase.kind === 'no_plan' ? 'goals' : phrase.kind;
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    assert.deepEqual(counts, COUNTS);
  });

  test(`${language} has two phrases for every category, besides the one that gives orders`, () => {
    const counts: Record<string, number> = {};
    for (const phrase of PHRASES) {
      if (phrase.language !== language || phrase.givesOrders || phrase.categoryIds[0] === undefined) continue;
      counts[phrase.categoryIds[0]] = (counts[phrase.categoryIds[0]] ?? 0) + 1;
    }
    assert.deepEqual(counts, { business: 2, skill: 2, fitness: 2, faith: 2, create: 2, money: 2 });
    assert.equal(PHRASES.filter((phrase) => phrase.language === language && phrase.givesOrders).length, 1);
  });
}

test('the ambiguous and wrong-area examples are included', () => {
  const tenK = PHRASES.find((phrase) => phrase.text === 'reach 10k');
  assert.deepEqual(tenK?.categoryIds, ['fitness', 'money']);
  const guitar = PHRASES.find((phrase) => phrase.text === 'learn guitar');
  assert.equal(guitar?.area, 'fitness');
  assert.deepEqual(guitar?.categoryIds, ['skill']);
});

test('every phrase is one the endpoint would accept, and none is repeated', () => {
  for (const phrase of PHRASES) assert.ok(phrase.text.trim() !== '' && [...phrase.text].length <= 200);
  assert.equal(new Set(PHRASES.map((phrase) => phrase.text)).size, PHRASES.length);
});

test('every expected dream is in one of its expected categories', () => {
  for (const phrase of PHRASES) {
    if (phrase.dreamId !== undefined) assert.ok(phrase.categoryIds.includes(categoryOf(phrase.dreamId)));
  }
});
