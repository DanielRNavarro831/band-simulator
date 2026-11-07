// ===== Band Simulator: 8x8 pixel icons for the album stat pools =====
// T = Theory (beamed notes), C = Creativity (light bulb), M = Playing (guitar pick)
const ICON_ART = {
  T: { pal: { X: '#74c0fc', D: '#1c3d6e' }, rows: [
    '..XXXXXX',
    '..XXXXXX',
    '..X....X',
    '..X....X',
    '..X....X',
    'XXX..XXX',
    'XXX..XXX',
    '........'] },
  C: { pal: { X: '#f783ac', O: '#fff0f6', B: '#adb5bd' }, rows: [
    '..XXXX..',
    '.XXXXXX.',
    '.XOXXXX.',
    '.XXXXXX.',
    '..XXXX..',
    '..BBBB..',
    '..BBBB..',
    '...BB...'] },
  M: { pal: { X: '#ffd43b', O: '#fff3bf', D: '#c88a00' }, rows: [
    '.XXXXXX.',
    'XXOXXXXD',
    'XOXXXXXD',
    'XXXXXXXD',
    '.XXXXXD.',
    '..XXXD..',
    '...XD...',
    '........'] },
};
const ICON_LABEL = { T: 'Theory', C: 'Creativity', M: 'Playing' };

const Icons = {
  urls: {},
  init() {
    for (const [k, art] of Object.entries(ICON_ART)) {
      const c = document.createElement('canvas'); c.width = 8; c.height = 8;
      const ctx = c.getContext('2d');
      art.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (art.pal[ch]) { ctx.fillStyle = art.pal[ch]; ctx.fillRect(x, y, 1, 1); }
      }));
      this.urls[k] = c.toDataURL();
    }
  },
  img(k) { return `<img class="ico" src="${this.urls[k]}" alt="${ICON_LABEL[k]}">`; },
  label(k) { return `${this.img(k)}${ICON_LABEL[k]}`; },
};
