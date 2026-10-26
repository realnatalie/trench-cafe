
/* ================= thumbnails ================= */
function fillThumbs() { document.querySelectorAll('img[data-th]').forEach(im => { const u = THUMBS[im.dataset.th]; if (u && im.getAttribute('src') !== u) im.src = u; }); }
function renderThumbs(onProgress) {
  return new Promise(resolve => {
    const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    tr.setPixelRatio(1); tr.setSize(256, 256); tr.toneMapping = THREE.ACESFilmicToneMapping;
    const ts = new THREE.Scene();
    { const pm = new PMREMGenerator(tr); ts.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; ts.environmentIntensity = 0.4; pm.dispose(); }
    ts.add(new THREE.HemisphereLight(0xe4ded4, 0x1e1c1a, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(2, 3, 4); ts.add(dl);
    const rim = new THREE.DirectionalLight(0xe6dccb, 0.8); rim.position.set(-3, 2, -2); ts.add(rim);
    const tc = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const box = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
    const list = [...CHARS]; let i = 0;
    const one = c => {
      const o = buildChar(c.id); const g = new THREE.Group(); g.add(o);
      if (c.companion) { const cg = makeCorgi(); cg.position.set(0.55, 0, 0.2); cg.rotation.y = -0.6; g.add(cg); }
      g.rotation.y = 0.38; ts.add(g); g.updateMatrixWorld(true);
      box.setFromObject(g); box.getSize(size); box.getCenter(ctr);
      const d = Math.max(size.y, size.x * 1.05) * 2.25 + 0.4;
      tc.position.set(ctr.x, ctr.y + size.y * 0.06, ctr.z + d); tc.lookAt(ctr);
      tr.render(ts, tc); THUMBS[c.id] = tr.domElement.toDataURL('image/png');
      const im = new Image(); im.src = THUMBS[c.id]; THUMB_IMG[c.id] = im;
      ts.remove(g);
    };
    const step = () => {
      const t0 = performance.now();
      try { while (i < list.length && (performance.now() - t0 < 24 || i === 0)) one(list[i++]); } catch (e) { console.warn('thumb failed', e); i++; }
      if (onProgress) onProgress(i, list.length);
      if (i < list.length) setTimeout(step, 0);
      else { tr.dispose(); try { tr.forceContextLoss(); } catch (e) { } resolve(); }
    };
    step();
  });
}

/* ================= i18n apply ================= */
function applyI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
  document.querySelectorAll('[data-ip]').forEach(el => { el.placeholder = t(el.dataset.ip); });
  if (TOUCH) { $('#hints').textContent = t('hints_touch'); $('#chatInput').placeholder = t('chat_ph').replace(/\s*[(（][^)）]*[)）]\s*$/, ''); }
  $('#langBtn').textContent = LANG_NAMES[LANG] || LANG.toUpperCase(); $('#landLang').value = LANG; if (!$('#land').hidden) renderLand();
  if (player) { const y = player.tag.querySelector('.you'); if (y) y.textContent = t('you'); }
  agents.forEach(updateAgentTag); booths.forEach(drawScreen); drawWalletChip(); drawWorldScreens(0);
  feedDirty = true; renderSide(true); renderSelect();
  if (!$('#mHow').hidden) openHow();
  if (!$('#mBooth').hidden && openAgent) openBooth(openAgent);
  if (!$('#mLaunch').hidden) openLaunch(true);
  if (!$('#mPlace').hidden && openPlaceId) openPlace(openPlaceId);
  near = null;
}
$('#langBtn').addEventListener('click', () => { setLang(LANGS[(LANGS.indexOf(LANG) + 1) % LANGS.length]); });

