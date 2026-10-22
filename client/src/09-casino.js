/* ================= TRENCH CASINO =================
   One play currency: chips. Guests play with local free chips (a refill every day). Signed-in players keep their chips on the
   server, can buy chip packs for SOL and spend chips on ranked runs and cosmetics; every bet is then settled by the server.
   Chips never turn back into SOL or anything else that leaves the game. */
const CHIP_START = 1000, CHIP_DAY = () => new Date().toISOString().slice(0, 10);
function chips() { const c = store.get('cc_chips', null); if (!c) { const n = { n: CHIP_START, day: CHIP_DAY(), best: 0 }; store.set('cc_chips', n); return n; } return c; }
function setChips(n) { const c = chips(); c.n = Math.max(0, Math.round(n)); store.set('cc_chips', c); const b = $('#chipBal'); if (b) b.textContent = fmtChips(c.n); return c.n; }
function noteWin(win) { if (win > 0) { dailyDone('cs'); gainXP(Math.min(30, 3 + win / 200), 'casino'); sfx('win'); } const c = chips(); if (win > (c.best || 0)) { c.best = win; store.set('cc_chips', c); } }
const fmtChips = n => (+n || 0).toLocaleString('en-US');
function canRefill() { const c = chips(); return c.n < CHIP_START && c.day !== CHIP_DAY(); }
function refillChips() { const c = chips(); if (!canRefill()) return false; c.n = CHIP_START; c.day = CHIP_DAY(); store.set('cc_chips', c); return true; }
const BETS = [10, 50, 100, 250, 500, 1000];
const fmtA = n => fmtChips(n);
const csServer = () => !!(NET.http && NET.cfg.casino && NET.loggedIn && NET.token);   // chips live on the server once signed in
const myChips = () => csServer() ? (NET.chips || 0) : chips().n;
function betRow(cur) { return `<div class="bets" id="cBets">${BETS.map(b => `<button type="button" data-bet="${b}" aria-pressed="${b === cur}">${b}</button>`).join('')}</div>`; }
function wireBets(onPick) { const r = $('#cBets'); if (!r) return; r.addEventListener('click', e => { const b = e.target.closest('[data-bet]'); if (!b) return; r.querySelectorAll('[data-bet]').forEach(x => x.setAttribute('aria-pressed', x === b)); onPick(+b.dataset.bet); }); }
function chipHead(title) { return gameHead(title, `<span class="chipbal"><i></i><b id="chipBal">${fmtChips(G && G.srv ? G.srvBal || 0 : chips().n)}</b> ${t('cs_chips')}</span>${G && G.srv && NET.cfg.casino && NET.cfg.casino.buy ? `<button type="button" class="btn small" data-cs-hall>${t('cs_more')}</button>` : ''}`); }
function setSrvBal(n) { NET.chips = n; if (G) G.srvBal = n; const b = $('#chipBal'); if (b) b.textContent = fmtChips(n); }
async function capi(path, body) {
  const get = !body, url = NET.http + '/api/casino/' + path + (get ? (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(NET.token || '') : '');
  const r = await fetch(url, get ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, token: NET.token }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'casino error ' + r.status); e.code = j.code; e.price = j.price; throw e; } return j;
}
async function chipsInfo() { const j = await capi('info'); NET.chips = j.balance; NET.chipsClaim = !!j.claim; return j; }
/* a chip pack: one Phantom payment to the cafe wallet, the server credits the chips. A payment that is still landing is kept and claimed later. */
async function buyChips(idx) {
  const packs = (NET.cfg.casino && NET.cfg.casino.packs) || []; if (!NET.cfg.casino || !NET.cfg.casino.buy) throw new Error(t('cs_packs_off'));
  if (!NET.loggedIn || !NET.token) await walletLogin();
  let pend = store.get('cc_chip_pend', null); if (pend && pend.wallet !== NET.wallet) pend = null;
  if (!pend) {   // the pack is priced in USD: the server quotes the SOL amount at the live price, then Phantom pays exactly that
    const pack = packs[idx]; if (!pack) return null;
    const q = await capi('quote', { pack: idx }); toast(t('cs_paying'), 'cyan', true);
    const sig = await paySol(q.sol, s => store.set('cc_chip_pend', { sig: s, pack: idx, quote: q.id, wallet: NET.wallet })); pend = { sig, pack: idx, quote: q.id, wallet: NET.wallet };
  }
  for (let i = 0; i < 20; i++) {
    try { const j = await capi('buy', { sig: pend.sig, quote: pend.quote }); store.set('cc_chip_pend', null); setSrvBal(j.balance); return j; }
    catch (e) { if (e.code === 'wait') { toast(t('cs_buy_wait'), 'cyan', true); await sleep(4000); continue; } if (e.code === 'used' || e.code === 'bad') store.set('cc_chip_pend', null); throw e; }   // a network hiccup keeps the pending payment for the resume button
  }
  throw new Error(t('cs_buy_wait'));
}
const packSol = usd => SOL_PX.usd > 0 ? (Math.ceil(usd / SOL_PX.usd * 1e4) / 1e4).toFixed(SOL_PX.usd > 500 ? 4 : 3) : null;
function bigWin(amount, x) {
  toast(t('cs_bigwin', { n: fmtChips(amount), x }), 'gold', true);
  if (player) { player.emote(); if (player.obj) confetti(_w.copy(player.obj.position).setY(1.6), 50); }
  if (player && amount >= 2000) { const msg = t('cs_brag', { n: fmtChips(amount), x }); player.say(msg); netSend({ t: 'say', text: msg }); }   // big wins are shouted to the room
}

