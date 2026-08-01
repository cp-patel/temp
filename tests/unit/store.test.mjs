import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadCurriculum,
  loadModule,
  makeMemoryStorage,
} from "../../scripts/lib/load-curriculum.mjs";

const C = loadCurriculum();

/** Fresh store over a fresh in-memory localStorage for each test.
 *
 * The curriculum is injected because the store's derived reports — readiness,
 * session, portfolio, drill stats — return null without it, so assertions about
 * them were passing vacuously on a store that could not compute them. */
function freshStore(seed, opts) {
  const util = loadModule("js/core/util.js");
  const storage = makeMemoryStorage();
  if (seed !== undefined) storage.setItem("forge.ai.v1", seed);
  const globals = { U: util.U, localStorage: storage };
  /* One test deliberately checks the no-curriculum degradation path. */
  if (!opts || opts.curriculum !== false) globals.Curriculum = C;
  const sandbox = loadModule("js/core/store.js", globals);
  return { Store: sandbox.Store, storage };
}

describe("damaged stored state", () => {
  /* Settings offers JSON export and import, so a hand-edited file is a supported
     way in. Defaulting only on null let a wrong *type* through into code that
     assumes shape: {"progress":"nope"} threw on the first completion, and
     {"xp":"lots"} became "lots50" the first time anything was awarded, which
     permanently breaks level, progress bar and badge arithmetic. */
  const CASES = [
    ["unparseable", "{not json"],
    ["a bare string", '"hello"'],
    ["a bare array", "[1,2,3]"],
    ["a number", "42"],
    ["empty object", "{}"],
    ["progress as a string", '{"progress":"nope","xp":10}'],
    ["progress as an array", '{"progress":[1,2],"xp":10}'],
    ["a progress record that is a number", '{"progress":{"role":7},"xp":5}'],
    ["xp as a string", '{"xp":"lots"}'],
    ["xp negative", '{"xp":-500}'],
    ["xp not finite", '{"xp":1e999}'],
    ["streak as a string", '{"streak":"7 days"}'],
    ["streak counters as strings", '{"streak":{"n":"many","best":"lots"}}'],
    ["cards as an array", '{"cards":[]}'],
    ["days as a string", '{"days":"x"}'],
    ["notes as an array", '{"notes":[]}'],
    ["projects as a string", '{"projects":"none"}'],
    ["profile as a string", '{"profile":"backend"}'],
    [
      "profile skills as a string",
      '{"profile":{"track":"backend","skills":"apis"}}',
    ],
  ];

  for (const [name, seed] of CASES) {
    test(`recovers from ${name}`, () => {
      const { Store } = freshStore(seed);
      const s = Store.state();

      assert.equal(typeof s.xp, "number", "xp must be a number");
      assert.ok(isFinite(s.xp) && s.xp >= 0, `xp is ${s.xp}`);
      for (const k of [
        "progress",
        "notes",
        "cards",
        "projects",
        "days",
        "labs",
      ]) {
        assert.ok(
          s[k] && typeof s[k] === "object" && !Array.isArray(s[k]),
          `${k} must be a plain object, got ${JSON.stringify(s[k])}`
        );
      }
      assert.equal(typeof s.streak.n, "number");
      assert.equal(typeof s.streak.best, "number");
      assert.ok(s.profile === null || typeof s.profile === "object");
      if (s.profile) assert.ok(Array.isArray(s.profile.skills));

      // And the write paths still work on top of it.
      Store.complete("role", true);
      assert.equal(Store.isDone("role"), true);
      assert.equal(typeof Store.state().xp, "number");
      assert.ok(Store.state().xp >= Store.XP.chapter);
      Store.saveQuiz("role", 3, 4);
      Store.saveCheck("role", "k1", true);
      assert.equal(Store.getCheck("role", "k1"), true);
      assert.equal(typeof Store.level().name, "string");
    });
  }

  test("import runs through the same sanitiser as load", () => {
    const { Store } = freshStore();
    Store.import('{"xp":"lots","progress":"nope","streak":"never"}');
    const s = Store.state();
    assert.equal(typeof s.xp, "number");
    assert.ok(s.progress && !Array.isArray(s.progress));
    assert.equal(typeof s.streak.n, "number");
    Store.complete("tokens", true);
    assert.equal(typeof Store.state().xp, "number");
  });

  test("reports whether this browser can keep anything", () => {
    /* Private browsing, blocked site data and a full quota all make writes fail.
       The app degrades to in-memory perfectly well, which is the problem: a
       learner loses a session's work at the moment the tab closes, having been
       told progress is saved locally. */
    const util = loadModule("js/core/util.js");

    const working = loadModule("js/core/store.js", {
      U: util.U,
      localStorage: makeMemoryStorage(),
    }).Store;
    assert.equal(working.persists(), true);

    const throwing = loadModule("js/core/store.js", {
      U: util.U,
      localStorage: {
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
        removeItem() {
          throw new Error("blocked");
        },
      },
    }).Store;
    assert.equal(throwing.persists(), false);
    // …and still works in memory for the length of the session.
    throwing.complete("role", true);
    assert.equal(throwing.isDone("role"), true);
    assert.equal(throwing.state().xp, throwing.XP.chapter);

    /* A browser that accepts the write and silently discards it is the case a
       bare try/catch calls a success, which is why the probe reads back. */
    const lying = loadModule("js/core/store.js", {
      U: util.U,
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    }).Store;
    assert.equal(lying.persists(), false);
  });

  test("import still rejects a payload that is not an object", () => {
    const { Store } = freshStore();
    for (const bad of ['"hi"', "[1,2]", "null", "7"]) {
      assert.throws(() => Store.import(bad), /bad payload/);
    }
  });

  test("a valid export round-trips unchanged", () => {
    // The sanitiser must not quietly rewrite legitimate state.
    const a = freshStore().Store;
    a.complete("tokens", true);
    a.saveQuiz("tokens", 4, 4);
    a.saveCheck("tokens", "t-mid", true);
    a.setProfile({
      track: "backend",
      skills: ["apis"],
      hoursPerWeek: 10,
      goal: "job",
    });
    const json = a.export();

    const b = freshStore().Store;
    b.import(json);
    assert.equal(b.isDone("tokens"), true);
    assert.equal(b.getCheck("tokens", "t-mid"), true);
    assert.equal(b.profile().track, "backend");
    assert.deepEqual(b.profile().skills, ["apis"]);
    assert.equal(b.state().xp, a.state().xp);
  });
});

