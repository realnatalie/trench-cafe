// BUYBACK: a share of the cafe's income buys the main token back on the open market, from a wallet that does nothing else.
//
//   income ──▶ server hot wallet ──(sweep every 10 min)──▶ BUYBACK_SHARE ──▶ buyback wallet ──▶ market buy ──▶ burn or hold
//                                                       └──────────────────▶ the rest ──▶ PAYOUT_WALLET
//
// Income is the pump.fun creator fees of every coin launched here and, with BUYBACK_FROM = "all", the site's own payments
// (launches, VIP, boosts, plates, chip packs, cosmetics, ranked runs), which then land on the hot wallet instead of the payout one.
// Buys are small, split over time and randomised, so bots cannot front-run a schedule. Every buy and burn is public.
//
// Off until BUYBACK_MINT and the BUYBACK_SECRET_KEY secret are both set. Installed onto the Cafe Durable Object by installBuyback(Cafe).
import { Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'node:buffer';
import bs58 from 'bs58';

const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
const PUMPPORTAL = 'https://pumpportal.fun/api/trade-local';
const LAMPORTS = 1e9;
export const BUYBACK_DEFAULTS = { share: 0.5, mode: 'burn', maxSol: 0.25, minSol: 0.01, slippage: 10, keepSol: 0.015, skipChance: 0.35, keep: 30 };

/** SPL Token and Token-2022 share the Burn instruction: index 8, then the amount as u64 little-endian */
export function burnData(amount) {
  const d = new Uint8Array(9); d[0] = 8; new DataView(d.buffer).setBigUint64(1, BigInt(amount), true); return Buffer.from(d);
}
/** how much of a sweep goes to the buyback wallet, in lamports */
export function splitSweep(lamports, share) { const s = Math.min(1, Math.max(0, +share || 0)); const bb = Math.floor(lamports * s); return { buyback: bb, payout: lamports - bb }; }
/** the size of the next buy: never more than the cap, never so much that the wallet cannot pay its fees */
export function nextBuySol(balanceSol, cfg = BUYBACK_DEFAULTS, rnd = Math.random) {
  const spendable = balanceSol - cfg.keepSol; if (spendable < cfg.minSol) return 0;
  return Math.max(cfg.minSol, Math.floor(Math.min(spendable, cfg.maxSol) * (0.55 + rnd() * 0.45) * 1e4) / 1e4);
}

export function installBuyback(Cafe) {
  Object.assign(Cafe.prototype, {
    buybackInit(env) {
      const num = (v, d) => (v === undefined || v === '' || !isFinite(+v) ? d : +v);
      let key = null; try { if (env.BUYBACK_SECRET_KEY) key = Keypair.fromSecretKey(bs58.decode(String(env.BUYBACK_SECRET_KEY).trim())); } catch (e) { this.log('[buyback] bad BUYBACK_SECRET_KEY'); }
      let mint = String(env.BUYBACK_MINT || '').trim(); try { if (mint) mint = new PublicKey(mint).toBase58(); } catch (e) { this.log('[buyback] bad BUYBACK_MINT'); mint = ''; }
      this.BB = {
        key, pub: key ? key.publicKey.toBase58() : '', mint,
        share: Math.min(1, Math.max(0, num(env.BUYBACK_SHARE, BUYBACK_DEFAULTS.share))),
        mode: env.BUYBACK_MODE === 'hold' ? 'hold' : 'burn',
        from: env.BUYBACK_FROM === 'fees' ? 'fees' : 'all',
        maxSol: num(env.BUYBACK_MAX_SOL, BUYBACK_DEFAULTS.maxSol), minSol: BUYBACK_DEFAULTS.minSol, keepSol: BUYBACK_DEFAULTS.keepSol,
        slippage: num(env.BUYBACK_SLIPPAGE, BUYBACK_DEFAULTS.slippage), skipChance: BUYBACK_DEFAULTS.skipChance
      };
      if (this.buybackOn() && this.BB.from === 'all' && this.OWNER_PUBKEY) this.FEE_RECEIVER = this.OWNER_PUBKEY;   // site payments flow through the hot wallet so they can be split
    },
    buybackOn() { return !!(this.BB && this.BB.key && this.BB.mint && this.BB.share > 0 && this.OWNER); },
    /** wallets a payment may be addressed to: the current receiver, plus the payout wallet for payments started before a switch */
    payReceivers() { return [...new Set([this.FEE_RECEIVER, this.PAYOUT_WALLET].filter(Boolean))]; },
    async buybackStats() { return (await this.ctx.storage.get('buyback:stats')) || { sol: 0, bought: '0', burned: '0', decimals: 6, buys: [], fed: 0 }; },
    async tokenHoldings(owner, mint) {   // all token accounts of `owner` for `mint`, with their program (SPL Token or Token-2022)
      const r = await this.rpcJson('getTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      return ((r && r.value) || []).map(a => ({ account: a.pubkey, program: a.account.owner, amount: BigInt(a.account.data.parsed.info.tokenAmount.amount), decimals: a.account.data.parsed.info.tokenAmount.decimals }));
    },
    async sendLegacy(tx, signer, waitMs = 45000) {
      tx.feePayer = signer.publicKey; tx.recentBlockhash = (await this.rpcJson('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash; tx.sign(signer);
      const raw = tx.serialize().toString('base64'), sig = bs58.encode(tx.signature);
      await this.rpcJson('sendTransaction', [raw, { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 5 }]);
      const t0 = Date.now();
      while (Date.now() - t0 < waitMs) {
        await new Promise(r => setTimeout(r, 2000));
        const st = (await this.rpcJson('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]).catch(() => null))?.value?.[0];
        if (st && st.err) throw new Error('transaction failed on chain: ' + sig);
        if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return sig;
      }
      throw new Error('not confirmed in time: ' + sig);
    },
    async buybackBurnAll() {   // burn every token the buyback wallet holds
      const BB = this.BB, owner = BB.key.publicKey, list = (await this.tokenHoldings(BB.pub, BB.mint)).filter(h => h.amount > 0n);
      if (!list.length) return { burned: 0n, sig: '' };
      const tx = new Transaction(); let burned = 0n;
      for (const h of list) {
        tx.add(new TransactionInstruction({ programId: new PublicKey(h.program), data: burnData(h.amount), keys: [{ pubkey: new PublicKey(h.account), isSigner: false, isWritable: true }, { pubkey: new PublicKey(BB.mint), isSigner: false, isWritable: true }, { pubkey: owner, isSigner: true, isWritable: false }] }));
        burned += h.amount;
      }
      return { burned, sig: await this.sendLegacy(tx, BB.key) };
    },
    /** one step of the robot, run by the scheduled job after the sweep */
    async buybackRun(force = false) {
      if (!this.buybackOn()) return null;
      const BB = this.BB;
      try {
        const balSol = (await this.conn.getBalance(BB.key.publicKey)) / LAMPORTS;
        const sol = nextBuySol(balSol, BB);
        if (!sol) return null;
        if (!force && balSol < BB.maxSol * 3 && Math.random() < BB.skipChance) return null;   // irregular timing: no schedule to front-run
        const before = (await this.tokenHoldings(BB.pub, BB.mint)).reduce((s, h) => s + h.amount, 0n);
        const r = await fetch(PUMPPORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: BB.pub, action: 'buy', mint: BB.mint, amount: sol, denominatedInSol: 'true', slippage: BB.slippage, priorityFee: 0.00005, pool: 'auto' }) });
        if (!r.ok) { this.log('[buyback] quote failed', r.status, (await r.text()).slice(0, 160)); return null; }
        const sig = await this.signAndSend(await r.arrayBuffer(), [BB.key]);
        const hold = await this.tokenHoldings(BB.pub, BB.mint), after = hold.reduce((s, h) => s + h.amount, 0n), bought = after > before ? after - before : 0n;
        let burn = { burned: 0n, sig: '' };
        if (BB.mode === 'burn') { try { burn = await this.buybackBurnAll(); } catch (e) { this.log('[buyback] burn failed, will retry next run:', e.message); } }
        const st = await this.buybackStats();
        st.sol = Math.round((st.sol + sol) * 1e4) / 1e4; st.bought = (BigInt(st.bought) + bought).toString(); st.burned = (BigInt(st.burned) + burn.burned).toString();
        if (hold[0]) st.decimals = hold[0].decimals;
        st.buys.unshift({ at: Date.now(), sol, bought: bought.toString(), sig, burnSig: burn.sig }); st.buys = st.buys.slice(0, BUYBACK_DEFAULTS.keep);
        await this.ctx.storage.put('buyback:stats', st);
        this.broadcast({ t: 'buyback', sol, bought: bought.toString(), burned: burn.burned.toString(), decimals: st.decimals, sig });
        this.log('[buyback]', sol, 'SOL ->', bought.toString(), BB.mode === 'burn' ? 'burned ' + burn.burned.toString() : 'held', sig);
        return { sol, sig };
      } catch (e) { this.log('[buyback] error', e.message); return null; }
    },
    async buybackView() {
      const BB = this.BB || {}, st = await this.buybackStats();
      return { on: this.buybackOn(), mint: BB.mint || '', wallet: BB.pub || '', mode: BB.mode || 'burn', share: BB.share || 0, from: BB.from || 'all', sol: st.sol, bought: st.bought, burned: st.burned, decimals: st.decimals, fed: st.fed || 0, buys: st.buys.slice(0, 10) };
    },
    async buybackHandle(req, url) {
      if (req.method === 'GET' && url.pathname === '/api/buyback') return json(200, await this.buybackView());
      return json(404, { error: 'unknown buyback call' });
    }
  });
}
