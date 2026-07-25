#!/usr/bin/env node
/**
 * Scaffolds a new chapter into the right phase file.
 *
 *   npm run new:chapter -- --phase retrieval --id query-rewriting \
 *                          --title "Query Rewriting in Depth"
 *
 * Appends a complete, schema-valid skeleton (objectives, body with one of each
 * useful block, takeaways, quiz, cards, resources) so `npm run validate` passes
 * immediately and you can fill it in rather than remember the shape.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadCurriculum, ROOT } from "./lib/load-curriculum.mjs";

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf("--" + name);
  return i !== -1 ? args[i + 1] : null;
}

const C = loadCurriculum();

const phaseId = arg("phase");
const id = arg("id");
const title = arg("title");
const before = arg("before"); // optional: insert before this chapter id

function die(msg) {
  console.error(`\n  ${msg}\n`);
  console.error(
    "  usage: npm run new:chapter -- --phase <phase> --id <kebab-id> --title <title> [--before <chapter-id>]\n"
  );
  console.error("  phases: " + C.phases.map((p) => p.id).join(", ") + "\n");
  process.exit(1);
}

if (!phaseId || !id || !title) die("missing --phase, --id or --title");
if (!C.phases.some((p) => p.id === phaseId)) die(`unknown phase "${phaseId}"`);
if (!/^[a-z0-9-]+$/.test(id)) die("id must be lowercase kebab-case");
if (C.chapters.some((c) => c.id === id)) die(`chapter "${id}" already exists`);
if (before && !C.chapters.some((c) => c.id === before)) {
  die(`--before references unknown chapter "${before}"`);
}

/* Which file holds this phase? Find it by looking for an existing chapter. */
const contentDir = join(ROOT, "js", "content");
const files = readdirSync(contentDir).filter(
  (f) => f.endsWith(".js") && f !== "meta.js" && f !== "tracks.js"
);
const sibling = C.chapters.find((c) => c.phase === phaseId);
let targetFile = null;
for (const f of files) {
  const src = readFileSync(join(contentDir, f), "utf8");
  if (sibling && src.includes(`id: "${sibling.id}"`)) {
    targetFile = f;
    break;
  }
}
if (!targetFile) die(`could not find the content file for phase "${phaseId}"`);

const path = join(contentDir, targetFile);
let src = readFileSync(path, "utf8");

const SKELETON = `    /* ------------------------------------------------------ */
    {
      id: "${id}",
      phase: "${phaseId}",
      title: ${JSON.stringify(title)},
      subtitle:
        "One or two sentences that say what this chapter is for and why it earns the reader's time.",
      minutes: 18,
      difficulty: "intermediate",
      tags: ["${phaseId}"],
      // lab: "someLabId",   // optional; must also appear as a lab block below
      objectives: [
        "First thing the reader can do afterwards",
        "Second thing",
        "Third thing",
      ],
      body: [
        { t: "p", text: "Opening paragraph. State the idea plainly before elaborating." },

        { t: "h", text: "First section" },
        { t: "p", text: "Prose supports bold, emphasis, inline code and links — see docs/CONTENT-SCHEMA.md for the inline syntax." },

        {
          t: "note",
          kind: "insight",
          title: "The point worth remembering",
          text: "Callout kinds: insight, pitfall, warn, pro, money.",
        },

        {
          t: "table",
          head: ["Column", "Meaning"],
          rows: [
            ["**Row label**", "Every row must have exactly as many cells as the header."],
          ],
        },

        {
          t: "code",
          lang: "python",
          caption: "Keep lines under 78 characters so they do not scroll",
          code: \`def example() -> str:
    # Code blocks are template literals: escape any backtick as needed.
    return "hello"\`,
        },

        {
          t: "compare",
          left: { title: "Do", kind: "good", items: ["A good practice"] },
          right: { title: "Don't", kind: "bad", items: ["The failure mode"] },
        },

        {
          t: "steps",
          items: [
            { title: "Step one", text: "What to do and why." },
          ],
        },

        {
          t: "flow",
          nodes: [
            { b: "Input", s: "subtitle", c: "accent" },
            { b: "Output", s: "", c: "emerald" },
          ],
          cap: "Optional caption under the diagram.",
        },

        {
          t: "check",
          key: "${id}-1",
          q: "A scenario question with one defensibly correct answer.",
          options: ["Plausible but wrong", "Correct", "Also wrong", "Wrong"],
          answer: 1,
          why: "Explain why the right answer is right AND why the tempting wrong one is wrong. This explanation is where the teaching happens.",
        },
      ],
      takeaways: [
        "First takeaway — a claim, not a topic.",
        "Second takeaway.",
        "Third takeaway.",
      ],
      quiz: [
        {
          q: "First quiz question.",
          options: ["A", "B", "C", "D"],
          answer: 1,
          why: "Explanation of at least forty characters, covering the distractor too.",
        },
        {
          q: "Second quiz question.",
          options: ["A", "B", "C", "D"],
          answer: 0,
          why: "Explanation of at least forty characters, covering the distractor too.",
        },
      ],
      cards: [
        { f: "Question side of the flashcard?", b: "Answer side, complete enough to stand alone." },
        { f: "Second card?", b: "Second answer." },
      ],
      resources: [
        { title: "A primary source", url: "https://example.com", kind: "docs" },
      ],
    },
`;

/* Insert before a named chapter, or append at the end of the push() call. */
if (before) {
  const marker = `    /* ------------------------------------------------------ */\n    {\n      id: "${before}",`;
  if (!src.includes(marker))
    die(`could not locate "${before}" in ${targetFile}`);
  src = src.replace(marker, SKELETON + "\n" + marker);
} else {
  // The push() call ends with "  );" at two-space indentation.
  const idx = src.lastIndexOf("\n  );");
  if (idx === -1)
    die(`could not find the end of the chapter list in ${targetFile}`);
  // The preceding chapter object ends with "}" and needs a comma before ours.
  const head = src.slice(0, idx).replace(/\}\s*$/, "},\n");
  src = head + SKELETON.replace(/,\n$/, "\n") + src.slice(idx + 1);
}

writeFileSync(path, src);

console.log(`
  created chapter "${id}" in js/content/${targetFile}
  ${before ? `inserted before "${before}"` : "appended at the end of its phase"}

  next:
    1. npm run validate      confirm the skeleton is schema-valid
    2. edit js/content/${targetFile}
    3. consider adding an entry to js/content/tracks.js if experienced
       engineers will already know part of it (the delta note is the payload)
    4. npm run test:all
`);
