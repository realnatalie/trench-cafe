
/* ================= animation ================= */
const EMOTE_DUR = 1.8;
function resetPose(P) {
  P.rig.position.set(0, 0, 0); P.rig.rotation.set(0, 0, 0); P.rig.scale.set(1, 1, 1);
  for (const k of ['legL', 'legR', 'armL', 'armR']) if (P[k]) P[k].rotation.set(0, 0, 0);
  if (P.head && P.head !== P.torso) { P.head.rotation.set(0, 0, 0); P.head.scale.set(1, 1, 1); }
  if (P.torso) P.torso.rotation.set(0, 0, 0);
  if (P.mouth) P.mouth.scale.y = P.mouthOpen ? 1.1 : 0.4;
  if (P.prop) P.prop.visible = false;
  if (P.phone) P.phone.visible = false;
}
function flipAbout(P, h, ang, axis = 'x') {
  P.rig.rotation[axis] = ang;
  if (axis === 'x') { P.rig.position.y += h / 2 - h / 2 * Math.cos(ang); P.rig.position.z += -h / 2 * Math.sin(ang); }
  else { P.rig.position.y += h / 2 - h / 2 * Math.cos(ang); P.rig.position.x += h / 2 * Math.sin(ang); }
}
const POSE_KEYS = ['legL', 'legR', 'armL', 'armR'];
function readPose(P, o) { for (const k of POSE_KEYS) { const r = P[k].rotation; o[k + 'x'] = r.x; o[k + 'z'] = r.z; } o.tx = P.torso.rotation.x; o.ty = P.torso.rotation.y; if (P.head !== P.torso) { o.hx = P.head.rotation.x; o.hy = P.head.rotation.y; o.hz = P.head.rotation.z; } o.ry = P.rig.position.y; return o; }
function blendPose(P, o, k, keepRig) {   // ease every joint toward this frame's target: no snapping between run, jump, sit and emotes
  for (const kk of POSE_KEYS) { const r = P[kk].rotation; r.x = o[kk + 'x'] + (r.x - o[kk + 'x']) * k; r.z = o[kk + 'z'] + (r.z - o[kk + 'z']) * k; }
  P.torso.rotation.x = o.tx + (P.torso.rotation.x - o.tx) * k; P.torso.rotation.y = o.ty + (P.torso.rotation.y - o.ty) * k;
  if (P.head !== P.torso && o.hx != null) { P.head.rotation.x = o.hx + (P.head.rotation.x - o.hx) * k; P.head.rotation.y = o.hy + (P.head.rotation.y - o.hy) * k; P.head.rotation.z = o.hz + (P.head.rotation.z - o.hz) * k; }
  if (!keepRig) P.rig.position.y = o.ry + (P.rig.position.y - o.ry) * k;
}
function animateRig(av, dt, time) {
  const ud = av.obj.userData, P = ud.P, plush = ud.kind === 'plush';
  const sp = av.state === 'run' ? 13 : av.state === 'walk' ? 9 : 3;
  av.phase += dt * sp;
  const ph = av.phase, prev = readPose(P, av._pose || (av._pose = {}));
  resetPose(P);
  if (av.emoteT > 0) { emoteAnim(av, 1 - av.emoteT / EMOTE_DUR, time); blendPose(P, prev, 1 - Math.exp(-dt * 26), true); return; }
  switch (av.state) {
    case 'walk': case 'run': {
      const run = av.state === 'run', a = run ? 1.05 : 0.68, s1 = Math.sin(ph);
      P.legL.rotation.x = s1 * a; P.legR.rotation.x = -s1 * a;
      P.armL.rotation.x = -s1 * a * 0.85; P.armR.rotation.x = s1 * a * 0.85;
      if (plush) { const b = Math.abs(s1); P.rig.position.y = b * 0.12; P.rig.scale.set(1 + (1 - b) * 0.05, 1 - (1 - b) * 0.06, 1); P.rig.rotation.z = s1 * 0.06; }
      else {
        P.armL.rotation.z = -0.06; P.armR.rotation.z = 0.06;
        P.rig.position.y = Math.abs(s1) * (run ? 0.07 : 0.04); P.torso.rotation.y = s1 * (run ? 0.1 : 0.06);
        if (run) P.torso.rotation.x = 0.13;
        if (P.head !== P.torso) { P.head.rotation.y = -s1 * 0.05; if (run) P.head.rotation.x = -0.1; }
      }
      break;
    }
    case 'jump': {
      const falling = (av.vy ?? 1) < -0.5;
      if (falling) { P.armL.rotation.z = -1.05; P.armR.rotation.z = 1.05; P.armL.rotation.x = P.armR.rotation.x = -0.35; P.legL.rotation.x = -0.25; P.legR.rotation.x = 0.1; }
      else { P.armL.rotation.x = P.armR.rotation.x = -2.75; P.armL.rotation.z = -0.16; P.armR.rotation.z = 0.16; P.legL.rotation.x = -0.6; P.legR.rotation.x = 0.18; if (P.head !== P.torso) P.head.rotation.x = -0.12; }
      if (plush) P.rig.scale.set(0.94, 1.08, 0.94);
      break;
    }
    case 'sit': case 'sleep': {
      const sleep = av.state === 'sleep';
      if (plush) { P.rig.position.y = 0.32; P.legL.rotation.x = P.legR.rotation.x = -0.5; }
      else { P.rig.position.y = 0.48 - ud.legLen; P.legL.rotation.x = P.legR.rotation.x = -1.5; }
      if (sleep) {
        if (plush) { P.rig.rotation.x = 0.35; P.rig.scale.y = 1 + Math.sin(time * 1.6 + av.seed) * 0.03; }
        else { P.head.rotation.x = 0.55; P.armL.rotation.x = P.armR.rotation.x = -1.3; P.torso.rotation.x = 0.25; }
      } else {
        const tp = time * 16 + av.seed;
        P.armL.rotation.x = -1.2 + Math.sin(tp) * 0.06; P.armR.rotation.x = -1.2 + Math.sin(tp + 1.7) * 0.06;
        P.armL.rotation.z = 0.12; P.armR.rotation.z = -0.12;
        if (!plush) P.head.rotation.y = Math.sin(time * 0.6 + av.seed) * 0.15;
        else P.rig.rotation.z = Math.sin(time * 1.3 + av.seed) * 0.04;
      }
      break;
    }
    case 'dance': {
      const tt = time * 3.2 + av.seed;
      P.rig.rotation.y = Math.sin(tt * 0.5) * 0.6; P.rig.position.y = Math.abs(Math.sin(tt)) * 0.12;
      P.armL.rotation.z = -2.2 + Math.sin(tt) * 0.5; P.armR.rotation.z = 2.2 - Math.sin(tt + 1) * 0.5;
      P.legL.rotation.x = Math.max(0, Math.sin(tt)) * 0.5; P.legR.rotation.x = Math.max(0, -Math.sin(tt)) * 0.5;
      break;
    }
    case 'work': {
      const tt = time * 6 + av.seed;
      P.armR.rotation.x = -1.4 + Math.sin(tt) * 0.25; P.armL.rotation.x = -0.6; P.rig.position.y = Math.abs(Math.sin(tt * 0.5)) * 0.02;
      if (!plush) P.head.rotation.x = 0.15;
      break;
    }
    case 'podium': {
      P.rig.position.y = Math.sin(time * 2 + av.seed) * 0.01;
      P.armL.rotation.z = -0.07 - Math.sin(time * 2) * 0.03; P.armR.rotation.z = 0.07 + Math.sin(time * 2) * 0.03;
      if (!plush) P.head.rotation.y = Math.sin(time * 0.8) * 0.2;
      break;
    }
    default: {
      const br = Math.sin(time * 2 + av.seed);
      P.rig.position.y = br * 0.008;
      P.armL.rotation.z = -0.06 - br * 0.025; P.armR.rotation.z = 0.06 + br * 0.025;
      if (plush) P.rig.scale.y = 1 + Math.sin(time * 2.2 + av.seed) * 0.02;
      else if (P.head !== P.torso) P.head.rotation.y = Math.sin(time * 0.45 + av.seed) * 0.14;
    }
  }
  if (av.landT > 0) { av.landT -= dt; const q = Math.sin(Math.max(0, av.landT) / 0.2 * Math.PI); P.rig.scale.y *= 1 - q * 0.07; P.rig.scale.x *= 1 + q * 0.04; P.rig.scale.z *= 1 + q * 0.04; P.legL.rotation.x -= q * 0.25; P.legR.rotation.x -= q * 0.25; }
  blendPose(P, prev, 1 - Math.exp(-dt * 15), av.state === 'jump' || av.state === 'sit' || av.state === 'sleep' || av.state === 'dance');
}
function emoteAnim(av, u, time) {
  const ud = av.obj.userData, P = ud.P, h = ud.height, s = Math.sin(u * Math.PI);
  switch (ud.emote || CHAR[av.charId].emote) {
    case 'bounce': { const k = Math.abs(Math.sin(u * Math.PI * 3)); P.rig.position.y = k * 0.6; P.rig.scale.set(1 + (1 - k) * 0.15, 1 - (1 - k) * 0.18 + k * 0.08, 1 + (1 - k) * 0.15); P.armL.rotation.z = -1.5 * k; P.armR.rotation.z = 1.5 * k; break; }
    case 'zap': P.rig.position.x = Math.sin(u * 90) * 0.04 * s; P.rig.rotation.y = u * Math.PI * 4; P.rig.position.y = s * 0.3; P.armL.rotation.z = -2.6; P.armR.rotation.z = 2.6; break;
    case 'spin': P.rig.rotation.y = u * Math.PI * 4; P.rig.position.y = s * 0.9; P.armL.rotation.z = -1.4; P.armR.rotation.z = 1.4; break;
    case 'wiggle': P.rig.rotation.z = Math.sin(u * Math.PI * 8) * 0.4; P.rig.position.y = s * 0.15; P.armL.rotation.z = -1 - Math.sin(u * 20); P.armR.rotation.z = 1 + Math.sin(u * 20); break;
    case 'flip': flipAbout(P, h, -u * Math.PI * 2); P.rig.position.y += s * 0.9; break;
    case 'dive': {
      const a = clamp(u * 1.3, 0, 1);
      flipAbout(P, h, a * Math.PI * 2); P.rig.position.y += s * 0.7;
      P.armL.rotation.x = P.armR.rotation.x = -2.8 * (1 - a) - 0.4; P.legL.rotation.x = P.legR.rotation.x = -0.6 * s;
      break;
    }
    case 'selfie': {
      P.armR.rotation.x = -2.4; P.armR.rotation.z = 0.5; P.head.rotation.z = 0.2; P.head.rotation.y = 0.3; P.armL.rotation.z = -0.9;
      if (!P.phone) { P.phone = add(P.armR.userData.hand, RBOX(0.09, 0.16, 0.02, 0.01), M(0x111111)); P.phone.position.set(0, -0.06, 0.05); }
      P.phone.visible = true; if (u > 0.45 && u < 0.55) av.flash = true;
      break;
    }
    case 'keys': P.armR.rotation.x = -2.9; P.armR.rotation.y = u * 24; if (P.prop) P.prop.visible = true; P.rig.rotation.y = Math.sin(u * Math.PI * 4) * 0.3; P.rig.position.y = Math.abs(Math.sin(u * Math.PI * 6)) * 0.08; break;
    case 'box': {
      const pl = Math.max(0, Math.sin(u * Math.PI * 8)), pr = Math.max(0, -Math.sin(u * Math.PI * 8));
      P.armL.rotation.x = -0.9 - pl * 0.8; P.armR.rotation.x = -0.9 - pr * 0.8; P.armL.rotation.z = 0.35; P.armR.rotation.z = -0.35;
      P.legL.rotation.z = -0.22; P.legR.rotation.z = 0.22; P.rig.position.y = Math.abs(Math.sin(u * Math.PI * 8)) * 0.06; P.torso.rotation.y = (pl - pr) * 0.3;
      break;
    }
    case 'footwork': P.rig.rotation.y = u * Math.PI * 2; P.legL.rotation.x = Math.sin(u * 40) * 0.9; P.legR.rotation.x = -Math.sin(u * 40) * 0.9; P.armL.rotation.z = -1.3; P.armR.rotation.z = 1.3 + Math.sin(u * 30) * 0.3; P.rig.position.y = Math.abs(Math.sin(u * 40)) * 0.08; break;
    case 'float': P.rig.position.y = s * 1.0; P.legL.rotation.x = P.legR.rotation.x = -1.3 * s; P.armL.rotation.z = -1.3 * s; P.armR.rotation.z = 1.3 * s; P.rig.rotation.y = u * Math.PI; break;
    case 'scream': { const k = s; P.head.scale.set(1 + k * 0.12, 1 + k * 0.4, 1 + k * 0.12); if (P.mouth) P.mouth.scale.y = 1.1 + k * 1.4; P.rig.position.x = Math.sin(u * 120) * 0.03 * k; P.armL.rotation.z = -0.9 * k; P.armR.rotation.z = 0.9 * k; P.armL.rotation.x = P.armR.rotation.x = -0.8 * k; break; }
    case 'rain': { P.armR.rotation.x = -2.5 - Math.sin(u * 30) * 0.4; P.armL.rotation.x = -2.2 - Math.cos(u * 30) * 0.4; if (Math.random() < 0.5) av.rain = true; break; }
    case 'dab': { const k = Math.min(1, u * 4) * (u > 0.8 ? (1 - u) * 5 : 1); P.armR.rotation.x = -1.6 * k; P.armR.rotation.z = -1.1 * k; P.armL.rotation.z = 1.0 * k; P.armL.rotation.x = -0.3 * k; if (P.head !== P.torso) { P.head.rotation.z = 0.45 * k; P.head.rotation.y = -0.4 * k; } P.torso.rotation.y = -0.35 * k; P.rig.rotation.z = 0.12 * k; P.rig.position.y = k * 0.1; break; }
    case 'wave': { P.armR.rotation.x = -2.9; P.armR.rotation.z = Math.sin(u * 28) * 0.45; P.armL.rotation.z = -0.15; if (P.head !== P.torso) P.head.rotation.z = -0.15; P.rig.position.y = Math.abs(Math.sin(u * 14)) * 0.03; break; }
    case 'moonwalk': { const k = u * 24; P.legL.rotation.x = Math.sin(k) * 0.55 - 0.1; P.legR.rotation.x = -Math.sin(k) * 0.55 - 0.1; P.rig.position.x = Math.sin(k * 0.5) * 0.08; P.armL.rotation.x = 0.35; P.armR.rotation.x = 0.35; P.armL.rotation.z = -0.2; P.armR.rotation.z = 0.2; if (P.head !== P.torso) P.head.rotation.x = 0.35; P.rig.rotation.y = Math.PI * Math.min(1, u * 2.5); P.torso.rotation.x = 0.1; break; }
    case 'robot': { const q = Math.floor(u * 10) / 10; const st = n => Math.sin(q * Math.PI * n) > 0 ? 1 : -1; P.armL.rotation.x = -0.8 - 0.6 * st(3); P.armR.rotation.x = -0.8 + 0.6 * st(3); P.armL.rotation.z = -0.3; P.armR.rotation.z = 0.3; P.torso.rotation.y = 0.3 * st(5); if (P.head !== P.torso) P.head.rotation.y = -0.4 * st(7); P.rig.position.y = q % 0.2 < 0.1 ? 0.04 : 0; break; }
    case 'hearts': { P.armL.rotation.z = -2.4; P.armR.rotation.z = 2.4; P.armL.rotation.x = -0.6; P.armR.rotation.x = -0.6; P.rig.position.y = s * 0.12; P.rig.rotation.y = Math.sin(u * Math.PI * 2) * 0.25; if (Math.random() < 0.35) av.hearts = true; break; }
  }
}

