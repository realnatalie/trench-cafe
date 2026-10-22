/* materials: PBR, one shared cache */
const matCache = new Map();
function M(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02, ...opts }));
  return matCache.get(key);
}
const GLOW = (c, i = 1) => M(c, { emissive: c, emissiveIntensity: i, roughness: 0.5 });
const CLOTH = (c, o = {}) => M(c, { roughness: 0.92, metalness: 0, ...o });
const METAL = (c, o = {}) => M(c, { roughness: 0.32, metalness: 0.85, ...o });
const physCache = new Map();
function PHYS(color, opts = {}) { const key = 'P' + color + '|' + JSON.stringify(opts); if (!physCache.has(key)) physCache.set(key, new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, metalness: 0, ...opts })); return physCache.get(key); }
const SKIN = c => PHYS(c, { roughness: 0.5, clearcoat: 0.18, clearcoatRoughness: 0.6 });
const FUR = c => PHYS(c, { roughness: 0.95, sheen: 0.8, sheenRoughness: 0.7, sheenColor: 0xffffff });
const PLASTIC = c => PHYS(c, { roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.4 });
const GHOSTM = c => PHYS(c, { roughness: 0.2, clearcoat: 0.8, transparent: true, opacity: 0.55, depthWrite: false });
const SPH = (r, w = 28, h = 22) => new THREE.SphereGeometry(r, w, h);
const BOX = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const RBOX = (x, y, z, r = 0.04) => new RoundedBoxGeometry(x, y, z, 3, Math.min(r, x / 2 - 0.001, y / 2 - 0.001, z / 2 - 0.001));
const CAP = (r, l, s = 16) => new THREE.CapsuleGeometry(r, l, 6, s);
const CYL = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const CONE = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function labelTex(text, color, bg, w = 256, h = 96, size = 54) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  let s = Math.min(size, h * 0.8); for (let i = 0; i < 40; i++) { ctx.font = `900 ${s}px Unbounded, 'Arial Black', sans-serif`; if (ctx.measureText(text).width <= w * 0.92 || s <= 8) break; s = Math.max(8, Math.floor(s * 0.92)); }   // shrink to fit
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 2);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
}
function textPlate(parent, text, color, bg, w, h, x, y, z, size = 54) { return add(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelTex(text, color, bg, 256, Math.round(256 * h / w), size), transparent: !bg }), x, y, z); }
const hexOf = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
const darker = (c, k = 0.75) => new THREE.Color(hexOf(c)).multiplyScalar(k).getHex();
const lighter = (c, k = 0.25) => new THREE.Color(hexOf(c)).lerp(new THREE.Color(0xffffff), k).getHex();
const cssOf = c => '#' + new THREE.Color(hexOf(c)).getHexString();
function loadFaces() { if (!document.fonts || !document.fonts.load) return Promise.resolve(); const t = setTimeout(() => { }, 0); return Promise.race([Promise.all(['900 32px Unbounded', '700 32px Unbounded', '600 20px Onest', '500 20px Onest', '700 16px "JetBrains Mono"', '600 16px "JetBrains Mono"'].map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, 2500))]).then(() => clearTimeout(t)); }

/* custom photos (player uploads): id → texture, loaded on demand */
const PHOTO_TEX = {}, PHOTO_WAIT = {};
function photoTexFromUrl(id, url) {
  if (PHOTO_TEX[id]) return Promise.resolve(PHOTO_TEX[id]);
  if (!PHOTO_WAIT[id]) PHOTO_WAIT[id] = new Promise(res => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { const tx = new THREE.Texture(img); tx.colorSpace = THREE.SRGBColorSpace; tx.needsUpdate = true; tx.anisotropy = 8; PHOTO_TEX[id] = tx; res(tx); }; img.onerror = () => res(null); img.src = url; });
  return PHOTO_WAIT[id];
}
/* the photo becomes the front face of the head block (blended over the skin color) */
function applyPhotoTex(h, tx) {
  const P = h.userData.P; if (!P || !tx || !tx.image) return;
  if (P.facePlate) { P.facePlate.parent.remove(P.facePlate); P.facePlate = null; }
  if (P.headMesh && Array.isArray(P.headMesh.material)) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d');
    ctx.fillStyle = cssOf(P.skin ?? 0xdcae88); ctx.fillRect(0, 0, 256, 256);
    const im = tx.image, k = Math.max(256 / im.width, 256 / im.height), w = im.width * k, hh = im.height * k;   // the face fills the whole front of the head, like a block skin
    ctx.imageSmoothingEnabled = !(tx.userData && tx.userData.pixel);
    ctx.drawImage(im, 128 - w / 2, 128 - hh / 2, w, hh);
    const t2 = new THREE.CanvasTexture(c); t2.colorSpace = THREE.SRGBColorSpace; t2.anisotropy = 8;
    const mat = new THREE.MeshPhysicalMaterial({ map: t2, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 });
    P.headMesh.material[4] = mat; P.headMesh.material.needsUpdate = true; P.photoMat = mat; return;
  }
  const fa = P.faceAnchor || { y: 0.3, z: 0.3, w: 0.4, h: 0.5 };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(fa.w, fa.h), new THREE.MeshStandardMaterial({ map: tx, transparent: true, depthWrite: false, roughness: 0.75 })); m.position.set(0, fa.y, fa.z); (P.faceParent || P.head || P.torso).add(m);
  m.renderOrder = 2; m.castShadow = false; P.facePlate = m;
}

