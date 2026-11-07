// ===== Band Simulator: game state & simulation =====
const SAVE_KEY = 'bandsim_save_v1';
const LEGACY_KEY = 'bandsim_legacy_v1';
let state = null;

const CITY_BY_ID = Object.fromEntries(CITIES.map(c => [c.id, c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const round1 = v => Math.round(v * 10) / 10;
const fmtMoney = v => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString();
const fmtNum = v => Math.round(v).toLocaleString();
const STAT_LABEL = { theory: 'Theory', performance: 'Performance', creativity: 'Creativity' };

function log(msg, kind = 'info') {
  state.log.unshift({ msg, kind });
  if (state.log.length > 50) state.log.length = 50;
  UI.renderLog();
}

// Repeat breaker: if a roll exactly matches one of the last two results of the
// same kind, roll it again once. Combined with wide scales and multi-dice
// variance, identical scores become rare.
function rollUnique(key, fn) {
  const hist = state.rollHistory[key] || (state.rollHistory[key] = []);
  let v = fn();
  if (hist.includes(v)) v = fn();
  hist.push(v);
  if (hist.length > 2) hist.shift();
  return v;
}

function dateParts(w = state.week) {
  return { year: Math.floor(w / WEEKS_PER_YEAR) + 1, month: Math.floor((w % WEEKS_PER_YEAR) / 4) + 1, wk: (w % 4) + 1 };
}
function dateStr(w) { const d = dateParts(w); return `Y${d.year} M${d.month} W${d.wk}`; }

// ---------- cities & fans ----------
function cityName(id) { return id === 'home' ? state.hometown : CITY_BY_ID[id].name; }
function tierIndex(id) { return TIER_ORDER.indexOf(CITY_BY_ID[id].tier); }
function totalFans() { return Object.values(state.cities).reduce((a, c) => a + c.fans, 0); }
function cityUnlocked(id) { return id === 'home' || state.cities[id].fans >= CITY_TIERS[CITY_BY_ID[id].tier].unlock; }

function distributeFans(n) {
  if (n <= 0) return;
  const fame = Math.log10(totalFans() + 10);
  const tw = { local: 1, regional: 0.25 * fame, national: 0.08 * fame * fame, international: 0.02 * fame ** 3 };
  const weights = CITIES.map(c => (c.id === 'home' ? 2 : tw[c.tier]));
  const sum = weights.reduce((a, b) => a + b, 0);
  CITIES.forEach((c, i) => { state.cities[c.id].fans += Math.round(n * weights[i] / sum); });
}
function scaleFans(mult) { for (const c of Object.values(state.cities)) c.fans = Math.max(0, Math.floor(c.fans * mult)); }

// ---------- members ----------
function byId(id) { return state.members.find(m => m.id === +id); }
function instrLevel(m) { return m.instruments[m.instrument] || 0; }
function statSum(m) { return instrLevel(m) + m.theory + m.performance + m.creativity; }
function salary(m) { return 300 + 50 * statSum(m); }
function spreadOf(m) { return m.trait === 'Steady' ? 0.5 : m.trait === 'Wildcard' ? 1.6 : 1; }
function xpNeed(level) { return level <= 0 ? 50 : 100 * level; }

function randomName() {
  const used = new Set([...state.members, ...(state.candidates || [])].map(m => m.name));
  let n;
  for (let i = 0; i < 30; i++) {
    n = RNG.pick(FIRST_NAMES) + ' ' + RNG.pick('ABCDEFGHJKLMNPRSTVWZ'.split('')) + '.';
    if (!used.has(n)) break;
  }
  return n;
}
function randomTitle() {
  const a = RNG.pick(TITLE_ADJ), n = RNG.pick(TITLE_NOUN);
  return RNG.pick([`${a} ${n}`, `The ${a} ${n}`, `${n} of ${RNG.pick(TITLE_NOUN)}`, `${a}`]);
}

function makeMember(min, max, instrument) {
  const primary = instrument || RNG.pick(INSTRUMENTS);
  const lv = () => RNG.int(min, max);
  const instruments = { [primary]: Math.max(1, lv()) };
  if (RNG.chance(0.3)) {
    const s = RNG.pick(INSTRUMENTS.filter(i => i !== primary));
    instruments[s] = RNG.int(1, Math.max(1, max - 2));
  }
  return {
    id: state.nextId++, name: randomName(), genre: RNG.pick(GENRES), trait: RNG.pick(TRAIT_NAMES),
    instrument: primary, instruments, instrXp: {},
    theory: lv(), performance: lv(), creativity: lv(),
    xp: { theory: 0, performance: 0, creativity: 0 },
    stamina: 100, albums: 0, busy: null, request: null, warned: false,
    nextRequestIn: RNG.int(8, 16),
    gear: { tier: 0, condition: 100 },
    look: { skin: RNG.pick(SKINS), hair: RNG.pick(HAIRS), hairStyle: RNG.int(0, 5), shirt: RNG.pick(SHIRTS), pants: RNG.pick(PANTS) },
  };
}

function addXp(m, stat, amt) {
  if (m.trait === 'Prodigy') amt *= 1.5;
  if (stat === 'instrument') {
    const k = m.instrument;
    m.instrXp[k] = (m.instrXp[k] || 0) + amt;
    let lvl = m.instruments[k] || 0;
    while (lvl < 10 && m.instrXp[k] >= xpNeed(lvl)) {
      m.instrXp[k] -= xpNeed(lvl); lvl++; m.instruments[k] = lvl;
      levelUp(m, k);
    }
    if (lvl >= 10) m.instrXp[k] = 0;
  } else {
    m.xp[stat] += amt;
    while (m[stat] < 10 && m.xp[stat] >= xpNeed(m[stat])) {
      m.xp[stat] -= xpNeed(m[stat]); m[stat]++;
      levelUp(m, STAT_LABEL[stat]);
    }
    if (m[stat] >= 10) m.xp[stat] = 0;
  }
}
function levelUp(m, label) {
  UI.popupMember(m, `+1 ${label}!`, '#ffe066');
  log(`${m.name}'s ${label} rose!`, 'good');
}
function drainStamina(m, amt) {
  if (m.trait === 'Workaholic') amt *= 0.75;
  m.stamina = clamp(Math.round(m.stamina - amt), 0, 100);
}
function addStamina(m, amt) { m.stamina = clamp(Math.round(m.stamina + amt), 0, 100); if (m.stamina >= 30) m.warned = false; }

// ---------- requests ----------
// Stamina % at or below which a member may ask for a vacation.
function vacationThreshold(m) { return m.trait === 'Lazy' ? 70 : 50; }
const VACATION_REQUEST_COOLDOWN = 8; // weeks after returning before they can ask again

// Each entry: [weight, builder]. Builders return null when the request doesn't make sense right now.
const REQUEST_TYPES = {
  instrument: [3, m => {
    const v = RNG.pick(INSTRUMENTS.filter(i => i !== m.instrument));
    return { value: v, text: `I want to play ${v} on our next album.`, hint: `Switch ${m.name} to ${v} in the Band menu, then start writing an album.` };
  }],
  genre: [3, m => {
    const v = RNG.chance(0.6) ? m.genre : RNG.pick(GENRES);
    return { value: v, text: `Let's make ${/^[AEIOU]/.test(v) ? 'an' : 'a'} ${v} album!`, hint: `Start writing a ${v} album.` };
  }],
  vacation: [4, m => {
    if (m.stamina > vacationThreshold(m)) return null;
    if (m.lastVacationWeek != null && state.week - m.lastVacationWeek < VACATION_REQUEST_COOLDOWN) return null;
    return { value: null, text: 'I need a vacation...', hint: `Send ${m.name} on vacation from the Band menu.` };
  }],
  lesson: [3, m => {
    const opts = [['instrument', instrLevel(m)], ['theory', m.theory], ['creativity', m.creativity]].filter(([, l]) => l < 10);
    if (!opts.length) return null;
    const [stat] = RNG.pick(opts);
    const label = stat === 'instrument' ? m.instrument : STAT_LABEL[stat];
    return { value: stat, text: `I want to get better at ${label}.`, hint: `Book ${m.name} a ${label} lesson in the Band menu.` };
  }],
  venue: [3, m => {
    const unlocked = CITIES.filter(c => cityUnlocked(c.id));
    const away = unlocked.filter(c => c.id !== 'home');
    const pool = away.length ? away : unlocked;
    // Prefer somewhere the band hasn't played much.
    const c = pool.slice().sort((a, b) => (state.cities[a.id].shows || 0) - (state.cities[b.id].shows || 0) + RNG.float(-1.5, 1.5))[0];
    return { value: c.id, text: `I want to play a show in ${cityName(c.id)}!`, hint: `Play a show in ${cityName(c.id)} (Tour).`, weeks: 10 };
  }],
  gear: [2, m => {
    const next = GEAR_TIERS[m.gear.tier + 1];
    if (!next || state.money < next.cost * 0.5) return null;
    return { value: null, text: `My ${m.instrument.toLowerCase()} rig is holding me back.`, hint: `Upgrade ${m.name}'s gear in the Shop.` };
  }],
  tour: [2, m => {
    if (CITIES.filter(c => cityUnlocked(c.id) && tierIndex(c.id) <= 1).length < 3) return null;
    return { value: null, text: "Let's go on a real tour!", hint: 'Start a tour with 3 or more cities.', weeks: 10 };
  }],
  bandmate: [1, m => {
    if (state.members.length >= MAX_MEMBERS) return null;
    return { value: null, text: 'We need another member.', hint: 'Hire someone from the Recruit menu.', weeks: 10 };
  }],
};

function makeRequest(m) {
  const options = [];
  for (const [type, [weight, build]] of Object.entries(REQUEST_TYPES)) {
    const req = build(m);
    if (req) options.push({ type, weight, req });
  }
  let roll = Math.random() * options.reduce((a, o) => a + o.weight, 0);
  const pick = options.find(o => (roll -= o.weight) < 0) || options[0];
  m.request = { type: pick.type, weeks: 8, ...pick.req };
  m.lastRequest = { text: m.request.text, week: state.week, status: 'pending' };
  log(`${m.name}: "${m.request.text}"`, 'warn');
  UI.popupMember(m, '!', '#ff8787');
}
function fulfillRequest(m, type, value) {
  if (!m.request || m.request.type !== type) return;
  if (m.request.value !== null && m.request.value !== value) return;
  m.request = null;
  if (m.lastRequest) m.lastRequest.status = 'granted';
  m.nextRequestIn = nextRequestDelay(m);
  addStamina(m, 15);
  log(`${m.name} is happy you listened! (+15 stamina)`, 'good');
  UI.popupMember(m, '+15 Stamina', '#8ce99a');
}
function nextRequestDelay(m) { return m.trait === 'Diva' ? RNG.int(7, 12) : RNG.int(10, 18); }
const MAX_OPEN_REQUESTS = 2; // band-wide

// ---------- actions ----------
function canStartActivity() {
  if (!state.members.length) return 'You have no band members!';
  if (state.activity.type !== 'idle') return 'The band is busy right now.';
  if (state.writing) return 'Release your finished album first.';
  if (state.members.some(m => m.busy)) return 'Wait until everyone is back from lessons or vacation.';
  return null;
}

function switchInstrument(m, inst) {
  if (state.activity.type === 'tour') return 'Instruments can\'t change on tour.';
  if (state.writing) return 'Instruments are locked in until the album is finished.';
  if (m.instruments[inst] == null) { m.instruments[inst] = 0; m.instrXp[inst] = 0; log(`${m.name} picked up the ${inst} for the first time.`); }
  else log(`${m.name} switched to ${inst}.`);
  m.instrument = inst;
  return null;
}

function startLesson(m, stat) {
  if (state.activity.type !== 'idle') return 'Lessons only while the band is idle.';
  if (m.busy) return `${m.name} is busy.`;
  const lvl = stat === 'instrument' ? instrLevel(m) : m[stat];
  if (lvl >= 10) return 'Already maxed!';
  const cost = lessonCost(lvl);
  if (state.money < cost) return 'Not enough money.';
  state.money -= cost;
  m.busy = { type: 'lesson', stat, weeks: 1 };
  log(`${m.name} started ${stat === 'instrument' ? m.instrument : STAT_LABEL[stat]} lessons.`);
  fulfillRequest(m, 'lesson', stat);
  return null;
}
function startVacation(m) {
  if (state.activity.type !== 'idle') return 'Vacations only while the band is idle.';
  if (m.busy) return `${m.name} is busy.`;
  if (state.money < VACATION_COST) return 'Not enough money.';
  state.money -= VACATION_COST;
  m.busy = { type: 'vacation', weeks: VACATION_WEEKS };
  log(`${m.name} left on vacation.`);
  fulfillRequest(m, 'vacation', null);
  return null;
}
function finishBusy(m) {
  const b = m.busy; m.busy = null;
  if (b.type === 'lesson') { UI.popupMember(m, 'Lesson done', '#a5d8ff'); addXp(m, b.stat, 80); }
  else { m.lastVacationWeek = state.week; addStamina(m, 60); addXp(m, 'creativity', 40); log(`${m.name} is back from vacation, refreshed and inspired.`, 'good'); UI.popupMember(m, '+60 Stamina', '#8ce99a'); }
}

function removeMember(m) { state.members = state.members.filter(x => x !== m); }
function firePenalty(m) { return Math.min(0.2, 0.02 * m.albums); }
function fireMember(m) {
  if (state.activity.type === 'tour') return 'Can\'t fire anyone mid-tour.';
  const pen = firePenalty(m);
  removeMember(m);
  if (pen > 0) { const before = totalFans(); scaleFans(1 - pen); log(`Fans are upset that ${m.name} was fired. (-${fmtNum(before - totalFans())} fans)`, 'bad'); }
  else log(`${m.name} was let go.`);
  return null;
}

// ---------- recruiting ----------
function startRecruit(method) {
  const r = RECRUIT[method];
  if (state.activity.type === 'tour') return 'Can\'t recruit while on tour.';
  if (state.money < r.cost) return 'Not enough money.';
  state.money -= r.cost;
  if (r.weeks === 0) { state.candidates = generateCandidates(method); }
  else { state.pendingRecruit = { method, weeks: r.weeks }; log(`Searching for new members (${r.name})...`); }
  return null;
}
function generateCandidates(method) {
  const r = RECRUIT[method];
  state.candidates = [];
  for (let i = 0; i < r.count; i++) {
    const star = r.star && RNG.chance(r.star);
    const c = star ? makeMember(6, 9) : makeMember(r.min, r.max);
    c.star = star;
    state.candidates.push(c);
  }
  return state.candidates;
}
function hireCandidate(idx) {
  if (state.activity.type === 'tour') return 'Can\'t hire mid-tour.';
  if (state.members.length >= MAX_MEMBERS) return 'The band is full (5 max).';
  const c = state.candidates[idx];
  if (!c) return null;
  state.candidates.splice(idx, 1);
  delete c.star;
  state.members.push(c);
  log(`${c.name} joined the band on ${c.instrument}! (Trait: ${c.trait})`, 'good');
  state.members.forEach(m => fulfillRequest(m, 'bandmate', null));
  if (statSum(c) >= 22 && totalFans() > 0) {
    const before = totalFans(); scaleFans(1.03);
    log(`"New lineup!" Buzz brings +${fmtNum(totalFans() - before)} fans.`, 'good');
  }
  if (!state.candidates.length) state.candidates = null;
  return null;
}

// ---------- gear ----------
function gearQuality(m) { return Math.min(5, m.gear.tier + 1 + (m.trait === 'Gearhead' ? 1 : 0)) * (m.gear.condition / 100); }
function repairCost(m) { return Math.max(20, Math.round(GEAR_TIERS[m.gear.tier].cost * 0.1)); }
function repairGear(m) {
  const c = repairCost(m);
  if (state.money < c) return 'Not enough money.';
  state.money -= c; m.gear.condition = 100;
  log(`${m.name}'s gear is tuned up and good as new.`);
  return null;
}
function upgradeGear(m) {
  const next = GEAR_TIERS[m.gear.tier + 1];
  if (!next) return 'Already legendary!';
  if (state.money < next.cost) return 'Not enough money.';
  state.money -= next.cost; m.gear.tier++; m.gear.condition = 100;
  log(`${m.name} got ${next.name} gear!`, 'good');
  fulfillRequest(m, 'gear', null);
  return null;
}
function buyBus() {
  if (state.ownsBus) return null;
  if (state.money < TRANSPORT.bus.buy) return 'Not enough money.';
  state.money -= TRANSPORT.bus.buy; state.ownsBus = true;
  log('You bought a Tour Bus! National tours unlocked.', 'good');
  return null;
}

// ---------- albums ----------
function songCountFor(members) { return clamp(5 + Math.floor(avg(members.map(m => m.stamina)) / 100 * 7), 5, 12); }
function startWriting(genre, title) {
  const err = canStartActivity(); if (err) return err;
  const songs = songCountFor(state.members);
  state.writing = { genre, title: title || randomTitle(), songs, weeksLeft: songs, T: [], C: [], M: [],
    bonusC: state.nextAlbumBonus || 0, lineup: state.members.map(m => m.id),
    pts: { T: 0, C: 0, M: 0 }, byMember: {} };
  state.nextAlbumBonus = 0;
  state.activity = { type: 'writing' };
  log(`Writing "${state.writing.title}" (${genre}, ${songs} songs).`);
  state.members.forEach(m => {
    fulfillRequest(m, 'genre', genre);
    fulfillRequest(m, 'instrument', m.instrument); // instruments lock in for the album
  });
  return null;
}
function writingWeek() {
  const w = state.writing;
  w.pts = w.pts || { T: 0, C: 0, M: 0 }; w.byMember = w.byMember || {};
  const gains = [];
  for (const m of state.members) {
    const sf = 0.6 + 0.4 * m.stamina / 100;
    const sp = spreadOf(m);
    const j = () => 1 + RNG.float(-0.25, 0.25) * sp;
    const t = clamp(m.theory * 10 * sf * j(), 0, 100);
    const c = clamp(m.creativity * 10 * sf * j(), 0, 100);
    const mu = clamp(instrLevel(m) * 10 * sf * j(), 0, 100);
    w.T.push(t); w.C.push(c); w.M.push(mu);
    // Display points: the same contributions on a friendlier scale.
    const g = { T: Math.max(1, Math.round(t / 5)), C: Math.max(1, Math.round(c / 5)), M: Math.max(1, Math.round(mu / 5)) };
    const bm = w.byMember[m.id] || (w.byMember[m.id] = { name: m.name, T: 0, C: 0, M: 0 });
    for (const k of ['T', 'C', 'M']) { w.pts[k] += g[k]; bm[k] += g[k]; }
    gains.push({ m, g });
    addXp(m, 'theory', 12); addXp(m, 'creativity', 10); addXp(m, 'instrument', 4);
    drainStamina(m, 3);
  }
  if (UI.writingPoints) UI.writingPoints(gains);
  w.weeksLeft--;
  if (w.weeksLeft <= 0) {
    state.activity = { type: 'idle' };
    log(`"${w.title}" is finished!`, 'good');
    UI.open(Modals.release);
  }
}
// Genre mastery: each Acclaimed album in a genre is +4 critic points for future albums
// in that genre (a Classic counts double), capped at +12.
function genreMastery(genre) { return Math.min(12, 4 * ((state.genreAcclaim || {})[genre] || 0)); }
function lengthScore(n) { return n >= 8 && n <= 10 ? 100 : (n === 6 || n === 7 || n === 11) ? 80 : 60; }
function scoreLabel(s) {
  if (s >= 90) return { text: 'Classic', cls: 'gold' };
  if (s >= 75) return { text: 'Acclaimed', cls: 'good' };
  if (s >= 55) return { text: 'Solid', cls: 'ok' };
  if (s >= 35) return { text: 'Mixed', cls: 'meh' };
  return { text: 'Flop', cls: 'bad' };
}
function quoteIndex(s) { return s < 35 ? 0 : s < 55 ? 1 : s < 75 ? 2 : s < 90 ? 3 : 4; }

function releaseAlbum(format) {
  const w = state.writing, f = FORMATS[format];
  if (state.money < f.cost) return null;
  state.money -= f.cost;
  let lineup = state.members.filter(m => w.lineup.includes(m.id));
  if (!lineup.length) lineup = state.members;
  const pools = { T: avg(w.T), C: clamp(avg(w.C) + w.bonusC, 0, 100), M: avg(w.M), L: lengthScore(w.songs) };
  let fit = Math.min(16, lineup.filter(m => m.genre === w.genre).length * 4);
  if (state.trending.includes(w.genre)) fit += 8;
  if (state.stale === w.genre) fit -= 8;
  const mastery = genreMastery(w.genre);
  fit += mastery;
  const spread = avg(lineup.map(spreadOf)) || 1;

  const critics = CRITICS.map((c, i) => {
    let moment = null;
    const score = rollUnique('critic' + i, () => {
      moment = null;
      const bias = c.bias === null ? RNG.int(-6, 6) : c.bias;
      const weighted = c.w.T * pools.T + c.w.C * pools.C + c.w.M * pools.M + c.w.L * pools.L;
      let raw = 25 + 0.7 * weighted + fit + bias + (RNG.dice(3, 11) - 18) * spread;
      const r = Math.random();
      if (r < 0.04) { moment = 'Masterpiece!'; raw += RNG.int(15, 25); }
      else if (r < 0.08) { moment = 'Panned!'; raw -= RNG.int(15, 25); }
      return clamp(Math.round(raw), 0, 100);
    });
    return { name: c.name, color: c.color, score, moment, quote: c.quotes[quoteIndex(score)] };
  });
  const score = round1(avg(critics.map(c => c.score)));

  const before = totalFans();
  const q = clamp(Math.pow(score / 60, 1.5), 0.15, 2.5);
  const gm = state.trending.includes(w.genre) ? 1.15 : state.stale === w.genre ? 0.9 : 1;
  let newFans = Math.round((150 + 3 * Math.pow(before, 0.8)) * q * f.fanMult * gm * RNG.float(0.85, 1.15));
  let lost = 0;
  if (score < 35) { scaleFans(0.95); lost = before - totalFans(); newFans = Math.round(newFans * 0.3); }
  distributeFans(newFans);

  const album = { title: w.title, genre: w.genre, songs: w.songs, format, score, critics, week: state.week,
    fansGained: newFans, fansLost: lost, sales: 0, revenue: 0, remaining: 0, firstWeek: 0,
    mastery, pts: w.pts ? { ...w.pts } : null };
  if (score >= 75) {
    state.genreAcclaim = state.genreAcclaim || {};
    state.genreAcclaim[w.genre] = (state.genreAcclaim[w.genre] || 0) + (score >= 90 ? 2 : 1);
    album.masteryUp = true;
  }
  if (f.price > 0) {
    const buyers = totalFans() * f.buy * q * RNG.float(0.85, 1.15);
    const first = Math.round(buyers * 0.35);
    album.remaining = buyers - first;
    album.firstWeek = first;
    sellAlbums(album, first);
  }
  state.albums.push(album);
  state.writing = null;
  state.weeksSinceAlbum = 0;
  lineup.forEach(m => m.albums++);
  log(`"${album.title}" released! Critics: ${score} (${scoreLabel(score).text}).`, score >= 55 ? 'good' : 'bad');
  return album;
}
function sellAlbums(a, n) {
  const rev = n * FORMATS[a.format].price;
  a.sales += n; a.revenue += rev; state.money += rev; state.totals.earned += rev;
}
function albumSalesWeek() {
  for (const a of state.albums) {
    if (a.remaining >= 1) {
      const n = Math.max(1, Math.round(a.remaining * 0.25));
      a.remaining -= n;
      sellAlbums(a, n);
    }
  }
}
function latestAlbum() { return state.albums[state.albums.length - 1] || null; }
function latestPhysical() {
  for (let i = state.albums.length - 1; i >= 0; i--) if (FORMATS[state.albums[i].format].price > 0) return state.albums[i];
  return null;
}

// ---------- shows & tours ----------
function computeShowScore() {
  const ms = state.members;
  const la = latestAlbum();
  const base = avg(ms.map(m => m.performance + (m.trait === 'Diva' ? 1 : 0))) * 40
    + avg(ms.map(instrLevel)) * 20
    + avg(ms.map(gearQuality)) * 30
    + (la ? la.score * 1.5 : 0);
  const stMult = 0.6 + 0.4 * avg(ms.map(m => m.stamina)) / 100;
  let events = [];
  const score = rollUnique('show', () => {
    events = [];
    let raw = base * stMult;
    for (const m of ms) raw += (RNG.dice(2, 25) - 26) * spreadOf(m); // each member's night
    raw += RNG.dice(1, 61) - 31;                                      // the crowd's mood
    for (const m of ms) if (m.gear.condition < 40 && RNG.chance(0.2)) { raw -= 80; events.push(`${m.name}'s gear failed mid-song!`); }
    const r = Math.random();
    if (r < 0.04) { raw += RNG.int(80, 150); events.push('ENCORE! The crowd went wild!'); }
    else if (r < 0.08) { raw -= RNG.int(80, 150); events.push('DISASTER! Nothing went right.'); }
    return clamp(Math.round(raw), 0, 1000);
  });
  return { score, events };
}

function tourCost(cityIds, transport) {
  const t = TRANSPORT[transport];
  let cost = cityIds.reduce((a, id) => a + (id === 'home' ? 0 : t.perCity), 0);
  if (transport === 'jet' && cityIds.length) cost += t.rent;
  return cost;
}
function merchCost(buy) { return Object.entries(buy).reduce((a, [k, n]) => a + n * MERCH[k].cost, 0); }

function startTour(cityIds, transport, buy) {
  const err = canStartActivity(); if (err) return err;
  if (!cityIds.length) return 'Pick at least one city.';
  const cost = tourCost(cityIds, transport) + merchCost(buy);
  if (state.money < cost) return 'Not enough money.';
  state.money -= cost;
  for (const [k, n] of Object.entries(buy)) state.merch[k] += n;
  state.activity = { type: 'tour', cities: cityIds.slice(), idx: 0, transport, results: [], cancelled: [] };
  // Requests count as granted the moment the show/tour is booked, not when it's played.
  for (const m of state.members) {
    if (m.request && m.request.type === 'venue' && cityIds.includes(m.request.value)) fulfillRequest(m, 'venue', m.request.value);
    if (cityIds.length >= 3) fulfillRequest(m, 'tour', null);
  }
  log(cityIds.length === 1 ? `Booked a show in ${cityName(cityIds[0])}.` : `Tour started: ${cityIds.length} cities by ${TRANSPORT[transport].name}!`);
  return null;
}

function playShow(cityId, transport) {
  const s = state, ms = s.members;
  const tier = CITY_TIERS[CITY_BY_ID[cityId].tier], cs = s.cities[cityId];
  const { score, events } = computeShowScore();
  const cap = Math.max(tier.cap, Math.round(cs.fans * 0.8));
  const walkins = RNG.int(5, 20) + Math.round(score / 50);
  const attendance = Math.min(cap, Math.round(cs.fans * (0.35 + score / 2000) * RNG.float(0.9, 1.1)) + walkins);
  const tickets = attendance * tier.ticket;
  let merchRev = 0; const sold = {};
  for (const [k, it] of Object.entries(MERCH)) {
    const want = Math.round(attendance * it.rate * (score / 1000) * RNG.float(0.7, 1.3));
    const n = Math.min(want, s.merch[k]);
    s.merch[k] -= n; sold[k] = n; merchRev += n * it.price;
  }
  const pa = latestPhysical();
  if (pa) {
    let n = Math.round(attendance * 0.3 * (score / 1000) * clamp(pa.score / 70, 0.3, 1.5) * RNG.float(0.7, 1.3));
    if (pa.format === 'cddvd' && score >= 700) n = Math.round(n * 1.25);
    sold.album = n;
    const rev = n * FORMATS[pa.format].price;
    pa.sales += n; pa.revenue += rev; merchRev += rev;
  }
  const fanDelta = Math.round(attendance * (score - 150) / 1000 + walkins * score / 600);
  cs.fans = Math.max(0, cs.fans + fanDelta);
  cs.shows = (cs.shows || 0) + 1;
  s.money += tickets + merchRev;
  s.totals.earned += tickets + merchRev;
  s.totals.shows++;
  s.lastAttendance = attendance;
  for (const m of ms) {
    drainStamina(m, TRANSPORT[transport].drain);
    m.gear.condition = Math.max(0, m.gear.condition - Math.round(RNG.int(5, 10) * (m.trait === 'Gearhead' ? 0.5 : 1)));
    addXp(m, 'performance', 15 + score / 40);
    addXp(m, 'instrument', 10);
  }
    const res = { cityId, score, events, attendance, tickets, merchRev, sold, fanDelta };
  log(`${cityName(cityId)}: score ${score}, ${attendance} came, +${fmtMoney(tickets + merchRev)}`, score >= 400 ? 'good' : 'info');
  events.forEach(e => log(e, e.startsWith('ENCORE') ? 'good' : 'bad'));
  return res;
}

function tourWeek() {
  const a = state.activity;
  if (!state.members.length) { state.activity = { type: 'idle' }; return; }
  const r = playShow(a.cities[a.idx], a.transport);
  a.results.push(r); a.idx++;
  UI.showScorePopup(r);
  const collapsed = state.members.filter(m => m.stamina <= 0);
  if (collapsed.length && a.idx < a.cities.length) {
    a.cancelled = a.cities.slice(a.idx);
    a.cancelled.forEach(id => { state.cities[id].fans = Math.floor(state.cities[id].fans * 0.95); });
    log(`${collapsed.map(m => m.name).join(' & ')} collapsed from exhaustion! The rest of the tour is cancelled.`, 'bad');
    endTour();
  } else if (a.idx >= a.cities.length) endTour();
}
function endTour() {
  const a = state.activity;
  state.activity = { type: 'idle' };
  if (a.cities.length > 1 || a.cancelled.length) UI.open(p => Modals.tourSummary(p, a));
}

// ---------- events ----------
function randomEvent() {
  const s = state, tf = totalFans();
  const pool = ['fanmail', 'feud'];
  if (s.albums.length) pool.push('radio');
  if (tf > 50 && s.albums.length) pool.push('viral');
  if (!s.ownsBus && s.money > 100) pool.push('van');
  if (tf >= 1500 && s.activity.type === 'idle' && !s.writing && !s.members.some(m => m.busy)) pool.push('festival', 'festival');
  switch (RNG.pick(pool)) {
    case 'radio': {
      const c = RNG.pick(CITIES.filter(c => cityUnlocked(c.id)));
      const gain = Math.max(8, Math.round(s.cities[c.id].fans * RNG.float(0.1, 0.25)));
      s.cities[c.id].fans += gain;
      UI.open(Modals.message('Radio Play!', `A DJ in ${cityName(c.id)} spun one of your songs. +${fmtNum(gain)} fans there.`));
      break;
    }
    case 'viral': {
      const before = tf, pct = RNG.float(0.05, 0.12);
      for (const c of Object.values(s.cities)) c.fans += Math.round(c.fans * pct);
      distributeFans(RNG.int(10, 40));
      UI.open(Modals.message('Gone Viral!', `A fan's clip of your band blew up online. +${fmtNum(totalFans() - before)} fans worldwide.`));
      break;
    }
    case 'van': {
      const cost = Math.min(s.money, RNG.int(100, 300));
      s.money -= cost;
      UI.open(Modals.message('Van Trouble', `The van broke down. Repairs cost ${fmtMoney(cost)}.`));
      break;
    }
    case 'feud': {
      if (s.writing) s.writing.bonusC += 10; else s.nextAlbumBonus = 10;
      s.members.forEach(m => drainStamina(m, 10));
      UI.open(Modals.message('Rival Feud!', `A rival band trashed you in an interview. Everyone is stressed (-10 stamina), but fired up: ${s.writing ? 'the album in progress' : 'your next album'} gets a Creativity boost.`));
      break;
    }
    case 'fanmail': {
      s.members.forEach(m => addStamina(m, 10));
      UI.open(Modals.message('Fan Mail', 'A heartfelt letter from a fan lifted everyone\'s spirits. +10 stamina for all.'));
      break;
    }
    case 'festival': UI.open(Modals.festival); break;
  }
}
function playFestival() {
  const tf = totalFans();
  const { score, events } = computeShowScore();
  const pay = Math.round(500 + tf * 0.15 * (score / 500));
  const before = tf;
  distributeFans(Math.round(tf * 0.04 * (score / 500)));
  state.money += pay; state.totals.earned += pay;
  state.members.forEach(m => { drainStamina(m, 15); addXp(m, 'performance', 30); });
  log(`Festival set scored ${score}! +${fmtMoney(pay)}`, 'good');
  return { score, events, pay, fans: totalFans() - before };
}

// ---------- milestones ----------
const MILESTONES = [
  ['firstAlbum', s => s.albums.length >= 1, 'First album released!'],
  ['firstCD', s => s.albums.some(a => a.format !== 'online'), 'First physical release!'],
  ['acclaimed', s => s.albums.some(a => a.score >= 75), 'First Acclaimed album!'],
  ['classic', s => s.albums.some(a => a.score >= 90), 'You made a CLASSIC album!'],
  ['fans1k', s => totalFans() >= 1000, '1,000 fans!'],
  ['fans10k', s => totalFans() >= 10000, '10,000 fans!'],
  ['fans100k', s => totalFans() >= 100000, '100,000 fans! Superstars!'],
  ['bus', s => s.ownsBus, 'Bought a Tour Bus!'],
  ['intl', s => CITIES.some(c => c.tier === 'international' && s.cities[c.id].shows > 0), 'First international show!'],
  ['fullBand', s => s.members.length >= MAX_MEMBERS, 'Full five-piece band!'],
];
function checkMilestones() {
  for (const [k, test, text] of MILESTONES) {
    if (!state.milestones[k] && test(state)) {
      state.milestones[k] = state.week;
      log(`🏆 ${text}`, 'gold');
      UI.toast(`🏆 ${text}`);
    }
  }
}

// ---------- weekly tick ----------
function memberWeek(m) {
  const s = state;
  if (m.busy) { m.busy.weeks--; if (m.busy.weeks <= 0) finishBusy(m); }
  else if (s.activity.type === 'idle' && !s.writing) addStamina(m, 5);

  // A rested member quietly drops a vacation request instead of holding it against you.
  if (m.request && m.request.type === 'vacation' && m.stamina >= vacationThreshold(m) + 30) {
    m.request = null; m.nextRequestIn = nextRequestDelay(m);
    if (m.lastRequest) m.lastRequest.status = 'withdrawn';
    log(`${m.name} feels rested and dropped their vacation request.`);
  }
  // Requests only come up, and only tick down, while the band is free to act on them.
  const bandFree = s.activity.type === 'idle' && !s.writing;
  if (m.request) {
    if (bandFree) m.request.weeks--;
    if (m.request.weeks <= 0) {
      const text = m.request.text;
      m.request = null; m.nextRequestIn = nextRequestDelay(m);
      if (m.lastRequest) m.lastRequest.status = 'ignored';
      m.stamina = clamp(m.stamina - 20, 0, 100);
      log(`${m.name} feels ignored ("${text}") -20 stamina`, 'bad');
      UI.popupMember(m, '-20 Stamina', '#ff8787');
    }
  } else if (bandFree && --m.nextRequestIn <= 0) {
    if (s.members.filter(x => x.request).length >= MAX_OPEN_REQUESTS) m.nextRequestIn = RNG.int(3, 6);
    else makeRequest(m);
  }

  if (m.stamina < 30 && !m.warned) { m.warned = true; log(`${m.name} is exhausted. Give them some rest!`, 'warn'); }
  if (m.stamina <= 0 && s.activity.type !== 'tour' && RNG.chance(0.5)) {
    removeMember(m);
    log(`${m.name} burned out and QUIT the band!`, 'bad');
    UI.toast(`${m.name} quit the band!`);
  }
}

function advanceWeek() {
  const s = state;
  s.week++;
  if (s.activity.type === 'writing') writingWeek();
  else if (s.activity.type === 'tour') tourWeek();
  for (const m of [...s.members]) memberWeek(m);
  albumSalesWeek();
  if (s.pendingRecruit && --s.pendingRecruit.weeks <= 0) {
    generateCandidates(s.pendingRecruit.method);
    s.pendingRecruit = null;
    log('Your recruiting search found some musicians! Check Recruit.', 'good');
    UI.toast('New recruits found!');
  }
  s.weeksSinceAlbum++;
  if (s.weeksSinceAlbum > 30 && s.albums.length) {
    scaleFans(0.99);
    if (s.weeksSinceAlbum === 31) log('Fans are drifting away. Time for a new album!', 'warn');
  }
  if (s.activity.type !== 'tour' && RNG.chance(0.04)) randomEvent();
  s.peakFans = Math.max(s.peakFans, totalFans());
  checkMilestones();
  if (!s.members.length) { gameOver('Everyone left the band.'); return; }
  if (s.week % WEEKS_PER_YEAR === 0) {
    s.paydayDue = true;
    UI.open(Modals.payday);
    rollTrends(false);
  }
  save();
}

function rollTrends(first) {
  const g = RNG.shuffle(GENRES.slice());
  state.trending = [g[0], g[1]]; state.stale = g[2];
  log(`${first ? 'This year' : 'New year!'} ${g[0]} & ${g[1]} are trending. ${g[2]} is stale.`);
}

// ---------- payday ----------
function payMembers(ids) {
  const leaving = [];
  for (const m of [...state.members]) {
    if (ids.includes(m.id)) state.money -= salary(m);
    else { leaving.push(m.name); removeMember(m); }
  }
  state.paydayDue = false;
  log(`Payday! Paid ${state.members.length} member(s).`);
  if (leaving.length) log(`${leaving.join(', ')} left the band unpaid.`, 'bad');
  if (!state.members.length) gameOver('You couldn\'t pay anyone, and the band broke up.');
  else save();
}

// ---------- lifecycle ----------
function newGame(bandName, hometown) {
  state = {
    bandName, hometown, week: 0, money: START_MONEY, speed: 1, nextId: 1,
    members: [], candidates: null, pendingRecruit: null,
    activity: { type: 'idle' }, writing: null, albums: [],
    cities: {}, trending: [], stale: null,
    merch: Object.fromEntries(Object.keys(MERCH).map(k => [k, 0])),
    ownsBus: false, nextAlbumBonus: 0, genreAcclaim: {},
    rollHistory: {}, log: [], weeksSinceAlbum: 0, milestones: {},
    peakFans: 0, totals: { shows: 0, earned: 0 }, paydayDue: false, gameOver: false, lastAttendance: 0,
  };
  CITIES.forEach(c => { state.cities[c.id] = { fans: c.id === 'home' ? 25 : 0, shows: 0 }; });
  ['Guitar', 'Drums', 'Vocals'].forEach(i => state.members.push(makeMember(1, 3, i)));
  rollTrends(true);
  log(`${bandName} formed in ${hometown}!`, 'good');
  log('Tip: play hometown gigs (Tour) for cash, then Write an album.');
  save();
}

function gameOver(reason) {
  const s = state;
  s.gameOver = true;
  const entry = { band: s.bandName, years: round1(s.week / WEEKS_PER_YEAR), peakFans: s.peakFans,
    albums: s.albums.length, best: s.albums.reduce((b, a) => Math.max(b, a.score), 0) };
  try {
    const list = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    list.push(entry);
    list.sort((a, b) => b.peakFans - a.peakFans);
    localStorage.setItem(LEGACY_KEY, JSON.stringify(list.slice(0, 10)));
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage unavailable */ }
  UI.open(p => Modals.gameOver(p, reason, entry));
}

function save() { if (!state || state.gameOver) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { state = JSON.parse(raw); return true; } } catch (e) { /* ignore */ }
  return false;
}
function getLegacy() { try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); } catch (e) { return []; } }