/* ================= intro: boot → cinematic → select → enter ================= */
let introPhase = 'boot', cineT = 0, cineSkip = false;
const CINE = [
  { t: 0, p: [0, 17, 76], l: [0, 6, 30] }, { t: 3.6, p: [0, 4.2, 31], l: [0, 5.5, 17.5] }, { t: 5.4, p: [0, 2.2, 21.5], l: [0, 2, 8] },
  { t: 6.6, p: [0, 2.3, 14], l: [0, 1.5, -6] }, { t: 10, p: [-6.5, 2.4, -2], l: [5, 1.2, -12] }, { t: 12.4, p: [8, 4.5, 7], l: [0, 1.6, -6] }, { t: 13.2, p: [8, 4.5, 7], l: [0, 1.6, -6] }
];
/* ---- landing: blurred blobs, emblem, member pass ---- */
let landRAF = 0, landPtr = { x: 0.5, y: 0.5 };
const BLOBS = [{ x: .12, y: .22, r: .34, c: [40, 78, 220], s: .9 }, { x: .88, y: .78, r: .42, c: [48, 92, 255], s: 1.1 }, { x: .72, y: .18, r: .26, c: [106, 43, 217], s: .8 }, { x: .3, y: .86, r: .3, c: [255, 79, 163], s: .45 }, { x: .55, y: .5, r: .22, c: [67, 232, 255], s: .25 }];
function landFrame() { }   // the landing is a flat matte page now: no animated background
const LAND3D = HQ;          // desktop: the live cafe slowly turns behind the landing text
if (LAND3D) document.documentElement.classList.add('land3d');
const TICKER = ['gm', 'wagmi', 'ngmi', 'few understand', 'ser, the chart', 'bonding curve go brrr', 'wen graduate', '2 SOL and a dream', 'probably nothing', 'jeets out, chads in', 'not a bear market, a trench', 'the candle is green, the vibes are green', 'rugged? no, we are early', 'diamond paws', 'touch grass? never heard of her', 'up only (for now)', 'buy the dip, sell the rip', 'trust me bro', 'this is financial advice from a hippo', 'still holding since the mint', 'gn is for quitters'];
function tickerHTML() { const one = TICKER.map((x, i) => i % 5 === 3 ? `<b>${esc(x)}</b>` : i % 7 === 2 ? `<em>${esc(x)}</em>` : i % 4 === 1 ? `<u>${esc(x)}</u>` : esc(x)).join('<span class="dot"> · </span>'); return one + '<span class="dot"> · </span>' + one + '<span class="dot"> · </span>'; }
const MEMES = [['degen', 'meme_degen'], ['chad', 'meme_chad'], ['ceo', 'meme_ceo'], ['ninja', 'meme_ninja'], ['wizard', 'meme_wizard'], ['zombo', 'meme_zombo'], ['kitty', 'meme_kitty'], ['midas', 'meme_midas'], ['sniper', 'meme_sniper'], ['whaleboy', 'meme_whaleboy'], ['cultist', 'meme_cultist'], ['grandma', 'meme_grandma'], ['queen', 'meme_queen']];
const inv = s => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
function renderLand() {
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };   // the landing is one screen now: sections that are not on the page are simply skipped
  if ($('#landWhat')) set('landWhat', t('land_what').map(([h, p], i) => `<article class="rvl" style="transition-delay:${i * 80}ms"><small class="land-chip">0${i + 1}</small><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join(''));
  const vb = $('#vipBtn'); if (vb) { const fee = NET.cfg.vipFee || 0.5; vb.textContent = NET.vip ? t('vip_have') : t('vip_buy', { n: fee }); vb.disabled = !!NET.vip; }
  const vt = $('#vipTokBtn'); if (vt) { vt.hidden = !(NET.cfg.payToken && !NET.vip); if (!vt.hidden) vt.textContent = t('vip_buy_tok'); }
  const tk = $('#landTick'); if (tk && !tk.innerHTML) tk.innerHTML = tickerHTML();
  landObserve();
}
let landIO = null;
function landObserve() {
  if (landIO) landIO.disconnect();
  landIO = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); landIO.unobserve(x.target); } }), { root: $('#land'), threshold: 0.05 });
  document.querySelectorAll('#land .rvl').forEach(el => landIO.observe(el));
  landReveal();
}
function landReveal() { const H = innerHeight; document.querySelectorAll('#land .rvl:not(.in)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < H + 40 && r.bottom > -40) el.classList.add('in'); }); }
$('#land').addEventListener('scroll', landReveal, { passive: true });
function landLive() {
  if ($('#land').hidden) return;
  const live = !!(NET.http && NET.ready), n = NET.online || 1;
  const ln = $('#landN'); if (ln) ln.textContent = n; const ln2 = $('#landN2'); if (ln2) ln2.textContent = n;
  const lo = $('#landOnline'); if (lo) lo.hidden = true;
  const lb = $('#landBoard'); if (lb) { lb.hidden = !live; if (live) { $('#lbCoins').textContent = agents.length; $('#lbGrad').textContent = agents.filter(a => a.bonded).length; $('#lbTrades').textContent = STAT.trades || 0; } }
}
setInterval(landLive, 2000);
function runLand() {
  document.documentElement.classList.remove('boot');
  $('#landEmb').innerHTML = emblemSVG({ ring: true }); { const e2 = $('#landEmb2'); if (e2) e2.innerHTML = emblemSVG({ ring: false }); } $('#passEmb').innerHTML = emblemSVG({ ring: false }); const bi = $('.brand i.emb'); if (bi) bi.innerHTML = emblemSVG({ fg: '#000000', acc: '#ffffff', ring: false });
  renderLand(); landLive();
  let fav = document.querySelector('link[rel="icon"]'); if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); } fav.type = 'image/svg+xml'; fav.href = EMBLEM_URI({ bg: '#000', acc: '#ffffff' });
  $('#landNick').value = myNick; drawLoginState(); restoreSession(); const hn = document.querySelector('.sel-walk .note'); if (hn) hn.hidden = !!NET.http;
  $('#skipBtn').hidden = true;
  netConnect();
}
$('#land').addEventListener('pointermove', e => { landPtr.x = e.clientX / innerWidth; landPtr.y = e.clientY / innerHeight; });
$('#landNick').addEventListener('keydown', e => e.stopPropagation());
$('#landNick').addEventListener('input', e => { myNick = e.target.value.replace(/[^\w\-\u0400-\u04FF .]/g, '').slice(0, 16); store.set('cc_nick', myNick); $('#nickIn').value = myNick; });
$('#land').addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { const el = document.getElementById(g.dataset.go); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const b = e.target.closest('[data-land]'); if (!b) return;
  if (b.dataset.land === 'how') openHow(); else if (b.dataset.land === 'watch') landToSelect();
  else if (b.dataset.land === 'enter') { $('#land').scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => { if (myNick) $('#landForm').requestSubmit(); else $('#landNick').focus(); }, 500); }
});
$('#landLang').addEventListener('change', ev => setLang(ev.target.value));
function setLang(l) { if (!LANGS.includes(l)) l = 'en'; LANG = l; store.set('cc_lang', LANG); applyI18n(); guiI18nRefresh(); CARD_CACHE.clear(); }
function landToSelect() { if (introPhase !== 'boot') return; $('#fade').classList.add('on'); setTimeout(() => { $('#land').hidden = true; cancelAnimationFrame(landRAF); introPhase = 'cine'; startSelect(); }, 450); }
let passNo = store.get('cc_passno', 0); if (!passNo) { passNo = 100000 + Math.floor(Math.random() * 899999); store.set('cc_passno', passNo); }
$('#landForm').addEventListener('submit', e => {
  e.preventDefault(); if (introPhase !== 'boot') return;
  const n = (myNick || 'PLAYER').toUpperCase();
  $('#passName').textContent = n; requestAnimationFrame(() => { const el = $('#passName'); if (!el) return; el.style.fontSize = ''; let fs = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth + 1 && fs > 18) { fs -= 2; el.style.fontSize = fs + 'px'; } }); $('#passNo').textContent = '#' + passNo; $('#passTier').textContent = NET.vip ? t('pass_tier_vip') : NET.loggedIn ? t('pass_tier_v') : t('pass_tier_guest'); $('#passWallet').textContent = NET.loggedIn && NET.wallet ? shortAddr(NET.wallet) : '—'; const ps = $('#passStamp'); ps.textContent = NET.loggedIn ? t('pass_verified') : t('pass_guest'); ps.classList.toggle('guest', !NET.loggedIn); const d = new Date(); $('#passDate').textContent = String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  $('#landPass').hidden = false; $('#passWrap').classList.remove('punch'); $('#passSlot').classList.remove('hot'); $('#passGranted').classList.remove('show');
  const card = $('#passCard'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
});
$('#passBack').addEventListener('click', () => { $('#landPass').hidden = true; });
$('#landConnect').addEventListener('click', async () => { if (NET.loggedIn) return; const b = $('#landConnect'); b.disabled = true; try { await walletLogin(); toast(t('land_signed_ok'), 'gold'); } catch (e) { toast(String(e.message || e).slice(0, 90)); } b.disabled = false; drawLoginState(); });
{ const wrap = $('#passWrap'), card = $('#passCard'); let down = false;
  const tilt = (x, y) => { const r = wrap.getBoundingClientRect(); const dx = (x - r.left) / r.width - 0.5, dy = (y - r.top) / r.height - 0.5; card.style.transform = `rotateY(${dx * 26}deg) rotateX(${-dy * 22}deg)`; card.style.setProperty('--sx', (dx * 120) + '%'); };
  wrap.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || down) tilt(e.clientX, e.clientY); });
  wrap.addEventListener('pointerdown', e => { down = true; tilt(e.clientX, e.clientY); }); addEventListener('pointerup', () => { down = false; });
  wrap.addEventListener('pointerleave', () => { if (!down) card.style.transform = ''; }); }
let punching = false;
function punchIn() {
  if (punching || introPhase !== 'boot') return; punching = true;
  $('#passCard').style.transform = ''; $('#passSlot').classList.add('hot'); $('#passWrap').classList.add('punch');
  setTimeout(() => $('#passGranted').classList.add('show'), 650);
  setTimeout(() => $('#fade').classList.add('on'), 1500);
  setTimeout(() => { punching = false; $('#land').hidden = true; cancelAnimationFrame(landRAF); introPhase = 'cine'; startSelect(); }, 1900);
}
$('#passPunch').addEventListener('click', punchIn);
$('#vipTokBtn').addEventListener('click', async () => { const b = $('#vipTokBtn'); if (NET.vip) return; b.disabled = true; try { await buyItem('vip', 'token'); toast(t('vip_done'), 'gold'); renderLand(); drawLoginState(); } catch (err) { toast(String(err.message || err).slice(0, 140)); } b.disabled = false; });
$('#vipBtn').addEventListener('click', async () => { const b = $('#vipBtn'); if (NET.vip) return; b.disabled = true; try { await buyVip(); b.textContent = t('vip_have'); toast(t('vip_done'), 'gold'); } catch (e) { toast(t('vip_fail', { e: String(e.message || e).slice(0, 80) })); b.disabled = false; } });
addEventListener('keydown', e => { if (introPhase === 'boot' && e.key === 'Enter' && !$('#landPass').hidden && document.activeElement !== $('#landNick')) punchIn(); });
function startCine() {
  if (introPhase !== 'boot') return;
  introPhase = 'cine'; cineT = 0; cineStartAt = performance.now(); camMode = 'cine'; $('#land').hidden = true; cancelAnimationFrame(landRAF); $('#cine').hidden = false; $('#skipBtn').hidden = false; $('#fade').classList.remove('on');
  scene.fog.near = 60; scene.fog.far = 160;
}
function cineFrame(dt) {
  cineT += dt;
  let i = 0; while (i < CINE.length - 2 && cineT > CINE[i + 1].t) i++;
  const a = CINE[i], b = CINE[i + 1], u = smooth(clamp((cineT - a.t) / (b.t - a.t), 0, 1));
  camera.position.set(lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u));
  camera.lookAt(lerp(a.l[0], b.l[0], u), lerp(a.l[1], b.l[1], u), lerp(a.l[2], b.l[2], u));
  const tt = $('#cineTitle'), l1 = $('#cineL1'), l2 = $('#cineL2'), l3 = $('#cineL3');
  tt.classList.toggle('show', cineT > 0.8 && cineT < 5.0);
  l1.classList.toggle('show', cineT > 6.6 && cineT < 9.4); l2.classList.toggle('show', cineT > 9.4 && cineT < 12); l3.classList.toggle('show', cineT > 12 && cineT < 13.1);
  $('#cineStamp').classList.toggle('show', cineT > 1.4 && cineT < 12.6); $('#cineTicker').classList.toggle('show', cineT > 2 && cineT < 12.6);
  if (townFx.fwT != null && cineT < 5 && townFx.fwT > 0.9) townFx.fwT = 0.9;
  if (cineT > 12.6 && !cineSkip) { cineSkip = true; $('#fade').classList.add('on'); setTimeout(startSelect, 650); }
  const inside = camera.position.z < ROOM.zf; scene.fog.far += ((inside ? 70 : 160) - scene.fog.far) * Math.min(1, dt * 3);
}
let selAvatar = null, selIdx = 0, selSpin = true;
function startSelect() {
  introPhase = 'select'; camMode = 'select'; $('#cine').hidden = true; $('#select').hidden = false; $('#skipBtn').hidden = true;
  scene.fog.near = 40; scene.fog.far = 120;
  selIdx = Math.max(0, PLAYABLE.findIndex(c => c.id === charChoice));
  mountSel(); renderSelect();
  setTimeout(() => $('#fade').classList.remove('on'), 60);
}
function mountSel() {
  if (selAvatar) selAvatar.dispose();
  const c = PLAYABLE[selIdx]; charChoice = c.id; store.set('cc_char', charChoice);
  selAvatar = new Avatar(c.id, { cls: 'me', look: c.id === 'custom' ? myLook : null }); selAvatar.obj.position.set(STAGE.x, 0.35, STAGE.z); if (c.id !== 'custom') { applyMyPhoto(selAvatar); if (myLook.emote !== 'auto') selAvatar.obj.userData.emote = myLook.emote; } selAvatar.obj.rotation.y = 0.3; selAvatar.state = 'podium';
  if (selAvatar.comp) selAvatar.comp.position.set(STAGE.x + 0.9, 0.35, STAGE.z + 0.4);
  applyFlair(selAvatar.obj, myFlair());   // bought items show on the stage too
  selAvatar.tag.hidden = true; selAvatar.tag.innerHTML = '';
  selAvatar.obj.scale.setScalar(0.01); selAvatar.popT = 0;
  if (introPhase === 'select') confetti(_w.set(STAGE.x, 1.6, STAGE.z), 26);
}
function selStep(d) { selIdx = (selIdx + d + PLAYABLE.length) % PLAYABLE.length; mountSel(); renderSelect(); }
function renderSelect() {
  if (introPhase !== 'select' && $('#select').hidden) return;
  const c = PLAYABLE[selIdx]; if (!c) return;
  $('#selName').textContent = c.id === 'custom' ? (myNick || c.name) : c.name; $('#selKind').textContent = c.kind === 'custom' ? t('sel_custom') : c.trader ? t('sel_trader') : t('sel_meme'); $('#selKind').className = 'kind ' + c.kind;
  $('#custEd').hidden = false; document.body.classList.toggle('ed-on', c.id === 'custom'); $('#custEd').classList.toggle('lite', c.id !== 'custom'); $('#edRandom').hidden = c.id !== 'custom'; renderEditor(c);
  $('#selBio').textContent = c.bio[LANG] || c.bio.en;
  { const r = selRarity(c); const si = $('.sel-info'); si.dataset.rar = r; si.style.setProperty('--rc', RARITY[r]); $('#selKind').textContent = t('r_' + r) + ' · ' + $('#selKind').textContent; }
  $('#selStats').innerHTML = [['sel_speed', 0], ['sel_clout', 1], ['sel_chaos', 2]].map(([k, i]) => `<div class="stat-row"><span>${t(k)}</span><i>${'<b></b>'.repeat(c.stats[i])}${'<b class="off"></b>'.repeat(5 - c.stats[i])}</i></div>`).join('');
  $('#selStrip').innerHTML = PLAYABLE.map((x, i) => `<button type="button" class="pt${i === selIdx ? ' on' : ''}" style="--rc:${RARITY[selRarity(x)]}" data-sel="${i}" title="${esc(x.name)}"><img src="${TH(x.id)}" data-th="${x.id}" alt="${esc(x.name)}"></button>`).join('');
  $('#selIdx').textContent = (selIdx + 1) + ' / ' + PLAYABLE.length;
  const on = $('#selStrip .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
$('#selStrip').addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if (b) { selIdx = +b.dataset.sel; mountSel(); renderSelect(); } });
$('#selPrev').addEventListener('click', () => selStep(-1)); $('#selNext').addEventListener('click', () => selStep(1));
$('#selEmote').addEventListener('click', () => selAvatar && selAvatar.emote());
$('#selRotL').addEventListener('click', () => { if (selAvatar) selAvatar.obj.rotation.y -= Math.PI / 4; });
$('#selRotR').addEventListener('click', () => { if (selAvatar) selAvatar.obj.rotation.y += Math.PI / 4; });
$('#selWalk').addEventListener('click', enterCafe);
let skipAt = 0, cineStartAt = 0;
$('#skipBtn').addEventListener('click', () => { const now = performance.now(); if (now - skipAt < 700) return; skipAt = now; if (introPhase === 'boot') startCine(); else if (introPhase === 'cine' && !cineSkip && now - cineStartAt > 400) { cineSkip = true; $('#fade').classList.add('on'); setTimeout(startSelect, 500); } });
function selectFrame(dt, time) {
  if (!selAvatar) return;
  selAvatar.popT = Math.min(1, (selAvatar.popT || 0) + dt * 3); const k = 1 - Math.pow(1 - selAvatar.popT, 3); selAvatar.obj.scale.setScalar(selAvatar.baseScale * (0.01 + 0.99 * k));
  const portrait = VW < VH * 0.9, want = portrait && $('#custEd').classList.contains('open') ? 1 : 0;
  selCamK += (want - selCamK) * Math.min(1, dt * 6);
  const dist = (portrait ? 6.4 : 5.6) + selCamK * 1.2;
  camera.position.set(STAGE.x, 1.9 - selCamK * 0.1, STAGE.z + dist); camera.lookAt(STAGE.x, 1.05 - selCamK * 1.35 + (portrait ? 0.12 : 0), STAGE.z);
}
let selCamK = 0;
function enterCafe() {
  if (introPhase !== 'select') return;
  introPhase = 'play'; $('#skipBtn').hidden = true; $('#fade').classList.add('on');
  setTimeout(() => {
    if (selAvatar) { selAvatar.dispose(); selAvatar = null; }
    $('#select').hidden = true; document.body.classList.remove('starting');
    spawnPlayer(charChoice, new THREE.Vector3(0, 0, ROOM.zf + 6), Math.PI, myLook, myNick);
    townFx.welcomeName = myNick || (charChoice === 'custom' ? 'FRIEND' : CHAR[charChoice].name); if (townFx.matTex) townFx.matTex.userData.redraw();
    cam.yaw = 0; cam.pitch = 0.42; cam.dist = 7; cam.target.set(0, 1.2, ROOM.zf + 6);
    camera.position.set(0, 4, ROOM.zf + 13); scene.fog.near = 60; scene.fog.far = 150;
    playing = true; camMode = 'play'; netConnect(); netHello(); saveProfile();
    moveTarget = DOOR_IN.clone(); moveTarget.run = false; autoWalk = () => { toast(t('toast_welcome', { n: myName() }), 'cyan'); confetti(_w.set(0, 1.5, ROOM.zf - 3), 40); };
    canvas.focus({ preventScroll: true });
    setTimeout(() => $('#fade').classList.remove('on'), 80);
  }, 550);
}
/* ---- character editor (custom body + tweaks for every character) ---- */
const ED_ROWS = [['base', 'ed_base', LOOK_OPTS.base, 'base'], ['body', 'ed_body', LOOK_OPTS.body], ['build', 'ed_build', LOOK_OPTS.build], ['skin', 'ed_skin', LOOK_OPTS.skins, 'sw'], ['hair', 'ed_hair', LOOK_OPTS.hair], ['hairCol', 'ed_hairCol', ['#2a1c14', '#5a3a22', '#e5bf72', '#1a1724', '#9a948c', '#ece9e2', '#bdb8ad', '#a66bff', '#f2f2f2', '#2b3d66'], 'sw'], ['eyes', 'ed_eyes', LOOK_OPTS.eyes], ['acc', 'ed_acc', LOOK_OPTS.acc], ['top', 'ed_top', LOOK_OPTS.top], ['topCol', 'ed_topCol', LOOK_OPTS.cols, 'sw'], ['pants', 'ed_pants', LOOK_OPTS.cols, 'sw'], ['shoes', 'ed_shoes', LOOK_OPTS.cols, 'sw'], ['accent', 'ed_accent', LOOK_OPTS.cols, 'sw'], ['photo', 'ed_photo', null, 'photo'], ['emote', 'ed_emote', LOOK_OPTS.emote], ['say', 'ed_say', null, 'say']];
let edPhotoSrc = store.get('cc_photo_src', null), edZoom = +store.get('cc_photo_zoom', 1.15), edDy = +store.get('cc_photo_dy', 0); let edStyle = store.get('cc_photo_style', 'pixel');
function renderEditor(c) {
  const full = !c || c.id === 'custom', human = true, preset = myLook.base !== 'own';
  const rows = ED_ROWS.filter(([k]) => {
    if (!full) return ['photo', 'emote', 'say'].includes(k);
    if (preset) return !['body', 'build', 'hair', 'hairCol', 'top'].includes(k);
    return human || !['build', 'top', 'topCol', 'pants', 'shoes'].includes(k);
  });
  const tabsHTML = edTabsHTML(full), shown = rows.filter(([k]) => ED_TAB_OF(k) === edTab).length ? rows.filter(([k]) => ED_TAB_OF(k) === edTab) : rows;
  $('#edRows').innerHTML = tabsHTML + shown.map(([k, lab, opts, kind]) => {
    let body = '';
    if (kind === 'base') body = opts.map(v => v === 'own' ? `<button type="button" data-k="base" data-v="own" aria-pressed="${myLook.base === 'own'}">${t('o_own')}</button>` : `<button type="button" class="pb" data-k="base" data-v="${v}" aria-pressed="${myLook.base === v}" title="${esc(CHAR[v].name)}"><img src="${THUMBS[v] || ''}" alt="${esc(CHAR[v].name)}"></button>`).join('');
    else if (kind === 'photo') body = `<div class="ed-photo">${myLook.photo === 'local' && PHOTO_TEX.local ? `<img class="pp" src="${store.get('cc_photo', '')}" alt="">` : `<div class="pp empty">?</div>`}<div class="ed-photo-c"><label class="btn small file">${t('ed_photo_pick')}<input type="file" id="edPhotoIn" accept="image/*" hidden></label>${edPhotoSrc ? `<div class="ed-pstyle">${['pixel', 'toon', 'photo'].map(s => `<button type="button" data-pstyle="${s}" aria-pressed="${s === edStyle}">${t('ed_ps_' + s)}</button>`).join('')}</div><label class="rng">${t('ed_zoom')}<input type="range" id="edZoom" min="0.8" max="2.4" step="0.05" value="${edZoom}"></label><label class="rng">${t('ed_shift')}<input type="range" id="edDy" min="-0.4" max="0.4" step="0.02" value="${edDy}"></label><button type="button" class="btn small ghost" id="edPhotoRm">${t('ed_photo_rm')}</button>` : ''}<small class="muted">${t('ed_photo_help')}</small></div></div>`;
    else if (kind === 'say') body = `<div class="ed-say">${[0, 1, 2].map(i => `<label><b>${i + 1}</b><input type="text" maxlength="48" data-say="${i}" value="${esc(myLook.say[i] || '')}" placeholder="${t('ed_say_ph' + (i + 1))}"></label>`).join('')}<small class="muted">${t('ed_say_help')}</small></div>`;
    else body = opts.filter(v => !(k === 'eyes' && preset && !['smile', 'shades'].includes(v))).map(v => kind === 'sw' ? `<button type="button" class="sw" data-k="${k}" data-v="${v}" aria-pressed="${myLook[k] === v}" style="background:${v}" title="${v}"></button>` : `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${myLook[k] === v}">${t('o_' + v)}</button>`).join('');
    return `<div class="ed-row"><span>${t(lab)}</span><div class="ed-opts">${body}</div></div>`;
  }).join('');
  const fi = $('#edPhotoIn'); if (fi) fi.addEventListener('change', ev => { const f = ev.target.files[0]; if (f) loadPhotoFile(f); });
  document.querySelectorAll('[data-pstyle]').forEach(b => b.addEventListener('click', () => { edStyle = b.dataset.pstyle; store.set('cc_photo_style', edStyle); document.querySelectorAll('[data-pstyle]').forEach(x => x.setAttribute('aria-pressed', x === b)); bakePhoto(); }));
  const zr = $('#edZoom'); if (zr) zr.addEventListener('input', ev => { edZoom = +ev.target.value; store.set('cc_photo_zoom', edZoom); bakePhoto(); });
  const dr = $('#edDy'); if (dr) dr.addEventListener('input', ev => { edDy = +ev.target.value; store.set('cc_photo_dy', edDy); bakePhoto(); });
  const rm = $('#edPhotoRm'); if (rm) rm.addEventListener('click', () => { edPhotoSrc = null; store.set('cc_photo_src', null); store.set('cc_photo', ''); delete PHOTO_TEX.local; setLook({ ...myLook, photo: '' }); });
  document.querySelectorAll('#edRows [data-say]').forEach(inp => { inp.addEventListener('keydown', ev => ev.stopPropagation()); inp.addEventListener('change', ev => { const say = [...myLook.say]; say[+inp.dataset.say] = inp.value; myLook = sanitizeLook({ ...myLook, say }); store.set('cc_look', myLook); }); });
}
function loadPhotoFile(f) {
  const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 720 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); edPhotoSrc = c.toDataURL('image/jpeg', 0.86); try { store.set('cc_photo_src', edPhotoSrc); } catch (e) { } edZoom = 1.15; edDy = 0; bakePhoto(); }; img.src = rd.result; }; rd.readAsDataURL(f);
}
let bakeT = 0;
function bakePhoto() {
  if (!edPhotoSrc) return; clearTimeout(bakeT);
  bakeT = setTimeout(() => {
    const img = new Image(); img.onload = () => {
      // crop a square around the face (zoom + up/down), then style it so it sits on a block head instead of looking pasted on
      const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d');
      const res = edStyle === 'pixel' ? 24 : edStyle === 'toon' ? 72 : S;
      const sm = document.createElement('canvas'); sm.width = sm.height = res; const sx = sm.getContext('2d');
      const s = Math.max(res / img.width, res / img.height) * edZoom, dw = img.width * s, dh = img.height * s;
      try { sx.filter = edStyle === 'photo' ? 'saturate(1.08) contrast(1.04)' : 'saturate(1.35) contrast(1.18) brightness(1.04)'; } catch (er) { }
      sx.drawImage(img, (res - dw) / 2, (res - dh) / 2 + edDy * res, dw, dh); sx.filter = 'none';
      if (edStyle !== 'photo') {   // fewer colours: a flat, drawn look
        const d = sx.getImageData(0, 0, res, res), p = d.data, lv = edStyle === 'pixel' ? 5 : 6, q = 255 / (lv - 1);
        for (let i = 0; i < p.length; i += 4) for (let k = 0; k < 3; k++) p[i + k] = Math.round(Math.round(p[i + k] / q) * q);
        sx.putImageData(d, 0, 0);
      }
      ctx.imageSmoothingEnabled = edStyle !== 'pixel'; ctx.drawImage(sm, 0, 0, S, S);
      if (edStyle === 'toon') { ctx.strokeStyle = 'rgba(10,10,11,.55)'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, S - 10, S - 10); }
      const url = c.toDataURL('image/png'); try { store.set('cc_photo', url); } catch (er) { toast(t('ed_photo_big')); return; }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; tx.userData.pixel = edStyle === 'pixel';
      if (edStyle === 'pixel') { tx.magFilter = THREE.NearestFilter; }
      PHOTO_TEX.local = tx; NET.photoId = null;
      setLook({ ...myLook, photo: 'local' });
    }; img.src = edPhotoSrc;
  }, 60);
}
function loadLocalPhoto() { const url = store.get('cc_photo', ''); if (!url) return Promise.resolve(); return photoTexFromUrl('local', url); }
function applyMyPhoto(av) { if (av && myLook.photo === 'local' && PHOTO_TEX.local) applyPhotoTex(av.obj, PHOTO_TEX.local); }
function setLook(l) { myLook = sanitizeLook(l); store.set('cc_look', myLook); const c = PLAYABLE[selIdx]; if (c && !$('#select').hidden) { const ry = selAvatar ? selAvatar.obj.rotation.y : 0.3; mountSel(); selAvatar.obj.rotation.y = ry; selAvatar.popT = 0.6; } renderEditor(c); }
let selRot = 0.3;
$('#edRows').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; setLook({ ...myLook, [b.dataset.k]: b.dataset.v }); });
$('#edRandom').addEventListener('click', () => { setLook({ ...randomLook(), photo: myLook.photo, say: myLook.say, emote: myLook.emote }); confetti(_w.set(STAGE.x, 1.5, STAGE.z), 30); });
$('#nickIn').value = myNick;
$('#nickIn').addEventListener('input', e => { myNick = e.target.value.replace(/[^\w\-\u0400-\u04FF .]/g, '').slice(0, 16); store.set('cc_nick', myNick); if (PLAYABLE[selIdx] && PLAYABLE[selIdx].id === 'custom') $('#selName').textContent = myNick || CHARS[selIdx].name; });
$('#nickIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.target.blur(); } });
function openCharSelect() { closeModals(); playing = false; introPhase = 'select'; camMode = 'select'; document.body.classList.add('starting'); $('#select').hidden = false; selIdx = Math.max(0, PLAYABLE.findIndex(c => c.id === charChoice)); mountSel(); renderSelect(); }

/* ================= side panel ================= */
let tab = 'feed';
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab; document.querySelectorAll('.tabs [data-tab]').forEach(x => x.setAttribute('aria-selected', x === b)); renderSide(true);
}));
$('#sideToggle').addEventListener('click', () => $('#side').classList.toggle('open'));
const shortW = w => w ? w.slice(0, 4) + '…' + w.slice(-4) : '';
function feedHTML(f) {
  const img = f.a.image || TH(f.a.body);
  const head = `<span class="av img"><img src="${img}" alt=""></span><div class="hd"><b>$${esc(f.a.sym)}</b><span class="k ${f.kind}">${t('fk_' + f.kind)}</span><time data-at="${f.at}">${ago(f.at)}</time></div>`;
  const pro = isPro(), whale = (f.kind === 'buy' || f.kind === 'sell') && +f.sol >= 0.5;
  const body = f.kind === 'launch' ? t('fe_launch', { n: esc(f.a.by || t('someone')), s: esc(f.a.title || f.a.sym) }) : f.kind === 'bond' ? t('fe_bond') : `${f.kind === 'buy' ? t('fe_buy') : t('fe_sell')} <b class="${f.kind}">${(+f.sol).toFixed(3)} SOL</b>${f.who && pro ? ' · <a class="who" href="https://solscan.io/account/' + esc(f.who) + '" target="_blank" rel="noopener">' + esc(shortW(f.who)) + '</a>' : f.who ? ' · <span class="who dim">····</span>' : ''}${whale && pro ? ' <span class="whale">' + t('fe_whale') + '</span>' : ''}`;
  return `<button type="button" class="fi ${whale && pro ? 'whale' : ''}" data-agent="${f.a.id}">${head}<p>${body}</p></button>`;
}
function renderSide(force) {
  $('#sAgents').textContent = agents.length;
  $('#sBonded').textContent = agents.filter(a => a.bonded).length;
  $('#sOut').textContent = NET.ready ? NET.online : 1;
  $('#sSol').textContent = STAT.trades;
  const body = $('#tabbody');
  if (tab === 'feed') {
    if (!feedDirty && !force) { body.querySelectorAll('time[data-at]').forEach(el => el.textContent = ago(+el.dataset.at)); return; }
    const pro = isPro(), lim = pro ? 80 : 12;
    const proBar = NET.http && NET.cfg.shop && NET.cfg.shop.profeed ? (pro ? `<div class="pro-bar on"><b>PRO</b><span>${t('pro_on', { d: Math.max(1, Math.ceil((NET.pro - Date.now()) / 864e5)) })}</span></div>` : `<button type="button" class="pro-bar" data-open="profeed"><b>PRO</b><span>${t('pro_offer', { n: NET.cfg.shop.profeed.sol })}</span></button>`) : '';
    body.innerHTML = proBar + (feed.length ? feed.slice(0, lim).map(feedHTML).join('') + (!pro && feed.length > lim ? `<button type="button" class="pro-more" data-open="profeed">${t('pro_more', { n: feed.length - lim })}</button>` : '') : `<div class="empty-state"><b>${t('feed_empty_t')}</b><p>${t('feed_empty')}</p><button type="button" class="btn hot small" data-open="launch">${t('launch')}</button></div>`);
  } else if (tab === 'lead') {
    if (!force && $('#side').matches(':hover')) return;
    const list = agents.slice().sort((a, b) => mcapFor(b) - mcapFor(a) || b.at - a.at).slice(0, 20);
    body.innerHTML = list.length ? list.map((a, i) => `<button type="button" class="lr" data-agent="${a.id}"><span class="n">${i + 1}</span><span class="nm"><img class="mini" src="${esc(a.image || TH(a.body))}" alt="">$${esc(a.sym)} ${!a.mint ? `<span class="pill">${t('test_tag')}</span>` : a.bonded ? `<span class="pill famous">${t('bonded_tag')}</span>` : ''}</span><span class="mc">${mcapText(a)}</span><span class="bar"><i style="width:${Math.min(100, a.bond)}%;${a.bonded ? 'background:var(--gold)' : ''}"></i></span></button>`).join('') : `<div class="empty-state"><b>${t('lead_empty_t')}</b><p>${t('feed_empty')}</p></div>`;
  } else {
    if (!force && $('#side').matches(':hover')) return;
    const ids = ['cafe', 'market', 'launchpad', 'billboard', 'arcade', 'casino', 'gym', 'sushi', 'well', 'xtower', 'quest', 'vault', 'studio', 'nest', 'docks', 'pond'];
    const here = outside.length ? `<div class="wnow"><b>${t('world_now')}</b>${outside.map(a => `<span class="pill famous">$${esc(a.sym)}</span> ${esc(a.placeNow ? t('out_work', { n: t('pl_' + a.placeNow) }) : t('out_walk', { n: t('pl_' + (a.outPlan[a.outIdx] || 'cafe')) }))}<br>`).join('')}</div>` : '';
    body.innerHTML = here + ids.map(id => `<div class="pl"><div><b>${t('pl_' + id)}</b><small>${t('pd_' + id)}</small></div><button type="button" data-go="${id}">${t('go')}</button></div>`).join('');
  }
  feedDirty = false;
}
document.addEventListener('click', e => {
  const lr = e.target.closest('[data-agent]'); if (lr) { const a = agentById(lr.dataset.agent); if (a) openBooth(a); return; }
  const go = e.target.closest('[data-go]'); if (go) { closeModals(); walkTo(go.dataset.go); return; }
  const pl = e.target.closest('[data-place]'); if (pl) { openPlace(pl.dataset.place); return; }
  const op = e.target.closest('[data-open]'); if (op) { const w = op.dataset.open; if (w === 'how') openHow(); else if (w === 'launch') { if (player && playing) goSit(nearestFreeBooth()); else openLaunch(); } else if (w === 'char') openCharSelect(); else if (w === 'shop') openShop(); else if (w === 'profeed') openShop('profeed'); else if (w === 'feed') $('#side').classList.toggle('open'); else if (w === 'map') { tab = 'world'; document.querySelectorAll('.tabs [data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === 'world')); renderSide(true); $('#side').classList.add('open'); } return; }
  if (e.target.closest('[data-close]') || e.target.classList.contains('modal')) { if (gameActive) closeGame(); else closeModals(); }
});
$('#brandBtn').addEventListener('click', openHow);
const menuSet = on => { $('#navMenu').classList.toggle('open', on); $('#menuBtn').setAttribute('aria-expanded', on); };
$('#menuBtn').addEventListener('click', e => { e.stopPropagation(); menuSet(!$('#navMenu').classList.contains('open')); });
$('#navMenu').addEventListener('click', () => menuSet(false));
document.addEventListener('pointerdown', e => { if (!e.target.closest('#navMenu') && !e.target.closest('#menuBtn')) menuSet(false); });
$('#edHead').addEventListener('click', () => { const ed = $('#custEd'), on = !ed.classList.contains('open'); ed.classList.toggle('open', on); $('#select').classList.toggle('ed-opened', on && innerWidth <= 760); $('#edHead').setAttribute('aria-expanded', on); });

/* ================= modals ================= */
let openAgent = null, openPlaceId = null;
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.hidden = true); openAgent = null; openPlaceId = null; canvas.focus({ preventScroll: true }); }
function showModal(id) { document.querySelectorAll('.modal').forEach(m => m.hidden = m.id !== id); for (const k in keys) keys[k] = false; }

function openBooth(a) {
  openAgent = a; showModal('mBooth');
  const status = !a.mint ? `<span class="pill test">${t('test_tag')}</span>` : a.bonded ? `<span class="pill famous">${t('bonded_tag')}</span>` : `<span class="pill onpump">${t('live_pump')}</span>`;
  const safe = u => /^https:\/\/[^\s"'<>]+$/i.test(u || '') ? u : '';
  const soc = a.socials ? [['𝕏', safe(a.socials.x)], ['TG', safe(a.socials.tg)], ['WEB', safe(a.socials.web)]].filter(([, u]) => u) : [];
  $('#boothBody').innerHTML = `
    <div class="booth-head"><img src="${esc(a.image || TH(a.body))}" alt="" style="object-fit:cover"><div style="min-width:0">
      <h3 id="bTitle">$${esc(a.sym)}${a.title && a.title !== a.sym ? ` <span class="muted" style="font:500 13px var(--f-body);text-transform:none;letter-spacing:0">${esc(a.title)}</span>` : ''} ${status}</h3>
      <div class="who">${t('by_line', { n: esc(a.by || t('someone')), t: ago(a.at) })}</div>
      ${a.mint ? `<div class="ca">CA <code>${esc(a.mint)}</code><button type="button" class="btn small" id="bCopy">${t('wz_copy')}</button><button type="button" class="btn small" data-share="coin" data-mint="${esc(a.mint)}">𝕏 ${t('sh_btn')}</button></div>` : ''}
    </div></div>
    <div class="booth-grid">
      <div><div class="chart-box" id="chartBox"></div><div class="chart-note" id="chartNote"></div>${a.mint ? `<div class="chart-tabs" id="chartTabs"><button type="button" data-cv="dex">DexScreener</button><button type="button" data-cv="own">${t('chart_live')}</button></div>` : ''}
        <div class="kv" id="boothKV"></div></div>
      <div><div class="desk"><h4>${t('b_trades')}</h4><div id="deskList"></div></div>
        ${a.desc ? `<p class="bdesc">${esc(a.desc)}</p>` : ''}${soc.length ? `<div class="pf-soc" style="margin-top:10px">${soc.map(([k, u]) => `<a class="pill" href="${esc(u)}" target="_blank" rel="noopener">${k} ↗</a>`).join('')}</div>` : ''}</div>
    </div>${tradeHTML(a)}`;
  chartView = a.mint && PX[a.mint] && PX[a.mint].pair ? 'dex' : 'own';
  const tabs = $('#chartTabs'); if (tabs) tabs.addEventListener('click', ev => { const b = ev.target.closest('[data-cv]'); if (!b || b.disabled) return; chartView = b.dataset.cv; renderChart(a); });
  const cp = $('#bCopy'); if (cp) cp.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(a.mint); cp.textContent = t('wz_copied'); });
  if (a.mint) wireTrade(a);
  if (a.mint && NET.http) {   // Trench League: this agent's week and the backing buttons, right under the header
    const lb = document.createElement('div'); lb.className = 'boost-box lg-box'; lb.id = 'lgBox'; lb.innerHTML = leagueBoothHTML(a);
    const head = $('#boothBody .booth-head'); head.parentNode.insertBefore(lb, head.nextSibling);
    leagueFetch().then(() => { const el = $('#lgBox'); if (el && openAgent === a) el.innerHTML = leagueBoothHTML(a); });
  }
  if (a.mint && NET.http && NET.cfg.plateFee && isMyCoin(a)) {
    const pb = document.createElement('div'); pb.className = 'boost-box plate-box';
    pb.innerHTML = `<div><b>${t('plate_t')}</b><span>${a.plate ? t('plate_on', { s: esc(a.plate) }) : t('plate_d')}</span></div><div class="row" style="margin:0"><input class="in" id="bPlateIn" maxlength="24" value="${esc(a.plate || '')}" placeholder="${esc(t('plate_ph'))}" style="max-width:180px"><button type="button" class="btn hot small" id="bPlate">${t('plate_btn', { n: NET.cfg.plateFee })}</button></div>`;
    $('#boothBody').appendChild(pb);
    $('#bPlateIn').addEventListener('keydown', ev => ev.stopPropagation());
    $('#bPlate').addEventListener('click', async ev => { const btn = ev.currentTarget, text = $('#bPlateIn').value.trim(); if (!text) return; btn.disabled = true; btn.textContent = t('vip_checking'); try { await buyPlate(a, text); toast(t('plate_done'), 'gold', true); openBooth(a); } catch (err) { toast(String(err.message || err).slice(0, 140)); btn.disabled = false; btn.textContent = t('plate_btn', { n: NET.cfg.plateFee }); } });
  }
  if (a.mint && NET.http && NET.cfg.boostFee) {
    const box = document.createElement('div'); box.className = 'boost-box';
    const until = NET.boosts && NET.boosts[a.mint] > Date.now() ? NET.boosts[a.mint] : 0;
    box.innerHTML = `<div><b>${t('boost_t')}</b><span>${until ? t('boost_on', { m: Math.ceil((until - Date.now()) / 60e3) }) : t('boost_d', { m: NET.cfg.boostMin || 60 })}</span></div><button type="button" class="btn hot small" id="bBoost">${t(until ? 'boost_more' : 'boost_btn', { n: NET.cfg.boostFee })}</button>`;
    $('#boothBody').appendChild(box);
    $('#bBoost').addEventListener('click', async ev => { const btn = ev.currentTarget; btn.disabled = true; btn.textContent = t('vip_checking'); try { await buyBoost(a); toast(t('boost_done', { s: '$' + a.sym }), 'gold', true); openBooth(a); } catch (err) { toast(String(err.message || err).slice(0, 140)); btn.disabled = false; btn.textContent = t('boost_btn', { n: NET.cfg.boostFee }); } });
  }
  boothChipButtons(a);
  renderChart(a); fillBooth(a);
}
let chartView = 'own';
function renderChart(a) {
  const box = $('#chartBox'); if (!box) return;
  const px = a.mint && PX[a.mint], hasDex = !!(px && px.pair);
  if (chartView === 'dex' && !hasDex) chartView = 'own';
  const tabs = $('#chartTabs'); if (tabs) tabs.querySelectorAll('[data-cv]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.cv === chartView); b.disabled = b.dataset.cv === 'dex' && !hasDex; });
  const note = $('#chartNote');
  if (chartView === 'dex') {
    if (note) note.textContent = '';
    if (box.dataset.mode !== 'dex:' + px.pair) { box.dataset.mode = 'dex:' + px.pair; box.innerHTML = `<iframe src="https://dexscreener.com/solana/${encodeURIComponent(px.pair)}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=1&chartType=marketCap&interval=5" title="DexScreener" loading="lazy"></iframe>`; }
    return;
  }
  if (box.dataset.mode !== 'own') { box.dataset.mode = 'own'; box.innerHTML = '<canvas width="960" height="540"></canvas>'; }
  drawCoinChart(box.querySelector('canvas').getContext('2d'), a, 960, 540);
  if (note) note.textContent = !a.mint ? t('chart_test_note') : hasDex ? '' : t('chart_dex_wait');
}
const fmtPx = p => p >= 1 ? p.toFixed(3) : p >= 0.001 ? p.toFixed(5) : p.toFixed(9).replace(/0+$/, '');
function walletRowHTML() { return NET.wallet ? `<span class="pill">${t('tr_connected')}: ${NET.wallet.slice(0, 4)}…${NET.wallet.slice(-4)}</span><span class="pill">${NET.solBal != null ? NET.solBal.toFixed(3) : '…'} SOL</span><span class="pill" id="trBag">${t('tr_bal')}: …</span>` : `<button type="button" class="btn small" id="trConnect">${t('tr_connect')}</button>`; }
function tradeHTML(a) {
  if (!a.mint) return `<p class="note-box" style="margin-top:14px">${t('test_coin_note')}</p>`;
  return `<div class="trade" id="tradeBox"><h4>◎ ${t('tr_title')}</h4>
    <div class="row" id="trWallet">${walletRowHTML()}</div>
    <div class="row"><span class="lab">${t('tr_buy')}</span>${[0.05, 0.1, 0.25, 0.5].map(v => `<button type="button" class="btn small hot" data-buy="${v}">${v} SOL</button>`).join('')}<input id="trAmt" type="number" min="0.001" max="50" step="0.01" placeholder="${t('tr_amount')}"><button type="button" class="btn small hot" id="trBuyCustom">${t('tr_buy')}</button></div>
    <div class="row"><span class="lab">${t('tr_sell')}</span>${['25%', '50%', '100%'].map(v => `<button type="button" class="btn small" data-sell="${v}">${v}</button>`).join('')}</div>
    <div class="ca"><a href="https://pump.fun/coin/${esc(a.mint)}" target="_blank" rel="noopener">pump.fun ↗</a> · <a href="https://dexscreener.com/solana/${esc(a.mint)}" target="_blank" rel="noopener">dexscreener ↗</a> · <a href="https://solscan.io/token/${esc(a.mint)}" target="_blank" rel="noopener">solscan ↗</a></div>
    <small class="muted">${t('tr_note')}</small></div>`;
}
async function refreshBag(a) { const el = $('#trBag'); if (!el || !NET.wallet) return; const n = await tokenBalance(a.mint); const el2 = $('#trBag'); if (el2) el2.textContent = t('tr_bal') + ': ' + big(n) + ' $' + a.sym; }
function wireTrade(a) {
  const box = $('#tradeBox'); if (!box) return;
  const run = async (action, amount) => {
    if (!NET.http) { toast(t('tr_need_server')); return; }
    const btns = box.querySelectorAll('button'); btns.forEach(b => b.disabled = true); toast(t('tr_sending'), 'cyan');
    try { const sig = await tradeToken(a.mint, action, amount); toast(t('tr_done', { s: sig.slice(0, 8) + '…' }), 'gold'); confetti(_w.copy(player.obj.position).setY(1.5), 50); }
    catch (e) { toast(t('tr_fail', { e: String(e.message || e).slice(0, 90) })); }
    btns.forEach(b => b.disabled = false); $('#trWallet').innerHTML = walletRowHTML(); refreshBag(a);
  };
  box.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'trConnect') { connectWallet().then(() => { $('#trWallet').innerHTML = walletRowHTML(); refreshBag(a); }); return; }
    if (b.dataset.buy) run('buy', +b.dataset.buy);
    else if (b.id === 'trBuyCustom') { const v = +$('#trAmt').value; if (v >= 0.001) run('buy', v); }
    else if (b.dataset.sell) run('sell', b.dataset.sell);
  });
  const amt = $('#trAmt'); if (amt) amt.addEventListener('keydown', ev => ev.stopPropagation());
  refreshBag(a);
}
function fillBooth(a) {
  if (!$('#boothKV')) return;
  const px = a.mint && PX[a.mint], dash = '—';
  $('#boothKV').innerHTML = `
    <div style="grid-column:1/3"><span>${t('k_bond')}</span><div class="bondbar${a.bonded ? ' done' : ''}"><i style="width:${a.mint ? Math.min(100, a.bond) : 0}%"></i></div><b>${!a.mint ? dash : a.bonded ? t('bonded_tag') : a.bond.toFixed(1) + '%'}</b></div>
    <div><span>${t('k_mcap')}</span><b>${mcapText(a)}</b></div>
    <div><span>${t('tr_price')}</span><b>${px && px.p ? '$' + fmtPx(px.p) : dash}</b></div>
    <div><span>${t('tr_vol')}</span><b>${px && px.v ? usd(px.v) : dash}</b></div>
    <div><span>${t('tr_chg')}</span><b style="color:${px && px.ch < 0 ? 'var(--bad)' : 'var(--good)'}">${px && px.ch != null ? (px.ch >= 0 ? '+' : '') + (+px.ch).toFixed(1) + '%' : dash}</b></div>
    <div><span>${t('k_traders')}</span><b>${a.mint ? a.holders : dash}</b></div>
    <div><span>${t('k_where')}</span><b>${a.outside ? t('where_out', { n: a.placeNow ? t('pl_' + a.placeNow) : t('pl_' + (a.outPlan?.[a.outIdx] || 'cafe')) }) : t('where_desk')}</b></div>`;
  $('#deskList').innerHTML = a.trades.length ? a.trades.slice(0, 14).map(tx => `<div class="tr"><b class="${tx.side === 'sell' ? 'sell' : 'buy'}">${(tx.side === 'sell' ? t('tr_sell') : t('tr_buy')).toUpperCase()}</b> ${(+tx.sol || 0).toFixed(3)} SOL <span class="muted">${tx.trader ? '· ' + esc(shortW(tx.trader)) : ''} · ${ago(tx.ts || Date.now())}</span></div>`).join('') : `<p class="muted" style="margin:0">${a.mint ? t('no_trades_yet') : t('test_no_trades')}</p>`;
  if (chartView === 'own') renderChart(a);
}

