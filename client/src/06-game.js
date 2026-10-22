
/* ================= avatars + labels ================= */
const labelsEl = $('#labels');
const avatars = [];
const SHADOW_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(0.6, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); const tx = new THREE.CanvasTexture(c); return tx; })();
const SHADOW_MAT = new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: 0.9 });
const SHADOW_GEO = new THREE.PlaneGeometry(1, 1);
class Avatar {
  constructor(charId, opts = {}) {
    this.charId = charId; this.look = opts.look || null; this.obj = buildChar(charId, opts.tint, opts.look); scene.add(this.obj);
    { const sh = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; const w = (this.obj.userData.kind === 'plush' ? 1.5 : 1.15); sh.scale.set(w, w * 0.8, 1); sh.renderOrder = 1; this.obj.add(sh); this.shadow = sh; }
    this.baseScale = this.obj.scale.x; this.state = 'idle'; this.phase = Math.random() * 6; this.seed = Math.random() * 10;
    this.emoteT = 0; this.vy = 0; this.onGround = true;
    if (CHAR[charId].companion && !opts.noComp) { this.comp = makeCorgi(); this.comp.position.set(0.8, 0, 0.6); scene.add(this.comp); }
    this.tag = document.createElement('div'); this.tag.className = 'tag ' + (opts.cls || ''); labelsEl.appendChild(this.tag);
    this.tagH = (this.obj.userData.height || 1.5) * this.baseScale + 0.35;
    avatars.push(this);
  }
  emote() { if (this.emoteT <= 0) this.emoteT = EMOTE_DUR; }
  say(text, dur = 4.2) {
    const old = this.tag.querySelector('.bubble'); if (old) old.remove();
    const b = document.createElement('div'); b.className = 'bubble'; b.textContent = text; this.tag.appendChild(b);
    clearTimeout(this._bt); this._bt = setTimeout(() => b.remove(), dur * 1000);
  }
  dispose() { scene.remove(this.obj); if (this.comp) scene.remove(this.comp); this.tag.remove(); const i = avatars.indexOf(this); if (i >= 0) avatars.splice(i, 1); }
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
let VW = 1, VH = 1;
function placeTag(el, pos, maxD) {
  _v.copy(pos); const d = camera.position.distanceTo(_v); _v.project(camera);
  if (_v.z > 1 || d > maxD || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { if (!el.hidden) el.hidden = true; return false; }
  if (el.hidden) el.hidden = false;
  el.style.transform = `translate(${(_v.x * .5 + .5) * VW}px,${(-_v.y * .5 + .5) * VH}px) translate(-50%,-100%)`;
  return true;
}
function popText(pos, text, cls = '') {
  _v.copy(pos); const d = camera.position.distanceTo(_v); _v.project(camera);
  if (_v.z > 1 || d > 34 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) return;
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
  el.style.transform = `translate(${(_v.x * .5 + .5) * VW}px,${(-_v.y * .5 + .5) * VH}px) translate(-50%,-100%)`;
  labelsEl.appendChild(el); setTimeout(() => el.remove(), 1700);
}

/* particles */
const particles = [];
const PG = { bill: new THREE.PlaneGeometry(0.16, 0.08), conf: new THREE.PlaneGeometry(0.1, 0.06), coin: new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), fire: new THREE.SphereGeometry(0.14, 8, 6), heart: new THREE.SphereGeometry(0.12, 8, 6), smoke: new THREE.SphereGeometry(0.3, 8, 6), drop: new THREE.SphereGeometry(0.07, 6, 5) };
const PM = { bill: new THREE.MeshBasicMaterial({ color: 0x9fcf8a, side: THREE.DoubleSide }), conf: [0xe6dccb, 0xd8c9a8, 0xc8a96a, 0x9ed9b2, 0xffffff].map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })), coin: new THREE.MeshBasicMaterial({ color: 0xc8a96a }), fire: [0xff6a2a, 0xffb347, 0xd9707a].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 })), heart: new THREE.MeshBasicMaterial({ color: 0xe6dccb }), smoke: new THREE.MeshBasicMaterial({ color: 0xcfc6e8, transparent: true, opacity: 0.5 }), drop: new THREE.MeshBasicMaterial({ color: 0xd6cfc2, transparent: true, opacity: 0.8 }) };
function spawnParticle(pos, kind, vel) {
  const mat = PM[kind]; const m = new THREE.Mesh(PG[kind], Array.isArray(mat) ? pick(mat) : mat);
  m.position.copy(pos); scene.add(m);
  const v = vel || new THREE.Vector3(rand(-1.4, 1.4), rand(2, 4.5), rand(-1.4, 1.4));
  const g = kind === 'smoke' ? -0.6 : kind === 'fire' ? -1.5 : kind === 'heart' ? -0.8 : 5.5;
  particles.push({ m, vel: v, life: kind === 'smoke' ? 2.5 : kind === 'fire' ? 1.2 : kind === 'heart' ? 2 : 2.2, g, grow: kind === 'smoke' ? 1.2 : kind === 'fire' ? -0.6 : 0, spin: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)) });
}
function confetti(pos, n = 70) { for (let i = 0; i < n; i++) spawnParticle(_w.copy(pos).add(new THREE.Vector3(rand(-.4, .4), rand(0, .6), rand(-.4, .4))), 'conf'); }
function burst(pos, kind, n, spread = 1.6, up = [2, 5]) { for (let i = 0; i < n; i++) spawnParticle(_w.copy(pos), kind, new THREE.Vector3(rand(-spread, spread), rand(up[0], up[1]), rand(-spread, spread))); }
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt; p.vel.y -= p.g * dt; p.vel.multiplyScalar(1 - 1.0 * dt);
    p.m.position.addScaledVector(p.vel, dt); p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; p.m.rotation.z += p.spin.z * dt;
    if (p.grow) p.m.scale.addScalar(p.grow * dt);
    if (p.g > 0 && p.m.position.y < 0.02) { p.m.position.y = 0.02; p.vel.set(0, 0, 0); p.spin.set(0, 0, 0); }
    if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); }
  }
  if (particles.length > 420) { for (let i = 0; i < particles.length - 420; i++) scene.remove(particles[i].m); particles.splice(0, particles.length - 420); }
}

