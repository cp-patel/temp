/* ============================================================
   Readiness model — what the job actually asks for, and how far
   along you are against each part of it.

   The rest of the app measures progress through content: chapters done, XP,
   percent complete. That is not the question a career-changer has. Theirs is
   "am I ready, and if not, what is the gap?" — and the app already stores every
   signal needed to answer it: which chapters are complete, how the quizzes went,
   which labs were used, which project milestones are ticked.

   The competency weights follow the interview loop this curriculum is shaped
   around (reported 2026 loops: roughly 40% retrieval/evals/agents, 30%
   production systems, 20% model internals, 10% behavioural), redistributed so
   that every phase feeds something and evaluation carries the largest single
   technical share — which is the position the content takes throughout.
   ============================================================ */
(function (global) {
  "use strict";

  var C = global.Curriculum;

  /* Each competency draws on the chapters of one or more phases, the labs inside
     them, and the projects that evidence it. `weight` is its share of overall
     readiness and the set must sum to 1 — the validator checks it. */
  C.competencies = [
    {
      id: "internals",
      label: "Model internals & economics",
      short: "Internals",
      weight: 0.15,
      phases: ["foundations"],
      projects: [],
      probes:
        "What a token costs, why the same prompt answers differently twice, and " +
        "which model to reach for. Interviews use this to check you are not " +
        "treating the model as magic.",
    },
    {
      id: "application",
      label: "Application engineering",
      short: "Application",
      weight: 0.2,
      phases: ["prompting", "building"],
      projects: ["p-classifier", "p-chat"],
      probes:
        "Prompt structure, structured output, streaming, state, caching and the " +
        "unit economics of a feature. The largest single block of the working day " +
        "and the easiest to demonstrate.",
    },
    {
      id: "retrieval",
      label: "Retrieval systems",
      short: "Retrieval",
      weight: 0.15,
      phases: ["retrieval"],
      projects: ["p-rag"],
      probes:
        "Chunking, hybrid search, reranking, and diagnosing a RAG system that " +
        "returns plausible nonsense. The most common system-design question in " +
        "this field.",
    },
    {
      id: "agents",
      label: "Agents & tools",
      short: "Agents",
      weight: 0.13,
      phases: ["agents"],
      projects: ["p-agent"],
      probes:
        "Tool design, the loop, budgets, and knowing when a workflow beats an " +
        "agent. Interviewers are looking for restraint as much as capability.",
    },
    {
      id: "evaluation",
      label: "Evaluation",
      short: "Evaluation",
      weight: 0.17,
      phases: ["evals"],
      projects: ["p-evals"],
      probes:
        "Eval sets, metrics, judge calibration, trajectory scoring and CI gates. " +
        "The round that filters most candidates, which is why it carries the " +
        "largest technical share here.",
    },
    {
      id: "production",
      label: "Production & security",
      short: "Production",
      weight: 0.15,
      phases: ["production"],
      projects: ["p-ship"],
      probes:
        "Tracing, prompt injection and the lethal trifecta, deployment, privacy. " +
        "Where a senior signal separates from a competent one.",
    },
    {
      id: "career",
      label: "Judgement & communication",
      short: "Judgement",
      weight: 0.05,
      phases: ["frontier"],
      projects: [],
      probes:
        "Fine-tune or prompt, build or buy, run local or hosted — and being able " +
        "to say why. Plus the behavioural round, which is 10% of the loop and " +
        "100% of the reason some strong candidates fail it.",
    },
  ];

  /* What each part of the work contributes. Evidence is weighted highest on
     purpose: this curriculum's central claim is that projects are where the
     learning happens, so a score you can reach by reading alone would contradict
     the thing it is measuring. */
  C.readinessParts = [
    { id: "reading", label: "Chapters read", weight: 0.3 },
    { id: "recall", label: "Quiz accuracy", weight: 0.25 },
    { id: "practice", label: "Labs used", weight: 0.15 },
    { id: "evidence", label: "Project milestones", weight: 0.3 },
  ];

  /* Calibrated against the real trajectory, not guessed: working through the
     roadmap properly — chapters, quizzes, labs and each phase's project — scores
     15% after foundations, 35% after building, 63% after agents, 80% after
     evals, 95% after production. The boundaries sit on those numbers, so a band
     changes when a phase closes rather than at an arbitrary tenth.

     The first band is named for its whole range and not just its floor. It read
     "Not started" originally, which a learner eleven chapters in was being told
     to their face at 14%. */
  C.readinessBands = [
    {
      at: 0,
      name: "Getting oriented",
      note:
        "The score moves on evidence, not reading: labs and project milestones " +
        "carry more weight per item than chapters do.",
    },
    {
      at: 15,
      name: "Learning the shape",
      note: "You can follow a conversation about this work. You cannot yet ship it.",
    },
    {
      at: 35,
      name: "Building",
      note: "Enough to be useful on a team that already has AI in production.",
    },
    {
      at: 55,
      name: "Interview-capable",
      note: "You would survive most loops. The gaps below are what a panel would find.",
      /* From here up, the score is a claim worth putting in a portfolio. Below it,
         the export omits the line entirely rather than advertising a low number —
         a portfolio is a document you choose the contents of, not a disclosure
         form, and "22% — Learning the shape" at the top of a case study undoes
         everything under it. Flagged on the band rather than hardcoded as 55 so
         the threshold moves with the calibration. */
      claim: true,
    },
    {
      at: 75,
      name: "Interview-ready",
      note: "You can answer the hard questions with numbers from your own work.",
      claim: true,
    },
    {
      at: 90,
      name: "Hire-ready",
      note: "Deployed work, measured, with the failures written up. Very few candidates reach this.",
      claim: true,
    },
  ];

  /* ---------------------------------------------------------
     Scoring
     --------------------------------------------------------- */

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function pct(n) {
    return Math.round(clamp01(n) * 100);
  }

  /* `signals` is deliberately plain data rather than the Store, so this is a pure
     function the unit tests can drive without a browser:
       { done: {id:true}, quiz: {id:{right,total}}, labs: {id:true},
         projectTasks: {projectId: {index:true}} }  */
  C.readinessFor = function (signals) {
    signals = signals || {};
    var done = signals.done || {};
    var quiz = signals.quiz || {};
    var labs = signals.labs || {};
    var tasks = signals.projectTasks || {};

    var partWeight = {};
    C.readinessParts.forEach(function (p) {
      partWeight[p.id] = p.weight;
    });

    var out = C.competencies.map(function (comp) {
      var chapters = C.chapters.filter(function (c) {
        return comp.phases.indexOf(c.phase) !== -1;
      });
      var labChapters = chapters.filter(function (c) {
        return !!c.lab;
      });
      var projects = (C.projects || []).filter(function (p) {
        return comp.projects.indexOf(p.id) !== -1;
      });

      /* reading */
      var readDone = chapters.filter(function (c) {
        return done[c.id];
      }).length;
      var reading = chapters.length ? readDone / chapters.length : 1;

      /* recall — accuracy over the whole competency, not over the quizzes you
         happened to take. Answering one quiz perfectly is not 100% recall of a
         seven-chapter subject, and scoring it that way is how a diagnostic
         starts flattering people. */
      var right = 0;
      var asked = 0;
      var possible = 0;
      chapters.forEach(function (c) {
        possible += (c.quiz || []).length;
        var q = quiz[c.id];
        if (q && q.total) {
          asked += q.total;
          right += q.right;
        }
      });
      var recall = possible ? right / possible : 1;

      /* practice */
      var labsUsed = labChapters.filter(function (c) {
        return labs[c.lab];
      }).length;
      var practice = labChapters.length ? labsUsed / labChapters.length : 1;

      /* evidence */
      var milestones = 0;
      var ticked = 0;
      projects.forEach(function (p) {
        milestones += (p.tasks || []).length;
        var t = tasks[p.id] || {};
        (p.tasks || []).forEach(function (_, i) {
          if (t[i]) ticked++;
        });
      });
      /* A competency with no project of its own cannot earn an evidence score, so
         its weight is redistributed across the parts it does have rather than
         capping it below 100. */
      var hasEvidence = milestones > 0;
      var evidence = hasEvidence ? ticked / milestones : 0;

      var parts = {
        reading: reading,
        recall: recall,
        practice: practice,
        evidence: evidence,
      };
      var total = 0;
      var wsum = 0;
      Object.keys(parts).forEach(function (k) {
        if (k === "evidence" && !hasEvidence) return;
        total += parts[k] * partWeight[k];
        wsum += partWeight[k];
      });
      var score = wsum ? total / wsum : 0;

      return {
        id: comp.id,
        label: comp.label,
        short: comp.short,
        weight: comp.weight,
        probes: comp.probes,
        score: pct(score),
        parts: {
          reading: pct(reading),
          recall: pct(recall),
          practice: pct(practice),
          evidence: hasEvidence ? pct(evidence) : null,
        },
        counts: {
          chapters: chapters.length,
          chaptersDone: readDone,
          quizQuestions: possible,
          quizAnswered: asked,
          quizRight: right,
          labs: labChapters.length,
          labsUsed: labsUsed,
          milestones: milestones,
          milestonesDone: ticked,
        },
      };
    });

    var overall = 0;
    out.forEach(function (c) {
      overall += (c.score / 100) * c.weight;
    });
    overall = pct(overall);

    var band = C.readinessBands[0];
    C.readinessBands.forEach(function (b) {
      if (overall >= b.at) band = b;
    });

    return {
      overall: overall,
      band: band,
      competencies: out,
      /* Weakest first, weighted by how much the loop cares — a 20-point gap in
         evaluation matters more than the same gap in judgement. */
      gaps: out
        .slice()
        .sort(function (a, b) {
          return (100 - b.score) * b.weight - (100 - a.score) * a.weight;
        })
        .filter(function (c) {
          return c.score < 100;
        }),
    };
  };

  /* How much of the material that comes *before* a phase is already behind you.
     1 for the first phase, 0 for the last one on a fresh account.

     This exists because lift-per-item alone gives bad advice. Production is a
     four-chapter phase carrying 15% of the loop, so one of its labs has the
     highest arithmetic value of anything in the curriculum — and the first
     version of this list duly told a learner at 0% to go and read about prompt
     injection. That is not the cheapest way to close a gap, it is the fastest way
     to waste an evening: the chapter assumes six phases of context. The roadmap
     is ordered for a reason, and a diagnostic that contradicts it is worse than
     no diagnostic. */
  function priorDone(phaseId, done) {
    var order = (C.phases || [])
      .slice()
      .sort(function (a, b) {
        return a.n - b.n;
      })
      .map(function (p) {
        return p.id;
      });
    var ix = order.indexOf(phaseId);
    if (ix <= 0) return 1;
    var earlier = order.slice(0, ix);
    var total = 0;
    var did = 0;
    C.chapters.forEach(function (ch) {
      if (earlier.indexOf(ch.phase) === -1) return;
      total++;
      if (done[ch.id]) did++;
    });
    return total ? did / total : 1;
  }

  /* Prerequisites are a gate, not a discount.

     Two attempts at this were a weight — multiply the lift by how ready you are
     — and both failed the same way. Production is a four-chapter phase carrying
     15% of the loop with exactly one lab, so that lab's lift-per-item is roughly
     three times anything else in the curriculum. A linear ramp let it top the
     list two phases in; squaring the ramp bought one more phase before it topped
     the list again. Any multiplier steep enough to hold back a 3× advantage is a
     tuning constant chosen to defeat one specific item, and would need choosing
     again the next time a phase gains a lab.

     So: rank in two tiers. Things you are ready for, then things you are not.
     Within a tier, highest lift first. A heavy small competency wins its tier and
     never jumps the gate, and the threshold means something you can say out loud
     — "the phase before this one is essentially done" — rather than being a
     number that happened to work. */
  var READY_AT = 0.9;

  /* Look-ahead items still need an order among themselves: nearest first, so
     "not yet" reads as a queue rather than a pile. */
  var LOOKAHEAD_FLOOR = 0.2;

  /* The actions that would move the score most per unit of effort, among the
     things you are actually ready to do. Only ever items not yet done, so this
     can never suggest busywork. */
  /* Curriculum position, for tie-breaking. Ties are the common case — every
     chapter in a phase has identical lift — and the first version broke them on
     id, which is alphabetical and therefore arbitrary. On a fresh account that
     listed foundations as "What Transfers", "How LLMs Work", "Choosing a Model",
     "What an AI Engineer Does": four chapters in an order the roadmap does not
     use and the prose does not assume. */
  var positionCache = null;

  function position(chapterId) {
    if (!positionCache) {
      positionCache = {};
      var order = (C.phases || [])
        .slice()
        .sort(function (a, b) {
          return a.n - b.n;
        })
        .map(function (p) {
          return p.id;
        });
      C.chapters
        .slice()
        .sort(function (a, b) {
          var d = order.indexOf(a.phase) - order.indexOf(b.phase);
          if (d) return d;
          return C.chapters.indexOf(a) - C.chapters.indexOf(b);
        })
        .forEach(function (c, i) {
          positionCache[c.id] = i;
        });
    }
    return positionCache[chapterId] === undefined
      ? 9999
      : positionCache[chapterId];
  }

  C.readinessActions = function (signals, limit) {
    signals = signals || {};
    var done = signals.done || {};
    var labs = signals.labs || {};
    var tasks = signals.projectTasks || {};
    var report = C.readinessFor(signals);
    var byId = {};
    report.competencies.forEach(function (c) {
      byId[c.id] = c;
    });

    var priorCache = {};
    function prior(phaseId) {
      if (priorCache[phaseId] === undefined) {
        priorCache[phaseId] = priorDone(phaseId, done);
      }
      return priorCache[phaseId];
    }
    function isReady(phaseId) {
      return prior(phaseId) >= READY_AT;
    }
    /* Orders the look-ahead tier only — a ready item's value is its raw lift. */
    function nearness(phaseId) {
      var p = prior(phaseId);
      return p >= READY_AT ? 1 : LOOKAHEAD_FLOOR + (1 - LOOKAHEAD_FLOOR) * p;
    }

    var actions = [];
    C.competencies.forEach(function (comp) {
      var c = byId[comp.id];
      if (!c || c.score >= 100) return;
      /* How much overall readiness one more item in this competency is worth.
         Scaled by the competency's weight, so the ranking follows the loop. */
      var lift = comp.weight * 100;

      C.chapters.forEach(function (ch) {
        if (comp.phases.indexOf(ch.phase) === -1) return;
        if (done[ch.id]) return;
        actions.push({
          kind: "chapter",
          id: ch.id,
          label: ch.title,
          competency: comp.short,
          phase: ch.phase,
          href: "#/chapter/" + ch.id,
          minutes: ch.minutes,
          ready: isReady(ch.phase),
          at: position(ch.id),
          value:
            ((lift * 0.3) / Math.max(1, c.counts.chapters)) *
            nearness(ch.phase),
        });
      });

      (C.projects || [])
        .filter(function (p) {
          return comp.projects.indexOf(p.id) !== -1;
        })
        .forEach(function (p) {
          var t = tasks[p.id] || {};
          (p.tasks || []).forEach(function (task, i) {
            if (t[i]) return;
            actions.push({
              kind: "milestone",
              id: p.id + "#" + i,
              label: typeof task === "string" ? task : task.t,
              competency: comp.short,
              project: p.title,
              phase: p.phase,
              href: "#/projects",
              ready: isReady(p.phase),
              at: position(task && task.ch ? task.ch : ""),
              value:
                ((lift * 0.3) / Math.max(1, c.counts.milestones)) *
                nearness(p.phase),
            });
          });
        });

      C.chapters.forEach(function (ch) {
        if (comp.phases.indexOf(ch.phase) === -1) return;
        if (!ch.lab || labs[ch.lab]) return;
        actions.push({
          kind: "lab",
          id: ch.lab,
          label: ch.title,
          competency: comp.short,
          phase: ch.phase,
          href: "#/chapter/" + ch.id,
          ready: isReady(ch.phase),
          at: position(ch.id),
          value:
            ((lift * 0.15) / Math.max(1, c.counts.labs)) * nearness(ch.phase),
        });
      });
    });

    return actions
      .sort(function (a, b) {
        /* The gate first, then lift, then curriculum order. Ties are the common
           case, so the third key is doing real work: it is what makes the list
           read in the order the roadmap teaches rather than alphabetically. */
        if (a.ready !== b.ready) return a.ready ? -1 : 1;
        return b.value - a.value || a.at - b.at || a.id.localeCompare(b.id);
      })
      .slice(0, limit || 6);
  };
})(window);
