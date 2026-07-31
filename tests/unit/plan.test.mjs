import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadCurriculum } from "../../scripts/lib/load-curriculum.mjs";

const C = loadCurriculum();

const BACKEND = {
  track: "backend",
  goal: "job",
  hoursPerWeek: 10,
  skills: [
    "apis",
    "reliability",
    "caching",
    "databases",
    "observability",
    "deployment",
    "testing",
    "streaming",
  ],
};

const NEWCOMER = { track: "new", goal: "depth", hoursPerWeek: 5, skills: [] };

const ALL_SKILLS = C.skills.map((s) => s.id);

describe("plan generation", () => {
  test("covers every chapter exactly once", () => {
    const plan = C.planFor(BACKEND);
    assert.equal(plan.items.length, C.chapters.length);
    const ids = new Set(plan.items.map((i) => i.id));
    assert.equal(ids.size, C.chapters.length);
  });

  test("assigns only known modes", () => {
    const plan = C.planFor(BACKEND);
    for (const it of plan.items) {
      assert.ok(["deep", "study", "skim"].includes(it.mode), it.mode);
    }
  });

  test("core chapters are never downgraded below deep", () => {
    for (const profile of [BACKEND, NEWCOMER]) {
      const plan = C.planFor(profile);
      for (const id of C.core) {
        assert.equal(plan.byId[id].mode, "deep", `${id} should be deep`);
      }
    }
  });

  test("a newcomer skims nothing", () => {
    const plan = C.planFor(NEWCOMER);
    assert.equal(plan.counts.skim, 0);
  });

  test("a backend engineer skims a meaningful number of chapters", () => {
    const plan = C.planFor(BACKEND);
    assert.ok(
      plan.counts.skim >= 6,
      `expected at least 6 skims, got ${plan.counts.skim}`
    );
  });

  test("skim requires every overlapping skill, not just one", () => {
    /* The onboarding tells you to uncheck anything that isn't true, promising
       that an over-claimed skill is what gets a chapter wrongly marked skim.
       That promise was false: any degree:"high" chapter skimmed on a single
       claimed skill, so unchecking the one you lacked changed nothing. */
    const multi = Object.keys(C.overlap).filter(
      (id) => (C.overlap[id].skills || []).length > 1
    );
    assert.ok(multi.length >= 4, "expected multi-skill overlaps to test");

    for (const id of multi) {
      const skills = C.overlap[id].skills;
      const partial = C.planFor({ ...BACKEND, skills: skills.slice(1) });
      const whole = C.planFor({ ...BACKEND, skills: skills });
      if (whole.byId[id].mode === "skim") {
        assert.notEqual(
          partial.byId[id].mode,
          "skim",
          `${id} skims on ${skills.length - 1} of ${skills.length} skills`
        );
      }
    }
  });

  test("the orientation chapter is never marked skim", () => {
    // It is the frame the other 43 chapters hang off, and it is the first thing
    // the plan's Continue button points at. "Skip this" is a bad first minute.
    for (const p of [BACKEND, NEWCOMER, { ...BACKEND, skills: ALL_SKILLS }]) {
      assert.notEqual(C.planFor(p).byId.role.mode, "skim");
    }
  });

  test("claiming more skills never increases total effort", () => {
    const none = C.planFor({ ...BACKEND, skills: [] });
    const some = C.planFor(BACKEND);
    assert.ok(some.readingMinutes <= none.readingMinutes);
  });

  test("every item carries a rationale", () => {
    const plan = C.planFor(BACKEND);
    for (const it of plan.items) {
      assert.ok(it.why && it.why.length > 20, `${it.id} has no useful why`);
    }
  });

  test("a note is marked generic unless it is about that chapter", () => {
    /* 31 of 44 rows used to repeat one of two boilerplate sentences, which buried
       the 13 carrying real guidance — and those notes are the whole point of a
       personalised plan. The flag lets the view show only the ones that earn a
       line, while the text still travels for tooltips and assistive output. */
    const plan = C.planFor(BACKEND);
    const specific = plan.items.filter((i) => !i.generic);
    assert.ok(
      specific.length >= 10,
      `expected 10+ chapter-specific notes, got ${specific.length}`
    );

    const BOILER = [
      "New material for you — read it properly.",
      "Core chapter — this is load-bearing for everything after it, and it's what interviews probe.",
    ];
    for (const it of specific) {
      assert.ok(
        !BOILER.includes(it.why),
        `${it.id} is marked specific but carries boilerplate`
      );
    }
    for (const it of plan.items.filter((i) => i.generic)) {
      assert.ok(
        BOILER.includes(it.why),
        `${it.id} is marked generic but says something specific: ${it.why}`
      );
    }

    // A skim recommendation without a reason is the one thing this must not do.
    for (const it of plan.items.filter((i) => i.mode === "skim")) {
      assert.equal(it.generic, false, `${it.id} skims with a generic note`);
    }
  });

  test("a newcomer's notes are all generic, and that is correct", () => {
    // Nothing overlaps, so there is no delta to report on any chapter.
    const plan = C.planFor(NEWCOMER);
    assert.equal(plan.items.filter((i) => !i.generic).length, 0);
  });

  test("skimmed chapters explain what is still new", () => {
    const plan = C.planFor(BACKEND);
    const skims = plan.items.filter((i) => i.mode === "skim");
    for (const it of skims) {
      // A skim note must be the specific delta, not the generic fallback.
      assert.ok(
        it.why.length > 80,
        `${it.id} skim note is too generic: ${it.why}`
      );
    }
  });
});

