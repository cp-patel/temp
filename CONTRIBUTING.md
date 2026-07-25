# Contributing

## Setup

```bash
npm install        # dev tools only — the site itself has no dependencies
npm run dev        # http://localhost:8000
```

There is no build step. Edit a file, reload the page.

## Before you commit

```bash
npm run check      # format check + content validation + unit tests
npm run test:e2e   # real browser, all routes, all chapters, all labs
```

`npm run test:all` runs everything. CI runs the same commands, so a green local
run means a green CI run.

If Playwright can't find its browser — common on machines with a shared
Chromium rather than Playwright's own download — point the runner at one:

```bash
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

## Adding a chapter

```bash
npm run new:chapter -- --phase retrieval --id query-rewriting \
                       --title "Query Rewriting in Depth"
```

That writes a schema-valid skeleton containing one of every block type into the
right phase file. Then:

1. Fill it in. `docs/CONTENT-SCHEMA.md` is the reference for every field.
2. If an experienced engineer would already know part of it, add an entry to
   `js/content/tracks.js` — see below.
3. `npm run validate` then `npm run test:e2e`.

Use `--before <chapter-id>` to control placement within the phase; the default
appends at the end.

## Writing standards

These are the conventions the existing 44 chapters follow. They exist because
the alternative produced worse material.

**Take a position.** Where practitioners disagree, say what you think and why.
"Some people prefer X, others Y" teaches nothing. "Prefer a workflow unless you
can't enumerate the steps, because agents cost you predictability" is useful even
to a reader who disagrees.

**Lead with the claim, then support it.** Don't build up to the point.

**Prefer a number to an adjective.** "Reranking 50 candidates adds roughly 180ms"
beats "reranking adds some latency". Where a number is illustrative rather than
measured, say so — the existing content uses phrases like "illustrative
mid-2026 orders of magnitude".

**Name the failure mode.** Most chapters are more useful for what they say goes
wrong than for what they say to do. Every technique should come with the
conditions under which it's the wrong choice.

**Explain distractors in `why` fields.** A quiz explanation that only restates
the correct answer wastes the question. Say why the tempting wrong answer is
tempting and why it's wrong.

**Don't name specific model versions or prices as facts.** They churn faster
than the rest of the material and date the content badly. Refer to tiers
("a small model", "a frontier model") and to the method for choosing.

**Be honest about simplifications.** If a lab approximates something, the lab
must say so in its own UI. A lab that quietly misrepresents system behaviour is
worse than no lab.

## Adding a lab

Labs live in `js/ui/labs.js`. Add an object on `L`:

```js
L.myLab = {
  title: "What it is",
  sub: "One line on what manipulating it teaches",
  tag: "Lab",
  icon: "beaker", // must exist in js/core/icons.js
  render: function (root) {
    // build DOM into root; own your state in closures
    // Call from your update(). It is a no-op until the reader actually touches
    // a control, so mounting the lab never awards XP.
    L.touched("myLab");
  },
};
```

Then embed it in its chapter with `{ t: "lab", id: "myLab" }` and declare
`lab: "myLab"` on the chapter. The validator enforces that both are present.

Guidelines:

- **One idea per lab.** A lab that demonstrates three things demonstrates none.
- **Make the failure visible.** The best labs let the reader break something and
  watch a specific consequence. The injection sandbox and the trajectory scorer
  are the models to follow.
- **Explain in the footer** what the reader should try, and what to notice.
- Reuse the shared helpers at the top of the file (`slider`, `toggles`,
  `switchRow`, `metrics`, `panel`, `foot`) so labs look like one system.
- Don't fetch anything. Labs must work offline from `file://`.

## Personalisation entries

`js/content/tracks.js` decides what each learner can skim. If your chapter
overlaps an existing engineering skill:

```js
C.overlap["your-chapter"] = {
  skills: ["reliability", "caching"],
  degree: "high", // high | partial | low
  delta:
    "You already know backoff and idempotency. What's new here is prompt " +
    "caching's byte-stable-prefix requirement, and the semantic-caching " +
    "correctness trap that has no analogue in ordinary caching.",
};
```

**The `delta` note is the point.** Telling a senior engineer "you can skim this"
is mildly useful. Telling them exactly which three things in the chapter are new
to them is why the feature exists. Write it concretely, in the form "you already
know X; the new things are Y and Z".

Add the chapter id to `C.core` if nobody should skip it regardless of
background — currently retrieval fundamentals, all of evaluation, agent control
flow, and prompt injection.

## Code conventions

**Browser code** (`js/**`) is ES5-compatible classic script: `var`, IIFE
namespacing, no `import`. This is what lets the site run from `file://` with no
build step. See `docs/ARCHITECTURE.md` for why that constraint is worth keeping.

**Tooling** (`scripts/**`, `tests/**`) is modern ESM and can use anything Node 20
supports.

**Layering is enforced by convention and by tests:**

- `js/core/store.js` must never touch the DOM. It persists and notifies; the app
  applies. A unit test fails if this regresses.
- Content files contain data, never logic.
- `js/ui/*` may read `Store` and `Curriculum`; neither may read the UI.

**Comments explain why, not what.** The existing code comments the non-obvious
decision (why the plan is derived rather than stored, why RRF avoids score
normalisation, why the toast stack is capped) and leaves the obvious alone.

**A recurring bug to know about:** components that stack a title above a
subtitle using nested `<span>` elements need an explicit `display: block`, or
the two lines overlap. This has been fixed four times. If text overlaps, that's
why.

The same root cause bites differently on sized boxes: a `<span>` styled as a
bar, swatch, or ring is inline until told otherwise, so its `height` is ignored
_and_ any absolutely-positioned child gets a zero-size containing block — the
element renders as literally nothing. The phase-mastery progress bars were
invisible for exactly this reason. `.bar` now sets `display: block` itself.
Anything with a height should do the same rather than relying on its parent
happening to be a flex or grid container.

**Never put a literal `#fff` on a token fill.** `--accent`, `--emerald`,
`--rose` and `--grad-brand` are _light_ on the dark theme and _dark_ on the
light one, so no single text colour works over them. Use `var(--ink-inv)`,
which flips with the theme. Same for `--accent-lo`, which inverts relative to
`--accent` between themes. This was wrong in six places and each one only looked
broken on the theme nobody was testing — the e2e contrast check now catches it.

**Colour that comes from data carries only a hue.** Phase colours are emitted
as `hsl(<hue> var(--phase-s) var(--phase-l))`; saturation and lightness are
theme tokens. A lightness baked into JS cannot respond to the theme, which is
how the phase chips ended up below AA on light.

**Emit progress bars through `U.bar(pct, opts)`**, not by hand. Zero progress is
its own state — a dashed ghost track, not a flat grey line that reads as a bar
that failed to draw — and there are six call sites that would each have to
remember that.

## Adding a block type

All four steps, or the validator will accept content the renderer drops:

1. A case in `Render.body` (`js/ui/render.js`).
2. A rule in `BLOCK_RULES` (`scripts/validate-content.mjs`).
3. Styles in `styles/reader.css`.
4. Documentation in `docs/CONTENT-SCHEMA.md`.

## Pull requests

- One concern per PR. A content PR and a refactor PR are separate PRs.
- Include the output of `npm run validate` if you changed content.
- If you changed the plan engine, say what the new duration estimate is for a
  backend engineer at 10 h/week; a plan that claims the roadmap takes two weeks
  is a bug even if every test passes.
- Screenshots for visual changes, in both themes if you touched tokens.
