/* ============================================================
   Onboarding — collects just enough to personalise the roadmap.

   Four questions, skippable, and re-openable from Settings. The output is a
   profile that drives Curriculum.planFor(): which chapters you can skim, what
   is new for you in each, and a week-by-week schedule from your real hours.
   ============================================================ */
(function (global) {
  "use strict";

  var el = U.el;
  var esc = U.esc;
  var C = global.Curriculum;

  var O = {};

  var GOALS = [
    {
      id: "job",
      label: "Get an AI engineering role",
      hint: "Weights evaluation, interview prep, and portfolio projects",
      icon: "target",
    },
    {
      id: "ship",
      label: "Ship an AI feature at work",
      hint: "Weights retrieval, cost, latency, and production concerns",
      icon: "rocket",
    },
    {
      id: "depth",
      label: "Understand it properly",
      hint: "Nothing skipped, foundations included",
      icon: "brain",
    },
  ];

  var HOURS = [
    { id: 3, label: "~3 h / week", hint: "Evenings only" },
    { id: 5, label: "~5 h / week", hint: "A steady habit" },
    { id: 10, label: "~10 h / week", hint: "Serious pace" },
    { id: 20, label: "~20 h / week", hint: "Full-time push" },
  ];

  /* ---------------------------------------------------------
     Modal
     --------------------------------------------------------- */

  O.open = function (opts) {
    opts = opts || {};
    var existing = Store.profile() || {};
    var draft = {
      track: existing.track || null,
      skills: (existing.skills || []).slice(),
      goal: existing.goal || "job",
      hoursPerWeek: existing.hoursPerWeek || 5,
    };

    var step = 0;
    var STEPS = ["track", "skills", "time", "review"];

    var scrim = el("div", "modal ob");
    var box = el("div", "modal__box ob__box");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Personalise your roadmap");
    scrim.appendChild(box);
    document.body.appendChild(scrim);

    /* Armed after the first render(), because the trap focuses the first control
       it finds and there is nothing in the box until then. */
    var release = null;

    /* Closing releases the trap, which is also what dismisses this dialog when the
       user navigates away — see U.trap. */
    function close() {
      if (release) release();
      if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
    }

    function trackById(id) {
      return C.tracks.filter(function (t) {
        return t.id === id;
      })[0];
    }

    function render() {
      box.innerHTML = "";

      /* progress dots */
      var dots = el("div", "ob__dots");
      STEPS.forEach(function (_, i) {
        var d = el(
          "span",
          "ob__dot" + (i === step ? " is-on" : i < step ? " is-done" : "")
        );
        dots.appendChild(d);
      });
      box.appendChild(dots);

      var name = STEPS[step];

      /* ---------------- 1. track ---------------- */
      if (name === "track") {
        box.appendChild(
          el(
            "div",
            "ob__head",
            "<h3>What's your background?</h3><p>This decides which chapters you can " +
              "skim and which are genuinely new for you. You can change it later.</p>"
          )
        );
        var list = el("div", "ob__opts");
        C.tracks.forEach(function (t) {
          var b = el(
            "button",
            "ob__opt" + (draft.track === t.id ? " is-sel" : "")
          );
          b.type = "button";
          b.innerHTML =
            '<span class="ob__opt-ic">' +
            Icons.get(t.icon, 17) +
            "</span>" +
            '<span class="u-grow"><span class="ob__opt-t">' +
            esc(t.label) +
            "</span>" +
            '<span class="ob__opt-d">' +
            esc(t.blurb) +
            "</span></span>" +
            '<span class="ob__opt-check">' +
            Icons.get("check", 14) +
            "</span>";
          b.onclick = function () {
            draft.track = t.id;
            // Preselect the track's assumed skills, but let the next step edit them.
            draft.skills = t.assumes.slice();
            step = 1;
            render();
          };
          list.appendChild(b);
        });
        box.appendChild(list);
      }

      /* ---------------- 2. skills ---------------- */
      if (name === "skills") {
        var tr = trackById(draft.track);
        box.appendChild(
          el(
            "div",
            "ob__head",
            "<h3>Which of these do you already do?</h3><p>" +
              (tr
                ? "Pre-filled from <strong>" + esc(tr.label) + "</strong>. "
                : "") +
              "Uncheck anything that isn't true — an over-claimed skill means a " +
              "chapter gets marked skim when you should read it.</p>"
          )
        );
        var grid = el("div", "ob__skills");
        C.skills.forEach(function (s) {
          var on = draft.skills.indexOf(s.id) !== -1;
          var b = el("button", "ob__skill" + (on ? " is-on" : ""));
          b.type = "button";
          b.innerHTML =
            '<span class="ob__skill-box">' +
            Icons.get("check", 11) +
            "</span>" +
            '<span><span class="ob__skill-t">' +
            esc(s.label) +
            "</span>" +
            '<span class="ob__skill-d">' +
            esc(s.hint) +
            "</span></span>";
          b.onclick = function () {
            var i = draft.skills.indexOf(s.id);
            if (i === -1) draft.skills.push(s.id);
            else draft.skills.splice(i, 1);
            b.classList.toggle("is-on");
          };
          grid.appendChild(b);
        });
        box.appendChild(grid);
        if (tr && tr.note) {
          var n = el("div", "ob__note");
          n.innerHTML = Icons.get("bulb", 14) + " " + esc(tr.note);
          box.appendChild(n);
        }
      }

      /* ---------------- 3. time + goal ---------------- */
      if (name === "time") {
        box.appendChild(
          el(
            "div",
            "ob__head",
            "<h3>How much time, and what for?</h3><p>Used to build a week-by-week " +
              "schedule you can actually keep.</p>"
          )
        );

        box.appendChild(el("div", "u-eyebrow", "Time available"));
        var hrs = el("div", "ob__pills");
        HOURS.forEach(function (h) {
          var b = el(
            "button",
            "ob__pill" + (draft.hoursPerWeek === h.id ? " is-on" : "")
          );
          b.type = "button";
          b.innerHTML = esc(h.label) + "<span>" + esc(h.hint) + "</span>";
          b.onclick = function () {
            draft.hoursPerWeek = h.id;
            U.qa(".ob__pill", hrs).forEach(function (x) {
              x.classList.remove("is-on");
            });
            b.classList.add("is-on");
          };
          hrs.appendChild(b);
        });
        box.appendChild(hrs);

        box.appendChild(el("div", "u-eyebrow", "Primary goal"));
        box.lastChild.style.marginTop = "var(--s-5)";
        var gl = el("div", "ob__opts");
        GOALS.forEach(function (g) {
          var b = el(
            "button",
            "ob__opt" + (draft.goal === g.id ? " is-sel" : "")
          );
          b.type = "button";
          b.innerHTML =
            '<span class="ob__opt-ic">' +
            Icons.get(g.icon, 17) +
            "</span>" +
            '<span class="u-grow"><span class="ob__opt-t">' +
            esc(g.label) +
            "</span>" +
            '<span class="ob__opt-d">' +
            esc(g.hint) +
            "</span></span>" +
            '<span class="ob__opt-check">' +
            Icons.get("check", 14) +
            "</span>";
          b.onclick = function () {
            draft.goal = g.id;
            U.qa(".ob__opt", gl).forEach(function (x) {
              x.classList.remove("is-sel");
            });
            b.classList.add("is-sel");
          };
          gl.appendChild(b);
        });
        box.appendChild(gl);
      }

      /* ---------------- 4. review ---------------- */
      if (name === "review") {
        var plan = C.planFor(draft);
        var deltas = C.deltaCount(draft);
        box.appendChild(
          el(
            "div",
            "ob__head",
            "<h3>Your plan</h3><p>Derived, not stored — change your profile any time " +
              "and it recomputes.</p>"
          )
        );

        var stats = el("div", "readout");
        stats.innerHTML =
          '<div class="metric metric--accent"><div class="metric__n">' +
          plan.counts.deep +
          '</div><div class="metric__l">Deep</div></div>' +
          '<div class="metric"><div class="metric__n">' +
          plan.counts.study +
          '</div><div class="metric__l">Study</div></div>' +
          '<div class="metric metric--emerald"><div class="metric__n">' +
          plan.counts.skim +
          '</div><div class="metric__l">Skim</div></div>' +
          '<div class="metric metric--amber"><div class="metric__n">' +
          plan.totalWeeks +
          '</div><div class="metric__l">Weeks</div></div>';
        box.appendChild(stats);

        var summary = el("div", "ob__note");
        summary.innerHTML =
          Icons.get("map", 14) +
          " At <b>" +
          draft.hoursPerWeek +
          " h/week</b> that's about <b>" +
          plan.totalWeeks +
          " weeks</b> — roughly " +
          Math.round(plan.readingMinutes / 60) +
          "h of chapters and labs plus " +
          Math.round(plan.projectMinutes / 60) +
          "h of project work, which is " +
          "where most of the learning actually happens. " +
          (deltas
            ? "<b>" +
              plan.counts.skim +
              " chapters</b> are marked skim because you " +
              "already know the material — each one carries a note on exactly what's " +
              "new in it, so you don't skip the part that matters."
            : "Nothing is downgraded — you'll work through the roadmap in full.");
        box.appendChild(summary);
      }

      /* ---------------- actions ---------------- */
      var actions = el("div", "modal__actions");
      if (step > 0) {
        var back = el("button", "btn btn--ghost");
        back.innerHTML = Icons.get("arrowLeft", 14) + " Back";
        back.onclick = function () {
          step--;
          render();
        };
        actions.appendChild(back);
      } else {
        var skip = el("button", "btn btn--ghost");
        skip.textContent = "Skip for now";
        skip.onclick = function () {
          Store.skipOnboarding();
          close();
          if (opts.onDone) opts.onDone(false);
        };
        actions.appendChild(skip);
      }

      var next = el("button", "btn btn--primary");
      if (name === "review") {
        next.innerHTML = Icons.get("check", 15) + " Start learning";
        next.onclick = function () {
          Store.setProfile(draft);
          close();
          if (opts.onDone) opts.onDone(true);
        };
      } else {
        next.innerHTML = "Continue " + Icons.get("arrowRight", 14);
        next.disabled = name === "track" && !draft.track;
        next.onclick = function () {
          step++;
          render();
        };
      }
      actions.appendChild(next);
      box.appendChild(actions);
    }

    function dismiss() {
      Store.skipOnboarding();
      close();
      if (opts.onDone) opts.onDone(false);
    }

    scrim.addEventListener("click", function (e) {
      if (e.target === scrim && step === 0) dismiss();
    });

    render();

    /* Escape does what "Skip for now" and a scrim click already do: dismiss
       without saving, and stop the prompt reappearing on every load. It stays
       re-openable from Settings and from My Plan, so this loses nothing. */
    release = U.trap(box, dismiss);
  };

  global.Onboarding = O;
})(window);
