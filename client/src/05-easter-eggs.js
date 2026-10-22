
/* ================= easter eggs: small props around the map for people who were on Solana from the start.
   Nothing here copies a mascot or a brand: only moments, written as the trenches remember them. Click one to read it. ================= */
const EGG_LINES = [];   // every egg text, for the test hooks
/* a clue per story for the notice board: what to look for, never the story itself */
const EGG_HINTS = {
  'November 2022': 'A price nobody wants to see again hangs on the cafe\'s left wall.',
  'February 2024': 'The cafe\'s right wall apologizes for a pause.',
  'Candy Machine': 'A machine full of candy by the counter.',
  'STEPN': 'Someone left their running shoes at the back of the cafe.',
  'Saga': 'A phone box on the counter is worth more than it looks.',
  'Jupuary': 'Look up: a banner on the tallest tower in town.',
  'Okay Bears': 'One calm word on a plaque by the pond.',
  'Moo Deng': 'Something small is swimming in the pond.',
  'Slerf': 'A sign at the vault about an expensive mistake.',
  'Mango Markets': 'A sticker on the market terminal remembers a squeeze.',
  'DeGods': 'A poster on the billboard pole about leaving and coming back.',
  'April 2024': 'The docks keep a sign about a very crowded spring.',
  'Degenerate Ape': 'A poster above the game machines in the cafe.',
  'gm': 'Two letters on the cafe\'s back wall, above the DJ.',
  'Solana summer': 'A sunny poster near the cafe\'s front, left side.',
  'Jito': 'Check the tip jar on the counter.',
  'Wormhole': 'A closed bridge near the water.',
  'Mango': 'Fresh fruit next to the market.',
  'BONK': 'A gift by the fountain.',
  'Firedancer': 'A sign about a dancer that is always almost here, by the tower.',
  'pump.fun': 'The launch pad remembers where the trenches began.',
  'dogwifhat': 'A pink hat on the billboard square.',
  'May 22': 'A receipt on the sushi bar wall.',
  'September 2021': 'The gym has advice for outages.',
  'The one SOL': 'Something shiny on the fountain rim.',
  'Breakpoint': 'A photo on the arcade\'s outside wall.',
  'Every cycle': 'An empty slot in a machine at the back of the cafe.',
  'Phantom': 'A ghost by the cafe door.',
  'Magic Eden': 'Two shops arguing on a sign near the market.',
  'Pyth': 'An oracle speaks near the tower.',
  'Helius': 'The server rack in the cafe has a name.',
  'Raydium': 'A diploma near the launch pad.',
  'Fartcoin': 'A sign outside the arcade about an agent with a sense of humour.',
  'Popcat': 'A cat with its mouth open near the casino.',
  'DRiP': 'Free art near the studio.',
  'Star Atlas': 'A spaceship ticket at the docks.'
};
function eggHint(text) { for (const k in EGG_HINTS) if (text.startsWith(k)) return EGG_HINTS[k]; return ''; }

