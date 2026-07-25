/* MITRON MAYHEM — BOSS ROUND: "THE 8 PM ADDRESS".
   A command rush that recycles every verb the player has learned. He barks an
   order, you obey inside a shrinking window — and sometimes the order is to
   do absolutely nothing. Three mistakes and the broadcast flops. */
(function (MM) {
  'use strict';

  const C = MM.C;
  const d = MM.d;
  const art = MM.art;
  const W = MM.W;
  const H = MM.H;

  const CMDS = [
    { text: 'TAALI!', key: 'action', hint: 'SPACE' },
    { text: 'MITRON!', key: 'action', hint: 'SPACE' },
    { text: 'BAAYE!', key: 'left', hint: '←' },
    { text: 'DAAYE!', key: 'right', hint: '→' },
    { text: 'JHANDA UPAR!', key: 'up', hint: '↑' },
    { text: 'JHUKO!', key: 'down', hint: '↓' },
    { text: 'CHUP!', key: 'none', hint: 'do NOTHING' },
  ];

  MM.boss = {
    id: 'boss8pm',
    cmd: '8 PM ADDRESS',
    sub: 'Obey every order. CHUP means do nothing!',
    time: 60,
    scene: 'rally',
    card: 'boss',
    isBoss: true,
    init(a) {
      const need = 8 + Math.min(6, a.level);
      a.st = {
        need,
        ok: 0,
        wrong: 0,
        maxWrong: 3,
        cur: null,
        wait: 0.7,
        window: 1.35,
        judged: false,
        shakeText: 0,
        lastVerdict: 0,
        verdict: '',
        legend: 3.2,
      };
    },
    update(dt, a) {
      const s = a.st;
      s.shakeText = Math.max(0, s.shakeText - dt * 4);
      s.lastVerdict = Math.max(0, s.lastVerdict - dt);
      s.legend = Math.max(0, s.legend - dt);

      const anyPress =
        a.in.hit('action') || a.in.hit('left') || a.in.hit('right') || a.in.hit('up') || a.in.hit('down');
      const which = a.in.down('left')
        ? 'left'
        : a.in.down('right')
        ? 'right'
        : a.in.down('up')
        ? 'up'
        : a.in.down('down')
        ? 'down'
        : a.in.down('action')
        ? 'action'
        : null;

      if (!s.cur) {
        // small breather between orders; stray presses here are harmless
        s.wait -= dt;
        if (s.wait <= 0) {
          const prev = s.cur;
          let c = MM.pick(CMDS);
          while (prev && c.text === prev.text) c = MM.pick(CMDS);
          s.cur = c;
          s.t = 0;
          s.limit = Math.max(0.62, s.window - s.ok * 0.055);
          s.shakeText = 1;
          a.sfx(c.key === 'none' ? 'ui' : 'tabla');
          a.shake(5);
        }
        return;
      }

      s.t += dt;
      const c = s.cur;
      if (c.key === 'none') {
        if (anyPress) return fail('Bola tha CHUP!');
        if (s.t >= s.limit) return succeed();
      } else {
        if (anyPress) {
          if (which === c.key || (c.key === 'action' && a.in.down('action'))) return succeed();
          return fail('Galat ishaara!');
        }
        if (s.t >= s.limit) return fail('Der ho gayi!');
      }

      function succeed() {
        s.ok++;
        s.cur = null;
        s.wait = Math.max(0.24, 0.62 - s.ok * 0.03);
        s.verdict = MM.pick(['SAHI!', 'BADHIYA!', 'KYA BAAT!', 'WAAH!']);
        s.lastVerdict = 0.6;
        a.sfx('coin');
        a.bonus(90);
        MM.fx.burst(W / 2, 300, 20, [C.saffron, C.gold, C.white], { shape: 'star' });
        a.shake(8);
        if (s.ok >= s.need) a.win('BROADCAST OF THE CENTURY!');
      }
      function fail(msg) {
        s.wrong++;
        s.cur = null;
        s.wait = 0.62;
        s.verdict = msg;
        s.lastVerdict = 0.9;
        a.sfx('bad');
        a.shake(16);
        a.flash(C.danger);
        a.breakCombo();
        if (s.wrong >= s.maxWrong) a.lose('TRP gir gayi. Broadcast band.');
      }
    },
    draw(g, a) {
      const s = a.st;

      // teleprompter-ish frame around the whole thing
      g.save();
      g.globalAlpha = 0.35;
      d.strokeRR(g, 22, 96, W - 44, H - 140, 18, C.gold, 4);
      g.restore();

      const quiet = s.cur && s.cur.key === 'none';
      art.modi(g, W / 2, H + 40, 1.28, {
        t: a.t,
        mouth: quiet ? 'flat' : s.cur ? 'talk' : 'smile',
        arms: quiet ? 'namaste' : 'point',
        eyes: quiet ? 'closed' : 'open',
        brow: 'up',
      });
      // mic stand
      g.fillStyle = '#2a2a34';
      g.fillRect(W / 2 - 190, H - 190, 9, 190);
      d.circle(g, W / 2 - 186, H - 194, 17, '#3a3a48');

      // dark plate so the order always reads over him
      g.save();
      g.globalAlpha = 0.72;
      d.fillRR(g, W / 2 - 330, 176, 660, 186, 18, '#080c1e');
      g.restore();

      // hearts (broadcast credibility)
      for (let i = 0; i < s.maxWrong; i++) {
        const x = 60 + i * 44;
        const alive = i < s.maxWrong - s.wrong;
        g.save();
        g.globalAlpha = alive ? 1 : 0.22;
        d.text(g, '❤', x, 140, { size: 34, fill: alive ? C.danger : '#555' });
        g.restore();
      }

      // progress
      const p = s.ok / s.need;
      d.fillRR(g, W / 2 - 200, 126, 400, 26, 13, 'rgba(0,0,0,.5)');
      d.fillRR(g, W / 2 - 200, 126, 400 * p, 26, 13, C.gold);
      d.text(g, `ORDERS OBEYED  ${s.ok} / ${s.need}`, W / 2, 139, { size: 16, fill: C.white, stroke: C.ink, lw: 4 });

      // the order itself
      if (s.cur) {
        const sc = 1 + s.shakeText * 0.25;
        g.save();
        g.translate(W / 2, 248);
        g.scale(sc, sc);
        d.text(g, s.cur.text, 0, 0, {
          size: 66,
          fill: s.cur.key === 'none' ? C.cyan : C.gold,
          stroke: C.ink,
          lw: 10,
        });
        g.restore();
        d.text(g, s.cur.hint, W / 2, 304, { size: 24, fill: C.white, stroke: C.ink, lw: 5 });
        // shrinking window bar
        const k = 1 - MM.clamp(s.t / s.limit, 0, 1);
        d.fillRR(g, W / 2 - 170, 330, 340, 14, 7, 'rgba(0,0,0,.55)');
        d.fillRR(g, W / 2 - 170, 330, 340 * k, 14, 7, k > 0.4 ? C.green : C.danger);
      } else if (s.lastVerdict > 0) {
        d.text(g, s.verdict, W / 2, 262, {
          size: 44,
          fill: s.wrong && s.verdict.length > 8 ? C.danger : C.gold,
          stroke: C.ink,
          lw: 8,
        });
      }

      if (s.legend > 0) {
        g.save();
        g.globalAlpha = Math.min(1, s.legend);
        d.fillRR(g, W / 2 - 330, H - 92, 660, 56, 12, 'rgba(11,21,51,.85)');
        d.text(g, 'TAALI/MITRON = SPACE   BAAYE = ←   DAAYE = →   JHANDA = ↑   JHUKO = ↓   CHUP = freeze', W / 2, H - 64, {
          size: 17,
          fill: C.white,
        });
        g.restore();
      }
    },
  };
})(window.MM);
