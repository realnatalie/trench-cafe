// Daily crates: the server and every browser must agree on today's spots without talking to each other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRATE_SPOTS, HUNT, huntDay, dailyCrates } from '../src/hunt-data.js';

test('the same day gives the same crates for everyone', () => {
  assert.deepEqual(dailyCrates('2026-10-23'), dailyCrates('2026-10-23'));
});

test('a day has the advertised number of distinct, valid crate spots', () => {
  for (const day of ['2026-10-23', '2026-10-24', '2027-01-01']) {
    const c = dailyCrates(day);
    assert.equal(c.length, HUNT.daily);
    assert.equal(new Set(c).size, c.length, 'no duplicates');
    for (const i of c) assert.ok(i >= 0 && i < CRATE_SPOTS.length);
  }
});

test('the spots change from day to day', () => {
  const days = Array.from({ length: 10 }, (_, i) => dailyCrates(huntDay(Date.UTC(2026, 9, 1 + i))).join(','));
  assert.ok(new Set(days).size > 5);
});
