import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadModule,
  makeMemoryStorage,
} from "../../scripts/lib/load-curriculum.mjs";

/** Fresh store over a fresh in-memory localStorage for each test. */
function freshStore(seed) {
  const util = loadModule("js/core/util.js");
  const storage = makeMemoryStorage();
  if (seed !== undefined) storage.setItem("forge.ai.v1", seed);
  const sandbox = loadModule("js/core/store.js", {
    U: util.U,
    localStorage: storage,
  });
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

  test("plan is null without a curriculum present", () => {
    Store.setProfile({ track: "backend", skills: [], hoursPerWeek: 5 });
    assert.equal(Store.plan(), null);
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