describe("chapter progress", () => {
  let Store;
  beforeEach(() => {
    Store = freshStore().Store;
  });

  test("a chapter starts incomplete", () => {
    assert.equal(Store.isDone("tokens"), false);
  });

  test("completing awards chapter XP exactly once", () => {
    Store.complete("tokens", true);
    assert.equal(Store.isDone("tokens"), true);
    assert.equal(Store.state().xp, Store.XP.chapter);

    Store.complete("tokens", true); // idempotent
    assert.equal(Store.state().xp, Store.XP.chapter);
  });

  test("uncompleting does not deduct XP but clears the flag", () => {
    Store.complete("tokens", true);
    Store.complete("tokens", false);
    assert.equal(Store.isDone("tokens"), false);
    assert.equal(Store.state().xp, Store.XP.chapter);
  });
});

describe("quizzes", () => {
  let Store;
  beforeEach(() => {
    Store = freshStore().Store;
  });

  test("records a score and awards per correct answer", () => {
    Store.saveQuiz("tokens", 3, 4);
    assert.equal(Store.state().xp, 3 * Store.XP.quizItem);
  });

  test("a worse retake does not lower the recorded best", () => {
    Store.saveQuiz("tokens", 3, 4);
    Store.saveQuiz("tokens", 1, 4);
    assert.equal(Store.state().progress.tokens.quiz.right, 3);
  });

  test("only the improvement is awarded on a better retake", () => {
    Store.saveQuiz("tokens", 2, 4);
    const afterFirst = Store.state().xp;
    Store.saveQuiz("tokens", 3, 4);
    assert.equal(Store.state().xp - afterFirst, Store.XP.quizItem);
  });

  test("a perfect score adds the bonus once", () => {
    Store.saveQuiz("tokens", 4, 4);
    const expected = 4 * Store.XP.quizItem + Store.XP.perfect;
    assert.equal(Store.state().xp, expected);
    Store.saveQuiz("tokens", 4, 4);
    assert.equal(Store.state().xp, expected);
  });
});