/* ================= drawn faces: one canvas per style, sits on the front of the head block ================= */
const FACE_TEX_CACHE = new Map(), FACE_MAT_CACHE = new Map();
function drawFace(ctx, style, o) {
  const ink = o.ink || '#17141f', skin = o.skin, acc = o.accent || '#43e8ff';
  const ell = (x, y, w, h, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); };
  const rrect = (x, y, w, h, r, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  const line = (x1, y1, x2, y2, lw = 9, c = ink) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const curve = (x1, y1, cx, cy, x2, y2, lw = 10, c = ink) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke(); };
  const eyes = (e = {}) => { const x = e.x ?? 40, y = e.y ?? 108, w = e.w ?? 17, h = e.h ?? 27; for (const s of [-1, 1]) { ell(128 + s * x, y, w, h, ink); if (e.hi !== false) ell(128 + s * x - 5, y - 9, 5, 7, '#fff'); } };
  const roundEyes = (r = 26, p = 13) => { for (const s of [-1, 1]) { ell(128 + s * 42, 108, r, r, '#fff'); ell(128 + s * 42 + 2, 110, p, p, ink); ell(128 + s * 42 - 4, 102, 4, 4, '#fff'); } };
  const happyEyes = () => { for (const s of [-1, 1]) curve(128 + s * 42 - 20, 112, 128 + s * 42, 90, 128 + s * 42 + 20, 112, 9); };
  const closedEyes = () => { for (const s of [-1, 1]) curve(128 + s * 42 - 20, 106, 128 + s * 42, 122, 128 + s * 42 + 20, 106, 9); };
  const smile = (w = 76, y = 156, d = 20, lw = 10) => curve(128 - w / 2, y, 128, y + d * 2, 128 + w / 2, y, lw);
  const smirk = () => curve(112, 160, 148, 172, 178, 150, 10);
  const frown = (w = 64, y = 178, d = 16) => curve(128 - w / 2, y, 128, y - d * 2, 128 + w / 2, y, 10);
  const openMouth = (w = 100, h = 54, y = 146, tongue = true) => { rrect(128 - w / 2, y, w, h, 18, ink); rrect(128 - w / 2 + 10, y + 7, w - 20, 13, 5, '#fff'); if (tongue) { ctx.save(); ctx.beginPath(); ctx.roundRect(128 - w / 2, y, w, h, 18); ctx.clip(); ell(128 + 6, y + h - 6, 26, 16, '#ff6b8a'); ctx.restore(); } };
  const brows = (angry = 1, y = 78) => { for (const s of [-1, 1]) line(128 + s * 60, y - angry * 8, 128 + s * 20, y + angry * 10, 10); };
  const blush = () => { for (const s of [-1, 1]) ell(128 + s * 66, 148, 17, 9, 'rgba(255,110,160,.5)'); };
  switch (style) {
    default: case 'smile': eyes(); smile(); break;
    case 'grin': eyes(); openMouth(); break;
    case 'chill': eyes({ h: 11, y: 112, hi: false }); smile(52, 160, 12, 9); break;
    case 'wink': ell(88, 108, 17, 27, ink); ell(83, 99, 5, 7, '#fff'); curve(148, 110, 170, 92, 192, 110, 9); smirk(); break;
    case 'cute': roundEyes(30, 17); for (const s of [-1, 1]) ell(128 + s * 42 - 8, 100, 7, 7, '#fff'); blush(); curve(104, 160, 116, 174, 128, 160, 8); curve(128, 160, 140, 174, 152, 160, 8); break;
    case 'cool': eyes({ h: 19, y: 110 }); line(146, 80, 190, 70, 9); line(66, 78, 110, 80, 9); smirk(); break;
    case 'angry': eyes({ h: 22 }); brows(1); frown(); break;
    case 'shock': roundEyes(28, 10); ell(128, 174, 20, 26, ink); ell(128, 180, 11, 14, '#5a1830'); break;
    case 'laugh': happyEyes(); openMouth(112, 60, 142); break;
    case 'sleepy': closedEyes(); ell(128, 172, 9, 9, ink); ctx.fillStyle = ink; ctx.font = '900 26px Unbounded, sans-serif'; ctx.fillText('z', 186, 72); ctx.font = '900 18px Unbounded, sans-serif'; ctx.fillText('z', 206, 52); break;
    case 'shades': rrect(50, 86, 72, 44, 12, ink); rrect(134, 86, 72, 44, 12, ink); line(120, 102, 136, 102, 7); line(50, 98, 30, 92, 6); line(206, 98, 226, 92, 6); ell(70, 98, 10, 5, 'rgba(255,255,255,.5)'); ell(154, 98, 10, 5, 'rgba(255,255,255,.5)'); smile(); break;
    case 'visor': rrect(34, 80, 188, 58, 16, '#0b0a14'); rrect(70, 94, 42, 26, 8, acc); rrect(144, 94, 42, 26, 8, acc); for (let i = 0; i < 5; i++) rrect(90 + i * 18, 160, 10, 10, 2, i % 2 ? acc : '#3b3a52'); break;
    case 'dead': for (const s of [-1, 1]) { line(128 + s * 42 - 16, 92, 128 + s * 42 + 16, 124, 9); line(128 + s * 42 + 16, 92, 128 + s * 42 - 16, 124, 9); } ctx.strokeStyle = ink; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(84, 168); for (let i = 1; i <= 6; i++) ctx.lineTo(84 + i * 15, 168 + (i % 2 ? 12 : 0)); ctx.stroke(); break;
    case 'stache': eyes(); for (const s of [-1, 1]) { ctx.save(); ctx.translate(128 + s * 24, 150); ctx.rotate(s * 0.25); ell(0, 0, 30, 11, ink); ctx.restore(); } smile(46, 176, 10, 8); break;
    case 'beard': eyes(); rrect(44, 140, 168, 96, 40, o.hair || ink); rrect(100, 150, 56, 12, 6, '#ffb3c6'); break;
    case 'pirate': ell(86, 108, 17, 27, ink); ell(81, 99, 5, 7, '#fff'); ell(170, 108, 28, 28, ink); line(26, 92, 236, 74, 8); openMouth(86, 40, 152, false); break;
    case 'cat': for (const s of [-1, 1]) { ell(128 + s * 42, 108, 20, 26, '#b4ff8a'); ell(128 + s * 42, 108, 6, 22, ink); ell(128 + s * 42 - 7, 98, 4, 5, '#fff'); } ell(128, 146, 8, 6, '#ff8fb8'); curve(108, 158, 118, 170, 128, 158, 7); curve(128, 158, 138, 170, 148, 158, 7); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(128 + s * 64, 140 + i * 14, 128 + s * 118, 130 + i * 20, 5); break;
    case 'ninja': rrect(18, 128, 220, 128, 34, o.mask || '#1a1724'); eyes({ h: 21, y: 104 }); brows(0.6, 76); break;
    case 'boo': for (const s of [-1, 1]) ell(128 + s * 38, 112, 18, 26, ink); ell(128, 172, 16, 24, ink); break;
    case 'blank': break;
  }
}
function faceTex(style, skin, o = {}) {
  const key = style + '|' + skin + '|' + (o.accent || '') + '|' + (o.hair || '') + '|' + (o.mask || '');
  if (FACE_TEX_CACHE.has(key)) return FACE_TEX_CACHE.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d');
  ctx.fillStyle = cssOf(skin); ctx.fillRect(0, 0, 256, 256);
  drawFace(ctx, style, { skin: cssOf(skin), accent: o.accent ? cssOf(o.accent) : undefined, hair: o.hair ? cssOf(o.hair) : undefined, mask: o.mask ? cssOf(o.mask) : undefined });
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; FACE_TEX_CACHE.set(key, tx); return tx;
}
function faceMat(style, skin, fin = 'classic', o = {}) {
  const key = style + '|' + skin + '|' + fin + '|' + (o.accent || '') + '|' + (o.hair || '') + '|' + (o.mask || '');
  if (FACE_MAT_CACHE.has(key)) return FACE_MAT_CACHE.get(key);
  const map = faceTex(style, skin, o);
  const mat = fin === 'ghost' ? new THREE.MeshPhysicalMaterial({ map, roughness: 0.2, clearcoat: 0.8, transparent: true, opacity: 0.6, depthWrite: false })
    : fin === 'metal' ? new THREE.MeshStandardMaterial({ map, roughness: 0.3, metalness: 0.8 })
      : new THREE.MeshPhysicalMaterial({ map, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  FACE_MAT_CACHE.set(key, mat); return mat;
}
/* animal faces (fur-colored background) */
function drawAnimalFace(ctx, type, o) {
  const ink = '#17141f', ell = (x, y, w, h, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); };
  const rrect = (x, y, w, h, r, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  const line = (x1, y1, x2, y2, lw = 7, c = ink) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const curve = (x1, y1, cx, cy, x2, y2, lw = 8, c = ink) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke(); };
  const dots = (x = 44, y = 100, r = 13) => { for (const s of [-1, 1]) { ell(128 + s * x, y, r, r * 1.15, ink); ell(128 + s * x - 4, y - 5, 4, 5, '#fff'); } };
  const nose = (y = 150, w = 18, h = 12, c = ink) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(128 - w, y - h / 2); ctx.lineTo(128 + w, y - h / 2); ctx.lineTo(128, y + h); ctx.closePath(); ctx.fill(); };
  const wmouth = (y = 170, w = 18) => { curve(128 - w * 2, y, 128 - w, y + 14, 128, y, 7); curve(128, y, 128 + w, y + 14, 128 + w * 2, y, 7); };
  switch (type) {
    case 'dog': dots(); nose(152, 20, 14); wmouth(172, 20); rrect(118, 176, 20, 26, 8, '#ff6b8a'); break;
    case 'cat': for (const s of [-1, 1]) { ell(128 + s * 44, 100, 18, 22, '#ffd36e'); ell(128 + s * 44, 100, 5, 18, ink); } nose(150, 12, 9, '#ff8fb8'); wmouth(168, 14); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(128 + s * 64, 150 + i * 12, 128 + s * 118, 142 + i * 16, 4); break;
    case 'capy': ell(84, 96, 9, 10, ink); ell(172, 96, 9, 10, ink); rrect(100, 136, 56, 40, 18, o.snout || '#6b4a2e'); ell(118, 150, 6, 7, ink); ell(138, 150, 6, 7, ink); line(108, 186, 148, 186, 6); break;
    case 'bear': dots(44, 96, 12); ell(128, 160, 40, 30, o.snout || '#f0cfa6'); nose(150, 14, 10); line(116, 176, 140, 176, 6); break;
    case 'bull': for (const s of [-1, 1]) { ell(128 + s * 46, 94, 14, 14, '#fff'); ell(128 + s * 46 + 3, 96, 8, 8, ink); line(128 + s * 68, 70, 128 + s * 26, 84, 9); } rrect(84, 136, 88, 56, 24, o.snout || '#f3b4b4'); ell(110, 164, 9, 11, ink); ell(146, 164, 9, 11, ink); break;
    case 'hamster': dots(42, 100, 16); for (const s of [-1, 1]) ell(128 + s * 76, 150, 30, 26, o.cheek || '#f7dfc0'); nose(146, 10, 8, '#ff8fb8'); wmouth(164, 12); break;
    case 'raccoon': rrect(30, 76, 196, 56, 26, '#2a2432'); for (const s of [-1, 1]) { ell(128 + s * 44, 104, 20, 18, '#f4f4f4'); ell(128 + s * 44, 106, 9, 11, ink); } nose(156, 16, 12); wmouth(176, 14); break;
    case 'bird': for (const s of [-1, 1]) { ell(128 + s * 50, 92, 15, 15, '#fff'); ell(128 + s * 50 + 2, 94, 8, 8, ink); } break;
    case 'frog': curve(60, 150, 128, 200, 196, 150, 10); for (const s of [-1, 1]) ell(128 + s * 36, 140, 6, 5, ink); break;
    case 'whale': for (const s of [-1, 1]) { ell(128 + s * 70, 110, 12, 14, ink); ell(128 + s * 70 - 4, 104, 4, 5, '#fff'); } curve(70, 160, 128, 200, 186, 160, 9); break;
    case 'tako': for (const s of [-1, 1]) { ell(128 + s * 44, 110, 26, 26, '#fff'); ell(128 + s * 44 + 4, 114, 13, 13, ink); ell(128 + s * 44 - 4, 104, 4, 5, '#fff'); } ell(128, 176, 10, 12, ink); break;
    case 'smile': dots(44, 104, 11); curve(90, 160, 128, 196, 166, 160, 9); break;
    case 'blank': break;
  }
}
function animalMat(type, col, o = {}) {
  const key = 'A' + type + '|' + col + '|' + JSON.stringify(o);
  if (FACE_MAT_CACHE.has(key)) return FACE_MAT_CACHE.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d');
  ctx.fillStyle = cssOf(col); ctx.fillRect(0, 0, 256, 256); drawAnimalFace(ctx, type, o);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const mat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.4 }); FACE_MAT_CACHE.set(key, mat); return mat;
}

/* ================= the blocky body: head block, torso block, four limb blocks ================= */
const S = 0.32;   // one unit of the block grid
const DIMS = { tw: 2 * S, th: 2 * S, td: S, aw: S, ah: 2 * S, ad: S, lw: S, lh: 2 * S, ld: S, hs: 1.25 * S };
function finishMat(fin, c, part) {
  if (fin === 'metal') return METAL(c, { roughness: 0.28 });
  if (fin === 'robot') return part === 'skin' ? METAL(c, { roughness: 0.42, metalness: 0.7 }) : PLASTIC(c);
  if (fin === 'ghost') return GHOSTM(c);
  return PLASTIC(c);
}
function makeBlocky(o) {
  const B = { ...DIMS, ...(o.dims || {}) }, fin = o.finish || 'classic';
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const skin = finishMat(fin, o.skin, 'skin'), shirt = finishMat(fin, o.shirt, 'cloth'), pants = finishMat(fin, o.pants, 'cloth'), shoes = finishMat(fin, o.shoes ?? 0x1a1a1a, 'cloth');
  const P = { rig, legLen: B.lh, torsoH: B.th, tw: B.tw / 2, r: B.hs / 2, hs: B.hs, B, front: B.td / 2, skin: o.skin, fin, mats: { skin, shirt, pants, shoes } };
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(s * B.lw / 2, B.lh, 0); rig.add(pv);
    add(pv, RBOX(B.lw, B.lh, B.ld, 0.035), pants, 0, -B.lh / 2, 0);
    if (fin !== 'ghost' && o.shoes !== null) add(pv, RBOX(B.lw + 0.02, 0.13, B.ld + 0.06, 0.035), shoes, 0, -B.lh + 0.065, 0.025);
    P[s < 0 ? 'legL' : 'legR'] = pv;
  }
  if (fin !== 'ghost') { const hip = add(rig, CYL(B.ld * 0.5, B.ld * 0.5, B.lw * 2 - 0.03, 24), pants, 0, B.lh, 0); hip.rotation.z = Math.PI / 2; hip.castShadow = false; }   // hip roller: a swinging leg never opens a gap under the torso
  const torso = new THREE.Group(); torso.position.y = B.lh; rig.add(torso); P.torso = torso;
  P.body = add(torso, RBOX(B.tw, B.th, B.td, 0.045), shirt, 0, B.th / 2, 0);
  const sleeves = o.sleeves || 'long';
  for (const s of [-1, 1]) {
    // shoulder joint sits in the middle of the arm's top block: the arm turns in place against the torso instead of swinging away from it
    const sh = new THREE.Group(); sh.position.set(s * (B.tw / 2 + B.aw / 2 + 0.006), B.th - B.aw / 2, 0); torso.add(sh);
    add(sh, RBOX(B.aw, B.ah, B.ad, 0.035), sleeves === 'long' ? shirt : skin, 0, -B.ah / 2 + B.aw / 2, 0);
    if (sleeves === 'short') add(sh, RBOX(B.aw + 0.024, B.ah * 0.34, B.ad + 0.024, 0.035), shirt, 0, -B.ah * 0.17 + B.aw / 2, 0);
    const hand = new THREE.Group(); hand.position.y = -B.ah + B.aw / 2 + 0.1; sh.add(hand); sh.userData.hand = hand;
    P[s < 0 ? 'armL' : 'armR'] = sh;
  }
  const head = new THREE.Group(); head.position.y = B.th + B.hs / 2 + 0.035; torso.add(head); P.head = head; P.hat = head;
  add(torso, CYL(B.hs * 0.2, B.hs * 0.2, 0.09, 12), skin, 0, B.th + 0.02, 0);
  const fm = faceMat(o.face || 'smile', o.skin, fin, { accent: o.accent, hair: o.hairCol, mask: o.mask });
  P.headMesh = add(head, RBOX(B.hs, B.hs, B.hs, 0.075), [skin, skin, skin, skin, fm, skin]);
  root.userData = { P, kind: 'block', legLen: B.lh, torsoH: B.th, r: B.hs / 2, height: B.lh + B.th + B.hs + 0.07 };
  if (o.scale) root.scale.setScalar(o.scale);
  return root;
}