/* ================= coins: only what real people launched ================= */
// Nothing here is invented. A desk gets a character only when a person launches a coin; every number on screens and
// panels comes from pump.fun trades (PumpPortal stream through the server) or DexScreener.
const agents = [];          // one entry per launched coin, each sits at its own desk
const feed = [];            // real events only: launches, trades, graduations
let feedDirty = true;
const W = { plushes: store.get('cc_claw2', []) };
try { localStorage.removeItem('cc_claw'); } catch (e) { }
const SOL_PX = { usd: 0 };  // SOL price in USD (server), to show market caps in dollars
const STAT = { trades: 0, vol: 0 };
const PX = {};   // DexScreener per mint: price, market cap, 24h volume and change, pair address, dex
const TX = {};   // live trades per mint, newest first
const OHLC = {}; // 5-minute candles per mint, from the server (GeckoTerminal)
let featured = null, featuredAt = 0;
function setFeatured(a, fresh) { if (!a) return; featured = a; featuredAt = fresh ? Date.now() : (a.at || 0); if (fresh && typeof toast === 'function') { toast(t('big_live', { s: '$' + a.sym }), 'gold'); confetti(_w.set(0, 4, ROOM.zb + 2), 80); launchRocket(); } }
const coinColor = a => '#' + new THREE.Color().setHSL((hashStr(a.sym) % 360) / 360, 0.7, 0.62).getHexString();
function newAgent(sym, body, extra = {}) {
  return { id: 'a_' + sym + '_' + Math.floor(Math.random() * 1e6), sym, body, brain: 'claude', title: sym, mint: null, image: null, desc: '', socials: null, by: '', at: Date.now(), mine: false,
    bond: 0, bonded: false, mcSol: 0, vSol: 0, trades: [], hist: [], traders: new Set(), holders: 0, outside: false, placeNow: null, booth: null, strategy: {}, ...extra };
}
const bondFromVSol = v => clamp((v - 30) / 85 * 100, 0, 100);   // pump.fun curve: 30 virtual SOL at start, graduates at ~115
function mcapUsd(a) { const px = a.mint && PX[a.mint]; if (px && px.mc > 0) return px.mc; return a.mcSol && SOL_PX.usd ? a.mcSol * SOL_PX.usd : 0; }
const mcapFor = a => mcapUsd(a) || a.mcSol * 150;   // only used for sorting
function mcapText(a) { const u = mcapUsd(a); return u ? usd(u) : a.mcSol ? '◎ ' + a.mcSol.toFixed(1) : a.mint ? t('mc_new') : '—'; }
const stageKey = a => a.bonded ? 'famous' : stageOf(a.bond);
function rebuildFeed() {   // after (re)joining: launches and the trades the server remembers, newest first
  const ev = [];
  for (const a of agents) { ev.push({ kind: 'launch', a, at: a.at }); if (a.bondAt) ev.push({ kind: 'bond', a, at: a.bondAt }); for (const tx of a.trades) ev.push({ kind: tx.side === 'sell' ? 'sell' : 'buy', a, sol: +tx.sol || 0, who: tx.trader || '', at: tx.ts || a.at }); }
  ev.sort((p, q) => q.at - p.at); feed.length = 0; feed.push(...ev.slice(0, 80)); feedDirty = true;
}
function feedPush(e) { feed.unshift(e); if (feed.length > 80) feed.length = 80; feedDirty = true; }
function onTrade(tx, live = true) {
  const a = agents.find(x => x.mint === tx.mint); if (!a) return;
  if (a.trades.some(x => x.sig ? x.sig === tx.sig : (x.ts === tx.ts && x.trader === tx.trader && x.sol === tx.sol))) return;
  STAT.trades++;
  a.trades.unshift(tx); if (a.trades.length > 60) a.trades.length = 60;
  if (tx.mcapSol) { a.mcSol = +tx.mcapSol; a.hist.push({ t: tx.ts || Date.now(), v: +tx.mcapSol }); a.hist.sort((p, q) => p.t - q.t); if (a.hist.length > 300) a.hist.shift(); }
  if (tx.trader) { a.traders.add(tx.trader); a.holders = a.traders.size; }
  const before = stageKey(a);
  if (tx.vSol) { a.vSol = +tx.vSol; if (!a.bonded) a.bond = bondFromVSol(a.vSol); }
  if (live) {
    STAT.vol += +tx.sol || 0;
    feedPush({ kind: tx.side === 'sell' ? 'sell' : 'buy', a, sol: +tx.sol || 0, who: tx.trader || '', at: Date.now() });
    if (+tx.sol >= 0.5 && typeof isPro === 'function' && isPro()) whaleAlert(a, tx);   // pro feed: whale alerts
    const av = a.booth && a.booth.avatar;
    if (av && av.obj.visible) { fx(a, (tx.side === 'sell' ? '-' : '+') + (+tx.sol || 0).toFixed(2) + ' SOL', tx.side === 'sell' ? 'neg' : ''); if (tx.side !== 'sell' && +tx.sol >= 0.3) av.emote(); }
  }
  if (a.bond >= 100 && !a.bonded) graduate(a, live);
  if (a.booth) { if (stageKey(a) !== before) applyBoothStage(a.booth); drawScreen(a.booth); updateAgentTag(a); }
}
function graduate(a, loud = true) {
  a.bonded = true; a.bond = 100; a.bondAt = a.bondAt || Date.now();
  if (loud) { feedPush({ kind: 'bond', a, at: Date.now() }); toast(t('toast_bond', { s: '$' + a.sym }), 'gold'); const p = agentPos(a); if (p) confetti(_w.copy(p).setY(1.4), 110); }
  if (a.booth) applyBoothStage(a.booth);
}
function onPrices(px) {
  for (const mint in px) { const a = agents.find(x => x.mint === mint); if (!a) continue; if (px[mint].dex && px[mint].dex !== 'pumpfun' && !a.bonded) graduate(a); if (a.booth) { drawScreen(a.booth); updateAgentTag(a); applyBoothStage(a.booth); } }
}
function seatAgent(a, b) {
  b.agent = a; a.booth = b;
  if (b.avatar) b.avatar.dispose();
  b.avatar = new Avatar(a.body, { cls: a.mine ? 'mine' : '' }); b.avatar.agent = a;
  b.avatar.obj.traverse(o => { o.userData.agentId = a.id; });
  pickables.push(b.avatar.obj);
  applyBoothStage(b); drawScreen(b); updateAgentTag(a);
}
function unseatAgent(a) {
  const b = a.booth; if (!b) return;
  if (a.outside) returnInside(a);
  if (b.avatar) { const i = pickables.indexOf(b.avatar.obj); if (i >= 0) pickables.splice(i, 1); b.avatar.dispose(); b.avatar = null; }
  b.agent = null; a.booth = null; const ai = agents.indexOf(a); if (ai >= 0) agents.splice(ai, 1);
  applyBoothStage(b); drawScreen(b);
}
function freeBooth(vip) {   // VIP coins sit in the VIP row, the rest in the ordinary rows
  let b = booths.filter(x => !x.agent && !!x.vip === !!vip).sort((p, q) => q.z - p.z)[0];
  if (b) return b;
  if (vip) b = booths.filter(x => !x.agent).sort((p, q) => q.z - p.z)[0]; if (b) return b;
  // every desk is taken: the oldest coin with the smallest market cap gives up its seat (it stays on pump.fun, of course)
  const out = agents.filter(a => a.booth && !a.mine && !a.bonded && a !== featured).sort((p, q) => mcapFor(p) - mcapFor(q) || p.at - q.at)[0];
  if (!out) return null;
  b = out.booth; unseatAgent(out); return b;
}
function updateAgentTag(a) {
  const av = a.booth && a.booth.avatar; if (!av) return;
  const st = stageKey(a);
  av.tag.className = 'tag s-' + st + (a.mine ? ' mine' : '');
  const bub = av.tag.querySelector('.bubble');
  av.tag.innerHTML = `<span class="dot"></span><b>$${esc(a.sym)}</b><span class="pct">${!a.mint ? t('test_tag') : a.bonded ? (a.outside && a.placeNow ? t('pl_' + a.placeNow) : t('bonded_tag')) : mcapText(a)}</span>`;
  if (bub) av.tag.appendChild(bub);
}
function agentById(id) { return agents.find(a => a.id === id); }
function agentPos(a) { const av = a.booth && a.booth.avatar; return av ? av.obj.position : null; }
function fx(a, text, cls) { const p = agentPos(a); if (p) popText(_w.copy(p).setY(p.y + (a.booth.avatar.tagH + 0.4)), text, cls); }

