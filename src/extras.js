// Shop (cosmetics + VIP paid in SOL, in the project token at a live price, or in chips) and the chips casino.
// Chips are the one play currency: a free refill every day, packs for SOL, spent on casino games, ranked runs and cosmetics.
// Chips never turn back into SOL or anything else that leaves the game. Installed onto the Cafe Durable Object by installExtras(Cafe).
import { PublicKey } from '@solana/web3.js';

const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{60,100}$/;

/* prices are set in SOL; a payment in the project token is converted at the live market price when the quote is made */
export const SHOP = {
  laser: { sol: 0.05 }, chain: { sol: 0.08 }, crown: { sol: 0.12 }, wings: { sol: 0.15 }, aura: { sol: 0.1 }, pet: { sol: 0.06 },
  jetpack: { sol: 0.1 }, horns: { sol: 0.07 }, halo: { sol: 0.07 }, shades: { sol: 0.04 }, bag: { sol: 0.09 }, flag: { sol: 0.06 },
  profeed: { sol: 0.1, days: 30 }   // pro trade feed: 30 days
};
const FLAIR_IDS = Object.keys(SHOP).filter(k => k !== 'profeed');
/* chips: 1 chip is worth about $0.002. A new wallet gets a small trial stack; after that chips are bought in packs priced in USD
   and paid in SOL at the live price. Chips are also earned in small amounts by the hunts (crates, stories, candles) and by
   royalties on trades of your own coin. */