/* ---- hats and hair, all built from blocks around the head ---- */
function hatStyle(P, style, col, accent) {
  const h = P.hs, head = P.head, m = FUR(col), cl = CLOTH(col), mt = METAL(col, { roughness: 0.3 });
  switch (style) {
    case 'short': add(head, RBOX(h * 1.1, h * 0.32, h * 1.1, 0.05), m, 0, h * 0.42, -h * 0.02); add(head, RBOX(h * 1.1, h * 0.55, h * 0.32, 0.05), m, 0, h * 0.08, -h * 0.42); break;
    case 'bowl': add(head, RBOX(h * 1.12, h * 0.4, h * 1.12, 0.06), m, 0, h * 0.4, 0); add(head, RBOX(h * 1.12, h * 0.26, h * 0.16, 0.04), m, 0, h * 0.24, h * 0.5); for (const s of [-1, 1]) add(head, RBOX(h * 0.16, h * 0.62, h * 1.12, 0.04), m, s * h * 0.5, h * 0.06, 0); break;
    case 'spiky': add(head, RBOX(h * 1.1, h * 0.3, h * 1.1, 0.05), m, 0, h * 0.42, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = add(head, RBOX(h * 0.22, h * 0.5, h * 0.22, 0.03), m, Math.sin(a) * h * 0.34, h * 0.7, Math.cos(a) * h * 0.34); sp.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); } break;
    case 'mohawk': for (let i = 0; i < 5; i++) add(head, RBOX(h * 0.16, h * (0.42 + Math.sin(i / 4 * Math.PI) * 0.36), h * 0.22, 0.03), m, 0, h * (0.66 + Math.sin(i / 4 * Math.PI) * 0.16), h * (0.44 - i * 0.22)); break;
    case 'bun': add(head, RBOX(h * 1.1, h * 0.32, h * 1.1, 0.05), m, 0, h * 0.42, 0); add(head, RBOX(h * 1.1, h * 0.55, h * 0.32, 0.05), m, 0, h * 0.08, -h * 0.42); add(head, RBOX(h * 0.42, h * 0.42, h * 0.42, 0.12), m, 0, h * 0.62, -h * 0.3); add(head, new THREE.TorusGeometry(h * 0.2, 0.012, 6, 14), M(accent), 0, h * 0.54, -h * 0.3).rotation.x = 0.4; break;
    case 'long': add(head, RBOX(h * 1.12, h * 0.34, h * 1.12, 0.05), m, 0, h * 0.42, 0); add(head, RBOX(h * 1.12, h * 1.3, h * 0.3, 0.05), m, 0, -h * 0.2, -h * 0.46); for (const s of [-1, 1]) add(head, RBOX(h * 0.22, h * 1.15, h * 0.9, 0.05), m, s * h * 0.5, -h * 0.12, -h * 0.08); break;
    case 'cap': case 'backcap': { const back = style === 'backcap'; add(head, RBOX(h * 1.14, h * 0.46, h * 1.14, 0.09), cl, 0, h * 0.4, 0); const br = add(head, RBOX(h * 0.92, 0.035, h * 0.6, 0.02), cl, 0, h * 0.24, (back ? -1 : 1) * h * 0.78); br.rotation.x = back ? -0.12 : 0.12; add(head, SPH(0.03, 8, 6), cl, 0, h * 0.64, 0); add(head, RBOX(h * 0.3, h * 0.18, 0.02, 0.01), M(accent), 0, h * 0.42, (back ? -1 : 1) * h * 0.58); break; }
    case 'beanie': add(head, RBOX(h * 1.16, h * 0.62, h * 1.16, 0.12), cl, 0, h * 0.4, 0); add(head, RBOX(h * 1.2, h * 0.18, h * 1.2, 0.04), CLOTH(darker(col, 0.8)), 0, h * 0.16, 0); add(head, SPH(h * 0.16, 12, 10), FUR(0xf4f4f4), 0, h * 0.8, 0); break;
    case 'tophat': add(head, CYL(h * 0.5, h * 0.5, h * 0.68, 20), cl, 0, h * 0.84, 0); add(head, CYL(h * 0.78, h * 0.78, 0.03, 24), cl, 0, h * 0.52, 0); add(head, CYL(h * 0.52, h * 0.52, h * 0.14, 20), M(accent), 0, h * 0.6, 0); break;
    case 'cowboy': add(head, RBOX(h * 0.96, h * 0.5, h * 0.96, 0.12), cl, 0, h * 0.66, 0); add(head, RBOX(h * 1.9, 0.035, h * 1.5, 0.02), cl, 0, h * 0.44, 0); for (const s of [-1, 1]) { const w = add(head, RBOX(h * 0.4, 0.035, h * 1.5, 0.02), cl, s * h * 1.02, h * 0.54, 0); w.rotation.z = -s * 0.55; } add(head, RBOX(h * 1.0, h * 0.1, h * 1.0, 0.02), M(accent), 0, h * 0.48, 0); break;
    case 'pirate': add(head, RBOX(h * 1.7, h * 0.52, h * 0.5, 0.1), cl, 0, h * 0.66, h * 0.1); add(head, RBOX(h * 1.14, h * 0.3, h * 1.14, 0.08), cl, 0, h * 0.42, 0); add(head, new THREE.PlaneGeometry(h * 0.42, h * 0.42), skullMat(), 0, h * 0.68, h * 0.36).castShadow = false; break;
    case 'wizard': { const c = add(head, CONE(h * 0.62, h * 1.5, 14), cl, 0, h * 1.1, 0); c.rotation.z = 0.12; add(head, CYL(h * 0.96, h * 0.96, 0.035, 24), cl, 0, h * 0.42, 0); add(head, CYL(h * 0.56, h * 0.62, h * 0.12, 14), M(accent), 0, h * 0.54, 0); add(c, SPH(0.035, 8, 6), GLOW(accent, 1.5), 0, h * 0.72, 0); break; }
    case 'helmet': add(head, RBOX(h * 1.18, h * 0.78, h * 1.18, 0.12), mt, 0, h * 0.26, 0); add(head, BOX(h * 0.12, h * 0.6, 0.03), mt, 0, -h * 0.02, h * 0.58); for (const s of [-1, 1]) add(head, BOX(h * 0.06, h * 0.56, h * 0.08), mt, s * h * 0.56, -h * 0.02, h * 0.3); add(head, RBOX(h * 0.12, h * 0.46, h * 0.8, 0.04), M(accent), 0, h * 0.82, -h * 0.1); break;
    case 'bucket': add(head, CYL(h * 0.62, h * 0.74, h * 0.56, 18), cl, 0, h * 0.46, 0); add(head, CYL(h * 0.88, h * 0.82, 0.04, 22), cl, 0, h * 0.2, 0); break;
    case 'crown': { const g = METAL(0xffc633, { roughness: 0.25 }); add(head, CYL(h * 0.56, h * 0.52, h * 0.2, 8), g, 0, h * 0.56, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(head, BOX(h * 0.14, h * 0.3, h * 0.14), g, Math.sin(a) * h * 0.48, h * 0.78, Math.cos(a) * h * 0.48); } add(head, SPH(h * 0.08, 10, 8), GLOW(accent, 1.2), 0, h * 0.58, h * 0.56); break; }
    case 'bandana': add(head, RBOX(h * 1.12, h * 0.22, h * 1.12, 0.05), cl, 0, h * 0.3, 0); add(head, RBOX(h * 0.22, h * 0.22, h * 0.22, 0.06), cl, 0, h * 0.26, -h * 0.62); for (const s of [-1, 1]) { const t = add(head, RBOX(h * 0.12, h * 0.5, 0.03, 0.02), cl, s * h * 0.12, 0, -h * 0.66); t.rotation.z = s * 0.4; } break;
    case 'astro': add(head, RBOX(h * 1.42, h * 1.42, h * 1.42, 0.36), PHYS(0xcfe6ff, { roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }), 0, h * 0.04, 0).castShadow = false; add(head, CYL(h * 0.72, h * 0.76, 0.1, 20), METAL(0xd9dde6, { roughness: 0.4 }), 0, -h * 0.66, 0); break;
    case 'halo': add(head, new THREE.TorusGeometry(h * 0.5, 0.03, 8, 28), GLOW(0xffe066, 1.6), 0, h * 0.98, 0).rotation.x = Math.PI / 2; break;
    case 'none': default: break;
  }
}
/* ---- gear: things hanging on the body ---- */
function gearStyle(P, acc, col, accent, hairCol) {
  const h = P.hs, B = P.B, torso = P.torso, head = P.head;
  switch (acc) {
    case 'chain': { const tq = add(torso, new THREE.TorusGeometry(B.tw * 0.36, 0.022, 8, 30), METAL(0xffc633), 0, B.th - 0.1, B.td * 0.2); tq.rotation.x = Math.PI / 2 + 0.55; tq.scale.y = 0.9; add(torso, CYL(0.06, 0.06, 0.02, 18), METAL(0xffc633), 0, B.th - 0.34, B.td / 2 + 0.012).rotation.x = Math.PI / 2; break; }
    case 'headphones': { const m = M(darker(col, 0.6), { roughness: 0.4 }); add(head, new THREE.TorusGeometry(h * 0.64, 0.03, 8, 30, Math.PI), m, 0, h * 0.06, 0); for (const s of [-1, 1]) { add(head, CYL(h * 0.3, h * 0.3, 0.09, 18), m, s * h * 0.6, 0, 0).rotation.z = Math.PI / 2; add(head, CYL(h * 0.17, h * 0.17, 0.02, 14), GLOW(accent, 1.3), s * h * 0.66, 0, 0).rotation.z = Math.PI / 2; } break; }
    case 'backpack': { const m = CLOTH(col); add(torso, RBOX(B.tw * 0.78, B.th * 0.76, 0.22, 0.05), m, 0, B.th * 0.5, -B.td / 2 - 0.11); add(torso, RBOX(B.tw * 0.5, B.th * 0.3, 0.06, 0.03), M(accent), 0, B.th * 0.38, -B.td / 2 - 0.25); for (const s of [-1, 1]) add(torso, BOX(0.06, B.th * 0.8, 0.02), M(darker(col, 0.6)), s * B.tw * 0.26, B.th * 0.5, B.td / 2 + 0.01); break; }
    case 'cape': { const c = add(torso, RBOX(B.tw * 1.06, B.th * 1.75, 0.025, 0.02), CLOTH(col), 0, B.th * 0.5 - B.th * 0.4, -B.td / 2 - 0.035); c.rotation.x = 0.1; add(torso, BOX(B.tw * 1.1, 0.06, 0.06), M(accent), 0, B.th - 0.03, -B.td / 2); break; }
    case 'wings': { const m = CLOTH(0xf7f7ff); for (const s of [-1, 1]) { const w = add(torso, RBOX(0.46, 0.3, 0.03, 0.05), m, s * 0.34, B.th * 0.7, -B.td / 2 - 0.05); w.rotation.set(0, s * 0.5, s * 0.35); const w2 = add(torso, RBOX(0.3, 0.2, 0.03, 0.05), m, s * 0.5, B.th * 0.45, -B.td / 2 - 0.1); w2.rotation.set(0, s * 0.6, s * 0.1); } break; }
    case 'halo': hatStyle(P, 'halo', 0xffe066, 0xffe066); break;
    case 'horns': for (const s of [-1, 1]) { const c = add(head, CONE(h * 0.14, h * 0.5, 8), M(accent, { roughness: 0.5 }), s * h * 0.42, h * 0.66, 0); c.rotation.z = -s * 0.45; } break;
    case 'catears': for (const s of [-1, 1]) { const e = add(head, CONE(h * 0.24, h * 0.42, 4), FUR(hairCol), s * h * 0.38, h * 0.66, 0); e.rotation.y = Math.PI / 4; add(head, CONE(h * 0.12, h * 0.24, 4), M(0xffb3c6), s * h * 0.38, h * 0.64, h * 0.04).rotation.y = Math.PI / 4; } break;
    case 'scarf': add(torso, RBOX(h * 1.2, 0.13, h * 1.2, 0.05), CLOTH(col), 0, B.th + 0.02, 0); add(torso, RBOX(0.14, 0.42, 0.035, 0.03), CLOTH(col), 0.1, B.th - 0.22, B.td / 2 + 0.03); break;
    case 'sword': { const g = new THREE.Group(); g.position.set(-0.08, B.th * 0.6, -B.td / 2 - 0.08); g.rotation.z = 0.5; torso.add(g); add(g, BOX(0.06, 0.9, 0.02), METAL(0xd9dde6, { roughness: 0.25 }), 0, 0.3, 0); add(g, BOX(0.2, 0.05, 0.05), METAL(0xffc633), 0, -0.16, 0); add(g, CYL(0.03, 0.03, 0.2, 10), CLOTH(0x3a2618), 0, -0.28, 0); break; }
    case 'jetpack': { const m = METAL(0xd9dde6, { roughness: 0.4 }); for (const s of [-1, 1]) { add(torso, CYL(0.09, 0.09, B.th * 0.8, 14), m, s * 0.14, B.th * 0.5, -B.td / 2 - 0.1); add(torso, CONE(0.07, 0.14, 10), GLOW(accent, 1.4), s * 0.14, B.th * 0.06, -B.td / 2 - 0.1).rotation.x = Math.PI; } add(torso, RBOX(0.42, 0.1, 0.1, 0.02), m, 0, B.th * 0.8, -B.td / 2 - 0.1); break; }
    case 'none': default: break;
  }
}
/* ---- tops: what sits on the torso block ---- */
function topStyle(P, style, col, accent, skin) {
  const B = P.B, torso = P.torso, z = B.td / 2;
  switch (style) {
    case 'tee': add(torso, RBOX(0.16, 0.16, 0.02, 0.03), M(accent), 0, B.th * 0.6, z + 0.01); break;
    case 'hoodie': add(torso, RBOX(P.hs * 1.26, P.hs * 0.5, P.hs * 0.74, 0.1), CLOTH(col), 0, B.th + 0.06, -B.td * 0.42); add(torso, RBOX(B.tw * 0.7, 0.15, 0.03, 0.03), CLOTH(darker(col, 0.8)), 0, B.th * 0.26, z + 0.012); for (const s of [-1, 1]) add(torso, CYL(0.012, 0.012, 0.22), M(0xffffff), s * 0.07, B.th - 0.17, z + 0.02); break;
    case 'jacket': add(torso, BOX(B.tw * 0.3, B.th * 0.92, 0.02), CLOTH(darker(col, 0.5)), 0, B.th * 0.5, z + 0.01); for (const s of [-1, 1]) { const l = add(torso, BOX(0.1, B.th * 0.5, 0.025), CLOTH(darker(col, 0.8)), s * 0.14, B.th * 0.74, z + 0.015); l.rotation.z = s * 0.35; } add(torso, BOX(0.02, B.th * 0.9, 0.025), METAL(0xd9dde6), 0, B.th * 0.5, z + 0.02); break;
    case 'suit': add(torso, BOX(B.tw * 0.28, B.th * 0.96, 0.015), M(0xf4f4f4), 0, B.th * 0.5, z + 0.008); for (const s of [-1, 1]) { const l = add(torso, BOX(0.12, B.th * 0.62, 0.02), CLOTH(darker(col, 0.7)), s * 0.14, B.th * 0.68, z + 0.012); l.rotation.z = s * 0.3; } add(torso, BOX(0.075, B.th * 0.56, 0.02), M(accent), 0, B.th * 0.56, z + 0.018); add(torso, BOX(0.11, 0.06, 0.02), M(accent), 0, B.th * 0.88, z + 0.018); break;
    case 'tank': for (const s of [-1, 1]) add(torso, BOX(0.1, 0.1, B.td + 0.02), skin, s * B.tw * 0.33, B.th - 0.05, 0); break;
    case 'armor': { const m = METAL(col, { roughness: 0.35 }); add(torso, RBOX(B.tw * 0.92, B.th * 0.8, 0.06, 0.03), m, 0, B.th * 0.52, z + 0.01); add(torso, RBOX(B.tw * 0.92, B.th * 0.6, 0.05, 0.03), m, 0, B.th * 0.5, -z - 0.01); for (const s of [-1, 1]) add(s < 0 ? P.armL : P.armR, RBOX(B.aw * 1.3, 0.14, B.ad * 1.3, 0.04), m, 0, B.aw / 2 - 0.05, 0); add(torso, RBOX(B.tw * 0.5, 0.2, 0.03, 0.02), M(accent), 0, B.th * 0.55, z + 0.05); add(torso, RBOX(B.tw * 1.02, 0.1, B.td + 0.04, 0.02), CLOTH(0x3a2618), 0, 0.08, 0); break; }
    case 'robe': add(torso, CYL(B.tw * 0.6, B.tw * 0.95, B.th * 0.9, 4), CLOTH(col), 0, -B.th * 0.05, 0).rotation.y = Math.PI / 4; for (const s of [-1, 1]) add(torso, BOX(0.1, B.th * 0.95, 0.02), M(accent), s * 0.12, B.th * 0.5, z + 0.012); break;
    default: break;
  }
}