/* ================= world: agents outside ================= */
const HUB = new THREE.Vector3(0, 0, 46);
const WELL_C = new THREE.Vector2(0, 36), WELL_R = 5.2;
function detour(path, from) {
  const out = []; let prev = from.clone();
  for (const p of path) {
    const a = new THREE.Vector2(prev.x, prev.z), b = new THREE.Vector2(p.x, p.z), ab = b.clone().sub(a), L2 = ab.lengthSq();
    if (L2 > 1e-6) { const tt = clamp(WELL_C.clone().sub(a).dot(ab) / L2, 0, 1); const cp = a.clone().addScaledVector(ab, tt); if (cp.distanceTo(WELL_C) < WELL_R) { const side = (a.x + b.x) / 2 >= 0 ? 1 : -1; out.push(new THREE.Vector3(side * 8.5, 0, 36 + (b.y > a.y ? -1 : 1) * 2)); } }
    if (CASINO_RECT) for (const w of rectDetour(prev, p, CASINO_RECT)) out.push(w);
    out.push(p); prev = p;
  }
  return out;
}
/* a straight walk that would cut through a building goes around one or two of its corners instead */
function segHitsRect(ax, az, bx, bz, R) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - R.minx], [dx, R.maxx - ax], [-dz, az - R.minz], [dz, R.maxz - az]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t1 - t0 > 1e-4;
}
function rectDetour(a, b, R) {
  const inner = { minx: R.minx + 0.05, maxx: R.maxx - 0.05, minz: R.minz + 0.05, maxz: R.maxz - 0.05 };
  if (!segHitsRect(a.x, a.z, b.x, b.z, inner)) return [];
  const cs = [[R.minx, R.minz], [R.maxx, R.minz], [R.maxx, R.maxz], [R.minx, R.maxz]], ok = (p, q) => !segHitsRect(p[0], p[1], q[0], q[1], inner);
  const A = [a.x, a.z], B = [b.x, b.z], len = (...ps) => ps.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - ps[i][0], p[1] - ps[i][1]), 0);
  let best = null, bl = 1e9;
  for (const c of cs) if (ok(A, c) && ok(c, B)) { const l = len(A, c, B); if (l < bl) { bl = l; best = [c]; } }
  if (!best) for (let i = 0; i < 4; i++) for (const j of [(i + 1) % 4, (i + 3) % 4]) { const c1 = cs[i], c2 = cs[j]; if (ok(A, c1) && ok(c2, B)) { const l = len(A, c1, c2, B); if (l < bl) { bl = l; best = [c1, c2]; } } }
  return (best || []).map(([x, z]) => new THREE.Vector3(x, 0, z));
}
const DOOR_OUT = new THREE.Vector3(0, 0, ROOM.zf + 2.6), DOOR_IN = new THREE.Vector3(0, 0, ROOM.zf - 2.2);
const outside = [];
function outsideScale(a) { return 1 + Math.min(1.2, Math.log10(1 + mcapFor(a) / 30000) * 0.55); }
function planFor(a) {
  const w = { market: 3, xtower: 2.5, billboard: 1.2, vault: 1.5, well: 1.5, studio: 1, launchpad: 0.8, quest: 1, arcade: 1.2, docks: 0.8, pond: 0.5 };
  const keys = Object.keys(w), plan = [];
  while (plan.length < 3 + Math.floor(rand(0, 3))) { let r = rand(keys.reduce((s, k) => s + w[k], 0)); for (const k of keys) { r -= w[k]; if (r <= 0) { if (plan[plan.length - 1] !== k) plan.push(k); break; } } }
  return plan;
}
function routeTo(from, pl) {
  const dest = new THREE.Vector3(pl.ax, 0, pl.az);
  const path = [];
  if (from.z < ROOM.zf + 1) path.push(DOOR_OUT.clone());
  const hub = HUB.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-3, 3)));
  if (pl.id !== 'cafe' && pl.id !== 'quest') path.push(hub);
  path.push(dest);
  return detour(path, from);
}
function goOutside(a, plan) {
  const av = a.booth && a.booth.avatar; if (!av || a.outside || !a.bonded) return;
  a.outside = true; a.outPlan = plan || planFor(a); a.outPlan.push('cafe'); a.outIdx = 0; a.outState = 'walk'; a.placeNow = null;
  av.obj.visible = true; av.obj.position.copy(DOOR_IN); av.obj.rotation.y = 0; av.obj.scale.setScalar(av.baseScale * outsideScale(a));
  av.path = routeTo(av.obj.position, PLACES[a.outPlan[0]]); av.state = 'walk';
  outside.push(a); applyBoothStage(a.booth); drawScreen(a.booth); updateAgentTag(a);
}
function returnInside(a) {
  const av = a.booth && a.booth.avatar; a.outside = false; a.placeNow = null; a.outState = null; const i = outside.indexOf(a); if (i >= 0) outside.splice(i, 1);
  if (av) { av.path = null; av.obj.scale.setScalar(av.baseScale); }
  if (a.booth) { applyBoothStage(a.booth); drawScreen(a.booth); updateAgentTag(a); }
}
function doPlaceAction(a, id) {
  a.placeNow = id; updateAgentTag(a);
  const av = a.booth && a.booth.avatar; if (av && Math.random() < 0.7) av.emote();
  if (id === 'launchpad') launchRocket();
}
function launchRocket() { townFx.rocketT = 4.5; }
function updateOutside(dt) {
  for (const a of [...outside]) {
    const av = a.booth && a.booth.avatar; if (!av) { returnInside(a); continue; }
    const o = av.obj;
    if (a.outState === 'walk') {
      const tgt = av.path && av.path[0];
      if (!tgt) { a.outState = 'arrive'; continue; }
      _v.subVectors(tgt, o.position); _v.y = 0; const d = _v.length();
      if (d < 0.25) { av.path.shift(); continue; }
      _v.divideScalar(d); o.position.addScaledVector(_v, Math.min(d, 2.6 * dt));
      o.rotation.y = lerpAngle(o.rotation.y, Math.atan2(_v.x, _v.z), 8 * dt); av.state = 'walk';
    } else if (a.outState === 'arrive') {
      const id = a.outPlan[a.outIdx];
      if (id === 'cafe') { o.position.copy(DOOR_IN); returnInside(a); continue; }
      const pl = PLACES[id]; o.rotation.y = Math.atan2(pl.x - o.position.x, pl.z - o.position.z);
      doPlaceAction(a, id); a.outState = 'work'; a.outTimer = rand(4, 7); av.state = 'work';
    } else if (a.outState === 'work') {
      a.outTimer -= dt; av.state = av.emoteT > 0 ? av.state : 'work';
      if (a.outTimer <= 0) { a.outIdx++; a.placeNow = null; const next = PLACES[a.outPlan[a.outIdx]] || PLACES.cafe; av.path = routeTo(o.position, next); a.outState = 'walk'; updateAgentTag(a); }
    }
  }
}
let outClock = 20;
function worldClock(dt) {
  outClock -= dt;
  if (outClock <= 0) {
    outClock = rand(22, 40);
    const cands = agents.filter(a => a.bonded && !a.outside && a.booth);
    if (cands.length && outside.length < 5) goOutside(pick(cands));
  }
}
/* ================= persistence ================= */
// Coins are never stored in the browser: real ones come from the server, a test launch lives until the page reloads.
function saveMine() { }
try { localStorage.removeItem('cc_mine'); } catch (e) { }

