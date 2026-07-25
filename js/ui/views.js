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
    totalMinutes: totalMinutes,
  };

  function phaseVars(p) {
    return "--phase-color: hsl(" + p.hue + " 82% 62%);";
  }

  /* =========================================================
     LANDING
     ========================================================= */

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
      "to “I can ship an AI system and prove it works.” Eight phases, " +
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
      '<div><div class="hstat__n">' +
      C.phases.length +
      '</div><div class="hstat__l">Phases</div></div>' +
      '<div><div class="hstat__n">' +
      C.chapters.length +
      '</div><div class="hstat__l">Chapters</div></div>' +
      '<div><div class="hstat__n">' +
      labCount +
      '</div><div class="hstat__l">Interactive labs</div></div>' +
      '<div><div class="hstat__n">' +
      C.projects.length +
      '</div><div class="hstat__l">Projects</div></div>' +
      '<div><div class="hstat__n">' +
      Math.round(totalMinutes() / 60) +
      'h</div><div class="hstat__l">Reading time</div></div>' +
      "</div></div>" +
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
      "<h2>Eight phases, in a deliberate order</h2>" +
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
        "<div><h4>" +
        esc(p.title) +
        "</h4><p>" +
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
  };

  /* =========================================================
     ROADMAP
     ========================================================= */

  V.roadmap = function (root) {
    var o = overall();
    var next = nextChapter();

    var head = el("div", "page-head");
    head.innerHTML =
      '<div class="u-eyebrow">Learning path</div>' +
      "<h1>The roadmap</h1>" +
      "<p>Forty-one chapters across eight phases. Work top to bottom, or jump to " +
      "what you need — every chapter stands on its own. " +
      "<strong>" +
      o.done +
      " of " +
      o.total +
      "</strong> complete.</p>";

    var legend = el("div", "rm__legend");
    legend.innerHTML =
      '<div class="rmleg"><span class="rmleg__sw rmleg__sw--done"></span>Completed</div>' +
      '<div class="rmleg"><span class="rmleg__sw rmleg__sw--now"></span>Up next</div>' +
      '<div class="rmleg"><span class="rmleg__sw rmleg__sw--next"></span>Not started</div>' +
      '<div class="u-grow"></div>' +
      '<div class="u-row" style="min-width:190px">' +
      '<div class="bar u-grow"><div class="bar__fill" style="width:' +
      o.pct +
      '%"></div></div>' +
      '<span class="u-mono u-dim" style="font-size:var(--t-xs)">' +
      Math.round(o.pct) +
      "%</span></div>";

    var track = el("div", "track");

    C.phases.forEach(function (p) {
      var prog = phaseProgress(p.id);
      var complete = prog.done === prog.total;
      var open =
        Store.phaseOpen(p.id) ||
        (next && next.phase === p.id && !Store.state().open.__touched);

      var node = el("section", "phase" + (open ? " is-open" : ""));
      node.style.cssText = phaseVars(p);

      var headBtn = el("button", "phase__head");
      headBtn.type = "button";
      headBtn.setAttribute("aria-expanded", open ? "true" : "false");
      headBtn.innerHTML =
        '<div class="phase__badge' +
        (complete ? " phase__badge--done" : "") +
        '">' +
        Icons.get(complete ? "check" : p.icon, 22) +
        '<span class="phase__num">' +
        p.n +
        "</span></div>" +
        '<div class="phase__title"><h3>' +
        esc(p.title) +
        "</h3><p>" +
        esc(p.blurb) +
        "</p></div>" +
        '<div class="phase__meta">' +
        '<div class="phase__prog"><div class="bar u-grow"><div class="bar__fill" style="width:' +
        prog.pct +
        '%"></div></div><span class="phase__pct">' +
        prog.done +
        "/" +
        prog.total +
        "</span></div>" +
        '<div class="phase__caret">' +
        Icons.get("chevDown", 18) +
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
          "chnode" + (done ? " is-done" : "") + (isNext ? " is-current" : ""),
        );
        a.href = "#/chapter/" + ch.id;
        var d = DIFF[ch.difficulty] || DIFF.intermediate;
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
      node.appendChild(headBtn);
      node.appendChild(bodyWrap);
      track.appendChild(node);

      headBtn.onclick = function () {
        var isOpen = node.classList.toggle("is-open");
        headBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        Store.phaseOpen(p.id, isOpen);
        Store.state().open.__touched = true;
        Store.save();
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
          "Back to roadmap",
        ),
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
      '<a class="chip chip--accent" href="#/roadmap" style="--accent:hsl(' +
      p.hue +
      ' 82% 62%)">' +
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
        "<h4>By the end of this chapter you can</h4><ul>" +
        ch.objectives
          .map(function (o) {
            return "<li>" + md(o) + "</li>";
          })
          .join("") +
        "</ul>";
      main.appendChild(ob);
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
        "btn " + (isDone ? "btn--outline" : "btn--primary"),
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
            "checkCircle",
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
      "<h4>On this page</h4><ul>" +
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
      "<h4>Your notes</h4>" +
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
      }, 500),
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
     DASHBOARD
     ========================================================= */

  V.dashboard = function (root) {
    var s = Store.state();
    var o = overall();
    var lvl = Store.level();
    var next = nextChapter();
    var cards = Store.cardStats(allCardIds());

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
      '<div class="bar bar--tall" style="max-width:420px;margin-top:var(--s-4)">' +
      '<div class="bar__fill" style="width:' +
      lvl.pct +
      '%"></div></div>';

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
        (quizTotal ? Math.round((quizRight / quizTotal) * 100) : 0) +
          "<small>%</small>",
        "target",
        quizzed + " of " + o.total + " quizzes taken",
      ],
      [
        "Cards learned",
        cards.learned + "<small>/" + cards.total + "</small>",
        "cards",
        cards.due + " due for review",
      ],
      [
        "Reading done",
        U.hours(minsDone),
        "clock",
        U.hours(totalMinutes() - minsDone) + " remaining",
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
        "<h3>" +
        esc(next.title) +
        "</h3>" +
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
        '<div class="u-eyebrow">Complete</div><h3>All 41 chapters done</h3>' +
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
        '<span class="bar bar--thin" style="margin-top:5px"><span class="bar__fill" style="width:' +
        prog.pct +
        '%"></span></span></span>' +
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
          emptyState("Nothing matches", "Try a different filter.", null, null),
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
          '<span class="chip" style="color:hsl(' +
          p.hue +
          " 82% 62%);background:hsl(" +
          p.hue +
          ' 82% 62% / .13);border-color:transparent">' +
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
          "<h3>" +
          esc(c.title) +
          "</h3><p>" +
          esc(c.subtitle) +
          "</p>" +
          '<div class="libcard__foot">' +
          "<span>" +
          Icons.get("clock", 12) +
          " " +
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
      }, 140),
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
          emptyState("No terms match", "Try a different search.", null, null),
        );
        return;
      }
      list.forEach(function (g) {
        var c = el("div", "gterm");
        c.innerHTML =
          '<div class="gterm__h"><h3>' +
          esc(g.t) +
          "</h3></div>" +
          "<p>" +
          md(g.d) +
          "</p>" +
          (g.n ? "<p>" + Icons.get("bulb", 12) + " " + md(g.n) + "</p>" : "");
        grid.appendChild(c);
      });
    }

    input.addEventListener(
      "input",
      U.debounce(function () {
        q = input.value.toLowerCase();
        paint();
      }, 140),
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
      "<p>Six projects, ordered by difficulty. Do at least three — the " +
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
        "<h3>" +
        esc(pr.title) +
        "</h3>" +
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

      var cl = el("div", "checklist");
      pr.tasks.forEach(function (t, i) {
        var on = !!(Store.state().projects[pr.id] || {})[i];
        var b = el("button", "ckitem" + (on ? " is-on" : ""));
        b.type = "button";
        b.innerHTML =
          '<span class="ckitem__box">' +
          Icons.get("check", 11) +
          "</span>" +
          "<span>" +
          md(t) +
          "</span>";
        b.onclick = function () {
          var nowOn = Store.projTask(pr.id, i);
          b.classList.toggle("is-on", nowOn);
          paintFoot();
        };
        cl.appendChild(b);
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
          '<div class="bar"><div class="bar__fill" style="width:' +
          pct +
          '%"></div></div>' +
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
    C.chapters.forEach(function (c) {
      (c.cards || []).forEach(function (card, i) {
        var id = c.id + ":" + i;
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

    if (!deck.length) {
      root.appendChild(
        emptyState(
          "Nothing due right now",
          "Every card is scheduled for a future day. Complete more chapters to add cards, or come back tomorrow.",
          "#/roadmap",
          "Back to roadmap",
        ),
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
          "<h3>" +
          got +
          " of " +
          deck.length +
          " recalled</h3>" +
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
        "</b></span>" +
        "<span>" +
        esc(c.ch.title) +
        "</span>";

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
            "alert",
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
        },
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
      "<h3>" +
      esc(title) +
      "</h3>" +
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
