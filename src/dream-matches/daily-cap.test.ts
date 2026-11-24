import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DailyCap } from './daily-cap';

test('refuses once the limit is reached', () => {
  const cap = new DailyCap(2);
  assert.deepEqual([cap.tryTake(), cap.tryTake(), cap.tryTake()], [true, true, false]);
});

test('starts again at midnight UTC, not before', () => {
  let now = new Date('2026-11-24T00:00:00Z');
  const cap = new DailyCap(1, () => now);
  assert.equal(cap.tryTake(), true);
  now = new Date('2026-11-24T23:59:59Z');
  assert.equal(cap.tryTake(), false);
  now = new Date('2026-11-25T00:00:00Z');
  assert.equal(cap.tryTake(), true);
  assert.equal(cap.tryTake(), false);
});

test('refused takes do not eat into the next day', () => {
  let now = new Date('2026-11-24T12:00:00Z');
  const cap = new DailyCap(2, () => now);
  for (let i = 0; i < 10; i++) cap.tryTake();
  now = new Date('2026-11-25T12:00:00Z');
  assert.deepEqual([cap.tryTake(), cap.tryTake(), cap.tryTake()], [true, true, false]);
});

test('a limit of 0 refuses everything', () => {
  assert.equal(new DailyCap(0).tryTake(), false);
});
