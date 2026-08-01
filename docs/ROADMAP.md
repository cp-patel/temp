# Project roadmap

What this is, what it deliberately isn't yet, and the designed extension points.
Written so the next change doesn't have to rediscover the reasoning.

## Where it stands

<!-- The numbers below are verified by `npm run check:docs`; run `npm run stats`
     to recompute them. Test counts are deliberately absent — they moved on
     almost every commit and nobody reads a stale one. -->

| Area            | State                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Curriculum      | 44 chapters, 8 phases, 72,528 words of prose, 73 code blocks          |
| Interactive     | 17 labs, 79 inline knowledge checks, 165 quiz questions               |
| Practice        | 6 projects with 43 verifiable milestones, 167 spaced-repetition cards |
| Personalisation | 5 tracks, 14 claimable skills, 17 per-chapter delta notes             |
| Diagnostic      | 7 weighted competencies, 4-part scoring, ranked next actions          |
| Planning        | Week-by-week schedule, plus a per-session planner from 10 to 90 min   |
| Output          | Markdown portfolio export, 28 prompted measures across 6 projects     |
| Rehearsal       | 28 interview drills, 5 question shapes, rubric-based self-marking     |
| Reference       | 52-term glossary, 91 external resources                               |
| Tooling         | Validator, unit + e2e suites, docs check, scaffolder, CI              |
| Deployment      | Static; GitHub Pages workflow included; runs from `file://`           |

## Design commitments

Changes that would break these need a strong argument.

1. **No build step for the site.** It runs from `file://`, unchanged. This is
   what makes it durable and contributable.
2. **No network calls after page load.** No analytics, no CDN, no telemetry.
   Progress lives in `localStorage` and never leaves the browser.
3. **The plan is derived, never stored.** Adding a chapter updates every existing
   learner's plan with no migration. The readiness score follows the same rule for
   the same reason: a stored number goes stale silently.
4. **Content is data.** Anyone who can edit a JS object can contribute a chapter.
5. **Simplifications are disclosed in the UI**, not just in a comment.
6. **No number is flattering by accident.** A metric a learner might act on is
   calibrated against the real trajectory and tested at both ends — the readiness
   diagnostic is 0 on a fresh account, cannot exceed 60 on reading alone, and
   reaches exactly 100 only when the projects are done. A score that saturates
   early is worse than no score, because someone will believe it.

## Next, in rough priority order

### 1. Optional sync backend

