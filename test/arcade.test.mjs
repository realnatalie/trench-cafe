// Ranked arcade rules: these run on the server to score paid runs, so they must be deterministic and hard to game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARC_SPEC, ARC_GAMES, ARC_GRACE_MS, arcWeek, arcMakeRun, arcPublic, arcScore, arcCheck } from '../src/arcade-games.js';

/** a seeded random source, so a run can be rebuilt exactly */
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const perfect = run => run.rounds.map(r => r.a);

test('every game builds a run with the advertised number of rounds', () => {
  for (const g of ARC_GAMES) {
    const run = arcMakeRun(g, seeded(1));
    assert.equal(run.rounds.length, ARC_SPEC[g].rounds, g);
    assert.equal(run.kind, ARC_SPEC[g].kind);
    for (const r of run.rounds) assert.ok(r.a !== undefined && r.a !== null, `${g}: every round has an answer`);
  }
});

test('the same seed gives the same run', () => {
  for (const g of ARC_GAMES) assert.deepEqual(arcMakeRun(g, seeded(42)), arcMakeRun(g, seeded(42)), g);
});

test('the public copy of a run never leaks the answers', () => {
  for (const g of ARC_GAMES) {
    const pub = JSON.stringify(arcPublic(arcMakeRun(g, seeded(7))));
    assert.ok(!/"a":/.test(pub), `${g}: no answer field in the public run`);
  }
});

test('a perfect fast run scores between 1000 and 1100', () => {
  for (const g of ARC_GAMES) {
    const run = arcMakeRun(g, seeded(3)), res = arcScore(run, perfect(run), 1000);
    assert.equal(res.correct, res.total);
    assert.ok(res.score >= 1000 && res.score <= 1100, `${g}: ${res.score}`);
  }
});

test('wrong answers lower the score, empty answers score zero', () => {
  const run = arcMakeRun('rug', seeded(9));
  const half = perfect(run).map((a, i) => (i % 2 ? a : (a === 0 ? 1 : 0)));
  assert.ok(arcScore(run, half, 1000).score < arcScore(run, perfect(run), 1000).score);
  assert.equal(arcScore(run, [], 1000).score, 0);
});

test('a run that overshoots the time limit plus grace scores zero', () => {
  const run = arcMakeRun('pnl', seeded(5));
  const res = arcScore(run, perfect(run), run.limitMs + ARC_GRACE_MS + 1);
  assert.equal(res.late, true);
  assert.equal(res.score, 0);
});

test('typed answers are compared case- and space-insensitively', () => {
  const run = arcMakeRun('type', seeded(11)), r = run.rounds[0];
  assert.equal(arcCheck('type', r, '  ' + r.a.toLowerCase().replace(/ /g, '   ') + ' '), true);
  assert.equal(arcCheck('type', r, r.a + 'X'), false);
});

test('week keys look like 2026-W43 and change on Monday', () => {
  assert.match(arcWeek(Date.UTC(2026, 9, 22)), /^\d{4}-W\d{2}$/);
  assert.equal(arcWeek(Date.UTC(2026, 9, 25, 23)), arcWeek(Date.UTC(2026, 9, 19, 1)));   // Sunday and the Monday before
  assert.notEqual(arcWeek(Date.UTC(2026, 9, 26, 1)), arcWeek(Date.UTC(2026, 9, 25, 23)));  // the next Monday
});