/* charts: real candles (server, GeckoTerminal) or the trade-by-trade market cap line (PumpPortal stream) */
function chartData(a) {
  const c = a.mint && OHLC[a.mint];
  if (c && c.length >= 3) return { kind: 'candle', unit: '$', pts: c.map(k => ({ t: k[0] * 1000, o: k[1] * 1e9, h: k[2] * 1e9, l: k[3] * 1e9, c: k[4] * 1e9 })) };
  if (a.hist.length >= 2) return { kind: 'line', unit: SOL_PX.usd ? '$' : '◎', pts: a.hist.map(p => ({ t: p.t, c: SOL_PX.usd ? p.v * SOL_PX.usd : p.v })) };
  return null;
}
const fmtCap = (v, unit) => unit === '$' ? usd(v) : '◎ ' + (v >= 100 ? v.toFixed(0) : v.toFixed(1));
function drawSeries(ctx, X, Y, Wd, Hd, d, small) {
  const pts = d.pts; let mn = Infinity, mx = -Infinity;
  for (const p of pts) { mn = Math.min(mn, p.l ?? p.c); mx = Math.max(mx, p.h ?? p.c); }
  if (!(mx > mn)) { mx = (mx || 1) * 1.03; mn = (mn || 1) * 0.97; }
  const pad = (mx - mn) * 0.1; mn -= pad; mx += pad;
  const yOf = v => Y + Hd - (v - mn) / (mx - mn) * Hd;
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const yy = Math.round(Y + Hd * i / 4) + 0.5; ctx.beginPath(); ctx.moveTo(X, yy); ctx.lineTo(X + Wd, yy); ctx.stroke(); }
  const first = pts[0].o ?? pts[0].c, last = pts[pts.length - 1].c, up = last >= first;
  if (d.kind === 'candle') {
    const n = pts.length, cw = Wd / n;
    pts.forEach((p, i) => { const x = X + i * cw + cw / 2, g = p.c >= p.o; ctx.strokeStyle = ctx.fillStyle = g ? '#8fd3a6' : '#d9707a'; ctx.lineWidth = Math.max(1, cw * 0.14); ctx.beginPath(); ctx.moveTo(x, yOf(p.h)); ctx.lineTo(x, yOf(p.l)); ctx.stroke(); const y1 = yOf(Math.max(p.o, p.c)), y2 = yOf(Math.min(p.o, p.c)); ctx.fillRect(x - cw * 0.34, y1, cw * 0.68, Math.max(1.5, y2 - y1)); });
  } else {
    const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, t0 + 1), xOf = tt => X + (tt - t0) / (t1 - t0) * Wd;
    ctx.beginPath(); pts.forEach((p, i) => { const x = xOf(p.t), y = yOf(p.c); if (!i) ctx.moveTo(x, y); else { ctx.lineTo(x, yOf(pts[i - 1].c)); ctx.lineTo(x, y); } });
    ctx.strokeStyle = up ? '#8fd3a6' : '#d9707a'; ctx.lineWidth = small ? 2.5 : 3; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(X + Wd, yOf(last)); ctx.lineTo(X + Wd, Y + Hd); ctx.lineTo(xOf(pts[0].t), Y + Hd); ctx.closePath(); ctx.fillStyle = up ? 'rgba(143,211,166,.13)' : 'rgba(217,112,122,.13)'; ctx.fill();
    if (!small) pts.forEach(p => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(xOf(p.t), yOf(p.c), 2.2, 0, 7); ctx.fill(); });
  }
  return { up, last, mn, mx, yOf };
}
function chartEmpty(ctx, W_, H_, a, small) {
  const im = imgOf(a), s = small ? 54 : 150;
  if (im) { ctx.save(); ctx.globalAlpha = 0.9; rr(ctx, W_ / 2 - s / 2, H_ / 2 - s / 2 - (small ? 8 : 30), s, s, small ? 8 : 18); ctx.clip(); ctx.drawImage(im, W_ / 2 - s / 2, H_ / 2 - s / 2 - (small ? 8 : 30), s, s); ctx.restore(); }
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `700 ${small ? 11 : 22}px 'JetBrains Mono', monospace`; ctx.textAlign = 'center';
  ctx.fillText(!a.mint ? t('chart_test') : t('chart_first'), W_ / 2, H_ / 2 + s / 2 + (small ? 6 : 14)); ctx.textAlign = 'left';
}
function drawCoinChart(ctx, a, W_, H_) {
  ctx.fillStyle = '#0a0a0b'; ctx.fillRect(0, 0, W_, H_);
  const d = chartData(a);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = "600 18px 'JetBrains Mono', monospace"; ctx.textAlign = 'left';
  ctx.fillText(t('k_mcap').toUpperCase() + (d ? ' · ' + (d.kind === 'candle' ? '5M' : t('chart_trades', { n: d.pts.length })) : ''), 24, 38);
  if (!d) { chartEmpty(ctx, W_, H_, a, false); return; }
  const r = drawSeries(ctx, 24, 64, W_ - 150, H_ - 120, d, false);
  ctx.font = "600 16px 'JetBrains Mono', monospace"; ctx.fillStyle = 'rgba(255,255,255,.45)';
  for (let i = 0; i <= 3; i++) { const v = r.mn + (r.mx - r.mn) * (1 - i / 3); ctx.fillText(fmtCap(v, d.unit), W_ - 118, 70 + (H_ - 120) * i / 3); }
  const y = r.yOf(r.last); ctx.fillStyle = r.up ? '#8fd3a6' : '#d9707a'; rr(ctx, W_ - 124, y - 16, 112, 32, 6); ctx.fill(); ctx.fillStyle = '#04120a'; ctx.font = "800 17px 'JetBrains Mono', monospace"; ctx.fillText(fmtCap(r.last, d.unit), W_ - 116, y + 6);
  const tl = new Date(d.pts[0].t), tr = new Date(d.pts[d.pts.length - 1].t), hm = x => String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = "500 15px 'JetBrains Mono', monospace"; ctx.fillText(hm(tl), 24, H_ - 22); ctx.textAlign = 'right'; ctx.fillText(hm(tr), W_ - 150, H_ - 22); ctx.textAlign = 'left';
}
function pick2(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrap(ctx, text, x, y, mw, lh) { const words = text.split(' '); let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > mw && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = test; } ctx.fillText(line, x, y); }

