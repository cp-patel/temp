/* ============================================================
   Views
   ============================================================ */
(function (global) {
  "use strict";

  var V = {};
  var el = U.el;
  var esc = U.esc;
  var md = U.md;
  var C = global.Curriculum;

  var DIFF = {
    beginner: { c: "emerald", l: "Beginner" },
    intermediate: { c: "cyan", l: "Intermediate" },
    advanced: { c: "rose", l: "Advanced" },
  };

  /* ---------------- helpers ---------------- */

  function phase(id) {
    return C.phases.filter(function (p) {
      return p.id === id;
    })[0];
  }

  function chaptersOf(pid) {
    return C.chapters.filter(function (c) {
      return c.phase === pid;
    });
  }

  function chapter(id) {
    return C.chapters.filter(function (c) {
      return c.id === id;
    })[0];
  }

  function phaseProgress(pid) {
    var list = chaptersOf(pid);
    var done = list.filter(function (c) {
      return Store.isDone(c.id);
    }).length;
    return {
      done: done,
      total: list.length,
      pct: list.length ? (done / list.length) * 100 : 0,
    };
  }

  function overall() {
    var done = C.chapters.filter(function (c) {
      return Store.isDone(c.id);
    }).length;
    return {
      done: done,
      total: C.chapters.length,
      pct: (done / C.chapters.length) * 100,
    };
  }

  function nextChapter() {
    for (var i = 0; i < C.phases.length; i++) {
      var list = chaptersOf(C.phases[i].id);
      for (var j = 0; j < list.length; j++) {
        if (!Store.isDone(list[j].id)) return list[j];
      }
    }
    return null;
  }

  function allCardIds() {
    var ids = [];
    C.chapters.forEach(function (c) {
      (c.cards || []).forEach(function (_, i) {
        ids.push(c.id + ":" + i);
      });
    });
    return ids;
  }

  /* Cards enter the review deck when their chapter is completed — which is what
     the completion box has always promised ("unlock its flashcards for review").
     Without this gate every card in the curriculum counts as due on a brand-new
     account: the sidebar showed a 167 badge before you had read a word, and the
     deck cold-quizzed you on reranking in phase 4 during your first session.
     Spaced repetition only does anything to material you have actually met. */
  function unlockedCardIds() {
    var ids = [];
    C.chapters.forEach(function (c) {
      if (!Store.isDone(c.id)) return;
      (c.cards || []).forEach(function (_, i) {
        ids.push(c.id + ":" + i);
      });
    });
    return ids;
  }

  function totalMinutes() {
    return C.chapters.reduce(function (a, c) {
      return a + c.minutes;
    }, 0);
  }

  V.helpers = {
    phase: phase,
    chaptersOf: chaptersOf,
    chapter: chapter,
    phaseProgress: phaseProgress,
    overall: overall,
    nextChapter: nextChapter,
    allCardIds: allCardIds,
    unlockedCardIds: unlockedCardIds,
    totalMinutes: totalMinutes,
  };

  /* Only the hue comes from the data. Saturation and lightness are theme
     tokens, so the same phase reads correctly on dark and light. */
  function phaseHsl(hue) {
    return "hsl(" + hue + " var(--phase-s) var(--phase-l))";
  }

  function phaseVars(p) {
    return "--phase-color: " + phaseHsl(p.hue) + ";";
  }

  /* =========================================================
     LANDING
     ========================================================= */

  /* A stat that counts up when it scrolls into view. */
  function heroStat(n, label, suffix) {
    return (
      '<div><div class="hstat__n tnum" data-count="' +
      n +
      '"' +
      (suffix ? ' data-count-suffix="' + suffix + '"' : "") +
      ">0" +
      (suffix || "") +
      '</div><div class="hstat__l">' +
      esc(label) +
      "</div></div>"
    );
  }

  /* The eight-phase rail in the hero. Built from real phase data — hues, icons
     and titles all come from the curriculum, so it cannot drift. */
  function pathRailHtml() {
    var stops = C.phases
      .map(function (p, i) {
        return (
          phaseHsl(p.hue) +
          " " +
          Math.round((i / (C.phases.length - 1)) * 100) +
          "%"
        );
      })
      .join(", ");

    var dots = C.phases
      .map(function (p) {
        return (
          '<a class="pathdot" href="#/roadmap" data-phase-hue="' +
          p.hue +
          '" data-phase-title="' +
          U.attr(p.title) +
          '" data-phase-blurb="' +
          U.attr(
            U.plural(chaptersOf(p.id).length, "chapter") + " · " + p.weeks
          ) +
          '" style="--pc: ' +
          phaseHsl(p.hue) +
          '">' +
          '<span class="pathdot__disc">' +
          Icons.get(p.icon, 18) +
          "</span>" +
          '<span class="pathdot__n">' +
          p.n +
          "</span></a>"
        );
      })
      .join("");

    return (
      '<div class="pathrail" style="--rail-gradient: linear-gradient(90deg, ' +
      stops +
      ')">' +
      '<div class="pathrail__line"></div>' +
      '<div class="pathrail__row">' +
      dots +
      "</div>" +
      '<div class="pathrail__label" data-rail-label>' +
      "<b>" +
      U.words(C.phases.length, true) +
      " phases, in a deliberate order</b>" +
      "Hover a phase to see what it covers." +
      "</div></div>"
    );
  }

  V.landing = function (root) {
    document.body.classList.add("is-landing");
    var labCount = Object.keys(Labs).filter(function (k) {
      return typeof Labs[k] === "object" && Labs[k].render;
    }).length;

    var hero = el("section", "hero");
    hero.innerHTML =
      '<div class="hero__inner">' +
      '<div class="hero__badge"><b>2026</b> Interactive curriculum · ' +
      C.chapters.length +
      " chapters · " +
      labCount +
      " labs</div>" +
      "<h1>Become an <em>AI application engineer.</em><br>Properly.</h1>" +
      '<div class="hero__lede">A structured, opinionated path from “I can call an LLM API” ' +
      "to “I can ship an AI system and prove it works.” " +
      U.words(C.phases.length, true) +
      " phases, " +
      "hands-on labs in every chapter, and the parts nobody teaches — " +
      "evaluation, cost, and security.</div>" +
      '<div class="hero__cta">' +
      '<a class="btn btn--primary btn--lg" href="#/roadmap">' +
      Icons.get("map", 16) +
      " Open the roadmap</a>" +
      '<a class="btn btn--outline btn--lg" href="#/chapter/role">' +
      Icons.get("play", 16) +
      " Start chapter 1</a>" +
      "</div>" +
      '<div class="hero__stats">' +
      heroStat(C.phases.length, "Phases") +
      heroStat(C.chapters.length, "Chapters") +
      heroStat(labCount, "Interactive labs") +
      heroStat(C.projects.length, "Projects") +
      heroStat(Math.round(totalMinutes() / 60), "Reading time", "h") +
      "</div>" +
      pathRailHtml() +
      "</div>" +
      '<div class="hero__scroll">' +
      Icons.get("arrowDown", 16) +
      "<span>What's inside</span></div>";

    var why = el("section", "lsection");
    why.innerHTML =
      '<div class="lsection__head"><div class="u-eyebrow">Why this exists</div>' +
      "<h2>Most AI courses stop where the job starts</h2>" +
      "<p>They teach you to call an API and build a chatbot. They don't teach " +
      "evaluation, cost engineering, retrieval debugging, or the security model " +
      "for systems where untrusted text is executable. Those are the skills that " +
      "separate shipping from demoing.</p></div>";

    var feats = el("div", "fgrid");
    [
      [
        "target",
        "Evals as the core skill",
        "A full phase on turning “it feels better” into evidence — eval sets, calibrated judges, confidence intervals, CI gates. This is the phase that gets people hired.",
      ],
      [
        "beaker",
        labCount + " interactive labs",
        "Tokenise text and watch the cost. Drag temperature and watch the distribution collapse. Break a RAG pipeline stage by stage and see exactly which failure it causes.",
      ],
      [
        "db",
        "Retrieval done properly",
        "Chunking, hybrid search, reranking, and a four-stage diagnostic that localises a broken RAG system to one component in twenty minutes.",
      ],
      [
        "shield",
        "Security that isn't hand-waving",
        "Prompt injection, the lethal trifecta, and an attack sandbox where you'll discover that delimiters don't hold and capability removal does.",
      ],
      [
        "dollar",
        "Unit economics throughout",
        "Cost arithmetic in every relevant chapter, because a feature that costs more per use than it earns is a science project.",
      ],
      [
        "graph",
        "Progress that means something",
        "Spaced-repetition flashcards, per-phase mastery, quizzes with real explanations, and notes that persist. All stored locally in your browser.",
      ],
    ].forEach(function (f) {
      var c = el("div", "fcard");
      c.innerHTML =
        '<div class="fcard__icon">' +
        Icons.get(f[0], 20) +
        "</div>" +
        "<h3>" +
        esc(f[1]) +
        "</h3><p>" +
        esc(f[2]) +
        "</p>";
      feats.appendChild(c);
    });
    why.appendChild(feats);

    var path = el("section", "lsection");
    path.innerHTML =
      '<div class="lsection__head"><div class="u-eyebrow">The path</div>' +
      "<h2>" +
      U.words(C.phases.length, true) +
      " phases, in a deliberate order</h2>" +
      "<p>Each phase builds on the last and ends with a project. You can jump " +
      "anywhere, but the sequence exists for a reason.</p></div>";
    var pp = el("div", "pathpreview");
    C.phases.forEach(function (p) {
      var a = el("a", "ppitem");
      a.href = "#/roadmap";
      a.style.cssText = phaseVars(p);
      a.innerHTML =
        '<div class="ppitem__n">' +
        p.n +
        "</div>" +
        "<div><h3>" +
        esc(p.title) +
        "</h3><p>" +
        U.plural(chaptersOf(p.id).length, "chapter") +
        " · " +
        esc(p.weeks) +
        "</p></div>" +
        '<div class="u-faint">' +
        Icons.get("chevRight", 18) +
        "</div>";
      pp.appendChild(a);
    });
    path.appendChild(pp);

    var cta = el("section", "lsection");
    var band = el("div", "cta-band");
    band.innerHTML =
      "<h2>Start with chapter one</h2>" +
      "<p>Fourteen minutes on what the job actually is — and the two mistakes " +
      "that cost people their first six months.</p>" +
      '<a class="btn btn--primary btn--lg" href="#/chapter/role">' +
      Icons.get("arrowRight", 16) +
      " What an AI engineer actually does</a>";
    cta.appendChild(band);

    var foot = el("footer", "lfoot");
    foot.innerHTML =
      "<p>Built as a self-contained static site — no build step, no tracking, " +
      "no accounts. Your progress lives in this browser's local storage.</p>";

    root.appendChild(hero);
    root.appendChild(why);
    root.appendChild(path);
    root.appendChild(cta);
    root.appendChild(foot);

    /* Kinetic headline: words rise out of a mask, in reading order. */
    if (global.Motion) {
      Motion.kinetic(hero.querySelector("h1"), { step: 58, delay: 90 });
    }

    /* One shared label slot for the rail, so eight phase titles don't have to
       compete for horizontal space. */
    var label = hero.querySelector("[data-rail-label]");
    var defaultLabel = label ? label.innerHTML : "";
    U.qa(".pathdot", hero).forEach(function (dot) {
      var show = function () {
        label.innerHTML =
          "<b>" +
          esc(dot.dataset.phaseTitle) +
          "</b>" +
          esc(dot.dataset.phaseBlurb);
      };
      dot.addEventListener("mouseenter", show);
      dot.addEventListener("focus", show);
      dot.addEventListener("mouseleave", function () {
        label.innerHTML = defaultLabel;
      });
      dot.addEventListener("blur", function () {
        label.innerHTML = defaultLabel;
      });
    });
  };

  /* =========================================================
     ROADMAP
     ========================================================= */

  V.roadmap = function (root) {
    var o = overall();
    var next = nextChapter();
    var rmPlan = Store.plan();

    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Learning path</div>' +
      "<h1>The roadmap</h1>" +
      "<p>" +
      U.words(C.chapters.length, true) +
      " chapters across " +
      U.words(C.phases.length) +
      " phases. Work top to bottom, or jump to " +
      "what you need — every chapter stands on its own. " +
      "<strong>" +
      o.done +
      " of " +
      o.total +
      "</strong> complete.</p>";

    if (!Store.profile()) {
      var pcta = el("div", "ob__note");
      pcta.style.marginBottom = "var(--s-6)";
      pcta.innerHTML =
        Icons.get("compass", 14) +
        '<span class="u-grow">Answer four questions and this roadmap will mark ' +
        "what you can <b>skim</b> given what you already know — with a note on " +
        "exactly what's new in each of those chapters.</span>";
      var pbtn = el("button", "btn btn--accent-soft btn--sm");
      pbtn.style.flex = "none";
      pbtn.textContent = "Personalise";
      pbtn.onclick = function () {
        Onboarding.open({
          onDone: function (saved) {
            if (saved) App.go("#/plan");
            else App.go("#/roadmap", true);
          },
        });
      };
      pcta.appendChild(pbtn);
      root.appendChild(pcta);
    }

    var legend = el("div", "rm__legend");
    legend.innerHTML =
      '<div class="rmleg"><span class="rmleg__sw rmleg__sw--done"></span>Completed</div>' +
      '<div class="rmleg"><span class="rmleg__sw rmleg__sw--now"></span>Up next</div>' +
      '<div class="rmleg"><span class="rmleg__sw rmleg__sw--next"></span>Not started</div>' +
      '<div class="u-grow"></div>' +
      '<div class="u-row" style="min-width:190px">' +
      U.bar(o.pct, { cls: "u-grow" }) +
      '<span class="u-mono u-dim" style="font-size:var(--t-xs)">' +
      Math.round(o.pct) +
      "%</span></div>";

    var track = el("div", "track");

    var currentPhase = next ? next.phase : null;

    C.phases.forEach(function (p) {
      var prog = phaseProgress(p.id);
      var complete = prog.done === prog.total;
      var isCurrent = p.id === currentPhase;
      var open =
        Store.phaseOpen(p.id) || (isCurrent && !Store.state().open.__touched);

      var node = el("section", "phase");
      node.style.cssText = phaseVars(p);
      node.className =
        "phase" +
        (open ? " is-open" : "") +
        (complete ? " is-complete" : "") +
        (isCurrent && !complete ? " is-current" : "");

      /* --- rail: medallion + spine --- */
      var rail = el("div", "phase__rail");
      var badge = el("div", "phase__badge");
      badge.style.setProperty("--pct", String(prog.pct));
      badge.innerHTML =
        Icons.get(complete ? "check" : p.icon, 20) +
        '<span class="phase__num">' +
        p.n +
        "</span>";
      rail.appendChild(badge);
      node.appendChild(rail);

      /* --- card --- */
      var card = el("div", "phase__card");

      var headBtn = el("button", "phase__head");
      headBtn.type = "button";
      headBtn.setAttribute("aria-expanded", open ? "true" : "false");
      headBtn.innerHTML =
        '<div class="phase__title"><h2>' +
        esc(p.title) +
        "</h2><p>" +
        esc(p.blurb) +
        "</p></div>" +
        '<div class="phase__meta">' +
        '<div class="phase__prog">' +
        U.bar(prog.pct, { cls: "u-grow" }) +
        '<span class="phase__pct">' +
        prog.done +
        "/" +
        prog.total +
        "</span></div>" +
        '<div class="phase__caret">' +
        Icons.get("chevDown", 16) +
        "</div></div>";

      var bodyWrap = el("div", "phase__body");
      var inner = el("div", "phase__bodyinner");
      var content = el("div", "phase__content");

      var outcomes = el("div", "phase__outcomes");
      outcomes.innerHTML =
        '<span class="chip chip--dot"><span></span>' +
        esc(p.weeks) +
        "</span>" +
        p.outcomes
          .map(function (o2) {
            return (
              '<span class="chip">' +
              Icons.get("check", 12) +
              esc(o2) +
              "</span>"
            );
          })
          .join("");
      content.appendChild(outcomes);

      var list = el("div", "chapters");
      chaptersOf(p.id).forEach(function (ch, i) {
        var done = Store.isDone(ch.id);
        var isNext = next && next.id === ch.id;
        var a = el(
          "a",
          "chnode" + (done ? " is-done" : "") + (isNext ? " is-current" : "")
        );
        a.href = "#/chapter/" + ch.id;
        var d = DIFF[ch.difficulty] || DIFF.intermediate;
        var pi = rmPlan && rmPlan.byId[ch.id];
        a.innerHTML =
          '<span class="chnode__dot">' +
          (done ? Icons.get("check", 15) : String(i + 1)) +
          "</span>" +
          '<span class="chnode__main"><span class="chnode__t">' +
          esc(ch.title) +
          '</span><span class="chnode__s">' +
          esc(ch.subtitle) +
          "</span></span>" +
          '<span class="chnode__tags">' +
          (pi
            ? '<span class="mode mode--' + pi.mode + '">' + pi.mode + "</span>"
            : "") +
          (ch.lab
            ? '<span class="chip chip--accent chip--hide-sm">' +
              Icons.get("beaker", 12) +
              "Lab</span>"
            : "") +
          '<span class="chip chip--' +
          d.c +
          ' chip--hide-sm">' +
          d.l +
          "</span>" +
          '<span class="chip">' +
          Icons.get("clock", 12) +
          ch.minutes +
          "m</span></span>";
        list.appendChild(a);
      });
      content.appendChild(list);

      var proj = C.projects.filter(function (pr) {
        return pr.phase === p.id;
      })[0];
      if (proj) {
        var pc = el("a", "capstone");
        pc.href = "#/projects";
        pc.innerHTML =
          '<span class="capstone__icon">' +
          Icons.get("hammer", 18) +
          "</span>" +
          '<span class="u-grow"><span class="capstone__t">Project: ' +
          esc(proj.title) +
          '</span><span class="capstone__s">' +
          esc(proj.tier) +
          " · " +
          esc(proj.hours) +
          " · " +
          U.plural(proj.tasks.length, "milestone") +
          "</span></span>" +
          Icons.get("chevRight", 16);
        content.appendChild(pc);
      }

      inner.appendChild(content);
      bodyWrap.appendChild(inner);
      card.appendChild(headBtn);
      card.appendChild(bodyWrap);
      node.appendChild(card);
      track.appendChild(node);

      headBtn.onclick = function () {
        var isOpen = node.classList.toggle("is-open");
        headBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        Store.phaseOpen(p.id, isOpen);
        Store.state().open.__touched = true;
        Store.save();
        // Newly-revealed bars should animate rather than appear filled.
        if (isOpen && global.Motion) Motion.progress(content);
      };
    });

    root.appendChild(head);
    root.appendChild(legend);
    root.appendChild(track);
  };

  /* =========================================================
     CHAPTER
     ========================================================= */

  V.chapter = function (root, id) {
    var ch = chapter(id);
    if (!ch) {
      root.appendChild(
        emptyState(
          "Chapter not found",
          "That chapter doesn't exist.",
          "#/roadmap",
          "Back to roadmap"
        )
      );
      return;
    }
    Store.visit(id);

    var p = phase(ch.phase);
    var idx = C.chapters.indexOf(ch);
    var prev = C.chapters[idx - 1];
    var nxt = C.chapters[idx + 1];
    var d = DIFF[ch.difficulty] || DIFF.intermediate;

    root.className = "page page--reader";

    var progressBar = el("div", "readbar");
    progressBar.innerHTML = '<div class="readbar__fill"></div>';
    document.body.appendChild(progressBar);

    var grid = el("div", "reader");
    var main = el("div", "reader__main");
    var aside = el("aside", "reader__aside");

    /* --- header --- */
    var head = el("header", "chhead");
    head.innerHTML =
      '<div class="chhead__kicker">' +
      '<a class="chip chip--accent" href="#/roadmap" style="--accent:' +
      phaseHsl(p.hue) +
      '">' +
      p.n +
      " · " +
      esc(p.title.split("—")[0].trim()) +
      "</a>" +
      '<span class="chip chip--' +
      d.c +
      '">' +
      d.l +
      "</span>" +
      (ch.lab
        ? '<span class="chip chip--accent">' +
          Icons.get("beaker", 12) +
          "Interactive lab</span>"
        : "") +
      "</div>" +
      "<h1>" +
      esc(ch.title) +
      "</h1>" +
      '<p class="chhead__sub">' +
      esc(ch.subtitle) +
      "</p>" +
      '<div class="chhead__facts">' +
      "<span>" +
      Icons.get("clock", 13) +
      ch.minutes +
      " min read</span>" +
      "<span>" +
      Icons.get("target", 13) +
      U.plural(ch.quiz.length, "quiz question") +
      "</span>" +
      "<span>" +
      Icons.get("cards", 13) +
      U.plural((ch.cards || []).length, "flashcard") +
      "</span>" +
      "<span>" +
      Icons.get("book", 13) +
      "Chapter " +
      (idx + 1) +
      " of " +
      C.chapters.length +
      "</span>" +
      "</div>";
    main.appendChild(head);

    /* --- objectives --- */
    if (ch.objectives && ch.objectives.length) {
      var ob = el("div", "objectives");
      ob.innerHTML =
        "<h2>By the end of this chapter you can</h2><ul>" +
        ch.objectives
          .map(function (o) {
            return "<li>" + md(o) + "</li>";
          })
          .join("") +
        "</ul>";
      main.appendChild(ob);
    }

    /* --- personalised delta note --- */
    var plan = Store.plan();
    var pItem = plan && plan.byId[ch.id];
    /* Shown whenever the plan has something specific to say about this chapter.
       The old test for that was `skim || (deep && has-an-overlap-entry)`, which
       silently dropped the study-mode notes — including the one on the roadmap's
       own first chapter, whose whole job is to say which section to actually
       read. The generic flag is the honest version of the same question. */
    if (pItem && pItem.why && !pItem.generic) {
      var isDeep = pItem.mode === "deep";
      var isSkim = pItem.mode === "skim";
      var dn = el("div", "delta" + (isDeep ? " delta--deep" : ""));
      dn.innerHTML =
        '<div class="delta__ic">' +
        Icons.get(isSkim ? "zap" : isDeep ? "target" : "bulb", 17) +
        "</div><div>" +
        '<div class="delta__t">' +
        (isSkim
          ? "You can skim this — here's what's actually new"
          : isDeep
            ? "Core chapter — where to focus, given your background"
            : "Some of this will be familiar — here's the part that isn't") +
        "</div>" +
        '<div class="delta__b">' +
        md(pItem.why) +
        "</div></div>";
      main.appendChild(dn);
    }

    /* --- body --- */
    var prose = el("article", "prose");
    var rendered = Render.body(ch.body, ch.id);
    prose.appendChild(rendered.frag);
    main.appendChild(prose);

    /* --- takeaways --- */
    if (ch.takeaways) main.appendChild(Render.takeaways(ch.takeaways));

    /* --- quiz --- */
    if (ch.quiz && ch.quiz.length) main.appendChild(Render.quiz(ch));

    /* --- resources --- */
    if (ch.resources && ch.resources.length)
      main.appendChild(Render.resources(ch.resources));

    /* --- complete --- */
    var doneBox = el("div", "chdone" + (Store.isDone(ch.id) ? " is-done" : ""));
    function paintDone() {
      var isDone = Store.isDone(ch.id);
      doneBox.classList.toggle("is-done", isDone);
      doneBox.innerHTML =
        '<div class="u-grow"><div class="chdone__t">' +
        (isDone
          ? Icons.get("checkCircle", 18) + " Chapter complete"
          : "Finished this chapter?") +
        "</div>" +
        '<div class="chdone__s">' +
        (isDone
          ? "Marked complete. Your flashcards from this chapter are now in the review deck."
          : "Mark it complete to earn " +
            Store.XP.chapter +
            " XP and unlock its flashcards for review.") +
        "</div></div>";
      var btn = el(
        "button",
        "btn " + (isDone ? "btn--outline" : "btn--primary")
      );
      btn.innerHTML = isDone
        ? Icons.get("reset", 15) + " Mark incomplete"
        : Icons.get("check", 15) + " Mark complete";
      btn.onclick = function () {
        Store.complete(ch.id, !isDone);
        paintDone();
        if (!isDone && nxt) {
          Toast.show(
            "Chapter complete",
            "Next: " + nxt.title,
            "win",
            "checkCircle"
          );
        }
      };
      doneBox.appendChild(btn);
    }
    paintDone();
    main.appendChild(doneBox);

    /* --- prev/next --- */
    var nav = el("div", "chnav");
    if (prev) {
      var pa = el("a", "chnav__btn");
      pa.href = "#/chapter/" + prev.id;
      pa.innerHTML =
        Icons.get("arrowLeft", 18) +
        '<span><span class="chnav__lbl">Previous</span>' +
        '<span class="chnav__t">' +
        esc(prev.title) +
        "</span></span>";
      nav.appendChild(pa);
    }
    if (nxt) {
      var na = el("a", "chnav__btn chnav__btn--next");
      na.href = "#/chapter/" + nxt.id;
      na.innerHTML =
        '<span><span class="chnav__lbl">Next</span>' +
        '<span class="chnav__t">' +
        esc(nxt.title) +
        "</span></span>" +
        Icons.get("arrowRight", 18);
      nav.appendChild(na);
    }
    main.appendChild(nav);

    /* --- aside: TOC + notes --- */
    var toc = el("div", "toc");
    toc.innerHTML =
      "<h2>On this page</h2><ul>" +
      rendered.headings
        .map(function (h) {
          return (
            '<li><a href="#' +
            h.id +
            '" class="' +
            (h.sub ? "is-sub" : "") +
            '">' +
            esc(h.text) +
            "</a></li>"
          );
        })
        .join("") +
      "</ul>";
    aside.appendChild(toc);

    var notes = el("div", "notes");
    notes.innerHTML =
      "<h2>Your notes</h2>" +
      '<textarea placeholder="Notes for this chapter — saved automatically."></textarea>' +
      '<div class="notes__saved">Saved</div>';
    var ta = notes.querySelector("textarea");
    var saved = notes.querySelector(".notes__saved");
    ta.value = Store.note(ch.id);
    ta.addEventListener(
      "input",
      U.debounce(function () {
        Store.note(ch.id, ta.value);
        saved.classList.add("is-on");
        setTimeout(function () {
          saved.classList.remove("is-on");
        }, 1400);
      }, 500)
    );
    aside.appendChild(notes);

    grid.appendChild(main);
    grid.appendChild(aside);
    root.appendChild(grid);

    /* --- scroll spy + reading progress --- */
    var fill = progressBar.querySelector(".readbar__fill");
    var tocLinks = U.qa("a", toc);
    var anchors = rendered.headings.map(function (h) {
      return document.getElementById(h.id);
    });

    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      fill.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";

      var active = -1;
      anchors.forEach(function (a, i) {
        if (a && a.getBoundingClientRect().top < 140) active = i;
      });
      tocLinks.forEach(function (l, i) {
        l.classList.toggle("is-active", i === active);
      });
    }
    App.onScroll(onScroll);
    App.onLeave(function () {
      if (progressBar.parentNode)
        progressBar.parentNode.removeChild(progressBar);
    });
    onScroll();
  };

  /* =========================================================
     PLAN — personalised week-by-week schedule
     ========================================================= */

  var MODE_LABEL = {
    deep: { l: "Deep", ic: "brain" },
    study: { l: "Study", ic: "book" },
    skim: { l: "Skim", ic: "zap" },
  };

  V.plan = function (root) {
    var profile = Store.profile();

    if (!profile) {
      var head0 = el("div", "page-head");
      head0.innerHTML =
        '<div class="u-eyebrow">Personalised</div><h1>My plan</h1>' +
        "<p>Tell us your background and available hours, and this becomes a " +
        "week-by-week schedule that marks what you can skim and what's genuinely " +
        "new for you.</p>";
      root.appendChild(head0);

      var cta = el("div", "resume");
      cta.innerHTML =
        '<div class="u-eyebrow">Two minutes</div><h2>Build your plan</h2>' +
        "<p>Four questions. Everything stays in this browser, and you can change " +
        "your answers whenever your situation does.</p>";
      var btn = el("button", "btn btn--primary");
      btn.innerHTML = Icons.get("compass", 15) + " Set up my plan";
      btn.onclick = function () {
        Onboarding.open({
          onDone: function (saved) {
            if (saved) App.go("#/plan", true);
          },
        });
      };
      cta.appendChild(btn);
      root.appendChild(cta);
      return;
    }

    var plan = Store.plan();
    var track = (C.tracks || []).filter(function (t) {
      return t.id === profile.track;
    })[0];

    /* ---- hero ---- */
    var doneCount = plan.items.filter(function (it) {
      return Store.isDone(it.id);
    }).length;
    var pct = (doneCount / plan.items.length) * 100;

    var hero = el("div", "planhero");
    var left = el("div");
    left.innerHTML =
      '<div class="u-eyebrow">Your plan · ' +
      esc(track ? track.label : "Custom") +
      "</div>" +
      "<h2>" +
      plan.totalWeeks +
      " weeks at " +
      plan.hoursPerWeek +
      " h/week</h2>" +
      "<p>" +
      Math.round(plan.readingMinutes / 60) +
      "h of chapters and labs, plus " +
      Math.round(plan.projectMinutes / 60) +
      "h of project work — projects are where most of the learning happens, so " +
      "they are scheduled rather than left as an afterthought. " +
      plan.counts.deep +
      " chapters to go deep on, " +
      plan.counts.study +
      " to study, and " +
      plan.counts.skim +
      " you can skim because you already know the material.</p>";
    var ring = el("div", "week__ring");
    ring.innerHTML =
      '<div class="ring" style="--ring-size:72px;--ring-w:6px;--pct:' +
      pct +
      '">' +
      '<span class="ring__label" style="font-size:0.8rem">' +
      Math.round(pct) +
      "%</span></div>";
    hero.appendChild(left);
    hero.appendChild(ring);
    root.appendChild(hero);

    /* ---- controls ---- */
    var bar = el("div", "u-between");
    bar.style.marginBottom = "var(--s-5)";
    var next = nextChapter();
    var acts = el("div", "u-row u-wrap");
    if (next) {
      var go = el("a", "btn btn--primary btn--wrap");
      go.href = "#/chapter/" + next.id;
      var m = plan.byId[next.id];
      go.innerHTML =
        Icons.get("play", 15) +
        "<span> Continue · " +
        esc(next.title.slice(0, 34)) +
        (m ? " (" + MODE_LABEL[m.mode].l.toLowerCase() + ")" : "") +
        "</span>";
      acts.appendChild(go);
    }
    var edit = el("button", "btn btn--outline");
    edit.innerHTML = Icons.get("settings", 15) + " Edit profile";
    edit.onclick = function () {
      Onboarding.open({
        onDone: function () {
          App.go("#/plan", true);
        },
      });
    };
    acts.appendChild(edit);
    bar.appendChild(acts);
    root.appendChild(bar);

    /* ---- legend ---- */
    var legend = el("div", "modelegend");
    legend.innerHTML =
      '<span><span class="mode mode--deep">Deep</span> &nbsp;<b>Core.</b> ' +
      "Load-bearing and interview-probed. Do the lab and the quiz.</span>" +
      '<span><span class="mode mode--study">Study</span> &nbsp;<b>New to you.</b> ' +
      "Read properly.</span>" +
      '<span><span class="mode mode--skim">Skim</span> &nbsp;<b>You know this.</b> ' +
      "Read the delta note, then move on.</span>";
    root.appendChild(legend);

    /* ---- weeks ---- */
    var weeks = el("div", "weeks");
    plan.weeks.forEach(function (wk) {
      var wDone = wk.items.filter(function (it) {
        return Store.isDone(it.id);
      }).length;
      // Project-only weeks have no chapters: fall back to project milestones
      // so the ring means something instead of showing NaN.
      var wTotal = wk.items.length;
      var wPct = wTotal ? (wDone / wTotal) * 100 : 0;
      if (!wTotal && wk.projects.length) {
        var pr0 = wk.projects[0].project;
        wDone = Store.projDone(pr0.id);
        wTotal = pr0.tasks.length;
        wPct = wTotal ? (wDone / wTotal) * 100 : 0;
      }

      var node = el("section", "week");
      var phases = {};
      wk.items.forEach(function (it) {
        phases[it.phase] = true;
      });
      var phaseNames = Object.keys(phases)
        .map(function (pid) {
          var p = phase(pid);
          return p ? p.title.split("—")[0].trim() : pid;
        })
        .join(" · ");

      var focus = wk.items.length
        ? esc(phaseNames)
        : wk.projects.length
          ? "Project work — " + esc(wk.projects[0].project.title)
          : "";
      node.innerHTML =
        '<div class="week__head"><div class="week__n">' +
        wk.n +
        "</div>" +
        '<div class="u-grow"><div class="week__t">Week ' +
        wk.n +
        "</div>" +
        '<div class="week__s">' +
        focus +
        " · " +
        U.hours(wk.minutes) +
        "</div></div>" +
        '<div class="week__ring"><div class="ring" style="--pct:' +
        wPct +
        '"><span class="ring__label">' +
        wDone +
        "/" +
        wTotal +
        "</span></div></div></div>";

      var body = el("div", "week__body");
      wk.items.forEach(function (it) {
        var done = Store.isDone(it.id);
        var a = el("a", "planrow" + (done ? " is-done" : ""));
        a.href = "#/chapter/" + it.id;
        var ml = MODE_LABEL[it.mode];
        /* A note only earns a line when it is about this chapter. The generic
           ones restated the mode chip, 31 times in 44 rows, which buried the 13
           that carry real guidance. The text still reaches the reader — it is the
           chip's tooltip, and the legend above the weeks spells out every mode. */
        a.innerHTML =
          '<span class="planrow__dot">' +
          (done ? Icons.get("check", 12) : "") +
          "</span>" +
          '<span><span class="planrow__t">' +
          esc(it.title) +
          "</span>" +
          (it.generic
            ? ""
            : '<span class="planrow__why">' + md(it.why || "") + "</span>") +
          "</span>" +
          '<span class="planrow__min">' +
          it.effort +
          "m</span>" +
          '<span class="mode mode--' +
          it.mode +
          '" title="' +
          U.attr(it.why || "") +
          '">' +
          ml.l +
          "</span>";
        body.appendChild(a);
      });

      wk.projects.forEach(function (slot) {
        var pr = slot.project;
        var pDone = Store.projDone(pr.id);
        var pn = el("a", "week__proj");
        pn.href = "#/projects";
        pn.innerHTML =
          Icons.get("hammer", 15) +
          '<span class="u-grow">Project: <b>' +
          esc(pr.title) +
          "</b>" +
          (slot.parts > 1
            ? ' <span class="u-faint">(part ' +
              slot.part +
              " of " +
              slot.parts +
              ")</span>"
            : "") +
          " — " +
          U.hours(slot.minutes) +
          " this week · " +
          pDone +
          "/" +
          pr.tasks.length +
          " milestones done</span>" +
          Icons.get("chevRight", 14);
        body.appendChild(pn);
      });

      node.appendChild(body);
      weeks.appendChild(node);
    });
    root.appendChild(weeks);
  };
  /* =========================================================
     DASHBOARD
     ========================================================= */

  V.dashboard = function (root) {
    var s = Store.state();
    var o = overall();
    var lvl = Store.level();
    var next = nextChapter();
    var cards = Store.cardStats(unlockedCardIds());

    var quizzed = 0,
      quizRight = 0,
      quizTotal = 0;
    C.chapters.forEach(function (c) {
      var q = (s.progress[c.id] || {}).quiz;
      if (q) {
        quizzed++;
        quizRight += q.right;
        quizTotal += q.total;
      }
    });

    var minsDone = C.chapters.reduce(function (a, c) {
      return a + (Store.isDone(c.id) ? c.minutes : 0);
    }, 0);

    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Your progress</div>' +
      "<h1>" +
      esc(lvl.name) +
      "</h1>" +
      "<p>" +
      U.commas(s.xp) +
      " XP" +
      (lvl.next
        ? " · " + U.commas(lvl.next - s.xp) + " to " + esc(lvl.nextName)
        : " · top level reached") +
      "</p>" +
      U.bar(lvl.pct, {
        cls: "bar--tall",
        style: "max-width:420px;margin-top:var(--s-4)",
      });

    var stats = el("div", "dgrid");
    [
      [
        "Chapters complete",
        o.done + "<small>/" + o.total + "</small>",
        "book",
        Math.round(o.pct) + "% of the curriculum",
      ],
      [
        "Current streak",
        s.streak.n + "<small>d</small>",
        "flame",
        "Best: " + U.plural(s.streak.best || 0, "day"),
      ],
      [
        "Quiz accuracy",
        /* An untaken quiz is not a failed one: 0% would read as "you got
           everything wrong" on a fresh install. */
        quizTotal
          ? Math.round((quizRight / quizTotal) * 100) + "<small>%</small>"
          : '<span class="stat__none">—</span>',
        "target",
        quizTotal
          ? quizzed + " of " + o.total + " quizzes taken"
          : "No quizzes taken yet",
      ],
      [
        "Cards learned",
        cards.total
          ? cards.learned + "<small>/" + cards.total + "</small>"
          : '<span class="stat__none">—</span>',
        "cards",
        cards.total
          ? cards.due + " due for review"
          : "Complete a chapter to unlock cards",
      ],
      [
        "Reading done",
        U.hours(minsDone),
        "clock",
        /* Say what this number is. Read alone it looks like the whole course
           fits in 15 hours, which contradicts the plan's 15 weeks and is the
           exact "it only takes two weeks" figure this curriculum argues against:
           labs, quizzes and projects are where the hours actually go. */
        U.hours(totalMinutes() - minsDone) + " of reading left, labs aside",
      ],
      [
        "Notes written",
        String(Store.noteCount()),
        "doc",
        "Across all chapters",
      ],
    ].forEach(function (x) {
      var c = el("div", "stat");
      c.innerHTML =
        '<div class="stat__top"><div class="stat__lbl">' +
        esc(x[0]) +
        "</div>" +
        '<div class="stat__ic">' +
        Icons.get(x[2], 15) +
        "</div></div>" +
        '<div class="stat__n">' +
        x[1] +
        "</div>" +
        '<div class="stat__sub">' +
        esc(x[3]) +
        "</div>";
      stats.appendChild(c);
    });

    var cols = el("div", "dcols");
    var lcol = el("div");
    var rcol = el("div");

    /* resume card */
    if (next) {
      var p = phase(next.phase);
      var resume = el("div", "resume");
      resume.innerHTML =
        '<div class="u-eyebrow">Up next · Phase ' +
        p.n +
        "</div>" +
        "<h2>" +
        esc(next.title) +
        "</h2>" +
        "<p>" +
        esc(next.subtitle) +
        "</p>" +
        '<a class="btn btn--primary" href="#/chapter/' +
        next.id +
        '">' +
        Icons.get("play", 15) +
        " Continue · " +
        next.minutes +
        " min</a>";
      lcol.appendChild(resume);
    } else {
      var doneCard = el("div", "resume");
      doneCard.innerHTML =
        '<div class="u-eyebrow">Complete</div><h2>All ' +
        C.chapters.length +
        " chapters done</h2>" +
        "<p>Now do the projects — the deployed one especially. Nothing on this " +
        "roadmap teaches as much as real users doing unexpected things.</p>" +
        '<a class="btn btn--primary" href="#/projects">' +
        Icons.get("hammer", 15) +
        " Open projects</a>";
      lcol.appendChild(doneCard);
    }

    /* activity heat */
    var heatCard = el("div", "card card--pad");
    heatCard.style.marginTop = "var(--s-5)";
    var heat = Store.heat(91);
    heatCard.innerHTML =
      '<div class="u-between" style="margin-bottom:var(--s-4)">' +
      '<div><div class="u-eyebrow">Activity</div>' +
      '<div class="u-dim" style="font-size:var(--t-sm);margin-top:4px">Last 13 weeks</div></div>' +
      '<div class="u-row" style="gap:4px;font-size:var(--t-xs);color:var(--ink-3)">Less' +
      [0, 1, 2, 3, 4]
        .map(function (l) {
          return '<span class="heat__c" data-lvl="' + l + '"></span>';
        })
        .join("") +
      "More</div></div>";
    var strip = el("div", "heat");
    heat.forEach(function (d) {
      var c = el("div", "heat__c");
      c.setAttribute("data-lvl", String(d.lvl));
      c.title = d.day + " · " + d.xp + " XP";
      strip.appendChild(c);
    });
    heatCard.appendChild(strip);
    lcol.appendChild(heatCard);

    /* mastery */
    var mastery = el("div", "card card--pad");
    mastery.innerHTML =
      '<div class="u-eyebrow" style="margin-bottom:var(--s-4)">Phase mastery</div>';
    var mg = el("div", "masterygrid");
    C.phases.forEach(function (p) {
      var prog = phaseProgress(p.id);
      var row = el("a", "mrow");
      row.href = "#/roadmap";
      row.style.cssText = phaseVars(p);
      row.innerHTML =
        '<span class="mrow__i">' +
        p.n +
        "</span>" +
        '<span class="u-grow"><span class="mrow__t">' +
        esc(p.title.split("—")[0].trim()) +
        "</span>" +
        U.bar(prog.pct, {
          cls: "bar--thin",
          style: "margin-top:5px",
          inline: true,
        }) +
        "</span>" +
        '<span class="mrow__v">' +
        prog.done +
        "/" +
        prog.total +
        "</span>";
      mg.appendChild(row);
    });
    mastery.appendChild(mg);
    rcol.appendChild(mastery);

    /* badges */
    var badges = el("div", "card card--pad");
    badges.style.marginTop = "var(--s-5)";
    badges.innerHTML =
      '<div class="u-eyebrow" style="margin-bottom:var(--s-4)">Milestones</div>';
    var bg = el("div", "badgegrid");
    var earned = [
      ["First step", "play", o.done >= 1],
      ["Foundations", "brain", phaseProgress("foundations").pct === 100],
      ["Prompt smith", "chat", phaseProgress("prompting").pct === 100],
      ["Builder", "terminal", phaseProgress("building").pct === 100],
      ["Retriever", "db", phaseProgress("retrieval").pct === 100],
      ["Agent wrangler", "robot", phaseProgress("agents").pct === 100],
      ["Eval engineer", "target", phaseProgress("evals").pct === 100],
      ["Operator", "gauge", phaseProgress("production").pct === 100],
      ["Frontier", "rocket", phaseProgress("frontier").pct === 100],
      ["Lab rat", "beaker", Object.keys(s.labs).length >= 6],
      [
        "Perfectionist",
        "star",
        quizTotal > 0 && quizRight === quizTotal && quizzed >= 5,
      ],
      ["Week streak", "flame", (s.streak.best || 0) >= 7],
      ["Card shark", "cards", cards.learned >= 40],
      ["Shipped", "trophy", Store.projDone("p-ship") >= 4],
    ];
    earned.forEach(function (b) {
      var n = el("div", "badge" + (b[2] ? "" : " is-locked"));
      n.title = b[2] ? "Earned" : "Locked";
      n.innerHTML =
        '<div class="badge__ic">' +
        Icons.get(b[2] ? b[1] : "lock", 18) +
        "</div>" +
        '<div class="badge__t">' +
        esc(b[0]) +
        "</div>";
      bg.appendChild(n);
    });
    badges.appendChild(bg);
    rcol.appendChild(badges);

    /* review CTA */
    if (cards.due > 0) {
      var rev = el("div", "card card--pad");
      rev.style.marginTop = "var(--s-5)";
      rev.innerHTML =
        '<div class="u-eyebrow">Spaced repetition</div>' +
        '<div style="font-size:var(--t-md);font-weight:640;color:var(--ink);margin:var(--s-2) 0">' +
        cards.due +
        " cards due</div>" +
        '<p class="u-dim" style="font-size:var(--t-sm);margin-bottom:var(--s-4)">' +
        "Reviewing on schedule is how this content stops being something you read " +
        "and becomes something you know.</p>" +
        '<a class="btn btn--accent-soft btn--block" href="#/review">' +
        Icons.get("cards", 15) +
        " Start review</a>";
      rcol.appendChild(rev);
    }

    cols.appendChild(lcol);
    cols.appendChild(rcol);

    root.appendChild(head);
    root.appendChild(stats);
    root.appendChild(cols);
  };

  /* =========================================================
     LIBRARY
     ========================================================= */

  V.library = function (root) {
    var filter = { phase: "all", diff: "all", q: "", state: "all" };

    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">All content</div><h1>Chapter library</h1>' +
      "<p>Every chapter, filterable. Useful when you know what you're looking for.</p>";

    var filters = el("div", "filters");
    var search = el("div", "searchfield");
    search.innerHTML =
      Icons.get("search", 15) +
      '<input type="text" placeholder="Filter chapters…" aria-label="Filter chapters">';
    var input = search.querySelector("input");
    filters.appendChild(search);

    function pillGroup(key, opts) {
      opts.forEach(function (o) {
        var b = el("button", "fpill" + (filter[key] === o.id ? " is-on" : ""));
        b.textContent = o.label;
        b.onclick = function () {
          filter[key] = o.id;
          U.qa(".fpill", filters).forEach(function (x) {
            if (x.dataset.k === key) x.classList.remove("is-on");
          });
          b.classList.add("is-on");
          paint();
        };
        b.dataset.k = key;
        filters.appendChild(b);
      });
    }
    pillGroup("state", [
      { id: "all", label: "All" },
      { id: "todo", label: "Not done" },
      { id: "done", label: "Complete" },
      { id: "lab", label: "Has lab" },
    ]);
    pillGroup("diff", [
      { id: "all", label: "Any level" },
      { id: "beginner", label: "Beginner" },
      { id: "intermediate", label: "Intermediate" },
      { id: "advanced", label: "Advanced" },
    ]);

    var grid = el("div", "libgrid");

    function paint() {
      var q = filter.q.toLowerCase();
      var list = C.chapters.filter(function (c) {
        if (filter.diff !== "all" && c.difficulty !== filter.diff) return false;
        if (filter.state === "done" && !Store.isDone(c.id)) return false;
        if (filter.state === "todo" && Store.isDone(c.id)) return false;
        if (filter.state === "lab" && !c.lab) return false;
        if (q) {
          var hay = (
            c.title +
            " " +
            c.subtitle +
            " " +
            (c.tags || []).join(" ")
          ).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

      grid.innerHTML = "";
      if (!list.length) {
        grid.appendChild(
          emptyState("Nothing matches", "Try a different filter.", null, null)
        );
        return;
      }
      list.forEach(function (c) {
        var p = phase(c.phase);
        var d = DIFF[c.difficulty] || DIFF.intermediate;
        var done = Store.isDone(c.id);
        var a = el("a", "libcard");
        a.href = "#/chapter/" + c.id;
        a.innerHTML =
          '<div class="libcard__top">' +
          '<span class="chip chip--phase" style="--pc: ' +
          phaseHsl(p.hue) +
          '">' +
          p.n +
          " · " +
          esc(p.title.split("—")[0].trim()) +
          "</span>" +
          (done
            ? '<span class="chip chip--emerald">' +
              Icons.get("check", 12) +
              "Done</span>"
            : "") +
          "</div>" +
          "<h2>" +
          esc(c.title) +
          "</h2><p>" +
          esc(c.subtitle) +
          "</p>" +
          '<div class="libcard__foot">' +
          "<span>" +
          Icons.get("clock", 12) +
          c.minutes +
          "m</span>" +
          '<span class="chip chip--' +
          d.c +
          '">' +
          d.l +
          "</span>" +
          (c.lab
            ? '<span class="chip chip--accent">' +
              Icons.get("beaker", 12) +
              "Lab</span>"
            : "") +
          "</div>";
        grid.appendChild(a);
      });
    }

    input.addEventListener(
      "input",
      U.debounce(function () {
        filter.q = input.value;
        paint();
      }, 140)
    );

    root.appendChild(head);
    root.appendChild(filters);
    root.appendChild(grid);
    paint();
  };

  /* =========================================================
     GLOSSARY
     ========================================================= */

  V.glossary = function (root) {
    var letter = "all";
    var q = "";

    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Reference</div><h1>Glossary</h1>' +
      "<p>" +
      C.glossary.length +
      " terms, each with the practical note that " +
      "matters more than the definition.</p>";

    var search = el("div", "searchfield");
    search.style.marginBottom = "var(--s-5)";
    search.innerHTML =
      Icons.get("search", 15) +
      '<input type="text" placeholder="Search terms…" aria-label="Search glossary">';
    var input = search.querySelector("input");

    var alpha = el("div", "alpha");
    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    var present = {};
    C.glossary.forEach(function (g) {
      present[g.t[0].toUpperCase()] = true;
    });

    var allBtn = el("button", "is-on");
    allBtn.textContent = "All";
    allBtn.style.width = "auto";
    allBtn.style.padding = "0 8px";
    alpha.appendChild(allBtn);
    allBtn.onclick = function () {
      letter = "all";
      U.qa("button", alpha).forEach(function (b) {
        b.classList.remove("is-on");
      });
      allBtn.classList.add("is-on");
      paint();
    };

    letters.forEach(function (L) {
      var b = el("button");
      b.textContent = L;
      b.disabled = !present[L];
      b.onclick = function () {
        letter = L;
        U.qa("button", alpha).forEach(function (x) {
          x.classList.remove("is-on");
        });
        b.classList.add("is-on");
        paint();
      };
      alpha.appendChild(b);
    });

    var grid = el("div", "glossgrid");

    function paint() {
      var list = C.glossary
        .slice()
        .sort(function (a, b) {
          return a.t.localeCompare(b.t);
        })
        .filter(function (g) {
          if (letter !== "all" && g.t[0].toUpperCase() !== letter) return false;
          if (q) {
            return (
              (g.t + " " + g.d + " " + (g.n || "")).toLowerCase().indexOf(q) !==
              -1
            );
          }
          return true;
        });

      grid.innerHTML = "";
      if (!list.length) {
        grid.appendChild(
          emptyState("No terms match", "Try a different search.", null, null)
        );
        return;
      }
      list.forEach(function (g) {
        var c = el("div", "gterm");
        c.innerHTML =
          '<div class="gterm__h"><h2>' +
          esc(g.t) +
          "</h2></div>" +
          "<p>" +
          md(g.d) +
          "</p>" +
          /* The practical note is the half of a glossary entry worth reading,
             so it gets its own treatment rather than reading as a second
             definition paragraph. */
          (g.n
            ? '<p class="gterm__note"><span class="gterm__bulb">' +
              Icons.get("bulb", 13) +
              "</span><span>" +
              md(g.n) +
              "</span></p>"
            : "");
        grid.appendChild(c);
      });
    }

    input.addEventListener(
      "input",
      U.debounce(function () {
        q = input.value.toLowerCase();
        paint();
      }, 140)
    );

    root.appendChild(head);
    root.appendChild(search);
    root.appendChild(alpha);
    root.appendChild(grid);
    paint();
  };

  /* =========================================================
     PROJECTS
     ========================================================= */

  V.projects = function (root) {
    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Build</div><h1>Projects</h1>' +
      "<p>" +
      U.words(C.projects.length, true) +
      " projects, ordered by difficulty. Do at least three — the " +
      "eval harness and the deployed one especially. Tick milestones as you go; " +
      "each is worth " +
      Store.XP.task +
      " XP.</p>";

    var grid = el("div", "projgrid");

    C.projects.forEach(function (pr) {
      var p = phase(pr.phase);
      var doneCount = Store.projDone(pr.id);
      var node = el("div", "proj");

      var tierColor =
        pr.tier === "Capstone"
          ? "amber"
          : pr.tier === "Advanced"
            ? "rose"
            : pr.tier === "Core"
              ? "cyan"
              : "emerald";

      var headHtml =
        '<div class="proj__tier"><span class="chip chip--' +
        tierColor +
        '">' +
        Icons.get("hammer", 12) +
        esc(pr.tier) +
        "</span></div>" +
        "<h2>" +
        esc(pr.title) +
        "</h2>" +
        '<p class="proj__brief">' +
        esc(pr.brief) +
        "</p>" +
        '<dl class="proj__specs">' +
        '<div class="pspec"><dt>Phase</dt><dd>' +
        p.n +
        " · " +
        esc(p.title.split("—")[0].trim()) +
        "</dd></div>" +
        '<div class="pspec"><dt>Effort</dt><dd>' +
        esc(pr.hours) +
        "</dd></div>" +
        '<div class="pspec"><dt>Stack</dt><dd>' +
        esc(pr.stack) +
        "</dd></div>" +
        '<div class="pspec"><dt>Proves</dt><dd>' +
        esc(pr.proves) +
        "</dd></div>" +
        "</dl>";
      node.innerHTML = headHtml;

      /* Each milestone names the chapter that teaches it. Projects are 118 of the
         plan's 147 hours and had no link back to the 44 chapters at all, so a
         reader stuck on "fuse BM25 and dense with RRF" had to remember which
         chapter covered it and go find it. The row stays a single toggle target;
         the reference is a sibling link, outside the button, so tapping the
         milestone never navigates by accident. */
      var cl = el("div", "checklist");
      pr.tasks.forEach(function (t, i) {
        var text = typeof t === "string" ? t : t.t;
        var chId = typeof t === "string" ? null : t.ch;
        var ch = chId ? chapter(chId) : null;
        var on = !!(Store.state().projects[pr.id] || {})[i];

        var row = el("div", "ckrow");
        var b = el("button", "ckitem" + (on ? " is-on" : ""));
        b.type = "button";
        b.innerHTML =
          '<span class="ckitem__box">' +
          Icons.get("check", 11) +
          "</span>" +
          "<span>" +
          md(text) +
          "</span>";
        b.onclick = function () {
          var nowOn = Store.projTask(pr.id, i);
          b.classList.toggle("is-on", nowOn);
          paintFoot();
        };
        row.appendChild(b);

        if (ch) {
          /* Icon only. Spelling out 43 chapter titles doubled the length of every
             checklist in a three-up grid and made the milestones themselves hard
             to scan — the value here is being able to reach the chapter, not
             reading its name twice. The title survives as the tooltip, the
             accessible name, and the link's own text for a screen reader. */
          var link = el("a", "ckref");
          link.href = "#/chapter/" + ch.id;
          link.innerHTML =
            Icons.get("book", 13) +
            '<span class="u-sr">Read the chapter: ' +
            esc(ch.title) +
            "</span>";
          link.title = "Read: " + ch.title;
          row.appendChild(link);
        }
        cl.appendChild(row);
      });
      node.appendChild(cl);

      var foot = el("div", "proj__foot");
      node.appendChild(foot);

      function paintFoot() {
        var n = Store.projDone(pr.id);
        var pct = (n / pr.tasks.length) * 100;
        foot.innerHTML =
          '<div class="u-between" style="margin-bottom:var(--s-2)">' +
          '<span class="u-eyebrow">Progress</span>' +
          '<span class="u-mono u-dim" style="font-size:var(--t-xs)">' +
          n +
          "/" +
          pr.tasks.length +
          "</span></div>" +
          U.bar(pct) +
          (n === pr.tasks.length
            ? '<div class="chip chip--emerald" style="margin-top:var(--s-3)">' +
              Icons.get("trophy", 12) +
              "Complete</div>"
            : "");
      }
      paintFoot();

      grid.appendChild(node);
    });

    root.appendChild(head);
    root.appendChild(grid);
  };

  /* =========================================================
     FLASHCARD REVIEW
     ========================================================= */

  V.review = function (root) {
    var deck = [];
    var unlocked = 0;
    C.chapters.forEach(function (c) {
      if (!Store.isDone(c.id)) return;
      (c.cards || []).forEach(function (card, i) {
        var id = c.id + ":" + i;
        unlocked++;
        if (Store.cardDue(id)) {
          deck.push({ id: id, f: card.f, b: card.b, ch: c });
        }
      });
    });
    deck = U.shuffle(deck, deck.length * 7 + U.epochDay());

    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Spaced repetition</div><h1>Review deck</h1>' +
      "<p>Cards you get right move to a longer interval; cards you miss come back " +
      "sooner. Five minutes a day beats an hour a week.</p>";
    root.appendChild(head);

    /* Two different empty states. Conflating them is what made the old copy
       ("complete more chapters to add cards") read as a lie to someone who had
       completed nothing and was being shown 167 cards anyway. */
    if (!unlocked) {
      var nx = nextChapter();
      root.appendChild(
        emptyState(
          "No cards unlocked yet",
          "A chapter's flashcards join this deck when you mark it complete — there is " +
            "no point drilling recall on material you haven't read. Finish one chapter " +
            "and come back.",
          nx ? "#/chapter/" + nx.id : "#/roadmap",
          nx ? "Start: " + nx.title : "Back to roadmap"
        )
      );
      return;
    }

    if (!deck.length) {
      root.appendChild(
        emptyState(
          "Nothing due today",
          "All " +
            unlocked +
            " of your unlocked cards are scheduled for a future day — that is the " +
            "system working. Come back tomorrow, or complete another chapter to add " +
            "its cards.",
          "#/roadmap",
          "Back to roadmap"
        )
      );
      return;
    }

    var at = 0;
    var got = 0;
    var stage = el("div", "fcstage");
    var card = el("div", "fcard3d");
    var inner = el("div", "fcard3d__inner");
    card.appendChild(inner);

    var meta = el("div", "fcmeta");
    var ctrl = el("div", "fcctrl");
    var sess = el("div", "fcsess");

    stage.appendChild(sess);
    stage.appendChild(meta);
    stage.appendChild(card);
    stage.appendChild(ctrl);
    root.appendChild(stage);

    function paint() {
      if (at >= deck.length) {
        stage.innerHTML = "";
        var done = el("div", "resume");
        done.style.maxWidth = "560px";
        done.innerHTML =
          '<div class="u-eyebrow">Session complete</div>' +
          "<h2>" +
          got +
          " of " +
          deck.length +
          " recalled</h2>" +
          "<p>Cards you missed will resurface sooner. The ones you got right move " +
          "to a longer interval — that spacing is what makes recall durable.</p>" +
          '<div class="u-row u-wrap">' +
          '<a class="btn btn--primary" href="#/dashboard">' +
          Icons.get("graph", 15) +
          " See progress</a>" +
          '<a class="btn btn--outline" href="#/roadmap">' +
          Icons.get("map", 15) +
          " Roadmap</a></div>";
        stage.appendChild(done);
        return;
      }

      var c = deck[at];
      var st = Store.card(c.id);
      card.classList.remove("is-flipped");
      /* Drives the ghost cards stacked behind this one, so the pile visibly
         thins out as the session runs down. */
      card.dataset.remain = String(Math.min(3, deck.length - at));
      inner.innerHTML =
        '<div class="fcface"><div class="fcface__q">' +
        md(c.f) +
        "</div>" +
        '<div class="fcface__hint">Click, or press Space, to reveal</div></div>' +
        '<div class="fcface fcface--back"><div class="fcface__a">' +
        md(c.b) +
        "</div>" +
        '<div class="fcface__hint">' +
        esc(c.ch.title) +
        "</div></div>";

      sess.innerHTML = U.bar((at / deck.length) * 100, { cls: "bar--thin" });

      /* The source chapter is deliberately not shown until the card is
         flipped — on the front it's a hint, and hints defeat recall practice. */
      meta.innerHTML =
        "<span>Card <b>" +
        (at + 1) +
        "</b> of <b>" +
        deck.length +
        "</b></span>" +
        "<span>Box <b>" +
        st.box +
        "</b>/5</span>" +
        "<span>Recalled <b>" +
        got +
        "</b></span>";

      ctrl.innerHTML = "";
      var flip = el("button", "btn btn--outline");
      flip.innerHTML = Icons.get("eye", 15) + " Reveal answer";
      flip.onclick = reveal;
      ctrl.appendChild(flip);
    }

    function reveal() {
      card.classList.add("is-flipped");
      ctrl.innerHTML = "";
      var no = el("button", "btn btn--outline");
      no.innerHTML = Icons.get("x", 15) + " Didn't know";
      no.onclick = function () {
        grade(false);
      };
      var yes = el("button", "btn btn--primary");
      yes.innerHTML = Icons.get("check", 15) + " Got it";
      yes.onclick = function () {
        grade(true);
      };
      ctrl.appendChild(no);
      ctrl.appendChild(yes);
    }

    function grade(ok) {
      Store.reviewCard(deck[at].id, ok);
      if (ok) got++;
      at++;
      paint();
    }

    card.onclick = function () {
      if (!card.classList.contains("is-flipped")) reveal();
    };

    App.onKey(function (e) {
      if (at >= deck.length) return false;
      if (e.key === " " || e.key === "Enter") {
        if (!card.classList.contains("is-flipped")) reveal();
        return true;
      }
      if (card.classList.contains("is-flipped")) {
        if (e.key === "1" || e.key.toLowerCase() === "n") {
          grade(false);
          return true;
        }
        if (e.key === "2" || e.key.toLowerCase() === "y") {
          grade(true);
          return true;
        }
      }
      return false;
    });

    paint();
  };

  /* =========================================================
     LABS INDEX
     ========================================================= */

  V.labs = function (root) {
    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Hands on</div><h1>Interactive labs</h1>' +
      "<p>Every lab is embedded in its chapter, but they're all here too — " +
      "useful for revisiting one without rereading the chapter around it.</p>";
    root.appendChild(head);

    var ids = Object.keys(Labs).filter(function (k) {
      return typeof Labs[k] === "object" && Labs[k] && Labs[k].render;
    });

    ids.forEach(function (id) {
      var owner = C.chapters.filter(function (c) {
        return c.lab === id;
      })[0];
      var wrap = el("div");
      wrap.style.marginBottom = "var(--s-10)";
      if (owner) {
        var link = el("div", "u-between");
        link.style.marginBottom = "var(--s-3)";
        link.innerHTML =
          '<div class="u-eyebrow">From: ' +
          esc(owner.title) +
          "</div>" +
          '<a class="btn btn--ghost btn--sm" href="#/chapter/' +
          owner.id +
          '">' +
          "Read the chapter " +
          Icons.get("arrowRight", 13) +
          "</a>";
        wrap.appendChild(link);
      }
      Labs.mount(id, wrap);
      root.appendChild(wrap);
    });
  };

  /* =========================================================
     SETTINGS
     ========================================================= */

  V.settings = function (root) {
    var s = Store.state();

    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Preferences</div><h1>Settings</h1>' +
      "<p>Everything is stored in this browser's local storage. Nothing is sent anywhere.</p>";

    var card = el("div", "card card--pad");

    /* theme */
    var themeRow = el("div", "setrow");
    themeRow.innerHTML =
      '<div><div class="setrow__t">Appearance</div>' +
      '<div class="setrow__d">Follow your system setting, or pin one.</div></div>';
    var seg = el("div", "seg");
    [
      ["system", "System"],
      ["dark", "Dark"],
      ["light", "Light"],
    ].forEach(function (o) {
      var b = el("button", (s.theme || "system") === o[0] ? "is-on" : "");
      b.textContent = o[1];
      b.onclick = function () {
        Store.setTheme(o[0] === "system" ? null : o[0]);
        U.qa("button", seg).forEach(function (x) {
          x.classList.remove("is-on");
        });
        b.classList.add("is-on");
      };
      seg.appendChild(b);
    });
    themeRow.appendChild(seg);
    card.appendChild(themeRow);

    /* personalisation */
    var profRow = el("div", "setrow");
    var prof = Store.profile();
    var trk = prof
      ? (C.tracks || []).filter(function (x) {
          return x.id === prof.track;
        })[0]
      : null;
    profRow.innerHTML =
      '<div><div class="setrow__t">Learning profile</div>' +
      '<div class="setrow__d">' +
      (prof
        ? esc(trk ? trk.label : "Custom") +
          " · " +
          U.plural((prof.skills || []).length, "skill") +
          " claimed · " +
          Store.plan().hoursPerWeek +
          " h/week. Drives which chapters are marked skim."
        : "Not set. Without it, every chapter is treated as new material.") +
      "</div></div>";
    var profBtn = el("button", "btn btn--outline btn--sm");
    profBtn.innerHTML = Icons.get("compass", 14) + (prof ? " Edit" : " Set up");
    profBtn.onclick = function () {
      Onboarding.open({
        onDone: function () {
          App.go("#/settings", true);
        },
      });
    };
    profRow.appendChild(profBtn);
    card.appendChild(profRow);

    /* export */
    var expRow = el("div", "setrow");
    expRow.innerHTML =
      '<div><div class="setrow__t">Export progress</div>' +
      '<div class="setrow__d">Download a JSON snapshot — useful for moving to another browser.</div></div>';
    var expBtn = el("button", "btn btn--outline btn--sm");
    expBtn.innerHTML = Icons.get("down", 14) + " Export";
    expBtn.onclick = function () {
      var blob = new Blob([Store.export()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "forge-ai-progress.json";
      a.click();
      URL.revokeObjectURL(a.href);
      Toast.show("Exported", "Saved to your downloads", "win", "check");
    };
    expRow.appendChild(expBtn);
    card.appendChild(expRow);

    /* import */
    var impRow = el("div", "setrow");
    impRow.innerHTML =
      '<div><div class="setrow__t">Import progress</div>' +
      '<div class="setrow__d">Restore from a previously exported file. This replaces your current progress.</div></div>';
    var impBtn = el("button", "btn btn--outline btn--sm");
    impBtn.innerHTML = Icons.get("up", 14) + " Import";
    var file = el("input");
    file.type = "file";
    file.accept = "application/json";
    file.style.display = "none";
    impBtn.onclick = function () {
      file.click();
    };
    file.onchange = function () {
      var f = file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          Store.import(reader.result);
          Toast.show("Imported", "Progress restored", "win", "check");
          App.go("#/dashboard", true);
        } catch (e) {
          Toast.show(
            "Import failed",
            "That file wasn't valid progress data",
            "",
            "alert"
          );
        }
      };
      reader.readAsText(f);
    };
    impRow.appendChild(impBtn);
    impRow.appendChild(file);
    card.appendChild(impRow);

    /* reset */
    var resetRow = el("div", "setrow");
    resetRow.innerHTML =
      '<div><div class="setrow__t">Reset everything</div>' +
      '<div class="setrow__d">Clears completions, quiz scores, flashcard schedules, notes, and XP. This cannot be undone.</div></div>';
    var resetBtn = el("button", "btn btn--outline btn--sm");
    resetBtn.style.color = "var(--rose)";
    resetBtn.style.borderColor =
      "color-mix(in oklab, var(--rose) 34%, transparent)";
    resetBtn.innerHTML = Icons.get("trash", 14) + " Reset";
    resetBtn.onclick = function () {
      App.confirm(
        "Reset all progress?",
        "This clears every completion, quiz score, flashcard schedule, note, and your XP. It cannot be undone — export first if you might want it back.",
        function () {
          Store.reset();
          Toast.show("Progress reset", "Starting fresh", "", "reset");
          App.go("#/dashboard", true);
        }
      );
    };
    resetRow.appendChild(resetBtn);
    card.appendChild(resetRow);

    /* stats */
    var info = el("div", "card card--pad");
    info.style.marginTop = "var(--s-5)";
    var o = overall();
    info.innerHTML =
      '<div class="u-eyebrow" style="margin-bottom:var(--s-4)">Stored data</div>' +
      '<div class="readout">' +
      '<div class="metric"><div class="metric__n">' +
      o.done +
      '</div><div class="metric__l">Chapters done</div></div>' +
      '<div class="metric"><div class="metric__n">' +
      Object.keys(s.cards).length +
      '</div><div class="metric__l">Cards tracked</div></div>' +
      '<div class="metric"><div class="metric__n">' +
      Store.noteCount() +
      '</div><div class="metric__l">Notes</div></div>' +
      '<div class="metric"><div class="metric__n">' +
      U.compact(s.xp) +
      '</div><div class="metric__l">XP</div></div>' +
      "</div>" +
      '<p class="u-faint" style="font-size:var(--t-xs);margin-top:var(--s-4)">Learning since ' +
      esc(s.started) +
      " · approximately " +
      U.compact(new Blob([Store.export()]).size) +
      " bytes in local storage.</p>";

    root.appendChild(head);
    root.appendChild(card);
    root.appendChild(info);
  };

  /* ---------------- shared empty state ---------------- */

  function emptyState(title, text, href, cta) {
    var e = el("div", "empty");
    e.innerHTML =
      '<div class="empty__icon">' +
      Icons.get("compass", 24) +
      "</div>" +
      "<h2>" +
      esc(title) +
      "</h2>" +
      '<p style="max-width:44ch">' +
      esc(text) +
      "</p>" +
      (href
        ? '<a class="btn btn--outline" href="' + href + '">' + esc(cta) + "</a>"
        : "");
    return e;
  }

  V.emptyState = emptyState;

  global.Views = V;
})(window);
