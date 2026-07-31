#!/usr/bin/env node
/**
 * Verifies the numbers the documentation quotes against the curriculum it
 * describes.
 *
 * Every count in the README and in docs/ drifted at some point: the roadmap
 * claimed 13 labs when there were 17 and ~56k words when there were 72,528, and
 * the architecture doc named an assertion count three iterations out of date.
 * These are the easiest kind of wrong to ship, because nothing breaks and no
 * reader can tell — they just stop trusting the numbers.
 *
 * Test counts are deliberately not checked here, and deliberately not written
 * down in docs/ any more: they moved on nearly every commit, and a suite's size
 * is not a fact about the product. `npm run test:all` prints the real ones.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCurriculum, ROOT } from "./lib/load-curriculum.mjs";

const C = loadCurriculum();

/* ------------------------------------------------------------------ *
 * The truth, computed the same way scripts/stats.mjs computes it
 * ------------------------------------------------------------------ */

function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") {
    for (const k of Object.keys(v)) {
      if (["t", "lang", "id", "key", "code", "url"].includes(k)) continue;
      strings(v[k], out);
    }
  }
  return out;
}

// Counted exactly as scripts/stats.mjs counts it, or the two disagree and the
// check becomes the thing that is wrong.
const words = (v) => strings(v).join(" ").split(/\s+/).filter(Boolean).length;

let prose = 0;
let codeBlocks = 0;
let checks = 0;
let quiz = 0;
let cards = 0;
let resources = 0;
for (const ch of C.chapters) {
  prose += words(ch);
  for (const b of ch.body || []) {
    if (b.t === "code") codeBlocks++;
    if (b.t === "check") checks++;
  }
  quiz += (ch.quiz || []).length;
  cards += (ch.cards || []).length;
  resources += (ch.resources || []).length;
}
prose += words(C.projects) + words(C.glossary) + words(C.phases);

const labs = Object.keys(globalThis.Labs || {}).length
  ? Object.keys(globalThis.Labs).length
  : countLabs();

