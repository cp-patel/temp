/* CHUNAV CHANAKYA — immediate-mode UI kit + the board renderer.
   Every frame rebuilds a hit list; clicks are tested against it in reverse
   draw order. Small, predictable, and no DOM to keep in sync. */
(function (root) {
  'use strict';

  const SG = (root.SG = root.SG || {});
  const MM = root.MM;
  const d = MM.d;
  const UI = (SG.ui = {});

  UI.C = {
    bg: '#0a1020',
    panel: 'rgba(16,24,46,.92)',
    panel2: 'rgba(255,255,255,.06)',
    line: 'rgba(255,255,255,.14)',
    text: '#f2f4fa',
    dim: 'rgba(242,244,250,.6)',
    dim2: 'rgba(242,244,250,.38)',
    gold: '#ffd447',
    saffron: '#ff9933',
    green: '#22b573',
    blue: '#2f8fe0',
    red: '#ff5b52',
    heat: '#ff7a3d',
  };

  UI.hits = [];
  UI.mouse = { x: 0, y: 0 };
  UI.tip = null;
  UI.reset = function () {
    UI.hits = [];
    UI.tip = null;
  };

  UI.hit = function (x, y, w, h, fn, tip, disabled) {
    UI.hits.push({ x, y, w, h, fn, tip, disabled });
    const m = UI.mouse;
    const over = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    if (over && tip) UI.tip = { text: tip, x: m.x, y: m.y };
    return over;
  };

  UI.click = function (x, y) {
    for (let i = UI.hits.length - 1; i >= 0; i--) {
      const h = UI.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        if (h.disabled) return 'disabled';
        if (h.fn) h.fn();
        return true;
      }
    }
    return false;
  };

  /* ------------------------------------------------------------- primitives */
  UI.panel = function (g, x, y, w, h, title) {
    d.fillRR(g, x, y, w, h, 12, UI.C.panel);
    d.strokeRR(g, x, y, w, h, 12, UI.C.line, 1.5);
    if (title) {
      d.fillRR(g, x, y, w, 30, 12, 'rgba(255,255,255,.06)');
      d.text(g, title, x + 12, y + 16, { size: 13, align: 'left', fill: UI.C.gold });
    }
  };

  UI.button = function (g, x, y, w, h, label, opt) {
    const o = opt || {};
    const over = UI.hit(x, y, w, h, o.fn, o.tip, o.disabled);
    // record the label on the hit so tests can click by name rather than by
    // hand-computed coordinates, which drift every time a layout moves
    UI.hits[UI.hits.length - 1].label = label;
    const bg = o.disabled
      ? 'rgba(255,255,255,.05)'
      : over
      ? o.hoverBg || UI.C.saffron
      : o.bg || 'rgba(255,255,255,.10)';
    d.fillRR(g, x, y, w, h, o.r === undefined ? 9 : o.r, bg);
    d.strokeRR(g, x, y, w, h, o.r === undefined ? 9 : o.r, o.disabled ? 'rgba(255,255,255,.12)' : over ? '#fff' : UI.C.line, 1.6);
    d.text(g, label, x + w / 2, y + h / 2 + 1, {
      size: o.size || 14,
      fill: o.disabled ? UI.C.dim2 : over ? '#171008' : o.fg || UI.C.text,
    });
    return over;
  };

  UI.bar = function (g, x, y, w, h, frac, col, bg) {
    d.fillRR(g, x, y, w, h, h / 2, bg || 'rgba(0,0,0,.45)');
    const ww = Math.max(0, Math.min(1, frac)) * w;
    if (ww > 1) d.fillRR(g, x, y, ww, h, h / 2, col);
  };

  /* Stacked party share bar: the single most-read widget in the game. */
  UI.shareBar = function (g, x, y, w, h, share) {
    let cx = x;
    ['P', 'A', 'B', 'O'].forEach((p) => {
      const ww = (share[p] / 100) * w;
      g.fillStyle = SG.PARTIES[p].color;
      g.fillRect(cx, y, ww + 0.5, h);
      cx += ww;
    });
    d.strokeRR(g, x, y, w, h, 2, 'rgba(0,0,0,.45)', 1);
  };

  UI.tooltip = function (g) {
    if (!UI.tip) return;
    const lines = String(UI.tip.text).split('\n');
    const wpx = Math.max(...lines.map((l) => d.measure(g, l, 12, 700))) + 20;
    const h = lines.length * 16 + 14;
    let x = UI.tip.x + 16;
    let y = UI.tip.y + 16;
    if (x + wpx > MM.W - 8) x = MM.W - wpx - 8;
    if (y + h > MM.H - 8) y = UI.tip.y - h - 10;
    d.fillRR(g, x, y, wpx, h, 8, 'rgba(6,10,22,.97)');
    d.strokeRR(g, x, y, wpx, h, 8, UI.C.gold, 1.4);
    lines.forEach((l, i) =>
      d.text(g, l, x + 10, y + 15 + i * 16, { size: 12, weight: 700, align: 'left', fill: i ? UI.C.dim : UI.C.text })
    );
  };

  /* ------------------------------------------------------------------ board */
  const BX = 24;
  const BY = 78;
  const BW = 772;
  const BH = 656;
  UI.BOARD = { x: BX, y: BY, w: BW, h: BH };

  UI.regionRect = function (def) {
    // positions are authored by hand in board-local pixels so nothing overlaps
    return { x: BX + 10 + def.bx - 70, y: BY + 10 + def.by - 36, w: 140, h: 72 };
  };

  UI.drawBoard = function (g, st, sel, opts) {
    const o = opts || {};
    d.fillRR(g, BX, BY, BW, BH, 14, 'rgba(10,18,38,.85)');
    d.strokeRR(g, BX, BY, BW, BH, 14, UI.C.line, 1.5);

    // faint decorative map wash
    g.save();
    g.globalAlpha = 0.06;
    d.dots(g, BX, BY, BW, BH, 26, 1.6, '#fff');
    g.restore();

    // adjacency threads
    g.save();
    g.strokeStyle = 'rgba(255,255,255,.10)';
    g.lineWidth = 1.5;
    SG.REGIONS.forEach((def) => {
      const a = UI.regionRect(def);
      def.nb.forEach((nid) => {
        const nb = SG.REGIONS.find((z) => z.id === nid);
        if (!nb || nb.id < def.id) return;
        const b = UI.regionRect(nb);
        g.beginPath();
        g.moveTo(a.x + a.w / 2, a.y + a.h / 2);
        g.lineTo(b.x + b.w / 2, b.y + b.h / 2);
        g.stroke();
      });
    });
    g.restore();

    SG.REGIONS.forEach((def) => UI.drawRegion(g, st, def, sel === def.id, o));
  };

  UI.drawRegion = function (g, st, def, selected, o) {
    const r = st.regions[def.id];
    const R = UI.regionRect(def);
    const lead = ['P', 'A', 'B', 'O'].sort((a, b) => r.share[b] - r.share[a])[0];
    const queued = st.queue.filter((q) => q.regionId === def.id);
    const threat = (st.intel || []).filter((i) => i.regionId === def.id);

    const over = UI.hit(R.x, R.y, R.w, R.h, o.onPick ? () => o.onPick(def.id) : null, null);

    // body, tinted by whoever leads it
    const lc = SG.PARTIES[lead].color;
    d.fillRR(g, R.x, R.y, R.w, R.h, 9, 'rgba(12,20,40,.95)');
    g.save();
    g.globalAlpha = 0.22;
    d.fillRR(g, R.x, R.y, R.w, R.h, 9, lc);
    g.restore();
    d.strokeRR(g, R.x, R.y, R.w, R.h, 9, selected ? UI.C.gold : over ? '#fff' : 'rgba(255,255,255,.22)', selected ? 3 : over ? 2 : 1.2);

    // name + seats
    d.text(g, def.short || def.name, R.x + 7, R.y + 13, { size: 11, align: 'left', fill: UI.C.text });
    d.fillRR(g, R.x + R.w - 38, R.y + 5, 32, 16, 8, 'rgba(0,0,0,.45)');
    d.text(g, def.seats + '', R.x + R.w - 22, R.y + 13, { size: 11.5, fill: UI.C.gold });

    // issue tag — green when it matches your manifesto
    const fits = st.planks.includes(def.issue);
    const iss = SG.ISSUES[def.issue];
    const tw = d.measure(g, iss.name, 9.5, 800) + 10;
    d.fillRR(g, R.x + 7, R.y + 19, tw, 13, 6, fits ? 'rgba(34,181,115,.85)' : 'rgba(255,255,255,.12)');
    d.text(g, iss.name, R.x + 7 + tw / 2, R.y + 26, { size: 9.5, fill: fits ? '#04240f' : UI.C.dim });

    // your share, big
    d.text(g, Math.round(r.share.P) + '%', R.x + R.w - 8, R.y + 30, {
      size: 14,
      align: 'right',
      fill: lead === 'P' ? UI.C.saffron : UI.C.dim,
    });

    // stacked share bar
    UI.shareBar(g, R.x + 7, R.y + 40, R.w - 14, 7, r.share);

    // buzz + cadre readouts
    const bz = Math.round(r.buzz.P);
    d.text(g, '⚡' + bz, R.x + 7, R.y + 59, { size: 10.5, align: 'left', fill: bz > 5 ? UI.C.gold : UI.C.dim2 });
    d.text(g, '👥' + Math.round(r.cadre.P), R.x + 48, R.y + 59, { size: 10.5, align: 'left', fill: UI.C.dim });

    // status pips
    let px = R.x + R.w - 8;
    const pip = (txt, col, tip) => {
      const w = d.measure(g, txt, 9, 800) + 8;
      px -= w + 3;
      d.fillRR(g, px, R.y + 52, w, 14, 7, col);
      d.text(g, txt, px + w / 2, R.y + 59, { size: 9, fill: '#0b1020' });
      UI.hit(px, R.y + 52, w, 14, null, tip);
    };
    if (r.fortress.P > 0) pip('FORT', UI.C.green, 'FORTRESS: rivals gain 45% less here');
    if (r.blocked === 'P') pip('HELD', UI.C.blue, 'Streets held — rival moves here fail');
    if (queued.length) pip('▶' + queued.length, UI.C.saffron, queued.map((q) => q.name).join('\n'));
    if (threat.length) pip('!', UI.C.red, threat.map((t) => 'INTEL: ' + t.text).join('\n'));

    if (over && !selected) {
      UI.tip = {
        text:
          `${def.name} — ${def.seats} seats\n` +
          `cares about: ${SG.ISSUES[def.issue].name} (${SG.ISSUES[def.issue].blurb})\n` +
          `you ${Math.round(r.share.P)}%  opp ${Math.round(r.share.A)}%  reg ${Math.round(r.share.B)}%  oth ${Math.round(r.share.O)}%\n` +
          `your buzz ${Math.round(r.buzz.P)} · your cadre ${Math.round(r.cadre.P)}\n` +
          (fits ? 'ON MESSAGE: conversion ×1.6 here' : 'OFF MESSAGE: conversion ×0.55 here') +
          '\nclick to plan a move here',
        x: UI.mouse.x,
        y: UI.mouse.y,
      };
    }
  };

  /* --------------------------------------------------------------- HUD bits */
  UI.resourceStrip = function (g, st, x, y, w) {
    const proj = SG.project(st);
    const items = [
      { k: 'WEEK', v: `${st.week}/${st.maxWeeks}`, c: UI.C.text, tip: 'Polling day is after the final week.' },
      { k: 'AP', v: `${st.ap}/${st.apMax}`, c: st.ap ? UI.C.gold : UI.C.dim2, tip: 'Action points. The scarcest thing you own.' },
      { k: 'FUNDS', v: '₹' + Math.round(st.funds), c: UI.C.green, tip: 'Rallies, ads and schemes all cost money.' },
      { k: 'CADRE', v: Math.round(st.cadre) + '', c: UI.C.blue, tip: 'Workers. Ground pushes and booth work spend them.' },
      {
        k: 'CREDIBILITY',
        v: Math.round(st.cred) + '',
        c: st.cred > 60 ? UI.C.green : st.cred > 35 ? UI.C.gold : UI.C.red,
        tip: 'Swings every conversion from 0.72× to 1.27×.\nMemes and defections burn it; org meetings repair it.',
      },
      {
        k: 'HEAT',
        v: st.heat.toFixed(1),
        c: st.heat >= 6 ? UI.C.red : st.heat >= 3 ? UI.C.heat : UI.C.dim,
        tip: 'Dirty-tricks meter. At 8 the Election Commission steps in.',
      },
    ];
    const cw = w / items.length;
    items.forEach((it, i) => {
      const ix = x + i * cw;
      UI.hit(ix, y, cw, 46, null, it.tip);
      d.text(g, it.k, ix + cw / 2, y + 13, { size: 9.5, fill: UI.C.dim2 });
      d.text(g, it.v, ix + cw / 2, y + 32, { size: 19, fill: it.c });
    });
    return proj;
  };

  /* The live exit poll — the number players actually plan against. */
  UI.projection = function (g, st, x, y, w, proj) {
    const seats = proj.seats;
    d.text(g, 'LIVE EXIT POLL', x + 8, y + 12, { size: 11, align: 'left', fill: UI.C.dim });
    d.text(g, `± ${proj.margin}`, x + w - 8, y + 12, { size: 11, align: 'right', fill: UI.C.dim2 });

    const bx = x + 8;
    const bw = w - 16;
    const by = y + 22;
    let cx = bx;
    ['P', 'A', 'B', 'O'].forEach((p) => {
      const ww = (seats[p] / SG.TOTAL_SEATS) * bw;
      g.fillStyle = SG.PARTIES[p].color;
      g.fillRect(cx, by, ww + 0.5, 20);
      if (ww > 26) d.text(g, seats[p] + '', cx + ww / 2, by + 11, { size: 11, fill: '#0b1020' });
      cx += ww;
    });
    // majority marker
    const mx = bx + (SG.MAJORITY / SG.TOTAL_SEATS) * bw;
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(mx, by - 4);
    g.lineTo(mx, by + 24);
    g.stroke();
    g.setLineDash([]);
    UI.hit(bx, by, bw, 20, null, `Projected seats if the week ended now.\nMajority is ${SG.MAJORITY} of ${SG.TOTAL_SEATS}.`);

    const need = SG.MAJORITY - seats.P;
    d.text(
      g,
      need > 0 ? `YOU ${seats.P} — ${need} short of majority` : `YOU ${seats.P} — MAJORITY (+${-need})`,
      x + w / 2,
      by + 36,
      { size: 13, fill: need > 0 ? UI.C.text : UI.C.green }
    );
    if (SG.allied(st))
      d.text(g, '⚠ MAHAGATHBANDHAN ACTIVE — rivals counted as one bloc', x + w / 2, by + 54, {
        size: 11,
        fill: UI.C.red,
      });
    else if (st.alliance)
      d.text(g, '✔ alliance fractured — they are not speaking', x + w / 2, by + 54, { size: 11, fill: UI.C.green });
  };

  UI.ticker = function (g, st, x, y, w, t) {
    d.fillRR(g, x, y, w, 24, 6, 'rgba(0,0,0,.4)');
    g.save();
    g.beginPath();
    d.rr(g, x, y, w, 24, 6);
    g.clip();
    const txt = '📰  ' + st.news;
    const tw = d.measure(g, txt, 12, 700) + 80;
    const off = (t * 42) % tw;
    d.text(g, txt, x + w - off, y + 12, { size: 12, weight: 700, align: 'left', fill: UI.C.dim });
    d.text(g, txt, x + w - off + tw, y + 12, { size: 12, weight: 700, align: 'left', fill: UI.C.dim });
    g.restore();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
