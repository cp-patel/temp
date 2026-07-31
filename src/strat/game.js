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

  /* ---------------------------------------------------------------- autosave
     A campaign is ~20 minutes; losing it to a closed tab is unforgivable.
     Saved after every state change, cleared when the campaign ends. */
  const SAVE_KEY = 'chunav-campaign-v1';
  let savedCache; // undefined = not probed yet; null = no save; else the parsed state
  function autosave() {
    try {
      // never delete here: the save must survive the reveal + coalition screens,
      // where st.finished is already true but the result is not yet locked in.
      // finishUp() clears it once the outcome is final.
      if (G.st && !G.st.finished) localStorage.setItem(SAVE_KEY, SG.serialize(G.st));
      savedCache = undefined;
    } catch (e) {}
  }
  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    savedCache = undefined;
  }
  function savedCampaign() {
    if (savedCache !== undefined) return savedCache;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const st = raw ? SG.deserialize(raw) : null;
      savedCache = st && !st.finished && st.week <= st.maxWeeks ? st : null;
    } catch (e) {
      savedCache = null;
    }
    return savedCache;
  }
  function resumeCampaign() {
    const st = savedCampaign();
    if (!st) return toast('No campaign to resume.', C.red);
    G.st = st;
    savedCache = undefined; // the cached object is now the live game — reprobe next time
    G.sel = null;
    G.previewKey = '';
    G.advice = null;
    MM.audio.sfx('conch');
    nextBeat();
  }

  /* ------------------------------------------------------------------ start */
  function beginCampaign() {
    G.st = SG.newGame({ leaders: G.draft.slice(), planks: G.planks.slice(), difficulty: G.difficulty });
    G.sel = null;
    G.screen = 'play';
    G.log = [];
    G.advice = null;
    store.data.plays++;
    store.save();
    autosave();
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

    const items = [];
    const saved = savedCampaign();
    if (saved) items.push([`▶ RESUME CAMPAIGN (week ${saved.week} of ${saved.maxWeeks})`, resumeCampaign]);
    items.push(
      ['NEW CAMPAIGN', () => (G.screen = 'draft')],
      ['HOW TO PLAY', () => (G.screen = 'howto')],
      ['ARCADE MODE (the old microgames)', () => (location.href = 'arcade.html')],
      [`SOUND: ${store.data.muted ? 'OFF' : 'ON'}`, () => {
        store.data.muted = !store.data.muted;
        MM.audio.setMuted(store.data.muted);
        store.save();
      }]
    );
    items.forEach((it, i) => {
      const w = 440;
      const x = W / 2 - w / 2;
      const y = (saved ? 278 : 296) + i * 50;
      UI.button(g, x, y, w, 40, it[0], { fn: it[1], size: 16, hoverBg: i === 0 && saved ? C.green : undefined });
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
      if (UI.button(g, bx, qy - 7, 44, 14, 'undo', { fn: () => (SG.unqueue(st, i), (G.previewKey = ''), autosave()), size: 9.5, r: 4 })) {
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
        autosave();
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
    if (G.advice) return drawAdvicePanel(st, x, y, w, h);
    UI.panel(g, x, y, w, h, 'YOUR CAMPAIGN');
    UI.button(g, x + w - 118, y + 4, 112, 22, '💡 ADVISOR', {
      fn: () => {
        G.advice = SG.advise(st);
        if (!G.advice.length) {
          G.advice = null;
          toast('The advisor shrugs. Nothing affordable to suggest.', C.red);
        }
        MM.audio.sfx('ui');
      },
      size: 11,
      r: 6,
      tip: 'Ask the war room for this week\'s plan.\nFree — accept any, all, or none of it.',
    });
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

  /* The war room's suggested week: each row queues with one click. */
  function drawAdvicePanel(st, x, y, w, h) {
    UI.panel(g, x, y, w, h, '💡 THE WAR ROOM SUGGESTS');
    UI.button(g, x + w - 62, y + 4, 56, 22, 'close', { fn: () => (G.advice = null), size: 10, r: 6 });
    d.text(g, 'A plan, not an order. Click a line to queue it.', x + 12, y + 44, {
      size: 12,
      align: 'left',
      fill: C.dim,
    });
    G.advice.forEach((a, i) => {
      const ay = y + 62 + i * 62;
      const def = SG.REGIONS.find((z) => z.id === a.regionId);
      const act = SG.actionsFor(st, 'P').find((z) => z.id === a.actionId);
      const chk = act ? SG.canQueue(st, act, a.regionId) : { ok: false, why: 'unavailable' };
      const queuedAlready = st.queue.some((q) => q.actionId === a.actionId && q.regionId === a.regionId);
      const over = UI.hit(x + 8, ay, w - 16, 54, chk.ok && !queuedAlready ? () => {
        SG.queue(st, act, a.regionId);
        G.previewKey = '';
        autosave();
        MM.audio.sfx('coin');
      } : null, chk.ok ? null : '⛔ ' + chk.why, !chk.ok || queuedAlready);
      d.fillRR(g, x + 8, ay, w - 16, 54, 9, queuedAlready ? 'rgba(34,181,115,.18)' : over ? 'rgba(255,153,51,.3)' : 'rgba(255,255,255,.07)');
      d.strokeRR(g, x + 8, ay, w - 16, 54, 9, queuedAlready ? C.green : over ? '#fff' : C.line, 1.4);
      d.text(g, (a.icon || '•') + ' ' + a.name + '  →  ' + (def.short || def.name), x + 18, ay + 18, {
        size: 12.5,
        align: 'left',
        fill: queuedAlready ? C.green : C.text,
      });
      d.text(g, queuedAlready ? '✔ queued' : 'why: ' + a.reason, x + 18, ay + 38, {
        size: 11,
        weight: 700,
        align: 'left',
        fill: queuedAlready ? C.green : C.gold,
      });
    });
    d.text(g, 'The advisor plays a solid game. A great one is on you.', x + w / 2, y + h - 12, {
      size: 10.5,
      weight: 700,
      fill: C.dim2,
    });
  }

  /* ---------------------------------------------------------- first briefing
     One-time overlay on a player's very first campaign week. Four lines, one
     button — not a tutorial maze. */
  function briefingVisible() {
    return !store.data.coached && G.screen === 'play' && G.st && G.st.week === 1;
  }

  function drawBriefing() {
    g.save();
    // a full-canvas hit registered FIRST: UI.click scans in reverse, so the
    // card's own button (registered later) wins, and everything underneath is
    // swallowed instead of falling through the dim to the play screen.
    UI.hit(0, 0, W, H, () => {});
    g.fillStyle = 'rgba(5,8,18,.78)';
    g.fillRect(0, 0, W, H);
    const bx = W / 2 - 330;
    const by = H / 2 - 190;
    d.fillRR(g, bx, by, 660, 360, 14, 'rgba(14,22,44,.98)');
    d.strokeRR(g, bx, by, 660, 360, 14, C.gold, 2);
    d.text(g, 'WEEK 1 — YOUR FIRST BRIEFING', W / 2, by + 34, { size: 20, fill: C.gold });
    const lines = [
      ['1.', 'Click a REGION on the map. Green issue tag = your manifesto lands ×1.6 there.'],
      ['2.', 'Spend your 4 AP. Every action shows its projected SEAT change before you commit.'],
      ['3.', 'BUZZ ⚡ decays 45% a week — bank it with GROUND PUSH before it evaporates.'],
      ['4.', 'Stuck? The 💡 ADVISOR button suggests a full week. Accept any of it, or none.'],
    ];
    lines.forEach((l, i) => {
      d.text(g, l[0], bx + 34, by + 84 + i * 52, { size: 16, align: 'left', fill: C.saffron });
      wrapClipRet(g, l[1], bx + 62, by + 84 + i * 52, 560, 13.5, 18, C.text, 2);
    });
    UI.button(g, W / 2 - 110, by + 300, 220, 40, 'CHALO, SHURU KAREIN', {
      fn: () => {
        store.data.coached = true;
        store.save();
      },
      hoverBg: C.green,
      size: 15,
    });
    g.restore();
  }

  /* ------------------------------------------------------------- week resolve */
  function endWeek() {
    const st = G.st;
    const rep = SG.endWeek(st); // rep carries its own delta + headline
    G.sel = null;
    G.previewKey = '';
    G.report = rep;
    G.advice = null;
    G.screen = 'resolve';
    autosave();
    MM.audio.sfx(rep.delta >= 0 ? 'good' : 'bad');
    if (rep.delta > 6) MM.fx.confetti(40);
  }

  /* After a week resolves: story beat first, then the Monday problem, then play. */
  function nextBeat() {
    const st = G.st;
    if (st.finished) return startReveal();
    if (st.storyBeat) G.screen = 'story';
    else if (st.dilemma) G.screen = 'dilemma';
    else G.screen = 'play';
  }

  function drawResolve() {
    const st = G.st;
    const rep = G.report;
    bg();

    // ---- newsprint
    const px = 168;
    const pw = W - px * 2;
    const py = 40;
    const ph = H - 108;
    d.fillRR(g, px + 5, py + 6, pw, ph, 4, 'rgba(0,0,0,.45)');
    d.fillRR(g, px, py, pw, ph, 4, '#f1ebdd');
    g.save();
    g.globalAlpha = 0.05;
    d.dots(g, px, py, pw, ph, 7, 0.7, '#3a3226');
    g.restore();

    const ink = '#1b1710';
    const ink2 = '#5a5142';
    const rule = (y, lw) => {
      g.strokeStyle = ink;
      g.lineWidth = lw || 1.5;
      g.beginPath();
      g.moveTo(px + 26, y);
      g.lineTo(px + pw - 26, y);
      g.stroke();
    };

    // masthead
    const mast = SG.MASTHEADS[(rep.week + (st.seed % 4)) % SG.MASTHEADS.length];
    d.text(g, mast, W / 2, py + 40, { size: 38, fill: ink });
    rule(py + 60, 2.5);
    d.text(g, `WEEK ${rep.week} OF THE CAMPAIGN`, px + 30, py + 74, { size: 11, align: 'left', fill: ink2 });
    d.text(g, `PRICE ₹4  ·  ${SG.TOTAL_SEATS} SEATS  ·  MAJORITY ${SG.MAJORITY}`, px + pw - 30, py + 74, {
      size: 11,
      align: 'right',
      fill: ink2,
    });
    rule(py + 82);

    // headline
    const head = rep.headline || SG.frontPage(st, rep);
    wrapCentreClip(g, head, W / 2, py + 124, pw - 80, 40, 44, ink, 2);

    // ---- left column: the photo + your numbers
    const cx = px + 30;
    const photoW = 230;
    d.fillRR(g, cx, py + 186, photoW, 150, 3, '#d9d2c2');
    g.save();
    g.beginPath();
    d.rr(g, cx, py + 186, photoW, 150, 3);
    g.clip();
    const heroId = st.leaders.P[(rep.week - 1) % st.leaders.P.length];
    SG.face(g, cx + photoW / 2, py + 268, 1.05, heroId, { mood: rep.delta >= 0 ? 'smile' : 'sad' });
    g.restore();
    d.strokeRR(g, cx, py + 186, photoW, 150, 3, ink2, 1);
    d.text(g, SG.leaderById(heroId).nick + ' on the road this week', cx + photoW / 2, py + 350, {
      size: 10.5,
      weight: 700,
      fill: ink2,
    });

    const dl = rep.delta;
    d.text(g, (dl >= 0 ? '+' : '') + dl, cx + photoW / 2, py + 406, {
      size: 54,
      fill: dl > 0 ? '#137a3a' : dl < 0 ? '#a52018' : ink2,
    });
    d.text(g, 'SEATS THIS WEEK', cx + photoW / 2, py + 440, { size: 11, fill: ink2 });
    d.text(g, `PROJECTION  ${rep.seatsAfter.P} / ${SG.TOTAL_SEATS}`, cx + photoW / 2, py + 462, { size: 13, fill: ink });

    // ---- right column: what everyone did
    const rx = cx + photoW + 26;
    const rw = pw - photoW - 82;
    g.strokeStyle = ink2;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(rx - 13, py + 186);
    g.lineTo(rx - 13, py + 470);
    g.stroke();

    let y = py + 198;
    d.text(g, 'ON THE GROUND', rx, y, { size: 12, align: 'left', fill: '#a52018' });
    y += 20;
    rep.log.slice(0, 9).forEach((l) => {
      const mine = l.party === 'P' || l.good;
      d.text(g, (mine ? '▪ ' : '▫ ') + l.t, rx, y, {
        size: 11.5,
        weight: 700,
        align: 'left',
        fill: l.bad ? '#a52018' : mine ? ink : ink2,
      });
      y += 17;
    });
    if (rep.events.length) {
      y += 6;
      rep.events.slice(0, 3).forEach((e) => {
        y = wrapClipRet(g, (e.bad ? '⚠ ' : '★ ') + e.t, rx, y, rw, 12, 16, e.bad ? '#a52018' : '#8a5a10', 2) + 18;
      });
    }

    // ---- quote of the week
    const qy = py + ph - 92;
    rule(qy - 16);
    if (rep.taunt) {
      if (rep.taunt.leader) {
        g.save();
        g.globalAlpha = 0.9;
        SG.face(g, px + 62, qy + 34, 0.44, rep.taunt.leader, { mood: 'flat' });
        g.restore();
      }
      d.text(g, 'THEY SAID IT', px + 118, qy + 6, { size: 11, align: 'left', fill: '#a52018' });
      wrapClipRet(g, '“' + rep.taunt.text + '”', px + 118, qy + 28, pw - 200, 16, 20, ink, 2);
      d.text(g, '— ' + SG.PARTIES[rep.taunt.party].name, px + 118, qy + 68, { size: 11, align: 'left', fill: ink2 });
    }

    const done = st.finished;
    UI.button(g, W / 2 - 150, H - 52, 300, 40, done ? 'COUNTING DAY ▶' : 'CONTINUE ▶', {
      fn: () => (done ? startReveal() : nextBeat()),
      hoverBg: C.green,
      size: 17,
    });
  }

  /* -------------------------------------------------------------- story beat */
  function drawStory() {
    const st = G.st;
    const sb = st.storyBeat;
    if (!sb) return nextBeat();
    const arc = SG.ARCS.find((a) => a.id === sb.arcId);
    const beat = arc.beats[sb.beat];
    const text = SG.beatText(st, sb.arcId, sb.beat);
    bg();

    // breaking-news slab
    const px = 190;
    const pw = W - px * 2;
    const faceId0 = arc.id === 'star' ? SG.idleLeader(st) || st.leaders.P[0] : null;
    // measure the prose first so the card hugs its content
    const probeW = faceId0 ? pw - 190 : pw - 60;
    const nLines = Math.min(4, Math.ceil(d.measure(g, text, 19, 700) / probeW));
    const oy = Math.max(300, 176 + nLines * 26 + 34);
    const slabH = oy - 96 + beat.opts.length * 74 + 18;
    d.fillRR(g, px, 96, pw, slabH, 12, 'rgba(12,18,38,.97)');
    d.strokeRR(g, px, 96, pw, slabH, 12, C.red, 2);
    d.fillRR(g, px, 96, pw, 40, 12, 'rgba(200,40,34,.92)');
    const blink = Math.sin(G.t * 6) > 0;
    d.text(g, (blink ? '● ' : '  ') + 'BREAKING  ·  ' + arc.name, px + 16, 116, {
      size: 14,
      align: 'left',
      fill: '#fff',
    });
    d.text(g, `CHAPTER ${sb.beat + 1} OF ${arc.beats.length}`, px + pw - 16, 116, {
      size: 12,
      align: 'right',
      fill: 'rgba(255,255,255,.8)',
    });

    // a face reacting, if the arc is about one of yours
    const faceId = faceId0;
    if (faceId) {
      SG.face(g, px + 78, 214, 0.66, faceId, { mood: 'flat' });
      d.text(g, SG.leaderById(faceId).nick, px + 78, 292, { size: 11, fill: C.dim });
    }
    const tx = faceId ? px + 160 : px + 30;
    const tw = faceId ? pw - 190 : pw - 60;
    wrapClipRet(g, text, tx, 176, tw, 19, 26, C.text, 4);

    beat.opts.forEach((o, i) => {
      const y = oy + i * 74;
      const over = UI.hit(px + 24, y, pw - 48, 64, () => {
        const res = SG.resolveStoryBeat(st, i);
        toast(res.opt.note, C.gold);
        MM.audio.sfx('coin');
        autosave();
        nextBeat();
      });
      d.fillRR(g, px + 24, y, pw - 48, 64, 10, over ? 'rgba(255,153,51,.3)' : 'rgba(255,255,255,.07)');
      d.strokeRR(g, px + 24, y, pw - 48, 64, 10, over ? '#fff' : C.line, 1.5);
      d.text(g, `${i + 1}.  ${o.t}`, px + 44, y + 25, { size: 16, align: 'left', fill: C.text });
      d.text(g, effectText(o.fx), px + 44, y + 47, { size: 12, weight: 700, align: 'left', fill: C.gold });
    });
    d.text(g, 'This choice is remembered. Later chapters will refer to it.', W / 2, 96 + slabH + 26, {
      size: 13,
      fill: C.dim2,
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
        autosave();
        nextBeat();
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
    clearSave();
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

    UI.button(g, W / 2 - 345, H - 56, 200, 42, '📖 CAMPAIGN DIARY', { fn: () => (G.screen = 'diary'), size: 13 });
    UI.button(g, W / 2 - 130, H - 56, 200, 42, '⬇ RESULT CARD', { fn: downloadResultCard, size: 13, tip: 'Download a PNG of this result to share.' });
    UI.button(g, W / 2 + 85, H - 56, 130, 42, '↻ AGAIN', {
      fn: () => {
        G.draft = [];
        G.planks = [];
        G.screen = 'draft';
      },
      hoverBg: C.green,
      size: 13,
    });
    UI.button(g, W / 2 + 228, H - 56, 117, 42, 'MENU', { fn: () => (G.screen = 'title'), size: 13 });
  }

  /* ------------------------------------------------------------------- diary
     The run, retold: week-by-week swings plus the arc choices you made. This is
     where "that campaign where I released the full tape" becomes a story. */
  const FLAG_STORIES = {
    'tape.denied': 'You called the tape a deepfake. Nobody believed you, but the buzz survived.',
    'tape.blamed': 'You blamed a volunteer for the tape. He is famous now. You are not forgiven.',
    'tape.released': 'You released the FULL tape yourself. Analysts still call it "the gamble".',
    'tape.faced': 'You took every question on prime time for four hours. Respect was earned.',
    'tape.shouted': 'Your spokesperson out-shouted three anchors in one week. Ratings soared, dignity sank.',
    'tape.ignored': 'You let the tape story die of boredom while you campaigned twice as hard.',
    'defector.took': 'You sent the white Fortuner at midnight. The defector came. So did the headlines.',
    'defector.principled': 'You told the midnight caller to resign publicly first. He hung up. Your workers grew taller.',
    'defector.recorded': 'You recorded the midnight call and kept a small, radioactive asset.',
    'star.appeased': 'You handed your restless star the big rally. Insufferable, and brilliant.',
    'star.benched': 'You benched your star. He waited. Loudly. Near the opposition.',
    'star.promoted': 'You put your critic in charge of the manifesto. It became 94 pages long.',
    'merger.framed': 'When they merged against you, you made "one against many" your battle cry.',
    'merger.arithmetic': 'You attacked the merger\'s seat-sharing maths until their allies briefed against each other.',
    'merger.flooded': 'You ignored the merger circus and quietly flooded the swing regions.',
    'march.met': 'You met the long march at the city\'s edge and sat on the road with them.',
    'march.committee': 'You sent the march a committee. It will report after the election. Obviously.',
    'march.conceded': 'You conceded the marchers\' demand outright. The treasury made a small, wounded noise.',
  };

  function drawDiary() {
    const st = G.st;
    bg();
    UI.panel(g, W / 2 - 470, 40, 940, H - 130, '📖 THE CAMPAIGN DIARY — how it actually went');

    // week strip: a mini bar chart of your projection over time
    const hist = st.history || [];
    const cx0 = W / 2 - 430;
    const cw = 860;
    const barW = Math.min(64, cw / Math.max(1, hist.length) - 8);
    // scale bars to the run's own range so week-to-week movement is visible
    const lo = Math.min(...hist.map((z) => z.seats), SG.MAJORITY) * 0.88;
    const hi = Math.max(...hist.map((z) => z.seats), SG.MAJORITY) * 1.04;
    const scale = (v) => 18 + ((v - lo) / Math.max(1, hi - lo)) * 102;
    hist.forEach((hh, i) => {
      const x = cx0 + i * (cw / Math.max(1, hist.length)) + 4;
      const hgt = scale(hh.seats);
      const col = hh.delta > 0 ? C.green : hh.delta < 0 ? C.red : C.dim2;
      d.fillRR(g, x, 208 - hgt, barW, hgt, 3, col);
      d.text(g, 'W' + hh.week, x + barW / 2, 222, { size: 10, fill: C.dim2 });
      d.text(g, hh.seats + '', x + barW / 2, 208 - hgt - 9, { size: 10, fill: C.dim });
      UI.hit(x, 208 - hgt, barW, hgt, null, `Week ${hh.week}: ${hh.seats} seats (${hh.delta >= 0 ? '+' : ''}${hh.delta})\n${hh.headline}`);
    });
    // majority line
    const my = 208 - (hist.length ? scale(SG.MAJORITY) : 60);
    g.strokeStyle = 'rgba(255,255,255,.4)';
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(cx0, my);
    g.lineTo(cx0 + cw, my);
    g.stroke();
    g.setLineDash([]);
    d.text(g, 'majority', cx0 + cw - 4, my - 8, { size: 9.5, align: 'right', fill: C.dim2 });

    // best & worst week
    if (hist.length) {
      const best = hist.reduce((a, b) => (b.delta > a.delta ? b : a));
      const worst = hist.reduce((a, b) => (b.delta < a.delta ? b : a));
      d.text(g, `▲ Best week: W${best.week} (${best.delta >= 0 ? '+' : ''}${best.delta}) — “${best.headline}”`, W / 2 - 430, 254, { size: 13, align: 'left', fill: C.green });
      d.text(g, `▼ Worst week: W${worst.week} (${worst.delta >= 0 ? '+' : ''}${worst.delta}) — “${worst.headline}”`, W / 2 - 430, 276, { size: 13, align: 'left', fill: C.red });
    }

    // the choices that defined the run
    d.text(g, 'THE CHOICES THAT DEFINED IT', W / 2 - 430, 312, { size: 13, align: 'left', fill: C.gold });
    let dy = 336;
    let told = 0;
    Object.entries(st.arcFlags || {}).forEach(([arcId, flags]) => {
      Object.keys(flags).forEach((f) => {
        const line = FLAG_STORIES[arcId + '.' + f];
        if (line && told < 6) {
          dy = wrapClipRet(g, '• ' + line, W / 2 - 430, dy, 860, 13, 18, C.text, 2) + 8;
          told++;
        }
      });
    });
    if (!told) d.text(g, '• A clean, quiet campaign. No tapes, no midnight calls. Historians will be bored.', W / 2 - 430, dy, { size: 13, weight: 700, align: 'left', fill: C.dim });

    // who did the work
    const u = st.usage || {};
    const workhorse = st.leaders.P.slice().sort((a, b) => (u[b] || 0) - (u[a] || 0))[0];
    if (workhorse) {
      SG.face(g, W / 2 - 380, H - 168, 0.52, workhorse);
      d.text(g, `WORKHORSE OF THE CAMPAIGN: ${SG.leaderById(workhorse).nick} — ${u[workhorse] || 0} assignments`, W / 2 - 320, H - 178, {
        size: 13,
        align: 'left',
        fill: C.gold,
      });
      d.text(g, 'The rest of the cast will mention this in interviews for years.', W / 2 - 320, H - 158, { size: 11.5, weight: 700, align: 'left', fill: C.dim });
    }

    UI.button(g, W / 2 - 110, H - 74, 220, 40, '← BACK TO RESULT', { fn: () => (G.screen = 'end'), size: 14 });
  }

  /* ------------------------------------------------------------- result card
     A downloadable PNG of the outcome — the shareable artifact. Pure canvas,
     works from file://. Exposed on SG for tests. */
  SG.buildResultCard = function () {
    const st = G.st;
    const r = st.result;
    const cv2 = document.createElement('canvas');
    cv2.width = 1000;
    cv2.height = 560;
    const q = cv2.getContext('2d');
    // backdrop
    const gr = q.createLinearGradient(0, 0, 0, 560);
    gr.addColorStop(0, '#1b2350');
    gr.addColorStop(1, '#080d1c');
    q.fillStyle = gr;
    q.fillRect(0, 0, 1000, 560);
    MM.d.sunburst(q, 500, 180, 700, 22, 0.2, 'rgba(255,153,51,.10)', 'rgba(255,255,255,.03)');
    MM.d.text(q, 'CHUNAV CHANAKYA', 500, 52, { size: 30, fill: C.saffron, stroke: '#12060a', lw: 6 });
    MM.d.text(q, r.ending.title, 500, 130, { size: 58, fill: C.gold, stroke: '#12060a', lw: 10 });
    MM.d.text(q, `${r.seats.P} of ${SG.TOTAL_SEATS} seats`, 500, 186, { size: 26, fill: '#fff' });
    // seat bar
    let sx = 150;
    ['P', 'A', 'B', 'O'].forEach((p) => {
      const ww = (r.seats[p] / SG.TOTAL_SEATS) * 700;
      q.fillStyle = SG.PARTIES[p].color;
      q.fillRect(sx, 216, ww + 0.5, 26);
      sx += ww;
    });
    q.strokeStyle = '#fff';
    q.setLineDash([4, 4]);
    q.beginPath();
    const mx = 150 + (SG.MAJORITY / SG.TOTAL_SEATS) * 700;
    q.moveTo(mx, 208);
    q.lineTo(mx, 250);
    q.stroke();
    q.setLineDash([]);
    // the cast
    st.leaders.P.forEach((id, i) => {
      SG.face(q, 285 + i * 145, 360, 0.75, id, { mood: r.majority ? 'smile' : 'sad' });
      MM.d.text(q, SG.leaderById(id).nick, 285 + i * 145, 468, { size: 12, fill: 'rgba(255,255,255,.7)' });
    });
    MM.d.text(q, `manifesto: ${st.planks.map((p) => SG.plankById(p).name).join(' + ')}   ·   credibility ${Math.round(st.cred)}   ·   heat ${st.heat.toFixed(1)}`, 500, 508, {
      size: 14,
      fill: 'rgba(255,255,255,.65)',
    });
    MM.d.text(q, 'an affectionate parody — chunav chanakya, the meme election strategy game', 500, 538, {
      size: 11,
      weight: 700,
      fill: 'rgba(255,255,255,.4)',
    });
    return cv2.toDataURL('image/png');
  };

  function downloadResultCard() {
    try {
      const url = SG.buildResultCard();
      const a = document.createElement('a');
      a.href = url;
      a.download = `chunav-chanakya-${G.st.result.seats.P}-seats.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Result card downloaded. Go on, post it.', C.green);
    } catch (e) {
      toast('Could not build the card in this browser.', C.red);
    }
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

  function wrapClipRet(g2, text, x, y, maxw, size, lh, col, maxLines) {
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
    const shown = lines.slice(0, maxLines || 99);
    shown.forEach((l, i) => d.text(g2, l, x, y + i * lh, { size, weight: 700, align: 'left', fill: col }));
    return y + shown.length * lh;
  }

  function wrapCentreClip(g2, text, cx, y, maxw, size, lh, col, maxLines) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (d.measure(g2, test, size, 900) > maxw && line) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines || 99).forEach((l, i) => d.text(g2, l, cx, y + i * lh, { size, fill: col }));
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
  let crashes = 0;
  function frame(now) {
    try {
      drawFrame(now);
    } catch (e) {
      // A thrown draw must never kill requestAnimationFrame and freeze the board.
      if (crashes++ < 3) console.error('render error', e);
      G.sel = null;
      G.previewKey = '';
      G.previews = null;
    }
    MM.input.endFrame();
    requestAnimationFrame(frame);
  }

  function drawFrame(now) {
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
      case 'play':
        drawPlay();
        if (!store.data.coached && G.st && G.st.week === 1) drawBriefing();
        break;
      case 'story': drawStory(); break;
      case 'dilemma': drawDilemma(); break;
      case 'resolve': drawResolve(); break;
      case 'election': drawElection(); break;
      case 'coalition': drawCoalition(); break;
      case 'end': drawEnd(); break;
      case 'diary': drawDiary(); break;
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
  }

  // keyboard: numbers pick dilemma options, Esc backs out
  addEventListener('keydown', (e) => {
    audioOn();
    if (G.screen === 'dilemma' && /^Digit[1-3]$/.test(e.code)) {
      const i = +e.code.slice(5) - 1;
      if (G.st.dilemma && G.st.dilemma.opts[i]) {
        toast(SG.resolveDilemma(G.st, i).note, C.gold);
        autosave();
        nextBeat();
      }
    }
    if (e.code === 'Escape') {
      if (G.sel) G.sel = null;
      else if (G.screen === 'play') G.screen = 'title';
    }
    if (e.code === 'Enter' && G.screen === 'play' && !briefingVisible()) endWeek();
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
