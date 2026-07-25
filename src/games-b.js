/* MITRON MAYHEM — microgames, part 2. Same contract as part 1. */
(function (MM) {
  'use strict';

  const C = MM.C;
  const d = MM.d;
  const art = MM.art;
  const W = MM.W;
  const H = MM.H;

  /* ================================================================ 8. TAALI */
  MM.reg({
    id: 'taali',
    cmd: 'TAALI BAJAO!',
    sub: 'Hit every beat on the line',
    time: 10,
    scene: 'night',
    card: 'taali',
    init(a) {
      const n = 4 + Math.min(3, Math.floor(a.level / 2));
      const notes = [];
      const gap = 0.78 / Math.min(1.7, a.speed);
      for (let i = 0; i < n; i++) notes.push({ t: 1.5 + i * gap, hit: false, missed: false });
      a.st = { notes, need: n, hits: 0, win: Math.max(0.13, 0.2 - a.level * 0.012), lineX: 250, thump: 0 };
    },
    update(dt, a) {
      const s = a.st;
      s.thump = Math.max(0, s.thump - dt * 4);
      if (a.in.hit('action')) {
        let best = null;
        s.notes.forEach((n) => {
          if (n.hit || n.missed) return;
          const err = Math.abs(n.t - a.t);
          if (err < s.win && (!best || err < Math.abs(best.t - a.t))) best = n;
        });
        if (best) {
          best.hit = true;
          s.hits++;
          s.thump = 1;
          a.sfx('tabla');
          const perfect = Math.abs(best.t - a.t) < s.win * 0.35;
          a.pop(perfect ? 'PERFECT!' : 'TAALI!', s.lineX, 250, { c: perfect ? C.gold : C.white, size: perfect ? 40 : 30 });
          if (perfect) a.bonus(80);
          MM.fx.burst(s.lineX, 330, 16, [C.gold, C.white, C.saffron], { shape: 'star' });
          a.shake(6);
          if (s.hits >= s.need) return a.win('Poora mohalla goonj utha!');
        } else {
          a.sfx('bad');
          a.shake(9);
          return a.lose('Beat se bahar, ustad.');
        }
      }
      for (const n of s.notes) {
        if (!n.hit && !n.missed && a.t > n.t + s.win) {
          n.missed = true;
          a.sfx('bad');
          a.shake(11);
          return a.lose('Beat miss ho gayi!');
        }
      }
    },
    draw(g, a) {
      const s = a.st;
      const pps = 260; // pixels per second of travel
      // track
      d.fillRR(g, 0, 300, W, 74, 0, 'rgba(255,255,255,.08)');
      g.strokeStyle = C.gold;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(s.lineX, 280);
      g.lineTo(s.lineX, 394);
      g.stroke();
      g.save();
      g.globalAlpha = 0.35 + s.thump * 0.5;
      d.circle(g, s.lineX, 337, 52 + s.thump * 26, C.gold);
      g.restore();

      s.notes.forEach((n) => {
        const x = s.lineX + (n.t - a.t) * pps;
        if (x < -80 || x > W + 80) return;
        g.save();
        if (n.hit) {
          g.globalAlpha = 0.25;
          g.translate(x, 337);
          g.scale(1.4, 1.4);
        } else g.translate(x, 337);
        art.thali(g, 0, 0, 0.95, false);
        g.restore();
      });

      art.modi(g, W - 190, H - 14, 0.9, {
        t: a.t,
        arms: s.thump > 0.3 ? 'hug' : 'up',
        hugT: 1,
        mouth: 'grin',
        eyes: s.thump > 0.3 ? 'closed' : 'open',
      });
      d.text(g, `${s.hits} / ${s.need}`, W / 2, 128, { size: 30, fill: C.white, stroke: C.ink, lw: 6 });
      d.text(g, '9 baje, 9 minute — thali bajao!', W / 2, 462, { size: 22, fill: C.gold, stroke: C.ink, lw: 5 });
    },
  });

  /* =============================================================== 9. SELFIE */
  MM.reg({
    id: 'selfie',
    cmd: 'SELFIE!',
    sub: 'Frame TWO leaders, then snap',
    time: 11,
    scene: 'rally',
    card: 'selfie',
    init(a) {
      const guys = [];
      const n = 3;
      for (let i = 0; i < n; i++)
        guys.push({
          who: (MM.randInt(0, 90) + i) % art.LEADERS.length,
          x: MM.rand(200, W - 160),
          y: MM.rand(230, H - 160),
          vx: MM.rand(-1, 1) * 120 * a.speed,
          vy: MM.rand(-1, 1) * 90 * a.speed,
        });
      a.st = { guys, fx: W / 2, fy: H / 2, need: 2, got: 0, snaps: 4, flash: 0, cool: 0 };
    },
    update(dt, a) {
      const s = a.st;
      s.flash = Math.max(0, s.flash - dt * 4);
      s.cool = Math.max(0, s.cool - dt);
      const sp = 560;
      if (a.in.down('left')) s.fx -= sp * dt;
      if (a.in.down('right')) s.fx += sp * dt;
      if (a.in.down('up')) s.fy -= sp * dt;
      if (a.in.down('down')) s.fy += sp * dt;
      if (a.in.p.moved) {
        s.fx = a.in.p.x;
        s.fy = a.in.p.y;
      }
      s.fx = MM.clamp(s.fx, 170, W - 170);
      s.fy = MM.clamp(s.fy, 200, H - 176);

      s.guys.forEach((q) => {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.x < 170 || q.x > W - 90) q.vx *= -1;
        if (q.y < 220 || q.y > H - 120) q.vy *= -1;
        q.x = MM.clamp(q.x, 170, W - 90);
        q.y = MM.clamp(q.y, 220, H - 120);
      });

      const inFrame = s.guys.filter((q) => Math.abs(q.x - s.fx) < 150 && Math.abs(q.y - 152 - s.fy) < 116).length;
      s.inFrame = inFrame;

      if ((a.in.hit('action') || a.in.pHit()) && s.cool <= 0) {
        s.cool = 0.28;
        if (inFrame >= 2) {
          s.got++;
          s.flash = 1;
          a.sfx('camera');
          a.flash('#ffffff');
          a.pop('CLICK!', s.fx, s.fy - 120, { c: C.white, size: 40 });
          MM.fx.burst(s.fx, s.fy, 20, [C.white, C.cyan, C.gold], { shape: 'star' });
          if (s.got >= s.need) return a.win('Viral selfie diplomacy!');
        } else {
          s.snaps--;
          a.sfx('bad');
          a.shake(8);
          a.pop('BLURRY!', s.fx, s.fy - 120, { c: C.danger, size: 30 });
          if (s.snaps <= 0) return a.lose('Phone ki memory full!');
        }
      }
    },
    draw(g, a) {
      const s = a.st;
      s.guys.forEach((q) => {
        const inside = Math.abs(q.x - s.fx) < 150 && Math.abs(q.y - 152 - s.fy) < 116;
        if (inside) {
          g.save();
          g.globalAlpha = 0.35;
          d.circle(g, q.x, q.y - 88, 84, 'rgba(120,255,140,.5)');
          g.restore();
        }
        art.leader(g, q.x, q.y, 0.66, q.who, { t: a.t, label: false });
      });
      // the selfie frame, with our man wedged into the corner
      const ok = s.inFrame >= 2;
      g.save();
      g.strokeStyle = ok ? C.green : C.white;
      g.lineWidth = 6;
      d.rr(g, s.fx - 150, s.fy - 116, 300, 232, 16);
      g.stroke();
      g.setLineDash([12, 10]);
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.lineWidth = 2;
      d.rr(g, s.fx - 138, s.fy - 104, 276, 208, 12);
      g.stroke();
      g.setLineDash([]);
      d.fillRR(g, s.fx - 150, s.fy - 152, 152, 34, 8, ok ? C.green : 'rgba(0,0,0,.6)');
      d.text(g, ok ? 'PERFECT FRAME' : `IN FRAME: ${s.inFrame}`, s.fx - 74, s.fy - 135, { size: 17, fill: C.white });
      g.restore();
      art.modi(g, s.fx - 100, s.fy + 116, 0.44, { t: a.t, mouth: 'grin', arms: 'up', eyes: 'wink' });
      if (s.flash > 0) {
        g.save();
        g.globalAlpha = s.flash * 0.6;
        g.fillStyle = '#fff';
        g.fillRect(0, 0, W, H);
        g.restore();
      }
      d.text(g, `GOOD SNAPS ${s.got}/${s.need}   •   TRIES LEFT ${s.snaps}`, W / 2, 128, {
        size: 24,
        fill: C.white,
        stroke: C.ink,
        lw: 6,
      });
    },
  });

  /* ============================================== 10. ENTIRE POLITICAL SCIENCE */
  const QUIZ = [
    { q: 'Complete the legendary degree:', o: ['Entire Political Science', 'Partial Political Science', 'Semi Political Art', 'Full Stack Politics'], c: 0 },
    { q: 'How do you open a speech?', o: ['Hello everybody', 'Mitron!', 'Yo yo listeners', 'Ahem ahem'], c: 1 },
    { q: 'Good days are…', o: ['Cancelled', 'Aane waale hain', 'Already gone', 'Under GST'], c: 1 },
    { q: 'Best defence against radar?', o: ['Stealth coating', 'Baadal (clouds)', 'Turning it off', 'A strong WiFi'], c: 1 },
    { q: 'Monthly radio programme?', o: ['Mann Ki Baat', 'Kaan Ki Baat', 'Mic Testing 1 2 3', 'Podcast Pe Charcha'], c: 0 },
    { q: 'Chest measurement of legend?', o: ['36 inch', '42 inch', '56 inch', '100 inch'], c: 2 },
    { q: 'Unemployed? Then…', o: ['Sell pakodas', 'Sell NFTs', 'Sell your kidney', 'Sell the pakoda shop'], c: 0 },
    { q: 'At 8 PM on TV, expect…', o: ['A movie', 'An announcement', 'Cricket', 'Weather'], c: 1 },
    { q: 'Vocal for…', o: ['Karaoke', 'Local', 'Vocal', 'Yodel'], c: 1 },
    { q: 'Correct greeting for a world leader?', o: ['Namaste + jhappi', 'Fist bump only', 'Just nod', 'High five'], c: 0 },
  ];
  MM.reg({
    id: 'degree',
    cmd: 'PARIKSHA!',
    sub: 'Pick the correct meme answer',
    time: 9,
    scene: 'hall',
    card: 'degree',
    init(a) {
      const qs = MM.shuffle(QUIZ).slice(0, a.level >= 3 ? 2 : 1);
      a.st = { qs, at: 0, sel: 0, done: 0, flashT: 0 };
    },
    update(dt, a) {
      const s = a.st;
      if (s.flashT > 0) {
        s.flashT -= dt;
        if (s.flashT <= 0) {
          s.at++;
          s.sel = 0;
          if (s.at >= s.qs.length) return a.win('Full marks, vidyarthi!');
        }
        return;
      }
      const q = s.qs[s.at];
      if (a.in.hit('up') || a.in.hit('left')) {
        s.sel = (s.sel + 3) % 4;
        a.sfx('move');
      }
      if (a.in.hit('down') || a.in.hit('right')) {
        s.sel = (s.sel + 1) % 4;
        a.sfx('move');
      }
      for (let i = 0; i < 4; i++) if (a.in.hit('num' + (i + 1))) s.sel = i;
      // click an option directly
      if (a.in.pHit()) {
        for (let i = 0; i < 4; i++) {
          const y = 244 + i * 72;
          if (a.in.p.y > y - 30 && a.in.p.y < y + 30 && Math.abs(a.in.p.x - W / 2) < 330) {
            s.sel = i;
            submit();
            return;
          }
        }
      }
      if (a.in.hit('action')) submit();

      function submit() {
        if (s.sel === q.c) {
          a.sfx('good');
          MM.fx.burst(W / 2, 244 + s.sel * 72, 22, [C.gold, C.green, C.white], { shape: 'star' });
          a.pop('SAHI JAWAB!', W / 2, 190, { c: C.gold, size: 36 });
          s.flashT = 0.5;
        } else {
          a.sfx('bad');
          a.shake(14);
          a.lose('Copy karte pakde gaye!');
        }
      }
    },
    draw(g, a) {
      const s = a.st;
      const q = s.qs[Math.min(s.at, s.qs.length - 1)];
      art.modi(g, 96, H - 4, 0.5, { t: a.t, mouth: 'talk', arms: 'point', eyes: 'open' });
      d.fillRR(g, W / 2 - 360, 140, 720, 76, 14, 'rgba(255,255,255,.94)');
      d.text(g, q.q, W / 2, 178, { size: 28, fill: C.ink });
      q.o.forEach((opt, i) => {
        const y = 244 + i * 72;
        const on = i === s.sel;
        d.fillRR(g, W / 2 - 320, y - 30, 640, 60, 12, on ? C.saffron : 'rgba(6,10,26,.72)');
        d.strokeRR(g, W / 2 - 320, y - 30, 640, 60, 12, on ? C.white : 'rgba(255,255,255,.35)', on ? 4 : 2);
        d.text(g, `${i + 1}.  ${opt}`, W / 2 - 292, y, {
          size: 25,
          align: 'left',
          fill: on ? C.ink : C.white,
        });
      });
      d.text(g, `Q ${Math.min(s.at + 1, s.qs.length)} / ${s.qs.length}  •  arrows + SPACE, keys 1-4, or click`, W / 2, H - 40, {
        size: 18,
        fill: C.white,
        stroke: C.ink,
        lw: 4,
      });
    },
  });

  /* ============================================================== 11. PAKODA */
  MM.reg({
    id: 'pakoda',
    cmd: 'PAKODA!',
    sub: 'Scoop each one out when GOLDEN',
    time: 12,
    scene: 'golden',
    card: 'pakoda',
    init(a) {
      const n = 3;
      const p = [];
      for (let i = 0; i < n; i++)
        p.push({
          cook: -MM.rand(0, 0.55),
          rate: MM.rand(0.3, 0.45) * a.speed,
          done: false,
          x: W / 2 + (i - 1) * 200,
          y: 424,
          pop: 0,
        });
      a.st = { p, need: n, served: 0 };
    },
    update(dt, a) {
      const s = a.st;
      let clickIdx = -1;
      if (a.in.pHit()) {
        s.p.forEach((q, i) => {
          if (!q.done && MM.dist(a.in.p.x, a.in.p.y, q.x, q.y) < 90) clickIdx = i;
        });
      }
      for (let i = 0; i < 3; i++) if (a.in.hit('num' + (i + 1))) clickIdx = i;
      if (a.in.hit('action')) {
        // grab the most-cooked live pakoda — one-button friendly
        let best = -1;
        s.p.forEach((q, i) => {
          if (!q.done && q.cook > 0 && (best < 0 || q.cook > s.p[best].cook)) best = i;
        });
        clickIdx = best;
      }

      s.p.forEach((q, i) => {
        if (q.done) {
          q.pop += dt * 3;
          return;
        }
        q.cook += q.rate * dt;
        if (q.cook > 1.34) {
          a.sfx('bad');
          a.shake(16);
          a.flash('#3a1a10');
          return a.lose('Pakoda jal gaya! Economy down.');
        }
        if (i === clickIdx) {
          if (q.cook >= 0.72 && q.cook <= 1.16) {
            q.done = true;
            s.served++;
            const perfect = Math.abs(q.cook - 0.94) < 0.1;
            a.sfx(perfect ? 'coin' : 'good');
            a.pop(perfect ? 'CRISPY!' : 'SERVED!', q.x, q.y - 70, { c: perfect ? C.gold : C.white, size: perfect ? 36 : 28 });
            if (perfect) a.bonus(120);
            MM.fx.burst(q.x, q.y, 16, [C.gold, '#f0c46a', '#e0a44a'], { shape: 'star' });
            if (s.served >= s.need) return a.win('Pakoda economy booming!');
          } else {
            a.sfx('bad');
            a.shake(10);
            return a.lose(q.cook < 0.72 ? 'Kaccha pakoda! Chhi.' : 'Bahut der kar di.');
          }
        }
      });
    },
    draw(g, a) {
      const s = a.st;
      art.kadhai(g, W / 2, 446, 1.35, a.t);
      s.p.forEach((q, i) => {
        if (q.done) {
          if (q.pop > 1.4) return;
          g.save();
          g.globalAlpha = Math.max(0, 1 - q.pop * 0.7);
          art.pakoda(g, q.x, q.y - q.pop * 150, 1.6 + q.pop * 0.3, 0.95);
          g.restore();
          return;
        }
        const c = MM.clamp(q.cook, 0, 1.4);
        art.pakoda(g, q.x, q.y + Math.sin(a.t * 5 + i) * 5, 1.9, c);
        // doneness meter
        const bx = q.x - 60;
        d.fillRR(g, bx, q.y + 78, 120, 16, 8, 'rgba(0,0,0,.5)');
        d.fillRR(g, bx + 120 * (0.72 / 1.34), q.y + 78, 120 * ((1.16 - 0.72) / 1.34), 16, 0, 'rgba(120,255,140,.65)');
        d.fillRR(g, bx, q.y + 78, MM.clamp(120 * (c / 1.34), 0, 120), 16, 8, c > 1.16 ? C.danger : C.gold);
        d.text(g, String(i + 1), q.x, q.y - 74, { size: 26, fill: C.white, stroke: C.ink, lw: 5 });
      });
      art.modi(g, 112, H - 8, 0.55, { t: a.t, mouth: 'grin', arms: 'point', eyes: 'open' });
      d.text(g, `SERVED ${s.served} / ${s.need}`, W / 2, 128, { size: 28, fill: C.white, stroke: '#7a3010', lw: 6 });
      d.text(g, 'click a pakoda, press 1-3, or SPACE for the ripest', W / 2, 170, { size: 18, fill: C.white, stroke: '#7a3010', lw: 4 });
    },
  });

  /* ============================================================ 12. ACHHE DIN */
  MM.reg({
    id: 'achhedin',
    cmd: 'ACHHE DIN!',
    sub: 'Jump the gaddhas, reach the sign',
    time: 13,
    scene: 'road',
    card: 'achhedin',
    init(a) {
      const dist = 2000 + a.level * 130;
      const obs = [];
      let x = 700;
      while (x < dist - 200) {
        obs.push({ x, k: Math.random() < 0.55 ? 'hole' : 'hurdle' });
        x += MM.rand(340, 520) / Math.min(1.5, a.speed);
      }
      a.st = { scroll: 0, dist, v: 300 * a.speed, y: 0, vy: 0, jumping: false, obs, ground: H - 118 };
    },
    update(dt, a) {
      const s = a.st;
      s.scroll += s.v * dt;
      if ((a.in.hit('action') || a.in.hit('up')) && !s.jumping) {
        s.jumping = true;
        s.vy = -640;
        a.sfx('whoosh');
      }
      if (s.jumping) {
        s.vy += 1750 * dt;
        s.y += s.vy * dt;
        if (s.y >= 0) {
          s.y = 0;
          s.vy = 0;
          s.jumping = false;
          MM.fx.burst(260, s.ground, 8, [C.dust, '#b8a98f'], { g: 300, spMax: 140, lifeMax: 0.4 });
          a.sfx('move');
        }
      }
      const px = 260 + s.scroll;
      for (const o of s.obs) {
        if (o.cleared) continue;
        if (Math.abs(o.x - px) < 46) {
          if (s.y > -60) {
            a.sfx('bad');
            a.shake(18);
            a.flash(C.danger);
            return a.lose(o.k === 'hole' ? 'Gaddhe mein gir gaye!' : 'GST se takra gaye!');
          }
          o.cleared = true;
          a.bonus(40);
          a.pop('NICE!', W / 2, 300, { c: C.gold, size: 26 });
        }
      }
      if (s.scroll >= s.dist) return a.win('ACHHE DIN AA GAYE!');
    },
    draw(g, a) {
      const s = a.st;
      const px = 260 + s.scroll;
      // obstacles
      s.obs.forEach((o) => {
        const x = o.x - s.scroll;
        if (x < -120 || x > W + 160) return;
        if (o.k === 'hole') {
          g.fillStyle = '#20202a';
          g.beginPath();
          g.ellipse(x, s.ground + 6, 44, 17, 0, 0, MM.TAU);
          g.fill();
          g.fillStyle = '#3a3a46';
          g.beginPath();
          g.ellipse(x, s.ground + 2, 46, 15, 0, 0, MM.TAU);
          g.fill();
          d.text(g, 'GADDHA', x, s.ground + 40, { size: 14, fill: 'rgba(255,255,255,.6)' });
        } else {
          d.fillRR(g, x - 26, s.ground - 66, 52, 66, 8, '#c0392b');
          d.text(g, 'GST', x, s.ground - 34, { size: 22, fill: C.white, stroke: C.ink, lw: 5 });
        }
      });
      // the goal
      const gx = s.dist - s.scroll + 260;
      if (gx < W + 300) {
        d.fillRR(g, gx - 8, s.ground - 250, 16, 250, 4, '#6b5a3a');
        d.fillRR(g, gx - 150, s.ground - 330, 300, 92, 14, C.saffron);
        d.strokeRR(g, gx - 150, s.ground - 330, 300, 92, 14, C.white, 5);
        d.text(g, 'ACHHE DIN', gx, s.ground - 284, { size: 34, fill: C.ink });
      }
      // runner
      art.modi(g, 260, s.ground + 26 + s.y, 0.7, {
        t: s.scroll * 0.02,
        mouth: s.jumping ? 'o' : 'grin',
        arms: s.jumping ? 'up' : 'run',
        eyes: 'open',
        tilt: s.jumping ? -0.12 : 0.06,
        legs: s.jumping ? 'stand' : 'run',
      });
      // progress bar
      const p = MM.clamp(s.scroll / s.dist, 0, 1);
      d.fillRR(g, W / 2 - 250, 124, 500, 24, 12, 'rgba(0,0,0,.45)');
      d.fillRR(g, W / 2 - 250, 124, 500 * p, 24, 12, C.green);
      d.text(g, `${Math.round(p * 100)}% to ACHHE DIN`, W / 2, 136, { size: 17, fill: C.white, stroke: C.ink, lw: 4 });
      d.text(g, 'SPACE / UP / TAP to jump', W / 2, 176, { size: 20, fill: C.ink, stroke: 'rgba(255,255,255,.7)', lw: 5 });
    },
  });

  /* ================================================================ 13. DIYA */
  MM.reg({
    id: 'diya',
    cmd: '9 BAJE!',
    sub: 'Light every diya at once — mind the wind',
    time: 12,
    scene: 'night',
    card: 'diya',
    init(a) {
      const n = 5 + Math.min(4, a.level);
      const rows = n > 7 ? 2 : 1;
      const diyas = [];
      for (let i = 0; i < n; i++) {
        const per = Math.ceil(n / rows);
        const r = Math.floor(i / per);
        const c = i % per;
        const cnt = Math.min(per, n - r * per);
        diyas.push({ x: W / 2 - ((cnt - 1) * 126) / 2 + c * 126, y: 336 + r * 132, lit: false });
      }
      a.st = { diyas, cur: 0, gust: 2.2 / a.speed, gustT: 2.2 / a.speed, wind: 0 };
    },
    update(dt, a) {
      const s = a.st;
      s.wind = Math.max(0, s.wind - dt * 2);
      if (a.in.hit('left')) {
        s.cur = (s.cur + s.diyas.length - 1) % s.diyas.length;
        a.sfx('move');
      }
      if (a.in.hit('right')) {
        s.cur = (s.cur + 1) % s.diyas.length;
        a.sfx('move');
      }
      if (a.in.p.moved || a.in.p.down) {
        let best = s.cur;
        let bd = 1e9;
        s.diyas.forEach((q, i) => {
          const dd = MM.dist(a.in.p.x, a.in.p.y, q.x, q.y);
          if (dd < bd) {
            bd = dd;
            best = i;
          }
        });
        if (bd < 120) s.cur = best;
      }
      const light = a.in.hit('action') || a.in.pHit();
      if (light) {
        const q = s.diyas[s.cur];
        if (!q.lit) {
          q.lit = true;
          a.sfx('coin');
          MM.fx.burst(q.x, q.y - 20, 12, [C.gold, '#ffd9a0'], { g: -60, spMax: 130, lifeMax: 0.7 });
          MM.fx.ripple(q.x, q.y - 20, 'rgba(255,200,110,.8)');
        }
        if (s.diyas.every((z) => z.lit)) {
          MM.fx.confetti(70);
          return a.win('Poora desh jag magaya!');
        }
      }
      // wind blows a random lit diya out
      s.gustT -= dt;
      if (s.gustT <= 0) {
        s.gustT = MM.rand(1.4, 2.4) / a.speed;
        const lit = s.diyas.filter((z) => z.lit);
        if (lit.length) {
          const v = MM.pick(lit);
          v.lit = false;
          s.wind = 1;
          a.sfx('whoosh');
          a.pop('HAWA!', v.x, v.y - 60, { c: C.cyan, size: 26 });
        }
      }
    },
    draw(g, a) {
      const s = a.st;
      const litCount = s.diyas.filter((z) => z.lit).length;
      // ambient glow from the lit diyas
      g.save();
      g.globalAlpha = 0.06 * litCount;
      g.fillStyle = '#ffb85c';
      g.fillRect(0, 0, W, H);
      g.restore();
      s.diyas.forEach((q, i) => {
        if (i === s.cur) {
          g.save();
          g.globalAlpha = 0.6 + Math.sin(a.t * 8) * 0.25;
          d.strokeRR(g, q.x - 46, q.y - 56, 92, 86, 12, C.cyan, 4);
          g.restore();
        }
        art.diya(g, q.x, q.y, 1.5, q.lit, a.t + i);
      });
      if (s.wind > 0) {
        g.save();
        g.globalAlpha = s.wind * 0.5;
        g.strokeStyle = C.cyan;
        g.lineWidth = 4;
        for (let i = 0; i < 5; i++) {
          const y = 200 + i * 70;
          g.beginPath();
          g.moveTo(0, y);
          g.quadraticCurveTo(W / 2, y - 40 + i * 12, W, y + 20);
          g.stroke();
        }
        g.restore();
      }
      art.modi(g, 108, H - 6, 0.5, { t: a.t, arms: 'namaste', eyes: 'closed', mouth: 'smile' });
      d.text(g, `DIYE JALE: ${litCount} / ${s.diyas.length}`, W / 2, 128, { size: 28, fill: C.gold, stroke: C.ink, lw: 6 });
      d.text(g, 'click/arrows to choose • SPACE to light', W / 2, H - 46, { size: 19, fill: C.white, stroke: C.ink, lw: 5 });
    },
  });

  /* ======================================================== 14. MANN KI BAAT */
  MM.reg({
    id: 'mannkibaat',
    cmd: 'MANN KI BAAT!',
    sub: 'Tune the dial and hold it steady',
    time: 12,
    scene: 'hall',
    card: 'mannkibaat',
    init(a) {
      a.st = {
        dial: MM.rand(0.05, 0.95),
        target: MM.rand(0.2, 0.8),
        band: Math.max(0.05, 0.1 - a.level * 0.007),
        hold: 0,
        needHold: 1.5,
        drift: MM.rand(-1, 1),
      };
    },
    update(dt, a) {
      const s = a.st;
      const sp = 0.55;
      if (a.in.down('left')) s.dial -= sp * dt;
      if (a.in.down('right')) s.dial += sp * dt;
      if (a.in.p.down) s.dial = MM.clamp((a.in.p.x - (W / 2 - 220)) / 440, 0, 1);
      // radio interference nudges the dial around
      s.drift += MM.rand(-1, 1) * dt * 4;
      s.drift = MM.clamp(s.drift, -1, 1);
      s.dial = MM.clamp(s.dial + s.drift * 0.055 * dt * a.speed, 0, 1);

      const err = Math.abs(s.dial - s.target);
      s.locked = err <= s.band;
      if (s.locked) {
        s.hold += dt;
        if (Math.random() < dt * 20) MM.fx.burst(W / 2, 250, 1, [C.green, C.gold], { g: -120, spMax: 90, rMax: 4 });
        if (s.hold >= s.needHold) return a.win('Poore desh ne suna!');
      } else {
        s.hold = Math.max(0, s.hold - dt * 0.7);
      }
    },
    draw(g, a) {
      const s = a.st;
      // static / signal visualisation
      const err = Math.abs(s.dial - s.target);
      const noise = MM.clamp(err / 0.4, 0, 1);
      g.save();
      g.globalAlpha = 0.25 + noise * 0.5;
      for (let i = 0; i < 60; i++) {
        g.fillStyle = Math.random() < 0.5 ? '#fff' : '#888';
        g.fillRect(MM.rand(W / 2 - 300, W / 2 + 300), MM.rand(160, 300), MM.rand(3, 26), 3);
      }
      g.restore();
      // waveform when locked in
      g.strokeStyle = s.locked ? C.green : 'rgba(255,255,255,.35)';
      g.lineWidth = 4;
      g.beginPath();
      for (let x = -300; x <= 300; x += 6) {
        const amp = s.locked ? 40 : 8 + noise * 4;
        const y = 232 + Math.sin(x * 0.05 + a.t * 8) * amp * (1 - noise * 0.6);
        x === -300 ? g.moveTo(W / 2 + x, y) : g.lineTo(W / 2 + x, y);
      }
      g.stroke();

      art.radio(g, W / 2, 400, 1, s.dial, s.locked ? a.t : 0);

      // tuning strip: target band + your needle
      const bx = W / 2 - 220;
      d.fillRR(g, bx, H - 96, 440, 30, 15, 'rgba(0,0,0,.55)');
      d.fillRR(g, bx + (s.target - s.band) * 440, H - 96, s.band * 2 * 440, 30, 8, 'rgba(120,255,140,.6)');
      const nx = bx + s.dial * 440;
      d.fillRR(g, nx - 4, H - 104, 8, 46, 4, s.locked ? C.green : C.danger);
      d.text(g, s.locked ? 'SIGNAL LOCKED — HOLD!' : 'FIND THE FREQUENCY', W / 2, H - 128, {
        size: 22,
        fill: s.locked ? C.green : C.white,
        stroke: C.ink,
        lw: 5,
      });
      // hold meter
      d.fillRR(g, W / 2 - 160, 128, 320, 22, 11, 'rgba(0,0,0,.5)');
      d.fillRR(g, W / 2 - 160, 128, 320 * MM.clamp(s.hold / s.needHold, 0, 1), 22, 11, C.gold);
      d.text(g, 'BROADCAST STRENGTH', W / 2, 139, { size: 15, fill: C.white, stroke: C.ink, lw: 4 });
      art.modi(g, 128, H - 10, 0.58, { t: a.t, mouth: 'talk', arms: 'point', eyes: 'open' });
    },
  });
})(window.MM);
