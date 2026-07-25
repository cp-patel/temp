#!/usr/bin/env node
/**
 * Curriculum stats — the numbers quoted in the README, computed rather than
 * remembered. Run after adding content and update the README from the output.
 */
import { loadCurriculum, ROOT } from "./lib/load-curriculum.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const C = loadCurriculum();

/* ---- prose words (excluding code and urls) ---- */
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
const words = (v) => strings(v).join(" ").split(/\s+/).filter(Boolean).length;

let prose = 0;
let codeLines = 0;
let codeBlocks = 0;
const blockCounts = {};

for (const ch of C.chapters) {
  prose += words(ch);
  for (const b of ch.body) {
    blockCounts[b.t] = (blockCounts[b.t] || 0) + 1;
    if (b.t === "code") {
      codeBlocks++;
      codeLines += b.code.split("\n").length;
    }
  }
}
prose += words(C.projects) + words(C.glossary) + words(C.phases);

/* ---- source size ---- */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else acc.push({ p: p.slice(ROOT.length + 1), bytes: s.size });
  }
  return acc;
}
const files = walk(ROOT);
const group = (pred) =>
  files.filter((f) => pred(f.p)).reduce((a, f) => a + f.bytes, 0);

const shipped =
  group((p) => p.startsWith("js/")) +
  group((p) => p.startsWith("styles/")) +
  group((p) => p === "index.html");

/* ---- labs ---- */
const labSrc = readFileSync(join(ROOT, "js", "ui", "labs.js"), "utf8");
const labs = [...labSrc.matchAll(/^\s{2}L\.([a-zA-Z0-9_]+)\s*=\s*\{/gm)]
  .map((m) => m[1])
  .filter((x) => x !== "mount");

/* ---- plan durations ---- */
const BACKEND = [
  "apis",
  "reliability",
  "caching",
  "databases",
  "observability",
  "deployment",
  "testing",
  "streaming",
];
const durations = [3, 5, 10, 20].map((h) => {
  const p = C.planFor({ track: "backend", skills: BACKEND, hoursPerWeek: h });
  const n = C.planFor({ track: "new", skills: [], hoursPerWeek: h });
  return { h, backend: p.totalWeeks, newcomer: n.totalWeeks };
});

const plan = C.planFor({ track: "backend", skills: BACKEND, hoursPerWeek: 10 });

/* ---- report ---- */
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log(`
CURRICULUM
  phases              ${C.phases.length}
  chapters            ${C.chapters.length}
  prose words         ${prose.toLocaleString()}
  reading time        ${Math.round(C.chapters.reduce((a, c) => a + c.minutes, 0) / 60)}h
  code                ${codeBlocks} blocks / ${codeLines.toLocaleString()} lines
  labs                ${labs.length}
  quiz questions      ${C.chapters.reduce((a, c) => a + c.quiz.length, 0)}
  flashcards          ${C.chapters.reduce((a, c) => a + (c.cards || []).length, 0)}
  inline checks       ${blockCounts.check || 0}
  projects            ${C.projects.length} (${C.projects.reduce((a, p) => a + p.tasks.length, 0)} milestones)
  glossary terms      ${C.glossary.length}
  resource links      ${C.chapters.reduce((a, c) => a + (c.resources || []).length, 0)}

BLOCKS USED
${Object.entries(blockCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `  ${pad(k, 18)}${num(v, 5)}`)
  .join("\n")}

PERSONALISATION
  tracks              ${C.tracks.length}
  claimable skills    ${C.skills.length}
  delta notes         ${Object.keys(C.overlap).length}
  core chapters       ${C.core.length}

  backend engineer at 10 h/week:
    ${plan.counts.deep} deep · ${plan.counts.study} study · ${plan.counts.skim} skim
    ${Math.round(plan.readingMinutes / 60)}h chapters + ${Math.round(plan.projectMinutes / 60)}h projects = ${plan.totalWeeks} weeks

  duration by pace (weeks):
    hours/wk   backend   newcomer
${durations
  .map(
    (d) => `    ${num(d.h, 8)}   ${num(d.backend, 7)}   ${num(d.newcomer, 8)}`
  )
  .join("\n")}

SOURCE
  shipped to browser  ${(shipped / 1024).toFixed(0)} KB across ${files.filter((f) => f.p.startsWith("js/") || f.p.startsWith("styles/") || f.p === "index.html").length} files
    js/content        ${(group((p) => p.startsWith("js/content")) / 1024).toFixed(0)} KB
    js/ui             ${(group((p) => p.startsWith("js/ui")) / 1024).toFixed(0)} KB
    js/core           ${(group((p) => p.startsWith("js/core")) / 1024).toFixed(0)} KB
    styles            ${(group((p) => p.startsWith("styles")) / 1024).toFixed(0)} KB
  tooling (not shipped)
    scripts + tests   ${(group((p) => p.startsWith("scripts") || p.startsWith("tests")) / 1024).toFixed(0)} KB
    docs              ${(group((p) => p.startsWith("docs") || p.endsWith(".md")) / 1024).toFixed(0)} KB
  runtime dependencies 0
`);