describe("project cross-references", () => {
  test("every milestone points at a chapter that exists", () => {
    const ids = new Set(C.chapters.map((c) => c.id));
    let n = 0;
    for (const pr of C.projects) {
      for (const [i, t] of pr.tasks.entries()) {
        assert.ok(t.t, `${pr.id} task[${i}] has no text`);
        assert.ok(t.ch, `${pr.id} task[${i}] has no chapter reference`);
        assert.ok(ids.has(t.ch), `${pr.id} task[${i}] -> unknown "${t.ch}"`);
        n++;
      }
    }
    assert.ok(n >= 40, `expected 40+ milestones, got ${n}`);
  });

  test("the reverse index agrees with the forward references", () => {
    /* The chapter's "where you'll use this" is computed from the milestones
       rather than authored, so the two directions cannot drift. This asserts the
       derivation, since it is the thing a future edit would break. */
    const reverse = {};
    for (const pr of C.projects) {
      for (const [i, t] of pr.tasks.entries()) {
        (reverse[t.ch] = reverse[t.ch] || []).push(`${pr.id}#${i}`);
      }
    }
    const forward = [];
    for (const pr of C.projects)
      for (const [i, t] of pr.tasks.entries()) forward.push(`${pr.id}#${i}`);

    assert.equal(
      Object.values(reverse).flat().sort().join(),
      forward.sort().join(),
      "every milestone appears exactly once in the reverse index"
    );

    // A chapter with no milestone is legitimate — groundwork and optional
    // directions — but most of the curriculum should be applied somewhere.
    const covered = Object.keys(reverse).length;
    assert.ok(
      covered >= 24 && covered <= C.chapters.length,
      `${covered} of ${C.chapters.length} chapters are used by a project`
    );
  });

  /* A milestone may legitimately draw on material from a later phase — the
     warm-up project asks for hand-labelled test cases and per-field precision,
     which is evaluation work taught in phase 6, and that is the project being
     honest about what shipping requires rather than a bad reference. But it must
     be a decision, not a slip: the first version of this mapping sent a phase-2
     project's reader to Tool Use & Function Calling in phase 5 when Prompt
     Anatomy in phase 2 taught the same point. Every forward reference is listed
     here, so adding one means writing down why. */
  const FORWARD_OK = new Set([
    "p-classifier#3", // hand-labelled test cases -> eval-datasets
    "p-classifier#4", // per-field precision -> eval-metrics
    "p-classifier#5", // confidence correlation -> llm-judge
    "p-rag#5", // graded relevance labels -> eval-datasets
    "p-agent#4", // OpenTelemetry spans -> observability
    "p-agent#6", // trajectory eval -> agent-evals
    "p-ship#7", // public post-mortem -> interview-prep
  ]);

  test("a milestone reaching into a later phase is a listed decision", () => {
    const order = C.phases.map((p) => p.id);
    const phaseOf = {};
    C.chapters.forEach((c) => (phaseOf[c.id] = order.indexOf(c.phase)));
    const forward = [];
    for (const pr of C.projects) {
      const own = order.indexOf(pr.phase);
      for (const [i, t] of pr.tasks.entries()) {
        if (phaseOf[t.ch] > own) forward.push(`${pr.id}#${i}`);
      }
    }
    for (const key of forward) {
      assert.ok(
        FORWARD_OK.has(key),
        `${key} points at a later phase and is not in FORWARD_OK — ` +
          `either pick an earlier chapter that teaches the same point, or list it`
      );
    }
    for (const key of FORWARD_OK) {
      assert.ok(
        forward.includes(key),
        `${key} is listed as a forward reference but no longer is one`
      );
    }
  });
});

