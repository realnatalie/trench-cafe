/* ================= HUNTS (client) =================
   Daily chip crates around town (same spots for everyone, new every day), chips for every Solana story found and a bonus
   for the full candle hunt. Rewards land on the server balance, so they need a signed-in wallet. */
let HUNT_DAY = huntDay(); const HUNT_LIVE = [];
const HS = { claimed: [], eggs: [], candles: false, synced: false };
function buildCrates() {
  for (const c of HUNT_LIVE) scene.remove(c.g); HUNT_LIVE.length = 0; HUNT_DAY = huntDay();   // a new day: new spots
  for (const i of dailyCrates(HUNT_DAY)) {
    const [x, z] = CRATE_SPOTS[i]; const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    add(g, RBOX(0.8, 0.5, 0.55, 0.04), M(0x141415), 0, 0.25, 0);
    add(g, BOX(0.84, 0.14, 0.6), M(0xc8a96a, { emissive: 0x3a2d12, emissiveIntensity: 1, roughness: 0.35, metalness: 0.4 }), 0, 0.57, 0);
    add(g, BOX(0.1, 0.5, 0.57), M(0xc8a96a, { roughness: 0.35, metalness: 0.4 }), 0, 0.26, 0);
    const ring = add(g, new THREE.TorusGeometry(0.75, 0.025, 8, 36), GLOW(0xc8a96a, 1.2), 0, 0.06, 0); ring.rotation.x = Math.PI / 2;
    const orb = add(g, SPH(0.09, 10, 8), GLOW(0xf1dca4, 2.2), 0, 1.25, 0);
    g.traverse(o => { o.userData.crate = i; }); pickables.push(g);
    HUNT_LIVE.push({ i, x, z, g, ring, orb, claimed: false });
  }
}
let huntDayCheck = 0;
function huntTick(time) { if (time - huntDayCheck > 60) { huntDayCheck = time; if (huntDay() !== HUNT_DAY) { buildCrates(); huntSync(); } }
  for (let k = 0; k < HUNT_LIVE.length; k++) { const c = HUNT_LIVE[k]; if (!c.g.visible) continue; c.orb.position.y = 1.2 + Math.sin(time * 2.4 + k) * 0.1; c.ring.rotation.z = time * 0.8; c.ring.scale.setScalar(1 + Math.sin(time * 3 + k) * 0.06); } }
function huntCrateNear(p) { let best = null, bd = 2.4; for (const c of HUNT_LIVE) { if (c.claimed) continue; const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = c; } } return best; }
async function hapi(path, body) {
  const r = await fetch(NET.http + '/api/hunt/' + path + (body ? '' : '?token=' + encodeURIComponent(NET.token || '')), body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, token: NET.token }) } : {});
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'hunt ' + r.status); e.code = j.code; throw e; } return j;
}
const huntOn = () => !!(NET.http && NET.loggedIn && NET.token);
/* after sign-in: which crates are already open today, which stories already paid */
async function huntSync() {
  if (!huntOn()) return;
  try { const s = await hapi('state'); if (s.day && s.day !== HUNT_DAY) buildCrates(); HS.claimed = s.claimed || []; HS.eggs = s.eggs || []; HS.candles = !!s.candles; HS.synced = true;
    for (const c of HUNT_LIVE) { c.claimed = HS.claimed.includes(c.i); c.g.visible = !c.claimed; }
    // stories read before signing in still pay out once, now
    for (const i of eggsSeen()) if (!HS.eggs.includes(i)) huntEgg(i, true);
    if (candlesFound().length >= CANDLE_SPOTS.length && !HS.candles) huntCandles();
  } catch (e) { }
}
function huntChipsToast(n, why) { toast(t('hunt_got', { n: fmtChips(n), s: t('hunt_why_' + why) }), 'gold', true); }
async function huntOpenCrate(c) {
  if (!c || c.claimed) return;
  if (!huntOn()) { toast(t('hunt_login'), 'cyan', true); return; }
  try { const j = await hapi('crate', { i: c.i }); c.claimed = true; c.g.visible = false; HS.claimed.push(c.i); setSrvBal(j.balance); confetti(_w.set(c.x, 1, c.z), 40); huntChipsToast(j.credited, 'crate'); gainXP(25, 'crate'); sfx('coin'); if (player) player.emote(); }
  catch (e) { if (e.code === 'done') { c.claimed = true; c.g.visible = false; } else toast(String(e.message || e).slice(0, 120), 'bad', true); }
}
async function huntEgg(i, quiet) {
  if (!huntOn() || HS.eggs.includes(i)) return;
  try { const j = await hapi('egg', { i }); HS.eggs = j.eggs || HS.eggs; if (j.credited) { setSrvBal(j.balance); if (!quiet) huntChipsToast(j.credited, 'egg'); } } catch (e) { }
}
async function huntCandles() {
  if (!huntOn() || HS.candles) return;
  try { const j = await hapi('candles'); HS.candles = true; if (j.credited) { setSrvBal(j.balance); huntChipsToast(j.credited, 'candles'); } } catch (e) { }
}
function huntPanelHTML() {
  const total = HUNT.daily, done = HS.claimed.length;
  return `<div class="candle-q crate-q"><b>${t('hunt_t')}</b><div class="cq-row">${Array.from({ length: total }, (_, k) => `<i class="${k < done ? 'on' : ''}"></i>`).join('')}</div><p class="muted">${huntOn() ? t('hunt_d', { n: done, of: total, c: HUNT.crate }) : t('hunt_d_guest', { of: total, c: HUNT.crate })}</p><p class="muted">${t('hunt_more', { e: HUNT.egg, c: fmtChips(HUNT.candles) })}</p></div>`;
}
buildCrates();
Object.assign(window.__cc, { HUNT_LIVE, huntOpenCrate, huntSync, HS, dailyCrates, CRATE_SPOTS });
