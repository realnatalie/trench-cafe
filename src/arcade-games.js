/* ================= RANKED ARCADE: the games =================
   One file, used twice: the server issues and scores ranked runs with it, the browser runs free practice with it.
   Everything here is deterministic given the random source. A run is a list of rounds; every round has a display
   payload `q` (numbers only, the browser writes the words in the player's language) and a hidden answer `a`.
   Scores are points on a board. They are never money. */
const ARC_SPEC = {
  rug: { rounds: 10, roundMs: 7000, kind: 'pick' },     // Rug Radar: read a token card, call RUG or SAFE
  pnl: { rounds: 8, roundMs: 12000, kind: 'pick' },     // Degen Math: bags, percentages, fees
  addr: { rounds: 8, roundMs: 10000, kind: 'addr' },    // Address Lock: memorize a wallet, spot it among look-alikes
  chart: { rounds: 8, roundMs: 10000, kind: 'chart' },  // Chart Eye: read the candles, name the move
  type: { rounds: 12, roundMs: 6000, kind: 'type' },    // Ticker Sprint: type the trench slang fast and clean
  quant: { rounds: 10, roundMs: 8000, kind: 'pick' }    // Quant Sprint: sequences, spreads, routes, tiny decimals
};
const ARC_GAMES = Object.keys(ARC_SPEC);
const ARC_GRACE_MS = 10000;
const ARC_PREFIX = ['MOON', 'PEPE', 'DOGE', 'WIF', 'BONK', 'CHAD', 'GIGA', 'TURBO', 'BABY', 'FLOKI', 'WOJAK', 'PUMP', 'TRENCH', 'LATTE', 'MUG', 'SIGMA', 'ZOOMER', 'BOOMER', 'HAWK', 'FROG', 'CAT', 'RAT', 'GOAT', 'PONKE', 'MEW'];
const ARC_SUFFIX = ['INU', 'COIN', 'AI', '2', 'CAT', 'X', 'FI', 'ROCKET', 'WIF', 'DAO', '69', '420', 'KING', 'LORD', 'BOT'];
const ARC_WORDS = ['WAGMI', 'NGMI', 'HODL', 'GM', 'DEGEN', 'RUGPULL', 'SEND IT', 'APE IN', 'DIAMOND HANDS', 'PAPER HANDS', 'MOONSHOT', 'BONDING CURVE', 'LIQUIDITY', 'TRENCHES', 'COPE', 'FOMO', 'FUD', 'REKT', 'ALPHA', 'SNIPER', 'JEET', 'BAGHOLDER', 'PUMP IT', 'LFG', 'CHAD', 'WHALE', 'AIRDROP', 'MINT', 'FLOOR', 'MCAP', 'DEV SOLD', 'KING OF THE HILL', 'RAYDIUM', 'PHANTOM', 'SOLANA', 'SLIPPAGE', 'PRIORITY FEE', 'TOP BLAST', 'DUST', 'MIGRATED', 'GRADUATED', 'LATTE', 'MUG LIFE'];
const ARC_B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function arcWeek(ts = Date.now()) {   // ISO week key: the season of the leaderboard
  const d = new Date(ts); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}
