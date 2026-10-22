// HUNTS: small chip rewards for exploring. Daily crates (verified against the player's position), the Solana story eggs
// (once each) and the full candle hunt (once). Installed onto the Cafe Durable Object by installHunt(Cafe).
import { CRATE_SPOTS, HUNT, huntDay, dailyCrates } from './hunt-data.js';
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
export function installHunt(Cafe) {
  Object.assign(Cafe.prototype, {
    async huntState(wallet) {
      const day = huntDay();
      return { day, crates: dailyCrates(day), claimed: (await this.ctx.storage.get('hcr:' + day + ':' + wallet)) || [], eggs: (await this.ctx.storage.get('heg:' + wallet)) || [], candles: !!(await this.ctx.storage.get('hcd:' + wallet)), reward: HUNT };
    },
    async huntHandle(req, url, ip) {
      const path = url.pathname.slice('/api/hunt/'.length);
      const p = req.method === 'POST' ? await this.body(req, 2048).catch(() => ({})) : {};
      const wallet = this.walletOfToken(p.token || url.searchParams.get('token')); if (!wallet) return json(401, { error: 'sign in with Phantom first' });
      if (!this.allowHits('hunt:' + ip, 60, 60e3)) return json(429, { error: 'slow down' });
      if (req.method === 'GET' && path === 'state') return json(200, await this.huntState(wallet));
      if (req.method !== 'POST') return json(405, { error: 'method' });
      if (path === 'crate') {
        const i = Math.floor(+p.i), day = huntDay();
        if (!dailyCrates(day).includes(i)) return json(400, { error: 'no crate there today' });
        const key = 'hcr:' + day + ':' + wallet, claimed = (await this.ctx.storage.get(key)) || [];
        if (claimed.includes(i)) return json(409, { error: 'already opened', code: 'done' });
        const [x, z] = CRATE_SPOTS[i]; let near = false; for (const me of this.players.values()) if (me.wallet === wallet && typeof me.x === 'number' && Math.hypot(me.x - x, me.z - z) <= 6) near = true;
        if (!near) return json(400, { error: 'walk up to the crate first', code: 'far' });
        claimed.push(i); await this.ctx.storage.put(key, claimed);
        const balance = await this.cadd(wallet, HUNT.crate, 'crate'); await this.bankMark(wallet, 'crate'); await this.bankLog(wallet, HUNT.crate, 'crate');
        return json(200, { ok: true, credited: HUNT.crate, balance, claimed });
      }
      if ((path === 'egg' || path === 'candles') && !this.playerPos(wallet)) return json(400, { error: 'enter the cafe first', code: 'far' });   // rewards are for players in the room
      if (path === 'egg') {
        const i = Math.floor(+p.i); if (!(i >= 0 && i < HUNT.maxEggs)) return json(400, { error: 'bad story' });
        const key = 'heg:' + wallet, list = (await this.ctx.storage.get(key)) || [];
        if (list.includes(i)) return json(200, { ok: true, again: true, balance: await this.cbal(wallet), eggs: list });
        list.push(i); await this.ctx.storage.put(key, list);
        const balance = await this.cadd(wallet, HUNT.egg, 'egg');
        return json(200, { ok: true, credited: HUNT.egg, balance, eggs: list });
      }
      if (path === 'candles') {
        const key = 'hcd:' + wallet; if (await this.ctx.storage.get(key)) return json(200, { ok: true, again: true, balance: await this.cbal(wallet) });
        await this.ctx.storage.put(key, Date.now());
        const balance = await this.cadd(wallet, HUNT.candles, 'candles');
        return json(200, { ok: true, credited: HUNT.candles, balance });
      }
      return json(404, { error: 'unknown hunt call' });
    }
  });
}
