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
    profile: null, // personalisation: { track, skills[], hoursPerWeek, goal }
    onboarded: false,
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

  function clone(d) {
    return d && typeof d === "object" ? JSON.parse(JSON.stringify(d)) : d;
  }

  /* Accept a stored value only if it is the same *kind* as the default.
     Defaulting on null alone was not enough: a wrong type passed straight into
     code that assumes shape. `{"progress":"nope"}` threw "cannot create property
     'role' on string" on the first completion, and `{"xp":"lots"}` survived to
     become "lots50" the first time anything was awarded — permanently breaking
     level, progress bar and badge arithmetic. Settings offers JSON import, so a
     hand-edited file is a supported way in, not a hypothetical. */
  function sane(v, d) {
    if (v === null || v === undefined) return clone(d);
    if (typeof d === "number")
      return typeof v === "number" && isFinite(v) && v >= 0 ? v : d;
    if (typeof d === "boolean") return typeof v === "boolean" ? v : d;
    if (Array.isArray(d)) return Array.isArray(v) ? v : clone(d);
    if (d && typeof d === "object")
      return v && typeof v === "object" && !Array.isArray(v) ? v : clone(d);
    // theme and profile default to null: any object or string is plausible.
    return v;
  }

  /* Nested shapes the rest of the file dereferences without asking. */
  function saneState(out) {
    var streak = out.streak;
    if (!streak || typeof streak !== "object" || Array.isArray(streak)) {
      out.streak = clone(DEFAULTS.streak);
    } else {
      out.streak = {
        n: typeof streak.n === "number" && streak.n >= 0 ? streak.n : 0,
        last: typeof streak.last === "string" ? streak.last : null,
        best:
          typeof streak.best === "number" && streak.best >= 0 ? streak.best : 0,
      };
    }
    Object.keys(out.progress).forEach(function (id) {
      var rec = out.progress[id];
      if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
        delete out.progress[id];
      }
    });
    if (out.profile !== null && typeof out.profile === "object") {
      if (!Array.isArray(out.profile.skills)) out.profile.skills = [];
    } else if (out.profile !== null) {
      out.profile = null;
    }
    return out;
  }

  function load() {
    var s;
    try {
      s = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {
      s = null;
    }
    if (!s || typeof s !== "object" || Array.isArray(s)) s = null;
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = sane(s ? s[k] : null, DEFAULTS[k]);
    });
    if (!out.started) out.started = U.today();
    return saneState(out);
  }

  /* Can this browser actually keep anything? Private browsing, blocked site data
     and a full quota all make writes fail, and the app degrades to in-memory
     perfectly well — which is the problem. A learner who completes six chapters
     and closes the tab loses all of it, having been told by the README that
     progress is stored locally. Write a sentinel and read it back: a browser that
     accepts setItem and silently discards it fails this too, which a bare
     try/catch would call a success. */
  var persistsProbe = null;

  function persists() {
    if (persistsProbe !== null) return persistsProbe;
    try {
      var probe = KEY + ".probe";
      localStorage.setItem(probe, "1");
      persistsProbe = localStorage.getItem(probe) === "1";
      localStorage.removeItem(probe);
    } catch (e) {
      persistsProbe = false;
    }
    return persistsProbe;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage full or blocked — degrade to in-memory only */
      persistsProbe = false;
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
          "trophy"
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
    var mq = global.matchMedia;
    if (typeof mq !== "function") return "dark";
    return mq("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };

  /* Persists the preference only. Applying it to the document is the app
     layer's job — keeping the DOM out of the store makes it testable and
     usable from any host (including Node, for the test suite). */
  S.setTheme = function (t) {
    state.theme = t;
    save();
  };

  /* ---- chapters ---- */

  S.chapter = function (id) {
    var rec = state.progress[id];
    // A record of the wrong type is replaced, not written onto: `{"role": 7}`
    // used to throw "cannot create property 'checks' on number".
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
      rec = state.progress[id] = { done: false, checks: {} };
    }
    if (!rec.checks || typeof rec.checks !== "object") rec.checks = {};
    return rec;
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

  /* ---- profile / personalisation ---- */

  S.profile = function () {
    return state.profile;
  };

  S.setProfile = function (p) {
    state.profile = p;
    state.onboarded = true;
    save();
  };

  S.isOnboarded = function () {
    return !!state.onboarded;
  };

  S.skipOnboarding = function () {
    state.onboarded = true;
    save();
  };

  /* ---- readiness ---- */

  /* The learner state, flattened into the four signals the readiness model
     scores. Kept here because the store owns the shape, and returned as plain
     data so Curriculum.readinessFor stays a pure function the unit tests can
     drive without a browser or a localStorage. */
  S.signals = function () {
    var done = {};
    var quiz = {};
    Object.keys(state.progress).forEach(function (id) {
      var rec = state.progress[id];
      if (!rec || typeof rec !== "object") return;
      if (rec.done) done[id] = true;
      if (rec.quiz && rec.quiz.total)
        quiz[id] = { right: rec.quiz.right, total: rec.quiz.total };
    });
    return {
      done: done,
      quiz: quiz,
      labs: clone(state.labs),
      projectTasks: clone(state.projects),
    };
  };

  S.readiness = function () {
    if (!global.Curriculum || !global.Curriculum.readinessFor) return null;
    return global.Curriculum.readinessFor(S.signals());
  };

  /* The generated plan is derived, never stored — so editing the profile or
     adding chapters recomputes it rather than leaving a stale copy behind. */
  S.plan = function () {
    if (!state.profile || !global.Curriculum || !global.Curriculum.planFor) {
      return null;
    }
    return global.Curriculum.planFor(state.profile);
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

  /* Exposed so the shell can say so once, and Settings can say so permanently. */
  S.persists = persists;

  S.export = function () {
    return JSON.stringify(state, null, 2);
  };

  S.import = function (json) {
    var parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("bad payload");
    // Through the same sanitiser as load(). An import is the most likely source
    // of a wrong-typed field, since the file is offered for hand editing.
    Object.keys(DEFAULTS).forEach(function (k) {
      if (parsed[k] !== undefined) state[k] = sane(parsed[k], DEFAULTS[k]);
    });
    saneState(state);
    save();
  };

  global.Store = S;
})(window);
