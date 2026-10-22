// RANKED ARCADE: skill games with a fixed entry fee per ranked run (paid in SOL to the cafe wallet) and weekly leaderboards.
// Nothing is ever paid out: scores are points on a board, not money. Practice runs are free and never touch the server.
// Installed onto the Cafe Durable Object by installArcade(Cafe).
import { ARC_GAMES, arcWeek, arcMakeRun, arcPublic, arcScore, ARC_GRACE_MS } from './arcade-games.js';

const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{60,100}$/;
const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const TOP_N = 10;
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const runId = () => { const a = crypto.getRandomValues(new Uint8Array(64)); let s = ''; for (const b of a) s += B58[b % 58]; return s; };   // ids for chip-paid runs share the signature format

export function installArcade(Cafe) {
  Object.assign(Cafe.prototype, {
    arcadeInit(env) {
      const fee = +env.ARCADE_RUN_SOL; this.ARCADE_RUN_SOL = fee > 0 && fee <= 1 ? fee : 0;   // 0 switches ranked runs off
      this.arcBoards = new Map();   // cache of leaderboards per key, cleared on every new score
    },
    arcadeCfg() { return { fee: this.LIVE ? this.ARCADE_RUN_SOL : 0, chips: this.ARCADE_RUN_CHIPS, games: ARC_GAMES, week: arcWeek() }; },
    async arcBest(span, game, wallet) { return (await this.ctx.storage.get(`abest:${span}:${game}:${wallet}`)) || null; },
    async arcBoard(span, game) {
      const key = span + ':' + game; if (this.arcBoards.has(key)) return this.arcBoards.get(key);
      const rows = [];
      if (game === 'all') {   // total of the best scores across every game
        const sum = new Map();
        for (const [k, v] of await this.ctx.storage.list({ prefix: `abest:${span}:` })) { const parts = k.split(':'); const w = parts[3]; const cur = sum.get(w) || { w, s: 0, n: 0, at: 0 }; cur.s += v.s; cur.n++; cur.at = Math.max(cur.at, v.at); sum.set(w, cur); }
        rows.push(...sum.values());
      } else for (const [k, v] of await this.ctx.storage.list({ prefix: `abest:${span}:${game}:` })) rows.push({ w: k.split(':')[3], s: v.s, at: v.at });
      rows.sort((a, b) => b.s - a.s || a.at - b.at);
      this.arcBoards.set(key, rows); return rows;
    },
    async arcRank(span, game, wallet) { const rows = await this.arcBoard(span, game); const i = rows.findIndex(r => r.w === wallet); return i < 0 ? 0 : i + 1; },
    async arcadeHandle(req, url, ip) {
      const path = url.pathname.slice('/api/arcade/'.length);
      const p = req.method === 'POST' ? await this.body(req, 8192).catch(() => ({})) : {};
      const wallet = this.walletOfToken(p.token || url.searchParams.get('token'));
      if (req.method === 'GET' && path === 'info') return json(200, this.arcadeCfg());
      if (req.method === 'GET' && path === 'top') {
        if (!this.allowHits('arct:' + ip, 60, 60e3)) return json(429, { error: 'slow down' });
        const game = String(url.searchParams.get('game') || 'all'), span = url.searchParams.get('span') === 'all' ? 'all' : arcWeek();
        if (game !== 'all' && !ARC_GAMES.includes(game)) return json(400, { error: 'unknown game' });
        const rows = await this.arcBoard(span, game);
        const me = wallet ? { rank: rows.findIndex(r => r.w === wallet) + 1, best: rows.find(r => r.w === wallet)?.s || 0 } : null;
        const top = await Promise.all(rows.slice(0, TOP_N).map(async r => ({ ...r, n: ((await this.profile(r.w)) || {}).nick || '' })));   // nicknames, so boards show people, not addresses
        return json(200, { game, span, week: arcWeek(), top, players: rows.length, me });
      }
      if (req.method !== 'POST') return json(405, { error: 'method' });
      if (!this.allowHits('arc:' + ip, 60, 60e3)) return json(429, { error: 'slow down' });
      if (!wallet) return json(401, { error: 'sign in with Phantom first' });
      if (path === 'run') {
        // a ranked run: one fee payment buys exactly one run. The same signature always returns the same run (safe to retry).
        const game = String(p.game || ''); if (!ARC_GAMES.includes(game)) return json(400, { error: 'unknown game' });
        if (p.pay === 'chips') {   // paid from the chip balance instead of a SOL transfer
          const cost = this.ARCADE_RUN_CHIPS; if (!cost) return json(403, { error: 'ranked runs for chips are off' });
          const left = await this.cspend(wallet, cost); if (left < 0) return json(402, { error: 'not enough chips', code: 'broke', price: cost });
          const id = runId(), rec = { wallet, game, run: arcMakeRun(game, rnd), issuedAt: Date.now(), startedAt: 0, done: false, chips: cost };
          await this.ctx.storage.put('arun:' + id, rec);
          this.log('[arcade] run', game, 'chips', wallet.slice(0, 6));
          return json(200, { ok: true, id, startedAt: 0, now: Date.now(), balance: left, ...arcPublic(rec.run) });
        }
        if (!this.LIVE || !this.ARCADE_RUN_SOL) return json(403, { error: 'ranked runs are off' });
        const sig = String(p.sig || '').trim(); if (!SIG_RE.test(sig)) return json(400, { error: 'bad signature' });
        const have = await this.ctx.storage.get('arun:' + sig);
        if (have) { if (have.wallet !== wallet) return json(403, { error: 'that payment belongs to another wallet' }); if (have.done) return json(409, { error: 'this payment was already used for a run', code: 'done' }); return json(200, { ok: true, again: true, id: sig, startedAt: have.startedAt, now: Date.now(), ...arcPublic(have.run) }); }
        const pv = await this.checkPayment(sig, this.ARCADE_RUN_SOL, wallet);
        if (pv === 'wait') return json(202, { code: 'wait', error: 'payment not visible on Solana yet' });
        if (pv === 'used') return json(409, { error: 'that payment was already used for something else', code: 'used' });
        if (pv !== 'ok') return json(402, { error: 'the entry fee payment was not found or is too small' });
        const rec = { wallet, game, run: arcMakeRun(game, rnd), issuedAt: Date.now(), startedAt: 0, done: false };
        await this.ctx.storage.put('arun:' + sig, rec);
        this.log('[arcade] run', game, wallet.slice(0, 6), sig.slice(0, 8));
        return json(200, { ok: true, id: sig, startedAt: 0, now: Date.now(), ...arcPublic(rec.run) });
      }
      const id = String(p.id || '').trim(); if (!SIG_RE.test(id)) return json(400, { error: 'bad run id' });
      const rec = await this.ctx.storage.get('arun:' + id);
      if (!rec || rec.wallet !== wallet) return json(404, { error: 'run not found' });
      if (path === 'go') {   // the clock starts when the player presses GO, not when the run was bought
        if (rec.done) return json(409, { error: 'run already finished' });
        if (!rec.startedAt) { rec.startedAt = Date.now(); await this.ctx.storage.put('arun:' + id, rec); }
        return json(200, { ok: true, startedAt: rec.startedAt, limitMs: rec.run.limitMs });
      }
      if (path === 'submit') {
        if (rec.done) return json(409, { error: 'run already finished', code: 'done' });
        if (!rec.startedAt) return json(409, { error: 'press GO first' });
        const answers = Array.isArray(p.answers) ? p.answers.slice(0, rec.run.rounds.length).map(a => typeof a === 'string' ? a.slice(0, 40) : Number.isInteger(a) ? a : -1) : [];
        const result = arcScore(rec.run, answers, Date.now() - rec.startedAt);
        rec.done = true; rec.result = { score: result.score, correct: result.correct, at: Date.now() }; await this.ctx.storage.put('arun:' + id, rec);
        const week = arcWeek(), bests = {};
        for (const span of [week, 'all']) {
          const key = `abest:${span}:${rec.game}:${wallet}`, prev = await this.ctx.storage.get(key);
          if (!prev || result.score > prev.s) { await this.ctx.storage.put(key, { s: result.score, at: Date.now() }); bests[span] = true; }
        }
        this.arcBoards.clear();
        const rank = await this.arcRank(week, rec.game, wallet), rankAll = await this.arcRank(week, 'all', wallet);
        const best = (await this.arcBest(week, rec.game, wallet))?.s || result.score;
        if (result.score >= 1000) this.broadcast({ t: 'arcade', game: rec.game, wallet, score: result.score });   // a perfect run is announced to the room
        return json(200, { ok: true, ...result, answers: rec.run.rounds.map(r => r.a), newBest: !!bests[week], best, rank, rankAll, week, grace: ARC_GRACE_MS });
      }
      return json(404, { error: 'unknown arcade call' });
    }
  });
}
