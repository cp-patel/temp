# Architecture

A deliberately small, dependency-free frontend. Read this before making
structural changes; it explains not just what the pieces are but why they're
shaped this way.

## The one constraint everything follows from

**No build step.** `index.html` loads plain CSS and classic `<script>` files.
That single decision produces most of the properties worth having:

- It runs from `file://`, a static host, or any web server, unchanged.
- There is no bundler config, no transpiler, no lockfile drift, no "works on my
  machine" caused by a toolchain version.
- The source you debug in the browser is the source in the repo.
- Contributing content requires no environment beyond a text editor.

The cost is real and accepted: no ES modules (classic scripts can't `import`
from `file://` without CORS failures), no JSX, no TypeScript. The code is
written in ES5-compatible JavaScript with `var`, IIFE namespacing, and a small
number of globals. If you find yourself wanting a bundler, first check whether
the thing you want is worth losing the properties above.

Node-side tooling (validation, tests, scaffolding) _does_ use modern ESM. Those
files never ship to the browser, so the constraint doesn't apply to them.

## Layers

```
                         ┌────────────────────────────┐
   index.html  ────────► │  load order is the only    │
                         │  dependency graph there is │
                         └────────────────────────────┘
                                      │
   ┌──────────────────────────────────┴──────────────────────────────┐
   │                                                                 │
   ▼                                                                 ▼
 CORE (no DOM, no app knowledge)                          CONTENT (pure data)
   js/core/icons.js    inline SVG set                     js/content/meta.js
   js/core/util.js     DOM helpers, markdown,               phases, projects,
                       syntax highlighting, tokenizer,      glossary
                       vector maths, formatting           js/content/p0..p7-*.js
   js/core/store.js    persistence, XP, streaks,            chapters, one file
                       card scheduling, profile             per phase
                                                          js/content/tracks.js
                                                            skills, tracks,
                                                            overlap + plan engine
   │                                                                 │
   └──────────────────────────────────┬──────────────────────────────┘
                                      ▼
                         UI (reads core + content, owns the DOM)
                           js/ui/labs.js        13 interactive labs
                           js/ui/render.js      block renderer, quiz engine
                           js/ui/views.js       one function per page
                           js/ui/onboarding.js  profile capture modal
                                      ▼
                         js/app.js   router, shell, palette, keyboard
```

### Rules that keep the layers honest

1. **`js/core/store.js` never touches the DOM.** It persists and notifies; the
   app applies. This is what makes it testable in Node, and it's why
   `setTheme()` only writes state while `applyTheme()` in `app.js` writes the
   `data-theme` attribute. There's a unit test that would fail if this
   regressed.
2. **Content files contain no logic.** A chapter is data. If you need behaviour,
   it belongs in a lab or a renderer, not in the content.
3. **`js/ui/*` may read `Store` and `Curriculum`; neither may read the UI.**
4. **`js/app.js` is the only file that builds the shell** (sidebar, topbar,
   palette, toasts) and the only owner of the router.

## State

All learner state lives in `localStorage` under one key, `forge.ai.v1`.

```js
{
  v: 1,
  theme: null | "dark" | "light",   // null = follow system
  progress: { [chapterId]: { done, ts, quiz: {right,total,ts}, checks: {} } },
  notes:    { [chapterId]: string },
  cards:    { [cardId]: { box, due, seen, right } },   // Leitner boxes
  projects: { [projectId]: { [taskIndex]: true } },
  labs:     { [labId]: true },      // first interaction awards XP once
  xp: number,
  days:     { "YYYY-MM-DD": xpEarned },
  streak:   { n, last, best },
  profile:  { track, skills[], goal, hoursPerWeek } | null,
  onboarded: boolean,
  recent: [chapterId],
  open:   { [phaseId]: true },      // roadmap accordion
  started: "YYYY-MM-DD"
}
```

`load()` merges stored state over defaults key by key, so adding a new field is
backwards compatible — existing users get the default without a migration. If
you ever need a breaking change, bump the key name (`forge.ai.v2`) and write an
explicit migration; don't silently reinterpret an existing field.

Corrupt JSON in storage degrades to defaults rather than throwing. There's a
test for that.

## The plan engine

`js/content/tracks.js` is the personalisation layer, and it's worth
understanding because it's the part most likely to be extended.

