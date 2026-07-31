# 🗳️ CHUNAV CHANAKYA

**A turn-based meme election strategy game.** Draft four star campaigners from a cast of
ten Indian-politics archetypes, write a two-plank manifesto, and out-think two rival
fronts across ten weeks and 543 seats. No reflexes, no timers — every decision waits
for you.

Plus **MITRON MAYHEM** (`arcade.html`), the 14-microgame reflex gauntlet, kept as a
side mode.

> **This is parody.** Every character is an invented archetype inspired by public
> political personas and meme culture. Every "quote" and every ability was written for
> this game. Nothing here is a real statement by a real person, and nothing targets a
> religion, a community, or a private individual.

---

## ▶ Play

```bash
git clone -b claude/modi-meme-game-7g05m8 https://github.com/cp-patel/temp.git chunav
cd chunav
open index.html          # macOS   ·   xdg-open (Linux)   ·   start (Windows)
```

Or double-click `index.html`. No build, no dependencies, works offline.
A local server (`npx serve .`) is only needed if you want your best result to persist
in Safari/Firefox, which block `localStorage` on `file://`.

**Mouse drives everything.** `ENTER` ends the week · `ESC` backs out · `1-3` answers a
dilemma · `M` mutes.

## 🧠 The game in one paragraph

**BUZZ** is momentum and it decays 45% a week. **VOTE SHARE** is permanent. Turning one
into the other is the whole game — and **CADRE** plus **CREDIBILITY** set the exchange
rate (0.72× at zero credibility, 1.27× at full). Seats are allocated on share², so
*leading* a region pays a bonus: concentration beats spreading thin. You get 4 action
points a week for ten weeks. That's 40 decisions to win 272 of 543 seats.

## 🎭 The cast — every persona is a mechanic

| Leader | Archetype | Passive | Signature move |
| --- | --- | --- | --- |
| **MITRON JI** | The 56-Inch Orator | +10% buzz on all rallies | **MEGA ROADSHOW** — huge buzz + spillover |
| **CHANAKYA JI** | The Booth Machine | +24% conversion efficiency | **BOOTH MANAGEMENT** — bank buzz as votes instantly |
| **YUVRAJ BHAIYA** | The Yatra Yodha | +14 cadre a week | **JODO YATRA** — buzz across a region *and* its neighbours, pays again next week |
| **MUFFLER MAN** | The Freebie Fakir | schemes −25%, cities convert +50% | **FREE BIJLI-PAANI** — instant urban share, empties the treasury |
| **MAHARAJ JI** | The 4 AM Monk | regions you lead become fortresses | **ANUSHASAN DRIVE** — locks a fortress for 3 weeks |
| **SUITED SIR** | The Prime-Time Prodigy | +4 credibility a week, smears land softer | **PRIME TIME DEBATE** — steal the rival's momentum for ₹6 |
| **DIDI** | The Street Fighter | best region never drops below 38% | **KHELA HOBE** — every rival move there next week simply fails |
| **SHABDKOSH SIR** | The Walking Thesaurus | extra intel + credibility | **VOCABULARY BOMB** — collapse rival buzz across a cluster |
| **PALTI JI** | The Alliance Acrobat | +18 funds/week · **12% chance he defects** | **ALLIANCE FLIP** — steal 6% share, and the only way to fracture the mahagathbandhan |
| **BAHI-KHATA MADAM** | The Ledger Lady | +26 funds a week | **BUDGET BONANZA** — a *free* action (0 AP) every 3 weeks |

**Everyone you don't draft joins the opposition, with their abilities pointed at you.**

## 🔀 The five decisions that decide the election

1. **DRAFT** — four of ten. Passing on Chanakya Ji means the *rivals* get booth conversion.
2. **CHEMISTRY** — pairs multiply or bicker. *Measured*: swapping in a leader with a
   **higher** solo value who clashes with a team-mate costs **20 seats**.
3. **MANIFESTO** — two planks. On-message regions convert ×1.6, off-message ×0.55, and
   each plank charges you every week (freebies drain funds, tradition raises heat,
   business pays you but costs credibility). Wide coverage costs more to run.
4. **WHERE** — every AP spent in a safe region is an AP not spent in a close one. The
   panel shows a **projected seat change** for each move before you commit.
5. **WHEN TO CASH OUT** — buzz evaporates. Bank it with GROUND PUSH or BOOTH MANAGEMENT.

## 📖 The storyline

Story arcs are **multi-week chains that trigger off your campaign's actual condition**,
not a fixed script — the CK2 trick of letting scripted chapters dovetail with emergent
state, so the story is about *your* campaign.

