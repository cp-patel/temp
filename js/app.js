/* ============================================================
   App shell: router, sidebar, command palette, toasts
   ============================================================ */
(function (global) {
  "use strict";

  var el = U.el;
  var esc = U.esc;
  var C = global.Curriculum;

  var App = {};
  var routeStatus = null;
  var scrollHandlers = [];

  /* Where the reader had got to, per route. Chapters run 20 to 60 minutes, so
     following a link out and pressing Back used to cost you your place: render()
     scrolled to the top unconditionally and the browser cannot restore a position
     it never recorded for a hash route. Only restored for a history navigation —
     clicking a link to a chapter should start it at the beginning. */
  var scrollFor = {};
  var fromHistory = false;
  var keyHandlers = [];
  var leaveHandlers = [];

  /* =========================================================
     Toasts
     ========================================================= */

  var Toast = {};
  var toastHost;

  var MAX_TOASTS = 3;

  function dropToast(t) {
    if (!t || t.dataset.going) return;
    t.dataset.going = "1";
    t.classList.add("is-out");
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 240);
  }

  Toast.show = function (title, sub, kind, icon) {
    if (!toastHost) return;
    var t = el("div", "toast" + (kind ? " toast--" + kind : ""));
    t.innerHTML =
      '<div class="toast__icon">' +
      Icons.get(icon || "info", 16) +
      "</div>" +
      '<div><div class="toast__t">' +
      esc(title) +
      "</div>" +
      (sub ? '<div class="toast__s">' + esc(sub) + "</div>" : "") +
      "</div>";
    toastHost.appendChild(t);

    // A burst of awards (completing several chapters quickly, or a scripted
    // run) would otherwise stack toasts down the whole viewport. Retire the
    // oldest so at most MAX_TOASTS are ever on screen.
    var live = U.qa(".toast", toastHost).filter(function (n) {
      return !n.dataset.going;
    });
    while (live.length > MAX_TOASTS) dropToast(live.shift());

    setTimeout(function () {
      dropToast(t);
    }, 3200);
  };

  global.Toast = Toast;

  /* =========================================================
     Modal confirm
     ========================================================= */

  App.confirm = function (title, text, onYes) {
    var m = el("div", "modal");
    m.innerHTML =
      '<div class="modal__box"><h3>' +
      esc(title) +
      "</h3><p>" +
      esc(text) +
      "</p>" +
      '<div class="modal__actions">' +
      '<button class="btn btn--ghost" data-a="no">Cancel</button>' +
      '<button class="btn btn--primary" data-a="yes">Confirm</button></div></div>';
    document.body.appendChild(m);
    var box = m.querySelector(".modal__box");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", title);
    var release = null;
    function close() {
      if (release) release();
      if (m.parentNode) m.parentNode.removeChild(m);
    }
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.dataset.a === "no") close();
      if (e.target.dataset.a === "yes") {
        close();
        onYes();
      }
    });
    /* Escape cancels — the safe half of a destructive prompt, and the behaviour
       every other dialog in the app now has. */
    release = U.trap(box, close);
  };

  /* =========================================================
     Sidebar
     ========================================================= */

  var NAV = [
    { href: "#/dashboard", icon: "home", label: "Dashboard" },
    { href: "#/plan", icon: "compass", label: "My plan" },
    { href: "#/roadmap", icon: "map", label: "Roadmap" },
    { href: "#/readiness", icon: "gauge", label: "Readiness" },
    { href: "#/library", icon: "grid", label: "Library" },
    { href: "#/labs", icon: "beaker", label: "Labs" },
    { href: "#/review", icon: "cards", label: "Review" },
    { href: "#/interview", icon: "chat", label: "Interview" },
    { href: "#/projects", icon: "hammer", label: "Projects" },
    { href: "#/glossary", icon: "book", label: "Glossary" },
    { href: "#/settings", icon: "settings", label: "Settings" },
  ];

  function buildSidebar() {
    var side = el("aside", "sidebar");
    side.id = "sidebar";

    var brand = el("a", "brand");
    brand.href = "#/dashboard";
    brand.innerHTML =
      '<span class="brand__mark">' +
      Icons.get("bolt", 19) +
      "</span>" +
      '<span><span class="brand__name">Forge</span>' +
      '<span class="brand__sub">AI Engineering</span></span>';
    side.appendChild(brand);

    var searchWrap = el("div", "sidebar__search");
    var sb = el("button", "searchbtn");
    sb.type = "button";
    sb.innerHTML =
      Icons.get("search", 15) + "<span>Search…</span><kbd>⌘K</kbd>";
    sb.onclick = function () {
      Palette.open();
    };
    searchWrap.appendChild(sb);
    side.appendChild(searchWrap);

    var scroll = el("div", "sidebar__scroll");

    var g1 = el("nav", "navgroup");
    g1.setAttribute("aria-label", "Main navigation");
    NAV.forEach(function (n) {
      var a = el("a", "navlink");
      a.href = n.href;
      a.dataset.nav = n.href;
      var count = "";
      if (n.href === "#/review") {
        var st = Store.cardStats(Views.helpers.unlockedCardIds());
        if (st.due)
          count = '<span class="navlink__count">' + st.due + "</span>";
      }
      a.innerHTML =
        Icons.get(n.icon, 16) + "<span>" + esc(n.label) + "</span>" + count;
      g1.appendChild(a);
    });
    scroll.appendChild(g1);

    var g2 = el("div", "navgroup");
    g2.innerHTML = '<div class="navgroup__label">Phases</div>';
    C.phases.forEach(function (p) {
      var prog = Views.helpers.phaseProgress(p.id);
      var a = el("a", "phaselink" + (prog.pct === 100 ? " is-done" : ""));
      a.href = "#/roadmap";
      a.dataset.phase = p.id;
      a.title = p.title;
      a.innerHTML =
        '<span class="phaselink__idx">' +
        p.n +
        "</span>" +
        '<span class="u-truncate u-grow">' +
        esc(p.title.split("—")[0].trim()) +
        "</span>" +
        U.bar(prog.pct, { cls: "phaselink__bar bar--thin", inline: true });
      g2.appendChild(a);
    });
    scroll.appendChild(g2);
    side.appendChild(scroll);

    var foot = el("div", "sidebar__foot");
    var s = Store.state();
    var o = Views.helpers.overall();
    foot.innerHTML =
      '<div class="streak">' +
      '<span class="streak__flame">' +
      Icons.get("flame", 16) +
      "</span>" +
      '<span class="u-grow"><span class="streak__n">' +
      U.plural(s.streak.n, "day") +
      " streak</span>" +
      '<span class="streak__lbl">' +
      o.done +
      "/" +
      o.total +
      " chapters · " +
      U.compact(s.xp) +
      " XP</span></span></div>";
    side.appendChild(foot);

    return side;
  }

  function refreshSidebar() {
    var old = U.q("#sidebar");
    if (!old) return;
    var fresh = buildSidebar();
    old.parentNode.replaceChild(fresh, old);
    markActive();
  }

  function markActive() {
    var h = location.hash || "#/";
    U.qa("[data-nav]").forEach(function (a) {
      var match =
        a.dataset.nav === h ||
        (a.dataset.nav === "#/roadmap" && h.indexOf("#/chapter/") === 0);
      a.classList.toggle("is-active", match);
    });
    var chId = h.indexOf("#/chapter/") === 0 ? h.slice(10) : null;
    var ch = chId ? Views.helpers.chapter(chId) : null;
    U.qa("[data-phase]").forEach(function (a) {
      a.classList.toggle("is-active", !!ch && a.dataset.phase === ch.phase);
    });
  }

  /* =========================================================
     Topbar
     ========================================================= */

  function buildTopbar() {
    var bar = el("header", "topbar");
    bar.id = "topbar";

    var menu = el("button", "btn btn--icon topbar__menu");
    menu.setAttribute("aria-label", "Toggle navigation");
    menu.innerHTML = Icons.get("menu", 18);
    menu.onclick = function () {
      document.body.classList.toggle("nav-open");
      toggleScrim();
    };
    bar.appendChild(menu);

    var crumbs = el("nav", "crumbs");
    crumbs.id = "crumbs";
    bar.appendChild(crumbs);

    var right = el("div", "topbar__right");

    var xp = el("div", "xp");
    xp.id = "xpchip";
    right.appendChild(xp);

    var theme = el("button", "btn btn--icon");
    theme.setAttribute("aria-label", "Toggle theme");
    theme.id = "themebtn";
    theme.onclick = function () {
      Store.setTheme(Store.theme() === "dark" ? "light" : "dark");
      paintTheme();
    };
    right.appendChild(theme);

    var search = el("button", "btn btn--icon");
    search.setAttribute("aria-label", "Search");
    search.innerHTML = Icons.get("search", 17);
    search.onclick = function () {
      Palette.open();
    };
    right.appendChild(search);

    bar.appendChild(right);
    return bar;
  }

  /* The single place that reflects the stored theme preference into the
     document. The store deliberately does not touch the DOM, so any code path
     that changes the preference must end up here. */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", Store.theme());
    var b = U.q("#themebtn");
    if (b)
      b.innerHTML = Icons.get(Store.theme() === "dark" ? "sun" : "moon", 17);
  }

  var paintTheme = applyTheme;

  function paintXp() {
    var n = U.q("#xpchip");
    if (!n) return;
    var lvl = Store.level();
    n.innerHTML =
      Icons.get("spark", 14) +
      "<span>" +
      U.compact(Store.state().xp) +
      " XP</span>";
    n.title =
      lvl.name +
      (lvl.next
        ? " · " + (lvl.next - Store.state().xp) + " XP to next level"
        : "");
  }

  function paintCrumbs(route) {
    var n = U.q("#crumbs");
    if (!n) return;
    var parts = [];
    parts.push('<a href="#/dashboard" class="crumbs__hide">Forge</a>');

    if (route.name === "chapter") {
      var ch = Views.helpers.chapter(route.arg);
      if (ch) {
        var p = Views.helpers.phase(ch.phase);
        parts.push('<span class="crumbs__sep crumbs__hide">/</span>');
        parts.push(
          '<a href="#/roadmap" class="crumbs__hide">' +
            esc(p.n + " " + p.title.split("—")[0].trim()) +
            "</a>"
        );
        parts.push('<span class="crumbs__sep">/</span>');
        parts.push('<span class="crumbs__now">' + esc(ch.title) + "</span>");
      }
    } else {
      var titles = {
        dashboard: "Dashboard",
        plan: "My plan",
        roadmap: "Roadmap",
        readiness: "Readiness",
        library: "Library",
        labs: "Labs",
        review: "Review",
        interview: "Interview drills",
        projects: "Projects",
        glossary: "Glossary",
        settings: "Settings",
      };
      parts.push('<span class="crumbs__sep">/</span>');
      parts.push(
        '<span class="crumbs__now">' +
          esc(titles[route.name] || "Forge") +
          "</span>"
      );
    }
    n.innerHTML = parts.join("");
  }

  function toggleScrim() {
    var scrim = U.q("#scrim");
    if (!scrim) return;
    scrim.hidden = !document.body.classList.contains("nav-open");
  }

  /* =========================================================
     Command palette
     ========================================================= */

  var Palette = {};
  var palNode,
    palInput,
    palResults,
    palItems = [],
    palCursor = 0;

  function buildPalette() {
    var p = el("div", "palette");
    p.id = "palette";
    p.hidden = true;
    p.innerHTML =
      '<div class="palette__box" role="dialog" aria-modal="true" ' +
      'aria-label="Search">' +
      '<div class="palette__input">' +
      Icons.get("search", 17) +
      '<input type="text" placeholder="Search chapters, labs, glossary, commands…" aria-label="Search">' +
      "</div>" +
      '<div class="palette__results"></div>' +
      '<div class="palette__foot">' +
      "<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>" +
      "<span><kbd>↵</kbd> open</span>" +
      "<span><kbd>esc</kbd> close</span>" +
      '<span class="u-grow"></span>' +
      "<span>" +
      C.chapters.length +
      " chapters · " +
      C.glossary.length +
      " terms</span>" +
      "</div></div>";
    palNode = p;
    palInput = p.querySelector("input");
    palResults = p.querySelector(".palette__results");

    p.addEventListener("click", function (e) {
      if (e.target === p) Palette.close();
    });
    palInput.addEventListener("input", function () {
      search(palInput.value);
    });
    palInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveCursor(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveCursor(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (palItems[palCursor]) {
          Palette.close();
          palItems[palCursor].run();
        }
      } else if (e.key === "Escape") {
        Palette.close();
      }
    });
    return p;
  }

  var palRelease = null;

  Palette.open = function () {
    palNode.hidden = false;
    palInput.value = "";
    search("");
    /* Escape is handled on the input already; the trap adds the two halves that
       were missing — Tab cannot wander onto the page behind the scrim, and
       closing puts focus back on whatever opened it instead of on <body>. */
    palRelease = U.trap(palNode.querySelector(".palette__box"), Palette.close);
    palInput.focus();
  };

  Palette.close = function () {
    palNode.hidden = true;
    palInput.blur();
    if (palRelease) {
      palRelease();
      palRelease = null;
    }
  };

  function moveCursor(d) {
    if (!palItems.length) return;
    palCursor = (palCursor + d + palItems.length) % palItems.length;
    U.qa(".presult", palResults).forEach(function (n, i) {
      n.classList.toggle("is-cursor", i === palCursor);
      if (i === palCursor && n.scrollIntoView) {
        n.scrollIntoView({ block: "nearest" });
      }
    });
  }

  var COMMANDS = [
    { t: "Go to dashboard", icon: "home", go: "#/dashboard" },
    { t: "Open my personalised plan", icon: "compass", go: "#/plan" },
    { t: "Open the roadmap", icon: "map", go: "#/roadmap" },
    { t: "Check my interview readiness", icon: "gauge", go: "#/readiness" },
    { t: "Rehearse interview questions", icon: "chat", go: "#/interview" },
    /* The library had no command either — it is reachable from the sidebar, but
       the palette is meant to be the complete index of where you can go. */
    { t: "Browse the chapter library", icon: "grid", go: "#/library" },
    { t: "Browse all labs", icon: "beaker", go: "#/labs" },
    { t: "Review flashcards", icon: "cards", go: "#/review" },
    { t: "Open projects", icon: "hammer", go: "#/projects" },
    { t: "Open glossary", icon: "book", go: "#/glossary" },
    { t: "Settings", icon: "settings", go: "#/settings" },
    {
      t: "Toggle light / dark theme",
      icon: "moon",
      run: function () {
        Store.setTheme(Store.theme() === "dark" ? "light" : "dark");
        paintTheme();
      },
    },
    {
      t: "Continue where I left off",
      icon: "play",
      run: function () {
        var n = Views.helpers.nextChapter();
        App.go(n ? "#/chapter/" + n.id : "#/projects");
      },
    },
    /* Twenty-five minutes is the modal session and the dashboard already answers
       it; this is the shortcut for someone who came to the palette first. */
    {
      t: "Plan a session — what fits in 25 minutes",
      icon: "clock",
      go: "#/dashboard",
    },
    /* "Continue" follows the curriculum order; this follows the diagnostic, which
       is a different question and sometimes a different answer — it will send you
       to a project milestone over the next unread chapter once the reading is
       ahead of the building. */
    {
      t: "Do the highest-value thing next",
      icon: "target",
      run: function () {
        var a = (C.readinessActions(Store.signals(), 1) || [])[0];
        App.go(a ? a.href : "#/readiness");
      },
    },
  ];

  function score(hay, needle) {
    hay = hay.toLowerCase();
    var i = hay.indexOf(needle);
    if (i === -1) return 0;
    return 100 - i - (hay.length - needle.length) * 0.1;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    palItems = [];
    palCursor = 0;
    palResults.innerHTML = "";

    function addGroup(label, entries) {
      if (!entries.length) return;
      palResults.appendChild(el("div", "palette__group", esc(label)));
      entries.forEach(function (e) {
        var b = el("button", "presult");
        b.type = "button";
        b.innerHTML =
          '<span class="presult__icon">' +
          Icons.get(e.icon, 15) +
          "</span>" +
          '<span class="u-grow" style="min-width:0"><span class="presult__t">' +
          esc(e.t) +
          "</span>" +
          (e.s ? '<span class="presult__s">' + esc(e.s) + "</span>" : "") +
          "</span>" +
          (e.meta ? '<span class="presult__meta">' + e.meta + "</span>" : "");
        b.onclick = function () {
          Palette.close();
          e.run();
        };
        var idx = palItems.length;
        b.addEventListener("mouseenter", function () {
          palCursor = idx;
          U.qa(".presult", palResults).forEach(function (n, i) {
            n.classList.toggle("is-cursor", i === idx);
          });
        });
        palItems.push(e);
        palResults.appendChild(b);
      });
    }

    // chapters
    var chapters = C.chapters
      .map(function (c) {
        var sc = q
          ? Math.max(
              score(c.title, q) * 2,
              score(c.subtitle, q),
              score((c.tags || []).join(" "), q)
            )
          : 1;
        return { c: c, sc: sc };
      })
      .filter(function (x) {
        return x.sc > 0;
      })
      .sort(function (a, b) {
        return b.sc - a.sc;
      })
      .slice(0, q ? 7 : 5)
      .map(function (x) {
        var p = Views.helpers.phase(x.c.phase);
        return {
          t: x.c.title,
          s: x.c.subtitle,
          icon: Store.isDone(x.c.id) ? "checkCircle" : p.icon,
          meta: '<span class="chip">' + p.n + "</span>",
          run: function () {
            App.go("#/chapter/" + x.c.id);
          },
        };
      });

    // commands
    var cmds = COMMANDS.filter(function (c) {
      return !q || score(c.t, q) > 0;
    })
      .slice(0, q ? 4 : 9)
      .map(function (c) {
        return {
          t: c.t,
          icon: c.icon,
          run:
            c.run ||
            function () {
              App.go(c.go);
            },
        };
      });

    // glossary
    var terms = q
      ? C.glossary
          .filter(function (g) {
            return score(g.t, q) > 0 || g.d.toLowerCase().indexOf(q) !== -1;
          })
          .slice(0, 5)
          .map(function (g) {
            return {
              t: g.t,
              s: g.d,
              icon: "book",
              run: function () {
                App.go("#/glossary");
                setTimeout(function () {
                  var f = U.q(".searchfield input");
                  if (f) {
                    f.value = g.t;
                    f.dispatchEvent(new Event("input"));
                  }
                }, 60);
              },
            };
          })
      : [];

    // labs
    var labs = q
      ? Object.keys(Labs)
          .filter(function (k) {
            return (
              typeof Labs[k] === "object" &&
              Labs[k] &&
              Labs[k].render &&
              (score(Labs[k].title, q) > 0 || score(k, q) > 0)
            );
          })
          .slice(0, 4)
          .map(function (k) {
            return {
              t: Labs[k].title,
              s: Labs[k].sub,
              icon: Labs[k].icon || "beaker",
              run: function () {
                App.go("#/labs");
              },
            };
          })
      : [];

    addGroup(q ? "Chapters" : "Jump back in", chapters);
    addGroup("Labs", labs);
    addGroup("Glossary", terms);
    addGroup(q ? "Commands" : "Actions", cmds);

    if (!palItems.length) {
      palResults.innerHTML =
        '<div class="empty" style="padding:var(--s-10) var(--s-5)">' +
        '<div class="empty__icon">' +
        Icons.get("search", 22) +
        "</div>" +
        "<h3>No matches</h3><p>Try a different search.</p></div>";
      return;
    }
    moveCursor(0);
  }

  /* =========================================================
     Router
     ========================================================= */

  var ROUTES = {
    "": { name: "landing", render: Views.landing },
    "/": { name: "landing", render: Views.landing },
    "/dashboard": { name: "dashboard", render: Views.dashboard },
    "/plan": { name: "plan", render: Views.plan },
    "/roadmap": { name: "roadmap", render: Views.roadmap },
    "/readiness": { name: "readiness", render: Views.readiness },
    "/library": { name: "library", render: Views.library },
    "/labs": { name: "labs", render: Views.labs },
    "/review": { name: "review", render: Views.review },
    "/interview": { name: "interview", render: Views.interview },
    "/projects": { name: "projects", render: Views.projects },
    "/glossary": { name: "glossary", render: Views.glossary },
    "/settings": { name: "settings", render: Views.settings },
  };

  /* The hash of every top-level route, deduplicated and in sidebar order.
     Exposed because the e2e suite kept three hand-written copies of this list and
     a new route was covered by none of them — the readiness page shipped with no
     entry in the route sweep, the accessibility sweep, or the contrast sweep,
     because all three were literals someone had to remember to edit. */
  App.routes = function () {
    var seen = {};
    var out = [];
    Object.keys(ROUTES).forEach(function (h) {
      var name = ROUTES[h].name;
      if (seen[name]) return;
      seen[name] = true;
      out.push(h === "" || h === "/" ? "" : "#" + h);
    });
    return out;
  };

  function parse() {
    var h = (location.hash || "").replace(/^#/, "");
    if (h.indexOf("/chapter/") === 0) {
      return { name: "chapter", arg: h.slice(9), render: Views.chapter };
    }
    var r = ROUTES[h];
    if (r) return { name: r.name, render: r.render };
    return { name: "landing", render: Views.landing };
  }

  /* Which children of each view get the staggered scroll reveal. Chosen per
     view so the stagger follows reading order rather than DOM accident. */
  var REVEAL = {
    landing: ".hero__inner > *, .lsection, .lfoot",
    dashboard: ".page-head, .dgrid > *, .dcols > div > *",
    plan: ".planhero, .modelegend, .week",
    roadmap: ".page-head, .rm__legend, .phase",
    readiness:
      ".page-head, .rdhero, .rdscale, .rdnext, .sec-head, .rdrow, .rdfoot",
    /* Not .drill: the card is replaced on every rating and every skip, and a
       reveal animation on each replacement reads as a page flicker rather than an
       entrance. */
    interview: ".page-head, .drillpick",
    library: ".page-head, .filters, .libcard",
    labs: ".page-head, .lab",
    projects: ".page-head, .proj",
    glossary: ".page-head, .searchfield, .alpha, .gterm",
    settings: ".page-head, .card",
    chapter: null,
  };

  var mainHost;

  function render() {
    var route = parse();

    // clear per-view handlers
    leaveHandlers.forEach(function (f) {
      try {
        f();
      } catch (e) {}
    });
    leaveHandlers = [];
    scrollHandlers = [];
    keyHandlers = [];

    document.body.classList.remove("is-landing", "nav-open");
    toggleScrim();

    var isLanding = route.name === "landing";
    if (isLanding) document.body.classList.add("is-landing");

    mainHost.innerHTML = "";
    var page = el("div", "page" + (route.name === "roadmap" ? "" : ""));
    if (isLanding) page.className = "";
    mainHost.appendChild(page);

    try {
      route.render(page, route.arg);
    } catch (e) {
      page.className = "page";
      page.innerHTML = "";
      page.appendChild(
        Views.emptyState(
          "Something went wrong rendering this page",
          e.message,
          "#/roadmap",
          "Back to roadmap"
        )
      );
      if (global.console) console.error(e);
    }

    markActive();
    paintCrumbs(route);
    paintXp();
    paintTheme();

    // Per-view motion: animate progress from zero, run any counters, and
    // reveal the view's top-level blocks in reading order.
    if (global.Motion) {
      Motion.reset();
      Motion.enterView(page, { reveal: REVEAL[route.name], step: 55 });
    }

    /* The table of contents scrolls in place rather than changing the hash, so the
       router never sees a section anchor and this is a plain choice: resume where
       they were, or start at the top. */
    var resume = fromHistory ? scrollFor[location.hash] : null;
    fromHistory = false;
    if (resume) {
      // After the view is in the document, or there is nothing to scroll through.
      requestAnimationFrame(function () {
        window.scrollTo(0, resume);
      });
    } else {
      window.scrollTo(0, 0);
    }
    document.title =
      (route.name === "chapter" && Views.helpers.chapter(route.arg)
        ? Views.helpers.chapter(route.arg).title + " · "
        : route.name !== "landing"
          ? route.name.charAt(0).toUpperCase() + route.name.slice(1) + " · "
          : "") + "Forge — AI Engineering Academy";

    /* Announce the new page. A hash router replaces the entire document body
       without a page load, so to a screen reader nothing happened — you activate
       "Roadmap" and hear silence. A polite status region says what you landed on
       without stealing focus, which is what the WAI guidance prefers for
       navigation inside a single-page app. Read from the rendered h1 rather than
       the route name so it matches what a sighted user sees.

       The clear-then-set is not superstition: setting identical text does not
       re-fire the announcement, and returning to a page you were already on
       otherwise says nothing at all. */
    maybeOfferOnboarding(route.name);

    if (routeStatus) {
      var h1 = page.querySelector("h1");
      var label = h1 ? h1.textContent.trim() : "Forge";
      routeStatus.textContent = "";
      setTimeout(function () {
        routeStatus.textContent = label;
      }, 120);
    }
  }

  /* Offer to personalise on the surfaces where planning is the point, and not on
     a page someone was linked to.
     
     A shared link to Hybrid Search & Reranking used to render the chapter and
     then cover it, 650ms later, with a four-question survey — with focus trapped
     inside it, so Tab could not even reach the text behind. That reader came to
     read one page; the roadmap will still be there when they want it, and the
     offer arrives the moment they go looking. */
  /* Not the landing page. It is the one screen whose job is to tell a stranger
     what this is, and the scrim is dark enough that opening a survey over it
     replaces the pitch rather than sitting on top of it — the same mistake as
     covering a shared chapter link, just less obvious because there is seemingly
     nothing to lose. Its own "Open the roadmap" button leads somewhere that does
     offer, so the sequence works out: read the pitch, then get asked. */
  var PLANNING_ROUTES = {
    dashboard: true,
    plan: true,
    roadmap: true,
  };
  var offered = false;

  function maybeOfferOnboarding(routeName) {
    if (offered || !PLANNING_ROUTES[routeName]) return;
    if (Store.isOnboarded() || !global.Onboarding) return;
    offered = true;
    setTimeout(function () {
      // Re-check at fire time: the profile may have been set in the interim
      // (imported progress, another tab, a direct visit to /plan).
      if (Store.isOnboarded()) return;
      Onboarding.open({
        onDone: function (saved) {
          refreshSidebar();
          if (saved) App.go("#/plan");
        },
      });
    }, 650);
  }

  App.go = function (hash, force) {
    if (location.hash === hash && force) render();
    else location.hash = hash;
  };

  App.onScroll = function (fn) {
    scrollHandlers.push(fn);
  };
  App.onKey = function (fn) {
    keyHandlers.push(fn);
  };
  App.onLeave = function (fn) {
    leaveHandlers.push(fn);
  };

  /* =========================================================
     Boot
     ========================================================= */

  function boot() {
    document.documentElement.setAttribute("data-theme", Store.theme());

    // Atmospheric layers, back to front: aurora wash, faint grid, film grain.
    var aurora = el("div", "aurora");
    aurora.innerHTML =
      '<div class="aurora__band aurora__band--1"></div>' +
      '<div class="aurora__band aurora__band--2"></div>' +
      '<div class="aurora__band aurora__band--3"></div>' +
      '<div class="aurora__band aurora__band--4"></div>';
    document.body.appendChild(aurora);

    var ambient = el("div", "ambient");
    ambient.innerHTML = '<div class="ambient__grid"></div>';
    document.body.appendChild(ambient);

    document.body.appendChild(el("div", "grain"));

    /* WCAG 2.4.1 Bypass Blocks. Nine nav links, eight phase links, a brand and a
       search button sit before the content on every page — 24 tab stops to reach
       the first paragraph of a chapter. This is the first focusable thing in the
       document and gets you there in one. */
    var skip = el("a", "skiplink", "Skip to content");
    skip.href = "#main";
    skip.onclick = function (e) {
      e.preventDefault();
      var host = document.getElementById("main");
      if (!host) return;
      host.focus();
      host.scrollIntoView({ block: "start" });
    };
    document.body.appendChild(skip);

    var app = el("div", "app");
    app.appendChild(buildSidebar());

    var main = el("div", "main");
    main.appendChild(buildTopbar());
    mainHost = el("div", "u-grow");
    mainHost.id = "main";
    /* -1 so it is not a tab stop of its own, but can still receive focus from the
       skip link — which is what makes the next Tab continue from the content. */
    mainHost.tabIndex = -1;
    mainHost.setAttribute("role", "main");
    mainHost.style.display = "flex";
    mainHost.style.flexDirection = "column";
    main.appendChild(mainHost);
    app.appendChild(main);
    document.body.appendChild(app);

    var scrim = el("div", "scrim");
    scrim.id = "scrim";
    scrim.hidden = true;
    scrim.onclick = function () {
      document.body.classList.remove("nav-open");
      toggleScrim();
    };
    document.body.appendChild(scrim);

    document.body.appendChild(buildPalette());

    toastHost = el("div", "toasts");
    toastHost.setAttribute("aria-live", "polite");
    document.body.appendChild(toastHost);

    routeStatus = el("div", "u-sr");
    routeStatus.setAttribute("role", "status");
    routeStatus.setAttribute("aria-live", "polite");
    document.body.appendChild(routeStatus);

    /* global listeners */
    if (window.history && "scrollRestoration" in window.history) {
      // Ours to do: the browser's own attempt fights the router's re-render.
      window.history.scrollRestoration = "manual";
    }
    window.addEventListener("popstate", function () {
      fromHistory = true;
    });
    window.addEventListener("hashchange", render);

    window.addEventListener(
      "scroll",
      function () {
        scrollFor[location.hash] = window.scrollY;
        scrollHandlers.forEach(function (f) {
          f();
        });
      },
      { passive: true }
    );

    document.addEventListener("keydown", function (e) {
      // palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        palNode.hidden ? Palette.open() : Palette.close();
        return;
      }
      if (e.key === "Escape" && !palNode.hidden) {
        Palette.close();
        return;
      }

      var typing =
        e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        Palette.open();
        return;
      }

      // view-specific
      for (var i = 0; i < keyHandlers.length; i++) {
        if (keyHandlers[i](e)) {
          e.preventDefault();
          return;
        }
      }

      // chapter nav with j/k
      var r = parse();
      if (r.name === "chapter") {
        var ch = Views.helpers.chapter(r.arg);
        var idx = C.chapters.indexOf(ch);
        if (e.key === "j" && C.chapters[idx + 1]) {
          App.go("#/chapter/" + C.chapters[idx + 1].id);
        } else if (e.key === "k" && C.chapters[idx - 1]) {
          App.go("#/chapter/" + C.chapters[idx - 1].id);
        }
      }
    });

    Store.subscribe(function () {
      paintXp();
      applyTheme();
    });

    // refresh sidebar counters when progress changes (debounced)
    var refresh = U.debounce(refreshSidebar, 400);
    Store.subscribe(refresh);

    // system theme changes
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: light)");
      var onMq = function () {
        if (!Store.state().theme) {
          document.documentElement.setAttribute("data-theme", Store.theme());
          paintTheme();
        }
      };
      if (mq.addEventListener) mq.addEventListener("change", onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }

    render();

    /* Say it once if nothing can be saved. The app works fine in memory, and that
       is exactly why this needs saying: the failure is invisible until the tab
       closes and a session's work goes with it. Worth interrupting for, because
       the mitigation — export from Settings — has to happen before the loss. */
    if (!Store.persists()) {
      setTimeout(function () {
        Toast.show(
          "Progress won't be saved",
          "This browser is blocking local storage. Export from Settings to keep it.",
          "warn",
          "alert"
        );
      }, 900);
    }

    maybeOfferOnboarding(parse().name);
  }

  global.App = App;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
