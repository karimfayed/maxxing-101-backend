import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG, CATEGORY_IDS, DREAM_IDS, categoryOf, plannedDreams } from './catalog';

test('the catalog holds the six categories in order', () => {
  assert.deepEqual(
    CATALOG.map((category) => category.id),
    ['business', 'skill', 'fitness', 'faith', 'create', 'money'],
  );
  assert.deepEqual(CATALOG.map((category) => category.id), [...CATEGORY_IDS]);
});

test('every dream id is in the catalog exactly once', () => {
  const ids = CATALOG.flatMap((category) => category.dreams.map((dream) => dream.id));
  assert.equal(ids.length, 15);
  assert.deepEqual([...ids].sort(), [...DREAM_IDS].sort());
});

test('only product, write and make have no plan', () => {
  const unplanned = CATALOG.flatMap((category) => category.dreams.filter((dream) => !dream.hasPlan));
  assert.deepEqual(
    unplanned.map((dream) => dream.id),
    ['product', 'write', 'make'],
  );
});

test('plannedDreams lists the dreams with a plan, in catalog order', () => {
  assert.deepEqual(plannedDreams('business'), ['sell', 'cart', 'service']);
  assert.deepEqual(plannedDreams('create'), ['film']);
  assert.deepEqual(plannedDreams('faith'), ['faith']);
});

test('categoryOf finds the category a dream belongs to', () => {
  assert.equal(categoryOf('gentle'), 'fitness');
  assert.equal(categoryOf('debt'), 'money');
});
