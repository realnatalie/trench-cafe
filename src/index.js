// Trench Cafe on Cloudflare: one Worker serves the page (static asset) and forwards everything else to a single
// Durable Object "Cafe" that holds the room: who is online, chat, agent launches, pump.fun token creation,
// live trades, prices, wallet sign-in, profiles, photos and VIP passes. Settings: wrangler.jsonc (vars) + secrets.
import { DurableObject } from 'cloudflare:workers';
import { Keypair, Connection, VersionedTransaction, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { installExtras } from './extras.js';
import { installArcade } from './arcade.js';
import { installHunt } from './hunt.js';
import { installLeague } from './league.js';
import { installRef } from './ref.js';
import { installBank } from './bank.js';
import { installBuyback, splitSweep } from './buyback.js';

const PUMPPORTAL = 'https://pumpportal.fun/api/trade-local';
const PC_STATES = ['idle', 'walk', 'run', 'jump', 'sit', 'dance', 'sleep', 'swim'], PC_CAP = 60;   // compact position states, same order as the client
const RECOVER_SINCE = Date.parse('2026-10-12T00:00:00Z');   // only coins the cafe made: older coins of the same wallet are left out
const LOOK_KEYS = ['base', 'emote', 'photo', 'body', 'build', 'skin', 'hair', 'hairCol', 'eyes', 'acc', 'top', 'topCol', 'pants', 'shoes', 'accent'];
const RPC_ALLOWED = new Set(['getBalance', 'getLatestBlockhash', 'getSignatureStatuses', 'getTokenAccountsByOwner', 'getParsedTokenAccountsByOwner', 'getTokenAccountBalance', 'sendTransaction', 'simulateTransaction', 'getAccountInfo', 'getTransaction', 'getMinimumBalanceForRentExemption', 'getRecentPrioritizationFees', 'getBlockHeight', 'getSlot', 'getMultipleAccounts']);
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,GET,OPTIONS' };
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', ...CORS } });
const cleanNick = n => String(n || '').replace(/[^\w\-\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF .]/g, '').slice(0, 16);
function cleanLook(l) { if (!l || typeof l !== 'object') return undefined; const o = {}; for (const k of LOOK_KEYS) { const v = l[k]; if (typeof v === 'string' && /^[#\w]{1,40}$/.test(v)) o[k] = v; } return o; }
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha1hex(buf) { return hex(await crypto.subtle.digest('SHA-1', buf)); }
function b64ToBytes(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function bytesToB64(bytes) { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
/* a coin image is accepted only as an inline PNG/JPEG/WebP data URL of a sane size or an https link on a known image host; anything else is dropped */
const IMG_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(ipfs\.io|mypinata\.cloud|pinata\.cloud|pump\.fun|dweb\.link|nftstorage\.link|arweave\.net|irys\.xyz)\/[A-Za-z0-9._~\/?=&%-]{1,300}$/i;
const safeImage = v => typeof v === 'string' && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]{1,260000}$/.test(v) || IMG_HOSTS.test(v)) ? v : null;
const loginMsg = (wallet, nonce) => `Trench Cafe sign-in\nwallet: ${wallet}\nnonce: ${nonce}`;

/* ---------- the Worker: page from assets, everything else to the room ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/og.png') return env.ASSETS.fetch(req);
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
    this.LAUNCH_FEE_SOL = +(env.LAUNCH_FEE_SOL || 0); this.VIP_FEE_SOL = +(env.VIP_FEE_SOL ?? 0.5); this.DEV_BUY_SOL = +(env.DEV_BUY_SOL || 0);
    this.PAYOUT_WALLET = (env.PAYOUT_WALLET || '6pMq3PeTRoR28YMk19Fbr1eJKeuRtMRAvQLWwQdQFEMw').trim(); this.RESERVE_SOL = +(env.RESERVE_SOL || 0.08);
    this.BOOST_FEE_SOL = +(env.BOOST_FEE_SOL ?? 0.1); this.BOOST_MIN = +(env.BOOST_MINUTES || 60); this.boosts = {};
    this.LAUNCHES_PER_HOUR_PER_IP = +(env.LAUNCHES_PER_HOUR_PER_IP || 2); this.PHOTO_MAX = +(env.PHOTO_MAX_KB || 220) * 1024;
    this.FEE_RECEIVER = this.PAYOUT_WALLET || this.OWNER_PUBKEY; this.LIVE = !!this.OWNER;
    this.conn = new Connection(this.RPC, 'confirmed');
    this.extrasInit(env); this.arcadeInit(env); this.buybackInit(env);
    this.agents = []; this.sessions = {}; this.vips = {}; this.profiles = new Map();
    this.players = new Map(); this.nextId = 1; this.NONCES = new Map(); this.usedSigs = new Set(); this.hitLog = new Map(); this.launchLog = new Map();
    this.PX = {}; this.OHLC = {}; this.SOL_USD = 0; this.ohlcIdx = 0; this.TRADES = {}; this.txQueue = []; this.ppWs = null; this.ppSubscribed = ''; this.psTick = 0; this.timer = null; this.lastPx = 0;
    for (const ws of this.ctx.getWebSockets()) { const me = ws.deserializeAttachment(); if (me) { this.players.set(ws, me); const n = +String(me.id).slice(1); if (n >= this.nextId) this.nextId = n + 1; } }
    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      const st = this.ctx.storage;
      const ag = await st.list({ prefix: 'a:' }); this.agents = [...ag.values()].sort((a, b) => a.at - b.at);
      this.sessions = (await st.get('sessions')) || {}; this.vips = (await st.get('vips')) || {}; this.boosts = (await st.get('boosts')) || {}; await this.extrasLoad(); await this.leagueLoad();
      const su = await st.get('solusd'); if (su && su.usd > 0 && Date.now() - su.at < 6 * 3600e3) this.SOL_USD = su.usd;   // the last known SOL price survives a restart
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
        if (this.LIVE && !this.recoverStarted) { this.recoverStarted = true; this.ctx.waitUntil(this.finishPending().then(() => this.recoverOrphans())); }
        server.send(JSON.stringify({ t: 'welcome', id, online: this.players.size, boosts: this.liveBoosts(), cfg: { ...this.extrasCfg(), live: this.LIVE, launchFee: this.LAUNCH_FEE_SOL, vipFee: this.VIP_FEE_SOL, boostFee: this.BOOST_FEE_SOL, boostMin: this.BOOST_MIN, owner: this.FEE_RECEIVER, creator: this.OWNER_PUBKEY, rpc: this.RPC.includes('api-key') ? '' : this.RPC }, players: [...this.players.values()].filter(p => p.id !== id).map(p => this.pub(p)), agents: this.agents.filter(a => a.mint).slice(-60).map(a => ({ sym: a.sym, name: a.name, body: a.body, image: a.image, mint: a.mint, by: a.by, desc: a.desc, socials: a.socials, wallet: a.wallet || '', vip: !!a.vip, plate: a.plate || '', at: a.at })), px: this.PX, sol: this.SOL_USD, ohlc: this.OHLC, trades: Object.fromEntries(Object.entries(this.TRADES).slice(-60).map(([k, v]) => [k, v.slice(0, 30)])) }));
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
        const token = randHex(24); this.sessions[token] = { wallet, at: Date.now() };
        const keys = Object.keys(this.sessions); if (keys.length > 3000) { keys.sort((a, b) => this.sessions[a].at - this.sessions[b].at); for (const k of keys.slice(0, keys.length - 3000)) delete this.sessions[k]; }   // oldest sessions go first
        await this.ctx.storage.put('sessions', this.sessions);
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
        if (this.vips[wallet]) return json(200, { ok: true, already: true });
        if (!(await this.verifyPayment(p.sig, this.VIP_FEE_SOL, wallet))) return json(402, { error: 'VIP payment not found yet, try again in a minute' });
        this.vips[wallet] = Date.now(); await this.ctx.storage.put('vips', this.vips);
        for (const [ws, me] of this.players) if (me.wallet === wallet) { me.vip = true; ws.serializeAttachment(me); this.broadcast({ t: 'ps', list: [{ id: me.id, vip: true }] }); }
        this.log('[vip]', wallet); return json(200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/boost') {   // paid promotion: a coin goes on the big screen and the top of the feed
        const p = await this.body(req, 2048);
        const mint = String(p.mint || ''), sig = String(p.sig || '').trim();
        if (!this.FEE_RECEIVER || !this.BOOST_FEE_SOL) return json(400, { error: 'boost is off' });
        if (!this.agents.some(a => a.mint === mint)) return json(400, { error: 'unknown coin' });
        const done = await this.ctx.storage.get('boostsig:' + sig);
        if (done) return json(200, { ok: true, mint: done.mint, until: this.boosts[done.mint] || done.until, again: true });
        const pv = await this.checkPayment(sig, this.BOOST_FEE_SOL);
        if (pv !== 'ok') return json(402, { error: pv === 'wait' ? 'the payment is not visible on Solana yet, press again in a minute: you will not be charged twice' : 'boost payment not found', code: pv });
        const until = this.applyBoost(mint);
        await this.ctx.storage.put('boosts', this.boosts); await this.ctx.storage.put('boostsig:' + sig, { mint, until });
        return json(200, { ok: true, mint, until });
      }
      if (url.pathname === '/api/launch-status') {   // lets a player who paid see for sure whether the coin exists
        const sig = String(url.searchParams.get('sig') || '').trim(); if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) return json(400, { error: 'bad sig' });
        const key = 'launch:' + sig, rec = await this.ctx.storage.get(key);
        if (!rec) return json(200, { state: 'none' });
        const agent = rec.mint ? this.agents.find(a => a.mint === rec.mint) : null;
        if (rec.done) return json(200, { state: 'done', mint: rec.mint, agent: agent ? { sym: agent.sym, name: agent.name, body: agent.body, image: agent.image, mint: agent.mint, by: agent.by, desc: agent.desc, socials: agent.socials, wallet: agent.wallet || '', vip: !!agent.vip, plate: agent.plate || '', at: agent.at } : null });
        if (!this.launchBusy?.has(key) && Date.now() - (rec.triedAt || 0) > 30000) { rec.triedAt = Date.now(); this.ctx.waitUntil(this.finishLaunch(key, rec).catch(() => { })); }
        return json(200, { state: 'pending', sym: rec.meta?.symbol || '' });
      }
      if (req.method === 'POST' && url.pathname === '/api/launch') {
        const p = await this.body(req, 4 * 1024 * 1024);
        const symbol = String(p.symbol || p.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        if (!symbol) return json(400, { error: 'bad name' });
        if (!this.LIVE) { if (this.agents.some(a => a.mint && a.sym === symbol)) return json(400, { error: 'ticker already exists' }); return json(200, { ok: true, mint: null, sim: true }); }   // test mode: the coin stays on the player's screen only
        if (p.vip && this.agents.filter(a => a.mint && a.vip).length >= 8) return json(400, { error: 'all VIP desks are taken', code: 'vipfull' });
        // one paid fee = one coin. The same payment can be sent again any number of times: it never creates a second coin and never needs a second payment.
        const paySig = String(p.paymentSig || '').trim();
        if (this.LAUNCH_FEE_SOL && !/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(paySig)) return json(402, { error: 'launch fee payment missing', code: 'pay_missing' });
        let key = paySig ? 'launch:' + paySig : null, rec = key ? await this.ctx.storage.get(key) : null;
        if (rec && rec.done) return json(200, { ok: true, mint: rec.mint, sig: rec.sig, again: true });
        if (!rec) {
          if (this.agents.some(a => a.mint && a.sym === symbol)) return json(400, { error: 'ticker already exists', code: 'ticker' });
          const vipDesk = !!p.vip && this.VIP_DESK_SOL > 0;
          if (this.LAUNCH_FEE_SOL || vipDesk) {
            const pv = await this.checkPayment(paySig, this.LAUNCH_FEE_SOL + (vipDesk ? this.VIP_DESK_SOL : 0));
            if (pv !== 'ok') return json(402, pv === 'used' ? { error: 'this payment was already used', code: 'pay_used' } : pv === 'bad' ? { error: 'the fee payment was not found or is too small', code: 'pay_bad' } : { error: 'the fee payment is not visible on Solana yet. Press Launch again in a minute: you will not be charged twice.', code: 'pay_wait' });
            if (!this.allowLaunch(ip)) return json(429, { error: 'too many launches from this address, try later' });   // the slot is spent only once the fee is confirmed
          }
          const mint = Keypair.generate(), paidBy = paySig ? (await this.ctx.storage.get('sig:' + paySig))?.from || '' : '';
          rec = { wallet: paidBy, vip: vipDesk, mint: mint.publicKey.toBase58(), mintSecret: bs58.encode(mint.secretKey), at: Date.now(), done: false, tries: 0, ip,
            meta: { name: String(p.name || symbol).slice(0, 32), symbol, description: String(p.description || '').slice(0, 300), twitter: String(p.twitter || '').slice(0, 80), telegram: String(p.telegram || '').slice(0, 80), website: String(p.website || '').slice(0, 120) },
            body: String(p.body || 'degen').slice(0, 16), image: safeImage(p.image), by: String(p.by || '').slice(0, 24) };
          if (!key) key = 'launch:free:' + rec.mint;
          await this.ctx.storage.put(key, rec);
        }
        try { const done = await this.finishLaunch(key, rec); return json(200, { ok: true, mint: done.mint, sig: done.sig }); }
        catch (e) { this.log('[launch] not finished yet', symbol, e.message); return json(503, { error: 'pump.fun has not confirmed the coin yet. Press Launch again: you will not be charged twice. (' + String(e.message).slice(0, 120) + ')', code: 'retry' }); }
      }
      if (url.pathname.startsWith('/api/arcade/')) return await this.arcadeHandle(req, url, ip);
      if (url.pathname.startsWith('/api/hunt/')) return await this.huntHandle(req, url, ip);
      if (url.pathname === '/api/league' || url.pathname.startsWith('/api/league/')) return await this.leagueHandle(req, url, ip);
      if (url.pathname.startsWith('/api/ref/')) return await this.refHandle(req, url, ip);
      if (url.pathname.startsWith('/api/bank/')) return await this.bankHandle(req, url, ip);
      if (url.pathname === '/api/buyback') return await this.buybackHandle(req, url);
      if (url.pathname === '/api/quote' || url.pathname === '/api/items' || url.pathname === '/api/buy' || url.pathname === '/api/plate' || url.pathname === '/api/pro' || url.pathname.startsWith('/api/casino/')) return await this.handleExtras(req, url, ip);
      if (req.method === 'POST' && url.pathname === '/internal/claim') { await this.finishPending(); await this.recoverOrphans(); await this.claimCreatorFees(); await this.sweepToPayout(); await this.buybackRun(); return json(200, { ok: true }); }
      return new Response('not found', { status: 404 });
    } catch (e) { this.log('[http] error', e.message); return json(500, { error: e.message }); }
  }
  async text(req, limit) { const t = await req.text(); if (t.length > limit) throw new Error('body too large'); return t; }
  async body(req, limit) { return JSON.parse(await this.text(req, limit)); }
  liveBoosts() { const now = Date.now(), o = {}; for (const k in this.boosts) if (this.boosts[k] > now) o[k] = this.boosts[k]; return o; }
  allowHits(key, n, windowMs) { const now = Date.now(); const arr = (this.hitLog.get(key) || []).filter(t => now - t < windowMs); if (arr.length >= n) return false; arr.push(now); this.hitLog.set(key, arr); if (this.hitLog.size > 5000) this.hitLog.clear(); return true; }
  allowLaunch(ip) { const now = Date.now(); const arr = (this.launchLog.get(ip) || []).filter(t => now - t < 3600e3); if (arr.length >= this.LAUNCHES_PER_HOUR_PER_IP) return false; arr.push(now); this.launchLog.set(ip, arr); return true; }
  /* short-lived keys are swept once an hour so storage does not grow forever */
  async housekeep() {
    const now = Date.now(), rules = [['cq:', 864e5, 'at'], ['quote:', 864e5, 'at'], ['cround:', 36e5, 't0'], ['roy:', 3 * 864e5, null], ['hcr:', 8 * 864e5, null], ['arun:', 30 * 864e5, 'issuedAt']];
    let n = 0;
    for (const [prefix, ttl, field] of rules) {
      const all = await this.ctx.storage.list({ prefix });
      for (const [k, v] of all) {
        let old = false;
        if (field) old = !(v && v[field] > now - ttl);
        else { const day = k.split(':')[1]; old = /^\d{4}-\d{2}-\d{2}$/.test(day) && now - Date.parse(day + 'T00:00:00Z') > ttl; }
        if (old) { await this.ctx.storage.delete(k); n++; }
      }
    }
    if (n) this.log('[housekeep] removed', n);
  }
  sendToWallet(wallet, msg) { if (!wallet) return; const raw = JSON.stringify(msg); for (const [ws, me] of this.players) if (me.wallet === wallet) { try { ws.send(raw); } catch (e) { } } }
  playerPos(wallet) { for (const me of this.players.values()) if (me.wallet === wallet && typeof me.x === 'number') return { x: me.x, z: me.z }; return null; }
  walletOfToken(tok) { const s = tok && this.sessions[tok]; if (!s) return null; if (Date.now() - s.at > 90 * 86400e3) { delete this.sessions[tok]; return null; } return s.wallet; }
  applyBoost(mint) {   // paid in SOL or in chips: the coin goes on the big screen and the top of the feed
    const until = Math.max(Date.now(), this.boosts[mint] || 0) + this.BOOST_MIN * 60e3;
    this.boosts[mint] = until; for (const k in this.boosts) if (this.boosts[k] < Date.now()) delete this.boosts[k];
    this.broadcast({ t: 'boost', mint, until }); this.log('[boost]', mint, new Date(until).toISOString());
    return until;
  }
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
    const now = Date.now(); if (now - (me._w || 0) > 1000) { me._w = now; me._n = 0; } if (++me._n > 12) return;   // a client sends at most 5 positions a second
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'hello') {
      me.c = String(m.c || 'degen').slice(0, 16); me.n = cleanNick(String(m.n || 'player').replace(/[<>&"']/g, '').slice(0, 16)) || 'player';
      me.look = me.c === 'custom' ? cleanLook(m.look) : undefined; me.photo = /^[a-f0-9]{8,40}$/.test(String(m.photo || '')) ? m.photo : undefined;
      me.em = /^[a-z]{3,10}$/.test(String(m.em || '')) && m.em !== 'auto' ? m.em : undefined;
      me.wallet = this.walletOfToken(m.token) || undefined; me.vip = !!(me.wallet && this.vips[me.wallet]); me.fl = this.ownedFlair(me.wallet, m.fl);
      if (typeof m.x === 'number') { me.x = m.x; me.z = m.z; }
      ws.serializeAttachment(me);
      this.broadcast({ t: 'ps', list: [this.pub(me)] }, ws);
    }
    else if (m.t === 'p') { if (typeof m.x === 'number' && typeof m.z === 'number') { me.x = m.x; me.z = m.z; me.ry = +m.ry || 0; me.st = String(m.st || 'idle').slice(0, 8); } }
    else if (m.t === 'say') { if (now - (me._say || 0) < 1500) return; me._say = now; const text = String(m.text || '').replace(/https?:\/\/\S+/g, '').slice(0, 80).trim(); if (text) this.broadcast({ t: 'say', id: me.id, text }, ws); }
    else if (m.t === 'emote') { if (now - (me._emo || 0) < 1000) return; me._emo = now; this.broadcast({ t: 'emote', id: me.id }, ws); }
  }
  webSocketClose(ws) { this.drop(ws); try { ws.close(); } catch (e) { } }
  webSocketError(ws) { this.drop(ws); try { ws.close(); } catch (e) { } }
  drop(ws) { const me = this.players.get(ws); this.players.delete(ws); if (me) this.broadcast({ t: 'leave', id: me.id, online: this.players.size }); if (!this.players.size) this.stopLoop(); }
  broadcast(obj, except) { const s = JSON.stringify(obj); for (const ws of this.ctx.getWebSockets()) { if (ws === except) continue; try { ws.send(s); } catch (e) { this.players.delete(ws); } } }
  /* every 5 s: players whose socket is gone (a closed tab the runtime never reported) leave the room for everyone */
  pruneGhosts() {
    const live = new Set(this.ctx.getWebSockets());
    for (const [ws, me] of this.players) {
      if (live.has(ws) && ws.readyState === 1) continue;
      this.players.delete(ws); this.broadcast({ t: 'leave', id: me.id, online: this.players.size });
    }
  }
  /* Positions, five times a second, to the players who can see them: the town is cut into cells, each player hears about the
     players in the 3x3 cells around their own (nearest PC_CAP first), in a compact array form. Everyone in a cell shares one
     message, so a full room costs one JSON string per busy cell instead of one huge list per player. */
  sendPositions(full) {
    const CELL = 18, cells = new Map(), key = (cx, cz) => cx + ',' + cz;
    for (const [ws, p] of this.players) {
      if (typeof p.x !== 'number') continue;
      const sig = p.x + '|' + p.z + '|' + p.ry + '|' + p.st, moved = sig !== p._sig; p._sig = sig;
      const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL), k = key(cx, cz);
      let c = cells.get(k); if (!c) cells.set(k, c = { cx, cz, members: [], ws: [] });
      c.members.push({ p, moved, row: [+String(p.id).slice(1) || 0, Math.round(p.x * 10), Math.round(p.z * 10), Math.round((p.ry || 0) * 100), Math.max(0, PC_STATES.indexOf(p.st))] });
      c.ws.push(ws);
    }
    const on = this.players.size;
    for (const c of cells.values()) {
      const near = []; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = cells.get(key(c.cx + dx, c.cz + dz)); if (n) near.push(...n.members); }
      let pick = near.filter(m => full || m.moved);
      if (!pick.length) continue;
      if (pick.length > PC_CAP) { const mx = (c.cx + 0.5) * CELL, mz = (c.cz + 0.5) * CELL; pick = pick.map(m => ({ m, d: (m.p.x - mx) ** 2 + (m.p.z - mz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, PC_CAP).map(o => o.m); }
      const s = JSON.stringify({ t: 'pc', l: pick.map(m => m.row), on });
      for (const ws of c.ws) { try { ws.send(s); } catch (e) { this.players.delete(ws); } }
    }
  }
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
    if (this.psTick % 25 === 0) this.pruneGhosts();
    this.sendPositions(this.psTick % 25 === 0);
    if (this.psTick % 3 === 0 && this.txQueue.length) { const l = this.txQueue.splice(0, 40); this.txQueue.length = 0; this.broadcast({ t: 'tx', list: l }); }
    if (this.psTick % 150 === 0) { this.pollPrices(); if (!this.ppWs && this.agents.some(a => a.mint)) this.ppConnect(); }
    if (this.psTick % 300 === 10) this.pollSol();
    if (this.psTick % 300 === 150) this.ctx.waitUntil(this.leagueSettle().catch(e => this.log('[league] settle', e.message)));
    if (this.psTick % 18000 === 900) this.ctx.waitUntil(this.housekeep().catch(e => this.log('[housekeep]', e.message)));
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
      Object.assign(this.PX, next); this.broadcast({ t: 'px', px: next }); this.leaguePeaks(next);
    } catch (e) { this.log('[px] error', e.message); }
  }
  async pollSol() {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    try {
      const r = await fetch('https://api.dexscreener.com/tokens/v1/solana/' + SOL_MINT, { headers: { accept: 'application/json' } }); if (!r.ok) return;
      const pairs = await r.json(); let best = null;
      for (const p of Array.isArray(pairs) ? pairs : []) { if (p.baseToken?.address !== SOL_MINT || !/^(USDC|USDT)$/.test(p.quoteToken?.symbol || '')) continue; if (!best || +(p.liquidity?.usd || 0) > +(best.liquidity?.usd || 0)) best = p; }
      if (best && +best.priceUsd > 0) { this.SOL_USD = +best.priceUsd; this.broadcast({ t: 'sol', usd: this.SOL_USD }); await this.ctx.storage.put('solusd', { usd: this.SOL_USD, at: Date.now() }); }
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
        this.txQueue.push(tx); this.ctx.waitUntil(this.leagueTrade(tx).catch(e => this.log('[league] trade', e.message)));
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
  // signs, sends and waits for confirmation over plain HTTP polling (no websockets, no 30 s blockhash timer that gives up while the transaction still lands)
  async signAndSend(txBytes, signers, waitMs = 45000) {
    const tx = VersionedTransaction.deserialize(new Uint8Array(txBytes)); tx.sign(signers);
    const raw = bytesToB64(tx.serialize()), sig = bs58.encode(tx.signatures[0]);
    await this.rpcJson('sendTransaction', [raw, { encoding: 'base64', skipPreflight: false, maxRetries: 5, preflightCommitment: 'confirmed' }]);
    const t0 = Date.now(); let n = 0;
    while (Date.now() - t0 < waitMs) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const st = (await this.rpcJson('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]))?.value?.[0];
        if (st && st.err) { const e = new Error('transaction failed on chain'); e.sig = sig; e.failed = true; throw e; }
        if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return sig;
      } catch (e) { if (e.failed) throw e; }
      if (++n % 4 === 0) { try { await this.rpcJson('sendTransaction', [raw, { encoding: 'base64', skipPreflight: true, maxRetries: 0 }]); } catch (e) { } }   // re-broadcast while waiting
    }
    const e = new Error('not confirmed in time'); e.sig = sig; throw e;
  }
  async mintExists(mint) { try { const r = await this.rpcJson('getAccountInfo', [mint, { encoding: 'base64', commitment: 'confirmed' }]); return !!(r && r.value); } catch (e) { return false; } }
  async createToken(meta, mintKp, rec) {
    if (!rec.uri) { rec.uri = await this.uploadMetadata({ ...meta, imageDataUrl: rec.image }); }
    const body = { publicKey: this.OWNER.publicKey.toBase58(), action: 'create', tokenMetadata: { name: meta.name, symbol: meta.symbol, uri: rec.uri }, mint: mintKp.publicKey.toBase58(), denominatedInSol: 'true', amount: this.DEV_BUY_SOL, slippage: 10, priorityFee: 0.0005, pool: 'pump' };
    const r = await fetch(PUMPPORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('pumpportal create failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const sig = await this.signAndSend(await r.arrayBuffer(), [mintKp, this.OWNER]);
    return { mint: mintKp.publicKey.toBase58(), sig };
  }
  // finishes one paid launch: if the coin is already on chain it is just recorded, otherwise it is created with the same mint (so it can never be created twice)
  async finishLaunch(key, rec) {
    if (rec.done) return rec;
    if (this.launchBusy?.has(key)) throw new Error('still creating');
    (this.launchBusy ||= new Set()).add(key);
    try {
      if (!(await this.mintExists(rec.mint))) {
        const kp = Keypair.fromSecretKey(bs58.decode(rec.mintSecret));
        try { const r = await this.createToken(rec.meta, kp, rec); rec.sig = r.sig; }
        catch (e) {
          if (e.sig) rec.sig = e.sig;
          await new Promise(r => setTimeout(r, 1500));
          if (!(await this.mintExists(rec.mint))) { rec.tries = (rec.tries || 0) + 1; rec.lastErr = String(e.message).slice(0, 200); await this.ctx.storage.put(key, rec); throw e; }
        }
      }
      return await this.commitLaunch(key, rec);
    } finally { this.launchBusy.delete(key); }
  }
  async commitLaunch(key, rec) {
    if (!this.agents.some(a => a.mint === rec.mint)) {
      const m = rec.meta || {};
      const agent = { sym: m.symbol, name: m.name || m.symbol, socials: { x: m.twitter || '', tg: m.telegram || '', web: m.website || '' }, body: rec.body || 'degen', image: rec.image || null, desc: m.description || '', by: rec.by || '', wallet: rec.wallet || '', vip: !!rec.vip, mint: rec.mint, sig: rec.sig || null, at: Date.now() };
      this.agents.push(agent); await this.ctx.storage.put('a:' + String(agent.at).padStart(14, '0'), agent);
      if (this.agents.length > 500) { const old = this.agents.shift(); await this.ctx.storage.delete('a:' + String(old.at).padStart(14, '0')); }
      this.ctx.waitUntil(this.ppConnect()); this.ctx.waitUntil(new Promise(r => setTimeout(r, 15000)).then(() => this.pollPrices()));
      this.broadcast({ t: 'launch', agent });
      this.log('[launch]', agent.sym, agent.mint);
    }
    rec.done = true; delete rec.mintSecret; if (key) await this.ctx.storage.put(key, rec);
    return rec;
  }
  // launches that were paid but not confirmed while the player waited: finished in the background (cron)
  async finishPending() {
    if (!this.OWNER) return;
    const all = await this.ctx.storage.list({ prefix: 'launch:' });
    for (const [key, rec] of all) {
      if (!rec || rec.done) continue;
      if (Date.now() - rec.at > 3 * 86400e3 || (rec.tries || 0) > 8) continue;
      try { await this.finishLaunch(key, rec); } catch (e) { this.log('[pending]', key.slice(0, 20), e.message); }
    }
  }
  // any coin the cafe wallet created that is missing from the cafe (for example after an old error) is added back
  async recoverOrphans() {
    if (!this.OWNER) return;
    try {
      const PUMP = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
      const sigs = await this.rpcJson('getSignaturesForAddress', [this.OWNER_PUBKEY, { limit: 40, commitment: 'confirmed' }]) || [];
      for (const s of sigs) {
        if (s.err || (s.blockTime && s.blockTime * 1000 < RECOVER_SINCE) || await this.ctx.storage.get('scan:' + s.signature)) continue;
        let tx = null; try { tx = await this.rpcJson('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); } catch (e) { continue; }
        if (!tx) continue;
        await this.ctx.storage.put('scan:' + s.signature, 1);
        const logs = (tx.meta?.logMessages || []).join('\n'); if (!/Instruction: Create/.test(logs)) continue;
        const keys = tx.transaction?.message?.accountKeys || [];
        const mintKey = keys.find(k => k.signer && k.pubkey !== this.OWNER_PUBKEY); if (!mintKey) continue;
        const mint = mintKey.pubkey; if (this.agents.some(a => a.mint === mint)) continue;
        const ix = (tx.transaction?.message?.instructions || []).find(i => i.programId === PUMP && i.data); if (!ix) continue;
        let name = '', symbol = '', uri = '';
        try { const d = bs58.decode(ix.data); let o = 8; const str = () => { const n = d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24); o += 4; const v = new TextDecoder().decode(d.slice(o, o + n)); o += n; return v; }; name = str(); symbol = str(); uri = str(); } catch (e) { continue; }
        if (!symbol) continue;
        let md = {}; if (/^https?:\/\//.test(uri)) { try { const r = await fetch(uri, { signal: AbortSignal.timeout(8000) }); if (r.ok) md = await r.json(); } catch (e) { } }
        const rec = { mint, sig: s.signature, at: (s.blockTime || 0) * 1000 || Date.now(), body: 'degen', image: safeImage(md.image), by: '',
          meta: { name: String(name).slice(0, 32), symbol: String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'COIN', description: String(md.description || '').slice(0, 300), twitter: String(md.twitter || '').slice(0, 80), telegram: String(md.telegram || '').slice(0, 80), website: String(md.website || '').slice(0, 120) } };
        await this.commitLaunch('launch:recovered:' + mint, rec);
        this.log('[recover] added', rec.meta.symbol, mint);
      }
    } catch (e) { this.log('[recover] error', e.message); }
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
  // JSON-RPC with fallbacks: the configured RPC first, then two public ones, so a payment is never lost to one slow endpoint
  async rpcJson(method, params) {
    const urls = [...new Set([this.RPC, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'])];
    let last = null;
    for (const u of urls) {
      try {
        const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        if (!r.ok) { last = new Error('rpc ' + r.status); continue; }
        const j = await r.json(); if (j.error) { last = new Error(j.error.message || 'rpc error'); continue; }
        return j.result;
      } catch (e) { last = e; }
    }
    throw last || new Error('rpc failed');
  }
  // checks on chain that `sig` moved at least `amountSol` from `from` to the fee wallet; waits up to ~45 s for the transaction to land.
  // returns 'ok', 'used' (already spent on something), 'bad' (failed or wrong transfer) or 'wait' (not visible yet)
  async checkPayment(sig, amountSol = this.LAUNCH_FEE_SOL, from = null) {
    if (!amountSol) return 'ok';
    sig = String(sig || ''); if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) return 'bad';
    if (this.usedSigs.has(sig) || await this.ctx.storage.get('sig:' + sig)) return 'used';
    if (!this.payBusy) this.payBusy = new Set();
    if (this.payBusy.has(sig)) return 'wait';   // the same signature is being checked by another request: never two credits
    this.payBusy.add(sig);
    try {
      for (let i = 0; i < 15; i++) {
        let tx = null; try { tx = await this.rpcJson('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); } catch (e) { this.log('[pay] rpc', e.message); }
        if (tx) {
          if (tx.meta?.err) return 'bad';
          const ixs = tx.transaction?.message?.instructions || [];
          const hit = ixs.find(ix => ix.parsed?.type === 'transfer' && this.payReceivers().includes(ix.parsed.info.destination) && +ix.parsed.info.lamports >= Math.round(amountSol * 1e9 * 0.98) && (!from || ix.parsed.info.source === from));
          if (!hit) return 'bad';
          if (this.usedSigs.has(sig) || await this.ctx.storage.get('sig:' + sig)) return 'used';
          this.usedSigs.add(sig); await this.ctx.storage.put('sig:' + sig, { at: Date.now(), from: hit.parsed.info.source });
          return 'ok';
        }
        await new Promise(r => setTimeout(r, 3000));
      }
      return 'wait';
    } finally { this.payBusy.delete(sig); }
  }
  async verifyPayment(sig, amountSol = this.LAUNCH_FEE_SOL, from = null) { return (await this.checkPayment(sig, amountSol, from)) === 'ok'; }
  async sweepToPayout() {   // everything above the reserve leaves the hot wallet: the buyback share to the buyback wallet, the rest to the payout wallet
    if (!this.OWNER || !this.PAYOUT_WALLET || this.PAYOUT_WALLET === this.OWNER_PUBKEY) return;
    try {
      const bal = await this.conn.getBalance(this.OWNER.publicKey); const send = bal - Math.round(this.RESERVE_SOL * 1e9) - 10000;
      if (send < 0.01 * 1e9) return;
      const part = this.buybackOn() ? splitSweep(send, this.BB.share) : { buyback: 0, payout: send };
      const tx = new Transaction();
      if (part.buyback > 0) tx.add(SystemProgram.transfer({ fromPubkey: this.OWNER.publicKey, toPubkey: this.BB.key.publicKey, lamports: part.buyback }));
      if (part.payout > 0) tx.add(SystemProgram.transfer({ fromPubkey: this.OWNER.publicKey, toPubkey: new PublicKey(this.PAYOUT_WALLET), lamports: part.payout }));
      tx.feePayer = this.OWNER.publicKey; tx.recentBlockhash = (await this.rpcJson('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash; tx.sign(this.OWNER); const sig = bs58.encode(tx.signature); await this.rpcJson('sendTransaction', [bytesToB64(tx.serialize()), { encoding: 'base64' }]);
      if (part.buyback > 0) { const st = await this.buybackStats(); st.fed = Math.round(((st.fed || 0) + part.buyback / 1e9) * 1e4) / 1e4; await this.ctx.storage.put('buyback:stats', st); }
      this.log('[sweep]', (part.payout / 1e9).toFixed(4), 'SOL ->', this.PAYOUT_WALLET, part.buyback ? '| ' + (part.buyback / 1e9).toFixed(4) + ' SOL -> buyback' : '', sig);
    } catch (e) { this.log('[sweep] error', e.message); }
  }

}
installExtras(Cafe);
installArcade(Cafe);
installHunt(Cafe);
installLeague(Cafe);
installRef(Cafe);
installBank(Cafe);
installBuyback(Cafe);
