/* ================= CHIP BANK (client) =================
   One panel for the whole chip economy: the balance, a daily streak, three daily tasks the server checks itself,
   everything chips can buy in town (megaphone, double-XP espresso, boosts, desk plates, cosmetics, ranked runs, league)
   and every way to earn more. Chips are a play currency: they never turn into SOL. */
const BK = { info: null, at: 0, busy: false };
async function bankApi(path, body) {
  const get = !body, url = NET.http + '/api/bank/' + path + (get ? '?token=' + encodeURIComponent(NET.token || '') : '');
  const r = await fetch(url, get ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, token: NET.token }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'bank error ' + r.status); e.code = j.code; e.price = j.price; throw e; }
  return j;
}
async function bankRefresh() {
  if (!csServer()) return null;
  try { BK.info = await bankApi('info'); BK.at = Date.now(); setSrvBal(BK.info.balance); if (BK.info.espressoUntil) store.set('cc_esp_until', BK.info.espressoUntil); } catch (e) { }
  bankDot(); return BK.info;
}
const espressoOn = () => +store.get('cc_esp_until', 0) > Date.now();
function bankDot() {   // a gold dot on the chip counter while something is waiting to be claimed
  const b = $('#gChips'); if (!b) return;
  const i = BK.info, waiting = !!(i && (!i.streak.claimed || i.tasks.some(x => x.done && !x.claimed)));
  b.classList.toggle('dot', waiting);
}
const BANK_WHY = k => t('bk_why_' + k) !== 'bk_why_' + k ? t('bk_why_' + k) : k;
function bankHTML() {
  const i = BK.info, on = csServer(), bal = myChips();
  const head = `<div class="bk-head"><div><span class="g-eyebrow">${t('bk_eyebrow')}</span><h3>${t('bk_title')}</h3><p class="sub">${t('bk_sub')}</p></div>
    <div class="bk-bal"><i class="coin"></i><b>${fmtChips(bal)}</b><small>${t('cs_chips')}</small></div></div>`;
  if (!on) return head + `<div class="bk-guest"><p>${t(NET.http ? 'bk_guest' : 'bk_offline')}</p>${NET.http ? `<button type="button" class="btn hot" data-bk="login">${t('land_connect')}</button>` : ''}<button type="button" class="btn" data-bk="casino">${t('pl_casino')}</button></div>` + bankEarnHTML();
  if (!i) return head + `<div class="rk-spin"></div>`;
  const s = i.streak, today = s.claimed ? s.n : s.n + 1;
  const streak = `<div class="bk-sec"><div class="bk-sec-h"><h4>${t('bk_streak')}</h4><span>${t('bk_streak_n', { n: s.n })}</span></div>
    <div class="bk-days">${s.table.map((v, k) => { const d = k + 1, got = d <= s.n && (s.claimed || d < today), cur = !s.claimed && d === Math.min(today, 7); return `<div class="bk-day${got ? ' got' : ''}${cur ? ' cur' : ''}"><small>${t('bk_day', { n: d })}${d === 7 ? '+' : ''}</small><b>${v}</b></div>`; }).join('')}</div>
    <button type="button" class="btn ${s.claimed ? '' : 'hot'} bk-claim" data-bk="daily" ${s.claimed ? 'disabled' : ''}>${s.claimed ? t('bk_tomorrow', { n: s.next }) : t('bk_claim', { n: s.next })}</button></div>`;
  const go = { rk: 'arcade', lg: 'launchpad', crate: 'quest' };
  const tasks = `<div class="bk-sec"><div class="bk-sec-h"><h4>${t('bk_tasks')}</h4><span>${t('bk_tasks_d')}</span></div><ul class="bar-tasks">${i.tasks.map(x => `<li class="${x.claimed ? 'done' : ''}"><i></i><span>${t('bk_task_' + x.id)}</span><b>+${x.reward}</b>${x.claimed ? '' : x.done ? `<button type="button" class="btn small hot" data-bk="task" data-id="${x.id}">${t('bk_take')}</button>` : `<button type="button" class="btn small" data-bk-go="${go[x.id]}">${t('bar_go')}</button>`}</li>`).join('')}</ul></div>`;
  const p = i.prices, esp = espressoOn() ? Math.ceil((+store.get('cc_esp_until', 0) - Date.now()) / 60e3) : 0;
  const card = (ico, title, desc, price, action) => `<div class="bk-card"><div class="bk-card-h"><i>${ico}</i><b>${title}</b>${price ? `<span class="bk-price"><i class="coin"></i>${fmtChips(price)}</span>` : ''}</div><p>${desc}</p>${action || ''}</div>`;
  const spend = `<div class="bk-sec"><div class="bk-sec-h"><h4>${t('bk_spend')}</h4><span>${t('bk_spend_d')}</span></div><div class="bk-grid">
    ${card('📣', t('bk_shout'), t('bk_shout_d'), p.shout, `<div class="bk-shout"><input class="in" id="bkShout" maxlength="80" placeholder="${esc(t('bk_shout_ph'))}"><button type="button" class="btn small hot" data-bk="shout">${t('bk_send')}</button></div>`)}
    ${card('☕', t('bk_esp'), esp ? t('bk_esp_on', { m: esp }) : t('bk_esp_d', { m: p.espressoMin }), p.espresso, `<button type="button" class="btn small" data-bk="espresso">${t(esp ? 'bk_esp_more' : 'bk_esp_btn')}</button>`)}
    ${card('🚀', t('bk_boost'), t('bk_boost_d'), p.boost, `<button type="button" class="btn small" data-bk-go="launchpad">${t('bk_pick_coin')}</button>`)}
    ${card('🪧', t('bk_plate'), t('bk_plate_d'), p.plate, `<button type="button" class="btn small" data-bk-go="mine">${t('bk_my_coin')}</button>`)}
    ${card('🕹️', t('bk_ranked'), t('bk_ranked_d'), (NET.cfg.casino && NET.cfg.casino.runChips) || 1000, `<button type="button" class="btn small" data-bk-go="arcade">${t('mp_arcade')}</button>`)}
    ${card('🏆', t('bk_league'), t('bk_league_d'), 0, `<button type="button" class="btn small" data-bk-go="launchpad">${t('lg_t')}</button>`)}
    ${card('🎩', t('bk_cosm'), t('bk_cosm_d'), 0, `<button type="button" class="btn small" data-bk="shop">${t('gui_shop')}</button>`)}
    ${card('🎰', t('pl_casino'), t('bk_casino_d'), 0, `<button type="button" class="btn small" data-bk="casino">${t('pl_casino')}</button>`)}
  </div></div>`;
  const log = i.log && i.log.length ? `<div class="bk-sec"><div class="bk-sec-h"><h4>${t('bk_log')}</h4></div><ul class="bk-log">${i.log.slice(0, 8).map(l => `<li><span>${esc(BANK_WHY(l.why))}</span><small>${ago(l.at)}</small><b class="${l.d < 0 ? 'neg' : ''}">${l.d > 0 ? '+' : ''}${fmtChips(l.d)}</b></li>`).join('')}</ul></div>` : '';
  return head + streak + tasks + spend + bankEarnHTML() + log + `<div class="bk-sec">${packsHTML()}</div>`;
}
function bankEarnHTML() {
  const rows = [['📦', 'bk_e_crate', '+25'], ['🃏', 'bk_e_card', '+20'], ['🕯️', 'bk_e_candle', '+250'], ['💸', 'bk_e_roy', '+5'], ['🏆', 'bk_e_league', '★'], ['🎟', 'bk_e_invite', '+300']];
  return `<div class="bk-sec"><div class="bk-sec-h"><h4>${t('bk_earn')}</h4><span>${t('bk_earn_d')}</span></div><ul class="bk-earn">${rows.map(([i, k, v]) => `<li><i>${i}</i><span>${t(k)}</span><b>${v}</b></li>`).join('')}</ul></div>`;
}
function openBank() {
  const m = ensureModal('mBank', 'bk-sheet');
  const draw = () => { m.querySelector('.soc-body').innerHTML = bankHTML(); const sh = $('#bkShout'); if (sh) sh.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { const b = m.querySelector('[data-bk="shout"]'); if (b) b.click(); } }); };
  draw(); showModal('mBank');
  if (csServer()) bankRefresh().then(() => { if (!m.hidden) draw(); });
}
document.addEventListener('click', async e => {
  const g = e.target.closest('[data-bk-go]');
  if (g) {
    const k = g.dataset.bkGo; closeModals();
    if (k === 'mine') { const a = agents.find(x => isMyCoin(x)); if (a) openBooth(a); else { toast(t('bk_no_coin')); walkTo('launchpad'); } }
    else if (k === 'quest') openPlace('quest'); else walkTo(k);
    return;
  }
  const b = e.target.closest('[data-bk]'); if (!b || b.disabled || BK.busy) return;
  const k = b.dataset.bk;
  if (k === 'login') { try { await walletLogin(); await bankRefresh(); openBank(); } catch (err) { toast(String(err.message || err).slice(0, 140)); } return; }
  if (k === 'casino') { closeModals(); openPlace('casino'); return; }
  if (k === 'shop') { closeModals(); openShop(); return; }
  if (!csServer()) { openBank(); return; }
  BK.busy = true; b.disabled = true;
  try {
    if (k === 'daily') { const j = await bankApi('daily', {}); BK.info = j; setSrvBal(j.balance); if (j.ok) { toast(t('bk_got_daily', { n: j.credited, d: j.day }), 'gold', true); sfx('coin'); } }
    if (k === 'task') { const j = await bankApi('task', { id: b.dataset.id }); BK.info = j; setSrvBal(j.balance); if (j.ok) { toast(t('bk_got_task', { n: j.credited }), 'gold', true); sfx('coin'); } }
    if (k === 'espresso') { const j = await bankApi('espresso', {}); store.set('cc_esp_until', j.until); setSrvBal(j.balance); toast(t('bk_esp_got', { m: Math.round((j.until - Date.now()) / 60e3) }), 'gold', true); sfx('level'); if (player) player.emote(); renderPlate(); await bankRefresh(); }
    if (k === 'shout') { const inp = $('#bkShout'), text = inp ? inp.value.trim() : ''; if (!text) { b.disabled = false; BK.busy = false; return; } const j = await bankApi('shout', { text }); setSrvBal(j.balance); if (inp) inp.value = ''; await bankRefresh(); }
    if (!$('#mBank').hidden) openBank();
    if (!$('#mBar').hidden && k === 'espresso') openBar();
  } catch (err) {
    toast(err.code === 'broke' ? t('bk_broke', { n: fmtChips(err.price || 0) }) : String(err.message || err).slice(0, 140), 'bad', true);
    b.disabled = false;
  } finally { BK.busy = false; bankDot(); }
});
/* the megaphone: a banner across the top of everyone's screen */
let shoutQ = [], shoutOn = false;
function showShout(m) {
  shoutQ.push(m); if (shoutOn) return;
  const next = () => {
    const s = shoutQ.shift(); if (!s) { shoutOn = false; return; } shoutOn = true;
    const el = document.createElement('div'); el.className = 'shout' + (s.vip ? ' vip' : ''); el.innerHTML = `<i>📣</i><b>${esc(String(s.n || '').slice(0, 16))}</b><span>${esc(String(s.text || '').slice(0, 80))}</span>`;
    document.body.appendChild(el); sfx('go');
    const r = NET.remote && [...NET.remote.values()].find(x => x.av && x.av.tag && x.av.tag.textContent.startsWith(String(s.n || ''))); if (r) r.av.say(s.text, 6);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 500); }, 7000);
  };
  next();
}
/* chip prices next to the SOL buttons in a coin's panel */
async function bankBoost(a) { const j = await bankApi('boost', { mint: a.mint }); setSrvBal(j.balance); NET.boosts = NET.boosts || {}; NET.boosts[a.mint] = j.until; applyBoosts(true); return j; }
async function bankPlate(a, text) { const j = await bankApi('plate', { mint: a.mint, text }); setSrvBal(j.balance); a.plate = j.text; return j; }
function boothChipButtons(a) {
  const pr = (NET.cfg && NET.cfg.bank) || (BK.info && BK.info.prices); if (!pr || !csServer()) return;
  const bb = $('#bBoost'); if (bb && pr.boost && !$('#bBoostC')) {
    bb.insertAdjacentHTML('afterend', `<button type="button" class="btn small" id="bBoostC"><i class="coin"></i>${t('bk_for_chips', { n: fmtChips(pr.boost) })}</button>`);
    $('#bBoostC').addEventListener('click', async ev => { const btn = ev.currentTarget; btn.disabled = true; try { await bankBoost(a); toast(t('boost_done', { s: '$' + a.sym }), 'gold', true); openBooth(a); } catch (err) { toast(err.code === 'broke' ? t('bk_broke', { n: fmtChips(err.price || pr.boost) }) : String(err.message || err).slice(0, 140), 'bad', true); btn.disabled = false; } });
  }
  const pb = $('#bPlate'); if (pb && pr.plate && !$('#bPlateC')) {
    pb.insertAdjacentHTML('afterend', `<button type="button" class="btn small" id="bPlateC"><i class="coin"></i>${t('bk_for_chips', { n: fmtChips(pr.plate) })}</button>`);
    $('#bPlateC').addEventListener('click', async ev => { const btn = ev.currentTarget, text = ($('#bPlateIn') || {}).value || ''; if (!text.trim()) return; btn.disabled = true; try { await bankPlate(a, text.trim()); toast(t('plate_done'), 'gold', true); openBooth(a); } catch (err) { toast(err.code === 'broke' ? t('bk_broke', { n: fmtChips(err.price || pr.plate) }) : String(err.message || err).slice(0, 140), 'bad', true); btn.disabled = false; } });
  }
}
let bankTickAt = 0;
function bankTick() { if (!playing || !csServer()) return; if (Date.now() - bankTickAt > 300e3) { bankTickAt = Date.now(); bankRefresh(); } }
Object.assign(window.__cc, { openBank, bankRefresh, showShout, BK });
