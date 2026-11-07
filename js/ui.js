// ===== Band Simulator: DOM UI, menus & modals =====
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function frame(title, body, foot = '', closable = true) {
  return `<div class="panel-head"><h2>${title}</h2>${closable ? '<button class="x" data-act="close">✕</button>' : ''}</div>
    <div class="panel-body">${body}</div>${foot ? `<div class="panel-foot">${foot}</div>` : ''}`;
}
function bar10(v) { let s = '<span class="bar10">'; for (let i = 1; i <= 10; i++) s += `<i class="${i <= v ? 'on' : ''}"></i>`; return s + `</span>`; }
function stamBar(v) {
  const c = v > 60 ? '#40c057' : v > 30 ? '#fab005' : '#fa5252';
  return `<span class="stam"><i style="width:${v}%;background:${c}"></i><b>${v}</b></span>`;
}
function scoreTag(score) { const l = scoreLabel(score); return `<span class="tag ${l.cls}">${l.text}</span>`; }

const UI = {
  queue: [], current: null, h: {}, chg: {}, anim: null, popNext: {},
  tourDraft: null, writeDraft: null, payDraft: null, confirmFire: null,

  init() {
    this.panel = $('#panel'); this.overlay = $('#overlay');
    this.panel.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      if (b.dataset.act === 'close') { UI.close(); return; }
      const fn = UI.h[b.dataset.act]; if (fn) fn(b.dataset, b);
    });
    this.panel.addEventListener('change', e => {
      const el = e.target.closest('[data-chg]'); if (!el) return;
      const fn = UI.chg[el.dataset.chg]; if (fn) fn(el.dataset, el);
    });
    document.querySelectorAll('#nav [data-menu]').forEach(b => b.onclick = () => {
      if (!state || state.gameOver || UI.current) return;
      UI.open(Menus[b.dataset.menu]);
    });
    document.querySelectorAll('#speed [data-speed]').forEach(b => b.onclick = () => {
      if (!state) return; state.speed = +b.dataset.speed; UI.updateSpeed();
    });
    $('#stage').onclick = () => { if (state && !UI.current && !state.gameOver) UI.open(Menus.band); };
  },

  // ----- modal stack: one panel at a time; the clock pauses while any is open -----
  open(builder) { this.queue.push(builder); if (!this.current) this.next(); },
  next() {
    const b = this.queue.shift();
    if (!b) { this.current = null; this.overlay.hidden = true; return; }
    this.current = b; this.overlay.hidden = false; this.render();
    const body = this.panel.querySelector('.panel-body'); if (body) body.scrollTop = 0;
  },
  replace(builder) { this.current = builder; this.render(); const body = this.panel.querySelector('.panel-body'); if (body) body.scrollTop = 0; },
  render() { this.stopAnim(); this.h = {}; this.chg = {}; this.current(this.panel); },
  refresh() {
    if (!this.current) return;
    const body = this.panel.querySelector('.panel-body'); const st = body ? body.scrollTop : 0;
    this.render();
    const nb = this.panel.querySelector('.panel-body'); if (nb) nb.scrollTop = st;
  },
  close() { this.stopAnim(); this.confirmFire = null; this.current = null; save(); this.next(); },
  clearAll() { this.queue = []; this.stopAnim(); this.current = null; this.overlay.hidden = true; },
  stopAnim() { if (this.anim) { clearInterval(this.anim); this.anim = null; } },

  // ----- HUD -----
  updateHud() {
    if (!state) return;
    const s = state, set = (id, v) => { const el = document.getElementById(id); if (el.textContent !== v) el.textContent = v; };
    set('hud-band', s.bandName);
    set('hud-date', dateStr(s.week));
    set('hud-money', fmtMoney(s.money));
    set('hud-fans', fmtNum(totalFans()) + ' fans');
    let text, pct;
    const wp = s.weekProgress || 0;
    if (s.activity.type === 'writing' && s.writing) {
      const w = s.writing, done = w.songs - w.weeksLeft;
      text = `Writing "${w.title}" · song ${Math.min(done + 1, w.songs)}/${w.songs}`;
      pct = (done + wp) / w.songs;
    } else if (s.activity.type === 'tour') {
      const a = s.activity;
      text = `On stage in ${cityName(a.cities[a.idx] || a.cities[a.cities.length - 1])} · show ${Math.min(a.idx + 1, a.cities.length)}/${a.cities.length}`;
      pct = (a.idx + wp) / a.cities.length;
    } else if (s.writing) { text = 'Album finished! Choose how to release it.'; pct = 1; }
    else {
      const away = s.members.filter(m => m.busy).length;
      text = away ? `${away} member${away > 1 ? 's' : ''} away · rest of the band is resting` : 'Hanging out in the rehearsal room';
      pct = wp;
    }
    const meter = document.getElementById('album-meter');
    if (s.writing && s.activity.type === 'writing') {
      const key = s.writing.title + '|' + s.writing.songs;
      if (this.shownKey !== key) { this.shownKey = key; this.shown = { ...(s.writing.pts || { T: 0, C: 0, M: 0 }) }; }
      meter.hidden = false;
      for (const k of ['T', 'C', 'M']) set('pt-' + k, String(this.shown[k]));
    } else { meter.hidden = true; this.shownKey = null; }
    if (s.speed === 0) text = '❚❚ PAUSED · ' + text;
    set('status-text', text);
    $('#status-bar').style.width = Math.round(clamp(pct, 0, 1) * 100) + '%';
  },
  updateSpeed() {
    document.querySelectorAll('#speed [data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === state.speed));
  },
  renderLog() {
    if (!state) return;
    $('#log').innerHTML = state.log.slice(0, 6).map(l => `<div class="log-${l.kind}">${esc(l.msg)}</div>`).join('');
  },
  toast(text) {
    const el = $('#toast'); el.textContent = text; el.classList.add('show');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => el.classList.remove('show'), 2600);
  },

  // ----- floating pixel text over the stage canvas -----
  popup(x, y, text, color = '#fff', key = 'g', big = false) {
    const now = performance.now();
    const delay = Math.max(0, (this.popNext[key] || 0) - now);
    this.popNext[key] = now + delay + 380;
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'popup' + (big ? ' big' : '');
      el.textContent = text;
      el.style.left = (x / Render.W * 100) + '%';
      el.style.top = (y / Render.H * 100) + '%';
      el.style.color = color;
      $('#popups').appendChild(el);
      setTimeout(() => el.remove(), big ? 2300 : 1700);
    }, delay);
  },
  popupMember(m, text, color) {
    if (!state) return;
    const i = state.members.indexOf(m); if (i < 0) return;
    this.popup(Render.slotX(i, state.members.length) + 5, Render.memberY() - 6, text, color, 'm' + m.id);
  },
  // Game-Dev-Story-style: each member's weekly album points float up over their head
  // in the pool's color, and the meter under the stage counts up as they land.
  writingPoints(gains) {
    const weekMs = WEEK_MS / Math.max(1, state.speed || 1);
    const colors = { T: '#74c0fc', C: '#f783ac', M: '#ffd43b' };
    gains.forEach(({ m, g }, mi) => {
      ['T', 'C', 'M'].forEach((k, ki) => {
        const delay = (ki + 0.2) * weekMs / 3.4 + mi * Math.min(120, weekMs / 12);
        setTimeout(() => {
          if (!state || !state.writing) return;
          const i = state.members.indexOf(m);
          if (i >= 0) this.float(Render.slotX(i, state.members.length) + 5 + (ki - 1) * 3, Render.memberY() - 4, '+' + g[k], colors[k], k);
          if (this.shown) this.shown[k] += g[k];
        }, delay);
      });
    });
  },
  float(x, y, text, color, key) {
    const el = document.createElement('div');
    el.className = 'popup pts';
    el.innerHTML = (key ? Icons.img(key) : '') + esc(text);
    el.style.left = (x / Render.W * 100) + '%';
    el.style.top = (y / Render.H * 100) + '%';
    el.style.color = color;
    $('#popups').appendChild(el);
    setTimeout(() => el.remove(), 1300);
  },
  showScorePopup(r) {
    Render.lingerUntil = performance.now() + 2200;
    const c = r.score >= 700 ? '#ffd43b' : r.score >= 400 ? '#8ce99a' : r.score >= 200 ? '#fff' : '#ff8787';
    this.popup(80, 30, `${cityName(r.cityId)}: ${r.score}`, c, 'show', true);
    this.popup(80, 44, `+${fmtMoney(r.tickets + r.merchRev)}`, '#8ce99a', 'show2');
    r.events.forEach(e => this.popup(80, 52, e.split('!')[0] + '!', isGoodEvent(e) ? '#ffd43b' : '#ff8787', 'show3'));
  },
};

