/**
 * The portfolio export.
 *
 * This is the only output of the app that leaves the browser and gets read by
 * someone deciding whether to hire the author, which changes what "correct" means.
 * A rendering bug here is not a wrong pixel, it is a claim in a document with the
 * learner's name on it. So: it must never invent a number, never quote a
 * self-assessment it should not, and never silently drop a gap it should be
 * naming.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadCurriculum } from "../../scripts/lib/load-curriculum.mjs";

const C = loadCurriculum();

const RAG = C.projects.filter((p) => p.id === "p-rag")[0];

/** Every milestone of `pid` ticked. */
function allTicked(pid) {
  const p = C.projects.filter((x) => x.id === pid)[0];
  const out = {};
  p.tasks.forEach((_, i) => (out[i] = true));
  return out;
}

function withMetrics(pid, values, notes = "") {
  return { [pid]: { metrics: { ...values }, notes } };
}

/** A readiness report whose band is above / below the portfolio claim line. */
function readinessAt(wantClaim) {
  const s = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
  if (wantClaim) {
    for (const ch of C.chapters) {
      s.done[ch.id] = true;
      if ((ch.quiz || []).length)
        s.quiz[ch.id] = { right: ch.quiz.length, total: ch.quiz.length };
      if (ch.lab) s.labs[ch.lab] = true;
    }
    for (const p of C.projects) {
      s.projectTasks[p.id] = {};
      p.tasks.forEach((_, i) => (s.projectTasks[p.id][i] = true));
    }
  }
  return C.readinessFor(s);
}

describe("the metric fields", () => {
  test("every project asks for at least three numbers", () => {
    for (const p of C.projects) {
      assert.ok(
        (p.metrics || []).length >= 3,
        `${p.id} has ${(p.metrics || []).length}`
      );
    }
  });

  test("metric keys are unique within a project", () => {
    for (const p of C.projects) {
      const keys = p.metrics.map((m) => m.key);
      assert.equal(keys.length, new Set(keys).size, p.id);
    }
  });

  /* A metric about something the project does not build is a question the learner
     cannot answer, so each one has to name a chapter the project's own milestones
     already draw on. */
  test("every metric names a chapter its own project uses", () => {
    const ids = new Set(C.chapters.map((c) => c.id));
    for (const p of C.projects) {
      const own = new Set(p.tasks.map((t) => t.ch));
      for (const m of p.metrics) {
        assert.ok(
          ids.has(m.ch),
          `${p.id}/${m.key} → unknown chapter "${m.ch}"`
        );
        assert.ok(
          own.has(m.ch),
          `${p.id}/${m.key} → "${m.ch}" is not used by this project`
        );
      }
    }
  });

  test("every metric has a label and a substantive hint", () => {
    for (const p of C.projects) {
      for (const m of p.metrics) {
        assert.ok(m.label && m.label.length > 5, `${p.id}/${m.key}`);
        assert.ok(
          m.hint && m.hint.length > 40,
          `${p.id}/${m.key} hint too thin`
        );
      }
    }
  });
});