/* ================= player-made characters ================= */
const EMOTES = ['bounce', 'zap', 'spin', 'wiggle', 'flip', 'dive', 'selfie', 'keys', 'box', 'footwork', 'float', 'scream', 'rain', 'dab', 'wave', 'moonwalk', 'robot', 'hearts'];
const LOOK_OPTS = {
  base: ['own', ...CHARS.filter(c => c.id !== 'custom' && !c.npc).map(c => c.id)],
  emote: ['auto', ...EMOTES],
  body: ['classic', 'robot', 'ghost', 'metal'],
  build: ['normal', 'slim', 'big', 'small'],
  hair: ['short', 'bowl', 'spiky', 'mohawk', 'bun', 'long', 'cap', 'backcap', 'beanie', 'tophat', 'cowboy', 'pirate', 'wizard', 'helmet', 'bucket', 'crown', 'bandana', 'astro', 'none'],
  eyes: ['smile', 'grin', 'chill', 'wink', 'cute', 'cool', 'angry', 'shock', 'laugh', 'sleepy', 'shades', 'visor', 'dead', 'stache', 'beard', 'pirate', 'cat', 'ninja', 'boo'],
  acc: ['none', 'chain', 'headphones', 'backpack', 'cape', 'wings', 'halo', 'horns', 'catears', 'scarf', 'sword', 'jetpack'],
  top: ['tee', 'hoodie', 'jacket', 'suit', 'tank', 'armor', 'robe'],
  skins: ['#f3cbb5', '#e8b894', '#dcae88', '#c48a63', '#9a6a48', '#6e4c42', '#3e2b27', '#ffd36e', '#9ff2c8', '#7fd4ff', '#cdbcff', '#ff9ad5', '#f4f4f4', '#9aa3b2', '#e5bf72', '#1a1724'],
  cols: ['#ff4fa3', '#43e8ff', '#ffc94a', '#52f5a8', '#ff6a2a', '#a66bff', '#ffffff', '#1a1724', '#2b3d66', '#a8122c', '#2fb8a8', '#e5bf72', '#5a3a22', '#f2f2f2', '#9aa3b2', '#1f6a3a']
};
const DEFAULT_LOOK = { base: 'own', body: 'classic', build: 'normal', skin: '#dcae88', hair: 'short', hairCol: '#2a1c14', eyes: 'smile', acc: 'chain', top: 'hoodie', topCol: '#a66bff', pants: '#2b3d66', shoes: '#f2f2f2', accent: '#43e8ff', emote: 'auto', photo: '', say: ['', '', ''] };
function sanitizeLook(l) {
  const o = { ...DEFAULT_LOOK }; if (!l || typeof l !== 'object') return o;
  const hex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
  for (const k of ['base', 'emote', 'body', 'build', 'hair', 'eyes', 'acc', 'top']) if (LOOK_OPTS[k].includes(l[k])) o[k] = l[k];
  for (const k of ['skin', 'hairCol', 'topCol', 'pants', 'shoes', 'accent']) { const v = hex(l[k]); if (v) o[k] = v; }
  if (typeof l.photo === 'string' && (l.photo === 'local' || /^[a-f0-9]{8,40}$/.test(l.photo))) o.photo = l.photo;
  if (Array.isArray(l.say)) o.say = [0, 1, 2].map(i => String(l.say[i] || '').replace(/[<>]/g, '').slice(0, 48));
  return o;
}
function randomLook() {
  const p = a => a[Math.floor(Math.random() * a.length)];
  return { base: 'own', emote: 'auto', photo: '', say: ['', '', ''], body: Math.random() < 0.7 ? 'classic' : p(LOOK_OPTS.body), build: p(LOOK_OPTS.build), skin: p(LOOK_OPTS.skins.slice(0, 7)), hair: p(LOOK_OPTS.hair), hairCol: p(['#2a1c14', '#5a3a22', '#e5bf72', '#1a1724', '#ffffff', '#43e8ff', '#a66bff', '#ff4fa3', '#a8122c']), eyes: p(LOOK_OPTS.eyes.slice(0, 12)), acc: p(LOOK_OPTS.acc), top: p(LOOK_OPTS.top), topCol: p(LOOK_OPTS.cols), pants: p(LOOK_OPTS.cols), shoes: p(LOOK_OPTS.cols), accent: p(LOOK_OPTS.cols) };
}
const EMOTE_OF_BODY = { classic: 'selfie', robot: 'robot', ghost: 'float', metal: 'rain' };
const BUILDS = { normal: {}, slim: { dims: { tw: 1.7 * S, aw: 0.8 * S, lw: 0.86 * S, ah: 2.1 * S, lh: 2.15 * S } }, big: { dims: { tw: 2.5 * S, td: 1.25 * S, aw: 1.15 * S, ad: 1.15 * S, lw: 1.1 * S, hs: 1.3 * S, lh: 1.8 * S } }, small: { dims: { hs: 1.45 * S, lh: 1.6 * S, ah: 1.6 * S, th: 1.7 * S }, scale: 0.8 } };
function assembleLook(L) {
  const skin = hexOf(L.skin), accent = hexOf(L.accent), topCol = hexOf(L.topCol), pants = hexOf(L.pants), shoes = hexOf(L.shoes), hairCol = hexOf(L.hairCol);
  const fin = L.body, bd = BUILDS[L.build] || BUILDS.normal;
  let face = L.eyes; if (fin === 'robot' && !['visor', 'shades', 'dead', 'boo'].includes(face)) face = 'visor'; if (fin === 'ghost' && face === 'smile') face = 'boo';
  const h = makeBlocky({ skin, shirt: topCol, pants, shoes: fin === 'ghost' ? null : shoes, finish: fin, face, accent, hairCol, mask: L.top === 'tee' ? undefined : darker(topCol, 0.6), sleeves: L.top === 'tank' ? 'skin' : L.top === 'tee' ? 'short' : 'long', dims: bd.dims, scale: bd.scale });
  const P = h.userData.P;
  topStyle(P, L.top, topCol, accent, P.mats.skin);
  if (L.hair !== 'none') hatStyle(P, L.hair, L.hair === 'helmet' || L.hair === 'crown' ? 0xd9dde6 : hairCol, accent);
  gearStyle(P, L.acc, L.acc === 'cape' || L.acc === 'scarf' || L.acc === 'backpack' ? accent : topCol, accent, hairCol);
  if (fin === 'robot') { add(P.head, CYL(0.012, 0.012, 0.2), METAL(0x9aa3b2), 0, P.hs * 0.6, 0); add(P.head, SPH(0.04, 10, 8), GLOW(accent, 1.5), 0, P.hs * 0.74, 0); for (const s of [-1, 1]) add(P.head, CYL(0.05, 0.05, 0.05, 12), METAL(0x9aa3b2), s * P.hs * 0.52, 0, 0).rotation.z = Math.PI / 2; }
  return h;
}
function buildCustom(look) {
  const L = sanitizeLook(look);
  let h;
  if (L.base !== 'own' && CHAR[L.base] && CHAR[L.base].look) h = assembleLook({ ...CHAR[L.base].look, skin: L.skin, accent: L.accent, acc: L.acc, eyes: ['smile', 'shades'].includes(L.eyes) ? L.eyes : CHAR[L.base].look.eyes, topCol: L.topCol, pants: L.pants, shoes: L.shoes });
  else h = assembleLook(L);
  h.userData.emote = L.emote !== 'auto' ? L.emote : (L.base !== 'own' && CHAR[L.base]) ? CHAR[L.base].emote : (EMOTE_OF_BODY[L.body] || 'selfie'); h.userData.look = L;
  if (L.photo && PHOTO_TEX[L.photo]) applyPhotoTex(h, PHOTO_TEX[L.photo]);
  return h;
}