- **`C.skills`** — things a learner can claim to already do.
- **`C.tracks`** — presets that preselect a set of skills.
- **`C.core`** — chapter ids that are never downgraded, whatever you claim.
- **`C.overlap`** — per chapter: which skills it overlaps, how much, and a
  **`delta` note**. The delta note is the product. "You can skim this" is mildly
  useful; "you know backoff and idempotency, here are the three things in this
  chapter that are new" is the reason the feature exists. When you add a chapter
  that an experienced engineer would partly know, write the delta.
- **`C.planFor(profile)`** — pure function, no side effects, no storage. Returns
  modes per chapter, a week-by-week schedule, and totals.

Two design decisions worth preserving:

**The plan is derived, never stored.** `Store.plan()` recomputes on every call.
That means editing your profile, or adding a chapter to the curriculum, updates
the plan immediately with no stale copy and no migration.

**The schedule counts project hours.** Reading time alone produced a "2 week"
estimate for the whole roadmap, which was both wrong and credibility-destroying.
Mode weights convert reading minutes into learning minutes (deep 2.6×, study
2.0×, skim 0.45×), and each project's estimated hours are scheduled explicitly,
splitting across weeks when they exceed one week's budget. The result lands at
~15 weeks for a backend engineer at 10 h/week, which matches reported real-world
timelines for this transition.

## Rendering a chapter

`Render.body(blocks, chapterId)` walks the block array and returns a document
fragment plus the headings it found (used to build the table of contents). Each
block type maps to one small builder function. Adding a block type means:

1. Add a case in `Render.body`.
2. Add its rule to `BLOCK_RULES` in `scripts/validate-content.mjs`.
3. Style it in `styles/reader.css`.
4. Document it in `docs/CONTENT-SCHEMA.md`.

All four, or the validator will accept content the renderer silently drops.

## Labs

Each lab is an object on the `Labs` namespace with `{ title, sub, tag, icon,
render(container) }`. `Labs.mount(id, container)` wraps it in the standard
chrome and calls `render`, catching exceptions so one broken lab can't take down
a chapter.

Labs are self-contained: they own their state in closure variables and don't
read or write learner progress except `L.touched(id)`, which awards XP once on
first interaction.

`L.touched` is gated, and that gate matters: labs call it from their `update()`
function, which also runs once on mount to paint initial state. Ungated, that
awarded XP for merely rendering — and the labs index mounts all thirteen, so
opening it handed out 130 XP for scrolling. `Labs.mount` arms the award on the
first real interaction inside the lab, at the one choke point rather than in
fourteen call sites. The gate lives in the UI layer because arming is a UI
concern and `Store` is core.

Two labs use documented simplifications. The tokenizer is a heuristic
approximation of subword segmentation. The dense retriever in the retrieval lab
is a hand-authored concept-space model, not embeddings — an earlier version used
lexical trigram hashing and _could not demonstrate paraphrase matching_, which
was the lab's entire point. Both say so in their own footers. If you build a lab
that simplifies something, say so in the UI; a lab that quietly misrepresents
how a system behaves is worse than no lab.

## Styles

Eight stylesheets, loaded in order, cascading intentionally:

| File         | Scope                                                       |
| ------------ | ----------------------------------------------------------- |
| `tokens.css` | Custom properties only. Both themes fully specified.        |
| `base.css`   | Reset, typography, buttons, chips, cards, bars, animations. |
| `shell.css`  | Sidebar, topbar, command palette, toasts, modals.           |
| `views.css`  | Landing, roadmap, dashboard, library, glossary, projects.   |
| `reader.css` | Chapter prose, code blocks, callouts, quiz, TOC.            |
| `labs.css`   | Lab-specific components.                                    |
| `plan.css`   | Onboarding modal and the plan view.                         |
| `motion.css` | Aurora, grain, reveal, kinetic type, progress animation.    |

Theming is entirely token substitution under `:root[data-theme="..."]`. No
component should hardcode a colour. If you need a new colour, add a token.

Two rules follow from having two themes rather than one:

- **A literal text colour over a token fill is a bug.** `--accent`,
  `--emerald`, `--rose` and `--grad-brand` are light on dark and dark on light,
  so no single text colour works over them — use `var(--ink-inv)`, which flips.
  The e2e suite audits both themes against WCAG AA on every route and fails on
  any violation, because this class of bug only shows up on whichever theme
  nobody happened to be looking at.
