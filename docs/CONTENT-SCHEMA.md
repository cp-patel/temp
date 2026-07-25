# Content schema

Everything the curriculum knows is plain data in `js/content/`. This is the
reference for that shape. `npm run validate` enforces all of it.

Fastest way to start: `npm run new:chapter -- --phase retrieval --id my-topic
--title "My Topic"` produces a valid skeleton with one of every block type.

## Chapter

```js
{
  id: "hybrid-rerank",        // required, lowercase-kebab, globally unique
  phase: "retrieval",         // required, must match a phase id
  title: "Hybrid Search & Reranking",
  subtitle: "One or two sentences...",
  minutes: 22,                // 3–90; drives the schedule
  difficulty: "intermediate", // beginner | intermediate | advanced
  tags: ["hybrid", "bm25"],
  lab: "chunking",            // optional; MUST also appear as a lab block

  objectives: ["...", "..."],  // 2+ recommended; "you can X afterwards"
  body: [ /* blocks, see below */ ],
  takeaways: ["...", "..."],   // 3+ recommended; claims, not topics

  quiz: [{ q, options, answer, why }],   // 2+ required
  cards: [{ f, b }],                     // 2+ recommended
  resources: [{ title, url, kind }],     // url must be https
}
```

### Field notes

**`minutes`** is reading time, not learning time. The plan engine multiplies it
(deep 2.6×, study 2.0×, skim 0.45×) to get learning time. Estimate honestly at
roughly 200 words per minute plus 30 seconds per code block.

**`answer`** is a zero-based index into `options`. The validator checks the
range and rejects duplicate option text — a duplicated distractor makes a
question unanswerable.

**`why`** must be at least 40 characters, and should explain both why the right
answer is right _and_ why the most tempting wrong answer is wrong. This field is
where the teaching happens; a `why` that restates the answer is a wasted
question.

**`cards`** are for spaced repetition. The back must stand alone — the learner
sees it weeks later with no surrounding context. `"See the chapter"` is not an
answer.

## Blocks

The `body` array. Every block has a `t` (type) discriminator.

### `p` — paragraph

```js
{ t: "p", text: "Supports inline markdown." }
```

### `h` — section heading

```js
{ t: "h", text: "Why dense retrieval alone underperforms" }
```

Becomes an `<h2>`, gets an auto-generated anchor id, and appears in the table of
contents. A chapter with no `h` blocks gets an empty TOC — the validator warns.

### `h3` — subheading

Same, rendered smaller and indented in the TOC.

### `code` — code block

```js
{
  t: "code",
  lang: "python",              // label only; highlighting is language-agnostic
  caption: "Optional caption",
  code: `def example():
    return "hello"`,
}
```