/* ================= townsfolk: blocky animals and mascots, NPC only ================= */
function quadBlock(o) {
  // o: { col, belly, bw, bh, bl, legW, legLen, hs, headY, headZ, face, faceOpts, legCol, ears, tail, snout }
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const m = PLASTIC(o.col), legM = PLASTIC(o.legCol ?? o.col), P = { rig }, legLen = o.legLen, bodyY = legLen + o.bh / 2 - 0.02;
  const torso = new THREE.Group(); torso.position.y = bodyY; rig.add(torso); P.torso = torso;
  add(torso, RBOX(o.bw, o.bh, o.bl, 0.06), m, 0, 0, 0);
  if (o.belly) add(torso, RBOX(o.bw * 0.7, o.bh * 0.5, o.bl * 0.8, 0.04), PLASTIC(o.belly), 0, -o.bh * 0.3, 0);
  const lw = o.legW;
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const pv = new THREE.Group(); pv.position.set(sx * (o.bw / 2 - lw / 2), legLen, sz * (o.bl / 2 - lw / 2)); rig.add(pv); add(pv, RBOX(lw, legLen, lw, 0.03), legM, 0, -legLen / 2, 0); return pv; });
  P.legL = legs[0]; P.legR = legs[1]; P.armL = legs[3]; P.armR = legs[2]; P.armL.userData.hand = P.armL; P.armR.userData.hand = P.armR;
  const hs = o.hs, head = new THREE.Group(); head.position.set(0, o.headY ?? o.bh * 0.4, o.bl / 2 + hs * (o.headZ ?? 0.3)); torso.add(head); P.head = head; P.r = hs / 2; P.hs = hs;
  const fm = animalMat(o.face || 'dog', o.col, o.faceOpts || {});
  P.headMesh = add(head, RBOX(hs, hs, hs, 0.07), [m, m, m, m, fm, m]);
  if (o.ears === 'tri') for (const s of [-1, 1]) { const e = add(head, CONE(hs * 0.22, hs * 0.4, 4), m, s * hs * 0.34, hs * 0.62, -hs * 0.05); e.rotation.y = Math.PI / 4; }
  if (o.ears === 'round') for (const s of [-1, 1]) add(head, RBOX(hs * 0.3, hs * 0.3, hs * 0.14, 0.06), m, s * hs * 0.42, hs * 0.58, -hs * 0.05);
  if (o.ears === 'long') for (const s of [-1, 1]) add(head, RBOX(hs * 0.2, hs * 0.5, hs * 0.14, 0.05), m, s * hs * 0.5, hs * 0.35, -hs * 0.05);
  if (o.ears === 'horns') for (const s of [-1, 1]) { const hn = add(head, CONE(hs * 0.12, hs * 0.4, 8), M(0xf4f4f4, { roughness: 0.5 }), s * hs * 0.5, hs * 0.52, 0); hn.rotation.z = -s * 0.7; }
  if (o.snout) add(head, RBOX(hs * 0.5, hs * 0.32, hs * 0.26, 0.05), PLASTIC(o.snout), 0, -hs * 0.14, hs * 0.56);
  if (o.beak) add(head, RBOX(hs * 0.3, hs * 0.16, hs * 0.4, 0.03), M(o.beak, { roughness: 0.5 }), 0, -hs * 0.08, hs * 0.62);
  if (o.tail === 'curl') add(torso, new THREE.TorusGeometry(0.09, 0.035, 8, 14, Math.PI * 1.4), m, 0, o.bh * 0.4, -o.bl / 2 - 0.02).rotation.y = Math.PI / 2;
  if (o.tail === 'stub') add(torso, RBOX(0.1, 0.1, 0.12, 0.03), m, 0, o.bh * 0.3, -o.bl / 2 - 0.05);
  if (o.tail === 'long') { const t = add(torso, RBOX(0.08, 0.08, 0.5, 0.03), m, 0, o.bh * 0.35, -o.bl / 2 - 0.2); t.rotation.x = -0.5; }
  if (o.tail === 'ring') { const t = add(torso, RBOX(0.1, 0.1, 0.46, 0.03), PLASTIC(o.tailCol || o.col), 0, o.bh * 0.35, -o.bl / 2 - 0.2); t.rotation.x = -0.7; for (let i = 0; i < 3; i++) add(t, BOX(0.11, 0.11, 0.06), PLASTIC(0x2a2432), 0, 0, -0.16 + i * 0.14); }
  root.userData = { P, kind: 'plush', legLen, torsoH: o.bh, r: hs / 2, height: bodyY + o.bh / 2 + hs * 0.9 };
  return root;
}
function makeCritter(type) {
  let h, P;
  switch (type) {
    case 'capy': h = quadBlock({ col: 0x9c6b3c, belly: 0xc9a06a, bw: 0.52, bh: 0.42, bl: 0.8, legW: 0.13, legLen: 0.2, hs: 0.42, headY: 0.14, face: 'capy', faceOpts: { snout: '#6b4a2e' }, ears: 'round' }); P = h.userData.P;
      add(P.head, RBOX(0.36, 0.08, 0.06, 0.02), M(0x111111, { roughness: 0.15, metalness: 0.5 }), 0, 0.07, 0.21);   // sunglasses
      add(P.head, SPH(0.07, 12, 10), PLASTIC(0xffa040), 0, 0.26, -0.02); add(P.head, BOX(0.02, 0.05, 0.02), M(0x3a6a2a), 0, 0.32, -0.02);   // tangerine
      break;
    case 'shiba': h = quadBlock({ col: 0xe3a85a, belly: 0xfaf1e4, bw: 0.38, bh: 0.36, bl: 0.62, legW: 0.11, legLen: 0.24, hs: 0.4, headY: 0.16, face: 'dog', ears: 'tri', tail: 'curl', snout: 0xfaf1e4 }); P = h.userData.P;
      add(P.head, new THREE.TorusGeometry(0.12, 0.025, 8, 18), M(0xff4fa3), 0, -0.22, 0.02).rotation.x = Math.PI / 2;   // collar
      add(P.head, RBOX(0.36, 0.17, 0.36, 0.06), CLOTH(0xf0a8c8), 0, 0.24, 0); add(P.head, SPH(0.06, 10, 8), CLOTH(0xffffff), 0, 0.36, 0);   // the knitted hat. If you know, you know.
      break;
    case 'hamster': h = quadBlock({ col: 0xd9a86c, belly: 0xfff1dc, bw: 0.4, bh: 0.32, bl: 0.4, legW: 0.1, legLen: 0.1, hs: 0.38, headY: 0.1, face: 'hamster', ears: 'round', tail: 'stub' }); P = h.userData.P;
      add(P.torso, RBOX(0.26, 0.02, 0.18, 0.01), M(0x1a1c3a), 0, 0.17, 0.02); add(P.torso, RBOX(0.26, 0.16, 0.02, 0.01), M(0x1a1c3a), 0, 0.25, -0.06); add(P.torso, new THREE.PlaneGeometry(0.22, 0.12), chestScreen(), 0, 0.25, -0.048);   // tiny laptop
      break;
    case 'goose': h = quadBlock({ col: 0xf4f4f4, bw: 0.34, bh: 0.32, bl: 0.5, legW: 0.07, legLen: 0.24, hs: 0.22, headY: 0.5, headZ: 0.2, face: 'bird', beak: 0xff8a2a, legCol: 0xff8a2a }); P = h.userData.P;
      add(P.torso, RBOX(0.12, 0.42, 0.12, 0.03), PLASTIC(0xf4f4f4), 0, 0.3, 0.2);   // neck
      add(P.torso, RBOX(0.18, 0.08, 0.26, 0.02), PLASTIC(0xf4f4f4), 0, 0.12, -0.3).rotation.x = -0.4;   // tail
      break;
    case 'pigeon': h = quadBlock({ col: 0x9aa3b2, bw: 0.3, bh: 0.28, bl: 0.42, legW: 0.05, legLen: 0.14, hs: 0.22, headY: 0.26, headZ: 0.2, face: 'bird', beak: 0x5a5a62, legCol: 0xff8fb8 }); P = h.userData.P;
      add(P.torso, RBOX(0.3, 0.1, 0.1, 0.02), PLASTIC(0x2fb8a8), 0, 0.08, 0.2);   // iridescent neck patch
      add(P.torso, RBOX(0.16, 0.06, 0.22, 0.02), PLASTIC(0x9aa3b2), 0, 0.08, -0.28).rotation.x = -0.3;
      add(P.head, RBOX(0.12, 0.06, 0.26, 0.02), PLASTIC(0xc9a85c), 0.06, -0.1, 0.22).rotation.y = 0.5;   // the baguette
      break;
    case 'raccoon': h = quadBlock({ col: 0x8d8f9a, belly: 0xd9dbe2, bw: 0.38, bh: 0.34, bl: 0.6, legW: 0.1, legLen: 0.2, hs: 0.38, headY: 0.14, face: 'raccoon', ears: 'tri', tail: 'ring', legCol: 0x2a2432 }); P = h.userData.P;
      add(P.armR, RBOX(0.14, 0.12, 0.08, 0.03), CLOTH(0xc9a86a), 0.06, -0.14, 0.06);   // a little bag
      break;
    case 'frog': { h = makeBlocky({ skin: 0x5fcf7a, shirt: 0x5fcf7a, pants: 0x5fcf7a, shoes: null, face: 'blank', dims: { hs: 1.6 * S, th: 1.3 * S, lh: 1.1 * S, ah: 1.3 * S, tw: 1.9 * S, aw: 0.7 * S, lw: 0.9 * S }, scale: 0.82 }); P = h.userData.P;
      P.headMesh.material[4] = animalMat('frog', 0x5fcf7a); for (const s of [-1, 1]) { add(P.head, RBOX(0.17, 0.17, 0.17, 0.05), PLASTIC(0x5fcf7a), s * 0.16, 0.3, 0.08); add(P.head, RBOX(0.12, 0.12, 0.04, 0.02), PLASTIC(0xffffff), s * 0.16, 0.3, 0.17); add(P.head, RBOX(0.06, 0.07, 0.03, 0.01), M(0x17141f), s * 0.17, 0.3, 0.19); }
      add(P.torso, RBOX(0.4, 0.3, 0.04, 0.03), PLASTIC(0xd9f0a8), 0, 0.22, 0.17);   // pale belly
      h.userData.kind = 'plush'; break; }
    case 'penguin': { h = makeBlocky({ skin: 0x2a2432, shirt: 0x2a2432, pants: 0x2a2432, shoes: 0xff8a2a, face: 'blank', dims: { hs: 1.3 * S, th: 1.5 * S, lh: 0.7 * S, ah: 1.3 * S, tw: 1.8 * S, aw: 0.55 * S, ad: 0.9 * S, lw: 0.8 * S }, scale: 0.85 }); P = h.userData.P;
      P.headMesh.material[4] = animalMat('bird', 0x2a2432); add(P.head, RBOX(0.2, 0.1, 0.22, 0.03), M(0xff8a2a, { roughness: 0.5 }), 0, -0.06, 0.26);
      add(P.torso, RBOX(0.42, 0.42, 0.04, 0.05), PLASTIC(0xf4f4f4), 0, 0.26, 0.17);   // white belly
      hatStyle(P, 'tophat', 0x1a1724, 0xa8122c); add(P.torso, RBOX(0.2, 0.08, 0.03, 0.02), M(0xa8122c), 0, 0.42, 0.19);   // bow tie
      h.userData.kind = 'plush'; break; }
    case 'cat': h = quadBlock({ col: 0x1e1a26, bw: 0.3, bh: 0.3, bl: 0.56, legW: 0.09, legLen: 0.22, hs: 0.34, headY: 0.14, face: 'cat', ears: 'tri', tail: 'long' }); P = h.userData.P;
      add(P.torso, new THREE.TorusGeometry(0.11, 0.02, 8, 18), M(0xffc633), 0, 0.1, 0.22).rotation.x = Math.PI / 2 + 0.2;
      break;
    case 'bull': h = quadBlock({ col: 0x52f5a8, belly: 0xb4ffd6, bw: 0.5, bh: 0.44, bl: 0.78, legW: 0.14, legLen: 0.26, hs: 0.44, headY: 0.18, face: 'bull', faceOpts: { snout: '#b4ffd6' }, ears: 'horns', tail: 'long' }); P = h.userData.P;
      add(P.head, new THREE.TorusGeometry(0.05, 0.012, 6, 14), METAL(0xffc633), 0, -0.2, 0.24).rotation.x = 0.3;   // nose ring
      break;
    case 'bear': h = quadBlock({ col: 0xff5d6c, belly: 0xffb3b8, bw: 0.5, bh: 0.46, bl: 0.76, legW: 0.15, legLen: 0.26, hs: 0.46, headY: 0.2, face: 'bear', faceOpts: { snout: '#ffb3b8' }, ears: 'round', tail: 'stub' }); P = h.userData.P;
      for (const s of [-1, 1]) add(P.head, BOX(0.14, 0.04, 0.02), M(0x17141f), s * 0.1, 0.17, 0.235).rotation.z = s * 0.4;   // angry brows
      break;
    case 'whale': h = quadBlock({ col: 0x4b7cff, belly: 0xbfd4ff, bw: 0.6, bh: 0.5, bl: 1.0, legW: 0.12, legLen: 0.14, hs: 0.5, headY: 0.1, headZ: 0.1, face: 'whale' }); P = h.userData.P;
      add(P.torso, RBOX(0.5, 0.08, 0.3, 0.03), PLASTIC(0x4b7cff), 0, 0.12, -0.62).rotation.x = -0.3;   // tail fluke
      add(P.torso, RBOX(0.1, 0.1, 0.1, 0.03), PLASTIC(0x4b7cff), 0, 0.22, -0.5);
      for (const s of [-1, 1]) add(P.torso, RBOX(0.2, 0.05, 0.24, 0.02), PLASTIC(0x4b7cff), s * 0.36, -0.05, 0.1).rotation.z = s * 0.4;   // fins
      add(P.head, CYL(0.03, 0.03, 0.2, 8), GLOW(0x43e8ff, 1.2), 0, 0.3, 0);   // spout
      break;
    case 'tako': { const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig); P = { rig }; const col = 0xff6f86, m = PLASTIC(col), legLen = 0.18;
      const legs = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const pv = new THREE.Group(); pv.position.set(Math.sin(a) * 0.2, legLen, Math.cos(a) * 0.2); rig.add(pv); add(pv, RBOX(0.1, legLen, 0.1, 0.03), m, 0, -legLen / 2, 0); legs.push(pv); }
      P.legL = legs[1]; P.legR = legs[7]; P.armL = legs[2]; P.armR = legs[6]; P.armL.userData.hand = P.armL; P.armR.userData.hand = P.armR;
      const torso = new THREE.Group(); torso.position.y = legLen; rig.add(torso); P.torso = torso; P.head = torso; P.hs = 0.5; P.r = 0.25;
      P.headMesh = add(torso, RBOX(0.5, 0.5, 0.5, 0.1), [m, m, m, m, animalMat('tako', col), m], 0, 0.25, 0);
      add(torso, RBOX(0.56, 0.1, 0.56, 0.03), CLOTH(0x2a2246), 0, 0.42, 0); add(torso, RBOX(0.12, 0.24, 0.03, 0.02), CLOTH(0x2a2246), 0.2, 0.38, -0.28).rotation.z = 0.4;   // bandana
      root.userData = { P, kind: 'plush', legLen, torsoH: 0.5, r: 0.25, height: legLen + 0.6 }; h = root; break; }
    case 'rug': { const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig); P = { rig }; const legLen = 0.22, m = CLOTH(0xa8122c);
      const torso = new THREE.Group(); torso.position.y = legLen; rig.add(torso); P.torso = torso; P.head = torso; P.r = 0.3; P.hs = 0.6;
      add(torso, RBOX(0.9, 0.08, 0.6, 0.02), m, 0, 0.04, 0); add(torso, RBOX(0.74, 0.085, 0.44, 0.01), CLOTH(0xffc94a), 0, 0.045, 0); add(torso, RBOX(0.58, 0.09, 0.28, 0.01), m, 0, 0.05, 0);
      for (const s of [-1, 1]) for (let i = 0; i < 7; i++) add(torso, BOX(0.02, 0.02, 0.06), CLOTH(0xffe9a8), s * 0.47, 0.03, -0.3 + i * 0.1);
      const fp = add(torso, new THREE.PlaneGeometry(0.5, 0.26), animalMat('smile', 0xa8122c), 0, 0.1, 0); fp.rotation.x = -Math.PI / 2; fp.castShadow = false;
      const legs = [[-0.3, 0.2], [0.3, 0.2], [-0.3, -0.2], [0.3, -0.2]].map(([x, z]) => { const pv = new THREE.Group(); pv.position.set(x, legLen, z); rig.add(pv); add(pv, RBOX(0.09, 0.16, 0.09, 0.02), PLASTIC(0xf0c8a6), 0, -0.1, 0); add(pv, RBOX(0.11, 0.06, 0.15, 0.02), PLASTIC(0xffffff), 0, -0.2, 0.03); return pv; });
      P.legL = legs[0]; P.legR = legs[1]; P.armL = legs[3]; P.armR = legs[2]; P.armL.userData.hand = P.armL; P.armR.userData.hand = P.armR;
      root.userData = { P, kind: 'plush', legLen, torsoH: 0.2, r: 0.3, height: legLen + 0.4 }; h = root; break; }
    case 'banana': { h = makeBlocky({ skin: 0xffd63a, shirt: 0xffd63a, pants: 0x1a1c3a, shoes: 0xffffff, face: 'laugh', dims: { hs: 1.1 * S, th: 2.2 * S, lh: 1.5 * S, ah: 1.7 * S, tw: 1.4 * S, aw: 0.6 * S, lw: 0.7 * S, td: 0.9 * S }, scale: 0.9 }); P = h.userData.P;
      add(P.head, RBOX(0.3, 0.4, 0.3, 0.08), PLASTIC(0xffd63a), 0, 0.32, 0); add(P.head, RBOX(0.1, 0.16, 0.1, 0.03), PLASTIC(0x5a3a1a), 0, 0.58, 0);   // banana tip
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const p = add(P.torso, RBOX(0.16, 0.5, 0.05, 0.03), PLASTIC(0xf7e07a), Math.sin(a) * 0.26, 0.3, Math.cos(a) * 0.2); p.rotation.set(Math.cos(a) * 0.5, a, -Math.sin(a) * 0.5); }   // peel flaps
      h.userData.kind = 'plush'; break; }
    default: return makeCritter('shiba');
  }
  return h;
}
let SKULL_MAT = null;
function skullMat() {
  if (SKULL_MAT) return SKULL_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(64, 50, 34, 32, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(44, 70, 40, 22);
  ctx.fillStyle = '#17141f'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(64 + s * 14, 50, 10, 12, 0, 0, Math.PI * 2); ctx.fill(); } ctx.beginPath(); ctx.moveTo(64, 62); ctx.lineTo(58, 72); ctx.lineTo(70, 72); ctx.fill();
  for (let i = 0; i < 4; i++) ctx.fillRect(48 + i * 10, 78, 3, 12);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(22, 100); ctx.lineTo(106, 118); ctx.moveTo(106, 100); ctx.lineTo(22, 118); ctx.stroke();
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; SKULL_MAT = new THREE.MeshBasicMaterial({ map: tx, transparent: true }); return SKULL_MAT;
}
function chestScreen() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const ctx = c.getContext('2d');
  ctx.fillStyle = '#06060f'; ctx.fillRect(0, 0, 128, 64); ctx.strokeStyle = '#52f5a8'; ctx.lineWidth = 3; ctx.beginPath();
  let y = 44; for (let x = 6; x < 122; x += 8) { y += (Math.random() - 0.45) * 12; y = Math.max(10, Math.min(56, y)); ctx.lineTo(x, y); } ctx.stroke();
  ctx.fillStyle = '#ffe066'; ctx.font = '700 12px monospace'; ctx.fillText('+42%', 8, 16);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: tx });
}
function makeCorgi() { const g = makeCritter('shiba'); g.scale.setScalar(0.7); g.userData.legs = []; g.userData.head = g.userData.P.head; g.userData.phase = 0; return g; }

