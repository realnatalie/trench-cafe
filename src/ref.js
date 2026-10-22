// INVITE PASS: every browser gets a short invite code. A friend who opens the site with ?ref=CODE and starts playing counts once,
// the inviter collects XP for it the next time they look. XP is a progress meter only: nothing here pays chips or SOL.
// A weekly table of the best recruiters feeds the board in the town square.
// Installed onto the Cafe Durable Object by installRef(Cafe).
import { arcWeek } from './arcade-games.js';
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { const a = crypto.getRandomValues(new Uint8Array(7)); let s = ''; for (const b of a) s += ABC[b % ABC.length]; return s; };
const UID_RE = /^[a-f0-9]{16,32}$/, CODE_RE = /^[A-Z2-9]{7}$/;
const cleanName = s => String(s || '').replace(/[^\w\-Ѐ-ӿ一-鿿぀-ヿ가-힯 .]/g, '').trim().slice(0, 16);
async function ipTag(ip) {   // never stored raw: a short salted hash, only to tell "same network" apart
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('trench-ref:' + ip));
  return [...new Uint8Array(d)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function installRef(Cafe) {
  Object.assign(Cafe.prototype, {
    async refUser(uid, ipt, create, nick) {
      let u = await this.ctx.storage.get('ref:u:' + uid);
      if (!u && create) {
        let code = newCode(); for (let i = 0; i < 6 && (await this.ctx.storage.get('ref:c:' + code)); i++) code = newCode();
        u = { code, n: 0, paid: 0, ip: ipt, at: Date.now(), nick: cleanName(nick) };
        await this.ctx.storage.put({ ['ref:u:' + uid]: u, ['ref:c:' + code]: uid });
      } else if (u && nick && cleanName(nick) && u.nick !== cleanName(nick)) { u.nick = cleanName(nick); await this.ctx.storage.put('ref:u:' + uid, u); }
      return u || null;
    },
    async refWeek() { const wk = arcWeek(); if (!this.REFWK || this.REFWK.week !== wk) this.REFWK = (await this.ctx.storage.get('ref:wk')) || { week: wk, rows: {} }; if (this.REFWK.week !== wk) this.REFWK = { week: wk, rows: {} }; return this.REFWK; },
    async refHandle(req, url, ip) {
      const path = url.pathname.slice('/api/ref/'.length);
      if (req.method === 'GET' && path === 'top') {
        const w = await this.refWeek();
        const top = Object.values(w.rows).sort((a, b) => b.n - a.n || a.at - b.at).slice(0, 10).map(r => ({ nick: r.nick || 'anon', n: r.n }));
        return json(200, { week: w.week, top });
      }
      if (req.method !== 'POST') return json(405, { error: 'POST only' });
      if (!this.allowHits('ref:' + ip, 40, 60e3)) return json(429, { error: 'slow down' });
      const p = await this.body(req, 1024).catch(() => ({}));
      const uid = String(p.uid || ''); if (!UID_RE.test(uid)) return json(400, { error: 'bad id' });
      const ipt = await ipTag(ip);
      if (path === 'me') {
        const u = await this.refUser(uid, ipt, true, p.nick);
        return json(200, { code: u.code, invited: u.n, unpaid: Math.max(0, u.n - u.paid), by: !!(await this.ctx.storage.get('ref:by:' + uid)) });
      }
      if (path === 'collect') {
        const u = await this.refUser(uid, ipt, false); if (!u) return json(200, { add: 0, invited: 0 });
        const add = Math.max(0, u.n - u.paid); if (add) { u.paid = u.n; await this.ctx.storage.put('ref:u:' + uid, u); }
        return json(200, { add, invited: u.n });
      }
      if (path === 'join') {
        const code = String(p.code || '').toUpperCase(); if (!CODE_RE.test(code)) return json(400, { error: 'bad code' });
        if (await this.ctx.storage.get('ref:by:' + uid)) return json(200, { ok: false, why: 'already' });
        const owner = await this.ctx.storage.get('ref:c:' + code); if (!owner) return json(404, { error: 'unknown code' });
        if (owner === uid) return json(200, { ok: false, why: 'self' });
        const mine = await this.ctx.storage.get('ref:u:' + uid);
        if (mine && Date.now() - mine.at > 864e5) return json(200, { ok: false, why: 'old' });   // only new players count
        const u = await this.refUser(owner, ipt, false); if (!u) return json(404, { error: 'unknown code' });
        await this.ctx.storage.put('ref:by:' + uid, code);   // one inviter per browser, ever
        if (u.ip === ipt) return json(200, { ok: false, why: 'same' });   // same network as the inviter
        if (!this.allowHits('refj:' + ipt, 3, 864e5)) return json(200, { ok: false, why: 'limit' });
        u.n++; await this.ctx.storage.put('ref:u:' + owner, u);
        const w = await this.refWeek(), row = w.rows[owner] || (w.rows[owner] = { n: 0, at: 0, nick: '' });
        row.n++; row.at = Date.now(); row.nick = u.nick || row.nick;
        await this.ctx.storage.put('ref:wk', w);
        this.log('[ref] join', code);
        return json(200, { ok: true, from: u.nick || '' });
      }
      return json(404, { error: 'unknown ref call' });
    }
  });
}
