/* ============================================================
   Store — persistent learner state (localStorage) + XP/streak/badges
   ============================================================ */
(function (global) {
  "use strict";

  var KEY = "forge.ai.v1";

  var DEFAULTS = {
    v: 1,
    theme: null, // null = follow system
    dense: false,
    progress: {}, // chapterId -> { done, ts, quiz:{right,total,ts}, checks:{} }
    notes: {}, // chapterId -> string
    cards: {}, // cardId -> { box, due, seen, right }
    projects: {}, // projectId -> { taskIndex: true }
    labs: {}, // labId -> true (first interaction awards XP)
    xp: 0,
    days: {}, // 'YYYY-MM-DD' -> xp earned that day
    streak: { n: 0, last: null, best: 0 },
    recent: [], // recently opened chapter ids
    open: {}, // phaseId -> bool (roadmap accordion)
    started: null,
  };

  var LEVELS = [
    { at: 0, name: "Curious Beginner" },
    { at: 200, name: "Prompt Apprentice" },
    { at: 550, name: "API Wrangler" },
    { at: 1000, name: "Pipeline Builder" },
    { at: 1600, name: "Retrieval Practitioner" },
    { at: 2400, name: "Agent Engineer" },
    { at: 3400, name: "Eval Specialist" },
    { at: 4600, name: "Production Operator" },
    { at: 6200, name: "AI Systems Architect" },
    { at: 8500, name: "Principal AI Engineer" },
  ];

  var XP = {
    chapter: 50,
    quizItem: 10,
    perfect: 25,
    check: 5,
    card: 3,
    task: 15,
    lab: 10,
  };

  var state = load();
  var listeners = [];

  function load() {
    var s;
    try {
      s = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {
      s = null;
    }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var d = DEFAULTS[k];
      var v = s && s[k] !== undefined ? s[k] : null;
      if (v === null || v === undefined) {
        out[k] = d && typeof d === "object" ? JSON.parse(JSON.stringify(d)) : d;
      } else {
        out[k] = v;
      }
    });
    if (!out.started) out.started = U.today();
    return out;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage full or blocked — degrade to in-memory only */
    }
    listeners.forEach(function (fn) {
      fn(state);
    });
  }

  /* ---------------- streak + xp ---------------- */

  function touchDay() {
    var t = U.today();
    var st = state.streak;
    if (st.last === t) return;
    if (st.last) {
      var gap = U.daysBetween(st.last, t);
      st.n = gap === 1 ? st.n + 1 : gap <= 0 ? st.n : 1;
    } else {
      st.n = 1;
    }
    st.last = t;
    if (st.n > (st.best || 0)) st.best = st.n;
  }

  function award(amount, reason) {
    if (!amount) return 0;
    var beforeLevel = S.level().idx;
    state.xp += amount;
    var t = U.today();
    state.days[t] = (state.days[t] || 0) + amount;
    touchDay();
    save();
    var afterLevel = S.level().idx;
    if (global.Toast) {
      if (afterLevel > beforeLevel) {
        Toast.show(
          "Level up — " + S.level().name,
          "You crossed " + U.commas(LEVELS[afterLevel].at) + " XP",
          "win",
          "trophy",
        );
      } else if (reason) {
        Toast.show("+" + amount + " XP", reason, "xp", "spark");
      }
    }
    return amount;
  }

  /* ---------------- public API ---------------- */

  var S = {};

  S.state = function () {
    return state;
  };

  S.subscribe = function (fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  };

  S.save = save;
  S.XP = XP;

  /* ---- theme ---- */

  S.theme = function () {
    if (state.theme) return state.theme;
    return global.matchMedia &&
      global.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  };

  S.setTheme = function (t) {
    state.theme = t;
    document.documentElement.setAttribute("data-theme", S.theme());
    save();
  };

  /* ---- chapters ---- */

  S.chapter = function (id) {
    if (!state.progress[id]) state.progress[id] = { done: false, checks: {} };
    if (!state.progress[id].checks) state.progress[id].checks = {};
    return state.progress[id];
  };

  S.isDone = function (id) {
    return !!(state.progress[id] && state.progress[id].done);
  };

  S.complete = function (id, on) {
    var c = S.chapter(id);
    var was = c.done;
    c.done = on !== false;
    c.ts = Date.now();
    if (c.done && !was) {
      award(XP.chapter, "Chapter completed");
    } else {
      save();
    }
    return c.done;
  };

  S.visit = function (id) {
    var r = state.recent.filter(function (x) {
      return x !== id;
    });
    r.unshift(id);
    state.recent = r.slice(0, 12);
    touchDay();
    save();
  };

  /* ---- quizzes / checks ---- */

  S.saveQuiz = function (id, right, total) {
    var c = S.chapter(id);
    var prev = c.quiz;
    var better = !prev || right > prev.right;
    if (better) c.quiz = { right: right, total: total, ts: Date.now() };
    var gained = 0;
    if (better) {
      var delta = right - (prev ? prev.right : 0);
      gained = delta * XP.quizItem;
      if (right === total && (!prev || prev.right < total))
        gained += XP.perfect;
    }
    if (gained) award(gained, right + "/" + total + " correct");
    else save();
    return c.quiz;
  };

  S.saveCheck = function (id, key, correct) {
    var c = S.chapter(id);
    if (c.checks[key] !== undefined) {
      save();
      return false;
    }
    c.checks[key] = !!correct;
    if (correct) award(XP.check, "Knowledge check");
    else save();
    return true;
  };

  S.getCheck = function (id, key) {
    var c = state.progress[id];
    return c && c.checks ? c.checks[key] : undefined;
  };

  /* ---- notes ---- */

  S.note = function (id, text) {
    if (text === undefined) return state.notes[id] || "";
    if (text) state.notes[id] = text;
    else delete state.notes[id];
    save();
  };

  S.noteCount = function () {
    return Object.keys(state.notes).length;
  };

  /* ---- labs ---- */

  S.labTouched = function (labId) {
    if (state.labs[labId]) return;
    state.labs[labId] = true;
    award(XP.lab, "Lab explored");
  };

  /* ---- projects ---- */

  S.projTask = function (pid, idx) {
    if (!state.projects[pid]) state.projects[pid] = {};
    var p = state.projects[pid];
    if (p[idx]) {
      delete p[idx];
      save();
      return false;
    }
    p[idx] = true;
    award(XP.task, "Project milestone");
    return true;
  };

  S.projDone = function (pid) {
    return Object.keys(state.projects[pid] || {}).length;
  };

  /* ---- flashcards (Leitner box scheduling) ---- */

  var BOX_GAP = [0, 1, 2, 4, 8, 16];

  S.card = function (id) {
    if (!state.cards[id])
      state.cards[id] = { box: 0, due: 0, seen: 0, right: 0 };
    return state.cards[id];
  };

  S.reviewCard = function (id, got) {
    var c = S.card(id);
    c.seen++;
    if (got) {
      c.right++;
      c.box = Math.min(5, c.box + 1);
    } else {
      c.box = Math.max(0, c.box - 1);
    }
    c.due = U.epochDay() + BOX_GAP[c.box];
    award(XP.card, null);
    return c;
  };

  S.cardDue = function (id) {
    var c = state.cards[id];
    if (!c) return true;
    return c.due <= U.epochDay();
  };

  S.cardStats = function (allIds) {
    var due = 0,
      learned = 0,
      seen = 0;
    allIds.forEach(function (id) {
      var c = state.cards[id];
      if (!c || !c.seen) {
        due++;
        return;
      }
      seen++;
      if (c.box >= 4) learned++;
      if (c.due <= U.epochDay()) due++;
    });
    return { due: due, learned: learned, seen: seen, total: allIds.length };
  };

  /* ---- roadmap accordion ---- */

  S.phaseOpen = function (pid, val) {
    if (val === undefined) return !!state.open[pid];
    if (val) state.open[pid] = true;
    else delete state.open[pid];
    save();
  };

  /* ---- level ---- */

  S.level = function () {
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++)
      if (state.xp >= LEVELS[i].at) idx = i;
    var cur = LEVELS[idx];
    var next = LEVELS[idx + 1];
    return {
      idx: idx,
      name: cur.name,
      at: cur.at,
      next: next ? next.at : null,
      nextName: next ? next.name : null,
      pct: next
        ? U.clamp(((state.xp - cur.at) / (next.at - cur.at)) * 100, 0, 100)
        : 100,
    };
  };

  S.levels = LEVELS;

  /* ---- activity heat (last N days) ---- */

  S.heat = function (days) {
    var n = days || 91;
    var out = [];
    var max = 1;
    Object.keys(state.days).forEach(function (k) {
      if (state.days[k] > max) max = state.days[k];
    });
    for (var i = n - 1; i >= 0; i--) {
      var key = U.dayKey(-i);
      var v = state.days[key] || 0;
      var lvl =
        v === 0
          ? 0
          : v < max * 0.26
            ? 1
            : v < max * 0.55
              ? 2
              : v < max * 0.8
                ? 3
                : 4;
      out.push({ day: key, xp: v, lvl: lvl });
    }
    return out;
  };

  /* ---- reset ---- */

  S.reset = function () {
    var theme = state.theme;
    state = JSON.parse(JSON.stringify(DEFAULTS));
    state.theme = theme;
    state.started = U.today();
    save();
  };

  S.export = function () {
    return JSON.stringify(state, null, 2);
  };

  S.import = function (json) {
    var parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") throw new Error("bad payload");
    Object.keys(DEFAULTS).forEach(function (k) {
      if (parsed[k] !== undefined) state[k] = parsed[k];
    });
    save();
  };

  global.Store = S;
})(window);
