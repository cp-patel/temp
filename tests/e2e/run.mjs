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
  await go("#/review");
  await page.waitForTimeout(300);
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
  for (const r of [
    "",
    "#/plan",
    "#/roadmap",
    "#/chapter/rag-architecture",
    "#/labs",
  ]) {
    await mp.goto(BASE + r, { waitUntil: "networkidle" });
    await mp.evaluate(() => Store.skipOnboarding());
    await mp.waitForTimeout(350);
    const ov = await mp.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    check(`mobile ${r || "/"} no h-overflow`, ov <= 2, `${ov}px`);
  }
  await mp.goto(BASE + "#/roadmap", { waitUntil: "networkidle" });
  await mp.evaluate(() => Store.skipOnboarding());
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
