/**
 * The session planner.
 *
 * The contract a learner reads into this is "these items fit in the time I said",
 * so overrunning the budget is the one failure that makes the whole feature worse
 * than the menu it replaced — they would rather choose badly than be told a plan
 * fits when it does not. Everything below is either that invariant or one of the
 * coherence rules that took two attempts to get right.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadCurriculum } from "../../scripts/lib/load-curriculum.mjs";

const C = loadCurriculum();

const FRESH = {
  done: {},
  quiz: {},
  labs: {},
  projectTasks: {},
  dueCards: 0,
  recent: [],
};

const PHASES = C.phases.slice().sort((a, b) => a.n - b.n);

/** Everything in `phaseIds` read, quizzed imperfectly, labs untouched. */
function through(phaseIds, extra = {}) {
  const s = {
    done: {},
    quiz: {},
    labs: {},
    projectTasks: {},
    dueCards: 0,
    recent: [],
    ...extra,
  };
  for (const ch of C.chapters) {
    if (!phaseIds.includes(ch.phase)) continue;
    if (extra.skip === ch.id) continue;
    s.done[ch.id] = true;
    if ((ch.quiz || []).length) {
      s.quiz[ch.id] = {
        right: Math.max(0, ch.quiz.length - 1),
        total: ch.quiz.length,
      };
    }
  }
  return s;
}

function readEverything() {
  const s = { ...FRESH, done: {}, quiz: {}, labs: {} };
  for (const ch of C.chapters) {
    s.done[ch.id] = true;
    if ((ch.quiz || []).length)
      s.quiz[ch.id] = { right: ch.quiz.length, total: ch.quiz.length };
    if (ch.lab) s.labs[ch.lab] = true;
  }
  return s;
}

const STATES = () => [
  ["fresh", FRESH],
  ["one phase in", through([PHASES[0].id])],
  [
    "two phases, cards due, mid-chapter",
    through([PHASES[0].id, PHASES[1].id], {
      dueCards: 23,
      recent: ["sampling"],
      skip: "sampling",
    }),
  ],
  ["read everything, built nothing", readEverything()],
];

const LENGTHS = [5, 10, 12, 25, 40, 45, 60, 90, 120];

describe("the budget", () => {
  /* The one promise the feature makes. */
  test("a plan never exceeds the minutes asked for", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const p = C.sessionFor(m, state);
        const sum = p.items.reduce((n, it) => n + it.minutes, 0);
        assert.equal(sum, p.used, `${label} @ ${m}: used disagrees with items`);
        assert.ok(p.used <= m, `${label} @ ${m}: plan is ${p.used} min`);
        assert.equal(p.spare, Math.max(0, m - p.used));
      }
    }
  });

  test("every item costs at least a minute", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        for (const it of C.sessionFor(m, state).items) {
          assert.ok(
            it.minutes >= 1,
            `${label} @ ${m}: ${it.kind} is ${it.minutes}`
          );
        }
      }
    }
  });

  test("a longer session is never a smaller plan", () => {
    for (const [label, state] of STATES()) {
      let prev = -1;
      for (const m of LENGTHS) {
        const used = C.sessionFor(m, state).used;
        assert.ok(used >= prev, `${label}: ${m} min used ${used}, was ${prev}`);
        prev = used;
      }
    }
  });

  test("nonsense budgets are clamped, not crashed", () => {
    for (const bad of [undefined, null, 0, -30, "25", 1e9, NaN, {}]) {
      assert.doesNotThrow(() => C.sessionFor(bad, FRESH));
      const p = C.sessionFor(bad, FRESH);
      assert.ok(p.minutes >= 5 && p.minutes <= 240, String(p.minutes));
      assert.ok(p.used <= p.minutes);
    }
  });

  test("a damaged state bundle does not throw", () => {
    for (const bad of [
      undefined,
      {},
      { done: null, quiz: null, labs: null, recent: null, dueCards: null },
      { dueCards: -5, recent: "nope" },
      { recent: ["no-such-chapter"], done: {} },
      { projectTasks: { "no-such-project": { 0: true } } },
    ]) {
      assert.doesNotThrow(() => C.sessionFor(25, bad));
      assert.ok(C.sessionFor(25, bad).used <= 25);
    }
  });
});

