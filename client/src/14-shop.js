/* ================= SHOP: cosmetics and the VIP pass, paid in SOL or in the project token =================
   Prices are set in SOL on the server. When a project token is configured (PAY_TOKEN_MINT), the server quotes the
   same price in that token at the live market rate, so the token amount moves with the token price. */
const SHOP_IDS = ['laser', 'chain', 'crown', 'wings', 'aura', 'pet', 'jetpack', 'horns', 'halo', 'shades', 'bag', 'flag'];
NET.pro = 0;
const isPro = () => NET.pro > Date.now();
let whaleAudio = null;
function whaleAlert(a, tx) {
  toast(t('fe_whale_toast', { s: '$' + a.sym, n: (+tx.sol).toFixed(2), k: tx.side === 'sell' ? t('fe_sell') : t('fe_buy') }), tx.side === 'sell' ? 'bad' : 'gold', true);
  try { whaleAudio = whaleAudio || new (window.AudioContext || window.webkitAudioContext)(); const o = whaleAudio.createOscillator(), g = whaleAudio.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(tx.side === 'sell' ? 440 : 660, whaleAudio.currentTime); o.frequency.exponentialRampToValueAtTime(tx.side === 'sell' ? 220 : 990, whaleAudio.currentTime + 0.18); g.gain.setValueAtTime(0.0001, whaleAudio.currentTime); g.gain.exponentialRampToValueAtTime(0.12, whaleAudio.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, whaleAudio.currentTime + 0.35); o.connect(g).connect(whaleAudio.destination); o.start(); o.stop(whaleAudio.currentTime + 0.36); } catch (e) { }
}
const SHOP_ART = {
  laser: `<svg viewBox="0 0 64 64"><rect x="14" y="14" width="36" height="36" fill="#e8b894"/><rect x="20" y="28" width="8" height="6" fill="#ff2a2a"/><rect x="36" y="28" width="8" height="6" fill="#ff2a2a"/><path d="M28 31h34M44 31h18" stroke="#ff2a2a" stroke-width="3"/></svg>`,
  chain: `<svg viewBox="0 0 64 64"><path d="M14 14q18 30 36 0" fill="none" stroke="#e8f4ff" stroke-width="5"/><path d="M32 30l10 10-10 14-10-14z" fill="#cfe9ff"/></svg>`,
  crown: `<svg viewBox="0 0 64 64"><path d="M10 46l4-26 12 12 6-16 6 16 12-12 4 26z" fill="#e5bf72"/><circle cx="20" cy="40" r="3" fill="#d9707a"/><circle cx="32" cy="40" r="3" fill="#8fd3a6"/><circle cx="44" cy="40" r="3" fill="#d9707a"/></svg>`,
  wings: `<svg viewBox="0 0 64 64"><path d="M30 34C20 18 8 18 4 24c8 0 14 6 26 14zM34 34c10-16 22-16 26-10-8 0-14 6-26 14z" fill="#e5bf72"/><path d="M30 40C20 30 10 32 6 36c8 0 14 2 24 8zM34 40c10-10 20-8 24-4-8 0-14 2-24 8z" fill="#c8a96a"/></svg>`,
  aura: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="48" rx="24" ry="7" fill="none" stroke="#e5bf72" stroke-width="3"/>${[10, 22, 42, 54].map((x, i) => `<rect x="${x - 3}" y="${26 + (i % 2) * 6}" width="6" height="12" fill="#8fd3a6"/>`).join('')}</svg>`,
  pet: `<svg viewBox="0 0 64 64"><rect x="18" y="26" width="24" height="24" fill="#ece9e2"/><rect x="42" y="32" width="6" height="12" fill="#ece9e2"/><rect x="21" y="26" width="18" height="4" fill="#2a1c14"/><rect x="22" y="12" width="4" height="10" fill="#8fd3a6"/><rect x="30" y="8" width="4" height="14" fill="#8fd3a6"/><rect x="38" y="4" width="4" height="16" fill="#8fd3a6"/></svg>`,
  jetpack: `<svg viewBox="0 0 64 64"><rect x="18" y="10" width="12" height="30" rx="4" fill="#9aa3b2"/><rect x="34" y="10" width="12" height="30" rx="4" fill="#9aa3b2"/><path d="M24 42l-5 14 5-6 5 6zM40 42l-5 14 5-6 5 6z" fill="#ff6a2a"/><path d="M24 44l-2 8 2-3 2 3zM40 44l-2 8 2-3 2 3z" fill="#ffd36e"/></svg>`,
  horns: `<svg viewBox="0 0 64 64"><path d="M20 44c-10-6-14-20-8-32 2 12 8 18 14 22zM44 44c10-6 14-20 8-32-2 12-8 18-14 22z" fill="#d9707a"/><rect x="18" y="40" width="28" height="12" fill="#e8b894"/></svg>`,
  halo: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="16" rx="22" ry="7" fill="none" stroke="#ffe066" stroke-width="5"/><rect x="18" y="26" width="28" height="26" fill="#e8b894"/></svg>`,
  shades: `<svg viewBox="0 0 64 64"><rect x="6" y="24" width="22" height="16" rx="4" fill="#0a0a0b"/><rect x="36" y="24" width="22" height="16" rx="4" fill="#0a0a0b"/><path d="M28 30h8M4 28h4M56 28h4" stroke="#0a0a0b" stroke-width="3"/><path d="M10 28h8" stroke="#c8a96a" stroke-width="2"/></svg>`,
  bag: `<svg viewBox="0 0 64 64"><path d="M14 26h36l-4 30H18z" fill="#5a3a22"/><path d="M22 26c0-10 20-10 20 0" fill="none" stroke="#5a3a22" stroke-width="5"/><text x="32" y="48" text-anchor="middle" font-family="monospace" font-weight="700" font-size="16" fill="#c8a96a">$</text></svg>`,
  flag: `<svg viewBox="0 0 64 64"><rect x="12" y="6" width="4" height="52" fill="#1d1d1f"/><path d="M16 10h34l-8 10 8 10H16z" fill="#8fd3a6"/><rect x="22" y="16" width="4" height="8" fill="#0a0a0b"/><rect x="30" y="13" width="4" height="11" fill="#0a0a0b"/><rect x="38" y="11" width="4" height="13" fill="#0a0a0b"/></svg>`
};
NET.owned = [];
function myFlair() { const eq = store.get('cc_flair', []) || []; return eq.filter(x => NET.owned.includes(x)); }
async function refreshOwned() {
  if (!NET.http || !NET.token) return;
  try { const j = await (await fetch(NET.http + '/api/items?token=' + encodeURIComponent(NET.token))).json(); NET.owned = j.items || []; if (j.vip) NET.vip = true; NET.pro = +j.pro || 0; feedDirty = true; if (player) applyFlair(player.obj, myFlair()); if (selAvatar) applyFlair(selAvatar.obj, myFlair()); netHello(); } catch (e) { }
}
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWTnTQ8sBaVCGXH6L';
function u64le(v) { const b = new Uint8Array(8); let x = BigInt(v); for (let i = 0; i < 8; i++) { b[i] = Number(x & 0xffn); x >>= 8n; } return b; }
/* pays a token quote from the player's Phantom: creates the receiver's token account if needed, then a checked transfer */
async function payToken(tok, onSent) {
  const pv = await ensurePhantom(); const W3 = await loadWeb3();
  const owner = new W3.PublicKey(NET.wallet), mint = new W3.PublicKey(tok.mint), prog = new W3.PublicKey(tok.program || TOKEN_PROGRAM), ataProg = new W3.PublicKey(ATA_PROGRAM), dest = new W3.PublicKey(NET.cfg.owner);
  const ata = o => W3.PublicKey.findProgramAddressSync([o.toBuffer(), prog.toBuffer(), mint.toBuffer()], ataProg)[0];
  const from = ata(owner), to = ata(dest);
  const tx = new W3.Transaction();
  tx.add(new W3.TransactionInstruction({ programId: ataProg, data: Uint8Array.of(1), keys: [{ pubkey: owner, isSigner: true, isWritable: true }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: dest, isSigner: false, isWritable: false }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: W3.SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: prog, isSigner: false, isWritable: false }] }));
  const data = new Uint8Array(10); data[0] = 12; data.set(u64le(tok.raw), 1); data[9] = tok.decimals;
  tx.add(new W3.TransactionInstruction({ programId: prog, data, keys: [{ pubkey: from, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: owner, isSigner: true, isWritable: false }] }));
  tx.feePayer = owner; tx.recentBlockhash = (await rpcTry(W3, c => c.getLatestBlockhash('confirmed'))).blockhash;
  const { signature } = await sendViaPhantom(pv, tx); if (onSent) onSent(signature);
  await waitConfirmed(W3, signature); return signature;
}
/* one purchase: SOL or token. A paid but not yet credited purchase is retried with the same payment, never paid twice */
async function buyItem(item, method) {
  if (!NET.http) throw new Error(t('shop_off'));
  if (!NET.loggedIn || !NET.token) await walletLogin();
  if (method === 'chips') {   // paid from the chip balance: one call, no transaction
    const r = await fetch(NET.http + '/api/buy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: NET.token, item, method }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.code === 'broke' ? t('shop_no_chips', { n: fmtChips(j.price || 0), b: fmtChips(j.balance || 0) }) : j.error || 'purchase failed');
    NET.owned = j.items || NET.owned; NET.chips = j.balance; if (j.vip) { NET.vip = true; if (player) player.tag.classList.add('vip'); } if (j.pro) { NET.pro = +j.pro; feedDirty = true; } return j;
  }
  const key = 'cc_buy_' + item; let pend = store.get(key, null), quote = null, sig;
  if (pend && pend.method === method && Date.now() - pend.at < 864e5) { sig = pend.sig; quote = pend.quote; }
  else if (method === 'token') {
    const q = await (await fetch(NET.http + '/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item }) })).json();
    if (!q.token) throw new Error(q.tokenError || q.error || t('shop_no_price'));
    quote = q.id; sig = await payToken(q.token, s => store.set(key, { sig: s, method, quote, at: Date.now() }));
  } else { const price = item === 'vip' ? NET.cfg.vipFee : NET.cfg.shop[item].sol; sig = await paySol(price, s => store.set(key, { sig: s, method, at: Date.now() })); }
  store.set(key, { sig, method, quote, at: Date.now() });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(NET.http + '/api/buy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: NET.token, item, method, sig, quote }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { store.set(key, null); NET.owned = j.items || NET.owned; if (j.vip) { NET.vip = true; if (player) player.tag.classList.add('vip'); } if (j.pro) { NET.pro = +j.pro; feedDirty = true; } return j; }
    if (j.code !== 'wait') { if (j.code === 'used' || j.code === 'bad') store.set(key, null); throw new Error(j.error || 'purchase failed'); }
    await sleep(8000);
  }
  throw new Error(t('shop_pending'));
}
let shopRate = null;   // tokens per 1 SOL, from the latest quote (display only: each purchase gets its own fresh quote)
async function loadShopRate() {
  shopRate = null; if (!NET.http || !NET.cfg.payToken) return;
  try { const q = await (await fetch(NET.http + '/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: 'vip' }) })).json(); if (q.token) shopRate = { perSol: q.token.ui / q.sol, symbol: q.token.symbol || 'TOKEN', usdPerSol: q.token.usd / q.sol }; } catch (e) { }
}
const fmtTok = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(n < 10 ? 2 : 0);
function shopModal() { let m = document.getElementById('mShop'); if (!m) { m = document.createElement('div'); m.className = 'modal'; m.id = 'mShop'; m.hidden = true; m.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><button type="button" class="xclose" data-close aria-label="Close">×</button><div id="shopBody"></div></div>'; document.body.appendChild(m); m.addEventListener('click', shopClick); } return m; }
async function openShop(focus) {
  shopModal(); showModal('mShop'); renderShop(); await loadShopRate(); renderShop();
  if (focus === 'profeed') { const el = document.querySelector('.shop-pro'); if (el) el.scrollIntoView({ block: 'center' }); }
}
function priceLine(sol) { return `<span class="p-sol">${sol} SOL</span>${shopRate ? `<span class="p-tok">≈ ${fmtTok(sol * shopRate.perSol)} $${esc(shopRate.symbol)}</span>` : ''}`; }
function renderShop() {
  const body = $('#shopBody'); if (!body) return; const cfg = NET.cfg.shop || {}, live = !!(NET.http && NET.cfg.shop), eq = myFlair();
  const tokBtn = id => NET.cfg.payToken && shopRate ? `<button type="button" class="btn small gold" data-buy="${id}" data-m="token">${t('shop_pay_tok', { s: '$' + esc(shopRate.symbol) })}</button>` : '';
  const chipBtn = id => { if (!csServer() || !NET.cfg.casino.perUsd || !(SOL_PX.usd > 0)) return ''; const n = Math.round((id === 'vip' ? NET.cfg.vipFee || 0 : cfg[id] ? cfg[id].sol : 0) * SOL_PX.usd * NET.cfg.casino.perUsd); return n > 0 ? `<button type="button" class="btn small" data-buy="${id}" data-m="chips">${t('shop_pay_chips', { n: fmtChips(n) })}</button>` : ''; };
  body.innerHTML = `<h3>${t('shop_t')}</h3><p class="sub">${t('shop_d')}${NET.cfg.payToken ? ' ' + t('shop_tok_note') : ''}</p>
    ${!live ? `<p class="note-box">${t('shop_off')}</p>` : ''}
    <div class="shop-vip"><div><b>VIP PASS</b><span>${t('vip_sub')}</span><div class="prices">${priceLine(NET.cfg.vipFee || 0.5)}</div></div><div class="acts">${NET.vip ? `<span class="pill famous">${t('vip_have')}</span>` : `<button type="button" class="btn small hot" data-buy="vip" data-m="sol">${t('shop_pay_sol')}</button>${tokBtn('vip')}${chipBtn('vip')}`}</div></div>
    ${cfg.profeed ? `<div class="shop-vip shop-pro"><div><b>PRO FEED · ${cfg.profeed.days} ${t('pro_days')}</b><span>${t('pro_d')}</span><div class="prices">${priceLine(cfg.profeed.sol)}</div></div><div class="acts">${isPro() ? `<span class="pill famous">${t('pro_on', { d: Math.max(1, Math.ceil((NET.pro - Date.now()) / 864e5)) })}</span>` : ''}<button type="button" class="btn small hot" data-buy="profeed" data-m="sol">${isPro() ? t('pro_extend') : t('shop_pay_sol')}</button>${tokBtn('profeed')}${chipBtn('profeed')}</div></div>` : ''}
    <div class="shop-grid">${SHOP_IDS.map(id => { const own = NET.owned.includes(id), on = eq.includes(id); return `<div class="shop-card ${own ? 'own' : ''}"><span class="art">${SHOP_ART[id]}</span><b>${t('it_' + id)}</b><small>${t('it_' + id + '_d')}</small>
      <div class="prices">${cfg[id] ? priceLine(cfg[id].sol) : ''}</div>
      <div class="acts">${own ? `<button type="button" class="btn small ${on ? '' : 'hot'}" data-equip="${id}">${on ? t('shop_unequip') : t('shop_equip')}</button>` : live ? `<button type="button" class="btn small hot" data-buy="${id}" data-m="sol">${t('shop_pay_sol')}</button>${tokBtn(id)}${chipBtn(id)}` : ''}</div></div>`; }).join('')}</div>
    <p class="muted" style="font-size:12px;margin-top:12px">${t('shop_foot')}</p>`;
}
async function shopClick(e) {
  const eqb = e.target.closest('[data-equip]');
  if (eqb) { const id = eqb.dataset.equip; let eq = store.get('cc_flair', []) || []; eq = eq.includes(id) ? eq.filter(x => x !== id) : [...eq, id]; store.set('cc_flair', eq); if (player) applyFlair(player.obj, myFlair()); if (selAvatar) applyFlair(selAvatar.obj, myFlair()); netHello(); renderShop(); return; }
  const bb = e.target.closest('[data-buy]'); if (!bb || bb.disabled) return;
  const item = bb.dataset.buy, method = bb.dataset.m; bb.disabled = true; const old = bb.textContent; bb.textContent = t('vip_checking');
  try {
    await buyItem(item, method);
    if (item !== 'vip' && item !== 'profeed') { const eq = store.get('cc_flair', []) || []; if (!eq.includes(item)) store.set('cc_flair', [...eq, item]); if (player) { applyFlair(player.obj, myFlair()); confetti(_w.copy(player.obj.position).setY(1.6), 40); } netHello(); }
    toast(t('shop_done', { s: item === 'vip' ? 'VIP' : item === 'profeed' ? 'PRO FEED' : t('it_' + item) }), 'gold', true); drawLoginState(); renderShop(); feedDirty = true;
  } catch (err) { toast(String(err.message || err).slice(0, 140)); bb.disabled = false; bb.textContent = old; }
}