describe("inline knowledge checks", () => {
  let Store;
  beforeEach(() => {
    Store = freshStore().Store;
  });

  test("first answer is recorded, repeats are ignored", () => {
    assert.equal(Store.saveCheck("tokens", "tok-1", true), true);
    assert.equal(Store.saveCheck("tokens", "tok-1", false), false);
    assert.equal(Store.getCheck("tokens", "tok-1"), true);
  });

  test("a wrong answer records without awarding XP", () => {
    Store.saveCheck("tokens", "tok-1", false);
    assert.equal(Store.state().xp, 0);
    assert.equal(Store.getCheck("tokens", "tok-1"), false);
  });
});

describe("flashcard scheduling", () => {
  let Store;
  beforeEach(() => {
    Store = freshStore().Store;
  });

  test("an unseen card is due", () => {
    assert.equal(Store.cardDue("tokens:0"), true);
  });

  test("a correct review promotes the box and defers the card", () => {
    const c = Store.reviewCard("tokens:0", true);
    assert.equal(c.box, 1);
    assert.equal(Store.cardDue("tokens:0"), false);
  });

  test("a missed review demotes the box", () => {
    Store.reviewCard("tokens:0", true);
    Store.reviewCard("tokens:0", true);
    assert.equal(Store.card("tokens:0").box, 2);
    Store.reviewCard("tokens:0", false);
    assert.equal(Store.card("tokens:0").box, 1);
  });

  test("box is clamped to the interval table", () => {
    for (let i = 0; i < 12; i++) Store.reviewCard("tokens:0", true);
    assert.equal(Store.card("tokens:0").box, 5);
    for (let i = 0; i < 12; i++) Store.reviewCard("tokens:0", false);
    assert.equal(Store.card("tokens:0").box, 0);
  });

  test("stats separate due, seen and learned", () => {
    const ids = ["a:0", "a:1", "a:2"];
    for (let i = 0; i < 4; i++) Store.reviewCard("a:0", true); // box 4 = learned
    const st = Store.cardStats(ids);
    assert.equal(st.total, 3);
    assert.equal(st.learned, 1);
    assert.equal(st.due, 2);
  });
});

describe("levels", () => {
  let Store;
  beforeEach(() => {
    Store = freshStore().Store;
  });

  test("starts at the first level", () => {
    assert.equal(Store.level().idx, 0);
  });

  test("crossing a threshold advances the level", () => {
    const second = Store.levels[1];
    for (let i = 0; i < 60; i++) Store.complete("ch" + i, true);
    assert.ok(Store.state().xp >= second.at);
    assert.ok(Store.level().idx >= 1);
  });

  test("percentage toward the next level stays in range", () => {
    Store.complete("a", true);
    const l = Store.level();
    assert.ok(l.pct >= 0 && l.pct <= 100);
  });
});

describe("projects", () => {
  let Store;
  beforeEach(() => {
    Store = freshStore().Store;
  });

  test("toggling a task flips it and awards once", () => {
    assert.equal(Store.projTask("p-rag", 0), true);
    assert.equal(Store.projDone("p-rag"), 1);
    assert.equal(Store.state().xp, Store.XP.task);

    assert.equal(Store.projTask("p-rag", 0), false);
    assert.equal(Store.projDone("p-rag"), 0);
  });
});