/* ================= the cast ================= */
function buildChar(id, tint, look, ov) {
  const c = CHAR[id] || CHAR.degen;
  if (c.id === 'custom') return buildCustom(look);
  if (c.kind === 'critter') { const h = makeCritter(c.critter); h.userData.emote = c.emote; if (c.scale) h.scale.setScalar(c.scale); return h; }
  const L = { ...DEFAULT_LOOK, ...c.look };
  if (ov) { if (ov.top) L.topCol = cssOf(ov.top); if (ov.pants) L.pants = cssOf(ov.pants); if (ov.shoes) L.shoes = cssOf(ov.shoes); }
  if (tint && tint.color) { L.topCol = cssOf(tint.color); if (tint.accent) L.accent = cssOf(tint.accent); }
  const h = assembleLook(L), P = h.userData.P;
  switch (c.id) {
    case 'sheriff': add(P.torso, CYL(0.07, 0.07, 0.015, 5), METAL(0xffc633), -0.16, P.B.th * 0.68, P.B.td / 2 + 0.02).rotation.x = Math.PI / 2; break;   // star badge
    case 'wizard': { const st = new THREE.Group(); P.armL.userData.hand.add(st); st.position.set(0, 0.1, 0.08); add(st, CYL(0.025, 0.03, 1.3, 8), CLOTH(0x5a3a22), 0, 0.3, 0); add(st, SPH(0.08, 12, 10), GLOW(0xa66bff, 1.6), 0, 0.98, 0); break; }
    case 'midas': for (const s of [-1, 1]) add(s < 0 ? P.armL : P.armR, new THREE.TorusGeometry(0.17, 0.025, 8, 18), METAL(0xffc633), 0, -0.33, 0).rotation.x = Math.PI / 2; break;   // bangles
    case 'kitty': add(P.torso, RBOX(0.09, 0.09, 0.5, 0.04), FUR(hexOf(L.hairCol)), 0.2, 0.16, -P.B.td / 2 - 0.2).rotation.x = -0.8; break;   // tail
    case 'zombo': add(P.torso, RBOX(0.2, 0.12, 0.03, 0.02), CLOTH(0x3a4a3a), 0.12, P.B.th * 0.3, P.B.td / 2 + 0.012); add(P.legR, RBOX(0.14, 0.08, 0.03, 0.02), CLOTH(0x4a3a2a), 0.03, -0.3, P.B.ld / 2 + 0.01); break;   // patches
    case 'degen': textPlate(P.torso, '$', '#ffffff', null, 0.16, 0.16, 0.14, P.B.th * 0.62, P.B.td / 2 + 0.012, 120); break;
    case 'dev': { const lp = new THREE.Group(); P.armR.userData.hand.add(lp); lp.position.set(0, -0.02, 0.16); lp.rotation.x = -0.5; add(lp, RBOX(0.34, 0.025, 0.24, 0.01), M(0x2a2a2e, { roughness: 0.4 }), 0, 0, 0); const sc = add(lp, RBOX(0.34, 0.22, 0.02, 0.01), M(0x2a2a2e), 0, 0.11, -0.12); add(sc, new THREE.PlaneGeometry(0.3, 0.18), GLOW(0x8fd3a6, 0.9), 0, 0, 0.012); break; }   // laptop
    case 'influencer': { const ph = new THREE.Group(); P.armR.userData.hand.add(ph); ph.position.set(0, 0.08, 0.06); add(ph, RBOX(0.09, 0.17, 0.016, 0.012), M(0x1a1a1c, { roughness: 0.3 }), 0, 0, 0); add(ph, new THREE.PlaneGeometry(0.075, 0.15), GLOW(0xffd6ea, 0.8), 0, 0, -0.01).rotation.y = Math.PI; break; }   // phone
    case 'angel': hatStyle(P, 'halo', 0xffe066, 0xffe066); break;
    case 'alien': for (const s of [-1, 1]) { const an = add(P.head, CYL(0.012, 0.012, P.hs * 0.55, 6), M(0x9ff2c8), s * P.hs * 0.22, P.hs * 0.78, 0); an.rotation.z = -s * 0.25; add(P.head, SPH(P.hs * 0.07, 10, 8), GLOW(0x9ff2c8, 1.4), s * P.hs * 0.3, P.hs * 1.04, 0); } break;   // antennae
    case 'sniper': { const sc = new THREE.Group(); P.armR.userData.hand.add(sc); sc.position.set(0, 0.05, 0.1); add(sc, CYL(0.03, 0.03, 0.9, 8), M(0x1a1a1c, { roughness: 0.4 }), 0, 0, 0.3).rotation.x = Math.PI / 2; add(sc, CYL(0.05, 0.05, 0.2, 10), M(0x2a2a2e), 0, 0.07, 0.1).rotation.x = Math.PI / 2; add(sc, SPH(0.03, 8, 6), GLOW(0xff2a2a, 2), 0, 0.07, 0.21); break; }   // a scope
    case 'whaleboy': { add(P.torso, RBOX(0.34, 0.2, 0.06, 0.03), M(0x43e8ff, { emissive: 0x43e8ff, emissiveIntensity: 0.4 }), 0, P.B.th * 0.55, P.B.td / 2 + 0.03); textPlate(P.torso, '50 SOL', '#0a0a0b', null, 0.3, 0.12, 0, P.B.th * 0.55, P.B.td / 2 + 0.065, 70); break; }
    case 'cultist': { const m = M(0xc8a96a); for (let i = 0; i < 5; i++) add(P.torso, BOX(0.05, 0.1 + i * 0.07, 0.02), m, -0.16 + i * 0.08, P.B.th * 0.42, P.B.td / 2 + 0.012); break; }   // a chart on the robe
    case 'grandma': { const pl = new THREE.Group(); P.armL.userData.hand.add(pl); pl.position.set(0, -0.02, 0.1); add(pl, CYL(0.16, 0.16, 0.02, 20), M(0xf2efe8), 0, 0, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(pl, CYL(0.04, 0.04, 0.02, 10), M(0xb8773e), Math.sin(a) * 0.09, 0.02, Math.cos(a) * 0.09); } break; }   // a plate of cookies
    case 'chef': { add(P.head, CYL(P.hs * 0.5, P.hs * 0.44, P.hs * 0.5, 16), M(0xf2efe8, { roughness: 0.9 }), 0, P.hs * 0.75, 0); add(P.head, SPH(P.hs * 0.55, 14, 10), M(0xf2efe8, { roughness: 0.9 }), 0, P.hs * 1.0, 0).scale.y = 0.55; break; }   // toque
    case 'mod': { add(P.armR.userData.hand, BOX(0.14, 0.05, 0.4), M(0xd9707a), 0, 0, 0.14); textPlate(P.torso, 'MOD', '#0a0a0b', '#ffffff', 0.22, 0.1, 0, P.B.th * 0.7, P.B.td / 2 + 0.012, 80); break; }   // the ban hammer
    case 'botfarm': { for (const s of [-1, 1]) { const mini = add(P.torso, RBOX(0.12, 0.14, 0.12, 0.02), METAL(0x9aa3b2), s * 0.34, P.B.th * 0.9, -0.05); add(mini, BOX(0.09, 0.03, 0.01), GLOW(0xff6a2a, 1.5), 0, 0.01, 0.065); } break; }   // two tiny bots on the shoulders
    case 'tourist': { const cam = new THREE.Group(); P.torso.add(cam); cam.position.set(0, P.B.th * 0.5, P.B.td / 2 + 0.08); add(cam, RBOX(0.2, 0.13, 0.08, 0.02), M(0x1a1a1c), 0, 0, 0); add(cam, CYL(0.04, 0.045, 0.05, 12), M(0x2a2a2e), 0, 0, 0.06).rotation.x = Math.PI / 2; add(P.torso, BOX(0.02, 0.02, P.B.td + 0.1), M(0x1a1a1c), -0.1, P.B.th * 0.7, 0); break; }   // camera on a strap
    case 'reaper': { const sc = new THREE.Group(); P.armR.userData.hand.add(sc); sc.position.set(0, 0.2, 0); add(sc, CYL(0.025, 0.025, 1.8, 8), M(0x3a2a1a), 0, 0.3, 0); const bl = add(sc, BOX(0.7, 0.12, 0.02), METAL(0xbdb8ad, { roughness: 0.25 }), 0.3, 1.2, 0); bl.rotation.z = -0.3; break; }   // the scythe
    case 'queen': { const sc = new THREE.Group(); P.armL.userData.hand.add(sc); sc.position.set(0, 0.1, 0.06); add(sc, CYL(0.02, 0.025, 1.0, 8), METAL(0xe5bf72), 0, 0.25, 0); add(sc, new THREE.OctahedronGeometry(0.09), M(0xd9707a, { roughness: 0.2, metalness: 0.4 }), 0, 0.82, 0); break; }   // a sceptre
    case 'og': { const cane = new THREE.Group(); P.armL.userData.hand.add(cane); cane.position.set(0, 0, 0.06); add(cane, CYL(0.022, 0.022, 0.9, 8), M(0x1a1724, { roughness: 0.3 }), 0, -0.4, 0); add(cane, SPH(0.045, 10, 8), METAL(0xc8a96a), 0, 0.06, 0); break; }
  }
  h.userData.emote = c.emote;
  return h;
}

