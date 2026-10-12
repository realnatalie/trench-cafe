// Clout Cafe on Cloudflare: one Worker serves the page (static asset) and forwards everything else to a single
// Durable Object "Cafe" that holds the room: who is online, chat, agent launches, pump.fun token creation,
// live trades, prices, wallet sign-in, profiles, photos and VIP passes. Settings: wrangler.jsonc (vars) + secrets.
import { DurableObject } from 'cloudflare:workers';
import { Keypair, Connection, VersionedTransaction, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const PUMPPORTAL = 'https://pumpportal.fun/api/trade-local';
const LOOK_KEYS = ['base', 'emote', 'photo', 'body', 'build', 'skin', 'hair', 'hairCol', 'eyes', 'acc', 'top', 'topCol', 'pants', 'shoes', 'accent'];
const RPC_ALLOWED = new Set(['getBalance', 'getLatestBlockhash', 'getSignatureStatuses', 'getTokenAccountsByOwner', 'getParsedTokenAccountsByOwner', 'getTokenAccountBalance', 'sendTransaction', 'simulateTransaction', 'getAccountInfo', 'getTransaction', 'getMinimumBalanceForRentExemption', 'getRecentPrioritizationFees', 'getBlockHeight', 'getSlot', 'getMultipleAccounts']);
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,GET,OPTIONS' };
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', ...CORS } });
const cleanNick = n => String(n || '').replace(/[^\w\-À-ɏЀ-ӿ぀-ヿ㐀-䶿一-鿿가-힯 .]/g, '').slice(0, 16);
function cleanLook(l) { if (!l || typeof l !== 'object') return undefined; const o = {}; for (const k of LOOK_KEYS) { const v = l[k]; if (typeof v === 'string' && /^[#\w]{1,40}$/.test(v)) o[k] = v; } return o; }
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha1hex(buf) { return hex(await crypto.subtle.digest('SHA-1', buf)); }
function b64ToBytes(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function bytesToB64(bytes) { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
const loginMsg = (wallet, nonce) => `Clout Cafe sign-in\nwallet: ${wallet}\nnonce: ${nonce}`;

/* ---------- the Worker: page from assets, everything else to the room ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/' || url.pathname === '/index.html') return env.ASSETS.fetch(req);
    return env.CAFE.get(env.CAFE.idFromName('main')).fetch(req);
  },
  async scheduled(ev, env, ctx) {
    // every 10 minutes: claim creator fees and sweep the hot wallet to the payout address
    ctx.waitUntil(env.CAFE.get(env.CAFE.idFromName('main')).fetch('https://cafe/internal/claim', { method: 'POST' }));
  }
};

/* ---------- the room ---------- */
export class Cafe extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.OWNER = env.OWNER_SECRET_KEY ? Keypair.fromSecretKey(bs58.decode(env.OWNER_SECRET_KEY.trim())) : null;
    this.OWNER_PUBKEY = this.OWNER ? this.OWNER.publicKey.toBase58() : '';
    this.RPC = env.RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.LAUNCH_FEE_SOL = +(env.LAUNCH_FEE_SOL || 0); this.VIP_FEE_SOL = +(env.VIP_FEE_SOL || 0.05); this.DEV_BUY_SOL = +(env.DEV_BUY_SOL || 0);
    this.PAYOUT_WALLET = (env.PAYOUT_WALLET || '6pMq3PeTRoR28YMk19Fbr1eJKeuRtMRAvQLWwQdQFEMw').trim(); this.RESERVE_SOL = +(env.RESERVE_SOL || 0.08);
    this.LAUNCHES_PER_HOUR_PER_IP = +(env.LAUNCHES_PER_HOUR_PER_IP || 2); this.PHOTO_MAX = +(env.PHOTO_MAX_KB || 220) * 1024;
    this.FEE_RECEIVER = this.PAYOUT_WALLET || this.OWNER_PUBKEY; this.LIVE = !!this.OWNER;
    this.conn = new Connection(this.RPC, 'confirmed');
    this.agents = []; this.sessions = {}; this.vips = {}; this.profiles = new Map();
    this.players = new Map(); this.nextId = 1; this.NONCES = new Map(); this.usedSigs = new Set(); this.hitLog = new Map(); this.launchLog = new Map();
    this.PX = {}; this.OHLC = {}; this.SOL_USD = 0; this.ohlcIdx = 0; this.TRADES = {}; this.txQueue = []; this.ppWs = null; this.ppSubscribed = ''; this.psTick = 0; this.timer = null; this.lastPx = 0;
    for (const ws of this.ctx.getWebSockets()) { const me = ws.deserializeAttachment(); if (me) { this.players.set(ws, me); const n = +String(me.id).slice(1); if (n >= this.nextId) this.nextId = n + 1; } }
    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      const st = this.ctx.storage;
      const ag = await st.list({ prefix: 'a:' }); this.agents = [...ag.values()].sort((a, b) => a.at - b.at);
      this.sessions = (await st.get('sessions')) || {}; this.vips = (await st.get('vips')) || {};
      const now = Date.now(); let pruned = false; for (const k in this.sessions) if (now - this.sessions[k].at > 90 * 86400e3) { delete this.sessions[k]; pruned = true; } if (pruned) await st.put('sessions', this.sessions);
    });
    if (this.players.size) this.startLoop();
  }
  log(...a) { console.log(...a); }

  /* ---- http ---- */
  async fetch(req) {
    await this.ready;
    const url = new URL(req.url); const ip = req.headers.get('cf-connecting-ip') || '0';
    try {
      if (url.pathname === '/ws') {
        if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
        const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        const id = 'p' + (this.nextId++); const me = { id, c: 'degen', n: 'player', x: 0, z: 20, ry: 0, st: 'idle', ip };
        this.players.set(server, me); server.serializeAttachment(me);
        server.send(JSON.stringify({ t: 'welcome', id, online: this.players.size, cfg: { live: this.LIVE, launchFee: this.LAUNCH_FEE_SOL, vipFee: this.VIP_FEE_SOL, owner: this.FEE_RECEIVER, creator: this.OWNER_PUBKEY, rpc: this.RPC.includes('api-key') ? '' : this.RPC }, players: [...this.players.values()].filter(p => p.id !== id).map(p => this.pub(p)), agents: this.agents.filter(a => a.mint).slice(-60).map(a => ({ sym: a.sym, name: a.name, body: a.body, image: a.image, mint: a.mint, by: a.by, desc: a.desc, socials: a.socials, at: a.at })), px: this.PX, sol: this.SOL_USD, ohlc: this.OHLC, trades: Object.fromEntries(Object.entries(this.TRADES).slice(-60).map(([k, v]) => [k, v.slice(0, 30)])) }));
        this.broadcast({ t: 'online', online: this.players.size }, server);
        this.startLoop();
        return new Response(null, { status: 101, webSocket: client });
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return json(200, { ok: true, live: this.LIVE, owner: this.OWNER_PUBKEY, online: this.players.size, agents: this.agents.length, platform: 'cloudflare' });
      if (req.method === 'GET' && url.pathname === '/api/agents') return json(200, this.agents.filter(a => a.mint).slice(-200));
      if (req.method === 'GET' && url.pathname.startsWith('/api/photo/')) {
        const id = url.pathname.slice(11); if (!/^[a-f0-9]{8,40}$/.test(id)) return new Response('', { status: 404 });
        const ph = await this.ctx.storage.get('photo:' + id); if (!ph) return new Response('', { status: 404 });
        return new Response(ph.data, { headers: { 'content-type': 'image/' + ph.type, 'cache-control': 'public, max-age=86400', ...CORS } });
      }
      if (req.method === 'POST' && url.pathname === '/api/photo') {
        if (!this.allowHits('photo:' + ip, 20, 3600e3)) return json(429, { error: 'too many uploads' });
        const p = await this.body(req, 600 * 1024);
        const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(p.image || ''); if (!m) return json(400, { error: 'bad image' });
        const data = b64ToBytes(m[2]); if (data.length > this.PHOTO_MAX) return json(400, { error: 'image too big' });
        const id = (await sha1hex(data)).slice(0, 32);
        if (!(await this.ctx.storage.get('photo:' + id))) { await this.ctx.storage.put('photo:' + id, { type: m[1], data: data.buffer, at: Date.now() }); this.ctx.waitUntil(this.prunePhotos()); }
        return json(200, { id });
      }
      if (req.method === 'POST' && url.pathname === '/rpc') {
        if (!this.allowHits('rpc:' + ip, 240, 60e3)) return json(429, { error: 'slow down' });
        const txt0 = await this.text(req, 200 * 1024); let m; try { m = JSON.parse(txt0); } catch (e) { return json(400, { error: 'bad json' }); }
        const reqs = Array.isArray(m) ? m : [m]; if (reqs.some(q => !q || !RPC_ALLOWED.has(q.method))) return json(403, { error: 'method not allowed' });
        const r = await fetch(this.RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: txt0 });
        return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json', ...CORS } });
      }
      if (req.method === 'POST' && url.pathname === '/api/trade') {
        if (!this.allowHits('trade:' + ip, 30, 60e3)) return json(429, { error: 'too many trades, wait a minute' });
        const p = await this.body(req, 4096);
        let pk; try { pk = new PublicKey(String(p.publicKey)).toBase58(); } catch (e) { return json(400, { error: 'bad wallet' }); }
        const mint = String(p.mint || ''); if (!this.agents.some(a => a.mint === mint)) return json(400, { error: 'unknown token' });
        const action = p.action === 'sell' ? 'sell' : 'buy'; const denomSol = action === 'buy';
        let amount; if (denomSol) { amount = +p.amount; if (!(amount >= 0.001 && amount <= 50)) return json(400, { error: 'amount must be 0.001-50 SOL' }); } else { amount = /^(100|[1-9][0-9]?)%$/.test(String(p.amount)) ? String(p.amount) : (+p.amount > 0 ? +p.amount : null); if (amount == null) return json(400, { error: 'bad sell amount' }); }
        const body = { publicKey: pk, action, mint, amount, denominatedInSol: denomSol ? 'true' : 'false', slippage: Math.min(50, Math.max(1, +p.slippage || 10)), priorityFee: 0.0005, pool: 'auto' };
        const r = await fetch(PUMPPORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) return json(502, { error: 'pumpportal: ' + r.status + ' ' + (await r.text()).slice(0, 160) });
        this.log('[trade]', action, amount, mint.slice(0, 8), 'for', pk.slice(0, 6));
        return json(200, { tx: bytesToB64(await r.arrayBuffer()) });
      }
      if (req.method === 'GET' && url.pathname === '/api/nonce') { const n = randHex(16); this.NONCES.set(n, Date.now()); for (const [k, tm] of this.NONCES) if (Date.now() - tm > 300e3) this.NONCES.delete(k); return json(200, { nonce: n }); }
      if (req.method === 'POST' && url.pathname === '/api/login') {
        if (!this.allowHits('login:' + ip, 30, 600e3)) return json(429, { error: 'slow down' });
        const p = await this.body(req, 4096);
        let wallet; try { wallet = new PublicKey(String(p.wallet)).toBase58(); } catch (e) { return json(400, { error: 'bad wallet' }); }
        if (!this.NONCES.has(String(p.nonce))) return json(400, { error: 'nonce expired, try again' });
        let ok = false; try { ok = nacl.sign.detached.verify(new TextEncoder().encode(loginMsg(wallet, p.nonce)), b64ToBytes(String(p.sig)), bs58.decode(wallet)); } catch (e) { }
        if (!ok) return json(401, { error: 'signature does not match' });
        this.NONCES.delete(String(p.nonce));
        const token = randHex(24); this.sessions[token] = { wallet, at: Date.now() }; await this.ctx.storage.put('sessions', this.sessions);
        let pr = await this.profile(wallet);
        if (!pr) { pr = { createdAt: Date.now(), passNo: 100000 + parseInt((await sha1hex(new TextEncoder().encode(wallet))).slice(0, 6), 16) % 900000 }; await this.saveProfile(wallet, pr); }
        this.log('[login]', wallet.slice(0, 6));
        return json(200, { token, wallet, profile: { ...pr, vip: !!this.vips[wallet] } });
      }
      if (req.method === 'GET' && url.pathname === '/api/me') { const w = this.walletOfToken(url.searchParams.get('token')); if (!w) return json(401, { error: 'not signed in' }); return json(200, { wallet: w, profile: { ...((await this.profile(w)) || {}), vip: !!this.vips[w] } }); }
      if (req.method === 'POST' && url.pathname === '/api/profile') {
        const p = await this.body(req, 8192); const w = this.walletOfToken(p.token); if (!w) return json(401, { error: 'not signed in' });
        const pr = (await this.profile(w)) || { createdAt: Date.now() };
        if (p.nick != null) pr.nick = cleanNick(p.nick); if (p.c != null) pr.c = String(p.c).slice(0, 16); if (p.look != null) pr.look = cleanLook(p.look); if (p.photo != null) pr.photo = /^[a-f0-9]{8,40}$/.test(String(p.photo)) ? p.photo : ''; if (p.em != null) pr.em = String(p.em).slice(0, 12);
        await this.saveProfile(w, pr); return json(200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/vip') {
        if (!this.allowHits('vip:' + ip, 10, 600e3)) return json(429, { error: 'slow down' });
        const p = await this.body(req, 2048);
        let wallet = this.walletOfToken(p.token); if (!wallet) { try { wallet = new PublicKey(String(p.wallet)).toBase58(); } catch (e) { return json(400, { error: 'bad wallet' }); } }
        if (!this.FEE_RECEIVER) return json(400, { error: 'no fee wallet configured' });
        if (!(await this.verifyPayment(p.sig, this.VIP_FEE_SOL, wallet))) return json(402, { error: 'VIP payment not found' });
        this.vips[wallet] = Date.now(); await this.ctx.storage.put('vips', this.vips);
        for (const [ws, me] of this.players) if (me.wallet === wallet) { me.vip = true; ws.serializeAttachment(me); this.broadcast({ t: 'ps', list: [{ id: me.id, vip: true }] }); }
        this.log('[vip]', wallet); return json(200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/launch') {
        const p = await this.body(req, 4 * 1024 * 1024);
        const symbol = String(p.symbol || p.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        if (!symbol) return json(400, { error: 'bad name' });
        if (this.agents.some(a => a.mint && a.sym === symbol)) return json(400, { error: 'ticker already exists' });
        if (!this.LIVE) return json(200, { ok: true, mint: null, sim: true });   // test mode: the coin stays on the player's screen only
        if (!this.allowLaunch(ip)) return json(429, { error: 'too many launches from this address, try later' });
        let mint = null, sig = null;
        if (this.LIVE) {
          if (this.LAUNCH_FEE_SOL && !(await this.verifyPayment(p.paymentSig))) return json(402, { error: 'launch fee payment not found' });
          ({ mint, sig } = await this.createToken({ name: String(p.name || symbol).slice(0, 32), symbol, description: String(p.description || '').slice(0, 300), imageDataUrl: p.image, twitter: p.twitter, telegram: p.telegram, website: p.website }));
        }
        const agent = { sym: symbol, name: String(p.name || symbol).slice(0, 32), socials: { x: String(p.twitter || '').slice(0, 80), tg: String(p.telegram || '').slice(0, 80), web: String(p.website || '').slice(0, 120) }, body: String(p.body || 'degen').slice(0, 16), image: typeof p.image === 'string' && p.image.length < 400000 ? p.image : null, desc: String(p.description || '').slice(0, 300), by: String(p.by || '').slice(0, 24), mint, sig, at: Date.now() };
        if (!agent.mint) return json(500, { error: 'token was not created' });
        this.agents.push(agent); await this.ctx.storage.put('a:' + String(agent.at).padStart(14, '0'), agent);
        if (this.agents.length > 500) { const old = this.agents.shift(); await this.ctx.storage.delete('a:' + String(old.at).padStart(14, '0')); }
        this.ctx.waitUntil(this.ppConnect()); this.ctx.waitUntil(new Promise(r => setTimeout(r, 15000)).then(() => this.pollPrices()));
        this.broadcast({ t: 'launch', agent });
        this.log('[launch]', symbol, mint || '(sim)', 'by', ip);
        return json(200, { ok: true, mint, sig, sim: !this.LIVE });
      }
      if (req.method === 'POST' && url.pathname === '/internal/claim') { await this.claimCreatorFees(); await this.sweepToPayout(); return json(200, { ok: true }); }
      return new Response('not found', { status: 404 });
    } catch (e) { this.log('[http] error', e.message); return json(500, { error: e.message }); }
  }
  async text(req, limit) { const t = await req.text(); if (t.length > limit) throw new Error('body too large'); return t; }
  async body(req, limit) { return JSON.parse(await this.text(req, limit)); }
  allowHits(key, n, windowMs) { const now = Date.now(); const arr = (this.hitLog.get(key) || []).filter(t => now - t < windowMs); if (arr.length >= n) return false; arr.push(now); this.hitLog.set(key, arr); if (this.hitLog.size > 5000) this.hitLog.clear(); return true; }
  allowLaunch(ip) { const now = Date.now(); const arr = (this.launchLog.get(ip) || []).filter(t => now - t < 3600e3); if (arr.length >= this.LAUNCHES_PER_HOUR_PER_IP) return false; arr.push(now); this.launchLog.set(ip, arr); return true; }
  walletOfToken(tok) { const s = tok && this.sessions[tok]; if (!s) return null; if (Date.now() - s.at > 90 * 86400e3) { delete this.sessions[tok]; return null; } return s.wallet; }
  async profile(w) { if (this.profiles.has(w)) return this.profiles.get(w); const pr = await this.ctx.storage.get('prof:' + w); if (pr) this.profiles.set(w, pr); return pr || null; }
  async saveProfile(w, pr) { this.profiles.set(w, pr); await this.ctx.storage.put('prof:' + w, pr); }
  async prunePhotos() {
    try { const all = await this.ctx.storage.list({ prefix: 'photo:' }); if (all.size > 3000) { const arr = [...all.entries()].sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).slice(0, 500); await this.ctx.storage.delete(arr.map(x => x[0])); } } catch (e) { }
  }
  pub(p) { const { wallet, ip, _sig, ...rest } = p; return rest; }

  /* ---- websocket presence ---- */
  webSocketMessage(ws, raw) {
    let me = this.players.get(ws); if (!me) { me = ws.deserializeAttachment(); if (!me) return; this.players.set(ws, me); }
    if (typeof raw !== 'string' || raw.length > 1500) return;
    const now = Date.now(); if (now - (me._w || 0) > 1000) { me._w = now; me._n = 0; } if (++me._n > 40) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'hello') {
      me.c = String(m.c || 'degen').slice(0, 16); me.n = cleanNick(String(m.n || 'player').replace(/[<>&"']/g, '').slice(0, 16)) || 'player';
      me.look = me.c === 'custom' ? cleanLook(m.look) : undefined; me.photo = /^[a-f0-9]{8,40}$/.test(String(m.photo || '')) ? m.photo : undefined;
      me.em = /^[a-z]{3,10}$/.test(String(m.em || '')) && m.em !== 'auto' ? m.em : undefined;
      me.wallet = this.walletOfToken(m.token) || undefined; me.vip = !!(me.wallet && this.vips[me.wallet]);
      if (typeof m.x === 'number') { me.x = m.x; me.z = m.z; }
      ws.serializeAttachment(me);
      this.broadcast({ t: 'ps', list: [this.pub(me)] }, ws);
    }
    else if (m.t === 'p') { if (typeof m.x === 'number' && typeof m.z === 'number') { me.x = m.x; me.z = m.z; me.ry = +m.ry || 0; me.st = String(m.st || 'idle').slice(0, 8); } }
    else if (m.t === 'say') { const text = String(m.text || '').replace(/https?:\/\/\S+/g, '').slice(0, 80).trim(); if (text) this.broadcast({ t: 'say', id: me.id, text }, ws); }
    else if (m.t === 'emote') this.broadcast({ t: 'emote', id: me.id }, ws);
  }
  webSocketClose(ws) { this.drop(ws); try { ws.close(); } catch (e) { } }
  webSocketError(ws) { this.drop(ws); try { ws.close(); } catch (e) { } }
  drop(ws) { const me = this.players.get(ws); this.players.delete(ws); if (me) this.broadcast({ t: 'leave', id: me.id, online: this.players.size }); if (!this.players.size) this.stopLoop(); }
  broadcast(obj, except) { const s = JSON.stringify(obj); for (const ws of this.ctx.getWebSockets()) { if (ws === except) continue; try { ws.send(s); } catch (e) { this.players.delete(ws); } } }
  startLoop() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 200);
    this.ctx.waitUntil(this.pollSol());
    if (this.agents.some(a => a.mint)) { this.ctx.waitUntil(this.pollPrices()); this.ctx.waitUntil(this.ppConnect()); }
  }
  stopLoop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.ppWs) { try { this.ppWs.close(); } catch (e) { } this.ppWs = null; } }
  tick() {
    if (!this.players.size) return this.stopLoop();
    this.psTick++;
    const list = []; for (const p of this.players.values()) { const sig = p.x + '|' + p.z + '|' + p.ry + '|' + p.st; if (sig !== p._sig || this.psTick % 25 === 0) { p._sig = sig; list.push({ id: p.id, c: p.c, x: p.x, z: p.z, ry: p.ry, st: p.st, vip: p.vip || undefined }); } }
    if (list.length) this.broadcast({ t: 'ps', list, online: this.players.size });
    if (this.psTick % 3 === 0 && this.txQueue.length) { const l = this.txQueue.splice(0, 40); this.txQueue.length = 0; this.broadcast({ t: 'tx', list: l }); }
    if (this.psTick % 150 === 0) { this.pollPrices(); if (!this.ppWs && this.agents.some(a => a.mint)) this.ppConnect(); }
    if (this.psTick % 300 === 10) this.pollSol();
    if (this.psTick % 100 === 45) this.pollOhlc();
  }

  /* ---- prices (DexScreener) and live trades (PumpPortal stream) ---- */
  async pollPrices() {
    const mints = this.agents.filter(a => a.mint).slice(-30).map(a => a.mint); if (!mints.length) return;
    try {
      const r = await fetch('https://api.dexscreener.com/tokens/v1/solana/' + mints.join(','), { headers: { accept: 'application/json' } });
      if (!r.ok) return; const pairs = await r.json(); if (!Array.isArray(pairs)) return;
      const next = {};
      for (const p of pairs) { const mint = p.baseToken?.address; if (!mint) continue; const cur = next[mint]; const liq = +(p.liquidity?.usd || 0); if (cur && cur.liq >= liq) continue; next[mint] = { p: +p.priceUsd || 0, mc: +(p.marketCap || p.fdv || 0), v: +(p.volume?.h24 || 0), ch: +(p.priceChange?.h24 || 0), liq, url: p.url || '', pair: p.pairAddress || '', dex: p.dexId || '' }; }
      for (const k in next) delete next[k].liq;
      Object.assign(this.PX, next); this.broadcast({ t: 'px', px: next });
    } catch (e) { this.log('[px] error', e.message); }
  }
  async pollSol() {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    try {
      const r = await fetch('https://api.dexscreener.com/tokens/v1/solana/' + SOL_MINT, { headers: { accept: 'application/json' } }); if (!r.ok) return;
      const pairs = await r.json(); let best = null;
      for (const p of Array.isArray(pairs) ? pairs : []) { if (p.baseToken?.address !== SOL_MINT || !/^(USDC|USDT)$/.test(p.quoteToken?.symbol || '')) continue; if (!best || +(p.liquidity?.usd || 0) > +(best.liquidity?.usd || 0)) best = p; }
      if (best && +best.priceUsd > 0) { this.SOL_USD = +best.priceUsd; this.broadcast({ t: 'sol', usd: this.SOL_USD }); }
    } catch (e) { this.log('[sol] error', e.message); }
  }
  async pollOhlc() {
    // 5-minute candles from GeckoTerminal (free, about 30 calls a minute): 4 coins every 20 seconds
    const list = this.agents.filter(a => a.mint && this.PX[a.mint] && this.PX[a.mint].pair).slice(-30); if (!list.length) return;
    for (let i = 0; i < Math.min(4, list.length); i++) {
      const a = list[(this.ohlcIdx++) % list.length];
      try {
        const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${this.PX[a.mint].pair}/ohlcv/minute?aggregate=5&limit=72`, { headers: { accept: 'application/json' } }); if (!r.ok) continue;
        const j = await r.json(); const c = (j?.data?.attributes?.ohlcv_list || []).map(k => k.slice(0, 5).map(Number)).filter(k => k.every(Number.isFinite)).sort((p, q) => p[0] - q[0]);
        if (c.length) { this.OHLC[a.mint] = c; this.broadcast({ t: 'ohlc', mint: a.mint, c }); }
      } catch (e) { this.log('[ohlc] error', e.message); }
    }
  }
  async ppConnect() {
    const keys = this.agents.filter(a => a.mint).slice(-50).map(a => a.mint); if (!keys.length) return;
    if (this.ppWs) { const k = keys.join(','); if (k !== this.ppSubscribed) { this.ppSubscribed = k; try { this.ppWs.send(JSON.stringify({ method: 'subscribeTokenTrade', keys })); } catch (e) { } } return; }
    try {
      const r = await fetch('https://pumpportal.fun/api/data', { headers: { Upgrade: 'websocket' } });
      const ws = r.webSocket; if (!ws) { this.log('[pp] no websocket', r.status); return; }
      ws.accept(); this.ppWs = ws; this.ppSubscribed = keys.join(','); ws.send(JSON.stringify({ method: 'subscribeTokenTrade', keys })); this.log('[pp] connected');
      ws.addEventListener('message', ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (!m || !m.mint || !m.txType) return;
        const tx = { mint: m.mint, side: m.txType === 'sell' ? 'sell' : 'buy', sol: +(+m.solAmount || 0).toFixed(4), mcapSol: +(+m.marketCapSol || 0).toFixed(2), vSol: +(+m.vSolInBondingCurve || 0).toFixed(2), trader: String(m.traderPublicKey || '').slice(0, 44), sig: String(m.signature || '').slice(0, 100), ts: Date.now() };
        (this.TRADES[tx.mint] = this.TRADES[tx.mint] || []).unshift(tx); this.TRADES[tx.mint].length = Math.min(this.TRADES[tx.mint].length, 30);
        this.txQueue.push(tx);
      });
      ws.addEventListener('close', () => { this.ppWs = null; });
      ws.addEventListener('error', () => { this.ppWs = null; });
    } catch (e) { this.log('[pp] error', e.message); this.ppWs = null; }
  }

  /* ---- pump.fun through PumpPortal (transactions are signed here by the hot wallet) ---- */
  async uploadMetadata({ name, symbol, description, imageDataUrl, twitter, telegram, website }) {
    const m = /^data:(image\/\w+);base64,(.+)$/.exec(imageDataUrl || '');
    const fd = new FormData();
    if (m) fd.append('file', new Blob([b64ToBytes(m[2])], { type: m[1] }), 'image.' + (m[1].split('/')[1] || 'png'));
    fd.append('name', name); fd.append('symbol', symbol); fd.append('description', description || ''); fd.append('showName', 'true');
    if (twitter) fd.append('twitter', twitter); if (telegram) fd.append('telegram', telegram); if (website) fd.append('website', website);
    const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('metadata upload failed: ' + r.status);
    const j = await r.json(); return j.metadataUri;
  }
  async signAndSend(txBytes, signers) {
    const tx = VersionedTransaction.deserialize(new Uint8Array(txBytes)); tx.sign(signers);
    const sig = await this.conn.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
    await this.conn.confirmTransaction(sig, 'confirmed'); return sig;
  }
  async createToken({ name, symbol, description, imageDataUrl, twitter, telegram, website }) {
    const uri = await this.uploadMetadata({ name, symbol, description, imageDataUrl, twitter, telegram, website });
    const mint = Keypair.generate();
    const body = { publicKey: this.OWNER.publicKey.toBase58(), action: 'create', tokenMetadata: { name, symbol, uri }, mint: mint.publicKey.toBase58(), denominatedInSol: 'true', amount: this.DEV_BUY_SOL, slippage: 10, priorityFee: 0.0005, pool: 'pump' };
    const r = await fetch(PUMPPORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('pumpportal create failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const sig = await this.signAndSend(await r.arrayBuffer(), [mint, this.OWNER]);
    return { mint: mint.publicKey.toBase58(), sig };
  }
  async claimCreatorFees() {
    if (!this.OWNER) return;
    try {
      const r = await fetch(PUMPPORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: this.OWNER.publicKey.toBase58(), action: 'collectCreatorFee', priorityFee: 0.000001 }) });
      if (!r.ok) { this.log('[claim] skipped:', r.status, (await r.text()).slice(0, 120)); return; }
      const sig = await this.signAndSend(await r.arrayBuffer(), [this.OWNER]);
      this.log('[claim] creator fees claimed:', sig);
    } catch (e) { this.log('[claim] error:', e.message); }
  }
  async verifyPayment(sig, amountSol = this.LAUNCH_FEE_SOL, from = null) {
    if (!amountSol) return true;
    if (!sig || this.usedSigs.has(sig)) return false;
    const tx = await this.conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    if (!tx || tx.meta?.err) return false;
    const ok = tx.transaction.message.instructions.some(ix => ix.parsed?.type === 'transfer' && ix.parsed.info.destination === this.FEE_RECEIVER && ix.parsed.info.lamports >= Math.round(amountSol * 1e9 * 0.98) && (!from || ix.parsed.info.source === from));
    if (ok) this.usedSigs.add(sig); return ok;
  }
  async sweepToPayout() {
    if (!this.OWNER || !this.PAYOUT_WALLET || this.PAYOUT_WALLET === this.OWNER_PUBKEY) return;
    try {
      const bal = await this.conn.getBalance(this.OWNER.publicKey); const send = bal - Math.round(this.RESERVE_SOL * 1e9) - 10000;
      if (send < 0.01 * 1e9) return;
      const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: this.OWNER.publicKey, toPubkey: new PublicKey(this.PAYOUT_WALLET), lamports: send }));
      const sig = await this.conn.sendTransaction(tx, [this.OWNER]); await this.conn.confirmTransaction(sig, 'confirmed');
      this.log('[sweep]', (send / 1e9).toFixed(4), 'SOL →', this.PAYOUT_WALLET, sig);
    } catch (e) { this.log('[sweep] error', e.message); }
  }
}