// ======================= MENUS =======================
const Menus = {
  band(p) {
    const s = state, touring = s.activity.type === 'tour', idle = s.activity.type === 'idle';
    let body = '';
    if (!idle) body += '<p class="note">Lessons and vacations are only available while the band is idle.</p>';
    s.members.forEach(m => {
      const il = instrLevel(m), canTrain = idle && !m.busy;
      const opts = INSTRUMENTS.map(i => `<option value="${i}" ${i === m.instrument ? 'selected' : ''}>${i} ${m.instruments[i] != null ? 'Lv' + m.instruments[i] : '(new: Lv0)'}</option>`).join('');
      const busy = m.busy ? `<div class="tag info">${m.busy.type === 'vacation' ? 'On vacation' : 'In lessons'} · ${m.busy.weeks}w</div>` : '';
      const lr = m.lastRequest;
      const req = m.request
        ? `<div class="req">💬 Wants: "${esc(m.request.text)}"${m.request.hint ? `<small class="how">➜ ${esc(m.request.hint)}</small>` : ''}<small>${m.request.weeks}w left to grant it (+15 stamina), or -20 if ignored. The clock pauses while writing or touring.</small></div>`
        : lr ? `<div class="req past ${lr.status}">Last request (${dateStr(lr.week)}): "${esc(lr.text)}" <small>${{ granted: '✓ Granted', ignored: '✗ Ignored (-20 stamina)', withdrawn: '– Withdrawn (rested up)' }[lr.status] || ''}</small></div>` : '';
      const lesson = (stat, label, lvl) => `<button data-act="lesson" data-id="${m.id}" data-stat="${stat}" ${canTrain && lvl < 10 && s.money >= lessonCost(lvl) ? '' : 'disabled'}>${label} lesson<small>${lvl >= 10 ? 'MAX' : fmtMoney(lessonCost(lvl))}</small></button>`;
      const firing = UI.confirmFire === m.id;
      body += `<div class="card">
        <div class="card-top"><canvas class="portrait" width="26" height="26" data-portrait="${s.members.indexOf(m)}"></canvas><div class="card-info">
        <div class="card-head"><b>${esc(m.name)}</b><span class="tag trait">${m.trait}</span></div>
        <div class="sub">${m.genre} fan · ${fmtMoney(salary(m))}/yr · ${m.albums} album${m.albums === 1 ? '' : 's'}</div></div></div>
        ${busy}${req}
        <label class="instr">Plays <select data-chg="instr" data-id="${m.id}" ${touring || s.writing ? 'disabled' : ''}>${opts}</select>${s.writing ? ' <small>🔒 until album is done</small>' : ''}</label>
        <div class="stats">
          <span>${m.instrument}</span>${bar10(il)}
          <span>Theory</span>${bar10(m.theory)}
          <span>Perform</span>${bar10(m.performance)}
          <span>Creative</span>${bar10(m.creativity)}
          <span>Stamina</span>${stamBar(m.stamina)}
        </div>
        <div class="note">${TRAITS[m.trait].desc}</div>
        <div class="btns">
          ${lesson('instrument', m.instrument, il)}${lesson('theory', 'Theory', m.theory)}${lesson('creativity', 'Creativity', m.creativity)}
          <button data-act="vacation" data-id="${m.id}" ${canTrain && s.money >= VACATION_COST ? '' : 'disabled'}>Vacation<small>${fmtMoney(VACATION_COST)} · ${VACATION_WEEKS}w</small></button>
        </div>
        <div class="btns one"><button class="danger" data-act="fire" data-id="${m.id}" ${touring ? 'disabled' : ''}>${firing ? `Really fire? (-${Math.round(firePenalty(m) * 100)}% fans)` : 'Fire'}</button></div>
      </div>`;
    });
    p.innerHTML = frame(`${esc(s.bandName)} ${s.members.length}/${MAX_MEMBERS}`, body);
    drawPortraits(p, s.members);
    UI.h = {
      lesson: d => { const e = startLesson(byId(d.id), d.stat); if (e) UI.toast(e); UI.refresh(); },
      vacation: d => { const e = startVacation(byId(d.id)); if (e) UI.toast(e); UI.refresh(); },
      fire: d => {
        if (UI.confirmFire !== +d.id) { UI.confirmFire = +d.id; UI.refresh(); return; }
        UI.confirmFire = null; const e = fireMember(byId(d.id)); if (e) UI.toast(e);
        if (!state.members.length) { UI.close(); gameOver('You fired everyone. The band is no more.'); return; }
        UI.refresh();
      },
    };
    UI.chg = { instr: (d, el) => { const e = switchInstrument(byId(d.id), el.value); if (e) UI.toast(e); UI.refresh(); } };
  },

  write(p) {
    const s = state;
    if (s.writing && s.writing.weeksLeft <= 0) { UI.replace(Modals.release); return; }
    if (s.writing) {
      const w = s.writing, pts = w.pts || { T: 0, C: 0, M: 0 };
      const rows = Object.values(w.byMember || {});
      const top = Math.max(1, ...rows.map(r => r.T + r.C + r.M));
      let table = rows.length ? '' : '<p class="note">Points will appear after the first week of writing.</p>';
      rows.sort((a, b) => (b.T + b.C + b.M) - (a.T + a.C + a.M)).forEach(r => {
        const tot = r.T + r.C + r.M;
        table += `<div class="contrib"><div class="contrib-head"><span>${esc(r.name)}</span><b>${tot}</b></div>
          <div class="contrib-bar" style="width:${Math.round(tot / top * 100)}%">
            <i class="T" style="flex:${r.T}"></i><i class="C" style="flex:${r.C}"></i><i class="M" style="flex:${r.M}"></i></div>
          <div class="sub"><span class="pt-T">${Icons.img('T')}${r.T}</span> · <span class="pt-C">${Icons.img('C')}${r.C}</span> · <span class="pt-M">${Icons.img('M')}${r.M}</span></div></div>`;
      });
      const mb = genreMastery(w.genre);
      p.innerHTML = frame('Studio', `<p>Writing <b>"${esc(w.title)}"</b> (${w.genre}${mb ? ` · 🏅 +${mb}` : ''}).</p>
        <p>Song ${w.songs - w.weeksLeft + 1} of ${w.songs}. ${w.weeksLeft} week(s) to go.</p>
        <div class="pt-totals"><span class="pt-T">${Icons.label('T')}<b>${pts.T}</b></span><span class="pt-C">${Icons.label('C')}<b>${pts.C}</b></span><span class="pt-M">${Icons.label('M')}<b>${pts.M}</b></span></div>
        <h3>Who's contributing</h3>${table}
        <p class="note">Points come from each member's Theory, Creativity and instrument level, scaled by their stamina. Instruments are locked in until the album is done. Everyone gains XP while writing, but stamina drains 3/week.</p>`);
      return;
    }
    const err = canStartActivity();
    const d = UI.writeDraft || (UI.writeDraft = { genre: RNG.pick(s.members.map(m => m.genre).concat(s.trending)), title: randomTitle() });
    const songs = songCountFor(s.members);
    let grid = '<div class="grid3">';
    GENRES.forEach(g => {
      const fans = s.members.filter(m => m.genre === g).length;
      const mastered = genreMastery(g) / 4;
      const rep = genreStreak(g);
      const mark = (s.trending.includes(g) ? '🔥' : s.stale === g ? '❄' : '') + '🏅'.repeat(mastered) + '★'.repeat(fans) + (rep ? '🔁' : '');
      grid += `<button data-act="genre" data-g="${g}" class="${d.genre === g ? 'sel' : ''}">${g}<small>${mark || '&nbsp;'}</small></button>`;
    });
    grid += '</div>';
    const body = `${err ? `<p class="warn">${err}</p>` : ''}
      <h3>Genre</h3>${grid}
      <p class="note">🔥 trending (+fans, +critic score) · ❄ stale · ★ a member who specializes in it (+critic score) · 🏅 mastered: you've made an Acclaimed album in it (+4 critic score each, a Classic counts double, max +12) · 🔁 your last release was this genre (fans get tired of repeats)</p>
      ${genreStreak(d.genre) === 1 ? `<p class="warn">🔁 Your last album was ${d.genre} too. A 2nd in a row draws complaints (fewer new fans).</p>` : ''}
      ${genreStreak(d.genre) >= 2 ? `<p class="warn">🔁 That would be ${genreStreak(d.genre) + 1} ${d.genre} albums in a row. Fans will leave!</p>` : ''}
      ${untouredAlbum() && !err ? `<p class="warn">⚠ You haven't done a release tour for "${esc(untouredAlbum().title)}" (${releaseTourSize()}+ cities). Writing now costs 5% of your fans.</p>` : ''}
      <h3>Album title</h3>
      <div class="title-row"><input id="album-title" maxlength="32" value="${esc(d.title)}"><button data-act="dice">🎲</button></div>
      <p>Based on the band's stamina, this album will have <b>${songs} songs</b> (${songs} weeks). More rested bands write longer albums. 8–10 songs is the sweet spot.</p>`;
    p.innerHTML = frame('Write an Album', body, `<button class="primary wide" data-act="go" ${err ? 'disabled' : ''}>Start Writing</button>`);
    p.querySelector('#album-title').oninput = e => { d.title = e.target.value; };
    UI.h = {
      genre: x => { d.genre = x.g; UI.refresh(); },
      dice: () => { d.title = randomTitle(); UI.refresh(); },
      go: () => {
        const e = startWriting(d.genre, d.title.trim());
        if (e) { UI.toast(e); return; }
        UI.writeDraft = null; UI.close();
      },
    };
  },

  tour(p) {
    const s = state;
    if (s.activity.type === 'tour') {
      const a = s.activity;
      const body = `<p>Traveling by ${TRANSPORT[a.transport].name}.</p>` + a.cities.map((id, i) => {
        const r = a.results[i];
        return `<div class="line"><span>${i < a.idx ? '✓' : i === a.idx ? '▶' : '·'} ${esc(cityName(id))}</span><span>${r ? 'Score ' + r.score : ''}</span></div>`;
      }).join('');
      p.innerHTML = frame('On Tour', body); return;
    }
    const err = canStartActivity();
    const d = UI.tourDraft || (UI.tourDraft = { transport: 'van', cities: ['home'], buy: {} });
    if (d.transport === 'bus' && !s.ownsBus) d.transport = 'van';
    const t = TRANSPORT[d.transport];
    d.cities = d.cities.filter(id => cityUnlocked(id) && tierIndex(id) <= t.maxTier);

    let body = err ? `<p class="warn">${err}</p>` : '';
    const fr = s.fanRequests || [];
    if (fr.length) body += fr.map(r => `<p class="fanreq">📣 Fans in <b>${esc(cityName(r.cityId))}</b> want a show! ${r.weeks}w left. Book it for a packed house.</p>`).join('');
    const ua = untouredAlbum();
    if (ua) body += `<p class="note">🎤 Book ${releaseTourSize()}+ cities to make this the release tour for "${esc(ua.title)}".</p>`;
    body += '<h3>Transport</h3><div class="grid3">';
    for (const [k, tr] of Object.entries(TRANSPORT)) {
      const locked = k === 'bus' && !s.ownsBus;
      const price = locked ? 'Buy in Gear menu' : `${fmtMoney(tr.perCity)}/city${k === 'jet' ? ' +' + fmtMoney(tr.rent) : ''}`;
      body += `<button data-act="tr" data-k="${k}" class="${d.transport === k ? 'sel' : ''}" ${locked ? 'disabled' : ''}>${tr.name}<small>${price}<br>-${tr.drain} stamina/show</small></button>`;
    }
    body += '</div><h3>Cities <small>(tap in the order to visit)</small></h3>';
    TIER_ORDER.forEach((tier, ti) => {
      body += `<div class="tier-label">${CITY_TIERS[tier].name} · ${fmtMoney(CITY_TIERS[tier].ticket)} tickets · unlock at ${fmtNum(CITY_TIERS[tier].unlock)} fans</div><div class="grid3">`;
      CITIES.filter(c => c.tier === tier).forEach(c => {
        const unlocked = cityUnlocked(c.id), reach = ti <= t.maxTier, order = d.cities.indexOf(c.id);
        const f = s.cities[c.id].fans;
        const asked = fr.some(r => r.cityId === c.id) ? '📣' : '';
        const sub = !unlocked ? `🔒 ${fmtNum(f)}/${fmtNum(CITY_TIERS[tier].unlock)}` : !reach ? `${asked}Needs ${ti === 3 ? 'Jet' : 'Bus'}` : `${asked}${fmtNum(f)} fans`;
        body += `<button data-act="city" data-id="${c.id}" class="${order >= 0 ? 'sel' : ''}" ${unlocked && reach ? '' : 'disabled'}>${order >= 0 ? `<em>${order + 1}</em>` : ''}${esc(cityName(c.id))}<small>${sub}</small></button>`;
      });
      body += '</div>';
    });
    body += '<h3>Merch to bring</h3>';
    for (const [k, it] of Object.entries(MERCH)) {
      const b = d.buy[k] || 0;
      body += `<div class="line merch"><span>${it.name}<small>have ${s.merch[k]} · cost ${fmtMoney(it.cost * it.step)}/${it.step} · sells ${fmtMoney(it.price)}</small></span>
        <span class="qty"><button data-act="mq" data-k="${k}" data-dir="-1" ${b ? '' : 'disabled'}>−</button><b>+${b}</b><button data-act="mq" data-k="${k}" data-dir="1">+</button></span></div>`;
    }
    const pa = latestPhysical();
    body += `<p class="note">${pa ? `Copies of "${esc(pa.title)}" are sold at every show automatically.` : 'Release a physical album to also sell copies at shows.'} Unsold merch carries over.</p>`;
    const travel = tourCost(d.cities, d.transport), merch = merchCost(d.buy), total = travel + merch;
    const minSt = Math.min(...s.members.map(m => m.stamina));
    const risky = s.members.length && d.cities.length * t.drain >= minSt;
    body += `<div class="line"><span>Travel</span><span>${fmtMoney(travel)}</span></div>
      <div class="line"><span>Merch</span><span>${fmtMoney(merch)}</span></div>
      <div class="line total"><span>Total</span><span>${fmtMoney(total)} of ${fmtMoney(s.money)}</span></div>
      ${risky ? '<p class="warn">⚠ Someone may collapse from exhaustion on this tour!</p>' : ''}`;
    const ok = !err && d.cities.length && total <= s.money;
    p.innerHTML = frame('Shows & Tours', body, `<button class="primary wide" data-act="go" ${ok ? '' : 'disabled'}>${d.cities.length > 1 ? `Start ${d.cities.length}-City Tour` : 'Play Show'}</button>`);
    UI.h = {
      tr: x => { d.transport = x.k; UI.refresh(); },
      city: x => { const i = d.cities.indexOf(x.id); if (i >= 0) d.cities.splice(i, 1); else d.cities.push(x.id); UI.refresh(); },
      mq: x => { d.buy[x.k] = Math.max(0, (d.buy[x.k] || 0) + (+x.dir) * MERCH[x.k].step); UI.refresh(); },
      go: () => {
        const e = startTour(d.cities, d.transport, d.buy);
        if (e) { UI.toast(e); return; }
        d.buy = {}; UI.close();
      },
    };
  },

  shop(p) {
    const s = state, touring = s.activity.type === 'tour';
    let body = touring ? '<p class="warn">The shop is closed while you are on tour.</p>' : '';
    body += '<h3>Gear</h3><p class="note">Better gear boosts show scores. Gear below 40% condition may fail on stage!</p>';
    s.members.forEach(m => {
      const g = m.gear, next = GEAR_TIERS[g.tier + 1], rc = repairCost(m);
      body += `<div class="card"><div class="card-head"><b>${esc(m.name)}</b><span>${m.instrument}</span></div>
        <div class="sub">${GEAR_TIERS[g.tier].name} rig${m.trait === 'Gearhead' ? ' (Gearhead +1)' : ''}</div>
        <div class="stats"><span>Condition</span>${stamBar(g.condition)}</div>
        <div class="btns">
          <button data-act="repair" data-id="${m.id}" ${!touring && g.condition < 100 && s.money >= rc ? '' : 'disabled'}>Tune up<small>${fmtMoney(rc)}</small></button>
          <button data-act="upgrade" data-id="${m.id}" ${!touring && next && s.money >= next.cost ? '' : 'disabled'}>${next ? 'Get ' + next.name : 'Maxed'}<small>${next ? fmtMoney(next.cost) : '—'}</small></button>
        </div></div>`;
    });
    body += `<h3>Vehicles</h3><div class="card"><div class="card-head"><b>Tour Bus</b><span>${s.ownsBus ? 'Owned' : fmtMoney(TRANSPORT.bus.buy)}</span></div>
      <div class="note">Unlocks national cities. Shows drain only ${TRANSPORT.bus.drain} stamina instead of ${TRANSPORT.van.drain}.</div>
      ${s.ownsBus ? '' : `<div class="btns one"><button data-act="bus" ${!touring && s.money >= TRANSPORT.bus.buy ? '' : 'disabled'}>Buy Tour Bus</button></div>`}</div>
      <p class="note">The Private Jet is rented per tour from the Tour screen. Merch is ordered when you plan a show.</p>`;
    p.innerHTML = frame('Gear', body);
    const act = fn => x => { const e = fn(byId(x.id)); if (e) UI.toast(e); UI.refresh(); };
    UI.h = { repair: act(repairGear), upgrade: act(upgradeGear), bus: () => { const e = buyBus(); if (e) UI.toast(e); UI.refresh(); } };
  },

  recruit(p) {
    const s = state;
    let body = '', foot = '';
    if (s.activity.type === 'tour') body = '<p class="warn">You can\'t recruit while on tour.</p>';
    else if (s.candidates) {
      body = `<p>Band: ${s.members.length}/${MAX_MEMBERS}. Traits stay hidden until you hire.</p>`;
      s.candidates.forEach((c, i) => {
        const inst = Object.entries(c.instruments).map(([k, v]) => `${k} Lv${v}`).join(', ');
        body += `<div class="card ${c.star ? 'star' : ''}"><div class="card-top"><canvas class="portrait" width="26" height="26" data-portrait="${i}"></canvas><div class="card-info">
          <div class="card-head"><b>${esc(c.name)}${c.star ? ' ★' : ''}</b><span class="tag trait">???</span></div>
          <div class="sub">${c.genre} fan · ${fmtMoney(salary(c))}/yr</div>
          <div class="sub">${inst}</div></div></div>
          <div class="stats"><span>${c.instrument}</span>${bar10(instrLevel(c))}<span>Theory</span>${bar10(c.theory)}<span>Perform</span>${bar10(c.performance)}<span>Creative</span>${bar10(c.creativity)}</div>
          <div class="btns one"><button class="primary" data-act="hire" data-i="${i}" ${s.members.length < MAX_MEMBERS ? '' : 'disabled'}>Hire</button></div></div>`;
      });
      foot = '<button class="wide" data-act="dismiss">Clear list</button>';
    } else if (s.pendingRecruit) {
      body = `<p>Searching via ${RECRUIT[s.pendingRecruit.method].name}... results in ${s.pendingRecruit.weeks} week(s).</p>`;
    } else {
      body = `<p>Band: ${s.members.length}/${MAX_MEMBERS}. How do you want to find new members?</p>`;
      for (const [k, r] of Object.entries(RECRUIT)) {
        body += `<button class="option" data-act="search" data-k="${k}" ${s.money >= r.cost ? '' : 'disabled'}><b>${r.name}</b> <span>${r.cost ? fmtMoney(r.cost) : 'Free'}</span><small>${r.desc} ${r.count} candidates, skill ${r.min}–${r.max}.</small></button>`;
      }
    }
    p.innerHTML = frame('Recruit', body, foot);
    if (s.candidates) drawPortraits(p, s.candidates);
    UI.h = {
      search: x => { const e = startRecruit(x.k); if (e) UI.toast(e); UI.refresh(); },
      hire: x => { const e = hireCandidate(+x.i); if (e) UI.toast(e); UI.refresh(); },
      dismiss: () => { state.candidates = null; UI.refresh(); },
    };
  },

  fans(p) {
    const s = state;
    let body = `<div class="line total"><span>Total fans</span><span>${fmtNum(totalFans())}</span></div>
      <div class="line"><span>Peak</span><span>${fmtNum(s.peakFans)}</span></div>
      <p>🔥 Trending: <b>${s.trending.join(', ')}</b> · ❄ Stale: <b>${s.stale}</b></p>
      ${s.albums.length && s.weeksSinceAlbum > 24 ? `<p class="warn">It's been ${s.weeksSinceAlbum} weeks since your last album. After 30, fans start leaving.</p>` : ''}
      ${(s.fanRequests || []).map(r => `<p class="fanreq">📣 Fans in <b>${esc(cityName(r.cityId))}</b> want a show (${r.weeks}w left). Ignoring them costs fans there.</p>`).join('')}
      <h3>Cities</h3>`;
    TIER_ORDER.forEach(tier => {
      body += `<div class="tier-label">${CITY_TIERS[tier].name} (unlock ${fmtNum(CITY_TIERS[tier].unlock)})</div>`;
      CITIES.filter(c => c.tier === tier).forEach(c => {
        const cs = s.cities[c.id];
        body += `<div class="line"><span>${cityUnlocked(c.id) ? '' : '🔒 '}${esc(cityName(c.id))}</span><span>${fmtNum(cs.fans)}${cs.shows ? ` · ${cs.shows} show${cs.shows > 1 ? 's' : ''}` : ''}</span></div>`;
      });
    });
    body += '<h3>Discography</h3>';
    if (!s.albums.length) body += '<p class="note">No albums yet.</p>';
    [...s.albums].reverse().forEach(a => {
      body += `<div class="card"><div class="card-head"><b>"${esc(a.title)}"</b>${scoreTag(a.score)}</div>
        <div class="sub">${dateStr(a.week)} · ${a.genre} · ${a.songs} songs · ${FORMATS[a.format].name}</div>
        <div class="sub">Critics: ${a.critics.map(c => c.score).join(' / ')} → <b>${a.score}</b></div>
        <div class="sub">+${fmtNum(a.fansGained)} fans${a.sales ? ` · ${fmtNum(a.sales)} sold · ${fmtMoney(a.revenue)}` : ''}${a.pirated ? ' · ☠ leaked' : ''}</div>
        ${a.toured === true ? '<div class="sub good">🎤 Release tour done</div>' : a.toured === 'skipped' ? '<div class="sub bad">No release tour</div>' : a.toured === false ? '<div class="sub">🎤 Awaiting release tour</div>' : ''}</div>`;
    });
    p.innerHTML = frame('Fans & Records', body);
  },
};

// ======================= MODALS =======================
const Modals = {
  message(title, text) { return p => { p.innerHTML = frame(title, `<p>${esc(text)}</p>`, '<button class="primary wide" data-act="close">OK</button>'); }; },

  release(p) {
    const w = state.writing;
    let body = `<p><b>"${esc(w.title)}"</b> is done! ${w.songs} songs of ${w.genre}.</p><p>How will you release it?</p>`;
    for (const [k, f] of Object.entries(FORMATS)) {
      body += `<button class="option" data-act="fmt" data-f="${k}" ${state.money >= f.cost ? '' : 'disabled'}><b>${f.name}</b> <span>${f.cost ? fmtMoney(f.cost) : 'Free'}</span><small>${f.desc}${f.price ? ` Sells for ${fmtMoney(f.price)}.` : ''}</small></button>`;
    }
    body += `<p class="note">You have ${fmtMoney(state.money)}.</p>`;
    p.innerHTML = frame('Release Album', body, '', false);
    UI.h = { fmt: x => { const album = releaseAlbum(x.f); if (album) UI.replace(pp => Modals.reveal(pp, album)); } };
  },

  reveal(p, album) {
    let cards = '';
    album.critics.forEach((c, i) => {
      cards += `<div class="critic" style="--c:${c.color}"><div class="cname">${c.name}</div><div class="cscore" id="cs${i}">--</div>
        <div class="cquote" id="cq${i}"></div><div class="cmoment" id="cm${i}"></div></div>`;
    });
    const l = scoreLabel(album.score);
    const sum = `<div id="reveal-sum" class="hidden">
      <div class="big-score ${l.cls}">${album.score}<small>/100</small></div><div class="center"><span class="tag ${l.cls}">${l.text}</span></div>
      ${album.pts ? `<div class="pt-totals small"><span class="pt-T">${Icons.label('T')}<b>${album.pts.T}</b></span><span class="pt-C">${Icons.label('C')}<b>${album.pts.C}</b></span><span class="pt-M">${Icons.label('M')}<b>${album.pts.M}</b></span></div>` : ''}
      ${album.streak === 2 ? `<p class="warn">Fans grumble: two ${album.genre} albums in a row. Fewer new fans this time.</p>` : ''}
      ${album.streak >= 3 ? `<p class="warn">${album.streak} ${album.genre} albums in a row! Fans are leaving. Switch genres next time.</p>` : ''}
      ${album.mastery ? `<div class="line"><span>🏅 ${album.genre} mastery</span><span>+${album.mastery} critic score</span></div>` : ''}
      ${album.masteryUp ? `<p class="good-note">🏅 ${album.genre} mastery up! Future ${album.genre} albums get a critic bonus.</p>` : ''}
      <div class="line"><span>New fans</span><span>+${fmtNum(album.fansGained)}</span></div>
      ${album.fansLost ? `<div class="line"><span>Disappointed fans</span><span>-${fmtNum(album.fansLost)}</span></div>` : ''}
      ${album.firstWeek ? `<div class="line"><span>First week sales</span><span>${fmtNum(album.firstWeek)} (${fmtMoney(album.firstWeek * FORMATS[album.format].price)})</span></div>` : ''}
      ${album.format === 'online' ? '<p class="note">Released online: lots of ears, no money.</p>' : '<p class="note">Copies keep selling for a few weeks, and at your shows.</p>'}
    </div>`;
    p.innerHTML = frame(`"${esc(album.title)}" Reviews`, `<div class="critics">${cards}</div>${sum}`, '<button class="primary wide" data-act="next">Skip</button>', false);
    const start = performance.now();
    const doneAt = album.critics.map((_, i) => 700 + i * 650);
    const finished = album.critics.map(() => false);
    const show = i => {
      const c = album.critics[i]; finished[i] = true;
      p.querySelector('#cs' + i).textContent = c.score;
      p.querySelector('#cs' + i).classList.add('land');
      p.querySelector('#cq' + i).textContent = `"${c.quote}"`;
      if (c.moment) p.querySelector('#cm' + i).textContent = c.moment === 'Masterpiece!' ? '★ ' + c.moment : '✖ ' + c.moment;
    };
    const finish = () => {
      UI.stopAnim();
      album.critics.forEach((_, i) => { if (!finished[i]) show(i); });
      p.querySelector('#reveal-sum').classList.remove('hidden');
      const b = p.querySelector('[data-act="next"]'); b.textContent = 'Continue'; b.dataset.done = '1';
    };
    UI.anim = setInterval(() => {
      const el = performance.now() - start;
      album.critics.forEach((c, i) => {
        if (finished[i]) return;
        if (el >= doneAt[i]) show(i); else p.querySelector('#cs' + i).textContent = RNG.int(0, 99);
      });
      if (finished.every(Boolean)) finish();
    }, 50);
    UI.h = { next: x => { if (x.done) UI.close(); else finish(); } };
  },

  tourSummary(p, a) {
    let tickets = 0, merch = 0, fans = 0, people = 0;
    let body = '';
    a.results.forEach(r => {
      tickets += r.tickets; merch += r.merchRev; fans += r.fanDelta; people += r.attendance;
      const l = scoreLabel(r.score / 10);
      body += `<div class="card"><div class="card-head"><b>${esc(cityName(r.cityId))}</b><span class="tag ${l.cls}">${r.score}</span></div>
        <div class="sub">${r.attendance} came · tickets ${fmtMoney(r.tickets)} · merch ${fmtMoney(r.merchRev)} · fans ${r.fanDelta >= 0 ? '+' : ''}${r.fanDelta}</div>
        ${r.events.map(e => `<div class="sub ${isGoodEvent(e) ? 'good' : 'bad'}">${esc(e)}</div>`).join('')}</div>`;
    });
    if (a.cancelled.length) body += `<p class="warn">Cancelled: ${a.cancelled.map(id => esc(cityName(id))).join(', ')}. Fans there are disappointed.</p>`;
    const head = `<div class="line"><span>Shows</span><span>${a.results.length}</span></div>
      <div class="line"><span>Total crowd</span><span>${fmtNum(people)}</span></div>
      <div class="line"><span>Tickets</span><span>${fmtMoney(tickets)}</span></div>
      <div class="line"><span>Merch & albums</span><span>${fmtMoney(merch)}</span></div>
      <div class="line total"><span>Fans</span><span>${fans >= 0 ? '+' : ''}${fmtNum(fans)}</span></div>`;
    p.innerHTML = frame('Tour Wrap-up', head + body, '<button class="primary wide" data-act="close">Head home</button>');
  },

  payday(p) {
    const s = state;
    if (!UI.payDraft) {
      UI.payDraft = new Set(); let left = s.money;
      for (const m of s.members) if (salary(m) <= left) { UI.payDraft.add(m.id); left -= salary(m); }
    }
    const d = UI.payDraft;
    const total = s.members.filter(m => d.has(m.id)).reduce((a, m) => a + salary(m), 0);
    let body = `<p>The year is over and salaries are due. Members you don't pay will leave the band.</p>`;
    s.members.forEach(m => {
      const on = d.has(m.id);
      body += `<button class="option ${on ? 'sel' : 'off'}" data-act="tog" data-id="${m.id}"><b>${on ? '✓ Pay' : '✗ Let go'} · ${esc(m.name)}</b> <span>${fmtMoney(salary(m))}</span><small>${m.instrument} Lv${instrLevel(m)} · ${m.albums} album${m.albums === 1 ? '' : 's'}</small></button>`;
    });
    body += `<div class="line total"><span>Paying</span><span>${fmtMoney(total)} of ${fmtMoney(s.money)}</span></div>`;
    if (total > s.money) body += '<p class="warn">Not enough money! Let someone go.</p>';
    if (!d.size) body += '<p class="warn">Paying no one ends the band.</p>';
    p.innerHTML = frame('💰 Payday', body, `<button class="primary wide" data-act="pay" ${total <= s.money ? '' : 'disabled'}>Pay salaries</button>`, false);
    UI.h = {
      tog: x => { const id = +x.id; if (d.has(id)) d.delete(id); else d.add(id); UI.refresh(); },
      pay: () => { const ids = [...d]; UI.payDraft = null; UI.close(); payMembers(ids); },
    };
  },

  festival(p) {
    p.innerHTML = frame('Festival Invite!', `<p>A big summer festival wants ${esc(state.bandName)} on the bill! It pays well and reaches lots of new people, but costs 15 stamina for everyone.</p>`,
      '<button data-act="close">Decline</button><button class="primary" data-act="go">Play it!</button>');
    UI.h = { go: () => {
      const r = playFestival();
      UI.replace(Modals.message('Festival Set: ' + r.score, `${r.events.join(' ')} You earned ${fmtMoney(r.pay)} and won over ${fmtNum(r.fans)} new fans.`));
    } };
  },

  gameOver(p, reason, entry) {
    p.innerHTML = frame('GAME OVER', `<p class="warn">${esc(reason)}</p>
      <div class="line"><span>Band</span><span>${esc(entry.band)}</span></div>
      <div class="line"><span>Years active</span><span>${entry.years}</span></div>
      <div class="line"><span>Peak fans</span><span>${fmtNum(entry.peakFans)}</span></div>
      <div class="line"><span>Albums</span><span>${entry.albums}</span></div>
      <div class="line"><span>Best album</span><span>${entry.best || '—'}</span></div>`,
      '<button class="primary wide" data-act="again">Start a new band</button>', false);
    UI.h = { again: () => { UI.clearAll(); state = null; Title.show(); } };
  },
};
