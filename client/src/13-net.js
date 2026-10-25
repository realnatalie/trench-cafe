
/* ================= multiplayer: active only when the page is served by the Trench Cafe server ================= */
const NET = { url: window.CC_SERVER || null, http: window.CC_SERVER ? window.CC_SERVER.replace(/^ws/, 'http').replace(/\/ws$/, '') : null, ws: null, id: null, remote: new Map(), online: 1, ready: false, lastSend: 0, cfg: { live: false, launchFee: 0, owner: '' }, lastSig: '', lastFull: 0, photoId: null, wallet: null, solBal: null, token: store.get('cc_token', '') || null, loggedIn: false, profile: null };
function netConnect() {
  if (!NET.url || NET.ws) return;
  try { NET.ws = new WebSocket(NET.url); } catch (e) { return; }
  NET.ws.onopen = () => { NET.ready = true; netHello(); };
  NET.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } netHandle(m); };
  NET.ws.onclose = () => { NET.ready = false; NET.ws = null; for (const r of NET.remote.values()) r.av.dispose(); NET.remote.clear(); setTimeout(netConnect, 3000); };
  NET.ws.onerror = () => { };
}
async function netHello() {
  if (!player || !NET.ready) return;
  if (!NET.photoId && myLook.photo === 'local' && NET.http) { try { const r = await fetch(NET.http + '/api/photo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: store.get('cc_photo', '') }) }); const j = await r.json(); if (j.id) NET.photoId = j.id; } catch (e) { } }
  const p = player.obj.position, photo = NET.photoId || '';
  netSend({ t: 'hello', c: charChoice, n: myName().slice(0, 16), look: charChoice === 'custom' ? { ...myLook, photo, say: undefined } : undefined, photo, em: myLook.emote, token: NET.token || undefined, fl: myFlair(), x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
}
function netSend(m) { if (NET.ready) { try { NET.ws.send(JSON.stringify(m)); } catch (e) { } } }
function netHandle(m) {
  switch (m.t) {
    case 'welcome': {
      NET.id = m.id; NET.online = m.online || 1; if (m.cfg) NET.cfg = m.cfg;
      if (m.px) Object.assign(PX, m.px); if (+m.sol > 0) SOL_PX.usd = +m.sol; if (m.ohlc) Object.assign(OHLC, m.ohlc);
      (m.players || []).forEach(netUpsert);
      (m.agents || []).forEach(netSeatAgent); setTimeout(watchPendingLaunch, 1500); NET.boosts = m.boosts || {}; applyBoosts(true);
      if (m.trades) for (const k in m.trades) (m.trades[k] || []).slice().reverse().forEach(tx => onTrade(tx, false));
      onPrices(m.px || {}); rebuildFeed();
      if (!featured) { const last = agents.filter(a => a.mint).sort((p, q) => q.at - p.at)[0]; if (last) setFeatured(last, false); }
      booths.forEach(drawScreen); drawWorldScreens(time); if (!$('#land').hidden) renderLand(); setTimeout(retryPendingVip, 2000); break;
    }
    case 'ps': (m.list || []).forEach(netUpsert); if (m.online) NET.online = m.online; break;
    case 'leave': { const r = NET.remote.get(m.id); if (r) { r.av.dispose(); NET.remote.delete(m.id); } if (m.online) NET.online = m.online; break; }
    case 'say': { const r = NET.remote.get(m.id); if (r) r.av.say(String(m.text).slice(0, 80)); break; }
    case 'emote': { const r = NET.remote.get(m.id); if (r) r.av.emote(); break; }
    case 'arcade': { toast(t('rk_perfect', { w: shortW(m.wallet), g: rkName(m.game) }), 'gold'); RK.top3dAt = 0; break; }
    case 'shout': { showShout(m); break; }
    case 'buyback': { onBuyback(m); break; }
    case 'plate': { const a = agents.find(x => x.mint === m.mint); if (a) { a.plate = String(m.text || '').slice(0, 24); if (a.booth) { applyBoothStage(a.booth); drawScreen(a.booth); } } break; }
    case 'boost': { NET.boosts = NET.boosts || {}; NET.boosts[m.mint] = m.until; const a = agents.find(x => x.mint === m.mint); if (a) { setFeatured(a, true); toast(t('boost_live', { s: '$' + a.sym }), 'gold', true); updateAgentTag(a); } break; }
    case 'launch': if (m.agent && m.agent.mint && m.agent.sym !== NET.launching && launchPaid() && (launchPaid().sym === m.agent.sym || (NET.wallet && m.agent.wallet === NET.wallet))) { pendingLaunchDone(m.agent); break; }
      if (m.agent && m.agent.mint && m.agent.sym !== NET.launching) { const a = netSeatAgent(m.agent); if (a) { feedPush({ kind: 'launch', a, at: Date.now() }); setFeatured(a, true); drawWorldScreens(time); } } break;
    case 'tx': for (const tx of (m.list || [])) onTrade(tx, true); break;
    case 'px': if (m.px) { Object.assign(PX, m.px); onPrices(m.px); if (openAgent && !$('#mBooth').hidden) { fillBooth(openAgent); if (chartView === 'own' && PX[openAgent.mint] && PX[openAgent.mint].pair) renderChart(openAgent); } } break;
    case 'sol': if (+m.usd > 0) { SOL_PX.usd = +m.usd; agents.forEach(updateAgentTag); } break;
    case 'league': { const c = lgCoin(m.mint); if (c) { c.pool = m.pool; c.backers = m.backers; } break; }
    case 'champion': { LG.at = 0; if (m.champ) toast(t('lg_new_champ', { s: m.champ.sym }), 'gold', true); break; }
    case 'backed': { toast(t('lg_got_backed', { s: m.sym, n: fmtChips(m.chips) }), 'gold', true); break; }
    case 'chips': { if (typeof m.balance === 'number') setSrvBal(m.balance); if (m.delta > 0 && (m.why === 'royalty' || m.why === 'league' || m.why === 'invite')) toast(t('hunt_got', { n: fmtChips(m.delta), s: t('hunt_why_' + m.why) + (m.sym ? ' $' + m.sym : '') }), 'gold', true); break; }
    case 'ohlc': if (m.mint && Array.isArray(m.c)) { OHLC[m.mint] = m.c; const a = agents.find(x => x.mint === m.mint); if (a && a.booth) drawScreen(a.booth); if (a && openAgent === a && !$('#mBooth').hidden) renderChart(a); } break;
    case 'online': NET.online = m.online; break;
  }
  const el = $('#onlineChip'); if (el) { el.hidden = false; el.textContent = NET.online + ' online'; } const ln = $('#landN'); if (ln) ln.textContent = NET.online;
}
function netUpsert(p) {
  if (!p) return;
  if (p.id === NET.id) { if (p.vip && !NET.vip) { NET.vip = true; if (player) player.tag.classList.add('vip'); toast(t('vip_done'), 'gold'); } return; }
  let r = NET.remote.get(p.id);
  if (!r) {
    const look = p.c === 'custom' ? sanitizeLook({ ...(p.look || {}), photo: '' }) : null;
    const av = new Avatar(CHAR[p.c] && !CHAR[p.c].npc ? p.c : 'degen', { cls: 'npc', look }); av.tag.innerHTML = `<b>${esc(String(p.n || p.c || 'player').slice(0, 16))}</b>`; av.obj.position.set(p.x || 0, 0, p.z || 20);
    r = { av, tx: p.x || 0, tz: p.z || 20, ry: p.ry || 0, st: 'idle', c: p.c, lk: JSON.stringify(look) }; NET.remote.set(p.id, r);
    if (Array.isArray(p.fl)) { applyFlair(av.obj, p.fl); r.fl = p.fl.join(','); }
  } else if (p.c && CHAR[p.c] && (p.c !== r.c || (p.c === 'custom' && p.look && JSON.stringify(sanitizeLook(p.look)) !== r.lk))) { r.av.dispose(); NET.remote.delete(p.id); netUpsert(p); return; }
  if (p.n && r.av.tag.firstChild && r.av.tag.firstChild.textContent !== p.n) r.av.tag.firstChild.textContent = String(p.n).slice(0, 16);
  if (Array.isArray(p.fl) && p.fl.join(',') !== r.fl) { r.fl = p.fl.join(','); applyFlair(r.av.obj, p.fl); }
  if (p.em && EMOTES.includes(p.em)) r.av.obj.userData.emote = p.em;
  if (p.vip != null) r.av.tag.classList.toggle('vip', !!p.vip);
  if (p.photo && p.photo !== r.photo && NET.http) { r.photo = p.photo; photoTexFromUrl(p.photo, NET.http + '/api/photo/' + p.photo).then(tx => { if (tx && NET.remote.get(p.id) === r) applyPhotoTex(r.av.obj, tx); }); }
  if (p.x != null) { r.tx = p.x; r.tz = p.z; r.ry = p.ry || 0; r.st = p.st || 'idle'; }
}
function netSeatAgent(ag) {
  if (!ag || !ag.sym || !ag.mint || agents.some(a => a.mint === ag.mint)) return null;   // only coins that really exist on pump.fun
  const b = freeBooth(!!ag.vip); if (!b) return null;
  const a = newAgent(ag.sym, CHAR[ag.body] && !CHAR[ag.body].npc ? ag.body : 'degen', { mint: ag.mint, image: ag.image || null, title: ag.name || ag.sym, desc: ag.desc || '', socials: ag.socials || null, by: ag.by || '', wallet: ag.wallet || '', vip: !!ag.vip, plate: ag.plate || '', at: ag.at || Date.now(), mine: isMyCoin(ag) });
  agents.push(a); seatAgent(a, b); return a;
}
function netTick(dt) {
  /* crowd control, twice a second: only the nearest players are drawn (36 on desktop, 18 on phones), only the close ones cast shadows.
     A full room of 100 stays smooth because the far ones simply wait their turn. */
  const MAXV = TOUCH ? 18 : 36;
  if (NET.remote.size && player && performance.now() - (NET.cullAt || 0) > 500) {
    NET.cullAt = performance.now(); const pp = player.obj.position;
    const arr = [...NET.remote.values()].map(r => ({ r, d: Math.hypot(r.tx - pp.x, r.tz - pp.z) })).sort((a, b) => a.d - b.d);
    arr.forEach((o, i) => { const vis = i < MAXV && o.d < 60, sh = vis && o.d < 16 && i < 12; o.r.av.obj.visible = vis; o.r.av.tag.hidden = !vis; if (o.r.shadow !== sh) { o.r.shadow = sh; o.r.av.obj.traverse(m => { if (!m.isMesh) return; if (m.userData.sh === undefined) m.userData.sh = m.castShadow; m.castShadow = sh && m.userData.sh; }); } });
  }
  for (const r of NET.remote.values()) {
    const o = r.av.obj; const dx = r.tx - o.position.x, dz = r.tz - o.position.z; const d = Math.hypot(dx, dz);
    if (!o.visible) { o.position.set(r.tx, 0, r.tz); o.rotation.y = r.ry; continue; }   // hidden players just teleport along
    if (d > 10) o.position.set(r.tx, 0, r.tz); else { o.position.x += dx * Math.min(1, dt * 10); o.position.z += dz * Math.min(1, dt * 10); }
    o.rotation.y = lerpAngle(o.rotation.y, r.ry, dt * 10); r.av.state = d > 0.08 ? (r.st === 'run' ? 'run' : 'walk') : (r.st === 'jump' ? 'jump' : 'idle');
  }
  if (!NET.ready || !player || !playing) return;
  const now = performance.now(); if (now - NET.lastSend < 200) return; NET.lastSend = now;
  const p = player.obj.position; const sig = p.x.toFixed(1) + '|' + p.z.toFixed(1) + '|' + player.obj.rotation.y.toFixed(1) + '|' + player.state; if (sig === NET.lastSig && now - NET.lastFull < 5000) return; NET.lastSig = sig; if (now - NET.lastFull >= 5000) NET.lastFull = now;
  netSend({ t: 'p', x: +p.x.toFixed(2), z: +p.z.toFixed(2), ry: +player.obj.rotation.y.toFixed(2), st: player.state });
}
/* real launch through the server (pump.fun). Falls back to the local simulation when there is no server. */
async function netLaunch(payload) {
  if (!NET.http) return { sim: true };
  NET.launching = payload.symbol; setTimeout(() => { if (NET.launching === payload.symbol) NET.launching = null; }, 120000);
  try {
    const r = await fetch(NET.http + '/api/launch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error || ('server ' + r.status), code: j.code || (r.status >= 500 ? 'retry' : ''), status: r.status };
    return j;
  } catch (e) { return { error: String(e.message || e), code: 'retry', network: true }; }   // the connection dropped: the server may still be finishing, so the same payment is simply sent again
}
/* pay SOL to the cafe wallet from the player's Phantom; returns the signature.
   Network hiccups after Phantom has sent the payment never abort: the server checks the payment on chain itself. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitConfirmed(W3, signature) {
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    try { const st = (await rpcTry(W3, c => c.getSignatureStatuses([signature]))).value[0]; if (st && st.err) throw new Error('payment failed on chain'); if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return true; }
    catch (e) { if (/failed on chain/.test(e.message)) throw e; }
  }
  return false;
}
/* Phantom's errors in plain words */
function payError(e) {
  const m = String(e && e.message || e || '');
  if (/reject|cancel|denied|declined/i.test(m) || (e && e.code === 4001)) return t('pay_rejected');
  if (/insufficient|not enough|0x1\b|debit an account/i.test(m)) return t('pay_insufficient');
  if (/blockhash|rpc|network|fetch|failed to get/i.test(m)) return t('pay_network');
  return m.slice(0, 140);
}
async function paySol(amount, onSent) {
  if (!amount || !NET.cfg.owner) return null;
  const pv = await ensurePhantom();
  const W3 = await loadWeb3();
  await refreshSol();   // the balance is checked before Phantom opens: a clear message beats a wallet error
  if (NET.solBal !== null && NET.solBal < amount + 0.0015) throw new Error(t('pay_short', { n: (+amount.toFixed(4)).toString(), b: (NET.solBal || 0).toFixed(4) }));
  const from = new W3.PublicKey(NET.wallet);
  const tx = new W3.Transaction().add(W3.SystemProgram.transfer({ fromPubkey: from, toPubkey: new W3.PublicKey(NET.cfg.owner), lamports: Math.round(amount * 1e9) }));
  tx.feePayer = from; tx.recentBlockhash = (await rpcTry(W3, c => c.getLatestBlockhash('confirmed'))).blockhash;
  let signature; try { ({ signature } = await sendViaPhantom(pv, tx)); } catch (e) { throw new Error(payError(e)); }
  if (onSent) onSent(signature);
  await waitConfirmed(W3, signature);
  refreshSol().then(drawWalletChip); return signature;
}
async function payLaunchFee() { return paySol(NET.cfg.launchFee); }
/* VIP: one payment from the player's Phantom to the cafe; the server checks it on chain and remembers the wallet */
async function buyVip() {
  if (!NET.http) throw new Error(t('vip_need'));
  if (!NET.cfg.owner || !NET.cfg.vipFee) throw new Error(t('vip_off'));
  if (!NET.loggedIn) await walletLogin();   // ties the pass to the wallet session so everyone sees the gold tag
  const pending = store.get('cc_vip_sig', '');
  if (pending) { try { await claimVip(pending); return true; } catch (e) { } }
  const sig = await paySol(NET.cfg.vipFee, s => store.set('cc_vip_sig', s));
  await claimVip(sig); return true;
}
async function claimVip(sig) {
  toast(t('vip_checking'), 'cyan', true);
  const r = await fetch(NET.http + '/api/vip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sig, wallet: NET.wallet, token: NET.token || undefined }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status);
  store.set('cc_vip_sig', ''); NET.vip = true; if (player) player.tag.classList.add('vip'); netHello(); drawLoginState(); return true;
}
/* BOOST: a paid promotion. Anyone can put a coin on the big screen and the billboard for an hour; the payment is checked on chain by the server */
async function buyBoost(a) {
  if (!NET.http || !NET.cfg.boostFee) throw new Error(t('boost_off'));
  let pend = store.get('cc_boost_pay', null); if (pend && (pend.mint !== a.mint || Date.now() - pend.at > 864e5)) pend = null;
  const sig = pend ? pend.sig : await paySol(NET.cfg.boostFee, s => store.set('cc_boost_pay', { sig: s, mint: a.mint, at: Date.now() }));
  store.set('cc_boost_pay', { sig, mint: a.mint, at: Date.now() });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(NET.http + '/api/boost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mint: a.mint, sig }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { store.set('cc_boost_pay', null); NET.boosts = NET.boosts || {}; NET.boosts[a.mint] = j.until; applyBoosts(true); return j; }
    if (j.code !== 'wait') { if (j.code === 'used' || j.code === 'bad') store.set('cc_boost_pay', null); throw new Error(j.error || 'boost failed'); }
    await sleep(8000);
  }
  throw new Error(t('boost_pending'));
}
/* NAME PLATE: the coin's owner pays once and a sign with the text hangs over the desk for everyone */
async function buyPlate(a, text) {
  if (!NET.loggedIn || !NET.token) await walletLogin();
  const key = 'cc_plate_' + a.mint; let pend = store.get(key, null); if (pend && Date.now() - pend.at > 864e5) pend = null;
  const sig = pend ? pend.sig : await paySol(NET.cfg.plateFee, s => store.set(key, { sig: s, at: Date.now() }));
  store.set(key, { sig, at: Date.now() });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(NET.http + '/api/plate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: NET.token, mint: a.mint, text, sig }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { store.set(key, null); a.plate = j.text; if (a.booth) { applyBoothStage(a.booth); drawScreen(a.booth); } return j; }
    if (j.code !== 'wait') { if (j.code === 'used' || j.code === 'bad') store.set(key, null); throw new Error(j.error || 'failed'); }
    await sleep(8000);
  }
  throw new Error(t('shop_pending'));
}
const isBoosted = a => !!(a && a.mint && NET.boosts && NET.boosts[a.mint] > Date.now());
/* boosted coins own the big screen: several boosts take turns every 20 seconds */
function applyBoosts(force) {
  const live = agents.filter(isBoosted); if (!live.length) return;
  const a = live[Math.floor(Date.now() / 20000) % live.length];
  if (force || featured !== a) { featured = a; featuredAt = Date.now(); drawWorldScreens(time); }
  for (const x of live) if (x.booth && x.booth.avatar) x.booth.avatar.tag.classList.add('boosted');
}
setInterval(() => { if (NET.boosts) applyBoosts(false); }, 5000);
/* a payment that was sent but not yet credited (closed tab, slow network) is claimed on the next visit */
async function retryPendingVip() { const sig = store.get('cc_vip_sig', ''); if (!sig || NET.vip || !NET.http || !NET.wallet) return; try { await claimVip(sig); toast(t('vip_done'), 'gold', true); renderLand(); } catch (e) { } }

/* ================= Solana: wallet + real trading of launched tokens ================= */
function loadWeb3() { if (window.solanaWeb3) return Promise.resolve(window.solanaWeb3); return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.95.3/lib/index.iife.min.js'; s.onload = () => res(window.solanaWeb3); s.onerror = rej; document.head.appendChild(s); }); }
function phantom() { const p = window.phantom?.solana || window.solana; return p && p.isPhantom ? p : null; }
function rpcConn(W3) { return new W3.Connection(NET.http ? NET.http + '/rpc' : (NET.cfg.rpc || 'https://api.mainnet-beta.solana.com'), 'confirmed'); }
/* the cafe's RPC proxy first, then public endpoints: one slow RPC never blocks a payment or a trade */
async function rpcTry(W3, fn) {
  const urls = [...new Set([NET.http ? NET.http + '/rpc' : null, NET.cfg.rpc || null, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].filter(Boolean))];
  let last = null;
  for (const u of urls) { try { return await fn(new W3.Connection(u, 'confirmed')); } catch (e) { last = e; } }
  throw last || new Error('rpc failed');
}
async function connectWallet(silent) {
  const pv = phantom(); if (!pv) { if (!silent) toast(t('tr_nophantom')); return null; }
  try { const r = await pv.connect(silent ? { onlyIfTrusted: true } : undefined); NET.wallet = (r?.publicKey || pv.publicKey).toBase58(); } catch (e) { return null; }
  if (!pv._ccHooked) { pv._ccHooked = true; pv.on && pv.on('disconnect', () => { NET.wallet = null; NET.solBal = null; drawWalletChip(); }); pv.on && pv.on('accountChanged', pk => { if (pk) { const w = pk.toBase58(); if (NET.wallet && w !== NET.wallet) { NET.token = null; store.set('cc_token', ''); NET.loggedIn = false; NET.chips = 0; drawLoginState(); } NET.wallet = w; drawWalletChip(); } }); }   // another account: the old session must not pay for it
  await refreshSol(); drawWalletChip(); return NET.wallet;
}
/* before anything is signed: Phantom must be connected in THIS page load, even if the sign-in session was restored from a cookie.
   Otherwise Phantom answers "The requested method and/or account has not been authorized by the user". */
async function ensurePhantom() {
  const pv = phantom(); if (!pv) throw new Error(t('tr_nophantom'));
  if (!pv.isConnected || !pv.publicKey) { const w = await connectWallet(); if (!w) throw new Error(t('tr_nophantom')); }
  else NET.wallet = pv.publicKey.toBase58();
  return pv;
}
/* signAndSendTransaction with one retry after a fresh connect (Phantom drops the connection on its own now and then) */
async function sendViaPhantom(pv, tx) {
  try { return await pv.signAndSendTransaction(tx); }
  catch (e) { if (e && (e.code === 4100 || /not been authorized/i.test(e.message || ''))) { await pv.connect(); NET.wallet = pv.publicKey.toBase58(); return await pv.signAndSendTransaction(tx); } throw e; }
}
async function refreshSol() { if (!NET.wallet) return; try { const W3 = await loadWeb3(); NET.solBal = (await rpcTry(W3, c => c.getBalance(new W3.PublicKey(NET.wallet)))) / 1e9; } catch (e) { } }
async function tokenBalance(mint) { if (!NET.wallet) return 0; try { const W3 = await loadWeb3(); const r = await rpcTry(W3, c => c.getParsedTokenAccountsByOwner(new W3.PublicKey(NET.wallet), { mint: new W3.PublicKey(mint) })); return r.value.reduce((s, a) => s + (a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0); } catch (e) { return 0; } }
function drawWalletChip() { const el = $('#walletChip'); if (!el) return; if (NET.wallet) { el.textContent = NET.wallet.slice(0, 4) + '…' + NET.wallet.slice(-4) + (NET.solBal != null ? ' · ' + NET.solBal.toFixed(3) + ' SOL' : ''); el.classList.add('real'); } else { el.textContent = t('w_connect'); el.classList.remove('real'); el.title = t('w_connect'); } }
async function tradeToken(mint, action, amount) {
  if (!NET.http) throw new Error(t('tr_need_server'));
  const pv = await ensurePhantom();
  const W3 = await loadWeb3();
  const r = await fetch(NET.http + '/api/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: NET.wallet, mint, action, amount, slippage: 10 }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
  const tx = W3.VersionedTransaction.deserialize(Uint8Array.from(atob(j.tx), c => c.charCodeAt(0)));
  const { signature } = await sendViaPhantom(pv, tx);
  await waitConfirmed(W3, signature);
  refreshSol().then(drawWalletChip);
  return signature;
}
$('#walletChip').addEventListener('click', () => { if (!NET.loggedIn) walletLogin().then(() => { netHello(); toast(t('land_signed_ok'), 'gold'); }).catch(e => toast(String(e.message || e).slice(0, 90))); else refreshSol().then(drawWalletChip); });
setTimeout(() => { if (phantom()) connectWallet(true); }, 1500);

/* ================= sign-in with the wallet: one signed message, no transaction ================= */
const shortAddr = w => w ? w.slice(0, 4) + '…' + w.slice(-4) : '';
function applyProfile(pr) {
  if (!pr) return; NET.profile = pr;
  if (pr.nick) { myNick = pr.nick; store.set('cc_nick', myNick); const ni = $('#landNick'); if (ni) ni.value = myNick; const n2 = $('#nickIn'); if (n2) n2.value = myNick; }
  if (pr.c && CHAR[pr.c]) { charChoice = pr.c; store.set('cc_char', charChoice); }
  if (pr.look) { myLook = sanitizeLook({ ...myLook, ...pr.look, photo: myLook.photo, say: myLook.say }); store.set('cc_look', myLook); }
  if (pr.photo && !PHOTO_TEX.local && NET.http) { NET.photoId = pr.photo; photoTexFromUrl(pr.photo, NET.http + '/api/photo/' + pr.photo).then(tx => { if (tx) { PHOTO_TEX.local = tx; myLook.photo = 'local'; } }); }
  if (pr.passNo) passNo = pr.passNo; NET.vip = !!pr.vip;
  setTimeout(refreshOwned, 0);   // the shop items this wallet owns
}
async function walletLogin() {
  const w = await connectWallet(); if (!w) throw new Error(t('tr_nophantom'));
  if (!NET.http) { NET.loggedIn = true; passNo = 100000 + (hashStr(w) % 900000); store.set('cc_passno', passNo); drawLoginState(); return w; }
  const { nonce } = await (await fetch(NET.http + '/api/nonce')).json();
  const pv = phantom(); const { signature } = await pv.signMessage(new TextEncoder().encode(`Trench Cafe sign-in\nwallet: ${w}\nnonce: ${nonce}`), 'utf8');
  const sig = btoa(String.fromCharCode(...signature));
  const r = await fetch(NET.http + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: w, nonce, sig }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
  NET.token = j.token; store.set('cc_token', j.token); NET.loggedIn = true; applyProfile(j.profile); drawLoginState(); drawWalletChip(); netHello(); huntSync(); chipsInfo().catch(() => { }); return w;
}
async function restoreSession() {
  if (!NET.token || !NET.http) return;
  try { const r = await fetch(NET.http + '/api/me?token=' + encodeURIComponent(NET.token)); if (!r.ok) { NET.token = null; store.set('cc_token', ''); return; } const j = await r.json(); NET.wallet = j.wallet; NET.loggedIn = true; applyProfile(j.profile); drawLoginState(); drawWalletChip(); refreshSol().then(drawWalletChip); setTimeout(retryPendingVip, 1500); setTimeout(huntSync, 2500); chipsInfo().catch(() => { }); } catch (e) { }
}
function saveProfile() { if (!NET.token || !NET.http) return; fetch(NET.http + '/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: NET.token, nick: myNick, c: charChoice, look: myLook, photo: NET.photoId || '', em: myLook.emote }) }).catch(() => { }); }
function drawLoginState() {
  refreshMine();
  const b = $('#landConnect'); if (!b) return;
  if (NET.loggedIn && NET.wallet) { b.classList.add('on'); b.innerHTML = `<i></i>${shortAddr(NET.wallet)} · ${t('land_signed')}${NET.vip ? ' · VIP' : ''}`; }
  else { b.classList.remove('on'); b.textContent = t('land_connect'); }
}