/* ================= toasts ================= */
function toast(msg, cls = '', force = false) {
  if (!force && !playing && document.body.classList.contains('starting') && cls !== 'gold' && !/fail|not|error|Phantom|slow|big/i.test(msg)) return;   // no simulation chatter over the landing and the podium
  if (!force && modalOpen() && !/fail|not|error|Phantom|slow|big|max/i.test(msg)) return;   // keep open sheets readable
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg; $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
  const all = $('#toasts').children; while (all.length > (TOUCH ? 2 : 3)) all[0].remove();
}

/* ================= world setup ================= */
buildRoom(); buildTown(); buildExtras(); buildEasterEggs(); buildStage();
BOOTH_Z.forEach((z, ri) => BOOTH_X.forEach((x, ci) => buildBooth(ri * 8 + ci + 1, x, z)));
booths.forEach(drawScreen);

/* NPC wanderers */
const LANES_Z = [-15.5, -10.2, -5.2, -0.2, 5.4, 9, 12.5];
const npcs = [];
function npcTarget(zone) { if (zone === 'out') return new THREE.Vector3(rand(-16, 16), 0, rand(22, 50)); const z = pick(LANES_Z); const x = z > 4 ? rand(-15, 18) : rand(-16, 16); return new THREE.Vector3(x, 0, z); }
function npcPath(from, to) {
  const near = (a, b) => Math.abs(a - b) < 0.6;
  if (from.z > 4 && to.z > 4) return [to];
  const laneFrom = LANES_Z.reduce((p, c) => Math.abs(c - from.z) < Math.abs(p - from.z) ? c : p);
  if (near(laneFrom, to.z)) return [new THREE.Vector3(from.x, 0, laneFrom), to];
  const sx = (from.x + to.x) / 2 < 0 ? -17.3 : 17.3;
  return [new THREE.Vector3(from.x, 0, laneFrom), new THREE.Vector3(sx, 0, laneFrom), new THREE.Vector3(sx, 0, to.z), to];
}
function spawnNPCs(exclude) {
  for (const n of npcs) n.dispose(); npcs.length = 0;
  // fewer bots: six critters and two regulars (there were nineteen). Real players should be the crowd
  const folk = TOWNSFOLK.map(c => c.id).sort(() => Math.random() - 0.5).slice(0, 6), regulars = PLAYABLE.filter(c => c.id !== exclude && c.id !== 'custom').map(c => c.id).sort(() => Math.random() - 0.5).slice(0, 2);
  const pool = [...folk, ...regulars];
  pool.forEach((id, i) => {
    const zone = (i < folk.length ? i % 3 === 0 : i % 2 === 0) ? 'in' : 'out';
    const n = new Avatar(id, { cls: 'npc' }); const tp = npcTarget(zone); n.obj.position.copy(tp); n.path = []; n.wait = rand(0, 3); n.zone = zone;
    n.tag.innerHTML = `<b>${esc(CHAR[id].name)}</b>`; npcs.push(n);
  });
}
function updateNPCs(dt) {
  for (const n of npcs) {
    if (n.wait > 0) { n.wait -= dt; n.state = 'idle'; if (n.wait <= 0) { const tp = npcTarget(n.zone); n.path = n.zone === 'out' ? detour([HUB.clone().add(new THREE.Vector3(rand(-6, 6), 0, rand(-4, 4))), tp], n.obj.position) : npcPath(n.obj.position, tp); } continue; }
    const tgt = n.path[0]; if (!tgt) { n.wait = rand(2, 7); if (Math.random() < 0.35) n.say(pick(CHAR[n.charId].lines || t('npc_lines'))); if (Math.random() < 0.3) n.emote(); continue; }
    _v.subVectors(tgt, n.obj.position); _v.y = 0; const d = _v.length();
    if (d < 0.2) { n.path.shift(); continue; }
    _v.divideScalar(d); n.obj.position.addScaledVector(_v, Math.min(d, 2.4 * dt));
    n.obj.rotation.y = lerpAngle(n.obj.rotation.y, Math.atan2(_v.x, _v.z), 8 * dt); n.state = 'walk';
  }
}
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); }
function updateCompanion(av, dt, time) {
  const c = av.comp; if (!c) return;
  c.visible = av.obj.visible;
  const o = av.obj, back = new THREE.Vector3(Math.sin(o.rotation.y + 2.3), 0, Math.cos(o.rotation.y + 2.3)).multiplyScalar(0.9);
  const tgt = _w.copy(o.position).add(back); tgt.y = 0;
  _v.subVectors(tgt, c.position); _v.y = 0; const d = _v.length();
  const moving = d > 0.15;
  if (d > 12) c.position.copy(tgt);
  else if (moving) { c.position.addScaledVector(_v.normalize(), Math.min(d, (d > 2 ? 7 : 3.5) * dt)); c.rotation.y = lerpAngle(c.rotation.y, Math.atan2(_v.x, _v.z), 10 * dt); }
  const ud = c.userData; ud.phase += dt * (moving ? 18 : 2);
  ud.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(ud.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 : 0);
  c.position.y = av.emoteT > 0 ? Math.abs(Math.sin(time * 12)) * 0.4 : moving ? Math.abs(Math.sin(ud.phase)) * 0.04 : 0;
  ud.head.rotation.z = Math.sin(time * 3) * 0.1;
}

