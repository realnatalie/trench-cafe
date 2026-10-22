
/* ================= extra detail: inside the cafe + the town ================= */
function buildExtras() {
  /* ---- inside: ceiling neon tubes + cables ---- */
  const tubeG = [], tubeM = GLOW(0xe6dccb, 1.1), tube2 = GLOW(0xd8c9a8, 1.0);
  const pushT = (list, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); };
  const tA = [], tB = [];
  for (let i = -3; i <= 3; i++) pushT(i % 2 ? tA : tB, 0.08, 0.08, ROOM.zf - ROOM.zb - 4, i * 6, 9.6, (ROOM.zf + ROOM.zb) / 2);
  for (let z = -14; z <= 14; z += 7) pushT(tA, ROOM.x * 2 - 4, 0.08, 0.08, 0, 9.5, z);
  scene.add(new THREE.Mesh(mergeGeometries(tA), tubeM)); scene.add(new THREE.Mesh(mergeGeometries(tB), tube2));
  /* ---- plants ---- */
  const potM = M(0x242426), leafM = M(0x3fbf7a, { roughness: 0.9 }), leafD = M(0x2f9a5e, { roughness: 0.9 });
  for (const [x, z, s] of [[-21.5, 15.5, 1.1], [21.5, 15.5, 1.0], [-21.5, -16.5, 1.2], [21.5, 2, 0.9], [-21.5, 1, 0.9]]) {
    add(scene, new THREE.CylinderGeometry(0.4 * s, 0.3 * s, 0.7 * s, 12), potM, x, 0.35 * s, z);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const l = add(scene, new THREE.ConeGeometry(0.16 * s, 1.3 * s, 6), i % 2 ? leafM : leafD, x + Math.sin(a) * 0.25 * s, 1.1 * s, z + Math.cos(a) * 0.25 * s); l.rotation.x = Math.cos(a) * 0.55; l.rotation.z = -Math.sin(a) * 0.55; }
  }
  /* ---- the big screen: every launch goes up here, trades scroll in real time ---- */
  { const bt = canvasTex(1024, 460, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 1024, 460); }); townFx.bigTex = bt;
    add(scene, RBOX(12.6, 6.0, 0.3, 0.08), M(0x0b0b0c, { roughness: 0.4 }), 0, 3.9, ROOM.zb + 0.2);
    const scr = add(scene, new THREE.PlaneGeometry(12, 5.4), new THREE.MeshBasicMaterial({ map: bt, toneMapped: false }), 0, 3.9, ROOM.zb + 0.37); scr.userData.place = 'bigscreen'; pickables.push(scr);
    add(scene, BOX(12.6, 0.06, 0.06), GLOW(0xd8c9a8, 1.2), 0, 0.86, ROOM.zb + 0.36); add(scene, BOX(12.6, 0.06, 0.06), GLOW(0xd8c9a8, 1.2), 0, 6.94, ROOM.zb + 0.36);
    const sl = new THREE.PointLight(0xd8c9a8, 18, 16, 1.5); sl.position.set(0, 4, ROOM.zb + 3); scene.add(sl); townFx.bigLight = sl;
    for (const s of [-1, 1]) add(scene, new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), M(0x1d1d1f), s * 5, 7.4, ROOM.zb + 0.5); }
  /* ---- leaderboard screen on the left wall ---- */
  { const lt = canvasTex(512, 384, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 384); }); townFx.leaderTex = lt;
    add(scene, BOX(0.16, 3.2, 4.2), M(0x0c0c0e), -ROOM.x + 0.1, 4.2, 4);
    const m = add(scene, new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ map: lt }), -ROOM.x + 0.2, 4.2, 4); m.rotation.y = Math.PI / 2;
    neonSign(scene, 'TOP COINS', '#c8a96a', 4, 0.8, -ROOM.x + 0.2, 6.2, 4, Math.PI / 2, 80); }
  /* ---- game machines along the right wall: walk up and press E. Six ranked skill games, then the three casino games ---- */
  const MACHINES = [['rug', 'RUG RADAR', '#d9707a'], ['pnl', 'DEGEN MATH', '#8fd3a6'], ['addr', 'ADDRESS LOCK', '#bdb8ad'], ['chart', 'CHART EYE', '#8fd3a6'], ['type', 'TICKER SPRINT', '#ffffff'], ['quant', 'QUANT SPRINT', '#c8a96a'], ['slots', 'SLOTS', '#c8a96a'], ['crash', 'RUG CRASH', '#8fd3a6'], ['flip', 'PUMP OR DUMP', '#ffffff']];
  MACHINES.forEach(([id, txt, col], i) => {
    const z = -4.3 + i * 1.5, casino = i >= 6, g = new THREE.Group(); g.position.set(21.7, 0, z); scene.add(g);
    add(g, RBOX(1.3, 1.9, 1.3, 0.05), M(casino ? 0x1a1214 : 0x111114), 0, 0.95, 0); add(g, BOX(1.3, 0.5, 1.4), M(0x1d1d1f), 0, 2.1, 0);
    const f = add(g, new THREE.PlaneGeometry(1.0, 0.8), neon(txt, col, 300, 240, 54), -0.66, 1.3, 0); f.rotation.y = -Math.PI / 2;
    const tag = add(g, new THREE.PlaneGeometry(1.0, 0.36), neon(casino ? 'CASINO' : 'RANKED', casino ? '#d9707a' : '#c8a96a', 300, 108, 58), -0.66, 2.1, 0); tag.rotation.y = -Math.PI / 2;
    add(g, BOX(0.3, 0.08, 0.9), M(0x1d1d1f), -0.75, 0.95, 0); for (let k = 0; k < 3; k++) add(g, SPH(0.05, 8, 6), GLOW([0xe6dccb, 0xd8c9a8, 0xc8a96a][k], 1), -0.85, 1.0, -0.3 + k * 0.3);
    g.traverse(o => o.userData.place = 'cab_' + id); pickables.push(g);
    place('cab_' + id, 21.7, z, 0.9, [20.1, z]);
  });
  colliders.push({ minx: 20.9, maxx: 23, minz: -5.1, maxz: 8.5, h: 2.2 });
  neonSign(scene, 'GAMES', '#ffffff', 3.6, 1, 22.6, 6.1, 2.1, -Math.PI / 2, 130);
  add(scene, new THREE.PlaneGeometry(13.8, 0.3), new THREE.MeshBasicMaterial({ color: 0xc8a96a, transparent: true, opacity: 0.25 }), 22.6, 5.4, 2.1).rotation.y = -Math.PI / 2;
  /* ---- speakers + DJ corner (back right) ---- */
  { const g = new THREE.Group(); g.position.set(19.5, 0, -16.2); scene.add(g); const sm = M(0x0c0c0e), cone = M(0x1d1d1f, { roughness: 0.4 });
    townFx.speakers = [];
    for (let i = 0; i < 2; i++) { add(g, RBOX(1.3, 1.2, 1.0, 0.05), sm, 0, 0.6 + i * 1.25, 0); const c = add(g, new THREE.CylinderGeometry(0.4, 0.4, 0.1, 20), cone, 0, 0.6 + i * 1.25, 0.5); c.rotation.x = Math.PI / 2; townFx.speakers.push(c); add(g, new THREE.TorusGeometry(0.42, 0.03, 8, 24), GLOW(0xd8c9a8, 1), 0, 0.6 + i * 1.25, 0.52); }
    add(g, RBOX(2.6, 0.9, 1.0, 0.05), M(0x1d1d1f), 2.4, 0.45, 0.2); for (let i = 0; i < 2; i++) add(g, new THREE.CylinderGeometry(0.35, 0.35, 0.04, 24), M(0x0b0b0c), 1.7 + i * 1.4, 0.93, 0.2);
    neonSign(g, 'DJ DEGEN', '#c8a96a', 3, 0.7, 2.4, 2.2, -0.2, 0, 70); colliders.push({ minx: 18.6, maxx: 23, minz: -18, maxz: -15.4, h: 2.6 }); }
  /* ---- floor arrows to the door ---- */
  for (let i = 0; i < 4; i++) add(scene, new THREE.ConeGeometry(0.35, 0.7, 3), GLOW(0x9ed9b2, 0.5), 0, 0.03, 8 + i * 2.2).rotation.set(-Math.PI / 2, 0, Math.PI);

  /* ---- outside: welcome mat with the player's name ---- */
  { const matT = canvasTex(512, 256, (ctx, W, H) => { ctx.fillStyle = '#2a2150'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(14, 14, W - 28, H - 28); ctx.fillStyle = '#ffffff'; ctx.font = "700 50px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText('WELCOME', W / 2, 108); ctx.fillStyle = '#bdb8ad'; { const nm = (townFx.welcomeName || 'FRIEND').slice(0, 16).toUpperCase(), fs = fitText(ctx, nm, '700 {s}px Unbounded, sans-serif', 44, W - 70); ctx.font = `700 ${fs}px Unbounded, sans-serif`; ctx.fillText(nm, W / 2, 190); } });
    redrawOnFonts.push(matT); townFx.matTex = matT;
    add(scene, new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: matT }), 0, 0.012, ROOM.zf + 4.4).rotation.x = -Math.PI / 2; }
  /* ---- string lights between lamp posts ---- */
  { const bulbs = []; const pushS = (x1, z1, x2, z2, y = 5.6) => { for (let i = 0; i <= 14; i++) { const u = i / 14; const g = new THREE.SphereGeometry(0.1, 6, 5); g.translate(lerp(x1, x2, u), y - Math.sin(u * Math.PI) * 1.1, lerp(z1, z2, u)); bulbs.push(g); } };
    pushS(-10, 24, 10, 24); pushS(-10, 24, -22, 47); pushS(10, 24, 18, 44); pushS(-22, 47, -6, 66); pushS(18, 44, 6, 66); pushS(-6, 66, 6, 66);
    scene.add(new THREE.Mesh(mergeGeometries(bulbs), GLOW(0xffe0a0, 1.6)));
    const wire = []; const pushW = (x1, z1, x2, z2, y = 5.6) => { for (let i = 0; i < 14; i++) { const u = i / 14, v = (i + 1) / 14; const a = new THREE.Vector3(lerp(x1, x2, u), y - Math.sin(u * Math.PI) * 1.1, lerp(z1, z2, u)), b = new THREE.Vector3(lerp(x1, x2, v), y - Math.sin(v * Math.PI) * 1.1, lerp(z1, z2, v)); const g = new THREE.CylinderGeometry(0.015, 0.015, a.distanceTo(b), 4); g.translate(0, a.distanceTo(b) / 2, 0); const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m); q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)); g.applyQuaternion(q); g.translate(a.x, a.y, a.z); wire.push(g); } };
    pushW(-10, 24, 10, 24); pushW(-10, 24, -22, 47); pushW(10, 24, 18, 44); pushW(-22, 47, -6, 66); pushW(18, 44, 6, 66); pushW(-6, 66, 6, 66);
    scene.add(new THREE.Mesh(mergeGeometries(wire), M(0x111111))); }
  /* ---- ferris wheel ---- */
  { const g = new THREE.Group(); g.position.set(-38, 0, 26); scene.add(g); const fm = M(0x1d1d1f), gl = GLOW(0xe6dccb, 1.2);
    for (const s of [-1, 1]) { const leg = add(g, new THREE.CylinderGeometry(0.18, 0.22, 11, 10), fm, s * 1.2, 5.2, 2.6); leg.rotation.x = -0.24; const leg2 = add(g, new THREE.CylinderGeometry(0.18, 0.22, 11, 10), fm, s * 1.2, 5.2, -2.6); leg2.rotation.x = 0.24; }
    add(g, new THREE.CylinderGeometry(0.4, 0.4, 3.2, 14), METAL(0x8d939e), 0, 10, 0).rotation.x = Math.PI / 2;
    const wheel = new THREE.Group(); wheel.position.y = 10; g.add(wheel); townFx.wheel = wheel;
    for (const z of [-1, 1]) { add(wheel, new THREE.TorusGeometry(7, 0.12, 8, 48), fm, 0, 0, z * 0.9); add(wheel, new THREE.TorusGeometry(7, 0.05, 6, 48), gl, 0, 0, z * 1.0); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; for (const z of [-0.9, 0.9]) { const sp = add(wheel, new THREE.CylinderGeometry(0.05, 0.05, 7, 6), fm, Math.sin(a) * 3.5, Math.cos(a) * 3.5, z); sp.rotation.z = -a; }
      const cab = new THREE.Group(); cab.position.set(Math.sin(a) * 7, Math.cos(a) * 7, 0); wheel.add(cab); cab.userData.a = a; add(cab, RBOX(1.3, 1.1, 1.2, 0.2), M([0xe6dccb, 0xd8c9a8, 0xc8a96a, 0x9ed9b2][i % 4], { roughness: 0.5 }), 0, -0.7, 0); add(cab, BOX(0.9, 0.5, 1.25), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }), 0, -0.55, 0); add(cab, SPH(0.1, 6, 5), GLOW(0xffe0a0, 1.4), 0, -1.3, 0.5); townFx.cabs = townFx.cabs || []; townFx.cabs.push(cab); }
    neonSign(g, 'MOON WHEEL', '#ffffff', 7, 1.1, 0, 18.6, 0, 0, 90); neonSign(g, 'MOON WHEEL', '#ffffff', 7, 1.1, 0, 18.6, 0, Math.PI, 90);
    add(g, new THREE.CylinderGeometry(3.5, 3.8, 0.4, 24), fm, 0, 0.2, 0); add(g, RBOX(2.4, 1.2, 1.2, 0.05), M(0x111114), 3.6, 0.6, 3); neonSign(g, 'TICKETS', '#c8a96a', 2.4, 0.6, 3.6, 1.6, 3.6, 0, 60);
    colliders.push({ minx: -42, maxx: -34, minz: 22.5, maxz: 29.5, h: 3 }); }
  /* ---- monorail ---- */
  { const tm = M(0x1d1d1f), rail = GLOW(0xd8c9a8, 0.5); const Y = 8.2, Z = 28;
    add(scene, BOX(104, 0.5, 1.6), tm, 0, Y, Z); add(scene, BOX(104, 0.08, 0.1), rail, 0, Y + 0.3, Z - 0.5); add(scene, BOX(104, 0.08, 0.1), rail, 0, Y + 0.3, Z + 0.5);
    for (let x = -48; x <= 48; x += 12) { if (Math.abs(x) < 3) continue; add(scene, new THREE.CylinderGeometry(0.3, 0.45, Y, 10), tm, x, Y / 2, Z); add(scene, BOX(2.4, 0.3, 2), tm, x, Y - 0.4, Z); colliders.push({ minx: x - 0.5, maxx: x + 0.5, minz: Z - 0.5, maxz: Z + 0.5, h: 3 }); }
    const train = new THREE.Group(); train.position.set(-40, Y + 0.3, Z); scene.add(train); townFx.train = train;
    for (let i = 0; i < 3; i++) { const car = new THREE.Group(); car.position.x = i * 4.6; train.add(car); add(car, RBOX(4.2, 1.5, 1.7, 0.25), M(i === 1 ? 0xece9e2 : 0xe6dccb, { roughness: 0.4 }), 0, 0.75, 0); add(car, BOX(3.6, 0.5, 1.75), new THREE.MeshBasicMaterial({ color: 0xd6cfc2, transparent: true, opacity: 0.45 }), 0, 0.95, 0); add(car, BOX(4.2, 0.08, 1.8), GLOW(0xd8c9a8, 1), 0, 1.52, 0); if (i === 0) add(car, SPH(0.2), GLOW(0xffe0a0, 2), -2.1, 0.7, 0); if (i === 2) add(car, SPH(0.2), GLOW(0xd9707a, 2), 2.1, 0.7, 0); }
    add(scene, BOX(6, 0.3, 3.2), tm, 0, Y - 0.2, Z + 2.4); for (const s of [-1, 1]) add(scene, new THREE.CylinderGeometry(0.25, 0.3, Y - 0.3, 8), tm, s * 2.6, Y / 2, Z + 3.6); neonSign(scene, 'SKY LINE', '#bdb8ad', 4, 0.8, 0, Y + 1.0, Z + 4.0, 0, 70);
    colliders.push({ minx: -3, maxx: 3, minz: Z + 3.2, maxz: Z + 4, h: 3 }); }
  /* ---- HODL GYM (east side, below the nest): a glass box with a bench press, dumbbells and a punching bag; "we lift bags" ---- */
  { const g = new THREE.Group(); g.position.set(44, 0, 26); g.rotation.y = -Math.PI / 2; scene.add(g);
    add(g, RBOX(9, 4.6, 6, 0.1), M(0x111113), 0, 2.3, 0);
    add(g, BOX(8.6, 3.4, 0.1), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.16, roughness: 0.05, clearcoat: 1, depthWrite: false }), 0, 2.1, 3.02);
    add(g, BOX(9.4, 0.3, 6.4), M(0x1b1712), 0, 4.75, 0);
    neonSign(g, 'HODL GYM', '#d9707a', 6.5, 1.1, 0, 5.6, 3.1, 0, 110);
    add(g, new THREE.PlaneGeometry(4.4, 0.5), neon('WE LIFT BAGS', '#bdb8ad', 440, 50, 34), 0, 0.5, 3.06);
    const steel = METAL(0x9aa3b2, { roughness: 0.35 }), rub = M(0x1a1a1c, { roughness: 0.9 });
    // bench press
    add(g, RBOX(1.6, 0.14, 0.5, 0.04), M(0xa8122c, { roughness: 0.7 }), -2.4, 0.55, 0.6); for (const s of [-1, 1]) add(g, BOX(0.08, 0.5, 0.08), steel, -2.4 + s * 0.6, 0.25, 0.6);
    for (const s of [-1, 1]) add(g, BOX(0.08, 1.2, 0.08), steel, -2.4 + s * 0.9, 0.6, 0.1); add(g, CYL(0.025, 0.025, 2.4, 10), steel, -2.4, 1.22, 0.1).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) add(g, CYL(0.22 - i * 0.05, 0.22 - i * 0.05, 0.06, 20), rub, -2.4 + s * (1.0 + i * 0.08), 1.22, 0.1).rotation.z = Math.PI / 2;
    // dumbbell rack
    add(g, RBOX(2.4, 0.08, 0.5, 0.02), steel, 1.8, 0.5, -2.2); for (let i = 0; i < 5; i++) { const x = 0.8 + i * 0.5; add(g, CYL(0.02, 0.02, 0.36, 8), steel, x, 0.62, -2.2).rotation.z = Math.PI / 2; for (const s of [-1, 1]) add(g, CYL(0.07 + i * 0.015, 0.07 + i * 0.015, 0.06, 14), rub, x + s * 0.15, 0.62, -2.2).rotation.z = Math.PI / 2; }
    // punching bag
    add(g, CYL(0.02, 0.02, 1.2, 8), steel, 2.6, 3.9, 1.4); const bag = add(g, CYL(0.3, 0.32, 1.3, 16), M(0xa8122c, { roughness: 0.75 }), 2.6, 2.6, 1.4); bag.userData.swing = 1; townFx.gymBag = bag;
    add(bag, new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: labelTex('JEETS', '#ffffff', null, 256, 150, 72), transparent: true }), 0, 0, 0.33);
    // a mirror wall
    add(g, BOX(8.6, 3, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 1.2 }), 0, 2.2, -2.95);
    g.traverse(o => o.userData.place = 'gym'); pickables.push(g); colliders.push({ minx: 41, maxx: 47.2, minz: 21.4, maxz: 30.6, h: 4.8 });
    place('gym', 44, 26, 5.5, [40.4, 26]); }
  /* ---- SUSHI BAR "WAGMI" (west side, by the market): counter, stools, a conveyor belt with plates ---- */
  { const g = new THREE.Group(); g.position.set(-44, 0, 26); g.rotation.y = Math.PI / 2; scene.add(g);
    add(g, RBOX(9, 4.2, 6, 0.1), M(0x14110f), 0, 2.1, 0);
    add(g, BOX(9.4, 0.3, 6.6), M(0x3a2a1a), 0, 4.35, 0);
    for (let i = 0; i < 6; i++) { const lan = add(g, CYL(0.12, 0.12, 0.3, 12), GLOW(0xff6a2a, 1.4), -3.2 + i * 1.28, 4.0, 3.2); lan.userData.lantern = i; }
    neonSign(g, 'WAGMI SUSHI', '#ff6a2a', 7, 1.1, 0, 5.2, 3.1, 0, 110);
    add(g, BOX(8.6, 3, 0.1), new THREE.MeshPhysicalMaterial({ color: 0xffd6b0, transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false }), 0, 1.9, 3.02);
    // counter + belt
    add(g, RBOX(7.6, 0.9, 0.9, 0.04), M(0x2a1c14, { roughness: 0.6 }), 0, 0.45, 0.6); add(g, BOX(7.6, 0.04, 0.5), M(0x1a1a1c), 0, 0.92, 0.3);
    const belt = new THREE.Group(); g.add(belt); townFx.sushiBelt = belt;
    const plateCols = [0xd9707a, 0x8fd3a6, 0xffd36e, 0xf2efe8, 0xc8a96a];
    for (let i = 0; i < 9; i++) { const p = new THREE.Group(); p.position.set(-3.6 + i * 0.9, 0.95, 0.3); belt.add(p); add(p, CYL(0.17, 0.17, 0.02, 16), M(plateCols[i % 5]), 0, 0, 0); add(p, RBOX(0.14, 0.08, 0.1, 0.03), M(0xf2efe8), 0, 0.05, 0); add(p, RBOX(0.14, 0.03, 0.1, 0.01), M(i % 2 ? 0xff6a2a : 0xd9707a), 0, 0.1, 0); p.userData.i = i; }
    for (let i = 0; i < 5; i++) { add(g, CYL(0.22, 0.22, 0.06, 14), M(0xa8122c, { roughness: 0.7 }), -3 + i * 1.5, 0.6, 1.6); add(g, CYL(0.04, 0.04, 0.55, 8), METAL(0x9aa3b2), -3 + i * 1.5, 0.3, 1.6); }
    // menu board
    const menu = canvasTex(512, 300, (ctx, W, H) => { ctx.fillStyle = '#1a120c'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ff6a2a'; ctx.font = '700 40px Unbounded, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OMAKASE', W / 2, 54); ctx.font = "600 24px 'JetBrains Mono', monospace"; ctx.fillStyle = '#ece9e2'; ctx.textAlign = 'left'; [['green candle roll', '0.1'], ['rug tartare', '0.05'], ['bonded nigiri', '0.4'], ['jeet soup (cold)', '0.01'], ['diamond paws set', '1.0']].forEach(([n, p], i) => { ctx.fillText(n, 30, 110 + i * 36); ctx.textAlign = 'right'; ctx.fillText(p + ' SOL', W - 30, 110 + i * 36); ctx.textAlign = 'left'; }); });
    redrawOnFonts.push(menu); add(g, new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ map: menu, toneMapped: false }), -2.4, 2.6, -2.9);
    g.traverse(o => o.userData.place = 'sushi'); pickables.push(g); colliders.push({ minx: -47.2, maxx: -41, minz: 21.4, maxz: 30.6, h: 4.4 });
    place('sushi', -44, 26, 5.5, [-40.4, 26]); }
  /* ---- drones ---- */
  { townFx.drones = []; for (let i = 0; i < 4; i++) { const d = new THREE.Group(); scene.add(d); add(d, RBOX(0.5, 0.15, 0.5, 0.05), M(0x1d1d1f), 0, 0, 0); for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { add(d, new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), M(0x111111), x, 0.08, z); add(d, new THREE.CylinderGeometry(0.22, 0.22, 0.01, 10), new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.35 }), x, 0.14, z); } add(d, SPH(0.06, 6, 5), GLOW(i % 2 ? 0xd9707a : 0x9ed9b2, 2), 0, -0.08, 0.2); d.userData = { cx: [-10, 14, -30, 30][i], cz: [40, 52, 50, 40][i], r: 6 + i * 2, h: 7 + i * 1.5, ph: i * 1.7 }; townFx.drones.push(d); } }
  /* ---- food truck ---- */
  { const g = new THREE.Group(); g.position.set(22, 0, 27); g.rotation.y = -0.25; scene.add(g);
    add(g, RBOX(5.4, 2.4, 2.4, 0.15), M(0xc8a96a, { roughness: 0.5 }), 0, 1.6, 0); add(g, RBOX(1.8, 1.6, 2.2, 0.15), M(0xece9e2, { roughness: 0.5 }), 3.4, 1.2, 0); add(g, BOX(1.2, 0.7, 2.25), new THREE.MeshBasicMaterial({ color: 0xd6cfc2, transparent: true, opacity: 0.5 }), 3.6, 1.6, 0);
    for (const [x, z] of [[-1.6, 1.1], [1.6, 1.1], [-1.6, -1.1], [1.6, -1.1], [3.4, 1.1], [3.4, -1.1]]) add(g, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), M(0x111111, { roughness: 0.8 }), x, 0.42, z).rotation.x = Math.PI / 2;
    add(g, BOX(3.6, 1.0, 0.1), new THREE.MeshBasicMaterial({ color: 0x111114 }), -0.2, 1.9, 1.22); const flap = add(g, BOX(3.8, 1.3, 0.08), M(0xe6dccb), -0.2, 2.8, 1.8); flap.rotation.x = -1.2; add(g, BOX(3.6, 0.1, 0.9), M(0x1d1d1f), -0.2, 1.3, 1.6);
    neonSign(g, 'TACO MOON', '#ffffff', 4.5, 0.9, -0.2, 3.3, 1.26, 0, 80); add(g, SPH(0.5, 12, 10), M(0xffe0a0, { emissive: 0x6a3a00, emissiveIntensity: 0.6 }), -2.2, 3.1, 0);
    const pl = new THREE.PointLight(0xffb070, 14, 10, 1.4); pl.position.set(0, 2.2, 2.4); g.add(pl); colliders.push({ minx: 17.8, maxx: 26.6, minz: 25.2, maxz: 29, h: 3 });
    const menu = canvasTex(256, 200, (ctx, W, H) => { ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#c8a96a'; ctx.font = "700 22px 'JetBrains Mono', monospace"; ['taco  0.01', 'burrito 0.02', 'nachos 0.015', 'moon juice 0.05'].forEach((s, i) => ctx.fillText(s, 16, 40 + i * 40)); }); redrawOnFonts.push(menu);
    add(g, new THREE.PlaneGeometry(1.6, 1.25), new THREE.MeshBasicMaterial({ map: menu }), -1.6, 1.9, 1.27); }
  /* ---- parked cars ---- */
  const car = (x, z, ry, col) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); add(g, RBOX(4.2, 0.9, 2.0, 0.2), M(col, { roughness: 0.35, metalness: 0.3 }), 0, 0.75, 0); add(g, RBOX(2.4, 0.8, 1.8, 0.25), M(col, { roughness: 0.35, metalness: 0.3 }), -0.2, 1.5, 0); add(g, BOX(2.2, 0.5, 1.85), new THREE.MeshBasicMaterial({ color: 0xd6cfc2, transparent: true, opacity: 0.5 }), -0.2, 1.55, 0); for (const [wx, wz] of [[-1.4, 1.0], [1.4, 1.0], [-1.4, -1.0], [1.4, -1.0]]) add(g, new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), M(0x111111, { roughness: 0.8 }), wx, 0.4, wz).rotation.x = Math.PI / 2; for (const s of [-1, 1]) { add(g, SPH(0.12, 8, 6), GLOW(0xffe0a0, 1.5), 2.1, 0.8, s * 0.7); add(g, SPH(0.1, 8, 6), GLOW(0xd9707a, 1.5), -2.1, 0.8, s * 0.7); } const ca = Math.abs(Math.cos(ry)), sa = Math.abs(Math.sin(ry)); const hx = 2.2 * ca + 1.1 * sa, hz = 2.2 * sa + 1.1 * ca; colliders.push({ minx: x - hx, maxx: x + hx, minz: z - hz, maxz: z + hz, h: 1.9 }); };
  car(-21, 21.5, 0, 0xa66bff); car(17, 21.5, 0.1, 0xd8c9a8); car(-44, 50, Math.PI / 2, 0xe6dccb); car(44, 30, Math.PI / 2 + 0.2, 0xc8a96a);
  /* ---- trees + bushes (merged) ---- */
  { const trunks = [], crowns = [], bush = []; const rnd = seeded(23);
    const tree = (x, z, s = 1) => { const t = new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 3 * s, 8); t.translate(x, 1.5 * s, z); trunks.push(t); for (const [dx, dy, dz, r] of [[0, 3.6, 0, 1.5], [0.9, 3.1, 0.4, 1.1], [-0.9, 3.2, -0.3, 1.0], [0.2, 4.4, -0.2, 1.0]]) { const c = new THREE.SphereGeometry(r * s, 10, 8); c.translate(x + dx * s, dy * s, z + dz * s); crowns.push(c); } colliders.push({ minx: x - 0.4, maxx: x + 0.4, minz: z - 0.4, maxz: z + 0.4, h: 2 }); };
    for (let z = 22; z <= 70; z += 8) { tree(-45 + rnd() * 1.5, z + rnd() * 2, 0.9 + rnd() * 0.4); tree(45 - rnd() * 1.5, z + 3 + rnd() * 2, 0.9 + rnd() * 0.4); }
    for (const [x, z] of [[-14, 56], [-30, 44], [22, 40], [34, 66], [-20, 70], [6, 56]]) tree(x, z, 0.8 + rnd() * 0.5);
    for (const [x, z] of [[-17.5, 25.6], [14, 22], [-28, 36], [20, 56], [-16, 64], [30, 24], [-34, 60], [36, 50], [8, 70], [-8, 70]]) for (let i = 0; i < 3; i++) { const b = new THREE.SphereGeometry(0.5 + rnd() * 0.35, 8, 6); b.translate(x + (rnd() - 0.5) * 1.6, 0.35, z + (rnd() - 0.5) * 1.6); bush.push(b); }
    scene.add(new THREE.Mesh(mergeGeometries(trunks), M(0x4a2f22))); scene.add(new THREE.Mesh(mergeGeometries(crowns), M(0x3a8f5e, { roughness: 0.95 }))); scene.add(new THREE.Mesh(mergeGeometries(bush), M(0x2f7a4e, { roughness: 1 }))); }
  /* ---- benches, bins, cones ---- */
  for (const [x, z, ry] of [[-6.5, 42.5, 0.6], [6.5, 42.5, -0.6], [-12, 30, Math.PI / 2], [12, 36, -Math.PI / 2], [-30, 66, 0]]) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); add(g, BOX(2.2, 0.08, 0.6), M(0x6b4a2e), 0, 0.5, 0); add(g, BOX(2.2, 0.5, 0.08), M(0x6b4a2e), 0, 0.85, -0.3).rotation.x = -0.15; for (const s of [-1, 1]) add(g, BOX(0.08, 0.5, 0.6), M(0x1d1d1f), s * 1.0, 0.25, 0); colliders.push({ minx: x - 1.1, maxx: x + 1.1, minz: z - 0.5, maxz: z + 0.5, h: 1 }); }
  for (const [x, z] of [[-9, 42], [9, 42], [16, 25], [-24, 30], [36, 62]]) { add(scene, new THREE.CylinderGeometry(0.35, 0.3, 0.9, 12), M(0x1d1d1f), x, 0.45, z); add(scene, new THREE.TorusGeometry(0.33, 0.04, 6, 16), M(0xd8c9a8, { emissive: 0x18181b, emissiveIntensity: 1 }), x, 0.9, z).rotation.x = Math.PI / 2; }
  for (let i = 0; i < 4; i++) { const x = 8 + i * 1.6, z = 66.5; add(scene, new THREE.ConeGeometry(0.28, 0.8, 10), M(0xff6a2a), x, 0.4, z); add(scene, new THREE.TorusGeometry(0.2, 0.03, 6, 12), M(0xffffff), x, 0.45, z).rotation.x = Math.PI / 2; }
  /* ---- giant balloon agent over the square ---- */
  { const g = new THREE.Group(); g.position.set(22, 13, 68); scene.add(g); townFx.balloon = g;
    add(g, SPH(2.6, 24, 18), M(0x8ff2c8, { roughness: 0.35 }), 0, 0, 0).scale.set(1, 1.1, 1);
    for (const s of [-1, 1]) { add(g, SPH(0.4, 12, 10), M(0xffffff, { roughness: 0.3 }), s * 0.9, 0.3, 2.3).scale.set(1, 1.3, 0.5); add(g, SPH(0.22, 10, 8), M(0x16121f), s * 0.9, 0.3, 2.62); }
    add(g, new THREE.TorusGeometry(0.55, 0.1, 8, 20, Math.PI), M(0x6a2a5a), 0, -0.6, 2.4).rotation.z = Math.PI;
    for (const s of [-1, 1]) add(g, SPH(0.45, 10, 8), M(0xff8fb8, { roughness: 1 }), s * 1.6, -0.4, 2.0).scale.set(1, 0.6, 0.3);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 13), M(0x333333), 0, -6.5, 0); add(scene, new THREE.CylinderGeometry(0.5, 0.6, 0.5, 12), M(0x1d1d1f), 22, 0.25, 68); colliders.push({ minx: 21.4, maxx: 22.6, minz: 67.4, maxz: 68.6, h: 1 }); }
  /* ---- shop fronts along the left edge ---- */
  { const sb = []; const fronts = [['GPU SHOP', '#bdb8ad'], ['MEME MART', '#ffffff'], ['BAG STORE', '#c8a96a'], ['SOL PAWN', '#8fd3a6']]; const rnd = seeded(5);
    fronts.forEach(([txt, col], i) => { const z = 32 + i * 9, x = -46.5; const h = 5 + rnd() * 2; const g = new THREE.BoxGeometry(5, h, 7.5); g.translate(x, h / 2, z); sb.push(g); add(scene, new THREE.PlaneGeometry(5.5, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.5), transparent: true, opacity: 0.6 }), x + 2.52, 1.6, z).rotation.y = Math.PI / 2; add(scene, BOX(0.1, 2.4, 5.8), M(0x1d1d1f), x + 2.5, 1.6, z); neonSign(scene, txt, col, 5.5, 0.9, x + 2.56, 3.7, z, Math.PI / 2, 80); add(scene, BOX(0.2, 0.2, 6.2), GLOW(col, 0.8), x + 2.56, 4.4, z); colliders.push({ minx: x - 2.5, maxx: x + 2.5, minz: z - 3.75, maxz: z + 3.75, h: h }); });
    scene.add(new THREE.Mesh(mergeGeometries(sb), M(0x0c0d24))); }
  /* ---- the emblem in the world: a spinning roof sign + the podium floor ---- */
  { const img = new Image(); const mat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, side: THREE.DoubleSide }); const mat2 = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, opacity: 0.9 });
    img.onload = () => { const tx = new THREE.Texture(img); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; tx.needsUpdate = true; mat.map = tx; mat.needsUpdate = true; mat2.map = tx; mat2.needsUpdate = true; };
    img.src = EMBLEM_URI({ fg: '#ffffff', acc: '#ece9e2' });
    const g = new THREE.Group(); g.position.set(0, 13.2, ROOM.zf - 3); scene.add(g); townFx.roofSign = g;
    add(scene, new THREE.CylinderGeometry(0.12, 0.16, 2.6, 10), M(0x1d1d1f), 0, 11.6, ROOM.zf - 3);
    add(g, new THREE.CylinderGeometry(2.4, 2.4, 0.16, 56), M(0x05030c, { roughness: 0.4 }), 0, 0, 0).rotation.x = Math.PI / 2;
    add(g, new THREE.TorusGeometry(2.4, 0.07, 10, 64), GLOW(0xd8c9a8, 1.3), 0, 0, 0);
    for (const s of [-1, 1]) { const p = add(g, new THREE.PlaneGeometry(4.2, 4.2), mat, 0, 0, s * 0.1); if (s < 0) p.rotation.y = Math.PI; }
    const sl = new THREE.PointLight(0xd8c9a8, 30, 18, 1.4); sl.position.set(0, 14.5, ROOM.zf - 1); scene.add(sl);
    const decal = add(scene, new THREE.PlaneGeometry(2.6, 2.6), mat2, STAGE.x, 0.36, STAGE.z); decal.rotation.x = -Math.PI / 2; decal.castShadow = false; }
  /* ---- sky blobs: the same soft light pools as the website, far behind the skyline ---- */
  { const soft = canvasTex(256, 256, (ctx, W, H) => { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
    for (const [x, y, z, sz, c, o] of [[-120, 40, 60, 220, 0x2a2a30, 0.5], [140, 50, 110, 260, 0x3050ff, 0.45], [20, 80, 200, 280, 0x6a2bd9, 0.4], [-50, 30, -150, 220, 0x2a2a30, 0.4], [70, 30, -130, 180, 0xd8c9a8, 0.16]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: c, transparent: true, opacity: o, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); sp.position.set(x, y, z); sp.scale.set(sz, sz, 1); sp.renderOrder = -10; scene.add(sp); } }
  /* ---- petals in the park + fireworks timer ---- */
  { townFx.petals = []; const pm = M(0xe8e0d0, { roughness: 1 }); for (let i = 0; i < 40; i++) { const p = add(scene, new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshBasicMaterial({ color: 0xe8e0d0, side: THREE.DoubleSide }), -38 + (Math.random() - .5) * 14, Math.random() * 6, 66 + (Math.random() - .5) * 12); p.userData.v = 0.4 + Math.random() * 0.5; p.userData.ph = Math.random() * 7; townFx.petals.push(p); } townFx.fwT = 4; }
}
function worldAnimExtra(dt, time) {
  if (townFx.gymBag) townFx.gymBag.rotation.z = Math.sin(time * 1.7) * 0.12;
  if (townFx.sushiBelt) for (const p of townFx.sushiBelt.children) { p.position.x = -3.6 + (((p.userData.i * 0.9 + time * 0.35) % 8.1) + 8.1) % 8.1; }
  if (townFx.roofSign) { townFx.roofSign.rotation.y = time * 0.45; townFx.roofSign.position.y = 13.2 + Math.sin(time * 0.8) * 0.12; }
  if (townFx.wheel) { townFx.wheel.rotation.z = time * 0.12; for (const c of townFx.cabs) c.rotation.z = -townFx.wheel.rotation.z; }
  if (townFx.train) { const tr = townFx.train; tr.position.x += dt * 7; if (tr.position.x > 70) tr.position.x = -72; }
  if (townFx.drones) for (const d of townFx.drones) { const u = d.userData; const a = time * 0.35 + u.ph; d.position.set(u.cx + Math.sin(a) * u.r, u.h + Math.sin(time * 1.3 + u.ph) * 0.4, u.cz + Math.cos(a) * u.r); d.rotation.y = -a; d.rotation.z = 0.15; }
  if (townFx.balloon) { townFx.balloon.position.x = 22 + Math.sin(time * 0.4) * 0.8; townFx.balloon.position.y = 13 + Math.sin(time * 0.7) * 0.5; townFx.balloon.rotation.y = Math.sin(time * 0.3) * 0.3; }
  if (townFx.speakers) townFx.speakers.forEach((c, i) => { const k = 1 + Math.max(0, Math.sin(time * 9 + i)) * 0.12; c.scale.set(k, k, 1); });
  if (townFx.petals) for (const p of townFx.petals) { p.position.y -= dt * p.userData.v; p.position.x += Math.sin(time * 1.5 + p.userData.ph) * dt * 0.5; p.rotation.x += dt * 2; p.rotation.y += dt; if (p.position.y < 0.05) p.position.y = 5 + Math.random() * 2; }
  if (townFx.fwT != null && typeof spawnParticle === 'function') { townFx.fwT -= dt; if (townFx.fwT <= 0) { townFx.fwT = 3 + Math.random() * 4; const x = (Math.random() - 0.5) * 60, y = 14 + Math.random() * 8, z = 34 + Math.random() * 30; for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI; const v = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).multiplyScalar(3 + Math.random() * 3); spawnParticle(_w.set(x, y, z), 'conf', v); } } }
}
