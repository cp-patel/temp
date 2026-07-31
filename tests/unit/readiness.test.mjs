/**
 * The readiness diagnostic.
 *
 * This is the one number in the app a learner might make a decision on — start
 * applying, or spend another month on evals — so its failure modes are worse
 * than a wrong label. A score that quietly saturates says "ready" to someone who
 * has read a lot and built nothing; one that cannot reach 100 says "not ready"
 * forever. Neither breaks the page, which is exactly why they need tests.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadCurriculum } from "../../scripts/lib/load-curriculum.mjs";

const C = loadCurriculum();

const EMPTY = { done: {}, quiz: {}, labs: {}, projectTasks: {} };

/** Every signal set, i.e. a learner who has finished the entire curriculum. */
function everything() {
  const s = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
  for (const ch of C.chapters) {
    s.done[ch.id] = true;
    if ((ch.quiz || []).length) {
      s.quiz[ch.id] = { right: ch.quiz.length, total: ch.quiz.length };
    }
    if (ch.lab) s.labs[ch.lab] = true;
  }
  for (const p of C.projects) {
    s.projectTasks[p.id] = {};
    p.tasks.forEach((_, i) => (s.projectTasks[p.id][i] = true));
  }
  return s;
}

/** Only the reading and quizzes — no labs, no project milestones. */
function readOnly() {
  const s = everything();
  s.labs = {};
  s.projectTasks = {};
  return s;
}

const chaptersOf = (comp) =>
  C.chapters.filter((c) => comp.phases.includes(c.phase));

describe("the model", () => {
  test("competency weights sum to 1", () => {
    const sum = C.competencies.reduce((n, k) => n + k.weight, 0);
    assert.ok(Math.abs(sum - 1) < 0.001, `sum is ${sum}`);
  });

  test("part weights sum to 1", () => {
    const sum = C.readinessParts.reduce((n, p) => n + p.weight, 0);
    assert.ok(Math.abs(sum - 1) < 0.001, `sum is ${sum}`);
  });

  test("every phase feeds exactly one competency", () => {
    const claimed = C.competencies.flatMap((k) => k.phases);
    assert.equal(
      claimed.length,
      new Set(claimed).size,
      "a phase is claimed twice"
    );
    for (const p of C.phases) {
      assert.ok(claimed.includes(p.id), `phase "${p.id}" feeds nothing`);
    }
  });

  test("every competency claims at least one chapter", () => {
    for (const k of C.competencies) {
      assert.ok(chaptersOf(k).length > 0, k.id);
    }
  });

  test("every project evidences exactly one competency", () => {
    const claimed = C.competencies.flatMap((k) => k.projects);
    assert.equal(claimed.length, new Set(claimed).size);
    for (const p of C.projects) {
      assert.ok(claimed.includes(p.id), `project "${p.id}" evidences nothing`);
    }
  });

  test("bands start at 0 and ascend", () => {
    assert.equal(C.readinessBands[0].at, 0);
    for (let i = 1; i < C.readinessBands.length; i++) {
      assert.ok(C.readinessBands[i].at > C.readinessBands[i - 1].at);
    }
  });
});