describe("what it picks", () => {
  test("no item appears twice in one plan", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const p = C.sessionFor(m, state);
        const keys = p.items.map((it) => it.kind + ":" + it.id);
        assert.equal(
          keys.length,
          new Set(keys).size,
          `${label} @ ${m}: ${keys.join(", ")}`
        );
      }
    }
  });

  test("it never suggests a chapter already complete", () => {
    const state = through([PHASES[0].id, PHASES[1].id]);
    for (const m of LENGTHS) {
      for (const it of C.sessionFor(m, state).items) {
        if (it.kind === "chapter" || it.kind === "resume") {
          assert.ok(!state.done[it.id], `${it.id} is done`);
        }
      }
    }
  });

  /* A lab lives inside a chapter. Suggesting one for an unread chapter drops the
     learner mid-page onto a widget with nothing to interpret it, and suggesting
     one whose chapter is in the same plan double-counts it, because
     `chapter.minutes` already covers the embedded lab. */
  test("a lab is only suggested once its chapter is read", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const p = C.sessionFor(m, state);
        const inPlan = new Set(
          p.items
            .filter((i) => i.kind === "chapter" || i.kind === "resume")
            .map((i) => i.id)
        );
        for (const it of p.items.filter((i) => i.kind === "lab")) {
          const owner = C.chapters.filter((c) => c.lab === it.id)[0];
          assert.ok(owner, `lab ${it.id} has no chapter`);
          assert.ok(
            state.done[owner.id],
            `${label} @ ${m}: lab ${it.id} suggested but ${owner.id} unread`
          );
          assert.ok(
            !inPlan.has(owner.id),
            `${label} @ ${m}: lab ${it.id} duplicates ${owner.id} in the same plan`
          );
        }
      }
    }
  });

  test("a quiz is only suggested for a chapter that is read and imperfect", () => {
    const state = through([PHASES[0].id, PHASES[1].id]);
    for (const m of LENGTHS) {
      for (const it of C.sessionFor(m, state).items) {
        if (it.kind !== "quiz") continue;
        assert.ok(state.done[it.id], `${it.id} not read`);
        const q = state.quiz[it.id];
        if (q) assert.ok(q.right < q.total, `${it.id} is already perfect`);
      }
    }
  });

  test("no quiz appears for a chapter answered perfectly", () => {
    const state = readEverything();
    for (const m of LENGTHS) {
      const kinds = C.sessionFor(m, state).items.map((i) => i.kind);
      assert.ok(!kinds.includes("quiz"), kinds.join(", "));
    }
  });

  /* Milestones are hours of work. Offering one for a coffee break invites ticking
     it without doing it, which corrupts the signal readiness weights highest. */
  test("project milestones only appear in a long session", () => {
    const state = readEverything();
    for (const m of LENGTHS) {
      const has = C.sessionFor(m, state).items.some(
        (i) => i.kind === "project"
      );
      if (m < 45) assert.ok(!has, `${m} min offered a milestone`);
    }
    assert.ok(
      C.sessionFor(90, state).items.some((i) => i.kind === "project"),
      "90 min with all reading done should reach for a milestone"
    );
  });

  test("cards come first and never eat more than a third of the session", () => {
    const state = through([PHASES[0].id], { dueCards: 200 });
    for (const m of LENGTHS) {
      const p = C.sessionFor(m, state);
      const cards = p.items.filter((i) => i.kind === "cards");
      if (!cards.length) continue;
      assert.equal(p.items[0].kind, "cards", `${m} min: cards not first`);
      /* The tail top-up can push the block past the cap when nothing else fits —
         that is deliberate, it beats reporting idle time — but only up to the
         whole session. */
      assert.ok(
        cards[0].minutes <= m,
        `${m} min: ${cards[0].minutes} of cards`
      );
      if (p.items.length > 1) {
        assert.ok(
          cards[0].minutes <= Math.ceil(m * 0.35),
          `${m} min: cards took ${cards[0].minutes} with other work present`
        );
      }
    }
  });

  test("no cards are suggested when none are due", () => {
    for (const m of LENGTHS) {
      assert.ok(
        !C.sessionFor(m, FRESH).items.some((i) => i.kind === "cards"),
        `${m} min invented a card review`
      );
    }
  });

  test("an unfinished chapter is resumed before a new one is opened", () => {
    const state = through([PHASES[0].id, PHASES[1].id], {
      recent: ["sampling"],
      skip: "sampling",
    });
    for (const m of [10, 25, 45, 90]) {
      const p = C.sessionFor(m, state);
      const resume = p.items.filter((i) => i.kind === "resume");
      assert.equal(resume.length, 1, `${m} min: ${p.items.map((i) => i.kind)}`);
      assert.equal(resume[0].id, "sampling");
      const firstNew = p.items.findIndex((i) => i.kind === "chapter");
      const resumeAt = p.items.findIndex((i) => i.kind === "resume");
      if (firstNew !== -1) assert.ok(resumeAt < firstNew, `${m} min`);
    }
  });

  /* The regression: value ties are the common case, and breaking them on id is
     alphabetical, so a fresh 90-minute plan read foundations in an order the
     roadmap does not use. */
  test("chapters are planned in curriculum order", () => {
    const pos = {};
    let i = 0;
    for (const p of PHASES)
      for (const ch of C.chapters.filter((c) => c.phase === p.id))
        pos[ch.id] = i++;

    for (const m of [45, 90, 120]) {
      const chapters = C.sessionFor(m, FRESH)
        .items.filter((it) => it.kind === "chapter")
        .map((it) => pos[it.id]);
      for (let k = 1; k < chapters.length; k++) {
        assert.ok(
          chapters[k] > chapters[k - 1],
          `${m} min plans out of order: ${chapters.join(", ")}`
        );
      }
    }
  });

  test("every item points somewhere real", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        for (const it of C.sessionFor(m, state).items) {
          assert.ok(it.label && it.label.length > 2, `${label}: ${it.kind}`);
          assert.ok(it.why && it.why.length > 10, `${label}: ${it.kind} why`);
          assert.ok(it.href, `${label}: ${it.kind} href`);
          if (it.href.startsWith("#/chapter/")) {
            const id = it.href.replace("#/chapter/", "");
            assert.ok(
              C.chapters.some((c) => c.id === id),
              `${it.href} is not a chapter`
            );
          } else {
            assert.ok(["#/review", "#/projects"].includes(it.href), it.href);
          }
        }
      }
    }
  });
});

