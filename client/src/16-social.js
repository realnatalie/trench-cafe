/* ================= SOCIAL: the bartender, cafe music, the invite pass, sharing to X, the weekly board =================
   All of it is game flavour: XP only, never chips or SOL. Music is synthesised live (no audio files, nothing licensed). */
const SITE_FALLBACK = 'https://clout-cafe.fkamilev102.workers.dev';
const siteURL = () => String(NET.http || SITE_FALLBACK).replace(/\/$/, '');
function myUid() {
  let u = store.get('cc_uid', '');
  if (!/^[a-f0-9]{16,32}$/.test(u)) { u = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join(''); store.set('cc_uid', u); }
  return u;
}
{ try { const q = new URLSearchParams(location.search).get('ref'); if (q && /^[A-Za-z2-9]{7}$/.test(q) && !store.get('cc_ref_done', false)) store.set('cc_ref_from', q.toUpperCase()); if (q) history.replaceState(null, '', location.pathname + location.hash); } catch (e) { } }
function landRefPill() {   // an invited player sees the welcome bonus right on the landing card
  if (!store.get('cc_ref_from', '') || store.get('cc_ref_done', false) || $('#landRef')) return;
  const h = $('#landForm .l2-card-h'); if (!h) return;
  h.insertAdjacentHTML('afterend', `<div class="l2-ref" id="landRef"><i>🎟</i><span data-i="ref_land">${t('ref_land')}</span></div>`);
}
landRefPill();

