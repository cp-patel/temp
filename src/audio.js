/* MITRON MAYHEM — procedural audio.
   Everything (tabla, tanpura drone, sitar-ish plucks, jingles, SFX) is
   synthesized with WebAudio at runtime. No audio files, no downloads. */
(function (MM) {
  'use strict';

  const A = (MM.audio = {});

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let started = false;

  A.muted = false;
  A.musicOn = true;

  /* Bhairavi-flavoured scale (semitones from tonic) — gives the melody an
     unmistakably Indian colour without needing samples. */
  const SCALE = [0, 1, 4, 5, 7, 8, 11, 12];
  const TONIC = 146.83; // D3

  const semi = (n) => TONIC * Math.pow(2, n / 12);
  const scaleNote = (deg) => {
    const oct = Math.floor(deg / SCALE.length);
    return semi(SCALE[((deg % SCALE.length) + SCALE.length) % SCALE.length] + 12 * oct);
  };

  A.init = function () {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // gentle limiter so stacked hits never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.34;
    musicBus.connect(comp);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.75;
    sfxBus.connect(comp);
  };

  A.resume = function () {
    A.init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    started = true;
  };

  A.ready = () => !!ctx && !A.muted;

  A.setMuted = function (m) {
    A.muted = m;
    if (master) master.gain.value = m ? 0 : 0.9;
  };

  /* ------------------------------------------------------------- primitives */
  function env(node, t, a, d, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g);
    return g;
  }

  function tone(freq, t, dur, type, peak, dest, detune) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    const g = env(o, t, Math.min(0.02, dur * 0.2), dur, peak);
    g.connect(dest || sfxBus);
    o.start(t);
    o.stop(t + dur + 0.08);
    return o;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }

  /* Tabla-ish membrane hit: pitched sine that drops fast + a noise transient. */
  function tabla(t, freq, peak, dest, bright) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    const g = env(o, t, 0.004, 0.22, peak);
    g.connect(dest || sfxBus);
    o.start(t);
    o.stop(t + 0.35);

    const n = noise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = bright ? 2600 : 1200;
    nf.Q.value = 1.2;
    const ng = env(nf, t, 0.002, bright ? 0.09 : 0.04, peak * 0.5);
    n.connect(nf);
    ng.connect(dest || sfxBus);
    n.start(t);
    n.stop(t + 0.2);
  }

  /* Plucked string (sitar-ish): detuned saw pair through a swept lowpass. */
  function pluck(freq, t, dur, peak, dest) {
    if (!ctx) return;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(9000, freq * 9), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 1.6), t + dur);
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g);
    g.connect(dest || sfxBus);
    [0, 8, -7].forEach((dt, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : 'triangle';
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(dt, t);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  /* ------------------------------------------------------------------- SFX  */
  const S = {
    ui: () => tone(660, ctx.currentTime, 0.07, 'square', 0.16),
    move: () => tone(420, ctx.currentTime, 0.05, 'triangle', 0.12),
    good: () => {
      const t = ctx.currentTime;
      [0, 4, 7].forEach((n, i) => tone(semi(24 + n), t + i * 0.045, 0.16, 'square', 0.14));
    },
    coin: () => {
      const t = ctx.currentTime;
      tone(1180, t, 0.06, 'square', 0.13);
      tone(1560, t + 0.05, 0.14, 'square', 0.12);
    },
    bad: () => {
      const t = ctx.currentTime;
      tone(200, t, 0.18, 'sawtooth', 0.16);
      tone(140, t + 0.08, 0.3, 'sawtooth', 0.14);
    },
    thud: () => tabla(ctx.currentTime, 70, 0.5),
    tabla: () => tabla(ctx.currentTime, 180, 0.4, null, true),
    whoosh: () => {
      const t = ctx.currentTime;
      const n = noise();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.25);
      f.Q.value = 0.8;
      const g = env(f, t, 0.03, 0.25, 0.2);
      n.connect(f);
      g.connect(sfxBus);
      n.start(t);
      n.stop(t + 0.4);
    },
    pour: () => {
      const t = ctx.currentTime;
      const n = noise();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1700;
      f.Q.value = 2.5;
      const g = env(f, t, 0.02, 0.14, 0.12);
      n.connect(f);
      g.connect(sfxBus);
      n.start(t);
      n.stop(t + 0.2);
    },
    camera: () => {
      const t = ctx.currentTime;
      tone(2400, t, 0.03, 'square', 0.12);
      const n = noise();
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 4000;
      const g = env(f, t, 0.001, 0.06, 0.16);
      n.connect(f);
      g.connect(sfxBus);
      n.start(t);
      n.stop(t + 0.1);
    },
    win: () => {
      const t = ctx.currentTime;
      [0, 4, 7, 12].forEach((n, i) => pluck(semi(24 + n), t + i * 0.07, 0.42, 0.2));
      tabla(t, 90, 0.5, null, false);
      tabla(t + 0.28, 150, 0.4, null, true);
    },
    lose: () => {
      const t = ctx.currentTime;
      [7, 4, 1, -2].forEach((n, i) => tone(semi(18 + n), t + i * 0.1, 0.3, 'sawtooth', 0.15));
      tabla(t + 0.42, 60, 0.55);
    },
    speedup: () => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(1500, t + 0.55);
      const g = env(o, t, 0.05, 0.6, 0.14);
      g.connect(sfxBus);
      o.start(t);
      o.stop(t + 0.8);
      for (let i = 0; i < 4; i++) tabla(t + i * 0.14, 120 + i * 40, 0.42, null, true);
    },
    conch: () => {
      // shankh blow for the boss reveal
      const t = ctx.currentTime;
      [0, 7].forEach((n, i) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(semi(12 + n) * 0.98, t);
        o.frequency.linearRampToValueAtTime(semi(12 + n), t + 0.5);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.13, t + 0.25);
        g.gain.setValueAtTime(0.13, t + 1.0);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
        o.connect(f);
        f.connect(g);
        g.connect(sfxBus);
        o.start(t);
        o.stop(t + 1.8);
      });
    },
    gameover: () => {
      const t = ctx.currentTime;
      [12, 11, 8, 7, 5, 4, 1, 0].forEach((n, i) => pluck(semi(12 + n), t + i * 0.13, 0.5, 0.18));
    },
    fanfare: () => {
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16, 19].forEach((n, i) => pluck(semi(24 + n), t + i * 0.08, 0.7, 0.19));
      for (let i = 0; i < 6; i++) tabla(t + i * 0.16, i % 2 ? 170 : 85, 0.42, null, i % 2 === 1);
    },
    combo: (n) => {
      const t = ctx.currentTime;
      pluck(semi(24 + Math.min(24, n * 2)), t, 0.28, 0.19);
    },
  };

  A.sfx = function (name, arg) {
    if (!ctx || A.muted) return;
    const fn = S[name];
    if (fn) {
      try {
        fn(arg);
      } catch (e) {
        /* audio glitches must never break gameplay */
      }
    }
  };

  /* ------------------------------------------------------------------ music
     Lookahead scheduler: a 16-step loop of tabla + bass + melody whose tempo
     and density scale with the game's speed level. */
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let bpm = 104;
  let intensity = 0; // 0..1, raises melody density & adds a counter-line
  let droneNodes = null;

  const PATTERN_KICK = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const PATTERN_TIN = [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1];
  const MELODY = [7, 5, 4, 5, 7, 8, 7, 5, 4, 1, 0, 1, 4, 5, 4, 1];

  function startDrone() {
    if (!ctx || droneNodes) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 2);
    g.connect(musicBus);
    const nodes = [g];
    [TONIC / 2, TONIC * 1.5, TONIC].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = i === 2 ? 0.25 : 0.5;
      o.connect(og);
      og.connect(g);
      o.start();
      nodes.push(o);
    });
    droneNodes = nodes;
  }

  function stopDrone() {
    if (!droneNodes) return;
    const g = droneNodes[0];
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    const nodes = droneNodes;
    droneNodes = null;
    setTimeout(() => nodes.slice(1).forEach((o) => o.stop && o.stop()), 700);
  }

  function schedule() {
    if (!ctx) return;
    const spb = 60 / bpm / 4; // 16th note
    while (nextTime < ctx.currentTime + 0.15) {
      const t = nextTime;
      const s = step % 16;
      if (PATTERN_KICK[s]) tabla(t, 78, 0.42, musicBus, false);
      if (PATTERN_TIN[s]) tabla(t, 205, 0.3 + intensity * 0.15, musicBus, true);
      if (s % 4 === 0) pluck(scaleNote(MELODY[s] - 7) / 2, t, spb * 3.6, 0.16, musicBus);
      if (s % 2 === 0 || intensity > 0.5) {
        const deg = MELODY[s] + (intensity > 0.7 && s % 8 === 5 ? 7 : 0);
        pluck(scaleNote(deg), t, spb * (s % 4 === 0 ? 2.6 : 1.7), 0.085 + intensity * 0.05, musicBus);
      }
      nextTime += spb;
      step++;
    }
  }

  A.music = function (on) {
    A.init();
    if (!ctx) return;
    if (on) {
      if (timer) return;
      startDrone();
      nextTime = ctx.currentTime + 0.08;
      timer = setInterval(schedule, 25);
    } else {
      if (timer) clearInterval(timer);
      timer = null;
      stopDrone();
    }
  };

  A.setTempo = function (b, inten) {
    bpm = MM.clamp(b, 70, 220);
    intensity = MM.clamp(inten === undefined ? intensity : inten, 0, 1);
  };

  A.musicPlaying = () => !!timer;
})(window.MM);
