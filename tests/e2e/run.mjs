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

function section(title) {
  console.log(`\n${title}`);
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

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: "networkidle" });
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
  const routes = [
    "",
    "#/dashboard",
    "#/plan",
    "#/roadmap",
    "#/library",
    "#/labs",
    "#/review",
    "#/projects",
    "#/glossary",
    "#/settings",
    "#/nonexistent-route",
  ];
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
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  check(
    "onboarding auto-opens on first visit",
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
  await mctx.close();

  /* ---------------- contrast, both themes ---------------- */
  /* A dark-first token set drifts out of AA on the light theme without anyone
     noticing, because nothing looks broken — it just looks washed out. This
     found 66 failures across the two themes the first time it ran, almost all
     of them one token (--ink-3) or one pattern (a literal #fff over a fill that
     inverts between themes). */
  section("contrast (WCAG AA)");
  const CONTRAST_ROUTES = [
    "",
    "#/dashboard",
    "#/plan",
    "#/roadmap",
    "#/library",
    "#/labs",
    "#/review",
    "#/projects",
    "#/glossary",
    "#/settings",
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
