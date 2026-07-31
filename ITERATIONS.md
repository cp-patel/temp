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

## Backlog (ranked)

1. **Scenario starts** — "snap election" (6 weeks), "underdog" (3 leaders,
   rivals lead), "anti-incumbency" (start with heat 5). One data structure,
   big replay value.
2. **Achievements** for strategy mode (arcade already has cards): win without
   memes, win after the tape arc, fracture the mahagathbandhan, all-clean sweep.
3. **Leader mood/loyalty** — extends usage tracking into a visible morale stat
   with small buffs/maluses; BENCHED STAR arc already reads the same signal.
4. **Board juice** — animate seat swings on the map after each week; region
   tiles pulse when they change hands.
5. **Daily challenge** — fixed seed of the day + shareable score string.
6. **Mobile layout** for the strategy game (arcade already has it) — biggest
   effort, listed last deliberately.

## Verification checklist per iteration

```
node tools/balance.js 150        # skill gap, drafts, no invalid states
node tools/screens-test.js      # every screen has a working exit
node <scratchpad>/iter*.js      # feature-specific Playwright test
```