describe("the stretch item and the note", () => {
  /* Filling an awkward remainder with a third of a chapter loses the thread;
     reporting eleven idle minutes and saying "stop" wastes them. The stretch is
     the third answer, and it must not be counted as scheduled time. */
  test("a stretch item is never part of the budget", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const p = C.sessionFor(m, state);
        if (!p.stretch) continue;
        assert.ok(p.used <= m, `${label} @ ${m}`);
        const keys = p.items.map((it) => it.kind + ":" + it.id);
        assert.ok(
          !keys.includes("chapter:" + p.stretch.id) &&
            !keys.includes("resume:" + p.stretch.id),
          `${label} @ ${m}: stretch duplicates a scheduled item`
        );
      }
    }
  });

  test("a stretch item is a chapter that is not yet done", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const p = C.sessionFor(m, state);
        if (!p.stretch) continue;
        assert.equal(p.stretch.kind, "chapter");
        assert.ok(
          !state.done[p.stretch.id],
          `${label}: ${p.stretch.id} is done`
        );
      }
    }
  });

  test("every plan carries a note", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const p = C.sessionFor(m, state);
        assert.ok(p.note && p.note.length > 20, `${label} @ ${m}: "${p.note}"`);
      }
    }
  });

  /* The empty-plan note has three distinct truths to tell and the first version
     told the wrong one: it congratulated a learner with every chapter read and 43
     milestones untouched on being "ahead of your own schedule". */
  test("an empty plan says which kind of empty it is", () => {
    const shortFresh = C.sessionFor(5, FRESH);
    if (!shortFresh.items.length) {
      assert.match(shortFresh.note, /fits cleanly|shortest chapter/i);
    }

    const readAll = C.sessionFor(10, readEverything());
    assert.equal(readAll.items.length, 0);
    assert.match(readAll.note, /project milestones/i);
    assert.doesNotMatch(readAll.note, /ahead of your own schedule/i);

    const finished = readEverything();
    for (const p of C.projects) {
      finished.projectTasks[p.id] = {};
      p.tasks.forEach((_, i) => (finished.projectTasks[p.id][i] = true));
    }
    const done = C.sessionFor(90, finished);
    assert.equal(done.items.length, 0);
    assert.match(done.note, /Nothing outstanding/i);
  });

  test("partial is set exactly when an item is cut short", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const p = C.sessionFor(m, state);
        const cut = p.items.some((it) => it.full && it.minutes < it.full);
        assert.equal(!!p.partial, cut, `${label} @ ${m}`);
      }
    }
  });

  /* A partial chapter is acceptable as the whole session — chapters are resumable
     — but never as the tail of one, which is what "efficient packing" produced. */
  test("a chapter is only cut short when it is the first item", () => {
    for (const [label, state] of STATES()) {
      for (const m of LENGTHS) {
        const items = C.sessionFor(m, state).items;
        items.forEach((it, i) => {
          if (it.kind !== "chapter") return;
          if (it.full && it.minutes < it.full) {
            assert.equal(
              i,
              0,
              `${label} @ ${m}: cut-short chapter at index ${i}`
            );
          }
        });
      }
    }
  });
});

