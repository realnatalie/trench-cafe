
/* ================= arcade minigames ================= */
let gameActive = null, G = null;
const gkeys = {};
function gameKeyEvent(e, down) {
  if (!gameActive) return;
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(e.code)) { e.preventDefault(); gkeys[e.code] = down; if (e.code === 'Space' && down) gameAction(); }
}
function rivals(n = 3) { return TOWNSFOLK.slice().sort(() => Math.random() - 0.5).slice(0, n).map(c => ({ c, name: c.name, score: 0, temper: hashStr(c.id) % 2 ? 'agg' : 'care' })); }
function gameHead(title, right = '') { return `<div class="ghead"><h3>${title}</h3><div class="gmeta" id="gMeta">${right}</div><button type="button" class="xclose" data-close aria-label="Close">×</button></div>`; }
function rivalsHTML(list, yours) { return `<div class="rivals"><div class="rv you"><b>${t('g_you')}</b><span id="gYou">${yours}</span></div>${list.map((r, i) => `<div class="rv"><b><img class="rv-mini" src="${TH(r.c.id)}" alt="">${esc(r.name)}</b><span id="gR${i}">${r.score}</span></div>`).join('')}</div>`; }
function startGame(id) {
  { const sh = $('#mGame .sheet'); if (sh) sh.classList.remove('cab'); }
  gameActive = id; showModal('mGame'); for (const k in gkeys) gkeys[k] = false;
  const body = $('#gameBody');
  if (id === 'clash') {
    const r = rivals(1)[0]; G = { id, r, you: 0, them: 0, round: 1, busy: false };
    body.innerHTML = gameHead(t('g_clash'), `<span>${t('g_round', { n: 1 })}</span>`) + `<div class="clash-game"><div class="cside"><b><img class="rv-face" src="${TH(charChoice)}" alt="">${t('g_you')}</b><div class="card big" id="cYou">?</div><div class="sc" id="cYouS">0</div></div><div class="vs">${t('clash_vs')}</div><div class="cside"><b><img class="rv-face" src="${TH(r.c.id)}" alt="">${esc(r.name)}</b><div class="card big" id="cThem">?</div><div class="sc" id="cThemS">0</div><div class="banter" id="cBanter">${esc(pick((BANTER[LANG] || BANTER.en)[r.temper]))}</div></div></div>
      <div class="muted" style="text-align:center;margin:8px 0 6px">${t('g_pick')}</div><div class="picks" id="cPicks">${['pump', 'hodl', 'dump'].map(k => `<button type="button" class="card pick ${k}" data-pick="${k}">${t('clash_' + k)}</button>`).join('')}</div><div class="muted" style="text-align:center;font-size:12px">${t('g_clash_d')}</div><div id="gResult"></div>`;
    body.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => clashPick(b.dataset.pick)));
    return;
  }
  if (id === 'claw') {
    const bd = TOWNSFOLK.slice().sort(() => Math.random() - 0.5).slice(0, 6);
    G = { id, busy: false };
    body.innerHTML = gameHead(t('g_claw'), `<span>${t('g_free')}</span>`) + `<div class="claw"><div class="machine"><div class="clawarm" id="clawArm"><i></i></div><div class="plushes">${bd.map(c => `<div class="pl-item" data-ch="${c.id}"><img src="${TH(c.id)}" alt=""><span>${esc(c.name)}</span></div>`).join('')}</div></div>
      <div class="row" style="justify-content:center"><button type="button" class="btn hot" id="clawTry">${t('claw_try')}</button></div><div id="gResult" style="text-align:center"></div>
      <h4 class="h4">${t('claw_coll')}</h4><div class="coll" id="clawColl">${W.plushes.map(p => `<span class="pill famous">${esc(p)}</span>`).join('') || '<span class="muted">—</span>'}</div></div>`;
    $('#clawTry').addEventListener('click', clawTry);
    return;
  }
  const list = rivals(3);
  G = { id, list, score: 0, time: id === 'fish' ? 60 : 40, over: false, t: 0 };
  body.innerHTML = gameHead(t('g_' + id), `<span>${t('g_time')}: <b id="gTime">${G.time}</b></span><span>${t('g_score')}: <b id="gScore">0</b></span>`) + `<div class="garea"><canvas id="gc" width="480" height="600"></canvas>${rivalsHTML(list, 0)}</div><div class="muted" style="text-align:center;font-size:12px;margin-top:6px">${t('g_' + id + '_d')} · ${t('g_tap')}</div><div id="gResult"></div>`;
  const c = $('#gc'); G.c = c; G.ctx = c.getContext('2d');
  c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); G.px = (e.clientX - r.left) / r.width * 480; });
  c.addEventListener('pointerdown', e => { const r = c.getBoundingClientRect(); G.px = (e.clientX - r.left) / r.width * 480; gameAction(); });
  if (id === 'catch') { G.tray = 240; G.items = []; G.spawn = 0; }
  if (id === 'fish') { G.marker = 0; G.speed = 1.6; G.dir = 1; newFish(); G.flash = 0; }
  if (id === 'run') { G.y = 0; G.vy = 0; G.ground = true; G.x = 0; G.speed = 260; G.segs = []; G.coins = []; G.lives = 3; G.dist = 0; let x = 0; for (let i = 0; i < 40; i++) { const w = 220 + Math.random() * 260, gap = i < 2 ? 0 : 60 + Math.random() * 90; G.segs.push({ x, w }); for (let k = 0; k < 3; k++) if (Math.random() < 0.6) G.coins.push({ x: x + 40 + k * 60, y: 90 + Math.random() * 120, got: false }); x += w + gap; } G.len = x; }
}
function closeGame() { const back = G && G.casino ? 'casino' : G && G.cab ? null : 'arcade'; if (gameActive === 'rk') { rkStop(true); RK.from = null; } gameActive = null; G = null; if (back) openPlace(back); else closeModals(); }
function gameAction() { if (!G || G.over) return; if (G.id === 'fish') fishHook(); if (G.id === 'run' && G.ground) { G.vy = -520; G.ground = false; } }
function endGame(won, reward, winnerName) {
  if (!G || G.over) return; G.over = true;
  const r = $('#gResult'); if (!r) return;
  if (won) { r.innerHTML = `<div class="gres win">${t('g_win')}</div><button type="button" class="btn hot" id="gAgain">${t('g_again')}</button>`; }
  else r.innerHTML = `<div class="gres">${t('g_lose', { s: winnerName })}</div><button type="button" class="btn" id="gAgain">${t('g_again')}</button>`;
  $('#gAgain').addEventListener('click', () => startGame(G.id));
}
/* card clash */
function clashPick(k) {
  if (!G || G.busy || G.over) return; G.busy = true;
  const w = G.r.temper === 'agg' ? { pump: .5, hodl: .2, dump: .3 } : { pump: .25, hodl: .5, dump: .25 };
  let rr = Math.random(), them = 'pump'; for (const kk in w) { rr -= w[kk]; if (rr <= 0) { them = kk; break; } }
  const beats = { pump: 'hodl', hodl: 'dump', dump: 'pump' };
  $('#cYou').textContent = t('clash_' + k); $('#cYou').className = 'card big ' + k; $('#cThem').textContent = '?'; $('#cThem').className = 'card big flip';
  setTimeout(() => {
    $('#cThem').textContent = t('clash_' + them); $('#cThem').className = 'card big ' + them;
    let msg;
    if (k === them) msg = t('clash_tie'); else if (beats[k] === them) { G.you++; msg = t('clash_round_win'); } else { G.them++; msg = t('clash_round_lose', { s: G.r.name }); }
    $('#cYouS').textContent = G.you; $('#cThemS').textContent = G.them; $('#cBanter').textContent = msg + ' · ' + pick((BANTER[LANG] || BANTER.en)[k === them ? G.r.temper : beats[k] === them ? 'lose' : 'win']);
    G.round++; const m = $('#gMeta'); if (m) m.innerHTML = `<span>${t('g_round', { n: G.round })}</span>`;
    if (G.you >= 3) endGame(true); else if (G.them >= 3) endGame(false, 0, G.r.name);
    G.busy = false;
  }, 700);
}
/* claw */
function clawTry() {
  if (!G || G.busy) return; G.busy = true;
  const items = [...document.querySelectorAll('.pl-item')]; const target = pick(items); const arm = $('#clawArm');
  const idx = items.indexOf(target); arm.style.left = (8 + idx * (84 / Math.max(1, items.length - 1))) + '%'; arm.classList.add('down');
  setTimeout(() => {
    const win = Math.random() < 0.45; arm.classList.remove('down');
    const c = CHAR[target.dataset.ch];
    if (win && c) { target.classList.add('got'); W.plushes.unshift(c.name); if (W.plushes.length > 20) W.plushes.length = 20; store.set('cc_claw2', W.plushes); $('#gResult').innerHTML = `<div class="gres win">${t('claw_win', { s: c.name })}</div>`; $('#clawColl').innerHTML = W.plushes.map(p => `<span class="pill famous">${esc(p)}</span>`).join(''); setTimeout(() => target.classList.remove('got'), 1500); }
    else $('#gResult').innerHTML = `<div class="gres">${t('claw_miss')}</div>`;
    G.busy = false;
  }, 1500);
}
/* fish */
const FISH = [['minnow', 1, 90, '#a9b8ff'], ['puffer', 3, 70, '#c8a96a'], ['goldfish', 5, 55, '#ffd36e'], ['whale', 12, 34, '#bdb8ad'], ['jellyfish', -4, 80, '#ffffff'], ['boot', -2, 75, '#9c988f']];
function newFish() { const f = pick(FISH); G.zone = { x: rand(40, 440 - f[2]), w: f[2], f }; G.speed = Math.min(3.4, G.speed + 0.08); }
function fishHook() { const mx = 20 + (Math.sin(G.marker) * 0.5 + 0.5) * 440; const z = G.zone; if (mx >= z.x && mx <= z.x + z.w) { G.score += z.f[1]; G.flash = z.f[1] > 0 ? 1 : -1; } else { G.score -= 1; G.flash = -1; } newFish(); }
function drawFish(dt) {
  const ctx = G.ctx; G.marker += dt * G.speed * 2.2; G.flash *= Math.max(0, 1 - dt * 3);
  ctx.fillStyle = '#0e1a30'; ctx.fillRect(0, 0, 480, 600); ctx.fillStyle = '#163a66'; ctx.fillRect(0, 300, 480, 300);
  ctx.strokeStyle = 'rgba(214,207,194,.3)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let x = 0; x <= 480; x += 10) ctx.lineTo(x, 320 + i * 44 + Math.sin(x / 30 + G.marker + i) * 5); ctx.stroke(); }
  ctx.fillStyle = '#4a3524'; ctx.fillRect(0, 250, 480, 50); for (let x = 20; x < 480; x += 60) { ctx.fillStyle = '#3a2618'; ctx.fillRect(x, 250, 8, 80); }
  const z = G.zone; ctx.fillStyle = z.f[3]; ctx.globalAlpha = 0.25; ctx.fillRect(z.x, 380, z.w, 120); ctx.globalAlpha = 1; ctx.strokeStyle = z.f[3]; ctx.lineWidth = 3; ctx.strokeRect(z.x, 380, z.w, 120);
  ctx.fillStyle = z.f[3]; ctx.font = "700 18px 'JetBrains Mono', monospace"; ctx.textAlign = 'center'; ctx.fillText(z.f[0] + ' ' + (z.f[1] > 0 ? '+' : '') + z.f[1], z.x + z.w / 2, 370);
  ctx.beginPath(); ctx.ellipse(z.x + z.w / 2, 440, Math.min(40, z.w / 2 - 6), 20, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(z.x + z.w / 2 + Math.min(40, z.w / 2 - 6), 440); ctx.lineTo(z.x + z.w / 2 + Math.min(40, z.w / 2 - 6) + 18, 425); ctx.lineTo(z.x + z.w / 2 + Math.min(40, z.w / 2 - 6) + 18, 455); ctx.fill();
  const mx = 20 + (Math.sin(G.marker) * 0.5 + 0.5) * 440;
  ctx.strokeStyle = '#ece9e2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, 150); ctx.lineTo(mx, 520); ctx.stroke(); ctx.fillStyle = '#c8a96a'; ctx.beginPath(); ctx.arc(mx, 520, 10, 0, 7); ctx.fill();
  ctx.fillStyle = G.flash > 0.05 ? 'rgba(143,211,166,.3)' : G.flash < -0.05 ? 'rgba(217,112,122,.3)' : 'transparent'; ctx.fillRect(0, 0, 480, 600);
  ctx.fillStyle = '#ece9e2'; ctx.font = "700 44px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText(String(G.score), 240, 100);
}
/* coin catcher */
function drawCatch(dt) {
  const ctx = G.ctx;
  if (gkeys.ArrowLeft || gkeys.KeyA) G.tray -= 420 * dt; if (gkeys.ArrowRight || gkeys.KeyD) G.tray += 420 * dt; if (G.px != null) G.tray += (G.px - G.tray) * Math.min(1, dt * 14);
  G.tray = clamp(G.tray, 50, 430);
  G.spawn -= dt; if (G.spawn <= 0) { G.spawn = rand(0.25, 0.55); const r = Math.random(); G.items.push({ x: rand(20, 460), y: -20, v: rand(150, 280), k: r < 0.62 ? 'coin' : r < 0.78 ? 'gem' : 'crate' }); }
  for (const it of G.items) it.y += it.v * dt;
  G.items = G.items.filter(it => { if (it.y > 560 && it.y < 585 && Math.abs(it.x - G.tray) < 56) { if (it.k === 'coin') G.score += 1; else if (it.k === 'gem') G.score += 5; else { G.score = Math.max(0, G.score - 3); G.shake = 0.3; } return false; } return it.y < 640; });
  G.shake = Math.max(0, (G.shake || 0) - dt);
  ctx.save(); if (G.shake > 0) ctx.translate(rand(-6, 6), rand(-6, 6));
  ctx.fillStyle = '#111113'; ctx.fillRect(-10, -10, 500, 620);
  ctx.strokeStyle = 'rgba(189,184,173,.12)'; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, i * 50); ctx.lineTo(480, i * 50); ctx.stroke(); }
  for (const it of G.items) { if (it.k === 'coin') { ctx.fillStyle = '#c8a96a'; ctx.beginPath(); ctx.arc(it.x, it.y, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#b38600'; ctx.font = '700 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('$', it.x, it.y + 5); } else if (it.k === 'gem') { ctx.fillStyle = '#bdb8ad'; ctx.beginPath(); ctx.moveTo(it.x, it.y - 16); ctx.lineTo(it.x + 14, it.y); ctx.lineTo(it.x, it.y + 16); ctx.lineTo(it.x - 14, it.y); ctx.closePath(); ctx.fill(); } else { ctx.fillStyle = '#d9707a'; ctx.fillRect(it.x - 15, it.y - 15, 30, 30); ctx.fillStyle = '#fff'; ctx.font = '700 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('RUG', it.x, it.y + 4); } }
  ctx.fillStyle = '#ffffff'; roundRect(ctx, G.tray - 55, 562, 110, 18, 8); ctx.fill(); ctx.fillStyle = '#ece9e2'; ctx.fillRect(G.tray - 4, 580, 8, 20);
  ctx.restore();
  ctx.fillStyle = '#ece9e2'; ctx.font = "700 44px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText(String(G.score), 240, 70);
}
/* rooftop run */
function drawRun(dt) {
  const ctx = G.ctx;
  G.x += G.speed * dt; G.speed += dt * 6; G.dist = G.x;
  const px = G.x + 100; const seg = G.segs.find(s => px >= s.x && px <= s.x + s.w);
  if (!G.ground || !seg) { G.vy += 1500 * dt; G.y += G.vy * dt; if (seg && G.y >= 0 && G.vy > 0) { G.y = 0; G.vy = 0; G.ground = true; } else G.ground = false; }
  if (G.y > 260) { G.lives--; G.y = 0; G.vy = 0; G.ground = true; const nx = G.segs.find(s => s.x > px); if (nx) G.x = nx.x - 100 + 10; if (G.lives <= 0) { finishCanvasGame(); return; } }
  for (const c of G.coins) if (!c.got && Math.abs(c.x - px) < 22 && Math.abs((180 - c.y) - (180 + G.y - 20)) < 30) { c.got = true; G.score += 2; }
  ctx.fillStyle = '#0c0918'; ctx.fillRect(0, 0, 480, 600);
  ctx.fillStyle = '#0d0d10'; for (let i = 0; i < 8; i++) { const bx = ((i * 140 - G.x * 0.3) % 1120 + 1120) % 1120 - 140; ctx.fillRect(bx, 80 + (i % 3) * 40, 90, 400); }
  ctx.fillStyle = '#ffd27a'; for (let i = 0; i < 30; i++) { const bx = ((i * 73 - G.x * 0.3) % 1120 + 1120) % 1120 - 140; ctx.fillRect(bx + 20, 120 + (i % 7) * 40, 8, 10); }
  const gy = 380;
  for (const s of G.segs) { const sx = s.x - G.x; if (sx + s.w < -10 || sx > 500) continue; ctx.fillStyle = '#2a2150'; ctx.fillRect(sx, gy, s.w, 220); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, gy, s.w, 4); }
  for (const c of G.coins) { if (c.got) continue; const cx = c.x - G.x; if (cx < -10 || cx > 500) continue; ctx.fillStyle = '#c8a96a'; ctx.beginPath(); ctx.arc(cx, gy - c.y, 10, 0, 7); ctx.fill(); }
  const py = gy - 40 + G.y; ctx.fillStyle = '#bdb8ad'; roundRect(ctx, 86, py - 10, 28, 40, 6); ctx.fill(); ctx.fillStyle = '#ece9e2'; ctx.fillRect(96, py - 2, 6, 6);
  ctx.fillStyle = '#ece9e2'; ctx.font = "700 40px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText(String(G.score + Math.floor(G.dist / 60)), 240, 60); ctx.font = "700 14px 'JetBrains Mono', monospace"; ctx.fillText('♥'.repeat(Math.max(0, G.lives)), 240, 86);
}
function finishCanvasGame() {
  if (!G || G.over) return;
  const my = G.id === 'run' ? G.score + Math.floor(G.dist / 60) : G.score;
  const best = G.list.reduce((m, r) => r.score > m.score ? r : m, G.list[0]);
  $('#gYou').textContent = my;
  endGame(my >= best.score, 0, best.name);
}
function gameTick(dt, time) {
  if (!G || G.over || !G.ctx) return;
  G.time -= dt; G.t += dt;
  for (let i = 0; i < G.list.length; i++) { const r = G.list[i]; if (Math.random() < dt * (r.temper === 'agg' ? 1.3 : 0.9) * (G.id === 'fish' ? 0.5 : 1)) r.score += G.id === 'fish' ? pick([1, 3, 5, -1]) : G.id === 'run' ? 2 : pick([1, 1, 5]); const el = $('#gR' + i); if (el) el.textContent = r.score; }
  if (G.id === 'catch') drawCatch(dt); else if (G.id === 'fish') drawFish(dt); else if (G.id === 'run') drawRun(dt);
  const sc = $('#gScore'); if (sc) sc.textContent = G.id === 'run' ? G.score + Math.floor(G.dist / 60) : G.score; const tm = $('#gTime'); if (tm) tm.textContent = Math.max(0, Math.ceil(G.time)); const y = $('#gYou'); if (y) y.textContent = sc ? sc.textContent : G.score;
  if (G.time <= 0) finishCanvasGame();
}

/* test hooks */
window.__cc = { dbg: { THREE, Avatar, animateRig, scene, camera, renderer, composer, booths, agents }, get net() { return NET; }, get perf() { return PERF; }, autoQuality, get AQ() { return AQ; }, PX, OHLC, SOL_PX, STAT, netHandle, onTrade, rebuildFeed, get featured() { return featured; }, get featuredAt() { return featuredAt; }, get bigTex() { return townFx.bigTex; }, drawBigScreen, drawWorldScreens: () => drawWorldScreens(time), get look() { return myLook; }, setLook: l => setLook(l), PHOTO_TEX, get pos() { return player ? [player.obj.position.x, player.obj.position.z, moveTarget && [moveTarget.x, moveTarget.z], !!autoWalk, playing, camMode] : null; }, openBooth, openLaunch, setCine(v) { cineT = v; }, fast(n) { for (let i = 0; i < n; i++) { updateOutside(0.5); } }, get frames() { return frames; }, get cineT() { return cineT; }, get phase() { return introPhase; }, get camMode() { return camMode; }, THUMBS, walkTo, openPlace, startGame, agents, goOutside, PLACES, goSit, nearestFreeBooth, get near() { return near; }, teleport(x, z) { if (player) { player.obj.position.set(x, 0, z); moveTarget = null; autoWalk = null; snapCamera(); } }, get outside() { return outside; }, W, enterCafe, startCine, startSelect, cam, feed };
