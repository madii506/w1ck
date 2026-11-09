// w1ck intro: no words, under 5 seconds. Candles climb, one wicks hard, the reserve catches the wick, it snaps back and burns, and the trail becomes the w1ck mark.
(() => {
  const el = document.getElementById('intro'); if (!el) return;
  const h = location.hash; let seen = false; try { seen = sessionStorage.getItem('w1ck_intro') === '1'; } catch (e) { }
  if (seen || (h && h !== '#/' && h !== '#') || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.remove(); return; }
  try { sessionStorage.setItem('w1ck_intro', '1'); } catch (e) { }
  document.documentElement.classList.add('intro-on');
  const c = el.querySelector('canvas'), g = c.getContext('2d'), DPR = Math.min(2, devicePixelRatio || 1), LIME = '#c6ff3c', RED = '#ff5f5f';
  let W, H; const size = () => { W = innerWidth; H = innerHeight; c.width = W * DPR; c.height = H * DPR; c.style.width = W + 'px'; c.style.height = H + 'px'; g.setTransform(DPR, 0, 0, DPR, 0, 0); }; size(); addEventListener('resize', size);
  const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3), easeIn = k => Math.pow(Math.min(1, Math.max(0, k)), 2.2), cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ph = (t, a, b) => cl((t - a) / (b - a));
  // the chart: 15 candles climbing, then the 16th falls into a long wick
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = 15, C = []; let p = 0; for (let i = 0; i < N; i++) { const o = p, cv = o + (rnd() - .32) * 0.9; const hi = Math.max(o, cv) + .15 + rnd() * .45, lo = Math.min(o, cv) - .15 - rnd() * .4; C.push({ o, c: cv, h: hi, l: lo }); p = cv; }
  const last = p, lo = Math.min(...C.map(k => k.l)), hi = Math.max(...C.map(k => k.h)), DROP = (hi - lo) * 1.15;
  const parts = Array.from({ length: 34 }, () => ({ a: rnd() * Math.PI * 2, v: .35 + rnd() * .9, r: 1 + rnd() * 2.2 }));
  // the w1ck mark (the same path as the logo), in a 0–100 box; its dot sits at (50, 83.5)
  const MARK = new Path2D('M6 40 C 20 40, 30 42, 38 47 C 44 51, 46 60, 48 80 C 49 84, 51 84, 52 80 C 55 52, 62 34, 94 22');
  const T = { candles: [.25, 1.75], drop: [1.85, 2.35], catch: [2.35, 2.55], snap: [2.55, 2.95], fade: [2.95, 3.35], move: [3.0, 3.45], draw: [3.35, 4.15], out: 4.45 };
  let t0 = null, done = false, shake = 0;
  function finish(fast) { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.remove(); document.documentElement.classList.remove('intro-on'); removeEventListener('resize', size); }, fast ? 320 : 520); }
  el.querySelector('.iskip').addEventListener('click', () => finish(true)); addEventListener('keydown', e => { if (e.key === 'Escape') finish(true); });
  function frame(now) { if (done) return; if (t0 == null) t0 = now; const t = (now - t0) / 1000; if (t > T.out) { finish(); return; } requestAnimationFrame(frame);
    // stage geometry
    const cw = Math.min(W * .78, 920), chh = Math.min(H * .42, 360), x0 = (W - cw) / 2, step = cw / (N + 3), yTop = H * .5 - chh * .55;
    const span = hi - lo + DROP, Y = v => yTop + (hi - v) / span * chh * 1.35;
    const bg = g.createRadialGradient(W / 2, H * .45, 10, W / 2, H * .5, Math.max(W, H) * .75); bg.addColorStop(0, '#141b24'); bg.addColorStop(.6, '#0d1218'); bg.addColorStop(1, '#090c10'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); if (shake > 0) { g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .86; if (shake < .3) shake = 0; }
    // faint grid
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1; for (let x = (W / 2) % 60; x < W; x += 60) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); } for (let y = (H / 2) % 60; y < H; y += 60) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
    const fadeC = 1 - ease(ph(t, ...T.fade));
    // the climbing candles
    C.forEach((k, i) => { const k0 = T.candles[0] + i * (T.candles[1] - T.candles[0]) / N, a = ease(ph(t, k0, k0 + .22)); if (a <= 0) return; const x = x0 + (i + .5) * step, up = k.c >= k.o, col = up ? 'rgba(198,255,60,' : 'rgba(255,95,95,';
      g.globalAlpha = a * fadeC * (.35 + .65 * (i / N)); g.strokeStyle = col + '.9)'; g.lineWidth = 1.6; const mid = (k.o + k.c) / 2;
      g.beginPath(); g.moveTo(x, Y(mid + (k.h - mid) * a)); g.lineTo(x, Y(mid + (k.l - mid) * a)); g.stroke();
      g.fillStyle = col + '.9)'; const yb = Y(Math.max(k.o, k.c)), hb = Math.max(2, Math.abs(Y(k.o) - Y(k.c))); g.fillRect(x - step * .22, yb + hb * (1 - a) / 2, step * .44, hb * a); });
    g.globalAlpha = 1;
    // the wick: falls hard, gets caught, snaps back
    const xw = x0 + (N + .5) * step, d = easeIn(ph(t, ...T.drop)), snap = ease(ph(t, ...T.snap)), low = last - DROP * d, close = snap > 0 ? low + (last + (hi - lo) * .28 - low) * snap : low, caught = t >= T.catch[0];
    if (t >= T.drop[0] && fadeC > 0) { g.globalAlpha = fadeC; const colW = caught ? LIME : RED; g.strokeStyle = colW; g.lineWidth = 2; g.beginPath(); g.moveTo(xw, Y(Math.max(last, close) + .12)); g.lineTo(xw, Y(low)); g.stroke();
      g.fillStyle = colW; const yb = Y(Math.max(last, close)), hb = Math.max(2, Math.abs(Y(last) - Y(close))); g.fillRect(xw - step * .22, yb, step * .44, hb); g.globalAlpha = 1; }
    // the dot: lands on the wick's tip, pulses, then travels to where it sits in the mark
    const S = Math.min(W, H) * .44, mx = W / 2 - S / 2, my = H / 2 - S * .52, markDot = { x: mx + S * .5, y: my + S * .835 }, mv = ease(ph(t, ...T.move));
    if (caught) { const pop = ease(ph(t, T.catch[0], T.catch[0] + .18)), dx = xw + (markDot.x - xw) * mv, dy = Y(low) + (markDot.y - Y(low)) * mv, r = (4 + 3 * pop) + ((5.4 * S / 100) - 7) * mv;
      if (t < T.catch[0] + .05 && !shake) shake = 9;
      const rp = ph(t, T.catch[0], T.catch[0] + .7); if (rp < 1) { g.strokeStyle = `rgba(198,255,60,${(1 - rp) * .7})`; g.lineWidth = 2; g.beginPath(); g.arc(dx, dy, r + rp * 60, 0, 6.283); g.stroke(); }
      // the burn: sparks off the catch
      const bp = ph(t, T.catch[0], T.catch[0] + .9); if (bp < 1) parts.forEach(q => { const dd = ease(bp) * 90 * q.v; g.fillStyle = `rgba(228,255,138,${(1 - bp) * .9})`; g.beginPath(); g.arc(xw + Math.cos(q.a) * dd, Y(low) + Math.sin(q.a) * dd - bp * 26, q.r * (1 - bp * .6), 0, 6.283); g.fill(); });
      g.fillStyle = '#f2ffcc'; g.beginPath(); g.arc(dx, dy, r, 0, 6.283); g.fill(); }
    // the mark draws itself through the dot
    const dr = ease(ph(t, ...T.draw)); if (dr > 0) { const grow = 1 + ease(ph(t, T.draw[1], T.out)) * .06; g.save(); g.translate(W / 2, H / 2); g.scale(grow, grow); g.translate(-W / 2, -H / 2); g.translate(mx, my); g.scale(S / 100, S / 100);
      const gr = g.createLinearGradient(6, 0, 94, 0); gr.addColorStop(0, 'rgba(184,242,44,0)'); gr.addColorStop(.3, '#b8f22c'); gr.addColorStop(.6, '#d9ff6e'); gr.addColorStop(1, '#f4ffd6');
      g.strokeStyle = gr; g.lineWidth = 7; g.lineCap = 'round'; g.setLineDash([260, 260]); g.lineDashOffset = 260 * (1 - dr); g.stroke(MARK); g.setLineDash([]);
      g.fillStyle = '#f2ffcc'; g.beginPath(); g.arc(50, 83.5, 5.4, 0, 6.283); g.fill(); g.restore(); }
    g.restore(); }
  requestAnimationFrame(frame);
})();
