// Chip bank rules: rewards, prices and the megaphone filter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STREAK, TASKS, BANK, installBank } from '../src/bank.js';

class FakeCafe { constructor(usd) { this.SOL_USD = usd; this.BOOST_FEE_SOL = 0.1; this.PLATE_SOL = 0.03; } }
installBank(FakeCafe);

test('the streak pays more every day for a week', () => {
  assert.equal(STREAK.length, 7);
  for (let i = 1; i < STREAK.length; i++) assert.ok(STREAK[i] > STREAK[i - 1]);
});

test('every daily task pays something', () => {
  for (const [id, n] of Object.entries(TASKS)) assert.ok(n > 0, id);
});

test('chip prices follow the live SOL price and round up to tens', () => {
  const c = new FakeCafe(200);   // 0.1 SOL at $200 = $20 = 10,000 chips
  assert.equal(c.bankPrices().boost, 10000);
  assert.equal(c.bankPrices().plate % 10, 0);
  assert.equal(new FakeCafe(0).bankPrices().boost, 0, 'no price without a live SOL price');
});

test('the megaphone and the espresso have fixed prices', () => {
  const p = new FakeCafe(150).bankPrices();
  assert.equal(p.shout, BANK.shout);
  assert.equal(p.espresso, BANK.espresso);
});

test('the megaphone drops links and odd characters and keeps it short', async () => {
  const { cleanShout } = await import('../src/bank.js');
  assert.equal(cleanShout('gm trenches! visit http://scam.xyz/claim now'), 'gm trenches! visit now');
  assert.ok(!/drainer/.test(cleanShout('free sol at drainer.fun')));
  assert.equal(cleanShout('<script>alert(1)</script>'), 'scriptalert(1)script');
  assert.ok(cleanShout('x'.repeat(200)).length <= 80);
});
