# CHUNAV CHANAKYA — gameplay redesign

*A design document. No code yet. The goal is to agree on the game before we build it.*

Status: **proposal, awaiting feedback.** Nothing below is implemented.

---

## 1. The problem, measured

The strategy layer is deep, but it's the *wrong kind* of deep — it's arithmetic
depth, not decision depth. Numbers from the current build:

| What the player must hold in their head | Count |
| --- | ---: |
| Regions on the board | 12 |
| Live numbers on the board at once | **~210** |
| Global resources (AP, funds, cadre, cred, heat, seat-tax) | 6 |
| Leaders / synergy pairs / planks / dilemmas / arcs to learn | 10 / 10 / 8 / 12 / 5 |
| Legal (action × region) choices per turn | 132 |

But the real problem isn't the *quantity* of numbers. It's that **the core loop
is opaque**:

> You spend an action point on a RALLY. It produces **BUZZ** — an abstract
> number that decays 45% a week. Later you spend another action point on GROUND
> PUSH, which converts that buzz into **VOTE SHARE** at a rate equal to
> `CADRE × CREDIBILITY × MESSAGE-FIT` — three factors you can't see and can't
> easily predict. The seats then come from `share^2.1` with largest-remainder
> rounding.

No move has an immediate, readable consequence. To play *well* you must model a
hidden multiplication, and to play *at all* you must trust that the RALLY you
just did will matter three turns from now. That is a spreadsheet, not a game.

Three more issues compound it:

- **Twelve regions is too many to care about any single one.** You optimise a
  portfolio; you never fight for a place.
- **The story doesn't pull.** The five arcs are conditional garnish — they fire
  *if* the spreadsheet hits certain values. There's no spine dragging you into
  the next turn.
- **The jokes are costumes.** MITRON JI, DIDI, PALTI JI are terrific flavour,
  but they're painted onto a dry optimiser. The comedy lives in tooltip text,
  not in what actually happens when you play.

---

## 2. What we keep, because it's genuinely good

We are **refining, not rebuilding**. These bones are strong:

- **The pure, seeded rules engine + headless balance harness.** Being able to
  play 250 campaigns in node and *measure* whether strategy pays is rare and
  valuable. Every redesigned mechanic below stays measurable.
- **Telegraphed rivals.** Seeing the opponent's next move a beat early turns
  blocking and counter-punching into real decisions. This is the best thing in
  the current game. It stays and gets *more* central.
- **Draft-as-strategy.** Choosing four of ten campaigners, and handing the rest
  to your enemies, is a great opening decision. It stays — but the chosen cast
  now become *cards in your hand*, not passive modifiers.
- **The caricatures and the synth audio.** Keep entirely.
- **The projection / exit-poll.** "Here's where you'll land if nothing changes"
  is exactly the right idea. It moves from a footnote to the centre of the screen.

---

## 3. Design pillars for the refined game

Four rules every mechanic must obey:

1. **See the consequence before you spend.** Every move previews its effect on
   the board *before* you commit. No hidden conversion, ever. A number the
   player can't predict is a number we delete or expose.
2. **A handful of places you fight for, not a portfolio you optimise.** Small,
   named battlegrounds you come to know — not a dozen interchangeable regions.
3. **The story is the spine, not the garnish.** A campaign you *progress
   through*, chapter by chapter, with rising stakes and recurring characters —
   so you always know why you're playing the next turn.
4. **The joke is the mechanic.** Every character's comedy is expressed in what
   they *do* on the board, not in the text under their portrait.

---

## 4. The core loop, redesigned

### 4.1 Three resources, all intuitive

Collapse six stats into three that a first-timer understands instantly:

| Resource | Is | Replaces |
| --- | --- | --- |
| **DIN (days)** | Time. The campaign is N days; every move costs days. | Action points |
| **FUNDS (₹)** | The war chest. Moves cost money. | Funds (kept) |
| **BHAROSA (trust)** | Public trust, 0–100. Gates your best moves; dirty moves burn it; at zero, a scandal breaks. | Credibility **+** heat, merged |

**Cut:** CADRE becomes a *card* you can play ("send in the workers") rather than
a fourth meter. SEAT TAX becomes a one-off *story event* (a court order), not a
standing stat. That's 6 meters → 3.

### 4.2 The board: a few seats you actually fight for

Shrink from 12 regions to **5–6 named battlegrounds per chapter** (some early
chapters use just one). Each seat is a single, honest bar:

```
  CHAIPUR  ▐███████████░░░░░░░░▌  you 54%   ← leading
                        ▲ ghost: 48% on counting day if you do nothing
```