describe("assembling the document", () => {
  test("an empty portfolio says so and does not fake a case study", () => {
    const r = C.portfolioFor({});
    assert.equal(r.started, 0);
    assert.equal(r.words, 0);
    assert.match(r.markdown, /Nothing to show yet/);
    for (const p of C.projects) {
      assert.ok(
        !r.markdown.includes(p.title),
        `${p.title} leaked into an empty export`
      );
    }
  });

  test("no signals at all behaves like empty signals", () => {
    assert.doesNotThrow(() => C.portfolioFor());
    assert.equal(C.portfolioFor().started, 0);
  });

  test("only started projects appear", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
    });
    assert.equal(r.started, 1);
    assert.ok(r.markdown.includes(RAG.title));
    for (const p of C.projects) {
      if (p.id === "p-rag") continue;
      assert.ok(
        !r.markdown.includes("## " + p.title),
        `${p.id} appeared with no milestones ticked`
      );
    }
  });

  /* The load-bearing property: it can only ever contain what was written down. */
  test("it never invents a number", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": allTicked("p-rag") },
      evidence: withMetrics("p-rag", { recallAfter: "0.82" }),
    });
    assert.ok(r.markdown.includes("0.82"));
    /* The five unrecorded metrics must not appear as rows at all. */
    for (const m of RAG.metrics) {
      if (m.key === "recallAfter") continue;
      assert.ok(
        !r.markdown.includes("| " + m.label + " |"),
        `${m.key} was given a row with no value`
      );
    }
  });

  test("a blank or whitespace metric is treated as unrecorded", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": allTicked("p-rag") },
      evidence: withMetrics("p-rag", { recallAfter: "   ", evalSize: "" }),
    });
    const proj = r.projects.filter((p) => p.id === "p-rag")[0];
    assert.equal(proj.metricsFilled, 0);
    assert.ok(!r.markdown.includes("### Results"));
  });

  test("recorded values are trimmed", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      evidence: withMetrics("p-rag", { recallAfter: "  0.82  " }),
    });
    assert.ok(r.markdown.includes("| 0.82 |"));
  });

  /* A pipe in a value would break the table it sits in, and "cost | per user" is
     a plausible thing to type. */
  test("a pipe in a value cannot break the table", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      evidence: withMetrics("p-rag", { recallAfter: "0.61 | 0.82" }),
    });
    const row = r.markdown.split("\n").filter((l) => l.includes("0.61"))[0];
    assert.ok(row, "the row is missing");
    /* Exactly the three cell delimiters of a two-column row. */
    assert.equal((row.match(/(?<!\\)\|/g) || []).length, 3, row);
  });

  test("a newline in a value cannot break the table", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      evidence: withMetrics("p-rag", { recallAfter: "0.82\nand rising" }),
    });
    const rows = r.markdown.split("\n").filter((l) => l.includes("0.82"));
    assert.equal(rows.length, 1, "the value was split across lines");
    assert.ok(rows[0].includes("and rising"));
  });

  test("both ticked and unticked milestones are listed, correctly marked", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true, 2: true } },
    });
    RAG.tasks.forEach((t, i) => {
      const want = "- [" + (i === 0 || i === 2 ? "x" : " ") + "] " + t.t;
      assert.ok(r.markdown.includes(want), `milestone ${i} is wrong`);
    });
  });

  test("an in-progress project says so; a complete one does not", () => {
    const partial = C.portfolioFor({ projectTasks: { "p-rag": { 0: true } } });
    assert.match(partial.markdown, /In progress: 1 of 7 milestones/);

    const full = C.portfolioFor({
      projectTasks: { "p-rag": allTicked("p-rag") },
    });
    assert.doesNotMatch(full.markdown, /In progress/);
  });

  test("notes appear only when written", () => {
    const without = C.portfolioFor({ projectTasks: { "p-rag": { 0: true } } });
    assert.ok(!without.markdown.includes("### Notes"));

    const withNote = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      evidence: withMetrics("p-rag", {}, "The reranker was the win."),
    });
    assert.ok(withNote.markdown.includes("### Notes"));
    assert.ok(withNote.markdown.includes("The reranker was the win."));
  });

  test("whitespace-only notes are not notes", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      evidence: withMetrics("p-rag", {}, "   \n  "),
    });
    assert.ok(!r.markdown.includes("### Notes"));
  });

  test("a contents list appears once there is enough to scan", () => {
    const two = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true }, "p-chat": { 0: true } },
    });
    assert.ok(
      !two.markdown.includes("](#"),
      "two projects need no contents list"
    );

    const four = C.portfolioFor({
      projectTasks: {
        "p-rag": { 0: true },
        "p-chat": { 0: true },
        "p-agent": { 0: true },
        "p-evals": { 0: true },
      },
    });
    assert.ok(four.markdown.includes("](#"));
    /* Anchors must match what a Markdown renderer derives from the heading. */
    for (const line of four.markdown.split("\n")) {
      const m = line.match(/^- \[(.+)\]\(#(.+)\)$/);
      if (!m) continue;
      const derived = m[1]
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      assert.equal(m[2], derived, `anchor for "${m[1]}"`);
      assert.ok(
        four.markdown.includes("## " + m[1]),
        `anchor points at a heading that is not there: ${m[1]}`
      );
    }
  });

  test("the footer says the numbers are self-reported", () => {
    const r = C.portfolioFor({ projectTasks: { "p-rag": { 0: true } } });
    assert.match(r.markdown, /self-reported/i);
  });

  test("word count matches the document", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": allTicked("p-rag") },
      evidence: withMetrics("p-rag", { recallAfter: "0.82" }, "A note."),
    });
    assert.equal(r.words, r.markdown.split(/\s+/).filter(Boolean).length);
  });
});

