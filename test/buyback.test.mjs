// Buyback robot: the math that decides where the money goes and how big each buy is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { burnData, splitSweep, nextBuySol, BUYBACK_DEFAULTS } from '../src/buyback.js';

test('a sweep splits by the buyback share and never loses a lamport', () => {
  for (const [lamports, share] of [[1e9, 0.5], [123456789, 0.3], [5e8, 1], [5e8, 0], [777, 0.33]]) {
    const p = splitSweep(lamports, share);
    assert.equal(p.buyback + p.payout, lamports);
    assert.equal(p.buyback, Math.floor(lamports * share));
  }
  assert.deepEqual(splitSweep(1000, 7), { buyback: 1000, payout: 0 }, 'share is capped at 100%');
  assert.deepEqual(splitSweep(1000, -1), { buyback: 0, payout: 1000 });
});

test('a buy never exceeds the cap and always leaves SOL for fees', () => {
  const cfg = BUYBACK_DEFAULTS;
  for (const bal of [0.03, 0.1, 0.3, 1, 10]) for (const r of [0, 0.5, 0.999]) {
    const sol = nextBuySol(bal, cfg, () => r);
    assert.ok(sol <= cfg.maxSol, `cap at ${bal}`);
    assert.ok(sol === 0 || bal - sol >= cfg.keepSol - 1e-9, `fees left at ${bal}`);
  }
  assert.equal(nextBuySol(cfg.keepSol + cfg.minSol / 2, cfg), 0, 'dust is not traded');
});

test('buy sizes vary, so there is no fixed pattern to front-run', () => {
  const sizes = new Set([0.1, 0.3, 0.6, 0.9].map(r => nextBuySol(5, BUYBACK_DEFAULTS, () => r)));
  assert.ok(sizes.size >= 3);
});

test('the burn instruction is SPL Burn (8) with a little-endian u64 amount', () => {
  const d = burnData(1234567890123n);
  assert.equal(d.length, 9);
  assert.equal(d[0], 8);
  assert.equal(new DataView(d.buffer, d.byteOffset).getBigUint64(1, true), 1234567890123n);
});
