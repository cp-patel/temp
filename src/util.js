/* MITRON MAYHEM — core utilities, palette, math, canvas helpers.
   Everything hangs off the single global MM namespace. No dependencies. */
(function (root) {
  'use strict';

  const MM = (root.MM = root.MM || {});

  MM.W = 960; // logical canvas width
  MM.H = 600; // logical canvas height

  /* ------------------------------------------------------------------ palette
     Indian election-hoarding aesthetic: saffron / white / green, chakra navy,
     plus a few neon meme accents for juice. */
  MM.C = {
    saffron: '#ff9933',
    saffronDeep: '#e2761b',
    white: '#fdfdf7',
    green: '#138808',
    greenDeep: '#0d5c06',
    navy: '#0b1533',
    navySoft: '#152449',
    chakra: '#1a4ca1',
    skin: '#e0a878',
    skinShade: '#c2874f',
    hair: '#f2f0ec',
    hairShade: '#cfcbc2',
    ink: '#1a1526',
    pink: '#ff2e88',
    cyan: '#22e0ff',
    gold: '#ffd447',
    danger: '#ff3b30',
    dust: '#8a7f6d',
  };

  /* -------------------------------------------------------------------- math */
  MM.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  MM.lerp = (a, b, t) => a + (b - a) * t;
  MM.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  MM.TAU = Math.PI * 2;
  MM.rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  MM.randInt = (a, b) => Math.floor(MM.rand(a, b + 1));
  MM.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  MM.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  MM.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  // easings
  MM.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    outElastic: (t) =>
      t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };

  /* ---------------------------------------------------------- canvas helpers */
  const D = (MM.d = {});

  D.rr = function (g, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  };

  D.fillRR = function (g, x, y, w, h, r, fill) {
    D.rr(g, x, y, w, h, r);
    g.fillStyle = fill;
    g.fill();
  };

  D.strokeRR = function (g, x, y, w, h, r, stroke, lw) {
    D.rr(g, x, y, w, h, r);
    g.strokeStyle = stroke;
    g.lineWidth = lw || 2;
    g.stroke();
  };

  D.circle = function (g, x, y, r, fill) {
    g.beginPath();
    g.arc(x, y, r, 0, MM.TAU);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
  };

  D.ellipse = function (g, x, y, rx, ry, fill, rot) {
    g.beginPath();
    g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, MM.TAU);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
  };

  /* Text with an optional chunky outline — used for all the meme captions. */
  D.text = function (g, str, x, y, opt) {
    const o = opt || {};
    g.save();
    g.font = `${o.weight || 900} ${o.size || 24}px ${o.font || "'Baloo 2', 'Trebuchet MS', system-ui, sans-serif"}`;
    g.textAlign = o.align || 'center';
    g.textBaseline = o.baseline || 'middle';
    if (o.rot) {
      g.translate(x, y);
      g.rotate(o.rot);
      x = 0;
      y = 0;
    }
    if (o.shadow) {
      g.fillStyle = o.shadow;
      g.fillText(str, x + (o.shadowDx || 4), y + (o.shadowDy || 4));
    }
    if (o.stroke) {
      g.lineWidth = o.lw || 7;
      g.strokeStyle = o.stroke;
      g.lineJoin = 'round';
      g.miterLimit = 2;
      g.strokeText(str, x, y);
    }
    g.fillStyle = o.fill || MM.C.white;
    g.fillText(str, x, y);
    g.restore();
  };

  D.measure = function (g, str, size, weight) {
    g.save();
    g.font = `${weight || 900} ${size || 24}px 'Baloo 2', 'Trebuchet MS', system-ui, sans-serif`;
    const w = g.measureText(str).width;
    g.restore();
    return w;
  };

  /* Rotating sunburst — the backbone of the political-poster look. */
  D.sunburst = function (g, x, y, r, rays, phase, c1, c2) {
    g.save();
    g.translate(x, y);
    g.rotate(phase);
    for (let i = 0; i < rays; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      const a0 = (i / rays) * MM.TAU;
      const a1 = a0 + MM.TAU / rays / 2;
      g.arc(0, 0, r, a0, a1);
      g.closePath();
      g.fillStyle = i % 2 ? c1 : c2;
      g.fill();
    }
    g.restore();
  };

  /* Halftone dot field, adds print-poster texture cheaply. */
  D.dots = function (g, x, y, w, h, step, r, color) {
    g.fillStyle = color;
    for (let yy = y; yy < y + h; yy += step) {
      for (let xx = x + (Math.round((yy - y) / step) % 2 ? step / 2 : 0); xx < x + w; xx += step) {
        g.beginPath();
        g.arc(xx, yy, r, 0, MM.TAU);
        g.fill();
      }
    }
  };

  /* Bunting / garland strung across the top of the screen. */
  D.bunting = function (g, y, w, t) {
    const flags = 16;
    const cols = [MM.C.saffron, MM.C.white, MM.C.green];
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin((x / w) * Math.PI) * 26;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
    for (let i = 0; i < flags; i++) {
      const p = (i + 0.5) / flags;
      const x = p * w;
      const yy = y + Math.sin(p * Math.PI) * 26;
      const sway = Math.sin(t * 2 + i) * 0.12;
      g.save();
      g.translate(x, yy);
      g.rotate(sway);
      g.beginPath();
      g.moveTo(-11, 0);
      g.lineTo(11, 0);
      g.lineTo(0, 26);
      g.closePath();
      g.fillStyle = cols[i % 3];
      g.fill();
      g.restore();
    }
  };

  /* Convert seconds to the chunky "0:07" style timer string. */
  MM.fmtTime = (s) => {
    s = Math.max(0, s);
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  /* Tiny deterministic hash → used to vary art per-round without state. */
  MM.hash = function (n) {
    let x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
})(window);