/* ================= renderer + scene ================= */
const canvas = $('#gl');
const HQ = !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && Math.min(innerWidth, innerHeight) > 520;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !HQ, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HQ ? 1.5 : 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = HQ; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09090a);
scene.fog = new THREE.Fog(0x09090a, 30, 66);
/* night sky over the town: a dark gradient dome with a warm horizon glow and a field of stars */
{ const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256; const sx = skyC.getContext('2d'); const g = sx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#050507'); g.addColorStop(0.55, '#0b0b10'); g.addColorStop(0.8, '#15131a'); g.addColorStop(1, '#2a2218'); sx.fillStyle = g; sx.fillRect(0, 0, 4, 256);
  const skyT = new THREE.CanvasTexture(skyC); skyT.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(230, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })); dome.position.set(0, -4, 45); dome.renderOrder = -2; scene.add(dome);
  const n = 900, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 0.85), r = 200; pos[i * 3] = Math.cos(a) * Math.sin(e) * r; pos[i * 3 + 1] = Math.cos(e) * r + 2; pos[i * 3 + 2] = 45 + Math.sin(a) * Math.sin(e) * r; const w = 0.55 + Math.random() * 0.45; col[i * 3] = w; col[i * 3 + 1] = w; col[i * 3 + 2] = w * (0.9 + Math.random() * 0.1); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false })); stars.renderOrder = -1; scene.add(stars); }
{ const pm = new PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35; pm.dispose(); }
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260);
scene.add(new THREE.HemisphereLight(0xd9d2c5, 0x1c1a18, 0.95));
const sun = new THREE.DirectionalLight(0xfff0e0, 1.6); sun.position.set(6, 14, 10); scene.add(sun); scene.add(sun.target);
sun.castShadow = HQ; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 70; sun.shadow.camera.left = sun.shadow.camera.bottom = -24; sun.shadow.camera.right = sun.shadow.camera.top = 24; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.5, 0.92); if (HQ) composer.addPass(bloom);
composer.addPass(new OutputPass());
/* finishing pass: a soft vignette, a touch of contrast and film grain, so the picture reads like a photo and not a flat render */
const gradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: HQ ? 0.42 : 0.3 }, uGrain: { value: HQ ? 0.035 : 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; float v = 1.0 - smoothstep(0.35, 0.95, dot(d, d) * 2.2) * uVig;
      c.rgb = (c.rgb - 0.5) * 1.06 + 0.5; c.rgb *= v; c.rgb += (hash(vUv * 1000.0) - 0.5) * uGrain; gl_FragColor = c; }`
};
const gradePass = new ShaderPass(gradeShader); composer.addPass(gradePass);
const smaa = HQ ? new SMAAPass(innerWidth, innerHeight) : null; if (smaa) composer.addPass(smaa);
const pinkL = new THREE.PointLight(0xd8b070, 16, 26, 1.6); pinkL.position.set(-10, 5, -14); scene.add(pinkL);
const cyanL = new THREE.PointLight(0xe0c9a0, 14, 26, 1.6); cyanL.position.set(12, 5, -12); scene.add(cyanL);
const warmL = new THREE.PointLight(0xffb070, 22, 22, 1.6); warmL.position.set(0, 5, 9); scene.add(warmL);
const townL = new THREE.PointLight(0xc9a86a, 34, 60, 1.5); townL.position.set(0, 12, 40); scene.add(townL);
const townL2 = new THREE.PointLight(0xe0d2b8, 30, 60, 1.5); townL2.position.set(24, 14, 56); scene.add(townL2);
const sun2 = new THREE.DirectionalLight(0xd6cfc2, 0.7); sun2.position.set(-10, 12, 60); scene.add(sun2);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  tx.userData = { redraw: () => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h); tx.needsUpdate = true; }, ctx, c };
  return tx;
}
const redrawOnFonts = [];
/* the roof slot machine of the casino: spins every ~9 s, three mugs now and then */
const REEL_SYMS = ['mug', 'dia', 'cnd', 'ban', 'sev'];
function drawReelSym(x, k, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  if (k === 'mug') { x.fillStyle = '#ece9e2'; x.fillRect(-26, -14, 44, 42); x.fillRect(18, -6, 12, 6); x.fillRect(24, 0, 6, 14); x.fillRect(18, 14, 12, 6); x.fillStyle = '#0a0a0b'; x.fillRect(-21, -14, 34, 7); x.fillStyle = '#8fd3a6'; x.fillRect(-16, -38, 8, 16); x.fillRect(-2, -46, 8, 24); x.fillRect(12, -54, 8, 26); }
  else if (k === 'dia') { x.fillStyle = '#c8a96a'; x.beginPath(); x.moveTo(0, -42); x.lineTo(34, -8); x.lineTo(0, 42); x.lineTo(-34, -8); x.closePath(); x.fill(); x.fillStyle = '#f1dca4'; x.beginPath(); x.moveTo(0, -42); x.lineTo(12, -8); x.lineTo(0, 42); x.lineTo(-12, -8); x.closePath(); x.fill(); }
  else if (k === 'cnd') { x.fillStyle = '#8fd3a6'; x.fillRect(-3, -48, 6, 96); x.fillRect(-16, -30, 32, 58); }
  else if (k === 'ban') { x.fillStyle = '#e5bf72'; x.beginPath(); x.moveTo(-34, -24); x.quadraticCurveTo(-26, 34, 36, 26); x.quadraticCurveTo(-10, 18, -22, -30); x.closePath(); x.fill(); }
  else { x.fillStyle = '#d9707a'; x.font = "800 92px Unbounded, sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('7', 0, 4); }
  x.restore();
}
function casinoAnim(dt, time) {
  const R = townFx.casinoReels;
  if (R) {
    R.t += dt;
    if (R.spin <= 0 && R.t > 9) { R.t = 0; R.spin = 2.2; R.res = Math.random() < 0.3 ? ['mug', 'mug', 'mug'] : [0, 1, 2].map(() => REEL_SYMS[Math.floor(Math.random() * REEL_SYMS.length)]); }
    if (R.spin > -0.5) { R.spin -= dt; R.lever.rotation.x = R.spin > 1.9 ? -0.9 : 0; }
    R.drawAt = (R.drawAt || 0) + dt;
    if (R.drawAt > 0.09 && (R.spin > -0.4 || !R.done)) {
      R.drawAt = 0; const x = R.ctx, W = 600, H = 220; x.fillStyle = '#0a0a0b'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        const stop = R.spin - (2 - i) * 0.45, cx = 100 + i * 200;   // reels stop one after another
        x.fillStyle = '#141312'; x.fillRect(cx - 88, 12, 176, H - 24); x.strokeStyle = '#c8a96a'; x.lineWidth = 4; x.strokeRect(cx - 88, 12, 176, H - 24);
        const k = stop > 0 ? REEL_SYMS[Math.floor(time * 20 + i * 3) % REEL_SYMS.length] : R.res[i];
        drawReelSym(x, k, cx, H / 2 + (stop > 0 ? ((time * 900) % 60) - 30 : 0), 1.25);
      }
      const win = R.spin <= 0 && R.res[0] === R.res[1] && R.res[1] === R.res[2];
      x.strokeStyle = win ? '#8fd3a6' : 'rgba(217,112,122,.7)'; x.lineWidth = win ? 6 : 3; x.beginPath(); x.moveTo(6, H / 2); x.lineTo(W - 6, H / 2); x.stroke();
      R.tex.needsUpdate = true; R.done = R.spin <= -0.4;
    }
  }
  if (townFx.casinoBeams) townFx.casinoBeams.forEach((b, i) => { b.rotation.z = Math.sin(time * 0.45 + i * 2.1) * 0.42; b.rotation.x = Math.cos(time * 0.33 + i) * 0.25 - 0.1; });
}

/* text that always fits: the font shrinks until the line is inside the box (with padding) */
function fitText(ctx, text, font, size, maxW, minSize = 10) {
  let s = size; for (let i = 0; i < 40; i++) { ctx.font = font.replace('{s}', s); if (ctx.measureText(text).width <= maxW || s <= minSize) break; s = Math.max(minSize, Math.floor(s * 0.92)); }
  return s;
}
function neon(text, color, w, h, size, font = "700 {s}px Unbounded, 'Arial Black', sans-serif") {
  const tx = canvasTex(w, h, (ctx, W, H) => {
    const s = fitText(ctx, text, font, Math.min(size, H * 0.78), W * 0.92); ctx.font = font.replace('{s}', s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = H / 2 + s * 0.04;
    for (const [b, a] of [[s * 0.3, 0.45], [s * 0.12, 0.7]]) { ctx.shadowColor = color; ctx.shadowBlur = b; ctx.fillStyle = color; ctx.globalAlpha = a; ctx.fillText(text, W / 2, y); }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(text, W / 2, y);   // a dark rim keeps the sign readable against bright walls
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.95; ctx.fillText(text, W / 2, y); ctx.globalAlpha = 1;
  });
  redrawOnFonts.push(tx);
  const mm = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, fog: false, toneMapped: false }); return mm;
}
function neonSign(parent, text, color, w, h, x, y, z, ry = 0, size = 150) { const m = add(parent, new THREE.PlaneGeometry(w, h), neon(text, color, Math.round(w * 100), Math.round(h * 100), size), x, y, z); m.rotation.y = ry; return m; }

/* room */
const colliders = [];
const pickables = [];
const ROOM = { x: 23, zb: -18, zf: 17.5 };
const TOWN = { x: 48, zb: 19, zf: 72 };
const doorPanels = [];
function buildRoom() {
  const floorTex = canvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = '#0d0d10'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111113'; ctx.fillRect(0, 0, W / 2, H / 2); ctx.fillRect(W / 2, H / 2, W / 2, H / 2);
    ctx.strokeStyle = 'rgba(236,233,226,.05)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(23, 18);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.zf - ROOM.zb), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.38, metalness: 0.08, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = (ROOM.zf + ROOM.zb) / 2; floor.userData.floor = true; floor.receiveShadow = true; scene.add(floor); pickables.push(floor);
  const wallM = M(0x0f0f11), trimM = M(0x1d1d1f);
  add(scene, new THREE.PlaneGeometry(ROOM.x * 2, 10), wallM, 0, 5, ROOM.zb);
  const left = add(scene, new THREE.PlaneGeometry(ROOM.zf - ROOM.zb, 10), wallM, -ROOM.x, 5, (ROOM.zf + ROOM.zb) / 2); left.rotation.y = Math.PI / 2;
  const right = add(scene, new THREE.PlaneGeometry(ROOM.zf - ROOM.zb, 10), wallM, ROOM.x, 5, (ROOM.zf + ROOM.zb) / 2); right.rotation.y = -Math.PI / 2;
  const ceil = add(scene, new THREE.PlaneGeometry(ROOM.x * 2, ROOM.zf - ROOM.zb), M(0x08080a), 0, 10, (ROOM.zf + ROOM.zb) / 2); ceil.rotation.x = Math.PI / 2;
  add(scene, BOX(ROOM.x * 2, 0.35, 0.1), trimM, 0, 0.17, ROOM.zb + 0.05);
  add(scene, BOX(ROOM.x * 2, 0.05, 0.05), GLOW(0xe6dccb, 1.4), 0, 0.37, ROOM.zb + 0.1);
  for (const s of [-1, 1]) add(scene, BOX(0.05, 0.05, ROOM.zf - ROOM.zb), GLOW(0xd8c9a8, 1.2), s * (ROOM.x - 0.08), 0.37, (ROOM.zf + ROOM.zb) / 2);
  // front wall with a door gap + glass
  const fw = M(0x0f0f11);
  for (const s of [-1, 1]) { add(scene, BOX(ROOM.x - 1.8, 10, 0.6), fw, s * (ROOM.x / 2 + 0.9), 5, ROOM.zf + 0.3); colliders.push({ minx: s < 0 ? -ROOM.x : 1.8, maxx: s < 0 ? -1.8 : ROOM.x, minz: ROOM.zf - 0.1, maxz: ROOM.zf + 0.7, h: 10 }); }
  add(scene, BOX(3.6, 6.4, 0.6), fw, 0, 6.8, ROOM.zf + 0.3);
  add(scene, BOX(4.2, 0.2, 0.9), GLOW(0xd8c9a8, 0.7), 0, 3.6, ROOM.zf + 0.3);
  for (const s of [-1, 1]) add(scene, BOX(0.2, 3.6, 0.9), GLOW(0xd8c9a8, 0.7), s * 1.9, 1.8, ROOM.zf + 0.3);
  const glassM = new THREE.MeshBasicMaterial({ color: 0xe8e0d0, transparent: true, opacity: 0.18, depthWrite: false });
  for (const s of [-1, 1]) { const p = add(scene, BOX(1.75, 3.4, 0.08), glassM, s * 0.9, 1.7, ROOM.zf + 0.3); add(p, BOX(0.06, 3.4, 0.1), M(0x1d1d1f), -s * 0.86, 0, 0); p.userData.side = s; doorPanels.push(p); }
  // inside-facing windows on front wall
  for (const s of [-1, 1]) for (const x of [7, 15]) { add(scene, new THREE.PlaneGeometry(5, 2.6), new THREE.MeshBasicMaterial({ color: 0x111114 }), s * x, 5.6, ROOM.zf - 0.01).rotation.y = Math.PI; add(scene, BOX(5.3, 0.14, 0.14), trimM, s * x, 4.2, ROOM.zf - 0.05); }
  // night skyline windows (back wall)
  const sky = canvasTex(512, 200, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05050f'); g.addColorStop(0.7, '#1c1c22'); g.addColorStop(1, '#ffffff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rnd = seeded(7);
    for (let x = 0; x < W;) { const bw = 18 + rnd() * 40, bh = 50 + rnd() * 120; ctx.fillStyle = '#05050f'; ctx.fillRect(x, H - bh, bw, bh); ctx.fillStyle = 'rgba(255,214,120,.8)'; for (let wy = H - bh + 8; wy < H - 6; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 7) if (rnd() < 0.3) ctx.fillRect(wx, wy, 3, 4); x += bw + 2; }
  });
  for (const x of [-15, 15]) {
    add(scene, new THREE.PlaneGeometry(8.4, 3.3), new THREE.MeshBasicMaterial({ map: sky, fog: false }), x, 4.6, ROOM.zb + 0.03);
    add(scene, BOX(8.8, 0.18, 0.2), trimM, x, 2.9, ROOM.zb + 0.1);
    add(scene, BOX(0.12, 3.4, 0.16), trimM, x, 4.6, ROOM.zb + 0.1);
  }
  neonSign(scene, 'TRENCH CAFE', '#ffffff', 14, 2.3, 0, 8.0, ROOM.zb + 0.06);
  neonSign(scene, 'EXIT', '#8fd3a6', 2.2, 0.7, 0, 4.4, ROOM.zf - 0.02, Math.PI, 70);

  // counter + menu (left wall)
  const ctr = new THREE.Group(); ctr.position.set(-20.6, 0, -6); scene.add(ctr);
  add(ctr, RBOX(1.4, 1.1, 6, 0.08), M(0x1b1b1c), 0, 0.55, 0);
  add(ctr, RBOX(1.6, 0.08, 6.2, 0.03), M(0xd8c9a8), 0, 1.12, 0);
  add(ctr, BOX(0.05, 0.05, 6), GLOW(0xe6dccb, 1.2), 0.72, 0.9, 0);
  for (let i = 0; i < 4; i++) add(ctr, new THREE.CylinderGeometry(0.09, 0.07, 0.2, 14), M([0xffffff, 0xc8a96a, 0xd8c9a8, 0xe6dccb][i]), 0.1, 1.26, -2 + i * 1.3);
  const menu = canvasTex(512, 600, (ctx, W, H) => {
    ctx.fillStyle = '#111113'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#c8a96a'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.fillStyle = '#c8a96a'; ctx.font = "700 52px Unbounded, 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.fillText('MENU', W / 2, 90);
    ctx.font = "600 30px 'JetBrains Mono', monospace"; ctx.textAlign = 'left';
    const rows = [['coffee', '1h'], ['ramen', '2h'], ['energy can', '3h'], ['night pack', '8h'], ['gpu hour', '1 SOL'], ['free wifi', '24/7']];
    rows.forEach(([a, b], i) => { ctx.fillStyle = '#ece9e2'; ctx.fillText(a, 50, 180 + i * 66); ctx.fillStyle = '#bdb8ad'; ctx.textAlign = 'right'; ctx.fillText(b, W - 50, 180 + i * 66); ctx.textAlign = 'left'; });
  });
  redrawOnFonts.push(menu);
  const mb = add(scene, new THREE.PlaneGeometry(2.6, 3.0), new THREE.MeshBasicMaterial({ map: menu }), -ROOM.x + 0.05, 3.2, -6); mb.rotation.y = Math.PI / 2;
  colliders.push({ minx: -22, maxx: -19.8, minz: -9.2, maxz: -2.8, h: 1.3 });
  // vending machines (right wall)
  [['ENERGY', '#bdb8ad', -10], ['RAMEN', '#ffffff', -8.4], ['GPU', '#8fd3a6', -6.8]].forEach(([txt, col, z]) => {
    const g = new THREE.Group(); g.position.set(21.9, 0, z); scene.add(g);
    add(g, RBOX(1.1, 2.3, 1.3, 0.06), M(0x1d1d1f), 0, 1.15, 0);
    const f = add(g, new THREE.PlaneGeometry(1.0, 1.7), neon(txt, col, 300, 480, 64), -0.56, 1.35, 0); f.rotation.y = -Math.PI / 2;
  });
  colliders.push({ minx: 21.2, maxx: 23, minz: -11, maxz: -6, h: 2.4 });
  // launch booth (front-left)
  const lb = new THREE.Group(); lb.position.set(-19.2, 0, 10); lb.rotation.y = Math.PI / 2; scene.add(lb);
  add(lb, RBOX(2.8, 0.08, 1.1, 0.03), M(0x242426), 0, 0.78, 0);
  add(lb, BOX(2.7, 0.75, 0.06), M(0x1d1d1f), 0, 0.38, -0.5);
  const lmon = new THREE.Group(); lmon.position.set(0, 1.4, -0.25); lb.add(lmon);
  add(lmon, RBOX(1.9, 1.1, 0.07, 0.04), M(0x0b0b0c));
  const lt = canvasTex(512, 300, (ctx, W, H) => {
    ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    ctx.fillStyle = '#ece9e2'; ctx.font = "700 40px Unbounded, 'Arial Black', sans-serif"; ctx.fillText('PICK A', W / 2, 78); ctx.fillText('FREE SEAT', W / 2, 128);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, 196, 34, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(W / 2 - 18, 193, 36, 6); ctx.fillRect(W / 2 - 3, 178, 6, 36);
    ctx.fillStyle = '#9c988f'; ctx.font = "600 22px 'JetBrains Mono', monospace"; ctx.fillText('sit down to launch your coin', W / 2, 268);
  });
  redrawOnFonts.push(lt);
  add(lmon, new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshBasicMaterial({ map: lt }), 0, 0, 0.04);
  const pad = add(scene, new THREE.RingGeometry(1.0, 1.25, 40), new THREE.MeshBasicMaterial({ color: 0xe6dccb, transparent: true, opacity: 0.8 }), -17.2, 0.02, 10); pad.rotation.x = -Math.PI / 2;
  const padIn = add(scene, new THREE.CircleGeometry(1.0, 40), new THREE.MeshBasicMaterial({ color: 0xe6dccb, transparent: true, opacity: 0.12 }), -17.2, 0.015, 10); padIn.rotation.x = -Math.PI / 2;
  lb.traverse(o => { o.userData.launch = true; }); padIn.userData.launch = true; pad.userData.launch = true;
  pickables.push(lb, padIn);
  colliders.push({ minx: -20, maxx: -18.4, minz: 8.4, maxz: 11.6, h: 1.9 });
  // jobs board (right front wall)
  const jb = canvasTex(640, 420, (ctx, W, H) => {
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#7d5736'; const rnd = seeded(3); for (let i = 0; i < 400; i++) ctx.fillRect(rnd() * W, rnd() * H, 3, 3);
    ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.fillStyle = '#fff3c4'; ctx.font = "700 44px Unbounded, 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.fillText('HOUSE RULES', W / 2, 74);
    const cols = ['#fff27a', '#a9b8ff', '#ffb3d9', '#c9ffb3'];
    const notes = [['every coin', 'here is real'], ['launched on', 'pump.fun'], ['charts are', 'live data'], ['TEST means', 'not on chain'], ['arcade is', 'free to play'], ['say hi:', 'press Enter']];
    notes.forEach(([l1, l2], i) => { const x = 60 + (i % 3) * 180, y = 110 + Math.floor(i / 3) * 140; ctx.save(); ctx.translate(x + 60, y + 50); ctx.rotate((rnd() - .5) * .12); ctx.fillStyle = cols[i % 4]; ctx.fillRect(-60, -50, 130, 110); ctx.fillStyle = '#0a0a1e'; ctx.font = "700 17px 'JetBrains Mono', monospace"; ctx.textAlign = 'left'; ctx.fillText(l1, -48, -12); ctx.fillText(l2, -48, 14); ctx.restore(); });
  });
  redrawOnFonts.push(jb);
  const jbm = add(scene, new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshBasicMaterial({ map: jb }), ROOM.x - 0.05, 2.0, 9); jbm.rotation.y = -Math.PI / 2; jbm.userData.place = 'how'; pickables.push(jbm);
  // lamps
  for (const z of [-10.5, -5.5, -0.5, 4.5]) for (const x of [-11.4, -3.8, 3.8, 11.4]) {
    add(scene, new THREE.CylinderGeometry(0.01, 0.01, 2.2), M(0x111111), x, 8.9, z);
    add(scene, new THREE.ConeGeometry(0.45, 0.4, 18, 1, true), M(0x221a3f, { side: THREE.DoubleSide }), x, 7.7, z);
    add(scene, SPH(0.16), GLOW(0xffd59a, 1.5), x, 7.5, z);
  }
}

/* ================= booths ================= */
const BOOTH_X = [-13.3, -9.5, -5.7, -1.9, 1.9, 5.7, 9.5, 13.3];
const BOOTH_Z = [-13, -8, -3, 2];
const booths = [];
const deskM = M(0x202022), deskDark = M(0x1d1d1f), monM = M(0x0b0b0c);
function makeMonitor(parent, x, z, ry, mat) {
  const g = new THREE.Group(); g.position.set(x, 0.79, z); g.rotation.y = ry; parent.add(g);
  add(g, BOX(0.36, 0.03, 0.22), monM, 0, 0.015, 0);
  add(g, BOX(0.06, 0.32, 0.05), monM, 0, 0.18, -0.02);
  add(g, RBOX(1.0, 0.62, 0.05, 0.03), monM, 0, 0.62, 0);
  add(g, new THREE.PlaneGeometry(0.92, 0.54), mat, 0, 0.62, 0.028);
  return g;
}
function buildBooth(idx, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const parts = new Map();
  const st = (geo, mat, px = 0, py = 0, pz = 0, rx = 0, ry = 0) => { if (geo.index) geo = geo.toNonIndexed(); if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); geo.translate(px, py, pz); if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(geo); };
  st(RBOX(2.8, 0.08, 1.0, 0.03), deskM, 0, 0.75, 0);
  for (const s of [-1, 1]) st(BOX(0.06, 0.74, 0.9), deskDark, s * 1.3, 0.37, 0);
  st(BOX(2.6, 0.5, 0.04), deskDark, 0, 0.45, -0.46);
  const partM = new THREE.MeshBasicMaterial({ color: 0xd8d2c6, transparent: true, opacity: 0.07, depthWrite: false });
  for (const s of [-1, 1]) { add(g, BOX(0.04, 0.75, 1.0), partM, s * 1.42, 1.16, 0); st(BOX(0.06, 0.04, 1.0), deskDark, s * 1.42, 1.54, 0); }
  const strip = add(g, BOX(2.7, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0x6e6a60 }), 0, 0.72, 0.5);
  const dark = M(0x141415);
  st(RBOX(0.7, 0.03, 0.22, 0.01), dark, 0, 0.8, 0.18); st(RBOX(0.09, 0.03, 0.13, 0.015), dark, 0.52, 0.8, 0.2);
  st(new THREE.CylinderGeometry(0.06, 0.05, 0.13, 12), M(0xece9e2), -0.9, 0.86, 0.15);
  // main monitor (static frame)
  st(BOX(0.36, 0.03, 0.22), monM, 0, 0.805, -0.18); st(BOX(0.06, 0.32, 0.05), monM, 0, 0.97, -0.2); st(RBOX(1.0, 0.62, 0.05, 0.03), monM, 0, 1.41, -0.18);
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const scrM = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  add(g, new THREE.PlaneGeometry(0.92, 0.54), scrM, 0, 1.41, -0.152);
  const m2 = makeMonitor(g, -0.98, -0.1, 0.38, scrM); m2.visible = false;
  const m3 = makeMonitor(g, 0.98, -0.1, -0.38, scrM); m3.visible = false;
  const spk = new THREE.Group(); g.add(spk); spk.visible = false;
  for (const s of [-1, 1]) { add(spk, RBOX(0.16, 0.28, 0.16, 0.03), M(0x0c0c0e), s * 1.18, 0.93, -0.25); add(spk, new THREE.CylinderGeometry(0.05, 0.05, 0.01, 14), GLOW(0xd8c9a8, .6), s * 1.18, 0.95, -0.165).rotation.x = Math.PI / 2; }
  const chair = new THREE.Group(); chair.position.set(0, 0, 0.98); g.add(chair);
  const cg = [RBOX(0.62, 0.1, 0.6, 0.04), RBOX(0.62, 0.72, 0.09, 0.04)]; cg[0].translate(0, 0.45, 0); cg[1].translate(0, 0.86, 0.3);
  chair.add(new THREE.Mesh(mergeGeometries(cg), M(0x1e1e20)));
  const cb = [new THREE.CylinderGeometry(0.04, 0.04, 0.4).toNonIndexed(), new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14).toNonIndexed()]; cb[0].translate(0, 0.22, 0); cb[1].translate(0, 0.03, 0);
  chair.add(new THREE.Mesh(mergeGeometries(cb), M(0x111111)));
  const riser = add(g, new THREE.CylinderGeometry(1.0, 1.1, 0.18, 30), GLOW(0xc8a96a, 0.25), 0, 0.09, 1.0); riser.visible = false;
  const ringG = new THREE.Group(); ringG.position.set(1.05, 0, 1.6); ringG.rotation.y = -0.6; g.add(ringG); ringG.visible = false;
  add(ringG, new THREE.CylinderGeometry(0.02, 0.02, 1.7), M(0x111111), 0, 1.0, 0);
  add(ringG, new THREE.TorusGeometry(0.32, 0.035, 10, 32), new THREE.MeshBasicMaterial({ color: 0xfff6dc }), 0, 1.9, 0);
  const plaque = canvasTex(256, 64, (ctx) => { ctx.fillStyle = '#121214'; ctx.fillRect(0, 0, 256, 64); });
  add(g, new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: plaque }), 0, 0.62, 0.52);
  const vip = idx <= 8;   // the back row is the VIP row: gold trim, a velvet rope and a lamp; launching there costs extra
  if (vip) {
    const gold = METAL(0xc8a96a, { roughness: 0.3 });
    st(BOX(2.84, 0.03, 0.03), gold, 0, 0.795, 0.5); for (const s of [-1, 1]) st(BOX(0.03, 0.74, 0.03), gold, s * 1.42, 0.37, 0.5);
    for (const s of [-1, 1]) { st(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 10), gold, s * 1.25, 0.45, 1.75); st(SPH(0.06, 10, 8), gold, s * 1.25, 0.93, 1.75); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.25, 0.88, 1.75), new THREE.Vector3(0, 0.66, 1.75), new THREE.Vector3(1.25, 0.88, 1.75)), 12, 0.025, 6), M(0xa8122c, { roughness: 0.7 })));
    st(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), gold, -1.2, 1.05, -0.3); st(new THREE.ConeGeometry(0.14, 0.16, 12, 1, true), M(0xc8a96a, { emissive: 0xc8a96a, emissiveIntensity: 0.35, side: THREE.DoubleSide }), -1.2, 1.32, -0.3);
    add(g, new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ map: labelTex('VIP', '#0a0a0b', '#c8a96a', 128, 46, 30) }), 1.1, 0.62, 0.52);
  }
  // the name plate: a small sign above the desk, bought by the coin's owner
  const sign = add(g, new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), 0, 2.15, -0.25); sign.visible = false;
  for (const [mat, geos] of parts) g.add(new THREE.Mesh(mergeGeometries(geos), mat));
  g.traverse(o => { o.userData.boothIdx = idx; }); pickables.push(g);   // a desk is a click target: a free one is where you launch
  const b = { idx, x, z, vip, sign, group: g, tex, canvas: c, ctx: c.getContext('2d'), m2, m3, spk, chair, riser, ringG, partM, strip, plaque, agent: null, avatar: null, lastStage: null };
  colliders.push({ minx: x - 1.47, maxx: x + 1.47, minz: z - 0.55, maxz: z + 1.32, h: 0.9 });
  booths.push(b);
  return b;
}
function updatePlate(b) {
  const a = b.agent, text = a && a.plate; b.sign.visible = !!text;
  if (!text || b.signText === text) return; b.signText = text;
  if (b.sign.material.map) b.sign.material.map.dispose();
  b.sign.material = neon(text, '#c8a96a', 640, 160, 70); b.sign.material.needsUpdate = true;
}
function seatPos(b) { return new THREE.Vector3(b.x, 0, b.z + 0.98); }
function applyBoothStage(b) {
  const a = b.agent; const st = a ? (a.bonded ? 'famous' : stageOf(a.bond)) : 'lurker'; const i = stageIdx(st);
  b.m2.visible = i >= 2; b.m3.visible = i >= 3; b.spk.visible = i >= 3;
  b.partM.opacity = i >= 4 ? 0.28 : 0.1; b.partM.color.set(i >= 5 ? 0xc8a96a : i >= 4 ? 0xe6dccb : 0xd8d2c6);
  b.riser.visible = i >= 5; b.ringG.visible = i >= 5; b.chair.visible = i < 5;
  b.strip.material.color.set(a ? coinColor(a) : '#4a4270');
  const ctx = b.plaque.userData.ctx; ctx.clearRect(0, 0, 256, 64); ctx.fillStyle = i >= 5 ? '#3a2c00' : '#121214'; ctx.fillRect(0, 0, 256, 64);
  if (a) { ctx.font = "700 26px 'JetBrains Mono', monospace"; ctx.fillStyle = i >= 5 ? '#c8a96a' : '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('$' + a.sym.slice(0, 9), 12, 42); ctx.textAlign = 'right'; ctx.fillStyle = a.mint ? '#8fd3a6' : 'rgba(255,255,255,.5)'; ctx.fillText(a.mint ? mcapText(a) : 'TEST', 244, 42); ctx.textAlign = 'left'; }
  else if (b.vip) { ctx.font = "700 22px 'JetBrains Mono', monospace"; ctx.fillStyle = '#c8a96a'; ctx.textAlign = 'left'; ctx.fillText('VIP DESK', 12, 42); ctx.textAlign = 'left'; }
  b.plaque.needsUpdate = true;
  updatePlate(b);
  if (b.avatar && !a?.outside) {
    const sp = seatPos(b); b.avatar.obj.visible = true;
    if (i >= 5) { b.avatar.obj.position.set(sp.x, 0.18, sp.z); b.avatar.obj.rotation.y = 0; b.avatar.state = 'dance'; b.avatar.obj.scale.setScalar(b.avatar.baseScale * 1.15); }
    else { b.avatar.obj.position.copy(sp); b.avatar.obj.rotation.y = Math.PI; b.avatar.state = 'sit'; b.avatar.obj.scale.setScalar(b.avatar.baseScale * (1 + i * 0.03)); }
  }
  b.lastStage = st;
}
const IMG_CACHE = {};
function imgOf(a) { const src = a.image || THUMBS[a.body]; if (!src) return null; let im = IMG_CACHE[src]; if (!im) { im = new Image(); if (!src.startsWith('data:')) im.crossOrigin = 'anonymous'; im.src = src; IMG_CACHE[src] = im; } return im.complete && im.naturalWidth ? im : null; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawScreen(b) {
  const ctx = b.ctx, a = b.agent, W = 256, H = 160;
  ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, W, H);
  if (!a) {
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.setLineDash([6, 6]); ctx.strokeRect(10, 10, W - 20, H - 20); ctx.setLineDash([]);
    ctx.fillStyle = b.vip ? '#c8a96a' : 'rgba(255,255,255,.75)'; ctx.font = "700 18px Unbounded, 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.fillText(b.vip ? 'VIP SEAT' : 'FREE SEAT', W / 2, H / 2 - 2);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.fillText(b.vip ? 'launch here · +' + ((typeof NET !== 'undefined' && NET.cfg && NET.cfg.vipDeskFee) || 0.05) + ' SOL' : 'sit here to launch a coin', W / 2, H / 2 + 20); ctx.textAlign = 'left';
    b.tex.needsUpdate = true; return;
  }
  ctx.fillStyle = '#141416'; ctx.fillRect(0, 0, W, 26);
  ctx.fillStyle = '#ffffff'; ctx.font = "700 14px 'JetBrains Mono', monospace"; ctx.textAlign = 'left'; ctx.fillText('$' + a.sym.slice(0, 11), 8, 18);
  ctx.textAlign = 'right'; ctx.fillStyle = !a.mint ? 'rgba(255,255,255,.55)' : a.bonded ? '#c8a96a' : '#8fd3a6'; ctx.fillText(!a.mint ? 'TEST' : a.bonded ? 'GRADUATED' : mcapText(a), W - 8, 18); ctx.textAlign = 'left';
  const d = chartData(a);
  if (d) drawSeries(ctx, 8, 34, W - 16, 90, d, true); else chartEmpty(ctx, W, 128, a, true);
  if (a.mint) { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(8, 136, W - 16, 8); ctx.fillStyle = a.bonded ? '#c8a96a' : '#8fd3a6'; ctx.fillRect(8, 136, (W - 16) * Math.min(1, a.bond / 100), 8); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.fillText(a.bonded ? 'GRADUATED' : 'BONDING ' + a.bond.toFixed(0) + '%', 8, 156); ctx.textAlign = 'right'; ctx.fillText(a.trades.length ? a.trades.length + ' TRADES' : 'NO TRADES YET', W - 8, 156); ctx.textAlign = 'left'; }
  else { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.fillText('NOT ON PUMP.FUN', 8, 154); }
  if (a.outside) { ctx.fillStyle = 'rgba(8,6,16,.6)'; ctx.fillRect(0, 26, W, H - 26); ctx.fillStyle = '#c8a96a'; ctx.font = "700 18px 'JetBrains Mono', monospace"; ctx.textAlign = 'center'; ctx.fillText('OUT IN TOWN', W / 2, H / 2 + 6); ctx.textAlign = 'left'; }
  if (a.bonded) { ctx.strokeStyle = '#c8a96a'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, W - 4, H - 4); }
  b.tex.needsUpdate = true;
}

/* ================= town ================= */
const PLACES = {};
let CASINO_RECT = null;   // walking routes go around the casino
const townFx = {};
function place(id, x, z, r, approach, extra = {}) { PLACES[id] = { id, x, z, r, ax: approach[0], az: approach[1], ...extra }; return PLACES[id]; }
function buildTown() {
  const gTex = canvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = '#0d0d0f'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#121214'; ctx.fillRect(0, 0, W / 2, H / 2); ctx.fillRect(W / 2, H / 2, W / 2, H / 2);
    ctx.strokeStyle = 'rgba(236,233,226,.05)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, W - 4, H - 4);
  });
  gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping; gTex.repeat.set(32, 20);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(TOWN.x * 2 + 8, TOWN.zf - 17 + 14), new THREE.MeshStandardMaterial({ map: gTex, roughness: 0.8, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.01, (TOWN.zf + 17) / 2 + 3); ground.userData.floor = true; ground.receiveShadow = true; scene.add(ground); pickables.push(ground);
  // cafe exterior shell
  const shellM = M(0x0f0f11);
  add(scene, BOX(ROOM.x * 2 + 1, 0.6, ROOM.zf - ROOM.zb + 1), shellM, 0, 10.3, (ROOM.zf + ROOM.zb) / 2);
  add(scene, BOX(ROOM.x * 2 + 1, 11, 0.5), shellM, 0, 5.5, ROOM.zb - 0.3);
  for (const s of [-1, 1]) add(scene, BOX(0.5, 11, ROOM.zf - ROOM.zb + 1), shellM, s * (ROOM.x + 0.25), 5.5, (ROOM.zf + ROOM.zb) / 2);
  // facade decor
  neonSign(scene, 'TRENCH CAFE', '#ffffff', 16, 2.6, 0, 8.4, ROOM.zf + 0.62, 0, 150);
  for (const s of [-1, 1]) for (const x of [7, 15]) { add(scene, new THREE.PlaneGeometry(5, 2.6), new THREE.MeshBasicMaterial({ color: 0xd6cfc2, transparent: true, opacity: 0.35 }), s * x, 5.6, ROOM.zf + 0.61); add(scene, BOX(5.3, 0.14, 0.4), M(0x1d1d1f), s * x, 4.2, ROOM.zf + 0.7); }
  const awn = add(scene, BOX(6, 0.12, 2.2), M(0xe6dccb, { emissive: 0x1b1b1e, emissiveIntensity: 1 }), 0, 4.1, ROOM.zf + 1.5); awn.rotation.x = 0.12;
  for (const s of [-1, 1]) add(scene, new THREE.CylinderGeometry(0.05, 0.05, 4), M(0x1d1d1f), s * 2.8, 2, ROOM.zf + 2.5);
  const matT = canvasTex(256, 128, (ctx, W, H) => { ctx.fillStyle = '#2a2150'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffffff'; ctx.font = "700 44px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText('WALK IN', W / 2, 80); });
  redrawOnFonts.push(matT);
  add(scene, new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: matT }), 0, 0.01, ROOM.zf + 2.2).rotation.x = -Math.PI / 2;
  place('cafe', 0, ROOM.zf + 0.3, 2.5, [0, ROOM.zf + 2.6]);
  // street lamps + benches
  for (const [x, z] of [[-10, 24], [10, 24], [-22, 47], [18, 44], [-6, 66], [6, 66], [-30, 56], [34, 44]]) {   // (-22, 47): moved out of the casino's way
    add(scene, new THREE.CylinderGeometry(0.08, 0.1, 6, 10), M(0x1d1d1f), x, 3, z); add(scene, SPH(0.3), GLOW(0xffd59a, 1.6), x, 6.1, z);
    const pl = new THREE.PointLight(0xffd59a, 26, 22, 1.4); pl.position.set(x, 5.6, z); scene.add(pl);
  }
  // skyline ring
  const rnd = seeded(11); const skyM = M(0x07071a); const winM = GLOW(0xffd27a, 0.9);
  const bl = [], wl = [];
  const pushBox = (list, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); };
  for (let x = -60; x <= 60; x += 7) { const h = 14 + rnd() * 26, w = 4 + rnd() * 4; pushBox(bl, w, h, 6, x + rnd() * 2, h / 2, TOWN.zf + 16 + rnd() * 6); for (let i = 0; i < 6; i++) if (rnd() < 0.6) pushBox(wl, 0.5, 0.6, 0.1, x + (rnd() - 0.5) * w * 0.7, 2 + rnd() * (h - 4), TOWN.zf + 12.9); }
  for (const s of [-1, 1]) for (let z = 10; z <= 72; z += 8) { const h = 12 + rnd() * 22; pushBox(bl, 6, h, 5 + rnd() * 3, s * (TOWN.x + 8 + rnd() * 3), h / 2, z); }
  scene.add(new THREE.Mesh(mergeGeometries(bl), skyM)); scene.add(new THREE.Mesh(mergeGeometries(wl), winM));
  neonSign(scene, 'PUMP STREET', '#c8a96a', 12, 1.4, -TOWN.x - 4.9, 9, 44, Math.PI / 2, 90);
  neonSign(scene, 'FOMO AVE', '#8fd3a6', 10, 1.4, TOWN.x + 4.9, 9, 36, -Math.PI / 2, 90);

  /* market terminal */
  { const g = new THREE.Group(); g.position.set(-20, 0, 32); scene.add(g);
    add(g, RBOX(7, 4, 3.2, 0.1), M(0x151517), 0, 2, 0); add(g, BOX(7.4, 0.3, 3.6), M(0xd8c9a8, { emissive: 0x18181b, emissiveIntensity: 1 }), 0, 4.1, 0);
    const scr = canvasTex(512, 256, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 256); });
    townFx.marketTex = scr;
    add(g, new THREE.PlaneGeometry(6.2, 3.1), new THREE.MeshBasicMaterial({ map: scr }), 0, 2.05, 1.62);
    neonSign(g, 'MARKET', '#bdb8ad', 5, 1, 0, 4.9, 1.2, 0, 90);
    add(g, RBOX(2.4, 1.0, 0.8, 0.05), M(0x1d1d1f), 0, 0.5, 2.3); add(g, RBOX(2.0, 0.06, 0.6, 0.02), M(0xd8c9a8, { emissive: 0x18181b, emissiveIntensity: 1 }), 0, 1.03, 2.3);
    g.traverse(o => o.userData.place = 'market'); pickables.push(g); colliders.push({ minx: -23.7, maxx: -16.3, minz: 30.3, maxz: 34.8, h: 4.5 });
    place('market', -20, 32, 4.5, [-20, 36.4]); }
  /* rewards well (fountain) */
  { const g = new THREE.Group(); g.position.set(0, 0, 36); scene.add(g);
    add(g, new THREE.CylinderGeometry(3.4, 3.6, 0.7, 36), M(0x1d1d1f), 0, 0.35, 0); add(g, new THREE.CylinderGeometry(3.0, 3.0, 0.1, 36), new THREE.MeshBasicMaterial({ color: 0xd8c9a8, transparent: true, opacity: 0.55 }), 0, 0.68, 0);
    add(g, new THREE.CylinderGeometry(0.5, 0.7, 2.2, 16), M(0x242426), 0, 1.5, 0); add(g, new THREE.CylinderGeometry(1.3, 1.1, 0.25, 24), M(0x242426), 0, 2.6, 0);
    const jet = add(g, new THREE.ConeGeometry(0.35, 1.6, 12), new THREE.MeshBasicMaterial({ color: 0xd6cfc2, transparent: true, opacity: 0.8 }), 0, 3.4, 0); townFx.jet = jet;
    add(g, new THREE.TorusGeometry(3.4, 0.06, 8, 48), GLOW(0xc8a96a, 1), 0, 0.72, 0).rotation.x = Math.PI / 2;
    neonSign(g, 'GM FOUNTAIN', '#c8a96a', 7, 1, 0, 5.2, 0, 0, 90);
    g.traverse(o => o.userData.place = 'well'); pickables.push(g); colliders.push({ minx: -3.7, maxx: 3.7, minz: 32.3, maxz: 39.7, h: 2.8 });
    place('well', 0, 36, 5.2, [0, 41]); }
  /* quest board */
  { const g = new THREE.Group(); g.position.set(12, 0, 23); scene.add(g);
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), M(0x3a2618), s * 2.1, 1.6, 0);
    const qb = canvasTex(512, 300, ctx => { ctx.fillStyle = '#6b4a2e'; ctx.fillRect(0, 0, 512, 300); }); townFx.questTex = qb;
    add(g, new THREE.PlaneGeometry(4.4, 2.6), new THREE.MeshBasicMaterial({ map: qb }), 0, 2.2, 0.06);
    add(g, BOX(4.6, 2.8, 0.1), M(0x3a2618), 0, 2.2, 0);
    add(g, BOX(5, 0.3, 0.6), M(0x3a2618), 0, 3.7, 0);
    g.traverse(o => o.userData.place = 'quest'); pickables.push(g); colliders.push({ minx: 9.6, maxx: 14.4, minz: 22.5, maxz: 23.5, h: 3.6 });
    place('quest', 12, 23, 3.4, [12, 25.4]); }
  /* X tower */
  { const g = new THREE.Group(); g.position.set(26, 0, 48); scene.add(g);
    add(g, BOX(4.4, 18, 4.4), M(0x161228), 0, 9, 0); add(g, BOX(5, 0.4, 5), M(0x1d1d1f), 0, 0.2, 0);
    for (let y = 2; y < 17; y += 1.5) for (const s of [-1, 1]) add(g, BOX(0.08, 0.9, 2.6), GLOW(0xd8c9a8, 0.6), s * 2.22, y, 0);
    add(g, new THREE.CylinderGeometry(0.06, 0.1, 5, 8), M(0x1d1d1f), 0, 20.5, 0); const bk = add(g, SPH(0.35), GLOW(0xd9707a, 2), 0, 23, 0); townFx.beacon = bk;
    neonSign(g, 'GM', '#ece9e2', 3.4, 3.4, 0, 15.5, 2.22, 0, 200); neonSign(g, 'TOWER', '#bdb8ad', 3.6, 0.9, 0, 13.2, 2.22, 0, 80);
    const scr = canvasTex(512, 256, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 256); }); townFx.xTex = scr;
    add(g, new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: scr }), 0, 5, 2.22);
    add(g, BOX(2.2, 3, 0.1), GLOW(0xd8c9a8, 0.3), 0, 1.5, 2.2);
    g.traverse(o => o.userData.place = 'xtower'); pickables.push(g); colliders.push({ minx: 23.5, maxx: 28.5, minz: 45.5, maxz: 50.5, h: 18 });
    place('xtower', 26, 48, 5, [26, 52.5]); }
  /* billboard */
  { const g = new THREE.Group(); g.position.set(-26, 0, 52); g.rotation.y = Math.PI / 2 - 0.4; scene.add(g);
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.18, 0.2, 7, 10), M(0x1d1d1f), s * 3.5, 3.5, 0);
    add(g, BOX(10.4, 5.4, 0.3), M(0x0c0c0e), 0, 9, 0);
    const scr = canvasTex(1024, 512, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 1024, 512); }); townFx.billTex = scr;
    add(g, new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: scr }), 0, 9, 0.17);
    for (const s of [-1, 1]) { add(g, BOX(0.1, 0.1, 1.2), M(0x1d1d1f), s * 4, 12, 0.6).rotation.x = 0.3; add(g, SPH(0.2), GLOW(0xffd59a, 1.6), s * 4, 12.1, 1.1); }
    const bl = new THREE.PointLight(0xffd59a, 14, 14, 1.4); bl.position.set(0, 11, 2.5); g.add(bl);
    g.traverse(o => o.userData.place = 'billboard'); pickables.push(g); colliders.push({ minx: -27, maxx: -25, minz: 47, maxz: 57, h: 12 });
    place('billboard', -26, 52, 6, [-21.5, 52]); }
  /* vault */
  { const g = new THREE.Group(); g.position.set(-8, 0, 60); scene.add(g);
    add(g, RBOX(8, 5.5, 6, 0.15), M(0x151517), 0, 2.75, 0); add(g, BOX(8.6, 0.6, 6.6), M(0x1d1d1f), 0, 5.8, 0);
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.4, 0.4, 5.5, 12), M(0x1d1d1f), s * 3.2, 2.75, 3.1);
    add(g, new THREE.CylinderGeometry(1.7, 1.7, 0.5, 32), M(0x8d939e, { emissive: 0x1c1f24, emissiveIntensity: 1 }), 0, 2.2, 3.1).rotation.x = Math.PI / 2;
    add(g, new THREE.TorusGeometry(1.1, 0.12, 10, 32), M(0xc8a96a, { emissive: 0x3a2c00, emissiveIntensity: 1 }), 0, 2.2, 3.4);
    for (let i = 0; i < 4; i++) { const sp = add(g, BOX(0.15, 1.9, 0.12), M(0xc8a96a), 0, 2.2, 3.42); sp.rotation.z = i * Math.PI / 4; }
    neonSign(g, 'HODL VAULT', '#c8a96a', 5.5, 1, 0, 4.8, 3.1, 0, 90);
    const fire = new THREE.PointLight(0xff6a2a, 0, 10, 1.5); fire.position.set(0, 2, 5); g.add(fire); townFx.fireL = fire;
    g.traverse(o => o.userData.place = 'vault'); pickables.push(g); colliders.push({ minx: -12.4, maxx: -3.6, minz: 56.6, maxz: 63.6, h: 6 });
    place('vault', -8, 60, 5, [-8, 65.2]);
    /* the Trench League trophy: shown once a week has a champion, the plaque names the coin */
    { const tg = new THREE.Group(); tg.position.set(-14.6, 0, 62.4); tg.rotation.y = 0.35; scene.add(tg); tg.visible = false;
      add(tg, new THREE.CylinderGeometry(0.75, 0.85, 1.1, 20), M(0x151517), 0, 0.55, 0); add(tg, new THREE.CylinderGeometry(0.85, 0.85, 0.08, 20), M(0xc8a96a, { metalness: 0.6, roughness: 0.3 }), 0, 1.14, 0);
      const gold = M(0xc8a96a, { emissive: 0x3a2c00, emissiveIntensity: 1, metalness: 0.7, roughness: 0.25 });
      add(tg, new THREE.CylinderGeometry(0.12, 0.2, 0.5, 14), gold, 0, 1.4, 0); add(tg, new THREE.CylinderGeometry(0.42, 0.18, 0.55, 18, 1, true), gold, 0, 1.9, 0); add(tg, SPH(0.16, 14, 10), gold, 0, 2.3, 0);
      for (const s of [-1, 1]) add(tg, new THREE.TorusGeometry(0.16, 0.035, 8, 18), gold, s * 0.5, 1.95, 0);
      const pt = canvasTex(256, 128, ctx => { ctx.fillStyle = '#121214'; ctx.fillRect(0, 0, 256, 128); });
      add(tg, new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: pt }), 0, 0.6, 0.86);
      const lamp = new THREE.PointLight(0xf1dca4, 6, 5, 1.6); lamp.position.set(0, 2.8, 0.6); tg.add(lamp);
      townFx.trophy = { g: tg, tex: pt, ctx: pt.userData.ctx, drawn: '' };
      colliders.push({ minx: -15.5, maxx: -13.7, minz: 61.5, maxz: 63.3, h: 1.2 }); } }
  /* studio */
  { const g = new THREE.Group(); g.position.set(-36, 0, 38); g.rotation.y = 0.5; scene.add(g);
    add(g, RBOX(7, 4.5, 6, 0.12), M(0x16183a), 0, 2.25, 0); add(g, BOX(7.4, 0.3, 6.4), M(0xd6cfc2, { emissive: 0x1b1b1e, emissiveIntensity: 1 }), 0, 4.6, 0);
    [[0xe6dccb, -2.2, 1.2], [0xd8c9a8, 0, 2.2], [0xc8a96a, 2.2, 1.0], [0x9ed9b2, 1, 3.4]].forEach(([c, x, y]) => add(g, SPH(0.5 + Math.random() * 0.3, 12, 8), GLOW(c, 0.8), x, y, 3.05).scale.set(1, 1, 0.2));
    add(g, BOX(1.8, 2.8, 0.2), M(0x0c0c0e), -0.5, 1.4, 3.05);
    neonSign(g, 'MEME STUDIO', '#ffffff', 6, 1, 0, 5.3, 2.5, 0, 90);
    g.traverse(o => o.userData.place = 'studio'); pickables.push(g); colliders.push({ minx: -40.5, maxx: -31.5, minz: 33.5, maxz: 42.5, h: 5 });
    place('studio', -36, 38, 5.5, [-33.2, 43.4]); }
  /* launch pad */
  { const g = new THREE.Group(); g.position.set(14, 0, 62); scene.add(g);
    add(g, new THREE.CylinderGeometry(4.2, 4.4, 0.3, 40), M(0x1d1d1f), 0, 0.15, 0); add(g, new THREE.TorusGeometry(4.2, 0.08, 8, 48), GLOW(0x9ed9b2, 1.2), 0, 0.32, 0).rotation.x = Math.PI / 2;
    add(g, new THREE.TorusGeometry(2.6, 0.06, 8, 40), GLOW(0xc8a96a, 1), 0, 0.33, 0).rotation.x = Math.PI / 2;
    const rk = new THREE.Group(); rk.position.y = 0.3; g.add(rk); townFx.rocket = rk;
    add(rk, new THREE.CylinderGeometry(0.6, 0.7, 3.2, 20), M(0xece9e2), 0, 2.0, 0); add(rk, new THREE.ConeGeometry(0.6, 1.4, 20), M(0xe6dccb), 0, 4.3, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const fin = add(rk, BOX(0.12, 1.2, 0.8), M(0xe6dccb), Math.sin(a) * 0.75, 0.8, Math.cos(a) * 0.75); fin.rotation.y = a; }
    add(rk, new THREE.CylinderGeometry(0.42, 0.55, 0.5, 16), M(0x1d1d1f), 0, 0.25, 0); const flame = add(rk, new THREE.ConeGeometry(0.45, 1.6, 12), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 }), 0, -0.7, 0); flame.rotation.x = Math.PI; flame.visible = false; townFx.flame = flame;
    add(rk, new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: labelTex('MOON', '#0a0a1e', null, 256, 128, 70), transparent: true }), 0, 2.2, 0.72);
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.08, 0.1, 6, 8), M(0x1d1d1f), s * 3, 3, -3.2);
    add(g, BOX(6.5, 0.2, 0.2), M(0x1d1d1f), 0, 6, -3.2);
    neonSign(g, 'LAUNCH PAD', '#8fd3a6', 6.5, 1, 0, 6.8, -3.1, 0, 90);
    g.traverse(o => o.userData.place = 'launchpad'); pickables.push(g); colliders.push({ minx: 12.4, maxx: 15.6, minz: 60.4, maxz: 63.6, h: 5 });
    place('launchpad', 14, 62, 6.5, [14, 67.6]); }
  /* nest (tree) */
  { const g = new THREE.Group(); g.position.set(32, 0, 34); scene.add(g);
    add(g, new THREE.CylinderGeometry(0.7, 1.1, 5, 12), M(0x4a2f22), 0, 2.5, 0);
    for (const [x, y, z, r] of [[0, 6.2, 0, 2.6], [1.8, 5.4, 0.6, 1.9], [-1.9, 5.6, -0.4, 1.8], [0.4, 5.2, -1.9, 1.7], [-0.3, 5.0, 1.9, 1.6]]) add(g, SPH(r, 16, 12), M(0xd8c9a8), x, y, z);
    for (let i = 0; i < 18; i++) add(g, SPH(0.12, 6, 5), M(0xe8e0d0), (Math.random() - .5) * 5, 4 + Math.random() * 3.5, (Math.random() - .5) * 5);
    const nest = add(g, new THREE.TorusGeometry(1.1, 0.35, 10, 24), M(0x8a6a3a), 0, 3.7, 1.6); nest.rotation.x = Math.PI / 2; nest.scale.z = 0.6;
    add(g, new THREE.CylinderGeometry(1.1, 0.9, 0.2, 20), M(0x6a4e2a), 0, 3.6, 1.6);
    const egg = add(g, SPH(0.45, 16, 12), M(0xfff6dc, { emissive: 0x3a2c00, emissiveIntensity: 0.4 }), 0, 4.2, 1.6); egg.scale.y = 1.3; egg.visible = false; townFx.egg = egg;
    for (let i = 0; i < 5; i++) add(g, SPH(0.22, 8, 6), M(0xd8c9a8), (i - 2) * 1.6 + (Math.random() - .5), 0.1, 3.2 + Math.random());
    neonSign(g, 'CHILL NEST', '#ffffff', 4.6, 0.9, 0, 9.4, 0, 0, 90);
    g.traverse(o => o.userData.place = 'nest'); pickables.push(g); colliders.push({ minx: 30.8, maxx: 33.2, minz: 32.8, maxz: 35.2, h: 4 });
    place('nest', 32, 34, 5, [32, 38.6], { seats: [[29.6, 38], [34.4, 38]] }); }
  /* casino: free chips only. On the plaza left of the fountain, facing the cafe door, so everyone sees it on the way out */
  { const CX = -12, CZ = 48, g = new THREE.Group(); g.position.set(CX, 0, CZ); g.rotation.y = Math.PI; scene.add(g);   // local +z (the facade) faces the cafe
    const gold = METAL(0xc8a96a, { roughness: 0.28 }), dark = M(0x0d0c0b);
    add(g, RBOX(11, 6.4, 7, 0.12), dark, 0, 3.2, 0);
    add(g, BOX(11.4, 0.36, 7.4), M(0x1b1712), 0, 6.55, 0);
    for (const y of [0.18, 6.3]) add(g, BOX(11.25, 0.14, 0.12), gold, 0, y, 3.56);
    for (const s of [-1, 1]) add(g, BOX(0.14, 6.3, 0.12), gold, s * 5.56, 3.2, 3.56);
    // the sign: a lit box inside the facade (never cut off by the camera), framed by chasing bulbs
    const signTex = canvasTex(1024, 300, (ctx, W, H) => {
      ctx.fillStyle = '#0f0d0a'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#c8a96a'; ctx.lineWidth = 8; ctx.strokeRect(14, 14, W - 28, H - 28);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f1dca4'; ctx.font = '800 112px Unbounded, sans-serif'; ctx.fillText('CASINO', W / 2, 128);
      ctx.fillStyle = '#c8a96a'; ctx.font = "700 34px 'JetBrains Mono', monospace"; ctx.fillText('SLOTS · RUG CRASH · PUMP OR DUMP', W / 2, 226);
    });
    redrawOnFonts.push(signTex);
    add(g, BOX(8.4, 2.5, 0.3), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }), 0, 4.75, 3.7);
    const bulbs = []; const per = (w, h) => { const pts = []; const n = 34; for (let i = 0; i < n; i++) { const u = i / n * (2 * (w + h)); let px, py; if (u < w) { px = -w / 2 + u; py = h / 2; } else if (u < w + h) { px = w / 2; py = h / 2 - (u - w); } else if (u < 2 * w + h) { px = w / 2 - (u - w - h); py = -h / 2; } else { px = -w / 2; py = -h / 2 + (u - 2 * w - h); } pts.push([px, py]); } return pts; };
    for (const [px, py] of per(8.9, 3)) bulbs.push(add(g, SPH(0.1, 8, 6), GLOW(0xf1dca4, 2), px, 4.75 + py, 3.9));
    townFx.casinoBulbs = bulbs;
    // entrance: glowing doors, brass columns, a red carpet with velvet ropes
    add(g, BOX(3.2, 3, 0.12), new THREE.MeshBasicMaterial({ color: 0xc8a96a, transparent: true, opacity: 0.32 }), 0, 1.5, 3.58);
    for (const s of [-1, 1]) { add(g, CYL(0.22, 0.26, 3.3, 14), gold, s * 2.05, 1.65, 3.75); add(g, SPH(0.3, 14, 10), gold, s * 2.05, 3.4, 3.75); }
    add(g, new THREE.PlaneGeometry(3, 4.6), M(0x8a1622, { roughness: 0.9 }), 0, 0.02, 6.1).rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) { add(g, new THREE.PlaneGeometry(0.1, 4.6), gold, s * 1.5, 0.025, 6.1).rotation.x = -Math.PI / 2;
      for (const z of [4.4, 6.1, 7.8]) { add(g, CYL(0.05, 0.07, 0.95, 10), gold, s * 1.9, 0.48, z); add(g, SPH(0.08, 10, 8), gold, s * 1.9, 0.98, z); }
      for (const [z1, z2] of [[4.4, 6.1], [6.1, 7.8]]) { const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * 1.9, 0.9, z1), new THREE.Vector3(s * 1.9, 0.62, (z1 + z2) / 2), new THREE.Vector3(s * 1.9, 0.9, z2)), 12, 0.035, 6), M(0xa8122c, { roughness: 0.7 })); g.add(rope); } }
    // chip stacks and a pair of dice by the door
    const chipCols = [0xc8a96a, 0x0d0c0b, 0x8fd3a6, 0xa8122c];
    for (const [sx, n] of [[-3.7, 7], [-4.6, 4], [3.8, 9], [4.7, 5]]) for (let i = 0; i < n; i++) add(g, CYL(0.42, 0.42, 0.13, 26), M(chipCols[i % 4], { roughness: 0.45 }), sx, 0.07 + i * 0.135, 4.3);
    const dice = (x, z, ry) => { const d = add(g, RBOX(0.8, 0.8, 0.8, 0.12), M(0xf2efe8, { roughness: 0.35 }), x, 0.4, z); d.rotation.y = ry; for (const [dx, dy] of [[-0.2, 0.2], [0, 0], [0.2, -0.2]]) add(d, CYL(0.07, 0.07, 0.02, 12), M(0x0a0a0b), dx, 0.41, dy); return d; };
    dice(3.3, 6.6, 0.4); dice(4.2, 7.2, -0.3);
    // the giant slot machine on the roof: its reels spin every few seconds and can be seen from the cafe door
    const sm = new THREE.Group(); sm.position.set(0, 6.7, 0.8); g.add(sm);
    add(sm, RBOX(4.6, 2.9, 1.5, 0.18), M(0x1d1a16), 0, 1.45, 0); add(sm, RBOX(4.8, 0.3, 1.6, 0.08), gold, 0, 3, 0); add(sm, RBOX(4.8, 0.3, 1.6, 0.08), gold, 0, 0.12, 0);
    const reelTex = canvasTex(600, 220, () => { }); const rc = reelTex.image.getContext('2d');
    add(sm, new THREE.PlaneGeometry(3.9, 1.43), new THREE.MeshBasicMaterial({ map: reelTex, toneMapped: false }), 0, 1.55, 0.77);
    const lever = new THREE.Group(); lever.position.set(2.55, 1.6, 0); sm.add(lever); add(lever, CYL(0.06, 0.06, 1.6, 10), gold, 0, 0.8, 0); add(lever, SPH(0.2, 14, 10), GLOW(0xd9707a, 1.2), 0, 1.65, 0);
    townFx.casinoReels = { tex: reelTex, ctx: rc, lever, t: 0, spin: 0, res: ['mug', 'mug', 'mug'] };
    // two searchlights sweeping the sky: visible from anywhere in town
    const beamM = new THREE.MeshBasicMaterial({ color: 0xf1dca4, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beams = []; for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 4.6, 6.8, -2.4); g.add(piv); add(piv, CYL(0.35, 0.45, 0.5, 14), gold, 0, 0, 0); const cone = add(piv, new THREE.ConeGeometry(2.6, 30, 24, 1, true), beamM, 0, 15, 0); cone.rotation.x = Math.PI; beams.push(piv); }
    townFx.casinoBeams = beams;
    g.traverse(o => { if (o.userData.place === undefined) o.userData.place = 'casino'; }); pickables.push(g);
    colliders.push({ minx: CX - 5.8, maxx: CX + 5.8, minz: CZ - 3.6, maxz: CZ + 3.6, h: 6.6 });
    for (const s of [-1, 1]) colliders.push({ minx: CX - s * 4.2 - 0.9, maxx: CX - s * 4.2 + 0.9, minz: CZ - 4.9, maxz: CZ - 3.6, h: 1.4 });   // chip stacks
    colliders.push({ minx: CX - 4.8, maxx: CX - 2.7, minz: CZ - 7.8, maxz: CZ - 6.1, h: 0.9 });   // dice
    place('casino', CX, CZ, 6.5, [CX, CZ - 9.2]);
    CASINO_RECT = { minx: CX - 6.2, maxx: CX + 6.2, minz: CZ - 5.5, maxz: CZ + 4 }; }
  /* arcade */
  { const g = new THREE.Group(); g.position.set(40, 0, 58); g.rotation.y = -0.5; scene.add(g);
    add(g, RBOX(9, 6, 7, 0.12), M(0x111114), 0, 3, 0);
    add(g, BOX(9.4, 0.5, 7.4), M(0xe6dccb, { emissive: 0x1b1b1e, emissiveIntensity: 1 }), 0, 6.2, 0);
    const marq = []; for (let i = 0; i < 12; i++) { const b = add(g, SPH(0.14, 8, 6), GLOW(i % 2 ? 0xe6dccb : 0xd8c9a8, 1.4), -4.2 + i * 0.76, 5.4, 3.55); marq.push(b); } townFx.marquee = marq;
    add(g, BOX(2.6, 3.4, 0.2), new THREE.MeshBasicMaterial({ color: 0xd8c9a8, transparent: true, opacity: 0.25 }), 0, 1.7, 3.55);
    for (const s of [-1, 1]) { add(g, RBOX(1.2, 2.2, 0.8, 0.06), M(0x1d1d1f), s * 2.8, 1.1, 3.6); add(g, new THREE.PlaneGeometry(0.9, 0.9), neon(s < 0 ? 'PLAY' : 'WIN', s < 0 ? '#8fd3a6' : '#c8a96a', 200, 200, 60), s * 2.8, 1.5, 4.02); }
    neonSign(g, 'NEON ARCADE', '#ffffff', 8, 1.3, 0, 7.2, 3.6, 0, 110);
    /* ranked board on the side wall that faces the town: the weekly leaders of the skill games */
    { const rt = canvasTex(512, 384, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 384); }); townFx.rankTex = rt;
      add(g, BOX(0.16, 3.4, 4.6), M(0x0c0c0e), -4.55, 3.1, 0);
      const m = add(g, new THREE.PlaneGeometry(4.2, 3.15), new THREE.MeshBasicMaterial({ map: rt }), -4.65, 3.1, 0); m.rotation.y = -Math.PI / 2;
      neonSign(g, 'RANKED RUNS', '#c8a96a', 4.2, 0.8, -4.66, 5.3, 0, -Math.PI / 2, 80); }
    g.traverse(o => o.userData.place = 'arcade'); pickables.push(g); colliders.push({ minx: 35, maxx: 45, minz: 53.5, maxz: 62.5, h: 6.5 });
    place('arcade', 40, 58, 6.5, [36.8, 64]); }
  /* docks + water */
  { const water = add(scene, new THREE.PlaneGeometry(TOWN.x * 2 + 10, 14), new THREE.MeshStandardMaterial({ color: 0x0b1b2e, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4, transparent: true, opacity: 0.94 }), 0, 0.02, TOWN.zf + 7); water.rotation.x = -Math.PI / 2; townFx.water = water;
    const wt = canvasTex(256, 256, (ctx, W, H) => { ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, W, H); ctx.strokeStyle = 'rgba(214,207,194,.14)'; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { ctx.beginPath(); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, i * 26 + Math.sin(x / 18 + i) * 6); ctx.stroke(); } });
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(10, 1.5); const waves = add(scene, new THREE.PlaneGeometry(TOWN.x * 2 + 10, 14), new THREE.MeshBasicMaterial({ map: wt, transparent: true }), 0, 0.03, TOWN.zf + 7); waves.rotation.x = -Math.PI / 2; townFx.waveTex = wt;
    add(scene, BOX(TOWN.x * 2 + 10, 0.6, 0.5), M(0x1d1d1f), 0, 0.3, TOWN.zf + 0.1);
    const pier = add(scene, BOX(5, 0.35, 9), M(0x4a3524), 0, 0.2, TOWN.zf + 4.5); pier.userData.floor = true; pickables.push(pier);
    for (const s of [-1, 1]) for (let z = 1; z < 9; z += 2.5) add(scene, new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), M(0x3a2618), s * 2.4, 0.5, TOWN.zf + z);
    const idx = canvasTex(512, 192, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 192); }); townFx.indexTex = idx;
    const ib = add(scene, BOX(5.4, 2.2, 0.3), M(0x0c0c0e), -5.5, 2.4, TOWN.zf + 1.2); add(scene, new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({ map: idx }), -5.5, 2.4, TOWN.zf + 1.04).rotation.y = Math.PI;
    for (const s of [-1, 1]) add(scene, new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8), M(0x1d1d1f), -5.5 + s * 2.5, 1.2, TOWN.zf + 1.2);
    neonSign(scene, 'HARBOR DOCKS', '#bdb8ad', 7, 1, 8, 3.6, TOWN.zf + 1.1, Math.PI, 90);
    const boat = new THREE.Group(); boat.position.set(12, 0.1, TOWN.zf + 6); scene.add(boat); add(boat, BOX(2.6, 0.6, 1.2), M(0xe6dccb), 0, 0.3, 0); add(boat, BOX(1.2, 0.8, 0.9), M(0xece9e2), -0.3, 0.9, 0); add(boat, new THREE.CylinderGeometry(0.04, 0.04, 2.5), M(0x1d1d1f), 0.6, 1.8, 0); townFx.boat = boat;
    ib.userData.place = 'docks'; pickables.push(ib); colliders.push({ minx: -8.3, maxx: -2.7, minz: TOWN.zf + 0.9, maxz: TOWN.zf + 1.5, h: 3.5 });
    place('docks', -5.5, TOWN.zf + 1.2, 4.5, [-5.5, TOWN.zf - 2]); }
  /* sakura park + wishing pond */
  { const g = new THREE.Group(); g.position.set(-38, 0, 66); scene.add(g);
    for (const [x, z, s] of [[-4, -3, 1], [4, -4, 0.8], [-6, 3, 0.9], [5, 3, 1.1]]) { add(g, new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 3.5 * s, 10), M(0x4a2f22), x, 1.75 * s, z); for (const [dx, dy, dz, r] of [[0, 4.4, 0, 1.8], [1.1, 3.8, 0.4, 1.3], [-1.2, 3.9, -0.3, 1.2]]) add(g, SPH(r * s, 14, 10), M(0xd8c9a8), x + dx * s, dy * s, z + dz * s); }
    add(g, new THREE.CylinderGeometry(3, 3.2, 0.4, 32), M(0x1d1d1f), 0, 0.2, 0); const pw = add(g, new THREE.CylinderGeometry(2.7, 2.7, 0.1, 32), new THREE.MeshBasicMaterial({ color: 0x2a6a9a, transparent: true, opacity: 0.8 }), 0, 0.38, 0); townFx.pond = pw;
    for (let i = 0; i < 6; i++) add(g, SPH(0.08, 6, 5), GLOW(0xc8a96a, 1.2), (Math.random() - .5) * 4, 0.44, (Math.random() - .5) * 4);
    for (const [x, z] of [[-3.5, 0], [3.5, 0], [0, -3.5], [0, 3.5]]) { add(g, new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), M(0x1d1d1f), x, 1.1, z); add(g, RBOX(0.5, 0.7, 0.5, 0.08), GLOW(0xff9a6a, 1.2), x, 2.5, z); }
    for (let i = 0; i < 24; i++) add(g, SPH(0.1, 6, 5), M(0xe8e0d0), (Math.random() - .5) * 12, 0.05, (Math.random() - .5) * 10);
    neonSign(g, 'SAKURA PARK', '#ffffff', 7, 1, 0, 6.5, -6, 0, 90);
    g.traverse(o => { if (o !== g) o.userData.place = 'pond'; }); pickables.push(g); colliders.push({ minx: -41.2, maxx: -34.8, minz: 62.8, maxz: 69.2, h: 1 });
    place('pond', -38, 66, 5, [-38, 70.5]); }
  place('jobs', ROOM.x - 1.5, 9, 3, [ROOM.x - 2.5, 9]);
}

/* ================= character-select stage ================= */
const STAGE = { x: 90, z: 0 };
let stageGroup, podium;
function buildStage() {
  stageGroup = new THREE.Group(); stageGroup.position.set(STAGE.x, 0, STAGE.z); scene.add(stageGroup);
  add(stageGroup, new THREE.CylinderGeometry(9, 9, 0.2, 48), M(0x08081a), 0, -0.1, 0);
  add(stageGroup, new THREE.PlaneGeometry(22, 12), M(0x0b0b0c), 0, 5, -6);
  const grid = canvasTex(512, 512, (ctx, W, H) => { ctx.strokeStyle = 'rgba(189,184,173,.14)'; ctx.lineWidth = 2; for (let i = 0; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(W, i * 32); ctx.stroke(); } });
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping; grid.repeat.set(3, 2);
  add(stageGroup, new THREE.PlaneGeometry(22, 12), new THREE.MeshBasicMaterial({ map: grid, transparent: true }), 0, 5, -5.98);
  neonSign(stageGroup, 'PICK YOUR BODY', '#ffffff', 12, 1.8, 0, 8.3, -5.9, 0, 130);
  podium = new THREE.Group(); stageGroup.add(podium);
  add(podium, new THREE.CylinderGeometry(1.5, 1.7, 0.35, 40), M(0x1d1d1f), 0, 0.17, 0);
  add(podium, new THREE.TorusGeometry(1.55, 0.05, 8, 48), GLOW(0xd8c9a8, 0.8), 0, 0.36, 0).rotation.x = Math.PI / 2;
  add(podium, new THREE.TorusGeometry(2.6, 0.03, 8, 60), GLOW(0xe6dccb, 0.7), 0, 0.02, 0).rotation.x = Math.PI / 2;
  const spot = new THREE.SpotLight(0xfff0e0, 22, 20, 0.5, 0.5, 1.2); spot.position.set(0, 9, 4); spot.target = podium; stageGroup.add(spot); stageGroup.add(spot.target);
  const rim1 = new THREE.PointLight(0xe6dccb, 9, 16, 1.5); rim1.position.set(-5, 3, -2); stageGroup.add(rim1);
  const rim2 = new THREE.PointLight(0xd8c9a8, 9, 16, 1.5); rim2.position.set(5, 3, -2); stageGroup.add(rim2);
  for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; add(stageGroup, new THREE.CylinderGeometry(0.05, 0.05, 6, 8), M(0x1d1d1f), s * 4.5, 3, -3); add(stageGroup, new THREE.ConeGeometry(0.5, 0.8, 16, 1, true), M(0x0c0c0e, { side: THREE.DoubleSide }), s * 4.5, 6.2, -3).rotation.x = -0.6; }
}