/* launch */
const draft = { name: '', title: '', desc: '', image: null, x: '', tg: '', web: '', firstBuy: 0, agree: false, body: null, booth: null };
let wzStep = 1;
function pfCard() {
  const img = draft.image || THUMBS[draft.body] || '', name = draft.title || draft.name || 'YOUR COIN', tick = draft.name || 'TICK';
  return `<div class="pf-card"><div class="pf-top"><img src="${img}" alt=""><div><b>${esc(name)} <span>(${esc(tick)})</span></b><small>${t('wz_created_by')} <i>TRENCH CAFE</i></small><small class="mc">${t('wz_new_coin')}</small></div></div><p>${esc(draft.desc || t('f_desc_ph'))}</p><div class="pf-curve"><span>${t('wz_curve')}</span><i><b style="width:1%"></b></i><span>0%</span></div><div class="pf-soc">${[['𝕏', draft.x], ['TG', draft.tg], ['WEB', draft.web]].filter(([, v]) => v).map(([k]) => `<span>${k}</span>`).join('') || `<span class="dim">${t('wz_no_soc')}</span>`}</div></div>`;
}
function wzSteps() { return `<div class="wz-steps">${[1, 2, 3].map(i => `<span class="${i === wzStep ? 'on' : i < wzStep ? 'done' : ''}"><b>${i}</b>${t('wz_s' + i)}</span>`).join('')}</div>`; }
function openLaunch(keep, booth) {
  if (booth !== undefined) draft.booth = booth && !booth.agent ? booth : null;
  showModal('mLaunch');
  if (!draft.body) draft.body = charChoice === 'custom' ? 'degen' : charChoice;
  if (!keep) wzStep = 1;
  const live = !!(NET.http && NET.cfg.live), fee = NET.cfg.launchFee || 0, vipDesk = !!(draft.booth && draft.booth.vip), vipFee = vipDesk ? (NET.cfg.vipDeskFee || 0) : 0;
  let body = '';
  if (wzStep === 1) body = `
      <div class="field"><label for="fTitle">${t('f_title')}</label><input class="in" id="fTitle" maxlength="32" value="${esc(draft.title)}" placeholder="Blinky the Dip Cat" autocomplete="off"></div>
      <div class="field"><label for="fName">${t('f_ticker')}</label><input class="in mono" id="fName" maxlength="10" value="${esc(draft.name)}" placeholder="BLINKY" autocomplete="off"><div class="help">${t('f_name_help')}</div></div>
      <div class="field"><span class="lab">${t('f_image')}</span><div class="imgpick"><img id="fImgPrev" src="${draft.image || THUMBS[draft.body] || ''}" alt=""><label class="btn small pick">${t('f_image_pick')}<input type="file" id="fImage" accept="image/png,image/jpeg,image/webp"></label></div><div class="help">${t('f_image_help')}</div></div>
      <div class="field"><label for="fDesc">${t('f_desc')}</label><textarea class="in" id="fDesc" maxlength="300" placeholder="${t('f_desc_ph')}">${esc(draft.desc || '')}</textarea></div>
      <div class="nums soc"><div class="field"><label class="lab" for="fX">${t('f_x')}</label><input class="in" id="fX" value="${esc(draft.x)}" placeholder="https://x.com/…"></div><div class="field"><label class="lab" for="fTg">${t('f_tg')}</label><input class="in" id="fTg" value="${esc(draft.tg)}" placeholder="https://t.me/…"></div><div class="field"><label class="lab" for="fWeb">${t('f_web')}</label><input class="in" id="fWeb" value="${esc(draft.web)}" placeholder="https://…"></div></div>`;
  else if (wzStep === 2) body = `
      <div class="field"><span class="lab">${t('f_body')}</span><div class="bodies" id="fBodies">${PLAYABLE.filter(c => c.id !== 'custom').map(c => `<button type="button" data-body="${c.id}" aria-pressed="${draft.body === c.id}"><img src="${TH(c.id)}" alt="">${esc(c.name)}</button>`).join('')}</div><div class="help">${t('f_body_help')}</div></div>`;
  else body = live ? `
      <div class="wz-fees"><span class="lab">${t('wz_fees')}</span>
        <div><span>${t('wz_fee_launch')}</span><b>${fee ? fee + ' SOL' : t('wz_free')}</b></div>
        ${vipDesk ? `<div class="vipline"><span>${t('wz_fee_vipdesk')}</span><b>+${vipFee} SOL</b></div>` : ''}
        <div><span>${t('wz_fee_net')}</span><b>~0.02 SOL</b></div>
      </div>
      <div class="field"><label class="lab" for="fFirst">${t('wz_first')}</label><div class="row" style="margin-top:4px"><input class="in" type="number" id="fFirst" min="0" max="50" step="0.01" value="${draft.firstBuy || ''}" placeholder="0.1" style="max-width:140px"> <span class="muted" style="font-size:12px">SOL</span></div><div class="help">${t('wz_first_help')}</div></div>
      <label class="toggle"><input type="checkbox" id="fAgree" ${draft.agree ? 'checked' : ''}><span>${t('wz_agree')}</span></label>
      <div class="wz-progress" id="wzProg" hidden><div class="bar"><i id="wzBar"></i></div><div id="wzLog"></div></div>` : `
      <div class="note-box">${NET.http ? t('wz_soon_note') : t('wz_sim_note')}</div>
      <label class="toggle"><input type="checkbox" id="fAgree" ${draft.agree ? 'checked' : ''}><span>${t('wz_agree_test')}</span></label>
      <div class="wz-progress" id="wzProg" hidden><div class="bar"><i id="wzBar"></i></div><div id="wzLog"></div></div>`;
  $('#launchBody').innerHTML = `
    <h3>${t('launch_title')}${draft.booth ? ` <span class="muted" style="font:600 11px var(--f-mono);letter-spacing:.14em;vertical-align:middle">· ${t('seat_no', { n: draft.booth.idx })}${draft.booth.vip ? ' · VIP' : ''}</span>` : ''}</h3><p class="sub">${t('launch_sub')}</p>
    ${myCoinsBanner()}
    ${wzSteps()}
    <div class="wz"><form class="form" id="launchForm" novalidate>${body}
      <div class="err" id="fErr" role="alert"></div>
      <div class="row wz-nav" style="margin-top:6px">${wzStep > 1 ? `<button type="button" class="btn" id="wzBack">${t('wz_back')}</button>` : ''}${wzStep < 3 ? `<button type="submit" class="btn hot" id="wzNext">${t('wz_next')}</button>` : `<button type="submit" class="btn hot big" id="fSubmit">${live ? (launchPaid() ? t('wz_relaunch') : t('wz_sign')) : t('wz_sim')}</button>`}</div>
    </form><aside class="wz-side"><span class="lab">${t('wz_preview')}</span><div id="pfPrev">${pfCard()}</div><a class="pf-link" href="https://pump.fun" target="_blank" rel="noopener">pump.fun ↗</a></aside></div>`;
  const sync = () => {
    const g = id => $(id); if (g('#fTitle')) draft.title = g('#fTitle').value.slice(0, 32); if (g('#fName')) draft.name = g('#fName').value; if (g('#fDesc')) draft.desc = g('#fDesc').value; if (g('#fX')) draft.x = g('#fX').value.trim(); if (g('#fTg')) draft.tg = g('#fTg').value.trim(); if (g('#fWeb')) draft.web = g('#fWeb').value.trim();
    if (g('#fFirst')) draft.firstBuy = Math.max(0, +g('#fFirst').value || 0); if (g('#fAgree')) draft.agree = g('#fAgree').checked;
    const pv = $('#pfPrev'); if (pv) pv.innerHTML = pfCard();
  };
  $('#launchForm').addEventListener('input', sync);
  const fi = $('#fImage'); if (fi) fi.addEventListener('change', ev => { const f = ev.target.files && ev.target.files[0]; if (!f || f.size > 2 * 1024 * 1024) { if (f) toast('max 2 MB'); return; } const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); const s = Math.min(512, im.width, im.height); c.width = c.height = s; c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, s, s); draft.image = c.toDataURL('image/jpeg', 0.86); $('#fImgPrev').src = draft.image; sync(); }; im.src = rd.result; }; rd.readAsDataURL(f); });
  const fn = $('#fName'); if (fn) fn.addEventListener('input', ev => { ev.target.value = ev.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); draft.name = ev.target.value; sync(); });
  const fb = $('#fBodies'); if (fb) fb.addEventListener('click', ev => { const b = ev.target.closest('[data-body]'); if (!b) return; draft.body = b.dataset.body; fb.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); sync(); });
  const wb = $('#wzBack'); if (wb) wb.addEventListener('click', () => { sync(); wzStep--; openLaunch(true); });
  $('#launchForm').addEventListener('submit', ev => {
    ev.preventDefault(); sync();
    if (wzStep === 1) { const name = (draft.name || '').toUpperCase(); if (!/^[A-Z0-9]{1,10}$/.test(name)) { $('#fErr').textContent = t('err_name'); return; } if (agents.some(a => a.booth && a.sym === name)) { $('#fErr').textContent = t('err_taken'); return; } wzStep = 2; openLaunch(true); return; }
    if (wzStep === 2) { wzStep = 3; openLaunch(true); return; }
    submitLaunch();
  });
  setTimeout(() => { const f = $('#fTitle') || $('#fBodies'); if (f && !keep && f.focus) f.focus(); }, 30);
}
function wzProgress(step, total, text) { const pr = $('#wzProg'); if (!pr) return; pr.hidden = false; $('#wzBar').style.width = Math.round(step / total * 100) + '%'; const d = document.createElement('div'); d.textContent = '› ' + text; $('#wzLog').appendChild(d); }
/* ---- the player's own coins: always visible, so nobody pays twice thinking a launch failed ---- */
const myMints = () => store.get('cc_my_coins', []);
function addMyCoin(mint) { const l = myMints(); if (mint && !l.includes(mint)) { l.push(mint); store.set('cc_my_coins', l.slice(-50)); } }
function isMyCoin(ag) { return !!ag && !!ag.mint && (myMints().includes(ag.mint) || (!!NET.wallet && ag.wallet === NET.wallet)); }
function refreshMine() { for (const a of agents) if (!a.mine && isMyCoin(a)) { a.mine = true; updateAgentTag(a); if (a.booth && a.booth.avatar) a.booth.avatar.tag.classList.add('mine'); } }
function myCoinsBanner() {
  const pend = launchPaid(), mine = agents.filter(a => a.mine && a.mint);
  if (pend) return `<div class="wz-mine pend"><b>${t('wz_pend_t', { s: '$' + esc(pend.sym || '') })}</b><span>${t('wz_pend_d')}</span></div>`;
  if (!mine.length) return '';
  return `<div class="wz-mine"><b>${t('wz_have_t', { n: mine.length })}</b><span class="chips">${mine.slice(-5).map(a => `<button type="button" data-mycoin="${a.id}"><i></i>$${esc(a.sym)}</button>`).join('')}</span><small>${t('wz_have_d')}</small></div>`;
}
$('#launchBody').addEventListener('click', e => { const b = e.target.closest('[data-mycoin]'); if (!b) return; const a = agents.find(x => x.id === b.dataset.mycoin); if (a) { closeModals(); openBooth(a); } });
let pendWatch = 0;
function watchPendingLaunch() {
  if (pendWatch || !launchPaid() || !NET.http) return;
  const t0 = Date.now();
  const tick = async () => {
    const q = launchPaid(); if (!q || Date.now() - t0 > 30 * 60e3) { clearInterval(pendWatch); pendWatch = 0; return; }
    if (NET.launching) return;   // the wizard is waiting for this launch right now
    try { const j = await (await fetch(NET.http + '/api/launch-status?sig=' + encodeURIComponent(q.sig))).json(); if (j.state === 'done' && j.mint) { clearInterval(pendWatch); pendWatch = 0; pendingLaunchDone(j.agent || { mint: j.mint, sym: q.sym }); } } catch (e) { }
  };
  pendWatch = setInterval(tick, 10000); tick();
}
function pendingLaunchDone(ag) {
  const q = launchPaid(); store.set('cc_launch_pay', null); addMyCoin(ag.mint); gainXP(500, 'launch');
  let a = agents.find(x => x.mint === ag.mint); if (!a && ag.sym) a = netSeatAgent(ag);
  if (a) { a.mine = true; updateAgentTag(a); setFeatured(a, true); drawWorldScreens(time); }
  showLaunchDone(a, ag.mint, ag.sym || (q && q.sym) || '');
}
function showLaunchDone(a, mint, sym) {
  if ($('#mLaunch').hidden) showModal('mLaunch');
  const title = a ? a.title : sym, img = a ? (a.image || TH(a.body)) : '';
  $('#launchBody').innerHTML = `<div class="wz-done"><div class="land-chip">${t('wz_done')}</div><h3>$${esc(sym)} · ${esc(title)}</h3><p class="sub">${t('wz_done_sure')}</p>
    ${img ? `<div class="pf-card"><div class="pf-top"><img src="${esc(img)}" alt=""><div><b>${esc(title)} <span>($${esc(sym)})</span></b><small>${t('wz_created_by')} <i>TRENCH CAFE</i></small></div></div></div>` : ''}
    <div class="wz-ca"><span class="lab">${t('wz_ca')}</span><code>${esc(mint)}</code><button type="button" class="btn small" id="wzCopy">${t('wz_copy')}</button></div><div class="ca"><a href="https://pump.fun/coin/${esc(mint)}" target="_blank" rel="noopener">pump.fun ↗</a> · <a href="https://dexscreener.com/solana/${esc(mint)}" target="_blank" rel="noopener">dexscreener ↗</a></div>
    <div class="row"><button type="button" class="btn hot" data-share="coin" data-mint="${esc(mint)}" data-sym="${esc(sym)}">𝕏 ${t('wz_share')}</button><button type="button" class="btn" id="wzGo">${t('wz_goto')}</button></div></div>`;
  const cp = $('#wzCopy'); if (cp) cp.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(mint); cp.textContent = t('wz_copied'); });
  const b = a && a.booth;
  $('#wzGo').addEventListener('click', () => { closeModals(); if (player && b) { player.obj.position.set(b.x, 0, b.z + 2.7); player.obj.rotation.y = Math.PI; moveTarget = null; autoWalk = null; cam.yaw = 0; snapCamera(); } });
  if (b) confetti(_w.set(b.x, 1.4, b.z + 1), 60);
  toast(t('launched_real', { s: '$' + sym }), 'gold', true);
}
function launchPaid() { const p = store.get('cc_launch_pay', null); return p && p.sig && Date.now() - p.at < 3 * 864e5 ? p : null; }
async function submitLaunch() {
  const name = (draft.name || '').toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(name)) { $('#fErr').textContent = t('err_name'); wzStep = 1; openLaunch(true); return; }
  const paid = launchPaid();
  if (!paid && agents.some(a => a.booth && a.sym === name)) { $('#fErr').textContent = t('err_taken'); return; }
  if (!draft.agree) { $('#fErr').textContent = t('wz_err_agree'); return; }
  if (NET.http && !NET.ready) { $('#fErr').textContent = t('wz_wait_net'); return; }
  const live = !!(NET.http && NET.cfg.live), btn = $('#fSubmit'); btn.disabled = true; $('#fErr').textContent = '';
  const steps = 2 + (live && NET.cfg.launchFee ? 1 : 0) + (live && draft.firstBuy > 0 ? 1 : 0); let st = 0, mint = null;
  if (live) {
    try {
      // a fee that was already paid (earlier attempt, closed tab, dropped connection) is reused: one payment = one coin, never two charges
      let paymentSig = null;
      if (NET.cfg.launchFee) {
        if (paid) { wzProgress(++st, steps, t('wz_p1_kept')); paymentSig = paid.sig; }
        else { const vipDesk = !!(draft.booth && draft.booth.vip), total = NET.cfg.launchFee + (vipDesk ? (NET.cfg.vipDeskFee || 0) : 0); wzProgress(++st, steps, t('wz_p1')); paymentSig = await paySol(total, s => store.set('cc_launch_pay', { sig: s, at: Date.now(), sym: name, vip: vipDesk })); store.set('cc_launch_pay', { sig: paymentSig, at: Date.now(), sym: name, vip: vipDesk }); }
      }
      wzProgress(++st, steps, t('wz_p2'));
      const payload = { name: draft.title || name, symbol: name, description: draft.desc || '', image: draft.image || THUMBS[draft.body] || '', twitter: draft.x, telegram: draft.tg, website: draft.web, body: draft.body, by: myName(), paymentSig, vip: !!(paid ? paid.vip : (draft.booth && draft.booth.vip)) };
      let res = null;
      for (let i = 0; i < 5; i++) {
        res = await netLaunch(payload);
        if (res.mint) break;
        if (res.code === 'pay_used' || res.code === 'pay_bad' || res.code === 'pay_missing') { store.set('cc_launch_pay', null); break; }
        if (res.code !== 'retry' && res.code !== 'pay_wait') break;
        wzProgress(st, steps, t('wz_p2_wait')); await new Promise(r => setTimeout(r, 8000));
      }
      if (!res || !res.mint) {
        NET.launching = null; btn.disabled = false;
        if (launchPaid()) { $('#fErr').textContent = ''; wzProgress(st, steps, t('wz_pending_note')); btn.textContent = t('wz_relaunch'); watchPendingLaunch(); }
        else $('#fErr').textContent = res && res.error || t('wz_fail');
        return;
      }
      store.set('cc_launch_pay', null); addMyCoin(res.mint); gainXP(500, 'launch');
      mint = res.mint;
    } catch (err) { btn.disabled = false; NET.launching = null; if (launchPaid()) { wzProgress(st, steps, t('wz_pending_note')); btn.textContent = t('wz_relaunch'); watchPendingLaunch(); } else $('#fErr').textContent = String(err.message || err); return; }
  } else wzProgress(++st, steps, t('wz_p2s'));
  wzProgress(++st, steps, t('wz_p3'));
  let a = mint ? agents.find(x => x.mint === mint) : null;
  if (!a) {
    const b = (draft.booth && !draft.booth.agent) ? draft.booth : freeBooth(false); if (!b) { $('#fErr').textContent = t('wz_full'); btn.disabled = false; NET.launching = null; return; }
    a = newAgent(name, draft.body, { mine: true, by: myName(), at: Date.now(), title: draft.title || name, mint, image: draft.image || null, desc: draft.desc || '', socials: { x: draft.x, tg: draft.tg, web: draft.web }, vip: !!b.vip, wallet: NET.wallet || '' });
    agents.push(a); seatAgent(a, b); feedPush({ kind: 'launch', a, at: Date.now() });
  } else { a.mine = true; updateAgentTag(a); }
  NET.launching = null; setFeatured(a, true); drawWorldScreens(time);
  if (mint && draft.firstBuy > 0) { wzProgress(++st, steps, t('wz_p4')); try { await tradeToken(mint, 'buy', draft.firstBuy); } catch (err) { toast(t('tr_fail', { e: String(err.message || err).slice(0, 80) })); } }
  const b = a.booth; if (b) confetti(_w.set(b.x, 1.4, b.z + 1), 60);
  $('#launchBody').innerHTML = `<div class="wz-done"><div class="land-chip">${mint ? t('wz_done') : t('wz_done_test')}</div><h3>$${esc(name)} · ${esc(a.title)}</h3>${pfCard()}
    ${mint ? `<div class="wz-ca"><span class="lab">${t('wz_ca')}</span><code>${esc(mint)}</code><button type="button" class="btn small" id="wzCopy">${t('wz_copy')}</button></div><div class="ca"><a href="https://pump.fun/coin/${esc(mint)}" target="_blank" rel="noopener">pump.fun ↗</a> · <a href="https://dexscreener.com/solana/${esc(mint)}" target="_blank" rel="noopener">dexscreener ↗</a> · <a href="https://solscan.io/token/${esc(mint)}" target="_blank" rel="noopener">solscan ↗</a></div>` : `<div class="note-box">${NET.http ? t('wz_soon_note') : t('wz_sim_note')}</div>`}
    <div class="row">${mint ? `<a class="btn hot" href="https://x.com/intent/post?text=${encodeURIComponent(`$${name} just launched at Trench Cafe. CA: ${mint} · https://pump.fun/coin/${mint}`)}" target="_blank" rel="noopener">${t('wz_share')}</a>` : ''}<button type="button" class="btn" id="wzGo">${t('wz_goto')}</button></div></div>`;
  const cp = $('#wzCopy'); if (cp) cp.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(mint); cp.textContent = t('wz_copied'); });
  $('#wzGo').addEventListener('click', () => { closeModals(); if (player && b) { player.obj.position.set(b.x, 0, b.z + 2.7); player.obj.rotation.y = Math.PI; moveTarget = null; autoWalk = null; cam.yaw = 0; snapCamera(); } });
  toast(mint ? t('launched_real', { s: '$' + name }) : t('launched_test', { s: '$' + name }), mint ? 'gold' : 'cyan', true);
  draft.name = ''; draft.title = ''; draft.desc = ''; draft.image = null; draft.agree = false; draft.firstBuy = 0; draft.booth = null; wzStep = 1;
}

