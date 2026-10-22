// CHIP BANK: everything a signed-in player can earn chips with and spend chips on, outside the casino tables.
// Earn: a daily login streak, three daily tasks the server can see for itself, friends who come in with your invite pass.
// Spend: a boost on the big screen, a name plate on your coin's desk, the megaphone, a double-XP espresso at the bar.
// Chips stay a play currency: nothing here turns chips into SOL or anything else that leaves the game.
// Installed onto the Cafe Durable Object by installBank(Cafe).
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);
const CHIPS_PER_USD = 500;
export const STREAK = [50, 75, 100, 150, 200, 250, 400];   // day 1..7, then 400 every day while the streak holds
export const TASKS = { rk: 150, lg: 50, crate: 50 };        // a ranked arcade run, backing a coin in the league, opening a crate
export const BANK = { shout: 300, espresso: 400, espressoMin: 60, invite: 300, inviteWeekCap: 20, shoutGap: 15e3, logKeep: 20 };
export const cleanShout = s => String(s || '')
  .replace(/https?:\/\/\S+|www\.\S+|\b\S+\.(com|io|xyz|fun|gg|net|org|app|me|sh|ru|link)\b/gi, '')   // no links on the megaphone
  .replace(/[^\w\-\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF .,!?$#@:'·()]/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, 80);

export function installBank(Cafe) {
  Object.assign(Cafe.prototype, {
    solChips(sol) { return this.SOL_USD > 0 && sol > 0 ? Math.ceil(sol * this.SOL_USD * CHIPS_PER_USD / 10) * 10 : 0; },   // 0 = no live SOL price yet
    bankPrices() { return { boost: this.BOOST_FEE_SOL ? this.solChips(this.BOOST_FEE_SOL) : 0, plate: this.PLATE_SOL ? this.solChips(this.PLATE_SOL) : 0, shout: BANK.shout, espresso: BANK.espresso, espressoMin: BANK.espressoMin }; },
    async bankLog(w, d, why) {
      const k = 'bank:log:' + w, list = (await this.ctx.storage.get(k)) || [];
      list.unshift({ at: Date.now(), d, why }); await this.ctx.storage.put(k, list.slice(0, BANK.logKeep));
    },
    async bankEarn(w, n, why) { const bal = await this.cadd(w, n, why); await this.bankLog(w, n, why); return bal; },
    async bankPay(w, n, why) { const left = await this.cspend(w, n); if (left >= 0) { await this.bankLog(w, -n, why); this.sendToWallet(w, { t: 'chips', balance: left, delta: -n, why }); } return left; },
    async bankMark(w, task) { if (w && TASKS[task]) await this.ctx.storage.put(`bank:did:${dayKey()}:${task}:${w}`, true); },   // called by the arcade, the league and the hunt
    async bankState(w) {
      const today = dayKey(), yday = dayKey(Date.now() - 864e5);
      const st = (await this.ctx.storage.get('bank:streak:' + w)) || { last: '', n: 0 };
      const alive = st.last === today || st.last === yday, n = alive ? st.n : 0, claimed = st.last === today;
      const next = STREAK[Math.min(STREAK.length - 1, n)];   // what the next claim pays: today's if not claimed yet, else tomorrow's
      const tasks = [];
      for (const id of Object.keys(TASKS)) {
        const done = !!(await this.ctx.storage.get(`bank:did:${today}:${id}:${w}`)), got = !!(await this.ctx.storage.get(`bank:got:${today}:${id}:${w}`));
        tasks.push({ id, reward: TASKS[id], done, claimed: got });
      }
      return { balance: await this.cbal(w), streak: { n, claimed, next, table: STREAK }, tasks, prices: this.bankPrices(), log: (await this.ctx.storage.get('bank:log:' + w)) || [], espressoUntil: (await this.ctx.storage.get('bank:esp:' + w)) || 0 };
    },
    async bankHandle(req, url, ip) {
      const path = url.pathname.slice('/api/bank/'.length);
      const p = req.method === 'POST' ? await this.body(req, 2048).catch(() => ({})) : {};
      const wallet = this.walletOfToken(p.token || url.searchParams.get('token'));
      if (!wallet) return json(401, { error: 'sign in with Phantom first' });
      if (!this.allowHits('bank:' + wallet, 60, 60e3)) return json(429, { error: 'slow down' });
      if (path === 'info') return json(200, await this.bankState(wallet));
      if (req.method !== 'POST') return json(405, { error: 'POST only' });
      if (path === 'daily') {   // one claim per UTC day; missing a day starts the streak again
        const today = dayKey(), yday = dayKey(Date.now() - 864e5), k = 'bank:streak:' + wallet;
        const st = (await this.ctx.storage.get(k)) || { last: '', n: 0 };
        if (st.last === today) return json(200, { ok: false, why: 'claimed', ...(await this.bankState(wallet)) });
        const n = st.last === yday ? st.n + 1 : 1, pay = STREAK[Math.min(STREAK.length, n) - 1];
        await this.ctx.storage.put(k, { last: today, n });
        await this.bankEarn(wallet, pay, 'daily');
        return json(200, { ok: true, credited: pay, day: n, ...(await this.bankState(wallet)) });
      }
      if (path === 'task') {
        const id = String(p.id || ''); if (!TASKS[id]) return json(400, { error: 'unknown task' });
        const today = dayKey();
        if (!(await this.ctx.storage.get(`bank:did:${today}:${id}:${wallet}`))) return json(400, { error: 'not done yet today', code: 'todo' });
        const gk = `bank:got:${today}:${id}:${wallet}`; if (await this.ctx.storage.get(gk)) return json(200, { ok: false, why: 'claimed', ...(await this.bankState(wallet)) });
        await this.ctx.storage.put(gk, true); await this.bankEarn(wallet, TASKS[id], 'task_' + id);
        return json(200, { ok: true, credited: TASKS[id], ...(await this.bankState(wallet)) });
      }
      if (path === 'boost') {   // the same boost as the SOL one, paid in chips
        const mint = String(p.mint || ''), price = this.bankPrices().boost;
        if (!price) return json(400, { error: 'boost for chips is not available right now' });
        if (!this.agents.some(a => a.mint === mint)) return json(400, { error: 'unknown coin' });
        const left = await this.bankPay(wallet, price, 'boost'); if (left < 0) return json(402, { error: 'not enough chips', code: 'broke', price });
        const until = this.applyBoost(mint); await this.ctx.storage.put('boosts', this.boosts);
        return json(200, { ok: true, mint, until, balance: left, price });
      }
      if (path === 'plate') {
        const mint = String(p.mint || ''), price = this.bankPrices().plate;
        const text = String(p.text || '').replace(/[^\w\-\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF .!?$#·]/g, '').trim().slice(0, 24);
        const agent = this.agents.find(a => a.mint === mint); if (!agent) return json(400, { error: 'unknown coin' });
        if (agent.wallet && agent.wallet !== wallet) return json(403, { error: 'only the wallet that launched this coin can name its desk' });
        if (!text) return json(400, { error: 'empty text' }); if (!price) return json(400, { error: 'plates for chips are not available right now' });
        const left = await this.bankPay(wallet, price, 'plate'); if (left < 0) return json(402, { error: 'not enough chips', code: 'broke', price });
        agent.plate = text; if (!agent.wallet) agent.wallet = wallet;
        await this.ctx.storage.put('a:' + String(agent.at).padStart(14, '0'), agent);
        this.broadcast({ t: 'plate', mint, text });
        return json(200, { ok: true, text, balance: left, price });
      }
      if (path === 'shout') {   // the megaphone: one line across the whole town
        const text = cleanShout(p.text); if (text.length < 2) return json(400, { error: 'say something first' });
        if (Date.now() - (this.lastShout || 0) < BANK.shoutGap) return json(429, { error: 'the megaphone is busy, try again in a few seconds', code: 'busy' });
        const left = await this.bankPay(wallet, BANK.shout, 'shout'); if (left < 0) return json(402, { error: 'not enough chips', code: 'broke', price: BANK.shout });
        this.lastShout = Date.now();
        const pr = (await this.profile(wallet)) || {};
        this.broadcast({ t: 'shout', n: pr.nick || (wallet.slice(0, 4) + '…' + wallet.slice(-4)), text, vip: !!this.vips[wallet] });
        this.log('[shout]', wallet.slice(0, 6), text);
        return json(200, { ok: true, balance: left });
      }
      if (path === 'espresso') {   // double XP for an hour; XP lives in the browser, the server only keeps the timer
        const k = 'bank:esp:' + wallet, cur = (await this.ctx.storage.get(k)) || 0;
        const left = await this.bankPay(wallet, BANK.espresso, 'espresso'); if (left < 0) return json(402, { error: 'not enough chips', code: 'broke', price: BANK.espresso });
        const until = Math.max(Date.now(), cur) + BANK.espressoMin * 60e3; await this.ctx.storage.put(k, until);
        return json(200, { ok: true, until, balance: left });
      }
      return json(404, { error: 'unknown bank call' });
    }
  });
}
