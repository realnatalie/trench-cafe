// TRENCH LEAGUE: every coin launched here is an agent in a weekly league. Players back agents with chips, the agent whose coin
// hits the highest market cap during the week wins: its backers split the whole backing pool, its launcher takes a cut and a
// trophy in the vault. Launchers also earn small chip royalties whenever someone trades their coin. Chips only, never SOL.
// Installed onto the Cafe Durable Object by installLeague(Cafe).
import { arcWeek } from './arcade-games.js';
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const BACK_MIN = 50, BACK_MAX = 5000, BACK_WALLET_MAX = 20000, ROYALTY = 5, ROYALTY_DAY_CAP = 200, LAUNCHER_CUT = 0.1, CHAMPS_KEPT = 8;
const dayKey = () => new Date().toISOString().slice(0, 10);
function weekEnd(ts = Date.now()) {   // next Monday 00:00 UTC
  const d = new Date(ts); d.setUTCHours(0, 0, 0, 0); const dow = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + (8 - dow)); return d.getTime();
}
export function installLeague(Cafe) {
  Object.assign(Cafe.prototype, {
    async leagueLoad() {
      const week = arcWeek();
      this.LG = (await this.ctx.storage.get('league:cur')) || { week, coins: {} };
      this.CHAMPS = (await this.ctx.storage.get('champs')) || [];
      await this.leagueSettle();
    },
    leagueSave() { if (this.lgSaveT) return; this.lgSaveT = setTimeout(() => { this.lgSaveT = null; this.ctx.storage.put('league:cur', this.LG).catch(() => { }); }, 1500); },
    leagueCoin(mint) {
      if (!this.LG) return null; const a = this.agents.find(x => x.mint === mint); if (!a) return null;
      return this.LG.coins[mint] || (this.LG.coins[mint] = { pool: 0, backers: {}, peak: 0, trades: 0 });
    },
    leaguePeak(mint, mc) { const c = this.leagueCoin(mint); if (!c || !(mc > c.peak)) return; c.peak = Math.round(mc); this.leagueSave(); },
    leaguePeaks(px) { for (const mint in px) if (px[mint] && px[mint].mc > 0) this.leaguePeak(mint, px[mint].mc); },
    async leagueTrade(tx) {   // called for every live trade on a coin launched here
      const a = this.agents.find(x => x.mint === tx.mint); if (!a) return;
      const c = this.leagueCoin(tx.mint); if (c) { c.trades++; if (tx.mcapSol > 0 && this.SOL_USD > 0) this.leaguePeak(tx.mint, tx.mcapSol * this.SOL_USD); else this.leagueSave(); }
      if (!a.wallet || tx.trader === a.wallet) return;   // no royalties on your own trades
      const key = 'roy:' + dayKey() + ':' + tx.mint, paid = (await this.ctx.storage.get(key)) || 0;
      if (paid >= ROYALTY_DAY_CAP) return;
      await this.ctx.storage.put(key, paid + ROYALTY);
      const bal = await this.cset(a.wallet, (await this.cbal(a.wallet)) + ROYALTY);
      this.sendToWallet(a.wallet, { t: 'chips', balance: bal, delta: ROYALTY, why: 'royalty', sym: a.sym });
    },
    async leagueSettle() {
      const week = arcWeek(); if (!this.LG || this.LG.week === week) return;
      const old = this.LG; this.LG = { week, coins: {} }; await this.ctx.storage.put('league:cur', this.LG);
      const entries = Object.entries(old.coins).filter(([mint]) => this.agents.some(a => a.mint === mint));
      const pool = entries.reduce((s, [, c]) => s + c.pool, 0), active = entries.some(([, c]) => c.peak > 0 || c.pool > 0 || c.trades > 0);
      if (entries.length && active) {
        entries.sort((p, q) => q[1].peak - p[1].peak || q[1].pool - p[1].pool || q[1].trades - p[1].trades);
        const [mint, win] = entries[0], a = this.agents.find(x => x.mint === mint);
        const stake = Object.values(win.backers).reduce((s, v) => s + v, 0), paid = {};
        if (stake === 0 && !a.wallet) {   // nobody to pay: every backer gets their chips back
          for (const [, c] of entries) for (const [w, v] of Object.entries(c.backers)) paid[w] = (paid[w] || 0) + v;
        } else {
          const cut = Math.floor(pool * LAUNCHER_CUT), share = pool - cut;
          if (stake > 0) for (const [w, v] of Object.entries(win.backers)) { const amt = Math.floor(share * v / stake); if (amt > 0) paid[w] = (paid[w] || 0) + amt; }
          if (a.wallet) paid[a.wallet] = (paid[a.wallet] || 0) + cut + (stake > 0 ? 0 : share);
        }
        for (const [w, amt] of Object.entries(paid)) { const bal = await this.cset(w, (await this.cbal(w)) + amt); this.sendToWallet(w, { t: 'chips', balance: bal, delta: amt, why: 'league', sym: a.sym }); }
        const champ = { week: old.week, mint, sym: a.sym, name: a.name, image: a.image || '', body: a.body, by: a.by || '', wallet: a.wallet || '', pool, peak: win.peak, backers: Object.keys(win.backers).length, at: Date.now() };
        this.CHAMPS.unshift(champ); this.CHAMPS.length = Math.min(this.CHAMPS.length, CHAMPS_KEPT); await this.ctx.storage.put('champs', this.CHAMPS);
        this.broadcast({ t: 'champion', champ }); this.log('[league]', old.week, 'champion $' + a.sym, 'pool', pool);
      }
      await this.ctx.storage.put('league:' + old.week, old);
    },
    leagueView(wallet) {
      const zero = { pool: 0, backers: {}, peak: 0, trades: 0 };   // every launched coin is in the league from its first minute
      const coins = this.agents.filter(a => a.mint).slice(-60).map(a => { const c = (this.LG && this.LG.coins[a.mint]) || zero; return { mint: a.mint, sym: a.sym, name: a.name, image: a.image || '', body: a.body, by: a.by || '', pool: c.pool, backers: Object.keys(c.backers).length, peak: c.peak, trades: c.trades, mine: (wallet && c.backers[wallet]) || 0, own: !!(wallet && a.wallet === wallet), at: a.at }; });
      coins.sort((p, q) => q.peak - p.peak || q.pool - p.pool || q.trades - p.trades || q.at - p.at);
      return { week: this.LG ? this.LG.week : arcWeek(), endsAt: weekEnd(), coins, champs: this.CHAMPS.slice(0, 4), rules: { min: BACK_MIN, max: BACK_MAX, cut: LAUNCHER_CUT, royalty: ROYALTY, royaltyCap: ROYALTY_DAY_CAP } };
    },
    async leagueHandle(req, url, ip) {
      const p = req.method === 'POST' ? await this.body(req, 2048).catch(() => ({})) : {};
      const wallet = this.walletOfToken(p.token || url.searchParams.get('token'));
      if (req.method === 'GET' && url.pathname === '/api/league') return json(200, this.leagueView(wallet));
      if (req.method === 'POST' && url.pathname === '/api/league/back') {
        if (!wallet) return json(401, { error: 'sign in with Phantom first' });
        if (!this.allowHits('lg:' + wallet, 30, 60e3)) return json(429, { error: 'slow down' });
        const mint = String(p.mint || ''), chips = Math.floor(+p.chips);
        const c = this.leagueCoin(mint); if (!c) return json(400, { error: 'that coin is not in the league' });
        if (!(chips >= BACK_MIN && chips <= BACK_MAX)) return json(400, { error: `back with ${BACK_MIN} to ${BACK_MAX} chips at a time` });
        if ((c.backers[wallet] || 0) + chips > BACK_WALLET_MAX) return json(400, { error: 'that is already a big bag on one agent' });
        const left = await this.cspend(wallet, chips); if (left < 0) return json(402, { error: 'not enough chips', code: 'broke' });
        c.pool += chips; c.backers[wallet] = (c.backers[wallet] || 0) + chips; this.leagueSave(); await this.bankMark(wallet, 'lg');
        const a = this.agents.find(x => x.mint === mint);
        this.broadcast({ t: 'league', mint, pool: c.pool, backers: Object.keys(c.backers).length });
        if (a && a.wallet && a.wallet !== wallet) this.sendToWallet(a.wallet, { t: 'backed', sym: a.sym, chips });
        this.log('[league] back', a ? a.sym : mint, chips, wallet.slice(0, 6));
        return json(200, { ok: true, balance: left, pool: c.pool, mine: c.backers[wallet] });
      }
      return json(404, { error: 'unknown league call' });
    }
  });
}