function openHow() {
  showModal('mHow');
  $('#howBody').innerHTML = `<h3>${t('how_title')}</h3><p class="sub" style="max-width:70ch">${t('how_lede')}</p>
    <h4>${t('how_loop')}</h4>
    <ol class="steps">${[1, 2, 3, 4, 5].map(i => `<li><b>${t('l' + i)}</b>${t('l' + i + 'd')}</li>`).join('')}</ol>
    <h4>${t('how_evo')}</h4><p class="muted" style="margin:0 0 10px;font-size:14px;max-width:70ch">${t('how_evo_d')}</p>
    <div class="evo">${STAGES.map(s => `<div class="${s.id}"><span>${s.id === 'famous' ? '100%' : s.at + '%'}</span><b>${t('st_' + s.id)}</b>${t('e_' + s.id)}</div>`).join('')}</div>
    <h4>${t('how_world_t')}</h4><p class="muted" style="margin:0;font-size:14px;max-width:70ch">${t('how_world')}</p>
    <div class="places">${['market', 'launchpad', 'billboard', 'arcade', 'casino', 'gym', 'sushi', 'well', 'xtower', 'quest', 'vault', 'studio', 'nest', 'docks', 'pond'].map(id => `<button type="button" data-place="${id}"><b>${t('pl_' + id)}</b><small>${t('pd_' + id)}</small></button>`).join('')}</div>
    <p class="note-box" style="margin-top:18px">${NET.http ? (NET.cfg.live ? t('how_note_live') : t('how_note_test')) : t('how_note')}</p>`;
}

