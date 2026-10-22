/* ================= RANKED ARCADE (client) =================
   Six skill games. Practice is free and runs entirely in the browser with the same generator the server uses.
   A ranked run costs a fixed SOL fee paid from the player's Phantom to the cafe wallet; the server deals the rounds,
   keeps the clock, scores the answers and keeps the weekly board. Points are points: nothing is paid out. */
const RK = { run: null, mode: null, id: null, i: 0, answers: [], tm: null, roundEnd: 0, deadline: 0, t0: 0, busy: false, board: { game: 'all', span: 'week' }, cache: new Map(), top3d: null, top3dAt: 0 };
const RK_GAMES = ['rug', 'pnl', 'addr', 'chart', 'type', 'quant'];
const RK_ICON = { rug: '◎', pnl: '∑', addr: '⌗', chart: '▟', type: '⌨', quant: '∴' };
const rkFee = () => (NET.cfg.arcade && +NET.cfg.arcade.fee) || 0;
const rkOn = () => !!(NET.http && rkFee() > 0);
const rkFeeTxt = () => (+rkFee().toFixed(4)).toString();
const rkChipsCost = () => (NET.cfg.arcade && +NET.cfg.arcade.chips) || 0;
const rkChipsOn = () => !!(NET.http && NET.cfg.casino && rkChipsCost() > 0);
/* the machines in the cafe use the game names as their prompt */
for (const L in I18N) { for (const g of ['rug', 'pnl', 'addr', 'chart', 'type', 'quant']) I18N[L]['pl_cab_' + g] = I18N[L]['rk_' + g] || I18N.en['rk_' + g]; for (const [c, k] of [['slots', 'cs_slots'], ['crash', 'cs_crash'], ['flip', 'cs_flip']]) I18N[L]['pl_cab_' + c] = I18N[L][k] || I18N.en[k]; }
const rkName = g => t('rk_' + g);
function rkPBest() { return store.get('cc_rk_pbest', {}); }
function rkPending() { const p = store.get('cc_rk_pending', null); return p && p.sig && (!NET.wallet || p.wallet === NET.wallet) ? p : null; }
async function rkApi(path, body) {
  const get = !body, url = NET.http + '/api/arcade/' + path + (get ? (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(NET.token || '') : '');
  const r = await fetch(url, get ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, token: NET.token }) });
  const j = await r.json().catch(() => ({})); return { status: r.status, ok: r.ok, body: j };
}
/* ---- the arcade panel: ranked section + leaderboard ---- */
function arcadeRankedHTML() {
  const pend = rkPending(), pb = rkPBest();
  setTimeout(rkRenderBoard, 0);
  return `<div class="rk"><div class="rk-head"><div><span class="rk-eyebrow">${t('rk_tag')}</span><h4>${t('rk_t')}</h4></div><p class="muted">${rkOn() ? t('rk_d', { fee: rkFeeTxt() }) : t('rk_off')}</p></div>
    ${pend ? `<div class="rk-pend"><b>${t('rk_pending')}</b><button type="button" class="btn small hot" data-rk-resume>${t('rk_resume')}</button></div>` : ''}
    <div class="rk-games">${RK_GAMES.map(g => `<div class="rk-card g-${g}"><i class="rk-ic">${RK_ICON[g]}</i><b>${rkName(g)}</b><small>${t('rk_' + g + '_d')}</small>${pb[g] ? `<em>${t('rk_pbest', { s: pb[g] })}</em>` : ''}<div class="rk-row"><button type="button" class="btn small" data-rk-practice="${g}">${t('rk_practice')}</button>${rkOn() ? `<button type="button" class="btn small hot" data-rk-ranked="${g}">${t('rk_ranked', { fee: rkFeeTxt() })}</button>` : ''}${rkChipsOn() ? `<button type="button" class="btn small" data-rk-chips="${g}">${t('rk_ranked_chips', { n: fmtChips(rkChipsCost()) })}</button>` : ''}</div></div>`).join('')}</div>
    <div class="rk-board"><div class="rk-tabs"><button type="button" data-rk-tab="all" aria-pressed="${RK.board.game === 'all'}">${t('rk_overall')}</button>${RK_GAMES.map(g => `<button type="button" data-rk-tab="${g}" aria-pressed="${RK.board.game === g}">${rkName(g)}</button>`).join('')}</div>
      <div class="rk-span"><button type="button" data-rk-span="week" aria-pressed="${RK.board.span === 'week'}">${t('rk_week')}</button><button type="button" data-rk-span="all" aria-pressed="${RK.board.span === 'all'}">${t('rk_all')}</button></div>
      <div id="rkBoard" class="rk-rows"><p class="muted">…</p></div></div></div>`;
}
async function rkRenderBoard() {
  const box = $('#rkBoard'); if (!box) return;
  if (!NET.http) { box.innerHTML = `<p class="muted">${t('rk_off')}</p>`; return; }
  const key = RK.board.game + ':' + RK.board.span + ':' + (NET.token ? 1 : 0), hit = RK.cache.get(key);
  let data = hit && Date.now() - hit.at < 60e3 ? hit.data : null;
  if (!data) { try { const r = await rkApi(`top?game=${RK.board.game}&span=${RK.board.span}`); if (!r.ok) throw new Error(r.body.error || r.status); data = r.body; RK.cache.set(key, { at: Date.now(), data }); } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; } }
  if (!$('#rkBoard')) return;
  const rows = data.top || [];
  $('#rkBoard').innerHTML = (rows.length ? rows.map((r, i) => `<div class="rk-r ${r.w === NET.wallet ? 'me' : ''}"><span class="n">${i + 1}</span><b>${esc(r.n || shortW(r.w))}</b><span class="s">${r.s}</span></div>`).join('') : `<p class="muted">${t('rk_empty')}</p>`) +
    `<div class="rk-foot"><span>${t('rk_players', { n: data.players || 0 })} · ${esc(data.week || '')}</span><span>${data.me && data.me.rank ? t('rk_me', { r: data.me.rank, s: data.me.best }) : NET.wallet ? t('rk_me_none') : ''}</span></div>`;
}
/* ---- starting runs ---- */
function rkPractice(game) { if (RK.busy || !RK_GAMES.includes(game)) return; rkPlay(arcMakeRun(game), 'practice', null, 0); }
async function rkRanked(game) {
  if (RK.busy || !RK_GAMES.includes(game)) return;
  if (!rkOn()) return toast(t('rk_off'), '', true);
  RK.busy = true;
  try {
    if (!NET.loggedIn || !NET.token) { toast(t('rk_login'), 'cyan', true); await walletLogin(); }
    let pend = rkPending();
    if (pend) game = pend.game;   // a run that is already paid for comes first, whatever game it was
    if (!pend) { rkWait(t('rk_paying')); const sig = await paySol(rkFee(), s => store.set('cc_rk_pending', { sig: s, game, wallet: NET.wallet })); pend = { sig, game, wallet: NET.wallet }; }
    rkWait(t('rk_checking'));
    const run = await rkClaim(pend);
    rkPlay(run, 'ranked', run.id, run.startedAt ? Math.max(0, (run.now || Date.now()) - run.startedAt) : 0);
  } catch (e) {
    if (gameActive === 'rk' && !RK.run) rkStop();   // back to the arcade panel; if the payment did go through, the resume button is there
    toast((e && e.message || String(e)).slice(0, 120), 'bad', true);
    if (rkPending()) setTimeout(() => toast(t('rk_pending'), 'cyan', true), 1200);
  }
  finally { RK.busy = false; }
}
/* a waiting screen in the game sheet while Phantom and Solana do their part (Esc closes it; the run opens by itself when ready) */
function rkWait(msg) {
  gameActive = 'rk'; G = { id: 'rk', cab: RK.from === 'cab' }; showModal('mGame');
  $('#gameBody').innerHTML = `<div class="ghead"><h3>${t('rk_t')}</h3><button type="button" class="xclose" data-close aria-label="Close">×</button></div><div class="rk-intro"><div class="rk-spin"></div><p class="muted">${esc(msg)}</p></div>`;
}
/* a ranked run paid from the chip balance */
async function rkRankedChips(game) {
  if (RK.busy || !RK_GAMES.includes(game)) return;
  if (!rkChipsOn()) return toast(t('rk_off'), '', true);
  RK.busy = true;
  try {
    if (!NET.loggedIn || !NET.token) { toast(t('rk_login'), 'cyan', true); await walletLogin(); }
    rkWait(t('rk_checking_chips'));
    const r = await rkApi('run', { game, pay: 'chips' });
    if (!r.ok) { if (r.body.code === 'broke') { rkStop(); openPlace('casino'); throw new Error(t('rk_no_chips', { n: fmtChips(r.body.price || rkChipsCost()) })); } throw new Error(r.body.error || ('arcade ' + r.status)); }
    if (r.body.balance !== undefined) NET.chips = r.body.balance;
    rkPlay(r.body, 'ranked', r.body.id, 0);
  } catch (e) { if (gameActive === 'rk' && !RK.run) rkStop(); toast((e && e.message || String(e)).slice(0, 120), 'bad', true); }
  finally { RK.busy = false; }
}
/* the screen of an arcade machine in the cafe: one game, its three ways to play and the top of its board */
async function rkOpenGame(game) {
  if (!RK_GAMES.includes(game)) return;
  rkStop(true); RK.from = 'cab'; RK.lastGame = game;
  gameActive = 'rk'; G = { id: 'rk', cab: true }; showModal('mGame');
  const pb = rkPBest()[game];
  $('#gameBody').innerHTML = `<div class="ghead"><h3>${rkName(game)}</h3><div class="gmeta"><span class="rk-mode">${t('rk_choose_t')}</span></div><button type="button" class="xclose" data-close aria-label="Close">×</button></div>
    <div class="rk-choose"><i class="rk-ic big">${RK_ICON[game]}</i><p>${t('rk_' + game + '_d')}</p>${game === 'rug' ? `<p class="rk-rule">${t('rk_rug_rule')}</p>` : ''}<p class="muted">${t('rk_cab_hint')}</p>${pb ? `<em>${t('rk_pbest', { s: pb })}</em>` : ''}
      <div class="rk-row"><button type="button" class="btn hot" data-rk-practice="${game}">${t('rk_practice')}</button>${rkOn() ? `<button type="button" class="btn" data-rk-ranked="${game}">${t('rk_ranked', { fee: rkFeeTxt() })}</button>` : ''}${rkChipsOn() ? `<button type="button" class="btn" data-rk-chips="${game}">${t('rk_ranked_chips', { n: fmtChips(rkChipsCost()) })}</button>` : ''}</div>
      <div class="rk-rows" id="rkCabTop"><p class="muted">${NET.http ? '…' : ''}</p></div></div>`;
  if (!NET.http) return;
  try { const r = await rkApi(`top?game=${game}&span=week`); const box = $('#rkCabTop'); if (!box || !r.ok) return; const rows = (r.body.top || []).slice(0, 5);
    box.innerHTML = `<div class="rk-foot"><span>${t('rk_top5')}</span><span>${t('rk_players', { n: r.body.players || 0 })}</span></div>` + (rows.length ? rows.map((x, i) => `<div class="rk-r ${x.w === NET.wallet ? 'me' : ''}"><span class="n">${i + 1}</span><b>${esc(x.n || shortW(x.w))}</b><span class="s">${x.s}</span></div>`).join('') : `<p class="muted">${t('rk_empty')}</p>`); } catch (e) { }
}
async function rkResume() { const p = rkPending(); if (!p || RK.busy) return; await rkRanked(p.game); }
async function rkClaim(pend) {
  for (let i = 0; i < 20; i++) {
    const r = await rkApi('run', { game: pend.game, sig: pend.sig });
    if (r.status === 202) { toast(t('rk_checking'), 'cyan', true); await sleep(4000); continue; }
    if (r.status === 409 || r.status === 402) { store.set('cc_rk_pending', null); throw new Error(r.status === 409 ? t('rk_used') : r.body.error); }
    if (!r.ok) throw new Error(r.body.error || ('arcade ' + r.status));
    return r.body;
  }
  throw new Error(t('rk_checking'));
}
/* ---- playing ---- */
const RK_COL = { rug: '#ff6b7a', pnl: '#6ff0b0', addr: '#6fb3ff', chart: '#ffcf5a', type: '#b98cff', quant: '#5ee7ff' };
function rkCab(game) { const sh = $('#mGame .sheet'); if (!sh) return; sh.classList.add('cab'); sh.style.setProperty('--gc', RK_COL[game] || '#ffcf5a'); }
function rkPlay(run, mode, id, elapsedMs) {
  rkStop(true); rkCab(run.game); RK.combo = 0; RK.best = 0; RK.pts = 0;
  RK.run = run; RK.mode = mode; RK.id = id; RK.i = 0; RK.answers = []; RK.elapsed0 = elapsedMs || 0; RK.playAt = Date.now(); RK.finishedAt = 0;
  gameActive = 'rk'; G = { id: 'rk', cab: RK.from === 'cab' }; showModal('mGame');
  const n = run.rounds.length, sec = Math.round(run.roundMs / 1000);
  $('#gameBody').innerHTML = rkHead() + `<div class="rk-intro"><i class="rk-ic big">${RK_ICON[run.game]}</i><h3>${rkName(run.game)}</h3><p>${t('rk_' + run.game + '_d')}</p>${run.game === 'rug' ? `<p class="rk-rule">${t('rk_rug_rule')}</p>` : ''}<p class="muted">${t('rk_ready', { n, s: sec })}</p><button type="button" class="btn hot big" id="rkGo">${t('rk_go')}</button><p class="muted small">${t('rk_keys')}</p></div>`;
  $('#rkGo').addEventListener('click', rkGo); $('#rkGo').focus();
}
function rkHead(run = RK.run) { return `<div class="ghead"><h3>${rkName(run.game)}</h3><div class="gmeta"><span class="rk-mode ${RK.mode}">${t(RK.mode === 'ranked' ? 'rk_ranked_tag' : 'rk_practice_tag')}</span><span id="rkRound"></span><span id="rkClock"></span><span class="rk-combo" id="rkCombo"></span></div><button type="button" class="xclose" data-close aria-label="Close">×</button></div>`; }
async function rkCountdown() {
  const box = $('#gameBody .rk-intro'); if (!box) return;
  box.innerHTML = '<div class="rk-count" id="rkCount"></div>';
  for (const s of ['3', '2', '1', 'GO']) { const c = $('#rkCount'); if (!c || !RK.run) return; c.textContent = s; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); sfx(s === 'GO' ? 'go' : 'tick'); await sleep(s === 'GO' ? 420 : 560); }
}
async function rkGo() {
  const run = RK.run; if (!run || RK.t0 || RK.counting) return;
  if (!RK.elapsed0) { RK.counting = true; await rkCountdown(); RK.counting = false; if (RK.run !== run) return; }
  if (RK.mode === 'ranked') { try { const r = await rkApi('go', { id: RK.id }); if (!r.ok) throw new Error(r.body.error || r.status); } catch (e) { toast(String(e.message || e), 'bad', true); return; } }
  RK.t0 = Date.now() - (RK.elapsed0 ? RK.elapsed0 + (Date.now() - RK.playAt) : 0); RK.deadline = RK.t0 + run.limitMs;   // a resumed run keeps the server's clock
  rkRound();
}
function rkRound() {
  const run = RK.run; if (!run) return;
  if (RK.i >= run.rounds.length || Date.now() >= RK.deadline) return rkFinish();
  const r = run.rounds[RK.i], q = r.q;
  RK.roundEnd = Math.min(RK.deadline, Date.now() + run.roundMs); RK.answered = false;
  $('#gameBody').innerHTML = rkHead() + `<div class="rk-timer"><i id="rkBar"></i></div><div class="rk-q" id="rkQ">${rkQuestionHTML(run.game, q)}</div>`;
  $('#rkRound').textContent = t('rk_round', { i: RK.i + 1, n: run.rounds.length });
  rkAfterRender(run.game, q);
  clearInterval(RK.tm); RK.tm = setInterval(rkTick, 100); rkTick();
}
function rkTick() {
  if (!RK.run) return clearInterval(RK.tm);
  const left = RK.roundEnd - Date.now(), total = RK.run.roundMs, bar = $('#rkBar'), clock = $('#rkClock');
  if (bar) bar.style.width = Math.max(0, Math.min(100, left / total * 100)) + '%';
  if (clock) clock.textContent = Math.max(0, left / 1000).toFixed(1) + ' s';
  if (bar) bar.classList.toggle('low', left < 2500);
  if (left <= 0) rkAnswer(-1);
}
function rkAnswer(a) {
  if (!RK.run || RK.answered) return; RK.answered = true; clearInterval(RK.tm);
  const run = RK.run, round = run.rounds[RK.i]; RK.answers[RK.i] = a; RK.i++;
  const box = $('#rkQ'), sheet = $('#mGame .sheet');
  if (RK.mode === 'practice' && round && 'a' in round) {
    const ok = arcCheck(run.game, round, a), left = Math.max(0, RK.roundEnd - Date.now());
    if (ok) { RK.combo++; RK.best = Math.max(RK.best, RK.combo); const pts = 100 + Math.round(left / run.roundMs * 50); RK.pts += pts; sfx('ok'); rkFloat('+' + pts + (RK.combo >= 3 ? ' · x' + RK.combo : ''), 'ok'); }
    else { RK.combo = 0; sfx('bad'); rkFloat(a === -1 ? t('rk_time') : t('rk_miss'), 'no'); if (sheet) { sheet.classList.remove('shake'); void sheet.offsetWidth; sheet.classList.add('shake'); } }
    if (box) box.classList.add('done', ok ? 'ok' : 'no');
    if (!ok && run.game !== 'type') { const right = box && box.querySelectorAll('[data-rk-choice]')[round.a]; if (right) right.classList.add('right'); }
    const c = $('#rkCombo'); if (c) { c.textContent = RK.combo >= 2 ? t('rk_combo', { n: RK.combo }) : ''; c.classList.toggle('hot', RK.combo >= 3); }
    const pause = 520; RK.t0 += pause; RK.deadline += pause;   // the feedback pause never counts against the player
    setTimeout(rkRound, pause); return;
  }
  sfx('tick'); if (box) box.classList.add('done', 'lock');
  setTimeout(rkRound, a === -1 ? 350 : 160);
}
function rkFloat(txt, cls) { const b = $('#gameBody'); if (!b) return; const f = document.createElement('div'); f.className = 'rk-float ' + cls; f.textContent = txt; b.appendChild(f); setTimeout(() => f.remove(), 900); }
const rkGrade = (c, n) => { const r = c / n; return r >= 1 ? 'S' : r >= 0.8 ? 'A' : r >= 0.6 ? 'B' : r >= 0.4 ? 'C' : 'D'; };
function rkCountUp(el, to) { const t0 = performance.now(), d = 900; const step = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
async function rkFinish() {
  const run = RK.run; if (!run) return; clearInterval(RK.tm);
  if (!RK.finishedAt) RK.finishedAt = Date.now();
  const elapsed = RK.finishedAt - RK.t0;
  let res, extra = '';
  if (RK.mode === 'practice') {
    res = arcScore(run, RK.answers, elapsed);
    const pb = rkPBest(); if (res.score > (pb[run.game] || 0)) { pb[run.game] = res.score; store.set('cc_rk_pbest', pb); res.newBest = true; }
  } else {
    $('#gameBody').innerHTML = rkHead(run) + `<div class="rk-intro"><div class="rk-spin"></div><p class="muted">${t('rk_checking')}</p></div>`;
    let r; for (let i = 0; i < 4; i++) { try { r = await rkApi('submit', { id: RK.id, answers: RK.answers }); if (r.ok || r.status < 500) break; } catch (e) { r = null; } await sleep(1500); }   // network hiccups and 5xx are retried by themselves
    if (r && !r.ok && (r.status === 409 || r.status === 404)) { store.set('cc_rk_pending', null); toast(r.body.error || r.status, 'bad', true); return rkStop(); }
    if (!r || !r.ok) {   // the answers stay in memory: one tap sends them again
      $('#gameBody').innerHTML = rkHead(run) + `<div class="rk-intro"><p class="rk-late">${esc((r && r.body.error) || t('rk_retry_d'))}</p><button type="button" class="btn hot" data-rk-retry>${t('rk_retry')}</button></div>`; return;
    }
    res = r.body; store.set('cc_rk_pending', null); RK.cache.clear(); RK.top3dAt = 0;
    if (RK.run !== run) { toast(t('rk_result_t') + ': ' + res.score, 'gold', true); return; }   // closed while waiting: the score is on the board anyway
    extra = `<p class="rk-rank">${t('rk_rank', { r: res.rank, g: rkName(run.game), ra: res.rankAll })}</p>`;
  }
  gainXP(10 + Math.round((res.score || 0) / 25), 'arcade'); dailyDone('rk');
  const fee = rkFeeTxt(), dots = (res.per || []).map(ok => `<i class="${ok ? 'ok' : 'no'}"></i>`).join('');
  const grade = rkGrade(res.correct, res.total);
  RK.shareRes = { game: run.game, score: res.score, grade, correct: res.correct, total: res.total, rank: RK.mode === 'ranked' ? res.rank : 0 };
  $('#gameBody').innerHTML = rkHead(run) + `<div class="rk-res"><div class="rk-grade g-${grade}"><small>${t('rk_grade')}</small><b>${grade}</b></div><span class="rk-eyebrow">${t('rk_result_t')}</span><div class="rk-score" id="rkScoreN">0</div>${RK.best >= 3 ? `<p class="rk-bestc">${t('rk_bestcombo', { n: RK.best })}</p>` : ''}<div class="rk-dots">${dots}</div>
    <p>${t('rk_correct', { c: res.correct, n: res.total })} · ${t('rk_bonus', { b: res.bonus })}</p>${res.late ? `<p class="rk-late">${t('rk_late')}</p>` : ''}${res.newBest ? `<p class="rk-best">${t('rk_newbest')}</p>` : ''}${extra}
    <div class="rk-row">${RK.mode === 'ranked' && rkOn() ? `<button type="button" class="btn hot" data-rk-ranked="${run.game}">${t('rk_again', { fee })}</button>` : ''}<button type="button" class="btn ${RK.mode === 'practice' ? 'hot' : ''}" data-rk-practice="${run.game}">${t('rk_again_free')}</button><button type="button" class="btn" data-share="rk">𝕏 ${t('sh_btn')}</button><button type="button" class="btn" data-rk-back>${t('rk_back')}</button></div></div>`;
  $('#rkRound').textContent = ''; $('#rkClock').textContent = ''; const cb = $('#rkCombo'); if (cb) cb.textContent = '';
  rkCountUp($('#rkScoreN'), res.score); sfx(grade === 'S' || grade === 'A' ? 'win' : 'coin');
  if (grade === 'S' || grade === 'A') { const r = $('#mGame .sheet').getBoundingClientRect(); bigWinBurst(r.left + r.width / 2, r.top + 120); }
  RK.run = null; RK.t0 = 0;
}
function rkStop(silent) { clearInterval(RK.tm); RK.run = null; RK.t0 = 0; if (!silent) { gameActive = null; G = null; if (RK.from === 'cab') { RK.from = null; closeModals(); } else openPlace('arcade'); } }
/* ---- rendering a round ---- */
const rkNum = (v, unit) => unit === '%' ? (v > 0 ? '+' : '') + v + '%' : unit === 'x' ? v + 'x' : unit === 'SOL' ? v + ' SOL' : String(v);
function rkChoices(list, unit, cls = '') { return `<div class="rk-choices ${cls}">${list.map((c, i) => `<button type="button" class="btn" data-rk-choice="${i}"><span class="k">${i + 1}</span>${esc(rkNum(c, unit))}</button>`).join('')}</div>`; }
function rkQuestionHTML(game, q) {
  if (game === 'rug') {
    const flag = (bad, txt) => `<b class="${bad ? 'bad' : 'good'}">${txt}</b>`;
    const hue = [...q.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
    return `<p class="rk-ask">${t('rk_rug_q')}</p><div class="rk-token"><div class="rk-thead"><span class="rk-tav" style="--h:${hue}">${esc(q.name.slice(0, 2))}</span><div><div class="rk-tname">$${esc(q.name)}</div><small class="rk-tsub">pump.fun · ${t('rk_hours', { n: q.age })}</small></div></div><div class="rk-stats">
      <div><small>${t('rk_top10')}</small>${flag(q.top10 >= 50, q.top10 + '%')}</div><div><small>${t('rk_dev')}</small>${flag(q.dev >= 20, q.dev + '%')}</div>
      <div><small>${t('rk_lp')}</small>${flag(q.lp === 'unlocked', t('rk_' + q.lp))}</div><div><small>${t('rk_mint')}</small>${flag(q.mint === 'active', t('rk_' + q.mint))}</div>
      <div><small>${t('rk_age')}</small><b>${t('rk_hours', { n: q.age })}</b></div><div><small>${t('rk_social')}</small><b>${t(q.social ? 'rk_yes' : 'rk_no')}</b></div></div></div>
      <div class="rk-choices two"><button type="button" class="btn safe" data-rk-choice="0"><span class="k">1</span>${t('rk_safe')}</button><button type="button" class="btn rug" data-rk-choice="1"><span class="k">2</span>${t('rk_rugbtn')}</button></div>`;
  }
  if (game === 'pnl') {
    const txt = q.kind === 'bag' ? t('rk_pnl_bag', { bag: q.bag, buy: q.buy, now: q.now }) : q.kind === 'pct' ? t('rk_pnl_pct', { p: q.p, q: q.qv }) : q.kind === 'fee' ? t('rk_pnl_fee', { fee: q.fee, amt: q.amt }) : t('rk_pnl_x', { start: q.start, end: q.end });
    return `<p class="rk-ask">${txt}</p>${rkChoices(q.choices, q.unit)}`;
  }
  if (game === 'addr') return `<p class="rk-ask">${t('rk_addr_show')}</p><div class="rk-addr show" id="rkAddr">${esc(q.show)}</div><div id="rkAddrPick"></div>`;
  if (game === 'chart') return `<p class="rk-ask">${t('rk_chart_q')}</p><canvas id="rkChart" width="560" height="220"></canvas>${rkChoices(q.choices, q.unit)}`;
  if (game === 'type') return `<p class="rk-ask">${t('rk_type_q')}</p><div class="rk-word" id="rkWord">${[...q.word].map(ch => `<i>${ch === ' ' ? '&nbsp;' : esc(ch)}</i>`).join('')}</div><form class="rk-type" id="rkTypeForm"><input id="rkType" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${t('rk_type_ph')}"><button type="submit" class="btn hot">${t('rk_type_go')}</button></form>`;
  // quant
  const txt = q.kind === 'seq' ? t('rk_quant_seq', { seq: q.seq.join(' · ') }) : q.kind === 'spread' ? t('rk_quant_spread', { bid: q.bid, ask: q.ask }) : q.kind === 'route' ? t('rk_quant_route', { a: q.fees[0], b: q.fees[1], c: q.fees[2], d: q.fees[3] }) : t('rk_quant_dec');
  return `<p class="rk-ask">${txt}</p>${rkChoices(q.choices, '')}`;
}
function rkAfterRender(game, q) {
  const body = $('#gameBody');
  body.querySelectorAll('[data-rk-choice]').forEach(b => b.addEventListener('click', () => rkAnswer(+b.dataset.rkChoice)));
  if (game === 'addr') {
    const i = RK.i;
    setTimeout(() => { if (!RK.run || RK.i !== i || RK.answered) return; const a = $('#rkAddr'); if (a) { a.textContent = '· · ·'; a.classList.remove('show'); } $('#rkAddrPick').innerHTML = `<p class="rk-ask">${t('rk_addr_pick')}</p>${rkChoices(q.choices, '', 'addr')}`; $('#rkAddrPick').querySelectorAll('[data-rk-choice]').forEach(b => b.addEventListener('click', () => rkAnswer(+b.dataset.rkChoice))); }, 4000);
  }
  if (game === 'chart') { const c = $('#rkChart'), i0 = RK.i, n = q.candles.length; let k = 0; const step = () => { if (!RK.run || RK.i !== i0) return; k = Math.min(n, k + 2); rkDrawCandles(c, q.candles, k); if (k < n) setTimeout(step, 28); }; step(); }
  if (game === 'type') { const f = $('#rkTypeForm'), inp = $('#rkType'); f.addEventListener('submit', e => { e.preventDefault(); rkAnswer(inp.value); }); setTimeout(() => inp.focus(), 30);
    inp.addEventListener('input', () => { const v = inp.value.toUpperCase(), cells = $('#rkWord').children; [...q.word].forEach((ch, k) => { const c = cells[k]; if (!c) return; c.className = k < v.length ? (v[k] === ch ? 'hit' : 'bad') : ''; }); sfx('spin'); }); }
}
function rkDrawCandles(c, candles, upto = candles.length) {
  if (!c) return; const x = c.getContext('2d'), W = c.width, H = c.height, n = candles.length;
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0f14'); bg.addColorStop(1, '#050507'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const lo = Math.min(...candles.map(k => k[2])), hi = Math.max(...candles.map(k => k[1])), y = v => H - 14 - (v - lo) / (hi - lo || 1) * (H - 28);
  x.strokeStyle = 'rgba(236,233,226,.08)'; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke(); }
  const w = W / n;
  x.shadowBlur = 10; candles.forEach(([o, h, l, cl], i) => { if (i >= upto) return; const up = cl >= o, cx = i * w + w / 2; x.strokeStyle = x.fillStyle = up ? '#6ff0b0' : '#ff6b7a'; x.shadowColor = x.fillStyle; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, y(h)); x.lineTo(cx, y(l)); x.stroke(); const top = y(Math.max(o, cl)), hh = Math.max(2, Math.abs(y(o) - y(cl))); x.fillRect(cx - w * 0.3, top, w * 0.6, hh); });
  x.shadowBlur = 0; x.strokeStyle = 'rgba(255,207,90,.6)'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, y(candles[0][0])); x.lineTo(W, y(candles[0][0])); x.stroke(); x.setLineDash([]);
}
/* ---- keys, clicks ---- */
document.addEventListener('keydown', e => {
  if (gameActive !== 'rk' || !RK.run || !RK.t0 || RK.answered) return;
  if (isTyping()) return;
  const k = e.key; if (k >= '1' && k <= '4') { const b = document.querySelectorAll('#gameBody [data-rk-choice]')[+k - 1]; if (b) { b.click(); e.preventDefault(); } }
});
document.addEventListener('click', e => {
  const src = e.target.closest('#gameBody') ? RK.from : null;
  const p = e.target.closest('[data-rk-practice]'); if (p) { RK.from = src; rkPractice(p.dataset.rkPractice); return; }
  const r = e.target.closest('[data-rk-ranked]'); if (r) { RK.from = src; rkRanked(r.dataset.rkRanked); return; }
  const rc = e.target.closest('[data-rk-chips]'); if (rc) { RK.from = src; rkRankedChips(rc.dataset.rkChips); return; }
  if (e.target.closest('[data-rk-resume]')) { rkResume(); return; }
  if (e.target.closest('[data-rk-back]')) { if (RK.from === 'cab' && RK.lastGame) { const g = RK.lastGame; rkStop(true); gameActive = null; G = null; rkOpenGame(g); } else rkStop(); return; }
  if (e.target.closest('[data-rk-retry]')) { rkFinish(); return; }
  const tab = e.target.closest('[data-rk-tab]'); if (tab) { RK.board.game = tab.dataset.rkTab; document.querySelectorAll('[data-rk-tab]').forEach(b => b.setAttribute('aria-pressed', b === tab)); rkRenderBoard(); return; }
  const sp = e.target.closest('[data-rk-span]'); if (sp) { RK.board.span = sp.dataset.rkSpan; document.querySelectorAll('[data-rk-span]').forEach(b => b.setAttribute('aria-pressed', b === sp)); rkRenderBoard(); }
});
/* ---- the TOP RUNS board on the arcade wall: overall weekly leaders, refreshed every few minutes ---- */
async function rkBoard3d() {
  const tex = townFx.rankTex; if (!tex) return;
  if (NET.http && Date.now() - RK.top3dAt > 240e3) { RK.top3dAt = Date.now(); try { const r = await rkApi('top?game=all'); if (r.ok) RK.top3d = r.body; } catch (e) { } }
  const ctx = tex.userData.ctx, W = 512, H = 384; ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c8a96a'; ctx.font = "700 26px Unbounded, 'Arial Black', sans-serif"; ctx.textAlign = 'left'; ctx.fillText(t('rk_board3d'), 20, 44);
  ctx.fillStyle = '#8a877f'; ctx.font = `600 15px ${MONO}`; ctx.fillText(t('rk_board3d_sub'), 20, 68);
  const rows = (RK.top3d && RK.top3d.top || []).slice(0, 7);
  if (!rows.length) { emptyBoard(ctx, 512, 400, 'NO RUNS YET', 'press E at the arcade'); }
  rows.forEach((r, i) => {
    const y = 108 + i * 38;
    ctx.fillStyle = i === 0 ? '#c8a96a' : i === 1 ? '#c9ccd6' : i === 2 ? '#c9a85c' : '#3a3160'; ctx.beginPath(); ctx.arc(34, y - 7, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0b0c'; ctx.font = "700 15px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText(i + 1, 34, y - 2); ctx.textAlign = 'left';
    ctx.fillStyle = '#ece9e2'; ctx.font = `700 19px ${MONO}`; ctx.fillText(String(r.n || shortW(r.w)).slice(0, 16), 64, y);
    ctx.fillStyle = r.w === NET.wallet ? '#8fd3a6' : '#c8a96a'; ctx.textAlign = 'right'; ctx.fillText(String(r.s), 492, y); ctx.textAlign = 'left';
  });
  tex.needsUpdate = true;
}
Object.assign(window.__cc, { rkPractice, rkRanked, rkRankedChips, rkOpenGame, rkPlay, rkWait, arcMakeRun, arcScore, rkAnswer, rkFinish, rkBoard3d, rkRenderBoard });
Object.defineProperties(window.__cc, { RK: { get: () => RK } });
