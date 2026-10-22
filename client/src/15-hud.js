
/* ================= GAME UI: player plate with level and XP, currencies, minimap, today's tracker, hotbar, the card album =================
   Everything a player does (stories, crates, candles, arcade runs, casino rounds, launches, backing agents) feeds one XP bar,
   so the separate systems read as one game. XP lives in this browser only: it is a progress meter, never money. */
const XP_KEY = 'cc_xp';
const LV_TITLES = [[1, 'lt_1'], [3, 'lt_2'], [5, 'lt_3'], [8, 'lt_4'], [12, 'lt_5'], [18, 'lt_6'], [25, 'lt_7']];
const lvlOf = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1;
const lvlFloor = l => 60 * (l - 1) * (l - 1);
const lvlTitle = l => { let k = 'lt_1'; for (const [n, key] of LV_TITLES) if (l >= n) k = key; return t(k); };
function xpState() {
  let s = store.get(XP_KEY, null);
  if (!s) {   // players from before levels existed get credit for what they already found
    s = { xp: 0 }; try { s.xp = eggsSeen().length * 60 + candlesFound().length * 15; } catch (e) { }
    store.set(XP_KEY, s);
  }
  return s;
}
function gainXP(n, why) {
  n = Math.round(n * (espressoOn() ? 2 : 1)); if (!(n > 0)) return;
  const s = xpState(), before = lvlOf(s.xp); s.xp += n; store.set(XP_KEY, s);
  const after = lvlOf(s.xp);
  guiPop('+' + n + ' XP');
  if (after > before) {
    toast(t('lvl_up', { n: after, t: lvlTitle(after) }), 'gold', true); sfx('level');
    if (player) { confetti(_w.copy(player.obj.position).setY(1.6), 50); player.emote(); }
    const pl = $('#gPlate'); if (pl) { pl.classList.remove('lvlup'); void pl.offsetWidth; pl.classList.add('lvlup'); }
  }
  renderPlate();
}
/* daily tasks: one arcade run, one casino win. Each pays XP once a day. */
function dailyState() { const d = new Date().toISOString().slice(0, 10); let s = store.get('cc_daily', null); if (!s || s.day !== d) { s = { day: d, rk: false, cs: false }; store.set('cc_daily', s); } return s; }
function dailyDone(k) { const s = dailyState(); if (s[k]) return; s[k] = true; store.set('cc_daily', s); toast(t('daily_done', { n: 50 }), 'gold'); gainXP(50, 'daily'); renderTrack(); }

/* ---- sounds: tiny synth blips, no files. Off switch remembered per browser. ---- */
let SFX_ON = store.get('cc_sfx', true), sfxCtx = null;
function sfx(kind) {
  if (!SFX_ON) return;
  try {
    sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)(); const a = sfxCtx; if (a.state === 'suspended') a.resume();
    const seq = { ok: [[660, 0.06], [990, 0.09]], bad: [[220, 0.12], [150, 0.16]], tick: [[880, 0.03]], coin: [[1320, 0.05], [1760, 0.08]], level: [[523, 0.09], [659, 0.09], [784, 0.09], [1046, 0.2]], spin: [[300, 0.02]], win: [[784, 0.08], [988, 0.08], [1318, 0.18]], go: [[440, 0.08], [880, 0.14]], card: [[600, 0.05], [900, 0.05], [1200, 0.12]] }[kind] || [[600, 0.05]];
    let at = a.currentTime;
    for (const [f, d] of seq) {
      const o = a.createOscillator(), g = a.createGain(); o.type = kind === 'bad' ? 'sawtooth' : 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.06, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g); g.connect(a.destination); o.start(at); o.stop(at + d + 0.02); at += d * 0.9;
    }
  } catch (e) { }
}

