// ===== Band Simulator: random helpers =====
const RNG = {
  int(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
  float(a, b) { return a + Math.random() * (b - a); },
  chance(p) { return Math.random() < p; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  // Sum of n dice with s sides: a bell curve, centered on n*(s+1)/2.
  dice(n, s) { let t = 0; for (let i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * s); return t; },
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
};