describe("the session lengths offered", () => {
  test("ascend, and the shortest is genuinely short", () => {
    assert.ok(C.sessionLengths.length >= 3);
    for (let i = 1; i < C.sessionLengths.length; i++) {
      assert.ok(C.sessionLengths[i] > C.sessionLengths[i - 1]);
    }
    assert.ok(
      C.sessionLengths[0] <= 15,
      "a planner whose smallest option is half an hour excludes most sessions"
    );
  });

  test("each offered length produces a usable plan on a fresh account", () => {
    for (const m of C.sessionLengths) {
      const p = C.sessionFor(m, FRESH);
      assert.ok(
        p.items.length > 0,
        `${m} min gives a new learner nothing to do: ${p.note}`
      );
      assert.ok(p.used >= m * 0.5, `${m} min only fills ${p.used}`);
    }
  });
});

describe("the store's session bundle", () => {
  test("passes the learner's real state through to the planner", async () => {
    const { loadModule } =
      await import("../../scripts/lib/load-curriculum.mjs");
    const util = loadModule("js/core/util.js");
    const sandbox = loadModule("js/core/store.js", {
      U: util.U,
      Curriculum: C,
    });
    const Store = sandbox.Store;

    const first = C.chapters.filter((c) => c.phase === PHASES[0].id)[0];
    const second = C.chapters.filter((c) => c.phase === PHASES[0].id)[1];
    Store.complete(first.id);
    Store.visit(second.id);

    const p = Store.session(45, 6);
    assert.ok(p, "Store.session returned nothing");
    assert.ok(p.used <= 45);
    assert.ok(
      p.items.some((it) => it.kind === "cards"),
      "6 due cards did not reach the plan"
    );
    assert.ok(
      p.items.some((it) => it.kind === "resume" && it.id === second.id),
      "the visited-but-unfinished chapter was not resumed"
    );
    assert.ok(
      !p.items.some((it) => it.id === first.id && it.kind !== "quiz"),
      "the completed chapter was suggested again"
    );
  });

  test("no due cards means no card item", async () => {
    const { loadModule } =
      await import("../../scripts/lib/load-curriculum.mjs");
    const util = loadModule("js/core/util.js");
    const sandbox = loadModule("js/core/store.js", {
      U: util.U,
      Curriculum: C,
    });
    const p = sandbox.Store.session(25, 0);
    assert.ok(!p.items.some((it) => it.kind === "cards"));
  });
});
