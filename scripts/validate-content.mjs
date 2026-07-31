#!/usr/bin/env node
/**
 * Validates the whole curriculum against its schema.
 *
 * Run this before committing content. It catches the mistakes that are easy to
 * make when hand-authoring 40+ chapters of nested data and that would
 * otherwise surface as a blank panel in the browser: a quiz answer index out
 * of range, a lab id with no lab behind it, a duplicate chapter id, a phase
 * with no chapters, a broken cross-reference.
 */
import { loadCurriculum, ROOT } from "./lib/load-curriculum.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const errors = [];
const warnings = [];

const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const C = loadCurriculum();

/* ------------------------------------------------------------------ *
 * Which lab ids actually exist? Parsed out of the labs source so the
 * validator does not need a DOM.
 * ------------------------------------------------------------------ */
const labSrc = readFileSync(join(ROOT, "js", "ui", "labs.js"), "utf8");
const LAB_IDS = new Set(
  [...labSrc.matchAll(/^\s{2}L\.([a-zA-Z0-9_]+)\s*=\s*\{/gm)].map((m) => m[1])
);
LAB_IDS.delete("mount");

/* Which icon names exist? */
const iconSrc = readFileSync(join(ROOT, "js", "core", "icons.js"), "utf8");
const ICON_IDS = new Set(
  [...iconSrc.matchAll(/^\s{4}([a-zA-Z][a-zA-Z0-9]*):\s*($|"|')/gm)].map(
    (m) => m[1]
  )
);

/* ------------------------------------------------------------------ *
 * Block schema
 * ------------------------------------------------------------------ */
const BLOCK_RULES = {
  p: { req: ["text"] },
  h: { req: ["text"] },
  h3: { req: ["text"] },
  code: { req: ["lang", "code"], opt: ["caption"] },
  note: {
    req: ["text"],
    opt: ["kind", "title"],
    enums: {
      kind: ["insight", "pitfall", "warn", "pro", "money"],
    },
  },
  list: { req: ["items"], opt: ["ordered"] },
  table: { req: ["head", "rows"] },
  steps: { req: ["items"] },
  compare: { req: ["left", "right"] },
  flow: { req: ["nodes"], opt: ["cap"] },
  quote: { req: ["text"], opt: ["by"] },
  check: { req: ["key", "q", "options", "answer", "why"] },
  lab: { req: ["id"] },
};

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

/** Every human-readable string inside a value, at any depth. */
function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") {
    for (const k of Object.keys(value)) {
      // "code" is source, not prose: it must not be word-counted and must not
      // be checked for markdown balance (**kwargs is not an unclosed bold).
      if (["t", "lang", "id", "key", "code", "url"].includes(k)) continue;
      collectStrings(value[k], out);
    }
  }
  return out;
}

const countWords = (v) =>
  collectStrings(v).join(" ").split(/\s+/).filter(Boolean).length;

/* ------------------------------------------------------------------ *
 * Phases
 * ------------------------------------------------------------------ */
const phaseIds = new Set();
if (!Array.isArray(C.phases) || !C.phases.length) err("phases", "empty");

C.phases.forEach((p, i) => {
  const w = `phases[${i}]`;
  for (const f of [
    "id",
    "n",
    "icon",
    "hue",
    "title",
    "blurb",
    "weeks",
    "outcomes",
  ]) {
    if (p[f] === undefined) err(w, `missing "${f}"`);
  }
  if (phaseIds.has(p.id)) err(w, `duplicate phase id "${p.id}"`);
  phaseIds.add(p.id);
  if (typeof p.hue !== "number" || p.hue < 0 || p.hue > 360) {
    err(w, `hue must be 0-360, got ${p.hue}`);
  }
  if (p.icon && !ICON_IDS.has(p.icon)) err(w, `unknown icon "${p.icon}"`);
  if (!Array.isArray(p.outcomes) || p.outcomes.length < 2) {
    warn(w, "fewer than 2 outcomes listed");
  }
});

/* ------------------------------------------------------------------ *
 * Chapters
 * ------------------------------------------------------------------ */
const chapterIds = new Set();
const checkKeys = new Set();
const usedLabs = new Set();
let totalWords = 0;
let codeLines = 0;
let codeBlocks = 0;

C.chapters.forEach((ch, i) => {
  const w = `chapter "${ch.id || "#" + i}"`;

  for (const f of [
    "id",
    "phase",
    "title",
    "subtitle",
    "minutes",
    "difficulty",
    "body",
  ]) {
    if (ch[f] === undefined) err(w, `missing "${f}"`);
  }
  if (chapterIds.has(ch.id)) err(w, "duplicate chapter id");
  chapterIds.add(ch.id);

  if (!phaseIds.has(ch.phase)) err(w, `unknown phase "${ch.phase}"`);
  if (!DIFFICULTIES.includes(ch.difficulty)) {
    err(w, `difficulty must be one of ${DIFFICULTIES.join("/")}`);
  }
  if (typeof ch.minutes !== "number" || ch.minutes < 3 || ch.minutes > 90) {
    err(w, `minutes looks wrong: ${ch.minutes}`);
  }

  /* --- does `minutes` still match the chapter's content? ---
   *
   * `minutes` is hand-authored, because a word count can't know that a chapter
   * is conceptually hard and deserves more thinking time. But it is also the
   * input to the entire plan engine — every week in a learner's schedule is
   * derived from it — so an edit that adds 40% more content and leaves the
   * number alone silently makes both the "14 min read" label and the 15-week
   * estimate wrong. Adding the connective prose this curriculum needed did
   * exactly that, which is why this check exists.
   *
   * The model below is calibrated so that the sum over all chapters matches the
   * authored total: prose is read at roughly 130 words/minute (dense technical
   * material, read to be understood rather than skimmed), code far slower per
   * line, plus interaction time for a lab and thinking time per quiz question.
   * The tolerance is wide on purpose — this is here to catch drift, not to
   * second-guess an author's judgement about a specific chapter.
   */
  {
    const codeLines = (ch.body || [])
      .filter((b) => b.t === "code")
      .reduce((a, b) => a + (b.code || "").split("\n").length, 0);
    const proseWords = (ch.body || []).reduce(
      (a, b) => a + (b.t === "code" ? 0 : countWords(b)),
      0
    );
    const hasLab = (ch.body || []).some((b) => b.t === "lab");
    const modelled =
      1.314 *
      (proseWords / 170 +
        (codeLines * 4) / 60 +
        (hasLab ? 5 : 0) +
        (ch.quiz || []).length * 0.9 +
        2);
    const ratio = ch.minutes / modelled;
    if (ratio < 0.65 || ratio > 1.45) {
      warn(
        w,
        `minutes: ${ch.minutes} but the content models at ~${Math.round(modelled)} — the estimate and the chapter have drifted apart`
      );
    }
  }
  if (!/^[a-z0-9-]+$/.test(ch.id || "")) {
    err(w, "id must be lowercase kebab-case");
  }

  /* --- declared lab must exist and be embedded in the body --- */
  if (ch.lab) {
    if (!LAB_IDS.has(ch.lab))
      err(w, `declares lab "${ch.lab}" which does not exist`);
    usedLabs.add(ch.lab);
    const embedded = (ch.body || []).some(
      (b) => b.t === "lab" && b.id === ch.lab
    );
    if (!embedded) {
      err(w, `declares lab "${ch.lab}" but never embeds it with a lab block`);
    }
  }

  /* --- body blocks --- */
  let headings = 0;
  (ch.body || []).forEach((b, bi) => {
    const bw = `${w} body[${bi}] (${b.t})`;
    const rule = BLOCK_RULES[b.t];
    if (!rule) {
      err(bw, `unknown block type "${b.t}"`);
      return;
    }
    for (const f of rule.req) {
      if (b[f] === undefined) err(bw, `missing "${f}"`);
    }
    for (const k of Object.keys(rule.enums || {})) {
      if (b[k] !== undefined && !rule.enums[k].includes(b[k])) {
        err(
          bw,
          `${k} must be one of ${rule.enums[k].join("/")}, got "${b[k]}"`
        );
      }
    }

    if (b.t === "h") headings++;

    if (b.t === "lab") {
      if (!LAB_IDS.has(b.id)) err(bw, `references unknown lab "${b.id}"`);
      usedLabs.add(b.id);
    }

    if (b.t === "table") {
      if (!b.head.length) err(bw, "table has no header cells");
      b.rows.forEach((r, ri) => {
        if (r.length !== b.head.length) {
          err(
            bw,
            `row ${ri} has ${r.length} cells, header has ${b.head.length}`
          );
        }
      });
    }

    if (b.t === "check") {
      if (checkKeys.has(b.key)) err(bw, `duplicate check key "${b.key}"`);
      checkKeys.add(b.key);
      if (!Array.isArray(b.options) || b.options.length < 2) {
        err(bw, "needs at least 2 options");
      } else if (b.answer < 0 || b.answer >= b.options.length) {
        err(
          bw,
          `answer index ${b.answer} out of range (0-${b.options.length - 1})`
        );
      }
      if ((b.why || "").length < 40) warn(bw, "explanation is very short");
    }

    if (b.t === "compare") {
      for (const side of ["left", "right"]) {
        if (!b[side].title) err(bw, `${side} missing title`);
        if (!Array.isArray(b[side].items) || !b[side].items.length) {
          err(bw, `${side} has no items`);
        }
      }
    }

    if (b.t === "flow") {
      b.nodes.forEach((n, ni) => {
        if (!n.b) err(bw, `node ${ni} missing label "b"`);
      });
    }

    if (b.t === "steps" || b.t === "list") {
      if (!Array.isArray(b.items) || !b.items.length) err(bw, "no items");
      if (b.t === "steps") {
        b.items.forEach((it, ii) => {
          if (!it.title || !it.text) err(bw, `step ${ii} needs title and text`);
        });
      }
    }

    if (b.t === "code") {
      codeLines += b.code.split("\n").length;
      codeBlocks++;
      if (b.code.includes("\t")) warn(bw, "code contains a tab character");
      const lines = b.code.split("\n");
      const long = lines.filter((l) => l.length > 78).length;
      if (long) warn(bw, `${long} code line(s) exceed 78 chars and may scroll`);
    }

    /* text fields: catch unbalanced inline markdown, and count words */
    const text = collectStrings(b).join(" ");
    if (text) {
      totalWords += text.split(/\s+/).length;
      const ticks = (text.match(/`/g) || []).length;
      if (ticks % 2) err(bw, "unbalanced backtick in text");
      const bolds = (text.match(/\*\*/g) || []).length;
      if (bolds % 2) err(bw, "unbalanced ** in text");
    }
  });

  totalWords +=
    countWords(ch.objectives) +
    countWords(ch.takeaways) +
    countWords(ch.quiz) +
    countWords(ch.cards) +
    countWords(ch.subtitle);

  if (headings < 1)
    warn(w, "no h blocks — the table of contents will be empty");

  /* --- teaching structure ---
   *
   * A chapter that is all tables, callouts and code is a reference card, not a
   * lesson. It is skimmable and unlearnable: nothing motivates a table before
   * it appears, nothing says what to take from it afterwards, and nothing
   * connects one block to the next. The first audit of this curriculum found an
   * average prose share of 9%, two chapters with no paragraphs at all, and runs
   * of up to eleven consecutive boxes. These three rules are what stops that
   * coming back.
   */
  const bodyBlocks = ch.body || [];

  // 1. Open by framing the chapter, not by dropping the reader into a subsection.
  if (bodyBlocks.length && bodyBlocks[0].t !== "p") {
    warn(
      w,
      `opens with a "${bodyBlocks[0].t}" block — a chapter should open with a paragraph that says why this matters`
    );
  }

  // 2. Enough connective prose to carry the reader between the artefacts.
  const proseWords = countWords(bodyBlocks.filter((b) => b.t === "p"));
  const bodyWords = countWords(bodyBlocks);
  const prosePct = bodyWords ? Math.round((proseWords / bodyWords) * 100) : 0;
  if (prosePct < 22) {
    warn(
      w,
      `only ${prosePct}% of body words are prose — the reader has tables and callouts but no thread between them`
    );
  }

  /* 3a. Retrieval practice has to be spread through the chapter, not parked at
   *     the end.
   *
   * Every chapter had exactly one inline check, and in the 31 chapters without
   * an embedded lab it sat at 94–96% of the way through — twenty minutes of
   * reading with nothing to do, then one question. The testing effect is one of
   * the most replicated findings in learning research, and the guidance is
   * consistent: low-stakes recall belongs *inside* each chunk, not after all of
   * them. A chapter whose only interaction is the last block is a document.
   *
   * So: something interactive (a lab or a check) must arrive in the first half,
   * and a chapter of any length needs more than one.
   */
  {
    const isInteractive = (b) => b.t === "lab" || b.t === "check";
    const firstIx = bodyBlocks.findIndex(isInteractive);
    const interactions = bodyBlocks.filter(isInteractive).length;

    if (firstIx >= 0 && bodyBlocks.length > 8) {
      const at = Math.round((firstIx / bodyBlocks.length) * 100);
      if (at > 55) {
        warn(
          w,
          `first interactive block is ${at}% through — the reader gets nothing to do until the end`
        );
      }
    }
    if (bodyBlocks.length >= 12 && interactions < 2) {
      warn(
        w,
        `${interactions} interactive block(s) across ${bodyBlocks.length} — a chapter this long needs recall practice partway through, not only at the end`
      );
    }
  }

  // 3. No long unbroken stretch of structured blocks. Headings don't count:
  //    a heading announces a section, it doesn't explain anything.
  let run = 0;
  let worstRun = 0;
  for (const b of bodyBlocks) {
    if (b.t === "p") run = 0;
    else if (b.t === "h" || b.t === "h3") continue;
    else worstRun = Math.max(worstRun, ++run);
  }
  if (worstRun > 3) {
    warn(
      w,
      `${worstRun} structured blocks in a row with no prose between them — the reader is left to infer the connection`
    );
  }

  /* --- quiz --- */
  if (!Array.isArray(ch.quiz) || ch.quiz.length < 2) {
    err(w, "needs at least 2 quiz questions");
  } else {
    ch.quiz.forEach((q, qi) => {
      const qw = `${w} quiz[${qi}]`;
      for (const f of ["q", "options", "answer", "why"]) {
        if (q[f] === undefined) err(qw, `missing "${f}"`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        err(qw, "needs at least 2 options");
      } else if (q.answer < 0 || q.answer >= q.options.length) {
        err(qw, `answer index ${q.answer} out of range`);
      }
      if (new Set(q.options).size !== (q.options || []).length) {
        err(qw, "duplicate option text");
      }
      if ((q.why || "").length < 40) warn(qw, "explanation is very short");
    });
  }

  /* --- cards --- */
  if (!Array.isArray(ch.cards) || ch.cards.length < 2) {
    warn(w, "fewer than 2 flashcards");
  } else {
    ch.cards.forEach((c, ci) => {
      if (!c.f || !c.b)
        err(`${w} cards[${ci}]`, "needs both f (front) and b (back)");
    });
  }

  /* --- objectives / takeaways --- */
  if (!Array.isArray(ch.objectives) || ch.objectives.length < 2) {
    warn(w, "fewer than 2 objectives");
  }
  if (!Array.isArray(ch.takeaways) || ch.takeaways.length < 3) {
    warn(w, "fewer than 3 takeaways");
  }

  /* --- resources --- */
  (ch.resources || []).forEach((r, ri) => {
    const rw = `${w} resources[${ri}]`;
    if (!r.title || !r.url) err(rw, "needs title and url");
    if (r.url && !/^https:\/\//.test(r.url))
      err(rw, `url must be https: ${r.url}`);
  });
});

/* every phase has chapters */
C.phases.forEach((p) => {
  const n = C.chapters.filter((c) => c.phase === p.id).length;
  if (!n) err(`phase "${p.id}"`, "has no chapters");
});

/* every lab is reachable from a chapter */
for (const id of LAB_IDS) {
  if (!usedLabs.has(id)) warn(`lab "${id}"`, "is not embedded in any chapter");
}

/* ------------------------------------------------------------------ *
 * Projects
 * ------------------------------------------------------------------ */
const projIds = new Set();
C.projects.forEach((p, i) => {
  const w = `project "${p.id || "#" + i}"`;
  for (const f of [
    "id",
    "phase",
    "tier",
    "hours",
    "title",
    "brief",
    "stack",
    "proves",
    "tasks",
  ]) {
    if (p[f] === undefined) err(w, `missing "${f}"`);
  }
  if (projIds.has(p.id)) err(w, "duplicate project id");
  projIds.add(p.id);
  if (!phaseIds.has(p.phase)) err(w, `unknown phase "${p.phase}"`);
  if (!Array.isArray(p.tasks) || p.tasks.length < 3)
    err(w, "needs at least 3 tasks");

  /* Every milestone names the chapter that teaches it. Projects are the bulk of
     the plan's hours and used to have no route back to the material at all, so a
     reader stuck mid-task had to remember which chapter covered it. A dangling
     reference is worse than none — it renders a link to a blank page. */
  (p.tasks || []).forEach((t, ti) => {
    const label = `${w} task[${ti}]`;
    if (typeof t === "string") {
      warn(label, "has no `ch` — no route back to the chapter that teaches it");
      return;
    }
    if (!t.t) err(label, "missing task text `t`");
    if (!t.ch) {
      warn(label, "has no `ch` — no route back to the chapter that teaches it");
    } else if (!chapterIds.has(t.ch)) {
      err(label, `references unknown chapter "${t.ch}"`);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Glossary
 * ------------------------------------------------------------------ */
const terms = new Set();
C.glossary.forEach((g, i) => {
  const w = `glossary[${i}] "${g.t || ""}"`;
  if (!g.t || !g.d) err(w, "needs t (term) and d (definition)");
  const key = (g.t || "").toLowerCase();
  if (terms.has(key)) err(w, "duplicate term");
  terms.add(key);
  if ((g.d || "").length < 30) warn(w, "definition is very short");

  /* Every term names the chapter that teaches it, and each chapter lists the
     terms it defines from the same field. A glossary with no route into the
     material is a dead end; a route to a chapter that does not exist is worse. */
  if (!g.ch) {
    warn(w, "has no `ch` — no route to the chapter that teaches it");
  } else if (!chapterIds.has(g.ch)) {
    err(w, `references unknown chapter "${g.ch}"`);
  }
});

/* ------------------------------------------------------------------ *
 * Tracks (personalisation), if present
 * ------------------------------------------------------------------ */
if (C.tracks) {
  const skillIds = new Set((C.skills || []).map((s) => s.id));
  Object.keys(C.overlap || {}).forEach((chId) => {
    const w = `overlap["${chId}"]`;
    if (!chapterIds.has(chId)) err(w, "references unknown chapter");
    const o = C.overlap[chId];
    if (!["high", "partial", "low"].includes(o.degree)) {
      err(w, `degree must be high/partial/low, got "${o.degree}"`);
    }
    (o.skills || []).forEach((s) => {
      if (!skillIds.has(s)) err(w, `unknown skill "${s}"`);
    });
    if (!o.delta)
      warn(w, "no delta note — that note is the whole value of the track");
  });
  (C.tracks || []).forEach((t, i) => {
    const w = `tracks[${i}] "${t.id || ""}"`;
    for (const f of ["id", "label", "blurb", "assumes"]) {
      if (t[f] === undefined) err(w, `missing "${f}"`);
    }
    (t.assumes || []).forEach((s) => {
      if (!skillIds.has(s)) err(w, `assumes unknown skill "${s}"`);
    });
  });
  (C.core || []).forEach((id) => {
    if (!chapterIds.has(id)) err(`core list`, `unknown chapter "${id}"`);
  });
}

/* ------------------------------------------------------------------ *
 * Competencies (the readiness diagnostic)
 * ------------------------------------------------------------------ *
 * The score is only meaningful if the model covers the curriculum: a phase no
 * competency claims is work that earns nothing, and a weight set that doesn't
 * sum to 1 makes 100% unreachable (or reachable early) without anything looking
 * broken.
 */
if (C.competencies) {
  const compIds = new Set();
  const claimedPhases = new Set();
  const claimedProjects = new Set();
  const projectIds = new Set(C.projects.map((p) => p.id));
  let weightSum = 0;

  C.competencies.forEach((k, i) => {
    const w = `competencies[${i}] "${k.id || ""}"`;
    for (const f of [
      "id",
      "label",
      "short",
      "weight",
      "phases",
      "projects",
      "probes",
    ]) {
      if (k[f] === undefined) err(w, `missing "${f}"`);
    }
    if (compIds.has(k.id)) err(w, "duplicate competency id");
    compIds.add(k.id);
    if (typeof k.weight !== "number" || k.weight <= 0 || k.weight > 1) {
      err(w, `weight must be between 0 and 1, got ${k.weight}`);
    } else {
      weightSum += k.weight;
    }
    if (!(k.phases || []).length)
      err(w, "claims no phases, so it can never score");
    (k.phases || []).forEach((p) => {
      if (!phaseIds.has(p)) err(w, `unknown phase "${p}"`);
      if (claimedPhases.has(p))
        err(w, `phase "${p}" is already claimed elsewhere`);
      claimedPhases.add(p);
    });
    (k.projects || []).forEach((p) => {
      if (!projectIds.has(p)) err(w, `unknown project "${p}"`);
      if (claimedProjects.has(p))
        err(w, `project "${p}" is already claimed elsewhere`);
      claimedProjects.add(p);
    });
    if ((k.probes || "").length < 60) {
      warn(
        w,
        "probes note is very short — this text is what makes the score legible"
      );
    }
    if ((k.short || "").length > 12) {
      warn(w, `short label "${k.short}" will not fit the dashboard summary`);
    }
  });

  // Float arithmetic, so a cent of slack rather than an exact compare.
  if (Math.abs(weightSum - 1) > 0.001) {
    err("competencies", `weights sum to ${weightSum.toFixed(3)}, must be 1`);
  }

  phaseIds.forEach((p) => {
    if (!claimedPhases.has(p)) {
      err(
        "competencies",
        `phase "${p}" feeds no competency — its chapters score nothing`
      );
    }
  });
  projectIds.forEach((p) => {
    if (!claimedProjects.has(p)) {
      warn("competencies", `project "${p}" evidences no competency`);
    }
  });

  /* Parts and bands. The parts are the four things a score is made of, so they
     have to sum to 1 too; the bands have to start at 0 or a fresh learner falls
     off the bottom of the scale. */
  const partSum = (C.readinessParts || []).reduce((n, p) => n + p.weight, 0);
  if (Math.abs(partSum - 1) > 0.001) {
    err("readinessParts", `weights sum to ${partSum.toFixed(3)}, must be 1`);
  }
  const bands = C.readinessBands || [];
  if (!bands.length || bands[0].at !== 0) {
    err("readinessBands", "first band must start at 0");
  }
  bands.forEach((b, i) => {
    const w = `readinessBands[${i}] "${b.name || ""}"`;
    if (!b.name || !b.note) err(w, "needs name and note");
    if (i && b.at <= bands[i - 1].at) err(w, "bands must ascend");
    if (b.at < 0 || b.at > 100) err(w, `at must be 0-100, got ${b.at}`);
  });

  /* The scorer itself, at both ends. A diagnostic that cannot reach 100 tells
     everyone they are unready forever; one that starts above 0 congratulates a
     stranger. Both are silent failures — the page renders either way. */
  if (typeof C.readinessFor === "function") {
    const empty = C.readinessFor({});
    if (empty.overall !== 0) {
      err(
        "readinessFor",
        `a fresh learner scores ${empty.overall}%, must be 0`
      );
    }
    const all = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
    C.chapters.forEach((c) => {
      all.done[c.id] = true;
      if ((c.quiz || []).length)
        all.quiz[c.id] = { right: c.quiz.length, total: c.quiz.length };
      if (c.lab) all.labs[c.lab] = true;
    });
    C.projects.forEach((p) => {
      all.projectTasks[p.id] = {};
      p.tasks.forEach((_, i) => (all.projectTasks[p.id][i] = true));
    });
    const full = C.readinessFor(all);
    if (full.overall !== 100) {
      err(
        "readinessFor",
        `completing everything scores ${full.overall}%, must be 100`
      );
    }
    if (full.gaps.length) {
      err(
        "readinessFor",
        `${full.gaps.length} gap(s) remain after completing everything`
      );
    }
    if (C.readinessActions(all).length) {
      err("readinessActions", "suggests work after everything is done");
    }
    if (!C.readinessActions({}).length) {
      err(
        "readinessActions",
        "suggests nothing to a learner who has done nothing"
      );
    }

    /* A ready item must never rank below an unready one. This is the invariant
       that replaced two rounds of multiplier tuning, and it is cheap to check
       here as well as in the unit tests because it is the difference between a
       recommendation that agrees with the roadmap and one that contradicts it. */
    const fresh = C.readinessActions({}, 40);
    let seenUnready = false;
    for (const a of fresh) {
      if (!a.ready) seenUnready = true;
      else if (seenUnready) {
        err(
          "readinessActions",
          `"${a.label}" is ready but ranked below a look-ahead item`
        );
        break;
      }
    }
    const firstPhase = C.phases.slice().sort((x, y) => x.n - y.n)[0].id;
    if (fresh.length && fresh[0].phase !== firstPhase) {
      err(
        "readinessActions",
        `a fresh learner is pointed at "${fresh[0].phase}", not "${firstPhase}"`
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * Portfolio metrics
 * ------------------------------------------------------------------ *
 * The export is the only output of this app that a stranger reads with a hiring
 * decision in mind, so the fields it prompts for have to be answerable. A metric
 * about something the project does not build is a question the learner cannot
 * answer, which is why each one has to name a chapter the project's own
 * milestones already draw on.
 */
C.projects.forEach((p, i) => {
  const w = `projects[${i}] "${p.id}" metrics`;
  if (!Array.isArray(p.metrics) || p.metrics.length < 3) {
    err(w, `needs at least 3, has ${(p.metrics || []).length}`);
    return;
  }
  const own = new Set(p.tasks.map((t) => t.ch).filter(Boolean));
  const keys = new Set();
  p.metrics.forEach((m, mi) => {
    const mw = `${w}[${mi}] "${m.key || ""}"`;
    for (const f of ["key", "label", "hint", "ch"]) {
      if (!m[f]) err(mw, `missing "${f}"`);
    }
    if (keys.has(m.key)) err(mw, "duplicate metric key");
    keys.add(m.key);
    if (m.ch && !chapterIds.has(m.ch)) {
      err(mw, `references unknown chapter "${m.ch}"`);
    } else if (m.ch && !own.has(m.ch)) {
      err(
        mw,
        `references "${m.ch}", which none of this project's milestones use — ` +
          `the metric is asking about something the project does not build`
      );
    }
    if ((m.hint || "").length < 40) {
      warn(
        mw,
        "hint is thin — it is the only guidance on what good looks like"
      );
    }
    if ((m.label || "").length > 48) {
      warn(mw, `label "${m.label}" will wrap awkwardly in the export table`);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Portfolio export
 * ------------------------------------------------------------------ */
if (C.portfolioFor) {
  const empty = C.portfolioFor({});
  if (empty.started !== 0 || empty.words !== 0) {
    err("portfolioFor", "an empty portfolio is not empty");
  }
  for (const p of C.projects) {
    if (empty.markdown.includes(p.title)) {
      err("portfolioFor", `"${p.title}" appears in an empty export`);
    }
  }

  /* Everything ticked, nothing measured: the document must contain no Results
     table anywhere, because inventing a number is the one thing this must never
     do. */
  const ticked = { projectTasks: {}, evidence: {} };
  for (const p of C.projects) {
    ticked.projectTasks[p.id] = {};
    p.tasks.forEach((_, i) => (ticked.projectTasks[p.id][i] = true));
  }
  const bare = C.portfolioFor(ticked);
  if (bare.markdown.includes("### Results")) {
    err("portfolioFor", "produced a results table with no recorded numbers");
  }
  if (bare.missing.length !== C.projects.length) {
    err(
      "portfolioFor",
      `${C.projects.length} unevidenced projects but ${bare.missing.length} named`
    );
  }

  /* Every metric must be able to reach the document — a key the export ignores is
     a field the learner filled in for nothing. */
  const withValues = { projectTasks: ticked.projectTasks, evidence: {} };
  for (const p of C.projects) {
    withValues.evidence[p.id] = { metrics: {}, notes: "" };
    p.metrics.forEach((m) => {
      withValues.evidence[p.id].metrics[m.key] = "VALUE_" + m.key;
    });
  }
  const full = C.portfolioFor(withValues);
  for (const p of C.projects) {
    for (const m of p.metrics) {
      if (!full.markdown.includes("VALUE_" + m.key)) {
        err("portfolioFor", `"${p.id}/${m.key}" never reaches the export`);
      }
      if (!full.markdown.includes("| " + m.label + " |")) {
        err("portfolioFor", `"${p.id}/${m.key}" has no labelled row`);
      }
    }
  }
  if (full.missing.length) {
    err(
      "portfolioFor",
      `every number recorded but ${full.missing.length} gaps still reported`
    );
  }

  /* The claim threshold has to be a real, monotonic band boundary or the readiness
     line would appear and vanish as a learner improved. */
  if (C.portfolioClaimAt) {
    const at = C.portfolioClaimAt();
    if (typeof at !== "number") {
      err("portfolioClaimAt", "no band is marked as claimable");
    } else {
      for (const b of C.readinessBands) {
        if (b.at > at && !b.claim)
          err(
            "readinessBands",
            `"${b.name}" is above the claim line but not claimable`
          );
        if (b.at < at && b.claim)
          err("readinessBands", `"${b.name}" claims below the claim line`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Session planner
 * ------------------------------------------------------------------ *
 * The one promise this feature makes is that the plan fits the minutes asked
 * for. It is also the only surface whose output depends on `chapter.minutes`
 * being honest, so the checks here are cheap insurance on content edits: adding
 * 40% more prose to a chapter without touching its `minutes` already warns
 * above, and would silently make every session plan optimistic.
 */
if (C.sessionFor) {
  const FRESH = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
  const readAll = { done: {}, quiz: {}, labs: {}, projectTasks: {} };
  for (const ch of C.chapters) {
    readAll.done[ch.id] = true;
    if ((ch.quiz || []).length)
      readAll.quiz[ch.id] = { right: ch.quiz.length, total: ch.quiz.length };
    if (ch.lab) readAll.labs[ch.lab] = true;
  }

  if (!Array.isArray(C.sessionLengths) || C.sessionLengths.length < 3) {
    err("sessionLengths", "needs at least three options");
  } else {
    for (let i = 1; i < C.sessionLengths.length; i++) {
      if (C.sessionLengths[i] <= C.sessionLengths[i - 1])
        err("sessionLengths", "must ascend");
    }
  }

  for (const state of [FRESH, readAll]) {
    for (const m of [...(C.sessionLengths || []), 5, 12, 40, 120]) {
      const p = C.sessionFor(m, state);
      const sum = p.items.reduce((n, it) => n + it.minutes, 0);
      if (p.used > m) {
        err("sessionFor", `a ${m} min session plans ${p.used} min of work`);
      }
      if (sum !== p.used) {
        err(
          "sessionFor",
          `${m} min: items sum to ${sum} but used is ${p.used}`
        );
      }
      if (!p.note) err("sessionFor", `${m} min: no note`);
      for (const it of p.items) {
        if (!it.label || !it.why || !it.href)
          err("sessionFor", `${m} min: ${it.kind} item is missing a field`);
        if (it.href.indexOf("#/chapter/") === 0) {
          const id = it.href.replace("#/chapter/", "");
          if (!chapterIds.has(id))
            err("sessionFor", `${m} min: ${it.kind} points at "${id}"`);
        }
      }
    }
  }

  /* Every offered length must give a new learner something to do. The shortest
     option is the one at risk: if every chapter grew past it, the planner would
     start answering "come back later" to the session it exists to serve. */
  for (const m of C.sessionLengths || []) {
    const p = C.sessionFor(m, FRESH);
    if (!p.items.length) {
      err(
        "sessionFor",
        `a new learner with ${m} min is offered nothing — the shortest chapter is now ${Math.min(
          ...C.chapters.map((c) => c.minutes)
        )} min`
      );
    }
  }

  /* A lab is only a session of its own once its chapter is read: opening one cold
     lands the learner mid-chapter on a widget with no context, and a lab whose
     chapter is in the same plan is double-counted, because `minutes` covers it. */
  const labOwner = new Map();
  for (const ch of C.chapters) if (ch.lab) labOwner.set(ch.lab, ch.id);
  for (const m of [25, 45, 90]) {
    const p = C.sessionFor(m, FRESH);
    for (const it of p.items) {
      if (it.kind !== "lab") continue;
      err(
        "sessionFor",
        `${m} min offers lab "${it.id}" to a learner who has read nothing`
      );
    }
    const planned = new Set(
      p.items.filter((i) => i.kind === "chapter").map((i) => i.id)
    );
    for (const it of p.items) {
      if (it.kind === "lab" && planned.has(labOwner.get(it.id))) {
        err("sessionFor", `${m} min counts lab "${it.id}" twice`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
const totalMin = C.chapters.reduce((a, c) => a + c.minutes, 0);
const cards = C.chapters.reduce((a, c) => a + (c.cards || []).length, 0);
const quiz = C.chapters.reduce((a, c) => a + (c.quiz || []).length, 0);

console.log(
  `\n  phases    ${C.phases.length}` +
    `\n  chapters  ${C.chapters.length}  (${Math.round(totalMin / 60)}h reading, ~${totalWords.toLocaleString()} words of prose)` +
    `\n  code      ${codeBlocks} blocks, ${codeLines.toLocaleString()} lines` +
    `\n  labs      ${LAB_IDS.size}` +
    `\n  quiz Qs   ${quiz}` +
    `\n  cards     ${cards}` +
    `\n  checks    ${checkKeys.size}` +
    `\n  projects  ${C.projects.length}` +
    `\n  glossary  ${C.glossary.length}\n`
);

if (warnings.length) {
  console.log(`  ${warnings.length} warning(s):`);
  for (const wn of warnings) console.log(`    ~ ${wn}`);
  console.log("");
}

if (errors.length) {
  console.error(`  ${errors.length} ERROR(S):`);
  for (const e of errors) console.error(`    x ${e}`);
  console.error("");
  process.exit(1);
}

console.log("  content valid\n");
