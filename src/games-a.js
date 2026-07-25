/* MITRON MAYHEM — microgames, part 1.
   Contract (see main.js): each entry gets a round context `a` with
     a.st  scratch state      a.t     seconds elapsed in this round
     a.speed / a.level        a.frac  fraction of the clock used (0..1)
     a.win() / a.lose()       a.sfx / a.pop / a.shake / a.flash / a.in
   `time` is the base clock in seconds; the engine shortens it as speed rises. */
(function (MM) {
  'use strict';

  MM.games = [];
  MM.reg = (g) => MM.games.push(g);

  const C = MM.C;
  const d = MM.d;
  const art = MM.art;
  const W = MM.W;
  const H = MM.H;

  /* ============================================================== 1. MITRON */
  const MITRON_DECOYS = ['BHAIYON', 'BEHNON', 'DOSTON', 'SAATHIYON', 'JANATA', 'BANDHUON', 'YUVAAON'];
  MM.reg({
    id: 'mitron',
    cmd: 'MITRON!',
    sub: 'Cheer ONLY on "MITRON"',
    time: 7,
    scene: 'rally',
    card: 'mitron',
    init(a) {
      const need = a.level >= 4 ? 3 : a.level >= 2 ? 2 : 1;
      const slots = 4 + need * 2;
      const seq = [];
      for (let i = 0; i < slots; i++) seq.push(MM.pick(MITRON_DECOYS));
      // sprinkle the real thing into distinct slots, never the very first
      const spots = MM.shuffle([...Array(slots - 1).keys()].map((i) => i + 1)).slice(0, need);
      spots.forEach((s) => (seq[s] = 'MITRON'));
      a.st = { seq, i: 0, dur: 0.72 / Math.min(1.6, a.speed), hits: 0, need, judged: false, flash: 0, cheer: 0 };
    },
    update(dt, a) {
      const s = a.st;
      s.flash = Math.max(0, s.flash - dt * 3);
      s.cheer = Math.max(0, s.cheer - dt * 2);
      const word = s.seq[s.i];
      if (a.in.hit('action')) {
        if (word === 'MITRON') {
          s.hits++;
          s.cheer = 1;
          a.sfx('coin');
          a.pop('MITRON!', W / 2, 250, { c: C.gold });
          MM.fx.burst(W / 2, 300, 22, [C.saffron, C.gold, C.white], { shape: 'star' });
          a.shake(7);
          s.seq[s.i] = '✓ MITRON';
          if (s.hits >= s.need) return a.win('MITRON MAYHEM!');
        } else {
          s.flash = 1;
          a.sfx('bad');
          a.shake(12);
          return a.lose('Galat timing, mitron.');
        }
      }
      s.t = (s.t || 0) + dt;
      if (s.t >= s.dur) {
        s.t = 0;
        s.i++;
        a.sfx('move');
        if (s.i >= s.seq.length) return a.lose('Cheer hi nahi kiya!');
      }
    },
    draw(g, a) {
      const s = a.st;
      const word = s.seq[s.i] || '';
      art.modi(g, W / 2, H - 40, 1.15, {
        t: a.t,
        mouth: 'talk',
        arms: s.cheer > 0.2 ? 'up' : 'point',
        eyes: s.cheer > 0.2 ? 'closed' : 'open',
        brow: 'up',
      });
      // podium
      d.fillRR(g, W / 2 - 130, H - 120, 260, 120, 14, 'rgba(10,14,34,.85)');
      art.lotus(g, W / 2, H - 30, 0.6);
      const pulse = 1 + Math.sin(a.t * 8) * 0.03 + (word.includes('MITRON') ? 0.12 : 0);
      g.save();
      g.translate(W / 2, 236);
      g.scale(pulse, pulse);
      art.bubble(g, 0, 0, Math.max(320, d.measure(g, word, 46) + 90), 108, '', { bg: C.white });
      d.text(g, word, 0, 0, {
        size: 46,
        fill: word.includes('MITRON') ? C.saffronDeep : C.ink,
        stroke: word.includes('MITRON') ? C.ink : null,
        lw: 5,
      });
      g.restore();
      d.text(g, `CHEERS  ${s.hits} / ${s.need}`, W / 2, 132, { size: 24, fill: C.white, stroke: C.ink, lw: 6 });
      if (s.flash > 0) {
        g.save();
        g.globalAlpha = s.flash * 0.4;
        g.fillStyle = C.danger;
        g.fillRect(0, 0, W, H);
        g.restore();
      }
    },
  });

  /* ============================================================ 2. NOTEBANDI */
  MM.reg({
    id: 'notebandi',
    cmd: 'NOTEBANDI!',
    sub: 'Catch the NEW notes. Old ones are raddi!',
    time: 9,
    scene: 'bank',
    card: 'notebandi',
    init(a) {
      a.st = {
        x: W / 2,
        need: 3,
        got: 0,
        notes: [],
        spawn: 0,
        rate: 0.62 / a.speed,
        wob: 0,
      };
    },
    update(dt, a) {
      const s = a.st;
      const sp = 560;
      if (a.in.down('left')) s.x -= sp * dt;
      if (a.in.down('right')) s.x += sp * dt;
      if (a.in.p.down || a.in.p.moved) s.x = MM.lerp(s.x, a.in.p.x, Math.min(1, dt * 14));
      s.x = MM.clamp(s.x, 70, W - 70);
      s.wob = MM.lerp(s.wob, 0, dt * 6);

      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = s.rate * MM.rand(0.7, 1.3);
        const good = Math.random() < 0.5;
        s.notes.push({
          x: MM.rand(80, W - 80),
          y: -40,
          vy: MM.rand(190, 260) * a.speed,
          d: good ? MM.pick([2000, 200]) : MM.pick([500, 1000]),
          good,
          rot: MM.rand(-0.4, 0.4),
          vr: MM.rand(-1.6, 1.6),
        });
      }

      for (let i = s.notes.length - 1; i >= 0; i--) {
        const n = s.notes[i];
        n.y += n.vy * dt;
        n.rot += n.vr * dt;
        n.x += Math.sin(n.y * 0.02) * 40 * dt;
        if (n.y > H - 150 && n.y < H - 78 && Math.abs(n.x - s.x) < 74) {
          s.notes.splice(i, 1);
          if (n.good) {
            s.got++;
            s.wob = 1;
            a.sfx('coin');
            a.pop('+₹' + n.d, n.x, n.y - 30, { c: C.gold, size: 28 });
            MM.fx.burst(n.x, n.y, 14, [C.gold, C.white, C.pink]);
            if (s.got >= s.need) return a.win('Jholaful of cash!');
          } else {
            a.sfx('bad');
            a.shake(14);
            a.flash(C.danger);
            return a.lose('Yeh note band ho gaya!');
          }
        } else if (n.y > H + 60) s.notes.splice(i, 1);
      }
    },
    draw(g, a) {
      const s = a.st;
      s.notes.forEach((n) => art.note(g, n.x, n.y, 0.9, n.d, n.rot));
      // jhola (cloth bag) held open
      const sq = 1 + s.wob * 0.14;
      g.save();
      g.translate(s.x, H - 82);
      g.scale(sq, 2 - sq);
      g.fillStyle = '#3f7d3a';
      g.beginPath();
      g.moveTo(-74, -46);
      g.quadraticCurveTo(-64, 44, 0, 50);
      g.quadraticCurveTo(64, 44, 74, -46);
      g.closePath();
      g.fill();
      g.fillStyle = '#2f6a2c';
      d.ellipse(g, 0, -46, 74, 16, '#2f6a2c');
      g.fillStyle = 'rgba(255,255,255,.85)';
      d.text(g, 'JHOLA', 0, 8, { size: 22, fill: 'rgba(255,255,255,.9)' });
      g.restore();
      art.modi(g, 108, H - 14, 0.55, { t: a.t, mouth: 'grin', arms: 'wave', eyes: 'wink' });
      d.text(g, `NEW NOTES  ${s.got} / ${s.need}`, W / 2, 162, { size: 26, fill: C.navy, stroke: C.white, lw: 6 });
      d.text(g, 'catch ₹2000 / ₹200 — avoid ₹500 / ₹1000', W / 2, 192, { size: 17, fill: '#3c4a63' });
    },
  });

  /* =============================================================== 3. JHAPPI */
  MM.reg({
    id: 'jhappi',
    cmd: 'JHAPPI!',
    sub: 'Time the diplomatic bear hug',
    time: 7,
    scene: 'rally',
    card: 'jhappi',
    init(a) {
      a.st = {
        who: MM.randInt(0, art.LEADERS.length - 1),
        x: W + 90,
        v: MM.rand(150, 210) * a.speed,
        zone: MM.rand(300, 420),
        band: Math.max(46, 78 - a.level * 5),
        hug: 0,
        state: 'walk',
        wobble: MM.rand(0.4, 1.2),
      };
    },
    update(dt, a) {
      const s = a.st;
      if (s.state === 'walk') {
        // leaders bob and hesitate, so you can't just memorise a rhythm
        s.x -= s.v * dt * (1 + Math.sin(a.t * s.wobble * 3) * 0.35);
        const inZone = Math.abs(s.x - (W / 2 + s.zone / 3)) < s.band;
        if (a.in.hit('action')) {
          if (inZone) {
            s.state = 'hug';
            a.sfx('thud');
            a.shake(16);
            MM.fx.burst(W / 2 + 40, 330, 30, [C.saffron, C.white, C.pink, C.gold], { shape: 'star' });
            a.pop('JHAPPI!!', W / 2, 200, { c: C.pink, size: 52 });
          } else {
            a.sfx('bad');
            a.shake(10);
            return a.lose(s.x > W / 2 + 160 ? 'Bahut jaldi! Awkward.' : 'Hug missed. Handshake only.');
          }
        }
        if (s.x < 200) return a.lose('Woh nikal gaya!');
      } else {
        s.hug = Math.min(1, s.hug + dt * 3.4);
        if (s.hug >= 1) return a.win('Global jhappi diplomacy!');
      }
    },
    draw(g, a) {
      const s = a.st;
      const zx = W / 2 + s.zone / 3;
      // hug zone marker on the red carpet
      g.save();
      g.globalAlpha = 0.55 + Math.sin(a.t * 7) * 0.16;
      d.fillRR(g, zx - s.band, H - 150, s.band * 2, 130, 16, 'rgba(255,153,51,.5)');
      g.restore();
      d.strokeRR(g, zx - s.band, H - 150, s.band * 2, 130, 16, C.gold, 4);
      d.text(g, 'HUG ZONE', zx, 330, { size: 20, fill: C.gold, stroke: C.ink, lw: 6 });
      // red carpet
      g.fillStyle = '#8e1d2c';
      g.fillRect(0, H - 26, W, 26);

      if (s.state === 'hug') {
        const k = MM.ease.outElastic(s.hug);
        const lx = MM.lerp(zx, W / 2 + 96, k);
        art.leader(g, lx, H - 26, 0.9, s.who, { t: a.t, arms: 'hug', mood: 'shock', label: false });
        art.modi(g, W / 2 - 40, H - 20, 1.05, { t: a.t, arms: 'hug', hugT: k, mouth: 'grin', eyes: 'closed' });
        g.save();
        g.globalAlpha = 0.8;
        for (let i = 0; i < 5; i++) {
          const p = (a.t * 2 + i * 0.2) % 1;
          d.text(g, '♥', W / 2 + Math.sin(i * 2) * 90, 320 - p * 150, { size: 30 + i * 3, fill: C.pink });
        }
        g.restore();
      } else {
        art.leader(g, s.x, H - 26, 0.9, s.who, { t: a.t, arms: 'walk' });
        art.modi(g, 250, H - 20, 1.05, { t: a.t, arms: 'hug', hugT: 0, mouth: 'grin', eyes: 'wide' });
      }
      d.text(g, 'SPACE / TAP to hug', W / 2, 128, { size: 24, fill: C.white, stroke: C.ink, lw: 7 });
    },
  });

  /* ================================================================= 4. CHAI */
  MM.reg({
    id: 'chai',
    cmd: 'CHAI!',
    sub: 'Hold to pour. Stop inside the green band!',
    time: 8,
    scene: 'golden',
    card: 'chai',
    init(a) {
      const cups = a.level >= 3 ? 2 : 1;
      a.st = {
        cups,
        idx: 0,
        fill: 0,
        target: MM.rand(0.55, 0.86),
        band: Math.max(0.055, 0.13 - a.level * 0.011),
        pouring: false,
        rate: 0.42 * a.speed,
        served: 0,
        judgeT: 0,
      };
    },
    update(dt, a) {
      const s = a.st;
      if (s.judgeT > 0) {
        s.judgeT -= dt;
        if (s.judgeT <= 0) {
          s.idx++;
          if (s.served >= s.cups) return a.win('Perfect cutting chai!');
          s.fill = 0;
          s.target = MM.rand(0.5, 0.88);
          s.pouring = false;
        }
        return;
      }
      const holding = a.in.down('action') || a.in.p.down;
      if (holding) {
        if (!s.pouring) a.sfx('pour');
        s.pouring = true;
        s.fill += s.rate * dt;
        if (Math.random() < dt * 14) MM.fx.burst(W / 2 - 4, 250, 1, ['#c98a4b'], { g: 900, spMin: 10, spMax: 60, rMax: 3 });
        if (s.fill > 1.04) {
          a.sfx('bad');
          a.shake(12);
          return a.lose('Chai gir gayi!');
        }
      } else if (s.pouring) {
        // released — judge it
        const err = Math.abs(s.fill - s.target);
        if (err <= s.band) {
          s.served++;
          a.sfx('good');
          const perfect = err < s.band * 0.35;
          a.pop(perfect ? 'PERFECT CUTTING!' : 'BADHIYA CHAI!', W / 2, 200, { c: perfect ? C.gold : C.white, size: perfect ? 42 : 34 });
          MM.fx.burst(W / 2, 300, 20, [C.gold, C.white, '#c98a4b'], { shape: 'star' });
          if (perfect) a.bonus(150);
          s.judgeT = 0.55;
        } else {
          a.sfx('bad');
          a.shake(10);
          return a.lose(s.fill < s.target ? 'Itni kam chai?! Insult hai.' : 'Zyada bhar di, ustad.');
        }
      }
    },
    draw(g, a) {
      const s = a.st;
      // wooden tapri counter
      d.fillRR(g, 0, H - 118, W, 30, 0, '#7a4520');
      d.fillRR(g, 0, H - 100, W, 100, 0, '#5c3218');
      art.modi(g, 190, H - 106, 0.9, { t: a.t, mouth: s.pouring ? 'o' : 'smile', arms: 'point', eyes: 'open' });
      // kettle, tipped over the cup
      g.save();
      g.translate(W / 2 + 6, 232);
      g.rotate(s.pouring ? 0.42 : 0.12);
      g.fillStyle = '#8d8f99';
      d.fillRR(g, -48, -32, 96, 62, 16, '#8d8f99');
      d.fillRR(g, -18, -44, 36, 14, 7, '#75777f');
      g.beginPath();
      g.moveTo(34, -14);
      g.lineTo(80, -34);
      g.lineTo(86, -18);
      g.lineTo(42, 6);
      g.closePath();
      g.fill();
      g.strokeStyle = '#75777f';
      g.lineWidth = 8;
      g.beginPath();
      g.arc(-52, 0, 22, -1.2, 1.2);
      g.stroke();
      g.restore();
      if (s.pouring) {
        g.strokeStyle = '#8a5322';
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(W / 2 + 74, 226);
        g.quadraticCurveTo(W / 2 + 40 + Math.sin(a.t * 20) * 4, 300, W / 2, 350);
        g.stroke();
      }
      // the cup, big and central
      const cy = 432;
      g.save();
      g.translate(W / 2, cy);
      g.scale(2.4, 2.4);
      art.chai(g, 0, 0, 1, s.fill, { steam: s.fill > 0.15, t: a.t });
      g.restore();
      // target band overlay drawn on the cup
      const top = (f) => cy + MM.lerp(20, -38, f) * 2.4;
      g.save();
      g.globalAlpha = 0.55;
      g.fillStyle = C.green;
      g.fillRect(W / 2 - 68, top(s.target + s.band), 136, top(s.target - s.band) - top(s.target + s.band));
      g.restore();
      g.strokeStyle = C.white;
      g.lineWidth = 3;
      g.setLineDash([9, 7]);
      g.beginPath();
      g.moveTo(W / 2 - 80, top(s.target));
      g.lineTo(W / 2 + 80, top(s.target));
      g.stroke();
      g.setLineDash([]);
      d.text(g, `CUP ${Math.min(s.cups, s.served + 1)} / ${s.cups}`, W / 2, 122, { size: 26, fill: C.white, stroke: C.ink, lw: 6 });
      d.text(g, 'HOLD to pour • RELEASE in the green', W / 2, 160, { size: 20, fill: C.white, stroke: C.ink, lw: 5 });
    },
  });

  /* ================================================================= 5. YOGA */
  MM.reg({
    id: 'yoga',
    cmd: 'YOGA DAY!',
    sub: 'Copy the asana sequence',
    time: 11,
    scene: 'sunrise',
    card: 'yoga',
    init(a) {
      const n = MM.clamp(2 + Math.floor(a.level / 1.5), 3, 6);
      const seq = [];
      for (let i = 0; i < n; i++) seq.push(MM.pick(['up', 'down', 'left', 'right']));
      a.st = { seq, show: 0, showT: 0, phase: 'demo', at: 0, wrong: 0, step: 0.62 / Math.min(1.5, a.speed) };
    },
    update(dt, a) {
      const s = a.st;
      if (s.phase === 'demo') {
        s.showT += dt;
        if (s.showT >= s.step) {
          s.showT = 0;
          if (s.show < s.seq.length) a.sfx('tabla');
          s.show++;
          if (s.show > s.seq.length) {
            s.phase = 'play';
            a.sfx('ui');
          }
        }
        return;
      }
      ['up', 'down', 'left', 'right'].forEach((k) => {
        if (a.in.hit(k)) {
          if (k === s.seq[s.at]) {
            s.at++;
            a.sfx('coin');
            MM.fx.burst(W / 2, 360, 10, [C.gold, C.white]);
            if (s.at >= s.seq.length) a.win('Namaste. Full flexibility!');
          } else {
            s.wrong = 1;
            a.sfx('bad');
            a.shake(12);
            a.lose('Slip disc! Galat asana.');
          }
        }
      });
    },
    draw(g, a) {
      const s = a.st;
      const demo = s.phase === 'demo';
      const cur = demo ? s.seq[Math.min(s.show, s.seq.length - 1)] : s.seq[Math.min(s.at, s.seq.length - 1)];
      art.modi(g, 160, H - 20, 0.7, { t: a.t, arms: 'namaste', eyes: 'closed', mouth: 'smile' });
      // the mat
      g.save();
      g.globalAlpha = 0.85;
      d.fillRR(g, W / 2 - 210, 424, 420, 62, 20, '#6c4bd8');
      g.restore();
      // big stick-figure demo
      if (demo && s.show <= s.seq.length) {
        art.asana(g, W / 2, 348, 1.6, cur, C.white);
        art.arrow(g, W / 2, 520, 2.4, cur, C.gold);
      } else if (!demo) {
        art.asana(g, W / 2, 348, 1.6, s.at ? s.seq[s.at - 1] : 'down', 'rgba(255,255,255,.55)');
      }
      // sequence dots
      s.seq.forEach((k, i) => {
        const x = W / 2 - ((s.seq.length - 1) * 62) / 2 + i * 62;
        const on = demo ? i < s.show : i < s.at;
        d.circle(g, x, 190, 24, on ? C.gold : 'rgba(255,255,255,.25)');
        if (!demo && i < s.at) art.arrow(g, x, 190, 0.9, k, C.ink);
        else if (demo && i < s.show) art.arrow(g, x, 190, 0.9, k, C.ink);
      });
      d.text(g, demo ? 'WATCH...' : 'YOUR TURN — press the arrows!', W / 2, 130, {
        size: 30,
        fill: demo ? C.white : C.gold,
        stroke: C.ink,
        lw: 6,
      });
    },
  });

  /* =============================================================== 6. JHAADU */
  MM.reg({
    id: 'jhaadu',
    cmd: 'SAFAI!',
    sub: 'Sweep every last piece of kachra',
    time: 9,
    scene: 'street',
    card: 'jhaadu',
    init(a) {
      const n = 4 + Math.min(5, a.level);
      const bits = [];
      for (let i = 0; i < n; i++)
        bits.push({
          x: MM.rand(120, W - 120),
          y: MM.rand(H - 200, H - 50),
          k: MM.randInt(0, 2),
          rot: MM.rand(MM.TAU),
          gone: 0,
          vx: 0,
          vy: 0,
        });
      a.st = { bits, x: W / 2, y: H - 120, ang: 0, cleared: 0, need: n, swish: 0 };
    },
    update(dt, a) {
      const s = a.st;
      const sp = 620;
      if (a.in.p.moved || a.in.p.down) {
        s.x = MM.lerp(s.x, a.in.p.x, Math.min(1, dt * 16));
        s.y = MM.lerp(s.y, MM.clamp(a.in.p.y, H - 230, H - 30), Math.min(1, dt * 16));
      }
      if (a.in.down('left')) s.x -= sp * dt;
      if (a.in.down('right')) s.x += sp * dt;
      if (a.in.down('up')) s.y -= sp * dt;
      if (a.in.down('down')) s.y += sp * dt;
      s.x = MM.clamp(s.x, 40, W - 40);
      s.y = MM.clamp(s.y, H - 240, H - 24);
      s.ang = Math.sin(a.t * 12) * 0.5;

      s.bits.forEach((b) => {
        if (b.gone) {
          b.gone += dt * 2.4;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy += 900 * dt;
          b.rot += dt * 12;
          return;
        }
        if (MM.dist(b.x, b.y, s.x, s.y + 30) < 60) {
          b.gone = 0.001;
          const ang = Math.atan2(b.y - (s.y + 30), b.x - s.x);
          b.vx = Math.cos(ang) * 420 + 180;
          b.vy = -320;
          s.cleared++;
          s.swish = 1;
          a.sfx('whoosh');
          MM.fx.burst(b.x, b.y, 12, ['#d9cdb0', '#efe9d8', C.dust], { g: 260, lifeMax: 0.6 });
          a.pop('SWACHH!', b.x, b.y - 20, { c: C.green, size: 24 });
          if (s.cleared >= s.need) a.win('Swachh Bharat, 100%!');
        }
      });
      s.swish = Math.max(0, s.swish - dt * 3);
    },
    draw(g, a) {
      const s = a.st;
      // dustbin
      d.fillRR(g, W - 110, H - 190, 84, 130, 12, '#2f7d3a');
      d.fillRR(g, W - 118, H - 202, 100, 20, 8, '#245f2c');
      d.text(g, 'USE ME', W - 68, H - 130, { size: 16, fill: 'rgba(255,255,255,.8)', rot: -0.08 });
      s.bits.forEach((b) => {
        if (b.gone > 1) return;
        g.save();
        if (b.gone) g.globalAlpha = 1 - b.gone;
        art.trash(g, b.x, b.y, 1 + (b.gone || 0), b.k, b.rot);
        g.restore();
      });
      art.modi(g, 150, H - 30, 0.72, { t: a.t, mouth: 'grin', arms: 'point', eyes: 'open' });
      art.broom(g, s.x, s.y, 1, s.ang);
      if (s.swish > 0) {
        g.save();
        g.globalAlpha = s.swish * 0.5;
        g.strokeStyle = C.white;
        g.lineWidth = 6;
        g.beginPath();
        g.arc(s.x, s.y + 30, 62, -0.9, 0.9);
        g.stroke();
        g.restore();
      }
      d.text(g, `KACHRA LEFT: ${s.need - s.cleared}`, W / 2, 128, { size: 28, fill: C.white, stroke: C.ink, lw: 6 });
      d.text(g, 'move the jhaadu — mouse, arrows or swipe', W / 2, 162, { size: 17, fill: C.white, stroke: C.ink, lw: 4 });
    },
  });

  /* =============================================================== 7. RADAR */
  MM.reg({
    id: 'radar',
    cmd: 'CLOUD COVER!',
    sub: 'Hide inside a cloud when the radar sweeps',
    time: 12,
    scene: 'sky',
    card: 'radar',
    init(a) {
      const clouds = [];
      for (let i = 0; i < 8; i++)
        clouds.push({ x: MM.rand(0, W), y: MM.rand(170, H - 110), s: MM.rand(1.2, 1.9), v: -MM.rand(22, 50) });
      a.st = {
        clouds,
        y: H / 2,
        vy: 0,
        sweeps: 0,
        need: 3,
        beam: -1,
        next: 2.2 / a.speed,
        warn: 0,
        armed: false,
        safe: -1,
      };
    },
    update(dt, a) {
      const s = a.st;
      const sp = 420;
      if (a.in.down('up')) s.vy -= sp * dt * 6;
      if (a.in.down('down')) s.vy += sp * dt * 6;
      if (a.in.p.down) s.vy += (a.in.p.y - s.y) * dt * 12;
      s.vy = MM.clamp(s.vy * Math.pow(0.92, dt * 60), -sp, sp);
      s.y = MM.clamp(s.y + s.vy * dt, 130, H - 90);

      s.clouds.forEach((c) => {
        c.x += c.v * dt * a.speed;
        if (c.x < -160) {
          c.x = W + 160;
          c.y = MM.rand(160, H - 120);
          c.s = MM.rand(1.1, 1.9);
        }
      });

      const covers = (c, y) => MM.dist(c.x, c.y + 6, 200, y) < 78 * c.s;
      s.hidden = s.clouds.some((c) => covers(c, s.y));

      // Seconds until the beam will reach the plane's column, so both the
      // fairness guarantee and the on-screen hint work off the same number.
      const travel = (W - 200) / ((W / 0.85) * a.speed);

      if (s.beam < 0) {
        s.next -= dt;
        s.warn = s.next < 1.6 ? 1 : 0;
        const lead = s.next + travel;
        // where each cloud will be when the beam arrives
        const predict = (c) => c.x + c.v * a.speed * lead;
        if (s.warn && !s.armed) {
          s.armed = true;
          // Fairness: if no cloud will be over the plane's column in time, drift
          // one in so it lands exactly there — the round is always survivable.
          if (!s.clouds.some((c) => Math.abs(predict(c) - 200) < 110)) {
            const c = s.clouds.reduce((w, z) => (Math.abs(predict(z) - 200) > Math.abs(predict(w) - 200) ? z : w));
            c.s = MM.rand(1.5, 1.9);
            c.y = MM.clamp(s.y + MM.rand(-60, 60), 180, H - 110);
            c.x = 200 - c.v * a.speed * lead + MM.rand(-30, 30);
          }
        }
        // flag the cloud that will actually be covering the column, so the player
        // knows where to fly instead of guessing
        if (s.warn) {
          let best = -1;
          let bd = 1e9;
          s.clouds.forEach((c, i) => {
            const dd = Math.abs(predict(c) - 200);
            if (dd < bd) {
              bd = dd;
              best = i;
            }
          });
          s.safe = bd < 130 ? best : -1;
        } else s.safe = -1;
        if (s.next <= 0) {
          s.beam = W;
          s.armed = false;
          a.sfx('whoosh');
        }
      } else {
        s.beam -= (W / 0.85) * dt * a.speed;
        if (s.beam <= 200 && s.beam + (W / 0.85) * dt * a.speed > 200) {
          // the beam just crossed the plane
          if (s.hidden) {
            s.sweeps++;
            a.sfx('coin');
            a.pop('RADAR FAIL!', 200, s.y - 90, { c: C.cyan, size: 30 });
            MM.fx.burst(200, s.y, 16, [C.cyan, C.white]);
            if (s.sweeps >= s.need) return a.win('Baadal mein chhup gaye!');
          } else {
            a.sfx('bad');
            a.shake(16);
            a.flash(C.danger);
            return a.lose('Radar ne pakad liya!');
          }
        }
        if (s.beam < -60) {
          s.beam = -1;
          s.safe = -1;
          s.next = MM.rand(1.9, 2.6) / a.speed;
        }
      }
    },
    draw(g, a) {
      const s = a.st;
      s.clouds.forEach((c, i) => {
        art.cloud(g, c.x, c.y, c.s, 0.98);
        if (i === s.safe) {
          // "fly here" marker on the cloud that will shield you this sweep
          g.save();
          g.globalAlpha = 0.6 + Math.sin(a.t * 10) * 0.3;
          g.strokeStyle = C.green;
          g.lineWidth = 5;
          g.setLineDash([12, 9]);
          d.rr(g, c.x - 82 * c.s, c.y - 46 * c.s, 164 * c.s, 104 * c.s, 26);
          g.stroke();
          g.setLineDash([]);
          d.fillRR(g, c.x - 40, c.y - 56 * c.s - 15, 80, 30, 15, 'rgba(6,40,16,.85)');
          d.text(g, 'SAFE', c.x, c.y - 56 * c.s, { size: 19, fill: C.green });
          g.restore();
        }
      });
      // plane + tricolour trail
      g.save();
      g.globalAlpha = 0.6;
      [C.saffron, C.white, C.green].forEach((col, i) => {
        g.strokeStyle = col;
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(160, s.y + (i - 1) * 9);
        g.lineTo(20, s.y + (i - 1) * 9 + Math.sin(a.t * 6 + i) * 6);
        g.stroke();
      });
      g.restore();
      art.plane(g, 200, s.y, 1.6, MM.clamp(s.vy / 900, -0.35, 0.35));
      if (s.hidden) {
        d.text(g, 'HIDDEN', 200, s.y - 80, { size: 22, fill: C.cyan, stroke: C.ink, lw: 5 });
      }
      // radar beam
      if (s.beam >= 0) {
        const gr = g.createLinearGradient(s.beam - 60, 0, s.beam + 60, 0);
        gr.addColorStop(0, 'rgba(90,255,140,0)');
        gr.addColorStop(0.5, 'rgba(90,255,140,.75)');
        gr.addColorStop(1, 'rgba(90,255,140,0)');
        g.fillStyle = gr;
        g.fillRect(s.beam - 60, 100, 120, H);
      }
      // radar dish
      g.save();
      g.translate(W - 86, H - 40);
      g.fillStyle = '#37424e';
      g.beginPath();
      g.moveTo(-26, 0);
      g.lineTo(26, 0);
      g.lineTo(12, -34);
      g.lineTo(-12, -34);
      g.closePath();
      g.fill();
      g.fillRect(-6, -80, 12, 48);
      g.save();
      g.translate(0, -84);
      g.rotate(Math.sin(a.t * 2.4) * 0.5);
      g.fillStyle = '#5c6a78';
      g.beginPath();
      g.arc(0, 0, 34, Math.PI, 0);
      g.closePath();
      g.fill();
      g.fillStyle = '#8c9aa8';
      d.circle(g, 0, -4, 7, '#8c9aa8');
      g.restore();
      g.restore();
      d.text(g, `DODGED ${s.sweeps} / ${s.need}`, W / 2, 128, { size: 28, fill: C.white, stroke: C.chakra, lw: 6 });
      if (s.warn && s.beam < 0)
        d.text(g, 'SWEEP INCOMING!', W / 2, 172, {
          size: 24,
          fill: Math.sin(a.t * 20) > 0 ? C.danger : C.gold,
          stroke: C.ink,
          lw: 5,
        });
    },
  });
})(window.MM);