- **Colour that comes from data carries only a hue.** Phase colours are emitted
  as `hsl(<hue> var(--phase-s) var(--phase-l))`. A lightness baked into JS
  cannot respond to the theme.

**One recurring bug class worth knowing about:** several components stack a
title above a subtitle using nested `<span>` elements. Spans are inline, so
without an explicit `display: block` the two lines overlap. This has been fixed
four separate times in this codebase. If text is overlapping, that's why. The
same cause with a different symptom: a `<span>` given a `height` renders as
literally nothing, because an inline box ignores height and gives an
absolutely-positioned child a zero-size containing block.

## Motion

`js/core/motion.js` is progressive enhancement throughout: the reveal class is
applied from JS rather than authored into the markup, so if the file fails to
load nothing is hidden. Everything collapses under `prefers-reduced-motion`.

**Scroll reveal is a geometry predicate re-evaluated on scroll, not an
IntersectionObserver.** IO is edge-triggered — it fires when intersection
_changes_. Observe an element below the fold, then jump past it (anchor link,
restored scroll position, a flick on a trackpad) and it goes from
not-intersecting to not-intersecting: no callback, and the element stays at
opacity 0 for the life of the page. Asking "is this element above the reveal
line?" each scroll frame cannot miss that, and the listener detaches once the
last pending element has revealed. An e2e check jumps to the bottom of the
landing page and fails if anything is left invisible.

**Kinetic type and gradient-clipped text are resolved, not stacked.** Per-word
masks require each word to be its own inline-block, which makes words inside a
`background-clip: text` element inherit the transparent fill and paint nothing.
Giving each word its own gradient restarts the ramp per word. So `M.kinetic`
reads the gradient stops back out of the computed style and assigns
per-character colours — in sync with `--grad-text` on both themes, monotonic
across the phrase, and unaffected by line wrapping.

## Routing

Hash-based, in `js/app.js`. `ROUTES` maps a hash to a view function;
`#/chapter/:id` is special-cased. Unknown routes fall through to the landing
page rather than erroring.

Per-view cleanup is handled by three registration hooks — `App.onScroll`,
`App.onKey`, `App.onLeave` — all cleared on navigation. A view that adds a
global listener or appends outside its own container must register a cleanup via
`App.onLeave`, or it leaks across navigations. The chapter reader does this for
its fixed reading-progress bar.

## Testing strategy

| Layer      | Tool               | What it covers                                                                                                                                                                         |
| ---------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content    | `npm run validate` | Schema, cross-references, answer indices, duplicate ids, table arity, unbalanced markdown                                                                                              |
| Core logic | `npm test`         | util, store, plan engine — 76 assertions, no browser                                                                                                                                   |
| Whole app  | `npm run test:e2e` | Every route, every chapter, every lab control, personalisation flow, keyboard, themes, mobile, scroll reveal, and a WCAG AA contrast audit of both themes — 67 checks in real Chromium |

The unit tests load browser files into a `vm` context via
`scripts/lib/load-curriculum.mjs`, so there's no duplicate copy of the data or
the logic. Note that arrays created inside the vm realm have a different
prototype, so cross-realm `deepStrictEqual` fails — compare lengths or spread
into host arrays.

The e2e suite fails on **any** console or page error anywhere in the run. That
check has caught more real bugs than the explicit assertions.

## Extension points

Ordered roughly by effort:

- **A chapter** — `npm run new:chapter`, then fill in the skeleton. Add a
  `tracks.js` overlap entry if experienced engineers would partly know it.
- **A glossary term** — one object in `meta.js`.
- **A project** — one object in `meta.js`; it schedules itself into the plan.
- **A lab** — one object in `labs.js` plus a `lab` block in its chapter. The
  validator enforces that the declaration and the embed agree.
- **A block type** — the four steps above.
- **A track** — one object in `tracks.js`; the onboarding picks it up
  automatically.
- **A view** — a function in `views.js`, a `ROUTES` entry, a `NAV` entry.
- **A backend** — see `docs/ROADMAP.md`. The frontend is designed to work
  without one and to degrade gracefully if one is absent.