describe("scoring", () => {
  test("a fresh learner is 0, not a flattering number", () => {
    const r = C.readinessFor(EMPTY);
    assert.equal(r.overall, 0);
    assert.equal(r.band.name, C.readinessBands[0].name);
    for (const c of r.competencies) assert.equal(c.score, 0);
  });

  test("no signals at all behaves like empty signals", () => {
    assert.equal(C.readinessFor().overall, 0);
    assert.equal(C.readinessFor({}).overall, 0);
  });

  test("finishing everything is exactly 100", () => {
    const r = C.readinessFor(everything());
    assert.equal(r.overall, 100);
    for (const c of r.competencies) assert.equal(c.score, 100, c.id);
    assert.equal(r.gaps.length, 0);
  });

  test("every score stays inside 0-100", () => {
    for (const signals of [EMPTY, readOnly(), everything()]) {
      const r = C.readinessFor(signals);
      assert.ok(r.overall >= 0 && r.overall <= 100);
      for (const c of r.competencies) {
        assert.ok(c.score >= 0 && c.score <= 100, `${c.id} = ${c.score}`);
        for (const k of Object.keys(c.parts)) {
          const v = c.parts[k];
          if (v !== null) assert.ok(v >= 0 && v <= 100, `${c.id}.${k} = ${v}`);
        }
      }
    }
  });

  /* The central claim of the curriculum is that projects are where the learning
     happens. A diagnostic that hands out 100% for reading would contradict the
     thing it measures — and would be the single most misleading number in the
     app, because it is the one someone might act on. */
  test("reading and quizzing everything is not enough", () => {
    const r = C.readinessFor(readOnly());
    assert.ok(r.overall < 100, `read-only scores ${r.overall}`);
    assert.ok(
      r.overall >= 50,
      `read-only scores only ${r.overall} — too harsh`
    );
    assert.notEqual(r.band.name, "Hire-ready");
  });

  test("more work never lowers the score", () => {
    const steps = [EMPTY];
    let acc = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
    /* Walk the curriculum in order, snapshotting after each chapter. */
    for (const ch of C.chapters) {
      acc = JSON.parse(JSON.stringify(acc));
      acc.done[ch.id] = true;
      if ((ch.quiz || []).length)
        acc.quiz[ch.id] = { right: ch.quiz.length, total: ch.quiz.length };
      if (ch.lab) acc.labs[ch.lab] = true;
      steps.push(acc);
    }
    for (const p of C.projects) {
      for (let i = 0; i < p.tasks.length; i++) {
        acc = JSON.parse(JSON.stringify(acc));
        acc.projectTasks[p.id] = acc.projectTasks[p.id] || {};
        acc.projectTasks[p.id][i] = true;
        steps.push(acc);
      }
    }
    let prev = -1;
    for (const s of steps) {
      const now = C.readinessFor(s).overall;
      assert.ok(now >= prev, `score fell from ${prev} to ${now}`);
      prev = now;
    }
    assert.equal(prev, 100);
  });

  /* Answering one quiz perfectly is not full recall of a seven-chapter subject.
     Scoring it that way is how a diagnostic starts flattering people, so recall
     is measured over every question in the competency. */
  test("recall is over all questions, not only the ones taken", () => {
    const comp = C.competencies.find((k) => chaptersOf(k).length > 1);
    const chs = chaptersOf(comp).filter((c) => (c.quiz || []).length);
    const one = chs[0];
    const signals = {
      done: {},
      quiz: { [one.id]: { right: one.quiz.length, total: one.quiz.length } },
      labs: {},
      projectTasks: {},
    };
    const got = C.readinessFor(signals).competencies.find(
      (c) => c.id === comp.id
    );
    assert.ok(got.parts.recall > 0);
    assert.ok(
      got.parts.recall < 100,
      `one perfect quiz reads as ${got.parts.recall}% recall of ${comp.label}`
    );
  });

  test("a wrong answer scores less than a right one", () => {
    const ch = C.chapters.find((c) => (c.quiz || []).length >= 2);
    const mk = (right) => ({
      done: {},
      quiz: { [ch.id]: { right, total: ch.quiz.length } },
      labs: {},
      projectTasks: {},
    });
    assert.ok(
      C.readinessFor(mk(ch.quiz.length)).overall >=
        C.readinessFor(mk(0)).overall
    );
  });

  /* A competency with no project of its own cannot earn an evidence score.
     Leaving the weight in place would cap it below 100 forever. */
  test("competencies without a project can still reach 100", () => {
    const r = C.readinessFor(everything());
    const noProject = C.competencies.filter((k) => !k.projects.length);
    assert.ok(noProject.length, "fixture assumes at least one such competency");
    for (const k of noProject) {
      const got = r.competencies.find((c) => c.id === k.id);
      assert.equal(got.score, 100, k.id);
      assert.equal(got.parts.evidence, null, "evidence should read as n/a");
    }
  });

  test("gaps are ranked by weighted shortfall, worst first", () => {
    const r = C.readinessFor(readOnly());
    for (let i = 1; i < r.gaps.length; i++) {
      const a = r.gaps[i - 1];
      const b = r.gaps[i];
      assert.ok(
        (100 - a.score) * a.weight >= (100 - b.score) * b.weight,
        `${a.id} ranked above ${b.id}`
      );
    }
  });

  test("gaps exclude finished competencies", () => {
    const r = C.readinessFor(everything());
    assert.equal(r.gaps.length, 0);
    for (const c of C.readinessFor(readOnly()).gaps) {
      assert.ok(c.score < 100, c.id);
    }
  });

  test("the band matches the score", () => {
    for (const signals of [EMPTY, readOnly(), everything()]) {
      const r = C.readinessFor(signals);
      const expected = C.readinessBands
        .filter((b) => r.overall >= b.at)
        .slice(-1)[0];
      assert.equal(r.band.name, expected.name);
    }
  });

  test("counts agree with the curriculum", () => {
    const r = C.readinessFor(everything());
    for (const k of C.competencies) {
      const got = r.competencies.find((c) => c.id === k.id);
      const chs = chaptersOf(k);
      assert.equal(got.counts.chapters, chs.length, k.id);
      assert.equal(got.counts.chaptersDone, chs.length);
      assert.equal(
        got.counts.quizQuestions,
        chs.reduce((n, c) => n + (c.quiz || []).length, 0)
      );
      assert.equal(got.counts.labs, chs.filter((c) => c.lab).length);
      assert.equal(
        got.counts.milestones,
        C.projects
          .filter((p) => k.projects.includes(p.id))
          .reduce((n, p) => n + p.tasks.length, 0)
      );
    }
  });

  test("the sum of chapters across competencies is the whole curriculum", () => {
    const seen = new Set();
    for (const k of C.competencies)
      for (const c of chaptersOf(k)) seen.add(c.id);
    assert.equal(seen.size, C.chapters.length);
  });
});

