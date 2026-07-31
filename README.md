# Forge — AI Engineering Academy

An interactive, opinionated curriculum for becoming an **AI application
engineer**: the person who ships products on top of models someone else trained,
and can prove the result works.

**44 chapters · 8 phases · 17 interactive labs · 6 projects · 167 flashcards · 79 knowledge checks ·
~73,000 words · zero dependencies**

It adapts to you. Tell it you're a backend engineer and it marks the nine chapters
you can skim — each with a note on exactly what _is_ new in it — and builds a
week-by-week schedule from your real available hours.

---

## Run it

```bash
npm run dev          # http://localhost:8000
```

Or open `index.html` directly — it works from `file://` too. There is no build
step, no bundler, and no runtime dependencies. `npm install` fetches dev tools
(Prettier, Playwright) only.

## What it does

### The path

Eight phases in a deliberate order. Each ends with a project.

| Phase                                | Focus                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 01 · Foundations                     | What the job is, **what transfers from backend work**, next-token prediction, tokens & cost, sampling, model choice |
| 02 · Prompting & Context Engineering | Instruction hierarchy, few-shot, structured output, context budgets, failure modes                                  |
| 03 · Building Real Applications      | API surface, streaming & latency, caching/retries/idempotency, conversation state, unit economics                   |
| 04 · Retrieval & Knowledge Systems   | Embeddings, chunking, vector indexes, hybrid search + reranking, end-to-end RAG, advanced patterns, diagnosis       |
| 05 · Tools, Agents & Orchestration   | Function calling, the agent loop, memory, multi-agent, MCP, guardrails                                              |
| 06 · Evaluation                      | Why evals are the job, eval sets, metrics, LLM-as-judge calibration, **agent & trajectory evals**, CI gates         |
| 07 · Production Engineering          | Observability, prompt injection & the lethal trifecta, deployment, safety & privacy                                 |
| 08 · Frontier & Career               | Fine-tuning decisions, multimodal, local inference, **interviewing**, staying current                               |

Every chapter has learning objectives, prose with code/tables/callouts/diagrams,
two inline knowledge checks, key takeaways, a scored quiz with per-answer
explanations, flashcards, and further reading. Chapters and projects point at each
other: every project milestone links to the chapter that teaches it, and every
chapter lists the milestones that apply it — including which you've already
ticked. Every glossary term names the chapter that teaches it, and every chapter
lists the terms it defines.

### Personalised plan

Four questions produce a plan that annotates every chapter. They're offered when
you arrive somewhere planning is the point — the roadmap, the dashboard, your plan
— and never over the landing page or a chapter someone linked you to. A note
appears on a row only when it says something about that chapter — the mode chip
and the legend carry the rest, so the thirteen chapters with real guidance are the
thirteen you notice:

- **Deep** — core material. Load-bearing, and what interviews probe.
- **Study** — new to you. Read properly.
- **Skim** — you already know this. Here is precisely what's new in it.

A backend engineer with 4 years' experience gets 16 deep, 19 study, 9 skim, and
a 15-week schedule at 10 h/week — which matches reported real-world timelines for
this transition. The skim notes are the point:

> **Caching, Retries & Idempotency** — _skim._ Exponential backoff with full
> jitter, circuit breakers, and idempotency keys with an atomic claim will all be
> familiar. Read this chapter for **prompt caching**: it needs a byte-identical
> prefix, which makes prompt _layout_ a cost decision worth 40–70% of your input
> bill, and a single interpolated timestamp destroys it.

The plan is derived, never stored — change your profile or add a chapter and it
recomputes. Estimated durations:

| Hours / week | Backend engineer | Starting fresh |
| ------------ | ---------------- | -------------- |
| 3            | 50 weeks         | 52 weeks       |
| 5            | 30 weeks         | 31 weeks       |
| 10           | **15 weeks**     | 16 weeks       |
| 20           | 8 weeks          | 8 weeks        |

Those include project hours, which dominate: 29h of chapters and labs against
118h of building. Reading-only estimates are how you get an "it takes two weeks"
number that nobody should believe.

### Interactive labs

Seventeen labs, each making one idea manipulable rather than described.

