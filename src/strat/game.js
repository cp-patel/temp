/* CHUNAV CHANAKYA — screens, input and the main loop.
   Reuses the arcade's canvas/audio/input layer (window.MM) and drives the pure
   rules engine in model.js. No timers on any decision: the whole game waits
   for you to think. */
(function (root) {
  'use strict';

  const SG = root.SG;
  const MM = root.MM;
  const d = MM.d;
  const UI = SG.ui;
  const C = UI.C;

  MM.W = 1280;
  MM.H = 760;
  const W = MM.W;
  const H = MM.H;

  const cv = document.getElementById('game');
  const g = cv.getContext('2d');
  let scale = 1;
  let dpr = 1;

  const KEY = 'chunav-chanakya-v1';
  const store = {
    data: { best: 0, plays: 0, muted: false, wins: 0 },
    load() {
      try {
        Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || '{}'));
      } catch (e) {}
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {}
    },
  };
  store.load();
  SG.store = store;

  const G = {
    screen: 'title',
    st: null,
    sel: null,
    t: 0,
    draft: [],
    planks: [],
    difficulty: 1,
    menu: 0,
    report: null,
    reveal: null,
    coalition: null,
    previews: null,
    previewKey: '',
    toast: null,
    log: [],
  };
  SG.G = G;

  /* ------------------------------------------------------------------ setup */
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const availW = cv.parentElement.clientWidth;
    const availH = cv.parentElement.clientHeight;
    scale = Math.min(availW / W, availH / H);
    cv.style.width = W * scale + 'px';
    cv.style.height = H * scale + 'px';
    cv.width = Math.round(W * scale * dpr);
    cv.height = Math.round(H * scale * dpr);
    MM.input.setTransform(scale, 0, 0);
  }
  addEventListener('resize', resize);
  MM.input.attach(cv);
  MM.fx.initPetals();

  cv.addEventListener('pointermove', () => {
    UI.mouse.x = MM.input.p.x;
    UI.mouse.y = MM.input.p.y;
  });
  cv.addEventListener('pointerdown', () => {
    UI.mouse.x = MM.input.p.x;
    UI.mouse.y = MM.input.p.y;
    audioOn();
    const r = UI.click(MM.input.p.x, MM.input.p.y);
    MM.audio.sfx(r === true ? 'ui' : r === 'disabled' ? 'bad' : 'move');
  });

  let audioStarted = false;
  function audioOn() {
    if (audioStarted) return;
    audioStarted = true;
    MM.audio.resume();
    MM.audio.setMuted(!!store.data.muted);
    MM.audio.setTempo(86, 0.15);
    MM.audio.music(true);
  }

  function toast(text, col) {
    G.toast = { text, col: col || C.gold, t: 0 };
  }

  /* ------------------------------------------------------------------ start */
  function beginCampaign() {
    G.st = SG.newGame({ leaders: G.draft.slice(), planks: G.planks.slice(), difficulty: G.difficulty });
    G.sel = null;
    G.screen = 'play';
    G.log = [];
    store.data.plays++;
    store.save();
    MM.audio.sfx('conch');
  }

  /* ------------------------------------------------------------- screen: title */
  function drawTitle() {
    bg(true);
    const bob = Math.sin(G.t * 1.4) * 5;
    d.text(g, 'CHUNAV', W / 2, 118 + bob, { size: 92, fill: C.saffron, stroke: '#12060a', lw: 12, shadow: 'rgba(0,0,0,.5)', shadowDy: 7 });
    d.text(g, 'CHANAKYA', W / 2, 192 + bob, { size: 70, fill: '#fff', stroke: '#12060a', lw: 11, shadow: 'rgba(0,0,0,.5)', shadowDy: 7 });
    d.text(g, 'a turn-based meme election strategy game', W / 2, 240 + bob, { size: 20, fill: C.gold });

    // the cast lined up along the bottom
    SG.LEADERS.forEach((L, i) => {
      const x = 118 + i * ((W - 236) / (SG.LEADERS.length - 1));
      const y = H - 158 + Math.sin(G.t * 1.6 + i * 0.7) * 5;
      g.save();
      g.globalAlpha = 0.95;
      SG.face(g, x, y, 0.62, L.id);
      g.restore();
      d.text(g, L.nick, x, y + 88, { size: 10.5, fill: C.dim });
    });

    const items = [
      ['NEW CAMPAIGN', () => (G.screen = 'draft')],
      ['HOW TO PLAY', () => (G.screen = 'howto')],
      ['ARCADE MODE (the old microgames)', () => (location.href = 'arcade.html')],
      [`SOUND: ${store.data.muted ? 'OFF' : 'ON'}`, () => {
        store.data.muted = !store.data.muted;
        MM.audio.setMuted(store.data.muted);
        store.save();
      }],
    ];
    items.forEach((it, i) => {
      const w = 440;
      const x = W / 2 - w / 2;
      const y = 296 + i * 52;
      UI.button(g, x, y, w, 42, it[0], { fn: it[1], size: 17 });
    });

    d.text(
      g,
      `best result: ${store.data.best} seats  ·  campaigns run: ${store.data.plays}`,
      W / 2,
      H - 208,
      { size: 14, fill: C.dim }
    );
    d.text(
      g,
      'Affectionate parody. Every character is an invented archetype and every "quote" was written for this game.',
      W / 2,
      H - 26,
      { size: 12, weight: 700, fill: C.dim2 }
    );
  }

  /* -------------------------------------------------------------- screen: draft */
  function drawDraft() {
    bg();
    d.text(g, 'PICK YOUR FOUR STAR CAMPAIGNERS', W / 2, 40, { size: 30, fill: C.saffron });
    d.text(g, 'Everyone you leave behind joins the opposition. Choose the board, not just the cards.', W / 2, 68, {
      size: 14,
      fill: C.dim,
    });

    const cols = 5;
    const cw = 224;
    const ch = 202;
    const gx = W / 2 - (cols * cw + (cols - 1) * 14) / 2;
    SG.LEADERS.forEach((L, i) => {
      const cx = gx + (i % cols) * (cw + 14);
      const cy = 92 + Math.floor(i / cols) * (ch + 14);
      const picked = G.draft.includes(L.id);
      const full = G.draft.length >= 4 && !picked;
      const over = UI.hit(cx, cy, cw, ch, () => {
        if (picked) G.draft = G.draft.filter((x) => x !== L.id);
        else if (G.draft.length < 4) G.draft.push(L.id);
        else toast('Only four campaigners — drop one first.', C.red);
      });

      d.fillRR(g, cx, cy, cw, ch, 12, picked ? 'rgba(255,153,51,.20)' : full ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)');
      d.strokeRR(g, cx, cy, cw, ch, 12, picked ? C.saffron : over ? '#fff' : C.line, picked ? 3 : 1.4);

      SG.face(g, cx + 54, cy + 62, 0.66, L.id);
      d.text(g, L.nick, cx + 104, cy + 26, { size: 14, align: 'left', fill: '#fff' });
      d.text(g, L.tag, cx + 104, cy + 44, { size: 11, weight: 700, align: 'left', fill: C.gold });
      wrapClip(g, L.passive, cx + 104, cy + 62, cw - 116, 11, 12.5, C.dim, 6);
      d.fillRR(g, cx + 8, cy + ch - 46, cw - 16, 38, 8, 'rgba(0,0,0,.35)');
      d.text(g, L.action.icon + '  ' + L.action.name, cx + 16, cy + ch - 33, { size: 12, align: 'left', fill: C.saffron });
      d.text(g, `${L.action.ap ? L.action.ap + ' AP' : 'FREE'} · ₹${L.action.funds}${L.action.cadre ? ' · ' + L.action.cadre + ' cadre' : ''}`, cx + 16, cy + ch - 17, {
        size: 11,
        weight: 700,
        align: 'left',
        fill: C.dim,
      });
      if (over) UI.tip = { text: L.draft + '\n' + L.action.desc, x: UI.mouse.x, y: UI.mouse.y };
    });

    // synergy readout — the actual decision
    const py = 92 + 2 * (ch + 14) + 6;
    UI.panel(g, W / 2 - 470, py, 940, 96, 'CHEMISTRY');
    const syn = SG.synergiesFor(G.draft);
    if (!syn.length) {
      d.text(g, G.draft.length < 2 ? 'Pick two or more to see how they get along.' : 'No special chemistry. Steady, unremarkable, functional.', W / 2, py + 58, {
        size: 14,
        fill: C.dim,
      });
    } else {
      syn.slice(0, 4).forEach((s, i) => {
        const sy = py + 44 + i * 17;
        d.text(g, (s.good ? '✔ ' : '✖ ') + s.name, W / 2 - 450, sy, {
          size: 12.5,
          align: 'left',
          fill: s.good ? C.green : C.red,
        });
        d.text(g, s.text, W / 2 - 210, sy, { size: 12, weight: 700, align: 'left', fill: C.dim });
      });
    }

    UI.button(g, W / 2 - 250, H - 56, 160, 40, '← BACK', { fn: () => (G.screen = 'title') });
    UI.button(g, W / 2 + 90, H - 56, 220, 40, `NEXT: MANIFESTO (${G.draft.length}/4)`, {
      fn: () => {
        if (G.draft.length === 4) G.screen = 'planks';
        else toast('Pick exactly four campaigners.', C.red);
      },
      disabled: G.draft.length !== 4,
      hoverBg: C.green,
    });
  }

  /* -------------------------------------------------------------- screen: planks */
  function drawPlanks() {
    bg();
    d.text(g, 'WRITE YOUR MANIFESTO', W / 2, 40, { size: 30, fill: C.saffron });
    d.text(g, 'Two promises. They decide WHERE your message lands — and what it costs you every week.', W / 2, 68, {
      size: 14,
      fill: C.dim,
    });
    d.text(g, 'On-message regions convert ×1.6. Off-message regions convert ×0.55.', W / 2, 90, { size: 13, fill: C.gold });

    const cols = 4;
    const cw = 268;
    const ch = 148;
    const gx = W / 2 - (cols * cw + (cols - 1) * 14) / 2;
    SG.PLANKS.forEach((p, i) => {
      const cx = gx + (i % cols) * (cw + 14);
      const cy = 120 + Math.floor(i / cols) * (ch + 16);
      const picked = G.planks.includes(p.id);
      const over = UI.hit(cx, cy, cw, ch, () => {
        if (picked) G.planks = G.planks.filter((x) => x !== p.id);
        else if (G.planks.length < 2) G.planks.push(p.id);
        else toast('Two planks only. Drop one first.', C.red);
      });
      d.fillRR(g, cx, cy, cw, ch, 12, picked ? 'rgba(34,181,115,.22)' : 'rgba(255,255,255,.07)');
      d.strokeRR(g, cx, cy, cw, ch, 12, picked ? C.green : over ? '#fff' : C.line, picked ? 3 : 1.4);
      d.text(g, SG.ISSUES[p.issue].icon + '  ' + p.name, cx + 14, cy + 24, { size: 15, align: 'left', fill: '#fff' });
      d.text(g, `covers ${SG.plankSeats(p.id)} seats`, cx + 14, cy + 46, { size: 12, align: 'left', fill: C.gold });
      wrap(g, p.blurb, cx + 14, cy + 66, cw - 28, 12.5, 14, C.dim);
      d.fillRR(g, cx + 10, cy + ch - 44, cw - 20, 34, 7, 'rgba(0,0,0,.35)');
      wrap(g, p.cost, cx + 18, cy + ch - 30, cw - 36, 11.5, 13, p.econ && (p.econ.funds > 0 || p.econ.cred > 0) ? C.green : C.heat);
      const regs = SG.REGIONS.filter((r) => r.issue === p.issue).map((r) => r.name).join(', ');
      if (over) UI.tip = { text: 'Regions: ' + regs, x: UI.mouse.x, y: UI.mouse.y };
    });

    UI.button(g, W / 2 - 250, H - 56, 160, 40, '← BACK', { fn: () => (G.screen = 'draft') });
    UI.button(g, W / 2 + 60, H - 56, 260, 40, `START CAMPAIGN (${G.planks.length}/2)`, {
      fn: () => {
        if (G.planks.length === 2) beginCampaign();
        else toast('Pick exactly two planks.', C.red);
      },
      disabled: G.planks.length !== 2,
      hoverBg: C.green,
    });

    // difficulty toggle
    const dx = W / 2 - 250;
    d.text(g, 'RIVALS:', dx - 90, H - 36, { size: 13, align: 'left', fill: C.dim });
    ['NORMAL', 'RUTHLESS'].forEach((lab, i) => {
      UI.button(g, dx - 30 + i * 96, H - 118, 90, 30, lab, {
        fn: () => (G.difficulty = i + 1),
        bg: G.difficulty === i + 1 ? C.blue : 'rgba(255,255,255,.08)',
        size: 12,
      });
    });
  }

  /* --------------------------------------------------------------- screen: play */
  function actionRows(st) {
    return SG.actionsFor(st, 'P');
  }

  function previewsFor(st, rid) {
    const key = rid + '|' + st.queue.length + '|' + st.week + '|' + Math.round(st.funds);
    if (G.previewKey === key && G.previews) return G.previews;
    const base = SG.project(st).seats.P;
    const out = {};
    actionRows(st).forEach((a) => {
      if (!SG.canQueue(st, a, rid).ok) {
        out[a.id] = null;
        return;
      }
      const c = SG.cloneLite(st);
      c.queue.push({ actionId: a.id, regionId: rid, cost: a.cost });
      out[a.id] = SG.project(c).seats.P - base;
    });
    G.previewKey = key;
    G.previews = out;
    return out;
  }

  function drawPlay() {
    const st = G.st;
    bg();

    // header
    d.text(g, 'CHUNAV CHANAKYA', 24, 30, { size: 20, align: 'left', fill: C.saffron });
    d.text(g, `${SG.TOTAL_SEATS} seats · majority ${SG.MAJORITY}`, 24, 52, { size: 12, align: 'left', fill: C.dim2 });
    const proj = UI.resourceStrip(g, st, 300, 8, 700);
    UI.button(g, W - 128, 14, 104, 34, '⏸ MENU', { fn: () => (G.screen = 'title'), size: 12 });

    UI.drawBoard(g, st, G.sel, {
      onPick: (id) => {
        G.sel = id;
        G.previewKey = '';
      },
    });

    // ---------------- right panel
    const px = 810;
    const pw = W - px - 24;
    UI.panel(g, px, 78, pw, 108);
    UI.projection(g, st, px, 86, pw, proj);

    if (G.sel) drawActionPanel(st, px, 196, pw, 372);
    else drawIntelPanel(st, px, 196, pw, 372);

    // queue
    UI.panel(g, px, 578, pw, 108, `THIS WEEK'S PLAN — ${st.queue.length} move${st.queue.length === 1 ? '' : 's'}`);
    if (!st.queue.length)
      d.text(g, 'Nothing planned yet. Click a region on the map.', px + pw / 2, 640, { size: 13, fill: C.dim2 });
    st.queue.slice(0, 5).forEach((q, i) => {
      const qy = 612 + i * 15;
      const def = SG.REGIONS.find((z) => z.id === q.regionId);
      d.text(g, `${q.icon || '•'} ${q.name} → ${def.name}`, px + 10, qy, { size: 11.5, align: 'left', fill: C.text });
      const bx = px + pw - 54;
      if (UI.button(g, bx, qy - 7, 44, 14, 'undo', { fn: () => (SG.unqueue(st, i), (G.previewKey = '')), size: 9.5, r: 4 })) {
      }
    });

    UI.button(g, px, 698, pw, 44, st.ap > 0 ? `END WEEK  (${st.ap} AP unused)` : 'END WEEK ▶', {
      fn: endWeek,
      hoverBg: C.green,
      size: 17,
      bg: st.ap > 0 ? 'rgba(255,255,255,.10)' : 'rgba(34,181,115,.35)',
      tip: st.ap > 0 ? 'You still have action points. Unused AP is wasted.' : null,
    });
    UI.ticker(g, st, 24, 740, 772, G.t);
  }

  function drawActionPanel(st, x, y, w, h) {
    const def = SG.REGIONS.find((z) => z.id === G.sel);
    const r = st.regions[G.sel];
    UI.panel(g, x, y, w, h, def.name + '  ·  ' + def.seats + ' seats');
    UI.button(g, x + w - 62, y + 5, 56, 20, 'close', { fn: () => (G.sel = null), size: 10, r: 5 });

    const fits = st.planks.includes(def.issue);
    d.text(g, `${SG.ISSUES[def.issue].icon} cares about ${SG.ISSUES[def.issue].name}`, x + 12, y + 44, {
      size: 12.5,
      align: 'left',
      fill: fits ? C.green : C.heat,
    });
    d.text(g, fits ? 'ON MESSAGE ×1.6' : 'OFF MESSAGE ×0.55', x + w - 12, y + 44, {
      size: 12,
      align: 'right',
      fill: fits ? C.green : C.heat,
    });
    UI.shareBar(g, x + 12, y + 54, w - 24, 9, r.share);
    d.text(g, `you ${Math.round(r.share.P)}%   buzz ${Math.round(r.buzz.P)}   cadre ${Math.round(r.cadre.P)}`, x + 12, y + 78, {
      size: 11.5,
      align: 'left',
      fill: C.dim,
    });
    d.text(g, '★ leader · right = seat change', x + w - 12, y + 78, { size: 10, weight: 700, align: 'right', fill: C.dim2 });

    const prev = previewsFor(st, G.sel);
    const rows = actionRows(st);
    const ry = y + 92;
    rows.forEach((a, i) => {
      const yy = ry + i * 24;
      const chk = SG.canQueue(st, a, G.sel);
      const over = UI.hit(x + 8, yy, w - 16, 22, chk.ok ? () => {
        SG.queue(st, a, G.sel);
        G.previewKey = '';
        MM.audio.sfx('coin');
        MM.fx.pop('+' + a.name, UI.mouse.x, UI.mouse.y - 10, { size: 15, c: C.gold });
      } : null, (a.desc || '') + (chk.ok ? '' : '\n⛔ ' + chk.why), !chk.ok);

      d.fillRR(g, x + 8, yy, w - 16, 22, 6, chk.ok ? (over ? 'rgba(255,153,51,.35)' : 'rgba(255,255,255,.06)') : 'rgba(255,0,0,.05)');
      d.text(g, (a.owner ? '★ ' : '') + (a.icon || '•') + ' ' + a.name, x + 14, yy + 11, {
        size: 11.5,
        align: 'left',
        fill: chk.ok ? (a.owner ? C.gold : C.text) : C.dim2,
      });
      const cost = `${a.cost.ap ? a.cost.ap + 'AP' : 'FREE'}${a.cost.funds > 0 ? ' ₹' + a.cost.funds : a.cost.funds < 0 ? ' +₹' + -a.cost.funds : ''}${a.cost.cadre ? ' ' + a.cost.cadre + '👥' : ''}`;
      d.text(g, cost, x + w - 76, yy + 11, { size: 10.5, weight: 800, align: 'right', fill: C.dim });
      const dv = prev[a.id];
      if (dv !== null && dv !== undefined)
        d.text(g, (dv >= 0 ? '+' : '') + dv, x + w - 16, yy + 11, {
          size: 12,
          align: 'right',
          fill: dv > 0 ? C.green : dv < 0 ? C.red : C.dim2,
        });
    });

  }

  function drawIntelPanel(st, x, y, w, h) {
    UI.panel(g, x, y, w, h, 'YOUR CAMPAIGN');
    const m = SG.mods(st, 'P');
    st.leaders.P.forEach((id, i) => {
      SG.leaderChip(g, x + 8, y + 36 + i * 46, w - 16, 42, id);
    });
    if (m.names.length) {
      d.text(g, 'CHEMISTRY: ' + m.names.join(' · '), x + 12, y + 232, { size: 11, align: 'left', fill: C.gold });
    }
    d.text(g, 'MANIFESTO: ' + st.planks.map((p) => SG.plankById(p).name).join('  +  '), x + 12, y + 252, {
      size: 11,
      align: 'left',
      fill: C.green,
    });

    d.fillRR(g, x + 8, y + 266, w - 16, 96, 8, 'rgba(255,0,0,.08)');
    d.text(g, '🕵  INTEL — what the rivals do NEXT WEEK', x + 16, y + 282, { size: 11.5, align: 'left', fill: C.red });
    if (!st.intel.length) d.text(g, 'No chatter this week.', x + 16, y + 306, { size: 11, align: 'left', fill: C.dim2 });
    st.intel.forEach((it, i) => {
      d.text(g, '• ' + it.text, x + 16, y + 304 + i * 17, { size: 11, weight: 700, align: 'left', fill: C.dim });
    });
    d.text(g, 'Block it, out-shout it, or let it land. Your call.', x + w / 2, y + h - 12, { size: 10.5, weight: 700, fill: C.dim2 });
  }

  /* ------------------------------------------------------------- week resolve */
  function endWeek() {
    const st = G.st;
    const before = SG.seatTotals(st).P;
    const rep = SG.endWeek(st);
    G.sel = null;
    G.previewKey = '';
    rep.delta = SG.seatTotals(st).P - before;
    G.report = rep;
    G.screen = 'resolve';
    MM.audio.sfx(rep.delta >= 0 ? 'good' : 'bad');
    if (rep.delta > 6) MM.fx.confetti(40);
  }

  function drawResolve() {
    const st = G.st;
    bg();
    const rep = G.report;
    UI.panel(g, W / 2 - 470, 60, 940, H - 160, `WEEK ${rep.week} — WHAT HAPPENED`);

    const dl = rep.delta;
    d.text(g, `${dl >= 0 ? '+' : ''}${dl} SEATS`, W / 2, 128, {
      size: 52,
      fill: dl > 0 ? C.green : dl < 0 ? C.red : C.dim,
      stroke: '#0b1020',
      lw: 8,
    });
    d.text(g, `projection now ${rep.seatsAfter.P} of ${SG.TOTAL_SEATS}`, W / 2, 166, { size: 15, fill: C.dim });

    let y = 210;
    rep.log.slice(0, 12).forEach((l) => {
      const mine = l.party === 'P' || l.good;
      d.text(g, (mine ? '▸ ' : '◂ ') + l.t, W / 2 - 440, y, {
        size: 13,
        weight: 700,
        align: 'left',
        fill: l.bad ? C.red : mine ? C.text : C.blue,
      });
      y += 21;
    });
    y += 8;
    rep.events.forEach((e) => {
      d.text(g, (e.bad ? '⚠ ' : '★ ') + e.t, W / 2 - 440, y, {
        size: 13.5,
        align: 'left',
        fill: e.bad ? C.red : C.gold,
      });
      y += 22;
    });

    const done = st.finished;
    UI.button(g, W / 2 - 130, H - 84, 260, 44, done ? 'COUNTING DAY ▶' : 'NEXT WEEK ▶', {
      fn: () => {
        if (done) startReveal();
        else G.screen = st.dilemma ? 'dilemma' : 'play';
      },
      hoverBg: C.green,
      size: 17,
    });
  }

  /* ----------------------------------------------------------------- dilemma */
  function drawDilemma() {
    const st = G.st;
    bg();
    const dm = st.dilemma;
    UI.panel(g, W / 2 - 440, 120, 880, 420, 'MONDAY MORNING PROBLEM');
    d.text(g, '📞', W / 2, 190, { size: 40, fill: C.gold });
    wrapCentre(g, dm.q, W / 2, 240, 780, 22, 26, C.text);

    dm.opts.forEach((o, i) => {
      const y = 300 + i * 74;
      const over = UI.hit(W / 2 - 400, y, 800, 62, () => {
        const chosen = SG.resolveDilemma(st, i);
        toast(chosen.note, C.gold);
        MM.audio.sfx('coin');
        G.screen = 'play';
      });
      d.fillRR(g, W / 2 - 400, y, 800, 62, 10, over ? 'rgba(255,153,51,.3)' : 'rgba(255,255,255,.07)');
      d.strokeRR(g, W / 2 - 400, y, 800, 62, 10, over ? '#fff' : C.line, 1.5);
      d.text(g, `${i + 1}.  ${o.t}`, W / 2 - 380, y + 24, { size: 16, align: 'left', fill: C.text });
      d.text(g, effectText(o.fx), W / 2 - 380, y + 46, { size: 12, weight: 700, align: 'left', fill: C.gold });
    });
    d.text(g, 'No timer. Think it through.', W / 2, H - 60, { size: 13, fill: C.dim2 });
  }

  function effectText(fx) {
    const bits = [];
    const add = (k, v, unit) => v && bits.push(`${v > 0 ? '+' : ''}${v}${unit || ''} ${k}`);
    add('CREDIBILITY', fx.cred);
    add('HEAT', fx.heat);
    add('FUNDS', fx.funds);
    add('CADRE', fx.cadre);
    add('AP next week', fx.apNext);
    if (fx.buzzAll) bits.push(`${fx.buzzAll > 0 ? '+' : ''}${fx.buzzAll} BUZZ everywhere`);
    if (fx.shareAll) bits.push(`+${fx.shareAll}% share everywhere`);
    if (fx.urbanShare) bits.push(`${fx.urbanShare > 0 ? '+' : ''}${fx.urbanShare}% in cities`);
    if (fx.stealBuzz) bits.push(`steal ${fx.stealBuzz} rival BUZZ`);
    if (fx.stealShare) bits.push(`+${fx.stealShare}% in the biggest region`);
    if (fx.swingBuzz) bits.push(`+${fx.swingBuzz} BUZZ in the 4 closest races`);
    if (fx.seatTax) bits.push(`−${fx.seatTax} seats to allies`);
    if (fx.regionShare) Object.entries(fx.regionShare).forEach(([k, v]) => bits.push(`+${v}% in ${SG.REGIONS.find((z) => z.id === k).name}`));
    return bits.length ? bits.join('   ·   ') : 'no direct effect';
  }

  /* ----------------------------------------------------------- election night */
  function startReveal() {
    const st = G.st;
    G.reveal = { i: 0, t: 0, tot: { P: 0, A: 0, B: 0, O: 0 }, done: false };
    G.screen = 'election';
    MM.audio.sfx('conch');
  }

  function drawElection() {
    const st = G.st;
    bg();
    const R = G.reveal;
    d.text(g, 'COUNTING DAY', W / 2, 52, { size: 40, fill: C.saffron, stroke: '#12060a', lw: 8 });
    d.text(g, 'Every channel has already called it. Twice. Differently.', W / 2, 82, { size: 14, fill: C.dim });

    R.t += 1 / 60;
    if (!R.done && R.t > 0.42) {
      R.t = 0;
      const def = SG.REGIONS[R.i];
      if (def) {
        const s = SG.seatsInRegion(st.regions[def.id], def.seats, SG.allied(st));
        ['P', 'A', 'B', 'O'].forEach((p) => (R.tot[p] += s[p]));
        R.i++;
        MM.audio.sfx(s.P > def.seats * 0.4 ? 'coin' : 'move');
      } else {
        R.done = true;
        if (st.seatTax) {
          const t = Math.min(st.seatTax, R.tot.P);
          R.tot.P -= t;
          R.tot.O += t;
        }
        MM.audio.sfx(R.tot.P >= SG.MAJORITY ? 'fanfare' : 'gameover');
        if (R.tot.P >= SG.MAJORITY) MM.fx.confetti(160);
      }
    }

    // region-by-region board
    SG.REGIONS.forEach((def, i) => {
      const rc = UI.regionRect(def);
      const revealed = i < R.i;
      const s = revealed ? SG.seatsInRegion(st.regions[def.id], def.seats, SG.allied(st)) : null;
      const winner = s ? ['P', 'A', 'B', 'O'].sort((a, b) => s[b] - s[a])[0] : null;
      d.fillRR(g, rc.x, rc.y + 40, rc.w, rc.h - 6, 8, revealed ? SG.PARTIES[winner].color : 'rgba(255,255,255,.07)');
      d.text(g, def.name, rc.x + rc.w / 2, rc.y + 58, { size: 10.5, fill: revealed ? '#0b1020' : C.dim2 });
      d.text(g, revealed ? `${s.P} / ${def.seats}` : '…', rc.x + rc.w / 2, rc.y + 78, {
        size: 15,
        fill: revealed ? '#0b1020' : C.dim2,
      });
    });

    // tally
    const bx = 840;
    UI.panel(g, bx, 120, 400, 300, 'NATIONAL TALLY');
    ['P', 'A', 'B', 'O'].forEach((p, i) => {
      const y = 168 + i * 56;
      d.text(g, SG.PARTIES[p].name, bx + 14, y, { size: 13, align: 'left', fill: SG.PARTIES[p].color });
      d.text(g, R.tot[p] + '', bx + 386, y, { size: 26, align: 'right', fill: '#fff' });
      UI.bar(g, bx + 14, y + 12, 372, 10, R.tot[p] / SG.TOTAL_SEATS, SG.PARTIES[p].color);
    });
    d.text(g, `majority mark ${SG.MAJORITY}`, bx + 200, 396, { size: 12, fill: C.dim });

    if (R.done) {
      const hung = R.tot.P < SG.MAJORITY;
      UI.button(g, bx, 448, 400, 48, hung ? 'GOVERNMENT FORMATION ▶' : 'SEE THE RESULT ▶', {
        fn: () => {
          SG.finish(st);
          st.result.seats = { ...R.tot };
          st.result.frac = R.tot.P / SG.TOTAL_SEATS;
          st.result.majority = R.tot.P >= SG.MAJORITY;
          st.result.largest = ['P', 'A', 'B', 'O'].sort((a, b) => R.tot[b] - R.tot[a])[0];
          st.result.coalitionPossible = !st.result.majority && st.result.largest === 'P' && R.tot.P + R.tot.O >= SG.MAJORITY;
          st.result.ending = SG.ENDINGS.find((e) => st.result.frac >= e.min);
          G.screen = st.result.coalitionPossible ? 'coalition' : 'end';
          finishUp();
        },
        hoverBg: C.green,
        size: 17,
      });
    } else {
      UI.button(g, bx, 448, 400, 48, 'SKIP TO THE END ▶', {
        fn: () => {
          while (R.i < SG.REGIONS.length) {
            const def = SG.REGIONS[R.i];
            const s = SG.seatsInRegion(st.regions[def.id], def.seats, SG.allied(st));
            ['P', 'A', 'B', 'O'].forEach((p) => (R.tot[p] += s[p]));
            R.i++;
          }
          R.done = true;
        },
        size: 15,
      });
    }
  }

  function finishUp() {
    const st = G.st;
    if (st.result.seats.P > store.data.best) {
      store.data.best = st.result.seats.P;
      st.result.newBest = true;
    }
    if (st.result.majority) store.data.wins++;
    store.save();
  }

  /* -------------------------------------------------------------- coalition */
  function drawCoalition() {
    const st = G.st;
    bg();
    UI.panel(g, W / 2 - 460, 90, 920, 470, 'HUNG HOUSE — GOVERNMENT FORMATION');
    d.text(g, `You are the largest party with ${st.result.seats.P} seats.`, W / 2, 148, { size: 22, fill: C.text });
    d.text(g, `${SG.MAJORITY - st.result.seats.P} short. The independents are, conveniently, at a resort.`, W / 2, 180, {
      size: 15,
      fill: C.gold,
    });

    SG.coalitionOffers(st).forEach((o, i) => {
      const y = 216 + i * 78;
      const afford = !o.cost.funds || st.funds >= o.cost.funds;
      const over = UI.hit(W / 2 - 420, y, 840, 66, afford ? () => {
        const res = SG.applyCoalition(st, o);
        if (res.ok) {
          MM.audio.sfx(st.result.majority ? 'fanfare' : 'lose');
          if (st.result.majority) MM.fx.confetti(140);
          finishUp();
          G.screen = 'end';
        }
      } : null, afford ? null : 'Not enough funds', !afford);
      d.fillRR(g, W / 2 - 420, y, 840, 66, 10, over ? 'rgba(255,153,51,.28)' : 'rgba(255,255,255,.07)');
      d.strokeRR(g, W / 2 - 420, y, 840, 66, 10, over ? '#fff' : C.line, 1.5);
      d.text(g, o.t, W / 2 - 400, y + 24, { size: 16, align: 'left', fill: afford ? C.text : C.dim2 });
      d.text(g, o.note, W / 2 - 400, y + 46, { size: 12, weight: 700, align: 'left', fill: C.dim });
      d.text(g, o.gives ? `+${o.gives} seats` : 'no deal', W / 2 + 400, y + 34, {
        size: 18,
        align: 'right',
        fill: o.gives ? C.green : C.red,
      });
    });
  }

  /* ------------------------------------------------------------------- ending */
  function drawEnd() {
    const st = G.st;
    const r = st.result;
    bg(true);
    UI.panel(g, W / 2 - 460, 60, 920, H - 140, 'RESULT');
    d.text(g, r.ending.title, W / 2, 132, { size: 46, fill: C.gold, stroke: '#12060a', lw: 9 });
    wrapCentre(g, r.ending.text, W / 2, 176, 780, 17, 22, C.text);

    const rows = [
      ['YOUR SEATS', r.seats.P + (r.allies ? ` (incl. ${r.allies} allies)` : '')],
      ['MAHA VIPAKSH', r.seats.A],
      ['KSHETRIYA MORCHA', r.seats.B],
      ['OTHERS', r.seats.O],
      ['CREDIBILITY LEFT', Math.round(st.cred)],
      ['HEAT', st.heat.toFixed(1)],
      ['SCORE', r.score],
    ];
    rows.forEach((row, i) => {
      const y = 250 + i * 34;
      d.text(g, row[0], W / 2 - 300, y, { size: 15, weight: 700, align: 'left', fill: C.dim });
      d.text(g, String(row[1]), W / 2 + 300, y, { size: 17, align: 'right', fill: C.text });
      g.save();
      g.globalAlpha = 0.14;
      g.strokeStyle = '#fff';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(W / 2 - 300, y + 14);
      g.lineTo(W / 2 + 300, y + 14);
      g.stroke();
      g.restore();
    });
    if (r.newBest) d.text(g, '★ NEW PERSONAL BEST', W / 2, H - 168, { size: 20, fill: C.saffron });

    // the cast, reacting
    st.leaders.P.forEach((id, i) => {
      const x = W / 2 - 180 + i * 120;
      SG.face(g, x, H - 118, 0.5, id, { mood: r.majority ? 'smile' : 'sad' });
    });

    UI.button(g, W / 2 - 250, H - 56, 230, 42, '↻ NEW CAMPAIGN', {
      fn: () => {
        G.draft = [];
        G.planks = [];
        G.screen = 'draft';
      },
      hoverBg: C.green,
    });
    UI.button(g, W / 2 + 20, H - 56, 230, 42, 'MAIN MENU', { fn: () => (G.screen = 'title') });
  }

  /* ------------------------------------------------------------------ how to */
  function drawHowto() {
    bg();
    UI.panel(g, 60, 40, W - 120, H - 110, 'HOW TO WIN AN ELECTION (IN TEN WEEKS)');
    const L = [
      ['THE GOAL', C.gold],
      [`Win ${SG.MAJORITY} of ${SG.TOTAL_SEATS} seats in ten weeks. Fall short and you negotiate — or sit in opposition.`, C.text],
      ['', C.text],
      ['THE LOOP', C.gold],
      ['BUZZ is momentum and it decays every week. VOTE SHARE is permanent. Converting one into the other is the game.', C.text],
      ['CADRE and CREDIBILITY set the exchange rate: at 100 credibility you convert 1.27×, at 0 you convert 0.72×.', C.text],
      ['Seats use share², so leading a region pays a bonus. Concentrate. Spreading thin loses.', C.text],
      ['', C.text],
      ['THE FIVE DECISIONS THAT ACTUALLY MATTER', C.gold],
      ['1. DRAFT — four campaigners from ten. Everyone you skip joins the opposition, with their abilities pointed at you.', C.text],
      ['2. CHEMISTRY — some pairs multiply, some bicker. A stronger leader who clashes is worth ~20 seats LESS.', C.text],
      ['3. MANIFESTO — two planks. On-message regions convert ×1.6, off-message ×0.55. Wide coverage costs more per week.', C.text],
      ['4. WHERE — every AP spent in a safe region is an AP not spent in a close one.', C.text],
      ['5. WHEN TO CASH OUT — buzz decays 45% a week. Bank it with GROUND PUSH or BOOTH MANAGEMENT before it evaporates.', C.text],
      ['', C.text],
      ['THINGS THAT WILL HAPPEN TO YOU', C.gold],
      ['INTEL leaks the rivals\' moves one week early — block them, out-shout them, or accept the hit.', C.text],
      ['HEAT rises with memes and defections. At 8 the Election Commission takes an action point off you.', C.text],
      ['Run away with it and both rivals MERGE into a mahagathbandhan, counted as one bloc for seats.', C.text],
      ['Only PALTI JI can fracture that alliance. This is why you might draft a man who may defect on you.', C.text],
    ];
    L.forEach((l, i) => d.text(g, l[0], 92, 96 + i * 28, { size: l[1] === C.gold ? 15 : 14, weight: l[1] === C.gold ? 900 : 700, align: 'left', fill: l[1] }));
    UI.button(g, W / 2 - 110, H - 58, 220, 40, '← BACK', { fn: () => (G.screen = 'title') });
  }

  /* ------------------------------------------------------------------- chrome */
  function bg(festive) {
    g.fillStyle = '#080d1c';
    g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, 0, 60, W / 2, H, H * 1.2);
    gr.addColorStop(0, 'rgba(60,40,110,.55)');
    gr.addColorStop(1, 'rgba(6,10,24,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    if (festive) {
      d.sunburst(g, W / 2, H * 0.34, 980, 26, G.t * 0.06, 'rgba(255,153,51,.10)', 'rgba(255,255,255,.03)');
      MM.fx.drawPetals(g, 0.32);
    }
    g.save();
    g.globalAlpha = 0.05;
    d.dots(g, 0, 0, W, H, 30, 1.6, '#fff');
    g.restore();
  }

  function wrap(g2, text, x, y, maxw, size, lh, col) {
    const words = String(text).split(' ');
    let line = '';
    let yy = y;
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (d.measure(g2, test, size, 700) > maxw && line) {
        d.text(g2, line, x, yy, { size, weight: 700, align: 'left', fill: col });
        line = w;
        yy += lh;
      } else line = test;
    });
    if (line) d.text(g2, line, x, yy, { size, weight: 700, align: 'left', fill: col });
    return yy;
  }

  function wrapClip(g2, text, x, y, maxw, size, lh, col, maxLines) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (d.measure(g2, test, size, 700) > maxw && line) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => {
      const last = i === Math.min(maxLines, lines.length) - 1 && lines.length > maxLines;
      d.text(g2, last ? l.replace(/\s+\S*$/, '…') : l, x, y + i * lh, { size, weight: 700, align: 'left', fill: col });
    });
  }

  function wrapCentre(g2, text, cx, y, maxw, size, lh, col) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (d.measure(g2, test, size, 700) > maxw && line) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    if (line) lines.push(line);
    lines.forEach((l, i) => d.text(g2, l, cx, y + i * lh, { size, weight: 700, fill: col }));
    return y + lines.length * lh;
  }

  /* --------------------------------------------------------------- main loop */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.t += dt;
    MM.fx.update(dt);
    UI.reset();

    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    switch (G.screen) {
      case 'title': drawTitle(); break;
      case 'howto': drawHowto(); break;
      case 'draft': drawDraft(); break;
      case 'planks': drawPlanks(); break;
      case 'play': drawPlay(); break;
      case 'dilemma': drawDilemma(); break;
      case 'resolve': drawResolve(); break;
      case 'election': drawElection(); break;
      case 'coalition': drawCoalition(); break;
      case 'end': drawEnd(); break;
    }

    MM.fx.draw(g);
    if (G.toast) {
      G.toast.t += dt;
      const a = G.toast.t < 2.6 ? Math.min(1, G.toast.t * 4) * (G.toast.t > 2 ? 1 - (G.toast.t - 2) / 0.6 : 1) : 0;
      if (a <= 0) G.toast = null;
      else {
        g.save();
        g.globalAlpha = a;
        const tw = d.measure(g, G.toast.text, 14, 900) + 36;
        d.fillRR(g, W / 2 - tw / 2, H - 112, tw, 34, 17, 'rgba(8,12,26,.96)');
        d.strokeRR(g, W / 2 - tw / 2, H - 112, tw, 34, 17, G.toast.col, 1.6);
        d.text(g, G.toast.text, W / 2, H - 95, { size: 14, fill: G.toast.col });
        g.restore();
      }
    }
    UI.tooltip(g);
    MM.input.endFrame();
    requestAnimationFrame(frame);
  }

  // keyboard: numbers pick dilemma options, Esc backs out
  addEventListener('keydown', (e) => {
    audioOn();
    if (G.screen === 'dilemma' && /^Digit[1-3]$/.test(e.code)) {
      const i = +e.code.slice(5) - 1;
      if (G.st.dilemma && G.st.dilemma.opts[i]) {
        toast(SG.resolveDilemma(G.st, i).note, C.gold);
        G.screen = 'play';
      }
    }
    if (e.code === 'Escape') {
      if (G.sel) G.sel = null;
      else if (G.screen === 'play') G.screen = 'title';
    }
    if (e.code === 'Enter' && G.screen === 'play') endWeek();
    if (e.code === 'KeyM') {
      store.data.muted = !store.data.muted;
      MM.audio.setMuted(store.data.muted);
      store.save();
    }
  });

  resize();
  requestAnimationFrame(frame);
  const boot = document.getElementById('boot');
  if (boot) boot.classList.add('gone');
})(typeof window !== 'undefined' ? window : globalThis);
