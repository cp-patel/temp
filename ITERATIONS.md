# Iteration log — what's done, what's next

Working list for the improvement loop. Each iteration = one coherent theme,
verified (balance harness + Playwright) and pushed. Check this file first so
iterations build instead of repeating.

## Done

**v1 — the game itself** (`ba7377c` and earlier)
Turn-based strategy pivot: draft, chemistry, manifesto economics, buzz→share→seats
engine, INTEL, mahagathbandhan rubber-band + fracture, coalition endgame, balance
harness with measured skill gap.

**v2 — storyline layer** (`f89fd95`)
Five conditional story arcs (CK2-style: triggers read live campaign state, flags
carry between chapters), newspaper front page for week resolution, rival taunts,
per-leader usage tracking. Added tools/screens-test.js dead-end guard.

**v3 — product/retention pass** (this iteration)
PM review found the gaps were product, not game-design:
- **Autosave + resume** — SG.serialize/deserialize (rng re-seeded on load);
  saved after every state change; RESUME button on title. Verified across a
  real page reload.
- **ADVISOR** — the smart test bot doubles as an in-game war room:
  SG.advise() runs it on a clone and returns explained suggestions; each row
  queues on click. Makes week 1 survivable for new players.
- **WEEK 1 BRIEFING** — one-time 4-line overlay, not a tutorial maze.
- **CAMPAIGN DIARY** — end-of-run retelling: week-by-week seat chart (scaled to
  the run's own range), best/worst week, the arc choices retold as prose, the
  "workhorse" leader by usage count.
- **RESULT CARD** — SG.buildResultCard() renders a 1000×560 PNG (ending, seat
  bar, your cast) and downloads it. The shareable artifact.

An adversarial review workflow (3 lenses × verified findings) then confirmed
8 real defects in the first cut, all fixed:
- **HIGH — the briefing wasn't modal**: clicks fell through the dim to the map
  and ENTER resolved week 1 with 4 unused AP. Fixed with a full-canvas blocking
  hit + gating the ENTER shortcut; permanent guard in tools/modal-test.js.
- **MED — the advisor echoed your own queue** as "suggestions" (cloneLite copies
  the live queue; slice(0,4) started at index 0). Now slices past it, and the
  "advisor shrugs" fallback fires at 0 AP.
- **MED — autosave coverage was inconsistent** (keyboard dilemma, manual queue,
  undo didn't save while advisor-accept did). All state changes now save.
- **LOW ×3** — title screen deserialized the whole save every animation frame
  (now cached + invalidated), the save was deleted before the coalition decision
  locked in (now cleared only in finishUp), and G.advice survived a resume.

**v4 — scenario starts** (this iteration)
Four openings on one board, each balance-measured against classic (median seats,
smart play, 250 games): 🗳️ GENERAL ELECTION (282) · ⚡ SNAP ELECTION, 6 weeks
(223) · 🥊 THE UNDERDOG, 3 campaigners vs 7, rivals ahead, 5 AP/week (218) ·
🔥 ANTI-INCUMBENCY, heat 5, cred 38, **share erodes every week** (259).
Scenario picker screen with the changed numbers as chips; draft respects the
cast size; HUD badge + erosion warning; scenario named on the result screen and
the result card; resume carries the scenario (verified across a reload).
The harness gained scenario assertions (challenge modes must be harder than
classic; heatwave within a band; zero invalid states), which also caught the
urban draft slipping below the viability bar — DELHI DUO buffed (freebies −30%,
+2 cred/wk, urban conversion ×1.65), restoring 184 vs random 153.

**v5 — achievements** (this iteration)
Fourteen achievements designed by a three-lens panel (teach / replay / voice)
and merged by a judge, then **measured for reachability** — the point being
that an impossible achievement looks fine and costs a player hours before they
suspect the game rather than themselves. `tools/achievements-test.js` plays
~330 unguided campaigns across every scenario and draft, plus a scripted
*intentional* player per achievement, and fails if anything never fires or
fires in >75% of ordinary runs.

The ladder: 5 bronze · 6 silver · 3 gold. A wide first rung (form a government
from a hung house), silvers that each teach one thing the efficient line skips
(272 with no deal · refuse a deal you could have taken · never let HEAT leave
zero · release the full tape *and* face the questions · a 123-seat manifesto ·
hold all twelve regions against anti-incumbency erosion), and golds that need a
whole draft or several campaigns (fracture the mahagathbandhan · win carrying a
clashing pair · form a government in all four scenarios).

New tracking on the state, all cheap scalars: `everFractured`, `maxHeat`,
`maxApWasted`, `credHit100Week`, `finalWeekBanked`, `startShareByRegion`, plus
a frozen `result.outright`. Gallery screen off the title (locked rows show the
*hint*, unlocked rows show the joke), an unlock reel on the result screen, and
`unlocked[]` / `scenariosWon[]` in the existing store.

Four real bugs fixed on the way, three of them found by the harness rather than
by reading:
- **awards fired before the coalition decision** — the election screen called
  `finishUp()` on its way to the hung-house screen, so the two achievements that
  read `result.coalitionDone` could never fire. Now the award pass waits for the
  deal.
- **`result.outright` was lost** in the election screen's recompute from the
  reveal totals, which overwrites `majority` from `R.tot` (untaxed) after
  `SG.finish` set it from `seatTotals` (taxed).
- **`cloneLite` drifted out of sync** with the tracked fields — the exact
  omission that froze the render loop in v3. Now proven by test: 200
  projections leak nothing into the live state.
- **the reel was frame-rate paced** (`t += 1/60`), so it dealt twice as fast on
  a 120Hz display; now driven off the shared clock, and cleared when a new
  campaign starts.

An adversarial review workflow (4 lenses → independent refuters) then found more,
including one that had been shipping since v1: **BUDGET BONANZA was never free.**
`SG.costOf` returned `ap: a.ap || 1`, so the Ledger Lady's declared `ap: 0` was
charged as 1 — silently contradicting its own on-screen description and undoing
the v1 fix that made cash-income leaders worth drafting. Fixing it moved the
skill gap 96 → 101 and the majority rate 8% → 20%.

Also from that review: the counting-day screen recomputed the result from the
region-by-region reveal, which **skips the seat tax** `SG.seatTotals` applies —
so a court-ordered seat penalty had no effect on the result the player saw. It is
now applied once, before the button is even labelled, and named on screen.
And a double-click on GOVERNMENT FORMATION landed on the fourth coalition
offer — "refuse to deal" — because the offers render where that button was;
there is now a 0.35s guard, and `finishUp` is idempotent.

Four "unreachable" reports from the harness turned out to be harness bugs, not
design bugs — worth recording because it is the same trap as v1's balance
whack-a-mole: the *clean campaign* run had picked the FAITH plank, which bills
+0.9 HEAT a week; the *underdog* run spent every AP but played so badly it
finished second; the *anti-incumbency* run defended one region a week when it
takes two (measured: 11/12 vs 12/12); and the *fracture* run never happened
because the smart bot has never once played ALLIANCE FLIP. A harness measures
the policy you gave it, not the design — again.

`UI.button` now records its label on the hit rect, so tests click controls by
name instead of by hand-computed coordinates. Every previous front-end test in
this repo has broken at least once on layout maths rather than on the game.

## Backlog (ranked)

1. **Leader mood/loyalty** — extends usage tracking into a visible morale stat
   with small buffs/maluses; BENCHED STAR arc already reads the same signal,
   and `st.usage` is now load-bearing for KOI BENCH PAR NAHI too.
2. **Board juice** — animate seat swings on the map after each week; region
   tiles pulse when they change hands.
3. **Daily challenge** — pairs perfectly with scenarios (scenario-of-the-day) —
   fixed seed of the day + shareable score string. Now also pairs with
   achievements: a daily could carry its own one-off medal.
4. **Achievements on the result card** — the PNG does not yet show the medals
   the run earned, which is the obvious shareable moment.
5. **Mobile layout** for the strategy game (arcade already has it) — biggest
   effort, listed last deliberately.

## Verification checklist per iteration

```
node tools/balance.js 250        # skill gap, drafts, scenarios, no invalid states
node tools/screens-test.js      # every screen has a working exit
node tools/modal-test.js        # the briefing overlay is genuinely modal
node tools/achievements-test.js # every achievement reachable, none wallpaper
node <scratchpad>/iter*.js      # feature-specific Playwright test
```