describe("the readiness claim", () => {
  test("the claim line is omitted below the threshold", () => {
    const low = readinessAt(false);
    assert.ok(low.overall < C.portfolioClaimAt());
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      readiness: low,
    });
    assert.doesNotMatch(r.markdown, /Self-assessed/);
    assert.ok(
      !r.markdown.includes(low.overall + "% — "),
      "a low score was quoted"
    );
  });

  test("and included above it", () => {
    const high = readinessAt(true);
    assert.ok(high.overall >= C.portfolioClaimAt());
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      readiness: high,
    });
    assert.match(r.markdown, /Self-assessed/);
    assert.ok(r.markdown.includes(high.overall + "% — " + high.band.name));
  });

  test("no readiness report at all means no claim", () => {
    const r = C.portfolioFor({ projectTasks: { "p-rag": { 0: true } } });
    assert.doesNotMatch(r.markdown, /Self-assessed/);
  });

  test("the threshold is a real band boundary", () => {
    const at = C.portfolioClaimAt();
    assert.ok(typeof at === "number" && at > 0 && at < 100, String(at));
    const band = C.readinessBands.filter((b) => b.at === at)[0];
    assert.ok(band && band.claim, "the threshold is not a claiming band");
    /* Every band above it must also be claimable, or the line would appear and
       then vanish as the learner improved. */
    for (const b of C.readinessBands) {
      if (b.at > at)
        assert.ok(b.claim, `${b.name} at ${b.at} is not claimable`);
      if (b.at < at) assert.ok(!b.claim, `${b.name} at ${b.at} claims early`);
    }
  });
});

describe("naming the gaps", () => {
  test("a started project with no numbers is called out", () => {
    const r = C.portfolioFor({ projectTasks: { "p-rag": { 0: true } } });
    const gap = r.missing.filter((m) => m.id === "p-rag")[0];
    assert.ok(gap, "no gap reported");
    assert.match(gap.why, /no numbers recorded/);
  });

  test("a partly evidenced project reports how many are blank", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": allTicked("p-rag") },
      evidence: withMetrics("p-rag", { recallAfter: "0.82", evalSize: "40" }),
    });
    const gap = r.missing.filter((m) => m.id === "p-rag")[0];
    assert.ok(gap);
    assert.match(
      gap.why,
      new RegExp(`${RAG.metrics.length - 2} of ${RAG.metrics.length}`)
    );
  });

  test("a fully evidenced project is not a gap", () => {
    const values = {};
    RAG.metrics.forEach((m) => (values[m.key] = "measured"));
    const r = C.portfolioFor({
      projectTasks: { "p-rag": allTicked("p-rag") },
      evidence: withMetrics("p-rag", values),
    });
    assert.equal(r.missing.filter((m) => m.id === "p-rag").length, 0);
  });

  test("an untouched project is not a gap — it is just not started", () => {
    const r = C.portfolioFor({});
    assert.equal(r.missing.length, 0);
  });
});