| Arc | Fires when | What it does |
| --- | --- | --- |
| **THE TAPE** | your HEAT crosses 4.5 | a clip of your war room leaks. Deny it, blame a volunteer, or release the *full* tape yourself — and chapters 2 and 3 read back your choice |
| **THE MIDNIGHT PHONE CALL** | you drafted Palti Ji, or credibility slips | a rival MP wants in at 11:40 PM. Take him, demand he resign first, or quietly record the call |
| **THE BENCHED STAR** | **a leader you drafted has never been used** | the game notices your habits: your ignored campaigner starts giving interviews about "internal democracy" |
| **THE MERGER** | the mahagathbandhan forms | frames the rubber-band mechanic as a story beat and hands you three ways to fight it |
| **THE LONG MARCH** | you ran a FARMERS or JOBS manifesto | forty thousand people walk on the capital with a list of demands |

Choices set flags that later chapters read, so the same arc plays differently across
campaigns. Weeks now resolve into a **newspaper front page** — masthead, a headline
chosen from what actually happened, your seat swing, what every rival did, and a
"THEY SAID IT" jab from the rival front that's doing best.

## 🎬 Things that happen to you

* **INTEL** leaks the rivals' moves **one week early** — so blocking and counter-punching
  are real options, not guesswork.
* **DILEMMAS** — a Monday-morning problem most weeks. *"A 9 PM anchor demands you appear
  or the nation will assume the worst."* Send your debater, send an empty chair, or
  boycott and bank an action point.
* **HEAT** rises with meme blitzes and defections. At 8, the Election Commission takes
  an action point off you.
* **MAHAGATHBANDHAN** — run away with the campaign and both rival fronts *merge*,
  counted as one bloc for seat allocation. It is the single biggest swing in the game,
  and only Palti Ji can crack it open. That's why you might draft a man who may defect.
* **COUNTING DAY** — region-by-region reveal, then government formation: a hung house
  puts four coalition offers in front of you, including refusing to deal at all.

## ✔ Verified, with numbers

The rules engine is pure and runs headlessly, so balance is **measured, not asserted**.
`node tools/balance.js 250` plays hundreds of full campaigns with scripted players:

```
skill gap (thinking player − flailing player)     99 seats
plank-pair spread across 5 manifestos             21 seats   (no dominant manifesto)
viable drafts                                     184–251 median seats
anti-synergy cost (stronger but clashing leader)   −20 seats
outright majority rate, strong draft + good play   ~13%      (rare and prestigious)
path to power (majority or coalition shot)         ~96%
ruthless difficulty                                meaningfully harder
invalid states / NaN / seat-count drift            0
```

Tuning this surfaced four real design bugs, all fixed:

* **spillover exploit** — per-neighbour buzz meant aiming a roadshow at the
  most-connected region gave 114 buzz for one AP. Spillover is now a fixed budget.
* **funds were worthless** — AP is the binding constraint, so cash-income leaders
  measured at *zero* value. Bahi-Khata Madam's move became a 0-AP free action.
* **one mandatory leader** — the base cadre economy was so tight you couldn't afford a
  ground push without a cadre leader.
* **a single dominant passive** — Mitron Ji's buzz multiplier was worth 2.5× any other
  leader, so his power moved into his *action*, where it costs AP.

Two more Playwright suites guard the front end. `tools/screens-test.js` asserts **every
screen renders a working exit control** — it caught a rewrite that silently dropped the
CONTINUE button and left the week report a dead end. And a click-driven playthrough plays
through **real canvas clicks** — menu → draft → manifesto → select region → queue moves (AP 4→2) → end week
→ resolve → next week, with zero console errors.

## 🏗 Layout

```
index.html            the strategy game
arcade.html           MITRON MAYHEM, the 14-microgame reflex mode
tools/balance.js      headless balance harness (node tools/balance.js 250)
tools/screens-test.js dead-end screen guard (node tools/screens-test.js)

src/util.js           canvas primitives, palette, maths     ┐ shared engine,
src/audio.js          WebAudio synth: tabla, drone, plucks  │ borrowed by both
src/input.js          keyboard + mouse + touch              │ games
src/fx.js             particles, shake, petals, overlay     ┘

src/strat/data.js     board, cast, actions, planks, dilemmas, headlines
src/strat/model.js    PURE rules engine — seeded, node-testable, no rendering
src/strat/ai.js       rival planning, intel leaks, scripted test bots
src/strat/faces.js    the ten caricatures (one parametric portrait function)
src/strat/ui.js       immediate-mode UI kit + board renderer
src/strat/game.js     screens, input, main loop

src/games-a.js …      the arcade microgames (unchanged)
```

`model.js` never touches a canvas and `game.js` never computes a rule. That separation
is why the balance numbers above exist at all.