/* card art and rarity for every story (the album and the in-world posters use the same picture) */
const RARITY = { common: '#bdb8ad', rare: '#6fb3ff', epic: '#b98cff', legendary: '#e9c873' };
const RARITY_XP = { common: 40, rare: 60, epic: 90, legendary: 150 };
/* key → [rarity, sky top, sky bottom, main emoji, side emoji, stamp]. Pictures are drawn here from emoji and shapes: no logos, no photos. */
const EGG_ART = {
  'November 2022': ['legendary', '#5a1018', '#120406', '📉', ['💸', '🔥', '🧊'], '$8 SOL', 'FTX Week'],
  'February 2024': ['rare', '#1f2c45', '#06080d', '⏸️', ['🛠️', '⏳'], 'BRB', 'The Pause'],
  'Candy Machine': ['rare', '#5a2457', '#14081a', '🍬', ['🍭', '🎟️', '🍬'], 'MINT'],
  'STEPN': ['rare', '#155a3c', '#04120b', '👟', ['🏃', '🪙', '🪙'], '10K STEPS', 'Move to Earn'],
  'Saga': ['epic', '#26264a', '#07070f', '📱', ['🎁', '🐕', '✨'], 'SOLD OUT', 'The Phone'],
  'Jupuary': ['legendary', '#2e5a22', '#081206', '🪐', ['🎉', '🪂', '✨'], 'JUPUARY'],
  'Okay Bears': ['epic', '#4a3a24', '#100c07', '🐻', ['😌', '🌿'], 'okay.'],
  'Moo Deng': ['epic', '#1f5466', '#05141a', '🦛', ['💦', '🫧', '🫧'], 'MOO'],
  'Slerf': ['rare', '#5a2414', '#140805', '🦥', ['🔥', '💀'], 'BURNED', 'The Burn'],
  'Mango Markets': ['epic', '#5a4010', '#140e03', '📈', ['🧃', '⚖️'], 'SQUEEZE', 'The Squeeze'],
  'DeGods': ['rare', '#2a2a2a', '#050505', '👑', ['🌉', '🔁'], 'CAME BACK', 'The Return'],
  'April 2024': ['rare', '#163a5a', '#040b12', '🚦', ['🔁', '⏱️'], 'TRY AGAIN', 'Spring Rush'],
  'Degenerate Ape': ['legendary', '#4a3410', '#0f0a03', '🦍', ['⚡', '🖼️'], 'AUG 2021', 'The Mint'],
  'gm': ['common', '#5a4214', '#140e04', '☕', ['🌅'], 'gm'],
  'Solana summer': ['epic', '#7a4210', '#1a0d02', '☀️', ['🏖️', '🚀'], 'SUMMER', 'Solana Summer'],
  'Jito': ['rare', '#1c4a4a', '#051212', '🫙', ['💰', '⚡'], 'TIP JAR', 'Tip Jar'],
  'Wormhole': ['legendary', '#2a1a52', '#08050f', '🕳️', ['🌉', '🛡️'], 'BRIDGE', 'The Bridge'],
  'Mango': ['common', '#5a4210', '#140e03', '🥭', ['🍃'], 'MANGO', 'Fresh Mango'],
  'BONK': ['epic', '#5a3a0c', '#140c02', '🎁', ['🐕', '🎄', '✨'], 'DEC 2022', 'The Gift'],
  'Firedancer': ['rare', '#5a2410', '#140703', '🔥', ['💃', '⏳'], 'SOON'],
  'pump.fun': ['legendary', '#12523a', '#03110b', '💊', ['📈', '🚀', '🎓'], 'CURVE', 'Bonding Curve'],
  'dogwifhat': ['epic', '#5a2442', '#14060f', '🐶', ['🧶', '✨'], 'WIF', 'The Hat'],
  'May 22': ['rare', '#5a4218', '#140e05', '🍕', ['🍕', '₿'], '10,000 BTC', 'Pizza Day'],
  'September 2021': ['epic', '#2a2a30', '#060608', '🔌', ['😴', '⏸️'], '17 HOURS', '17 Hours'],
  'The one SOL': ['legendary', '#3a2a5a', '#0b0714', '🪙', ['✨', '✨'], '1 SOL', 'The One SOL'],
  'Breakpoint': ['rare', '#154a5a', '#041014', '🎤', ['🌉', '🌊'], 'LISBON', 'Lisbon'],
  'Every cycle': ['common', '#2a2a2a', '#070707', '🫥', ['🔁'], 'NO ALPHA', 'Out of Alpha'],
  'Phantom': ['epic', '#2c2752', '#09070f', '👻', ['🔐', '✨'], 'APPROVE?', 'The Ghost'],
  'Magic Eden': ['rare', '#4a1a52', '#10040f', '🪄', ['⚔️', '🏷️'], 'ROYALTIES', 'Royalty Wars'],
  'Pyth': ['rare', '#3a1f4a', '#0d0512', '🔮', ['📊'], 'ORACLE', 'The Oracle'],
  'Helius': ['rare', '#5a3e10', '#140d03', '🛰️', ['☀️', '🖥️'], 'RPC', 'The RPC'],
  'Raydium': ['epic', '#153a5a', '#040b12', '🎓', ['💧', '📈'], 'GRADUATED', 'Graduation'],
  'Fartcoin': ['epic', '#45450f', '#0f0f03', '💨', ['🤖', '😂'], '$1B', 'The Agent'],
  'Popcat': ['rare', '#4a2a4a', '#0f070f', '🐱', ['👆', '👄'], 'CLICK', 'Click'],
  'DRiP': ['rare', '#155252', '#041111', '🎨', ['💧', '🖼️'], 'FREE ART', 'Free Art'],
  'Star Atlas': ['rare', '#141f5a', '#03050f', '🚀', ['🌌', '🎫'], 'SOON™', 'Boarding Pass']
};
function eggArtOf(text) { for (const k in EGG_ART) if (String(text || '').startsWith(k)) return EGG_ART[k]; return null; }
function eggArt(e) { return eggArtOf(e.text) || ['common', '#2a2a2a', '#070707', '❔', [], '']; }
function eggPoster(lines, o) {
  // a framed card on a wall: lines = [[text, size, color], ...]
  const W = o.w || 512, H = o.h || 320;
  const tx = canvasTex(W, H, (ctx, W_, H_) => {
    const art = o.egg ? eggArtOf(o.egg) : null;
    ctx.fillStyle = o.bg || '#101011'; ctx.fillRect(0, 0, W_, H_);
    if (art) {   // the card's picture glows behind the words, so the poster and the album card read as one thing
      const g = ctx.createLinearGradient(0, 0, 0, H_); g.addColorStop(0, art[1]); g.addColorStop(1, art[2]); ctx.fillStyle = g; ctx.globalAlpha = 0.75; ctx.fillRect(0, 0, W_, H_); ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.32; ctx.font = `${Math.round(H_ * 0.82)}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; ctx.fillText(art[3], W_ * 0.5, H_ * 0.52); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W_, H_);
    }
    ctx.strokeStyle = art ? RARITY[art[0]] : (o.frame || 'rgba(236,233,226,.35)'); ctx.lineWidth = art ? 8 : 6; ctx.strokeRect(10, 10, W_ - 20, H_ - 20);
    if (art) { ctx.font = '700 18px "JetBrains Mono", monospace'; ctx.fillStyle = RARITY[art[0]]; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('◆ ' + art[0].toUpperCase(), W_ - 24, 22); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let y = H_ / 2 - (lines.reduce((s, l) => s + l[1] * 1.25, 0)) / 2;
    for (const [text, size0, col, fam] of lines) { const font = `${fam === 'mono' ? '600' : '700'} {s}px ${fam === 'mono' ? "'JetBrains Mono', monospace" : 'Unbounded, sans-serif'}`; const size = fitText(ctx, text, font, size0, W_ - 44); ctx.font = font.replace('{s}', size); ctx.fillStyle = col || '#ece9e2'; y += size0 * 0.62; ctx.fillText(text, W_ / 2, y); y += size0 * 0.63; }
  });
  redrawOnFonts.push(tx);
  const m = add(o.parent || scene, new THREE.PlaneGeometry(o.pw || 2.2, o.ph || (o.pw || 2.2) * H / W), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }), o.x, o.y, o.z);
  m.rotation.y = o.ry || 0; m.userData.egg = o.egg; m.userData.eggTitle = lines.map(l => l[0]).join(' '); if (o.egg) EGG_LINES.push(o.egg); pickables.push(m); return m;
}
function eggSignpost(lines, o) {
  // a small standing sign in the town
  const g = new THREE.Group(); g.position.set(o.x, 0, o.z); g.rotation.y = o.ry || 0; scene.add(g);
  add(g, new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8), M(0x1d1d1f), 0, 0.75, 0);
  eggPoster(lines, { parent: g, x: 0, y: 1.7, z: 0.02, pw: 1.7, w: 512, h: 300, egg: o.egg });
  g.traverse(ob => { ob.userData.egg = o.egg; }); return g;
}
function buildEasterEggs() {
  const mono = 'mono';
  /* 1. the $8 photo (left wall) */
  eggPoster([['SOL', 28, '#8a877f', mono], ['$8', 150, '#ece9e2'], ['NOV 2022 · WE WERE HERE', 22, '#c8a96a', mono]], { x: -ROOM.x + 0.08, y: 3.1, z: -13.5, ry: Math.PI / 2, pw: 2.4, w: 512, h: 400, egg: 'November 2022, FTX week: SOL touched $8, the timeline wrote the obituary, and Phantom downloads still went up. Everyone who stayed is sitting in this cafe.' });
  /* 2. the restart sign (right wall) */
  eggPoster([['BRB', 92, '#ece9e2'], ['VALIDATORS RESTARTING', 24, '#c8a96a', mono], ['ETA: SOON', 20, '#8a877f', mono]], { x: ROOM.x - 0.08, y: 3.3, z: 2.2, ry: -Math.PI / 2, pw: 2.6, w: 512, h: 300, egg: 'February 2024: five hours of downtime and one validator Discord doing the coordinated restart at 3 a.m. The chain stopped, the group chats did not. It always comes back.' });
  /* 3. the candy machine (by the counter) */
  { const g = new THREE.Group(); g.position.set(-20.2, 0, -0.6); scene.add(g);
    add(g, new THREE.CylinderGeometry(0.34, 0.4, 0.5, 16), M(0x1d1d1f), 0, 0.25, 0);
    add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), M(0xc8a96a, { roughness: 0.35 }), 0, 0.95, 0);
    add(g, new THREE.SphereGeometry(0.42, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.05, transmission: 0.0 }), 0, 1.75, 0);
    const rnd = seeded(21); for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = rnd() * 0.3, y = 1.45 + rnd() * 0.5; add(g, new THREE.SphereGeometry(0.06, 8, 6), M([0xd9707a, 0x8fd3a6, 0xc8a96a, 0xece9e2, 0xbdb8ad][i % 5], { roughness: 0.3 }), Math.cos(a) * r, y, Math.sin(a) * r); }
    add(g, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), M(0x1d1d1f), 0, 2.2, 0);
    eggPoster([['CANDY', 44, '#ece9e2'], ['MACHINE', 44, '#ece9e2'], ['v3 · minting since 2021', 20, '#c8a96a', mono]], { parent: g, x: 0, y: 0.95, z: 0.31, pw: 0.56, w: 512, h: 360, egg: 'Candy Machine by Metaplex: the little program that minted a whole generation of Solana NFTs. Every sold-out-in-4-minutes, every bot war, every gas-free mint night started here.' });
    g.traverse(ob => { ob.userData.egg = ob.userData.egg || 'Candy Machine by Metaplex: the little program that minted a whole generation of Solana NFTs. Every sold-out-in-4-minutes, every bot war, every gas-free mint night started here.'; }); pickables.push(g);
    colliders.push({ minx: -20.7, maxx: -19.7, minz: -1.1, maxz: -0.1, h: 2.3 }); }
  /* 4. the sneakers (back wall, left) */
  { const g = new THREE.Group(); g.position.set(-19, 0, ROOM.zb + 0.5); scene.add(g);
    add(g, BOX(2.4, 0.06, 0.6), M(0x1d1d1f), 0, 1.5, 0); for (const s of [-1, 1]) add(g, BOX(0.06, 0.06, 0.55), M(0x1d1d1f), s * 1.1, 1.54, 0);
    for (const [x, col] of [[-0.5, 0x8fd3a6], [0.5, 0xd9707a]]) { add(g, RBOX(0.62, 0.22, 0.3, 0.06), M(col, { roughness: 0.6 }), x, 1.65, 0.05); add(g, RBOX(0.62, 0.08, 0.32, 0.03), M(0xece9e2), x, 1.57, 0.05); add(g, RBOX(0.3, 0.16, 0.26, 0.05), M(col, { roughness: 0.6 }), x - 0.14, 1.82, 0.03); }
    eggPoster([['10,000 STEPS', 40, '#ece9e2'], ['FOR 0.2 GST', 40, '#ece9e2'], ['SUMMER 2022', 20, '#c8a96a', mono]], { parent: g, x: 0, y: 2.55, z: 0.02, pw: 1.6, w: 512, h: 300, egg: 'STEPN, summer 2022: half the cafe bought NFT sneakers and started walking for GST. The sneakers are still here. The token is not.' });
    g.traverse(ob => { ob.userData.egg = ob.userData.egg || 'STEPN, summer 2022: half the cafe bought NFT sneakers and started walking for GST. The sneakers are still here. The token is not.'; }); pickables.push(g); }
  /* 5. the phone box on the counter */
  { const g = new THREE.Group(); g.position.set(-20.4, 1.16, -4.4); scene.add(g);
    add(g, RBOX(0.5, 0.26, 0.9, 0.03), M(0x111112), 0, 0.13, 0);
    eggPoster([['PHONE', 70, '#ece9e2'], ['SOLD OUT', 36, '#d9707a'], ['the airdrop inside was worth more than the phone', 17, '#8a877f', mono]], { parent: g, x: 0, y: 0.27, z: 0, pw: 0.84, w: 512, h: 280, egg: 'Saga, December 2023: a $600 phone sold out overnight because the BONK airdrop inside it was worth more than the phone. Peak Solana. Then came the cheaper one, Seeker.' });
    g.children[1].rotation.x = -Math.PI / 2; g.traverse(ob => { ob.userData.egg = ob.userData.egg || 'Saga, December 2023: a $600 phone sold out overnight because the BONK airdrop inside it was worth more than the phone. Peak Solana. Then came the cheaper one, Seeker.'; }); pickables.push(g); }
  /* 6. the airdrop banner on the tower */
  eggPoster([['JUPUARY', 64, '#ece9e2'], ['CLAIMED ✓', 30, '#8fd3a6', mono], ['JAN 2024', 20, '#c8a96a', mono]], { x: 26, y: 8.5, z: 45.3, pw: 4.2, w: 512, h: 280, egg: 'Jupuary, January 2024: Jupiter dropped JUP on nearly a million wallets. Half of Solana woke up rich, the other half learned what an eligibility snapshot is.' });
  /* 7. the "okay." plaque by the pond */
  eggSignpost([['okay.', 110, '#ece9e2'], ['SPRING 2022', 20, '#c8a96a', mono]], { x: -32.4, z: 67.8, ry: 0.6, egg: 'Okay Bears, spring 2022: a bear market, a bear collection, and one word that calmed the whole timeline. okay.' });
  /* 8. a baby hippo in the pond */
  { const g = new THREE.Group(); g.position.set(-36.8, 0.1, 65.4); g.rotation.y = 0.8; scene.add(g);
    const hm = M(0x6f6a7c, { roughness: 0.85 }), pk = M(0xd8a0a8);
    add(g, RBOX(0.7, 0.42, 1.0, 0.12), hm, 0, 0.18, 0); add(g, RBOX(0.56, 0.4, 0.5, 0.1), hm, 0, 0.36, 0.62);
    add(g, RBOX(0.6, 0.26, 0.3, 0.08), pk, 0, 0.3, 0.9); for (const s of [-1, 1]) { add(g, SPH(0.08, 8, 6), hm, s * 0.24, 0.62, 0.5); add(g, SPH(0.045, 8, 6), M(0x0a0a0b), s * 0.17, 0.5, 0.87); }
    g.traverse(ob => { ob.userData.egg = 'Moo Deng, autumn 2024: a baby pygmy hippo from a Thai zoo, bouncy, bitey, briefly worth more than most banks. She lives in the pond now.'; }); pickables.push(g); EGG_LINES.push('A baby hippo, autumn 2024.'); }
  /* 9. the vault sign */
  eggSignpost([['PRESALE', 48, '#ece9e2'], ['BURNED', 48, '#d9707a'], ['SORRY · MAR 2024', 20, '#c8a96a', mono]], { x: -2.6, z: 65.8, ry: -0.5, egg: 'Slerf, March 2024: a dev burned a $10M presale by accident and posted a sorry. The chart pumped anyway. The trenches forgive, the trenches do not forget.' });
  /* 10. the sticker on the market terminal */
  eggPoster([['HIGHLY PROFITABLE', 30, '#ece9e2'], ['TRADING STRATEGY', 30, '#ece9e2'], ['OCT 2022', 18, '#c8a96a', mono]], { x: -17.2, y: 1.5, z: 34.9, pw: 1.6, w: 512, h: 220, egg: 'Mango Markets, October 2022: someone drained the lending market for $110M and called it “a highly profitable trading strategy”. The court disagreed.' });
  /* 11. the poster on the billboard pole */
  eggPoster([['LEFT FOR', 34, '#8a877f', mono], ['ANOTHER CHAIN', 40, '#ece9e2'], ['CAME BACK', 40, '#ece9e2'], ['2023 → 2024', 18, '#c8a96a', mono]], { x: -24.85, y: 2.2, z: 49.5, ry: Math.PI / 2, pw: 1.9, w: 512, h: 360, egg: 'DeGods and y00ts, 2023: the most famous collection bridged to Ethereum and Polygon, loudly. In 2024 it bridged back, quietly. Home is home.' });
  /* 12. the docks sign */
  eggSignpost([['TX DROPPED?', 40, '#ece9e2'], ['TRY AGAIN.', 40, '#ece9e2'], ['APRIL 2024', 20, '#c8a96a', mono]], { x: -1.4, z: TOWN.zf - 2.4, ry: 2.6, egg: 'April 2024: the busiest weeks the chain ever had. Every transaction tried five times, Jito tips went vertical and “priority fee” became a verb.' });
  /* 13. the mint that broke the chain (the APE cabinet gets a story) */
  eggPoster([['AUG 2021', 20, '#c8a96a', mono], ['ONE MINT', 36, '#ece9e2'], ['BROKE THE CHAIN', 30, '#ece9e2']], { x: ROOM.x - 0.08, y: 3.4, z: 15.9, ry: -Math.PI / 2, pw: 1.4, w: 512, h: 300, egg: 'Degenerate Ape Academy, August 2021: the mint was so popular it congested the whole network. The first of many lessons about what “fast” means under load.' });
  /* 14. the GM wall (back right, above the DJ corner) */
  eggPoster([['gm', 150, '#ece9e2'], ['say it back', 22, '#8a877f', mono]], { x: 20.5, y: 5.2, z: ROOM.zb + 0.08, pw: 2.2, w: 512, h: 400, egg: 'gm. Two letters, every morning, since 2021. Backpack made it a wallet, DRiP made it a daily drop, Mad Lads made it a lifestyle. Say it back.' });
  /* 15. Solana summer (left wall, front) */
  eggPoster([['SOLANA', 40, '#ece9e2'], ['SUMMER', 64, '#c8a96a'], ['2021 · NOBODY SLEPT', 20, '#8a877f', mono]], { x: -ROOM.x + 0.08, y: 3.2, z: 6.5, ry: Math.PI / 2, pw: 2.3, w: 512, h: 360, egg: 'Solana summer 2021: Raydium pools, Serum order books, a new NFT mint every night and nobody went to bed before sunrise. The cafe opened its doors that summer.' });
  /* 16. the tip jar on the counter */
  { const g = new THREE.Group(); g.position.set(-20.4, 1.16, -2.6); scene.add(g);
    add(g, new THREE.CylinderGeometry(0.16, 0.14, 0.34, 16), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0.17, 0);
    for (let i = 0; i < 5; i++) add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.015, 14), M(0xc8a96a, { roughness: 0.3, metalness: 0.8 }), (i % 2 - 0.5) * 0.06, 0.02 + i * 0.03, (i % 3 - 1) * 0.04);
    add(g, new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ map: labelTex('TIPS', '#0a0a0b', '#ece9e2', 256, 86, 54) }), 0, 0.2, 0.17);
    const egg = 'Jito, December 2023: the tip jar paid out. JTO landed in the wallets of everyone who had simply staked, and the liquid staking wars began. Marinade sends its regards.'; g.traverse(o => { o.userData.egg = egg; }); EGG_LINES.push(egg); pickables.push(g); }
  /* 17. the closed bridge (near the docks) */
  eggSignpost([['BRIDGE', 44, '#ece9e2'], ['CLOSED', 44, '#d9707a'], ['FEB 2022', 20, '#c8a96a', mono]], { x: 8, z: TOWN.zf - 1.6, ry: Math.PI, egg: 'Wormhole, February 2022: the bridge was drained for 120,000 ETH overnight. Jump refilled it by morning, the bridge reopened. The sign stays as a reminder.' });
  /* 18. the mango stand (next to the market) */
  { const g = new THREE.Group(); g.position.set(-27, 0, 30.5); scene.add(g);
    add(g, BOX(1.4, 0.8, 0.8), M(0x5a3a22), 0, 0.4, 0);
    for (let i = 0; i < 7; i++) add(g, SPH(0.13, 12, 10), M(0xf2a033, { roughness: 0.5 }), -0.45 + (i % 4) * 0.3, 0.92 + Math.floor(i / 4) * 0.16, (i % 2) * 0.16 - 0.08);
    eggPoster([['MANGO', 46, '#f2a033'], ['CLOSED', 30, '#ece9e2'], ['OCT 2022', 18, '#8a877f', mono]], { parent: g, x: 0, y: 1.75, z: 0, pw: 1.3, w: 512, h: 260, egg: '' });
    const egg = 'Mango, October 2022: the stand got squeezed. Someone pumped the price, borrowed against it and walked off with the whole market. Fruit is still on sale.'; g.traverse(o => { o.userData.egg = egg; }); EGG_LINES.push(egg); pickables.push(g); colliders.push({ minx: -27.8, maxx: -26.2, minz: 30, maxz: 31, h: 1.2 }); }
  /* 19. a gift box by the well */
  { const g = new THREE.Group(); g.position.set(-5.2, 0, 30.6); g.rotation.y = 0.4; scene.add(g);
    add(g, RBOX(0.7, 0.6, 0.7, 0.04), M(0xa8122c, { roughness: 0.6 }), 0, 0.3, 0); add(g, BOX(0.72, 0.62, 0.12), M(0xc8a96a), 0, 0.3, 0); add(g, BOX(0.12, 0.62, 0.72), M(0xc8a96a), 0, 0.3, 0);
    const egg = 'BONK, December 25, 2022: a dog coin airdropped to everyone still building after the crash: artists, devs, NFT holders. It was the first good news in weeks.'; g.traverse(o => { o.userData.egg = egg; }); EGG_LINES.push(egg); pickables.push(g); }
  /* 20. the firedancer sign (by the X tower) */
  eggSignpost([['FIREDANCER', 36, '#ece9e2'], ['COMING SOON', 30, '#c8a96a'], ['SINCE 2022', 18, '#8a877f', mono]], { x: 21.5, z: 44, ry: -0.6, egg: 'Firedancer: the second validator client, announced in 2022, always almost here. Every year someone says “this summer”. We believe.' });
  /* 21. the birth of the bonding curve (launch pad) */
  eggSignpost([['JAN 2024', 22, '#c8a96a', mono], ['A BONDING CURVE', 30, '#ece9e2'], ['WAS BORN', 30, '#ece9e2']], { x: 8.6, z: 66.5, ry: 0.4, egg: 'pump.fun, January 2024: one page, one bonding curve, one click to launch a coin. The trenches were never the same. You are standing in them.' });
  /* 22. the hat that went to Vegas (billboard square) */
  { const g = new THREE.Group(); g.position.set(-30.5, 0, 57); scene.add(g);
    add(g, new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8), M(0x1d1d1f), 0, 0.55, 0);
    add(g, RBOX(0.62, 0.3, 0.62, 0.12), M(0xf0a8c8, { roughness: 0.9 }), 0, 1.25, 0); add(g, SPH(0.1, 10, 8), M(0xffffff, { roughness: 0.9 }), 0, 1.46, 0);
    const egg = 'dogwifhat, 2024: holders crowdfunded $700k to put a dog in a pink knit hat on the Las Vegas Sphere. The hat now lives here.'; g.traverse(o => { o.userData.egg = egg; }); EGG_LINES.push(egg); pickables.push(g); }
  /* 23. the pizza receipt (sushi bar wall) */
  eggPoster([['10,000 BTC', 40, '#ece9e2'], ['FOR 2 PIZZAS', 32, '#ece9e2'], ['MAY 22, 2010', 18, '#c8a96a', mono], ['not solana, but we remember', 16, '#8a877f', mono]], { x: -47.3, y: 2.4, z: 23.5, ry: Math.PI / 2, pw: 1.6, w: 512, h: 330, egg: 'May 22, 2010: two pizzas for 10,000 BTC. Every chain has its day one; this receipt hangs at the sushi bar to remind the trenches where it all started.' });
  /* 24. the gym poster */
  eggPoster([['DO NOT SELL', 44, '#d9707a'], ['DURING THE', 26, '#ece9e2'], ['OUTAGE', 44, '#ece9e2'], ['SEP 2021 · 17 HOURS', 18, '#c8a96a', mono]], { x: 47.3, y: 2.6, z: 28.5, ry: -Math.PI / 2, pw: 1.7, w: 512, h: 360, egg: 'September 2021: seventeen hours offline, the longest outage ever. Nobody could sell. Some say it was the best hold of their lives.' });
  /* 25. the gold coin on the fountain rim */
  { const g = new THREE.Group(); g.position.set(3.6, 1.05, 32.4); scene.add(g);
    const coin = add(g, CYL(0.22, 0.22, 0.04, 24), METAL(0xe5bf72, { roughness: 0.25 }), 0, 0, 0); coin.rotation.x = Math.PI / 2; coin.rotation.z = 0.4;
    textPlate(g, '1', '#0a0a0b', null, 0.2, 0.2, 0, 0.03, 0, 150).rotation.x = -Math.PI / 2;
    const egg = 'The one SOL that started it all: in March 2020 it cost $0.22, less than a coffee. The coin is glued down; people tried.'; g.traverse(o => { o.userData.egg = egg; }); EGG_LINES.push(egg); pickables.push(g); }
  /* 26. the moon landing photo (arcade wall) */
  eggPoster([['FIRST', 26, '#8a877f', mono], ['SOLANA', 46, '#ece9e2'], ['BREAKPOINT', 40, '#c8a96a'], ['LISBON 2021', 18, '#8a877f', mono]], { x: 36, y: 3.4, z: 53.2, ry: 0.5 + Math.PI, pw: 1.8, w: 512, h: 360, egg: 'Breakpoint, Lisbon, November 2021: the first big Solana conference. SOL printed its all-time high the same week. Everyone in that photo is still here.' });
  /* 27. the empty vending slot by the DJ corner */
  eggPoster([['OUT OF', 34, '#ece9e2'], ['ALPHA', 56, '#c8a96a'], ['come back next cycle', 18, '#8a877f', mono]], { x: 15.5, y: 2.2, z: ROOM.zb + 0.08, pw: 1.3, w: 512, h: 300, egg: 'Every cycle the alpha runs out around the same time. It comes back, usually when nobody is looking. Ask anyone who sat in the Jupiter Discord in 2023.' });
  /* 28. the ghost by the cafe door */
  eggSignpost([['👻', 90, '#ece9e2'], ['APPROVE?', 26, '#c8a96a', mono]], { x: 5.6, z: 21.2, ry: 0.4, egg: 'Phantom, 2021: a purple ghost in a browser tab became the front door of Solana. A few hundred million approvals later it still asks you to check the amount. Do.' });
  /* 29. the marketplace wars sign near the market */
  eggSignpost([['ME vs TENSOR', 34, '#ece9e2'], ['ROYALTIES: OPTIONAL', 18, '#c8a96a', mono], ['2023', 18, '#8a877f', mono]], { x: -27, z: 36.5, ry: 0.9, egg: 'Magic Eden vs Tensor, 2023: the marketplace wars. Royalties became optional, points became a sport, and every floor got swept at least once.' });
  /* 30. the oracle near the tower */
  eggSignpost([['PYTH', 70, '#ece9e2'], ['PRICE: YES', 22, '#8fd3a6', mono]], { x: 31, z: 52.5, ry: -0.7, egg: 'Pyth: the price feeds every DEX on this chain quotes. When the oracle blinks, the whole trench blinks with it.' });
  /* 31. the server rack in the cafe */
  eggPoster([['RPC', 28, '#8a877f', mono], ['HELIUS', 56, '#ece9e2'], ['99.99% · DO NOT UNPLUG', 18, '#c8a96a', mono]], { x: -ROOM.x + 0.08, y: 2.4, z: 12.5, ry: Math.PI / 2, pw: 1.6, w: 512, h: 320, egg: 'Helius: the RPC half of these desks run on. When it is slow, everything is slow. When it is fast, nobody notices. That is the job.' });
  /* 32. the diploma near the launch pad */
  eggSignpost([['GRADUATED', 36, '#ece9e2'], ['TO RAYDIUM', 36, '#8fd3a6'], ['curve filled · pool opened', 16, '#8a877f', mono]], { x: 10.5, z: 66.5, ry: -0.5, egg: 'Raydium: where pump.fun coins graduate once the bonding curve fills. The diploma is a liquidity pool, the party is a chart, the hangover is a chart too.' });
  /* 33. the agent with a sense of humour, outside the arcade */
  eggSignpost([['AN AI AGENT', 24, '#8a877f', mono], ['LAUNCHED A COIN', 30, '#ece9e2'], ['ABOUT A FART', 30, '#ece9e2'], ['$1B · OCT 2024', 18, '#c8a96a', mono]], { x: 45, z: 53, ry: -1.2, egg: 'Fartcoin, October 2024: an AI agent on the timeline shilled a coin named after a fart and it hit a billion. The agents launch coins now. Some of them sit at these desks.' });
  /* 34. the cat near the casino */
  eggSignpost([['POPCAT', 60, '#ece9e2'], ['click · click · click', 18, '#c8a96a', mono]], { x: -21, z: 46, ry: 1.1, egg: 'Popcat, 2024: a cat with its mouth open, a click counter per country, and a $2B market cap. The trenches meme first and ask questions never.' });
  /* 35. free art near the studio */
  eggSignpost([['DRiP', 70, '#ece9e2'], ['FREE ART · EVERY WEEK', 18, '#c8a96a', mono]], { x: -29.5, z: 44.5, ry: 0.5, egg: 'DRiP, 2023: free art dropped into a million wallets every week. The first thing on Solana that made people open a wallet to receive instead of send.' });
  /* 36. the spaceship ticket at the docks */
  eggPoster([['STAR ATLAS', 40, '#ece9e2'], ['BOARDING PASS', 22, '#c8a96a', mono], ['ship: paid · game: soon', 16, '#8a877f', mono]], { x: 17.5, y: 2.3, z: 69.2, ry: Math.PI, pw: 1.7, w: 512, h: 300, egg: 'Star Atlas, 2021: a space MMO that sold spaceships for more than real cars before the game existed. Some ships are still waiting to launch.' });
  buildCandles(); buildWayfinder(); buildEggMarkers();
}

/* ---- the green candle hunt: 7 candles hidden around the map. Walk into one (or click it) to collect it ---- */
const CANDLE_SPOTS = [[17.4, 0, -16.9], [-21.6, 0, 15.6], [-30, 0, 46.5], [-8, 0, 55.6], [46.6, 0, 66], [46.8, 0, 39.4], [-44.5, 0, 71]];
const CANDLES = [];
function candlesFound() { return store.get('cc_candles', []); }
function buildCandles() {
  const found = candlesFound();
  CANDLE_SPOTS.forEach(([x, y, z], i) => {
    const g = new THREE.Group(); g.position.set(x, y + 0.5, z); scene.add(g);
    add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), GLOW(0x8fd3a6, 1.2), 0, 0, 0);
    add(g, BOX(0.22, 0.38, 0.22), GLOW(0x8fd3a6, 1.6), 0, 0.02, 0);
    const pt = new THREE.PointLight(0x8fd3a6, 2.2, 3.2); pt.position.y = 0.2; g.add(pt);
    add(g, new THREE.CylinderGeometry(0.05, 0.16, 16, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fd3a6, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 8, 0);   // a thin beam, visible across town
    g.userData.candle = i; g.traverse(o => { o.userData.candle = i; }); pickables.push(g);
    g.visible = !found.includes(i); CANDLES.push(g);
  });
}
function collectCandle(i) {
  const found = candlesFound(); if (found.includes(i)) return;
  found.push(i); store.set('cc_candles', found); gainXP(found.length >= CANDLE_SPOTS.length ? 215 : 15, 'candle'); sfx('coin'); const g = CANDLES[i]; if (g) { confetti(_w.copy(g.position), 30); g.visible = false; }
  if (found.length >= CANDLE_SPOTS.length) { toast(t('candle_all'), 'gold', true); if (player) { player.tag.classList.add('og'); player.emote(); } huntCandles(); }
  else toast(t('candle_got', { n: found.length, of: CANDLE_SPOTS.length }), 'gold');
}
function candleTick(time) {
  for (const g of CANDLES) if (g.visible) { g.rotation.y = time * 1.4; g.children[1].position.y = 0.02 + Math.sin(time * 2 + g.position.x) * 0.06; }
  if (!player || !playing) return;
  const p = player.obj.position;
  for (let i = 0; i < CANDLES.length; i++) { const g = CANDLES[i]; if (g.visible && Math.hypot(g.position.x - p.x, g.position.z - p.z) < 1.1) collectCandle(i); }
}

/* ---- every story gets a floating marker so players notice it: gold "?" until read, green tick after ---- */
const EGGS = [];
function eggsSeen() { return store.get('cc_eggs_seen', []); }
function markerTex(seen) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = seen ? '#8fd3a6' : '#e9c873'; x.beginPath(); x.arc(64, 64, 54, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#0a0a0b'; x.stroke();
  x.fillStyle = '#0a0a0b'; x.strokeStyle = '#0a0a0b';
  if (seen) { x.lineWidth = 14; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(38, 66); x.lineTo(56, 84); x.lineTo(90, 46); x.stroke(); }
  else { x.font = '800 74px Unbounded, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 64, 70); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
let MARK_TEX = null;
function buildEggMarkers() {
  MARK_TEX = { q: markerTex(false), ok: markerTex(true) };
  scene.updateMatrixWorld(true);
  const roots = new Map();
  scene.traverse(o => { const e = o.userData && o.userData.egg; if (!e || roots.has(e)) return; if (o.parent && o.parent.userData && o.parent.userData.egg === e) return; roots.set(e, o); });
  const seen = eggsSeen(), box = new THREE.Box3(), v = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (const [text, root] of roots) {
    box.setFromObject(root); box.getCenter(v); v.y = box.max.y + 0.55;
    if (root.isMesh && root.geometry && root.geometry.type === 'PlaneGeometry') { root.getWorldDirection(nrm); v.addScaledVector(nrm, 0.4); }
    let title = ''; root.traverse(o => { if (!title && o.userData.eggTitle) title = o.userData.eggTitle; });
    const i = EGGS.length;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: seen.includes(i) ? MARK_TEX.ok : MARK_TEX.q, toneMapped: false, depthWrite: false }));
    sp.scale.set(0.46, 0.46, 1); sp.position.copy(v); sp.userData.egg = text; sp.renderOrder = 3; scene.add(sp); pickables.push(sp);
    EGGS.push({ text, title: title || text.split(':')[0], hint: eggHint(text), pos: v.clone(), y0: v.y, sp, seen: seen.includes(i) });
  }
}
function eggMarkersTick(time) { for (let i = 0; i < EGGS.length; i++) { const e = EGGS[i]; e.sp.position.y = e.y0 + Math.sin(time * 2.2 + i) * 0.08; const k = e.seen ? 0.4 : 0.46 + Math.sin(time * 3 + i) * 0.04; e.sp.scale.set(k, k, 1); } }
function openEgg(i) {
  const e = EGGS[i]; if (!e) return;
  const seen = eggsSeen(); if (!seen.includes(i)) { seen.push(i); store.set('cc_eggs_seen', seen); e.sp.material.map = MARK_TEX.ok; e.sp.material.needsUpdate = true; e.seen = true; confetti(_w.copy(e.pos), 18); huntEgg(i); gainXP(RARITY_XP[eggRarity(e)], 'egg'); sfx('card'); e.isNew = true; }
  let m = document.getElementById('mStory');
  if (!m) { m = document.createElement('div'); m.className = 'modal'; m.id = 'mStory'; m.hidden = true; m.innerHTML = '<div class="sheet story-card" role="dialog" aria-modal="true"><button type="button" class="xclose" data-close aria-label="Close">×</button><div id="storyBody"></div></div>'; document.body.appendChild(m); }
  const date = (e.text.match(/^([^:]{3,40}):/) || [])[1] || '';
  const rar = eggRarity(e), isNew = e.isNew; e.isNew = false;
  $('#storyBody').innerHTML = `<div class="story-wrap${isNew ? ' fresh' : ''}" style="--rc:${RARITY[rar]}"><div class="story-art"><img src="${eggCardURL(i)}" alt="">${isNew ? `<span class="story-new">${t('new_card')} · +${RARITY_XP[rar]} XP</span>` : ''}</div>
    <div class="story-txt"><div class="land-chip">${t('egg_chip', { n: seen.length, of: EGGS.length })}</div><span class="story-rar">◆ ${t('r_' + rar)}</span><h3>${esc(eggArt(e)[6] || e.title)}</h3>${date ? `<small class="story-date">${esc(date)}</small>` : ''}<p>${esc(date ? e.text.slice(date.length + 1).trim() : e.text)}</p><div class="story-bar"><i style="width:${Math.round(seen.length / EGGS.length * 100)}%"></i></div><p class="muted">${seen.length >= EGGS.length ? t('egg_all') : t('egg_more')}</p><div class="rk-row story-acts"><button type="button" class="btn small hot" data-share="card" data-i="${i}">𝕏 ${t('sh_btn')}</button><button type="button" class="btn small" data-hot="album">${t('gui_album')} · J</button></div></div></div>`;
  showModal('mStory');
}
function openEggByText(text) { const i = EGGS.findIndex(e => e.text === text); if (i >= 0) openEgg(i); else toast(text, 'cyan', true); }

/* ---- a signpost right outside the cafe door: arrows to the casino, the arcade, the launch pad and the market ---- */
function arrowBoard(text, col, flip) {
  return canvasTex(512, 120, (x, W, H) => {
    x.fillStyle = '#0f0e0c'; x.fillRect(0, 0, W, H); x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(6, 6, W - 12, H - 12);
    x.fillStyle = col; x.beginPath(); if (!flip) { x.moveTo(W - 22, H / 2); x.lineTo(W - 70, 18); x.lineTo(W - 70, H - 18); } else { x.moveTo(22, H / 2); x.lineTo(70, 18); x.lineTo(70, H - 18); } x.closePath(); x.fill();
    x.fillStyle = '#ece9e2'; const fs = fitText(x, text, '800 {s}px Unbounded, sans-serif', 46, W - 150); x.font = `800 ${fs}px Unbounded, sans-serif`; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(text, flip ? W / 2 + 26 : W / 2 - 26, H / 2 + 3);
  });
}
function buildWayfinder() {
  const g = new THREE.Group(); g.position.set(4.4, 0, 24.6); scene.add(g);
  add(g, new THREE.CylinderGeometry(0.08, 0.1, 3.2, 10), M(0x1d1d1f), 0, 1.6, 0); add(g, SPH(0.14, 12, 10), METAL(0xc8a96a), 0, 3.25, 0);
  const list = [['casino', 'CASINO', '#e9c873'], ['arcade', 'ARCADE', '#bdb8ad'], ['launchpad', 'LAUNCH PAD', '#8fd3a6'], ['market', 'MARKET', '#bdb8ad']];
  list.forEach(([id, label, col], i) => {
    const pl = PLACES[id]; if (!pl) return;
    const b = new THREE.Group(); b.position.y = 2.75 - i * 0.48; b.rotation.y = Math.atan2(-(pl.z - g.position.z), pl.x - g.position.x); g.add(b);
    const front = arrowBoard(label, col, false), back = arrowBoard(label, col, true); redrawOnFonts.push(front, back);
    add(b, new THREE.PlaneGeometry(1.9, 0.44), new THREE.MeshBasicMaterial({ map: front, toneMapped: false }), 1.1, 0, 0.026);
    add(b, new THREE.PlaneGeometry(1.9, 0.44), new THREE.MeshBasicMaterial({ map: back, toneMapped: false }), 1.1, 0, -0.026).rotation.y = Math.PI;
    add(b, BOX(1.94, 0.48, 0.04), M(0x1d1d1f), 1.1, 0, 0);
    b.traverse(o => { o.userData.place = id; });
  });
  pickables.push(g); colliders.push({ minx: 4.2, maxx: 4.6, minz: 24.4, maxz: 24.8, h: 3 });
}
