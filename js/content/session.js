/* ============================================================
   Session planner — "I have 25 minutes." Now what?

   This is the friction that actually stops people. Not motivation, and not the
   content: the decision cost of sitting down with a fixed, awkward amount of time
   and a 44-chapter roadmap, and having to work out what fits. The honest failure
   mode of a self-directed course is not giving up, it is opening the dashboard,
   seeing eight things you could do, and closing the tab.

   So: name your minutes, get an ordered plan that fits them. Everything here is
   derived from what the app already knows — due cards, an unfinished chapter, the
   readiness ranking, chapter durations — and the output is a list you work down,
   not a menu you choose from.
   ============================================================ */
(function (global) {
  "use strict";

  var C = global.Curriculum;

  /* The lengths people actually have. Deliberately including 10: the whole point
     is that a short session is a real session, and a planner whose smallest
     option is half an hour tells most of its users to come back later. */
  C.sessionLengths = [10, 25, 45, 90];

  /* Minutes per unit of work.

     `chapter.minutes` is authored and already covers reading, its embedded lab and
     its quiz — scripts/validate-content.mjs models it that way and warns when the
     two drift — so a chapter costs exactly that and nothing here may add to it or
     the session budget silently double-counts. The rest are separate items only
     reachable once a chapter is complete. */
  var COST = {
    /* A card is a few seconds to read plus a few to grade. Twenty-four seconds is
       the pessimistic end, which is the right end for a time budget. */
    card: 0.4,
    /* A quiz question with its explanation read afterwards, which is where the
       learning is. */
    quizQuestion: 0.9,
    /* Opening a lab and actually moving its controls, rather than glancing at it. */
    lab: 6,
  };

  /* Cards are cheap, time-decaying and endless, which is a bad combination for a
     budget: a fresh deck of 40 due cards would eat a 25-minute session entirely
     and the learner would finish having read nothing. Cap the review block at a
     share of the session. */
  var CARD_SHARE = 0.3;

  /* Below this a project milestone is not a session, it is an interruption —
     milestones are hours of work, and suggesting one for a coffee break invites
     the learner to tick it without doing it, which corrupts the one signal the
     readiness score weights highest. */
  var PROJECT_MIN_SESSION = 45;

  function clampInt(n, lo, hi) {
    n = Math.floor(Number(n) || 0);
    return n < lo ? lo : n > hi ? hi : n;
  }

  function chapterById(id) {
    var out = null;
    C.chapters.forEach(function (c) {
      if (c.id === id) out = c;
    });
    return out;
  }

  /* Curriculum order, so "the next chapter" means the same thing here as it does
     on the roadmap. */
  function orderedChapters() {
    var order = (C.phases || [])
      .slice()
      .sort(function (a, b) {
        return a.n - b.n;
      })
      .map(function (p) {
        return p.id;
      });
    return C.chapters.slice().sort(function (a, b) {
      var d = order.indexOf(a.phase) - order.indexOf(b.phase);
      if (d) return d;
      return C.chapters.indexOf(a) - C.chapters.indexOf(b);
    });
  }

  function shortestOpen(done) {
    var min = null;
    C.chapters.forEach(function (ch) {
      if (done[ch.id]) return;
      if (min === null || ch.minutes < min) min = ch.minutes;
    });
    return min;
  }

  /**
   * Build a plan for a session of `minutes`.
   *
   * `state` is plain data so this stays a pure function the unit tests can drive:
   *   { done:{id:true}, quiz:{id:{right,total}}, labs:{id:true},
   *     projectTasks:{pid:{i:true}}, dueCards: <number>, recent: [chapterId] }
   *
   * Returns { minutes, items, used, spare, note, partial }.
   */
  C.sessionFor = function (minutes, state) {
    state = state || {};
    var budget = clampInt(minutes, 5, 240);
    var done = state.done || {};
    var quiz = state.quiz || {};
    var labs = state.labs || {};
    var due = Math.max(0, Math.floor(Number(state.dueCards) || 0));
    var recent = Array.isArray(state.recent) ? state.recent : [];

    var items = [];
    var used = 0;
    var partial = null;

    function fits(cost) {
      return used + cost <= budget;
    }
    function push(item) {
      items.push(item);
      used += item.minutes;
    }

    /* ---------------------------------------------------------
       1. Due cards, capped.

       First because they decay: a card reviewed on its due day is the whole
       mechanism, and one reviewed a week late is a card you have to relearn.
       Cheap enough that it never crowds out the real work once capped.
       --------------------------------------------------------- */
    if (due > 0) {
      var room = Math.floor((budget * CARD_SHARE) / COST.card);
      var n = Math.min(due, Math.max(1, room));
      var cost = Math.max(1, Math.round(n * COST.card));
      if (fits(cost)) {
        push({
          kind: "cards",
          id: "review",
          label:
            n === due
              ? "Review all " + n + " due cards"
              : "Review " + n + " due cards",
          minutes: cost,
          href: "#/review",
          why:
            n === due
              ? "Clears the deck. Reviewing on the due day is the entire point of the schedule."
              : "The oldest " +
                n +
                " of " +
                due +
                " due. Cards decay, so these come first.",
          count: n,
        });
      }
    }

    /* ---------------------------------------------------------
       2. Finish what is already open.

       A chapter you started and left is worth more than a new one: you already
       paid the cost of loading the context, and the app remembers your scroll
       position, so resuming is genuinely cheaper than the number suggests.
       --------------------------------------------------------- */
    var resumeCh = null;
    for (var i = 0; i < recent.length && !resumeCh; i++) {
      var rc = chapterById(recent[i]);
      if (rc && !done[rc.id]) resumeCh = rc;
    }
    if (resumeCh) {
      var rCost = Math.min(resumeCh.minutes, budget - used);
      if (rCost >= 5) {
        push({
          kind: "resume",
          id: resumeCh.id,
          label: resumeCh.title,
          minutes: rCost,
          href: "#/chapter/" + resumeCh.id,
          phase: resumeCh.phase,
          /* The note below the list already says your place is remembered, so
             saying it here too put the same clause twice in adjacent sentences. */
          why:
            rCost < resumeCh.minutes
              ? "You are partway through this — " +
                resumeCh.minutes +
                " min in total."
              : "You started this and did not finish it. Close it before opening anything new.",
          full: resumeCh.minutes,
        });
        if (rCost < resumeCh.minutes) partial = resumeCh.title;
      }
    }

    /* ---------------------------------------------------------
       3. The highest-value thing you are ready for.

       Straight from the readiness ranking, so this agrees with the diagnostic and
       with the roadmap rather than being a third opinion.
       --------------------------------------------------------- */
    var taken = {};
    var labCount = 0;
    items.forEach(function (it) {
      taken[it.kind + ":" + it.id] = true;
    });

    var ranked = C.readinessActions
      ? C.readinessActions(
          {
            done: done,
            quiz: quiz,
            labs: labs,
            projectTasks: state.projectTasks || {},
          },
          40
        )
      : [];

    ranked.forEach(function (a) {
      if (used >= budget) return;
      if (a.kind === "milestone") return; // handled below, needs a longer session
      if (taken["resume:" + a.id] || taken["chapter:" + a.id]) return;

      if (a.kind === "chapter") {
        var ch = chapterById(a.id);
        if (!ch) return;
        var left = budget - used;
        /* A chapter that does not fit is still the right thing to start, because
           chapters are resumable and the alternative is filling the session with
           busywork. Judge it as a fraction rather than an absolute: five minutes
           of a 22-minute chapter is a bookmark, but ten of an eighteen is more
           than half and a perfectly good short session. The floor lifts when
           there is already something in the plan — the last four minutes of a
           session are not the moment to open a new chapter. */
        /* A chapter either fits, or it is the only thing this session can be.
           Filling the tail with a third of a chapter looked like efficient
           packing and is not: you lose the thread, and the plan then ended with a
           partial chapter almost every time, which made the warning about it
           noise. When nothing fits, seven minutes spare and "stop early" is the
           better answer — and it is already what the note says. */
        var cost = Math.min(ch.minutes, left);
        if (cost < ch.minutes && items.length) return;
        /* As the sole item, a partial start is fine — chapters are resumable —
           but not for a sliver of one. */
        if (cost < ch.minutes && cost < ch.minutes * 0.35) return;
        push({
          kind: "chapter",
          id: ch.id,
          label: ch.title,
          minutes: cost,
          href: "#/chapter/" + ch.id,
          phase: ch.phase,
          competency: a.competency,
          why:
            cost < ch.minutes
              ? ch.minutes +
                " min in total — you will get about " +
                Math.round((cost / ch.minutes) * 100) +
                "% through."
              : ch.subtitle,
          full: ch.minutes,
        });
        if (cost < ch.minutes) partial = ch.title;
        taken["chapter:" + ch.id] = true;
        return;
      }

      if (a.kind === "lab") {
        var lch = chapterById(a.href.replace("#/chapter/", ""));
        if (!lch) return;
        /* A lab is only a session of its own once its chapter is read.
           readinessActions scores them separately — correctly, they earn a
           different part of the score — but here that produced two bad plans: a
           ten-minute session that opened a Phase 3 lab cold, landing the learner
           mid-chapter on a widget with no context to interpret it; and a
           ninety-minute plan that listed a lab whose chapter was already in the
           same plan, double-counting it, because `chapter.minutes` covers the
           embedded lab already. */
        if (!done[lch.id]) return;
        if (taken["chapter:" + lch.id] || taken["resume:" + lch.id]) return;
        if (!fits(COST.lab)) return;
        /* Two is variety; three in one sitting is a pattern. The marginal value of
           a third widget in ninety minutes is lower than a chapter's. */
        if (labCount >= 2) return;
        labCount++;
        push({
          kind: "lab",
          id: a.id,
          label: a.label,
          minutes: COST.lab,
          href: a.href,
          phase: lch.phase,
          competency: a.competency,
          /* Short on purpose: two labs can land next to each other and a
             two-sentence justification repeated verbatim reads as filler. The
             card's lede makes the general case once. */
          why: "Read, but you never opened its lab.",
        });
        taken["lab:" + a.id] = true;
      }
    });

    /* ---------------------------------------------------------
       4. Retrieval practice on material you have already read.

       An untaken quiz on a completed chapter is the highest-value short item in
       the app: the testing effect is one of the most replicated results in
       learning research, and this is a chapter you have met.
       --------------------------------------------------------- */
    orderedChapters().forEach(function (ch) {
      if (used >= budget) return;
      if (!done[ch.id]) return;
      var q = quiz[ch.id];
      if (q && q.total && q.right === q.total) return; // already perfect
      var n = (ch.quiz || []).length;
      if (!n) return;
      var cost = Math.max(1, Math.round(n * COST.quizQuestion));
      if (!fits(cost)) return;
      push({
        kind: "quiz",
        id: ch.id,
        label: ch.title,
        minutes: cost,
        href: "#/chapter/" + ch.id,
        phase: ch.phase,
        why: q
          ? "You scored " +
            q.right +
            "/" +
            q.total +
            " here. Retaking it is worth more than rereading it."
          : "Read but never tested. Recall practice beats rereading, and it is " +
            n +
            " questions.",
      });
    });

    /* ---------------------------------------------------------
       5. A project milestone, but only in a session long enough to mean it.
       --------------------------------------------------------- */
    if (budget >= PROJECT_MIN_SESSION) {
      var left = budget - used;
      if (left >= 20) {
        var ms = null;
        ranked.forEach(function (a) {
          if (!ms && a.kind === "milestone") ms = a;
        });
        if (ms) {
          push({
            kind: "project",
            id: ms.id,
            label: ms.label,
            minutes: left,
            href: "#/projects",
            competency: ms.competency,
            project: ms.project,
            why:
              "Milestones are hours, not minutes — this is the rest of the session, " +
              "and it is the part of the work the readiness score weights highest.",
          });
        }
      }
    }

    /* ---------------------------------------------------------
       6. Spend the tail on cards rather than reporting dead time.
       --------------------------------------------------------- */
    var spare = budget - used;
    var cardItem = null;
    items.forEach(function (it) {
      if (it.kind === "cards") cardItem = it;
    });
    if (spare >= 2 && cardItem && due > cardItem.count) {
      var extra = Math.min(due - cardItem.count, Math.floor(spare / COST.card));
      if (extra > 0) {
        var addCost = Math.max(1, Math.round(extra * COST.card));
        cardItem.count += extra;
        cardItem.minutes += addCost;
        cardItem.label =
          cardItem.count >= due
            ? "Review all " + cardItem.count + " due cards"
            : "Review " + cardItem.count + " due cards";
        used += addCost;
        spare = budget - used;
      }
    }

    /* ---------------------------------------------------------
       7. The stretch item.

       Chapters run 13 to 23 minutes, so a 25-minute budget fits exactly one and
       leaves an awkward remainder. Packing that remainder with a third of the next
       chapter was wrong — you lose the thread — but so was reporting eleven idle
       minutes and telling the learner to stop. This is the third answer: the plan
       is what fits, and the stretch is one named thing to start *if* they have
       more in them. Not counted in `used`, because it is not a commitment.
       --------------------------------------------------------- */
    var stretch = null;
    if (spare >= 4) {
      for (var si = 0; si < ranked.length && !stretch; si++) {
        var sa = ranked[si];
        if (sa.kind !== "chapter") continue;
        if (taken["chapter:" + sa.id] || taken["resume:" + sa.id]) continue;
        var sch = chapterById(sa.id);
        if (!sch) continue;
        stretch = {
          kind: "chapter",
          id: sch.id,
          label: sch.title,
          minutes: sch.minutes,
          href: "#/chapter/" + sch.id,
          phase: sch.phase,
          why:
            "You would get about " +
            Math.round((spare / sch.minutes) * 100) +
            "% through in the time left. Your place is remembered, so there is " +
            "nothing to lose by starting.",
        };
      }
    }

    var note;
    if (!items.length) {
      /* "Nothing outstanding" and "nothing fits" are different answers and the
         first version gave the wrong one to a brand-new account with ten minutes:
         it congratulated a learner who had done nothing on being ahead of
         schedule. */
      var chaptersLeft = false;
      C.chapters.forEach(function (ch) {
        if (!done[ch.id]) chaptersLeft = true;
      });
      var milestonesLeft = 0;
      (C.projects || []).forEach(function (p) {
        var t = (state.projectTasks || {})[p.id] || {};
        (p.tasks || []).forEach(function (_, i) {
          if (!t[i]) milestonesLeft++;
        });
      });
      if (chaptersLeft) {
        note =
          "Nothing fits cleanly in " +
          budget +
          " min. The shortest chapter left is " +
          shortestOpen(done) +
          " min — start it anyway if you like, your place is remembered.";
      } else if (milestonesLeft) {
        /* "Ahead of your own schedule" was the first version's answer here, said
           to someone with every chapter read and 43 milestones untouched. They are
           not ahead; they have done the half of the work that is easier to
           measure. */
        note =
          "Every chapter is read. What is left is " +
          milestonesLeft +
          " project milestones, and those need a longer sitting than " +
          budget +
          " min — come back with " +
          PROJECT_MIN_SESSION +
          "+.";
      } else {
        note =
          "Nothing outstanding. Every chapter read, every milestone ticked — " +
          "the next thing to learn is whatever your own deployed project starts " +
          "doing wrong.";
      }
    } else if (partial) {
      note =
        "You will not finish " +
        partial +
        " in this sitting, and that is fine — your place is remembered.";
    } else if (stretch) {
      note =
        "That is " +
        used +
        " of your " +
        budget +
        " min. The rest is not enough for another chapter, so it is offered rather " +
        "than scheduled.";
    } else if (spare >= 5) {
      note =
        "About " +
        spare +
        " min spare — nothing left that fits it. Stopping early beats starting " +
        "something you will abandon.";
    } else {
      note = "That fills the session.";
    }

    return {
      minutes: budget,
      items: items,
      used: used,
      spare: spare < 0 ? 0 : spare,
      partial: partial,
      stretch: stretch,
      note: note,
    };
  };
})(window);