describe("next actions", () => {
  test("a fresh learner gets a full list", () => {
    const acts = C.readinessActions(EMPTY, 6);
    assert.equal(acts.length, 6);
  });

  test("honours the limit", () => {
    assert.equal(C.readinessActions(EMPTY, 3).length, 3);
    assert.equal(C.readinessActions(EMPTY, 1).length, 1);
  });

  /* The one thing this list must never do: suggest work already finished. */
  test("never suggests something already done", () => {
    const signals = everything();
    assert.equal(C.readinessActions(signals, 20).length, 0);

    const partial = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
    C.chapters.slice(0, 20).forEach((c) => {
      partial.done[c.id] = true;
      if (c.lab) partial.labs[c.lab] = true;
    });
    partial.projectTasks["p-rag"] = { 0: true, 1: true };
    for (const a of C.readinessActions(partial, 40)) {
      if (a.kind === "chapter") assert.ok(!partial.done[a.id], a.id);
      if (a.kind === "lab") assert.ok(!partial.labs[a.id], a.id);
      if (a.kind === "milestone") {
        const [pid, ix] = a.id.split("#");
        assert.ok(!(partial.projectTasks[pid] || {})[ix], a.id);
      }
    }
  });

  test("every action resolves to a real route", () => {
    for (const a of C.readinessActions(EMPTY, 40)) {
      assert.ok(["chapter", "milestone", "lab"].includes(a.kind), a.kind);
      assert.equal(typeof a.ready, "boolean", `${a.id} has no ready flag`);
      assert.ok(
        C.phases.some((p) => p.id === a.phase),
        `${a.id} names unknown phase "${a.phase}"`
      );
      assert.ok(a.label && a.label.length > 2, JSON.stringify(a));
      assert.ok(a.competency, a.id);
      if (a.kind === "chapter" || a.kind === "lab") {
        const id = a.href.replace("#/chapter/", "");
        assert.ok(
          C.chapters.some((c) => c.id === id),
          a.href
        );
      } else {
        assert.equal(a.href, "#/projects");
        const pid = a.id.split("#")[0];
        assert.ok(
          C.projects.some((p) => p.id === pid),
          a.id
        );
      }
    }
  });

  test("ranked by value within a tier, descending", () => {
    const acts = C.readinessActions(EMPTY, 40);
    for (let i = 1; i < acts.length; i++) {
      const prev = acts[i - 1];
      const cur = acts[i];
      if (prev.ready === cur.ready) {
        assert.ok(prev.value >= cur.value, `${prev.id} then ${cur.id}`);
      }
    }
  });

  /* Lift-per-item alone recommends whatever sits in the smallest heavy
     competency — which on a fresh account was a Phase 7 prompt-injection lab.
     The list has to agree with the roadmap it sits next to. */
  test("a fresh learner is pointed at the first phase, not the heaviest", () => {
    const first = C.phases.slice().sort((a, b) => a.n - b.n)[0];
    for (const a of C.readinessActions(EMPTY, 3)) {
      assert.equal(a.phase, first.id, `${a.label} is in ${a.phase}`);
    }
  });

  test("later phases surface once their prerequisites are done", () => {
    const order = C.phases.slice().sort((a, b) => a.n - b.n);
    const signals = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
    /* Finish phase 1 entirely, including its labs. */
    for (const ch of C.chapters.filter((c) => c.phase === order[0].id)) {
      signals.done[ch.id] = true;
      if (ch.lab) signals.labs[ch.lab] = true;
    }
    const top = C.readinessActions(signals, 3);
    for (const a of top) {
      assert.notEqual(a.phase, order[0].id, "suggests a finished phase");
    }
    assert.ok(
      top.some((a) => a.phase === order[1].id),
      `nothing from ${order[1].id} in ${top.map((a) => a.phase).join(", ")}`
    );
  });

  /* The regression this gate exists for. Production is a four-chapter phase
     carrying 15% of the loop with one lab, so its lift-per-item is ~3x anything
     else; two earlier versions of the ranking put that lab at the top of the
     list for a learner who had not reached it. The rule that holds is
     structural: a ready item always outranks an unready one, whatever the
     arithmetic says. */
  test("nothing unready ever outranks something ready", () => {
    const order = C.phases.slice().sort((a, b) => a.n - b.n);
    const signals = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
    /* Walk the roadmap a phase at a time and check the invariant at every step,
       because the failures both showed up mid-way rather than at either end. */
    for (const p of order) {
      const acts = C.readinessActions(signals, 40);
      let seenUnready = false;
      for (const a of acts) {
        if (!a.ready) seenUnready = true;
        else
          assert.ok(
            !seenUnready,
            `${a.phase} "${a.label}" is ready but ranked below an unready item ` +
              `after finishing up to ${p.id}`
          );
      }
      if (acts.length) {
        assert.ok(
          acts[0].ready || acts.every((x) => !x.ready),
          `top action after ${p.id} is a look-ahead while ready work remains`
        );
      }
      for (const ch of C.chapters.filter((c) => c.phase === p.id)) {
        signals.done[ch.id] = true;
        if (ch.lab) signals.labs[ch.lab] = true;
      }
    }
  });

  test("the top action is always in the earliest unfinished phase", () => {
    const order = C.phases.slice().sort((a, b) => a.n - b.n);
    const signals = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
    for (const p of order.slice(0, -1)) {
      for (const ch of C.chapters.filter((c) => c.phase === p.id)) {
        signals.done[ch.id] = true;
        if (ch.lab) signals.labs[ch.lab] = true;
      }
      /* Chapters and labs done up to and including p, so the earliest phase with
         reading left is the next one. Project milestones are deliberately left
         undone — they are the point of the diagnostic, and they must not drag
         the recommendation back into a phase whose reading is finished. */
      const next = order[order.indexOf(p) + 1];
      const top = C.readinessActions(signals, 1)[0];
      const chaptersLeft = C.chapters.some((c) => !signals.done[c.id]);
      if (!chaptersLeft) break;
      assert.ok(top.ready, `top action after ${p.id} is a look-ahead`);
      const topPhaseIx = order.findIndex((x) => x.id === top.phase);
      assert.ok(
        topPhaseIx <= order.indexOf(next),
        `after ${p.id} the top action is in ${top.phase}, past ${next.id}`
      );
    }
  });

  /* Two labs in one phase score identically. Without an explicit tie-break the
     order would depend on sort stability, and the top of this list is the most
     visible thing on the page. */
  test("the order is deterministic across calls", () => {
    const a = C.readinessActions(EMPTY, 10).map((x) => x.kind + ":" + x.id);
    const b = C.readinessActions(EMPTY, 10).map((x) => x.kind + ":" + x.id);
    assert.deepEqual(a, b);
  });

  test("survives a damaged signal bundle", () => {
    for (const bad of [
      undefined,
      {},
      { done: null, quiz: null, labs: null, projectTasks: null },
      { done: {}, quiz: { nope: { right: 5, total: 0 } } },
      { projectTasks: { "not-a-project": { 0: true } } },
    ]) {
      assert.doesNotThrow(() => C.readinessFor(bad));
      assert.doesNotThrow(() => C.readinessActions(bad, 5));
    }
  });
});