describe("damaged input", () => {
  test("nothing here throws", () => {
    for (const bad of [
      undefined,
      {},
      { projectTasks: null, evidence: null, readiness: null },
      { projectTasks: { "no-such-project": { 0: true } } },
      { evidence: { "p-rag": null } },
      { evidence: { "p-rag": { metrics: null, notes: null } } },
      { evidence: { "p-rag": { metrics: { nope: "x" } } } },
      { projectTasks: { "p-rag": { 99: true } } },
      { readiness: { overall: 80 } },
    ]) {
      assert.doesNotThrow(() => C.portfolioFor(bad), JSON.stringify(bad));
      const r = C.portfolioFor(bad);
      assert.ok(typeof r.markdown === "string" && r.markdown.length > 10);
    }
  });

  test("a metric key that is not in the project is ignored", () => {
    const r = C.portfolioFor({
      projectTasks: { "p-rag": { 0: true } },
      evidence: withMetrics("p-rag", { notARealMetric: "42" }),
    });
    assert.ok(!r.markdown.includes("42"));
    assert.equal(
      r.projects.filter((p) => p.id === "p-rag")[0].metricsFilled,
      0
    );
  });
});

describe("the store's evidence state", () => {
  async function freshStore() {
    const { loadModule } =
      await import("../../scripts/lib/load-curriculum.mjs");
    const util = loadModule("js/core/util.js");
    return loadModule("js/core/store.js", { U: util.U, Curriculum: C }).Store;
  }

  test("metrics and notes round-trip", async () => {
    const Store = await freshStore();
    Store.setMetric("p-rag", "recallAfter", "  0.82 ");
    Store.setEvidenceNotes("p-rag", "The reranker won.");
    assert.equal(Store.evidence("p-rag").metrics.recallAfter, "0.82");
    assert.equal(Store.evidence("p-rag").notes, "The reranker won.");
    const c = Store.evidenceCount("p-rag");
    assert.equal(c.metrics, 1);
    assert.ok(c.notes > 0);
  });

  test("clearing a metric removes it rather than storing an empty string", async () => {
    const Store = await freshStore();
    Store.setMetric("p-rag", "recallAfter", "0.82");
    Store.setMetric("p-rag", "recallAfter", "   ");
    assert.equal(Store.evidence("p-rag").metrics.recallAfter, undefined);
    assert.equal(Store.evidenceCount("p-rag").metrics, 0);
  });

  test("counting a project with no evidence does not create a record", async () => {
    const Store = await freshStore();
    assert.deepEqual(
      { ...Store.evidenceCount("p-chat") },
      { metrics: 0, notes: 0 }
    );
    assert.equal(Store.state().evidence["p-chat"], undefined);
  });

  test("the portfolio reflects the store", async () => {
    const Store = await freshStore();
    Store.projTask("p-rag", 0);
    Store.setMetric("p-rag", "recallAfter", "0.82");
    const r = Store.portfolio();
    assert.ok(r.markdown.includes("0.82"));
    assert.equal(r.started, 1);
  });

  /* Evidence is prose the learner typed and the only state here that would be
     painful to lose, so it has to survive the export/import round trip that
     Settings offers — and a hand-edited file is a supported way back in. */
  test("evidence survives export and import", async () => {
    const Store = await freshStore();
    Store.setMetric("p-rag", "recallAfter", "0.82");
    Store.setEvidenceNotes("p-rag", "Kept.");
    const dump = Store.export();

    const Fresh = await freshStore();
    Fresh.import(dump);
    assert.equal(Fresh.evidence("p-rag").metrics.recallAfter, "0.82");
    assert.equal(Fresh.evidence("p-rag").notes, "Kept.");
  });

  test("a damaged evidence payload is repaired on import", async () => {
    const Store = await freshStore();
    for (const payload of [
      '{"evidence": "nope"}',
      '{"evidence": {"p-rag": 7}}',
      '{"evidence": {"p-rag": {"metrics": "nope", "notes": 3}}}',
      '{"evidence": {"p-rag": {"metrics": {"recallAfter": 0.82}}}}',
    ]) {
      assert.doesNotThrow(() => Store.import(payload), payload);
      /* Whatever survived, the shape the UI dereferences must hold. */
      const rec = Store.evidence("p-rag");
      assert.equal(typeof rec.metrics, "object");
      assert.equal(typeof rec.notes, "string");
      assert.doesNotThrow(() => Store.portfolio());
      assert.doesNotThrow(() => Store.setMetric("p-rag", "recallAfter", "0.9"));
    }
  });
});
