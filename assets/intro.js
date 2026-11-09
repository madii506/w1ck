// w1ck intro: under 5 seconds. Candles climb, one wicks hard, the reserve catches the wick, it snaps back and burns, and the dot becomes the 1 in w1ck.
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
  // the name: w1ck in the site's display face, the 1 in lime
  try { document.fonts && document.fonts.load('700 120px ID'); } catch (e) { }
  function wordLayout() { const F = Math.min(W * .19, H * .3, 210); g.font = `700 ${F}px ID, Inter, system-ui, sans-serif`; const ch = ['w', '1', 'c', 'k'], tr = -.055 * F, ws = ch.map(x => g.measureText(x).width), tot = ws.reduce((a, b) => a + b, 0) + tr * 3;
    const m = g.measureText('w1ck'), asc = m.actualBoundingBoxAscent || F * .7, des = m.actualBoundingBoxDescent || 0, base = H / 2 + (asc - des) / 2; let x = W / 2 - tot / 2; const pos = ch.map((c, i) => { const o = { c, x, w: ws[i] }; x += ws[i] + tr; return o; }); return { F, pos, base, asc }; }
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
    const L = wordLayout(), one = L.pos[1], markDot = { x: one.x + one.w / 2, y: L.base - L.asc / 2 }, mv = ease(ph(t, ...T.move)), S = L.F * 1.2;
    const dr = ease(ph(t, ...T.draw));
    if (caught && dr < 1) { g.globalAlpha = 1 - dr; const pop = ease(ph(t, T.catch[0], T.catch[0] + .18)), dx = xw + (markDot.x - xw) * mv, dy = Y(low) + (markDot.y - Y(low)) * mv, r = (4 + 3 * pop) + (S * .05 - 7) * mv;
      if (t < T.catch[0] + .05 && !shake) shake = 9;
      const rp = ph(t, T.catch[0], T.catch[0] + .7); if (rp < 1) { g.strokeStyle = `rgba(198,255,60,${(1 - rp) * .7})`; g.lineWidth = 2; g.beginPath(); g.arc(dx, dy, r + rp * 60, 0, 6.283); g.stroke(); }
      // the burn: sparks off the catch
      const bp = ph(t, T.catch[0], T.catch[0] + .9); if (bp < 1) parts.forEach(q => { const dd = ease(bp) * 90 * q.v; g.fillStyle = `rgba(228,255,138,${(1 - bp) * .9})`; g.beginPath(); g.arc(xw + Math.cos(q.a) * dd, Y(low) + Math.sin(q.a) * dd - bp * 26, q.r * (1 - bp * .6), 0, 6.283); g.fill(); });
      g.fillStyle = '#f2ffcc'; g.beginPath(); g.arc(dx, dy, r, 0, 6.283); g.fill(); g.globalAlpha = 1; }
    // the name: the dot opens into the lime 1, then w, c and k rise in around it
    if (dr > 0) { const grow = 1 + ease(ph(t, T.draw[1], T.out)) * .05; g.save(); g.translate(W / 2, H / 2); g.scale(grow, grow); g.translate(-W / 2, -H / 2); g.font = `700 ${L.F}px ID, Inter, system-ui, sans-serif`; g.textBaseline = 'alphabetic';
      const order = [1, 0, 2, 3]; order.forEach((idx, n) => { const q = L.pos[idx], k = ease(ph(t, T.draw[0] + n * .1, T.draw[0] + n * .1 + .45)); if (k <= 0) return;
        g.save(); g.globalAlpha = k; if (idx === 1) { const sc = .4 + .6 * k, cx = q.x + q.w / 2, cy = L.base - L.asc / 2; g.translate(cx, cy); g.scale(sc, sc); g.translate(-cx, -cy); g.fillStyle = '#c6ff3c'; }
        else { g.translate(0, (1 - k) * L.F * .18); g.fillStyle = '#f3f8ea'; } g.fillText(q.c, q.x, L.base); g.restore(); }); g.restore(); }
    g.restore(); }
  requestAnimationFrame(frame);
})();
