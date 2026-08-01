/**
 * Interview drills.
 *
 * The rubric is the product here, not the question, and the risk it guards against
 * is self-flattery: read a model answer, recognise every part of it, conclude you
 * would have said it. That only works if the rubric is specific enough to be
 * checkable, so most of what follows is about the content meeting a bar rather than
 * about the code paths — a vague strong-point is a bug in this feature even though
 * nothing throws.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadCurriculum } from "../../scripts/lib/load-curriculum.mjs";

const C = loadCurriculum();

const COMPS = new Set(C.competencies.map((k) => k.id));
const KINDS = new Set(C.drillKinds.map((k) => k.id));
const CHAPTERS = new Set(C.chapters.map((c) => c.id));

describe("the bank", () => {
  test("every drill has a unique id", () => {
    const ids = C.drills.map((d) => d.id);
    assert.equal(ids.length, new Set(ids).size);
    for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, id);
  });

  test("every drill names a known competency, kind and chapter", () => {
    for (const d of C.drills) {
      assert.ok(COMPS.has(d.competency), `${d.id} → "${d.competency}"`);
      assert.ok(KINDS.has(d.kind), `${d.id} → "${d.kind}"`);
      assert.ok(CHAPTERS.has(d.ch), `${d.id} → "${d.ch}"`);
    }
  });

  /* The chapter a drill claims to be prepared by has to be inside the competency
     the drill is filed under, or the "Prepared by" link sends you to material that
     does not cover the question. */
  test("a drill's chapter belongs to its own competency", () => {
    const phasesOf = {};
    for (const k of C.competencies) phasesOf[k.id] = new Set(k.phases);
    for (const d of C.drills) {
      const ch = C.chapters.filter((c) => c.id === d.ch)[0];
      assert.ok(
        phasesOf[d.competency].has(ch.phase),
        `${d.id}: chapter "${d.ch}" is in phase "${ch.phase}", not in ${d.competency}`
      );
    }
  });

  test("every competency has drills, and the spread is not lopsided", () => {
    const byComp = {};
    for (const d of C.drills)
      byComp[d.competency] = (byComp[d.competency] || 0) + 1;
    for (const k of C.competencies) {
      assert.ok(
        (byComp[k.id] || 0) >= 3,
        `${k.id} has ${byComp[k.id] || 0} drills`
      );
    }
    const counts = Object.values(byComp);
    assert.ok(
      Math.max(...counts) <= Math.min(...counts) * 2,
      `spread is ${Math.min(...counts)}–${Math.max(...counts)}`
    );
  });

  test("every question is a question, and long enough to be a real one", () => {
    for (const d of C.drills) {
      /* The bar is low on purpose. "How big should a chunk be?" is 26 characters
         and is exactly how it gets asked — the terseness is the trap, which is
         what the `probe` field is for. What must not happen is a question so bare
         it gives the learner nothing to answer. */
      assert.ok(d.q.length > 24, `${d.id} is ${d.q.length} chars`);
      assert.ok(
        /[?.]$/.test(d.q.trim()),
        `${d.id} does not end in a question mark or full stop`
      );
      /* A terse question has to be carried by its rubric. */
      if (d.q.length < 45) {
        assert.ok(
          d.strong.length >= 4,
          `${d.id} is a bare question with only ${d.strong.length} strong points`
        );
      }
    }
  });

  /* The rubric has to be worth reading after you have answered. Two bullets is a
     hint; five is a checklist you can score yourself against. */
  test("every drill has enough rubric to self-mark against", () => {
    for (const d of C.drills) {
      assert.ok(
        d.strong.length >= 3,
        `${d.id}: ${d.strong.length} strong points`
      );
      assert.ok(d.weak.length >= 2, `${d.id}: ${d.weak.length} weak points`);
      for (const t of d.strong.concat(d.weak)) {
        /* A quoted weak answer is allowed to be short — "Yes, it went up" is the
           entire failure, and padding it would blunt it. Everything else has to
           say enough that you can check yourself against it: "No error contract"
           names an absence without saying what goes wrong, which is not something
           you can mark your own answer against. */
        const quoted = /^["\u201c]/.test(t.trim());
        assert.ok(
          quoted || t.length > 28,
          `${d.id}: "${t}" is too vague to self-mark against`
        );
      }
    }
  });

  test("every drill says what is being probed and what comes next", () => {
    for (const d of C.drills) {
      assert.ok(d.probe && d.probe.length > 40, `${d.id} probe`);
      assert.ok(d.follow && d.follow.length > 15, `${d.id} follow-up`);
      assert.ok(
        /\?$/.test(d.follow.trim()),
        `${d.id} follow-up is not a question`
      );
    }
  });

  test("answer times are plausible for a spoken answer", () => {
    for (const d of C.drills) {
      assert.ok(
        d.minutes >= 2 && d.minutes <= 6,
        `${d.id} claims ${d.minutes} min`
      );
    }
  });

  /* Two drills asking the same thing in different words is wasted content and
     reads as padding. */
  test("no two drills share an opening", () => {
    const seen = new Map();
    for (const d of C.drills) {
      const head = d.q.slice(0, 30).toLowerCase();
      assert.ok(
        !seen.has(head),
        `${d.id} and ${seen.get(head)} open the same way`
      );
      seen.set(head, d.id);
    }
  });

  test("every kind is actually used", () => {
    const used = new Set(C.drills.map((d) => d.kind));
    for (const k of C.drillKinds) {
      assert.ok(used.has(k.id), `kind "${k.id}" is defined but never used`);
    }
  });

  test("the behavioural round is represented", () => {
    assert.ok(
      C.drills.filter((d) => d.kind === "behavioural").length >= 2,
      "10% of the loop and 100% of the reason some candidates fail it"
    );
  });

  test("ratings are three ascending points with labels", () => {
    assert.equal(C.drillRatings.length, 3);
    C.drillRatings.forEach((r, i) => {
      assert.equal(r.id, i);
      assert.ok(r.label && r.hint, `rating ${i}`);
    });
  });
});

