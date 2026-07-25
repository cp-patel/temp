/* MITRON MAYHEM — juice layer: particles, screen shake, hit-freeze, flashes,
   floating text pops, marigold petals, confetti. This is most of the "feel". */
(function (MM) {
  'use strict';

  const FX = (MM.fx = {});

  let parts = [];
  let pops = [];
  let shake = 0;
  let shakeDecay = 6;
  let flash = null;
  let freeze = 0;
  let petals = [];
  let ripples = [];

  FX.reset = function () {
    parts = [];
    pops = [];
    ripples = [];
    shake = 0;
    flash = null;
    freeze = 0;
  };

  FX.initPetals = function () {
    petals = [];
    for (let i = 0; i < 26; i++) {
      petals.push({
        x: MM.rand(MM.W),
        y: MM.rand(MM.H),
        r: MM.rand(4, 9),
        vy: MM.rand(14, 42),
        vx: MM.rand(-12, 12),
        a: MM.rand(MM.TAU),
        va: MM.rand(-2, 2),
        c: MM.pick([MM.C.saffron, MM.C.gold, '#ff7f2a', '#ffd9a0']),
      });
    }
  };

  FX.shake = function (amt) {
    shake = Math.max(shake, amt);
  };

  FX.freeze = function (s) {
    freeze = Math.max(freeze, s);
  };

  FX.flash = function (color, dur) {
    flash = { c: color || '#fff', t: 0, dur: dur || 0.18 };
  };

  FX.consumeFreeze = function (dt) {
    if (freeze <= 0) return dt;
    freeze -= dt;
    return 0;
  };

  FX.burst = function (x, y, n, colors, opt) {
    const o = opt || {};
    for (let i = 0; i < n; i++) {
      const a = o.dir === undefined ? MM.rand(MM.TAU) : o.dir + MM.rand(-o.spread || -0.6, o.spread || 0.6);
      const sp = MM.rand(o.spMin || 90, o.spMax || 380);
      parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: MM.rand(o.rMin || 2, o.rMax || 7),
        life: MM.rand(o.lifeMin || 0.35, o.lifeMax || 0.9),
        t: 0,
        g: o.g === undefined ? 700 : o.g,
        c: MM.pick(colors || [MM.C.saffron, MM.C.white, MM.C.green, MM.C.gold]),
        shape: o.shape || 'dot',
        rot: MM.rand(MM.TAU),
        vr: MM.rand(-8, 8),
        drag: o.drag || 0.98,
      });
    }
  };

  FX.confetti = function (n) {
    for (let i = 0; i < (n || 90); i++) {
      parts.push({
        x: MM.rand(MM.W),
        y: MM.rand(-160, -10),
        vx: MM.rand(-60, 60),
        vy: MM.rand(60, 220),
        r: MM.rand(4, 10),
        life: MM.rand(1.6, 3.4),
        t: 0,
        g: 120,
        c: MM.pick([MM.C.saffron, MM.C.white, MM.C.green, MM.C.pink, MM.C.cyan, MM.C.gold]),
        shape: 'rect',
        rot: MM.rand(MM.TAU),
        vr: MM.rand(-10, 10),
        drag: 0.995,
      });
    }
  };

  FX.ripple = function (x, y, color) {
    ripples.push({ x, y, t: 0, c: color || MM.C.white });
  };

  /* Floating score / hype text. */
  FX.pop = function (text, x, y, opt) {
    const o = opt || {};
    pops.push({
      text,
      x,
      y,
      t: 0,
      dur: o.dur || 0.9,
      size: o.size || 34,
      c: o.c || MM.C.gold,
      stroke: o.stroke || MM.C.ink,
      vy: o.vy === undefined ? -70 : o.vy,
      rot: o.rot || 0,
      scale: o.scale || 1,
    });
  };

  FX.update = function (dt) {
    shake = Math.max(0, shake - shake * shakeDecay * dt - 8 * dt);

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) {
        parts.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }

    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt;
      p.y += p.vy * dt;
      if (p.t >= p.dur) pops.splice(i, 1);
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].t += dt;
      if (ripples[i].t > 0.6) ripples.splice(i, 1);
    }

    if (flash) {
      flash.t += dt;
      if (flash.t >= flash.dur) flash = null;
    }

    for (const p of petals) {
      p.y += p.vy * dt;
      p.x += p.vx * dt + Math.sin(p.y * 0.02) * 12 * dt;
      p.a += p.va * dt;
      if (p.y > MM.H + 20) {
        p.y = -20;
        p.x = MM.rand(MM.W);
      }
      if (p.x < -20) p.x = MM.W + 20;
      if (p.x > MM.W + 20) p.x = -20;
    }
  };

  FX.applyShake = function (g) {
    if (shake > 0.01) {
      g.translate(MM.rand(-shake, shake), MM.rand(-shake, shake));
      g.rotate(MM.rand(-shake, shake) * 0.0012);
    }
  };

  FX.drawPetals = function (g, alpha) {
    g.save();
    g.globalAlpha = alpha === undefined ? 0.5 : alpha;
    for (const p of petals) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.a);
      g.fillStyle = p.c;
      g.beginPath();
      g.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, MM.TAU);
      g.fill();
      g.restore();
    }
    g.restore();
  };

  FX.draw = function (g) {
    for (const r of ripples) {
      const t = r.t / 0.6;
      g.save();
      g.globalAlpha = (1 - t) * 0.7;
      g.strokeStyle = r.c;
      g.lineWidth = 6 * (1 - t) + 1;
      g.beginPath();
      g.arc(r.x, r.y, 10 + t * 90, 0, MM.TAU);
      g.stroke();
      g.restore();
    }

    for (const p of parts) {
      const k = 1 - p.t / p.life;
      g.save();
      g.globalAlpha = Math.min(1, k * 1.6);
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.c;
      if (p.shape === 'rect') g.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      else if (p.shape === 'star') {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? p.r * 0.45 : p.r;
          const a = (i / 10) * MM.TAU;
          i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      } else {
        g.beginPath();
        g.arc(0, 0, p.r * (0.4 + k * 0.6), 0, MM.TAU);
        g.fill();
      }
      g.restore();
    }

    for (const p of pops) {
      const t = p.t / p.dur;
      const s = MM.ease.outBack(Math.min(1, t * 4)) * p.scale;
      g.save();
      g.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.scale(s, s);
      MM.d.text(g, p.text, 0, 0, { size: p.size, fill: p.c, stroke: p.stroke, lw: 6 });
      g.restore();
    }
  };

  FX.drawFlash = function (g) {
    if (!flash) return;
    g.save();
    g.globalAlpha = (1 - flash.t / flash.dur) * 0.75;
    g.fillStyle = flash.c;
    g.fillRect(0, 0, MM.W, MM.H);
    g.restore();
  };

  /* Subtle CRT scanlines + vignette, drawn last. Cheap, big mood payoff. */
  let vignette = null;
  FX.drawScreen = function (g, t) {
    g.save();
    g.globalAlpha = 0.06;
    g.fillStyle = '#000';
    for (let y = 0; y < MM.H; y += 3) g.fillRect(0, y, MM.W, 1);
    g.restore();

    if (!vignette) {
      vignette = g.createRadialGradient(MM.W / 2, MM.H / 2, MM.H * 0.35, MM.W / 2, MM.H / 2, MM.H * 0.92);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,.55)');
    }
    g.fillStyle = vignette;
    g.fillRect(0, 0, MM.W, MM.H);
  };
})(window.MM);