function arcLimit(game) { const s = ARC_SPEC[game]; return s ? s.rounds * s.roundMs + 3000 : 0; }
function arcShuffle4(correct, decoys, rnd) {   // 4 unique choices with the correct one at a random slot
  const seen = new Set([correct]), others = [];
  for (const d of decoys) { if (!seen.has(d)) { seen.add(d); others.push(d); } if (others.length === 3) break; }
  if (others.length < 3) throw new Error('not enough decoys');
  const a = Math.floor(rnd() * 4), choices = others.slice(); choices.splice(a, 0, correct);
  return { choices, a };
}
function arcMakeRound(game, rnd) {
  const pick = n => Math.floor(rnd() * n), from = arr => arr[pick(arr.length)], between = (lo, hi) => lo + pick(hi - lo + 1);
  if (game === 'rug') {
    // a token card. RUG if the mint is still open, the LP is unlocked, the top 10 hold half or the dev holds a fifth.
    const rug = rnd() < 0.5, name = from(ARC_PREFIX) + from(ARC_SUFFIX);
    const q = { name, top10: between(12, 44), dev: between(1, 15), lp: from(['locked', 'burned']), mint: 'revoked', age: between(1, 96), social: rnd() < 0.8 };
    if (rug) { const flaws = [() => q.mint = 'active', () => q.lp = 'unlocked', () => q.top10 = between(50, 92), () => q.dev = between(20, 60)]; const n = rnd() < 0.3 ? 2 : 1; const used = new Set(); while (used.size < n) { const i = pick(4); if (!used.has(i)) { used.add(i); flaws[i](); } } }
    return { q, a: rug ? 1 : 0 };
  }
  if (game === 'pnl') {
    const kind = from(['bag', 'bag', 'pct', 'pct', 'fee', 'x']);
    if (kind === 'bag') { const bag = from([0.2, 0.4, 0.5, 1, 2, 2.5]), ratio = from([2, 3, 4, 5, 0.5, 1.5, 10, 0.25]), buy = from([5, 8, 10, 12, 20, 25, 40, 50]); const now = +(buy * ratio).toFixed(2); const ans = +(bag * ratio).toFixed(3); return { q: { kind, bag, buy, now, unit: 'SOL', ...arcShuffle4(ans, [+(bag * ratio * 2).toFixed(3), +(bag * ratio / 2).toFixed(3), +(bag * (ratio + 1)).toFixed(3), +(bag * Math.max(0.1, ratio - 1)).toFixed(3), +(bag + ratio).toFixed(3)], rnd) }, a: null }; }
    if (kind === 'pct') { const pct = from([25, 50, 100, 150, 200, 300, -20, -25, -50, -75]), p = from([0.002, 0.004, 0.008, 0.01, 0.02, 0.05, 0.1]); const qv = +(p * (1 + pct / 100)).toPrecision(3); const decoys = [25, 50, 100, 150, 200, 300, -20, -25, -50, -75].filter(x => x !== pct).sort(() => rnd() - 0.5); return { q: { kind, p, qv, unit: '%', ...arcShuffle4(pct, decoys, rnd) }, a: null }; }
    if (kind === 'fee') { const amt = from([0.8, 2.5, 4, 10, 12.5, 25, 40]), fee = from([1, 2, 0.5]); const ans = +(amt * fee / 100).toFixed(4); return { q: { kind, amt, fee, unit: 'SOL', ...arcShuffle4(ans, [+(amt * fee / 10).toFixed(4), +(amt * fee / 1000).toFixed(4), +(amt * (fee + 1) / 100).toFixed(4), +(amt * fee / 50).toFixed(4)], rnd) }, a: null }; }
    const start = from([10, 20, 25, 40, 50, 80, 100]), x = from([2, 4, 5, 8, 10, 20, 25, 50, 100]); const end = start * x; return { q: { kind: 'x', start, end, unit: 'x', ...arcShuffle4(x, [x * 2, Math.max(1, x / 2), x + 5, x * 10, x - 1].filter(v => v > 0), rnd) }, a: null };
  }
  if (game === 'addr') {
    const b58 = n => { let s = ''; for (let i = 0; i < n; i++) s += ARC_B58[pick(ARC_B58.length)]; return s; };
    const real = b58(44), head = real.slice(0, 4), tail = real.slice(-4);
    const decoys = []; while (decoys.length < 3) { const d = head + b58(36) + tail; if (d !== real && !decoys.includes(d)) decoys.push(d); }
    const sh = arcShuffle4(real, decoys, rnd); return { q: { show: real, choices: sh.choices }, a: sh.a };
  }
  if (game === 'chart') {
    // a random walk of 20 candles; the question is the move from the first open to the last close, in percent
    let p = 100; const candles = []; const drift = (rnd() - 0.5) * 0.06;
    for (let i = 0; i < 20; i++) { const o = p; let c = o * (1 + drift + (rnd() - 0.5) * 0.12); c = Math.max(20, c); const h = Math.max(o, c) * (1 + rnd() * 0.04), l = Math.min(o, c) * (1 - rnd() * 0.04); candles.push([+o.toFixed(2), +h.toFixed(2), +l.toFixed(2), +c.toFixed(2)]); p = c; }
    const ans = Math.round((candles[19][3] / candles[0][0] - 1) * 100);
    const decoys = [ans + 12, ans - 12, ans + 25, ans - 25, -ans, ans + 40].filter(v => Math.abs(v - ans) >= 8).sort(() => rnd() - 0.5);
    const sh = arcShuffle4(ans, decoys, rnd); return { q: { candles, unit: '%', choices: sh.choices }, a: sh.a };
  }
  if (game === 'type') { const word = from(ARC_WORDS); return { q: { word }, a: word }; }
  // quant
  const kind = from(['seq', 'seq', 'spread', 'route', 'dec', 'geo']);
  if (kind === 'seq') { const start = between(3, 40), step = between(2, 12); const seq = [start, start + step, start + 2 * step, start + 3 * step], ans = start + 4 * step; const sh = arcShuffle4(ans, [ans + 1, ans - step, ans + step, ans + 2], rnd); return { q: { kind, seq, choices: sh.choices }, a: sh.a }; }
  if (kind === 'geo') { const start = from([1, 2, 3, 5]), m = from([2, 3]); const seq = [start, start * m, start * m * m, start * m * m * m], ans = start * m ** 4; const sh = arcShuffle4(ans, [ans + start, ans * m, ans - start * m, ans + m], rnd); return { q: { kind: 'seq', seq, choices: sh.choices }, a: sh.a }; }
  if (kind === 'spread') { const bid = between(80, 400), spread = between(2, 15), ask = bid + spread; const sh = arcShuffle4(spread, [spread + 1, spread + 2, spread - 1, spread + 3].filter(v => v > 0), rnd); return { q: { kind, bid, ask, choices: sh.choices }, a: sh.a }; }
  if (kind === 'dec') { const e = between(3, 6), base = Math.pow(10, -e); const vals = new Set(); while (vals.size < 4) vals.add(+(base * between(11, 99)).toPrecision(2)); const choices = [...vals].sort(() => rnd() - 0.5); const ans = Math.max(...choices); return { q: { kind, choices }, a: choices.indexOf(ans) }; }
  const base = between(8, 40), fees = [base, base + between(2, 6), base + between(7, 12), base + between(13, 20)].sort(() => rnd() - 0.5); return { q: { kind: 'route', fees, choices: ['A', 'B', 'C', 'D'] }, a: fees.indexOf(Math.min(...fees)) };
}
function arcMakeRun(game, rnd = Math.random) {
  const spec = ARC_SPEC[game]; if (!spec) throw new Error('unknown game');
  const rounds = []; for (let i = 0; i < spec.rounds; i++) { const r = arcMakeRound(game, rnd); if (r.a === null) r.a = r.q.a, delete r.q.a; rounds.push(r); }
  return { game, kind: spec.kind, roundMs: spec.roundMs, limitMs: arcLimit(game), rounds };
}
function arcPublic(run) { return { game: run.game, kind: run.kind, roundMs: run.roundMs, limitMs: run.limitMs, rounds: run.rounds.map(r => ({ q: r.q })) }; }
function arcCheck(game, round, answer) {
  if (game === 'type') return typeof answer === 'string' && answer.trim().replace(/\s+/g, ' ').toUpperCase() === round.a;
  return Number.isInteger(answer) && answer === round.a;
}
/* score = up to 1000 for accuracy + a speed bonus (up to 100, scaled by accuracy): every game tops out at 1100.
   A run that overshoots its time limit scores 0. */
function arcScore(run, answers, elapsedMs) {
  const limit = run.limitMs || arcLimit(run.game), list = Array.isArray(answers) ? answers : [];
  const per = run.rounds.map((r, i) => arcCheck(run.game, r, list[i]));
  const correct = per.filter(Boolean).length, total = run.rounds.length;
  const late = !(elapsedMs >= 0) || elapsedMs > limit + ARC_GRACE_MS;
  const bonus = late ? 0 : Math.round(100 * (correct / total) * Math.max(0, 1 - elapsedMs / limit));
  return { correct, total, score: late ? 0 : Math.round(1000 * correct / total) + bonus, bonus, late, per, elapsedMs: Math.max(0, Math.round(elapsedMs || 0)) };
}
export { ARC_SPEC, ARC_GAMES, ARC_GRACE_MS, arcWeek, arcLimit, arcMakeRun, arcPublic, arcScore, arcCheck };
