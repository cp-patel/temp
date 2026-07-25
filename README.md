# Forge — AI Engineering Academy

An interactive, opinionated curriculum for becoming an **AI application engineer**: the
person who ships products on top of models someone else trained, and can prove the
result works.

**41 chapters · 8 phases · 12 interactive labs · 6 projects · 153 flashcards · ~37,000 words**

## Run it

No build step, no dependencies, no accounts.

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `index.html` directly — it works from `file://` too, since everything is
plain ES5-compatible scripts and CSS with no module loading.

## What's in it

### The path

| Phase                                | Focus                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 01 · Foundations                     | Next-token prediction, tokens and cost, sampling, model choice                                                |
| 02 · Prompting & Context Engineering | Instruction hierarchy, few-shot, structured output, context budgets, failure modes                            |
| 03 · Building Real Applications      | API surface, streaming and latency, caching/retries/idempotency, conversation state, unit economics           |
| 04 · Retrieval & Knowledge Systems   | Embeddings, chunking, vector indexes, hybrid search + reranking, end-to-end RAG, advanced patterns, diagnosis |
| 05 · Tools, Agents & Orchestration   | Function calling, the agent loop, agent memory, multi-agent systems, MCP, guardrails                          |
| 06 · Evaluation                      | Why evals are the job, building eval sets, metrics, LLM-as-judge, CI gates and online monitoring              |
| 07 · Production Engineering          | Observability and tracing, prompt injection and the lethal trifecta, deployment, safety and privacy           |
| 08 · Frontier & Career               | Fine-tuning decisions, multimodal, local inference, staying current                                           |

### Interactive labs

Each lab exists to make one idea physical rather than described. They're embedded in
their chapters and also collected under **Labs**.

| Lab                         | Teaches                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Tokenizer & cost visualiser | How text fragments, and what it costs — including why IDs and non-Latin scripts are expensive |
| Temperature & top-p sandbox | What sampling parameters do to the probability distribution                                   |
| Model routing decision tool | Constraint-driven model selection with cost estimates                                         |
| Prompt anatomy builder      | Reorder prompt blocks; an audit flags broken caching and buried instructions                  |
| Context budget allocator    | Six consumers, one window — including what happens with no output reserve                     |
| Latency waterfall           | Which optimisations move TTFT, and which don't                                                |
| Dense vs lexical vs hybrid  | Where each retriever fails, demonstrated rather than asserted                                 |
| Chunking playground         | Four strategies on one document, with orphan and mid-sentence-cut detection                   |
| RAG pipeline simulator      | Toggle stages; see which failure each one causes                                              |
| Agent loop stepper          | Step a ReAct trace while the budget drains                                                    |
| Eval scorecard & CI gate    | Confidence intervals, and why a 4-point move on 50 cases is noise                             |
| Prompt injection sandbox    | Which defences actually hold (delimiters don't; capability removal does)                      |

Two labs use deliberate simplifications, documented in the labs themselves: the
tokenizer is a heuristic approximation of subword segmentation, and the dense
retriever is a hand-authored concept-space stand-in for an embedding model. Both
reproduce the behaviour that matters for the lesson without shipping model weights.

### Progress tracking

- Chapter completion, quiz scores with explanations, and inline knowledge checks
- Spaced-repetition flashcard review (Leitner boxes, 1/2/4/8/16-day intervals)
- XP, levels, streaks, per-phase mastery, milestone badges, activity heatmap
- Per-chapter notes
- Project milestone checklists
- Command palette (`⌘K` / `Ctrl+K` or `/`) over chapters, labs, glossary, and commands

Everything is stored in `localStorage` under a single key. Nothing is sent anywhere —
there is no analytics, no backend, and no network request after page load. Export and
import your progress as JSON from **Settings**.

## Structure

```
index.html                  app shell, script/style loading order
styles/
  tokens.css                design tokens; full dark + light themes
  base.css                  reset, typography, buttons, chips, cards
  shell.css                 sidebar, topbar, command palette, toasts
  views.css                 landing, roadmap, dashboard, library, projects
  reader.css                chapter prose, code blocks, callouts, quiz
  labs.css                  lab-specific components
js/
  core/
    icons.js                inline SVG icon set
    util.js                 DOM helpers, inline markdown, syntax highlighting
    store.js                persistent state, XP, streaks, card scheduling
  content/
    meta.js                 phases, projects, glossary
    p0..p7-*.js             chapter content, one file per phase
  ui/
    labs.js                 the 12 interactive labs
    render.js               block renderer, quiz engine
    views.js                page views
  app.js                    router, shell, palette, keyboard
```

Chapter content is plain data. A chapter is an object with `body` as an array of typed
blocks (`p`, `h`, `code`, `note`, `table`, `steps`, `compare`, `flow`, `list`, `check`,
`lab`), plus `objectives`, `takeaways`, `quiz`, `cards`, and `resources`. Adding a
chapter means appending one object to the relevant phase file — no build, no
registration step.

## Keyboard

| Key                   | Action                            |
| --------------------- | --------------------------------- |
| `⌘K` / `Ctrl+K` / `/` | Command palette                   |
| `j` / `k`             | Next / previous chapter           |
| `Space`               | Reveal flashcard                  |
| `1` / `2`             | Grade flashcard (missed / got it) |
| `Esc`                 | Close palette                     |

## Notes on the content

It's opinionated on purpose. Where practitioners disagree, the text takes a position
and says why — that evaluation is the highest-leverage skill, that most "agents"
should be workflows, that prompt injection is unsolvable at the prompt layer, that
Postgres with pgvector is the right default. Costs and latencies are illustrative
orders of magnitude rather than quotes; substitute your provider's real numbers.

Model names and prices deliberately don't appear as specifics, because they churn
faster than the rest of the material. The chapters point at tiers and at the method
for choosing, which outlast any particular model.

## Deploying

Push to GitHub and enable Pages (Settings → Pages → Source: GitHub Actions). The
included workflow publishes the repository root on every push to the default branch.