/* ================= shop flair: paid cosmetics drawn on top of any character ================= */
const FLAIR_ANIM = [];
const ICE = () => new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, metalness: 0.5, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x1a2a3a, emissiveIntensity: 0.6 });
function applyFlair(obj, list) {
  if (!obj) return; const P = obj.userData.P;
  for (const g of obj.userData.flairG || []) if (g.parent) g.parent.remove(g);
  obj.userData.flairG = [];
  if (!P || !P.head || !Array.isArray(list) || !list.length) return;
  const h = P.hs, B = P.B, keep = (parent, g) => { parent.add(g); obj.userData.flairG.push(g); return g; };
  const gold = METAL(0xe5bf72, { roughness: 0.22 });
  for (const id of list) {
    if (id === 'laser') { const g = keep(P.head, new THREE.Group()); for (const s of [-1, 1]) { const b = add(g, CYL(0.016, 0.016, 5, 8), GLOW(0xff2a2a, 3.2), s * h * 0.2, h * 0.04, h * 0.5 + 2.5); b.rotation.x = Math.PI / 2; b.castShadow = false; add(g, SPH(0.055, 10, 8), GLOW(0xff7070, 3), s * h * 0.2, h * 0.04, h * 0.53); } }
    else if (id === 'chain') { const g = keep(P.torso, new THREE.Group()); const m = ICE(); const tq = add(g, new THREE.TorusGeometry(B.tw * 0.4, 0.035, 10, 36), m, 0, B.th - 0.12, B.td * 0.22); tq.rotation.x = Math.PI / 2 + 0.55; add(g, new THREE.OctahedronGeometry(0.11), m, 0, B.th * 0.5, B.td / 2 + 0.07); }
    else if (id === 'crown') { const g = keep(P.head, new THREE.Group()); g.position.y = h * 0.82; add(g, CYL(h * 0.5, h * 0.46, h * 0.2, 12), gold, 0, 0, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(g, new THREE.ConeGeometry(h * 0.1, h * 0.28, 6), gold, Math.sin(a) * h * 0.46, h * 0.22, Math.cos(a) * h * 0.46); add(g, SPH(h * 0.06, 10, 8), GLOW(i % 2 ? 0x8fd3a6 : 0xd9707a, 1.2), Math.sin(a) * h * 0.49, 0, Math.cos(a) * h * 0.49); } }
    else if (id === 'wings') { const g = keep(P.torso, new THREE.Group()); for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) { const w = add(g, RBOX(0.62 - k * 0.14, 0.18, 0.03, 0.05), gold, s * (0.36 + k * 0.08), B.th * (0.82 - k * 0.14), -B.td / 2 - 0.06); w.rotation.set(0, s * 0.45, s * (0.5 - k * 0.12)); } } }
    else if (id === 'aura') { const g = keep(obj, new THREE.Group()); const r = add(g, new THREE.TorusGeometry(0.82, 0.03, 8, 48), GLOW(0xe5bf72, 2), 0, 0.05, 0); r.rotation.x = Math.PI / 2; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(g, BOX(0.08, 0.2, 0.08), GLOW(0x8fd3a6, 1.8), Math.sin(a) * 0.98, 0.45 + (i % 2) * 0.12, Math.cos(a) * 0.98); } FLAIR_ANIM.push({ g, kind: 'spin' }); }
    else if (id === 'jetpack') { const g = keep(P.torso, new THREE.Group()); const mt = METAL(0x9aa3b2, { roughness: 0.35 }); for (const s of [-1, 1]) { add(g, CYL(0.11, 0.13, 0.6, 12), mt, s * 0.17, B.th * 0.55, -B.td / 2 - 0.16); add(g, CYL(0.06, 0.1, 0.08, 10), M(0x2a2a2e), s * 0.17, B.th * 0.55 - 0.34, -B.td / 2 - 0.16); const f = add(g, new THREE.ConeGeometry(0.07, 0.3, 10), GLOW(0xff6a2a, 2.2), s * 0.17, B.th * 0.55 - 0.55, -B.td / 2 - 0.16); f.rotation.x = Math.PI; f.userData.flame = 1; } add(g, BOX(0.5, 0.08, 0.06), mt, 0, B.th * 0.7, -B.td / 2 - 0.08); FLAIR_ANIM.push({ g, kind: 'flame' }); }
    else if (id === 'horns') { const g = keep(P.head, new THREE.Group()); for (const s of [-1, 1]) { const hn = add(g, new THREE.ConeGeometry(h * 0.1, h * 0.42, 10), M(0xd9707a, { roughness: 0.45 }), s * h * 0.34, h * 0.72, 0); hn.rotation.z = -s * 0.45; } }
    else if (id === 'halo') { const g = keep(P.head, new THREE.Group()); const r = add(g, new THREE.TorusGeometry(h * 0.46, 0.035, 8, 32), GLOW(0xffe066, 2.4), 0, h * 1.02, 0); r.rotation.x = Math.PI / 2; FLAIR_ANIM.push({ g, kind: 'hover', y0: 0 }); }
    else if (id === 'shades') { const g = keep(P.head, new THREE.Group()); const m = M(0x0a0a0b, { roughness: 0.15, metalness: 0.3 }); for (const s of [-1, 1]) add(g, RBOX(h * 0.36, h * 0.2, 0.04, 0.03), m, s * h * 0.22, h * 0.06, h * 0.52); add(g, BOX(h * 0.1, 0.025, 0.03), m, 0, h * 0.08, h * 0.52); add(g, BOX(h * 0.9, 0.02, 0.02), gold, 0, h * 0.14, h * 0.5); }
    else if (id === 'bag') { const g = keep(P.armL.userData.hand, new THREE.Group()); g.position.set(0, -0.12, 0.02); add(g, RBOX(0.26, 0.3, 0.2, 0.05), M(0x5a3a22, { roughness: 0.8 }), 0, -0.1, 0); add(g, new THREE.TorusGeometry(0.1, 0.02, 8, 20), M(0x5a3a22), 0, 0.08, 0); textPlate(g, '$', '#c8a96a', null, 0.14, 0.14, 0, -0.1, 0.11, 140); }
    else if (id === 'flag') { const g = keep(P.torso, new THREE.Group()); add(g, CYL(0.02, 0.02, 1.5, 8), M(0x1d1d1f), -0.3, B.th * 0.7, -B.td / 2 - 0.08); const fl = add(g, BOX(0.56, 0.34, 0.015), GLOW(0x8fd3a6, 0.9), -0.02, B.th * 0.7 + 0.5, -B.td / 2 - 0.08); for (let i = 0; i < 3; i++) add(fl, BOX(0.06, 0.12 + i * 0.05, 0.02), M(0x0a0a0b), -0.16 + i * 0.14, -0.02, 0.012); FLAIR_ANIM.push({ g: fl, kind: 'wave' }); }
    else if (id === 'pet') { const g = keep(obj, new THREE.Group()); g.position.set(0.8, 1.9, -0.2); const m = M(0xece9e2, { roughness: 0.4 }); add(g, BOX(0.3, 0.3, 0.3), m, 0, 0, 0); add(g, BOX(0.08, 0.16, 0.06), m, 0.19, 0, 0); add(g, BOX(0.24, 0.03, 0.24), M(0x2a1c14), 0, 0.15, 0); for (const [x, y] of [[-0.07, 0.3], [0.03, 0.36], [0.12, 0.42]]) add(g, BOX(0.05, 0.1, 0.05), GLOW(0x8fd3a6, 1.6), x, y, 0); FLAIR_ANIM.push({ g, kind: 'bob', y0: 1.9 }); }
  }
}
function flairTick(time) {
  for (let i = FLAIR_ANIM.length - 1; i >= 0; i--) {
    const f = FLAIR_ANIM[i]; let root = f.g; while (root.parent) root = root.parent;
    if (root !== scene) { FLAIR_ANIM.splice(i, 1); continue; }
    if (f.kind === 'spin') f.g.rotation.y = time * 0.9;
    else if (f.kind === 'flame') f.g.traverse(o => { if (o.userData.flame) o.scale.setScalar(0.8 + Math.random() * 0.5); });
    else if (f.kind === 'hover') f.g.position.y = Math.sin(time * 2) * 0.03;
    else if (f.kind === 'wave') f.g.rotation.y = Math.sin(time * 4) * 0.18;
    else { f.g.position.y = f.y0 + Math.sin(time * 2.4) * 0.1; f.g.rotation.y = Math.sin(time * 0.8) * 0.6; }
  }
}