/* ---- the hall (place panel) ---- */
const CS_ART = {
  crash: `<svg viewBox="0 0 160 90" aria-hidden="true"><g fill="#8fd3a6">${[[10, 70, 8], [24, 64, 10], [38, 56, 12], [52, 50, 10], [66, 40, 14], [80, 34, 10], [94, 24, 14], [108, 14, 12]].map(([x, y, h]) => `<rect x="${x}" y="${y}" width="9" height="${h}"/><rect x="${x + 4}" y="${y - 4}" width="1.5" height="${h + 8}"/>`).join('')}</g><rect x="122" y="10" width="9" height="74" fill="#d9707a"/><path d="M8 80h146" stroke="rgba(236,233,226,.2)"/></svg>`,
  slots: `<svg viewBox="0 0 160 90" aria-hidden="true"><rect x="8" y="10" width="144" height="70" rx="4" fill="#141312" stroke="#c8a96a" stroke-width="2"/>${[0, 1, 2].map(i => `<rect x="${18 + i * 44}" y="20" width="36" height="50" fill="#0a0a0b"/><g transform="translate(${20 + i * 44} 27) scale(.5)">${symSVG('mug').replace(/<\/?svg[^>]*>/g, '')}</g>`).join('')}<path d="M10 45h140" stroke="#d9707a" stroke-width="1.5" stroke-dasharray="4 4"/></svg>`,
  flip: `<svg viewBox="0 0 160 90" aria-hidden="true"><circle cx="58" cy="45" r="30" fill="#8fd3a6" stroke="#0a0a0b" stroke-width="4"/><text x="58" y="50" text-anchor="middle" font-family="monospace" font-weight="700" font-size="13" fill="#0a0a0b">PUMP</text><ellipse cx="108" cy="45" rx="10" ry="30" fill="#d9707a" stroke="#0a0a0b" stroke-width="3"/></svg>`
};
const csGames = () => `<div class="cs-games">${[['crash', 'cs_crash'], ['slots', 'cs_slots'], ['flip', 'cs_flip']].map(([g, k]) => `<button type="button" class="cs-card cs-${g}" data-casino="${g}"><span class="art">${CS_ART[g]}</span><b>${t(k)}</b><small>${t(k + '_d')}</small><i>${t('cs_play')} →</i></button>`).join('')}</div>`;
function packsHTML() {
  const cs = NET.cfg.casino; if (!cs || !cs.buy || !cs.packs || !cs.packs.length) return '';
  const pend = store.get('cc_chip_pend', null);
  return `<div class="cs-packs"><h4 class="h4">${t('cs_packs_t')}</h4><div class="cs-pack-row">${cs.packs.map((p, i) => `<button type="button" class="cs-pack" data-pack="${i}"><b>${fmtChips(p.chips)}</b><small>${t('cs_chips')}</small><span>$${p.usd}${packSol(p.usd) ? ` · ≈${packSol(p.usd)} SOL` : ''}</span></button>`).join('')}</div>
    <p class="muted">${t('cs_packs_d', { n: fmtChips(cs.runChips || 0) })}</p>${pend && pend.wallet === NET.wallet ? `<button type="button" class="btn small hot" data-pack-resume>${t('cs_buy_resume')}</button>` : ''}</div>`;
}
function casinoHTML() {
  const c = chips(), srv = csServer();
  if (srv) setTimeout(casinoWalletPanel, 0);
  const wallet = srv ? `<div class="chip-wallet" id="csWallet"><div><small>${t('cs_balance')}</small><b>${fmtChips(NET.chips || 0)}</b><span>${t('cs_chips')}</span></div></div>`
    : `<div class="chip-wallet"><div><small>${t('cs_balance')}</small><b>${fmtChips(c.n)}</b><span>${t('cs_chips')}</span></div><div><small>${t('cs_best')}</small><b>${fmtChips(c.best || 0)}</b></div>
      ${canRefill() ? `<button type="button" class="btn hot small" data-refill>${t('cs_refill')}</button>` : `<p class="muted">${c.n < CHIP_START ? t('cs_refill_tmr') : t('cs_refill_info')}</p>`}
      ${NET.http ? `<p class="muted">${t('cs_guest')}</p><button type="button" class="btn small" data-cs-login>${t('cs_login')}</button>` : ''}</div>`;
  return `<div class="casino">${wallet}${csGames()}${srv ? packsHTML() : ''}<p class="note-box">${t('cs_note2')}</p></div>`;
}
async function casinoWalletPanel() {
  const box = $('#csWallet'); if (!box) return;
  try { const j = await chipsInfo(); if (!$('#csWallet')) return;
    box.innerHTML = `<div><small>${t('cs_balance')}</small><b>${fmtChips(j.balance)}</b><span>${t('cs_chips')}</span></div><div><small>${t('cs_best')}</small><b>${fmtChips(chips().best || 0)}</b></div>
      <p class="muted">${t('cs_trial', { n: fmtChips(NET.cfg.casino.start || CHIP_START) })}</p>`; }
  catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}
