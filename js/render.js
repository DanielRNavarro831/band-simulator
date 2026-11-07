// ===== Band Simulator: 8-bit canvas renderer (160x120 logical pixels) =====
const Render = {
  W: 160, H: 120,
  init(canvas) { this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false; },
  slotX(i, n) { return Math.round(this.W * (i + 1) / (n + 1)) - 5; },
  lingerUntil: 0, scene: 'room',
  memberY() { return this.scene === 'stage' ? 58 : 74; },

  draw(t) {
    if (!state) return;
    const ctx = this.ctx;
    let mode = state.activity.type;
    if (mode === 'idle' && t < this.lingerUntil) mode = 'tour'; // keep the stage up briefly after a gig
    this.scene = mode === 'tour' ? 'stage' : 'room';
    if (mode === 'tour') { this.stage(ctx, t); this.members(ctx, t, mode); this.crowd(ctx, t); }
    else { this.room(ctx, t); this.members(ctx, t, mode); }
  },

  room(ctx, t) {
    px(ctx, 0, 0, 160, 84, '#2e2148');
    for (let row = 0; row < 14; row++) {
      const y = row * 6;
      for (let x = (row % 2) * 8 - 8; x < 160; x += 16) px(ctx, x, y, 15, 5, '#382a57');
    }
    // window with drifting cloud; sky shifts with the season
    const month = dateParts().month;
    const sky = month <= 2 || month >= 11 ? '#9fb7d8' : month <= 8 ? '#74c0fc' : '#f3a683';
    px(ctx, 12, 10, 26, 20, '#1b1330'); px(ctx, 14, 12, 22, 16, sky);
    px(ctx, 14 + Math.floor((t / 400) % 22), 16, 6, 2, '#fff'); px(ctx, 15 + Math.floor((t / 400) % 22), 15, 3, 1, '#fff');
    px(ctx, 24, 12, 1, 16, '#1b1330'); px(ctx, 14, 19, 22, 1, '#1b1330');
    // poster
    px(ctx, 118, 10, 22, 28, '#f8f0e3'); px(ctx, 120, 12, 18, 12, '#e64980'); px(ctx, 126, 15, 6, 6, '#ffe066');
    px(ctx, 120, 27, 18, 2, '#333'); px(ctx, 120, 31, 12, 2, '#333');
    // trophy shelf: one trophy per Acclaimed+ album
    px(ctx, 52, 30, 50, 2, '#6b4a2b');
    const trophies = state.albums.filter(a => a.score >= 75).length;
    for (let i = 0; i < Math.min(8, trophies); i++) {
      const x = 54 + i * 6, gold = state.albums.filter(a => a.score >= 75)[i].score >= 90;
      px(ctx, x, 24, 4, 3, gold ? '#ffd43b' : '#ced4da'); px(ctx, x + 1, 27, 2, 2, '#8d6e63');
    }
    // floor & rug
    px(ctx, 0, 84, 160, 36, '#7a5230');
    for (let y = 88; y < 120; y += 6) px(ctx, 0, y, 160, 1, '#6a4526');
    px(ctx, 16, 92, 128, 22, '#8f2d3a'); px(ctx, 18, 94, 124, 18, '#b23a4a');
    // amps
    px(ctx, 3, 68, 14, 20, '#1e1e24'); px(ctx, 5, 71, 10, 10, '#495057'); px(ctx, 5, 84, 2, 2, '#ffd43b');
    px(ctx, 143, 70, 14, 18, '#1e1e24'); px(ctx, 145, 73, 10, 9, '#495057'); px(ctx, 153, 84, 2, 2, '#ffd43b');
  },

  stage(ctx, t) {
    px(ctx, 0, 0, 160, 120, '#0b0820');
    for (let x = 0; x < 160; x += 8) { px(ctx, x, 0, 4, 44, '#5a0f1e'); px(ctx, x + 4, 0, 4, 44, '#430b16'); }
    px(ctx, 0, 4, 160, 2, '#555'); for (let i = 0; i < 6; i++) px(ctx, 12 + i * 27, 6, 4, 3, '#adb5bd');
    ctx.globalAlpha = 0.18;
    const cols = ['#ffd43b', '#ff6b6b', '#74c0fc', '#b197fc'];
    for (let i = 0; i < 4; i++) {
      const sx = 20 + i * 40, sway = Math.sin(t / 700 + i) * 25;
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(sx, 8);
      ctx.lineTo(sx + sway - 14, 80); ctx.lineTo(sx + sway + 14, 80); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    px(ctx, 0, 78, 160, 14, '#3a3a46'); px(ctx, 0, 78, 160, 2, '#55556a');
    px(ctx, 2, 56, 14, 22, '#111'); px(ctx, 5, 60, 8, 8, '#333'); px(ctx, 6, 70, 6, 6, '#333');
    px(ctx, 144, 56, 14, 22, '#111'); px(ctx, 147, 60, 8, 8, '#333'); px(ctx, 148, 70, 6, 6, '#333');
    px(ctx, 0, 92, 160, 28, '#141026');
  },

  crowd(ctx, t) {
    const n = clamp(Math.round(10 + Math.sqrt(state.lastAttendance || 0) * 3), 10, 70);
    for (let row = 0; row < 4; row++) {
      for (let i = row; i < n; i += 4) {
        const h = hash(i * 7 + 3);
        const x = (i * 37 + row * 11) % 156;
        const jump = Math.sin(t / 130 + h * 6) > 0.4 ? -2 : 0;
        const y = 96 + row * 6 + jump;
        px(ctx, x, y + 4, 6, 8, SHIRTS[Math.floor(h * SHIRTS.length)]);
        px(ctx, x + 1, y, 4, 4, SKINS[Math.floor(hash(i) * SKINS.length)]);
        if (jump) { px(ctx, x, y - 3, 1, 4, SKINS[Math.floor(hash(i) * SKINS.length)]); }
      }
    }
  },

  members(ctx, t, mode) {
    const ms = state.members, n = ms.length, baseY = this.memberY();
    ms.forEach((m, i) => {
      const x = this.slotX(i, n), y = baseY;
      if (m.busy && m.busy.type === 'vacation') { palm(ctx, x, y); return; }
      const jam = mode !== 'idle';
      const bob = jam ? (Math.sin(t / (mode === 'tour' ? 120 : 220) + i * 1.7) > 0 ? -1 : 0)
                      : (Math.sin(t / 900 + i) > 0.7 ? -1 : 0);
      person(ctx, x, y + bob, m, t, jam);
      if (m.busy) book(ctx, x + 2, y - 9);
      else if (m.request && Math.floor(t / 400) % 2) bubble(ctx, x + 6, y - 10);
      if (m.stamina < 30) px(ctx, x + 9, y + 1 + (Math.floor(t / 200) % 3), 1, 2, '#74c0fc');
      if (mode === 'writing') {
        const k = (t / 40 + i * 37) % 30;
        ctx.globalAlpha = 1 - k / 30;
        note(ctx, x + 3 + Math.round(Math.sin(k / 5) * 2), y - 4 - k);
        ctx.globalAlpha = 1;
      }
    });
  },
};

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function hash(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }

function person(ctx, x, y, m, t, jam) {
  const L = m.look, inst = m.instrument;
  const strum = jam && Math.floor(t / 150) % 2;
  // legs & shoes
  px(ctx, x + 2, y + 13, 2, 5, L.pants); px(ctx, x + 6, y + 13, 2, 5, L.pants);
  px(ctx, x + 1, y + 18, 3, 1, '#111'); px(ctx, x + 6, y + 18, 3, 1, '#111');
  // body & arms
  px(ctx, x + 1, y + 7, 8, 6, L.shirt);
  px(ctx, x, y + 8, 1, 4, L.shirt); px(ctx, x + 9, y + 8, 1, 4, L.shirt);
  px(ctx, x, y + 12, 1, 1, L.skin); px(ctx, x + 9, y + 12, 1, 1, L.skin);
  // head
  px(ctx, x + 2, y + 1, 6, 6, L.skin);
  px(ctx, x + 3, y + 3, 1, 1, '#222'); px(ctx, x + 6, y + 3, 1, 1, '#222');
  if (jam && (inst === 'Vocals' || strum)) px(ctx, x + 4, y + 5, 2, 1, '#7a2a2a');
  // hair
  const H = L.hair;
  switch (L.hairStyle) {
    case 0: px(ctx, x + 2, y, 6, 2, H); px(ctx, x + 2, y + 2, 1, 1, H); px(ctx, x + 7, y + 2, 1, 1, H); break;
    case 1: px(ctx, x + 2, y, 6, 2, H); px(ctx, x + 1, y + 1, 1, 7, H); px(ctx, x + 8, y + 1, 1, 7, H); break;
    case 2: px(ctx, x + 4, y - 2, 2, 3, H); break;
    case 3: break;
    case 4: px(ctx, x + 1, y - 2, 8, 4, H); px(ctx, x + 1, y + 2, 1, 2, H); px(ctx, x + 8, y + 2, 1, 2, H); break;
    default: px(ctx, x + 2, y, 6, 2, H); px(ctx, x + 6, y + 1, 4, 1, H); break;
  }
  instrument(ctx, x, y, inst, t, jam, strum);
}

function instrument(ctx, x, y, inst, t, jam, strum) {
  switch (inst) {
    case 'Guitar':
      px(ctx, x + 1, y + 9, 5, 4, '#c0392b'); px(ctx, x + 2, y + 10, 2, 2, '#111');
      px(ctx, x + 6, y + 9, 5, 1, '#8b5a2b'); px(ctx, x + 11, y + 8, 1, 2, '#333');
      if (strum) px(ctx, x + 3, y + 8, 1, 1, '#fff'); break;
    case 'Bass':
      px(ctx, x + 1, y + 9, 5, 4, '#1c7ed6'); px(ctx, x + 6, y + 9, 7, 1, '#8b5a2b'); px(ctx, x + 13, y + 8, 1, 2, '#333'); break;
    case 'Drums': {
      const hit = jam && Math.floor(t / 120) % 2;
      px(ctx, x - 1, y + 6 + (hit ? 0 : 2), 2, 1, '#e9d8a6'); px(ctx, x + 9, y + 6 + (hit ? 2 : 0), 2, 1, '#e9d8a6');
      px(ctx, x - 5, y + 6, 5, 1, '#ffd43b'); px(ctx, x - 3, y + 7, 1, 12, '#868e96');
      px(ctx, x - 3, y + 10, 4, 2, '#ced4da'); px(ctx, x + 9, y + 10, 4, 2, '#ced4da');
      px(ctx, x - 1, y + 12, 12, 7, '#e9ecef'); px(ctx, x, y + 13, 10, 5, '#c92a2a'); px(ctx, x + 4, y + 14, 2, 3, '#e9ecef');
      break;
    }
    case 'Vocals':
      px(ctx, x + 11, y + 6, 1, 13, '#868e96'); px(ctx, x + 9, y + 18, 5, 1, '#868e96'); px(ctx, x + 10, y + 4, 2, 2, '#343a40'); break;
    case 'Keys':
      px(ctx, x - 2, y + 11, 14, 3, '#f8f9fa');
      for (let i = 0; i < 6; i++) px(ctx, x - 1 + i * 2, y + 11, 1, 1, '#222');
      px(ctx, x - 1, y + 14, 1, 5, '#495057'); px(ctx, x + 10, y + 14, 1, 5, '#495057'); break;
    case 'Synth':
      px(ctx, x - 2, y + 11, 14, 3, '#212529');
      ['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc'].forEach((c, i) => px(ctx, x + i * 3, y + 11, 1, 1, (jam && Math.floor(t / 200 + i) % 2) ? c : '#495057'));
      px(ctx, x - 1, y + 14, 1, 5, '#495057'); px(ctx, x + 10, y + 14, 1, 5, '#495057'); break;
    case 'Turntables':
      px(ctx, x - 3, y + 11, 16, 8, '#495057');
      px(ctx, x - 2, y + 10, 6, 2, '#111'); px(ctx, x + 6, y + 10, 6, 2, '#111');
      px(ctx, x + (jam ? Math.floor(t / 100) % 4 : 0) - 1, y + 10, 1, 1, '#ced4da'); break;
    case 'Sax':
      px(ctx, x + 6, y + 6, 1, 7, '#e0a800'); px(ctx, x + 5, y + 12, 3, 2, '#e0a800'); px(ctx, x + 5, y + 5, 2, 1, '#e0a800'); break;
    case 'Violin':
      px(ctx, x + 6, y + 6, 3, 4, '#8b4513'); px(ctx, x + 8, y + 5, 3, 1, '#5c3317');
      px(ctx, x + 2 + (strum ? 2 : 0), y + 8, 6, 1, '#dee2e6'); break;
  }
}
function palm(ctx, x, y) {
  px(ctx, x + 4, y + 6, 2, 13, '#8d6e63');
  px(ctx, x, y + 4, 10, 2, '#2f9e44'); px(ctx, x - 2, y + 6, 3, 2, '#2f9e44'); px(ctx, x + 9, y + 6, 3, 2, '#2f9e44');
  px(ctx, x + 3, y + 3, 4, 1, '#40c057');
}
function book(ctx, x, y) { px(ctx, x, y, 6, 5, '#1971c2'); px(ctx, x + 1, y + 1, 4, 3, '#f8f9fa'); px(ctx, x + 3, y, 1, 5, '#1971c2'); }
function bubble(ctx, x, y) { px(ctx, x, y, 6, 7, '#fff'); px(ctx, x + 1, y + 7, 2, 1, '#fff'); px(ctx, x + 2, y + 1, 2, 3, '#e03131'); px(ctx, x + 2, y + 5, 2, 1, '#e03131'); }
function note(ctx, x, y) { px(ctx, x + 1, y, 1, 4, '#fff59d'); px(ctx, x, y + 3, 2, 2, '#fff59d'); px(ctx, x + 2, y, 1, 1, '#fff59d'); }

// Small portrait of a member playing their current instrument (Band & Recruit cards).
function drawPortrait(canvas, m) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  px(ctx, 0, 0, 26, 26, '#2e2148');
  for (let y = 0; y < 20; y += 5) for (let x = (y / 5 % 2) * 4 - 4; x < 26; x += 8) px(ctx, x, y, 7, 4, '#382a57');
  px(ctx, 0, 20, 26, 6, '#7a5230'); px(ctx, 0, 23, 26, 1, '#6a4526');
  person(ctx, 8, 3, m, 0, false);
}
function drawPortraits(root, list) {
  root.querySelectorAll('canvas[data-portrait]').forEach(c => {
    const m = list[+c.dataset.portrait];
    if (m) drawPortrait(c, m);
  });
}
