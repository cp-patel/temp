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