const CHIP_START = 250, MIN_BET = 10, MAX_BET = 5000, CR_SPEED = 0.12, CR_WAIT = 2000, CHIPS_PER_USD = 500;
const CHIP_PACKS_DEFAULT = [{ usd: 10, chips: 5000 }, { usd: 25, chips: 13500 }, { usd: 50, chips: 30000 }];
const SLOT = [{ k: 'mug', w: 1, p3: 100, p2: 4 }, { k: 'dia', w: 2, p3: 30, p2: 2.5 }, { k: 'cnd', w: 3, p3: 12, p2: 1.5 }, { k: 'ban', w: 4, p3: 6, p2: 1 }, { k: 'rug', w: 4, p3: 0, p2: 0 }];
const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const dayKey = () => new Date().toISOString().slice(0, 10);
async function sha256hex(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

export function installExtras(Cafe) {
  Object.assign(Cafe.prototype, {
    extrasInit(env) {
      this.PAY_TOKEN_MINT = String(env.PAY_TOKEN_MINT || '').trim();
      this.CHIP_PACKS = CHIP_PACKS_DEFAULT;
      try { const pk = JSON.parse(env.CHIP_PACKS || 'null'); if (Array.isArray(pk) && pk.length && pk.length <= 6 && pk.every(x => +x.usd >= 1 && +x.usd <= 1000 && Number.isInteger(+x.chips) && +x.chips > 0)) this.CHIP_PACKS = pk.map(x => ({ usd: +x.usd, chips: +x.chips })); } catch (e) { this.log('[chips] bad CHIP_PACKS, using defaults'); }
      this.ARCADE_RUN_CHIPS = Number.isInteger(+env.ARCADE_RUN_CHIPS) && +env.ARCADE_RUN_CHIPS >= 0 ? +env.ARCADE_RUN_CHIPS : 1000;
      this.tokInfo = null; this.tokPx = { usd: 0, at: 0 }; this.rounds = new Map();
      this.VIP_DESK_SOL = +(env.VIP_DESK_SOL ?? 0.05); this.PLATE_SOL = +(env.PLATE_SOL ?? 0.03);
    },
    async extrasLoad() { this.items = (await this.ctx.storage.get('items')) || {}; this.subs = (await this.ctx.storage.get('subs')) || {}; },
    proUntil(wallet) { const u = wallet && this.subs[wallet]; return u && u > Date.now() ? u : 0; },
    extrasCfg() {
      return { shop: SHOP, vipDeskFee: this.VIP_DESK_SOL, plateFee: this.PLATE_SOL, payToken: this.PAY_TOKEN_MINT ? { mint: this.PAY_TOKEN_MINT, symbol: this.tokInfo?.symbol || '' } : null, casino: { start: CHIP_START, min: MIN_BET, max: MAX_BET, packs: this.CHIP_PACKS, buy: this.LIVE, perUsd: CHIPS_PER_USD, runChips: this.ARCADE_RUN_CHIPS }, arcade: this.arcadeCfg() };
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

    /* ---------- chips ---------- */
    async cbal(w) { const v = await this.ctx.storage.get('cbal:' + w); if (v === undefined) { await this.ctx.storage.put('cbal:' + w, CHIP_START); return CHIP_START; } return v; },
    async cset(w, n) { n = Math.max(0, Math.floor(n)); await this.ctx.storage.put('cbal:' + w, n); return n; },
    async cspend(w, n) { const bal = await this.cbal(w); if (bal < n) return -1; return this.cset(w, bal - n); },   // -1 = not enough chips
    async crashSettle(r) {   // the round is over: an auto cash out below the rug point pays, then the round is closed
      if (r.ended) return; r.ended = true;
      if (!r.out && r.auto && r.auto < r.cp) { r.out = r.auto; r.win = Math.floor(r.bet * r.auto); await this.cset(r.wallet, (await this.cbal(r.wallet)) + r.win); }
      await this.ctx.storage.put('cround:' + r.id, r); setTimeout(() => this.rounds.delete(r.id), 60e3);
    },
    betChips(bet) { const b = Math.floor(+bet); return b >= MIN_BET && b <= MAX_BET ? b : 0; },
    chipPrice(item) { return this.SOL_USD > 0 ? Math.round(this.priceSol(item) * this.SOL_USD * CHIPS_PER_USD) : 0; },   // 0 = no live SOL price yet
    async cadd(w, n, why) { const bal = await this.cset(w, (await this.cbal(w)) + n); this.sendToWallet(w, { t: 'chips', balance: bal, delta: n, why }); return bal; },

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
        const item = String(p.item || ''), sig = String(p.sig || '').trim(), method = p.method === 'token' ? 'token' : p.method === 'chips' ? 'chips' : 'sol';
        if (!this.priceSol(item)) return json(400, { error: 'unknown item' });
        if (method === 'chips') {   // paid from the chip balance: no transaction, no signature
          if (FLAIR_IDS.includes(item) && (this.items[wallet] || []).includes(item)) return json(200, { ok: true, again: true, item, items: this.items[wallet] || [], vip: !!this.vips[wallet], pro: this.proUntil(wallet), balance: await this.cbal(wallet) });
          if (item === 'vip' && this.vips[wallet]) return json(200, { ok: true, again: true, item, items: this.items[wallet] || [], vip: true, pro: this.proUntil(wallet), balance: await this.cbal(wallet) });
          const price = this.chipPrice(item), bal = await this.cbal(wallet);
          if (!price) return json(503, { error: 'no live SOL price yet, try again in a minute' });
          if (bal < price) return json(402, { error: 'not enough chips', code: 'broke', price, balance: bal });
          await this.cset(wallet, bal - price); await this.grant(wallet, item);
          this.log('[buy]', item, 'chips', wallet);
          return json(200, { ok: true, item, items: this.items[wallet] || [], vip: !!this.vips[wallet], pro: this.proUntil(wallet), balance: bal - price });
        }
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

      /* ----- chips casino: free refill daily, packs for SOL, server-settled games. Nothing is ever paid out. ----- */
      if (!url.pathname.startsWith('/api/casino/')) return json(404, { error: 'unknown call' });
      const wallet = this.walletOfToken(tokenParam); if (!wallet) return json(401, { error: 'sign in with Phantom first' });
      if (!this.allowHits('c:' + wallet, 240, 60e3)) return json(429, { error: 'slow down' });
      const path = url.pathname.slice('/api/casino/'.length);
      if (path === 'info') { const bal = await this.cbal(wallet); return json(200, { balance: bal, min: MIN_BET, max: MAX_BET, packs: this.CHIP_PACKS, buy: this.LIVE && this.SOL_USD > 0, solUsd: this.SOL_USD, runChips: this.ARCADE_RUN_CHIPS }); }
      if (path === 'quote') {   // a pack is priced in USD and paid in SOL at the live price; the quote is good for 15 minutes
        if (!this.LIVE) return json(403, { error: 'chip packs are off in simulation mode' });
        const pack = this.CHIP_PACKS[Math.floor(+p.pack)]; if (!pack) return json(400, { error: 'unknown pack' });
        if (!(this.SOL_USD > 0)) return json(503, { error: 'no live SOL price yet, try again in a minute' });
        const sol = Math.ceil(pack.usd / this.SOL_USD * 1e4) / 1e4, id = crypto.randomUUID();
        await this.ctx.storage.put('cq:' + id, { pack: Math.floor(+p.pack), sol, at: Date.now() });
        return json(200, { id, sol, usd: pack.usd, chips: pack.chips, solUsd: this.SOL_USD });
      }
      if (path === 'buy') {   // one SOL payment to the cafe wallet for a quoted pack, checked on chain. Same signature = same credit, never twice.
        if (!this.LIVE) return json(403, { error: 'chip packs are off in simulation mode' });
        const sig = String(p.sig || '').trim(); if (!SIG_RE.test(sig)) return json(400, { error: 'bad signature' });
        const done = await this.ctx.storage.get('cbuy:' + sig);
        if (done) { if (done.wallet !== wallet) return json(400, { error: 'payment belongs to another wallet' }); return json(200, { ok: true, again: true, credited: done.chips, balance: await this.cbal(wallet) }); }
        const q = await this.ctx.storage.get('cq:' + String(p.quote || '')); if (!q || Date.now() - q.at > 864e5) return json(400, { error: 'price quote expired, try again', code: 'quote' });   // a quote is honoured for a day: a late payment still counts
        const pack = this.CHIP_PACKS[q.pack]; if (!pack) return json(400, { error: 'unknown pack' });
        const pv = await this.checkPayment(sig, q.sol, wallet);
        if (pv !== 'ok') return json(402, { error: pv === 'wait' ? 'payment not visible on Solana yet, press again in a minute: you will not be charged twice' : pv === 'used' ? 'this payment was already used' : 'payment not found or too small', code: pv });
        await this.ctx.storage.put('cbuy:' + sig, { wallet, chips: pack.chips, usd: pack.usd, sol: q.sol, at: Date.now() });
        const bal = await this.cset(wallet, (await this.cbal(wallet)) + pack.chips);
        this.log('[chips] pack $' + pack.usd, q.sol, 'SOL ->', pack.chips, wallet.slice(0, 6));
        return json(200, { ok: true, credited: pack.chips, balance: bal });
      }
      if (path === 'flip') {
        const bet = this.betChips(p.bet); if (!bet) return json(400, { error: 'bet must be between ' + MIN_BET + ' and ' + MAX_BET + ' chips' });
        const bal = await this.cbal(wallet); if (bet > bal) return json(400, { error: 'not enough chips', code: 'broke' });
        const res = rnd() < 0.5 ? 'up' : 'down', side = p.side === 'down' ? 'down' : 'up', win = res === side ? Math.floor(bet * 1.95) : 0;
        return json(200, { res, win, balance: await this.cset(wallet, bal - bet + win) });
      }
      if (path === 'slots') {
        const bet = this.betChips(p.bet); if (!bet) return json(400, { error: 'bet must be between ' + MIN_BET + ' and ' + MAX_BET + ' chips' });
        const bal = await this.cbal(wallet); if (bet > bal) return json(400, { error: 'not enough chips', code: 'broke' });
        const roll = () => { const T = SLOT.reduce((s, x) => s + x.w, 0); let r = rnd() * T; for (const s of SLOT) if ((r -= s.w) < 0) return s; return SLOT[0]; };
        const res = [roll(), roll(), roll()], [a, b, c] = res.map(s => s.k);
        let mult = 0; if (a === b && b === c) mult = res[0].p3; else { const pr = a === b || a === c ? res[0] : b === c ? res[1] : null; if (pr) mult = pr.p2; }
        const win = Math.floor(bet * mult);
        return json(200, { reels: [a, b, c], mult, win, balance: await this.cset(wallet, bal - bet + win) });
      }
      if (path === 'crash/start') {
        const bet = this.betChips(p.bet); if (!bet) return json(400, { error: 'bet must be between ' + MIN_BET + ' and ' + MAX_BET + ' chips' });
        for (const r of this.rounds.values()) if (r.wallet === wallet && !r.ended) {
          const crashAt = r.t0 + Math.log(r.cp) / CR_SPEED * 1000;
          if (Date.now() < crashAt) return json(400, { error: 'finish your current round first' });
          await this.crashSettle(r);   // the old round rugged while the player was away: settle it (auto cash out pays) and move on
        }
        const bal = await this.cbal(wallet); if (bet > bal) return json(400, { error: 'not enough chips', code: 'broke' });
        const u = rnd(), cp = u < 0.03 ? 1 : Math.max(1, Math.floor(97 / (1 - u)) / 100), salt = crypto.randomUUID();
        const r = { id: crypto.randomUUID(), wallet, bet, cp, salt, t0: Date.now() + CR_WAIT, auto: +p.auto > 1 ? +p.auto : 0, out: 0, win: 0, ended: false };
        this.rounds.set(r.id, r); await this.ctx.storage.put('cround:' + r.id, r);
        return json(200, { id: r.id, startIn: CR_WAIT, t0: r.t0, speed: CR_SPEED, hash: await sha256hex(cp.toFixed(2) + ':' + salt), balance: await this.cset(wallet, bal - bet) });
      }
      if (path === 'crash/cashout' || path === 'crash/state') {
        const id = String(p.id || url.searchParams.get('id') || ''); let r = this.rounds.get(id) || await this.ctx.storage.get('cround:' + id);
        if (!r || r.wallet !== wallet) return json(404, { error: 'round not found' }); this.rounds.set(id, r);
        const now = Date.now(), mNow = now < r.t0 ? 1 : Math.exp(CR_SPEED * (now - r.t0) / 1000), crashAt = r.t0 + Math.log(r.cp) / CR_SPEED * 1000;
        const settle = () => this.crashSettle(r);
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