describe("profile and plan", () => {
  let Store;
  beforeEach(() => {
    Store = freshStore().Store;
  });

  test("not onboarded by default, and no profile", () => {
    assert.equal(Store.isOnboarded(), false);
    assert.equal(Store.profile(), null);
  });

  test("setting a profile marks onboarding complete", () => {
    Store.setProfile({ track: "backend", skills: ["apis"], hoursPerWeek: 10 });
    assert.equal(Store.isOnboarded(), true);
    assert.equal(Store.profile().track, "backend");
  });

  test("skipping marks onboarded without a profile", () => {
    Store.skipOnboarding();
    assert.equal(Store.isOnboarded(), true);
    assert.equal(Store.profile(), null);
  });

  /* Every derived report degrades to null rather than throwing when the content
     layer is absent — a deployment that dropped a content file must not take the
     whole store down with it. */
  test("derived reports are null without a curriculum present", () => {
    const { Store: bare } = freshStore(undefined, { curriculum: false });
    bare.setProfile({ track: "backend", skills: [], hoursPerWeek: 5 });
    assert.equal(bare.plan(), null);
    assert.equal(bare.readiness(), null);
    assert.equal(bare.session(25, 0), null);
    assert.equal(bare.portfolio(), null);
    assert.equal(bare.drillStats("all"), null);
    /* But the plain state accessors keep working, so the rest of the app can. */
    assert.doesNotThrow(() => bare.signals());
    assert.doesNotThrow(() => bare.resetWarning());
    assert.doesNotThrow(() => bare.complete("role"));
  });
});

describe("persistence", () => {
  test("state survives a reload from the same storage", () => {
    const util = loadModule("js/core/util.js");
    const storage = makeMemoryStorage();

    const first = loadModule("js/core/store.js", {
      U: util.U,
      localStorage: storage,
    }).Store;
    first.complete("tokens", true);
    first.setProfile({ track: "backend", skills: ["apis"], hoursPerWeek: 10 });
    const xp = first.state().xp;

    // Re-instantiate against the same storage, as a page reload would.
    const second = loadModule("js/core/store.js", {
      U: util.U,
      localStorage: storage,
    }).Store;
    assert.equal(second.isDone("tokens"), true);
    assert.equal(second.state().xp, xp);
    assert.equal(second.profile().track, "backend");
  });

  test("reset clears progress but keeps the theme", () => {
    const { Store } = freshStore();
    Store.setTheme("light");
    Store.complete("tokens", true);
    Store.reset();
    assert.equal(Store.isDone("tokens"), false);
    assert.equal(Store.state().xp, 0);
    assert.equal(Store.state().theme, "light");
  });

  test("corrupt stored JSON degrades to defaults instead of throwing", () => {
    const util = loadModule("js/core/util.js");
    const storage = makeMemoryStorage();
    storage.setItem("forge.ai.v1", "{not json");
    const Store = loadModule("js/core/store.js", {
      U: util.U,
      localStorage: storage,
    }).Store;
    assert.equal(Store.state().xp, 0);
    assert.equal(Store.isDone("tokens"), false);
  });

  test("export round-trips through import", () => {
    const a = freshStore().Store;
    a.complete("tokens", true);
    a.saveQuiz("tokens", 4, 4);
    const json = a.export();

    const b = freshStore().Store;
    b.import(json);
    assert.equal(b.isDone("tokens"), true);
    assert.equal(b.state().progress.tokens.quiz.right, 4);
  });

  test("import rejects a non-object payload", () => {
    const { Store } = freshStore();
    assert.throws(() => Store.import('"a string"'));
  });
});