describe("scheduling", () => {
  test("total time includes project hours, not just reading", () => {
    const plan = C.planFor(BACKEND);
    assert.ok(plan.projectMinutes > 0);
    assert.equal(plan.totalMinutes, plan.readingMinutes + plan.projectMinutes);
    // Projects should dominate: that is the honest shape of learning this.
    assert.ok(plan.projectMinutes > plan.readingMinutes);
  });

  test("produces a plausible duration rather than an absurd one", () => {
    const plan = C.planFor(BACKEND);
    // Reported real-world transitions cluster at 3-6 months part-time.
    assert.ok(
      plan.totalWeeks >= 8 && plan.totalWeeks <= 30,
      `${plan.totalWeeks} weeks is not plausible at 10 h/week`
    );
  });

  test("more hours per week means fewer weeks", () => {
    const slow = C.planFor({ ...BACKEND, hoursPerWeek: 5 });
    const fast = C.planFor({ ...BACKEND, hoursPerWeek: 20 });
    assert.ok(fast.totalWeeks < slow.totalWeeks);
  });

  /* A profile written by an older version, or restored from a hand-edited
     export, can carry a missing or non-numeric hoursPerWeek. The plan must
     resolve it and report what it used — the plan view prints
     plan.hoursPerWeek, and printing the raw profile field rendered
     "31 weeks at undefined h/week". */
  test("reports the hours per week it actually scheduled", () => {
    assert.equal(C.planFor(BACKEND).hoursPerWeek, 10);
    for (const bad of [undefined, null, "", "ten", 0, -4, NaN]) {
      const plan = C.planFor({ ...BACKEND, hoursPerWeek: bad });
      assert.ok(
        Number.isFinite(plan.hoursPerWeek) && plan.hoursPerWeek > 0,
        `hoursPerWeek=${String(bad)} produced ${plan.hoursPerWeek}`
      );
      assert.ok(plan.totalWeeks > 0);
    }
    // A numeric string is a legitimate value, not a fallback case.
    assert.equal(
      C.planFor({ ...BACKEND, hoursPerWeek: "20" }).hoursPerWeek,
      20
    );
  });

  test("no week is scheduled far beyond its budget", () => {
    for (const hours of [3, 5, 10, 20]) {
      const plan = C.planFor({ ...BACKEND, hoursPerWeek: hours });
      const budget = hours * 60;
      for (const wk of plan.weeks) {
        // One long chapter may overshoot slightly; a whole week must not.
        assert.ok(
          wk.minutes <= budget * 1.5,
          `week ${wk.n} at ${hours}h/wk: ${wk.minutes}m vs ${budget}m budget`
        );
      }
    }
  });

  test("every chapter appears in exactly one week", () => {
    const plan = C.planFor(BACKEND);
    const seen = [];
    plan.weeks.forEach((wk) => wk.items.forEach((it) => seen.push(it.id)));
    assert.equal(seen.length, C.chapters.length);
    assert.equal(new Set(seen).size, C.chapters.length);
  });

  test("every project is scheduled, split if it exceeds a week", () => {
    const plan = C.planFor({ ...BACKEND, hoursPerWeek: 5 });
    const scheduled = new Map();
    plan.weeks.forEach((wk) =>
      wk.projects.forEach((slot) => {
        const cur = scheduled.get(slot.project.id) || 0;
        scheduled.set(slot.project.id, cur + slot.minutes);
      })
    );
    assert.equal(scheduled.size, C.projects.length);
    // Each project's scheduled minutes should equal its estimate.
    for (const pr of C.projects) {
      assert.ok(scheduled.get(pr.id) > 0, `${pr.id} not scheduled`);
    }
  });

  test("a project spanning weeks is labelled with part numbers", () => {
    const plan = C.planFor({ ...BACKEND, hoursPerWeek: 3 });
    const multi = [];
    plan.weeks.forEach((wk) =>
      wk.projects.forEach((s) => {
        if (s.parts > 1) multi.push(s);
      })
    );
    assert.ok(multi.length > 0, "expected at least one split project at 3h/wk");
    for (const s of multi) {
      assert.ok(s.part >= 1 && s.part <= s.parts);
    }
  });

  test("weeks are numbered contiguously from 1", () => {
    const plan = C.planFor(BACKEND);
    plan.weeks.forEach((wk, i) => assert.equal(wk.n, i + 1));
  });
});

describe("tracks and overlap data", () => {
  test("every track's assumed skills exist", () => {
    const ids = new Set(C.skills.map((s) => s.id));
    for (const t of C.tracks) {
      for (const s of t.assumes) assert.ok(ids.has(s), `${t.id}: ${s}`);
    }
  });

  test("every overlap entry targets a real chapter and real skills", () => {
    const chapterIds = new Set(C.chapters.map((c) => c.id));
    const skillIds = new Set(C.skills.map((s) => s.id));
    for (const [chId, ov] of Object.entries(C.overlap)) {
      assert.ok(chapterIds.has(chId), `unknown chapter ${chId}`);
      assert.ok(["high", "partial", "low"].includes(ov.degree));
      assert.ok(ov.delta && ov.delta.length > 60, `${chId}: thin delta`);
      for (const s of ov.skills) assert.ok(skillIds.has(s), `${chId}: ${s}`);
    }
  });

  test("core chapter ids all exist", () => {
    const ids = new Set(C.chapters.map((c) => c.id));
    for (const id of C.core) assert.ok(ids.has(id), id);
  });

  test("deltaCount reflects claimed skills", () => {
    assert.equal(C.deltaCount({ skills: [] }), 0);
    assert.ok(C.deltaCount(BACKEND) > 5);
  });
});