document.addEventListener('click', async e => {
  const lg = e.target.closest('[data-cs-login]'); if (lg) { try { await walletLogin(); } catch (err) { toast(String(err.message || err).slice(0, 120)); } openPlace('casino'); return; }
  const pk = e.target.closest('[data-pack],[data-pack-resume]'); if (pk) { pk.disabled = true; try { const j = await buyChips(pk.dataset.pack === undefined ? (store.get('cc_chip_pend', {}) || {}).pack : +pk.dataset.pack); if (j) toast(t('cs_bought', { n: fmtChips(j.credited) }), 'gold', true); } catch (err) { toast(String(err.message || err).slice(0, 160), 'bad', true); } if (!$('#mPlace').hidden) openPlace('casino'); return; }
  const g = e.target.closest('[data-casino]'); if (g) { closeModals(); startCasino(g.dataset.casino); return; }
  const hall = e.target.closest('[data-cs-hall]'); if (hall) { if (gameActive) closeGame(); openPlace('casino'); return; }
  const r = e.target.closest('[data-refill]'); if (r) { if (refillChips()) { toast(t('cs_refilled', { n: fmtChips(CHIP_START) }), 'gold'); openPlace('casino'); } }
});
function startCasino(id) {
  const srv = csServer();
  gameActive = id; showModal('mGame'); G = { id, casino: true, bet: 50, busy: false, srv, srvBal: NET.chips || 0 };
  { const sh = $('#mGame .sheet'); sh.classList.add('cab'); sh.style.setProperty('--gc', { slots: '#ffcf5a', crash: '#6ff0b0', flip: '#b98cff' }[id] || '#ffcf5a'); }
  if (srv) chipsInfo().then(j => setSrvBal(j.balance)).catch(err => toast(err.message));
  const body = $('#gameBody');
  if (id === 'slots') {
    body.innerHTML = chipHead(t('cs_slots')) + `<div class="slots"><div class="reels">${[0, 1, 2].map(i => `<div class="reel" id="reel${i}">${symSVG('mug')}</div>`).join('')}</div>
      <div class="paytable">${SLOT_SYMS.filter(s => s.k !== 'rug').map(s => `<span>${symSVG(s.k)}×3 <b>${s.p3}x</b></span>`).join('')}<span class="muted">${t('cs_two')}</span></div>
      ${betRow(G.bet)}<div class="row" style="justify-content:center"><button type="button" class="btn hot" id="cSpin">${t('cs_spin')}</button></div><div id="gResult" class="cres"></div></div>`;
    wireBets(b => { G.bet = b; }); $('#cSpin').addEventListener('click', slotSpin);
  } else if (id === 'crash') {
    G.auto = +store.get('cc_crash_auto', 0) || 0;
    body.innerHTML = chipHead(t('cs_crash')) + `<div class="crash">
      <div class="crash-stage"><canvas id="crashC" width="720" height="380"></canvas></div>
      <div class="crash-live" id="crashLive">
        <div><small>${t('cs_bet')}</small><b id="clBet">${fmtA(G.bet)}</b></div>
        <div class="mult"><small>${t('cs_mult')}</small><b id="clMult">1.00x</b></div>
        <div class="win"><small>${t('cs_canwin')}</small><b id="clWin">${fmtA(G.bet)}</b><i id="clProfit">+0</i></div>
      </div>
      <div class="crash-hist" id="crashHist">${(store.get('cc_crash_hist', []) || []).map(crashPill).join('')}</div>
      <div class="crash-ctl">${betRow(G.bet)}
        <div class="auto" id="cAuto"><span>${t('cs_auto')}</span>${[0, 1.5, 2, 3, 5, 10].map(x => `<button type="button" data-auto="${x}" aria-pressed="${x === G.auto}">${x ? x + 'x' : t('cs_off')}</button>`).join('')}</div></div>
      <button type="button" class="btn hot crash-go" id="cGo">${t('cs_ape')}</button>
      <div id="gResult" class="cres"></div></div>`;
    wireBets(b => { if (!G.run && !G.count) { G.bet = b; crashLive(); } });
    $('#cAuto').addEventListener('click', e => { const b = e.target.closest('[data-auto]'); if (!b) return; G.auto = +b.dataset.auto; store.set('cc_crash_auto', G.auto); $('#cAuto').querySelectorAll('[data-auto]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#cGo').addEventListener('click', crashButton); crashDraw(); crashLoopIdle();
  } else if (id === 'flip') {
    body.innerHTML = chipHead(t('cs_flip')) + `<div class="flip"><div class="coin3d" id="coin"><div class="f up">PUMP</div><div class="f down">DUMP</div></div>
      ${betRow(G.bet)}<div class="row" style="justify-content:center"><button type="button" class="btn hot" data-side="up">${t('cs_pump')}</button><button type="button" class="btn" data-side="down">${t('cs_dump')}</button></div><div id="gResult" class="cres"></div><p class="muted" style="text-align:center;font-size:12px">${t('cs_flip_rule')}</p></div>`;
    wireBets(b => { G.bet = b; }); body.querySelectorAll('[data-side]').forEach(b => b.addEventListener('click', () => flipGo(b.dataset.side)));
  }
}
const brokeHTML = () => `<div class="gres">${t(G.srv ? 'cs_broke_srv' : 'cs_broke')}</div>${G.srv ? `<div class="row" style="justify-content:center"><button type="button" class="btn small hot" data-cs-hall>${t('cs_hall')}</button></div>` : ''}`;
function takeBet() { if (G.srv) { if (G.bet > (G.srvBal || 0)) { $('#gResult').innerHTML = brokeHTML(); return false; } return true; } const c = chips(); if (G.bet > c.n) { $('#gResult').innerHTML = brokeHTML(); return false; } setChips(c.n - G.bet); return true; }

/* ---- slots ---- */
const SLOT_SYMS = [{ k: 'mug', w: 1, p3: 100, p2: 4 }, { k: 'dia', w: 2, p3: 30, p2: 2.5 }, { k: 'cnd', w: 3, p3: 12, p2: 1.5 }, { k: 'ban', w: 4, p3: 6, p2: 1 }, { k: 'rug', w: 4, p3: 0, p2: 0 }];
function slotRoll() { const T = SLOT_SYMS.reduce((s, x) => s + x.w, 0); let r = Math.random() * T; for (const s of SLOT_SYMS) { if ((r -= s.w) < 0) return s; } return SLOT_SYMS[0]; }
function symSVG(k) {
  const g = { mug: `<rect x="14" y="24" width="26" height="26" fill="#ece9e2"/><rect x="17" y="24" width="20" height="4" fill="#0a0a0b"/><path d="M40 29h6v14h-6v-4h3v-6h-3z" fill="#ece9e2"/><rect x="21" y="12" width="4" height="8" fill="#8fd3a6"/><rect x="29" y="6" width="4" height="12" fill="#8fd3a6"/>`,
    dia: `<path d="M32 8 52 26 32 56 12 26z" fill="#c8a96a"/><path d="M32 8 40 26 32 56 24 26z" fill="#e9d29a"/><path d="M12 26h40" stroke="#0a0a0b" stroke-width="2"/>`,
    cnd: `<rect x="30" y="6" width="4" height="52" fill="#8fd3a6"/><rect x="22" y="16" width="20" height="32" fill="#8fd3a6"/>`,
    ban: `<path d="M14 20c4 22 24 34 40 28-14-2-28-14-32-30z" fill="#e5bf72"/><path d="M14 20l-2-6 6 3z" fill="#5a3a22"/>`,
    rug: `<rect x="12" y="16" width="40" height="32" fill="#d9707a"/><path d="M12 22h40M12 42h40" stroke="#0a0a0b" stroke-width="2"/><path d="M14 48v6M22 48v6M30 48v6M38 48v6M46 48v6" stroke="#d9707a" stroke-width="2"/><text x="32" y="36" font-size="10" text-anchor="middle" fill="#0a0a0b" font-family="monospace" font-weight="700">RUG</text>` }[k] || '';
  return `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${g}</svg>`;
}
async function slotSpin() {
  if (G.busy || !takeBet()) return; G.busy = true; $('#gResult').innerHTML = '';
  const reels = [0, 1, 2].map(i => $('#reel' + i));
  reels.forEach(r => r.classList.add('spin'));
  let tk = 0; const timers = reels.map((r, i) => setInterval(() => { r.innerHTML = symSVG(pick(SLOT_SYMS).k); if (i === 0 && tk++ % 2 === 0) sfx('spin'); }, 70));
  let res, srv = null;
  if (G.srv) { try { srv = await capi('slots', { bet: G.bet }); res = srv.reels.map(k => SLOT_SYMS.find(s => s.k === k)); } catch (err) { timers.forEach(clearInterval); reels.forEach(r => r.classList.remove('spin')); G.busy = false; $('#gResult').innerHTML = err.code === 'broke' ? brokeHTML() : `<div class="gres">${esc(err.message)}</div>`; return; } }
  else res = [slotRoll(), slotRoll(), slotRoll()];
  reels.forEach((r, i) => setTimeout(() => { clearInterval(timers[i]); r.classList.remove('spin'); r.innerHTML = symSVG(res[i].k); r.classList.add('land'); sfx('tick'); setTimeout(() => r.classList.remove('land'), 300);
    if (i === 2) slotPay(res, srv); }, 700 + i * 420));
}
function slotPay(res, srv) {
  if (!G || G.id !== 'slots') return; G.busy = false;
  { const won = srv ? srv.win > 0 : (res[0].k === res[1].k || res[0].k === res[2].k || res[1].k === res[2].k) && res.some(s => s.p2 > 0); const rr = $('.slots .reels'); if (rr) { rr.classList.remove('won'); void rr.offsetWidth; if (won) rr.classList.add('won'); } if (!won) sfx('bad'); }
  const [a, b, c] = res.map(s => s.k); let mult = 0;
  if (a === b && b === c) mult = res[0].p3;
  else { const pair = a === b || a === c ? res[0] : b === c ? res[1] : null; if (pair) mult = pair.p2; }
  if (srv) { setSrvBal(srv.balance); const win = srv.win; if (win > 0) { noteWin(win); $('#gResult').innerHTML = `<div class="gres win">+${fmtChips(win)} · ${srv.mult}x</div>`; if (srv.mult >= 12) bigWin(win, srv.mult); } else $('#gResult').innerHTML = `<div class="gres">${a === 'rug' && b === 'rug' && c === 'rug' ? t('cs_rugged') : t('cs_nothing')}</div>`; return; }
  const win = Math.floor(G.bet * mult);
  if (win > 0) { setChips(chips().n + win); noteWin(win); $('#gResult').innerHTML = `<div class="gres win">+${fmtChips(win)} · ${mult}x</div>`; if (mult >= 12) bigWin(win, mult); }
  else $('#gResult').innerHTML = `<div class="gres">${a === 'rug' && b === 'rug' && c === 'rug' ? t('cs_rugged') : t('cs_nothing')}</div>`;
}

/* ---- rug crash: a live chart of green candles that climbs until it gets rugged. The panel shows, every frame, what the player can take right now ---- */
function crashPoint() { const u = Math.random(); if (u < 0.03) return 1; return Math.max(1, Math.floor(97 / (1 - u)) / 100); }   // 3% instant rug, otherwise P(x or more) = 0.97 / x
const crashPill = x => `<span class="${x >= 10 ? 'moon' : x >= 2 ? 'hi' : ''}">${x.toFixed(2)}x</span>`;
const CR_SPEED = 0.12, CR_BUCKET = 0.45;   // the multiplier is e^(0.12 s); one candle per 0.45 s
async function crashButton() {
  if (!G || G.id !== 'crash' || G.count) return;
  if (G.run && !G.out) { crashCashOut(false); return; }
  if (G.run || G.starting || !takeBet()) return;
  // a short countdown builds the moment, then the candle starts
  G.out = 0; G.pts = []; G.candles = []; G.m = 1; G.rugAt = 0; G.parts = []; G.burst = 0; G.vT = 0; G.vM = 0; G.flash = 0; G.cashFx = 0; G.cp = Infinity; G.rid = null; G.win = 0;
  $('#gResult').innerHTML = ''; const btn = $('#cGo'); btn.disabled = true; btn.classList.remove('cash');
  let startAt;
  if (G.srv) {   // the server keeps the crash point secret and settles the bet
    G.starting = true;
    try { const sent = performance.now(); const j = await capi('crash/start', { bet: G.bet, auto: G.auto || 0 }); G.rid = j.id; setSrvBal(j.balance); startAt = performance.now() + j.startIn - (performance.now() - sent) / 2; G.hash = j.hash; }   // half the round trip: the server clock started before the answer arrived
    catch (err) { G.starting = false; btn.disabled = false; $('#gResult').innerHTML = err.code === 'broke' ? brokeHTML() : `<div class="gres">${esc(err.message)}</div>`; return; }
    G.starting = false;
  } else { startAt = performance.now() + 1950; G.cp = crashPoint(); }
  G.startAt = startAt;
  const tick = () => {
    if (!G || G.id !== 'crash') return; const left = startAt - performance.now();
    if (left > 0) { G.count = Math.max(1, Math.ceil(left / 650)); btn.textContent = t('cs_starting', { n: G.count }); crashDraw(); setTimeout(tick, Math.min(650, left)); return; }
    G.count = 0; Object.assign(G, { run: true, t0: startAt }); btn.disabled = false; btn.classList.add('cash'); requestAnimationFrame(crashStep);
    if (G.srv) crashPoll();
  };
  tick();
}
function crashPoll() {   // server mode: ask the server whether the round has been rugged (and whether an auto cash out paid)
  const rid = G.rid; const poll = async () => {
    if (!G || G.id !== 'crash' || G.rid !== rid || !G.run) return;
    try { const j = await capi('crash/state?id=' + encodeURIComponent(rid)); if (!G || G.rid !== rid) return;
      if (j.out && !G.out) srvCashed(j);
      if (j.state === 'ended') { G.cp = j.cp; setSrvBal(j.balance); return; } } catch (e) { }
    setTimeout(poll, 350);
  }; setTimeout(poll, 350);
}
function srvCashed(j) {
  G.out = j.out; G.win = j.win; G.cashFx = 1; setSrvBal(j.balance); noteWin(j.win);
  $('#gResult').innerHTML = `<div class="gres win">${t('cs_cashed', { x: j.out.toFixed(2) })} · +${fmtChips(G.win)}</div>`;
  if (j.out >= 5) bigWin(j.win, j.out.toFixed(2));
  const btn = $('#cGo'); btn.textContent = t('cs_wait'); btn.classList.remove('cash'); btn.disabled = true;
}
function crashStep() {
  if (!G || G.id !== 'crash' || !G.run) return;
  const s = (performance.now() - G.t0) / 1000; let m = Math.exp(CR_SPEED * s);
  if (m >= G.cp) m = G.cp;
  G.m = m; G.pts.push([s, m]);
  const bi = Math.floor(s / CR_BUCKET), cs = G.candles;
  for (let k = cs.length; k <= bi; k++) { const prev = cs[k - 1], o = prev ? prev.c : 1, c = k < bi ? Math.min(m, Math.exp(CR_SPEED * (k + 1) * CR_BUCKET)) : m; cs[k] = { o, c, h: c, l: o, n: Math.random() }; }   // a long frame fills the missed candles one by one
  const cur = cs[bi]; cur.c = m; cur.h = Math.max(cur.h, m * (1 + 0.012 * cur.n)); cur.l = Math.min(cur.l, cur.o * (1 - 0.01 * cur.n));
  if (!G.out && !G.srv && G.auto > 1 && m >= G.auto) crashCashOut(true);   // server mode: the server pays auto cash outs itself
  if (m >= G.cp) { crashEnd(); return; }
  crashLive(); crashDraw(); requestAnimationFrame(crashStep);
}
async function crashCashOut(auto) {
  if (!G.run || G.out || G.cashing) return;
  if (G.srv) {
    G.cashing = true; const btn = $('#cGo'); btn.disabled = true;
    try { const j = await capi('crash/cashout', { id: G.rid, m: G.m }); if (j.out) srvCashed(j); else btn.disabled = false; if (j.state === 'ended') G.cp = j.cp; }
    catch (err) { btn.disabled = false; toast(err.message); }
    G.cashing = false; return;
  }
  G.out = G.m; G.cashFx = 1; const win = Math.floor(G.bet * G.m); setChips(chips().n + win); noteWin(win);
  $('#gResult').innerHTML = `<div class="gres win">${t(auto ? 'cs_auto_out' : 'cs_cashed', { x: G.m.toFixed(2) })} · +${fmtChips(win)}</div>`;
  const btn = $('#cGo'); btn.textContent = t('cs_wait'); btn.classList.remove('cash'); btn.disabled = true;
  if (G.m >= 5) bigWin(win, G.m.toFixed(2));
}
function crashEnd() {
  G.run = false; G.rugAt = performance.now(); G.flash = 1; G.m = G.cp;
  if (G.candles) { const last = Math.floor(Math.log(Math.max(1, G.cp)) / CR_SPEED / CR_BUCKET); G.candles.length = Math.min(G.candles.length, last + 1); for (const k of G.candles) { k.c = Math.min(k.c, G.cp); k.h = Math.min(k.h, G.cp); k.o = Math.min(k.o, G.cp); k.l = Math.min(k.l, G.cp); } if (G.candles.length) G.candles[G.candles.length - 1].c = G.cp; }   // the chart never shows candles above the rug
  const h = [G.cp, ...(store.get('cc_crash_hist', []) || [])].slice(0, 12); store.set('cc_crash_hist', h); const hh = $('#crashHist'); if (hh) hh.innerHTML = h.map(crashPill).join('');
  if (!G.out) sfx('bad');
  if (!G.out) $('#gResult').innerHTML = `<div class="gres">${t('cs_rug_at', { x: G.cp.toFixed(2) })} · -${fmtA(G.bet)}</div>`;
  const btn = $('#cGo'); btn.disabled = false; btn.classList.remove('cash'); btn.textContent = t('cs_ape');
  crashLive();   // the idle loop keeps drawing the fall
}
function crashLive() {
  if (!G || G.id !== 'crash') return;
  const m = G.out || G.m || 1, win = Math.floor(G.bet * m), live = G.run && !G.out;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('clBet', fmtA(G.bet)); set('clMult', (G.m || 1).toFixed(2) + 'x'); set('clWin', fmtA(G.rugAt && !G.out ? 0 : win)); set('clProfit', G.rugAt && !G.out ? '-' + fmtA(G.bet) : (win - G.bet >= 0 ? '+' : '-') + fmtA(Math.abs(win - G.bet)));
  const box = $('#crashLive'); if (box) { box.classList.toggle('live', live); box.classList.toggle('out', !!G.out); box.classList.toggle('rug', !!G.rugAt && !G.out); }
  const btn = $('#cGo'); if (btn && live) btn.textContent = t('cs_cashout_n', { n: fmtA(win) });
}
function crashLoopIdle() { const step = () => { if (!G || G.id !== 'crash') return; if (!G.run) crashDraw(); requestAnimationFrame(step); }; requestAnimationFrame(step); }
function mugIcon(x, cx, cy, k, col) {   // the logo mug riding the chart
  const p = (c, r, w = 1, h = 1) => x.fillRect(cx + (c - 9) * k, cy + (r - 13) * k, w * k, h * k);
  x.fillStyle = col; p(4, 9, 9, 8); p(5, 17, 7, 1); p(13, 11, 2, 1); p(14, 12, 1, 3); p(13, 15, 2, 1);
  x.fillStyle = '#0a0a0b'; p(5, 9, 7, 1);
}
/* Rug Crash, drawn as one smooth curve: m(t) = e^(0.12 t) is sampled every frame, the view zooms out smoothly as it climbs,
   the colour warms up with the multiplier, a comet trail follows the tip, and the rug drops the line off the screen. */
const f60Prev = d => d * 54;   // about one trail particle per frame at 60 fps
const CR_TIER = m => m >= 10 ? ['#c79bff', '#7c4dff'] : m >= 3 ? ['#ffd36b', '#ff9b3d'] : m >= 1.6 ? ['#8ff5c4', '#38d39f'] : ['#bff7e0', '#5ee7b4'];
function crashCanvas() {
  const c = $('#crashC'); if (!c) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = c.clientWidth || 720, ch = Math.round(cw * 380 / 720);
  if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
  return { c, x: c.getContext('2d'), W: cw, H: ch, dpr };
}
function crashDraw() {
  const cv = crashCanvas(); if (!cv || !G) return; const { x, W, H, dpr } = cv, now = performance.now();
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const live = G.run, rugged = !!G.rugAt && !G.run, rugK = rugged ? Math.min(1, (now - G.rugAt) / 700) : 0;
  const s = live ? (now - G.t0) / 1000 : rugged ? Math.log(Math.max(1, G.cp)) / CR_SPEED : 0, m = live ? (G.m || 1) : rugged ? G.cp : 1;
  // smooth camera: the view eases toward the size the curve needs
  const tT = Math.max(8, s * 1.18), mT = Math.max(1.9, 1 + (m - 1) * 1.28);
  const dtv = Math.min(0.1, (now - (G.drawAt || now)) / 1000); G.drawAt = now; const ek = 1 - Math.exp(-dtv * 7);   // frame-rate independent easing
  G.vT = G.vT ? G.vT + (tT - G.vT) * ek : tT; G.vM = G.vM ? G.vM + (mT - G.vM) * ek : mT; if (!live && !rugged) { G.vT = 8; G.vM = 1.9; }
  G.vT = Math.max(G.vT, s * 1.04); G.vM = Math.max(G.vM, 1 + (m - 1) * 1.06);   // the tip never leaves the screen
  const padL = 16, padR = 64, padT = 22, padB = 34, PW = W - padL - padR, PH = H - padT - padB;
  const X = tt => padL + tt / G.vT * PW, Y = v => padT + PH - (v - 1) / (G.vM - 1) * PH;
  x.save();
  if (rugged && now - G.rugAt < 450) x.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8);
  // background: deep gradient, a drifting dot grid and a soft spotlight
  let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0f14'); g.addColorStop(1, '#050507'); x.fillStyle = g; x.fillRect(-20, -20, W + 40, H + 40);
  const drift = (now / 60) % 24; x.fillStyle = 'rgba(255,255,255,.05)';
  for (let yy = padT; yy < H - padB; yy += 24) for (let xx = padL - drift; xx < W - padR; xx += 24) if (xx > padL) { x.beginPath(); x.arc(xx, yy, 1, 0, 7); x.fill(); }
  const [c1, c2] = rugged ? ['#ff6b7a', '#c2334a'] : CR_TIER(m);
  // horizontal multiplier lines
  const raw = (G.vM - 1) / 4, mag = Math.pow(10, Math.floor(Math.log10(Math.max(0.01, raw)))), nr = raw / mag, step = Math.max(0.2, (nr < 1.5 ? 1 : nr < 3.5 ? 2 : nr < 7.5 ? 5 : 10) * mag);
  x.font = "600 11px 'JetBrains Mono', monospace"; x.textBaseline = 'middle'; x.textAlign = 'left';
  for (let v = 1; v <= G.vM + 0.001; v += step) { const y = Y(v); x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1; x.beginPath(); x.moveTo(padL, y); x.lineTo(W - padR + 6, y); x.stroke(); x.fillStyle = 'rgba(255,255,255,.34)'; x.fillText((v >= 100 ? Math.round(v) : +v.toFixed(2)) + 'x', W - padR + 12, y); }
  // time ticks along the bottom
  const ts = G.vT > 40 ? 10 : G.vT > 18 ? 5 : 2; x.textAlign = 'center'; x.textBaseline = 'top';
  for (let tt = 0; tt <= G.vT; tt += ts) { const xx = X(tt); x.fillStyle = 'rgba(255,255,255,.28)'; x.fillText(tt + 's', xx, H - padB + 10); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(xx, H - padB, 1, 5); }
  // the big multiplier behind the curve
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (G.count) {
    const k = ((G.startAt || now) - now) / 650 % 1;
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 6; x.beginPath(); x.arc(W / 2, H / 2 - 6, 58, 0, 7); x.stroke();
    x.strokeStyle = c1; x.shadowColor = c1; x.shadowBlur = 18; x.beginPath(); x.arc(W / 2, H / 2 - 6, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, k)); x.stroke(); x.shadowBlur = 0;
    x.fillStyle = '#fff'; x.font = "900 64px Unbounded, sans-serif"; x.fillText(String(G.count), W / 2, H / 2 - 2);
    x.font = "700 12px 'JetBrains Mono', monospace"; x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText(t('cs_get_ready').toUpperCase(), W / 2, H / 2 + 84);
  } else if (live || rugged) {
    const pulse = live && !G.out ? 1 + Math.sin(now / 160) * 0.015 : 1;
    x.save(); x.translate((W - padR) / 2 + padL / 2, padT + PH * 0.32); x.scale(pulse, pulse);
    x.font = "900 76px Unbounded, sans-serif"; x.fillStyle = rugged ? 'rgba(255,107,122,.92)' : G.out ? 'rgba(255,255,255,.28)' : '#ffffff';
    x.shadowColor = rugged ? '#ff6b7a' : c1; x.shadowBlur = G.out ? 0 : 30; x.fillText(m.toFixed(2) + 'x', 0, 0); x.shadowBlur = 0;
    if (G.out && !rugged) { x.font = "700 13px 'JetBrains Mono', monospace"; x.fillStyle = '#ffd36b'; x.fillText(t('cs_out_at', { x: G.out.toFixed(2) }), 0, 50); }
    x.restore();
  }
  // the curve
  if (live || rugged) {
    const n = 140, pts = []; for (let i = 0; i <= n; i++) { const tt = s * i / n; pts.push([X(tt), Y(Math.min(m, Math.exp(CR_SPEED * tt)))]); }
    const [tx, ty0] = pts[pts.length - 1], ty = rugged ? ty0 + (H - padB - ty0 + 30) * rugK * rugK : ty0;
    if (rugged) pts.push([tx + 6 * rugK, ty]);
    // area under the curve
    x.beginPath(); x.moveTo(pts[0][0], H - padB); for (const [a, b] of pts) x.lineTo(a, b); x.lineTo(pts[pts.length - 1][0], H - padB); x.closePath();
    g = x.createLinearGradient(0, ty0, 0, H - padB); g.addColorStop(0, rugged ? 'rgba(255,107,122,.28)' : c2 + '55'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fill();
    // the line, with glow
    x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b));
    g = x.createLinearGradient(padL, 0, tx, 0); g.addColorStop(0, c2); g.addColorStop(1, c1);
    x.strokeStyle = g; x.lineWidth = 4; x.lineJoin = 'round'; x.lineCap = 'round'; x.shadowColor = c1; x.shadowBlur = 18; x.stroke(); x.shadowBlur = 0;
    // comet trail particles from the tip
    G.parts = G.parts || [];
    if (live && !G.out && Math.random() < Math.min(1, f60Prev(dtv))) G.parts.push({ x: tx, y: ty, vx: -0.6 - Math.random() * 1.2, vy: 0.4 + Math.random() * 0.9, life: 1, r: 1.5 + Math.random() * 2.5, c: c1 });
    if (rugged && !G.burst) { G.burst = 1; for (let i = 0; i < 46; i++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4; G.parts.push({ x: tx, y: ty0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, r: 2 + Math.random() * 3, c: Math.random() < 0.5 ? '#ff6b7a' : '#ffb3bb' }); } }
    const f60 = dtv * 60; for (const q of G.parts) { q.x += q.vx * f60; q.y += q.vy * f60; q.vy += 0.03 * f60; q.life -= 0.022 * f60; }
    G.parts = G.parts.filter(q => q.life > 0).slice(-160);
    for (const q of G.parts) { x.globalAlpha = Math.max(0, q.life); x.fillStyle = q.c; x.beginPath(); x.arc(q.x, q.y, q.r * q.life + 0.5, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    // tip: glowing orb and the mug riding it
    if (!rugged) {
      g = x.createRadialGradient(tx, ty, 0, tx, ty, 34); g.addColorStop(0, c1 + 'cc'); g.addColorStop(1, c1 + '00'); x.fillStyle = g; x.beginPath(); x.arc(tx, ty, 34, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(tx, ty, 5, 0, 7); x.fill();
      mugIcon(x, tx, ty - 20, 1.8, '#ffffff');
      // live price tag on the right axis
      x.fillStyle = c1; x.beginPath(); x.roundRect(W - padR + 6, ty - 11, padR - 8, 22, 6); x.fill(); x.fillStyle = '#07080a'; x.font = "800 11px 'JetBrains Mono', monospace"; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(m.toFixed(2) + 'x', W - padR + 11, ty);
      x.setLineDash([3, 6]); x.strokeStyle = c1 + '66'; x.lineWidth = 1; x.beginPath(); x.moveTo(tx + 10, ty); x.lineTo(W - padR + 6, ty); x.stroke(); x.setLineDash([]);
    } else mugIcon(x, tx + 30 * rugK, ty - 20, 1.8, '#ff6b7a');
    // the cash-out point
    if (G.out) { const ot = Math.log(G.out) / CR_SPEED, ox = X(ot), oy = Y(G.out); x.fillStyle = '#ffd36b'; x.shadowColor = '#ffd36b'; x.shadowBlur = 14; x.beginPath(); x.arc(ox, oy, 6, 0, 7); x.fill(); x.shadowBlur = 0;
      const lab = 'OUT ' + G.out.toFixed(2) + 'x'; x.font = "800 11px 'JetBrains Mono', monospace"; const lw = x.measureText(lab).width + 14; x.fillStyle = '#ffd36b'; x.beginPath(); x.roundRect(ox - lw / 2, oy - 34, lw, 20, 6); x.fill(); x.fillStyle = '#1a1204'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lab, ox, oy - 24); }
  } else if (!G.count) {
    // idle: a calm breathing curve and the call to action
    x.beginPath(); for (let i = 0; i <= 80; i++) { const tt = i / 80 * 8, v = 1 + 0.35 * (Math.exp(0.16 * tt) - 1) / (Math.exp(1.28) - 1) + Math.sin(now / 700 + i / 9) * 0.015; const a = X(tt), b = Y(v); i ? x.lineTo(a, b) : x.moveTo(a, b); }
    x.strokeStyle = 'rgba(143,245,196,.35)'; x.lineWidth = 3; x.shadowColor = '#8ff5c4'; x.shadowBlur = 12; x.stroke(); x.shadowBlur = 0;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.font = "900 30px Unbounded, sans-serif"; x.fillText(t('cs_place_big'), W / 2 - padR / 2, H / 2 - 18);
    x.font = "600 12px 'JetBrains Mono', monospace"; x.fillStyle = 'rgba(255,255,255,.5)'; x.fillText(t('cs_place'), W / 2 - padR / 2, H / 2 + 14);
    mugIcon(x, W / 2 - padR / 2, H / 2 - 70, 2.6, 'rgba(255,255,255,.9)');
  }
  // rug stamp and flashes
  if (rugged) {
    x.fillStyle = `rgba(255,107,122,${0.22 * (1 - rugK)})`; x.fillRect(0, 0, W, H);
    const sc = 0.6 + 0.4 * Math.min(1, rugK * 2.2); x.save(); x.translate(W / 2 - padR / 2, H / 2 + 34); x.rotate(-0.07); x.scale(sc, sc);
    x.strokeStyle = '#ff6b7a'; x.lineWidth = 4; x.beginPath(); x.roundRect(-150, -34, 300, 68, 12); x.stroke(); x.fillStyle = 'rgba(30,6,10,.75)'; x.fill();
    x.fillStyle = '#ff6b7a'; x.font = "900 40px Unbounded, sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('RUGGED', 0, 2); x.restore();
  }
  if (G.cashFx > 0) { G.cashFx = Math.max(0, G.cashFx - dtv * 1.8); x.fillStyle = `rgba(255,211,107,${0.2 * G.cashFx})`; x.fillRect(0, 0, W, H); }
  x.restore();
}

/* ---- pump or dump ---- */
async function flipGo(side) {
  if (G.busy || !takeBet()) return; G.busy = true; $('#gResult').innerHTML = '';
  let res, srv = null;
  if (G.srv) { try { srv = await capi('flip', { bet: G.bet, side }); res = srv.res; } catch (err) { G.busy = false; $('#gResult').innerHTML = err.code === 'broke' ? brokeHTML() : `<div class="gres">${esc(err.message)}</div>`; return; } }
  else res = Math.random() < 0.5 ? 'up' : 'down';
  const coin = $('#coin');
  coin.style.transition = 'none'; coin.style.transform = 'rotateY(0deg)'; void coin.offsetWidth;
  sfx('spin'); coin.style.transition = 'transform 1.4s cubic-bezier(.2,.8,.2,1)'; coin.style.transform = `rotateY(${1800 + (res === 'down' ? 180 : 0)}deg)`;
  setTimeout(() => {
    if (!G || G.id !== 'flip') return; G.busy = false; const lab = res === 'up' ? 'PUMP' : 'DUMP'; if ((srv ? !srv.win : res !== side)) sfx('bad');
    if (srv) { setSrvBal(srv.balance); if (srv.win) noteWin(srv.win); $('#gResult').innerHTML = srv.win ? `<div class="gres win">${lab} · +${fmtChips(srv.win)}</div>` : `<div class="gres">${lab} · -${fmtChips(G.bet)}</div>`; return; }
    if (res === side) { const win = Math.floor(G.bet * 1.95); setChips(chips().n + win); noteWin(win); $('#gResult').innerHTML = `<div class="gres win">${lab} · +${fmtChips(win)}</div>`; }
    else $('#gResult').innerHTML = `<div class="gres">${lab} · -${fmtChips(G.bet)}</div>`;
  }, 1450);
}
Object.assign(window.__cc, { chips, setChips, startCasino, crashPoint, slotRoll, CANDLES, CANDLE_SPOTS, colliders, EGGS, openEgg, detour, HUB, refreshOwned: () => refreshOwned(), I18N, get LANG() { return LANG; } });
Object.defineProperties(window.__cc, { G: { get: () => G }, playing: { get: () => playing } });
