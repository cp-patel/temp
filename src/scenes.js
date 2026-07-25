/* MITRON MAYHEM — reusable backdrops. Each microgame picks one so the whole
   game feels like one world instead of fourteen unrelated screens. */
(function (MM) {
  'use strict';

  const bg = (MM.bg = {});
  const C = MM.C;
  const d = MM.d;
  const W = MM.W;
  const H = MM.H;

  function grad(g, y0, y1, c0, c1) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    return gr;
  }

  /* Rally stage: sunburst, bunting, a sea of silhouetted heads. */
  bg.rally = function (g, t) {
    g.fillStyle = grad(g, 0, H, '#2a1854', '#0b1533');
    g.fillRect(0, 0, W, H);
    d.sunburst(g, W / 2, H * 0.32, 900, 24, t * 0.12, 'rgba(255,153,51,.16)', 'rgba(255,255,255,.05)');
    g.save();
    g.globalAlpha = 0.12;
    d.dots(g, 0, 0, W, H, 26, 2.2, C.white);
    g.restore();
    // crowd
    for (let row = 0; row < 3; row++) {
      const y = H - 40 + row * 26;
      const sc = 1 + row * 0.28;
      g.fillStyle = `rgba(6,10,26,${0.55 + row * 0.18})`;
      for (let i = -1; i < 26 / sc; i++) {
        const x = i * 46 * sc + Math.sin(t * 1.4 + i + row) * 5;
        d.circle(g, x, y - 16 * sc, 15 * sc, null);
        g.fill();
        d.rr(g, x - 20 * sc, y - 6 * sc, 40 * sc, 60 * sc, 14 * sc);
        g.fill();
      }
    }
    d.bunting(g, 70, W, t); // kept below the HUD strip
  };

  /* Daytime street: sky, buildings, footpath. */
  bg.street = function (g, t) {
    g.fillStyle = grad(g, 0, H * 0.7, '#8fd0f2', '#e8f4ff');
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = 0.85;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 260 + t * 8) % (W + 300)) - 150;
      MM.art.cloud(g, x, 70 + (i % 3) * 40, 0.8, 0.85);
    }
    g.restore();
    // skyline
    for (let i = 0; i < 10; i++) {
      const bw = 90 + MM.hash(i * 5.5) * 70;
      const bh = 130 + MM.hash(i * 9.1) * 190;
      const x = i * 104 - 20;
      g.fillStyle = i % 2 ? '#9fb0c6' : '#8b9db6';
      g.fillRect(x, H - 190 - bh, bw, bh);
      g.fillStyle = 'rgba(255,255,255,.35)';
      for (let wy = 0; wy < bh - 30; wy += 34)
        for (let wx = 0; wx < bw - 24; wx += 30) g.fillRect(x + 12 + wx, H - 190 - bh + 18 + wy, 16, 20);
    }
    g.fillStyle = '#c8ccd4';
    g.fillRect(0, H - 190, W, 60);
    g.fillStyle = '#6b7280';
    g.fillRect(0, H - 132, W, 132);
    g.fillStyle = 'rgba(255,255,255,.5)';
    for (let x = -60; x < W; x += 140) g.fillRect(x + ((t * 40) % 140), H - 70, 70, 8);
  };

  /* Golden-hour ground with a giant halftone sun — used by chai/pakoda rounds. */
  bg.golden = function (g, t) {
    g.fillStyle = grad(g, 0, H, '#ffb457', '#ff6b4a');
    g.fillRect(0, 0, W, H);
    d.sunburst(g, W / 2, H * 0.42, 820, 28, -t * 0.1, 'rgba(255,255,255,.13)', 'rgba(255,255,255,0)');
    g.save();
    g.globalAlpha = 0.1;
    d.dots(g, 0, 0, W, H, 22, 2.6, '#5b1f28');
    g.restore();
    g.fillStyle = '#5c3218';
    g.fillRect(0, H - 120, W, 120);
    g.fillStyle = '#7a4520';
    g.fillRect(0, H - 120, W, 14);
  };

  /* Night sky with stars, moon, distant balconies (9 baje, 9 minute). */
  bg.night = function (g, t) {
    g.fillStyle = grad(g, 0, H, '#0a0f2c', '#221238');
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = MM.hash(i * 3.1) * W;
      const y = MM.hash(i * 7.7) * H * 0.66;
      const a = 0.3 + Math.abs(Math.sin(t * 2 + i)) * 0.7;
      g.globalAlpha = a;
      d.circle(g, x, y, 1.4 + MM.hash(i) * 1.4, '#fff');
    }
    g.globalAlpha = 1;
    d.circle(g, W - 130, 96, 46, '#f7f0c8');
    g.save();
    g.globalAlpha = 0.18;
    d.circle(g, W - 130, 96, 78, '#f7f0c8');
    g.restore();
    g.fillStyle = '#120c26';
    for (let i = 0; i < 8; i++) {
      const bh = 150 + MM.hash(i * 2.7) * 160;
      g.fillRect(i * 124, H - bh, 112, bh);
    }
    g.fillStyle = 'rgba(255,196,84,.5)';
    for (let i = 0; i < 8; i++)
      for (let k = 0; k < 3; k++) if (MM.hash(i * 3 + k * 11) > 0.55) g.fillRect(i * 124 + 20 + k * 30, H - 120 + 40, 18, 24);
  };

  /* Blue sky at altitude — cloud/radar round. */
  bg.sky = function (g, t) {
    g.fillStyle = grad(g, 0, H, '#1a5fa8', '#8ed0f0');
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = 0.35;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 190 - t * 30) % (W + 420)) - 210;
      MM.art.cloud(g, x, 60 + ((i * 83) % 400), 1.3, 0.5);
    }
    g.restore();
  };

  /* Studio / hall interior for quiz + radio rounds. */
  bg.hall = function (g, t) {
    g.fillStyle = grad(g, 0, H, '#2b1c3f', '#140d22');
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = 0.5;
    const spot = g.createRadialGradient(W / 2, H * 0.2, 40, W / 2, H * 0.2, 620);
    spot.addColorStop(0, 'rgba(255,220,150,.55)');
    spot.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = spot;
    g.fillRect(0, 0, W, H);
    g.restore();
    // curtain folds
    g.save();
    g.globalAlpha = 0.5;
    for (let x = 0; x < W; x += 56) {
      g.fillStyle = x % 112 ? 'rgba(120,20,50,.55)' : 'rgba(90,12,38,.55)';
      g.fillRect(x, 0, 56, H * 0.62);
    }
    g.restore();
    g.fillStyle = '#3a2b1c';
    g.fillRect(0, H - 130, W, 130);
    g.fillStyle = 'rgba(255,255,255,.05)';
    g.fillRect(0, H - 130, W, 8);
  };

  /* Yoga sunrise: gradient + big sun + water reflection. */
  bg.sunrise = function (g, t) {
    g.fillStyle = grad(g, 0, H, '#3b2a63', '#ffb06a');
    g.fillRect(0, 0, W, H);
    d.circle(g, W / 2, H * 0.52, 130, '#ffe08a');
    g.save();
    g.globalAlpha = 0.25;
    d.circle(g, W / 2, H * 0.52, 190, '#ffe08a');
    g.restore();
    g.fillStyle = 'rgba(20,30,70,.55)';
    g.fillRect(0, H * 0.62, W, H);
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = '#ffe08a';
    for (let i = 0; i < 16; i++) {
      const y = H * 0.63 + i * 12;
      const w = 120 - i * 4 + Math.sin(t * 2 + i) * 16;
      g.fillRect(W / 2 - w / 2, y, w, 5);
    }
    g.restore();
  };

  /* Long road stretching to the horizon — Achhe Din run. */
  bg.road = function (g, t, scroll) {
    g.fillStyle = grad(g, 0, H * 0.6, '#ffd08a', '#ffeccd');
    g.fillRect(0, 0, W, H * 0.6);
    d.sunburst(g, W / 2, H * 0.55, 620, 20, t * 0.08, 'rgba(255,153,51,.22)', 'rgba(255,255,255,0)');
    g.fillStyle = '#7fae4a';
    g.fillRect(0, H * 0.56, W, H);
    g.fillStyle = '#4c4c58';
    g.fillRect(0, H - 190, W, 190);
    g.fillStyle = '#3d3d48';
    g.fillRect(0, H - 190, W, 10);
    g.fillStyle = 'rgba(255,255,255,.75)';
    const off = (scroll || 0) % 180;
    for (let x = -180; x < W + 180; x += 180) g.fillRect(x - off, H - 108, 96, 9);
    // roadside poles
    g.fillStyle = '#5b5b66';
    for (let x = -240; x < W + 240; x += 240) {
      const px = x - ((scroll || 0) * 0.6) % 240;
      g.fillRect(px, H - 300, 9, 112);
    }
  };

  /* Bank / ATM queue interior. */
  bg.bank = function (g, t) {
    g.fillStyle = grad(g, 0, H, '#dfe7f0', '#aebccd');
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#c3cedd';
    g.fillRect(0, 76, W, 58);
    MM.d.text(g, 'BANK OF ACHHE DIN', W / 2, 105, { size: 30, fill: '#41506b', stroke: 'rgba(255,255,255,.7)', lw: 5 });
    // tiled floor with perspective-ish stripes
    g.fillStyle = '#8f9db1';
    g.fillRect(0, H - 150, W, 150);
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 12; i++) {
      g.beginPath();
      g.moveTo(i * 80, H - 150);
      g.lineTo(i * 100 - 100, H);
      g.stroke();
    }
    // queue silhouettes
    g.fillStyle = 'rgba(40,50,70,.35)';
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 100;
      const bobY = Math.sin(t * 1.2 + i) * 3;
      d.circle(g, x, H - 220 + bobY, 18, null);
      g.fill();
      d.rr(g, x - 24, H - 200 + bobY, 48, 74, 16);
      g.fill();
    }
  };
})(window.MM);
