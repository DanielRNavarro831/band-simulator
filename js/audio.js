// ===== Band Simulator: looping background music =====
// Drop a track at audio/bgm-main.mp3 and it plays. With no file there, the game
// stays silent and the mute button hides itself.
//
// Uses the Web Audio API rather than <audio loop>: MP3 encoders pad the start and
// end with a few ms of silence, which makes <audio> loops hiccup. We decode the
// whole file, find where the real sound starts and ends, and loop just that span.
const MUSIC_TRACKS = { main: 'audio/bgm-main.mp3' };
const MUSIC_VOLUME = 0.5;
const MUTE_KEY = 'bandsim_muted';

const Music = {
  ctx: null, gain: null, source: null, buffers: {}, current: null, wanted: null,
  muted: false, available: false,

  init() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }
    this.updateButton();
    // Check whether the track exists without downloading it yet.
    fetch(MUSIC_TRACKS.main, { method: 'HEAD' })
      .then(r => { this.available = r.ok; this.updateButton(); })
      .catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (!this.muted) this.ctx.resume();
    });
  },

  // Must be called from a tap/click: phones only allow audio to start from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : MUSIC_VOLUME;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  },

  async play(name = 'main') {
    this.unlock();
    if (!this.ctx) return;
    this.wanted = name;
    if (this.current === name) return;
    const buf = await this.load(name);
    if (!buf || this.wanted !== name) return;
    this.stopSource();
    const src = this.ctx.createBufferSource();
    src.buffer = buf.buffer;
    src.loop = true;
    src.loopStart = buf.start;
    src.loopEnd = buf.end;
    src.connect(this.gain);
    src.start(0, buf.start);
    this.source = src; this.current = name;
  },

  async load(name) {
    if (this.buffers[name]) return this.buffers[name];
    try {
      const res = await fetch(MUSIC_TRACKS[name]);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      const buffer = await new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
      const { start, end } = trimSilence(buffer);
      this.available = true; this.updateButton();
      return (this.buffers[name] = { buffer, start, end });
    } catch (e) { return null; }
  },

  stopSource() {
    if (this.source) { try { this.source.stop(); } catch (e) { /* already stopped */ } this.source.disconnect(); }
    this.source = null; this.current = null;
  },
  stop() { this.wanted = null; this.stopSource(); },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    this.unlock();
    if (this.gain) {
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(this.muted ? 0 : MUSIC_VOLUME, t + 0.25);
    }
    if (!this.muted && state && !this.current) this.play();
    this.updateButton();
  },

  updateButton() {
    const b = document.getElementById('btn-mute');
    if (!b) return;
    b.hidden = !this.available;
    b.textContent = this.muted ? '♪✕' : '♪';
    b.setAttribute('aria-label', this.muted ? 'Unmute music' : 'Mute music');
    b.classList.toggle('on', !this.muted);
  },
};

// Find where audible sound begins and ends (skipping encoder padding), capped so
// intentionally quiet intros/outros aren't eaten.
function trimSilence(buffer, threshold = 0.002, maxTrim = 0.25) {
  const n = buffer.length, rate = buffer.sampleRate, cap = Math.floor(maxTrim * rate);
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const loud = i => chans.some(c => Math.abs(c[i]) > threshold);
  let s = 0; while (s < cap && s < n && !loud(s)) s++;
  let e = n - 1; while (n - 1 - e < cap && e > s && !loud(e)) e--;
  return { start: s / rate, end: (e + 1) / rate };
}