The single most-requested capability of a local-first app is "my progress is
trapped in one browser". The frontend is already shaped for this: all state is
one JSON blob behind `Store`, and `Store.export()` / `Store.import()` already
round-trip it (there's a test).

**Design:** a small service with one resource.

```
POST /api/v1/progress      body: { state, clientUpdatedAt }
GET  /api/v1/progress      -> { state, serverUpdatedAt }
```

- Auth by a device token the user pastes into Settings; no accounts, no email.
- Last-write-wins on the whole blob, with the loser preserved for one recovery
  window. Field-level merge is not worth the complexity for single-user data.
- The frontend must treat the backend as **optional and possibly absent**:
  unreachable means fall back to `localStorage` silently, not an error banner.

Guard rails: don't let this become an account system. The moment it needs
password reset it has outgrown its purpose.

### 2. A reference backend that is itself the teaching artifact

This is the highest-value extension for the target reader — an experienced
backend engineer — and the most interesting.

Implement the curriculum's own patterns over the curriculum's own content, in a
service they can read:

- **Hybrid retrieval** over all 44 chapters: BM25 + embeddings, fused with RRF,
  then a cross-encoder rerank. Phase 04, made real.
- **`POST /api/v1/ask`** — grounded answers with verified citations back to
  chapter anchors, and a genuine abstention path. Phase 04 again.
- **Tracing** with OpenTelemetry, capturing rendered prompt, chunk IDs _with
  scores_, tokens, and cost per request. Phase 07.
- **Prompt caching, retries with full jitter, idempotency keys.** Phase 03.
- **An eval harness** with a labelled set over the site's own content, gating CI
  on faithfulness and recall@5. Phase 06.

Two requirements that make it genuinely useful rather than decorative:

- **A deterministic stub provider** so the whole thing runs and its tests pass
  with no API key. Without this it's undemonstrable and will rot.
- **Every module cross-referenced to the chapter it implements**, so reading the
  code and reading the curriculum reinforce each other.

Keep the frontend fully functional without it. The search box gets better when
the backend is present; it doesn't stop working when it isn't.

### 3. Content gaps worth filling

- **Fine-tuning, hands-on.** The decision chapter exists; a worked LoRA run with
  before/after eval numbers doesn't.
- **Voice and realtime.** Mentioned in the multimodal chapter, not built out.
  Streaming duplex, interruption handling, and sub-500ms budgets are a genuinely
  different architecture.
- **Structured data + LLMs.** Text-to-SQL, its failure modes, and why the
  aggregation trap from Phase 04 shows up here too.
- **Cost attribution at organisational scale.** Chargeback, per-tenant budgets,
  quota hierarchies.
- **A second interview-prep chapter**: the take-home and system-design rounds,
  with a worked example.

### 4. Labs worth adding

- **A prompt-caching simulator** — mutate the prefix and watch the hit rate and
  bill respond. Currently taught only in prose, and it's the highest-ROI
  optimisation in the whole curriculum.
- **A chunk-boundary quiz** — show a document, ask where the split should go,
  score against the structural answer.
- **A cost-attribution explorer** — a traffic mix with a heavy-user tail, so the
  p95-user point from Phase 03 becomes visible rather than asserted.
- **A judge-calibration lab** — label cases yourself, compare to a simulated
  judge, watch Cohen's kappa move. Phase 06's hardest idea, currently prose only.

### 5. Platform improvements

- **Deep links into labs** with pre-set state, so a chapter can say "open the
  budget lab with retrieval at 55%".
- **Per-chapter notes export** to Markdown — the notes exist but are trapped.
- **A printable plan** for people who want the schedule on paper.
- **Accessibility audit.** Keyboard paths and focus management are decent; the
  labs need a proper screen-reader pass, and the flow diagrams need text
  alternatives.
- **Search over chapter bodies**, not just titles and subtitles. The command
  palette currently misses content buried in prose. This is also the natural
  first consumer of the retrieval backend above.
- **Chapter notes in the export.** The portfolio assembles project evidence; the
  per-chapter notes are still trapped in `localStorage` with no way out but the JSON
  dump. `U.download` and the export machinery are both in place now, so this is a
  small addition rather than a feature.
- **More drills, and a mock loop.** 28 drills is four per competency — enough to
  rehearse, not enough to avoid memorising them. The natural next step is a "full
  loop" mode: five drills drawn across competencies in the order a real onsite runs
  them, timed end to end, with no reveal until the whole loop is done.
- **Drills as a readiness signal, if it can be earned.** They are excluded today
  because self-reporting is the easiest input to inflate. A version where the learner
  types their answer before seeing the rubric would be checkable enough to count —
  and would need the readiness bands recalibrated, which is why it is a separate
  piece of work rather than a flag.
- **Session planner deep links.** The planner names the items; it cannot yet hand
  you a single URL that walks them in order. Related to the lab deep-links above,
  and the natural way to make a plan resumable across devices once there is a sync
  backend.

## Explicitly out of scope

- **User accounts, social features, leaderboards.** Not the point.
- **Video.** Expensive to produce, impossible to keep current, and worse than
  text for reference.
- **A mobile app.** The site is responsive; a wrapper adds nothing.
- **Certificates.** They're near-zero hiring signal — the curriculum says so in
  Phase 08, and shipping one would contradict its own advice.

## Maintenance notes

**Content ages unevenly.** The durable material (evaluation methodology,
retrieval fundamentals, context engineering, security models) needs review
roughly annually. The volatile material — anything touching tooling, provider
capabilities, or the interview market — needs review every six months. The
content deliberately avoids specific model names and prices to slow this down,
and that convention should be preserved.

**The validator is the safety net.** Every bug class that has bitten this
codebase twice is now a validator rule or a test. When you find a new one, add
the check rather than just fixing the instance.
