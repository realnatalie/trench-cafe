// Shop (cosmetics + VIP paid in SOL or in the project token at a live price) and the DEVNET-ONLY test casino.
// Installed onto the Cafe Durable Object by installExtras(Cafe).
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{60,100}$/;

/* prices are set in SOL; a payment in the project token is converted at the live market price when the quote is made */
export const SHOP = {
  laser: { sol: 0.05 }, chain: { sol: 0.08 }, crown: { sol: 0.12 }, wings: { sol: 0.15 }, aura: { sol: 0.1 }, pet: { sol: 0.06 },
  jetpack: { sol: 0.1 }, horns: { sol: 0.07 }, halo: { sol: 0.07 }, shades: { sol: 0.04 }, bag: { sol: 0.09 }, flag: { sol: 0.06 },
  profeed: { sol: 0.1, days: 30 }   // pro trade feed: 30 days
};
const FLAIR_IDS = Object.keys(SHOP).filter(k => k !== 'profeed');

/* the casino runs ONLY on Solana test networks: devnet SOL has no value. On mainnet it refuses to start. */
const TEST_GENESIS = { EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: 'devnet', '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY': 'testnet' };
const LAMPORTS = 1e9, MIN_BET = 0.001, MAX_BET = 1, CR_SPEED = 0.12, CR_WAIT = 2000;
const SLOT = [{ k: 'mug', w: 1, p3: 100, p2: 4 }, { k: 'dia', w: 2, p3: 30, p2: 2.5 }, { k: 'cnd', w: 3, p3: 12, p2: 1.5 }, { k: 'ban', w: 4, p3: 6, p2: 1 }, { k: 'rug', w: 4, p3: 0, p2: 0 }];
const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
async function sha256hex(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

export function installExtras(Cafe) {
  Object.assign(Cafe.prototype, {
    extrasInit(env) {
      this.PAY_TOKEN_MINT = String(env.PAY_TOKEN_MINT || '').trim();
      this.CASINO_SECRET = String(env.CASINO_HOUSE_SECRET || '').trim();
      this.CASINO_RPC = String(env.CASINO_RPC || 'https://api.devnet.solana.com').trim();
      this.CASINO_OK = false; this.CASINO_NET = ''; this.HOUSE = null;
      if (this.CASINO_SECRET) { try { this.HOUSE = Keypair.fromSecretKey(bs58.decode(this.CASINO_SECRET)); } catch (e) { this.log('[casino] bad CASINO_HOUSE_SECRET'); } }
      this.tokInfo = null; this.tokPx = { usd: 0, at: 0 }; this.rounds = new Map();
      this.VIP_DESK_SOL = +(env.VIP_DESK_SOL ?? 0.05); this.PLATE_SOL = +(env.PLATE_SOL ?? 0.03);
    },
    async extrasLoad() { this.items = (await this.ctx.storage.get('items')) || {}; this.subs = (await this.ctx.storage.get('subs')) || {}; },
    proUntil(wallet) { const u = wallet && this.subs[wallet]; return u && u > Date.now() ? u : 0; },
    extrasCfg() {
      return { shop: SHOP, vipDeskFee: this.VIP_DESK_SOL, plateFee: this.PLATE_SOL, payToken: this.PAY_TOKEN_MINT ? { mint: this.PAY_TOKEN_MINT, symbol: this.tokInfo?.symbol || '' } : null, casino: this.CASINO_OK ? { net: this.CASINO_NET, house: this.HOUSE.publicKey.toBase58(), rpc: this.CASINO_RPC, min: MIN_BET, max: MAX_BET } : null };
    },
    ownedFlair(wallet, list) { const own = new Set((wallet && this.items[wallet]) || []); return (Array.isArray(list) ? list : []).map(String).filter(x => FLAIR_IDS.includes(x) && own.has(x)).slice(0, 6); },

    /* ---------- token price + quotes ---------- */
    async tokenMeta() {
      if (this.tokInfo && this.tokInfo.mint === this.PAY_TOKEN_MINT) return this.tokInfo;
      const r = await this.rpcJson('getAccountInfo', [this.PAY_TOKEN_MINT, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      const v = r && r.value; if (!v) throw new Error('pay token mint not found');
      const decimals = +v.data?.parsed?.info?.decimals; if (!(decimals >= 0)) throw new Error('pay token mint is not a token');
      this.tokInfo = { mint: this.PAY_TOKEN_MINT, program: v.owner, decimals, symbol: '' };
      return this.tokInfo;
    },
    async tokenUsd() {
      if (Date.now() - this.tokPx.at < 30e3 && this.tokPx.usd > 0) return this.tokPx.usd;
      const r = await fetch('https://api.dexscreener.com/tokens/v1/solana/' + this.PAY_TOKEN_MINT, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('price feed unavailable');
      const pairs = await r.json(); let best = null;
      for (const p of Array.isArray(pairs) ? pairs : []) { if (p.baseToken?.address !== this.PAY_TOKEN_MINT || !(+p.priceUsd > 0)) continue; if (!best || +(p.liquidity?.usd || 0) > +(best.liquidity?.usd || 0)) best = p; }
      if (!best) throw new Error('no market price for the pay token yet');
      this.tokPx = { usd: +best.priceUsd, at: Date.now() }; if (this.tokInfo) this.tokInfo.symbol = best.baseToken?.symbol || this.tokInfo.symbol;
      return this.tokPx.usd;
    },
    priceSol(item) { return item === 'vip' ? this.VIP_FEE_SOL : SHOP[item] ? SHOP[item].sol : 0; },
    async makeQuote(item) {
      const sol = this.priceSol(item); if (!sol) throw new Error('unknown item');
      const q = { id: crypto.randomUUID(), item, sol, at: Date.now() };
      if (this.PAY_TOKEN_MINT) {
        try {
          const meta = await this.tokenMeta(), tusd = await this.tokenUsd(); if (!(this.SOL_USD > 0)) await this.pollSol();
          if (this.SOL_USD > 0) {
            const tokens = sol * this.SOL_USD / tusd, raw = BigInt(Math.ceil(tokens * 10 ** Math.min(meta.decimals, 9))) * 10n ** BigInt(Math.max(0, meta.decimals - 9));
            q.token = { mint: meta.mint, program: meta.program, decimals: meta.decimals, symbol: meta.symbol, raw: raw.toString(), ui: tokens, usd: sol * this.SOL_USD };
          }
        } catch (e) { q.tokenError = e.message; }
      }
      await this.ctx.storage.put('quote:' + q.id, q);
      return q;
    },
    // checks a project-token transfer of at least `raw` units to the fee wallet, from `wallet`
    async checkTokenPayment(sig, mint, raw, wallet) {
      if (!SIG_RE.test(sig)) return 'bad';
      if (this.usedSigs.has(sig) || await this.ctx.storage.get('sig:' + sig)) return 'used';
      for (let i = 0; i < 15; i++) {
        let tx = null; try { tx = await this.rpcJson('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); } catch (e) { }
        if (tx) {
          if (tx.meta?.err) return 'bad';
          const bal = (list, owner) => (list || []).filter(b => b.mint === mint && b.owner === owner).reduce((s, b) => s + BigInt(b.uiTokenAmount?.amount || '0'), 0n);
          const got = bal(tx.meta?.postTokenBalances, this.FEE_RECEIVER) - bal(tx.meta?.preTokenBalances, this.FEE_RECEIVER);
          const spent = bal(tx.meta?.preTokenBalances, wallet) - bal(tx.meta?.postTokenBalances, wallet);
          const need = BigInt(raw) * 995n / 1000n;
          if (got >= need && spent >= need) { this.usedSigs.add(sig); await this.ctx.storage.put('sig:' + sig, { at: Date.now(), from: wallet }); return 'ok'; }
          return 'bad';
        }
        await new Promise(r => setTimeout(r, 3000));
      }
      return 'wait';
    },
    async grant(wallet, item) {
      if (item === 'profeed') { this.subs[wallet] = Math.max(Date.now(), this.subs[wallet] || 0) + SHOP.profeed.days * 86400e3; await this.ctx.storage.put('subs', this.subs); return; }
      if (item === 'vip') { this.vips[wallet] = Date.now(); await this.ctx.storage.put('vips', this.vips); for (const [ws, me] of this.players) if (me.wallet === wallet) { me.vip = true; ws.serializeAttachment(me); this.broadcast({ t: 'ps', list: [{ id: me.id, vip: true }] }); } return; }
      const l = this.items[wallet] || (this.items[wallet] = []); if (!l.includes(item)) l.push(item); await this.ctx.storage.put('items', this.items);
    },

    /* ---------- casino (test networks only) ---------- */
    async casinoCheck() {
      if (this.CASINO_OK || !this.HOUSE) return this.CASINO_OK;
      try {
        const r = await fetch(this.CASINO_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getGenesisHash' }) });
        const j = await r.json(); const net = TEST_GENESIS[j.result];
        if (net) { this.CASINO_OK = true; this.CASINO_NET = net; } else this.log('[casino] refused: CASINO_RPC is not a Solana test network');
      } catch (e) { this.log('[casino] check failed', e.message); }
      return this.CASINO_OK;
    },
    async crpc(method, params) {
      const r = await fetch(this.CASINO_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await r.json(); if (j.error) throw new Error(j.error.message || 'rpc error'); return j.result;
    },
    async cbal(w) { return (await this.ctx.storage.get('cbal:' + w)) || 0; },
    async cset(w, lam) { lam = Math.max(0, Math.floor(lam)); await this.ctx.storage.put('cbal:' + w, lam); return lam; },
    betLamports(bet) { const b = +bet; if (!(b >= MIN_BET && b <= MAX_BET)) return 0; return Math.round(b * LAMPORTS); },

    async handleExtras(req, url, ip) {
      const p = req.method === 'POST' ? await this.body(req, 4096).catch(() => ({})) : {};
      const tokenParam = p.token || url.searchParams.get('token');

      /* ----- shop ----- */
      if (req.method === 'GET' && url.pathname === '/api/pro') { const w = this.walletOfToken(tokenParam); return json(200, { pro: this.proUntil(w) }); }
      if (req.method === 'POST' && url.pathname === '/api/quote') {
        if (!this.allowHits('q:' + ip, 30, 60e3)) return json(429, { error: 'slow down' });
        try { return json(200, await this.makeQuote(String(p.item || ''))); } catch (e) { return json(400, { error: e.message }); }
      }
      if (req.method === 'GET' && url.pathname === '/api/items') {
        const w = this.walletOfToken(tokenParam); return json(200, { items: w ? this.items[w] || [] : [], vip: !!(w && this.vips[w]), pro: this.proUntil(w) });
      }
      if (req.method === 'POST' && url.pathname === '/api/buy') {
        const wallet = this.walletOfToken(tokenParam); if (!wallet) return json(401, { error: 'sign in with Phantom first' });
        const item = String(p.item || ''), sig = String(p.sig || '').trim(), method = p.method === 'token' ? 'token' : 'sol';
        if (!this.priceSol(item)) return json(400, { error: 'unknown item' });
        const done = await this.ctx.storage.get('buysig:' + sig);
        if (done) { if (done.wallet !== wallet) return json(400, { error: 'payment belongs to another wallet' }); return json(200, { ok: true, item: done.item, items: this.items[wallet] || [], vip: !!this.vips[wallet], again: true }); }
        let pv;
        if (method === 'sol') pv = await this.checkPayment(sig, this.priceSol(item), wallet);
        else {
          const q = await this.ctx.storage.get('quote:' + String(p.quote || '')); if (!q || q.item !== item || !q.token) return json(400, { error: 'price quote expired, try again' });
          if (Date.now() - q.at > 15 * 60e3) return json(400, { error: 'price quote expired, try again' });
          pv = await this.checkTokenPayment(sig, q.token.mint, q.token.raw, wallet);
        }
        if (pv !== 'ok') return json(402, { error: pv === 'wait' ? 'payment not visible on Solana yet, press again in a minute: you will not be charged twice' : pv === 'used' ? 'this payment was already used' : 'payment not found or too small', code: pv });
        await this.grant(wallet, item); await this.ctx.storage.put('buysig:' + sig, { wallet, item, at: Date.now() });
        this.log('[buy]', item, method, wallet);
        return json(200, { ok: true, item, items: this.items[wallet] || [], vip: !!this.vips[wallet], pro: this.proUntil(wallet) });
      }
      if (req.method === 'POST' && url.pathname === '/api/plate') {   // a name plate on your coin's desk: paid once, everyone sees it
        const wallet = this.walletOfToken(tokenParam); if (!wallet) return json(401, { error: 'sign in with Phantom first' });
        const mint = String(p.mint || ''), sig = String(p.sig || '').trim();
        const text = String(p.text || '').replace(/[^\w\-À-ɏЀ-ӿ぀-ヿ㐀-䶿一-鿿가-힯 .!?$#·]/g, '').trim().slice(0, 24);
        const agent = this.agents.find(a => a.mint === mint); if (!agent) return json(400, { error: 'unknown coin' });
        if (agent.wallet && agent.wallet !== wallet) return json(403, { error: 'only the wallet that launched this coin can name its desk' });
        if (!text) return json(400, { error: 'empty text' });
        const done = await this.ctx.storage.get('platesig:' + sig);
        if (!done) {
          const pv = await this.checkPayment(sig, this.PLATE_SOL, wallet);
          if (pv !== 'ok') return json(402, { error: pv === 'wait' ? 'payment not visible on Solana yet, press again in a minute: you will not be charged twice' : pv === 'used' ? 'this payment was already used' : 'payment not found or too small', code: pv });
          await this.ctx.storage.put('platesig:' + sig, { wallet, mint, at: Date.now() });
        } else if (done.mint !== mint) return json(400, { error: 'this payment was used for another coin' });
        agent.plate = text; if (!agent.wallet) agent.wallet = wallet;
        await this.ctx.storage.put('a:' + String(agent.at).padStart(14, '0'), agent);
        this.broadcast({ t: 'plate', mint, text }); this.log('[plate]', mint, text);
        return json(200, { ok: true, text });
      }

      /* ----- casino ----- */
      if (!url.pathname.startsWith('/api/casino/')) return null;
      if (!(await this.casinoCheck())) return json(403, { error: 'casino is off (test network only)' });
      const wallet = this.walletOfToken(tokenParam); if (!wallet) return json(401, { error: 'sign in with Phantom first' });
      if (!this.allowHits('c:' + wallet, 240, 60e3)) return json(429, { error: 'slow down' });
      const path = url.pathname.slice('/api/casino/'.length);
      if (path === 'info') return json(200, { net: this.CASINO_NET, house: this.HOUSE.publicKey.toBase58(), balance: await this.cbal(wallet), min: MIN_BET, max: MAX_BET });
      if (path === 'deposit') {
        const sig = String(p.sig || '').trim(); if (!SIG_RE.test(sig)) return json(400, { error: 'bad signature' });
        if (await this.ctx.storage.get('csig:' + sig)) return json(200, { ok: true, balance: await this.cbal(wallet), again: true });
        let tx = null; for (let i = 0; i < 12 && !tx; i++) { try { tx = await this.crpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); } catch (e) { } if (!tx) await new Promise(r => setTimeout(r, 2500)); }
        if (!tx) return json(402, { error: 'deposit not visible on ' + this.CASINO_NET + ' yet, press again in a minute', code: 'wait' });
        if (tx.meta?.err) return json(402, { error: 'deposit failed on chain' });
        const house = this.HOUSE.publicKey.toBase58();
        const lam = (tx.transaction?.message?.instructions || []).filter(ix => ix.parsed?.type === 'transfer' && ix.parsed.info.destination === house && ix.parsed.info.source === wallet).reduce((s, ix) => s + +ix.parsed.info.lamports, 0);
        if (!lam) return json(402, { error: 'no transfer from your wallet to the casino in this transaction' });
        await this.ctx.storage.put('csig:' + sig, Date.now());
        const bal = await this.cset(wallet, (await this.cbal(wallet)) + lam);
        return json(200, { ok: true, credited: lam, balance: bal });
      }
      if (path === 'withdraw') {
        const bal = await this.cbal(wallet), lam = Math.min(bal, Math.round((+p.sol || bal / LAMPORTS) * LAMPORTS));
        if (lam < 0.001 * LAMPORTS) return json(400, { error: 'nothing to withdraw' });
        await this.cset(wallet, bal - lam);
        try {
          const bh = (await this.crpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash;
          const tx = new Transaction({ feePayer: this.HOUSE.publicKey, recentBlockhash: bh }).add(SystemProgram.transfer({ fromPubkey: this.HOUSE.publicKey, toPubkey: new PublicKey(wallet), lamports: lam }));
          tx.sign(this.HOUSE);
          const sig = await this.crpc('sendTransaction', [btoa(String.fromCharCode(...tx.serialize())), { encoding: 'base64' }]);
          return json(200, { ok: true, sent: lam, sig, balance: bal - lam });
        } catch (e) { await this.cset(wallet, (await this.cbal(wallet)) + lam); return json(500, { error: 'withdraw failed: ' + e.message }); }
      }
      if (path === 'flip') {
        const bet = this.betLamports(p.bet); if (!bet) return json(400, { error: 'bet must be between ' + MIN_BET + ' and ' + MAX_BET + ' SOL' });
        const bal = await this.cbal(wallet); if (bet > bal) return json(400, { error: 'not enough balance', code: 'broke' });
        const res = rnd() < 0.5 ? 'up' : 'down', side = p.side === 'down' ? 'down' : 'up', win = res === side ? Math.floor(bet * 1.95) : 0;
        return json(200, { res, win, balance: await this.cset(wallet, bal - bet + win) });
      }
      if (path === 'slots') {
        const bet = this.betLamports(p.bet); if (!bet) return json(400, { error: 'bet must be between ' + MIN_BET + ' and ' + MAX_BET + ' SOL' });
        const bal = await this.cbal(wallet); if (bet > bal) return json(400, { error: 'not enough balance', code: 'broke' });
        const roll = () => { const T = SLOT.reduce((s, x) => s + x.w, 0); let r = rnd() * T; for (const s of SLOT) if ((r -= s.w) < 0) return s; return SLOT[0]; };
        const res = [roll(), roll(), roll()], [a, b, c] = res.map(s => s.k);
        let mult = 0; if (a === b && b === c) mult = res[0].p3; else { const pr = a === b || a === c ? res[0] : b === c ? res[1] : null; if (pr) mult = pr.p2; }
        const win = Math.floor(bet * mult);
        return json(200, { reels: [a, b, c], mult, win, balance: await this.cset(wallet, bal - bet + win) });
      }
      if (path === 'crash/start') {
        const bet = this.betLamports(p.bet); if (!bet) return json(400, { error: 'bet must be between ' + MIN_BET + ' and ' + MAX_BET + ' SOL' });
        for (const r of this.rounds.values()) if (r.wallet === wallet && !r.ended) return json(400, { error: 'finish your current round first' });
        const bal = await this.cbal(wallet); if (bet > bal) return json(400, { error: 'not enough balance', code: 'broke' });
        const u = rnd(), cp = u < 0.03 ? 1 : Math.max(1, Math.floor(97 / (1 - u)) / 100), salt = crypto.randomUUID();
        const r = { id: crypto.randomUUID(), wallet, bet, cp, salt, t0: Date.now() + CR_WAIT, auto: +p.auto > 1 ? +p.auto : 0, out: 0, win: 0, ended: false };
        this.rounds.set(r.id, r); await this.ctx.storage.put('cround:' + r.id, r);
        return json(200, { id: r.id, startIn: CR_WAIT, speed: CR_SPEED, hash: await sha256hex(cp.toFixed(2) + ':' + salt), balance: await this.cset(wallet, bal - bet) });
      }
      if (path === 'crash/cashout' || path === 'crash/state') {
        const id = String(p.id || url.searchParams.get('id') || ''); let r = this.rounds.get(id) || await this.ctx.storage.get('cround:' + id);
        if (!r || r.wallet !== wallet) return json(404, { error: 'round not found' }); this.rounds.set(id, r);
        const now = Date.now(), mNow = now < r.t0 ? 1 : Math.exp(CR_SPEED * (now - r.t0) / 1000), crashAt = r.t0 + Math.log(r.cp) / CR_SPEED * 1000;
        const settle = async () => { if (r.ended) return; r.ended = true; if (!r.out && r.auto && r.auto < r.cp) { r.out = r.auto; r.win = Math.floor(r.bet * r.auto); await this.cset(wallet, (await this.cbal(wallet)) + r.win); } await this.ctx.storage.put('cround:' + id, r); setTimeout(() => this.rounds.delete(id), 60e3); };
        if (path === 'crash/cashout' && !r.ended && !r.out && now >= r.t0) {
          const m = Math.min(mNow, +p.m > 1 ? +p.m : mNow);
          if (now < crashAt && mNow < r.cp) { const at = r.auto && r.auto <= m ? r.auto : Math.floor(m * 100) / 100; r.out = at; r.win = Math.floor(r.bet * at); await this.cset(wallet, (await this.cbal(wallet)) + r.win); await this.ctx.storage.put('cround:' + id, r); }
        }
        if (!r.ended && !r.out && r.auto && now < crashAt && mNow >= r.auto) { r.out = r.auto; r.win = Math.floor(r.bet * r.auto); await this.cset(wallet, (await this.cbal(wallet)) + r.win); await this.ctx.storage.put('cround:' + id, r); }   // auto cash out
        if (now >= crashAt) await settle();
        const out = { id, state: r.ended ? 'ended' : now < r.t0 ? 'wait' : 'run', out: r.out, win: r.win, balance: await this.cbal(wallet) };
        if (r.ended) { out.cp = r.cp; out.salt = r.salt; }
        return json(200, out);
      }
      return json(404, { error: 'unknown casino call' });
    }
  });
}