- One number per seat: your support, 0–100%. No buzz pool, no hidden share.
- A **ghost marker** shows where the seat lands on counting day *if nothing
  changes* — the projection, made per-seat and prominent.
- Win a seat by leading it when the days run out. Win enough seats to form the
  government. That's the whole win condition, and you can read it at a glance.

### 4.3 The hand: cards, not a conversion engine

Each turn you hold a **hand of MOVES**. Every card states its cost and its
effect in plain language, and previews the effect on the ghost bar before you
play it. No move produces an abstract intermediate quantity.

Starter deck (everyone has these):

| Card | Cost | Effect (stated on the card, previewed on the bar) |
| --- | --- | --- |
| **ROADSHOW** | 2 days, ₹ | +18 support in one seat now; fades a little each day after |
| **BOOTH MACHINE** | 1 day | Lock a seat's current support — it can't fall for 2 days |
| **DOOR KNOCK** | 1 day | +6 support in one seat, and +6 in the neighbour |
| **FUND DRIVE** | 1 day | +₹, −a little trust |
| **MEME BLITZ** | ₹ | +14 support fast, −trust; a rival can *expose* it next turn |

The **drafted cast become special cards in your deck** — this is where draft
strategy becomes tangible. You don't get a passive modifier; you *hold* MITRON
JI's **MEGA ROADSHOW** and decide when to play it.

Rivals still **telegraph**: their next card shows as an icon on a seat, so
blocking, baiting, and counter-punching are real plays.

### 4.4 The platform: a positioning choice, not a spreadsheet

Replace 8 planks with weekly running costs by a single **PLATFORM** pick at the
start of a chapter: choose **2 of ~6 promises** (JOBS, WELFARE, FAITH, FREEBIES,
BUSINESS, FARMERS). This only does one legible thing: it decides which
battlegrounds you're naturally **strong** in and which you're **weak** in
(shown on the map as ✓ / ✗ before you lock it). No per-week funds/cred/cadre
drip to track. A promise you can't keep can still be called out by a rival as a
story beat — but it isn't invisible bookkeeping.

---

## 5. The story — the spine that was missing

The title already says it: **you are the CHANAKYA** — the backroom strategist,
not a party. The current game never makes you *feel* that. The redesign makes it
the entire frame.

> **THE STRATEGIST'S RISE.** You're a nobody consultant with a laptop and a
> theory nobody believes. A washed-up politician hires you for a hopeless
> by-election. You win it. Word spreads. The clients get bigger, the betrayals
> get sharper, and a rival strategist starts shadowing your every move — until
> you're the kingmaker holding the national result in your hands, and the last
> choice is whether to stay the puppet-master, take power yourself, or burn the
> whole board down.

Every meme character now fits **naturally**, because each is either a **client**
you're hired to win for, a **rival**, or a **defector** — never a costume.

### 5.1 The campaign, chapter by chapter

Each chapter is a self-contained election that **introduces exactly one new
mechanic** — so complexity arrives a spoonful at a time instead of all 210
numbers on turn one. Each has an **asymmetric objective**, which is what makes
the strategy replayable.

| # | Chapter | Client | New mechanic taught | The twist |
| --- | --- | --- | --- | --- |
| 1 | **THE BY-ELECTION** | MUFFLER MAN — broke idealist | The support bar, ROADSHOW, BOOTH, the ghost marker | One seat. A tutorial that's still losable. |
| 2 | **DEFECTION SEASON** | PALTI JI — the acrobat | Poaching & alliances; the trust/results tension | If your **trust** drops too low, Palti Ji defects *from you* mid-chapter — the joke is the mechanic. |
| 3 | **THE STATE SWEEP** | MAHARAJ JI *or* DIDI (you pick a patron) | The multi-seat map, fortresses, home turf | Your patron's signature warps the board; the choice changes the whole chapter. |
| 4 | **THE MERGER** | your growing reputation precedes you | The opposition **unites** against you (rubber-band), and how to crack it | The rival strategist reveals themselves — it's someone from Chapter 1. |
| 5 | **THE NATIONAL** | MITRON JI — the 56-inch orator | Everything at once, but now you've learned it in pieces | The biggest board, the loudest opponent, the tightest days. |
| 6 | **THE KINGMAKER** | — | Coalition brokering as the finale | Hung house. Your **reputation** (clean vs. ruthless, tracked all game) decides which endings are even offered. |

### 5.2 Recurring threads that make it a story, not six levels

- **The rival strategist.** A mirror of you, working the other side, escalating
  each chapter. Introduced anonymously in Ch.1, unmasked in Ch.4. Gives the
  campaign an antagonist with a face.