/* ================= places ================= */
function coinRow(a, i) { return `<button type="button" class="lr" data-agent="${a.id}"><span class="n">${i + 1}</span><span class="nm"><img class="mini" src="${esc(a.image || TH(a.body))}" alt="">$${esc(a.sym)}</span><span class="mc">${mcapText(a)}</span><span class="bar"><i style="width:${Math.min(100, a.bond)}%;${a.bonded ? 'background:var(--gold)' : ''}"></i></span></button>`; }
function openPlace(id) {
  if (id === 'cafe') return;
  if (id.startsWith('cab_')) { const k = id.slice(4); if (RK_GAMES.includes(k)) rkOpenGame(k); else startCasino(k); return; }   // the machines in the cafe
  if (id === 'how') return openHow();
  if (id === 'bar') return openBar();
  if (id === 'week') return openWeek();
  if (id === 'bigscreen') return featured ? openBooth(featured) : openLaunch();
  openPlaceId = id; showModal('mPlace');
  const head = `<h3>${t('pl_' + id)}</h3><p class="sub">${t('pd_' + id)}</p>`;
  const lead = agents.slice().sort((a, b) => mcapFor(b) - mcapFor(a)).slice(0, 10), none = `<div class="empty-state"><b>${t('lead_empty_t')}</b><p>${t('feed_empty')}</p><button type="button" class="btn hot small" data-open="launch">${t('launch')}</button></div>`;
  let body = '';
  switch (id) {
    case 'market': { const trades = feed.filter(f => f.kind === 'buy' || f.kind === 'sell').slice(0, 12); body = lead.length ? `<div class="two"><div><h4 class="h4">${t('mk_lead')}</h4>${lead.map(coinRow).join('')}</div><div><h4 class="h4">${t('mk_trades')}</h4>${trades.length ? trades.map(feedHTML).join('') : `<p class="muted">${t('no_trades_yet')}</p>`}</div></div>` : none; break; }
    case 'launchpad': { const recent = agents.slice().sort((a, b) => b.at - a.at).slice(0, 10); body = `<div class="row" style="margin-top:0"><button type="button" class="btn hot" data-open="launch">${t('launch')}</button></div>${NET.http ? leagueStandingsHTML() : ''}${recent.length ? `<h4 class="h4">${t('lp_recent')}</h4>` + recent.map(coinRow).join('') : ''}`;
      if (NET.http) { const stamp = LG.at; leagueFetch().then(() => { if (LG.at !== stamp && openPlaceId === 'launchpad' && !$('#mPlace').hidden) openPlace('launchpad'); }); } break; }
    case 'billboard': { const a = featured || agents.slice().sort((p, q) => q.at - p.at)[0]; body = a ? `<div class="bb-now"><div class="ad"><img src="${esc(a.image || TH(a.body))}" alt=""><div><b>$${esc(a.sym)}</b><p>${esc(a.title || '')}</p><p class="muted">${mcapText(a)}</p></div></div></div><div class="row"><button type="button" class="btn small" data-agent="${a.id}">${t('open_coin')}</button></div>` : none; break; }
    case 'casino': body = casinoHTML(); break;
    case 'quest': { const n = candlesFound().length, ns = eggsSeen().length; body = huntPanelHTML() + `<div class="candle-q story-q"><b>${t('egg_hunt_t')}</b><div class="story-bar"><i style="width:${Math.round(ns / Math.max(1, EGGS.length) * 100)}%"></i></div><p class="muted">${t('egg_hunt_d', { n: ns, of: EGGS.length })}</p>${(() => { const left = EGGS.filter(e => !e.seen && e.hint); if (!left.length) return ''; const pick3 = left.slice(0, 40).sort((a, b) => (a.text.length * 7 + a.pos.x) % 13 - (b.text.length * 7 + b.pos.x) % 13).slice(0, 4); return `<div class="egg-clues"><small>${t('egg_clues')}</small>${pick3.map(e => `<span>${esc(e.hint)}</span>`).join('')}</div>`; })()}</div><div class="candle-q"><b>${t('candle_t')}</b><div class="cq-row">${CANDLE_SPOTS.map((_, i) => `<i class="${candlesFound().includes(i) ? 'on' : ''}"></i>`).join('')}</div><p class="muted">${n >= CANDLE_SPOTS.length ? t('candle_all') : t('candle_d', { n, of: CANDLE_SPOTS.length })}</p></div>`; break; }
    case 'arcade': body = arcadeRankedHTML() + `<h4 class="h4">${t('rk_free_t')}</h4><div class="games">${[['clash', 'g_clash'], ['catch', 'g_catch'], ['fish', 'g_fish'], ['run', 'g_run'], ['claw', 'g_claw']].map(([g, k]) => `<div class="gcard ${g}"><b>${t(k)}</b><small>${t(k + '_d')}</small><button type="button" class="btn small hot" data-game="${g}">${t('g_start')}</button></div>`).join('')}</div>`; break;
    default: { const here = outside.filter(a => a.placeNow === id); body = here.length ? `<h4 class="h4">${t('world_now')}</h4>` + here.map(coinRow).join('') : ''; }
  }
  $('#placeBody').innerHTML = head + body;
  document.querySelectorAll('[data-game]').forEach(b => b.addEventListener('click', () => startGame(b.dataset.game)));
}

