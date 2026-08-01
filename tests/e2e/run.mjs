#!/usr/bin/env node
/**
 * End-to-end suite: boots the real site in Chromium and drives it.
 *
 * Deliberately not a test framework. It is a single script so it can run in CI
 * with only Playwright installed, and so the failure output is a plain list of
 * what broke rather than a TAP tree. Any console error or page error anywhere
 * in the run fails the suite — that check has caught more real bugs here than
 * the explicit assertions have.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { ROOT } from "../../scripts/lib/load-curriculum.mjs";

const require = createRequire(import.meta.url);
const PORT = Number(process.env.E2E_PORT || 8911);
const BASE = `http://localhost:${PORT}/index.html`;

/* ------------------------------------------------------------------ */

let pass = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}

/* Section timings, printed at the end. The suite went over its runtime budget
   once already and the cause was not where I would have guessed — a link sweep
   doing 44 full page loads rather than 44 hash changes. Measuring beats guessing,
   and a slow section is usually a wasteful one. */
const timings = [];
let sectionStart = 0;
let currentSection = null;

function section(title) {
  if (currentSection) {
    timings.push([currentSection, Date.now() - sectionStart]);
  }
  currentSection = title;
  sectionStart = Date.now();
  console.log(`\n${title}`);
}

function closeSection() {
  if (currentSection) {
    timings.push([currentSection, Date.now() - sectionStart]);
    currentSection = null;
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error(
      "\n  playwright is not installed. Run: npm install\n" +
        "  (or npm install -g playwright, then re-run)\n"
    );
    process.exit(2);
  }

  const server = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });

  const stop = () => {
    try {
      server.kill();
    } catch {
      /* already gone */
    }
  };
  process.on("exit", stop);

  await new Promise((r) => setTimeout(r, 900));

  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}
  );

  const errors = [];
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  /* A goto whose URL differs from the current one only in the fragment is a
     same-document navigation: the page does not reload and the app's scripts do
     not re-run. That has cost real time three times in this suite's history —
     a review deck read before its seed landed, a "first visit" that was not one,
     and a set of filter counts painted before the state they counted existed.
     Reload when the URL is unchanged. */
  const visit = async (p2, url) => {
    if ((await p2.url()) === url) await p2.reload({ waitUntil: "networkidle" });
    else await p2.goto(url, { waitUntil: "networkidle" });
  };

  const go = async (hash) => {
    await visit(page, BASE + hash);
    await page.addStyleTag({
      content: "html{scroll-behavior:auto !important}",
    });
    await page.evaluate(() => Store.skipOnboarding());
    await page.waitForTimeout(150);
  };

  /* ---------------- boot ---------------- */
  section("boot");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => Store.skipOnboarding());
  await page.waitForTimeout(250);

  const counts = await page.evaluate(() => ({
    phases: window.Curriculum.phases.length,
    chapters: window.Curriculum.chapters.length,
    projects: window.Curriculum.projects.length,
    glossary: window.Curriculum.glossary.length,
    labs: Object.keys(window.Labs).filter(
      (k) => window.Labs[k] && window.Labs[k].render
    ).length,
    tracks: window.Curriculum.tracks.length,
  }));
  check("curriculum loads", counts.chapters > 40, JSON.stringify(counts));
  check("labs registered", counts.labs >= 13, `${counts.labs} labs`);
  check("tracks present", counts.tracks >= 5);

  /* ---------------- every route renders ---------------- */
  section("routes");
  /* Read from the app's own route table rather than a literal. Three copies of
     this list existed and the readiness route was in none of them: a new surface
     could ship with no render check, no heading check and no contrast check while
     the suite stayed green.

     Captured once, here, rather than re-evaluated per section: the main context is
     closed part-way through the suite, so a later `page.evaluate` would fail on a
     dead page — which is how the first version of this crashed. */
  const APP_ROUTES = await page.evaluate(() => App.routes());
  const routes = [...APP_ROUTES, "#/nonexistent-route"];
  check(
    "the route sweep covers every route the app declares",
    routes.length >= 11,
    JSON.stringify(routes)
  );
  for (const r of routes) {
    await go(r);
    const len = await page.evaluate(() => document.body.innerText.length);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    check(`route ${r || "/"} renders`, len > 300, `${len} chars`);
    check(`route ${r || "/"} no h-overflow`, overflow <= 2, `${overflow}px`);
  }

  /* ---------------- every chapter renders ---------------- */
  section("chapters");
  const ids = await page.evaluate(() =>
    window.Curriculum.chapters.map((c) => c.id)
  );
  let weak = 0;
  for (const id of ids) {
    await page.evaluate((i) => {
      location.hash = "#/chapter/" + i;
    }, id);
    await page.waitForTimeout(110);
    const info = await page.evaluate(() => ({
      h1: !!document.querySelector(".chhead h1"),
      prose: (document.querySelector(".prose") || { innerText: "" }).innerText
        .length,
      quiz: !!document.querySelector(".quiz"),
      toc: document.querySelectorAll(".toc a").length,
    }));
    if (!info.h1 || info.prose < 800 || !info.quiz || info.toc < 1) {
      weak++;
      console.log(`       weak: ${id} ${JSON.stringify(info)}`);
    }
  }
  check(`all ${ids.length} chapters render fully`, weak === 0, `${weak} weak`);

  /* ---------------- labs survive interaction ---------------- */
  section("labs");
  await go("#/labs");
  await page.waitForTimeout(400);
  const labCount = await page.locator(".lab").count();
  check("all labs mount", labCount >= 13, `${labCount} mounted`);

  /* Labs record use from update(), which also runs on mount. Rendering must not
     award XP, or opening this page hands out 130 XP for scrolling. */
  const xpOnMount = await page.evaluate(() => window.Store.state().xp);
  check("mounting labs awards no XP", xpOnMount === 0, `${xpOnMount} XP`);

  const sliders = await page.locator(".lab input[type=range]").count();
  for (let i = 0; i < sliders; i++) {
    const s = page.locator(".lab input[type=range]").nth(i);
    for (const v of ["max", "min"]) {
      await s.evaluate((el, which) => {
        el.value = which === "max" ? el.max : el.min;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, v);
    }
  }
  const controls = await page
    .locator(".lab .tg, .lab .pbrow, .lab .atk, .lab .btn")
    .count();
  for (let i = 0; i < controls; i++) {
    try {
      await page
        .locator(".lab .tg, .lab .pbrow, .lab .atk, .lab .btn")
        .nth(i)
        .click({ timeout: 800, force: true });
    } catch {
      /* a control may be disabled mid-state; that is fine */
    }
  }
  await page.waitForTimeout(500);
  check(
    `exercised ${sliders} sliders and ${controls} controls`,
    true,
    "no exceptions"
  );

  const xpAfterUse = await page.evaluate(() => window.Store.state().xp);
  check("using labs awards XP", xpAfterUse > 0, `${xpAfterUse} XP`);

  /* Every plotted lab must expose its numbers without hovering. Two of them read
     values out only on mouseenter, which is nothing at all on a phone and nothing
     at all to a screen reader — and the table view that fixed it immediately
     exposed a wrong model in one of the charts, where a series was flat across
     its whole domain and the bars made that look deliberate. */
  const hoverOnly = await page.evaluate(() =>
    [...document.querySelectorAll(".lab")]
      .filter((lab) => lab.querySelector(".ccurve__plot"))
      .filter((lab) => {
        const rows = lab.querySelectorAll("table tbody tr").length;
        return rows < 3;
      })
      .map(
        (lab) => (lab.querySelector(".lab__t") || lab).innerText.split("\n")[0]
      )
  );
  /* A lab footer that cites settings is a claim the reader can check against the
     widget three inches away, so it has to be derived rather than written. The
     compounding lab called 95% across five agents "a coin flip" while its own tile
     said "1 in 4" — 77%. This drives the lab to the settings its footer names and
     compares the two. */
  const footClaim = await page.evaluate(() => {
    const lab = [...document.querySelectorAll(".lab")].find((l) =>
      /chains of agents/i.test(l.innerText)
    );
    if (!lab) return null;
    const sliders = [...lab.querySelectorAll('input[type="range"]')];
    sliders[0].value = 80;
    sliders[0].dispatchEvent(new Event("input", { bubbles: true }));
    sliders[1].value = 8;
    sliders[1].dispatchEvent(new Event("input", { bubbles: true }));
    const foot = lab.querySelector(".lab__foot").innerText;
    const row = [...lab.querySelectorAll(".ccurve__table tbody tr")][7];
    const cells = row
      ? [...row.querySelectorAll("td")].map((t) => t.innerText)
      : [];
    return { foot, chain: cells[1], orch: cells[2] };
  });
  await page.waitForTimeout(200);
  check(
    "a lab footer's cited numbers match the lab",
    !!footClaim &&
      footClaim.foot.includes(footClaim.chain) &&
      footClaim.foot.includes(footClaim.orch),
    footClaim
      ? `footer cites ${footClaim.chain}/${footClaim.orch}?`
      : "lab not found"
  );

  /* "1 in N" stops meaning anything once failure is the common case: at 80%
     across eight agents the tile read "1 in 1 runs fail" beside "17% succeed". */
  const failTile = await page.evaluate(() => {
    const lab = [...document.querySelectorAll(".lab")].find((l) =>
      /chains of agents/i.test(l.innerText)
    );
    const tiles = [...lab.querySelectorAll(".metric")].map((m) => m.innerText);
    return tiles.join(" | ");
  });
  check(
    "the failure tile stays meaningful past a coin flip",
    !/1 in 1/.test(failTile),
    failTile
  );

  check(
    "every plotted lab reads its values out without hover",
    hoverOnly.length === 0,
    hoverOnly.join("; ")
  );

  /* ---------------- quiz, completion, persistence ---------------- */
  section("progress");
  await go("#/chapter/role");
  await page.locator(".qitem").first().locator(".opt").nth(1).click();
  await page.waitForTimeout(200);
  check(
    "quiz reveals an explanation",
    (await page.locator(".qitem").first().locator(".why").count()) === 1
  );

  await page.locator(".chdone .btn").click();
  await page.waitForTimeout(250);
  check(
    "chapter marks complete",
    await page.evaluate(() => Store.isDone("role"))
  );
  const xp = await page.evaluate(() => Store.state().xp);
  check("XP awarded", xp > 0, `xp=${xp}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(350);
  check(
    "progress survives reload",
    await page.evaluate(() => Store.isDone("role") && Store.state().xp > 0)
  );

  /* ---------------- personalisation ---------------- */
  section("personalisation");
  /* The roadmap, not the landing page: the offer arrives on surfaces where
     planning is the point, and the pitch is left to make its case. */
  await page.goto(BASE + "#/roadmap", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  check(
    "onboarding auto-opens on a planning surface",
    (await page.locator(".ob__box").count()) === 1
  );

  await page
    .locator(".ob__opt")
    .filter({ hasText: "Backend engineer" })
    .click();
  await page.waitForTimeout(250);
  const pre = await page.locator(".ob__skill.is-on").count();
  check("track preselects skills", pre >= 6, `${pre} preselected`);

  await page.locator(".btn--primary").filter({ hasText: "Continue" }).click();
  await page.waitForTimeout(200);
  await page.locator(".ob__pill").filter({ hasText: "~10 h" }).click();
  await page.locator(".btn--primary").filter({ hasText: "Continue" }).click();
  await page.waitForTimeout(250);
  await page
    .locator(".btn--primary")
    .filter({ hasText: "Start learning" })
    .click();
  await page.waitForTimeout(700);

  check(
    "lands on the plan after onboarding",
    (await page.evaluate(() => location.hash)) === "#/plan"
  );
  const plan = await page.evaluate(() => {
    const p = Store.plan();
    return { weeks: p.totalWeeks, skim: p.counts.skim, deep: p.counts.deep };
  });
  check(
    "plan duration is plausible",
    plan.weeks >= 8 && plan.weeks <= 30,
    `${plan.weeks} weeks`
  );
  check("backend track marks chapters skim", plan.skim >= 6, `${plan.skim}`);
  check("core chapters stay deep", plan.deep >= 14, `${plan.deep}`);

  await go("#/chapter/resilience");
  const delta = await page.locator(".delta").count();
  check("skimmed chapter shows its delta note", delta === 1);
  const deltaText = delta ? await page.locator(".delta__b").innerText() : "";
  check(
    "delta note is specific, not generic",
    deltaText.includes("prompt caching"),
    deltaText.slice(0, 60)
  );

  await go("#/roadmap");
  const chips = await page.locator(".mode").count();
  check("roadmap shows mode chips", chips >= 40, `${chips} chips`);

  /* The plan's per-chapter notes are its reason to exist, and 31 of 44 rows used
     to repeat one of two boilerplate sentences — which buried the 13 that carry
     real guidance. A note now earns a line only when it is about that chapter;
     the generic text moves to the mode chip's tooltip, where the legend above
     the weeks already explains what each mode means. */
  await go("#/plan");
  await page.waitForTimeout(400);
  const noteShape = await page.evaluate(() => ({
    rows: document.querySelectorAll(".planrow").length,
    notes: document.querySelectorAll(".planrow__why").length,
    tooltips: [...document.querySelectorAll(".planrow .mode")].filter(
      (m) => (m.getAttribute("title") || "").length > 20
    ).length,
    skimRowsWithNotes: [...document.querySelectorAll(".planrow")].filter(
      (r) => r.querySelector(".mode--skim") && r.querySelector(".planrow__why")
    ).length,
    skimRows: document.querySelectorAll(".planrow .mode--skim").length,
  }));
  check(
    "plan notes appear only where they say something",
    noteShape.notes >= 8 &&
      noteShape.notes < noteShape.rows / 2 &&
      noteShape.tooltips === noteShape.rows,
    JSON.stringify(noteShape)
  );
  check(
    "every skim recommendation still carries its reason",
    noteShape.skimRows > 0 &&
      noteShape.skimRowsWithNotes === noteShape.skimRows,
    JSON.stringify(noteShape)
  );

  /* The chapter-level version of the same note. Its old visibility test was
     `skim || (deep && has-an-overlap-entry)`, which silently dropped the
     study-mode notes — including the one on the roadmap's own first chapter. */
  await go("#/chapter/role");
  await page.waitForTimeout(300);
  const roleNote = await page.evaluate(() => {
    const n = document.querySelector(".delta");
    return n ? n.innerText.replace(/\s+/g, " ").slice(0, 60) : null;
  });
  check(
    "a study chapter with a specific note shows it",
    !!roleNote && /familiar/i.test(roleNote),
    String(roleNote)
  );
  await go("#/chapter/llm-mental-model");
  await page.waitForTimeout(300);
  check(
    "a chapter with nothing specific to say shows no note",
    (await page.locator(".delta").count()) === 0
  );

  /* ---------------- review deck ---------------- */
  section("review");
  /* Cards are gated on chapter completion. Before that gate existed, all 167
     cards counted as due on a brand-new account: the sidebar carried a "167"
     badge before you had read a word and the deck cold-quizzed phase-4 material
     in your first session, while the UI claimed completing a chapter is what
     "unlocks its flashcards for review". */
  await page.evaluate(() => Store.reset());
  await go("#/review");
  await page.waitForTimeout(300);
  check(
    "a fresh account has no cards to review",
    (await page.locator(".fcard3d").count()) === 0 &&
      (await page.locator(".empty").count()) === 1
  );
  check(
    "the empty state points at a chapter to unlock some",
    /No cards unlocked/.test(
      await page.evaluate(() => document.querySelector(".empty").innerText)
    )
  );
  check(
    "no review badge before anything is complete",
    (await page.locator(".navlink__count").count()) === 0
  );

  await page.evaluate(() => {
    Store.complete("role", true);
    Store.complete("tokens", true);
    // Restore the profile the reset above cleared: later sections measure #/plan,
    // and without one it renders its empty state instead of the real schedule.
    Store.setProfile({
      track: "backend",
      goal: "job",
      hoursPerWeek: 10,
      skills: ["apis", "reliability", "caching", "databases"],
    });
  });
  const unlocked = await page.evaluate(() =>
    ["role", "tokens"].reduce(
      (a, id) =>
        a +
        window.Curriculum.chapters.filter((c) => c.id === id)[0].cards.length,
      0
    )
  );
  // reload, not go() — goto to an identical URL is a same-document no-op, so the
  // empty-state DOM from the assertions above would still be on screen.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const deckSize = await page.evaluate(() =>
    Number(
      (document.querySelector(".fcmeta").innerText.match(/of (\d+)/) || [])[1]
    )
  );
  check(
    "completing chapters unlocks exactly their cards",
    deckSize === unlocked,
    `deck ${deckSize}, unlocked ${unlocked}`
  );
  check(
    "the sidebar badge counts only unlocked cards",
    (await page.evaluate(
      () => (document.querySelector(".navlink__count") || {}).innerText
    )) === String(unlocked)
  );
  check("a card is presented", (await page.locator(".fcard3d").count()) === 1);
  await page.locator(".fcard3d").click();
  await page.waitForTimeout(650);
  check(
    "card flips",
    await page.evaluate(() =>
      document.querySelector(".fcard3d").classList.contains("is-flipped")
    )
  );
  await page.locator(".fcctrl .btn--primary").click();
  await page.waitForTimeout(300);
  check(
    "grading advances the deck",
    await page.evaluate(() =>
      document.querySelector(".fcmeta").innerText.includes("2")
    )
  );

  /* ---------------- keyboard ---------------- */
  section("keyboard");
  await go("#/chapter/role");
  await page.keyboard.press("j");
  await page.waitForTimeout(220);
  const afterJ = await page.evaluate(() => location.hash);
  check("j advances a chapter", afterJ !== "#/chapter/role", afterJ);
  await page.keyboard.press("/");
  await page.waitForTimeout(220);
  check(
    "/ opens the palette",
    await page.evaluate(() => !document.getElementById("palette").hidden)
  );
  await page.keyboard.type("rerank");
  await page.waitForTimeout(300);
  const results = await page.locator(".presult").count();
  check("palette searches content", results > 0, `${results} results`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check(
    "escape closes the palette",
    await page.evaluate(() => document.getElementById("palette").hidden)
  );

  /* Keyboard-only operation, which no earlier pass had driven. Nine nav links,
     eight phase links, a brand and a search button sit before the content: 24
     tab stops to reach a chapter's first paragraph, which WCAG 2.4.1 exists to
     prevent. */
  await go("#/chapter/tokens");
  await page.keyboard.press("Tab");
  // It slides in on focus, so wait for the transition rather than guessing at it.
  await page
    .waitForFunction(
      () => {
        const e = document.activeElement;
        return (
          e &&
          e.classList.contains("skiplink") &&
          e.getBoundingClientRect().top >= 0
        );
      },
      { timeout: 2500 }
    )
    .catch(() => {});
  const skip = await page.evaluate(() => {
    const e = document.activeElement;
    return {
      cls: (e.className || "").toString(),
      onscreen: e.getBoundingClientRect().top >= 0,
      top: Math.round(e.getBoundingClientRect().top),
    };
  });
  check(
    "the first tab stop is a visible skip link",
    skip.cls.includes("skiplink") && skip.onscreen,
    JSON.stringify(skip)
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  check(
    "the skip link lands you inside the content",
    await page.evaluate(() => !!document.activeElement.closest("#main"))
  );

  /* Six labs build toggle rows from switchRow. The row is the pointer target, so
     the switch inside it has to be a real button or the control does not exist to
     a keyboard at all — which is what a div with an onclick amounts to. */
  await go("#/labs");
  await page.waitForTimeout(700);
  const swState = await page.evaluate(() => {
    const s = document.querySelector(".sw");
    s.scrollIntoView({ block: "center" });
    return {
      tag: s.tagName.toLowerCase(),
      role: s.getAttribute("role"),
      checked: s.getAttribute("aria-checked"),
      labelled: !!s.getAttribute("aria-label"),
    };
  });
  await page.locator(".sw").first().focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  const swAfter = await page.evaluate(() =>
    document.querySelector(".sw").getAttribute("aria-checked")
  );
  check(
    "lab toggles are real switches, operable by keyboard",
    swState.tag === "button" &&
      swState.role === "switch" &&
      swState.labelled &&
      swAfter !== swState.checked,
    `${JSON.stringify(swState)} → aria-checked=${swAfter}`
  );

  /* A dialog that leaves focus on <body> does not exist to the keyboard: the
     first Tab went to the skip link *behind* the scrim, and Escape did nothing. */
  await page.evaluate(() => Store.reset());
  // A planning surface, since that is where the offer is made.
  await page.goto(BASE + "#/roadmap", { waitUntil: "networkidle" });
  await page.waitForSelector(".ob", { timeout: 3000 });
  await page.waitForTimeout(400);
  const obFocus = await page.evaluate(
    () => !!document.activeElement.closest(".ob")
  );
  let obLeak = false;
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    if (!(await page.evaluate(() => !!document.activeElement.closest(".ob")))) {
      obLeak = true;
      break;
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const obClosed = (await page.locator(".ob").count()) === 0;
  check(
    "the onboarding dialog takes focus, keeps it, and closes on Escape",
    obFocus && !obLeak && obClosed,
    `focus=${obFocus} trapped=${!obLeak} escape=${obClosed}`
  );

  // Restore state for the sections that follow this one.
  await page.evaluate(() => Store.skipOnboarding());

  /* ---------------- accessibility tree ---------------- */
  /* What a screen reader is handed, as opposed to what a keyboard can reach. */
  section("accessibility tree");
  const treeIssues = { skips: [], h1: [], unlabelled: new Map(), svg: [] };
  for (const r of [...APP_ROUTES, "#/chapter/tokens"]) {
    await go(r);
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
        (h) => +h.tagName[1]
      );
      let skips = 0;
      for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) skips++;
      const unl = [];
      document.querySelectorAll("button, a[href]").forEach((e) => {
        /* textContent, not innerText: innerText is "" for anything not rendered,
           and the evidence forms live inside a collapsed <details>. A link there is
           labelled — a screen reader reads it the moment the section opens — so
           checking innerText reported it as nameless. An accessible name comes from
           the content, whether or not the box happens to be open. */
        if ((e.innerText || e.textContent || "").trim()) return;
        if (e.getAttribute("aria-label") || e.getAttribute("title")) return;
        unl.push(
          `${e.tagName.toLowerCase()}.${(e.className || "?").toString().split(" ")[0]}`
        );
      });
      return {
        h1: document.querySelectorAll("h1").length,
        skips,
        unl: [...new Set(unl)],
        loudSvg: [...document.querySelectorAll("svg")].filter(
          (v) => !v.getAttribute("aria-hidden") && !v.getAttribute("role")
        ).length,
      };
    });
    if (m.skips) treeIssues.skips.push(`${r || "/"}(${m.skips})`);
    if (m.h1 !== 1) treeIssues.h1.push(`${r || "/"}(${m.h1})`);
    m.unl.forEach((u) => treeIssues.unlabelled.set(u, r || "/"));
    if (m.loudSvg) treeIssues.svg.push(`${r || "/"}(${m.loudSvg})`);
  }
  /* Card and section titles had been picked for their visual size rather than
     their level, so nine of eleven routes jumped h1 -> h3 or h1 -> h4. Heading
     level is the document outline a screen reader navigates by; the size is CSS. */
  check(
    "no route skips a heading level",
    treeIssues.skips.length === 0,
    treeIssues.skips.join(", ")
  );
  check(
    "exactly one h1 per route",
    treeIssues.h1.length === 0,
    treeIssues.h1.join(", ")
  );
  check(
    "every icon-only control is labelled",
    treeIssues.unlabelled.size === 0,
    [...treeIssues.unlabelled.keys()].slice(0, 4).join(", ")
  );
  check(
    "decorative icons are hidden from the tree",
    treeIssues.svg.length === 0,
    treeIssues.svg.join(", ")
  );

  /* A hash router swaps the whole body with no page load, so navigation is silent
     to a screen reader — you activate "Roadmap" and hear nothing at all. */
  await go("#/roadmap");
  await page.waitForTimeout(400);
  const ann1 = await page.evaluate(
    () => (document.querySelector("[role=status]") || {}).textContent
  );
  await page.evaluate(() => {
    location.hash = "#/library";
  });
  await page.waitForTimeout(500);
  const ann2 = await page.evaluate(
    () => (document.querySelector("[role=status]") || {}).textContent
  );
  check(
    "navigating announces the page it landed on",
    /roadmap/i.test(ann1 || "") && /library/i.test(ann2 || ""),
    `"${ann1}" then "${ann2}"`
  );

  /* Right and wrong were colour plus an aria-hidden icon, so a revealed option
     read identically to an unanswered one. */
  await go("#/chapter/tokens");
  await page.waitForTimeout(300);
  await page.locator(".check").first().locator(".opt").first().click();
  await page.waitForTimeout(350);
  const revealed = await page.evaluate(() => {
    const opts = [...document.querySelectorAll(".check .opt")];
    return {
      names: opts.slice(0, 3).map((o) => o.textContent),
      why: (document.querySelector(".check .why") || {}).getAttribute?.("role"),
      hidden: (() => {
        const n = document.querySelector(".check .opt .u-sr");
        if (!n) return false;
        const r = n.getBoundingClientRect();
        return r.width <= 1 && r.height <= 1;
      })(),
    };
  });
  check(
    "a revealed answer says which it was, in text",
    revealed.names.some((n) => /correct answer/.test(n)) &&
      revealed.names.some((n) => /incorrect/.test(n)) &&
      revealed.hidden,
    JSON.stringify(revealed.names.map((n) => n.slice(-24)))
  );
  check(
    "the explanation announces itself when it appears",
    revealed.why === "status",
    String(revealed.why)
  );

  /* ---------------- projects link back to the material ---------------- */
  /* Projects are 118 of the plan's 147 hours and had no route back to the 44
     chapters at all: a reader stuck on "fuse BM25 and dense with RRF" had to
     remember which chapter covered it and go looking. Every milestone now names
     the chapter that teaches it. */
  section("projects");
  await go("#/projects");
  await page.waitForTimeout(500);
  const projLinks = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".ckrow")];
    const refs = [...document.querySelectorAll(".ckref")];
    const ids = new Set(window.Curriculum.chapters.map((c) => c.id));
    return {
      rows: rows.length,
      refs: refs.length,
      resolve: refs.every((r) =>
        ids.has(r.getAttribute("href").replace("#/chapter/", ""))
      ),
      labelled: refs.every(
        (r) =>
          (r.getAttribute("title") || "").length > 8 &&
          /\S/.test(r.innerText || r.textContent)
      ),
      tiny: refs.filter((r) => {
        const b = r.getBoundingClientRect();
        return b.width < 24 || b.height < 24;
      }).length,
      // the reference must not be inside the toggle: tapping "done" must not navigate
      nested: refs.filter((r) => r.closest("button")).length,
    };
  });
  check(
    "every project milestone links to the chapter that teaches it",
    projLinks.rows > 30 &&
      projLinks.refs === projLinks.rows &&
      projLinks.resolve,
    JSON.stringify(projLinks)
  );
  check(
    "those links are labelled, big enough, and outside the toggle",
    projLinks.labelled && projLinks.tiny === 0 && projLinks.nested === 0,
    JSON.stringify(projLinks)
  );
  const beforeNav = await page.evaluate(() => location.hash);
  await page.locator(".ckitem").first().click();
  await page.waitForTimeout(250);
  check(
    "ticking a milestone records it without navigating",
    (await page.evaluate(() => location.hash)) === beforeNav &&
      (await page.evaluate(() => Store.projDone("p-classifier"))) === 1,
    `hash ${await page.evaluate(() => location.hash)}`
  );
  await page.locator(".ckref").first().click();
  await page.waitForTimeout(400);
  check(
    "each reference names the phase its chapter is in",
    await page.evaluate(() =>
      [...document.querySelectorAll(".ckref")].every((r) =>
        /Phase \d/.test(r.getAttribute("title") || "")
      )
    )
  );

  check(
    "its reference opens the chapter",
    /#\/chapter\//.test(await page.evaluate(() => location.hash)),
    await page.evaluate(() => location.hash)
  );

  /* The other half of the link. Reading a chapter and building with it were one
     navigation apart with nothing joining them, and the projects hold four fifths
     of the plan's hours — so a chapter says which milestones it unlocks, computed
     from the milestone references rather than authored, and shows which of them
     you have already ticked. */
  await go("#/chapter/llm-judge");
  await page.waitForTimeout(400);
  const usesBlock = await page.evaluate(() => {
    const u = document.querySelector(".uses");
    if (!u) return null;
    const expected = window.Curriculum.projects.reduce(
      (n, pr) => n + pr.tasks.filter((t) => t.ch === "llm-judge").length,
      0
    );
    return {
      items: u.querySelectorAll(".uses__item").length,
      expected,
      links: [...u.querySelectorAll("a")].every(
        (a) => a.getAttribute("href") === "#/projects"
      ),
      namesProject: /Evaluation Harness/.test(u.innerText),
    };
  });
  check(
    "a chapter lists the project milestones that apply it",
    !!usesBlock &&
      usesBlock.items === usesBlock.expected &&
      usesBlock.items >= 2 &&
      usesBlock.links &&
      usesBlock.namesProject,
    JSON.stringify(usesBlock)
  );

  /* A ticked milestone must read as done here too, or the two views disagree
     about the same fact. */
  await page.evaluate(() => Store.projTask("p-evals", 2));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check(
    "a milestone already ticked shows as done in the chapter",
    (await page.locator(".uses__item.is-done").count()) === 1,
    `${await page.locator(".uses__item.is-done").count()} done`
  );

  /* And it appears only where a milestone actually points. */
  const usesCoverage = await page.evaluate(async () => {
    const ids = window.Curriculum.chapters.map((c) => c.id);
    const referenced = new Set();
    window.Curriculum.projects.forEach((pr) =>
      pr.tasks.forEach((t) => referenced.add(t.ch))
    );
    let shown = 0;
    let wrong = [];
    for (const id of ids) {
      location.hash = "#/chapter/" + id;
      await new Promise((r) => setTimeout(r, 55));
      const has = !!document.querySelector(".uses");
      if (has) shown++;
      if (has !== referenced.has(id)) wrong.push(id);
    }
    return { shown, referenced: referenced.size, wrong };
  });
  check(
    "the block appears on exactly the chapters a project uses",
    usesCoverage.wrong.length === 0 &&
      usesCoverage.shown === usesCoverage.referenced,
    JSON.stringify(usesCoverage)
  );

  /* ---------------- reading measure ---------------- */
  /* Line length is the single biggest lever on whether long-form text is
     comfortable, and it is easy to break without noticing because nothing looks
     wrong — the page just becomes tiring. Research puts the comfortable range at
     50–75 characters (66 the most cited target); WCAG 1.4.8 asks for no more
     than 80. This measures what the browser actually renders rather than
     trusting the CSS: the previous `--measure: 74ch` looked correct and produced
     91 characters, because `ch` is the width of the "0" glyph and Inter's zero
     is wider than its average lowercase letter. */
  section("reading measure");
  for (const w of [1600, 1440, 1280]) {
    const rctx = await browser.newContext({
      viewport: { width: w, height: 1000 },
      colorScheme: "dark",
    });
    const rp = await rctx.newPage();
    await rp.goto(BASE, { waitUntil: "networkidle" });
    await rp.evaluate(() => Store.skipOnboarding());
    await rp.goto(BASE + "#/chapter/api-surface", { waitUntil: "networkidle" });
    await rp.waitForTimeout(500);
    const m = await rp.evaluate(() => {
      const prose = document.querySelector(".prose");
      const el = [...prose.querySelectorAll("p")].sort(
        (a, b) => b.textContent.length - a.textContent.length
      )[0];
      const cs = getComputedStyle(el);
      const colW = el.getBoundingClientRect().width;
      const ctx2 = document.createElement("canvas").getContext("2d");
      ctx2.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const text = el.textContent.trim();
      let n = 0;
      while (
        n < text.length &&
        ctx2.measureText(text.slice(0, n + 1)).width <= colW
      ) {
        n++;
      }
      return { cpl: n, fontPx: parseFloat(cs.fontSize) };
    });
    check(
      `${w}px: line length ${m.cpl} chars is comfortable`,
      m.cpl >= 50 && m.cpl <= 80,
      `${m.cpl} chars at ${m.fontPx}px — want 50–80`
    );
    await rctx.close();
  }

  /* ---------------- no code block is a wall ---------------- */
  /* A listing taller than the viewport has no landmarks and no sense of how much
     is left — twelve chapters had one, the worst at 65 lines and 1499px. Long
     ones fold to a window with an explicit control. This also checks the full
     text is still in the DOM while folded, since a fold that truncated the code
     would break Copy and search. */
  section("code blocks");
  let walls = [];
  let foldedButComplete = true;
  for (const id of [
    "agent-loop",
    "agent-evals",
    "llm-judge",
    "streaming",
    "observability",
  ]) {
    await go("#/chapter/" + id);
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll(".codeblock")];
      return {
        tall: blocks
          .map((e) => Math.round(e.getBoundingClientRect().height))
          .filter((h) => h > 900),
        folded: blocks.filter((e) => e.dataset.long === "1").length,
        // does a folded block still hold every line of its source?
        intact: blocks
          .filter((e) => e.dataset.long === "1")
          .every((e) => {
            const claimed = parseInt(
              (e.querySelector(".codeblock__lines") || {}).textContent || "0",
              10
            );
            return (
              e.querySelector("code").textContent.split("\n").length === claimed
            );
          }),
      };
    });
    if (r.tall.length) walls.push(`${id}: ${r.tall.join("px, ")}px`);
    if (r.folded && !r.intact) foldedButComplete = false;
  }
  check(
    "no code block is taller than the viewport",
    walls.length === 0,
    walls.join("; ")
  );
  check(
    "a folded code block still contains every line",
    foldedButComplete,
    "folding must not truncate the source"
  );

  /* Horizontal scroll inside a listing is worse than vertical: you lose the left
     edge, which is where the indentation carrying the structure lives. The
     validator flags source lines over 78 chars, but that is a proxy — this
     measures what the browser actually does at reading width, across every
     chapter, and is the check that says the proxy is calibrated. */
  const sideways = [];
  for (const id of ids) {
    await page.evaluate((i) => {
      location.hash = "#/chapter/" + i;
    }, id);
    await page.waitForTimeout(120);
    const over = await page.evaluate(() =>
      [...document.querySelectorAll(".codeblock pre")]
        .map((pre) => pre.scrollWidth - pre.clientWidth)
        .filter((n) => n > 2)
    );
    if (over.length) sideways.push(`${id}: +${over.join("px, +")}px`);
  }
  check(
    "no code block scrolls sideways at reading width",
    sideways.length === 0,
    sideways.slice(0, 4).join("; ")
  );

  /* ---------------- scroll reveal never strands content ---------------- */
  /* Jump straight to the bottom of the longest page. Every revealable element
     must end up visible, including the ones the viewport skipped over — an
     element left at opacity 0 is content the reader can never see. */
  section("scroll reveal");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => Store.skipOnboarding());
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  await page.waitForTimeout(700);
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })
  );
  await page.waitForTimeout(1400);
  const stranded = await page.evaluate(() =>
    [...document.querySelectorAll(".rv")]
      .filter((el) => +getComputedStyle(el).opacity < 0.99)
      .map((el) => el.className)
  );
  check(
    "jumping to the bottom strands nothing",
    stranded.length === 0,
    stranded.join(", ")
  );

  /* ---------------- theme ---------------- */
  section("theme");
  await go("#/roadmap");
  const t0 = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );
  await page.locator("#themebtn").click();
  await page.waitForTimeout(250);
  const t1 = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );
  check("theme toggles", t0 !== t1, `${t0} -> ${t1}`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  check(
    "theme persists",
    (await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    )) === t1
  );

  await ctx.close();

  /* ---------------- mobile ---------------- */
  section("mobile (390px)");
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(`mobile pageerror: ${e.message}`));
  mp.on("console", (m) => {
    if (m.type() === "error") errors.push(`mobile console: ${m.text()}`);
  });
  /* A profile is set, not skipped. Skipping onboarding leaves #/plan showing its
     empty state, so the real plan — the widest content in the app, and the only
     place a chapter title ends up inside a button label — was never measured.
     That is how a 71px overflow on #/plan shipped past this check. */
  await mp.goto(BASE, { waitUntil: "networkidle" });
  await mp.evaluate(() =>
    Store.setProfile({
      track: "backend",
      goal: "job",
      hoursPerWeek: 10,
      skills: ["apis", "reliability", "caching", "databases"],
    })
  );
  for (const r of [
    "",
    "#/dashboard",
    "#/plan",
    "#/roadmap",
    "#/library",
    "#/review",
    "#/projects",
    "#/chapter/rag-architecture",
    "#/labs",
  ]) {
    await mp.goto(BASE + r, { waitUntil: "networkidle" });
    await mp.waitForTimeout(350);
    const ov = await mp.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    check(`mobile ${r || "/"} no h-overflow`, ov <= 2, `${ov}px`);
  }
  /* Page-level overflow checks miss content clipped *inside* a container: a card
     with overflow:hidden hides the fact that its children run off its edge. This
     found chips carrying whole sentences running out of the roadmap card, and an
     agent trace 95px wider than its lab — both invisible to the checks above. */
  const clipped = new Map();
  for (const r of [
    "#/dashboard",
    "#/plan",
    "#/roadmap",
    "#/library",
    "#/projects",
    "#/chapter/agent-loop",
    "#/chapter/tokens",
  ]) {
    await mp.goto(BASE + r, { waitUntil: "networkidle" });
    await mp.waitForTimeout(500);
    const found = await mp.evaluate(() => {
      const out = [];
      document.querySelectorAll("body *").forEach((el) => {
        if (el.children.length) return;
        if (!(el.textContent || "").trim()) return;
        const box = el.getBoundingClientRect();
        if (box.width < 4 || box.height < 4) return;
        let n = el.parentElement;
        let clip = null;
        while (n && n !== document.body) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === "hidden" || ox === "clip") {
            clip = n;
            break;
          }
          // A real horizontal scroller is allowed to have content past its edge.
          if (ox === "auto" || ox === "scroll") return;
          n = n.parentElement;
        }
        if (!clip) return;
        const over = Math.round(box.right - clip.getBoundingClientRect().right);
        if (over > 2) {
          out.push(
            `${el.tagName.toLowerCase()}.${el.className || "?"} +${over}px in .${clip.className || "?"}`
          );
        }
      });
      return out;
    });
    found.forEach((f) => clipped.set(f, r));
  }
  check(
    "no content clipped inside its container",
    clipped.size === 0,
    [...clipped.keys()].slice(0, 4).join("; ")
  );

  /* A table that scrolls must say so. On a phone the third column is clipped;
     without an edge fade that reads as broken content rather than as "swipe". */
  await mp.goto(BASE + "#/chapter/tokens", { waitUntil: "networkidle" });
  await mp.waitForTimeout(700);
  const edges = await mp.evaluate(() =>
    [...document.querySelectorAll(".tablebox")].map((e) => e.dataset.edge)
  );
  check(
    "scrollable tables show an edge fade on mobile",
    edges.length > 0 && edges.every((e) => e === "end" || e === "both"),
    edges.join(",")
  );

  await mp.goto(BASE + "#/roadmap", { waitUntil: "networkidle" });
  await mp.waitForTimeout(300);
  await mp.locator(".topbar__menu").click();
  await mp.waitForTimeout(350);
  check(
    "mobile nav drawer opens",
    await mp.evaluate(() => document.body.classList.contains("nav-open"))
  );

  /* Reading comfort on a phone, not just absence of overflow. Every measurement
     before this was taken at 1280px and up, where the column is capped by
     --measure; a phone's column is capped by the phone, so the only lever is
     type size. 18px on a 360px screen gives a 36-character line, and short lines
     are their own kind of tiring — constant eye returns and an ugly rag. The
     comfortable band on a narrow viewport is roughly 35–50. */
  await mp.goto(BASE + "#/chapter/api-surface", { waitUntil: "networkidle" });
  await mp.waitForTimeout(400);
  const mread = await mp.evaluate(() => {
    const el = [...document.querySelectorAll(".prose p")].sort(
      (a, b) => b.textContent.length - a.textContent.length
    )[0];
    const cs = getComputedStyle(el);
    const colW = el.getBoundingClientRect().width;
    const c2 = document.createElement("canvas").getContext("2d");
    c2.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = el.textContent.trim();
    let n = 0;
    while (
      n < text.length &&
      c2.measureText(text.slice(0, n + 1)).width <= colW
    )
      n++;
    return { cpl: n, px: parseFloat(cs.fontSize) };
  });
  check(
    `mobile line length ${mread.cpl} chars is comfortable`,
    mread.cpl >= 38 && mread.cpl <= 55,
    `${mread.cpl} chars at ${mread.px}px — want 38–55`
  );
  check(
    "mobile body text stays above the 16px floor",
    mread.px >= 16,
    `${mread.px}px`
  );

  /* WCAG 2.5.8: a target smaller than 24x24 is hard to hit accurately. The range
     sliders were 20px tall — the primary control in seventeen labs — and the
     prompt builder made a 34x19 pill the only way to toggle a row. */
  const tiny = new Map();
  for (const r of ["#/labs", "#/plan", "#/chapter/tokens", "#/review"]) {
    await mp.goto(BASE + r, { waitUntil: "networkidle" });
    await mp.waitForTimeout(450);
    const found = await mp.evaluate(() => {
      const out = [];
      document
        .querySelectorAll("a, button, input[type=range], [role=button]")
        .forEach((e) => {
          const box = e.getBoundingClientRect();
          if (box.width < 4 || box.height < 4) return;
          /* 2.5.8 does not count a small control whose action is also available
             on a larger target. The lab switches are 34x19 on purpose — they are
             the keyboard handle, while the whole row is the pointer target. */
          const alt = e.parentElement && e.parentElement.closest(".pbrow");
          if (alt && typeof alt.onclick === "function") {
            const ab = alt.getBoundingClientRect();
            if (ab.height >= 24 && ab.width >= 24) return;
          }
          if (box.height < 24 || box.width < 24)
            out.push(
              `${e.tagName.toLowerCase()}.${(e.className || "?").toString().split(" ")[0]} ` +
                `${Math.round(box.width)}x${Math.round(box.height)}`
            );
        });
      return [...new Set(out)];
    });
    found.forEach((f) => tiny.set(f, r));
  }
  check(
    "every tap target meets 24x24",
    tiny.size === 0,
    [...tiny.entries()]
      .slice(0, 4)
      .map(([k, v]) => `${k} on ${v}`)
      .join("; ")
  );
  await mctx.close();

  /* ---------------- contrast, both themes ---------------- */
  /* A dark-first token set drifts out of AA on the light theme without anyone
     noticing, because nothing looks broken — it just looks washed out. This
     found 66 failures across the two themes the first time it ran, almost all
     of them one token (--ink-3) or one pattern (a literal #fff over a fill that
     inverts between themes). */
  section("contrast (WCAG AA)");
  const CONTRAST_ROUTES = [
    ...APP_ROUTES,
    "#/chapter/role",
    "#/chapter/evals-ci",
  ];

  for (const scheme of ["dark", "light"]) {
    const cctx = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: scheme,
    });
    const cp = await cctx.newPage();
    cp.on("pageerror", (e) => errors.push(`${scheme} pageerror: ${e.message}`));
    cp.on("console", (m) => {
      if (m.type() === "error") errors.push(`${scheme} console: ${m.text()}`);
    });
    await cp.goto(BASE, { waitUntil: "networkidle" });
    await cp.evaluate(() =>
      Store.setProfile({
        role: "backend",
        years: "4",
        hours: "~10 h",
        goal: "job",
      })
    );

    const bad = new Map();
    for (const r of CONTRAST_ROUTES) {
      await cp.goto(BASE + r, { waitUntil: "networkidle" });
      await cp.waitForTimeout(400);
      const found = await cp.evaluate(() => {
        const lum = ([r, g, b]) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928
              ? v / 12.92
              : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
        // First ancestor with a background opaque enough to be the real backdrop.
        const backdrop = (el) => {
          let n = el;
          while (n && n !== document.documentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (c.length >= 3 && (c[3] === undefined || c[3] > 0.85)) return c;
            n = n.parentElement;
          }
          return parse(getComputedStyle(document.body).backgroundColor);
        };
        const out = [];
        document.querySelectorAll("body *").forEach((el) => {
          if (el.children.length) return; // text-bearing leaves only
          if (!(el.textContent || "").trim()) return;
          const box = el.getBoundingClientRect();
          if (box.width < 6 || box.height < 6) return;
          if (box.top < 0 || box.bottom > innerHeight) return;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || +cs.opacity < 0.6) return;
          const fg = parse(cs.color);
          if (fg.length < 3 || fg[3] === 0) return; // gradient-clipped text
          // A background-image can't be sampled, so its text is out of scope.
          let n = el;
          let painted = false;
          while (n && n !== document.documentElement) {
            if (getComputedStyle(n).backgroundImage !== "none") painted = true;
            n = n.parentElement;
          }
          if (painted) return;
          const bg = backdrop(el);
          if (bg.length < 3) return;
          const a = lum(fg);
          const b = lum(bg);
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const size = parseFloat(cs.fontSize);
          const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
          const need = large ? 3 : 4.5;
          if (ratio < need) {
            out.push({
              sel: el.tagName.toLowerCase() + "." + (el.className || "(none)"),
              ratio: +ratio.toFixed(2),
              need,
            });
          }
        });
        return out;
      });
      found.forEach((f) => {
        if (!bad.has(f.sel)) bad.set(f.sel, f);
      });
    }
    const list = [...bad.values()];
    check(
      `${scheme} theme meets AA`,
      list.length === 0,
      list.length
        ? list
            .slice(0, 6)
            .map((f) => `${f.sel} ${f.ratio}<${f.need}`)
            .join(", ")
        : "no failures"
    );
    await cctx.close();
  }

  /* ---------------- the library tells you what a filter would show ---------------- */
  section("library filters");
  {
    const fctx = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      colorScheme: "dark",
    });
    const fp = await fctx.newPage();
    fp.on("pageerror", (e) => errors.push(`library pageerror: ${e.message}`));
    fp.on("console", (m) => {
      if (m.type() === "error") errors.push(`library console: ${m.text()}`);
    });
    await fp.goto(BASE, { waitUntil: "networkidle" });
    await fp.evaluate(() => {
      Store.skipOnboarding();
      window.Curriculum.chapters
        .slice(0, 9)
        .forEach((c) => Store.complete(c.id, true));
    });
    await visit(fp, BASE + "#/library");
    await fp.waitForTimeout(500);

    const read = () =>
      fp.evaluate(() => ({
        cards: document.querySelectorAll(".libcard").length,
        line: (document.querySelector(".libcount") || {}).innerText || "",
        pills: Object.fromEntries(
          [...document.querySelectorAll(".fpill")].map((b) => [
            b.dataset.k + ":" + b.dataset.v,
            Number((b.querySelector("[data-c]") || {}).textContent),
          ])
        ),
        greyed: document.querySelectorAll(".fpill.is-none").length,
      }));

    const base = await read();
    /* Faceted: each count is what that option yields with the other filters as
       they stand, so it always matches what clicking it produces. Before this,
       filtering 44 chapters to 6 changed only the length of the grid. */
    check(
      "each filter says how many chapters it would show",
      base.pills["state:done"] === 9 &&
        base.pills["state:todo"] === 35 &&
        base.pills["state:lab"] === 17 &&
        base.pills["diff:beginner"] +
          base.pills["diff:intermediate"] +
          base.pills["diff:advanced"] ===
          44,
      JSON.stringify(base.pills)
    );
    check(
      "and the result line matches the grid",
      /44 of 44/.test(base.line) && base.cards === 44,
      `${base.line} vs ${base.cards} cards`
    );

    await fp.locator(".fpill", { hasText: "Has lab" }).click();
    await fp.waitForTimeout(350);
    const lab = await read();
    await fp.locator(".fpill", { hasText: "Advanced" }).click();
    await fp.waitForTimeout(350);
    const both = await read();
    check(
      "a count predicts exactly what clicking it produces",
      lab.cards === base.pills["state:lab"] &&
        both.cards === lab.pills["diff:advanced"] &&
        /17 of 44/.test(lab.line) &&
        new RegExp(`${both.cards} of 44`).test(both.line),
      `${base.pills["state:lab"]}->${lab.cards}, ${lab.pills["diff:advanced"]}->${both.cards}`
    );

    await fp.locator("input").first().fill("kubernetes");
    await fp.waitForTimeout(450);
    const none = await read();
    check(
      "a filter that would empty the grid is greyed before you click it",
      none.cards === 0 &&
        none.greyed === 8 &&
        (await fp.locator(".empty").count()) === 1,
      JSON.stringify({ cards: none.cards, greyed: none.greyed })
    );
    await fctx.close();
  }

  /* ---------------- the glossary is a stepping stone, not a dead end ---------------- */
  section("glossary cross-references");
  {
    const yctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const yp = await yctx.newPage();
    yp.on("pageerror", (e) => errors.push(`glossary pageerror: ${e.message}`));
    yp.on("console", (m) => {
      if (m.type() === "error") errors.push(`glossary console: ${m.text()}`);
    });
    await yp.goto(BASE + "#/glossary", { waitUntil: "networkidle" });
    await yp.evaluate(() => Store.skipOnboarding());
    await yp.waitForTimeout(500);

    const cards = await yp.evaluate(() => ({
      terms: document.querySelectorAll(".gterm").length,
      links: document.querySelectorAll(".gterm__ch").length,
      resolve: [...document.querySelectorAll(".gterm__ch")].every((a) => {
        const id = a.getAttribute("href").replace("#/chapter/", "");
        return window.Curriculum.chapters.some((c) => c.id === id);
      }),
    }));
    check(
      "every glossary term links to the chapter that teaches it",
      cards.terms >= 50 && cards.links === cards.terms && cards.resolve,
      JSON.stringify(cards)
    );
    await yp.locator(".gterm__ch").first().click();
    await yp.waitForTimeout(500);
    check(
      "and that link opens the chapter",
      (await yp.evaluate(() => location.hash)).startsWith("#/chapter/"),
      await yp.evaluate(() => location.hash)
    );

    /* The reverse, derived from the same field, so the two cannot disagree. */
    await yp.goto(BASE + "#/chapter/hybrid-rerank", {
      waitUntil: "networkidle",
    });
    await yp.waitForTimeout(500);
    const aside = await yp.evaluate(() => {
      const t = document.querySelector(".chterms");
      if (!t) return null;
      const expected = window.Curriculum.glossary
        .filter((g) => g.ch === "hybrid-rerank")
        .map((g) => g.t);
      const shown = [...t.querySelectorAll("a")].map((a) => a.innerText);
      return {
        shown,
        expected,
        tips: [...t.querySelectorAll("a")].every(
          (a) => (a.title || "").length > 20
        ),
      };
    });
    check(
      "a chapter lists the terms it defines, with their definitions on hover",
      !!aside &&
        aside.shown.join() === aside.expected.join() &&
        aside.shown.length >= 3 &&
        aside.tips,
      JSON.stringify(aside)
    );

    const cover = await yp.evaluate(async () => {
      const ids = window.Curriculum.chapters.map((c) => c.id);
      const expected = new Set(window.Curriculum.glossary.map((g) => g.ch));
      let shown = 0;
      const wrong = [];
      for (const id of ids) {
        location.hash = "#/chapter/" + id;
        await new Promise((r) => setTimeout(r, 50));
        const has = !!document.querySelector(".chterms");
        if (has) shown++;
        if (has !== expected.has(id)) wrong.push(id);
      }
      return { shown, expected: expected.size, wrong };
    });
    check(
      "it appears on exactly the chapters that define a term",
      cover.wrong.length === 0 && cover.shown === cover.expected,
      JSON.stringify(cover)
    );
    await yctx.close();
  }

  /* ---------------- readiness diagnostic ---------------- */
  /* The one number a learner might act on — "start applying" or "spend another
     month on evals" — so the checks here are about whether it can be trusted:
     does it move when work is done, does it stay inside its own scale, and does
     the advice it gives agree with the roadmap next to it. */
  section("readiness");
  {
    const rctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const rp = await rctx.newPage();
    rp.on("pageerror", (e) => errors.push(`readiness pageerror: ${e.message}`));
    rp.on("console", (m) => {
      if (m.type() === "error") errors.push(`readiness console: ${m.text()}`);
    });

    await rp.goto(BASE + "#/readiness", { waitUntil: "networkidle" });
    await rp.evaluate(() => Store.skipOnboarding());
    await rp.waitForTimeout(500);

    const fresh = await rp.evaluate(() => ({
      pct: (document.querySelector(".rdhero__pct") || {}).innerText || "",
      head: (document.querySelector(".rdhero__body h2") || {}).innerText || "",
      rows: document.querySelectorAll(".rdrow").length,
      comps: window.Curriculum.competencies.length,
      segs: document.querySelectorAll(".rdscale__seg").length,
      bands: window.Curriculum.readinessBands.length,
      acts: document.querySelectorAll(".rdact").length,
      /* Every action on a fresh account must be in phase 1. A ranking that goes
         by raw lift-per-item sends a beginner to a Phase 7 lab. */
      actPhases: window.Curriculum.readinessActions({}, 6).map((a) => a.phase),
      firstPhase: window.Curriculum.phases.slice().sort((a, b) => a.n - b.n)[0]
        .id,
    }));
    check(
      "a fresh account scores 0 and says so without a band name",
      fresh.pct.replace(/\s/g, "") === "0%" &&
        /start anywhere/i.test(fresh.head),
      JSON.stringify({ pct: fresh.pct, head: fresh.head })
    );
    check(
      "one row per competency, one scale segment per band",
      fresh.rows === fresh.comps &&
        fresh.rows === 7 &&
        fresh.segs === fresh.bands,
      JSON.stringify(fresh)
    );
    check(
      "the next actions all sit in the first phase, not the highest-lift one",
      fresh.acts === 6 &&
        fresh.actPhases.length === 6 &&
        fresh.actPhases.every((p) => p === fresh.firstPhase),
      JSON.stringify({ acts: fresh.acts, phases: fresh.actPhases })
    );

    /* Rows are sorted by weighted shortfall, and that figure is printed on each
       row precisely so the order is checkable by eye. If the two disagree the
       page is arguing with itself. */
    const sorted = await rp.evaluate(() =>
      [...document.querySelectorAll(".rdrow")].map((n) => {
        const w = n.querySelector(".rdrow__w").innerText;
        const m = w.match(/([\d.]+) pts/);
        return m ? Number(m[1]) : null;
      })
    );
    check(
      "rows descend by the points-to-gain figure printed on them",
      sorted.every((v) => v !== null) &&
        sorted.every((v, i) => i === 0 || sorted[i - 1] >= v),
      JSON.stringify(sorted)
    );

    /* Work in, score up. Seeding through the real Store rather than writing
       localStorage directly, so this exercises the same path the app uses. */
    const moved = await rp.evaluate(() => {
      const before = Store.readiness().overall;
      const C = window.Curriculum;
      C.chapters
        .filter((c) => c.phase === "foundations")
        .forEach((c) => {
          Store.complete(c.id);
          if ((c.quiz || []).length)
            Store.saveQuiz(c.id, c.quiz.length, c.quiz.length);
          if (c.lab) Store.labTouched(c.lab);
        });
      const after = Store.readiness();
      return { before, after: after.overall, band: after.band.name };
    });
    check(
      "completing a phase moves the score",
      moved.before === 0 && moved.after > 0 && moved.after < 100,
      JSON.stringify(moved)
    );

    await visit(rp, BASE + "#/readiness");
    await rp.waitForTimeout(500);
    const after = await rp.evaluate(() => ({
      pct: (document.querySelector(".rdhero__pct") || {}).innerText || "",
      here:
        (document.querySelector(".rdscale__seg.is-here .rdscale__lbl") || {})
          .innerText || "",
      band: (document.querySelector(".rdhero__body h2") || {}).innerText || "",
      /* The finished phase must not still be recommended. */
      actPhases: [...document.querySelectorAll(".rdact")].length
        ? window.Curriculum.readinessActions(Store.signals(), 6).map(
            (a) => a.phase
          )
        : [],
      fractions: [...document.querySelectorAll(".rdrow")]
        .map((n) => n.querySelector(".rdpart__v").innerText)
        .filter(Boolean).length,
    }));
    check(
      "the highlighted band on the scale is the one the hero names",
      after.here === after.band && after.band.length > 3,
      JSON.stringify({ here: after.here, band: after.band })
    );
    check(
      "a finished phase stops being recommended",
      after.actPhases.length > 0 &&
        after.actPhases.every((p) => p !== "foundations"),
      JSON.stringify(after.actPhases)
    );

    /* Every action must go somewhere real, and the top one must actually work —
       the contents-link bug was a link that existed and did nothing. */
    const hrefs = await rp.evaluate(() =>
      [...document.querySelectorAll(".rdact")].map((a) =>
        a.getAttribute("href")
      )
    );
    check(
      "every next action points at a chapter or the projects page",
      hrefs.length === 6 &&
        hrefs.every((h) => h === "#/projects" || h.startsWith("#/chapter/")),
      JSON.stringify(hrefs)
    );
    await rp.locator(".rdact").first().click();
    await rp.waitForTimeout(500);
    check(
      "and clicking the first one lands on a real page",
      await rp.evaluate(
        () =>
          !!document.querySelector("h1") &&
          (location.hash.startsWith("#/chapter/") ||
            location.hash === "#/projects")
      ),
      await rp.evaluate(() => location.hash)
    );

    /* The dashboard summary is the entry point; if it disagrees with the page it
       links to, one of them is lying. */
    await rp.goto(BASE + "#/dashboard", { waitUntil: "networkidle" });
    await rp.waitForTimeout(500);
    const dash = await rp.evaluate(() => {
      const card = [...document.querySelectorAll(".card")].filter((c) =>
        /interview readiness/i.test(c.innerText)
      )[0];
      if (!card) return null;
      return {
        ring: (card.querySelector(".ring__label") || {}).innerText || "",
        overall: Store.readiness().overall,
        link: (card.querySelector("a") || {}).getAttribute?.("href") || "",
      };
    });
    check(
      "the dashboard card shows the same score and links to the breakdown",
      !!dash &&
        dash.ring.replace(/\s/g, "") === dash.overall + "%" &&
        dash.link === "#/readiness",
      JSON.stringify(dash)
    );

    /* Everything done: the ceiling is reachable and the advice stops. */
    const full = await rp.evaluate(() => {
      const C = window.Curriculum;
      C.chapters.forEach((c) => {
        Store.complete(c.id);
        if ((c.quiz || []).length)
          Store.saveQuiz(c.id, c.quiz.length, c.quiz.length);
        if (c.lab) Store.labTouched(c.lab);
      });
      C.projects.forEach((p) =>
        p.tasks.forEach((_, i) => {
          if (!(Store.state().projects[p.id] || {})[i]) Store.projTask(p.id, i);
        })
      );
      const r = Store.readiness();
      return {
        overall: r.overall,
        band: r.band.name,
        gaps: r.gaps.length,
        acts: C.readinessActions(Store.signals(), 6).length,
      };
    });
    check(
      "finishing everything reaches 100 with no gaps and nothing left to suggest",
      full.overall === 100 && full.gaps === 0 && full.acts === 0,
      JSON.stringify(full)
    );

    await visit(rp, BASE + "#/readiness");
    await rp.waitForTimeout(500);
    const done = await rp.evaluate(() => ({
      acts: document.querySelectorAll(".rdact").length,
      rows: document.querySelectorAll(".rdrow.is-done").length,
      complete: [...document.querySelectorAll(".rdrow__w")].filter((n) =>
        /complete/.test(n.innerText)
      ).length,
    }));
    check(
      "and the page drops the action list rather than showing an empty one",
      done.acts === 0 && done.rows === 7 && done.complete === 7,
      JSON.stringify(done)
    );

    await rctx.close();
  }

  /* ---------------- session planner ---------------- */
  /* The promise is "this fits the time you said". A plan that overruns is worse
     than the menu it replaced, because the learner trusted the number. */
  section("session planner");
  {
    const sctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const sp = await sctx.newPage();
    sp.on("pageerror", (e) => errors.push(`session pageerror: ${e.message}`));
    sp.on("console", (m) => {
      if (m.type() === "error") errors.push(`session console: ${m.text()}`);
    });
    await sp.goto(BASE + "#/dashboard", { waitUntil: "networkidle" });
    await sp.evaluate(() => Store.skipOnboarding());
    await sp.waitForTimeout(500);

    const shape = await sp.evaluate(() => ({
      card: !!document.querySelector(".sesh"),
      chips: [...document.querySelectorAll(".sesh__chip")].map(
        (b) => b.innerText
      ),
      lengths: window.Curriculum.sessionLengths.map((m) => m + " min"),
      on: [...document.querySelectorAll(".sesh__chip.is-on")].length,
      pressed: [
        ...document.querySelectorAll('.sesh__chip[aria-pressed="true"]'),
      ].length,
      rows: document.querySelectorAll(".seshrow").length,
      note: (document.querySelector(".sesh__note") || {}).innerText || "",
    }));
    check(
      "the planner offers one chip per session length, exactly one selected",
      shape.card &&
        shape.chips.join("|") === shape.lengths.join("|") &&
        shape.on === 1 &&
        shape.pressed === 1,
      JSON.stringify(shape)
    );
    check(
      "and a fresh learner gets a plan with a note, not an empty box",
      shape.rows > 0 && shape.note.length > 20,
      JSON.stringify({ rows: shape.rows, note: shape.note })
    );

    /* Every chip, against the engine's own arithmetic and against the rendered
       minutes — a plan that is right in JS and wrong on screen is still wrong. */
    const perChip = [];
    for (const label of shape.lengths) {
      await sp.locator(`.sesh__chip:has-text("${label}")`).click();
      await sp.waitForTimeout(200);
      perChip.push(
        await sp.evaluate((lbl) => {
          const m = Number(lbl.replace(/\D/g, ""));
          /* Scoped to the list: the stretch item carries its own minutes class
             precisely so a sum of committed time cannot pick it up. */
          const shown = [
            ...document.querySelectorAll(".sesh__list .seshrow__m"),
          ].map((n) => Number(n.innerText.replace(/\D/g, "")));
          const plan = Store.session(m, 0);
          return {
            m,
            sum: shown.reduce((a, b) => a + b, 0),
            planUsed: plan.used,
            rows: shown.length,
            planRows: plan.items.length,
            selected: (document.querySelector(".sesh__chip.is-on") || {})
              .innerText,
          };
        }, label)
      );
    }
    check(
      "every chip renders a plan whose printed minutes fit the budget",
      perChip.every((c) => c.sum <= c.m && c.sum === c.planUsed),
      JSON.stringify(perChip)
    );
    check(
      "the rendered rows match the plan the engine produced",
      perChip.every((c) => c.rows === c.planRows),
      JSON.stringify(perChip.map((c) => [c.m, c.rows, c.planRows]))
    );
    check(
      "clicking a chip selects it",
      perChip.every((c) => c.selected === c.m + " min"),
      JSON.stringify(perChip.map((c) => c.selected))
    );

    /* The stretch item is an offer, not scheduled time — so it must never be
       counted in the printed total. */
    const stretch = await sp.evaluate(() => {
      const lens = window.Curriculum.sessionLengths;
      for (const m of lens) {
        const plan = Store.session(m, 0);
        if (plan.stretch)
          return { m, stretch: plan.stretch.label, used: plan.used };
      }
      return null;
    });
    if (stretch) {
      await sp.locator(`.sesh__chip:has-text("${stretch.m} min")`).click();
      await sp.waitForTimeout(250);
      const shownStretch = await sp.evaluate(() => {
        const s = document.querySelector(".sesh__stretch");
        const rows = [
          ...document.querySelectorAll(".sesh__list .seshrow__m"),
        ].map((n) => Number(n.innerText.replace(/\D/g, "")));
        return {
          present: !!s,
          inRows: document.querySelectorAll(".seshrow").length,
          sum: rows.reduce((a, b) => a + b, 0),
          href: s ? s.getAttribute("href") : null,
        };
      });
      check(
        "a stretch item is offered separately and not counted in the plan",
        shownStretch.present &&
          shownStretch.sum === stretch.used &&
          (shownStretch.href || "").startsWith("#/chapter/"),
        JSON.stringify({ ...shownStretch, expected: stretch })
      );
    }

    /* Work done changes the plan, and the first row of a mid-course session is the
       chapter you left open rather than a new one. */
    const moved = await sp.evaluate(() => {
      const C = window.Curriculum;
      const first = C.phases.slice().sort((a, b) => a.n - b.n)[0].id;
      const chs = C.chapters.filter((c) => c.phase === first);
      chs.slice(0, chs.length - 1).forEach((c) => Store.complete(c.id));
      Store.visit(chs[chs.length - 1].id);
      return { resumeId: chs[chs.length - 1].id };
    });
    await visit(sp, BASE + "#/dashboard");
    await sp.waitForTimeout(500);
    const after = await sp.evaluate(() => {
      const rows = [...document.querySelectorAll(".sesh__list .seshrow__go")];
      /* Due cards legitimately come first — they decay. The rule is that the
         chapter you left open beats any *new* chapter, so find the first row that
         goes to a chapter at all. */
      const chapterRows = rows.filter((a) =>
        (a.getAttribute("href") || "").startsWith("#/chapter/")
      );
      return {
        hrefs: rows.map((a) => a.getAttribute("href")),
        firstChapter: chapterRows.length
          ? chapterRows[0].getAttribute("href")
          : null,
        firstChapterText: chapterRows.length ? chapterRows[0].innerText : "",
      };
    });
    check(
      "the chapter you left open is the first chapter the plan sends you to",
      after.firstChapter === "#/chapter/" + moved.resumeId &&
        /partway|did not finish/i.test(after.firstChapterText),
      JSON.stringify({ ...after, want: moved.resumeId })
    );

    await sp
      .locator(`.sesh__list .seshrow__go[href="#/chapter/${moved.resumeId}"]`)
      .first()
      .click();
    await sp.waitForTimeout(500);
    check(
      "and its row actually navigates",
      (await sp.evaluate(() => location.hash)) ===
        "#/chapter/" + moved.resumeId,
      await sp.evaluate(() => location.hash)
    );

    await sctx.close();
  }

  /* ---------------- portfolio evidence and export ---------------- */
  /* The only output that leaves the browser and gets read by someone making a
     hiring decision. A bug here is not a wrong pixel, it is a claim in a document
     with the learner's name on it. */
  section("portfolio");
  {
    const pctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const pp = await pctx.newPage();
    pp.on("pageerror", (e) => errors.push(`portfolio pageerror: ${e.message}`));
    pp.on("console", (m) => {
      if (m.type() === "error") errors.push(`portfolio console: ${m.text()}`);
    });
    await pp.goto(BASE + "#/projects", { waitUntil: "networkidle" });
    await pp.evaluate(() => Store.skipOnboarding());
    await pp.waitForTimeout(500);

    const fresh = await pp.evaluate(() => ({
      panel: !!document.querySelector(".port"),
      forms: document.querySelectorAll(".evid").length,
      projects: window.Curriculum.projects.length,
      fields: document.querySelectorAll(".evfield__i").length,
      metrics: window.Curriculum.projects.reduce(
        (n, p) => n + p.metrics.length,
        0
      ),
      areas: document.querySelectorAll(".evfield__t").length,
      pre: (document.querySelector(".port__pre") || {}).textContent || "",
      note: (document.querySelector(".port__note") || {}).innerText || "",
    }));
    check(
      "every project offers an evidence form with one field per metric",
      fresh.forms === fresh.projects &&
        fresh.fields === fresh.metrics &&
        fresh.areas === fresh.projects,
      JSON.stringify(fresh)
    );
    check(
      "an untouched portfolio shows guidance, not an empty document",
      !fresh.pre && /Tick a milestone/i.test(fresh.note),
      JSON.stringify({ pre: fresh.pre.slice(0, 60), note: fresh.note })
    );

    /* Type into the real inputs rather than calling the store: this is the path a
       learner takes, and it exercises the debounce that writes it. */
    const target = await pp.evaluate(() => {
      const p = window.Curriculum.projects.filter((x) => x.id === "p-rag")[0];
      return { key: p.metrics[0].key, label: p.metrics[0].label, id: p.id };
    });
    /* The forms start collapsed — six projects of seven fields each, open by
       default, would bury the page. Open the one under test the way a learner
       would. */
    /* Located by the field's own id, not by card text: a "RAG System" text filter
       also matched the capstone, whose milestone links carry the title of the
       "Diagnosing a RAG System That Lies" chapter. */
    const evForm = pp.locator(`.evid:has(#ev-${target.id}-${target.key})`);
    check(
      "evidence forms start collapsed",
      !(await evForm.evaluate((n) => n.hasAttribute("open"))),
      "open by default"
    );
    await evForm.locator(".evid__sum").click();
    await pp.waitForTimeout(250);
    await pp
      .locator(`#ev-${target.id}-${target.key}`)
      .fill("40 questions, graded 0-2");
    await pp.waitForTimeout(600);
    check(
      "the summary counts what has been recorded",
      /1 of \d+ numbers recorded/.test(
        await evForm.locator(".evid__meta").innerText()
      ),
      await evForm.locator(".evid__meta").innerText()
    );
    const stored = await pp.evaluate(
      (t) => Store.evidence(t.id).metrics[t.key],
      target
    );
    check(
      "typing a number into the form persists it",
      stored === "40 questions, graded 0-2",
      String(stored)
    );

    /* A number with no milestone ticked must not manufacture a case study. */
    const beforeTick = await pp.evaluate(() => Store.portfolio().started);
    check(
      "a recorded number alone does not start a case study",
      beforeTick === 0,
      String(beforeTick)
    );

    const after = await pp.evaluate(() => {
      const p = window.Curriculum.projects.filter((x) => x.id === "p-rag")[0];
      p.tasks.forEach((_, i) => Store.projTask("p-rag", i));
      const r = Store.portfolio();
      return {
        started: r.started,
        words: r.words,
        hasValue: r.markdown.includes("40 questions, graded 0-2"),
        /* Nothing unrecorded may appear as a row. */
        inventedRows: p.metrics
          .slice(1)
          .filter((m) => r.markdown.includes("| " + m.label + " |")).length,
        missing: r.missing.length,
      };
    });
    check(
      "ticking milestones assembles a case study from only what was recorded",
      after.started === 1 &&
        after.hasValue &&
        after.inventedRows === 0 &&
        after.words > 100,
      JSON.stringify(after)
    );

    await visit(pp, BASE + "#/projects");
    await pp.waitForTimeout(600);
    const rendered = await pp.evaluate(() => {
      const pre = document.querySelector(".port__pre");
      return {
        shown: !!pre,
        matchesEngine: pre
          ? pre.textContent === Store.portfolio().markdown
          : false,
        gaps: document.querySelectorAll(".port__gap").length,
        buttons: [...document.querySelectorAll(".port button")].map((b) =>
          b.innerText.trim()
        ),
      };
    });
    check(
      "the panel renders exactly the document the engine produced",
      rendered.shown && rendered.matchesEngine,
      JSON.stringify(rendered)
    );
    check(
      "unevidenced projects are named rather than quietly omitted",
      rendered.gaps >= 1 && rendered.buttons.length === 2,
      JSON.stringify(rendered)
    );

    /* The readiness claim: absent while the score is low, present once it is a
       claim worth making. */
    const claim = await pp.evaluate(() => {
      const at = window.Curriculum.portfolioClaimAt();
      const low = Store.readiness().overall;
      const before = Store.portfolio().markdown.includes("Self-assessed");
      const C = window.Curriculum;
      C.chapters.forEach((c) => {
        Store.complete(c.id);
        if ((c.quiz || []).length)
          Store.saveQuiz(c.id, c.quiz.length, c.quiz.length);
        if (c.lab) Store.labTouched(c.lab);
      });
      C.projects.forEach((p) =>
        p.tasks.forEach((_, i) => {
          if (!(Store.state().projects[p.id] || {})[i]) Store.projTask(p.id, i);
        })
      );
      const high = Store.readiness().overall;
      return {
        at,
        low,
        high,
        before,
        after: Store.portfolio().markdown.includes("Self-assessed"),
      };
    });
    check(
      "a low readiness score is left out of the export, a high one is quoted",
      claim.low < claim.at &&
        claim.high >= claim.at &&
        claim.before === false &&
        claim.after === true,
      JSON.stringify(claim)
    );

    /* Download uses a blob URL, so intercept the download rather than the network. */
    await visit(pp, BASE + "#/projects");
    await pp.waitForTimeout(600);
    const dlPromise = pp
      .waitForEvent("download", { timeout: 5000 })
      .catch(() => null);
    await pp.locator('.port button:has-text("Download")').click();
    const dl = await dlPromise;
    check(
      "the download button produces a .md file",
      !!dl && /\.md$/.test(dl.suggestedFilename()),
      dl ? dl.suggestedFilename() : "no download fired"
    );

    await pctx.close();
  }

  /* ---------------- landing page pitch and nav grouping ---------------- */
  /* Both are "does a stranger understand what this is" checks. The apparatus that
     differentiates this from a course was invisible on the landing page for four
     commits, and eleven flat nav entries stopped being scannable at about seven. */
  section("pitch and navigation");
  {
    /* Its own context: the main `page` is closed part-way through the suite, and
       this section runs after that point. */
    const lctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const lp = await lctx.newPage();
    lp.on("pageerror", (e) => errors.push(`pitch pageerror: ${e.message}`));
    lp.on("console", (m) => {
      if (m.type() === "error") errors.push(`pitch console: ${m.text()}`);
    });
    const lgo = async (hash) => {
      await visit(lp, BASE + hash);
      await lp.evaluate(() => Store.skipOnboarding());
      await lp.waitForTimeout(300);
    };
    await lgo("");
    const pitch = await lp.evaluate(() => {
      const text = document.body.innerText;
      const cards = [...document.querySelectorAll(".acard")].map((c) => ({
        title: (c.querySelector("h3") || {}).innerText || "",
        href: (c.querySelector(".acard__go") || {}).getAttribute?.("href"),
      }));
      return {
        cards,
        drills: window.Curriculum.drills.length,
        /* Each of the four surfaces has to be findable from the pitch, or a
           stranger has no way to know it exists. */
        mentionsReadiness: /readiness/i.test(text),
        mentionsDrills: /drill|rehears/i.test(text),
        mentionsPortfolio: /portfolio/i.test(text),
        mentionsSession: /minutes/i.test(text),
        drillCountShown: text.includes(String(window.Curriculum.drills.length)),
      };
    });
    check(
      "the landing page names all four getting-hired surfaces",
      pitch.mentionsReadiness &&
        pitch.mentionsDrills &&
        pitch.mentionsPortfolio &&
        pitch.mentionsSession,
      JSON.stringify(pitch)
    );
    check(
      "with a card each, every one linking to the real surface",
      pitch.cards.length === 4 &&
        pitch.cards.every((c) => c.title.length > 8) &&
        new Set(pitch.cards.map((c) => c.href)).size === 4 &&
        pitch.cards.every((c) =>
          ["#/readiness", "#/dashboard", "#/interview", "#/projects"].includes(
            c.href
          )
        ),
      JSON.stringify(pitch.cards)
    );

    /* Every apparatus card must actually land somewhere real — a pitch that links
       into nothing is worse than no pitch. */
    for (const card of pitch.cards) {
      await lgo("");
      await lp.locator(`.acard__go[href="${card.href}"]`).click();
      await lp.waitForTimeout(400);
      const landed = await lp.evaluate(() => ({
        hash: location.hash,
        h1: !!document.querySelector("h1"),
        len: document.body.innerText.length,
      }));
      check(
        `"${card.title}" leads to a real page`,
        landed.hash === card.href && landed.h1 && landed.len > 300,
        JSON.stringify(landed)
      );
    }

    await lgo("#/dashboard");
    const nav = await lp.evaluate(() => {
      const g = document.querySelector(".navgroup");
      const kids = [...g.children];
      const labels = kids
        .filter((n) => n.classList.contains("navgroup__label"))
        .map((n) => n.innerText.trim());
      const links = kids.filter((n) => n.classList.contains("navlink"));
      return {
        labels,
        links: links.length,
        routes: App.routes().length,
        /* No heading may be left dangling with nothing under it. */
        emptyGroups: labels.filter((l, i) => {
          const at = kids.findIndex(
            (n) =>
              n.classList.contains("navgroup__label") &&
              n.innerText.trim() === l
          );
          const next = kids[at + 1];
          return !next || !next.classList.contains("navlink");
        }).length,
        /* The trailing utility item is separated rather than absorbed into the
           previous heading. */
        seps: document.querySelectorAll(".navlink--sep").length,
        lastIsSettings:
          links[links.length - 1].getAttribute("href") === "#/settings" &&
          links[links.length - 1].classList.contains("navlink--sep"),
      };
    });
    check(
      "the sidebar is grouped, with every heading followed by links",
      nav.labels.length >= 3 && nav.emptyGroups === 0,
      JSON.stringify(nav)
    );
    check(
      "every route the app declares has a nav entry",
      /* Landing is reached by the brand mark, not a nav link. */
      nav.links === nav.routes - 1,
      JSON.stringify({ links: nav.links, routes: nav.routes })
    );
    check(
      "Settings is separated from the group above it",
      nav.seps === 1 && nav.lastIsSettings,
      JSON.stringify(nav)
    );

    /* The badge rule, which the drill count got wrong first: a nav badge means
       something is waiting for you, not that content exists. */
    const badges = await lp.evaluate(() => {
      const fresh = document.querySelectorAll(".navlink__count").length;
      const C = window.Curriculum;
      Store.rateDrill(C.drills[0].id, 0);
      Store.rateDrill(C.drills[1].id, 2);
      return { fresh, weak: Store.drillStats("all").weak };
    });
    await lgo("#/dashboard");
    const after = await lp.evaluate(() => {
      const link = document.querySelector('[data-nav="#/interview"]');
      const b = link.querySelector(".navlink__count");
      return { text: b ? b.innerText.trim() : null };
    });
    check(
      "a fresh account carries no nav badges at all",
      badges.fresh === 0,
      String(badges.fresh)
    );
    check(
      "the interview badge counts fumbled drills, not untried ones",
      after.text === String(badges.weak) && badges.weak === 1,
      JSON.stringify({ ...after, weak: badges.weak })
    );

    await lctx.close();
  }

  /* ---------------- interview drills ---------------- */
  /* The sequence is the feature: question, clock, then rubric. Showing the rubric
     alongside the question would turn the whole thing into a reading exercise,
     which is precisely the failure it exists to prevent. */
  /* ---------------- what reset actually destroys ---------------- */
  /* The warning was a hand-written list in two places and went stale the moment
     portfolio evidence existed: it promised to clear five things while also
     destroying every write-up the learner had typed. Both surfaces derive it now. */
  /* ---------------- dashboard economy ---------------- */
  /* The dashboard grew to nine blocks over five commits with nobody reviewing it as
     a whole. This is the editorial pass, pinned: no tile spending itself on a zero,
     no metric duplicated by a card lower down, and the two columns roughly balanced
     rather than one running 630px past the other. */
  section("dashboard economy");
  {
    const dctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const dp = await dctx.newPage();
    dp.on("pageerror", (e) => errors.push(`dash pageerror: ${e.message}`));
    dp.on("console", (m) => {
      if (m.type() === "error") errors.push(`dash console: ${m.text()}`);
    });
    await visit(dp, BASE + "#/dashboard");
    await dp.evaluate(() => {
      Store.skipOnboarding();
      const C = window.Curriculum;
      /* A realistic mid-course account: three phases read, some quizzes imperfect,
         a project underway, two drills attempted. */
      C.chapters
        .filter((c) =>
          ["foundations", "prompting", "building"].includes(c.phase)
        )
        .forEach((c) => {
          Store.complete(c.id);
          if ((c.quiz || []).length)
            Store.saveQuiz(c.id, Math.max(1, c.quiz.length - 1), c.quiz.length);
          if (c.lab) Store.labTouched(c.lab);
        });
      [0, 1, 2].forEach((i) => Store.projTask("p-classifier", i));
      Store.rateDrill(C.drills[0].id, 0);
      Store.rateDrill(C.drills[1].id, 2);
    });
    await visit(dp, BASE + "#/dashboard");
    await dp.waitForTimeout(600);

    const tiles = await dp.evaluate(() =>
      [...document.querySelectorAll(".dgrid .stat")].map((t) => ({
        label: (t.querySelector(".stat__lbl") || {}).innerText || "",
        n: (t.querySelector(".stat__n") || {}).innerText || "",
        sub: (t.querySelector(".stat__sub") || {}).innerText || "",
        top: Math.round(t.getBoundingClientRect().top),
      }))
    );
    check(
      "six stat tiles in clean rows, no ragged gap",
      tiles.length === 6 && new Set(tiles.map((t) => t.top)).size === 2,
      JSON.stringify(tiles.map((t) => [t.label, t.top]))
    );
    /* The editorial rule: a tile earns its space by carrying a number the learner
       would act on. Three used to spend themselves on a zero or on a figure the
       review card already gave. */
    check(
      "no tile is showing a bare zero at a realistic mid-course state",
      tiles.every((t) => t.n.trim() !== "0" && !/^0\D*$/.test(t.n.trim())),
      JSON.stringify(tiles.map((t) => [t.label, t.n]))
    );
    check(
      "the tiles cover all four things readiness weights, plus habit",
      [
        "Chapters",
        "Project milestones",
        "Quiz",
        "Labs",
        "Drills",
        "streak",
      ].every((want) =>
        tiles.some((t) => t.label.toLowerCase().includes(want.toLowerCase()))
      ),
      JSON.stringify(tiles.map((t) => t.label))
    );
    /* "Cards learned 0/56" sat above a "56 cards due" card on the same page. */
    check(
      "no tile duplicates the spaced-repetition card below it",
      !tiles.some((t) => /cards/i.test(t.label)),
      JSON.stringify(tiles.map((t) => t.label))
    );

    const cols = await dp.evaluate(() => {
      const [l, r] = document.querySelectorAll(".dcols > div");
      const h = (n) => Math.round(n.getBoundingClientRect().height);
      return {
        left: h(l),
        right: h(r),
        leftCards: l.children.length,
        rightCards: r.children.length,
        page: document.body.scrollHeight,
      };
    });
    check(
      "the two dashboard columns are roughly balanced",
      Math.abs(cols.left - cols.right) < Math.max(cols.left, cols.right) * 0.35,
      JSON.stringify(cols)
    );
    check(
      "and the badge grid is in the wide column, so it is not the tallest block",
      cols.leftCards === 4 && cols.rightCards === 3,
      JSON.stringify(cols)
    );

    /* The tile strip must never become a column of six. */
    for (const w of [1440, 1100, 900, 640, 390]) {
      await dp.setViewportSize({ width: w, height: 900 });
      await dp.waitForTimeout(200);
      const shape = await dp.evaluate(() => {
        const tops = new Set(
          [...document.querySelectorAll(".dgrid .stat")].map((t) =>
            Math.round(t.getBoundingClientRect().top)
          )
        );
        return {
          rows: tops.size,
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        };
      });
      check(
        `stat tiles stay a strip at ${w}px (${shape.rows} rows)`,
        shape.rows <= 3 && shape.overflow <= 2,
        JSON.stringify(shape)
      );
    }

    await dctx.close();
  }

  section("reset warning");
  {
    const wctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const wp = await wctx.newPage();
    wp.on("pageerror", (e) => errors.push(`reset pageerror: ${e.message}`));
    wp.on("console", (m) => {
      if (m.type() === "error") errors.push(`reset console: ${m.text()}`);
    });
    await visit(wp, BASE + "#/settings");
    await wp.evaluate(() => Store.skipOnboarding());
    await wp.waitForTimeout(400);

    const copy = await wp.evaluate(() => {
      const rows = [...document.querySelectorAll(".setrow")];
      const row = rows.filter((r) => /Reset everything/.test(r.innerText))[0];
      const kinds = Store.dataKinds.filter((k) => k.cleared && k.label);
      return {
        shown: row ? row.innerText : "",
        derived: Store.resetWarning(),
        missing: kinds
          .filter((k) => !(row ? row.innerText : "").includes(k.label))
          .map((k) => k.label),
      };
    });
    check(
      "the Settings row names every category a reset destroys",
      copy.missing.length === 0 && copy.shown.includes(copy.derived),
      JSON.stringify(copy)
    );
    check(
      "including the portfolio write-ups, which are the only prose here",
      /portfolio/i.test(copy.shown) && /write-up/i.test(copy.shown),
      copy.shown
    );

    /* And the dialog, which is the last thing anyone reads before losing it. */
    await wp.locator('.setrow:has-text("Reset everything") button').click();
    await wp.waitForTimeout(300);
    const dialog = await wp.evaluate(() => {
      const box = document.querySelector(".modal__box");
      return {
        text: box ? box.innerText : "",
        derived: Store.resetWarning(),
        role: box ? box.getAttribute("role") : null,
      };
    });
    check(
      "the confirm dialog shows the same derived warning",
      dialog.text.includes(dialog.derived) && dialog.role === "dialog",
      JSON.stringify({ role: dialog.role, len: dialog.text.length })
    );
    await wp.keyboard.press("Escape");
    await wp.waitForTimeout(300);

    /* Reset really does clear the new state, and really does keep the theme. */
    const cleared = await wp.evaluate(() => {
      Store.setTheme("light");
      Store.setMetric("p-rag", "recallAfter", "0.82");
      Store.setEvidenceNotes("p-rag", "prose that would hurt to lose");
      Store.rateDrill(window.Curriculum.drills[0].id, 0);
      const before = {
        evidence: Object.keys(Store.state().evidence).length,
        drills: Object.keys(Store.state().drills).length,
      };
      Store.reset();
      return {
        before,
        after: {
          evidence: Object.keys(Store.state().evidence).length,
          drills: Object.keys(Store.state().drills).length,
        },
        theme: Store.state().theme,
      };
    });
    check(
      "reset clears portfolio evidence and drill history but keeps the theme",
      cleared.before.evidence === 1 &&
        cleared.before.drills === 1 &&
        cleared.after.evidence === 0 &&
        cleared.after.drills === 0 &&
        cleared.theme === "light",
      JSON.stringify(cleared)
    );

    await wctx.close();
  }

  section("interview drills");
  {
    const ictx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "dark",
    });
    const ip = await ictx.newPage();
    ip.on("pageerror", (e) => errors.push(`drills pageerror: ${e.message}`));
    ip.on("console", (m) => {
      if (m.type() === "error") errors.push(`drills console: ${m.text()}`);
    });
    await ip.goto(BASE + "#/interview", { waitUntil: "networkidle" });
    await ip.evaluate(() => Store.skipOnboarding());
    await ip.waitForTimeout(500);

    const start = await ip.evaluate(() => ({
      chips: document.querySelectorAll(".drillchip").length,
      comps: window.Curriculum.competencies.length,
      question: (document.querySelector(".drill__q") || {}).innerText || "",
      /* Nothing from the rubric may be in the DOM before the reveal. Hiding it with
         CSS would leave it one devtools inspection — or one screen reader — away. */
      rubric: document.querySelectorAll(".drillcol").length,
      rates: document.querySelectorAll(".ratebtn").length,
      probe: document.querySelectorAll(".drill__probe").length,
      follow: document.querySelectorAll(".drill__follow").length,
      clock: (document.querySelector(".drill__t") || {}).innerText || "",
      pos: (document.querySelector(".drill__pos") || {}).innerText || "",
      total: window.Curriculum.drills.length,
    }));
    check(
      "one chip per competency plus an everything chip",
      start.chips === start.comps + 1,
      JSON.stringify({ chips: start.chips, comps: start.comps })
    );
    check(
      "the question is shown and the rubric is not in the document at all",
      start.question.length > 30 &&
        start.rubric === 0 &&
        start.rates === 0 &&
        start.probe === 0 &&
        start.follow === 0,
      JSON.stringify(start)
    );
    check(
      "the clock starts at zero and the position is 1 of the bank",
      start.clock === "0:00" && start.pos === "1 of " + start.total,
      JSON.stringify({ clock: start.clock, pos: start.pos })
    );

    /* The clock has to actually run — a timer that renders and never ticks makes
       the pressure fictional. */
    await ip.locator('.drill button:has-text("Start answering")').click();
    await ip.waitForTimeout(2400);
    const ran = await ip.evaluate(
      () => (document.querySelector(".drill__t") || {}).innerText
    );
    check(
      "the clock ticks once started",
      ran !== "0:00" && /^\d+:\d\d$/.test(ran),
      ran
    );

    await ip.locator('.drill button:has-text("show the rubric")').click();
    await ip.waitForTimeout(400);
    const shown = await ip.evaluate(() => {
      const first = window.Curriculum.drillQueue("all", Store.drillState())[0]
        .drill;
      const good = [...document.querySelectorAll(".drillcol--good li")].map(
        (n) => n.innerText.trim()
      );
      const bad = [...document.querySelectorAll(".drillcol--bad li")].map((n) =>
        n.innerText.trim()
      );
      return {
        strong: good.length,
        weak: bad.length,
        wantStrong: first.strong.length,
        wantWeak: first.weak.length,
        rates: document.querySelectorAll(".ratebtn").length,
        probe: document.querySelectorAll(".drill__probe").length,
        follow: document.querySelectorAll(".drill__follow").length,
        chLink: (document.querySelector(".drill__ch") || {}).getAttribute?.(
          "href"
        ),
        wantCh: "#/chapter/" + first.ch,
        /* Whether the clock still offers to run is checked just below, with a
           text scan — `:has-text()` is a Playwright locator pseudo-class and
           throws inside querySelectorAll. */
      };
    });
    check(
      "revealing shows the full rubric, both columns, with the probe and follow-up",
      shown.strong === shown.wantStrong &&
        shown.weak === shown.wantWeak &&
        shown.strong >= 3 &&
        shown.probe === 1 &&
        shown.follow === 1 &&
        shown.rates === 3,
      JSON.stringify(shown)
    );
    check(
      "and links back to the chapter that prepares the question",
      shown.chLink === shown.wantCh,
      JSON.stringify({ got: shown.chLink, want: shown.wantCh })
    );

    const noResume = await ip.evaluate(
      () =>
        ![...document.querySelectorAll(".drill button")].some((b) =>
          /Resume|Pause|Start answering/.test(b.innerText)
        )
    );
    check(
      "the clock stops offering to run once the rubric is out",
      noResume,
      "a start/resume control survived the reveal"
    );

    /* Rating advances, records, and pays once. */
    const rated = await ip.evaluate(() => {
      const before = Store.state().xp;
      const first = window.Curriculum.drillQueue("all", Store.drillState())[0]
        .drill.id;
      return { before, first };
    });
    await ip.locator(".ratebtn--0").click();
    await ip.waitForTimeout(400);
    const advanced = await ip.evaluate(
      (r) => ({
        xpGained: Store.state().xp - r.before,
        rec: Store.state().drills[r.first],
        pos: (document.querySelector(".drill__pos") || {}).innerText,
        rubricGone: document.querySelectorAll(".drillcol").length === 0,
        clock: (document.querySelector(".drill__t") || {}).innerText,
        chip: (document.querySelector(".drillchip.is-on .drillchip__n") || {})
          .innerText,
      }),
      rated
    );
    check(
      "rating records the attempt, awards XP and advances to the next question",
      advanced.xpGained > 0 &&
        advanced.rec &&
        advanced.rec.rating === 0 &&
        advanced.rec.seen === 1 &&
        advanced.pos.startsWith("2 of ") &&
        advanced.rubricGone &&
        advanced.clock === "0:00",
      JSON.stringify(advanced)
    );
    check(
      "the competency chip counts the attempt",
      advanced.chip === "1/" + start.total,
      String(advanced.chip)
    );

    /* Filtering scopes the queue, and the counts on the chips are per competency. */
    const scoped = await ip.evaluate(() => {
      const k = window.Curriculum.competencies[0];
      return {
        id: k.id,
        short: k.short,
        n: window.Curriculum.drillsFor(k.id).length,
      };
    });
    await ip.locator(`.drillchip:has-text("${scoped.short}")`).first().click();
    await ip.waitForTimeout(300);
    const inScope = await ip.evaluate((s) => {
      const q = window.Curriculum.drillQueue(s.id, Store.drillState());
      return {
        pos: (document.querySelector(".drill__pos") || {}).innerText,
        want: "1 of " + s.n + " in " + s.short,
        shownQ: (document.querySelector(".drill__q") || {}).innerText,
        wantQ: q[0].drill.q,
      };
    }, scoped);
    check(
      "picking a competency scopes the queue to it",
      inScope.pos === inScope.want && inScope.shownQ === inScope.wantQ,
      JSON.stringify(inScope)
    );

    /* A fumbled drill must come back before a clean one, or the ordering claim is
       decoration. */
    const order = await ip.evaluate(() => {
      const C = window.Curriculum;
      const ds = C.drillsFor("retrieval");
      Store.rateDrill(ds[0].id, 2);
      Store.rateDrill(ds[1].id, 0);
      const q = C.drillQueue("retrieval", Store.drillState()).map(
        (x) => x.drill.id
      );
      return { q, clean: ds[0].id, fumbled: ds[1].id };
    });
    check(
      "a fumbled drill outranks a clean one in the queue",
      order.q.indexOf(order.fumbled) < order.q.indexOf(order.clean) &&
        order.q[order.q.length - 1] === order.clean,
      JSON.stringify(order)
    );

    /* The readiness page is where a gap is diagnosed; it has to link to the place
       you do something about it. */
    await visit(ip, BASE + "#/readiness");
    await ip.waitForTimeout(500);
    const links = await ip.evaluate(() => {
      const rows = [...document.querySelectorAll(".rdrow")];
      return {
        rows: rows.length,
        drillLinks: document.querySelectorAll(".rdrow__drill").length,
        hrefs: [
          ...new Set(
            [...document.querySelectorAll(".rdrow__drill")].map((a) =>
              a.getAttribute("href")
            )
          ),
        ],
        counted: [...document.querySelectorAll(".rdrow__drill")].filter((a) =>
          /\d+\/\d+ drills/.test(a.innerText)
        ).length,
      };
    });
    check(
      "every readiness row links to the drills for that competency",
      links.drillLinks === links.rows &&
        links.rows === 7 &&
        links.hrefs.length === 1 &&
        links.hrefs[0] === "#/interview" &&
        links.counted === links.rows,
      JSON.stringify(links)
    );

    /* Leaving mid-drill must not leave an interval running against a detached
       DOM — the classic single-page leak, and it would keep firing forever. */
    await visit(ip, BASE + "#/interview");
    await ip.waitForTimeout(400);
    await ip.locator('.drill button:has-text("Start answering")').click();
    await ip.waitForTimeout(1200);
    await visit(ip, BASE + "#/dashboard");
    await ip.waitForTimeout(1500);
    check(
      "navigating away mid-drill leaves no timer running",
      await ip.evaluate(() => !document.querySelector(".drill")),
      "the drill survived navigation"
    );

    await ictx.close();
  }

  /* ---------------- every link and control, activated ---------------- */
  /* The contents-link bug survived twenty iterations because the suite asserted a
     table of contents *exists* without ever activating a link in it. These two
     sweeps are the generalisation: every link must resolve, and every kind of
     control must survive being clicked. */
  section("links and controls");
  {
    const actx = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      colorScheme: "dark",
    });
    const ap = await actx.newPage();
    ap.on("pageerror", (e) => errors.push(`sweep pageerror: ${e.message}`));
    ap.on("console", (m) => {
      if (m.type() === "error") errors.push(`sweep console: ${m.text()}`);
    });
    const aGo = async (hash) => {
      await ap.goto(BASE + hash, { waitUntil: "networkidle" });
      await ap.addStyleTag({
        content: "html{scroll-behavior:auto !important}",
      });
      await ap.evaluate(() => Store.skipOnboarding());
      await ap.waitForTimeout(180);
    };

    /* The fourth copy of this list, now the same one. It was the last holdout and
       it caught the readiness page's own nav link as a broken anchor — which is
       the failure mode in miniature: a hand-maintained list of "routes that
       exist" reports every new route as a bug until someone remembers it. */
    const PAGES = APP_ROUTES;

    /* 1. Static: no link points at a chapter that does not exist, and every
       in-page anchor carries a handler — without one the hash reaches the router,
       which does not recognise "#s-ingestion" and falls through to the landing
       route, replacing the page. */
    await aGo("");
    const chapterIds = new Set(
      await ap.evaluate(() => window.Curriculum.chapters.map((c) => c.id))
    );
    const KNOWN_HASHES = new Set([...PAGES.filter(Boolean), "#/"]);
    const linkProblems = [];
    const linkSeen = new Set();
    let linkCount = 0;
    for (const r of [
      ...PAGES,
      ...[...chapterIds].map((id) => "#/chapter/" + id),
    ]) {
      /* Hash assignment, not goto: the router re-renders on hashchange, so a
         full load per chapter would be 44 boots for no extra coverage. */
      await ap.evaluate((h) => {
        location.hash = h || "#/";
      }, r);
      await ap.waitForTimeout(70);
      const links = await ap.evaluate(() =>
        [...document.querySelectorAll("a[href]")].map((a) => ({
          h: a.getAttribute("href"),
          handled: typeof a.onclick === "function",
          cls: (a.className || "").toString().split(" ")[0],
        }))
      );
      for (const l of links) {
        const key = `${l.h}|${l.cls}|${l.handled}`;
        if (linkSeen.has(key)) continue;
        linkSeen.add(key);
        linkCount++;
        if (/^https?:/.test(l.h)) continue;
        if (l.h.startsWith("#/chapter/")) {
          if (!chapterIds.has(l.h.replace("#/chapter/", "")))
            linkProblems.push(`${r || "/"} ${l.h} — no such chapter`);
          continue;
        }
        if (KNOWN_HASHES.has(l.h)) continue;
        if (!l.handled)
          linkProblems.push(
            `${r || "/"} ${l.h} (.${l.cls}) — in-page anchor the router will not recognise`
          );
      }
    }
    check(
      `all ${linkCount} distinct links resolve or are handled in place`,
      linkProblems.length === 0,
      linkProblems.slice(0, 3).join("; ")
    );

    /* 2. Behavioural: click one of every kind of control and require the app to
       still be on a route it recognises, with content on it.

       Keyed by signature, not by route+signature: the question is whether each
       *kind* of control survives activation, and asking it once per route made
       this sweep 71% of the suite's runtime. Reloading only after a click that
       navigated saves most of the rest — a toggle leaves the page usable for the
       next one. */
    const clickProblems = [];
    const clickSeen = new Set();
    let clicked = 0;
    const validHash = (h) =>
      h === "" ||
      h === "#/" ||
      h.startsWith("#/chapter/") ||
      KNOWN_HASHES.has(h);

    for (const route of [
      ...PAGES,
      "#/chapter/rag-architecture",
      "#/chapter/tokens",
      "#/chapter/agent-loop",
    ]) {
      await aGo(route);
      const sigs = await ap.evaluate(() => {
        const out = new Set();
        document
          .querySelectorAll("a[href], button, [role=button], [role=switch]")
          .forEach((e) => {
            if (e.closest(".skiplink, #palette")) return;
            const r = e.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return;
            out.add(
              e.tagName.toLowerCase() +
                "." +
                ((e.className || "").toString().trim().split(/\s+/)[0] || "-")
            );
          });
        return [...out];
      });

      let dirty = false;
      for (const sig of sigs) {
        if (clickSeen.has(sig)) continue;
        clickSeen.add(sig);
        const tag = sig.split(".")[0];
        const cls = sig.split(".").slice(1).join(".");
        const sel = cls === "-" ? tag : `${tag}.${cls.replace(/\./g, "\\.")}`;
        if (dirty) {
          await aGo(route);
          dirty = false;
        }
        try {
          // A control that is not clickable in a second is covered or disabled in
          // this state, which is not this check's business.
          await ap.locator(sel).first().click({ timeout: 1000 });
          clicked++;
        } catch {
          continue;
        }
        await ap.waitForTimeout(200);
        const st = await ap.evaluate(() => ({
          hash: location.hash,
          len: document.body.innerText.length,
        }));
        if (!validHash(st.hash) || st.len < 300)
          clickProblems.push(
            `${route || "/"} ${sig} -> "${st.hash}" len=${st.len}`
          );
        if (st.hash !== (route || "")) dirty = true;
      }
    }
    check(
      `clicking each of ${clicked} control kinds leaves a working page`,
      clickProblems.length === 0,
      clickProblems.slice(0, 3).join("; ")
    );
    await actx.close();
  }

  /* ---------------- history, anchors and the reader's place ---------------- */
  section("history and anchors");
  {
    const hctx = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      colorScheme: "dark",
    });
    const hp = await hctx.newPage();
    hp.on("pageerror", (e) => errors.push(`history pageerror: ${e.message}`));
    hp.on("console", (m) => {
      if (m.type() === "error") errors.push(`history console: ${m.text()}`);
    });
    const hGo = async (hash) => {
      await hp.goto(BASE + hash, { waitUntil: "networkidle" });
      await hp.addStyleTag({
        content: "html{scroll-behavior:auto !important}",
      });
      await hp.evaluate(() => Store.skipOnboarding());
      await hp.waitForTimeout(200);
    };

    /* Every chapter has an "On this page" list, and activating one used to hand
       "#s-ingestion" to a router that does not recognise it — which fell through
       to the landing route and replaced the chapter with the marketing page. One
       click, on every chapter, and no check had ever activated a contents link. */
    await hGo("#/chapter/rag-architecture");
    await hp.waitForTimeout(500);
    const tocCount = await hp.locator(".toc a").count();
    const histBefore = await hp.evaluate(() => history.length);
    await hp.locator(".toc a").first().click();
    await hp.waitForTimeout(500);
    const afterToc = await hp.evaluate(() => ({
      hash: location.hash,
      toc: document.querySelectorAll(".toc a").length,
      h1: (document.querySelector("h1") || {}).innerText,
      y: Math.round(window.scrollY),
      history: history.length,
    }));
    check(
      "a contents link scrolls within the chapter instead of leaving it",
      tocCount >= 3 &&
        afterToc.hash === "#/chapter/rag-architecture" &&
        afterToc.toc === tocCount &&
        /RAG End to End/.test(afterToc.h1) &&
        afterToc.y > 200,
      JSON.stringify(afterToc)
    );
    check(
      "and adds no history entry, so Back still leaves the chapter",
      afterToc.history === histBefore,
      `${histBefore} -> ${afterToc.history}`
    );

    /* Chapters run 20 to 60 minutes. Following a link out and pressing Back used
       to return you to the top of one you had read half of. */
    await hGo("#/chapter/rag-architecture");
    await hp.waitForTimeout(500);
    await hp.evaluate(() => window.scrollTo(0, 2400));
    await hp.waitForTimeout(400);
    const readAt = await hp.evaluate(() => Math.round(window.scrollY));
    await hp.locator(".chnav__btn--next").click();
    await hp.waitForTimeout(600);
    const movedOn = await hp.evaluate(() => ({
      y: Math.round(window.scrollY),
      hash: location.hash,
    }));
    await hp.goBack();
    await hp.waitForTimeout(700);
    const back = await hp.evaluate(() => ({
      y: Math.round(window.scrollY),
      hash: location.hash,
    }));
    check(
      "following a link starts the next chapter at the top",
      movedOn.y === 0 && movedOn.hash === "#/chapter/advanced-rag",
      JSON.stringify(movedOn)
    );
    check(
      "and Back returns you to where you were reading",
      back.hash === "#/chapter/rag-architecture" && back.y > readAt * 0.9,
      `read at ${readAt}, came back to ${back.y}`
    );
    await hp.goForward();
    await hp.waitForTimeout(500);
    check(
      "Forward works too",
      (await hp.evaluate(() => location.hash)) === "#/chapter/advanced-rag"
    );
    await hctx.close();
  }

  /* ---------------- no dialog outlives the page it opened on ---------------- */
  /* All three dialogs mount on document.body rather than inside the view the
     router replaces. The command palette showed what that costs: open it, press
     the browser Back button, and it stays — on top of the new page, swallowing
     every click until you happen to guess Escape. U.trap treats leaving as a
     dismissal, so a fourth dialog gets the behaviour for free. */
  section("dialogs and navigation");
  {
    const gctx = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      colorScheme: "dark",
    });
    const gp = await gctx.newPage();
    gp.on("pageerror", (e) => errors.push(`dialogs pageerror: ${e.message}`));
    gp.on("console", (m) => {
      if (m.type() === "error") errors.push(`dialogs console: ${m.text()}`);
    });
    const gGo = async (hash) => {
      await gp.goto(BASE + hash, { waitUntil: "networkidle" });
      await gp.addStyleTag({
        content: "html{scroll-behavior:auto !important}",
      });
      await gp.evaluate(() => Store.skipOnboarding());
      await gp.waitForTimeout(150);
    };

    // Real history, so Back means something.
    await gGo("#/glossary");
    await gp.goto(BASE + "#/roadmap", { waitUntil: "networkidle" });
    await gp.goto(BASE + "#/library", { waitUntil: "networkidle" });
    await gp.waitForTimeout(250);

    await gp.keyboard.press("/");
    await gp.waitForTimeout(350);
    const palWasOpen = await gp.evaluate(
      () => !document.getElementById("palette").hidden
    );
    await gp.goBack();
    await gp.waitForTimeout(600);
    check(
      "the command palette closes on the browser Back button",
      palWasOpen &&
        (await gp.evaluate(() => document.getElementById("palette").hidden)),
      `open before: ${palWasOpen}`
    );

    /* And the page underneath is usable again — the failure mode was not the
       stray dialog but everything it blocked. */
    check(
      "the page underneath takes clicks again",
      await gp
        .locator(".navlink")
        .first()
        .click({ timeout: 4000 })
        .then(() => true)
        .catch(() => false)
    );

    await gGo("#/settings");
    await gp.waitForTimeout(300);
    await gp
      .locator(".setrow", { hasText: "Reset" })
      .locator("button")
      .first()
      .click();
    await gp.waitForTimeout(350);
    const confirmWasOpen = (await gp.locator(".modal").count()) === 1;
    await gp.evaluate(() => {
      location.hash = "#/roadmap";
    });
    await gp.waitForTimeout(500);
    check(
      "the confirm dialog closes when the route changes",
      confirmWasOpen && (await gp.locator(".modal").count()) === 0,
      `open before: ${confirmWasOpen}`
    );

    /* Closing on navigation must not break the palette's own reason to navigate. */
    await gGo("#/labs");
    await gp.waitForTimeout(250);
    await gp.keyboard.press("/");
    await gp.waitForTimeout(300);
    await gp.keyboard.type("token");
    await gp.waitForTimeout(400);
    await gp.keyboard.press("Enter");
    await gp.waitForTimeout(600);
    check(
      "selecting a palette result still navigates and closes",
      (await gp.evaluate(() => location.hash)).startsWith("#/chapter/") &&
        (await gp.evaluate(() => document.getElementById("palette").hidden)),
      await gp.evaluate(() => location.hash)
    );
    await gctx.close();
  }

  /* ---------------- a shared link is not an invitation to onboard ---------------- */
  /* Someone links a colleague to Hybrid Search & Reranking. The chapter used to
     render and then get covered, 650ms later, by a four-question survey — with
     focus trapped in it, so Tab could not reach the text behind. That reader came
     to read one page. The offer now waits for a surface where planning is the
     point, and arrives the moment they go looking for one. */
  section("deep-link entry");
  {
    const lctx = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      colorScheme: "dark",
    });
    const lp = await lctx.newPage();
    const lErrors = [];
    lp.on("pageerror", (e) => lErrors.push(e.message));
    lp.on("console", (m) => {
      if (m.type() === "error") lErrors.push(m.text());
    });

    /* reload(), not goto(): a goto whose URL differs only in the fragment is a
       same-document navigation, so the app's scripts never re-run and the visit
       is not a first visit at all. */
    const firstVisit = async (entry) => {
      await lp.goto(BASE + entry, { waitUntil: "networkidle" });
      await lp.evaluate(() => localStorage.clear());
      await lp.reload({ waitUntil: "networkidle" });
      // The offer is scheduled at 650ms; 1000 observes it without idling.
      await lp.waitForTimeout(1000);
      return lp.locator(".ob").count();
    };

    /* The landing page is in this list, not the one below: it is the pitch, and the
       scrim is dark enough that a survey over it replaces the page rather than
       covering it. Its own "Open the roadmap" button leads somewhere that does
       offer, so nothing is lost by waiting. */
    for (const entry of [
      "",
      "#/chapter/hybrid-rerank",
      "#/labs",
      "#/glossary",
    ]) {
      check(
        `arriving at ${entry || "/"} is left alone`,
        (await firstVisit(entry)) === 0
      );
    }

    for (const entry of ["#/roadmap", "#/dashboard", "#/plan"]) {
      check(
        `arriving at ${entry} still offers to personalise`,
        (await firstVisit(entry)) === 1
      );
    }

    /* And the pitch is actually readable, which is the point of the change. */
    await firstVisit("");
    check(
      "the landing page's headline and CTA are not covered",
      await lp.evaluate(() => {
        const h1 = document.querySelector("h1");
        const cta = [...document.querySelectorAll("a.btn")].find((a) =>
          /roadmap/i.test(a.innerText)
        );
        if (!h1 || !cta) return false;
        const hit = (el) => {
          const r = el.getBoundingClientRect();
          const y = Math.max(
            1,
            Math.min(window.innerHeight - 1, r.top + r.height / 2)
          );
          return document.elementFromPoint(
            Math.round(r.left + r.width / 2),
            Math.round(y)
          );
        };
        return h1.contains(hit(h1)) && cta.contains(hit(cta));
      })
    );

    /* Deferring is only acceptable because the offer still arrives. Land on a
       chapter, do some work, then go looking for the path. */
    await firstVisit("#/chapter/hybrid-rerank");
    // Smooth scrolling plus the reveal transition means the auto-scroll before a
    // click never settles; the shared go() helper disables it for this reason.
    await lp.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
    await lp.waitForTimeout(900);
    const firstOpt = lp.locator(".check").first().locator(".opt").first();
    await firstOpt.scrollIntoViewIfNeeded();
    await lp.waitForTimeout(800);
    await firstOpt.click();
    await lp.waitForTimeout(250);
    await lp.locator('.navlink[data-nav="#/roadmap"]').click();
    await lp.waitForTimeout(1200);
    check(
      "going looking for the roadmap brings the offer with it",
      (await lp.locator(".ob").count()) === 1
    );
    check(
      "and work done before the offer survives it",
      (await lp.evaluate(() => {
        const rec = Store.state().progress["hybrid-rerank"];
        return !!(rec && rec.checks && Object.keys(rec.checks).length);
      })) && lErrors.length === 0,
      lErrors.slice(0, 1).join("")
    );

    /* The dialog lives on document.body, not in the view the router swaps, so
       navigating away used to leave it floating over a different page — reachable
       because the command palette opens on "/" from behind the scrim. */
    await lp.keyboard.press("Escape");
    await lp.waitForTimeout(200);
    await lp.evaluate(() => localStorage.clear());
    await lp.reload({ waitUntil: "networkidle" });
    await lp.waitForTimeout(1300);
    const orphan = await lp.evaluate(() => {
      const before = document.querySelectorAll(".ob").length;
      location.hash = "#/glossary";
      return before;
    });
    await lp.waitForTimeout(500);
    check(
      "navigating away closes the dialog instead of orphaning it",
      orphan === 1 && (await lp.locator(".ob").count()) === 0,
      `open before nav: ${orphan}, after: ${await lp.locator(".ob").count()}`
    );

    await lctx.close();
  }

  /* ---------------- a damaged stored state still works ---------------- */
  /* The unit tests cover the sanitiser; this covers the thing it protects — that
     the app boots and stays usable on top of state it did not write. Settings
     offers JSON import, so a hand-edited file is a supported way in. */
  section("damaged state");
  for (const [name, seed] of [
    ["unparseable", "{not json"],
    ["progress as a string", '{"progress":"nope","xp":10}'],
    ["xp as a string", '{"xp":"lots"}'],
    ["a progress record that is a number", '{"progress":{"role":7},"xp":5}'],
  ]) {
    const dctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
    });
    // Seeded once, before any app script, then out of the way.
    await dctx.addInitScript((payload) => {
      try {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem("forge.ai.v1", payload);
          sessionStorage.setItem("seeded", "1");
        }
      } catch {
        /* storage unavailable is its own case */
      }
    }, seed);
    const dp = await dctx.newPage();
    const dErrors = [];
    dp.on("pageerror", (e) => dErrors.push(e.message));
    dp.on("console", (m) => {
      if (m.type() === "error") dErrors.push(m.text());
    });
    await dp.goto(BASE + "#/dashboard", { waitUntil: "networkidle" });
    await dp.evaluate(() => Store.skipOnboarding());
    await dp.waitForTimeout(300);

    let rendered = 0;
    for (const r of [
      "#/plan",
      "#/roadmap",
      "#/review",
      "#/settings",
      "#/labs",
    ]) {
      await dp.goto(BASE + r, { waitUntil: "networkidle" });
      await dp.waitForTimeout(150);
      if (await dp.evaluate(() => document.body.innerText.length > 200))
        rendered++;
    }

    await dp.goto(BASE + "#/chapter/role", { waitUntil: "networkidle" });
    await dp.waitForTimeout(250);
    await dp.locator(".chdone .btn").click();
    await dp.waitForTimeout(250);
    const after = await dp.evaluate(() => ({
      done: Store.isDone("role"),
      xpIsNumber: typeof Store.state().xp === "number",
      xp: Store.state().xp,
    }));

    check(
      `boots and records progress with ${name}`,
      dErrors.length === 0 &&
        rendered === 5 &&
        after.done &&
        after.xpIsNumber &&
        after.xp >= 50,
      `${dErrors.slice(0, 1).join("")} rendered=${rendered} ${JSON.stringify(after)}`
    );
    await dctx.close();
  }

  /* Storage that refuses to work at all — private browsing, blocked site data, a
     full quota. The app degrades to in-memory cleanly, which is exactly why it
     has to say so: the failure is invisible until the tab closes and takes the
     session with it. */
  {
    const nctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
    });
    await nctx.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    });
    const np = await nctx.newPage();
    const nErrors = [];
    np.on("pageerror", (e) => nErrors.push(e.message));
    np.on("console", (m) => {
      if (m.type() === "error") nErrors.push(m.text());
    });
    await np.goto(BASE + "#/dashboard", { waitUntil: "networkidle" });
    await np.waitForTimeout(1400);

    const warned = await np.evaluate(() =>
      [...document.querySelectorAll(".toast")].some((t) =>
        /won't be saved/i.test(t.innerText)
      )
    );
    check("a browser that cannot persist is told so", warned);

    let renders = 0;
    for (const r of [
      "#/plan",
      "#/roadmap",
      "#/review",
      "#/labs",
      "#/projects",
    ]) {
      await np.goto(BASE + r, { waitUntil: "networkidle" });
      await np.waitForTimeout(150);
      if (await np.evaluate(() => document.body.innerText.length > 200))
        renders++;
    }
    await np.goto(BASE + "#/settings", { waitUntil: "networkidle" });
    await np.waitForTimeout(300);
    const exportCopy = await np.evaluate(() => {
      const r = [...document.querySelectorAll(".setrow")].find((x) =>
        /Export progress/.test(x.innerText)
      );
      return r ? r.innerText : "";
    });
    check(
      "settings explains that export is the only way to keep it",
      /blocking local storage/i.test(exportCopy),
      exportCopy.slice(0, 60)
    );

    await np.goto(BASE + "#/chapter/role", { waitUntil: "networkidle" });
    await np.evaluate(() => Store.skipOnboarding());
    await np.evaluate(() => {
      const m = document.querySelector(".modal");
      if (m) m.remove();
    });
    await np.waitForTimeout(250);
    await np.locator(".chdone .btn").click();
    await np.waitForTimeout(250);
    const inMemory = await np.evaluate(() => ({
      done: Store.isDone("role"),
      xp: Store.state().xp,
    }));
    check(
      "and it still works for the length of the session",
      renders === 5 &&
        inMemory.done &&
        inMemory.xp >= 50 &&
        nErrors.length === 0,
      `renders=${renders} ${JSON.stringify(inMemory)} ${nErrors.slice(0, 1)}`
    );
    await nctx.close();
  }

  /* ---------------- the first visitor's whole path ---------------- */
  /* Everything above drives the app with state pre-seeded from JS, because that
     is how you test a screen. Nobody arrives that way. This walks the actual
     journey with an empty localStorage, clicking only what a person can click:
     onboarding → plan → the Continue button → the chapter it lands on → its
     checks → its quiz → mark complete → review. It is the only check here that
     would catch a break in the seams *between* screens. */
  section("first-visitor walkthrough");
  const wctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    colorScheme: "dark",
  });
  const wp = await wctx.newPage();
  wp.on("pageerror", (e) => errors.push(`walkthrough pageerror: ${e.message}`));
  wp.on("console", (m) => {
    if (m.type() === "error") errors.push(`walkthrough console: ${m.text()}`);
  });
  const wover = () =>
    wp.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );

  await wp.goto(BASE, { waitUntil: "networkidle" });
  await wp.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  check(
    "arrives with empty storage",
    (await wp.evaluate(() => localStorage.length)) === 0
  );
  /* The landing page makes its case first; the offer comes when the visitor acts
     on it. Following its own primary button is what a first visitor does. */
  await wp.waitForTimeout(1200);
  check(
    "the pitch is not covered by a survey",
    (await wp.locator(".ob").count()) === 0
  );
  await wp.locator("a.btn", { hasText: "Open the roadmap" }).first().click();
  await wp.waitForSelector(".ob", { timeout: 3000 }).catch(() => {});
  check("onboarding opens by itself", (await wp.locator(".ob").count()) === 1);
  check(
    "Continue is gated until a track is picked",
    await wp.evaluate(
      () => document.querySelector(".ob .btn--primary").disabled
    )
  );

  await wp.locator(".ob__opt", { hasText: "Backend" }).first().click();
  await wp.waitForTimeout(200);
  const skills = await wp.evaluate(() => ({
    on: document.querySelectorAll(".ob__skill.is-on").length,
    total: document.querySelectorAll(".ob__skill").length,
  }));
  check(
    "picking a track pre-fills its skills, not all of them",
    skills.on >= 3 && skills.on < skills.total,
    JSON.stringify(skills)
  );

  await wp.locator(".ob .btn--primary").click();
  await wp.waitForTimeout(200);
  await wp.locator(".ob__pill", { hasText: "10 h" }).click();
  await wp.locator(".ob__opt", { hasText: "AI engineering role" }).click();
  await wp.locator(".ob .btn--primary").click();
  await wp.waitForTimeout(300);
  const obPlan = await wp.evaluate(() =>
    [...document.querySelectorAll(".ob .metric__n")].map((e) =>
      Number(e.innerText)
    )
  );
  check(
    "the review step accounts for every chapter",
    obPlan.length === 4 && obPlan[0] + obPlan[1] + obPlan[2] === 44,
    JSON.stringify(obPlan)
  );
  check("no h-overflow in the modal", (await wover()) <= 2);

  await wp.locator(".ob .btn--primary").click();
  await wp.waitForTimeout(500);
  const landed = await wp.evaluate(() => ({
    modal: document.querySelectorAll(".ob").length,
    hash: location.hash,
    track: (Store.profile() || {}).track,
    hours: (Store.profile() || {}).hoursPerWeek,
  }));
  check(
    "finishing onboarding lands on the plan with the profile saved",
    landed.modal === 0 &&
      landed.hash === "#/plan" &&
      landed.track === "backend" &&
      landed.hours === 10,
    JSON.stringify(landed)
  );
  await wp.waitForTimeout(400);
  check(
    "the plan built a real schedule",
    (await wp.locator(".week").count()) > 5,
    `${await wp.locator(".week").count()} weeks`
  );

  const cta = await wp.evaluate(
    () =>
      (document.querySelector("a.btn--primary") || {}).getAttribute("href") ||
      ""
  );
  check(
    "the plan offers a Continue CTA into a chapter",
    /#\/chapter\//.test(cta),
    cta
  );
  const firstId = cta.replace("#/chapter/", "");
  check(
    "the first chapter it sends you to is not one it told you to skim",
    (await wp.evaluate(
      (id) => window.Curriculum.planFor(Store.profile()).byId[id].mode,
      firstId
    )) !== "skim"
  );

  await wp.locator("a.btn--primary").first().click();
  await wp.waitForTimeout(600);
  const chapter = await wp.evaluate(() => ({
    blocks: document.querySelectorAll(".prose > *").length,
    checks: document.querySelectorAll(".check").length,
    quiz: document.querySelectorAll(".qitem").length,
    done: document.querySelectorAll(".chdone").length,
  }));
  check(
    "the chapter renders with body, checks, quiz and a completion box",
    chapter.blocks > 8 &&
      chapter.checks >= 2 &&
      chapter.quiz >= 3 &&
      chapter.done === 1,
    JSON.stringify(chapter)
  );
  check("the chapter has no h-overflow", (await wover()) <= 2);

  const nChecks = await wp.locator(".check").count();
  for (let i = 0; i < nChecks; i++) {
    await wp.locator(".check").nth(i).locator(".opt").first().click();
    await wp.waitForTimeout(140);
  }
  check(
    "answering every inline check records it",
    (await wp.evaluate(
      (id) => Object.keys(Store.state().progress[id].checks || {}).length,
      firstId
    )) === nChecks
  );

  const nQ = await wp.locator(".qitem").count();
  for (let i = 0; i < nQ; i++) {
    const answer = await wp.evaluate(
      (a) =>
        window.Curriculum.chapters.filter((c) => c.id === a.id)[0].quiz[a.i]
          .answer,
      { id: firstId, i }
    );
    await wp.locator(".qitem").nth(i).locator(".opt").nth(answer).click();
    await wp.waitForTimeout(80);
  }
  await wp.waitForTimeout(250);
  const quizSaved = await wp.evaluate(
    (id) => Store.state().progress[id].quiz,
    firstId
  );
  check(
    "a full-marks run is scored and saved",
    quizSaved && quizSaved.right === nQ,
    JSON.stringify(quizSaved)
  );

  await wp.locator(".chdone .btn").click();
  await wp.waitForTimeout(400);
  const completed = await wp.evaluate(
    (id) => ({ done: Store.isDone(id), xp: Store.state().xp }),
    firstId
  );
  check(
    "marking complete sticks and awards XP",
    completed.done === true && completed.xp > 0,
    JSON.stringify(completed)
  );

  await wp.goto(BASE + "#/review", { waitUntil: "networkidle" });
  await wp.waitForTimeout(500);
  const deck = await wp.evaluate(
    (id) => ({
      cards: document.querySelectorAll(".fcard3d").length,
      size: Number(
        ((document.querySelector(".fcmeta") || {}).innerText || "").match(
          /of (\d+)/
        )?.[1]
      ),
      chapterCards: window.Curriculum.chapters.filter((c) => c.id === id)[0]
        .cards.length,
    }),
    firstId
  );
  check(
    "the completed chapter's cards — and only those — are now due",
    deck.cards === 1 && deck.size === deck.chapterCards,
    JSON.stringify(deck)
  );

  await wp.goto(BASE, { waitUntil: "networkidle" });
  await wp.waitForTimeout(600);
  const returning = await wp.evaluate(
    (id) => ({
      modal: document.querySelectorAll(".ob").length,
      done: Store.isDone(id),
      profile: !!Store.profile(),
    }),
    firstId
  );
  check(
    "a return visit keeps the profile and progress and does not re-onboard",
    returning.modal === 0 && returning.done && returning.profile,
    JSON.stringify(returning)
  );
  await wctx.close();

  await browser.close();
  stop();

  /* ---------------- report ---------------- */
  closeSection();
  const slowest = timings.slice().sort((a, b) => b[1] - a[1]);
  const total = timings.reduce((a, t) => a + t[1], 0);
  console.log(`\n  ${Math.round(total / 1000)}s total. Slowest sections:`);
  slowest.slice(0, 6).forEach(([name, ms]) => {
    console.log(
      `    ${String(Math.round(ms / 100) / 10).padStart(6)}s  ${Math.round(
        (ms / total) * 100
      )
        .toString()
        .padStart(2)}%  ${name}`
    );
  });

  console.log("");
  if (errors.length) {
    const unique = [...new Set(errors)];
    console.log(`  ${unique.length} console/page error(s):`);
    unique.slice(0, 20).forEach((e) => console.log(`    x ${e}`));
    failures.push(`${unique.length} console/page errors`);
  }

  console.log(
    `\n  ${pass} passed, ${failures.length} failed\n` +
      (failures.length
        ? failures.map((f) => `    x ${f}`).join("\n") + "\n"
        : "  e2e green\n")
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error("\n  e2e crashed:", e.message, "\n");
  process.exit(1);
});