describe("selection", () => {
  test("filtering by competency returns only that competency", () => {
    for (const k of C.competencies) {
      const got = C.drillsFor(k.id);
      assert.ok(got.length > 0, k.id);
      for (const d of got) assert.equal(d.competency, k.id);
    }
  });

  test("no filter, or 'all', returns everything", () => {
    assert.equal(C.drillsFor().length, C.drills.length);
    assert.equal(C.drillsFor("all").length, C.drills.length);
  });

  test("an unknown competency returns nothing rather than everything", () => {
    assert.equal(C.drillsFor("not-a-competency").length, 0);
  });

  test("a fresh queue is the whole bank, all unseen", () => {
    const q = C.drillQueue("all", {});
    assert.equal(q.length, C.drills.length);
    for (const item of q) {
      assert.equal(item.seen, false);
      assert.equal(item.rating, null);
    }
  });

  test("no state at all behaves like empty state", () => {
    assert.doesNotThrow(() => C.drillQueue("all"));
    assert.equal(C.drillQueue("all").length, C.drills.length);
  });

  /* The whole ordering claim: unseen, then fumbled, then got-there, then clean. A
     drill you called clean is the one worth repeating last or never. */
  test("unseen first, then weakest self-rating", () => {
    const drills = C.drillsFor("retrieval");
    const state = { drills: {} };
    state.drills[drills[0].id] = { seen: 1, rating: 2, at: 10 };
    state.drills[drills[1].id] = { seen: 1, rating: 0, at: 11 };
    state.drills[drills[2].id] = { seen: 1, rating: 1, at: 12 };

    const order = C.drillQueue("retrieval", state).map((x) => x.drill.id);
    assert.equal(order[0], drills[3].id, "unseen should lead");
    assert.equal(order[1], drills[1].id, "fumbled should come next");
    assert.equal(order[2], drills[2].id, "got-there before clean");
    assert.equal(order[3], drills[0].id, "clean goes last");
  });

  test("within a tier, least recently seen first", () => {
    const drills = C.drillsFor("agents");
    const state = { drills: {} };
    drills.forEach((d, i) => {
      state.drills[d.id] = { seen: 1, rating: 0, at: 100 - i };
    });
    const order = C.drillQueue("agents", state).map((x) => x.drill.id);
    assert.deepEqual(
      order,
      drills
        .slice()
        .reverse()
        .map((d) => d.id)
    );
  });

  test("the order is deterministic across calls", () => {
    const a = C.drillQueue("all", {}).map((x) => x.drill.id);
    const b = C.drillQueue("all", {}).map((x) => x.drill.id);
    assert.deepEqual(a, b);
  });

  test("the queue reports what it knows about each drill", () => {
    const d = C.drills[0];
    const state = { drills: { [d.id]: { seen: 3, rating: 1, at: 5 } } };
    const item = C.drillQueue("all", state).filter(
      (x) => x.drill.id === d.id
    )[0];
    assert.equal(item.seen, true);
    assert.equal(item.rating, 1);
  });

  test("stats count attempted, clean and fumbled", () => {
    const drills = C.drillsFor("evaluation");
    const state = { drills: {} };
    state.drills[drills[0].id] = { seen: 1, rating: 2, at: 1 };
    state.drills[drills[1].id] = { seen: 2, rating: 0, at: 2 };
    const st = C.drillStats("evaluation", state);
    assert.equal(st.total, drills.length);
    assert.equal(st.attempted, 2);
    assert.equal(st.clean, 1);
    assert.equal(st.weak, 1);
  });

  test("stats on a fresh account are all zero but know the total", () => {
    const st = C.drillStats("all", {});
    assert.equal(st.total, C.drills.length);
    assert.equal(st.attempted, 0);
    assert.equal(st.clean, 0);
    assert.equal(st.weak, 0);
  });

  test("a damaged state bundle does not throw", () => {
    for (const bad of [
      undefined,
      {},
      { drills: null },
      { drills: "nope" },
      { drills: { "not-a-drill": { seen: 1, rating: 2 } } },
      { drills: { [C.drills[0].id]: null } },
      { drills: { [C.drills[0].id]: { seen: "yes", rating: "good" } } },
    ]) {
      assert.doesNotThrow(() => C.drillQueue("all", bad), JSON.stringify(bad));
      assert.doesNotThrow(() => C.drillStats("all", bad));
      assert.equal(C.drillQueue("all", bad).length, C.drills.length);
    }
  });
});