/* ================= world screens: only real coins, real trades ================= */
const MONO = "'JetBrains Mono', monospace";
function featuredStats(a) {
  const real = !!a.mint;
  const trades = a.trades.slice(0, 6).map(tx => ({ side: tx.side, amt: (+tx.sol || 0).toFixed(2) + ' SOL', who: tx.trader ? shortW(tx.trader) : '' }));
  return { real, pct: real ? (a.bonded ? 100 : a.bond) : 0, mcap: real ? mcapText(a) : t('test_tag'), trades, traders: a.holders };
}
function fitFont(ctx, txt, w, px, fam, maxW) { do { ctx.font = `${w} ${px}px ${fam}`; px -= 2; } while (px > 12 && ctx.measureText(txt).width > maxW); }
function coinThumb(ctx, a, x, y, s, r) { const im = imgOf(a); ctx.save(); rr(ctx, x, y, s, s, r); ctx.clip(); if (im) ctx.drawImage(im, x, y, s, s); else { ctx.fillStyle = '#141416'; ctx.fillRect(x, y, s, s); } ctx.restore(); }
function emptyBoard(ctx, W_, H_, title, sub) {
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(W_ / 17)}px Unbounded, sans-serif`; ctx.fillText(title, W_ / 2, H_ / 2 + 4);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `600 ${Math.round(W_ / 34)}px ${MONO}`; ctx.fillText(sub, W_ / 2, H_ / 2 + W_ / 17); ctx.textAlign = 'left';
}
function drawBigScreen() {
  const bt = townFx.bigTex; if (!bt) return; const ctx = bt.userData.ctx, W_ = 1024, H_ = 460;
  const g = ctx.createLinearGradient(0, 0, W_, H_); g.addColorStop(0, '#0d0d10'); g.addColorStop(1, '#09090a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W_, H_);
  ctx.strokeStyle = 'rgba(189,184,173,.1)'; ctx.lineWidth = 1; for (let x = 0; x < W_; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H_); ctx.stroke(); } for (let y = 0; y < H_; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W_, y); ctx.stroke(); }
  ctx.textBaseline = 'alphabetic';
  const chip = (txt, x, y, bg, fg) => { ctx.font = `700 15px ${MONO}`; const w = ctx.measureText(txt).width + 28; ctx.fillStyle = bg; rr(ctx, x, y, w, 32, 4); ctx.fill(); ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.fillText(txt, x + 14, y + 22); return w; };
  const a = featured;
  if (!a) {
    chip(t('big_title'), 32, 28, '#fff', '#000');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; fitFont(ctx, t('big_wait'), 900, 50, 'Unbounded, sans-serif', W_ - 96); ctx.fillText(t('big_wait'), W_ / 2, 236);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `600 19px ${MONO}`; ctx.fillText(t('big_wait_sub'), W_ / 2, 286); ctx.textAlign = 'left';
    bt.needsUpdate = true; return;
  }
  const st = featuredStats(a), fresh = Date.now() - featuredAt < 20 * 60e3;
  let x = 32 + chip(t('big_title'), 32, 28, '#fff', '#000') + 10;
  const blink = Math.floor(Date.now() / 600) % 2 === 0;
  chip((fresh && blink ? '● ' : '○ ') + (st.real ? (a.bonded ? t('bonded_tag') : t('big_live_badge')) : t('chart_test')), x, 28, st.real ? '#8fd3a6' : 'rgba(255,255,255,.12)', st.real ? '#06240f' : '#fff');
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `600 15px ${MONO}`; ctx.textAlign = 'right'; ctx.fillText(ago(a.at) + ' ' + t('ago'), W_ - 32, 50);
  coinThumb(ctx, a, 32, 84, 200, 18);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fitFont(ctx, '$' + a.sym, 900, 60, 'Unbounded, sans-serif', 430); ctx.fillText('$' + a.sym, 262, 146);
  ctx.font = "600 24px Onest, sans-serif"; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText((a.title && a.title !== a.sym ? a.title : '').slice(0, 26), 262, 184);
  ctx.font = `600 15px ${MONO}`; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText((t('big_by') + ' ' + (a.by || t('someone'))).toUpperCase().slice(0, 34), 262, 214);
  if (st.real) {
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `600 13px ${MONO}`; ctx.fillText(t('big_curve').toUpperCase(), 262, 256);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, 262, 266, 420, 20, 10); ctx.fill(); if (st.pct > 0) { ctx.fillStyle = st.pct >= 100 ? '#c8a96a' : '#8fd3a6'; rr(ctx, 262, 266, Math.max(14, 420 * st.pct / 100), 20, 10); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = `800 17px ${MONO}`; ctx.textAlign = 'right'; ctx.fillText(a.vSol || a.bonded ? st.pct.toFixed(1) + '%' : '—', 682, 256); ctx.textAlign = 'left';
  } else { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `600 15px ${MONO}`; ctx.fillText(t('chart_test_note').slice(0, 52), 262, 272); }
  // right column: market cap + chart
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `600 13px ${MONO}`; ctx.fillText(t('k_mcap').toUpperCase() + (st.real && st.traders ? ' · ' + t('k_traders').toUpperCase() + ' ' + st.traders : ''), 716, 104);
  ctx.fillStyle = '#fff'; ctx.font = "700 40px Unbounded, sans-serif"; ctx.fillText(st.mcap, 716, 150);
  const d = chartData(a);
  ctx.fillStyle = 'rgba(255,255,255,.04)'; rr(ctx, 716, 168, 276, 118, 10); ctx.fill();
  if (d) drawSeries(ctx, 724, 176, 260, 102, d, true);
  else { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `600 13px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText(st.real ? t('chart_first') : t('chart_test'), 854, 232); ctx.textAlign = 'left'; }
  // trades strip
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `600 13px ${MONO}`; ctx.fillText(t('big_trades').toUpperCase(), 32, 330);
  let tx = 32; for (const tr of st.trades) { const buy = tr.side !== 'sell'; const txt = (buy ? 'BUY ' : 'SELL ') + tr.amt + (tr.who ? ' · ' + tr.who : ''); ctx.font = `700 15px ${MONO}`; const w = ctx.measureText(txt).width + 26; if (tx + w > W_ - 32) break; ctx.fillStyle = buy ? 'rgba(143,211,166,.16)' : 'rgba(217,112,122,.16)'; rr(ctx, tx, 344, w, 34, 6); ctx.fill(); ctx.fillStyle = buy ? '#8fd3a6' : '#d9707a'; ctx.textAlign = 'left'; ctx.fillText(txt, tx + 13, 367); tx += w + 8; }
  if (!st.trades.length) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `600 15px ${MONO}`; ctx.fillText(st.real ? t('big_no_trades') : t('test_no_trades'), 32, 367); }
  if (a.mint) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = `600 14px ${MONO}`; ctx.textAlign = 'left'; ctx.fillText('CA ' + a.mint, 32, 428); }
  bt.needsUpdate = true;
}
const byCap = () => agents.filter(a => a.booth).sort((p, q) => mcapFor(q) - mcapFor(p) || q.at - p.at);
function drawWorldScreens(time) {
  const ld = townFx.leaderTex;
  if (NET.http && playing) { leagueFetch(); leagueTrophyDraw(); }
  if (ld && leagueBoardDraw(ld.userData.ctx)) ld.needsUpdate = true;
  else if (ld) {
    const ctx = ld.userData.ctx; ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = '#c8a96a'; ctx.font = "700 26px Unbounded, 'Arial Black', sans-serif"; ctx.textAlign = 'left'; ctx.fillText('TOP COINS', 20, 44);
    ctx.fillStyle = '#8a877f'; ctx.font = `600 15px ${MONO}`; ctx.fillText('launched here · market cap', 20, 68);
    const lead = byCap().slice(0, 7);
    if (!lead.length) emptyBoard(ctx, 512, 400, 'NO COINS YET', 'be the first: launch desk, press E');
    lead.forEach((a, i) => {
      const y = 108 + i * 38;
      ctx.fillStyle = i === 0 ? '#c8a96a' : i === 1 ? '#c9ccd6' : i === 2 ? '#c9a85c' : '#3a3160'; ctx.beginPath(); ctx.arc(34, y - 7, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#0b0b0c'; ctx.font = "700 15px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText(i + 1, 34, y - 2); ctx.textAlign = 'left';
      coinThumb(ctx, a, 56, y - 24, 30, 6);
      ctx.fillStyle = '#ece9e2'; ctx.font = `700 19px ${MONO}`; ctx.fillText('$' + a.sym, 96, y);
      ctx.fillStyle = '#8a877f'; ctx.font = `600 13px ${MONO}`; ctx.fillText(!a.mint ? 'TEST' : a.by ? '@' + a.by.slice(0, 12) : 'pump.fun', 96, y + 15);
      ctx.fillStyle = a.bonded ? '#c8a96a' : a.mint ? '#8fd3a6' : '#9c988f'; ctx.textAlign = 'right'; ctx.font = `700 19px ${MONO}`; ctx.fillText(a.mint ? mcapText(a) : '—', 492, y); ctx.textAlign = 'left';
    });
    ld.needsUpdate = true;
  }
  rkBoard3d();
  const mk = townFx.marketTex;
  if (mk) {
    const ctx = mk.userData.ctx; ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#bdb8ad'; ctx.font = `700 18px ${MONO}`; ctx.textAlign = 'left'; ctx.fillText('MARKET CAP', 16, 30);
    const lead = byCap().filter(a => a.mint).slice(0, 5);
    if (!lead.length) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = `600 15px ${MONO}`; ctx.fillText('no coins yet', 16, 62); }
    lead.forEach((a, i) => { ctx.fillStyle = '#ece9e2'; ctx.font = `600 17px ${MONO}`; ctx.fillText((i + 1) + '  $' + a.sym.slice(0, 8), 16, 62 + i * 26); ctx.fillStyle = a.bonded ? '#c8a96a' : '#9c988f'; ctx.textAlign = 'right'; ctx.fillText(mcapText(a), 250, 62 + i * 26); ctx.textAlign = 'left'; });
    ctx.fillStyle = '#8fd3a6'; ctx.font = `700 18px ${MONO}`; ctx.fillText('LIVE TRADES', 280, 30);
    const trades = feed.filter(f => f.kind === 'buy' || f.kind === 'sell').slice(0, 7);
    if (!trades.length) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = `600 15px ${MONO}`; ctx.fillText('no trades yet', 280, 62); }
    trades.forEach((f, i) => { ctx.fillStyle = f.kind === 'buy' ? '#8fd3a6' : '#d9707a'; ctx.font = `600 14px ${MONO}`; ctx.fillText(f.kind.toUpperCase(), 280, 60 + i * 24); ctx.fillStyle = '#d6d1c7'; ctx.fillText('$' + f.a.sym.slice(0, 7) + ' ' + f.sol.toFixed(2), 330, 60 + i * 24); });
    mk.needsUpdate = true;
  }
  const latest = agents.slice().sort((p, q) => q.at - p.at)[0];
  const xt = townFx.xTex;
  if (xt) {
    const ctx = xt.userData.ctx; ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#bdb8ad'; ctx.font = `700 18px ${MONO}`; ctx.textAlign = 'left'; ctx.fillText('LATEST LAUNCH', 20, 34);
    if (!latest) emptyBoard(ctx, 512, 290, 'NOTHING YET', 'launches show up here live');
    else { coinThumb(ctx, latest, 20, 56, 150, 14); ctx.fillStyle = '#fff'; ctx.font = "700 38px Unbounded, sans-serif"; ctx.fillText('$' + latest.sym.slice(0, 8), 190, 104); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = "600 20px Onest, sans-serif"; ctx.fillText((latest.title || '').slice(0, 24), 190, 136); ctx.fillStyle = '#8a877f'; ctx.font = `600 15px ${MONO}`; ctx.fillText((latest.mint ? 'pump.fun · ' : 'test · ') + ago(latest.at) + ' ago', 190, 166); if (latest.by) ctx.fillText('by ' + latest.by.slice(0, 16), 190, 190); }
    xt.needsUpdate = true;
  }
  const bb = townFx.billTex;
  if (bb) {
    const ctx = bb.userData.ctx, a = featured || latest;
    const g = ctx.createLinearGradient(0, 0, 1024, 512); g.addColorStop(0, '#0d0d10'); g.addColorStop(1, '#1c1c22'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
    if (a) {
      const st = featuredStats(a); coinThumb(ctx, a, 40, 40, 430, 24);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fitFont(ctx, '$' + a.sym, 900, 76, 'Unbounded, sans-serif', 490); ctx.fillText('$' + a.sym, 500, 150);
      ctx.font = `700 26px ${MONO}`; ctx.fillStyle = st.real ? '#8fd3a6' : 'rgba(255,255,255,.6)'; ctx.fillText(st.real ? 'LIVE ON PUMP.FUN' : 'TEST · NOT ON PUMP.FUN', 500, 205);
      if (st.real) { ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, 500, 300, 460, 26, 13); ctx.fill(); if (st.pct > 0) { ctx.fillStyle = st.pct >= 100 ? '#c8a96a' : '#8fd3a6'; rr(ctx, 500, 300, Math.max(16, 460 * st.pct / 100), 26, 13); ctx.fill(); } ctx.fillStyle = '#fff'; ctx.font = "700 44px Unbounded, sans-serif"; ctx.fillText(st.mcap, 500, 410); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `600 22px ${MONO}`; ctx.fillText('BONDING CURVE ' + (a.vSol || a.bonded ? st.pct.toFixed(0) + '%' : '—'), 500, 456); }
    } else { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; fitFont(ctx, 'YOUR COIN HERE', 900, 84, 'Unbounded, sans-serif', 940); ctx.fillText('YOUR COIN HERE', 512, 250); ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = `600 28px ${MONO}`; ctx.fillText('launch it on pump.fun from the cafe', 512, 316); ctx.textAlign = 'left'; }
    bb.needsUpdate = true;
  }
  const qt = townFx.questTex;
  if (qt && !qt.userData.static) {
    qt.userData.static = true; const ctx = qt.userData.ctx; ctx.fillStyle = '#6b4a2e'; ctx.fillRect(0, 0, 512, 300);
    ctx.fillStyle = '#fff3c4'; ctx.font = "700 26px Unbounded, sans-serif"; ctx.textAlign = 'left'; ctx.fillText('HOW TO LAUNCH', 20, 40);
    [['1 · walk in', 'cafe, launch desk'], ['2 · name it', 'ticker + picture'], ['3 · sign', 'Phantom wallet'], ['4 · live', 'on pump.fun']].forEach(([h, p], i) => { const x = 20 + (i % 2) * 250, y = 60 + Math.floor(i / 2) * 116; ctx.fillStyle = ['#fff27a', '#a9b8ff', '#ffb3d9', '#c9ffb3'][i]; ctx.fillRect(x, y, 230, 100); ctx.fillStyle = '#0a0a1e'; ctx.font = `800 19px ${MONO}`; ctx.fillText(h, x + 12, y + 38); ctx.font = `600 16px ${MONO}`; ctx.fillText(p, x + 12, y + 70); });
    qt.needsUpdate = true;
  }
  const it = townFx.indexTex;
  if (it) {
    const ctx = it.userData.ctx; ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = '#bdb8ad'; ctx.font = `700 18px ${MONO}`; ctx.textAlign = 'left'; ctx.fillText('CAFE BOARD', 14, 28);
    const real = agents.filter(a => a.mint);
    [['COINS', real.length], ['GRADUATED', real.filter(a => a.bonded).length], ['TRADES SEEN', STAT.trades]].forEach(([k, v], i) => { const x = 14 + i * 166; ctx.fillStyle = '#fff'; ctx.font = "700 46px Unbounded, sans-serif"; ctx.fillText(String(v), x, 110); ctx.fillStyle = '#8a877f'; ctx.font = `600 14px ${MONO}`; ctx.fillText(k, x, 140); });
    it.needsUpdate = true;
  }
}
function worldAnim(dt, time) {
  worldAnimExtra(dt, time);
  if (townFx.jet) { townFx.jetT = Math.max(0, (townFx.jetT || 0) - dt); const k = 1 + (townFx.jetT > 0 ? 1.4 : 0) + Math.sin(time * 6) * 0.08; townFx.jet.scale.set(k, k, k); townFx.jet.position.y = 3.4 + (k - 1) * 0.6; }
  if (townFx.beacon) { townFx.beaconT = Math.max(0, (townFx.beaconT || 0) - dt); townFx.beacon.material.emissiveIntensity = townFx.beaconT > 0 ? (Math.sin(time * 20) > 0 ? 3 : 0.4) : (Math.sin(time * 2) > 0.8 ? 2 : 0.5); }
  if (townFx.fireL) { townFx.fireT = Math.max(0, (townFx.fireT || 0) - dt); townFx.fireL.intensity = townFx.fireT > 0 ? 30 + Math.sin(time * 30) * 10 : 0; }
  if (townFx.rocket) { if (townFx.rocketT > 0) { townFx.rocketT -= dt; const u = 4.5 - townFx.rocketT; townFx.rocket.position.y = 0.3 + u * u * 3; townFx.flame.visible = true; townFx.flame.scale.y = 1 + Math.sin(time * 40) * 0.3; if (Math.random() < 0.7) spawnParticle(_w.set(PLACES.launchpad.x + rand(-0.4, 0.4), townFx.rocket.position.y + 0.3, PLACES.launchpad.z + rand(-0.4, 0.4)), 'smoke', new THREE.Vector3(rand(-1, 1), rand(0.2, 1), rand(-1, 1))); if (townFx.rocketT <= 0) { townFx.rocket.position.y = 0.3; townFx.flame.visible = false; } } }
  if (townFx.marquee) townFx.marquee.forEach((b, i) => b.material.emissiveIntensity = (Math.floor(time * 6) + i) % 3 === 0 ? 2.2 : 0.4);
  candleTick(time); casinoAnim(dt, time); eggMarkersTick(time); flairTick(time); huntTick(time);
  if (townFx.casinoBulbs) townFx.casinoBulbs.forEach((b, i) => b.visible = (Math.floor(time * 5) + i) % 4 !== 0);
  if (townFx.waveTex) townFx.waveTex.offset.x = time * 0.03;
  if (townFx.boat) { townFx.boat.position.y = 0.1 + Math.sin(time * 1.5) * 0.08; townFx.boat.rotation.z = Math.sin(time * 1.2) * 0.05; townFx.boat.position.x = 12 + Math.sin(time * 0.2) * 6; }
  if (townFx.egg && townFx.egg.visible) townFx.egg.rotation.z = Math.sin(time * 14) * 0.15;
}
/* zone label */
let zoneId = '';
function zoneOf(p) { if (p.z < ROOM.zf + 0.3) return 'cafe'; if (p.z > TOWN.zf - 6) return 'docks'; if (p.x < -28 && p.z > 58) return 'park'; if (p.x > 32 && p.z > 50) return 'arcade'; if (p.x > 33 && p.z > 37) return 'casino'; if (p.x > 38 && p.z > 20 && p.z < 32) return 'gym'; if (p.x < -38 && p.z > 20 && p.z < 32) return 'sushi'; return 'town'; }
function updateZone() {
  if (!player || !playing) return; const z = zoneOf(player.obj.position);
  if (z !== zoneId) { zoneId = z; const el = $('#zone'); el.textContent = t('zone_' + z); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
}

/* ================= loop ================= */
/* automatic quality: when the frame rate stays under ~26 fps for a few seconds while playing, the picture is simplified one step at a time
   (render scale, then bloom, then shadows). Strong machines never notice; weak ones stop lagging and still get the same world. */
const AQ = { step: 0, slow: 0, fast: 0, last: 0 };
function autoQuality() {
  const now = performance.now(), gap = now - AQ.last; AQ.last = now;
  if (!playing || AQ.step >= 3 || document.hidden || gap > 1500 || !gap) return;   // a tab switch or a modal pause is not lag
  if (gap > 38) { AQ.slow += Math.min(gap, 400); AQ.fast = 0; } else { AQ.fast += gap; if (AQ.fast > 2000) AQ.slow = 0; }
  if (AQ.slow < 3000) return;
  AQ.slow = 0; AQ.step++;
  if (AQ.step === 1) { renderer.setPixelRatio(1); composer.setPixelRatio(1); resize(); }
  else if (AQ.step === 2) bloom.enabled = false;
  else if (AQ.step === 3) { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse(o => { if (o.isMesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); }); }
  PERF.quality = AQ.step;
}
function resize() { VW = innerWidth; VH = innerHeight; renderer.setSize(VW, VH, false); composer.setSize(VW, VH); bloom.setSize(VW, VH); if (smaa) smaa.setSize(VW, VH); camera.aspect = VW / VH; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
setInterval(() => renderSide(), 1000);
setInterval(() => { if (openAgent) fillBooth(openAgent); }, 1500);
setInterval(() => drawWorldScreens(time), 2500);
setInterval(() => { if (introPhase !== 'boot') drawBigScreen(); }, 1000);   // real time, not game time: slow devices still see fresh numbers
const clock = new THREE.Clock();
let screenRR = 0, time = 0;
let frames = 0;
const PERF = { logic: 0, render: 0 };   // smoothed milliseconds per frame, for the test hooks and the debug overlay
function frame() {
  frames++; const pf0 = performance.now();
  const dt = Math.min(0.05, clock.getDelta()); time += dt;
  if (camMode === 'cine') cineFrame(dt); else if (camMode === 'select') selectFrame(dt, time); else if (camMode === 'orbit') { if (introPhase === 'boot') { camera.position.set(Math.sin(time * 0.045) * 12.5, 3.6 + Math.sin(time * 0.11) * 0.5, -1 + Math.cos(time * 0.045) * 11.5); camera.lookAt(0, 1.5, -3); } else { camera.position.set(Math.sin(time * 0.06) * 19, 10.5, -2 + Math.cos(time * 0.06) * 17); camera.lookAt(0, 1, -4); } }
  updatePlayer(dt); updateNPCs(dt); updateOutside(dt); worldClock(dt); updateDoors(dt); netTick(dt);
  let avK = 0;
  for (const av of avatars) {
    avK++;
    if (!av.obj.visible) continue;   // culled far players cost nothing
    if (av !== player && avK % 3 !== frames % 3 && av.obj.position.distanceToSquared(camera.position) > 900) { av.phase += dt * (av.state === 'run' ? 13 : av.state === 'walk' ? 9 : 3) * 0; continue; }   // far avatars animate every third frame
    if (av.emoteT > 0) { av.emoteT -= dt; if (av.rain) { av.rain = false; av.obj.userData.P.armR.userData.hand.getWorldPosition(_w); spawnParticle(_w, 'bill'); } if (av.hearts) { av.hearts = false; _w.copy(av.obj.position); _w.y += av.tagH * 0.7; _w.x += rand(-0.4, 0.4); spawnParticle(_w, 'heart', new THREE.Vector3(rand(-0.6, 0.6), rand(1.2, 2.4), rand(-0.6, 0.6))); } if (av.flash) { av.flash = false; popText(_w.copy(av.obj.position).setY(av.tagH + 0.2), 'flash!', 'gold'); } }
    animateRig(av, dt, time); updateCompanion(av, dt, time);
  }
  if (Math.random() < dt * 0.6) { const b = pick(booths); if (b.avatar && b.agent && b.avatar.state === 'dance') b.avatar.emote(); }
  updateParticles(dt); worldAnim(dt, time);
  updateCamera(dt, time);
  const showTags = camMode === 'play' || camMode === 'cine';
  const TAG_D = TOUCH ? 12 : 15;
  for (const b of booths) if (b.avatar) placeTag(b.avatar.tag, _w.copy(b.avatar.obj.position).setY(b.avatar.obj.position.y + (b.avatar.state === 'sit' || b.avatar.state === 'sleep' ? b.avatar.tagH - 0.35 : b.avatar.tagH * (b.agent?.outside ? outsideScale(b.agent) : 1) + 0.1)), showTags ? (b.avatar.tag.lastElementChild && b.avatar.tag.lastElementChild.classList.contains('bubble') ? 26 : TAG_D) : 0);
  for (const n of npcs) placeTag(n.tag, _w.copy(n.obj.position).setY(n.tagH), showTags ? (TOUCH ? 11 : 14) : 0);
  for (const r of NET.remote.values()) if (r.av && r.av.obj.visible) placeTag(r.av.tag, _w.copy(r.av.obj.position).setY(r.av.tagH), showTags ? 30 : 0);
  if (player) placeTag(player.tag, _w.copy(player.obj.position).setY(player.obj.position.y + player.tagH), camMode === 'play' ? 99 : 0);
  for (let i = 0; i < 3; i++) { screenRR = (screenRR + 1) % booths.length; drawScreen(booths[screenRR]); }
  if (time - (townFx.bigAt || 0) > 1 && introPhase !== 'boot') { townFx.bigAt = time; if (townFx.bigLight) townFx.bigLight.intensity = featured && Date.now() - featuredAt < 20 * 60e3 ? 26 + Math.sin(time * 3) * 6 : 14; }
  if (gameActive) gameTick(dt, time);
  updateProximity(); updateZone(); guiTick(time); socialTick(time);
  if (player && playing) { const pp = player.obj.position; sun.position.set(pp.x + 6, 14, pp.z + 10); sun.target.position.set(pp.x, 0, pp.z); } else if (camMode === 'select') { sun.position.set(STAGE.x + 6, 14, STAGE.z + 10); sun.target.position.set(STAGE.x, 0, STAGE.z); } else { sun.position.set(camera.position.x + 6, 14, camera.position.z); sun.target.position.set(camera.position.x, 0, camera.position.z - 10); }
  gradePass.uniforms.uTime.value = time % 100;
  const pf1 = performance.now(); PERF.logic += (pf1 - pf0 - PERF.logic) * 0.05;
  autoQuality();
  if (introPhase !== 'boot' || LAND3D) composer.render();   // the landing covers the canvas on phones: skip the expensive render there; desktops show the cafe behind it
  PERF.render += (performance.now() - pf1 - PERF.render) * 0.05;
  requestAnimationFrame(frame);
}

/* ================= boot ================= */
document.body.classList.add('starting');
Promise.all([loadFaces(), loadLocalPhoto()]).then(() => {
  applyI18n(); drawWorldScreens(0);
  document.fonts && document.fonts.ready.then(() => { redrawOnFonts.forEach(tx => tx.userData.redraw()); booths.forEach(drawScreen); });
  requestAnimationFrame(frame);
  runLand();
  let shown = 0;
  setTimeout(() => renderThumbs((n, total) => { if (n - shown >= 6 || n === total) { shown = n; fillThumbs(); } }).then(() => {
    fillThumbs(); if (!$('#select').hidden) renderSelect();
    setTimeout(() => { try { camera.position.set(STAGE.x, 1.9, STAGE.z + 5.6); camera.lookAt(STAGE.x, 1.05, STAGE.z); renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => { }) : renderer.compile(scene, camera); } catch (e) { } }, 200);   // warm up shaders while the landing is read
  }), 150);
});