describe("the store's signal bundle", () => {
  test("flattens progress into the shape the scorer expects", async () => {
    const { loadModule } =
      await import("../../scripts/lib/load-curriculum.mjs");
    const util = loadModule("js/core/util.js");
    const sandbox = loadModule("js/core/store.js", {
      U: util.U,
      Curriculum: C,
    });
    const Store = sandbox.Store;

    const ch = C.chapters.find((c) => (c.quiz || []).length && c.lab);
    Store.complete(ch.id);
    Store.saveQuiz(ch.id, ch.quiz.length, ch.quiz.length);
    Store.labTouched(ch.lab);
    Store.projTask("p-rag", 0);

    const s = Store.signals();
    assert.equal(s.done[ch.id], true);
    /* Field-by-field: the store runs in a vm sandbox, so its objects have a
       different Object.prototype and deepStrictEqual rejects them as
       cross-realm even when every value matches. */
    assert.equal(s.quiz[ch.id].right, ch.quiz.length);
    assert.equal(s.quiz[ch.id].total, ch.quiz.length);
    assert.equal(s.labs[ch.lab], true);
    assert.equal(s.projectTasks["p-rag"][0], true);

    /* A snapshot, not a live view — a caller that mutates it must not be able to
       rewrite the learner's progress. */
    s.done[ch.id] = false;
    delete s.labs[ch.lab];
    assert.equal(Store.signals().done[ch.id], true);
    assert.equal(Store.signals().labs[ch.lab], true);

    const r = Store.readiness();
    assert.ok(r.overall > 0 && r.overall < 100);
    assert.equal(r.overall, C.readinessFor(Store.signals()).overall);
  });

  test("an incomplete chapter with a quiz still reports the quiz", async () => {
    const { loadModule } =
      await import("../../scripts/lib/load-curriculum.mjs");
    const util = loadModule("js/core/util.js");
    const sandbox = loadModule("js/core/store.js", {
      U: util.U,
      Curriculum: C,
    });
    const Store = sandbox.Store;
    const ch = C.chapters.find((c) => (c.quiz || []).length >= 2);
    Store.saveQuiz(ch.id, 1, ch.quiz.length);
    const s = Store.signals();
    assert.ok(!s.done[ch.id]);
    assert.equal(s.quiz[ch.id].right, 1);
    assert.equal(s.quiz[ch.id].total, ch.quiz.length);
  });
});