describe("independence from the readiness score", () => {
  /* Drills are the only self-reported signal in the app, which makes them the
     easiest to inflate. Feeding them into readiness would move every documented
     number in that model and put the least reliable input on the same footing as a
     measured one. */
  test("rating every drill clean does not move readiness", () => {
    const before = C.readinessFor({}).overall;
    const signals = {
      done: {},
      quiz: {},
      labs: {},
      projectTasks: {},
      drills: {},
    };
    for (const d of C.drills)
      signals.drills[d.id] = { seen: 1, rating: 2, at: 1 };
    assert.equal(C.readinessFor(signals).overall, before);
  });

  test("the readiness parts do not include a drill term", () => {
    for (const p of C.readinessParts) {
      assert.ok(
        !/drill|rehears|interview/i.test(p.id + " " + p.label),
        `readiness part "${p.id}" looks like a drill signal`
      );
    }
  });
});

describe("the store", () => {
  async function freshStore() {
    const { loadModule } =
      await import("../../scripts/lib/load-curriculum.mjs");
    const util = loadModule("js/core/util.js");
    return loadModule("js/core/store.js", { U: util.U, Curriculum: C }).Store;
  }

  test("rating a drill records it and awards XP once", async () => {
    const Store = await freshStore();
    const id = C.drills[0].id;
    Store.rateDrill(id, 0);
    const first = Store.state().xp;
    assert.ok(first > 0, "no XP for the first attempt");
    assert.equal(Store.state().drills[id].seen, 1);
    assert.equal(Store.state().drills[id].rating, 0);

    /* Repeats still count as practice, but they must not pay: it is the one action
       nobody can verify, so paying per repeat would make the cheapest thing in the
       app the most rewarding. */
    Store.rateDrill(id, 2);
    assert.equal(Store.state().xp, first, "a repeat paid out again");
    assert.equal(Store.state().drills[id].seen, 2);
    assert.equal(Store.state().drills[id].rating, 2);
  });

  test("an out-of-range rating is coerced rather than stored", async () => {
    const Store = await freshStore();
    const id = C.drills[1].id;
    for (const bad of [undefined, null, 7, -1, "clean", 1.5]) {
      Store.rateDrill(id, bad);
      const r = Store.state().drills[id].rating;
      assert.ok([0, 1, 2].includes(r), `rating became ${JSON.stringify(r)}`);
    }
  });

  test("the store's bundle drives the queue", async () => {
    const Store = await freshStore();
    const drills = C.drillsFor("production");
    Store.rateDrill(drills[0].id, 2);
    const order = C.drillQueue("production", Store.drillState()).map(
      (x) => x.drill.id
    );
    assert.equal(order[order.length - 1], drills[0].id, "clean should sink");
    assert.equal(Store.drillStats("production").clean, 1);
  });

  test("the bundle is a snapshot, not a live view", async () => {
    const Store = await freshStore();
    const id = C.drills[0].id;
    Store.rateDrill(id, 2);
    const snap = Store.drillState();
    snap.drills[id].rating = 0;
    delete snap.drills[id].seen;
    assert.equal(Store.drillState().drills[id].rating, 2);
    assert.equal(Store.drillState().drills[id].seen, 1);
  });

  test("drill history survives export and import", async () => {
    const Store = await freshStore();
    const id = C.drills[3].id;
    Store.rateDrill(id, 1);
    const dump = Store.export();

    const Fresh = await freshStore();
    Fresh.import(dump);
    assert.equal(Fresh.state().drills[id].rating, 1);
    assert.equal(Fresh.drillStats("all").attempted, 1);
  });

  test("a damaged drill payload is repaired on import", async () => {
    const Store = await freshStore();
    for (const payload of [
      '{"drills": "nope"}',
      '{"drills": {"cost-arithmetic": 7}}',
      '{"drills": {"cost-arithmetic": {"seen": "lots", "rating": "good"}}}',
      '{"drills": {"cost-arithmetic": {"seen": -3, "rating": 9, "at": -1}}}',
    ]) {
      assert.doesNotThrow(() => Store.import(payload), payload);
      const recs = Store.state().drills;
      for (const id of Object.keys(recs)) {
        assert.ok(recs[id].seen > 0, `${id} seen is ${recs[id].seen}`);
        assert.ok([0, 1, 2].includes(recs[id].rating), `${id} rating`);
        assert.ok(recs[id].at >= 0, `${id} at`);
      }
      assert.doesNotThrow(() => C.drillQueue("all", Store.drillState()));
      assert.doesNotThrow(() => Store.drillStats("all"));
    }
  });
});
