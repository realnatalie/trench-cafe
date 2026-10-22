/* ================= TRENCH LEAGUE (client) =================
   Every coin launched here is an agent in the weekly league. Back an agent with chips; when the week ends the backers of the
   agent with the highest market cap split the whole pool, its launcher takes a cut and a trophy in the vault. Chips only. */
const LG = { view: null, at: 0, loading: null };
async function leagueFetch(force) {
  if (!NET.http) return null;
  if (!force && LG.view && Date.now() - LG.at < 60e3) return LG.view;
  if (LG.loading) return LG.loading;
  LG.loading = (async () => { try { const r = await fetch(NET.http + '/api/league?token=' + encodeURIComponent(NET.token || '')); if (r.ok) { LG.view = await r.json(); LG.at = Date.now(); } } catch (e) { } LG.loading = null; return LG.view; })();
  return LG.loading;
}
const lgCoin = mint => (LG.view && LG.view.coins.find(c => c.mint === mint)) || null;
const lgRank = mint => LG.view ? LG.view.coins.findIndex(c => c.mint === mint) + 1 : 0;
const fmtUsd = n => !(n > 0) ? '—' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n);
function lgCountdown() { const ms = LG.view ? LG.view.endsAt - Date.now() : 0; const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5); return d > 0 ? t('lg_ends_d', { d, h }) : t('lg_ends_h', { h: Math.max(0, h), m: Math.max(0, Math.floor(ms % 36e5 / 6e4)) }); }
const lgWeekNo = () => LG.view ? LG.view.week.split('W')[1] : '';
/* the block in a coin's panel */
function leagueBoothHTML(a) {
  const c = lgCoin(a.mint), v = LG.view, rules = (v && v.rules) || { min: 50, cut: 0.1, royalty: 5, royaltyCap: 200 };
  const n = v ? v.coins.length : 0, r = lgRank(a.mint);
  const stats = c ? `<div class="lg-stats"><div><small>${t('lg_peak')}</small><b>${fmtUsd(c.peak)}</b></div><div><small>${t('lg_pool')}</small><b>${fmtChips(c.pool)}</b><i>${t('lg_backers', { n: c.backers })}</i></div><div><small>${t('lg_t')}</small><b>${r ? t('lg_rank', { r, n }) : '—'}</b><i>${t('lg_trades', { n: c.trades })}</i></div></div>` : `<p class="muted">${v ? t('lg_empty') : '…'}</p>`;
  const mine = c && c.mine ? `<p class="lg-mine">${t('lg_mine', { n: fmtChips(c.mine) })}</p>` : '';
  const btns = csServer() ? `<div class="rk-row">${[100, 500, 1000].map(k => `<button type="button" class="btn small ${k === 100 ? 'hot' : ''}" data-lg-back="${esc(a.mint)}" data-n="${k}">${t('lg_back', { n: fmtChips(k) })}</button>`).join('')}</div>` : `<p class="muted">${t('lg_login')}</p>`;
  const own = c && c.own ? `<p class="muted">${t('lg_royalty', { n: rules.royalty, c: rules.royaltyCap })}</p>` : '';
  return `<div><b>${t('lg_t')} · W${lgWeekNo()}</b><span>${t('lg_how', { c: Math.round((rules.cut || 0.1) * 100) })} ${v ? lgCountdown() : ''}</span></div>${stats}${mine}${own}${btns}`;
}
async function leagueBack(mint, chips) {
  if (!csServer()) { toast(t('lg_login'), 'cyan', true); return; }
  const r = await fetch(NET.http + '/api/league/back', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mint, chips, token: NET.token }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.code === 'broke' ? t('cs_broke_srv') : j.error || ('league ' + r.status));
  setSrvBal(j.balance); gainXP(20, 'league'); await leagueFetch(true);
  const a = agents.find(x => x.mint === mint); toast(t('lg_backed', { s: a ? a.sym : '', n: fmtChips(chips), p: fmtChips(j.pool) }), 'gold', true);
  if (player) { player.emote(); confetti(_w.copy(player.obj.position).setY(1.6), 30); }
  return j;
}
/* standings for the launch pad panel */
function leagueStandingsHTML() {
  const v = LG.view; if (!v) return `<div class="lg-panel"><b>${t('lg_t')}</b><p class="muted">…</p></div>`;
  const champ = v.champs && v.champs[0];
  return `<div class="lg-panel"><div class="lg-head"><div><span class="rk-eyebrow">${t('lg_t')} · W${lgWeekNo()}</span><b>${t('lg_sub', { s: lgCountdown() })}</b></div></div>
    <p class="muted">${t('lg_how', { c: Math.round(v.rules.cut * 100) })}</p>
    ${v.coins.length ? `<div class="lg-rows">${v.coins.slice(0, 10).map((c, i) => `<button type="button" class="lg-r" data-agent="${agents.find(a => a.mint === c.mint) ? agents.find(a => a.mint === c.mint).id : ''}"><span class="n">${i + 1}</span><img src="${esc(c.image || TH(c.body))}" alt=""><b>$${esc(c.sym)}</b><span class="peak">${fmtUsd(c.peak)}</span><span class="pool">${fmtChips(c.pool)} ${t('cs_chips')}${c.mine ? ` <i>· ${fmtChips(c.mine)}</i>` : ''}</span></button>`).join('')}</div>` : `<p class="muted">${t('lg_empty')}</p>`}
    ${champ ? `<div class="lg-champ"><img src="${esc(champ.image || TH(champ.body))}" alt=""><div><small>${t('lg_champ')} · ${esc(champ.week)}</small><b>${t('lg_champ_line', { s: esc(champ.sym), p: fmtChips(champ.pool), m: fmtUsd(champ.peak) })}</b></div></div>` : ''}</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-lg-back]'); if (!b || b.disabled) return;
  const mint = b.dataset.lgBack, n = +b.dataset.n; b.disabled = true;
  try { await leagueBack(mint, n); const a = agents.find(x => x.mint === mint); const box = $('#lgBox'); if (box && a) box.innerHTML = leagueBoothHTML(a); }
  catch (err) { toast(String(err.message || err).slice(0, 140), 'bad', true); b.disabled = false; }
});
/* the board in the cafe: league standings instead of a plain top list once the league has entries */
function leagueBoardDraw(ctx) {
  const v = LG.view; if (!v || !v.coins.length) return false;
  ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = '#c8a96a'; ctx.font = "700 26px Unbounded, 'Arial Black', sans-serif"; ctx.textAlign = 'left'; ctx.fillText(t('lg_board'), 20, 44);
  ctx.fillStyle = '#8a877f'; ctx.font = `600 14px ${MONO}`; ctx.fillText(t('lg_board_sub', { w: lgWeekNo() }), 20, 68);
  v.coins.slice(0, 7).forEach((c, i) => {
    const y = 108 + i * 38, a = agents.find(x => x.mint === c.mint);
    ctx.fillStyle = i === 0 ? '#c8a96a' : i === 1 ? '#c9ccd6' : i === 2 ? '#c9a85c' : '#3a3160'; ctx.beginPath(); ctx.arc(34, y - 7, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0b0c'; ctx.font = "700 15px Unbounded, sans-serif"; ctx.textAlign = 'center'; ctx.fillText(i + 1, 34, y - 2); ctx.textAlign = 'left';
    if (a) coinThumb(ctx, a, 56, y - 24, 30, 6);
    ctx.fillStyle = '#ece9e2'; ctx.font = `700 19px ${MONO}`; ctx.fillText('$' + c.sym, 96, y);
    ctx.fillStyle = '#8a877f'; ctx.font = `600 13px ${MONO}`; ctx.fillText(fmtChips(c.pool) + ' chips · ' + c.backers, 96, y + 15);
    ctx.fillStyle = '#8fd3a6'; ctx.textAlign = 'right'; ctx.font = `700 19px ${MONO}`; ctx.fillText(fmtUsd(c.peak), 492, y); ctx.textAlign = 'left';
  });
  return true;
}
/* the champion's trophy by the vault */
function leagueTrophyDraw() {
  const tr = townFx.trophy; if (!tr) return; const champ = LG.view && LG.view.champs && LG.view.champs[0];
  tr.g.visible = !!champ; if (!champ || tr.drawn === champ.week + champ.mint) return; tr.drawn = champ.week + champ.mint;
  const ctx = tr.ctx; ctx.fillStyle = '#121214'; ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#c8a96a'; ctx.font = "700 16px 'JetBrains Mono', monospace"; ctx.textAlign = 'center'; ctx.fillText(t('lg_trophy') + ' · ' + champ.week, 128, 34);
  ctx.fillStyle = '#ece9e2'; ctx.font = '800 34px Unbounded, sans-serif'; fitText(ctx, '$' + champ.sym, '800 {s}px Unbounded, sans-serif', 34, 236); ctx.fillText('$' + champ.sym, 128, 78);
  ctx.fillStyle = '#8a877f'; ctx.font = "600 13px 'JetBrains Mono', monospace"; ctx.fillText((champ.by ? '@' + champ.by.slice(0, 14) + ' · ' : '') + fmtChips(champ.pool) + ' chips', 128, 108);
  tr.tex.needsUpdate = true;
}
Object.assign(window.__cc, { LG, leagueFetch, leagueBack, leagueBoothHTML, leagueStandingsHTML });