Written as a template literal, which means **a literal backtick inside code must
be escaped** as `` \` ``. Forgetting this terminates the literal and produces a
syntax error at load — `npm run validate` catches it immediately with the
filename and line.

Keep lines under 78 characters. The validator warns above that because longer
lines scroll horizontally in the reader.

The highlighter handles Python, JavaScript, JSON, SQL, and shell reasonably. It
is a single-pass tokeniser, not a parser; it will occasionally mis-colour
something exotic, which is an acceptable trade for zero dependencies.

### `note` — callout

```js
{
  t: "note",
  kind: "insight",   // insight | pitfall | warn | pro | money
  title: "The point worth remembering",
  text: "Body, supports inline markdown.",
}
```

| kind      | Colour  | Use for                                            |
| --------- | ------- | -------------------------------------------------- |
| `insight` | cyan    | The non-obvious idea the section exists to deliver |
| `pitfall` | rose    | A specific, common mistake                         |
| `warn`    | amber   | Something that will bite in production             |
| `pro`     | emerald | A practical technique worth adopting               |
| `money`   | emerald | Cost and unit-economics points                     |

Use these sparingly. A chapter where every third block is a callout has no
emphasis left.

### `list` — bulleted or numbered

```js
{ t: "list", ordered: false, items: ["First", "Second"] }
```

### `table`

```js
{
  t: "table",
  head: ["Metric", "Measures", "Layer"],
  rows: [
    ["**Recall@k**", "Is the gold chunk in the top k?", "Deterministic"],
  ],
}
```

Every row must have exactly as many cells as `head`. The validator checks this —
a ragged table renders as a visibly broken grid.

### `steps` — numbered sequence with bodies

```js
{
  t: "steps",
  items: [
    { title: "Step one", text: "What to do and why." },
  ],
}
```

For procedures where order matters. Both `title` and `text` are required.

### `compare` — two-column contrast

```js
{
  t: "compare",
  left:  { title: "Do", kind: "good", items: ["..."] },
  right: { title: "Don't", kind: "bad", items: ["..."] },
}
```

`kind` is `good` (green) or `bad` (red); it defaults by position. The single
most effective block type for teaching a judgement call.

### `flow` — horizontal pipeline diagram

```js
{
  t: "flow",
  nodes: [
    { b: "Query", s: "user input", c: "accent" },
    { b: "Retrieve", s: "top 50", c: "cyan" },
  ],
  cap: "Optional caption.",
}
```

`b` is the label (required), `s` an optional subtitle, `c` an optional colour
(`accent`, `cyan`, `emerald`, `amber`). Renders as connected boxes on desktop
and stacks vertically on mobile. Keep it to 3–6 nodes.

### `quote`

```js
{ t: "quote", text: "...", by: "Attribution" }
```

### `check` — inline knowledge check

```js
{
  t: "check",
  key: "hr-1",          // globally unique across ALL chapters
  q: "Recall@20 is 94% but answer quality is poor. Best fix?",
  options: ["...", "...", "...", "..."],
  answer: 1,
  why: "Explanation, 40+ chars.",
}
```

One per chapter, placed at the end, testing application rather than recall. The
`key` must be unique across the whole curriculum because it's the storage key
for the learner's answer — the validator rejects duplicates.

Write a _scenario_, not a definition question. "What is a reranker?" belongs in
a flashcard. "Recall@50 is 96%, recall@5 is 41%, what do you build?" belongs
here.

### `lab` — embed an interactive lab

```js
{ t: "lab", id: "chunking" }
```

The id must exist in `js/ui/labs.js`. If the chapter also declares `lab:
"chunking"` at the top level, the validator enforces that the embed is present —
declaring a lab without embedding it means the chapter advertises something the
reader never sees.

## Inline markdown

Available in every text field:

| Syntax                | Result                                              |
| --------------------- | --------------------------------------------------- |
| `**bold**`            | **bold**                                            |
| `*emphasis*`          | _emphasis_                                          |
| `` `code` ``          | inline code                                         |
| `[text](https://url)` | link, external ones get `rel="noopener noreferrer"` |
| `~~strike~~`          | strikethrough                                       |

HTML is escaped, so you cannot inject markup — write `&lt;` as `<` and it will
display correctly. Code spans are extracted before escaping, so `` `f(**kw)` ``
renders literally rather than turning into bold.

Only `https:`, `#`, and `mailto:` URLs are allowed; anything else becomes `#`.

Backticks and `**` must be balanced. The validator rejects odd counts in prose
fields, because an unbalanced marker silently swallows the rest of a paragraph.
(Code blocks are exempt — `**kwargs` in Python is not unclosed bold.)

## Phase

```js
{
  id: "retrieval",
  n: "04",                    // display number, zero-padded
  icon: "db",                 // must exist in js/core/icons.js
  hue: 158,                   // 0–360, drives the phase's accent colour
  title: "Retrieval & Knowledge Systems",
  blurb: "Two or three sentences...",
  weeks: "3 weeks",
  outcomes: ["...", "..."],   // 2+; "you can X"
}
```

Pick a `hue` well separated from neighbouring phases. Existing: 262, 224, 194,
158, 32, 348, 300, 84.

## Project

```js
{
  id: "p-rag",
  phase: "retrieval",
  tier: "Core",               // Warm-up | Core | Advanced | Capstone
  hours: "15–25 hours",       // parsed for scheduling; a range is averaged
  title: "RAG System Over Documents You Care About",
  brief: "Two or three sentences.",
  stack: "Postgres + pgvector · BM25 · a reranker",
  proves: "Chunking, hybrid search, reranking, citation, evaluation",
  tasks: ["...", "..."],      // 3+; each a checkable milestone
}
```

The `hours` string is parsed by the plan engine, so keep the digits
recognisable. Tasks should be verifiable — "measure recall@5 and publish the
number", not "understand chunking".

## Glossary

```js
{
  t: "Reranker",
  d: "A second-stage model that reorders a retrieved candidate set.",
  n: "Often the single highest-ROI addition to a mediocre RAG system.",
}
```

`n` is the practical note, and it's the part worth writing. The definition is
available anywhere; the judgement isn't.

## Personalisation (`tracks.js`)

```js
C.overlap["resilience"] = {
  skills: ["reliability", "caching"], // must exist in C.skills
  degree: "high", // high | partial | low
  delta:
    "Exponential backoff will be familiar. What's new is prompt caching...",
};
```

If you add a chapter that an experienced engineer would already partly know,
add an overlap entry. **The `delta` note is the entire value** — it tells someone
who could skim the chapter exactly which parts they still need. Write it as
"you already know X; the new things are Y and Z", concretely.

Add the chapter to `C.core` if nobody should ever skip it regardless of
background.

## Checklist before committing content

```
npm run validate     # schema, references, arity, balance
npm test             # core logic including the plan engine
npm run test:e2e     # renders in a real browser with zero console errors
npm run format       # consistent formatting
```

Or `npm run check` for the first two plus a format check.
