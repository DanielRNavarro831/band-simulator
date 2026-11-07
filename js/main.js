// ===== Band Simulator: boot, title screen & game loop =====
const Title = {
  show() {
    $('#title').hidden = false;
    $('#btn-continue').hidden = !hasSave();
    const legacy = getLegacy();
    $('#legacy').innerHTML = legacy.length
      ? '<h3>Legacy</h3>' + legacy.slice(0, 5).map(e => `<div class="line"><span>${esc(e.band)}</span><span>${fmtNum(e.peakFans)} fans · ${e.years}y</span></div>`).join('')
      : '';
  },
  hide() { $('#title').hidden = true; },
  start() {
    Music.play(); // tap on New Band = the gesture phones need to allow audio
    const band = $('#in-band').value.trim() || 'The Unnamed';
    const town = $('#in-town').value.trim() || 'Hometown';
    newGame(band, town);
    this.enter();
  },
  cont() { Music.play(); if (loadGame()) this.enter(); },
  enter() {
    this.hide();
    acc = 0;
    UI.renderLog(); UI.updateSpeed();
    // Restore anything that was waiting on the player when the game was saved.
    if (state.writing && state.writing.weeksLeft <= 0) UI.open(Modals.release);
    if (state.paydayDue) UI.open(Modals.payday);
  },
};

let lastT = performance.now(), acc = 0;
function loop(now) {
  const dt = Math.min(250, now - lastT); lastT = now;
  if (state && !state.gameOver && !UI.current && state.speed > 0) {
    acc += dt * state.speed;
    if (acc >= WEEK_MS) { acc -= WEEK_MS; advanceWeek(); }
  }
  if (state) state.weekProgress = acc / WEEK_MS;
  Render.draw(now);
  UI.updateHud();
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', () => {
  Icons.init();
  document.querySelectorAll('[data-ico]').forEach(el => { el.outerHTML = Icons.img(el.dataset.ico); });
  UI.init();
  Render.init($('#stage'));
  Music.init();
  $('#btn-mute').onclick = () => Music.toggleMute();
  // iOS can suspend audio after calls/notifications; any tap wakes it back up.
  document.addEventListener('pointerdown', () => { if (state && Music.ctx) Music.unlock(); });
  $('#btn-new').onclick = () => Title.start();
  $('#btn-continue').onclick = () => Title.cont();
  Title.show();
  requestAnimationFrame(loop);
});
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// Installable app: register the offline service worker (needs https or localhost).
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
