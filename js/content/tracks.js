/* ============================================================
   Personalisation: skills, tracks, and per-chapter overlap.

   The point of this file is the `delta` note on each overlap entry. Telling an
   experienced engineer "you can skim this" is mildly useful; telling them
   exactly which three things in the chapter are new to them is the whole
   value. Everything else here is scheduling arithmetic.
   ============================================================ */
(function (global) {
  "use strict";
  var C = (global.Curriculum = global.Curriculum || {});

  /* ---------------------------------------------------------
     SKILLS a learner can claim
     --------------------------------------------------------- */

  C.skills = [
    {
      id: "apis",
      label: "HTTP APIs & SDK integration",
      hint: "REST, JSON, status codes, client libraries",
    },
    {
      id: "python",
      label: "Python",
      hint: "Comfortable writing and reading it",
    },
    {
      id: "reliability",
      label: "Retries, timeouts & idempotency",
      hint: "Backoff, jitter, circuit breakers",
    },
    {
      id: "caching",
      label: "Caching strategy",
      hint: "Redis, invalidation, cache keys",
    },
    {
      id: "databases",
      label: "Relational databases",
      hint: "Postgres, indexes, query plans",
    },
    {
      id: "observability",
      label: "Tracing & metrics",
      hint: "OpenTelemetry, percentiles, dashboards",
    },
    {
      id: "deployment",
      label: "Deployment & CI/CD",
      hint: "Containers, canaries, rollback",
    },
    {
      id: "testing",
      label: "Automated testing",
      hint: "Unit, integration, CI gates",
    },
    {
      id: "streaming",
      label: "Streaming responses",
      hint: "SSE, WebSockets, backpressure",
    },
    {
      id: "security",
      label: "AppSec fundamentals",
      hint: "Authz, injection classes, least privilege",
    },
    {
      id: "privacy",
      label: "Data privacy & compliance",
      hint: "GDPR, retention, deletion paths",
    },
    {
      id: "search",
      label: "Search & information retrieval",
      hint: "Inverted indexes, BM25, ranking",
    },
    {
      id: "ml",
      label: "Machine learning background",
      hint: "Training, evaluation, gradients",
    },
    {
      id: "frontend",
      label: "Frontend engineering",
      hint: "React/Vue, UI state, latency perception",
    },
  ];

  /* ---------------------------------------------------------
     TRACKS — presets that pre-select skills
     --------------------------------------------------------- */

  C.tracks = [
    {
      id: "backend",
      label: "Backend engineer",
      blurb:
        "You already own services in production. Roughly a third of this roadmap is your day job with a different dependency — you'll skim those and go deep on retrieval, agents, and evaluation.",
      icon: "terminal",
      assumes: [
        "apis",
        "reliability",
        "caching",
        "databases",
        "observability",
        "deployment",
        "testing",
        "streaming",
      ],
      note: "The research on this transition is consistent: your API, testing, CI/CD and monitoring foundation transfers directly. What you're actually adding is context engineering, retrieval, agent control flow, and evaluation — and evaluation is the one that decides interviews.",
    },
    {
      id: "fullstack",
      label: "Full-stack engineer",
      blurb:
        "You'll move fast through the application-building phase and spend your time on retrieval quality, evaluation, and the security model.",
      icon: "layers",
      assumes: [
        "apis",
        "reliability",
        "databases",
        "deployment",
        "testing",
        "streaming",
        "frontend",
      ],
      note: "Your advantage is shipping end-to-end. Your gap is usually depth on retrieval and a habit of measuring instead of eyeballing.",
    },
    {
      id: "frontend",
      label: "Frontend engineer",
      blurb:
        "You have the strongest instincts for streaming UX and perceived latency. Budget extra time for the backend-shaped chapters.",
      icon: "eye",
      assumes: ["apis", "frontend", "streaming", "testing"],
      note: "Perceived-latency work will feel obvious to you. Retrieval infrastructure, cost modelling, and production concerns will take longer than the reading times suggest — that's expected.",
    },
    {
      id: "data",
      label: "Data / ML engineer",
      blurb:
        "You know evaluation and vectors already. Your gap is usually production application engineering: latency, cost, reliability, and security.",
      icon: "graph",
      assumes: ["python", "databases", "ml", "search", "testing"],
      note: "You'll find the statistics in the evaluation phase familiar and the agent/production phases less so. Resist skipping the cost and injection chapters — they're where ML people most often get caught out.",
    },
    {
      id: "new",
      label: "Early career / switching in",
      blurb:
        "Follow the roadmap in order, nothing skipped. It's sequenced so each phase only needs what came before.",
      icon: "compass",
      assumes: [],
      note: "Do the projects. Reading eight phases without building produces the illusion of competence, and interviews are very good at finding it.",
    },
  ];

  /* ---------------------------------------------------------
     CORE — never downgraded, whatever you already know
     --------------------------------------------------------- */

  C.core = [
    "tokens",
    "context-engineering",
    "structured-output",
    "chunking",
    "hybrid-rerank",
    "rag-debug",
    "tool-use",
    "agent-loop",
    "agent-guardrails",
    "why-evals",
    "eval-datasets",
    "eval-metrics",
    "llm-judge",
    "agent-evals",
    "evals-ci",
    "prompt-injection",
  ];

  /* ---------------------------------------------------------
     OVERLAP — what an experienced engineer already knows,
     and precisely what is new in each chapter.
     --------------------------------------------------------- */

  C.overlap = {
    "api-surface": {
      skills: ["apis"],
      degree: "high",
      delta:
        "Integrating a typed HTTP API is your day job. Three things are genuinely different: the API is **stateless**, so input tokens grow with the square of turn count and cost follows; `stop_reason` has a value (`length`) that means *silently truncated* and must be treated as an error rather than a result; and `400 context_length_exceeded` is terminal for the payload but recoverable for the request, which no HTTP client library models for you.",
    },
    streaming: {
      skills: ["streaming"],
      degree: "partial",
      delta:
        "You've built SSE before and you know about proxy buffering. What's new is the *metric* that matters — time-to-first-token, not total time — and that you keep being billed after a client disconnects, so a missing disconnect check is a cost bug rather than just a resource leak. Also worth reading: the pipeline breakdown, because in RAG the model is often not the slow part.",
    },
    resilience: {
      skills: ["reliability", "caching"],
      degree: "high",
      delta:
        "Exponential backoff with full jitter, circuit breakers, and idempotency keys with an atomic claim will all be familiar. Read this chapter for **prompt caching**: it needs a byte-identical prefix, which makes prompt *layout* a cost decision worth 40–70% of your input bill, and a single interpolated timestamp destroys it. Also read the semantic-caching warning — it's a correctness trap that has no analogue in ordinary caching.",
    },
    "conversation-state": {
      skills: ["apis", "databases"],
      degree: "partial",
      delta:
        "Server-side session state is not new. Two things are: accepting conversation history from the client is an **authorisation vulnerability**, because the model treats prior assistant turns as its own commitments and a user who can forge them can manufacture consent; and history must be actively compacted, which is a new class of background job with its own failure mode (never compact a compaction).",
    },
    "cost-latency": {
      skills: ["observability", "deployment"],
      degree: "partial",
      delta:
        "You already think in p95s and budgets. The new material is token economics: output tokens cost 3–5× input, cost per active user is the number that decides whether a feature ships, and the top 5% of users routinely consume 40% of inference spend. The lever ordering (caching → routing → output bounds → better ranking) is the practical takeaway.",
    },
    observability: {
      skills: ["observability"],
      degree: "high",
      delta:
        "You know OpenTelemetry, spans, and tail-based sampling. The LLM-specific parts: log the **fully rendered prompt** (roughly half of 'the model ignored my instruction' is a template bug where the instruction wasn't there); capture retrieved chunk IDs *with scores*, which is the single field that most often explains a wrong answer; and recognise that traces containing prompts make your observability platform a user-data store with retention and deletion obligations.",
    },
    deployment: {
      skills: ["deployment", "testing"],
      degree: "high",
      delta:
        "Canaries, circuit breakers, and load shedding are familiar. The twist that catches experienced engineers: **a prompt regression returns HTTP 200**. Latency, error rate, and throughput all look healthy while answers get worse, so your canary has to gate on eval scores and thumbs-down rate or it detects nothing. Also: a cross-provider fallback you haven't evaluated is not a fallback.",
    },
    "vector-db": {
      skills: ["databases"],
      degree: "partial",
      delta:
        "You'll be at home with index tuning and query plans. New: HNSW's `ef_search` is a per-query recall/latency knob; a *highly selective* metadata filter can make an ANN index slower than a brute-force scan, which is the opposite of the relational intuition; and changing embedding model invalidates every vector, so it's a migration with a dual-write window, not a config change.",
    },
    "safety-privacy": {
      skills: ["privacy", "security"],
      degree: "partial",
      delta:
        "You've built deletion paths and thought about retention. Two things are easy to miss: **embeddings are not anonymised** — inversion research recovers substantial source text, so your vector store carries the same obligations as the documents — and your judge/eval models are a data destination people routinely forget to enumerate.",
    },
    "local-models": {
      skills: ["deployment"],
      degree: "partial",
      delta:
        "Capacity planning and container ops transfer. New: quantisation trade-offs (more parameters at 4-bit beats fewer at 16-bit within a memory budget) and continuous batching, which is a 5–20× throughput difference and the only reason to run vLLM rather than a naive loop.",
    },
    embeddings: {
      skills: ["search"],
      degree: "partial",
      delta:
        "If you've worked with search you'll recognise the ranking problem. The specifics worth your attention: embeddings do not encode negation ('is' and 'is not' sit above 0.9 similarity), numeric comparison, recency, or rare identifiers — which is precisely why hybrid search exists.",
    },
    "hybrid-rerank": {
      skills: ["search"],
      degree: "partial",
      delta:
        "BM25 and rank fusion may be familiar territory. Read it anyway for two things: Reciprocal Rank Fusion needs no score normalisation, and an *absolute* reranker score floor is what gives your system the ability to return nothing — which is what makes honest abstention possible at all.",
    },
    "why-evals": {
      skills: ["testing"],
      degree: "partial",
      delta:
        "You know why regression suites matter, so the argument will land fast. What's new is the shape of the assertions: you cannot assert on exact output, so you assert on structure, semantics, and properties instead — and you need statistics, because a 4-point move on 50 cases is noise.",
    },
    "eval-datasets": {
      skills: ["testing"],
      degree: "partial",
      delta:
        "Test-case design is a transferable skill. The genuinely new part is that your test data comes from production traffic rather than your imagination, that hand-written cases are systematically *easier* than real ones, and that you must report confidence intervals or you'll chase phantom regressions.",
    },
    "evals-ci": {
      skills: ["testing", "deployment"],
      degree: "partial",
      delta:
        "CI gating is your world already. The adaptation: gate hard on deterministic invariants and *softly* on judged metrics using the interval's lower bound, or the suite flakes, gets bypassed, and takes its own credibility with it.",
    },
    "prompt-injection": {
      skills: ["security"],
      degree: "partial",
      delta:
        "You know injection classes and least privilege, which is most of the way there. The uncomfortable part: unlike SQL injection there is **no parameterisation** — instructions and data share one channel with no trust boundary. So the fix is architectural (remove a leg of the lethal trifecta), and the analogue you already trust — input sanitisation — is the weakest mitigation on the list.",
    },
    role: {
      skills: ["apis", "deployment"],
      degree: "partial",
      delta:
        "Skim the prerequisites section; you have them. Read the five hireable capabilities and the note on why evals are the moat — that framing is what the rest of the roadmap is organised around.",
    },
  };

  /* ---------------------------------------------------------
     PLAN GENERATION
     --------------------------------------------------------- */

  /* Reading time is only part of the work. A chapter you study properly means
     doing its lab, taking the quiz, and trying the ideas — empirically a
     multiple of the reading time, not a fraction of it. A skimmed chapter is
     genuinely quick. These multipliers turn "reading minutes" into "learning
     minutes", which is what a schedule has to be built from. */
  var MODE_WEIGHT = { deep: 2.6, study: 2.0, skim: 0.45 };

  /* "10–15 hours" -> 12.5. Falls back to a single number, then to 8. */
  function parseHours(s) {
    var nums = String(s || "").match(/\d+/g);
    if (!nums) return 8;
    if (nums.length >= 2) return (+nums[0] + +nums[1]) / 2;
    return +nums[0];
  }

  C.planFor = function (profile) {
    var claimed = {};
    (profile.skills || []).forEach(function (s) {
      claimed[s] = true;
    });
    var coreSet = {};
    C.core.forEach(function (id) {
      coreSet[id] = true;
    });

    var items = C.chapters.map(function (ch) {
      var ov = C.overlap[ch.id];
      var mode = "study";
      var why = null;

      if (coreSet[ch.id]) {
        mode = "deep";
        why =
          "Core chapter — this is load-bearing for everything after it, and it's what interviews probe.";
      }

      if (ov) {
        var known = (ov.skills || []).filter(function (s) {
          return claimed[s];
        }).length;
        var all = (ov.skills || []).length;
        if (known && all) {
          var full = known === all;
          if (coreSet[ch.id]) {
            // Stays deep, but the delta note explains what to focus on.
            why = ov.delta;
          } else if (ov.degree === "high" && full) {
            mode = "skim";
            why = ov.delta;
          } else if (
            ov.degree === "high" ||
            (ov.degree === "partial" && full)
          ) {
            mode = "skim";
            why = ov.delta;
          } else {
            why = ov.delta;
          }
        }
      }

      if (!why && !coreSet[ch.id]) {
        why = "New material for you — read it properly.";
      }

      return {
        id: ch.id,
        phase: ch.phase,
        title: ch.title,
        minutes: ch.minutes,
        mode: mode,
        why: why,
        effort: Math.round(ch.minutes * MODE_WEIGHT[mode]),
      };
    });

    /* --- build an ordered work queue: each phase's chapters, then its
           project. Projects are where most of the hours are, and leaving them
           out produces a schedule that is wrong by an order of magnitude. --- */
    var queue = [];
    C.phases.forEach(function (ph) {
      items
        .filter(function (it) {
          return it.phase === ph.id;
        })
        .forEach(function (it) {
          queue.push({ kind: "chapter", minutes: it.effort, item: it });
        });
      C.projects
        .filter(function (pr) {
          return pr.phase === ph.id;
        })
        .forEach(function (pr) {
          queue.push({
            kind: "project",
            minutes: parseHours(pr.hours) * 60,
            project: pr,
          });
        });
    });

    /* --- fill weeks. A project larger than one week's budget is split across
           consecutive weeks rather than distorting a single one. --- */
    /* A profile written by an older version of the app — or one restored from a
       hand-edited export — can carry a missing or non-numeric hoursPerWeek.
       Resolve it once, here, and return it on the plan, so the number the views
       print is always the number the schedule was built from. Printing
       profile.hoursPerWeek directly rendered "undefined h/week". */
    var hoursPerWeek = parseFloat(profile.hoursPerWeek);
    if (!isFinite(hoursPerWeek) || hoursPerWeek <= 0) hoursPerWeek = 5;
    var perWeek = hoursPerWeek * 60;
    var weeks = [];
    var cur = { n: 1, minutes: 0, items: [], projects: [] };

    function pushWeek() {
      weeks.push(cur);
      cur = { n: weeks.length + 1, minutes: 0, items: [], projects: [] };
    }

    queue.forEach(function (entry) {
      if (entry.kind === "chapter") {
        if (cur.minutes + entry.minutes > perWeek && cur.items.length)
          pushWeek();
        cur.items.push(entry.item);
        cur.minutes += entry.minutes;
        return;
      }

      // Project: consume the remaining capacity of the current week, then
      // spill into later ones. The number of parts is not known up front
      // (the first slot only gets whatever room is left), so the slots are
      // collected and labelled once the total is known.
      var remaining = entry.minutes;
      var slots = [];
      while (remaining > 0) {
        var room = perWeek - cur.minutes;
        if (room <= 15 && (cur.items.length || cur.projects.length)) {
          pushWeek();
          room = perWeek;
        }
        var take = Math.min(room, remaining);
        var slot = { project: entry.project, minutes: take, part: 0, parts: 0 };
        slots.push(slot);
        cur.projects.push(slot);
        cur.minutes += take;
        remaining -= take;
        if (remaining > 0) pushWeek();
      }
      slots.forEach(function (s, i) {
        s.part = i + 1;
        s.parts = slots.length;
      });
    });
    if (cur.items.length || cur.projects.length) pushWeek();

    var readingMinutes = items.reduce(function (a, it) {
      return a + it.effort;
    }, 0);
    var projectMinutes = C.projects.reduce(function (a, pr) {
      return a + parseHours(pr.hours) * 60;
    }, 0);
    var totalMinutes = readingMinutes + projectMinutes;

    var counts = { deep: 0, study: 0, skim: 0 };
    items.forEach(function (it) {
      counts[it.mode]++;
    });

    return {
      items: items,
      byId: items.reduce(function (m, it) {
        m[it.id] = it;
        return m;
      }, {}),
      weeks: weeks,
      counts: counts,
      hoursPerWeek: hoursPerWeek,
      readingMinutes: readingMinutes,
      projectMinutes: projectMinutes,
      totalMinutes: totalMinutes,
      totalWeeks: weeks.length,
      // Kept for compatibility with earlier callers.
      readingWeeks: weeks.length,
      profile: profile,
    };
  };

  /* Chapters where the learner's claimed skills mean the reading time is
     misleading — used to explain the plan back to them. */
  C.deltaCount = function (profile) {
    var claimed = {};
    (profile.skills || []).forEach(function (s) {
      claimed[s] = true;
    });
    return Object.keys(C.overlap).filter(function (id) {
      return (C.overlap[id].skills || []).some(function (s) {
        return claimed[s];
      });
    }).length;
  };
})(window);
