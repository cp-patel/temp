# CLAUDE.md

## What this project is

A political-satire game project. Vanilla JS + HTML5 canvas, **zero runtime
dependencies, no build step** — both games run by opening the HTML file from
`file://`. Keep it that way.

Three things live here:

| | Status |
| --- | --- |
| `index.html` — **CHUNAV CHANAKYA**, turn-based election strategy game | shipped, frozen |
| `arcade.html` — **MITRON MAYHEM**, 14 reflex microgames | shipped, frozen |
| `REDESIGN.md` — **ACHHE DIN SIMULATOR**, the active direction | concept, awaiting product-owner sign-off |

**Do not start building the Achhe Din Simulator until the product owner has
answered the three calls at the end of `REDESIGN.md`** (name, spice level,
which episode is the vertical slice). Read `REDESIGN.md` in full before
touching anything new — especially the **juice mandate** (§6): every input
reacts within 100 ms, ≤15 words on screen during play, teach by doing, every
payoff is a shareable meme-card PNG.

## The one architectural rule

`src/strat/model.js` is a **pure rules engine** — seeded RNG, no canvas, runs
headlessly in node. `src/strat/game.js` renders and never computes a rule.
This split is why balance is *measured* (hundreds of automated campaigns)
instead of asserted. Any new game mode must keep the same split: pure engine
file + rendering file, with a headless harness in `tools/`.

## Layout

```
src/util.js       canvas primitives, palette, easings   ┐ shared engine —
src/audio.js      WebAudio synth (no audio files)       │ any new game mode
src/input.js      keyboard + mouse + touch              │ should reuse these
src/fx.js         particles, screenshake, confetti      ┘
src/strat/        the strategy game (data, model, ai, faces, ui, game)
src/games-*.js …  the arcade microgames
tools/            headless + Playwright verification (see below)
```

## Verify before every commit

```
npm run balance          # 250 headless campaigns: skill gap, draft viability, no invalid states
npm run achievements     # every achievement reachable, none fires in >75% of runs
npm run screens          # every screen renders a working exit control (dead-end guard)
npm run modal            # the week-1 briefing overlay genuinely blocks the board
npm run achievements-ui  # real-click Playwright pass over unlock/persist paths
npm test                 # all of the above
```

Playwright resolution is handled by `tools/pw.js` — it works unconfigured in
the Claude Code cloud env and with a local `npm i -D playwright && npx
playwright install chromium`; `CHROMIUM_PATH` overrides the browser binary.

## Hard-won invariants (each of these was a real shipped bug)

- **`SG.cloneLite` must copy every field that `applyAction`/`markPeaks`
  write.** `SG.project()` runs on a clone *every frame*; a missed field either
  corrupts the preview or throws inside the render loop and freezes the game.
  This has happened twice. When you add state, add it to the clone and to a
  test.
- **`SG.costOf` uses `a.ap === undefined ? 1 : a.ap`.** The old `a.ap || 1`
  silently charged an action point for declared-free actions for four
  iterations. Beware falsy-vs-missing everywhere in the engine.
- **`SG.applyCoalition` mutates `result` in place.** The counting-day facts
  are frozen as `result.outright` before any deal — read the frozen field,
  never recompute majority after government formation.
- **UI tests click controls by label, never by coordinates.** `UI.button`
  records its label on the hit rect for exactly this reason. Every
  coordinate-based test in this repo's history broke on layout maths.
- **`SG.serialize` drops `rng`/`weekReport`; `deserialize` re-seeds from
  `(seed, week)`.** Resume-safety over replay-determinism, by design.
- **A balance harness measures the policy you gave the bot, not the design.**
  Before nerfing a mechanic the bots call weak, check whether the bots ever
  actually use it (see `DESIGN.md` — this trap has been hit three times).

## Content guardrails

Satire aims **up**: public policies, public statements, public spectacle. The
Leader is a parody archetype — unmistakable, never named — while events
reference real, recognizable public moments. Out of scope always: tragedies
(migrant crisis, oxygen shortage), communal flashpoints, private lives,
targeting ordinary citizens or communities. The parody disclaimer stays on
every title screen and README.

## Docs

- `README.md` — player-facing
- `REDESIGN.md` — the active concept (Achhe Din Simulator)
- `ITERATIONS.md` — iteration log + ranked backlog; **update it every iteration**
- `DESIGN.md` — v1 design notes and post-mortems
