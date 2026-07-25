/* MITRON MAYHEM — engine, state machine, HUD, menus, scoring, persistence.
   Flow:  TITLE → CMD (command slam) → PLAY (microgame) → RESULT → …
          every 4 rounds a SPEED UP, every 8 rounds the 8 PM ADDRESS boss. */
(function (MM) {
  'use strict';

  const C = MM.C;
  const d = MM.d;
  const W = MM.W;
  const H = MM.H;
  const I = MM.input;
  const FX = MM.fx;

  /* -------------------------------------------------------------- persistence */
  const KEY = 'mitron-mayhem-v1';
  const store = {
    data: { high: 0, cards: [], plays: 0, muted: false, music: true, bestCombo: 0 },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) Object.assign(this.data, JSON.parse(raw));
      } catch (e) {}
      return this.data;
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {}
    },
  };
  store.load();
  MM.store = store;

  /* --------------------------------------------------------------- game state */
  const S = {
    TITLE: 'title',
    HOWTO: 'howto',
    CARDS: 'cards',
    CMD: 'cmd',
    PLAY: 'play',
    RESULT: 'result',
    SPEED: 'speed',
    BOSSINTRO: 'bossintro',
    OVER: 'over',
  };

  const G = {
    state: S.TITLE,
    st: 0, // seconds in current state
    score: 0,
    lives: 3,
    level: 1,
    round: 0,
    combo: 0,
    bestCombo: 0,
    speed: 1,
    bag: [],
    def: null,
    a: null,
    result: null,
    paused: false,
    menu: 0,
    toast: null,
    pendingBoss: false,
    wonBoss: false,
    newCards: [],
    cardPage: 0,
    hype: '',
    hypeT: 0,
  };
  MM.G = G;

  const HYPE = [
    'BAHUT BADHIYA!',
    'KYA BAAT, KYA BAAT!',
    'MITRON, UNSTOPPABLE!',
    '56-INCH CONFIDENCE!',
    'MEME MAHAYUDH!',
    'DESH KA MOOD BANA DIYA!',
    'TRENDING NO. 1!',
  ];
  const RANKS = [
    [1500, 'BOOTH VOLUNTEER', 'You handed out one pamphlet and left.'],
    [4000, 'WARD MEMBER', 'Local fame. Free chai at exactly one stall.'],
    [9000, 'MLA MATERIAL', 'People now touch your feet at weddings.'],
    [16000, 'CABINET MINISTER', 'Your speeches trend for a full six hours.'],
    [28000, 'MEME MUKHYAMANTRI', 'WhatsApp uncles forward YOUR memes now.'],
    [Infinity, 'VISHWAGURU OF MEMES', 'The multiverse bows. Mitron, you did it.'],
  ];

  /* -------------------------------------------------------------------- setup */
  const cv = document.getElementById('game');
  const g = cv.getContext('2d');
  let scale = 1;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const availW = cv.parentElement.clientWidth;
    const availH = cv.parentElement.clientHeight;
    scale = Math.min(availW / W, availH / H);
    cv.style.width = W * scale + 'px';
    cv.style.height = H * scale + 'px';
    cv.width = Math.round(W * scale * dpr);
    cv.height = Math.round(H * scale * dpr);
    I.setTransform(scale, 0, 0);
  }
  addEventListener('resize', resize);

  I.attach(cv);
  FX.initPetals();

  /* Bind the on-screen pad (phones / tablets). */
  ['left', 'right', 'up', 'down', 'action'].forEach((k) => {
    const el = document.querySelector(`[data-key="${k}"]`);
    if (el) I.bindButton(el, k);
  });
  const padEl = document.getElementById('pad');
  if (matchMedia('(pointer: coarse)').matches && padEl) padEl.classList.add('show');

  function firstGesture() {
    MM.audio.resume();
    if (store.data.music && !MM.audio.musicPlaying()) MM.audio.music(true);
    MM.audio.setMuted(!!store.data.muted);
  }
  ['pointerdown', 'keydown'].forEach((e) => addEventListener(e, firstGesture, { once: true }));

  /* ------------------------------------------------------------ state helpers */
  function setState(s) {
    G.state = s;
    G.st = 0;
  }

  function unlock(id) {
    if (!id || store.data.cards.includes(id)) return;
    store.data.cards.push(id);
    store.save();
    const card = MM.cardById(id);
    if (card) {
      G.toast = { card, t: 0 };
      G.newCards.push(id);
    }
  }

  function mult() {
    return 1 + Math.min(2.5, G.combo * 0.15);
  }

  function nextFromBag() {
    if (!G.bag.length) G.bag = MM.shuffle(MM.games.map((_, i) => i));
    // avoid an immediate repeat of the game we just played
    if (MM.games.length > 1 && G.def && MM.games[G.bag[0]] === G.def && G.bag.length > 1) {
      G.bag.push(G.bag.shift());
    }
    return MM.games[G.bag.shift()];
  }

  function startRun() {
    G.score = 0;
    G.lives = 3;
    G.level = 1;
    G.round = 0;
    G.combo = 0;
    G.bestCombo = 0;
    G.speed = 1;
    G.bag = [];
    G.def = null;
    G.newCards = [];
    G.wonBoss = false;
    store.data.plays++;
    store.save();
    beginRound(nextFromBag());
  }

  function beginRound(def) {
    G.def = def;
    const clock = def.isBoss ? def.time : Math.max(3.2, def.time / (1 + (G.speed - 1) * 0.55));
    const a = {
      st: {},
      t: 0,
      clock,
      timeLeft: clock,
      frac: 0,
      speed: G.speed,
      level: G.level,
      in: I,
      done: false,
      sfx: (n) => MM.audio.sfx(n),
      pop: (t, x, y, o) => FX.pop(t, x, y, o),
      shake: (n) => FX.shake(n),
      flash: (c) => FX.flash(c),
      bonus: (n) => {
        G.score += Math.round(n * mult());
      },
      breakCombo: () => {
        G.combo = 0;
      },
      win: (m) => finish(true, m),
      lose: (m) => finish(false, m),
    };
    G.a = a;
    def.init(a);
    setState(S.CMD);
    MM.audio.sfx(def.isBoss ? 'conch' : 'tabla');
    I.clear();
  }

  function finish(won, msg) {
    const a = G.a;
    if (a.done) return;
    a.done = true;
    G.result = { won, msg, boss: !!G.def.isBoss };
    if (won) {
      const timeBonus = Math.round(a.timeLeft * 12);
      const base = (G.def.isBoss ? 900 : 260) + G.level * 45 + timeBonus;
      const gain = Math.round(base * mult());
      G.result.gain = gain;
      G.score += gain;
      G.combo++;
      G.bestCombo = Math.max(G.bestCombo, G.combo);
      unlock(G.def.card);
      if (G.def.isBoss) {
        G.wonBoss = true;
        G.lives = Math.min(5, G.lives + 1);
      }
      if (G.combo >= 2) {
        G.hype = HYPE[Math.min(HYPE.length - 1, G.combo - 2)];
        G.hypeT = 1.4;
      }
      MM.audio.sfx(G.def.isBoss ? 'fanfare' : 'win');
      FX.flash('rgba(120,255,140,.7)');
      FX.confetti(G.def.isBoss ? 140 : 40);
    } else {
      G.combo = 0;
      G.lives--;
      G.result.gain = 0;
      MM.audio.sfx('lose');
      FX.flash('rgba(255,60,50,.8)');
      FX.shake(18);
    }
    setState(S.RESULT);
    I.clear();
  }

  function afterResult() {
    if (G.lives <= 0) {
      gameOver();
      return;
    }
    G.round++;
    // difficulty steps up every 4 rounds; every 8th round is the boss instead
    if (G.round % 4 === 0) {
      G.level++;
      G.speed = Math.min(2.3, 1 + (G.level - 1) * 0.13);
      MM.audio.setTempo(100 + G.level * 7, Math.min(1, (G.level - 1) / 6));
    }
    if (G.round % 8 === 0) {
      setState(S.BOSSINTRO);
      MM.audio.sfx('conch');
    } else if (G.round % 4 === 0) {
      setState(S.SPEED);
      MM.audio.sfx('speedup');
    } else {
      beginRound(nextFromBag());
    }
  }

  function gameOver() {
    if (G.bestCombo >= 6) unlock('combo');
    if (G.score >= 12000) unlock('fakir');
    if (MM.games.every((x) => store.data.cards.includes(x.card))) unlock('vishwaguru');
    if (G.score > store.data.high) {
      store.data.high = G.score;
      G.newHigh = true;
    } else G.newHigh = false;
    store.data.bestCombo = Math.max(store.data.bestCombo || 0, G.bestCombo);
    store.save();
    MM.audio.sfx('gameover');
    setState(S.OVER);
    I.clear();
  }

  function rankFor(score) {
    for (const r of RANKS) if (score < r[0]) return r;
    return RANKS[RANKS.length - 1];
  }

  /* -------------------------------------------------------------------- update */
  function update(dt) {
    G.st += dt;
    I.anyRecent += dt;
    G.hypeT = Math.max(0, G.hypeT - dt);
    if (G.toast) {
      G.toast.t += dt;
      if (G.toast.t > 3) G.toast = null;
    }
    FX.update(dt);

    // global toggles
    if (I.hit('mute')) {
      store.data.muted = !store.data.muted;
      MM.audio.setMuted(store.data.muted);
      store.save();
    }

    if (G.paused) {
      if (I.hit('pause') || I.hit('action')) {
        G.paused = false;
        I.clear();
      }
      return;
    }

    switch (G.state) {
      case S.TITLE:
        titleUpdate();
        break;
      case S.HOWTO:
      case S.CARDS:
        if (I.hit('action') || I.hit('pause')) {
          MM.audio.sfx('ui');
          setState(S.TITLE);
        }
        if (G.state === S.CARDS) {
          if (I.hit('right')) {
            G.cardPage = (G.cardPage + 1) % 2;
            MM.audio.sfx('move');
          }
          if (I.hit('left')) {
            G.cardPage = (G.cardPage + 1) % 2;
            MM.audio.sfx('move');
          }
        }
        break;
      case S.CMD: {
        const dur = G.def.isBoss ? 1.6 : Math.max(0.72, 1.15 / (1 + (G.speed - 1) * 0.5));
        if (I.hit('pause')) G.paused = true;
        if (G.st >= dur) {
          setState(S.PLAY);
          I.clear();
        }
        break;
      }
      case S.PLAY: {
        if (I.hit('pause')) {
          G.paused = true;
          I.clear();
          break;
        }
        const a = G.a;
        const prev = Math.ceil(a.timeLeft);
        a.t += dt;
        a.timeLeft -= dt;
        a.frac = 1 - a.timeLeft / a.clock;
        if (Math.ceil(a.timeLeft) !== prev && a.timeLeft < 3 && a.timeLeft > 0) MM.audio.sfx('ui');
        G.def.update(dt, a);
        if (!a.done && a.timeLeft <= 0) finish(false, 'Time khatam, mitron!');
        break;
      }
      case S.RESULT: {
        const dur = G.result.won ? (G.result.boss ? 2.2 : 1.05) : 1.5;
        if (G.st >= dur) afterResult();
        break;
      }
      case S.SPEED:
        if (G.st >= 1.5 || I.hit('action')) beginRound(nextFromBag());
        break;
      case S.BOSSINTRO:
        if (G.st >= 2.6 || I.hit('action')) beginRound(MM.boss);
        break;
      case S.OVER:
        if (G.st > 0.7) {
          if (I.hit('action')) {
            MM.audio.sfx('ui');
            startRun();
          } else if (I.hit('pause')) {
            MM.audio.sfx('ui');
            setState(S.TITLE);
          }
        }
        break;
    }
  }

  /* Small hook so the round machinery can be driven from tests / the console. */
  MM.dev = { beginRound, startRun, setState, S, boss: () => beginRound(MM.boss) };

  const MENU = ['START GAME', 'HOW TO PLAY', 'MEME CARDS', 'SOUND'];

  function titleUpdate() {
    if (I.hit('up')) {
      G.menu = (G.menu + MENU.length - 1) % MENU.length;
      MM.audio.sfx('move');
    }
    if (I.hit('down')) {
      G.menu = (G.menu + 1) % MENU.length;
      MM.audio.sfx('move');
    }
    // click straight on a menu row
    if (I.p.hit) {
      for (let i = 0; i < MENU.length; i++) {
        const y = 372 + i * 52;
        if (I.p.y > y - 22 && I.p.y < y + 22 && Math.abs(I.p.x - W / 2) < 220) {
          G.menu = i;
          choose();
          return;
        }
      }
    }
    if (I.hit('action')) choose();
  }

  function choose() {
    MM.audio.sfx('ui');
    firstGesture();
    if (G.menu === 0) startRun();
    else if (G.menu === 1) setState(S.HOWTO);
    else if (G.menu === 2) setState(S.CARDS);
    else {
      store.data.muted = !store.data.muted;
      MM.audio.setMuted(store.data.muted);
      store.save();
    }
  }

  /* ---------------------------------------------------------------------- draw */
  function drawScene(def, a) {
    const fn = MM.bg[def.scene] || MM.bg.rally;
    fn(g, a ? a.t : G.st, a && a.st ? a.st.scroll || 0 : 0);
  }

  function drawHUD() {
    const a = G.a;
    // top bar
    g.save();
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(9,14,32,.95)');
    gr.addColorStop(1, 'rgba(9,14,32,.55)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, 64);
    g.restore();

    d.text(g, 'SCORE', 24, 20, { size: 13, align: 'left', fill: 'rgba(255,255,255,.6)' });
    d.text(g, String(G.score).padStart(5, '0'), 24, 44, { size: 30, align: 'left', fill: C.gold, stroke: C.ink, lw: 5 });

    // lives as chai cups
    for (let i = 0; i < Math.max(3, G.lives); i++) {
      const x = W - 40 - i * 44;
      g.save();
      g.globalAlpha = i < G.lives ? 1 : 0.22;
      g.translate(x, 40);
      g.scale(0.62, 0.62);
      MM.art.chai(g, 0, 0, 1, i < G.lives ? 0.8 : 0, { steam: false });
      g.restore();
    }

    d.text(g, `LEVEL ${G.level}`, W / 2, 20, { size: 16, fill: C.white });
    d.text(g, `ROUND ${G.round + 1}`, W / 2, 44, { size: 22, fill: C.saffron, stroke: C.ink, lw: 4 });

    if (G.combo >= 2) {
      const pulse = 1 + Math.sin(G.st * 12) * 0.06;
      g.save();
      g.translate(258, 40);
      g.scale(pulse, pulse);
      d.text(g, `x${G.combo} COMBO`, 0, 0, { size: 20, fill: C.pink, stroke: C.ink, lw: 5 });
      g.restore();
    }

    // timer bar
    if (a && (G.state === S.PLAY || G.state === S.CMD)) {
      const p = MM.clamp(a.timeLeft / a.clock, 0, 1);
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(0, 64, W, 12);
      const col = p > 0.45 ? C.green : p > 0.2 ? C.gold : C.danger;
      g.fillStyle = col;
      g.fillRect(0, 64, W * p, 12);
      if (p < 0.25) {
        g.save();
        g.globalAlpha = 0.35 + Math.sin(G.st * 22) * 0.3;
        g.fillStyle = C.danger;
        g.fillRect(0, 64, W, 12);
        g.restore();
      }
    }
  }

  function drawHype() {
    if (G.hypeT <= 0) return;
    const t = 1 - G.hypeT / 1.4;
    g.save();
    g.globalAlpha = Math.min(1, (1 - t) * 2);
    g.translate(W / 2, 560);
    const s = MM.ease.outBack(Math.min(1, t * 5));
    g.rotate(-0.04);
    g.scale(s, s);
    d.text(g, G.hype, 0, 0, { size: 40, fill: C.pink, stroke: C.white, lw: 8 });
    g.restore();
  }

  function drawToast() {
    if (!G.toast) return;
    const t = G.toast.t;
    const slide = MM.ease.outCubic(Math.min(1, t * 3)) * (t > 2.5 ? 1 - (t - 2.5) / 0.5 : 1);
    g.save();
    g.globalAlpha = MM.clamp(slide, 0, 1);
    const x = W - 250;
    const y = H - 120 - slide * 10;
    d.fillRR(g, x, y, 230, 92, 12, 'rgba(11,21,51,.94)');
    d.strokeRR(g, x, y, 230, 92, 12, C.gold, 3);
    d.text(g, 'NEW MEME CARD!', x + 115, y + 22, { size: 17, fill: C.gold });
    d.text(g, G.toast.card.name, x + 115, y + 50, { size: 15, fill: C.white });
    d.text(g, 'saved to your gallery', x + 115, y + 72, { size: 12, weight: 600, fill: 'rgba(255,255,255,.6)' });
    g.restore();
  }

  /* Command slam: diagonal wipe + the verb hitting the screen like a stamp. */
  function drawCmd() {
    const def = G.def;
    drawScene(def, G.a);
    g.save();
    g.fillStyle = 'rgba(8,10,26,.72)';
    g.fillRect(0, 0, W, H);
    g.restore();

    const dur = def.isBoss ? 1.6 : Math.max(0.72, 1.15 / (1 + (G.speed - 1) * 0.5));
    const t = MM.clamp(G.st / dur, 0, 1);

    // sliding tricolour bands
    [C.saffron, C.white, C.green].forEach((col, i) => {
      const off = MM.ease.outCubic(MM.clamp(t * 1.8 - i * 0.12, 0, 1));
      g.save();
      g.globalAlpha = 0.9 * (1 - MM.clamp((t - 0.62) / 0.38, 0, 1));
      g.fillStyle = col;
      g.beginPath();
      const y = 176 + i * 66;
      g.moveTo(-200 + off * W * 1.5, y);
      g.lineTo(-120 + off * W * 1.5, y);
      g.lineTo(-60 + off * W * 1.5, y + 60);
      g.lineTo(-140 + off * W * 1.5, y + 60);
      g.closePath();
      g.fill();
      g.restore();
    });

    const s = MM.ease.outBack(MM.clamp(t * 3.4, 0, 1));
    g.save();
    g.translate(W / 2, 268);
    g.rotate(-0.045 + (1 - s) * 0.25);
    g.scale(s * 1.0, s * 1.0);
    d.text(g, def.cmd, 0, 0, { size: def.cmd.length > 12 ? 62 : 82, fill: C.gold, stroke: C.ink, lw: 12, shadow: 'rgba(0,0,0,.5)' });
    g.restore();

    if (t > 0.35) {
      g.save();
      g.globalAlpha = MM.clamp((t - 0.35) / 0.25, 0, 1);
      d.text(g, def.sub, W / 2, 358, { size: 26, fill: C.white, stroke: C.ink, lw: 6 });
      g.restore();
    }
    if (def.isBoss) d.text(g, '★ BOSS ROUND ★', W / 2, 172, { size: 30, fill: C.danger, stroke: C.ink, lw: 6 });
  }

  function drawResult() {
    drawScene(G.def, G.a);
    G.def.draw(g, G.a);
    g.save();
    g.fillStyle = G.result.won ? 'rgba(12,60,20,.55)' : 'rgba(70,8,10,.6)';
    g.fillRect(0, 0, W, H);
    const t = MM.clamp(G.st * 3.6, 0, 1);
    const s = MM.ease.outElastic(t);
    g.translate(W / 2, 250);
    g.rotate((1 - t) * 0.4 - 0.05);
    g.scale(s, s);
    d.text(g, G.result.won ? 'SAHI HAI!' : 'GALAT!', 0, 0, {
      size: 90,
      fill: G.result.won ? C.gold : C.danger,
      stroke: C.ink,
      lw: 12,
    });
    g.restore();
    d.text(g, G.result.msg, W / 2, 348, { size: 30, fill: C.white, stroke: C.ink, lw: 7 });
    if (G.result.won && G.result.gain)
      d.text(g, `+${G.result.gain}  ${G.combo > 1 ? `(x${mult().toFixed(2)} combo)` : ''}`, W / 2, 404, {
        size: 26,
        fill: C.gold,
        stroke: C.ink,
        lw: 6,
      });
    if (!G.result.won)
      d.text(g, `${G.lives} chai left`, W / 2, 404, { size: 24, fill: C.white, stroke: C.ink, lw: 5 });
  }

  function drawSpeed() {
    MM.bg.rally(g, G.st);
    const t = MM.clamp(G.st / 1.5, 0, 1);
    g.save();
    g.translate(W / 2, H / 2 - 40);
    const s = MM.ease.outBack(Math.min(1, t * 3));
    g.scale(s, s);
    g.rotate(Math.sin(G.st * 18) * 0.03);
    d.text(g, 'SPEED UP!', 0, 0, { size: 96, fill: C.saffron, stroke: C.ink, lw: 14 });
    g.restore();
    d.text(g, `LEVEL ${G.level} — sab kuch tez ho gaya!`, W / 2, H / 2 + 60, {
      size: 30,
      fill: C.white,
      stroke: C.ink,
      lw: 6,
    });
    MM.art.modi(g, W / 2, H - 20, 0.8, { t: G.st, mouth: 'grin', arms: 'up', eyes: 'wide' });
  }

  function drawBossIntro() {
    MM.bg.night(g, G.st);
    const t = MM.clamp(G.st / 2.6, 0, 1);
    g.save();
    g.globalAlpha = 0.5 + Math.sin(G.st * 6) * 0.2;
    d.sunburst(g, W / 2, H / 2, 800, 18, G.st * 0.4, 'rgba(255,60,50,.25)', 'rgba(0,0,0,0)');
    g.restore();
    MM.art.modi(g, W / 2, H - 10, 1.5 * MM.ease.outCubic(Math.min(1, t * 2)), {
      t: G.st,
      mouth: 'flat',
      arms: 'point',
      eyes: 'wide',
      brow: 'up',
    });
    d.text(g, 'IT IS 8:00 PM.', W / 2, 150, { size: 46, fill: C.danger, stroke: C.ink, lw: 10 });
    if (t > 0.35) d.text(g, 'HE IS ON YOUR TELEVISION.', W / 2, 210, { size: 32, fill: C.white, stroke: C.ink, lw: 7 });
    if (t > 0.62) d.text(g, '★ BOSS ROUND ★', W / 2, 268, { size: 30, fill: C.gold, stroke: C.ink, lw: 6 });
  }

  function drawTitle() {
    MM.bg.rally(g, G.st);
    FX.drawPetals(g, 0.55);
    // logo block
    const bob = Math.sin(G.st * 1.6) * 5;
    MM.art.modi(g, W - 168, H - 12, 1.0, { t: G.st, mouth: 'grin', arms: 'wave', eyes: 'open' });
    MM.art.chai(g, 120, H - 130, 1.5, 0.8, { steam: true, t: G.st });

    g.save();
    g.translate(W / 2, 116 + bob);
    g.rotate(-0.03);
    d.text(g, 'MITRON', 0, 0, { size: 96, fill: C.saffron, stroke: C.ink, lw: 14, shadow: 'rgba(0,0,0,.45)', shadowDy: 8 });
    d.text(g, 'MAYHEM', 0, 74, { size: 72, fill: C.white, stroke: C.ink, lw: 12, shadow: 'rgba(0,0,0,.45)', shadowDy: 8 });
    g.restore();
    d.text(g, '14 meme microgames  •  1 boss  •  0 chill', W / 2, 224 + bob, {
      size: 21,
      fill: C.gold,
      stroke: C.ink,
      lw: 5,
    });

    // menu
    MENU.forEach((m, i) => {
      const on = i === G.menu;
      const label = i === 3 ? `SOUND: ${store.data.muted ? 'OFF' : 'ON'}` : m;
      const y = 290 + i * 50;
      if (on) {
        d.fillRR(g, W / 2 - 190, y - 21, 380, 42, 10, 'rgba(255,153,51,.94)');
        MM.art.arrow(g, W / 2 - 214, y, 1.05, 'right', C.gold);
      }
      d.text(g, label, W / 2, y, { size: on ? 29 : 25, fill: on ? C.ink : C.white, stroke: on ? null : C.ink, lw: 5 });
    });

    d.fillRR(g, W / 2 - 250, 500, 500, 34, 17, 'rgba(11,21,51,.7)');
    d.text(g, `HIGH SCORE ${store.data.high}   •   CARDS ${store.data.cards.length}/${MM.cards.length}`, W / 2, 517, {
      size: 19,
      fill: C.white,
    });
    d.text(g, 'SPACE / TAP to select  •  ↑ ↓ to move', W / 2, 552, { size: 15, weight: 700, fill: 'rgba(255,255,255,.75)' });
    d.text(g, 'Affectionate parody of Indian meme culture. Not affiliated with anyone real.', W / 2, 578, {
      size: 13,
      weight: 700,
      fill: 'rgba(255,255,255,.55)',
    });
  }

  function drawHowto() {
    MM.bg.hall(g, G.st);
    d.fillRR(g, 60, 70, W - 120, H - 150, 18, 'rgba(9,14,32,.9)');
    d.text(g, 'HOW TO PLAY', W / 2, 118, { size: 44, fill: C.saffron, stroke: C.ink, lw: 8 });
    const lines = [
      ['A verb slams onto the screen. You get a few seconds. Obey it.', C.white],
      ['', C.white],
      ['SPACE / TAP  — the do-it button (cheer, hug, clap, jump, snap, pour)', C.gold],
      ['ARROWS / SWIPE — move, aim, choose, do yoga', C.gold],
      ['MOUSE — sweep the jhaadu, click pakodas, pick diyas', C.gold],
      ['KEYS 1-4 — answer the quiz, grab a numbered pakoda', C.gold],
      ['P / ESC — pause      M — mute', C.gold],
      ['', C.white],
      ['Win rounds to build a COMBO — the multiplier stacks fast.', C.white],
      ['Every 4 rounds everything speeds up. Every 8 rounds: 8 PM ADDRESS boss.', C.white],
      ['3 cups of chai = 3 lives. Beat the boss, get one back.', C.white],
      ['First win in each microgame unlocks its MEME CARD.', C.cyan],
    ];
    lines.forEach((ln, i) => d.text(g, ln[0], W / 2, 176 + i * 30, { size: 21, weight: 700, fill: ln[1] }));
    d.text(g, 'SPACE / TAP to go back', W / 2, H - 104, { size: 22, fill: C.white, stroke: C.ink, lw: 5 });
  }

  function drawCards() {
    MM.bg.night(g, G.st);
    d.text(g, 'MEME CARD GALLERY', W / 2, 52, { size: 40, fill: C.gold, stroke: C.ink, lw: 8 });
    const per = 9;
    const page = G.cardPage;
    const list = MM.cards.slice(page * per, page * per + per);
    const cw = 200;
    const ch = 150;
    list.forEach((card, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = W / 2 - (3 * cw + 2 * 20) / 2 + col * (cw + 20);
      const y = 86 + row * (ch + 16);
      MM.drawCard(g, card, x, y, cw, ch, store.data.cards.includes(card.id), G.st);
    });
    d.text(
      g,
      `PAGE ${page + 1} / 2   •   ← → to flip   •   SPACE to go back   •   ${store.data.cards.length}/${MM.cards.length} collected`,
      W / 2,
      H - 24,
      { size: 19, fill: C.white, stroke: C.ink, lw: 5 }
    );
  }

  function drawOver() {
    MM.bg.hall(g, G.st);
    const rank = rankFor(G.score);
    d.fillRR(g, 90, 50, W - 180, H - 110, 20, 'rgba(9,14,32,.93)');
    d.strokeRR(g, 90, 50, W - 180, H - 110, 20, C.saffron, 4);
    d.text(g, 'MEME REPORT CARD', W / 2, 100, { size: 40, fill: C.saffron, stroke: C.ink, lw: 8 });

    d.text(g, rank[1], W / 2, 168, { size: 46, fill: C.gold, stroke: C.ink, lw: 9 });
    d.text(g, rank[2], W / 2, 208, { size: 20, weight: 700, fill: 'rgba(255,255,255,.8)' });

    const rows = [
      ['FINAL SCORE', String(G.score)],
      ['ROUNDS SURVIVED', String(G.round + (G.lives > 0 ? 1 : 0))],
      ['BEST COMBO', 'x' + G.bestCombo],
      ['BOSS DEFEATED', G.wonBoss ? 'HAAN JI' : 'NAHI'],
      ['NEW CARDS', String(G.newCards.length)],
      ['HIGH SCORE', String(store.data.high)],
    ];
    rows.forEach((r, i) => {
      const y = 262 + i * 40;
      d.text(g, r[0], W / 2 - 250, y, { size: 21, align: 'left', weight: 700, fill: 'rgba(255,255,255,.75)' });
      d.text(g, r[1], W / 2 + 250, y, { size: 24, align: 'right', fill: C.white });
      g.save();
      g.globalAlpha = 0.18;
      g.strokeStyle = C.white;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(W / 2 - 250, y + 18);
      g.lineTo(W / 2 + 250, y + 18);
      g.stroke();
      g.restore();
    });

    if (G.newHigh) {
      g.save();
      g.translate(W - 210, 150);
      g.rotate(0.18 + Math.sin(G.st * 4) * 0.03);
      d.text(g, 'NEW HIGH!', 0, 0, { size: 30, fill: C.pink, stroke: C.white, lw: 7 });
      g.restore();
    }
    MM.art.modi(g, 148, H - 46, 0.46, {
      t: G.st,
      mouth: G.score > 3000 ? 'grin' : 'sad',
      arms: G.score > 3000 ? 'up' : 'namaste',
      eyes: G.score > 3000 ? 'closed' : 'open',
    });
    d.text(g, 'SPACE / TAP — play again      ESC — main menu', W / 2, H - 78, {
      size: 22,
      fill: C.gold,
      stroke: C.ink,
      lw: 5,
    });
  }

  function drawPause() {
    g.save();
    g.fillStyle = 'rgba(6,9,22,.82)';
    g.fillRect(0, 0, W, H);
    d.text(g, 'PAUSED', W / 2, H / 2 - 30, { size: 76, fill: C.saffron, stroke: C.ink, lw: 12 });
    d.text(g, 'chai break. press P / SPACE to continue', W / 2, H / 2 + 40, { size: 24, fill: C.white, stroke: C.ink, lw: 5 });
    g.restore();
  }

  function render() {
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    FX.applyShake(g);

    switch (G.state) {
      case S.TITLE:
        drawTitle();
        break;
      case S.HOWTO:
        drawHowto();
        break;
      case S.CARDS:
        drawCards();
        break;
      case S.CMD:
        drawCmd();
        break;
      case S.PLAY:
        drawScene(G.def, G.a);
        G.def.draw(g, G.a);
        break;
      case S.RESULT:
        drawResult();
        break;
      case S.SPEED:
        drawSpeed();
        break;
      case S.BOSSINTRO:
        drawBossIntro();
        break;
      case S.OVER:
        drawOver();
        break;
    }

    if (G.state === S.PLAY || G.state === S.CMD || G.state === S.RESULT) {
      FX.draw(g);
      drawHUD();
      drawHype();
    } else FX.draw(g);

    FX.drawFlash(g);
    drawToast();
    if (G.paused) drawPause();
    FX.drawScreen(g, G.st);
    g.restore();
  }

  /* ----------------------------------------------------------------- the loop */
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.034, (now - last) / 1000);
    last = now;
    dt = FX.consumeFreeze(dt);
    update(dt);
    render();
    I.endFrame();
    requestAnimationFrame(frame);
  }

  resize();
  MM.audio.setTempo(104, 0);
  requestAnimationFrame(frame);

  // hide the loading splash
  const boot = document.getElementById('boot');
  if (boot) boot.classList.add('gone');
})(window.MM);