/* ================= player + camera + input ================= */
let player = null, playing = false, camMode = 'orbit';
let charChoice = store.get('cc_char', 'degen'); if (!CHAR[charChoice] || CHAR[charChoice].npc) charChoice = 'degen';
let myNick = String(store.get('cc_nick', '') || '').slice(0, 16), myLook = sanitizeLook(store.get('cc_look', null));
const myName = () => myNick || (charChoice === 'custom' ? 'PLAYER' : CHAR[charChoice].name);
const cam = { yaw: 0, pitch: 0.5, dist: 7.5, target: new THREE.Vector3(0, 1.2, 12) };
let moveTarget = null, jumpQ = false, autoWalk = null;
/* auto-walks (to a desk or a place) can always be cancelled: move, click the floor, tap the joystick, press Esc or the button */
function showWalkHint(text) { let h = document.getElementById('walkHint'); if (!h) { h = document.createElement('button'); h.type = 'button'; h.id = 'walkHint'; h.addEventListener('click', cancelWalk); document.body.appendChild(h); } h.innerHTML = `<span>${text}</span><b>${t('walk_cancel')}</b>`; h.hidden = false; }
function hideWalkHint() { const h = document.getElementById('walkHint'); if (h) h.hidden = true; }
function cancelWalk() { autoWalk = null; moveTarget = null; hideWalkHint(); }
const keys = {};
const TOUCH = (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1) && !matchMedia('(pointer: fine)').matches;
if (TOUCH) document.body.classList.add('touch');
const joy = { x: 0, y: 0, id: null };
function spawnPlayer(id, pos, rot, look, nick) {
  if (player) player.dispose();
  player = new Avatar(id, { cls: 'me', look: id === 'custom' ? (look || myLook) : null }); player.obj.position.copy(pos || new THREE.Vector3(0, 0, 13)); player.obj.rotation.y = rot ?? Math.PI;
  player.tag.innerHTML = `<b>${esc(nick || myNick || CHAR[id].name)}</b><span class="you">${t('you')}</span>`;
  if (id !== 'custom') { if (myLook.photo === 'local' && PHOTO_TEX.local) applyPhotoTex(player.obj, PHOTO_TEX.local); if (myLook.emote !== 'auto') player.obj.userData.emote = myLook.emote; }
  if (NET.vip) player.tag.classList.add('vip');
  applyFlair(player.obj, myFlair());
  spawnNPCs(id);
}
const isInside = p => p.z < ROOM.zf + 0.2;
function collide(p, r) {
  if (isInside(p)) { p.x = clamp(p.x, -ROOM.x + 0.5 + r, ROOM.x - 0.5 - r); p.z = Math.max(p.z, ROOM.zb + 0.5 + r); }
  else { p.x = clamp(p.x, -TOWN.x + r, TOWN.x - r); const onPier = Math.abs(p.x) < 2.2; p.z = Math.min(p.z, onPier ? TOWN.zf + 8.6 : TOWN.zf - 0.3 - r); }
  for (const b of colliders) {
    const minx = b.minx - r, maxx = b.maxx + r, minz = b.minz - r, maxz = b.maxz + r;
    if (p.x > minx && p.x < maxx && p.z > minz && p.z < maxz) {
      const dl = p.x - minx, dr = maxx - p.x, dn = p.z - minz, df = maxz - p.z, m = Math.min(dl, dr, dn, df);
      if (m === dl) p.x = minx; else if (m === dr) p.x = maxx; else if (m === dn) p.z = minz; else p.z = maxz;
    }
  }
}
const isTyping = () => { const e = document.activeElement; return e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT'); };
const modalOpen = () => [...document.querySelectorAll('.modal')].some(m => !m.hidden);
function updatePlayer(dt) {
  if (!player || !playing) return;
  const p = player.obj.position;
  let ix = 0, iz = 0;
  if (!isTyping() && !modalOpen()) {
    if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
  }
  const jm = Math.hypot(joy.x, joy.y);
  if (joy.id != null && jm > 0.18 && !modalOpen()) { ix += joy.x; iz += joy.y; }
  const dir = new THREE.Vector3();
  if (ix || iz) {
    if (autoWalk) { autoWalk = null; hideWalkHint(); }   // any move key or the joystick cancels a walk to a desk
    moveTarget = null;
    const fx_ = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    dir.set(fx_ * -iz + rx * ix, 0, fz * -iz + rz * ix).normalize();
  } else if (moveTarget) {
    dir.subVectors(moveTarget, p); dir.y = 0; const d = dir.length();
    if (d < 0.18) { moveTarget = null; dir.set(0, 0, 0); if (autoWalk) { const cb = autoWalk; autoWalk = null; cb(); } } else dir.divideScalar(d);
  }
  const run = keys.ShiftLeft || keys.ShiftRight || (joy.id != null && jm > 0.92) || (moveTarget && moveTarget.run);
  let speed = run ? 6.4 : (joy.id != null && jm > 0.18 ? 2.2 + 1.4 * Math.min(1, jm / 0.92) : 3.6);
  if (player.emoteT > 0 && CHAR[player.charId].emote === 'dive') { dir.set(Math.sin(player.obj.rotation.y), 0, Math.cos(player.obj.rotation.y)); speed = 4.2; }
  const before = p.clone();
  p.x += dir.x * speed * dt; p.z += dir.z * speed * dt;
  collide(p, 0.38);
  if (moveTarget && before.distanceTo(p) < speed * dt * 0.15) moveTarget.stuck = (moveTarget.stuck || 0) + dt; if (moveTarget && moveTarget.stuck > 0.5) { moveTarget = null; if (autoWalk) { const cb = autoWalk; autoWalk = null; cb(); } }
  if (dir.lengthSq() > 0.01) { player.obj.rotation.y = lerpAngle(player.obj.rotation.y, Math.atan2(dir.x, dir.z), 12 * dt); player.state = run ? 'run' : 'walk'; }
  else player.state = 'idle';
  if (jumpQ && player.onGround) { player.vy = 5.4; player.onGround = false; }
  jumpQ = false;
  if (!player.onGround) { player.vy -= 14 * dt; p.y += player.vy * dt; if (p.y <= 0) { p.y = 0; if (player.vy < -4) player.landT = 0.2; player.vy = 0; player.onGround = true; } else player.state = 'jump'; }
}
function updateCamera(dt, time) {
  if (camMode !== 'play' || !player) return;
  const inside = isInside(player.obj.position);
  cam.target.lerp(_w.copy(player.obj.position).add(new THREE.Vector3(0, 1.15, 0)), 1 - Math.pow(0.0015, dt));
  const cp = Math.cos(cam.pitch);
  const want = new THREE.Vector3(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  if (inside) {
    want.x = clamp(want.x, -ROOM.x + 0.6, ROOM.x - 0.6); want.z = clamp(want.z, ROOM.zb + 0.6, ROOM.zf - 0.2);
    const hz = Math.hypot(want.x - cam.target.x, want.z - cam.target.z), hzWant = cp * cam.dist;   // pressed against a wall: rise up and look down instead of hugging the back
    if (hz < hzWant) want.y += Math.min(4.5, (hzWant - hz) * 0.95);
    want.y = Math.min(want.y, 9.2);
  }
  else { want.y = Math.min(want.y, 16); want.z = Math.max(want.z, ROOM.zf + 0.8); }
  camBlock(want);
  camera.position.lerp(want, 1 - Math.pow(0.0005, dt));
  camera.lookAt(cam.target);
  const farWant = inside ? 66 : 150, nearWant = inside ? 30 : 60;
  scene.fog.far += (farWant - scene.fog.far) * Math.min(1, dt * 2); scene.fog.near += (nearWant - scene.fog.near) * Math.min(1, dt * 2);
}
function snapCamera() {
  if (!player) return; cam.target.copy(player.obj.position).add(new THREE.Vector3(0, 1.15, 0));
  const cp = Math.cos(cam.pitch); camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  if (isInside(player.obj.position)) { camera.position.x = clamp(camera.position.x, -ROOM.x + 0.6, ROOM.x - 0.6); camera.position.z = clamp(camera.position.z, ROOM.zb + 0.6, ROOM.zf - 0.2); camera.position.y = Math.min(camera.position.y, 9.2); scene.fog.near = 30; scene.fog.far = 66; } else { scene.fog.near = 60; scene.fog.far = 150; }
  camBlock(camera.position); camera.lookAt(cam.target);
}
const _seg = new THREE.Vector3();
function camBlock(want) {
  _seg.subVectors(want, cam.target);
  for (let k = 0.12; k <= 1.001; k += 0.06) {
    const px = cam.target.x + _seg.x * k, py = cam.target.y + _seg.y * k, pz = cam.target.z + _seg.z * k;
    for (const b of colliders) { if (py < (b.h ?? 6) && px > b.minx - 0.25 && px < b.maxx + 0.25 && pz > b.minz - 0.25 && pz < b.maxz + 0.25) { const kk = Math.max(0.1, k - 0.08); want.set(cam.target.x + _seg.x * kk, cam.target.y + _seg.y * kk, cam.target.z + _seg.z * kk); return; } }
  }
}
/* pointer */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let ptr = null;
const touches = new Map(); let pinchD = 0;
const pinchDist = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) { pinchD = pinchDist(); ptr = null; return; }
  ptr = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, drag: false, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); if (!TOUCH) canvas.focus({ preventScroll: true });
});
const dropTouch = e => { touches.delete(e.pointerId); if (touches.size < 2) pinchD = 0; };
canvas.addEventListener('pointercancel', e => { dropTouch(e); if (ptr && ptr.id === e.pointerId) ptr = null; });
canvas.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && pinchD) { const d = pinchDist(); if (camMode === 'play' && d > 0) cam.dist = clamp(cam.dist * pinchD / d, 3, 18); pinchD = d; return; }
  if (!ptr || e.pointerId !== ptr.id) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY;
  if (Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 6) ptr.drag = true;
  if (ptr.drag && camMode === 'play') { const k = TOUCH ? 1.5 : 1; cam.yaw -= dx * 0.006 * k; cam.pitch = clamp(cam.pitch + dy * 0.004 * k, 0.12, 1.25); }
  if (ptr.drag && camMode === 'select' && selAvatar) selAvatar.obj.rotation.y += dx * 0.012;
});
canvas.addEventListener('pointerup', e => {
  dropTouch(e);
  if (!ptr || e.pointerId !== ptr.id) return; const wasDrag = ptr.drag; ptr = null;
  if (wasDrag || camMode !== 'play') return;
  ndc.set(e.clientX / VW * 2 - 1, -(e.clientY / VH) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, true);
  for (const h of hits) {
    const ud = h.object.userData;
    if (ud.agentId) { const a = agentById(ud.agentId); if (a) { openBooth(a); return; } }
    if (ud.candle !== undefined && h.object.visible) { const g = CANDLES[ud.candle]; if (g && g.visible) { collectCandle(ud.candle); return; } }
    if (ud.egg) { openEggByText(ud.egg); return; }
    if (ud.crate !== undefined) { const c = HUNT_LIVE.find(x => x.i === ud.crate); if (c && !c.claimed) { if (Math.hypot(player.obj.position.x - c.x, player.obj.position.z - c.z) < 2.4) huntOpenCrate(c); else { moveTarget = new THREE.Vector3(c.x, 0, c.z + 1.2); moveTarget.run = true; } } return; }
    if (ud.boothIdx) { const b = booths[ud.boothIdx - 1]; if (b) { if (b.agent) openBooth(b.agent); else goSit(b); } return; }
    if (ud.launch) { goSit(nearestFreeBooth()); return; }
    if (ud.place) { openPlace(ud.place); return; }
    if (ud.floor) { moveTarget = h.point.clone(); moveTarget.y = 0; moveTarget.run = player.obj.position.distanceTo(h.point) > 7; if (autoWalk) { autoWalk = null; hideWalkHint(); } return; }
  }
});
canvas.addEventListener('wheel', e => { if (camMode !== 'play') return; e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 3, 18); }, { passive: false });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (autoWalk || moveTarget) { cancelWalk(); return; } if (gameActive) { closeGame(); return; } closeModals(); if (isTyping()) document.activeElement.blur(); return; }
  if (camMode === 'select' && !isTyping()) { if (e.code === 'ArrowLeft') selStep(-1); if (e.code === 'ArrowRight') selStep(1); if (e.code === 'Enter') enterCafe(); if (e.code === 'KeyF' && selAvatar) selAvatar.emote(); return; }
  if (isTyping() || !playing) return;
  if (modalOpen()) { if (gameActive) gameKeyEvent(e, true); return; }
  keys[e.code] = true;
  if (autoWalk && /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) cancelWalk();   // a move key stops the walk at once
  if (e.code === 'Space') { e.preventDefault(); jumpQ = true; }
  if (e.code === 'KeyF') { player.emote(); netSend({ t: 'emote' }); }
  if (/^Digit[123]$/.test(e.code)) { const txt = (myLook.say || [])[+e.code.slice(5) - 1]; if (txt) { player.say(txt); netSend({ t: 'say', text: txt }); player.emote(); netSend({ t: 'emote' }); } }
  if (e.code === 'KeyE') interact();
  if (e.code === 'Enter') { e.preventDefault(); $('#chatInput').focus(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (gameActive) gameKeyEvent(e, false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

/* touch controls: joystick on the left, buttons on the right, drag the scene to look, pinch to zoom */
(function setupTouch() {
  const base = $('#joy'), knob = $('#joyKnob'); if (!base) return;
  const R = 48;
  const move = e => { const r = base.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } joy.x = dx / R; joy.y = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; };
  base.addEventListener('pointerdown', e => { e.preventDefault(); joy.id = e.pointerId; try { base.setPointerCapture(e.pointerId); } catch (er) { } base.classList.add('on'); moveTarget = null; if (autoWalk) { autoWalk = null; hideWalkHint(); } move(e); });
  base.addEventListener('pointermove', e => { if (e.pointerId === joy.id) move(e); });
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end); base.addEventListener('lostpointercapture', end);
  const tapBtn = (id, fn) => { const b = $(id); if (!b) return; b.addEventListener('pointerdown', e => { e.preventDefault(); if (player && playing && !modalOpen()) fn(); }); };
  tapBtn('#tbJump', () => { jumpQ = true; });
  tapBtn('#tbEmote', () => { player.emote(); netSend({ t: 'emote' }); });
  tapBtn('#tbChat', () => { document.body.classList.add('chat-open'); setTimeout(() => $('#chatInput').focus(), 30); });
  $('#chatInput').addEventListener('blur', () => setTimeout(() => document.body.classList.remove('chat-open'), 120));
  document.addEventListener('gesturestart', e => e.preventDefault());
})();

/* proximity */
let near = null;
const LAUNCH_POS = new THREE.Vector3(-17.2, 0, 10);
function updateProximity() {
  if (!playing || !player) { $('#prompt').hidden = true; return; }
  const p = player.obj.position; let best = null, bd = 2.6;
  for (let i = 0; i < EGGS.length; i++) { const e = EGGS[i], dd = Math.hypot(p.x - e.pos.x, p.z - e.pos.z); if (dd < 3.1 && dd < bd && Math.abs(e.pos.y - p.y) < 6) { bd = dd; best = { type: 'egg', i, id: 'egg' + i }; } }
  for (const b of booths) if (b.agent && b.avatar && b.avatar.obj.visible) { const d = p.distanceTo(b.avatar.obj.position); if (d < bd) { bd = d; best = { type: 'booth', a: b.agent }; } }
  for (const b of booths) if (!b.agent) { const d = Math.hypot(p.x - b.x, p.z - (b.z + 1.6)); if (d < bd) { bd = d; best = { type: 'seat', b }; } }
  if (p.distanceTo(LAUNCH_POS) < 2.4) best = { type: 'launch' };
  if (featured && Math.abs(p.x) < 6.5 && p.z < ROOM.zb + 4) best = { type: 'big' };
  let pd = Infinity; for (const id in PLACES) { const pl = PLACES[id]; if (id === 'cafe') continue; const d = Math.hypot(p.x - pl.x, p.z - pl.z); if (d < pl.r + 1.2 && d < pd) { pd = d; best = { type: 'place', id }; } }
  { const c = huntCrateNear(p); if (c) best = { type: 'crate', c, id: 'crate' + c.i }; }   // a crate at your feet beats the building behind it
  if (Math.abs(p.x) < 2.2 && Math.abs(p.z - ROOM.zf) < 3) best = { type: 'door', inside: isInside(p) };
  const key = best ? best.type + (best.a ? best.a.id : '') + (best.b ? best.b.idx : '') + (best.id || '') + (best.inside ?? '') : '';
  if (key !== (near ? near.key : '')) {
    near = best ? { ...best, key } : null;
    const pr = $('#prompt');
    if (!near) pr.hidden = true;
    else { pr.hidden = false; pr.textContent = (TOUCH ? s => s.replace(/^E\s*·\s*/, '') : s => s)(near.type === 'egg' ? t('p_egg') : near.type === 'crate' ? t('p_crate') : near.type === 'big' ? t('p_big', { s: '$' + featured.sym }) : near.type === 'booth' ? (near.a.outside ? t('p_agent', { s: '$' + near.a.sym }) : t('p_screen', { s: '$' + near.a.sym })) : near.type === 'seat' && near.b.vip ? t('p_vipseat', { n: near.b.idx, f: NET.cfg.vipDeskFee || 0.05 }) : near.type === 'seat' ? t('p_seat', { n: near.b.idx }) : near.type === 'launch' ? t('p_launch') : near.type === 'door' ? (near.inside ? t('p_door') : t('p_door_in')) : t('p_place', { n: t('pl_' + near.id) })); }
  }
}
function interact() {
  if (!near) return;
  if (near.type === 'egg') { openEgg(near.i); return; }
  if (near.type === 'crate') { huntOpenCrate(near.c); return; }
  if (near.type === 'booth') openBooth(near.a); else if (near.type === 'big') openBooth(featured); else if (near.type === 'seat') openLaunch(false, near.b); else if (near.type === 'launch') goSit(nearestFreeBooth()); else if (near.type === 'place') openPlace(near.id);
  else if (near.type === 'door') { const to = near.inside ? DOOR_OUT.clone() : DOOR_IN.clone(); moveTarget = to; moveTarget.run = false; }
}
$('#prompt').addEventListener('click', interact);
/* launching happens at a desk: walk to a free one, the wizard opens when you arrive */
function nearestFreeBooth() { const p = player ? player.obj.position : new THREE.Vector3(0, 0, 10); return booths.filter(b => !b.agent && !b.vip).sort((a, c) => Math.hypot(p.x - a.x, p.z - a.z - 1.6) - Math.hypot(p.x - c.x, p.z - c.z - 1.6))[0] || null; }
function goSit(b) {
  if (!b) { toast(t('wz_full')); return; }
  if (!player) return;
  const p = player.obj.position; const dest = new THREE.Vector3(b.x, 0, b.z + 2.3);
  if (Math.hypot(p.x - dest.x, p.z - dest.z) < 1.6) { openLaunch(false, b); return; }
  const steps = []; if (!isInside(p)) steps.push(DOOR_OUT.clone(), DOOR_IN.clone()); steps.push(dest);
  const next = () => { const s = steps.shift(); if (!s) { hideWalkHint(); if (!b.agent) openLaunch(false, b); return; } moveTarget = s; moveTarget.run = true; autoWalk = next; };
  showWalkHint(t('walk_desk'));
  next(); $('#side').classList.remove('open'); closeModals();
}
function walkTo(id) {
  const pl = PLACES[id]; if (!pl || !player) return;
  const dest = new THREE.Vector3(pl.ax, 0, pl.az), p = player.obj.position;
  const steps = [];
  if (isInside(p) && !isInside(dest)) steps.push(DOOR_IN.clone(), DOOR_OUT.clone());
  if (!isInside(p) && isInside(dest)) steps.push(DOOR_OUT.clone(), DOOR_IN.clone());
  if (!isInside(dest) && id !== 'cafe' && id !== 'quest' && id !== 'week') steps.push(HUB.clone());
  steps.push(dest);
  const routed = detour(steps, p); steps.length = 0; steps.push(...routed);
  const next = () => { const s = steps.shift(); if (!s) { hideWalkHint(); return; } moveTarget = s; moveTarget.run = true; autoWalk = next; };
  showWalkHint(t('walk_place'));
  next(); $('#side').classList.remove('open');
}
/* doors */
let doorOpen = 0;
function updateDoors(dt) {
  let want = 0;
  const check = o => { if (o && Math.abs(o.x) < 3.2 && Math.abs(o.z - ROOM.zf) < 3.5) want = 1; };
  if (player) check(player.obj.position); for (const a of outside) { const p = agentPos(a); check(p); }
  doorOpen += (want - doorOpen) * Math.min(1, dt * 5);
  for (const p of doorPanels) p.position.x = p.userData.side * (0.9 + doorOpen * 1.6);
}
/* chat */
$('#chatForm').addEventListener('submit', e => {
  e.preventDefault(); const inp = $('#chatInput'); const text = inp.value.trim(); inp.value = ''; inp.blur();
  if (!text || !player) return;
  player.say(text); netSend({ t: 'say', text });
  let best = null, bd = 6;
  for (const b of booths) if (b.avatar && b.agent && b.avatar.obj.visible) { const d = player.obj.position.distanceTo(b.avatar.obj.position); if (d < bd) { bd = d; best = b; } }
  if (best) setTimeout(() => best.avatar && best.agent && best.avatar.say(replyFor(best.agent)), 1100);
  else { const n = npcs.find(n => n.obj.position.distanceTo(player.obj.position) < 6); if (n) setTimeout(() => n.say(pick(t('npc_lines'))), 1200); }
});
$('#emoteBtn').addEventListener('click', () => { if (player && playing) { player.emote(); netSend({ t: 'emote' }); } });