| Lab                           | Teaches                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Tokenizer & cost visualiser   | How text fragments, and why IDs and non-Latin scripts are expensive          |
| Temperature & top-p sandbox   | What sampling parameters do to the probability distribution                  |
| Model routing decision tool   | Constraint-driven model selection with cost estimates                        |
| Prompt anatomy builder        | Reorder prompt blocks; an audit flags broken caching and buried instructions |
| Context budget allocator      | Six consumers, one window, and what happens with no output reserve           |
| Latency waterfall             | Which optimisations move TTFT, and which don't                               |
| Dense vs lexical vs hybrid    | Where each retriever fails — demonstrated, not asserted                      |
| Chunking playground           | Four strategies on one document, with orphan and mid-sentence-cut detection  |
| RAG pipeline simulator        | Toggle stages; see which specific failure each one causes                    |
| Agent loop stepper            | Step a ReAct trace while the budget drains                                   |
| Eval scorecard & CI gate      | Confidence intervals, and why a 4-point move on 50 cases is noise            |
| **Golden trajectory scorer**  | Break an agent's route and watch which criteria catch it                     |
| Prompt injection sandbox      | Which defences hold (delimiters don't; capability removal does)              |
| **Conversation cost curve**   | Why a 20-turn chat bills quadratically, and what flattens it                 |
| **Why chains of agents fail** | Move reliability and agent count; watch the product, not the average         |
| **Fine-tuning break-even**    | One fixed cost against a cheaper rate — find the crossing point              |
| **VRAM fit calculator**       | Weights are what people budget for; the KV cache is what defeats them        |

Three labs use deliberate simplifications, stated in their own UI: the tokenizer
approximates subword segmentation heuristically, the retrieval lab's dense
retriever is a hand-authored concept-space stand-in for an embedding model, and
the VRAM calculator models activation scratch as a flat 1.2 GiB. The first
version of the retrieval lab used lexical hashing and _couldn't demonstrate
paraphrase matching_ — the lab's entire point — so it was rebuilt.

### Readiness diagnostic

Percent-complete answers "how much of this course have I done?". A career-changer
is asking something else: **am I ready, and if not, what is the gap?** The
readiness page answers that from work already recorded — no new tracking — by
scoring it against the seven competencies an AI engineering loop tests, weighted
the way the loop weights them.

| Competency                  | Share | What it probes                                                            |
| --------------------------- | ----- | ------------------------------------------------------------------------- |
| Application engineering     | 20%   | Prompt structure, structured output, streaming, state, caching, unit cost |
| Evaluation                  | 17%   | Eval sets, metrics, judge calibration, trajectory scoring, CI gates       |
| Model internals & economics | 15%   | What a token costs, why the same prompt answers differently twice         |
| Retrieval systems           | 15%   | Chunking, hybrid search, reranking, diagnosing plausible nonsense         |
| Production & security       | 15%   | Tracing, prompt injection, deployment, privacy                            |
| Agents & tools              | 13%   | Tool design, the loop, budgets, when a workflow beats an agent            |
| Judgement & communication   | 5%    | Fine-tune or prompt, build or buy — and the behavioural round             |

Each score is made of four parts: chapters read (30%), quiz accuracy (25%), labs
used (15%), and **project milestones (30%)**. Evidence is weighted highest on
purpose — reading every chapter and taking every quiz perfectly reaches 60%, not
100%, because a diagnostic you can satisfy by reading would contradict the thing
this curriculum argues. Recall is scored over _every_ question in a competency,
not the ones you happened to take, so one perfect quiz isn't full marks for a
seven-chapter subject.

Bands are calibrated against the real trajectory rather than round numbers:
working through the roadmap properly scores 15% after Foundations, 35% after
Building, 63% after Agents, 80% after Evaluation, 95% after Production. So a band
changes when a phase closes.

It also answers "what do I do right now" with a ranked list — but **prerequisites
are a gate, not a discount**. Production is a four-chapter phase carrying 15% of
the loop with one lab, so that lab's value-per-item is roughly 3× anything else,
and a pure lift ranking sent a learner at 0% to read about prompt injection. Two
attempts at damping it with a multiplier both failed; the rule that holds is
structural — anything whose earlier phases are done outranks anything whose aren't,
whatever the arithmetic says. Look-ahead items still appear, labelled `ahead`.

### Session planner

The thing that actually stops people is not motivation or the content — it is
sitting down with an awkward amount of time and a 44-chapter roadmap and having to
work out what fits. Name your minutes on the dashboard and it becomes an ordered
plan, not a menu:

> **10 min** · Review 7 due cards (3m) → Resume _Sampling: Temperature, Top-p &
> Determinism_ (7m)
> **90 min** · Review all 39 due cards (16m) → resume the open chapter (19m) → two
> untouched labs (6m each) → _The LLM API Surface_ (18m) → _Streaming & Perceived
> Latency_ (23m)

Ordering rules, all of them derived from something the app already knows:

- **Due cards first**, capped at a third of the session. Cards decay, so a card
  reviewed on its due day is the whole mechanism — but a fresh deck of 40 would
  otherwise eat a 25-minute session and you would finish having read nothing.
- **Then whatever you left open.** You already paid for the context, and the app
  remembers your scroll position.
- **Then the readiness ranking**, so this never disagrees with the diagnostic or
  the roadmap.
- **Then retrieval practice** — an untaken quiz on a chapter you have read is the
  best short item in the app.
- **Project milestones only in sessions of 45 minutes or more.** They are hours of
  work; offering one for a coffee break invites ticking it without doing it, which
  corrupts the one signal readiness weights highest.

Two decisions took a second attempt. A **lab is only a session of its own once its
chapter is read** — the first version opened a Phase 3 lab for a learner at zero,
landing them mid-chapter on a widget with no context, and listed a lab whose
chapter was already in the same plan, double-counting it. And chapters run 13–23
minutes, so a 25-minute budget fits exactly one and leaves an awkward remainder;
packing that with a third of the next chapter loses the thread, and reporting
eleven idle minutes wastes them. So there is a **stretch item** — one named
chapter, offered rather than scheduled, and never counted in the total.

### Progress tracking

- Chapter completion, quiz scores with explanations, inline knowledge checks
- Spaced-repetition flashcards (Leitner boxes, 1/2/4/8/16-day intervals), which a
  chapter unlocks when you complete it — you can't retrieval-practise a chapter
  you haven't read, so a fresh account has an empty deck rather than 167 cold cards
- XP, levels, streaks, per-phase mastery, milestone badges, activity heatmap
- Per-chapter notes, and project milestone checklists where every milestone links
  to the chapter that teaches it
- Command palette (`⌘K` / `Ctrl+K` / `/`) over chapters, labs, glossary, commands
- Keyboard-operable throughout: a skip link, focus-trapped dialogs that close on
  Escape and restore focus, and lab toggles that are real `role="switch"` buttons
- Screen-reader-legible: a correct heading outline on every route, navigation
  announced in a live region, and quiz results conveyed in text as well as colour

Everything is stored in `localStorage` under one key, type-checked on read so a
hand-edited import cannot break the app. If the browser blocks storage — private
browsing, a full quota — the app keeps working in memory and says so, because the
alternative is losing a session's work without warning. **No network requests after
page load** — no analytics, no backend, no telemetry. Export and import your
progress as JSON from Settings.

## Project layout

```
index.html                  app shell; load order is the dependency graph
styles/                     8 stylesheets, tokens → base → shell → views → reader → labs → plan → motion
js/core/                    icons, util (markdown/highlighting/tokenizer/vectors), motion, store
js/content/                 phases, projects, glossary, 8 phase files, tracks (plan engine)
js/ui/                      labs, block renderer + quiz, views, onboarding
js/app.js                   router, shell, command palette, keyboard
scripts/                    dev server, content validator, scaffolder, stats
tests/unit/                 108 assertions — util, store, plan engine
tests/e2e/                  162 checks in real Chromium, incl. a full first-visitor walkthrough
                            and a WCAG AA audit of both themes
docs/                       architecture, content schema, roadmap
```

## Commands

```bash
npm run dev            # static server on :8000
npm run validate       # content schema, cross-references, answer indices, table arity
npm test               # unit tests (util, store, plan engine)
npm run test:e2e       # every route, chapter, and lab control in Chromium
npm run test:all       # all three
npm run check          # format check + validate + docs check + unit tests
npm run check:docs     # the counts in README and docs/ against the curriculum
npm run new:chapter    # scaffold a schema-valid chapter
npm run stats          # the numbers in this README, computed
npm run format         # Prettier
```

CI runs the same commands on every push.

## Extending it

Content is plain data — a chapter is an object with a `body` array of typed
blocks. Adding one takes no build step and no registration:

```bash
npm run new:chapter -- --phase retrieval --id query-rewriting \
                       --title "Query Rewriting in Depth"
npm run validate
```

The validator is the safety net. It catches quiz answer indices out of range,
labs declared but never embedded, project milestones referencing a chapter that
doesn't exist, duplicate ids, ragged tables, unbalanced
inline markdown, unknown icons, and phases with no chapters — the mistakes that
otherwise surface as a blank panel in the browser.

- **`docs/CONTENT-SCHEMA.md`** — every field and block type
- **`docs/ARCHITECTURE.md`** — layering, state, the plan engine, why there's no build step
- **`docs/ROADMAP.md`** — what's next and what's deliberately out of scope
- **`CONTRIBUTING.md`** — writing standards and code conventions

## Notes on the content

**It's opinionated on purpose.** Where practitioners disagree, the text takes a
position and says why — that evaluation is the highest-leverage skill, that most
"agents" should be workflows, that prompt injection is unsolvable at the prompt
layer, that Postgres with pgvector is the right default. Costs and latencies are
illustrative orders of magnitude, not quotes; substitute your provider's numbers.

**Model names and prices deliberately don't appear as specifics**, because they
churn faster than the rest of the material. The chapters point at tiers and at
the method for choosing, which outlast any particular model.

**The curriculum is shaped by what's actually being hired for.** Reported 2026
interview loops weight roughly 40% retrieval/evals/agents, 30% production
systems, 20% model internals, 10% behavioural — and the evaluation round,
especially its agentic form, is what filters most candidates. That's why
evaluation gets a full phase, a dedicated chapter on golden trajectories and
step-level scoring, and its own capstone.

## Deploying

Push to GitHub and enable Pages (Settings → Pages → Source: GitHub Actions). The
included workflow publishes the repository root on every push to the default
branch. There's nothing to build.