/* ================= the invite pass ================= */
const REF = { me: null, at: 0, top: null, topAt: 0, busy: false };
const REF_XP = 250, REF_WELCOME = 100, REF_BADGES = [[1, 'ref_b1'], [3, 'ref_b2'], [10, 'ref_b3'], [25, 'ref_b4']];
async function refApi(path, body) {
  if (!NET.http) return null;
  try {
    const r = await fetch(NET.http + '/api/ref/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: myUid(), ...body }) } : undefined);
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) { return null; }
}
const refLink = () => REF.me && REF.me.code ? siteURL() + '/?ref=' + REF.me.code : siteURL();
async function refSync() {   // join once if invited, then collect XP for friends who came in since last time
  if (REF.busy || !NET.http) return; REF.busy = true;
  try {
    const from = store.get('cc_ref_from', '');
    if (from && !store.get('cc_ref_done', false)) {
      const j = await refApi('join', { code: from });
      if (j && (j.status === 200 || j.status === 404 || j.status === 400)) {
        store.set('cc_ref_done', true); store.set('cc_ref_from', '');
        if (j.body.ok) { gainXP(REF_WELCOME, 'invited'); toast(t('ref_welcome', { n: j.body.from || t('ref_friend'), x: REF_WELCOME }), 'gold', true); sfx('win'); }
        const lp = $('#landRef'); if (lp) lp.remove();
      }
    }
    const me = await refApi('me', { nick: myName(), token: NET.token || undefined });
    if (me && me.status === 200) {
      REF.me = me.body; REF.at = Date.now();
      if (me.body.unpaid > 0) {
        const c = await refApi('collect', {});
        if (c && c.body.add > 0) { gainXP(c.body.add * REF_XP, 'ref'); toast(t('ref_paid', { n: c.body.add, x: c.body.add * REF_XP }), 'gold', true); sfx('win'); REF.me.unpaid = 0; }
      }
      if (!$('#mInvite').hidden) renderInvite();
    }
  } finally { REF.busy = false; }
}
async function refTopFetch() { if (!NET.http || Date.now() - REF.topAt < 180e3) return; REF.topAt = Date.now(); const j = await refApi('top'); if (j && j.status === 200) REF.top = j.body; }
function ensureModal(id, cls) {
  let m = document.getElementById(id); if (m) return m;
  m = document.createElement('div'); m.className = 'modal'; m.id = id; m.hidden = true;
  m.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><button type="button" class="xclose" data-close aria-label="Close">×</button><div class="soc-body"></div></div>`;
  document.body.appendChild(m); return m;
}
function openInvite() { ensureModal('mInvite', 'inv-sheet'); renderInvite(); showModal('mInvite'); refSync(); }
function renderInvite() {
  const m = $('#mInvite'); if (!m) return;
  const n = REF.me ? REF.me.invited : 0, code = REF.me ? REF.me.code : '·······', lv = lvlOf(xpState().xp);
  const next = REF_BADGES.find(([k]) => n < k), prev = [...REF_BADGES].reverse().find(([k]) => n >= k);
  const pct = next ? Math.round(n / next[0] * 100) : 100;
  m.querySelector('.soc-body').innerHTML = `
    <span class="g-eyebrow">${t('ref_eyebrow')}</span><h3>${t('ref_title')}</h3><p class="sub">${t('ref_sub', { x: REF_XP, w: REF_WELCOME })}</p>
    <div class="inv-pass"><div class="inv-l"><small>TRENCH CAFE · ${t('ref_pass')}</small><b>${esc(myName())}</b><span>${t('ref_lv', { n: lv })}${prev ? ' · ' + t(prev[1]) : ''}</span></div>
      <div class="inv-r"><small>${t('ref_code')}</small><code>${esc(code)}</code><span>+${REF_WELCOME} XP</span></div></div>
    ${NET.http ? `<div class="inv-link"><input class="in" id="invLink" readonly value="${esc(refLink())}"><button type="button" class="btn small" id="invCopy">${t('wz_copy')}</button></div>
    <div class="inv-stats"><div><small>${t('ref_n')}</small><b>${n}</b></div><div><small>${t('ref_xp')}</small><b>${fmtChips(n * REF_XP)}</b></div><div><small>${t('ref_next')}</small><b>${next ? t(next[1]) : '★'}</b><i class="inv-bar"><em style="width:${pct}%"></em></i></div></div>
    <div class="rk-row"><button type="button" class="btn hot" data-share="invite">𝕏 ${t('sh_post')}</button><button type="button" class="btn" data-place-go="week">${t('ref_board')}</button></div>
    <p class="muted inv-fine">${t('ref_fine')}</p>` : `<p class="note-box">${t('ref_offline')}</p>`}`;
  const cp = $('#invCopy'); if (cp) cp.addEventListener('click', () => { try { navigator.clipboard.writeText(refLink()); } catch (e) { } const i = $('#invLink'); if (i) i.select(); cp.textContent = t('wz_copied'); sfx('tick'); });
}

/* ================= sharing to X: a picture made on the spot, the post text, and the link (with your invite code) ================= */
const SH = { blob: null, url: '', text: '', file: null, kind: '' };
const loadImg = src => new Promise(res => { if (!src) return res(null); const im = new Image(); if (!src.startsWith('data:')) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
function shBg(x, W, H, accent) {
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b0b0e'); g.addColorStop(1, '#16141b'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(W * 0.82, H * 0.12, 10, W * 0.82, H * 0.12, W * 0.6); r.addColorStop(0, accent + '55'); r.addColorStop(1, accent + '00'); x.fillStyle = r; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(236,233,226,.045)'; x.lineWidth = 1; for (let i = 0; i < W; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let i = 0; i < H; i += 40) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
  x.strokeStyle = accent + '88'; x.lineWidth = 3; rr(x, 18, 18, W - 36, H - 36, 30); x.stroke();
}
function shFooter(x, W, H, accent) {
  x.save(); x.translate(64, H - 74);
  x.fillStyle = accent; rr(x, 0, -26, 52, 52, 14); x.fill();
  x.fillStyle = '#0b0b0d'; x.font = '900 26px Unbounded, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TC', 26, 1);
  x.textAlign = 'left'; x.fillStyle = '#ece9e2'; x.font = '900 28px Unbounded, sans-serif'; x.fillText('TRENCH CAFE', 70, -6);
  x.fillStyle = '#8a877f'; x.font = `600 17px ${MONO}`; x.fillText(siteURL().replace(/^https?:\/\//, ''), 70, 20);
  x.restore();
  const lab = t('sh_play'); x.font = '800 19px Unbounded, sans-serif'; const w = x.measureText(lab).width + 48;
  x.fillStyle = accent; rr(x, W - 64 - w, H - 100, w, 52, 26); x.fill(); x.fillStyle = '#0b0b0d'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lab, W - 64 - w / 2, H - 73); x.textAlign = 'left'; x.textBaseline = 'alphabetic';
}
function shText(x, txt, font, size, maxW, X, Y, col, min = 14) { const s = fitText(x, txt, font, size, maxW, min); x.font = font.replace('{s}', s); x.fillStyle = col; x.fillText(txt, X, Y); return s; }
async function shDraw(kind, d) {
  const W = 1200, H = kind === 'og' ? 630 : 675, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  try { await document.fonts.ready; } catch (e) { }
  const gold = '#e9c873', mint = '#8fd3a6';
  if (kind === 'card') {
    const e = EGGS[d.i], rar = eggRarity(e), col = RARITY[rar], art = eggArt(e), seen = eggsSeen().length;
    shBg(x, W, H, col);
    const im = await loadImg(eggCardURL(d.i)); x.save(); x.shadowColor = col; x.shadowBlur = 40; if (im) x.drawImage(im, 92, 70, 360, 504); x.restore();
    x.fillStyle = col; x.font = `700 20px ${MONO}`; x.fillText('◆ ' + t('r_' + rar).toUpperCase() + ' · ' + t('sh_card_found'), 510, 150);
    shText(x, art[6] || e.title, '900 {s}px Unbounded, sans-serif', 60, 610, 510, 230, '#ffffff', 26);
    const date = (e.text.match(/^([^:]{3,40}):/) || [])[1] || ''; if (date) { x.fillStyle = '#bdb8ad'; x.font = `600 22px ${MONO}`; x.fillText(date, 510, 276); }
    { const body = (date ? e.text.slice(date.length + 1) : e.text).trim(); x.font = '500 22px Onest, sans-serif'; x.fillStyle = '#d6d1c7'; let line = '', y = 326, n = 0; for (const w of body.split(/\s+/)) { const tt = line ? line + ' ' + w : w; if (x.measureText(tt).width > 600 && line) { if (n === 3) { line += '…'; break; } x.fillText(line, 510, y); y += 32; n++; line = w; } else line = tt; } if (n < 4) x.fillText(line, 510, y); }
    x.fillStyle = 'rgba(255,255,255,.1)'; rr(x, 510, 470, 600, 14, 7); x.fill(); x.fillStyle = col; rr(x, 510, 470, Math.max(14, 600 * seen / EGGS.length), 14, 7); x.fill();
    x.fillStyle = '#ece9e2'; x.font = '800 26px Unbounded, sans-serif'; x.fillText(t('sh_album', { n: seen, of: EGGS.length }), 510, 528);
    shFooter(x, W, H, col);
  } else if (kind === 'rk') {
    const r = d.res, gcol = { S: gold, A: mint, B: '#9fc3ff', C: '#bdb8ad', D: '#d9707a' }[r.grade] || gold;
    shBg(x, W, H, gcol);
    x.fillStyle = gcol + '22'; rr(x, 90, 110, 340, 360, 40); x.fill(); x.strokeStyle = gcol; x.lineWidth = 6; rr(x, 90, 110, 340, 360, 40); x.stroke();
    x.fillStyle = gcol; x.font = '900 250px Unbounded, sans-serif'; x.textAlign = 'center'; x.fillText(r.grade, 260, 390); x.font = `700 20px ${MONO}`; x.fillText(t('rk_grade').toUpperCase(), 260, 450); x.textAlign = 'left';
    x.fillStyle = '#8a877f'; x.font = `700 22px ${MONO}`; x.fillText(t('sh_arcade').toUpperCase(), 490, 150);
    shText(x, rkName(r.game), '900 {s}px Unbounded, sans-serif', 58, 620, 490, 222, '#ffffff', 24);
    x.fillStyle = gcol; x.font = '900 120px Unbounded, sans-serif'; x.fillText(String(r.score), 486, 370);
    x.fillStyle = '#ece9e2'; x.font = `600 26px ${MONO}`; x.fillText(t('rk_correct', { c: r.correct, n: r.total }) + (r.rank ? ' · #' + r.rank : ''), 490, 430);
    shFooter(x, W, H, gcol);
  } else if (kind === 'coin') {
    const a = d.a; shBg(x, W, H, mint);
    const im = await loadImg(a.image) || await loadImg(TH(a.body));
    x.save(); rr(x, 92, 96, 400, 400, 40); x.clip(); x.fillStyle = '#141416'; x.fillRect(92, 96, 400, 400); if (im) x.drawImage(im, 92, 96, 400, 400); x.restore();
    x.strokeStyle = mint; x.lineWidth = 5; rr(x, 92, 96, 400, 400, 40); x.stroke();
    x.fillStyle = mint; x.font = `700 22px ${MONO}`; x.fillText(t('sh_coin_eb').toUpperCase(), 550, 160);
    shText(x, '$' + a.sym, '900 {s}px Unbounded, sans-serif', 110, 580, 548, 280, '#ffffff', 40);
    if (a.title && a.title !== a.sym) shText(x, a.title, '700 {s}px Onest, sans-serif', 38, 580, 552, 334, '#d6d1c7', 20);
    const mc = a.mint ? mcapText(a) : ''; if (mc && mc !== '—') { x.fillStyle = gold; x.font = '800 40px Unbounded, sans-serif'; x.fillText(mc, 552, 406); x.fillStyle = '#8a877f'; x.font = `600 18px ${MONO}`; x.fillText(t('sh_mcap'), 552, 434); }
    if (a.mint) { x.fillStyle = '#8a877f'; x.font = `600 18px ${MONO}`; x.fillText('CA ' + a.mint.slice(0, 22) + '…', 552, 486); }
    shFooter(x, W, H, mint);
  } else if (kind === 'invite' || kind === 'og') {
    shBg(x, W, H, gold);
    x.fillStyle = gold; x.font = `700 22px ${MONO}`; x.fillText(kind === 'og' ? 'SOLANA · PUMP.FUN · 3D' : t('ref_pass').toUpperCase(), 92, 130);
    const l1 = kind === 'og' ? 'Launch a coin.' : t('l2_h1a'), l2 = kind === 'og' ? 'Pull up a chair.' : t('l2_h1b'), l3 = kind === 'og' ? 'Ride the chart.' : t('l2_h1c');
    shText(x, l1, '900 {s}px Unbounded, sans-serif', 66, 620, 88, 220, '#ffffff', 30); shText(x, l2, '900 {s}px Unbounded, sans-serif', 66, 620, 88, 296, '#ffffff', 30);
    const gg = x.createLinearGradient(88, 0, 700, 0); gg.addColorStop(0, gold); gg.addColorStop(1, mint); shText(x, l3, '900 {s}px Unbounded, sans-serif', 66, 620, 88, 372, gg, 30);
    // the ticket
    x.save(); x.translate(800, kind === 'og' ? 100 : 150); x.rotate(0.05);
    x.fillStyle = '#efe6cf'; rr(x, 0, 0, 300, 380, 26); x.fill();
    x.fillStyle = '#0b0b0d'; x.font = '900 24px Unbounded, sans-serif'; x.fillText('TRENCH CAFE', 26, 56);
    x.fillStyle = '#6b6457'; x.font = `700 15px ${MONO}`; x.fillText(kind === 'og' ? 'MEMBER PASS' : t('ref_pass').toUpperCase(), 26, 84);
    x.setLineDash([8, 8]); x.strokeStyle = '#b9ad92'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 220); x.lineTo(280, 220); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#0b0b0d'; shText(x, kind === 'og' ? 'YOU' : myName(), '900 {s}px Unbounded, sans-serif', 38, 250, 26, 160, '#0b0b0d', 16);
    x.fillStyle = '#6b6457'; x.font = `700 15px ${MONO}`; x.fillText(kind === 'og' ? 'SEAT · ANY FREE DESK' : t('ref_lv', { n: lvlOf(xpState().xp) }).toUpperCase(), 26, 192);
    x.fillStyle = '#6b6457'; x.font = `700 14px ${MONO}`; x.fillText(kind === 'og' ? 'ENTRY' : t('ref_code').toUpperCase(), 26, 262);
    x.fillStyle = '#0b0b0d'; x.font = `800 ${kind === 'og' ? 40 : 44}px ${MONO}`; x.fillText(kind === 'og' ? 'FREE' : (d.code || 'TRENCH'), 26, 312);
    x.fillStyle = '#2f8a5a'; x.font = '800 18px Unbounded, sans-serif'; x.fillText(kind === 'og' ? '36 CARDS · 9 GAMES' : '+' + REF_WELCOME + ' XP', 26, 350);
    x.restore();
    if (kind === 'og') { x.fillStyle = '#bdb8ad'; x.font = '600 24px Onest, sans-serif'; x.fillText('A 3D net cafe where every desk is a live pump.fun coin.', 92, 446); }
    else { x.fillStyle = '#bdb8ad'; shText(x, t('sh_inv_line', { x: REF_WELCOME }), '600 {s}px Onest, sans-serif', 26, 640, 92, 446, '#bdb8ad', 16); }
    shFooter(x, W, H, gold);
  }
  return c;
}
const shTweet = (kind, d) => kind === 'card' ? t('sh_tx_card', { c: eggArt(EGGS[d.i])[6] || EGGS[d.i].title, r: t('r_' + eggRarity(EGGS[d.i])), n: eggsSeen().length, of: EGGS.length })
  : kind === 'rk' ? t('sh_tx_rk', { g: d.res.grade, game: rkName(d.res.game), s: d.res.score })
  : kind === 'coin' ? t('sh_tx_coin', { s: d.a.sym, ca: d.a.mint || '' })
  : t('sh_tx_inv');
async function openShare(kind, d) {
  const m = ensureModal('mShare', 'sh-sheet'); SH.kind = kind;
  if (kind === 'invite' && !REF.me) await refSync();
  m.querySelector('.soc-body').innerHTML = `<span class="g-eyebrow">${t('sh_eyebrow')}</span><h3>${t('sh_title_' + kind)}</h3>
    <div class="sh-prev"><div class="rk-spin"></div></div>
    <label class="sh-lab"><span>${t('sh_text')}</span><textarea class="in" id="shText" rows="3" maxlength="240"></textarea></label>
    <div class="rk-row"><button type="button" class="btn hot" id="shX" disabled>𝕏 ${t('sh_post')}</button><button type="button" class="btn" id="shSave" disabled>${t('sh_save')}</button><button type="button" class="btn" id="shCopy" disabled>${t('sh_copy')}</button></div>
    <p class="muted sh-hint" id="shHint">${t(TOUCH ? 'sh_hint_m' : 'sh_hint')}</p>`;
  showModal('mShare');
  SH.url = refLink(); SH.text = shTweet(kind, d); $('#shText').value = SH.text;
  $('#shText').addEventListener('keydown', ev => ev.stopPropagation());
  let c = await shDraw(kind, d), blob = null;
  try { blob = await new Promise(r => c.toBlob(r, 'image/png')); } catch (e) { blob = null; }
  if (!blob && kind === 'coin') { c = await shDraw(kind, { a: { ...d.a, image: '' } }); blob = await new Promise(r => c.toBlob(r, 'image/png')); }   // a picture from a host without CORS taints the canvas
  SH.blob = blob; SH.file = blob ? new File([blob], 'trench-cafe-' + kind + '.png', { type: 'image/png' }) : null;
  const pv = m.querySelector('.sh-prev'); if (pv) pv.innerHTML = blob ? `<img alt="" src="${URL.createObjectURL(blob)}">` : '';
  ['#shX', '#shSave', '#shCopy'].forEach(s => { const b = $(s); if (b) b.disabled = false; });
}
function shDownload() { if (!SH.blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(SH.blob); a.download = SH.file.name; document.body.appendChild(a); a.click(); a.remove(); }
async function shCopyImg() { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': SH.blob })]); return true; } catch (e) { return false; } }
document.addEventListener('click', async e => {
  const s = e.target.closest('[data-share]');
  if (s) {
    const k = s.dataset.share;
    if (k === 'card') openShare('card', { i: +s.dataset.i });
    else if (k === 'rk' && RK.shareRes) openShare('rk', { res: RK.shareRes });
    else if (k === 'coin') { const a = agents.find(x => x.mint === s.dataset.mint) || (s.dataset.mint ? { sym: s.dataset.sym || '', mint: s.dataset.mint, title: '', body: 'degen' } : null); if (a) openShare('coin', { a }); }
    else if (k === 'invite') openShare('invite', { code: REF.me && REF.me.code });
    return;
  }
  const hint = $('#shHint'), text = () => ($('#shText') ? $('#shText').value : SH.text).trim();
  if (e.target.closest('#shX')) {
    if (TOUCH && SH.file && navigator.canShare && navigator.canShare({ files: [SH.file] })) { try { await navigator.share({ files: [SH.file], text: text() + ' ' + SH.url }); return; } catch (err) { if (err && err.name === 'AbortError') return; } }
    const ok = SH.blob && await shCopyImg(); if (!ok) shDownload();
    window.open('https://x.com/intent/post?text=' + encodeURIComponent(text()) + '&url=' + encodeURIComponent(SH.url), '_blank', 'noopener');
    if (hint) { hint.textContent = ok ? t('sh_done_copy') : t('sh_done_save'); hint.classList.add('on'); }
    gainOnce('share', 30);
  }
  if (e.target.closest('#shSave')) { shDownload(); if (hint) { hint.textContent = t('sh_saved'); hint.classList.add('on'); } }
  if (e.target.closest('#shCopy')) { const ok = await shCopyImg(); if (hint) { hint.textContent = ok ? t('sh_copied') : t('sh_nocopy'); hint.classList.add('on'); } }
  const go = e.target.closest('[data-place-go]'); if (go) { closeModals(); walkTo(go.dataset.placeGo); }
});
function gainOnce(k, xp) { const s = dailyState(); if (s[k]) return; s[k] = true; store.set('cc_daily', s); gainXP(xp, k); }

/* ================= GWEI, the bartender ================= */
const BAR = { av: null, greetAt: 0, lineAt: 0, tipI: 0, portrait: '', typing: 0, near: false };
const BAR_POS = { x: -22.15, z: -6 };
const BAR_LOOK = { base: 'own', body: 'classic', build: 'normal', skin: '#c48a63', hair: 'short', hairCol: '#d9d4c7', eyes: 'stache', acc: 'none', top: 'suit', topCol: '#1a1724', pants: '#1a1724', shoes: '#0b0b0c', accent: '#c8a96a', emote: 'wave', photo: '', say: ['', '', ''] };
const DRINKS = ['Green Candle Latte', 'Diamond Hands Espresso', 'Liquidity Lemonade', 'Moon Mocha', 'Bonding Curve Cold Brew', 'Rug-Proof Cola', 'Gas Fee Ginger Ale'];
function buildBar() {
  try {
    const av = new Avatar('custom', { cls: 'npc barkeep', look: sanitizeLook(BAR_LOOK), noComp: true });
    av.obj.position.set(BAR_POS.x, 0.28, BAR_POS.z); add(scene, BOX(0.9, 0.28, 6.2), M(0x1a1714), BAR_POS.x, 0.14, BAR_POS.z);   // he stands on a step behind the counter av.obj.rotation.y = Math.PI / 2; av.state = 'idle'; av.tag.innerHTML = `<b>GWEI</b>`;
    const P = av.obj.userData.P, hand = P && P.armR && P.armR.userData.hand;
    if (hand) { add(hand, new THREE.CylinderGeometry(0.075, 0.06, 0.26, 14), METAL(0xd8d8de), 0, -0.12, 0.04); add(hand, new THREE.CylinderGeometry(0.05, 0.075, 0.08, 14), METAL(0xd8d8de), 0, 0.04, 0.04); }
    BAR.av = av;
  } catch (e) { console.warn('bartender', e); }
  // back-bar shelves with bottles on both sides of the menu board, and the bar sign
  const cols = [0x8fd3a6, 0xc8a96a, 0xd9707a, 0x9fc3ff, 0xe6dccb, 0x6b4a2e];
  for (const zc of [-8.45, -3.55]) {
    const sh = new THREE.Group(); sh.position.set(-ROOM.x + 0.22, 0, zc); scene.add(sh);
    add(sh, BOX(0.36, 2.6, 0.06), M(0x2a2420), 0.08, 2.4, -0.78); add(sh, BOX(0.36, 2.6, 0.06), M(0x2a2420), 0.08, 2.4, 0.78);
    [1.55, 2.25, 2.95, 3.65].forEach((y, r) => {
      add(sh, BOX(0.4, 0.05, 1.6), M(0x2a2420), 0.1, y, 0); add(sh, BOX(0.03, 0.03, 1.56), GLOW(0xe9c873, 0.6), 0.29, y + 0.03, 0);
      for (let k = 0; k < 4; k++) { const c = cols[(k + r * 2 + (zc > -6 ? 3 : 0)) % cols.length], h = 0.28 + ((k + r) % 3) * 0.05; const bt = add(sh, new THREE.CylinderGeometry(0.06, 0.07, h, 10), GLOW(c, 0.35), 0.1, y + 0.03 + h / 2, -0.54 + k * 0.36); add(bt, new THREE.CylinderGeometry(0.022, 0.028, 0.1, 8), M(0x1d1d1f), 0, h / 2 + 0.05, 0); }
    });
  }
  neonSign(scene, 'BAR · GWEI', '#e9c873', 3.2, 0.7, -ROOM.x + 0.08, 5.1, -6, Math.PI / 2, 90);
  const lt = new THREE.PointLight(0xffc98a, 10, 7, 1.6); lt.position.set(-20.4, 3.2, -6); scene.add(lt);
  place('bar', -20.6, -6, 2.1, [-18.6, -6]);
}
/* the big weekly board in the square, mirrored to the quest board on the other side of the door */
function buildWeekBoard() {
  const g = new THREE.Group(); g.position.set(-13.6, 0, 23); g.rotation.y = 0.12; scene.add(g);
  const tex = canvasTex(1024, 560, ctx => { ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 1024, 560); }); townFx.weekTex = tex;
  for (const s of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.12, 0.14, 4.6, 10), M(0x1d1d1f), s * 2.95, 2.3, 0); add(g, SPH(0.16, 10, 8), GLOW(0xe9c873, 1.2), s * 2.95, 4.65, 0); }
  add(g, RBOX(6.0, 3.4, 0.22, 0.08), M(0x0c0c0e, { roughness: 0.4 }), 0, 2.75, 0);
  for (const sgn of [1, -1]) { const p = add(g, new THREE.PlaneGeometry(5.7, 3.12), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 2.75, sgn * 0.12); if (sgn < 0) p.rotation.y = Math.PI; }
  for (const y of [1.03, 4.47]) add(g, BOX(6.0, 0.05, 0.26), GLOW(0xe9c873, 1.3), 0, y, 0);
  g.traverse(o => o.userData.place = 'week'); pickables.push(g);
  colliders.push({ minx: -16.7, maxx: -10.5, minz: 22.3, maxz: 23.7, h: 4.6 });
  place('week', -13.6, 23, 3.2, [-13.2, 20.9]);
}
buildBar(); buildWeekBoard();
MAP_PLACES.push('week', 'bar'); MAP_COL.week = '#e9c873'; MAP_COL.bar = '#d9707a';

function barPortrait() {
  if (BAR.portrait) return BAR.portrait;
  try {
    const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); tr.setPixelRatio(1); tr.setSize(240, 240); tr.toneMapping = THREE.ACESFilmicToneMapping;
    const ts = new THREE.Scene(); ts.add(new THREE.HemisphereLight(0xe4ded4, 0x1e1c1a, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 4); ts.add(dl);
    const o = buildChar('custom', null, sanitizeLook(BAR_LOOK)); o.rotation.y = 0.3; ts.add(o); o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const tc = new THREE.PerspectiveCamera(30, 1, 0.1, 50); tc.position.set(ctr.x, ctr.y + size.y * 0.22, ctr.z + size.y * 1.45); tc.lookAt(ctr.x, ctr.y + size.y * 0.2, ctr.z);
    tr.render(ts, tc); BAR.portrait = tr.domElement.toDataURL('image/png'); tr.dispose(); try { tr.forceContextLoss(); } catch (e) { }
  } catch (e) { BAR.portrait = TH('degen'); }
  return BAR.portrait;
}
function barTips() {   // what to do next, in the order a new player needs it
  const ds = dailyState(), seen = eggsSeen().length, tips = [];
  if (!agents.some(a => isMyCoin(a))) tips.push(t('bar_tip_launch'));
  if (!ds.rk) tips.push(t('bar_tip_arcade'));
  if (!ds.cs) tips.push(t('bar_tip_casino'));
  if (seen < EGGS.length) tips.push(t('bar_tip_cards', { n: EGGS.length - seen }));
  if (!(REF.me && REF.me.invited)) tips.push(t('bar_tip_invite', { x: REF_XP }));
  tips.push(t('bar_tip_week'), t('bar_tip_league'), t('bar_tip_map'));
  return tips;
}
function barSay(txt) {
  const el = $('#barSay'); if (BAR.av) BAR.av.say(txt, 5);
  if (!el) return; clearInterval(BAR.typing); el.textContent = ''; let i = 0;
  BAR.typing = setInterval(() => { i += 2; el.textContent = txt.slice(0, i); if (i >= txt.length) clearInterval(BAR.typing); }, 16);
}
function barTasksHTML() {
  const ds = dailyState(), seen = eggsSeen().length, n = REF.me ? REF.me.invited : 0;
  const row = (done, txt, xp, go) => `<li class="${done ? 'done' : ''}"><i></i><span>${txt}</span><b>${done ? '✓' : xp}</b>${!done && go ? `<button type="button" class="btn small" data-bar-go="${go}">${t('bar_go')}</button>` : ''}</li>`;
  return `<ul class="bar-tasks">${row(ds.dr, t('tr_bar'), '+25', 'drink')}${row(ds.rk, t('tr_arcade'), '+50', 'arcade')}${row(ds.cs, t('tr_casino'), '+50', 'casino')}${row(ds.share, t('tr_share'), '+30', 'share')}${row(seen >= EGGS.length, t('tr_stories'), `${seen}/${EGGS.length}`, 'album')}${row(false, t('tr_invite'), `${n} · +${REF_XP}`, 'invite')}</ul>`;
}
function openBar(view) {
  const m = ensureModal('mBar', 'bar-sheet'); const ds = dailyState();
  m.querySelector('.soc-body').innerHTML = `<div class="bar-top"><div class="bar-port"><img alt="" src="${barPortrait()}"></div><div><span class="g-eyebrow">${t('bar_eyebrow')}</span><h3>GWEI</h3><p class="sub">${t('bar_role')}</p></div></div>
    <div class="bar-bubble"><span id="barSay"></span></div>
    <div class="bar-acts"><button type="button" data-bar="tip"><i>💡</i>${t('bar_b_tip')}</button><button type="button" data-bar="tasks"><i>📋</i>${t('bar_b_tasks')}</button><button type="button" data-bar="joke"><i>🎲</i>${t('bar_b_joke')}</button>
      <button type="button" data-bar="drink" class="hot" ${ds.dr ? 'disabled' : ''}><i>🍸</i>${ds.dr ? t('bar_b_drunk') : t('bar_b_drink', { x: 25 })}</button>
      <button type="button" data-bk="espresso" class="wide"><i>☕</i>${espressoOn() ? t('bk_esp_on', { m: Math.ceil((+store.get('cc_esp_until', 0) - Date.now()) / 60e3) }) : t('bar_b_esp', { n: 400 })}</button></div>
    <div id="barOut"></div>`;
  showModal('mBar');
  if (view === 'tasks') { $('#barOut').innerHTML = barTasksHTML(); barSay(t('bar_tasks_line')); }
  else barSay(pick(t('bar_hi')).replace('{n}', myName()));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-bar]');
  if (b) {
    const k = b.dataset.bar, out = $('#barOut');
    if (k === 'tip') { const tips = barTips(); barSay(tips[BAR.tipI++ % tips.length]); if (out) out.innerHTML = ''; }
    if (k === 'joke') { barSay(pick(t('bar_jokes'))); if (out) out.innerHTML = ''; if (BAR.av) BAR.av.emote(); }
    if (k === 'tasks') { if (out) out.innerHTML = barTasksHTML(); barSay(t('bar_tasks_line')); }
    if (k === 'drink') {
      const s = dailyState(); if (s.dr) return; s.dr = true; store.set('cc_daily', s);
      const d = pick(DRINKS); barSay(t('bar_drink_line', { d })); gainXP(25, 'bar'); sfx('coin'); renderTrack();
      if (BAR.av) BAR.av.emote(); if (player) { player.emote(); confetti(_w.copy(player.obj.position).setY(1.7), 16); }
      b.disabled = true; b.innerHTML = `<i>🍸</i>${t('bar_b_drunk')}`; if (out && out.querySelector('.bar-tasks')) out.innerHTML = barTasksHTML();
    }
    return;
  }
  const g = e.target.closest('[data-bar-go]'); if (!g) return;
  const k = g.dataset.barGo;
  if (k === 'drink') { const d = $('[data-bar="drink"]'); if (d) d.click(); return; }
  closeModals();
  if (k === 'arcade' || k === 'casino') walkTo(k); else if (k === 'album') openAlbum(); else if (k === 'invite') openInvite(); else if (k === 'share') openInvite();
});

/* ================= buyback: part of the cafe's income buys the main token back (and burns it) ================= */
const BBK = { v: null, at: 0 };
async function buybackFetch(force) {
  if (!NET.http || (!force && Date.now() - BBK.at < 180e3)) return BBK.v;
  BBK.at = Date.now(); try { const r = await fetch(NET.http + '/api/buyback'); if (r.ok) BBK.v = await r.json(); } catch (e) { }
  return BBK.v;
}
function tokAmt(raw, dec) {
  let n = 0; try { n = Number(BigInt(raw || '0')) / Math.pow(10, dec ?? 6); } catch (e) { }
  return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
}
const bbSym = () => (NET.cfg && NET.cfg.payToken && BBK.v && NET.cfg.payToken.mint === BBK.v.mint && NET.cfg.payToken.symbol ? '$' + NET.cfg.payToken.symbol : t('bb_token'));
function buybackHTML() {
  const v = BBK.v; if (!v || !v.on) return '';
  const burn = v.mode === 'burn', solscan = s => 'https://solscan.io/tx/' + encodeURIComponent(s);
  return `<div class="bb-box"><div class="bb-h"><b>🔥 ${t(burn ? 'bb_title' : 'bb_title_hold')}</b><span>${t('bb_sub', { p: Math.round(v.share * 100), s: bbSym() })}${burn ? t('bb_burn_tail') : ''}</span></div>
    <div class="inv-stats"><div><small>${t('bb_spent')}</small><b>${(+v.sol || 0).toFixed(2)} SOL</b></div><div><small>${t('bb_bought')}</small><b>${tokAmt(v.bought, v.decimals)}</b></div><div><small>${t(burn ? 'bb_burned' : 'bb_held')}</small><b>${tokAmt(burn ? v.burned : v.bought, v.decimals)}</b></div></div>
    ${v.buys && v.buys.length ? `<ul class="bk-log">${v.buys.slice(0, 5).map(b => `<li><span><a href="${solscan(b.sig)}" target="_blank" rel="noopener">${(+b.sol).toFixed(3)} SOL → ${tokAmt(b.bought, v.decimals)}</a></span><small>${ago(b.at)}</small><b>${b.burnSig ? '🔥' : ''}</b></li>`).join('')}</ul>` : ''}
    <p class="muted bb-wallet">${t('bb_wallet')}: <a href="https://solscan.io/account/${esc(v.wallet)}" target="_blank" rel="noopener">${esc(shortW(v.wallet))}</a></p></div>`;
}
function onBuyback(m) {
  toast(t('bb_toast', { s: (+m.sol || 0).toFixed(3), n: tokAmt(m.bought, m.decimals), t: bbSym() }), 'gold', true); sfx('coin');
  buybackFetch(true).then(() => { if ($('#mWeek') && !$('#mWeek').hidden) openWeek(true); });
}

/* ================= the weekly board: launches, arcade runs, recruiters ================= */
function weekCols() {
  const coins = LG.view ? LG.view.coins.filter(c => c.peak > 0 || c.trades > 0 || c.pool > 0) : [];
  const runs = RK.top3d && RK.top3d.top ? RK.top3d.top : [];
  const recs = REF.top && REF.top.top ? REF.top.top : [];
  return { coins, runs, recs };
}
function drawWeekBoard() {
  const tex = townFx.weekTex; if (!tex) return;
  const x = tex.userData.ctx, W = 1024, H = 560, { coins, runs, recs } = weekCols();
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#111014'); g.addColorStop(1, '#09090b'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#e9c873'; rr(x, 0, 0, W, 78, 0); x.fill();
  x.fillStyle = '#0b0b0d'; x.textAlign = 'left'; x.textBaseline = 'middle';
  const title = t('wk_title').toUpperCase(); const ts = fitText(x, title, '900 {s}px Unbounded, sans-serif', 34, 600, 18); x.font = `900 ${ts}px Unbounded, sans-serif`; x.fillText(title, 28, 41);
  x.textAlign = 'right'; x.font = `800 19px ${MONO}`; x.fillText((LG.view ? 'W' + lgWeekNo() + ' · ' : '') + (LG.view ? lgCountdown() : t('wk_soon')), W - 28, 41);
  x.textBaseline = 'alphabetic';
  const cols = [[t('wk_launch'), '#8fd3a6', coins.slice(0, 5).map(c => [('$' + c.sym).slice(0, 11), fmtUsd(c.peak), c])], [t('wk_arcade'), '#b98cff', runs.slice(0, 5).map(r => [(r.n || shortW(r.w)).slice(0, 12), String(r.s)])], [t('wk_recruit'), '#e9c873', recs.slice(0, 5).map(r => [String(r.nick).slice(0, 12), '+' + r.n])]];
  cols.forEach(([head, col, rows], ci) => {
    const X = 24 + ci * 333, Wc = 310;
    x.fillStyle = 'rgba(255,255,255,.04)'; rr(x, X, 98, Wc, 420, 18); x.fill(); x.strokeStyle = col + '55'; x.lineWidth = 2; rr(x, X, 98, Wc, 420, 18); x.stroke();
    x.fillStyle = col; x.textAlign = 'left'; const hs = fitText(x, head.toUpperCase(), '800 {s}px Unbounded, sans-serif', 20, Wc - 36, 12); x.font = `800 ${hs}px Unbounded, sans-serif`; x.fillText(head.toUpperCase(), X + 18, 136);
    if (!rows.length) { x.fillStyle = 'rgba(255,255,255,.4)'; x.font = `600 17px ${MONO}`; x.fillText(t('wk_empty'), X + 18, 190); x.fillStyle = col; x.font = '800 16px Unbounded, sans-serif'; x.fillText(t('wk_empty_go'), X + 18, 220); return; }
    rows.forEach(([name, val, c], i) => {
      const y = 186 + i * 66;
      x.fillStyle = i === 0 ? '#e9c873' : i === 1 ? '#c9ccd6' : i === 2 ? '#c99a5c' : '#2c2a34'; x.beginPath(); x.arc(X + 34, y - 8, 17, 0, 7); x.fill();
      x.fillStyle = i < 3 ? '#0b0b0d' : '#ece9e2'; x.font = '800 16px Unbounded, sans-serif'; x.textAlign = 'center'; x.fillText(i + 1, X + 34, y - 2); x.textAlign = 'left';
      let nx = X + 62; if (c) { const a = agents.find(q => q.mint === c.mint); if (a) { coinThumb(x, a, nx, y - 30, 40, 9); nx += 50; } }
      const vs = 22; x.font = `800 ${vs}px ${MONO}`; const vw = x.measureText(val).width;
      const ns = fitText(x, name, `700 {s}px ${MONO}`, 21, X + Wc - 18 - vw - 12 - nx, 12); x.font = `700 ${ns}px ${MONO}`; x.fillStyle = '#ece9e2'; x.fillText(name, nx, y);
      x.font = `800 ${vs}px ${MONO}`; x.fillStyle = col; x.textAlign = 'right'; x.fillText(val, X + Wc - 18, y); x.textAlign = 'left';
    });
  });
  const champ = LG.view && LG.view.champs && LG.view.champs[0];
  x.fillStyle = '#8a877f'; x.font = `600 17px ${MONO}`; x.textAlign = 'left';
  x.fillText(champ ? t('wk_champ', { s: champ.sym, m: fmtUsd(champ.peak) }) : t('wk_foot'), 28, 546);
  const bb = BBK.v; if (bb && bb.on) { x.fillStyle = '#ff9a5a'; x.font = `800 17px ${MONO}`; x.textAlign = 'right'; x.fillText(t(bb.mode === 'burn' ? 'bb_board' : 'bb_board_hold', { s: (+bb.sol || 0).toFixed(2), n: tokAmt(bb.mode === 'burn' ? bb.burned : bb.bought, bb.decimals) }), W - 28, 546); x.textAlign = 'left'; }
  tex.needsUpdate = true;
}
function openWeek(fresh) {
  const m = ensureModal('mWeek', 'wk-sheet'); const { coins, runs, recs } = weekCols();
  const list = (rows, fn) => rows.length ? `<ol class="wk-list">${rows.slice(0, 10).map((r, i) => `<li><span class="n">${i + 1}</span>${fn(r)}</li>`).join('')}</ol>` : `<p class="muted">${t('wk_empty')}</p>`;
  m.querySelector('.soc-body').innerHTML = `<span class="g-eyebrow">${LG.view ? 'W' + lgWeekNo() + ' · ' + lgCountdown() : t('wk_soon')}</span><h3>${t('wk_title')}</h3><p class="sub">${t('wk_sub')}</p>
    <div class="wk-cols">
      <div class="wk-col" style="--wc:#8fd3a6"><h4>${t('wk_launch')}</h4>${list(coins, c => { const a = agents.find(q => q.mint === c.mint); return `<button type="button" class="wk-nm" ${a ? `data-agent="${a.id}"` : ''}><img alt="" src="${esc(c.image || TH(c.body))}">$${esc(c.sym)}</button><b>${fmtUsd(c.peak)}</b>`; })}<button type="button" class="btn small hot" data-place-go="launchpad">${t('launch')}</button></div>
      <div class="wk-col" style="--wc:#b98cff"><h4>${t('wk_arcade')}</h4>${list(runs, r => `<span class="wk-nm">${esc(r.n || shortW(r.w))}</span><b>${r.s}</b>`)}<button type="button" class="btn small" data-place-go="arcade">${t('mp_arcade')}</button></div>
      <div class="wk-col" style="--wc:#e9c873"><h4>${t('wk_recruit')}</h4>${list(recs, r => `<span class="wk-nm">${esc(r.nick)}</span><b>+${r.n}</b>`)}<button type="button" class="btn small" data-open-invite>${t('ref_title')}</button></div>
    </div>${buybackHTML()}`;
  showModal('mWeek');
  const stamp = (LG.at || 0) + ':' + (REF.top ? REF.topAt : 0) + ':' + (RK.top3dAt || 0) + ':' + BBK.at;
  if (!fresh) Promise.all([leagueFetch(), refTopFetch(), buybackFetch()]).then(() => { const now = (LG.at || 0) + ':' + (REF.top ? REF.topAt : 0) + ':' + (RK.top3dAt || 0); if (now + ':' + BBK.at !== stamp && !$('#mWeek').hidden) openWeek(true); });
}
document.addEventListener('click', e => { if (e.target.closest('[data-open-invite]')) openInvite(); });

/* ================= music: a slow lo-fi loop made of oscillators, plus the room around you ================= */
const MUS = { on: store.get('cc_music', true), a: null, out: null, lp: null, bus: null, ep: null, amb: null, mur: null, wind: null, next: 0, step: 0, bar: 0, prog: 0, tm: 0, white: null, brown: null, inside: true, ambAt: 0 };
const BPM = 72, S16 = 60 / BPM / 4;
const PROGS = [
  [[41, 57, 60, 64, 67], [40, 55, 59, 62, 64], [38, 57, 60, 62, 65], [36, 55, 59, 62, 64]],
  [[38, 53, 57, 60, 64], [43, 53, 57, 59, 64], [36, 55, 59, 62, 64], [45, 55, 60, 64, 67]],
  [[45, 55, 60, 64, 67], [41, 57, 60, 64, 67], [43, 55, 59, 62, 65], [40, 55, 59, 62, 67]],
  [[36, 55, 59, 64, 69], [33, 55, 60, 64, 67], [38, 57, 60, 65, 69], [43, 53, 59, 62, 65]]
];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function musBuffers(a) {
  const w = a.createBuffer(1, a.sampleRate, a.sampleRate), d = w.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const b = a.createBuffer(1, a.sampleRate * 4, a.sampleRate), e = b.getChannelData(0); let l = 0; for (let i = 0; i < e.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = l * 3.5; }
  const c = a.createBuffer(1, a.sampleRate * 3, a.sampleRate), f = c.getChannelData(0); for (let i = 0; i < f.length; i++) f[i] = (Math.random() * 2 - 1) * 0.04 + (Math.random() < 0.00035 ? (Math.random() * 2 - 1) * 0.9 : 0);
  const ir = a.createBuffer(2, a.sampleRate * 2.4, a.sampleRate); for (let ch = 0; ch < 2; ch++) { const r = ir.getChannelData(ch); for (let i = 0; i < r.length; i++) r[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / r.length, 2.6); }
  return { w, b, c, ir };
}
function musInit(off) {
  if (MUS.a && !off) return true;
  try {
    if (!off) sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)(); const a = MUS.a = off || sfxCtx;
    const B = musBuffers(a); MUS.white = B.w; MUS.brown = B.b;
    MUS.out = a.createGain(); MUS.out.gain.value = 0; MUS.out.connect(a.destination);
    MUS.lp = a.createBiquadFilter(); MUS.lp.type = 'lowpass'; MUS.lp.frequency.value = 4200; MUS.lp.Q.value = 0.3; MUS.lp.connect(MUS.out);
    MUS.bus = a.createGain(); MUS.bus.gain.value = 0.62; MUS.bus.connect(MUS.lp);
    const rev = a.createConvolver(); rev.buffer = B.ir; const wet = a.createGain(); wet.gain.value = 0.22; MUS.bus.connect(rev); rev.connect(wet); wet.connect(MUS.lp);
    MUS.ep = a.createGain(); MUS.ep.gain.value = 1; MUS.ep.connect(MUS.bus);   // electric piano with a slow tremolo
    const trem = a.createOscillator(), td = a.createGain(); trem.frequency.value = 4.2; td.gain.value = 0.18; trem.connect(td); td.connect(MUS.ep.gain); trem.start();
    MUS.dly = a.createDelay(1); MUS.dly.delayTime.value = S16 * 3; const fb = a.createGain(); fb.gain.value = 0.32; const dw = a.createGain(); dw.gain.value = 0.35; MUS.dly.connect(fb); fb.connect(MUS.dly); MUS.dly.connect(dw); dw.connect(MUS.bus);
    const cr = a.createBufferSource(); cr.buffer = B.c; cr.loop = true; const crh = a.createBiquadFilter(); crh.type = 'highpass'; crh.frequency.value = 1400; const crg = a.createGain(); crg.gain.value = 0.35; cr.connect(crh); crh.connect(crg); crg.connect(MUS.lp); cr.start();
    // the room: murmur inside, wind outside
    MUS.amb = a.createGain(); MUS.amb.gain.value = 1; MUS.amb.connect(MUS.out);
    const mk = (f, q, g) => { const s = a.createBufferSource(); s.buffer = MUS.brown; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4; const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const gn = a.createGain(); gn.gain.value = 0; s.connect(bp); bp.connect(gn); gn.connect(MUS.amb); s.start(); const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.07 + Math.random() * 0.1; lg.gain.value = g * 0.35; lfo.connect(lg); lg.connect(gn.gain); lfo.start(); return { gn, g }; };
    MUS.mur = [mk(380, 0.9, 0.22), mk(1050, 1.6, 0.08)];
    { const s = a.createBufferSource(); s.buffer = MUS.brown; s.loop = true; s.playbackRate.value = 0.5; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const gn = a.createGain(); gn.gain.value = 0; s.connect(lp); lp.connect(gn); gn.connect(MUS.amb); s.start(); MUS.wind = { gn, g: 0.2 }; }
    if (!off) document.addEventListener('visibilitychange', () => { if (!MUS.a) return; if (document.hidden) MUS.a.suspend().catch(() => { }); else { MUS.a.resume().catch(() => { }); MUS.next = MUS.a.currentTime + 0.1; } });
    return true;
  } catch (e) { console.warn('music', e); MUS.a = null; return false; }
}
function musEnv(g, at, peak, a, d, sus, rel) { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), at + a + d); g.gain.exponentialRampToValueAtTime(0.0001, at + a + d + rel); }
function musEP(note, at, dur, vel) {
  const a = MUS.a, g = a.createGain(), f = mtof(note);
  const o1 = a.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
  const o2 = a.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2.003; const g2 = a.createGain(); g2.gain.value = 0.12;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(MUS.ep); musEnv(g, at, 0.07 * vel, 0.012, 0.6, 0.35, dur);
  o1.start(at); o2.start(at); o1.stop(at + dur + 0.7); o2.stop(at + dur + 0.7);
}
function musBass(note, at, dur) {
  const a = MUS.a, o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mtof(note); lp.type = 'lowpass'; lp.frequency.value = 380;
  o.connect(lp); lp.connect(g); g.connect(MUS.bus); musEnv(g, at, 0.2, 0.02, 0.3, 0.6, dur); o.start(at); o.stop(at + dur + 0.4);
}
function musLead(note, at) {
  const a = MUS.a, o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mtof(note); lp.type = 'lowpass'; lp.frequency.value = 2200;
  o.connect(lp); lp.connect(g); g.connect(MUS.bus); g.connect(MUS.dly); musEnv(g, at, 0.045, 0.01, 0.25, 0.3, 0.5); o.start(at); o.stop(at + 1);
}
function musNoise(at, type, f, q, peak, dec) {
  const a = MUS.a, s = a.createBufferSource(), bf = a.createBiquadFilter(), g = a.createGain(); s.buffer = MUS.white; s.playbackRate.value = 1; bf.type = type; bf.frequency.value = f; bf.Q.value = q;
  s.connect(bf); bf.connect(g); g.connect(MUS.bus); g.gain.setValueAtTime(peak, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dec); s.start(at, Math.random() * 0.5); s.stop(at + dec + 0.02);
}
function musKick(at, v) { const a = MUS.a, o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(115, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.13); o.connect(g); g.connect(MUS.bus); g.gain.setValueAtTime(0.42 * v, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32); o.start(at); o.stop(at + 0.35); }
function musSnare(at, v) { musNoise(at, 'bandpass', 1800, 0.7, 0.09 * v, 0.2); const a = MUS.a, o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = 190; o.connect(g); g.connect(MUS.bus); g.gain.setValueAtTime(0.05 * v, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.08); o.start(at); o.stop(at + 0.1); }
function musStep(step, at) {
  const s = step % 16, barN = Math.floor(step / 16), prog = PROGS[MUS.prog], ch = prog[barN % 4];
  if (s === 0 && barN % 8 === 0 && barN > 0) MUS.prog = Math.random() < 0.6 ? (MUS.prog + 1) % PROGS.length : Math.floor(Math.random() * PROGS.length);
  const brk = barN % 16 >= 14, intro = barN < 2, swing = (s % 4 === 2) ? S16 * 0.3 : 0, t0 = at + swing + (Math.random() - 0.5) * 0.008;
  if (s === 0) { ch.slice(1).forEach((n, i) => musEP(n, at + i * 0.018, S16 * 14, 0.9 + Math.random() * 0.2)); musBass(ch[0], at, S16 * 6); }
  if (s === 10 && Math.random() < 0.45) ch.slice(2).forEach((n, i) => musEP(n, t0 + i * 0.015, S16 * 5, 0.55));
  if (s === 8) musBass(Math.random() < 0.7 ? ch[0] : ch[0] + 7, t0, S16 * 5);
  if (s === 14 && Math.random() < 0.3) musBass(ch[0] + (Math.random() < 0.5 ? 2 : -2), t0, S16 * 2);
  if (!intro && !brk) {
    if (s === 0 || (s === 10 && Math.random() < 0.8) || (s === 7 && Math.random() < 0.25)) musKick(t0, s === 0 ? 1 : 0.8);
    if (s === 4 || s === 12) musSnare(t0, 1);
    if (s % 2 === 0) musNoise(t0, 'highpass', 7200, 0.5, (s % 4 === 0 ? 0.03 : 0.018) * (0.7 + Math.random() * 0.5), 0.045);
  } else if (s % 4 === 0) musNoise(t0, 'highpass', 7200, 0.5, 0.012, 0.04);
  if (s % 2 === 0 && barN % 2 === 1 && Math.random() < 0.22) { const pool = ch.slice(2).map(n => n + 12); musLead(pick(pool), t0); }
}
function musPump() {
  if (!MUS.a || !MUS.on) return;
  const a = MUS.a, now = a.currentTime;
  if (MUS.next < now - 0.2) MUS.next = now + 0.05;
  while (MUS.next < now + 0.3) { musStep(MUS.step, MUS.next); MUS.next += S16; MUS.step++; }
  // the room around you
  const inside = player ? isInside(player.obj.position) : true, busy = modalOpen() || !!gameActive;
  MUS.lp.frequency.setTargetAtTime(busy ? 1300 : inside ? 4200 : 1900, now, 0.4);
  MUS.bus.gain.setTargetAtTime(busy ? 0.4 : inside ? 0.62 : 0.4, now, 0.5);
  MUS.mur.forEach(m => m.gn.gain.setTargetAtTime(inside && !busy ? m.g : inside ? m.g * 0.4 : 0.0, now, 0.8));
  MUS.wind.gn.gain.setTargetAtTime(!inside && !busy ? MUS.wind.g : 0, now, 1);
  if (now > MUS.ambAt) {
    MUS.ambAt = now + 3 + Math.random() * 7;
    if (inside && !busy) {
      if (Math.random() < 0.5) { const n = 4 + Math.floor(Math.random() * 10); for (let i = 0; i < n; i++) ambClick(now + 0.1 + i * (0.07 + Math.random() * 0.08)); }   // somebody typing at a desk
      else { const f = 2400 + Math.random() * 1200; ambPing(now + 0.1, f); if (Math.random() < 0.6) ambPing(now + 0.22, f * 1.07); }   // glasses at the bar
    } else if (!inside && !busy && Math.random() < 0.6) { const f = 4300 + Math.random() * 500; for (let i = 0; i < 3; i++) ambPing(now + 0.1 + i * 0.09, f, 0.006, 0.05); }   // crickets
  }
}
function ambClick(at) { const a = MUS.a, s = a.createBufferSource(), bf = a.createBiquadFilter(), g = a.createGain(); s.buffer = MUS.white; bf.type = 'highpass'; bf.frequency.value = 2600; s.connect(bf); bf.connect(g); g.connect(MUS.amb); g.gain.setValueAtTime(0.03, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.018); s.start(at, Math.random() * 0.5); s.stop(at + 0.03); }
function ambPing(at, f, peak = 0.02, dec = 0.5) { const a = MUS.a, o = a.createOscillator(), g = a.createGain(); o.frequency.value = f; o.connect(g); g.connect(MUS.amb); g.gain.setValueAtTime(peak, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dec); o.start(at); o.stop(at + dec + 0.05); }
function musStart() {
  if (!MUS.on || !musInit()) return;
  const a = MUS.a; if (a.state === 'suspended') a.resume().catch(() => { });
  if (!MUS.tm) { MUS.next = a.currentTime + 0.15; MUS.tm = setInterval(musPump, 60); }
  MUS.out.gain.cancelScheduledValues(a.currentTime); MUS.out.gain.setTargetAtTime(1.1, a.currentTime, 1.2);
}
function musStop() { if (!MUS.a) return; const a = MUS.a; MUS.out.gain.cancelScheduledValues(a.currentTime); MUS.out.gain.setTargetAtTime(0, a.currentTime, 0.25); setTimeout(() => { if (!MUS.on) { clearInterval(MUS.tm); MUS.tm = 0; } }, 900); }
function musToggle() {
  MUS.on = !MUS.on; store.set('cc_music', MUS.on);
  if (MUS.on) musStart(); else musStop();
  const b = document.querySelector('[data-hot="music"]'); if (b) { b.classList.toggle('off', !MUS.on); b.title = t(MUS.on ? 'gui_music_on' : 'gui_music_off'); }
  toast(t(MUS.on ? 'gui_music_on' : 'gui_music_off'));
}
addEventListener('pointerdown', () => { if (playing && MUS.on && (!MUS.tm || (MUS.a && MUS.a.state === 'suspended'))) musStart(); }, { passive: true });

/* ================= per frame ================= */
let socAt = 0, socLast = 0, socRefAt = 0;
function socialTick(time) {
  const dt = Math.min(0.1, Math.max(0, time - socLast)); socLast = time;
  const av = BAR.av;
  if (av) {
    const show = camMode === 'play' || camMode === 'cine';
    placeTag(av.tag, _w.copy(av.obj.position).setY(av.obj.position.y + av.tagH), show ? (TOUCH ? 11 : 14) : 0);
    if (player && playing) {
      const p = player.obj.position, d = Math.hypot(p.x - BAR_POS.x, p.z - BAR_POS.z);
      const want = d < 8 && isInside(p) ? Math.max(Math.PI / 2 - 1.1, Math.min(Math.PI / 2 + 1.1, Math.atan2(p.x - BAR_POS.x, p.z - BAR_POS.z))) : Math.PI / 2;
      av.obj.rotation.y = lerpAngle(av.obj.rotation.y, want, Math.min(1, dt * 4));
      if (d < 5.5 && !BAR.near && Date.now() - BAR.greetAt > 45e3) { BAR.greetAt = Date.now(); av.say(pick(t('bar_hi')).replace('{n}', myName()), 4.5); }
      BAR.near = d < 5.5;
      if (d < 12 && Date.now() - BAR.lineAt > 26e3 && !BAR.near) { BAR.lineAt = Date.now(); if (Math.random() < 0.5) av.say(pick(t('bar_jokes')), 5); }
    }
  }
  if (!playing) return;
  if (MUS.on && !MUS.tm) musStart();
  if (time - socAt > 8) { socAt = time; drawWeekBoard(); refTopFetch(); buybackFetch(); }
  if (Date.now() - socRefAt > 240e3) { socRefAt = Date.now(); refSync(); }
  bankTick();
}
async function musLevels(sec = 20, inside = true) {   // test hook: renders the loop offline and reports peak/RMS
  const keep = { ...MUS }, off = new OfflineAudioContext(2, 44100 * sec, 44100);
  musInit(off); MUS.out.gain.value = 0.9; MUS.mur.forEach(m => m.gn.gain.value = inside ? m.g : 0); MUS.wind.gn.gain.value = inside ? 0 : MUS.wind.g;
  let tt = 0.05, st = 0; while (tt < sec - 0.5) { musStep(st++, tt); tt += S16; }
  const buf = await off.startRendering(); Object.assign(MUS, keep);
  let pk = 0, sum = 0; const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; sum += v * v; }
  return { peak: +pk.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4) };
}
Object.assign(window.__cc, { BBK, buybackHTML, LG, musLevels, openBar, openInvite, openShare, openWeek, drawWeekBoard, shDraw, musToggle, refSync, MUS, REF, BAR });