- **Reputation.** Every dirty move (MEME BLITZ, buying a defector) and every
  clean one (winning on platform) shifts a hidden **clean ↔ ruthless** axis. It
  changes which clients hire you, which cards you're offered, and which of the
  three finales you can reach. This is the CK2 trick done right: the story is
  *about your campaign* because it reads your actual choices.
- **Recurring cast.** A client you won for in Ch.2 can endorse you in Ch.5 — or,
  if you betrayed them, campaign against you. Characters remember.

### 5.3 The comedy, expressed as mechanics

The rule from pillar 4, made concrete:

- **PALTI JI** can defect *from your own camp* if trust is low. The Alliance
  Acrobat living up to his name is the punchline **and** a strategic risk you
  chose when you drafted him.
- **MEME BLITZ** can go viral *the wrong way* — a rival's "expose" turns your +14
  into a −20 and a trust crater. Everyone does it; nobody admits it.
- **MAHARAJ JI's** seats "never sleep" — they lock overnight, so his fortresses
  are literally un-raidable at 4 AM.
- **BAHI-KHATA MADAM's** BUDGET BONANZA is a genuinely free move (the bug we just
  fixed) — the Ledger Lady bends the rules of the game itself.

---

## 6. Migration: what changes, at a glance

| System | Now | Redesign |
| --- | --- | --- |
| Board | 12 regions, ~210 numbers | 5–6 named battlegrounds, one bar each |
| Resources | 6 meters | 3 (Days, Funds, Trust) |
| Core loop | BUZZ → hidden conversion → SHARE → seats | Cards that move a visible support bar directly |
| Predictability | model 3 invisible factors | ghost marker + per-card preview |
| Draft | passive modifiers | cards in your hand |
| Platform | 8 planks w/ weekly drip | pick 2 promises = strong/weak seats, shown |
| Story | 5 conditional arcs | 6-chapter campaign spine + reputation |
| Characters | flavour on an optimiser | clients / rivals / defectors, comedy = mechanic |
| Structure | one long 10-week run | chapters, one new idea each |

**Kept wholesale:** the seeded engine + balance harness, telegraphed rivals,
draft, caricatures, audio, the projection idea, achievements & scenarios (recast
as per-chapter challenges).

---

## 7. Why this is more fun *and* still strategic

Fun isn't the *absence* of strategy — it's strategy you can *see*. The redesign
keeps every genuine decision and deletes the arithmetic around it:

- **Still deep:** where to spend limited days, which seats to concede, when to go
  dirty, how to counter a telegraphed move, which patron to take, when to cash a
  character card. These are real, tense choices.
- **Now legible:** every one of them shows its consequence before you commit.
- **Now motivated:** you're climbing a story, not optimising a portfolio.
- **Now funny in play:** the acrobat really might walk; the meme really might
  blow up in your face.

And it stays **measurable** — the harness still plays hundreds of headless
chapters and proves a thinking player beats a flailing one, that no card
dominates, and that each chapter's asymmetric objective is winnable but not free.

---

## 8. Open questions for you

Before I turn this into a build plan, four calls I'd like your steer on:

1. **Story vs. sandbox.** Is the **6-chapter campaign** the main mode (with the
   current free-play kept as a "quick match")? I'm recommending yes — the story
   spine is the biggest single fun-lever.
2. **Cards vs. actions.** Are you happy with the **hand-of-cards** framing, or
   would you rather keep the current "spend AP on actions" verbs and just make
   them legible? Cards make "see before you spend" and "draft = your deck" much
   cleaner, but it's the bigger change.
3. **Board size.** **5–6 battlegrounds** — or do you want to keep a sense of the
   full national map (543 seats) as a *backdrop* while only ever deciding the
   handful of battlegrounds?
4. **Tone of the finale.** The three-way ending (puppet-master / take power /
   burn it down) — as funny, as cynical, or as earnest as you'd like it to land?

---

## 9. If you green-light it — suggested build phasing

So we ship playable slices, not a big-bang rewrite:

- **Phase A — legible core (no story yet).** New 3-resource, small-board,
  card-hand loop as a single-election "quick match." Rebuild the harness around
  it. *This alone tests whether the new loop is fun.*
- **Phase B — the spine.** Chapters 1–3, the tutorial ramp, reputation, the
  rival strategist. The story mode becomes real.
- **Phase C — the payoff.** Chapters 4–6, the merger, the kingmaker finale,
  recurring-cast callbacks, per-chapter challenge achievements.

Each phase is independently playable and independently testable. We validate
"is it fun?" at the end of Phase A before committing to B and C.

---

*Parody, unchanged: every character is an invented archetype, every "quote" is
written for this game, nothing targets a real person, community, or faith.*