describe("what the app admits it stores", () => {
  /* The check that makes the reset warning un-driftable.

     Two hand-written prose lists described this state, and both went stale the
     moment `evidence` and `drills` were added — the reset dialog was promising to
     clear five things while also destroying every portfolio write-up the learner
     had typed, which is the one thing in here nobody can reconstruct. Adding state
     without describing it now fails here. */
  test("every stored key is described exactly once", () => {
    const { Store } = freshStore();
    const stored = Object.keys(Store.state());
    const seen = new Map();
    for (const kind of Store.dataKinds) {
      assert.ok(Array.isArray(kind.keys) && kind.keys.length, "empty kind");
      assert.equal(typeof kind.cleared, "boolean", JSON.stringify(kind.keys));
      for (const k of kind.keys) {
        assert.ok(
          !seen.has(k),
          `"${k}" is described twice: ${seen.get(k)} and ${kind.label}`
        );
        seen.set(k, kind.label);
      }
    }
    for (const k of stored) {
      assert.ok(seen.has(k), `state key "${k}" is stored but never described`);
    }
    for (const k of seen.keys()) {
      assert.ok(stored.includes(k), `"${k}" is described but is not state`);
    }
  });

  test("the reset warning names everything it will destroy", () => {
    const { Store } = freshStore();
    const warning = Store.resetWarning();
    for (const kind of Store.dataKinds) {
      if (!kind.cleared || !kind.label) continue;
      assert.ok(
        warning.includes(kind.label),
        `the warning does not mention "${kind.label}"`
      );
    }
    /* And says what survives, so "reset" does not read as "uninstall". */
    for (const kind of Store.dataKinds) {
      if (kind.cleared || !kind.label) continue;
      assert.ok(
        warning.includes(kind.label),
        `"${kind.label}" is not named as kept`
      );
    }
    assert.match(warning, /cannot be undone/i);
    assert.match(warning, /export first/i);
  });

  /* The two prose kinds lead, because they are what someone would actually regret.
     A tick can be re-ticked from memory; a measured number and the paragraph
     explaining it cannot. */
  test("the prose you typed is named before the ticks", () => {
    const { Store } = freshStore();
    const warning = Store.resetWarning();
    const prose = Store.dataKinds.filter((k) => k.prose && k.label);
    assert.ok(prose.length >= 2, "expected notes and portfolio evidence");
    const ticks = Store.dataKinds.filter(
      (k) => k.cleared && k.label && !k.prose
    );
    const lastProse = Math.max(...prose.map((k) => warning.indexOf(k.label)));
    const firstTick = Math.min(...ticks.map((k) => warning.indexOf(k.label)));
    assert.ok(
      lastProse < firstTick,
      `"${warning}" buries the prose behind the ticks`
    );
  });

  test("reset clears everything it claims to, and keeps what it claims to keep", () => {
    const { Store } = freshStore();
    Store.setTheme("light");
    Store.complete("role");
    Store.saveQuiz("role", 1, 2);
    Store.note("role", "a note");
    Store.projTask("p-rag", 0);
    Store.labTouched("tokenizer");
    Store.setMetric("p-rag", "recallAfter", "0.82");
    Store.setEvidenceNotes("p-rag", "the reranker won");
    Store.rateDrill("cost-arithmetic", 1);
    Store.setProfile({
      track: "backend",
      skills: [],
      goal: "job",
      hoursPerWeek: 10,
    });
    assert.ok(Store.state().xp > 0, "fixture earned no XP");

    const { Store: untouched } = freshStore();
    const pristine = JSON.parse(JSON.stringify(untouched.state()));

    Store.reset();
    const after = Store.state();
    for (const kind of Store.dataKinds) {
      for (const key of kind.keys) {
        if (key === "v" || key === "started") continue;
        /* Compared against a never-touched store rather than guessing at what
           "empty" looks like: streak resets to {n:0,last:null,best:0}, which is an
           object with keys and is entirely correct. */
        if (kind.cleared) {
          assert.deepEqual(
            JSON.parse(JSON.stringify(after[key])),
            JSON.parse(JSON.stringify(pristine[key])),
            `"${key}" survived a reset: ${JSON.stringify(after[key])}`
          );
        }
      }
    }
    /* Theme is deliberately preserved — resetting your progress should not put you
       back on the wrong colour scheme. */
    assert.equal(after.theme, "light");
  });

  /* Several keys damaged at once, which is what a hand-edited file actually looks
     like. Each was covered alone; the combination is what the app has to survive. */
  test("a payload with every key damaged at once still yields a usable app", () => {
    const { Store } = freshStore();
    const junk = JSON.stringify({
      progress: { role: 7, tokens: [], sampling: { done: true } },
      notes: "not an object",
      cards: { "role:0": "nope" },
      projects: "nope",
      labs: 12,
      evidence: { "p-rag": { metrics: { recallAfter: 0.82 }, notes: 9 } },
      drills: { "cost-arithmetic": { seen: -1, rating: 99, at: "yesterday" } },
      xp: "lots",
      days: [],
      streak: "on fire",
      recent: { 0: "role" },
      open: null,
      profile: "backend",
      onboarded: "yes",
      theme: 7,
      started: 12,
      v: "one",
    });
    assert.doesNotThrow(() => Store.import(junk));

    /* Every write path the UI can reach, on the repaired state. */
    assert.doesNotThrow(() => Store.complete("role"));
    assert.doesNotThrow(() => Store.saveQuiz("role", 2, 2));
    assert.doesNotThrow(() => Store.saveCheck("role", "k", true));
    assert.doesNotThrow(() => Store.note("role", "x"));
    assert.doesNotThrow(() => Store.reviewCard("role:0", true));
    assert.doesNotThrow(() => Store.projTask("p-rag", 1));
    assert.doesNotThrow(() => Store.labTouched("tokenizer"));
    assert.doesNotThrow(() => Store.setMetric("p-rag", "recallAfter", "0.9"));
    assert.doesNotThrow(() => Store.setEvidenceNotes("p-rag", "hi"));
    assert.doesNotThrow(() => Store.rateDrill("cost-arithmetic", 2));
    assert.doesNotThrow(() => Store.level());
    assert.doesNotThrow(() => Store.heat(30));

    /* And every derived report, which is what the pages actually render. These
       return null without a curriculum, so a bare doesNotThrow would pass on a
       store that cannot compute them — assert the shape too. */
    assert.doesNotThrow(() => Store.signals());
    assert.ok(Store.readiness(), "readiness is unavailable");
    assert.ok(Store.session(25, 3), "session planner is unavailable");
    assert.ok(Store.portfolio(), "portfolio is unavailable");
    assert.ok(Store.drillStats("all"), "drill stats are unavailable");
    assert.ok(Store.resetWarning().length > 40);

    /* Arithmetic must be arithmetic: "lots" + 50 was a real bug. */
    assert.equal(typeof Store.state().xp, "number");
    assert.ok(isFinite(Store.state().xp) && Store.state().xp > 0);
    assert.equal(typeof Store.readiness().overall, "number");
    assert.ok(Store.session(25, 3).used <= 25);
  });

  test("a round trip through export and import is lossless", () => {
    const { Store } = freshStore();
    Store.complete("role");
    Store.note("role", "kept");
    Store.setMetric("p-rag", "recallAfter", "0.82");
    Store.setEvidenceNotes("p-rag", "kept too");
    Store.rateDrill("cost-arithmetic", 0);
    Store.projTask("p-rag", 0);
    const before = Store.export();

    const { Store: Fresh } = freshStore();
    Fresh.import(before);
    /* Compared key by key rather than string-wise: the sanitiser is allowed to
       normalise, but it must not lose anything. */
    const a = JSON.parse(before);
    const b = Fresh.state();
    for (const k of Object.keys(a)) {
      assert.deepEqual(
        JSON.parse(JSON.stringify(b[k])),
        JSON.parse(JSON.stringify(a[k])),
        `"${k}" changed across a round trip`
      );
    }
  });
});
