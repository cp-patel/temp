/* ============================================================
   Portfolio export — the artefact.

   Everything else in this app measures. None of it produces anything you can send
   to someone. That is a real gap, because the claim this curriculum makes is that
   you should be able to *prove* the result works, and the proof has to leave the
   browser to be worth anything.

   What makes a case study credible in this field is specifically numbers. "I built
   a RAG system" is worth nothing next to "recall@5 went from 0.61 to 0.82 with a
   cross-encoder over the top 50, measured on a 40-question set with graded
   relevance labels, and p95 latency stayed under 900 ms". The second sentence is
   also much harder to fake, which is exactly why it is the one that gets asked
   about — so each project carries the list of numbers its own tasks tell you to
   collect, and this file assembles whatever has been recorded into Markdown.

   It deliberately does not invent, round, or pad. An unrecorded number is shown as
   missing, because a portfolio generator that fills gaps with prose produces
   exactly the kind of document that falls apart in the follow-up question.
   ============================================================ */
(function (global) {
  "use strict";

  var C = global.Curriculum;

  function esc(v) {
    return String(v === undefined || v === null ? "" : v);
  }

  /* Markdown table cells cannot contain a raw pipe, and a learner pasting
     "cost | per user" into a metric field should not silently break the table. */
  function cell(v) {
    return esc(v).replace(/\|/g, "\\|").replace(/\n+/g, " ");
  }

  function tickedCount(tasks, ticks) {
    var n = 0;
    (tasks || []).forEach(function (_, i) {
      if (ticks[i]) n++;
    });
    return n;
  }

  /**
   * Assemble the portfolio.
   *
   * `state` is plain data:
   *   { projectTasks: {pid:{i:true}}, evidence: {pid:{metrics:{},notes:""}},
   *     notes: {chapterId: string}, readiness: <readinessFor() result or null> }
   *
   * Returns { markdown, projects, started, missing, words }.
   */
  /* The lowest score the export is willing to quote. Read off the bands so the UI
     can tell the learner where the line is without duplicating the number. */
  C.portfolioClaimAt = function () {
    var at = null;
    (C.readinessBands || []).forEach(function (b) {
      if (b.claim && at === null) at = b.at;
    });
    return at;
  };

  C.portfolioFor = function (state) {
    state = state || {};
    var ticks = state.projectTasks || {};
    var evidence = state.evidence || {};
    var readiness = state.readiness || null;

    var out = [];
    var missing = [];

    (C.projects || []).forEach(function (p) {
      var t = ticks[p.id] || {};
      var doneCount = tickedCount(p.tasks, t);
      var ev = evidence[p.id] || {};
      var recorded = ev.metrics || {};

      var filled = (p.metrics || []).filter(function (m) {
        return (recorded[m.key] || "").trim().length > 0;
      });
      var blank = (p.metrics || []).filter(function (m) {
        return !(recorded[m.key] || "").trim().length;
      });

      out.push({
        id: p.id,
        title: p.title,
        tier: p.tier,
        started: doneCount > 0,
        complete: doneCount === (p.tasks || []).length,
        milestones: (p.tasks || []).length,
        milestonesDone: doneCount,
        metrics: (p.metrics || []).length,
        metricsFilled: filled.length,
        notes: (ev.notes || "").trim(),
        filled: filled.map(function (m) {
          return { key: m.key, label: m.label, value: recorded[m.key].trim() };
        }),
        blank: blank,
      });

      /* A project with milestones ticked and no numbers recorded is the one case
         worth naming out loud: it is work that has been done and cannot be
         evidenced, which is the failure this whole feature exists to prevent. */
      if (doneCount > 0 && filled.length === 0) {
        missing.push({
          id: p.id,
          title: p.title,
          why: "milestones ticked, no numbers recorded",
        });
      } else if (doneCount > 0 && blank.length) {
        missing.push({
          id: p.id,
          title: p.title,
          why:
            blank.length + " of " + p.metrics.length + " numbers still blank",
        });
      }
    });

    var started = out.filter(function (p) {
      return p.started;
    });

    /* ---------------------------------------------------------
       Markdown
       --------------------------------------------------------- */
    var md = [];
    md.push("# AI Engineering Portfolio");
    md.push("");

    if (!started.length) {
      md.push(
        "_Nothing to show yet. Tick a project milestone and record its numbers, " +
          "and this becomes a case study you can paste into a README._"
      );
      return {
        markdown: md.join("\n") + "\n",
        projects: out,
        started: 0,
        missing: missing,
        words: 0,
      };
    }

    var totalDone = 0;
    var totalMilestones = 0;
    started.forEach(function (p) {
      totalDone += p.milestonesDone;
      totalMilestones += p.milestones;
    });

    var lead =
      started.length +
      (started.length === 1 ? " project" : " projects") +
      ", " +
      totalDone +
      " of " +
      totalMilestones +
      " milestones delivered";
    /* Only once the number is a claim worth making — see `claim` on the bands. */
    if (readiness && readiness.band && readiness.band.claim) {
      lead +=
        ". Self-assessed against the competencies an AI engineering interview " +
        "tests: **" +
        readiness.overall +
        "% — " +
        readiness.band.name +
        "**";
    }
    md.push(lead + ".");
    md.push("");

    /* A contents list, because six case studies is long enough that a reader
       scanning for the eval harness should not have to page for it. */
    if (started.length > 2) {
      started.forEach(function (p) {
        md.push(
          "- [" +
            p.title +
            "](#" +
            p.title
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, "")
              .replace(/\s+/g, "-") +
            ")"
        );
      });
      md.push("");
    }

    started.forEach(function (p) {
      var proj = null;
      C.projects.forEach(function (x) {
        if (x.id === p.id) proj = x;
      });
      md.push("## " + p.title);
      md.push("");
      md.push(
        "_" +
          p.tier +
          " · " +
          proj.hours +
          " · " +
          proj.stack +
          "_" +
          (p.complete
            ? ""
            : "  \n_In progress: " +
              p.milestonesDone +
              " of " +
              p.milestones +
              " milestones._")
      );
      md.push("");
      md.push(proj.brief);
      md.push("");
      md.push("**Demonstrates:** " + proj.proves);
      md.push("");

      if (p.filled.length) {
        md.push("### Results");
        md.push("");
        md.push("| Measure | Value |");
        md.push("| --- | --- |");
        p.filled.forEach(function (m) {
          md.push("| " + cell(m.label) + " | " + cell(m.value) + " |");
        });
        md.push("");
      }

      if (p.notes) {
        md.push("### Notes");
        md.push("");
        md.push(p.notes);
        md.push("");
      }

      md.push("### Delivered");
      md.push("");
      (proj.tasks || []).forEach(function (task, i) {
        var t = ticks[p.id] || {};
        /* Unticked milestones are included, unticked. A checklist showing only the
           done items is a claim about scope; one showing both is a claim about
           progress, and the second is both more honest and more useful to a reader
           deciding whether to ask about it. */
        md.push("- [" + (t[i] ? "x" : " ") + "] " + (task.t || task));
      });
      md.push("");
    });

    /* A short, honest footer. Anyone can tell a generated document from a written
       one; saying so costs nothing and pre-empts the thought. */
    md.push("---");
    md.push("");
    md.push(
      "_Assembled from my own progress tracking. Milestone checkboxes and the " +
        "measures above are self-reported; the code and the eval sets are the " +
        "actual evidence._"
    );

    var text = md.join("\n") + "\n";
    return {
      markdown: text,
      projects: out,
      started: started.length,
      missing: missing,
      words: text.split(/\s+/).filter(Boolean).length,
    };
  };
})(window);