/* ---- the HUD itself ---- */
const GUI_ICONS = {
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', emote: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1.2 1.6 2.5 2.3 4 2.3s2.8-.7 4-2.3"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>', quests: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  album: '<rect x="3" y="5" width="12" height="16" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>', shop: '<path d="M4 7h16l-1.5 12h-13z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  feed: '<path d="M4 6h16M4 12h16M4 18h10"/>', sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>', mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>', invite: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  launch: '<path d="M12 3c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10z"/><path d="M10 20h4"/>'
};
const gIcon = (k, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GUI_ICONS[k] || ''}</svg>`;
function buildGameUI() {
  if ($('#gPlate')) return;
  const plate = document.createElement('div'); plate.id = 'gPlate'; plate.className = 'g-plate';
  plate.innerHTML = `<button type="button" class="g-port" data-open="char" aria-label="Character"><img id="gPortImg" alt=""><b id="gLv">1</b></button><div class="g-pinfo"><div class="g-name"><span id="gName">PLAYER</span><small id="gTitle"></small></div><div class="g-xp"><i id="gXpBar"></i></div><div class="g-cur"><button type="button" class="g-coin" id="gChips" title="Chips"><i class="coin"></i><b id="gChipsN">0</b></button><button type="button" class="g-coin sol" id="gSol" title="SOL"><i class="sol">◎</i><b id="gSolN">connect</b></button></div></div>`;
  document.body.appendChild(plate);
  const map = document.createElement('div'); map.id = 'gMap'; map.className = 'g-map';
  map.innerHTML = `<canvas id="gMapC" width="400" height="380"></canvas><div class="g-map-f"><span id="gZone"></span><span id="gOnline"></span></div>`;
  document.body.appendChild(map);
  const track = document.createElement('button'); track.type = 'button'; track.id = 'gTrack'; track.className = 'g-track'; track.dataset.place = 'quest';
  document.body.appendChild(track);
  const hud = $('.hud');
  if (hud && !$('#gHot')) {
    const hot = document.createElement('div'); hot.id = 'gHot'; hot.className = 'g-hot';
    hot.innerHTML = [['emote', 'F', 'gui_emote'], ['map', 'M', 'gui_map'], ['quests', 'Q', 'gui_quests'], ['album', 'J', 'gui_album'], ['shop', 'B', 'gui_shop'], ['launch', 'L', 'launch'], ['feed', 'T', 'tab_feed'], ['invite', 'I', 'gui_invite']].map(([k, key, lab]) => `<button type="button" class="g-hb" data-hot="${k}" title="${esc(t(lab))}">${gIcon(k)}<span>${t(lab)}</span><kbd>${key}</kbd></button>`).join('') + `<button type="button" class="g-hb snd${MUS.on ? '' : ' off'}" data-hot="music" title="${esc(t(MUS.on ? 'gui_music_on' : 'gui_music_off'))} (N)">${gIcon('music')}</button><button type="button" class="g-hb snd" data-hot="sound" title="Sound">${gIcon(SFX_ON ? 'sound' : 'mute')}</button>`;
    hud.appendChild(hot);
    const eb = $('#emoteBtn'); if (eb) eb.hidden = true;
  }
  const nav = $('#navMenu'); if (nav && !nav.querySelector('.nav-touch')) nav.insertAdjacentHTML('afterbegin', `<button type="button" class="nav-touch" data-hot="quests">${t('gui_quests')}</button><button type="button" class="nav-touch" data-hot="album">${t('gui_album')}</button><button type="button" class="nav-touch" data-hot="invite">${t('gui_invite')}</button><button type="button" class="nav-touch" data-hot="music">${t('gui_music')}</button>`);
  document.body.classList.add('gui');
  $('#gChips').addEventListener('click', () => { if (playing) openBank(); });
  $('#gSol').addEventListener('click', () => { const w = $('#walletChip'); if (w) w.click(); });
  map.addEventListener('click', ev => guiMapClick(ev));
  map.addEventListener('dblclick', () => map.classList.toggle('big'));
  renderPlate(); renderTrack();
}
function guiHot(k) {
  if (!playing) return;
  if (k === 'emote') { if (player) { player.emote(); netSend({ t: 'emote' }); } return; }
  if (k === 'map') { $('#gMap').classList.toggle('big'); return; }
  if (k === 'quests') { openPlace('quest'); return; }
  if (k === 'album') { openAlbum(); return; }
  if (k === 'shop') { openShop(); return; }
  if (k === 'launch') { if (player) goSit(nearestFreeBooth()); else openLaunch(); return; }
  if (k === 'feed') { $('#side').classList.toggle('open'); return; }
  if (k === 'invite') { openInvite(); return; }
  if (k === 'music') { musToggle(); return; }
  if (k === 'sound') { SFX_ON = !SFX_ON; store.set('cc_sfx', SFX_ON); const b = document.querySelector('[data-hot="sound"]'); if (b) b.innerHTML = gIcon(SFX_ON ? 'sound' : 'mute'); if (SFX_ON) sfx('coin'); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-hot]'); if (b) { guiHot(b.dataset.hot); b.blur(); } });
addEventListener('keydown', e => {
  if (!playing || isTyping() || modalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { KeyM: 'map', KeyQ: 'quests', KeyJ: 'album', KeyB: 'shop', KeyL: 'launch', KeyT: 'feed', KeyI: 'invite', KeyN: 'music' }[e.code];
  if (map) { e.preventDefault(); guiHot(map); }
});
function renderPlate() {
  if (!$('#gPlate')) return;
  const s = xpState(), l = lvlOf(s.xp), lo = lvlFloor(l), hi = lvlFloor(l + 1);
  $('#gLv').textContent = l; $('#gTitle').textContent = lvlTitle(l) + (espressoOn() ? ' · ☕ 2× XP' : '');
  $('#gName').textContent = myName();
  $('#gXpBar').style.width = Math.max(3, Math.min(100, (s.xp - lo) / (hi - lo) * 100)) + '%';
  $('#gXpBar').parentElement.title = t('gui_xp', { n: hi - s.xp });
  const img = $('#gPortImg'), src = TH(charChoice); if (img.getAttribute('src') !== src) img.src = src;
  $('#gChipsN').textContent = fmtChips(myChips());
  $('#gSolN').textContent = NET.wallet ? (NET.solBal != null ? NET.solBal.toFixed(3) : '…') : t('gui_connect');
  $('#gSol').classList.toggle('off', !NET.wallet);
}
function renderTrack() {
  const el = $('#gTrack'); if (!el) return;
  const ds = dailyState(), stories = eggsSeen().length, cand = candlesFound().length;
  const crates = huntOn() ? `${HS.claimed.length}/${HUNT_LIVE.length}` : '';
  const row = (done, txt, val) => `<li class="${done ? 'done' : ''}"><i></i><span>${txt}</span>${val ? `<b>${val}</b>` : ''}</li>`;
  el.innerHTML = `<div class="g-track-h"><span>${t('gui_track')}</span><kbd>Q</kbd></div><ul>
    ${row(huntOn() && HS.claimed.length >= HUNT_LIVE.length, t('tr_crates'), crates || `<em>${t('tr_signin')}</em>`)}
    ${row(ds.dr, t('tr_bar'), ds.dr ? '✓' : '+25')}
    ${row(ds.rk, t('tr_arcade'), ds.rk ? '✓' : '+50')}
    ${row(ds.cs, t('tr_casino'), ds.cs ? '✓' : '+50')}
    ${row(stories >= EGGS.length, t('tr_stories'), `${stories}/${EGGS.length}`)}
    ${row(cand >= CANDLE_SPOTS.length, t('tr_candles'), `${cand}/${CANDLE_SPOTS.length}`)}</ul>`;
}
let guiPopT = 0;
function guiPop(txt) {
  const pl = $('#gPlate'); if (!pl) return;
  const p = document.createElement('div'); p.className = 'g-xppop'; p.textContent = txt; pl.appendChild(p);
  setTimeout(() => p.remove(), 1500);
}

/* ---- minimap: a static layer (rooms, buildings, places) drawn once, then the player, other players and today's crates ---- */
const MAP_B = { x0: -49, x1: 49, z0: -19, z1: 73 };
let mapBase = null;
function mapXY(x, z, W, H) { return [(x - MAP_B.x0) / (MAP_B.x1 - MAP_B.x0) * W, (z - MAP_B.z0) / (MAP_B.z1 - MAP_B.z0) * H]; }
function buildMapBase(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#0b0b0d'; x.fillRect(0, 0, W, H);
  // town ground with a faint grid
  let [a, b] = mapXY(-TOWN.x, TOWN.zb, W, H), [a2, b2] = mapXY(TOWN.x, TOWN.zf, W, H);
  x.fillStyle = '#16161a'; x.fillRect(a, b, a2 - a, b2 - b);
  x.strokeStyle = 'rgba(236,233,226,.04)'; x.lineWidth = 1; for (let gx = -40; gx <= 40; gx += 10) { const [p] = mapXY(gx, 0, W, H); x.beginPath(); x.moveTo(p, b); x.lineTo(p, b2); x.stroke(); } for (let gz = 25; gz <= 70; gz += 10) { const [, q] = mapXY(0, gz, W, H); x.beginPath(); x.moveTo(a, q); x.lineTo(a2, q); x.stroke(); }
  // the cafe
  [a, b] = mapXY(-ROOM.x, ROOM.zb, W, H); [a2, b2] = mapXY(ROOM.x, ROOM.zf, W, H);
  x.fillStyle = '#1d1a14'; x.fillRect(a, b, a2 - a, b2 - b); x.strokeStyle = 'rgba(233,200,115,.55)'; x.lineWidth = 2; x.strokeRect(a, b, a2 - a, b2 - b);
  // buildings and big furniture
  for (const k of colliders) { const area = (k.maxx - k.minx) * (k.maxz - k.minz); if (area < 2.2) continue; const [p, q] = mapXY(k.minx, k.minz, W, H), [p2, q2] = mapXY(k.maxx, k.maxz, W, H); x.fillStyle = k.minz > ROOM.zf ? '#2a2a30' : '#2b261c'; x.fillRect(p, q, Math.max(1, p2 - p), Math.max(1, q2 - q)); }
  // the pond
  const [px, pz] = mapXY(-38, 66, W, H); x.fillStyle = 'rgba(70,120,160,.45)'; x.beginPath(); x.ellipse(px, pz, 14, 9, 0, 0, 7); x.fill();
  return c;
}
const MAP_PLACES = ['casino', 'arcade', 'launchpad', 'market', 'quest', 'well', 'xtower', 'billboard', 'vault', 'studio', 'nest', 'docks', 'pond', 'gym', 'sushi'];
const MAP_COL = { casino: '#e9c873', arcade: '#b98cff', launchpad: '#8fd3a6', market: '#6fb3ff', quest: '#e9c873' };
let mapHit = [], mapAt = 0;
function drawMinimap(time) {
  const c = $('#gMapC'); if (!c || !player) return;
  const now = performance.now(); if (now - mapAt < 120) return; mapAt = now;
  const W = c.width, H = c.height, x = c.getContext('2d');
  if (!mapBase || mapBase.width !== W) mapBase = buildMapBase(W, H);
  x.drawImage(mapBase, 0, 0); mapHit = [];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const id of MAP_PLACES) {
    const pl = PLACES[id]; if (!pl) continue; const [p, q] = mapXY(pl.x, pl.z, W, H), col = MAP_COL[id] || '#bdb8ad';
    x.fillStyle = col; x.beginPath(); x.arc(p, q, MAP_COL[id] ? 7 : 5, 0, 7); x.fill(); x.strokeStyle = '#0b0b0d'; x.lineWidth = 2; x.stroke();
    const big = $('#gMap').classList.contains('big'); if (big || MAP_COL[id]) { x.font = (big ? '700 13px' : '800 19px') + ' "JetBrains Mono", monospace'; x.lineWidth = 4; x.strokeStyle = 'rgba(11,11,13,.85)'; const lab = big ? t('pl_' + id).toUpperCase().slice(0, 14) : t('mp_' + id); x.strokeText(lab, p, q - 14); x.fillStyle = big ? 'rgba(236,233,226,.9)' : col; x.fillText(lab, p, q - 14); }
    mapHit.push({ id, p, q });
  }
  for (const k of HUNT_LIVE) { if (k.claimed || !k.g.visible) continue; const [p, q] = mapXY(k.x, k.z, W, H), s = 6 + Math.sin(time * 4) * 1.5; x.fillStyle = '#f1dca4'; x.fillRect(p - s / 2, q - s / 2, s, s); x.strokeStyle = '#0b0b0d'; x.lineWidth = 1.5; x.strokeRect(p - s / 2, q - s / 2, s, s); }
  x.fillStyle = 'rgba(111,179,255,.9)';
  for (const r of NET.remote.values()) { const o = r.av.obj.position, [p, q] = mapXY(o.x, o.z, W, H); x.beginPath(); x.arc(p, q, 3.2, 0, 7); x.fill(); }
  const o = player.obj.position, [p, q] = mapXY(o.x, o.z, W, H), ry = player.obj.rotation.y, dx = Math.sin(ry), dz = Math.cos(ry);
  x.save(); x.translate(p, q); x.rotate(Math.atan2(dz, dx) - Math.PI / 2);
  x.fillStyle = 'rgba(233,200,115,.18)'; x.beginPath(); x.arc(0, 0, 18 + Math.sin(time * 3) * 2, 0, 7); x.fill();
  x.fillStyle = '#ffffff'; x.strokeStyle = '#0b0b0d'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, 12); x.lineTo(8, -7); x.lineTo(0, -3); x.lineTo(-8, -7); x.closePath(); x.stroke(); x.fill();
  x.restore();
  const z = $('#gZone'); if (z) z.textContent = isInside(o) ? 'TRENCH CAFE' : 'TOWN';
  const on = $('#gOnline'); if (on) on.innerHTML = `<i></i>${t('gui_online', { n: NET.remote.size + 1 })}`;
}
function guiMapClick(ev) {
  const c = $('#gMapC'), r = c.getBoundingClientRect(), sx = (ev.clientX - r.left) / r.width * c.width, sy = (ev.clientY - r.top) / r.height * c.height;
  let best = null, bd = 26; for (const h of mapHit) { const d = Math.hypot(h.p - sx, h.q - sy); if (d < bd) { bd = d; best = h; } }
  if (best) walkTo(best.id);
}
let guiAt = 0;
function guiTick(time) {
  if (!playing) return;
  if (!$('#gPlate')) buildGameUI();
  drawMinimap(time);
  if (time - guiAt > 1.5) { guiAt = time; renderPlate(); renderTrack(); }
}

/* ================= the card album: every Solana story is a collectible card with its own picture ================= */
const eggRarity = e => eggArt(e)[0];
const CARD_CACHE = new Map();
function eggCardURL(i) {
  if (CARD_CACHE.has(i)) return CARD_CACHE.get(i);
  const e = EGGS[i]; if (!e) return '';
  const [rar, c1, c2, main, side, stamp, cname] = eggArt(e), rc = RARITY[rar];
  const W = 360, H = 504, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
  // frame
  let g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, rc); g.addColorStop(0.5, '#151515'); g.addColorStop(1, rc);
  x.fillStyle = g; rr(0, 0, W, H, 22); x.fill();
  x.fillStyle = '#0b0b0d'; rr(8, 8, W - 16, H - 16, 16); x.fill();
  // art window
  const ax = 18, ay = 50, aw = W - 36, ah = 268;
  x.save(); rr(ax, ay, aw, ah, 12); x.clip();
  g = x.createLinearGradient(0, ay, 0, ay + ah); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(ax, ay, aw, ah);
  // sunburst
  x.globalAlpha = 0.12; x.fillStyle = '#ffffff'; const cx = W / 2, cy = ay + ah * 0.52;
  for (let k = 0; k < 18; k++) { const a0 = k / 18 * Math.PI * 2; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 420, a0, a0 + Math.PI / 36); x.fill(); }
  x.globalAlpha = 1;
  // halftone dots
  x.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = ay; yy < ay + ah; yy += 10) for (let xx = ax + ((yy / 10) % 2) * 5; xx < ax + aw; xx += 10) { x.beginPath(); x.arc(xx, yy, 1.6, 0, 7); x.fill(); }
  // ground glow
  g = x.createRadialGradient(cx, cy + 40, 10, cx, cy + 40, 170); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(ax, ay, aw, ah);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const emo = s => `${s}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  const pos = [[0.2, 0.25, 54, -0.2], [0.82, 0.3, 50, 0.25], [0.8, 0.8, 44, 0.1], [0.17, 0.78, 40, -0.15]];
  side.forEach((s, k) => { const [px, py, sz, rot] = pos[k % pos.length]; x.save(); x.translate(ax + aw * px, ay + ah * py); x.rotate(rot); x.font = emo(sz); x.globalAlpha = 0.9; x.fillText(s, 0, 0); x.restore(); });
  x.globalAlpha = 1; x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 24; x.shadowOffsetY = 10; x.font = emo(132); x.fillText(main, cx, cy); x.shadowColor = 'transparent';
  // stamp
  if (stamp) { x.save(); x.font = '900 22px Unbounded, Arial Black, sans-serif'; const w = Math.min(190, x.measureText(stamp).width + 22); x.translate(ax + aw - w / 2 - 16, ay + ah - 34); x.rotate(-0.08); x.fillStyle = 'rgba(11,11,13,.82)'; rr(-w / 2, -18, w, 36, 8); x.fill(); x.strokeStyle = rc; x.lineWidth = 2; x.stroke(); x.fillStyle = '#ffffff'; x.fillText(stamp, 0, 1, 170); x.restore(); }
  x.restore();
  // header: number + rarity
  x.textAlign = 'left'; x.font = '700 15px "JetBrains Mono", monospace'; x.fillStyle = 'rgba(236,233,226,.7)'; x.fillText('#' + String(i + 1).padStart(2, '0') + ' / ' + EGGS.length, 22, 30);
  x.textAlign = 'right'; x.fillStyle = rc; x.fillText(t('r_' + rar).toUpperCase() + ' ◆', W - 22, 30);
  // title + date
  const date = (e.text.match(/^([^:]{3,40}):/) || [])[1] || '';
  x.textAlign = 'left'; x.fillStyle = '#ffffff';
  const title = cname || (e.title.length > 40 ? e.title.slice(0, 38) + '…' : e.title);
  let fs = 30; x.font = `800 ${fs}px Unbounded, Arial Black, sans-serif`; while (x.measureText(title).width > W - 44 && fs > 15) { fs--; x.font = `800 ${fs}px Unbounded, Arial Black, sans-serif`; }
  x.fillText(title, 22, 352);
  x.font = '700 14px "JetBrains Mono", monospace'; x.fillStyle = rc; x.fillText(date.toUpperCase(), 22, 384);
  // a short first line of the story
  const body = (date ? e.text.slice(date.length + 1) : e.text).trim();
  x.font = '500 14px Onest, Arial, sans-serif'; x.fillStyle = 'rgba(236,233,226,.78)';
  const words = body.split(' '); let line = '', y = 414, n = 0;
  for (const w of words) { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > W - 44) { x.fillText(line, 22, y); line = w; y += 20; if (++n >= 3) { line = ''; break; } } else line = test; }
  if (line && n < 3) x.fillText(line, 22, y); else if (n >= 3) { x.fillText('…', 22, y); }
  // foil sheen for legendary
  if (rar === 'legendary') { g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,240,200,.12)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); x.fillStyle = g; rr(8, 8, W - 16, H - 16, 16); x.fill(); }
  const url = c.toDataURL('image/jpeg', 0.88); CARD_CACHE.set(i, url); return url;
}
function openAlbum() {
  let m = $('#mAlbum');
  if (!m) { m = document.createElement('div'); m.className = 'modal'; m.id = 'mAlbum'; m.hidden = true; m.innerHTML = '<div class="sheet album" role="dialog" aria-modal="true"><button type="button" class="xclose" data-close aria-label="Close">×</button><div id="albumBody"></div></div>'; document.body.appendChild(m); }
  const seen = eggsSeen(), by = { common: 0, rare: 0, epic: 0, legendary: 0 }, tot = { common: 0, rare: 0, epic: 0, legendary: 0 };
  EGGS.forEach((e, i) => { const r = eggRarity(e); tot[r]++; if (seen.includes(i)) by[r]++; });
  $('#albumBody').innerHTML = `<div class="al-head"><div><span class="g-eyebrow">${t('al_eyebrow')}</span><h3>${t('al_title')}</h3><p class="sub">${t('al_sub', { n: seen.length, of: EGGS.length })}</p></div>
    <div class="al-rar">${Object.keys(RARITY).map(r => `<span style="--rc:${RARITY[r]}"><i></i>${t('r_' + r)} <b>${by[r]}/${tot[r]}</b></span>`).join('')}</div></div>
    <div class="al-bar"><i style="width:${Math.round(seen.length / Math.max(1, EGGS.length) * 100)}%"></i></div>
    <div class="al-grid">${EGGS.map((e, i) => seen.includes(i)
      ? `<button type="button" class="al-card" data-card="${i}" style="--rc:${RARITY[eggRarity(e)]}"><img src="${eggCardURL(i)}" alt="${esc(e.title)}" loading="lazy"></button>`
      : `<div class="al-card locked"><b>#${String(i + 1).padStart(2, '0')}</b><span>?</span><small>${esc(e.hint || t('al_locked'))}</small></div>`).join('')}</div>`;
  showModal('mAlbum');
}
document.addEventListener('click', e => { const c = e.target.closest('[data-card]'); if (c) openEgg(+c.dataset.card); });

