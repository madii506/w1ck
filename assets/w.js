// w1ck: every wick gets bought. Everything here is read live: Raydium LaunchLab (coins, curves, candles, trades), Jupiter (prices, swaps), Solana (wallets, profiles, the wick log).
(() => {
  const $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, DPR = Math.min(2, devicePixelRatio || 1), JUP = 'https://lite-api.jup.ag', SOL = 'So11111111111111111111111111111111111111112', HIST = 'https://launch-history-v1.raydium.io';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const usd = (x, d) => x == null || !isFinite(x) ? '—' : '$' + (+x).toLocaleString('en-US', { minimumFractionDigits: d ?? (Math.abs(x) >= 1 ? 2 : 4), maximumFractionDigits: d ?? (Math.abs(x) >= 1 ? 2 : 6) });
  const big = x => x == null || !isFinite(x) ? '—' : x >= 1e9 ? '$' + (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? '$' + (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? '$' + (x / 1e3).toFixed(1) + 'K' : usd(x, x < 10 ? 2 : 0);
  const kfmt = x => x == null || !isFinite(x) ? '' : x >= 1e6 ? (x / 1e6).toFixed(x >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M' : x >= 1e3 ? (x / 1e3).toFixed(x >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(x));
  const spct = x => x == null || !isFinite(x) ? '—' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2) + '%', cls = x => x == null ? '' : x < 0 ? 'dn' : 'up';
  const num = (x, d = 4) => x == null || !isFinite(x) ? '—' : (+x).toLocaleString('en-US', { maximumFractionDigits: x >= 1000 ? 2 : d });
  const sol = (x, d = 3) => x == null || !isFinite(x) ? '—' : (+x).toLocaleString('en-US', { maximumFractionDigits: d }) + ' SOL';
  const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '', clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ago = t => { const s = Date.now() / 1000 - t; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };
  const setT = (sel, v, c) => { const el = $(sel); if (!el) return; el.textContent = v; if (c !== undefined) el.className = c; };
  function toast(m) { const t = $('#toast'); t.innerHTML = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4200); }
  async function api(a, q = '') { const r = await fetch('/api/w1ck?a=' + a + q); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
  async function post(a, b) { const r = await fetch('/api/w1ck?a=' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
  const b64 = u => { let s = ''; u.forEach(c => s += String.fromCharCode(c)); return btoa(s); }, unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let w3 = null; const web3 = () => w3 || (w3 = new Promise((ok, no) => { if (window.solanaWeb3) return ok(window.solanaWeb3); const s = document.createElement('script'); s.src = '/assets/web3.min.js'; s.onload = () => ok(window.solanaWeb3); s.onerror = () => no(new Error('could not load the signer')); document.head.append(s); }));
  const S = { m: null, coins: null, ledger: null, res: null, ll: null, profiles: null, me: null };
  const solUsd = () => S.m && S.m.sol && S.m.sol.usd || null;
  const avatarHtml = (p, w) => p && p.avatar ? `<img src="${esc(p.avatar)}" alt="" onerror="this.remove()">` : esc(((p && p.name) || w || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?');
  const tsx = sig => `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${short(sig)} ↗</a>`;
  const swoosh = (w = 7) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="swg" gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="94" y2="0"><stop offset="0" stop-color="#b8f22c" stop-opacity="0"/><stop offset=".3" stop-color="#b8f22c"/><stop offset=".6" stop-color="#d9ff6e"/><stop offset="1" stop-color="#f4ffd6"/></linearGradient></defs><g fill="none" stroke-linecap="round"><path d="M6 40 C 20 40, 30 42, 38 47 C 44 51, 46 60, 48 80 C 49 84, 51 84, 52 80 C 55 52, 62 34, 94 22" stroke="url(#swg)" stroke-width="${w}"/><circle cx="50" cy="83.5" r="5.4" fill="#f2ffcc"/></g></svg>`;

  // ---------------------------------------------------------------- the curve math (the same as the API's): two market caps in, LaunchLab's curve out
  const curveOf = (s0, s1) => { const run = s1 / s0, q = Math.sqrt(run), sold = q / (1 + q); return { run, sold, raise: s1 * (1 - sold), startSol: s0, gradSol: s1 }; };
  const DEF = { sold: .7931, raise: 85 }; DEF.gradSol = DEF.raise / (1 - DEF.sold); DEF.run = Math.pow(DEF.sold / (1 - DEF.sold), 2); DEF.startSol = DEF.gradSol / DEF.run;
  const curvePath = (run, W, H, pad = 6) => { let d = ''; const k = 1 - 1 / Math.sqrt(run); for (let i = 0; i <= 40; i++) { const u = i / 40, p = 1 / Math.pow(1 - u * k, 2), y = H - pad - (p - 1) / (run - 1 || 1) * (H - 2 * pad); d += (i ? 'L' : 'M') + (pad + u * (W - 2 * pad)).toFixed(1) + ' ' + y.toFixed(1); } return d; };

  // ---------------------------------------------------------------- the background: a live-drawn candle chart; every long wick gets bought
  function backdrop() { const c = $('#cv'), g = c.getContext('2d'); let W, H, sy = 0; const LO = innerWidth < 700;
    const size = () => { W = innerWidth; H = innerHeight; c.width = W * DPR; c.height = H * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0); }; size(); addEventListener('resize', size); addEventListener('scroll', () => sy = scrollY, { passive: true });
    const STEP = LO ? 22 : 26, C = []; let p = 0, off = 0, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const mk = () => { const o = p, dip = rnd() < .14; let cl = o + (rnd() - .46) * 18; const hi = Math.max(o, cl) + 2 + rnd() * 8; let lo = Math.min(o, cl) - 2 - rnd() * 7; if (dip) { lo = Math.min(o, cl) - 30 - rnd() * 34; cl = o + 4 + rnd() * 10; } p = cl + (p < -60 ? 6 : p > 60 ? -6 : 0); return { o, cl, hi, lo, dip, born: performance.now() }; };
    for (let i = 0; i < 90; i++) C.push(mk());
    let last = 0; function frame(now) { requestAnimationFrame(frame); if (document.hidden || now - last < 33) return; last = now;
      const bg = g.createRadialGradient(W / 2, H * .35, 10, W / 2, H * .5, Math.max(W, H) * .8); bg.addColorStop(0, '#141b24'); bg.addColorStop(.5, '#0d1218'); bg.addColorStop(1, '#090c10'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.025)'; g.lineWidth = 1; for (let x = 0; x <= W; x += 60) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); } for (let y = 0; y <= H; y += 60) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
      if (!RM) { off += .35; if (off >= STEP) { off -= STEP; C.shift(); C.push(mk()); } }
      const fadeAll = 1 - clamp(sy / (H * 1.2)) * .55, base = H * .72, sc = Math.min(1.6, H / 600), n = Math.ceil(W / STEP) + 2, start = C.length - n;
      for (let i = Math.max(0, start); i < C.length; i++) { const k = C[i], x = (i - start) * STEP - off, cx = x + STEP / 2, up = k.cl >= k.o, yy = v => base - v * sc, edge = clamp(Math.min(cx, W - cx) / (W * .12));
        const mid = Math.abs(cx - W / 2) < W * .32 ? .45 : 1, a = fadeAll * edge * mid; if (a <= 0) continue;
        g.strokeStyle = up ? `rgba(198,255,60,${.42 * a})` : `rgba(255,95,95,${.3 * a})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, yy(k.hi)); g.lineTo(cx, yy(k.lo)); g.stroke();
        g.fillStyle = up ? `rgba(198,255,60,${.42 * a})` : `rgba(255,95,95,${.3 * a})`; const y0 = yy(Math.max(k.o, k.cl)), h = Math.max(2, Math.abs(k.cl - k.o) * sc); g.beginPath(); g.roundRect ? g.roundRect(cx - STEP * .22, y0, STEP * .44, h, 2) : g.rect(cx - STEP * .22, y0, STEP * .44, h); g.fill();
        if (k.dip) { const age = (now - k.born) / 1000, ry = yy(k.lo); g.fillStyle = `rgba(233,255,154,${.95 * a})`; g.beginPath(); g.arc(cx, ry, 3.6, 0, 6.3); g.fill(); const rp = (age % 2.4) / 2.4; g.strokeStyle = `rgba(198,255,60,${(1 - rp) * .55 * a})`; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, ry, 4 + rp * 16, 0, 6.3); g.stroke(); } }
      const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(9,12,16,.5)'); vg.addColorStop(.35, 'rgba(9,12,16,0)'); vg.addColorStop(1, 'rgba(9,12,16,.4)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    requestAnimationFrame(frame); }

  // ---------------------------------------------------------------- wallet: connect, live balance, profile
  const WL = { pk: null, p: null, name: '', view: null };
  const providers = () => [['Phantom', window.phantom && window.phantom.solana], ['Solflare', window.solflare && window.solflare.isSolflare && window.solflare], ['Backpack', window.backpack]].filter(([, p]) => p);
  async function connect() { if (WL.pk) return WL.pk; const ps = providers(); if (!ps.length) { toast('No Solana wallet found. Open this page in Phantom, Solflare or Backpack.'); throw new Error('no wallet'); }
    const [name, p] = ps[0]; const r = await p.connect(); onConnect(((r && r.publicKey) || p.publicKey).toString(), p, name); return WL.pk; }
  function onConnect(pk, p, name) { WL.pk = pk; WL.p = p; WL.name = name; $('#connect').hidden = true; $('#wbtn').hidden = false; $('#dAddr').textContent = short(pk); $('#dProfile').href = '#/u/' + pk;
    if (p.on && !p._w1ck) { p._w1ck = 1; p.on('accountChanged', k => { if (k) { onConnect(k.toString(), p, name); toast('Switched to ' + short(k.toString())); } else disconnect(); }); }
    refreshWallet(); loadMe(); render(); }
  async function disconnect() { try { await WL.p.disconnect(); } catch (e) { } WL.pk = null; WL.view = null; S.me = null; $('#connect').hidden = false; $('#wbtn').hidden = true; $('#drop').classList.remove('on'); render(); }
  function countTo(el, v, fmt) { if (!el || v == null) return; const from = el._v ?? v; el._v = v; if (RM || from === v) { el.textContent = fmt(v); return; } const t0 = performance.now(); cancelAnimationFrame(el._r); const st = n => { const k = clamp((n - t0) / 900); el.textContent = fmt(from + (v - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) el._r = requestAnimationFrame(st); }; el._r = requestAnimationFrame(st); }
  const tokRow = t => `<div class="tok">${t.icon ? `<img src="${esc(t.icon)}" alt="" onerror="this.outerHTML='<span class=ph></span>'">` : '<span class="ph"></span>'}<span><b>${esc(t.symbol)}</b><small>${esc(t.name)}</small></span><span class="v">${num(t.amount)}<small>${usd(t.usd, 2)}</small></span></div>`;
  async function refreshWallet() { if (!WL.pk) return; try { const v = await api('wallet', '&addr=' + WL.pk); if (v.wallet !== WL.pk) return; const prev = WL.view; WL.view = v;
      countTo($('#wSol'), v.sol, x => x.toFixed(3) + ' SOL'); countTo($('#dTot'), v.totalUsd, x => usd(x, 2));
      $('#dToks').innerHTML = `<div class="tok"><span class="ph"></span><span><b>SOL</b><small>Solana</small></span><span class="v">${num(v.sol)}<small>${usd(v.solValue, 2)}</small></span></div>` + v.tokens.slice(0, 30).map(tokRow).join('');
      if (prev && Math.abs(prev.sol - v.sol) > 1e-9) toast(`Balance updated: ${v.sol >= prev.sol ? '+' : '−'}${Math.abs(v.sol - prev.sol).toFixed(4)} SOL`);
      $$('[data-live="bal"]').forEach(el => el.dispatchEvent(new Event('bal'))); } catch (e) { } }
  async function loadMe() { if (!WL.pk) return; try { const r = await api('profile', '&wallet=' + WL.pk); S.me = r.profile; } catch (e) { S.me = null; } $('#wAv').innerHTML = avatarHtml(S.me, WL.pk); }
  function walletInit() { $('#connect').onclick = () => connect().catch(() => { }); $('#wbtn').onclick = e => { e.stopPropagation(); $('#drop').classList.toggle('on'); }; $('#dOut').onclick = disconnect;
    document.addEventListener('click', e => { if (!e.target.closest('#acct')) $('#drop').classList.remove('on'); }); $$('#drop a').forEach(a => a.addEventListener('click', () => $('#drop').classList.remove('on')));
    const ps = providers(); if (ps.length && ps[0][1].connect) ps[0][1].connect({ onlyIfTrusted: true }).then(r => { if (r && r.publicKey) onConnect(r.publicKey.toString(), ps[0][1], ps[0][0]); }).catch(() => { });
    setInterval(refreshWallet, 10000); }
  async function signSend(list, st, versioned) { const W = await web3(); const txs = list.map(t => versioned ? W.VersionedTransaction.deserialize(unb64(t)) : W.Transaction.from(unb64(t)));
    st('check your wallet…'); const signed = WL.p.signAllTransactions && txs.length > 1 ? await WL.p.signAllTransactions(txs) : [await WL.p.signTransaction(txs[0])];
    st('sending…'); const r = await post('send', { txs: signed.map(t => b64(t.serialize())) }); setTimeout(refreshWallet, 1500); setTimeout(refreshWallet, 6000); return r; }
  const stat = sel => (m, c = '') => { const el = typeof sel === 'string' ? $(sel) : sel; if (!el) return; el.className = 'stat2 ' + c; el.innerHTML = m; };

  // ---------------------------------------------------------------- data
  async function loadMarket() { try { S.m = await api('market'); } catch (e) { } }
  async function loadCoins() { try { S.coins = await api('coins'); } catch (e) { S.coins = S.coins || { open: false, coins: [], error: true }; } }
  async function loadLedger() { try { S.ledger = await api('ledger'); } catch (e) { S.ledger = S.ledger || { entries: [] }; } try { S.res = await api('reserves'); } catch (e) { } }
  async function loadLL() { try { S.ll = await api('launchlab'); } catch (e) { S.ll = S.ll || { error: true }; } }
  async function loadSocial() { try { S.profiles = (await api('profiles')).profiles; } catch (e) { S.profiles = S.profiles || []; } }
  const coinBy = m => ((S.coins && S.coins.coins) || []).find(c => c.mint === m) || null;

  // ---------------------------------------------------------------- the picker: the curve (two market caps) and the wick (two percentages), shared by the hero and the launcher
  const START = 10000, LN = { run: 6, s0: null, s1: null, wick: 25, buy: 25, preset: 'mid', img: '1', imgUrl: null, busy: false };
  const setStart = () => { const u = solUsd(); if (u) { LN.s0 = START / u; LN.s1 = LN.s0 * LN.run; } };
  const parseMoney = v => { const s = String(v).trim().toLowerCase().replace(/[$,\s]/g, ''); const m = s.match(/^([\d.]+)([km]?)$/); if (!m) return NaN; return +m[1] * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1); };
  function preset(id) { const P = ((S.m && S.m.presets) || []).find(p => p.id === id); if (!P) return; LN.preset = id; LN.run = P.run; setStart(); syncPickers(true); }
  function pickerHtml(id) { return `<div class="pkw" data-pk="${id}">
      <div class="pk-row"><div class="cap fixed"><small>Every coin starts at</small><div class="in2"><span>$</span><b class="s0v">10K</b></div><em class="s0s">— SOL</em></div>
        <svg class="spark" viewBox="0 0 150 64"><path class="spk"/></svg>
        <div class="cap r"><small>Graduates at</small><div class="in2"><span>$</span><input class="s1" inputmode="decimal" aria-label="graduation market cap"></div><em class="s1s">— SOL</em></div></div>
      <div class="pk-info"></div>
      <div class="pk-wick"><div class="sl"><small><span>the wick</span><b class="wv">25%</b></small><input class="rng wk" type="range" min="10" max="60" step="1" value="25" aria-label="wick"><p class="wp"></p></div>
        <div class="sl"><small><span>the buy</span><b class="bv">25%</b></small><input class="rng by" type="range" min="10" max="100" step="5" value="25" aria-label="buy"><p class="bp"></p></div></div>
      <div class="chips">${((S.m && S.m.presets) || []).map(p => `<button class="chip" data-pre="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>`; }
  function curveNow() { if (!(LN.s0 > 0 && LN.s1 > 0)) return null; const c = curveOf(LN.s0, LN.s1), M = S.m || {}, err = c.run < 1.5 - 1e-9 ? 'graduate at $15K or higher' : c.run > 32 + 1e-9 ? 'the highest graduation LaunchLab allows from $10K is $320K' : c.raise < (M.minRaiseSol || 24) - 1e-9 ? `LaunchLab's minimum raise is ${M.minRaiseSol || 24} SOL: pick a higher graduation` : c.sold > (M.maxSold || .85) + 1e-9 ? 'that curve sells more than 85% of the supply' : null; return { ...c, err }; }
  function pickerInit(el) { if (!el || el._on) return; el._on = 1;
    const s1 = $('.s1', el), wk = $('.wk', el), by = $('.by', el);
    const onCap = () => { const b = parseMoney(s1.value); if (b > 0) { LN.run = b / START; setStart(); } LN.preset = null; syncPickers(false, el); };
    s1.addEventListener('input', onCap); s1.addEventListener('blur', () => syncPickers(true));
    wk.addEventListener('input', () => { LN.wick = +wk.value; syncPickers(false); }); by.addEventListener('input', () => { LN.buy = +by.value; syncPickers(false); });
    $('.chips', el).onclick = e => { const b = e.target.closest('.chip'); if (b) preset(b.dataset.pre); };
    syncPickers(true); }
  function syncPickers(writeInputs, except) { const u = solUsd(), c = curveNow();
    $$('.pkw').forEach(el => { if (!el._on) return;
      if (u && LN.s0 && (writeInputs || el !== except)) { const b = $('.s1', el); if (document.activeElement !== b) b.value = kfmt(START * LN.run); }
      $('.s0s', el).textContent = LN.s0 ? num(LN.s0, 1) + ' SOL' : '— SOL'; $('.s1s', el).textContent = LN.s1 ? num(LN.s1, 1) + ' SOL' : '— SOL';
      if (c) $('.spk', el).setAttribute('d', curvePath(Math.max(1.01, c.run), 150, 64));
      const inf = $('.pk-info', el); inf.className = 'pk-info' + (c && c.err ? ' err' : ''); inf.innerHTML = !u ? 'reading the SOL price…' : !c ? '' : c.err ? esc(c.err) : `<b>${c.run.toFixed(1)}×</b> on the curve · raises <b>${num(c.raise, 1)} SOL</b> (${big(c.raise * u)}) · <b>${(c.sold * 100).toFixed(1)}%</b> sold on the curve`;
      const wk = $('.wk', el), by = $('.by', el); wk.value = LN.wick; by.value = LN.buy; wk.style.setProperty('--p', (LN.wick - 10) / 50 * 100 + '%'); by.style.setProperty('--p', (LN.buy - 10) / 90 * 100 + '%');
      $('.wv', el).textContent = LN.wick + '%'; $('.bv', el).textContent = LN.buy + '%'; $('.wp', el).textContent = `buys when it falls ${LN.wick}% below its 24h high`; $('.bp', el).textContent = `spends ${LN.buy}% of its reserve on each wick`;
      $$('.chip', el).forEach(b => b.classList.toggle('on', b.dataset.pre === LN.preset)); });
    renderLaunch(); }

  // ---------------------------------------------------------------- the home page
  const app = () => $('#app');
  const wickIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v4M9 7h6v7H9zM12 14v5"/><circle cx="12" cy="20.5" r="1.6" fill="currentColor"/></svg>';
  const head = (k, a, b) => `<div class="head rv"><span class="kick">${k}</span><h2>${a}${b ? `<br><span>${b}</span>` : ''}</h2></div>`;
  const PAGES = {
    start: () => `<section class="hero start"><div class="wrap" style="display:flex;flex-direction:column;align-items:center">
      <h1 class="word">w<span class="one">1</span>ck</h1>
      <p class="tagl">Every coin starts at $10K <span>/</span> every wick gets bought</p>
      <div class="picker">${pickerHtml('hero')}</div>
      <div class="hcta"><a class="btn go" href="#/launch">Launch →</a><a class="btn" href="#/board">Board</a><a class="btn" href="#/how">How it works</a></div>
</div></section>`,
    how: () => `<div class="page"><div class="wrap">${head('how it works', 'Every wick', 'gets bought.')}
      <div class="story"><div class="steps">
        <div class="stp" data-i="0"><span class="n">01</span><h3>Starts at $10K</h3><p>Every coin. You pick where it graduates.</p></div>
        <div class="stp" data-i="1"><span class="n">02</span><h3>Trades fill the reserve</h3><p>1% of every trade goes to the coin's own reserve.</p></div>
        <div class="stp" data-i="2"><span class="n">03</span><h3>Pick the wick</h3><p>How far below its 24h high before the reserve steps in.</p></div>
        <div class="stp" data-i="3"><span class="n">04</span><h3>The wick gets bought</h3><p>The reserve buys the wick and burns it. One transaction.</p></div>
        <div class="stp" data-i="4"><span class="n">05</span><h3>It graduates</h3><p>Into a Raydium pool at your number.</p></div>
      </div><div class="stage"><canvas id="stCv"></canvas><span class="lbl" id="stL">the curve</span><span class="lbr" id="stR"></span></div></div>
      <div style="height:90px"></div>${head('try it', 'Drag it down.')}
      <div class="sim"><div class="card simc rv"><canvas id="simCv"></canvas></div>
        <div class="card simp rv d1"><span class="note">simulator</span><div class="big" id="sDd">0.0%</div><span class="st" id="sSt">watching</span>
          <div class="kvs"><div>trigger<b id="sTr">—</b></div><div>reserve<b id="sRes">—</b></div><div>each wick spends<b id="sBuy">—</b></div><div>wicks bought<b id="sN">0</b></div><div>burned<b id="sBurn">0</b></div></div><button class="btn sm" id="sReset">Reset</button></div></div>
      <div class="hcta" style="margin-top:40px"><a class="btn go" href="#/launch">Launch a coin →</a></div></div></div>`,
    board: () => `<div class="page"><div class="wrap">${head('board', 'Every coin', 'picked its own wick.')}
      <div class="btool rv"><button class="chip on" data-s="new">newest</button><button class="chip" data-s="mcap">market cap</button><button class="chip" data-s="res">reserve</button><button class="chip" data-s="fill">closest to graduating</button><span class="sp"></span><span class="mono dim" id="bCount"></span></div>
      <div class="card board rv" id="bList"><div class="empty">reading the launchpad…</div></div>
      <div class="else"><div class="card bigst rv"><span class="kick">elsewhere on LaunchLab</span><b id="llPct">—</b><p id="llTxt">took the default curve.</p></div><div class="card rv d1" id="llList"><div class="empty">reading LaunchLab…</div></div></div></div></div>`,
    launch: () => `<div class="page"><div class="wrap">${head('launch', 'Starts at $10K.', 'Your wick.')}
      <div class="launch">
        <div class="card lform rv"><div class="blk"><h3>01 · graduation and wick</h3>${pickerHtml('launch')}</div>
          <div class="blk"><h3>02 · the coin</h3><div class="frow"><label class="fld"><span>Name</span><input id="cName" maxlength="32" placeholder="Wick Dog"></label><label class="fld"><span>Ticker</span><input id="cSym" maxlength="10" placeholder="WDOG"></label></div>
            <span class="fld"><span>Image</span></span><div class="imgs" id="imgs"></div><div class="upl"><label class="btn sm" for="cFile">Upload your image</label><input id="cFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><span class="mono dim" id="cFileSt"></span></div><label class="fld"><input id="cImg" placeholder="or paste an https image link"></label>
            <label class="fld"><span>Dev buy (SOL, optional)</span><input id="cBuy" type="number" min="0" step="0.1" placeholder="0"></label></div></div>
        <div class="card prevw rv d1"><div class="pcard" id="prev"></div><div class="padst" id="padSt"><i></i>reading the launchpad…</div><button class="btn go wide" id="launchBtn">Connect wallet</button><div class="stat2" id="lStat"></div>
          <div class="cost">1B supply · no mint or freeze authority · ~0.03 SOL to launch</div></div>
      </div></div></div>`,
    log: () => `<div class="page"><div class="wrap">${head('wick log', 'Every wick.', 'Every burn.')}
      <div class="lgrid"><div class="card entries rv" id="eList"><div class="empty">reading the wick log…</div></div>
        <div class="card por rv d1"><h3>Proof of reserves</h3><p>Reserves owed vs SOL held.</p><div id="porRows"><div class="empty">reading…</div></div></div></div></div></div>`,
    trade: () => `<div class="page"><div class="wrap">${head('trade', 'Buy the dip', 'yourself.')}${tradeHtml('home', '')}</div></div>`,
    people: () => `<div class="page"><div class="wrap">${head('people', 'Profiles,', 'on Solana.')}
      <div class="pbar rv"><span class="mono dim" id="pCount"></span><button class="btn sm go" id="mkProfile">Make my profile</button></div><div class="people" id="peopleList"><div class="card empty">reading…</div></div></div></div>`,
    faq: () => `<div class="page"><div class="wrap">${head('fees and faq', 'Every cut,', 'in the open.')}
      <div class="fees"><div class="card rv"><b class="lm">1%</b><p>to the coin's reserve</p></div><div class="card rv d1"><b>0.25%</b><p>to Raydium LaunchLab</p></div><div class="card rv d2"><b>0%</b><p>to the creator</p></div><div class="card rv d3"><b>0%</b><p>to w1ck</p></div></div>
      <div class="card limits rv"><div>Start<b>$10K for every coin</b></div><div>Graduation<b>$15K to $320K</b></div><div>Raise<b>24 SOL minimum</b></div><div>Sold on the curve<b>up to 85%</b></div><div>The wick<b>10% to 60% below the 24h high</b></div><div>The buy<b>10% to 100% of the reserve</b></div><div>Dev buy<b>at most half the raise, 20 SOL</b></div><div>At graduation<b>Raydium pool · 50% LP burned</b></div></div>
      <div class="faq rv" style="margin-top:50px">
        <details><summary>What's a wick?</summary><p>The line under a candle: the price fell that far, then came back. w1ck buys those moments.</p></details>
        <details><summary>Where does the reserve come from?</summary><p>1% of every curve trade, counted per coin, minus every wick it has already bought.</p></details>
        <details><summary>How is the wick measured?</summary><p>From Raydium's own LaunchLab candles: the latest price against the 24h high.</p></details>
        <details><summary>Who sends the buys?</summary><p>The reserve wallet, from the console, only when a coin is past its trigger. Every buy is on the wick log.</p></details>
        <details><summary>What happens to what it buys?</summary><p>It's burned in the same transaction.</p></details>
        <details><summary>What does launching cost?</summary><p>About 0.03 SOL in network fees, plus your dev buy. No launch fee.</p></details>
      </div></div></div>`,
  };
  function pageInit(view) {
    if (view === 'start') { $$('.pkw').forEach(pickerInit); renderStats(); }
    if (view === 'how') { storyInit(); simInit(); }
    if (view === 'board') { $$('.btool .chip').forEach(b => b.onclick = () => { SORT = b.dataset.s; $$('.btool .chip').forEach(x => x.classList.toggle('on', x === b)); renderBoard(); }); renderBoard(); renderLL(); }
    if (view === 'launch') { $$('.pkw').forEach(pickerInit); launchInit(); renderLaunch(); }
    if (view === 'log') renderLog();
    if (view === 'trade') { const t = $('[data-trade="home"]'); tradeInit(t); if (t && t._picks) t._picks(); }
    if (view === 'people') { $('#mkProfile').onclick = async () => { try { await connect(); editProfile(S.me); } catch (e) { } }; renderPeople(); }
  }

  // ---------------------------------------------------------------- the story stage
  function storyInit() { const c = $('#stCv'); if (!c) return; const g = c.getContext('2d'); let step = 0, t0 = performance.now(), vis = false;
    new IntersectionObserver(e => vis = e[0].isIntersecting).observe(c);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { step = +e.target.dataset.i; t0 = performance.now(); $$('.stp').forEach(s => s.classList.toggle('on', +s.dataset.i === step)); setT('#stL', ['the curve', 'the reserve', 'the trigger', 'the buy', 'graduation'][step]); } }), { rootMargin: '-45% 0px -45% 0px' });
    $$('.stp').forEach(s => io.observe(s)); $$('.stp')[0].classList.add('on');
    const N = 34; let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const P = []; let p = 50; for (let i = 0; i < N; i++) { const o = p; let cl = o + (rnd() - .35) * 7; const hi = Math.max(o, cl) + rnd() * 3, lo = Math.min(o, cl) - rnd() * 3; P.push({ o, cl, hi, lo }); p = cl; }
    const fr = now => { requestAnimationFrame(fr); if (!vis || document.hidden) return; const w = c.clientWidth, h = c.clientHeight; if (c.width !== w * DPR) { c.width = w * DPR; c.height = h * DPR; } g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, w, h);
      const t = RM ? 99 : (now - t0) / 1000, L = 40, R = w - 30, T = 60, B = h - 50, cv = curveNow() || curveOf(DEF.startSol, DEF.gradSol), u = solUsd();
      g.strokeStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 6; i++) { const y = T + i * (B - T) / 5; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); }
      g.font = '500 12px GM, monospace'; g.textAlign = 'left';
      if (step === 0 || step === 4) { const run = Math.max(1.01, cv.run), k = 1 - 1 / Math.sqrt(run), prog = step === 4 ? 1 : clamp(t / 1.6); g.beginPath(); for (let i = 0; i <= 80 * prog; i++) { const s = i / 80, pr = 1 / Math.pow(1 - s * k, 2), x = L + s * (R - L - 120), y = B - (pr - 1) / (run - 1) * (B - T - 30); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = '#c6ff3c'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#9aa5b1'; g.fillText('start ' + (u ? big(cv.startSol * u) : num(cv.startSol, 1) + ' SOL'), L, B + 26); g.textAlign = 'right'; g.fillText('graduates ' + (u ? big(cv.gradSol * u) : num(cv.gradSol, 1) + ' SOL'), R - 120, T + 18); g.textAlign = 'left';
        setT('#stR', cv.run.toFixed(1) + '× · ' + (cv.sold * 100).toFixed(1) + '% sold');
        if (step === 4) { const bx = R - 104, by = T + 6, k2 = clamp((t - .2) / 1); g.strokeStyle = `rgba(198,255,60,${k2})`; g.lineWidth = 1.5; g.beginPath(); g.roundRect ? g.roundRect(bx, by, 100, 60, 10) : g.rect(bx, by, 100, 60); g.stroke(); g.fillStyle = `rgba(243,248,234,${k2})`; g.fillText('Raydium pool', bx + 10, by + 26); g.fillStyle = `rgba(154,165,177,${k2})`; g.fillText('50% LP burned', bx + 10, by + 46); } return; }
      // candles for steps 1-3
      const n = step === 1 ? Math.min(N, Math.floor(t * 9) + 6) : N, sw = (R - L - 90) / N, vmin = 20, vmax = 80, Y = v => B - (v - vmin) / (vmax - vmin) * (B - T);
      const C = P.slice(0, n).map(x => ({ ...x })); if (step >= 2) { const last = C[N - 1], hi = Math.max(...C.map(x => x.hi)), drop = step === 2 ? clamp(t / 1.2) : 1; const lo = hi * (1 - LN.wick / 100 * 1.08); last.lo = last.o - (last.o - lo) * drop; last.cl = step === 3 ? last.o - (last.o - lo) * .35 * clamp(t / 1.5) : last.lo + 1; last.hi = last.o + 1; }
      C.forEach((k, i) => { const x = L + i * sw + sw / 2, up = k.cl >= k.o; g.strokeStyle = up ? 'rgba(198,255,60,.8)' : 'rgba(255,95,95,.7)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, Y(k.hi)); g.lineTo(x, Y(k.lo)); g.stroke(); g.fillStyle = g.strokeStyle; const y0 = Y(Math.max(k.o, k.cl)), hh = Math.max(2, Math.abs(Y(k.o) - Y(k.cl))); g.fillRect(x - sw * .28, y0, sw * .56, hh);
        if (step === 1 && i < n) { const fall = ((t * 1.2 + i * .37) % 1.6) / 1.6; if (fall < 1) { const tx = R - 50, ty = B - 10; g.fillStyle = `rgba(198,255,60,${.9 - fall * .6})`; g.beginPath(); g.arc(x + (tx - x) * fall, Y(k.cl) + (ty - Y(k.cl)) * fall * fall, 2.2, 0, 6.3); g.fill(); } } });
      // the reserve bar
      const rb = step === 1 ? clamp(t / 4) : step === 3 ? 1 - LN.buy / 100 * clamp(t / 1) : 1; g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(R - 64, T, 28, B - T); g.fillStyle = '#c6ff3c'; g.fillRect(R - 64, B - (B - T) * rb, 28, (B - T) * rb); g.fillStyle = '#9aa5b1'; g.textAlign = 'center'; g.fillText('reserve', R - 50, B + 26); g.textAlign = 'left';
      if (step >= 2) { const hi = Math.max(...P.map(x => x.hi)), tr = hi * (1 - LN.wick / 100); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(198,255,60,.6)'; g.beginPath(); g.moveTo(L, Y(tr)); g.lineTo(R - 80, Y(tr)); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(L, Y(hi)); g.lineTo(R - 80, Y(hi)); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#9aa5b1'; g.fillText('24h high', L + 4, Y(hi) - 6); g.fillStyle = '#c6ff3c'; g.fillText('trigger −' + LN.wick + '%', L + 4, Y(tr) - 6); setT('#stR', step === 2 ? 'armed' : 'bought · burned'); }
      else setT('#stR', '1% of every trade');
      if (step === 3) { const k = C[N - 1], x = L + (N - 1) * sw + sw / 2, y = Y(k.lo), rp = (t % 1.4) / 1.4; g.fillStyle = '#f2ffcc'; g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill(); g.strokeStyle = `rgba(198,255,60,${1 - rp})`; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 6 + rp * 26, 0, 6.3); g.stroke();
        for (let i = 0; i < 14; i++) { const a = (t * .8 + i / 14) % 1; g.fillStyle = `rgba(255,107,107,${(1 - a) * .8})`; g.beginPath(); g.arc(x + Math.sin(i * 2.4) * 30 * a, y - 70 * a - 10, 2, 0, 6.3); g.fill(); } } };
    requestAnimationFrame(fr); }

  // ---------------------------------------------------------------- the simulator
  function simInit() { const c = $('#simCv'); if (!c || c._on) return; c._on = 1; const g = c.getContext('2d'); let vis = false; new IntersectionObserver(e => vis = e[0].isIntersecting).observe(c);
    const Z = { pts: [], price: 100, target: 100, high: 100, res: 10, burned: 0, n: 0, armed: false, flash: 0, drag: false, cool: 0 };
    const reset = () => { Z.pts = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 7) * 2); Z.price = Z.target = Z.high = 100; Z.res = 10; Z.burned = 0; Z.n = 0; Z.armed = false; Z.flash = 0; }; reset(); $('#sReset').onclick = reset;
    const yOf = (v, h) => 24 + (130 - v) / 100 * (h - 48), vOf = (y, h) => 130 - (y - 24) / (h - 48) * 100;
    const set = e => { const r = c.getBoundingClientRect(); Z.target = clamp(vOf(e.clientY - r.top, r.height), 34, 128); };
    c.addEventListener('pointerdown', e => { Z.drag = true; c.setPointerCapture(e.pointerId); set(e); }); c.addEventListener('pointermove', e => { if (Z.drag) set(e); }); c.addEventListener('pointerup', () => { Z.drag = false; });
    let last = 0; const fr = now => { requestAnimationFrame(fr); if (!vis || document.hidden || now - last < 33) return; last = now; const w = c.clientWidth, h = c.clientHeight; if (c.width !== w * DPR) { c.width = w * DPR; c.height = h * DPR; } g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, w, h);
      if (!Z.drag) Z.target += (Math.max(Z.target, 96 + Math.sin(now / 900) * 3) - Z.target) * .02; Z.price += (Z.target - Z.price) * .2 + (Math.random() - .5) * .6; Z.pts.push(Z.price); if (Z.pts.length > 120) Z.pts.shift();
      Z.high = Math.max(...Z.pts); const dd = Math.max(0, (1 - Z.price / Z.high) * 100), trig = Z.high * (1 - LN.wick / 100); Z.res += .004;
      if (dd >= LN.wick && now > Z.cool) { const spend = Z.res * LN.buy / 100; Z.res -= spend; Z.burned += spend * 1e6 / Z.price; Z.n++; Z.flash = now; Z.cool = now + 1500; Z.target = Z.price * 1.12; }
      g.strokeStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 6; i++) { const y = 24 + i * (h - 48) / 5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(0, yOf(Z.high, h)); g.lineTo(w, yOf(Z.high, h)); g.stroke(); g.strokeStyle = 'rgba(198,255,60,.7)'; g.beginPath(); g.moveTo(0, yOf(trig, h)); g.lineTo(w, yOf(trig, h)); g.stroke(); g.setLineDash([]);
      g.font = '500 12px GM, monospace'; g.fillStyle = '#9aa5b1'; g.fillText('24h high', 12, yOf(Z.high, h) - 6); g.fillStyle = '#c6ff3c'; g.fillText('trigger −' + LN.wick + '%', 12, yOf(trig, h) - 6);
      g.beginPath(); Z.pts.forEach((v, i) => { const x = i / 119 * (w - 30); i ? g.lineTo(x, yOf(v, h)) : g.moveTo(x, yOf(v, h)); }); g.strokeStyle = dd >= LN.wick * .8 ? '#ff6b6b' : '#c6ff3c'; g.lineWidth = 2.4; g.stroke();
      const px = w - 30, py = yOf(Z.price, h); g.fillStyle = '#f2ffcc'; g.beginPath(); g.arc(px, py, 6, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(198,255,60,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, 12, 0, 6.3); g.stroke();
      if (now - Z.flash < 1200) { const k = (now - Z.flash) / 1200; g.strokeStyle = `rgba(198,255,60,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 10 + k * 50, 0, 6.3); g.stroke(); g.fillStyle = `rgba(198,255,60,${1 - k})`; g.font = '700 16px ID, sans-serif'; g.fillText('wick bought', px - 130, py + 34); }
      if (!Z.drag && now - Z.flash > 1200) { g.fillStyle = 'rgba(154,165,177,.7)'; g.font = '500 12px GM, monospace'; g.textAlign = 'right'; g.fillText('drag the price down ↓', w - 50, h - 14); g.textAlign = 'left'; }
      setT('#sDd', dd.toFixed(1) + '%'); const st = $('#sSt'); st.className = 'st' + (dd >= LN.wick ? ' armed' : ''); st.textContent = dd >= LN.wick ? 'armed · buying' : `watching · triggers at −${LN.wick}%`;
      setT('#sTr', '−' + LN.wick + '%'); setT('#sRes', Z.res.toFixed(2) + ' SOL'); setT('#sBuy', LN.buy + '% of the reserve'); setT('#sN', String(Z.n)); setT('#sBurn', kfmt(Z.burned)); };
    requestAnimationFrame(fr); }

  // ---------------------------------------------------------------- the trade widget (Jupiter)
  function tradeHtml(id, mint) { return `<div class="card trade rv" data-trade="${id}" data-mint="${esc(mint || '')}" data-live="bal">
    <div class="tr-l"><div class="picker2"><input class="tq" placeholder="paste a token address, or pick one" autocomplete="off" value="${esc(mint || '')}"></div><div class="picks"></div><div class="tinfo"></div><div class="tstat"></div></div>
    <div class="tr-r"><div class="side"><button class="buy on" data-side="buy">Buy</button><button class="sell" data-side="sell">Sell</button></div>
      <div class="box"><small><span>You pay</span><a class="max">balance —</a></small><div class="r"><input class="amt" inputmode="decimal" placeholder="0.0"><span class="tsel tin">SOL</span></div><div class="pct"><button data-p=".25">25%</button><button data-p=".5">50%</button><button data-p="1">MAX</button></div></div>
      <div class="box"><small><span>You get</span><span class="outusd"></span></small><div class="r"><input class="out" readonly placeholder="0.0"><span class="tsel tout">—</span></div></div>
      <div class="qinfo"><div>price impact<b class="qi">—</b></div><div>route<b class="qr">—</b></div><div>slippage<b>1%</b></div></div>
      <button class="btn go wide tgo">Connect wallet</button><div class="stat2 tst"></div></div></div>`; }
  const TI = {}; async function tokInfo(m) { if (TI[m]) return TI[m]; if (m === SOL) return TI[m] = { id: SOL, symbol: 'SOL', name: 'Solana', decimals: 9, icon: '' };
    const j = await fetch(`${JUP}/tokens/v2/search?query=${m}`).then(r => r.json()).catch(() => []); const t = (Array.isArray(j) ? j : []).find(x => x.id === m); if (!t) throw new Error('Jupiter does not know this token yet'); return TI[m] = t; }
  function tradeInit(el) { if (!el || el._on) return; el._on = 1; const T = { side: 'buy', mint: el.dataset.mint || '', q: null, t: null, seq: 0 };
    const picks = $('.picks', el), q = $('.tq', el), amtEl = $('.amt', el), st = (m, c = '') => { const s = $('.tst', el); s.className = 'stat2 tst ' + c; s.innerHTML = m; };
    const list = () => ((S.coins && S.coins.coins) || []).slice(0, 8).map(c => ({ mint: c.mint, sym: c.symbol, img: c.image }));
    const drawPicks = () => { picks.innerHTML = list().map(p => `<button data-m="${p.mint}"><img src="${esc(p.img || '/coins/1.png')}" alt="">${esc(p.sym)}</button>`).join(''); labels(); }; el._picks = drawPicks; drawPicks();
    picks.onclick = e => { const b = e.target.closest('button'); if (!b) return; q.value = b.dataset.m; pick(b.dataset.m); };
    q.addEventListener('input', () => { const v = q.value.trim(); if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) pick(v); });
    $('.side', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; T.side = b.dataset.side; $$('.side button', el).forEach(x => x.classList.toggle('on', x === b)); labels(); amtEl.value = ''; quote(); };
    $('.pct', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; const bal = balOf(); if (bal == null) return; const f = +b.dataset.p; amtEl.value = String(+(T.side === 'buy' ? Math.max(0, bal * f - (f === 1 ? .01 : 0)) : bal * f).toFixed(T.side === 'buy' ? 4 : 6)); quote(); };
    $('.max', el).onclick = () => $('.pct button[data-p="1"]', el).click();
    let deb; amtEl.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(quote, 350); }); el.addEventListener('bal', labels); $('.tgo', el).onclick = go;
    function balOf() { if (!WL.view) return null; if (T.side === 'buy') return WL.view.sol; const t = WL.view.tokens.find(x => x.mint === T.mint); return t ? t.amount : 0; }
    function labels() { const bal = balOf(); $('.max', el).textContent = 'balance ' + (bal == null ? '—' : num(bal)); const sym = T.t ? T.t.symbol : '—', ic = T.t && T.t.icon ? `<img src="${esc(T.t.icon)}" alt="">` : '';
      $('.tin', el).innerHTML = T.side === 'buy' ? 'SOL' : ic + esc(sym); $('.tout', el).innerHTML = T.side === 'buy' ? ic + esc(sym) : 'SOL';
      $('.tgo', el).textContent = !WL.pk ? 'Connect wallet' : !T.t ? 'Pick a token' : (T.side === 'buy' ? 'Buy ' : 'Sell ') + sym; $$('.picks button', el).forEach(b => b.classList.toggle('on', b.dataset.m === T.mint)); }
    async function pick(m) { T.mint = m; T.t = null; labels(); $('.tinfo', el).innerHTML = '<small>reading the token…</small>'; try { const t = await tokInfo(m); if (T.mint !== m) return; T.t = t;
        const mc = t.mcap ?? t.fdv, ch = t.stats24h && t.stats24h.priceChange; $('.tinfo', el).innerHTML = `${t.icon ? `<img src="${esc(t.icon)}" alt="">` : '<img alt="" src="/coins/1.png">'}<b>${esc(t.name || t.symbol)} <span class="lm">$${esc(t.symbol)}</span></b><small>${esc(m)}</small>`;
        $('.tstat', el).innerHTML = `<div><small>price</small><b>${usd(t.usdPrice)}</b></div><div><small>24h</small><b class="${cls(ch)}">${spct(ch)}</b></div><div><small>market cap</small><b>${big(mc)}</b></div>`; labels(); quote(); }
      catch (e) { $('.tinfo', el).innerHTML = `<small class="dn">${esc(e.message)}</small>`; $('.tstat', el).innerHTML = ''; } }
    async function quote() { const a = +amtEl.value; $('.out', el).value = ''; $('.qi', el).textContent = '—'; $('.qr', el).textContent = '—'; $('.outusd', el).textContent = ''; T.q = null; if (!T.t || !(a > 0)) return;
      const inM = T.side === 'buy' ? SOL : T.mint, outM = T.side === 'buy' ? T.mint : SOL, inD = T.side === 'buy' ? 9 : T.t.decimals, outD = T.side === 'buy' ? T.t.decimals : 9, my = ++T.seq;
      try { const r = await fetch(`${JUP}/swap/v1/quote?inputMint=${inM}&outputMint=${outM}&amount=${Math.floor(a * 10 ** inD)}&slippageBps=100`).then(x => x.json()); if (my !== T.seq) return; if (!r.outAmount) throw new Error(r.error || 'no route right now');
        T.q = r; const o = r.outAmount / 10 ** outD; $('.out', el).value = num(o, 6); $('.qi', el).textContent = (+r.priceImpactPct * 100).toFixed(2) + '%'; $('.qr', el).textContent = (r.routePlan || []).map(x => x.swapInfo.label).join(' → ');
        const px = T.side === 'buy' ? T.t.usdPrice : (WL.view && WL.view.solUsd); if (px) $('.outusd', el).textContent = '≈ ' + usd(o * px, 2); st(''); } catch (e) { if (my === T.seq) st(esc(e.message), 'err'); } }
    async function go() { try { if (!WL.pk) { await connect(); return; } if (!T.q) throw new Error('enter an amount first'); st('building the swap…');
        const s = await fetch(`${JUP}/swap/v1/swap`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: T.q, userPublicKey: WL.pk, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 400000, priorityLevel: 'high' } } }) }).then(r => r.json());
        if (!s.swapTransaction) throw new Error('Jupiter returned no swap'); const r = await signSend([s.swapTransaction], st, true); st(`done. ${tsx(r.sigs[0])}`, 'ok'); toast(`Swap confirmed · ${tsx(r.sigs[0])}`); amtEl.value = ''; quote(); }
      catch (e) { if (e.message !== 'no wallet') st(esc(e.message || String(e)), 'err'); } }
    labels(); if (T.mint) pick(T.mint); }

  // ---------------------------------------------------------------- the launcher
  function squareImage(file) { return new Promise((ok, no) => { const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { const S2 = 512, c = document.createElement('canvas'); c.width = c.height = S2; const g = c.getContext('2d'), s = Math.min(im.naturalWidth, im.naturalHeight);
      g.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, S2, S2); URL.revokeObjectURL(url); let d = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .9); if (d.length * .75 > 700 * 1024) d = c.toDataURL('image/jpeg', .85); ok(d.split(',')[1]); };
    im.onerror = () => no(new Error('could not read that image')); im.src = url; }); }
  function launchInit() { const box = $('#imgs'); if (!box || box._on) return; box._on = 1;
    box.innerHTML = [1, 2, 3, 4, 5, 6].map(i => `<button data-i="${i}" aria-label="image ${i}"><img src="/coins/${i}.png" alt=""></button>`).join('');
    box.onclick = e => { const b = e.target.closest('button'); if (!b) return; LN.img = b.dataset.i; LN.imgUrl = null; $('#cImg').value = ''; setT('#cFileSt', ''); renderLaunch(); };
    $('#cFile').onchange = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; const st = $('#cFileSt'); try { if (f.size > 12e6) throw new Error('that file is too big'); st.textContent = 'preparing…';
        const data = await squareImage(f); st.textContent = 'uploading…'; const r = await post('upload', { data }); LN.img = r.image; LN.imgUrl = r.url; $('#cImg').value = ''; st.textContent = 'uploaded ✓'; renderLaunch(); }
      catch (err) { st.textContent = err.message; } finally { e.target.value = ''; } };
    ['#cName', '#cSym', '#cImg', '#cBuy'].forEach(id => $(id).addEventListener('input', () => { if (id === '#cSym') $(id).value = $(id).value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (id === '#cImg') { LN.img = $('#cImg').value.trim() || '1'; LN.imgUrl = null; setT('#cFileSt', ''); } renderLaunch(); }));
    $('#launchBtn').onclick = doLaunch; renderLaunch(); }
  function renderLaunch() { if (!$('#launchBtn')) return; const custom = /^https:\/\//.test(LN.img) || LN.img[0] === 'b'; $$('#imgs button').forEach(b => b.classList.toggle('on', !custom && b.dataset.i === LN.img));
    const c = curveNow(), u = solUsd(), name = $('#cName').value.trim() || 'Your coin', sym = $('#cSym').value.trim() || 'TICKER', src = LN.img[0] === 'b' ? LN.imgUrl : custom ? LN.img : `/coins/${/^[1-6]$/.test(LN.img) ? LN.img : 1}.png`;
    $('#prev').innerHTML = `<div class="ph1"><img src="${esc(src)}" alt="" onerror="this.src='/coins/1.png'"><b>${esc(name)} <span>$${esc(sym)}</span></b></div>
      <svg viewBox="0 0 300 120" preserveAspectRatio="none"><path d="${c ? curvePath(Math.max(1.01, c.run), 300, 120, 8) : ''}" fill="none" stroke="#c6ff3c" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>
      <div class="kvs"><div>starts at<b>$10K</b></div><div>graduates at<b>${c && u ? big(c.gradSol * u) : '—'}</b></div><div>sold on the curve<b>${c ? (c.sold * 100).toFixed(1) + '%' : '—'}</b></div><div>raises<b>${c ? num(c.raise, 1) + ' SOL' : '—'}</b></div><div>the wick<b>−${LN.wick}% from the 24h high</b></div><div>the buy<b>${LN.buy}% of the reserve</b></div></div>`;
    const open = S.m && S.m.pad, ps = $('#padSt'); ps.className = 'padst' + (open ? ' open' : ''); ps.innerHTML = `<i></i>${open ? 'launchpad open · ' + short(S.m.pad) : 'launchpad opening soon'}`;
    if (LN.busy) return; const b = $('#launchBtn'); if (!WL.pk) { b.textContent = 'Connect wallet'; b.disabled = false; return; } b.textContent = !open ? 'Launchpad opening soon' : c && c.err ? 'Fix the curve first' : 'Launch on Raydium →'; b.disabled = !open || !c || !!c.err; }
  async function doLaunch() { const st = stat('#lStat'); if (LN.busy) return; try { if (!WL.pk) { await connect(); return; } if (!(S.m && S.m.pad)) { st('The w1ck launchpad isn’t open yet. This button lights up the moment it is.'); return; }
      const c = curveNow(); if (!c || c.err) throw new Error(c ? c.err : 'pick a curve'); const name = $('#cName').value.trim(), symbol = $('#cSym').value.trim(); if (name.length < 2) throw new Error('Give your coin a name.'); if (symbol.length < 2) throw new Error('Give your coin a ticker.');
      const buySol = +$('#cBuy').value || 0; if (buySol > c.raise / 2) throw new Error('The dev buy is at most half the raise.');
      LN.busy = true; $('#launchBtn').disabled = true; st('building your launch on Raydium LaunchLab…');
      const r = await post('buildLaunch', { wallet: WL.pk, pad: S.m.pad, name, symbol, image: LN.img, wick: LN.wick, buy: LN.buy, run: LN.run, buySol }); const s = await signSend(r.txs, st, false);
      st(`$${esc(symbol)} is live.\nmint <b>${esc(r.mint)}</b>\n<a href="#/c/${r.mint}">open its page</a> · ${tsx(s.sigs[0])}`, 'ok'); setTimeout(async () => { await loadCoins(); renderBoard(); }, 5000); }
    catch (e) { if (e.message !== 'no wallet') st(esc(e.message || String(e)), 'err'); } finally { LN.busy = false; renderLaunch(); } }

  // ---------------------------------------------------------------- board, launchlab, log, reserves, people, stats
  let SORT = 'new';
  const curveTxt = c => c.curve.isDefault ? 'default' : `${big(c.curve.startUsd)} → ${big(c.curve.gradUsd)}`;
  function renderBoard() { const el = $('#bList'); if (!el || !S.coins) return; const c = S.coins; setT('#bCount', c.open ? `${c.coins.length} coin${c.coins.length === 1 ? '' : 's'}` : '');
    if (!c.open) { el.innerHTML = '<div class="empty">The w1ck launchpad opens soon. The first coin with its own wick shows up here.</div>'; return; }
    if (!c.coins.length) { el.innerHTML = '<div class="empty">No coins yet. Launch the first one above.</div>'; return; }
    const L = [...c.coins].sort((a, b) => SORT === 'mcap' ? (b.mcapUsd || 0) - (a.mcapUsd || 0) : SORT === 'res' ? b.reserve.sol - a.reserve.sol : SORT === 'fill' ? (b.graduated ? -1 : b.progress) - (a.graduated ? -1 : a.progress) : (b.created || 0) > (a.created || 0) ? 1 : -1);
    el.innerHTML = `<div class="brow h"><span></span><span>coin</span><span class="hm">curve</span><span class="n hs">market cap</span><span class="hm">filled</span><span class="n hs">reserve</span><span class="n hm">wicks</span><span class="rule">rule</span></div>` +
      L.map(x => `<a class="brow" href="#/c/${x.mint}"><img src="${esc(x.image || '/coins/1.png')}" alt="" onerror="this.src='/coins/1.png'"><span><b>${esc(x.name)}</b><small>$${esc(x.symbol)} · ${x.created ? ago(x.created > 1e11 ? x.created / 1000 : x.created) : ''}</small></span><span class="cv hm">${esc(curveTxt(x))}</span><span class="n hs">${big(x.mcapUsd)}</span><span class="hm fc"><span class="mono dim" style="font-size:12px">${x.graduated ? 'graduated' : Math.round(x.progress) + '%'}</span><span class="fill"><i style="width:${clamp(x.progress / 100) * 100}%"></i></span></span><span class="n hs">${sol(x.reserve.sol, 3)}</span><span class="n hm">${x.wicks}</span><span class="rule">${x.wick ? '−' + x.wick + '% · ' + x.buy + '%' : '—'}</span></a>`).join(''); }
  function renderLL() { const el = $('#llList'); if (!el || !S.ll) return; if (S.ll.error || !S.ll.coins) { el.innerHTML = '<div class="empty">LaunchLab didn’t answer. Trying again shortly.</div>'; return; }
    setT('#llPct', S.ll.defaultShare != null ? Math.round(S.ll.defaultShare) + '%' : '—'); setT('#llTxt', `of the ${S.ll.total} newest SOL coins on Raydium LaunchLab took the default curve, and none of them has a wick rule.`);
    el.innerHTML = S.ll.coins.slice(0, 8).map(c => `<div class="erow"><img src="${esc(c.image || '')}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(c.name)} <span class="dim">$${esc(c.symbol)}</span></b><span class="tg ${c.isDefault ? 'd' : 'c'}">${c.isDefault ? 'default' : 'custom'}</span><span class="dim">${big(c.startUsd)} → ${big(c.gradUsd)}</span></div>`).join(''); }
  function entryRow(e) { const c = coinBy(e.coin); return `<div class="ent"><span class="ic">${wickIc}</span><span><b>${c ? '$' + esc(c.symbol) : short(e.coin)}</b> wick bought with ${num(e.sol, 4)} SOL at −${num(e.drawdown, 1)}%, burned ${kfmt(Number(e.burned) / 1e6)} tokens<small>${ago(e.time)}</small></span>${tsx(e.sig)}</div>`; }
  function renderLog() { const el = $('#eList'); if (!el || !S.ledger) return; const E = S.ledger.entries || [];
    el.innerHTML = !(S.coins && S.coins.open) ? '<div class="empty">The wick log starts with the first wick, the moment the launchpad opens.</div>' : E.length ? E.slice(0, 40).map(entryRow).join('') : '<div class="empty">No wicks bought yet. The first one lands here, linked to Solscan.</div>';
    const r = $('#porRows'); if (!r) return; const R = S.res; if (!R || !R.open || !R.wallet) { r.innerHTML = '<div class="empty">Shows once the launchpad is open.</div>'; return; }
    r.innerHTML = `<div class="prow">reserves owed<b>${sol(R.owedSol, 4)}</b></div><div class="prow">reserve wallet<b>${sol(R.walletSol, 4)}</b></div><div class="prow">waiting in LaunchLab's vault<b>${sol(R.vaultSol, 4)}</b></div><div class="prow">status<span class="${R.covered ? 'ok' : 'no'}">${R.covered ? 'covered ✓' : 'short ✕'}</span></div><div class="prow">wallet<a class="lm" href="https://solscan.io/account/${R.wallet}" target="_blank" rel="noopener">${short(R.wallet)} ↗</a></div>`; }
  function personCard(p) { return `<a class="card pc" href="#/u/${p.wallet}"><span class="av">${avatarHtml(p, p.wallet)}</span><b>${esc(p.name)}</b><small>${p.x ? '@' + esc(p.x) + ' · ' : ''}${short(p.wallet)}</small>${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</a>`; }
  function renderPeople() { const el = $('#peopleList'); if (!el || !S.profiles) return; setT('#pCount', `${S.profiles.length} profile${S.profiles.length === 1 ? '' : 's'} on-chain`); el.innerHTML = S.profiles.length ? S.profiles.slice(0, 24).map(personCard).join('') : '<div class="card empty" style="grid-column:1/-1">No profiles yet. Be the first: it takes one signature.</div>'; }
  function renderStats() { if (S.m && S.m.sol) { countTo($('#kSol'), S.m.sol.usd, x => usd(x, 2)); setT('#kSolC', spct(S.m.sol.ch24), cls(S.m.sol.ch24)); }
    if (S.coins) { const o = S.coins.open, T = S.coins.totals || {}; countTo($('#kCoins'), o ? S.coins.coins.length : 0, x => String(Math.round(x))); setT('#kPad', o ? (T.graduated || 0) + ' graduated' : 'launchpad opening soon');
      countTo($('#kRes'), o ? T.reserveSol || 0 : 0, x => x.toFixed(3) + ' SOL'); setT('#kResU', o && solUsd() ? usd((T.reserveSol || 0) * solUsd(), 2) : ''); countTo($('#kWicks'), o ? T.wicks || 0 : 0, x => String(Math.round(x))); countTo($('#kBurn'), o ? T.burned || 0 : 0, x => kfmt(x)); } }

  // ---------------------------------------------------------------- coin page: Raydium's candles, the trigger, every wick bought
  function candleSvg(d, coin) { const R = d.candles || []; if (!R.length) return '<div class="empty">No candles yet. The chart starts with the first trade.</div>';
    const W = 900, H = 340, L = 8, Rt = 70, T = 14, B = 26, rows = R.slice(-90), hi = Math.max(...rows.map(r => r.h)), lo = Math.min(...rows.map(r => r.l)), trig = d.high && coin.wick ? d.high * (1 - coin.wick / 100) : null;
    const top = Math.max(hi, d.high || 0) * 1.02, bot = Math.min(lo, trig || lo) * .98, Y = v => T + (top - v) / (top - bot || 1) * (H - T - B), sw = (W - L - Rt) / rows.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
    for (let i = 0; i < 5; i++) { const y = T + i * (H - T - B) / 4; s += `<line x1="${L}" x2="${W - Rt}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.05)"/><text x="${W - Rt + 6}" y="${y + 4}" font-family="GM, monospace" font-size="11" fill="#5f6b77">${(top - i * (top - bot) / 4).toPrecision(3)}</text>`; }
    rows.forEach((r, i) => { const x = L + i * sw + sw / 2, up = r.c >= r.o, col = up ? '#c6ff3c' : '#ff6b6b'; s += `<line x1="${x}" x2="${x}" y1="${Y(r.h)}" y2="${Y(r.l)}" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke"/><rect x="${x - sw * .32}" y="${Y(Math.max(r.o, r.c))}" width="${Math.max(1, sw * .64)}" height="${Math.max(1.5, Math.abs(Y(r.o) - Y(r.c)))}" fill="${col}"/>`; });
    if (d.high) s += `<line x1="${L}" x2="${W - Rt}" y1="${Y(d.high)}" y2="${Y(d.high)}" stroke="rgba(255,255,255,.3)" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/><text x="${L + 4}" y="${Y(d.high) - 5}" font-family="GM, monospace" font-size="11" fill="#9aa5b1">24h high</text>`;
    if (trig) s += `<line x1="${L}" x2="${W - Rt}" y1="${Y(trig)}" y2="${Y(trig)}" stroke="#c6ff3c" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/><text x="${L + 4}" y="${Y(trig) - 5}" font-family="GM, monospace" font-size="11" fill="#c6ff3c">trigger −${coin.wick}%</text>`;
    (d.entries || []).forEach(e => { const f = rows.findIndex(r => r.t > e.time), idx = f === -1 ? rows.length - 1 : f - 1; if (idx < 0) return; const r = rows[idx]; if (!r) return; const x = L + idx * sw + sw / 2, y = Y(r.l); s += `<circle cx="${x}" cy="${y}" r="5" fill="#f2ffcc"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#c6ff3c" stroke-opacity=".5"/>`; });
    return s + '</svg>'; }
  let tradeTimer = null;
  async function loadTrades(pool) { const el = $('#cFeed'); if (!el) return; try { const j = await fetch(`${HIST}/trade?poolId=${pool}&limit=20`).then(r => r.json()); const R = (j && j.data && j.data.rows) || [];
      el.innerHTML = R.length ? R.map(t => `<div class="tr"><span class="s ${t.side}">${esc(t.side)}</span><span>${kfmt(+t.amountA)} tokens</span><span>${num(+t.amountB, 4)} SOL</span><a href="https://solscan.io/tx/${esc(t.txid)}" target="_blank" rel="noopener">${ago(t.blockTime)}</a></div>`).join('') : '<div class="empty">No trades yet.</div>'; } catch (e) { el.innerHTML = '<div class="empty">Trades are on Raydium.</div>'; } }
  async function coinPage(mint) { app().innerHTML = `<div class="page"><div class="wrap"><div class="card empty">reading the coin…</div></div></div>`; let d; try { d = await api('coin', '&mint=' + mint); } catch (e) { d = { coin: null, entries: [], candles: [] }; }
    if (location.hash !== '#/c/' + mint) return; const c = d.coin, u = solUsd();
    app().innerHTML = `<div class="page"><div class="wrap">
      <div class="card phead rv"><span class="ph-av">${c && c.image ? `<img src="${esc(c.image)}" alt="">` : '$'}</span><div><h1>${c ? esc(c.name) + ' <span class="lm">$' + esc(c.symbol) + '</span>' : 'Trade ' + short(mint)}</h1><p>${c ? (c.wick ? `Every wick past −${c.wick}% gets bought with ${c.buy}% of its reserve.` : 'Launched on w1ck.') : 'This token is not on the w1ck launchpad, but you can still trade it here.'}</p>
        <div class="meta"><span class="mono">${esc(mint)}</span><a href="https://raydium.io/launchpad/token/?mint=${mint}" target="_blank" rel="noopener">raydium ↗</a><a href="https://solscan.io/token/${mint}" target="_blank" rel="noopener">solscan ↗</a><span id="hCount"></span></div></div></div>
      ${c ? `<div class="cgrid"><div class="card chart rv"><div class="cth"><span>15m candles · Raydium LaunchLab${d.src && d.src.includes('gecko') ? ' + pool' : ''}</span><span>price in SOL</span></div>${candleSvg(d, c)}</div>
        <div class="card ws rv d1"><span class="note">the wick, now</span><div class="big ${d.armed ? 'lm' : ''}">${d.drawdown != null ? '−' + d.drawdown.toFixed(1) + '%' : '—'}</div><span class="st ${d.armed ? 'armed' : ''}">${d.drawdown == null ? 'no candles yet' : d.armed ? 'armed · the reserve can buy' : 'watching'}</span>
          <div class="bar"><i style="width:${clamp((d.drawdown || 0) / 60) * 100}%"></i><em style="left:${clamp((c.wick || 25) / 60) * 100}%"></em></div><span class="note">below the 24h high · trigger −${c.wick || '—'}%</span>
          <div class="kvs pcard" style="padding:0;border:0;background:none"><div class="kvs"><div>reserve<b>${sol(c.reserve.sol, 4)}</b></div><div>next wick spends<b>${sol(c.reserve.sol * (c.buy || 25) / 100, 4)}</b></div><div>wicks bought<b>${c.wicks}</b></div><div>burned<b>${kfmt(c.burned)}</b></div></div></div></div></div>
      <div class="kv"><div class="card rv"><small>market cap</small><b>${big(c.mcapUsd)}</b><em>Raydium</em></div><div class="card rv d1"><small>curve</small><b>${c.curve.isDefault ? 'default' : c.curve.run.toFixed(1) + '×'}</b><em>${big(c.curve.startUsd)} → ${big(c.curve.gradUsd)}</em></div><div class="card rv d2"><small>filled</small><b>${c.graduated ? 'graduated' : Math.round(c.progress) + '%'}</b><em>of ${num(c.curve.raise, 1)} SOL</em></div><div class="card rv d3"><small>fees earned</small><b>${sol(c.reserve.earnedSol, 4)}</b><em>1% of ${num(c.volumeSol, 2)} SOL volume</em></div></div>
      <div class="two"><div class="card feed rv"><h3>live trades</h3><div id="cFeed"><div class="empty">reading…</div></div></div><div class="card feed rv d1"><h3>wick log</h3>${d.entries.length ? d.entries.map(entryRow).join('') : '<div class="empty">No wicks bought for this coin yet.</div>'}</div></div>` : ''}
      <div style="margin-top:14px">${tradeHtml('coin', mint)}</div></div></div>`; tradeInit($('[data-trade="coin"]')); reveals();
    if (c) { loadTrades(c.pool); clearInterval(tradeTimer); tradeTimer = setInterval(() => { if (location.hash === '#/c/' + mint) loadTrades(c.pool); else clearInterval(tradeTimer); }, 10000); }
    try { const h = await api('holders', '&mint=' + mint); setT('#hCount', `${h.count}${h.full ? '' : '+'} holders`); } catch (e) { } }

  // ---------------------------------------------------------------- profile page
  async function profilePage(w) { app().innerHTML = `<div class="page"><div class="wrap"><div class="card empty">reading the profile…</div></div></div>`; let p = null; try { p = (await api('profile', '&wallet=' + w)).profile; } catch (e) { app().innerHTML = `<div class="page"><div class="wrap"><div class="card empty">${esc(e.message)}</div></div></div>`; return; }
    const mine = WL.pk === w; app().innerHTML = `<div class="page"><div class="wrap">
      <div class="card phead rv"><span class="ph-av">${avatarHtml(p, w)}</span><div><h1>${esc(p ? p.name : short(w))}</h1>${p && p.bio ? `<p>${esc(p.bio)}</p>` : `<p>${mine ? 'No profile yet. Make one: it takes one signature.' : 'This wallet has no profile yet.'}</p>`}
        <div class="meta"><span class="mono">${esc(w)}</span>${p && p.x ? `<a href="https://x.com/${esc(p.x)}" target="_blank" rel="noopener">@${esc(p.x)} ↗</a>` : ''}<a href="https://solscan.io/account/${w}" target="_blank" rel="noopener">solscan ↗</a>${p ? `<span>updated ${ago(p.time)}</span>` : ''}</div></div>
        ${mine ? `<button class="btn go" id="edit">${p ? 'Edit profile' : 'Make my profile'}</button>` : ''}</div>
      <div class="pgrid"><div class="card pbox rv"><h3>wallet · live</h3><div class="bigbal"><b id="pTot">—</b><small id="pSol">—</small></div><div class="toks" id="pToks" style="max-height:none"></div></div>
        <div class="card pbox rv d1"><h3>w1ck coins held</h3><div class="toks" id="pCoins" style="max-height:none"><div class="empty">reading…</div></div></div></div></div></div>`;
    if (mine) $('#edit').onclick = () => editProfile(p); reveals();
    const fill = v => { setT('#pTot', usd(v.totalUsd, 2)); setT('#pSol', `${num(v.sol)} SOL · ${usd(v.solValue, 2)}`); $('#pToks').innerHTML = v.tokens.slice(0, 20).map(tokRow).join('') || '<div class="empty">no tokens</div>';
      const held = v.tokens.filter(t => coinBy(t.mint)); $('#pCoins').innerHTML = held.map(t => { const c = coinBy(t.mint); return `<a class="tok" href="#/c/${t.mint}">${c.image ? `<img src="${esc(c.image)}" alt="">` : '<span class="ph"></span>'}<span><b>$${esc(c.symbol)}</b><small>wick −${c.wick || '—'}%</small></span><span class="v">${kfmt(t.amount)}<small>${usd(t.usd, 2)}</small></span></a>`; }).join('') || '<div class="empty">No w1ck coins in this wallet yet.</div>'; };
    const load = async () => { try { const v = mine && WL.view ? WL.view : await api('wallet', '&addr=' + w); if (location.hash === '#/u/' + w) fill(v); } catch (e) { } }; load(); clearInterval(profilePage.t); profilePage.t = setInterval(() => { if (location.hash === '#/u/' + w) load(); else clearInterval(profilePage.t); }, 10000); }
  function editProfile(p) { const m = $('#modal'); $('#mCard').innerHTML = `<h3>Your profile, on Solana</h3><label class="fld"><span>Name</span><input id="eName" maxlength="24" value="${esc(p ? p.name : '')}" placeholder="wickhunter"></label><label class="fld"><span>Bio</span><textarea id="eBio" maxlength="140" rows="3" placeholder="what you launch, what you hold">${esc(p ? p.bio : '')}</textarea></label><label class="fld"><span>Avatar (https image link)</span><input id="eAv" value="${esc(p ? p.avatar : '')}" placeholder="https://…"></label><label class="fld"><span>X handle</span><input id="eX" maxlength="16" value="${esc(p ? p.x : '')}" placeholder="@handle"></label><button class="btn go wide" id="eSave">Save on-chain</button><div class="stat2" id="eStat"></div>`;
    m.classList.add('on'); m.onclick = e => { if (e.target === m) m.classList.remove('on'); };
    $('#eSave').onclick = async () => { const st = stat('#eStat'); try { await connect(); st('building the memo…'); const r = await post('buildProfile', { wallet: WL.pk, name: $('#eName').value, bio: $('#eBio').value, avatar: $('#eAv').value.trim(), x: $('#eX').value });
        const s = await signSend(r.txs, st, false); st(`saved on-chain. ${tsx(s.sigs[0])}`, 'ok'); toast('Profile saved on Solana.'); setTimeout(async () => { m.classList.remove('on'); await loadMe(); await loadSocial(); if (location.hash.startsWith('#/u/')) profilePage(WL.pk); else renderPeople(); }, 2200); } catch (e) { if (e.message !== 'no wallet') st(esc(e.message), 'err'); } }; }

  // ---------------------------------------------------------------- console: for the reserve wallet
  function consolePage() { app().innerHTML = `<div class="page"><div class="wrap"><div class="head"><span class="kick">console</span><h2>Run the <span>reserves.</span></h2><p>For the wallet that runs w1ck. Every step is a transaction you sign, and every wick buy lands on the public wick log.</p></div>
    <div class="con">
      <div class="card cstep"><h3><span>01</span>Create the w1ck launchpad</h3><p>One transaction on Raydium LaunchLab: 1% fee to this wallet (the reserve wallet), 0% creator fee, half the LP burned at graduation and half kept as a fee key.</p><div class="crow"><button class="btn go sm" id="kPad">Create the launchpad</button><span class="mono" id="kPadInfo"></span></div><div class="stat2" id="kPadSt"></div></div>
      <div class="card cstep"><h3><span>02</span>Claim the fees</h3><p>Moves what every coin has paid from LaunchLab's vault to this wallet, as SOL. The reserves are already counted per coin; claiming just moves the SOL.</p><div class="crow"><button class="btn sm" id="kClaim">Claim</button><span class="mono" id="kVault"></span></div><div class="stat2" id="kClaimSt"></div></div>
      <div class="card cstep"><h3><span>03</span>Buy the wicks</h3><p>Every coin, its reserve and how far it is below its 24h high right now. A coin is armed once it's past its own wick. Buying spends the coin's buy share of its reserve on the coin through Jupiter and burns what it bought, in one transaction. The site refuses to build a buy for a coin that isn't armed.</p>
        <div class="crow" style="margin-bottom:10px"><button class="btn sm" id="kScan">Check every coin now</button><span class="mono" id="kScanSt"></span></div><div class="ctable" id="kTable"><div class="empty">reading the launchpad…</div></div><div class="stat2" id="kSt"></div></div>
    </div></div></div>`;
    const ref = async () => { if (!WL.pk) { setT('#kPadInfo', 'connect the wallet that runs w1ck'); return; } try { const p = await api('pad', '&admin=' + WL.pk); setT('#kPadInfo', p.exists ? `launchpad ${short(p.id)} · ${p.feePct}% fee` : 'no launchpad on this wallet yet'); setT('#kVault', p.exists ? `${(+p.unclaimedSol).toFixed(4)} SOL waiting` : ''); } catch (e) { setT('#kPadInfo', e.message); } }; ref();
    const WS = {}; const table = () => { const el = $('#kTable'), C = (S.coins && S.coins.coins) || []; if (!S.coins || !S.coins.open) { el.innerHTML = '<div class="empty">Opens once the launchpad address is set on the site.</div>'; return; } if (!C.length) { el.innerHTML = '<div class="empty">No coins on the launchpad yet.</div>'; return; }
      el.innerHTML = `<div class="ctr h"><span>coin</span><span>rule</span><span>reserve</span><span>below high</span><span>status</span><span></span></div>` + C.map(c => { const w = WS[c.mint]; return `<div class="ctr" data-m="${c.mint}"><span>$${esc(c.symbol)}</span><span>−${c.wick || '—'}% · ${c.buy || '—'}%</span><span>${sol(c.reserve.sol, 4)}</span><span>${w && w.drawdown != null ? '−' + w.drawdown.toFixed(1) + '%' : '—'}</span><span class="${w && w.armed ? 'lm' : 'dim'}">${w ? (w.armed ? 'armed' : 'watching') : '—'}</span>
        <span class="act"><input class="kSol" type="number" min="0" step="0.001" value="${+(c.reserve.sol * (c.buy || 25) / 100).toFixed(4)}" aria-label="SOL"><button class="btn sm go kB" ${w && w.armed ? '' : 'disabled title="not armed"'}>Buy the wick</button></span></div>`; }).join(''); };
    table();
    $('#kScan').onclick = async () => { const C = (S.coins && S.coins.coins) || []; setT('#kScanSt', `checking ${C.length} coin${C.length === 1 ? '' : 's'}…`); for (const c of C) { try { WS[c.mint] = await api('wickstate', '&mint=' + c.mint); } catch (e) { } table(); } setT('#kScanSt', 'checked ' + new Date().toLocaleTimeString()); };
    $('#kTable').onclick = async e => { const b = e.target.closest('.kB'); if (!b) return; const row = b.closest('.ctr'), mint = row.dataset.m, st = stat('#kSt');
      try { await connect(); st('building the wick buy…'); const r = await post('buildWick', { wallet: WL.pk, coin: mint, sol: +$('.kSol', row).value }); const s = await signSend(r.txs, st, true); st(`wick bought with ${num(r.sol, 4)} SOL at −${r.drawdown.toFixed(1)}% and burned. ${tsx(s.sigs[0])}`, 'ok');
        setTimeout(async () => { await Promise.all([loadCoins(), loadLedger()]); if (location.hash === '#/console') table(); }, 3000); } catch (err) { if (err.message !== 'no wallet') st(esc(err.message), 'err'); } };
    $('#kPad').onclick = async () => { const st = stat('#kPadSt'); try { await connect(); st('building…'); const r = await post('buildPad', { wallet: WL.pk, feePct: 1, burnPct: 50, web: location.origin, img: location.origin + '/icon.png' }); const s = await signSend(r.txs, st, false); st(`the w1ck launchpad is live: <b>${esc(r.pad)}</b> ${tsx(s.sigs[0])}\nsend this address over so the site can open the launcher.`, 'ok'); ref(); } catch (e) { if (e.message !== 'no wallet') st(esc(e.message), 'err'); } };
    $('#kClaim').onclick = async () => { const st = stat('#kClaimSt'); try { await connect(); st('building the claim…'); const r = await post('claim', { wallet: WL.pk }); const s = await signSend(r.txs, st, false); st(`claimed. ${tsx(s.sigs[0])}`, 'ok'); ref(); } catch (e) { if (e.message !== 'no wallet') st(esc(e.message), 'err'); } }; }

  // ---------------------------------------------------------------- router + glue
  function reveals() { if (RM) { $$('.rv').forEach(e => e.classList.add('shown')); return; } const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }); $$('.rv:not(.shown)').forEach(e => io.observe(e)); }
  let cur = null;
  function render() { const h = location.hash || '#/', [, view, arg] = h.split('/'); const v = view && PAGES[view] ? view : (view === 'u' || view === 'c' || view === 'console') ? view : 'start';
    document.body.classList.toggle('sub', v !== 'start'); document.body.classList.toggle('home', v === 'start');
    $$('#links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === h));
    const key = v + ':' + (arg || ''); if (key === cur) { $$('[data-trade]').forEach(el => el.dispatchEvent(new Event('bal'))); renderLaunch(); return; } cur = key;
    scrollTo({ top: 0 }); app().classList.remove('pin'); void app().offsetWidth; app().classList.add('pin');
    if (v === 'u') return profilePage(arg); if (v === 'c') return coinPage(arg); if (v === 'console') return consolePage();
    app().innerHTML = PAGES[v](); reveals(); pageInit(v); }
  function renderLive() { const el = $('#liveLine'); if (!el) return; const c = S.coins; if (!c) return; if (!c.open) { el.textContent = 'launchpad opening soon'; return; } const T = c.totals || {}; el.textContent = `${c.coins.length} coins · ${(T.reserveSol || 0).toFixed(3)} SOL in reserves · ${T.wicks || 0} wicks bought`; }
  function onMarket() { if (!S.m) return; if (LN.s0 == null) preset(S.m.defaultPreset || 'mid'); else { setStart(); syncPickers(true); } $$('.pkw').forEach(el => { const ch = $('.chips', el); if (ch && !ch.children.length) ch.innerHTML = (S.m.presets || []).map(p => `<button class="chip" data-pre="${p.id}">${esc(p.name)}</button>`).join(''); }); syncPickers(true); }
  function navInit() { const top = $('#top'), pr = $('#prog'); addEventListener('scroll', () => { top.classList.toggle('sc', scrollY > 20); const h = document.documentElement.scrollHeight - innerHeight; pr.style.transform = `scaleX(${h > 0 ? clamp(scrollY / h) : 0})`; }, { passive: true }); addEventListener('hashchange', render); }
  backdrop(); walletInit(); navInit(); render();
  loadMarket().then(() => { onMarket(); renderStats(); });
  const refresh = () => { renderStats(); renderLive(); renderBoard(); renderLL(); renderLog(); renderPeople(); renderLaunch(); const t = $('[data-trade="home"]'); if (t && t._picks) t._picks(); };
  Promise.all([loadCoins(), loadLedger(), loadLL(), loadSocial()]).then(refresh);
  setInterval(async () => { await loadMarket(); renderStats(); }, 30000);
  setInterval(async () => { await Promise.all([loadCoins(), loadLedger(), loadSocial()]); refresh(); }, 60000);
  setInterval(async () => { await loadLL(); renderLL(); }, 120000);
})();