function countLabs() {
  const src = readFileSync(join(ROOT, "js", "ui", "labs.js"), "utf8");
  return [...src.matchAll(/^ {2}L\.([a-zA-Z0-9_]+)\s*=\s*\{/gm)].filter(
    (m) => !["touched", "mount"].includes(m[1])
  ).length;
}

const milestones = C.projects.reduce((n, p) => n + p.tasks.length, 0);
const deltas = Object.keys(C.overlap || {}).length;

/* The plan's own figures. These changed the day the skim rule was fixed and had
   to be hand-patched in the README; a plan is derived, so its documented shape
   should be derived too. */
const backendSkills = C.tracks.filter((t) => t.id === "backend")[0].assumes;
const backendPlan = C.planFor({
  track: "backend",
  goal: "job",
  hoursPerWeek: 10,
  skills: backendSkills,
});
const newcomerPlan = (h) =>
  C.planFor({ track: "new", goal: "depth", hoursPerWeek: h, skills: [] });
const backendAt = (h) => C.planFor({ ...backendPlan.profile, hoursPerWeek: h });

/* The readiness diagnostic's own figures. Every one of these is derived from
   competencies.js, so documenting them by hand is documenting them wrong — the
   weights were retuned twice while this section was being written. */
const readAll = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
for (const ch of C.chapters) {
  readAll.done[ch.id] = true;
  if ((ch.quiz || []).length)
    readAll.quiz[ch.id] = { right: ch.quiz.length, total: ch.quiz.length };
}
const readOnlyScore = C.readinessFor(readAll).overall;

/* Working through the roadmap properly, a phase at a time. */
const trajectory = {};
{
  const s2 = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
  for (const p of C.phases.slice().sort((a, b) => a.n - b.n)) {
    for (const ch of C.chapters.filter((c) => c.phase === p.id)) {
      s2.done[ch.id] = true;
      if ((ch.quiz || []).length)
        s2.quiz[ch.id] = { right: ch.quiz.length, total: ch.quiz.length };
      if (ch.lab) s2.labs[ch.lab] = true;
    }
    for (const pr of C.projects.filter((x) => x.phase === p.id)) {
      s2.projectTasks[pr.id] = {};
      pr.tasks.forEach((_, i) => (s2.projectTasks[pr.id][i] = true));
    }
    trajectory[p.id] = C.readinessFor(s2).overall;
  }
}

const partPct = {};
for (const part of C.readinessParts) partPct[part.id] = part.weight * 100;

const compPct = {};
for (const k of C.competencies) compPct[k.id] = Math.round(k.weight * 100);

const metricFields = C.projects.reduce((n, p) => n + p.metrics.length, 0);
const claimBand = (C.readinessBands || []).filter((b) => b.claim)[0];

const TRUTH = {
  metricFields,
  competencies: C.competencies.length,
  readOnlyScore,
  partReading: partPct.reading,
  partRecall: partPct.recall,
  partPractice: partPct.practice,
  partEvidence: partPct.evidence,
  bandFoundations: trajectory.foundations,
  bandBuilding: trajectory.building,
  bandAgents: trajectory.agents,
  bandEvals: trajectory.evals,
  bandProduction: trajectory.production,
  chapters: C.chapters.length,
  phases: C.phases.length,
  labs,
  projects: C.projects.length,
  milestones,
  checks,
  quiz,
  cards,
  glossary: C.glossary.length,
  resources,
  tracks: C.tracks.length,
  skills: C.skills.length,
  deltas,
  codeBlocks,
  planDeep: backendPlan.counts.deep,
  planStudy: backendPlan.counts.study,
  planSkim: backendPlan.counts.skim,
  planWeeks: backendPlan.totalWeeks,
  planReadHours: Math.round(backendPlan.readingMinutes / 60),
  planProjectHours: Math.round(backendPlan.projectMinutes / 60),
};

/* ------------------------------------------------------------------ *
 * The claims, as written
 * ------------------------------------------------------------------ *
 * Each rule is a regex with one capture group and the key it must equal. A rule
 * that matches nothing is itself a failure: the sentence it was guarding got
 * reworded, and an unenforced claim is how the drift started.
 */
const RULES = [
  ["README.md", /(\d+) chapters · \d+ phases/, "chapters"],
  ["README.md", /\d+ chapters · (\d+) phases/, "phases"],
  ["README.md", /(\d+) interactive labs/, "labs"],
  ["README.md", /(\d+) projects ·/, "projects"],
  ["README.md", /(\d+) flashcards/, "cards"],
  ["README.md", /(\d+) knowledge checks/, "checks"],
  ["README.md", /Sixteen|Seventeen|Eighteen labs, each making/, "labsWord"],
  ["docs/ROADMAP.md", /(\d+) chapters, \d+ phases/, "chapters"],
  ["docs/ROADMAP.md", /\d+ chapters, (\d+) phases/, "phases"],
  ["docs/ROADMAP.md", /([\d,]+) words of prose/, "proseApprox"],
  ["docs/ROADMAP.md", /(\d+) code blocks/, "codeBlocks"],
  ["docs/ROADMAP.md", /(\d+) labs, \d+ inline/, "labs"],
  ["docs/ROADMAP.md", /\d+ labs, (\d+) inline knowledge checks/, "checks"],
  ["docs/ROADMAP.md", /(\d+) quiz questions/, "quiz"],
  ["docs/ROADMAP.md", /(\d+) projects with \d+ verifiable/, "projects"],
  [
    "docs/ROADMAP.md",
    /\d+ projects with (\d+) verifiable milestones/,
    "milestones",
  ],
  ["docs/ROADMAP.md", /(\d+) spaced-repetition cards/, "cards"],
  ["docs/ROADMAP.md", /(\d+) tracks, \d+ claimable/, "tracks"],
  ["docs/ROADMAP.md", /\d+ tracks, (\d+) claimable skills/, "skills"],
  ["docs/ROADMAP.md", /(\d+) per-chapter delta notes/, "deltas"],
  ["docs/ROADMAP.md", /(\d+)-term glossary/, "glossary"],
  ["docs/ROADMAP.md", /(\d+) external resources/, "resources"],
  ["docs/ARCHITECTURE.md", /(\d+) interactive labs/, "labs"],

  /* The personalised plan, as the README describes it. */
  ["README.md", /gets (\d+) deep, \d+ study, \d+ skim/, "planDeep"],
  ["README.md", /gets \d+ deep, (\d+) study, \d+ skim/, "planStudy"],
  ["README.md", /gets \d+ deep, \d+ study, (\d+) skim/, "planSkim"],
  ["README.md", /a (\d+)-week schedule at 10 h\/week/, "planWeeks"],
  ["README.md", /dominate: (\d+)h of chapters and labs/, "planReadHours"],
  ["README.md", /(\d+)h of building/, "planProjectHours"],
  ["README.md", /marks the (nine|ten|eleven|twelve) chapters/, "skimWord"],

  /* The readiness diagnostic. Each competency share is checked against its own
     weight below; these are the figures written into the surrounding prose. */
  ["README.md", /against the (\w+) competencies an AI engineering/, "compWord"],
  ["README.md", /chapters read \((\d+)%\)/, "partReading"],
  ["README.md", /quiz accuracy \((\d+)%\)/, "partRecall"],
  ["README.md", /labs used \((\d+)%\)/, "partPractice"],
  ["README.md", /project milestones \((\d+)%\)\*\*/, "partEvidence"],
  ["README.md", /perfectly reaches (\d+)%, not/, "readOnlyScore"],
  ["README.md", /scores (\d+)% after Foundations/, "bandFoundations"],
  ["README.md", /(\d+)% after Building/, "bandBuilding"],
  ["README.md", /(\d+)% after Agents/, "bandAgents"],
  ["README.md", /(\d+)% after Evaluation/, "bandEvals"],
  ["README.md", /(\d+)% after Production/, "bandProduction"],
  ["README.md", /(\d+) fields across the six projects/, "metricFields"],
];

/* Every row of the competency table, against the weight it claims. A share that
   drifts from its weight is the readiness page and its documentation disagreeing
   about what the loop asks for. */
const COMP_ROWS = C.competencies.map((k) => [k.label, k.id]);

const WORDS_SMALL = {
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
};

/* The duration table: every row recomputed from the plan engine. */
const DURATION_ROWS = [3, 5, 10, 20];

const WORDS = {
  16: "Sixteen",
  17: "Seventeen",
  18: "Eighteen",
  19: "Nineteen",
  20: "Twenty",
};

const SMALL = {
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
};

const fails = [];
let checked = 0;
const cache = {};

/* Prose rules match against a whitespace-collapsed copy.
 *
 * Prettier reflows Markdown paragraphs, so a claim written on one line can end up
 * split across two the next time anything nearby is edited — and a regex with a
 * literal space in it then reports the claim as missing. That is a false failure
 * about formatting, not a real one about a number, and it wastes exactly the
 * attention this script exists to focus. The table loops below keep the raw
 * source, because a row's meaning depends on its line. */
const flat = {};

for (const [file, re, key] of RULES) {
  cache[file] ??= readFileSync(join(ROOT, file), "utf8");
  const src = (flat[file] ??= cache[file].replace(/\s+/g, " "));
  const m = src.match(re);
  if (!m) {
    fails.push(
      `${file}: no sentence matches ${re} — the claim it guarded moved`
    );
    continue;
  }
  checked++;

  if (key === "labsWord") {
    const want = WORDS[TRUTH.labs];
    if (m[0].split(" ")[0] !== want)
      fails.push(`${file}: says "${m[0].split(" ")[0]} labs", want "${want}"`);
    continue;
  }

  if (key === "compWord") {
    const want = WORDS_SMALL[TRUTH.competencies];
    if (m[1] !== want)
      fails.push(`${file}: says "${m[1]} competencies", want "${want}"`);
    continue;
  }

  if (key === "skimWord") {
    const want = SMALL[TRUTH.planSkim];
    if (m[1] !== want)
      fails.push(
        `${file}: says "${m[1]} chapters you can skim", want "${want}"`
      );
    continue;
  }

  const got = Number(m[1].replace(/,/g, ""));
  if (key === "proseApprox") {
    // Prose drifts with every edit, so this one is a band rather than a value.
    const off = Math.abs(got - prose) / prose;
    if (off > 0.03)
      fails.push(
        `${file}: claims ${m[1]} words of prose, actual ${prose.toLocaleString()} (${Math.round(off * 100)}% out)`
      );
    continue;
  }
  if (got !== TRUTH[key])
    fails.push(`${file}: claims ${key} = ${got}, actual ${TRUTH[key]}`);
}

/* The band the portfolio export starts quoting. Named in the README, so a
   recalibration that moved the `claim` flag would otherwise leave the prose
   pointing at the wrong band. */
{
  const readmeSrc = (cache["README.md"] ??= readFileSync(
    join(ROOT, "README.md"),
    "utf8"
  ));
  const m = readmeSrc.match(/joins the export only at\s+\*\*([^*]+)\*\*/);
  if (!m) {
    fails.push("README.md: no sentence names the portfolio claim band");
  } else {
    checked++;
    if (!claimBand) {
      fails.push("no readiness band is marked claimable");
    } else if (m[1].trim() !== claimBand.name) {
      fails.push(
        `README.md: says the export quotes from "${m[1].trim()}", actual "${claimBand.name}"`
      );
    }
  }
}

/* The competency table's shares. */
for (const [label, id] of COMP_ROWS) {
  const readmeSrc = (cache["README.md"] ??= readFileSync(
    join(ROOT, "README.md"),
    "utf8"
  ));
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const row = new RegExp(`\\|\\s*${esc}\\s*\\|\\s*(\\d+)%\\s*\\|`);
  const m = readmeSrc.match(row);
  if (!m) {
    fails.push(`README.md: no competency row for "${label}"`);
    continue;
  }
  checked++;
  if (Number(m[1]) !== compPct[id]) {
    fails.push(
      `README.md: "${label}" row says ${m[1]}%, actual ${compPct[id]}%`
    );
  }
}

/* The README's duration table, row by row. It was right, but only because I
   remembered to rerun the numbers; nothing was checking. */
const readme = (cache["README.md"] ??= readFileSync(
  join(ROOT, "README.md"),
  "utf8"
));
for (const h of DURATION_ROWS) {
  const row = new RegExp(
    `\\|\\s*${h}\\s*\\|\\s*\\**(\\d+) weeks\\**\\s*\\|\\s*(\\d+) weeks\\s*\\|`
  );
  const m = readme.match(row);
  if (!m) {
    fails.push(`README.md: no duration row for ${h} h/week`);
    continue;
  }
  checked += 2;
  const wantB = backendAt(h).totalWeeks;
  const wantN = newcomerPlan(h).totalWeeks;
  if (Number(m[1]) !== wantB)
    fails.push(
      `README.md: ${h} h/week backend says ${m[1]} weeks, actual ${wantB}`
    );
  if (Number(m[2]) !== wantN)
    fails.push(
      `README.md: ${h} h/week newcomer says ${m[2]} weeks, actual ${wantN}`
    );
}

console.log(`\n  checked ${checked} documented numbers`);
if (fails.length) {
  console.log(`\n  ${fails.length} out of date:`);
  fails.forEach((f) => console.log(`    x ${f}`));
  console.log("\n  run `npm run stats` for the current figures\n");
  process.exit(1);
}
console.log("  docs match the curriculum\n");