/* ---- the character screen as a game lobby: tabs for the editor, rarity, a big PLAY button ---- */
let edTab = store.get('cc_edtab', 'look');
function selRarity(c) { if (c.kind === 'custom') return 'epic'; const s = (c.stats || [0, 0, 0]).reduce((a, b) => a + b, 0); return s >= 12 ? 'legendary' : s >= 10 ? 'epic' : s >= 8 ? 'rare' : 'common'; }
function edTabsHTML(full) {
  const tabs = full ? ['look', 'face', 'emote', 'say'] : ['face', 'emote', 'say'];
  if (!tabs.includes(edTab)) edTab = tabs[0];
  return `<div class="ed-tabs" role="tablist">${tabs.map(k => `<button type="button" role="tab" data-edtab="${k}" aria-selected="${k === edTab}">${t('sel_tab_' + k)}</button>`).join('')}</div>`;
}
const ED_TAB_OF = k => k === 'photo' ? 'face' : k === 'emote' ? 'emote' : k === 'say' ? 'say' : 'look';
document.addEventListener('click', e => { const b = e.target.closest('[data-edtab]'); if (!b) return; edTab = b.dataset.edtab; store.set('cc_edtab', edTab); const c = PLAYABLE[selIdx]; if (c) renderEditor(c); });

function guiI18nRefresh() { document.querySelectorAll('.nav-touch').forEach(b => b.remove()); const h = $('#gHot'); if (h) { h.remove(); const eb = $('#emoteBtn'); if (eb) eb.hidden = false; } if ($('#gPlate')) { $('#gPlate').remove(); $('#gMap').remove(); $('#gTrack').remove(); } if (playing) buildGameUI(); }
Object.assign(window.__cc, { gainXP, xpState, lvlOf, openAlbum, eggCardURL, eggArt, renderTrack, renderPlate, dailyState, sfx, guiHot, EGG_ART });
/* a burst of gold coins in screen space, for big wins and S grades */
function bigWinBurst(x, y) {
  for (let i = 0; i < 26; i++) {
    const c = document.createElement('i'); c.className = 'g-coinfx'; const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 160;
    c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.setProperty('--dx', Math.cos(a) * d + 'px'); c.style.setProperty('--dy', Math.sin(a) * d - 60 + 'px'); c.style.animationDelay = Math.random() * 0.15 + 's';
    document.body.appendChild(c); setTimeout(() => c.remove(), 1400);
  }
}
