# CHUNAV CHANAKYA — design document

*(The earlier reflex game, MITRON MAYHEM, is now `arcade.html`; its design notes are in
the appendix.)*

## 1. The brief and what it demanded

> "More strategy based, where users have to think and strategize… add more relatable
> characters (Rahul Gandhi, Arvind Kejriwal, Amit Shah, Yogi, Raghav Chadha) so they fit
> naturally in the storyline and strategy, and make it funny."

Three requirements, one of which is the hard one:

1. **Thinking, not twitching** — decisions must have consequences you can reason about
   *before* committing, and no timer may ever rush them.
2. **Characters that fit the strategy naturally** — the trap here is cosmetic characters:
   portraits pasted onto generic abilities. The fix is to make **each persona's meme
   trope literally be its mechanic**, so remembering the joke teaches you the rules.
3. **Funny** — carried by copy (headlines, dilemmas, endings) rather than by mechanics
   being silly, because silly mechanics undermine requirement 1.

## 2. Genre choice

A **turn-based campaign strategy game** in the lineage of *The Political Machine*
(turn = week, a stamina/AP budget, state-by-state targeting, message must match the
state) and *Democracy* (interconnected systems, think before acting).

Why it fits: an election already contains the strategic primitives — a map with unequal
prizes, resources that trade off, momentum that decays, rivals who react, and a hard
deadline. Nothing had to be invented to make politics into a strategy game; it only had
to be exposed.

Sources for the genre grounding:
[The Political Machine (Wikipedia)](https://en.wikipedia.org/wiki/The_Political_Machine) ·
[The Political Machine 2024](https://store.steampowered.com/app/2512090/The_Political_Machine_2024/) ·
[Playing The Political Machine (Fast Company)](https://www.fastcompany.com/91218688/what-its-like-to-play-the-political-machine) ·
[Democracy 4](https://techimaging.co.uk/democracy-4-the-ultimate-political-strategy-game/) ·
[Political Strategy Game (TV Tropes)](https://tvtropes.org/pmwiki/pmwiki.php/Main/PoliticalStrategyGame)

Meme-vocabulary grounding: the white-tee yatra
([Deccan Herald](https://www.deccanherald.com/india/jab-tak-chal-rahi-hai-rahul-gandhi-on-his-famed-white-tee-1175775)),
Bharat Jodo Yatra
([Deccan Herald](https://www.deccanherald.com/india/bharat-jodo-nyay-yatra-live-february-15-rahul-gandhi-bharat-jodo-nyay-yatra-congress-indian-politics-2895376)),
the Delhi-2025 meme wave
([The Tribune](https://www.tribuneindia.com/news/delhi/meme-fest-erupts-as-bjp-heads-for-big-win-in-delhi-aap-congress-face-jesters-barbs/)),
and the cloud-cover jokes
([The Week](https://www.theweek.in/news/india/2019/05/12/modis-cloud-theory-triggers-jokes-memes-ec-complaint.html)).

## 3. The core economy

Three quantities and one exchange rate:

```
  ACTIONS (4 AP/week)  ──spend──▶  BUZZ  ──convert──▶  VOTE SHARE  ──share²──▶  SEATS
                                    │                      ▲
                        decays 45%/wk                       │
                                    └── rate set by CADRE × CREDIBILITY × MESSAGE FIT
```

* **BUZZ** decays, so hoarding it is a mistake and cashing out is a timing decision.
* **VOTE SHARE** is permanent, so schemes (direct share) and rallies (buzz) are a real
  choice between slow-certain and fast-perishable.
* **Seats = share^2.1** with largest-remainder rounding. This reproduces the aggregate
  behaviour of first-past-the-post: leading a region earns a seat bonus, so
  **concentration beats spreading**, and *where* to concentrate becomes the question.
* **CREDIBILITY** scales every conversion from **0.72× to 1.27×**. This exists so that
  MEME BLITZ — the cheapest buzz in the game — is a genuine trade rather than free
  momentum, and so a "clean campaign" is a viable second engine beside a "loud campaign".

## 4. Characters as mechanics

Each leader gets a **passive** (shapes your whole plan) and an **action** (a move you
spend AP on). The persona dictates both:

| Meme trope | Becomes |
| --- | --- |
| the crowd-moving orator | a buzz multiplier + the biggest single buzz action |
| the booth-level strategist | a conversion multiplier — turns vibes into votes |
| the 4,000-km padyatra | an action that hits a region *and its neighbours*, and pays again next week |
| free bijli-paani | instant urban share for a brutal cash cost |
| the 4 AM monk's discipline | fortresses: rivals gain 45% less where you lead |
| the 9 PM debate prodigy | steal the rival's momentum for almost no money |
| holding the streets | *denial* — rival moves in a region simply fail |
| the unspellable vocabulary | area suppression of rival buzz |
| the alliance acrobat | steal share, fracture the opposition alliance — and he may defect on you |
| the budget ledger | income, plus a **0-AP free action** (AP is the scarce resource) |

**Synergies and anti-synergies** are the draft's actual decision surface: JODI No. 1 and
DOUBLE ENGINE reward pairing; AWKWARD ALLIANCE, COLD WAR and IMPOSSIBLE GATHBANDHAN
punish drafting on solo power alone. Both are displayed in full on the draft screen, so
a trap is a *readable* trap.

## 5. Legibility: the anti-guesswork rules

A strategy game is only strategic if the player can reason. Three deliberate choices:

* **A live exit poll.** Queueing a move updates a projected seat count immediately, and
  each action row shows its own **projected seat delta**. You are never guessing at the
  value of a click.
* **Rival plans are telegraphed.** The AI commits to next week's moves at the end of this
  week and INTEL leaks some of them. Blocking (KHELA HOBE) and suppression (VOCABULARY
  BOMB) exist *because* threats are knowable.
* **Uncertainty is honest.** The projection carries a ± margin that narrows as polling
  day approaches, instead of pretending to precision.

## 6. The rubber band, and its counter

Two rival fronts split the anti-incumbent vote, and share² then hands the single largest
party a landslide. Structurally the player would always win big.

Fix: at 50% projected seats, the rivals **merge into a mahagathbandhan** and are counted
as one bloc for seat allocation — thematically the funniest beat in the game and
mechanically the strongest swing. Two refinements keep it from being a ceiling:

* the merge is **partial** — 28% of the junior partner's vote keeps fighting the senior
  one (seat-sharing friction, exactly like real "friendly contests");
* **PALTI JI can fracture it** for 2–3 weeks. A rubber band with a counter is tension; a
  rubber band without one is just a cap.

## 7. Verified balance (measured, not asserted)

`model.js` is pure and seeded, so `tools/balance.js` plays hundreds of full campaigns
headlessly with scripted players. Final numbers at 250 games/row:

| Check | Result | Why it matters |
| --- | --- | --- |
| skill gap (smart − random) | **99 seats** | thinking pays |
| plank-pair spread (5 manifestos) | **21 seats** | no dominant manifesto |
| viable drafts | **184–251** median | multiple routes, all real |
| anti-synergy cost | **−20 seats** | chemistry beats raw card power |
| outright majority, strong play | **~13%** | rare and prestigious |
| path to power | **~96%** | good play always gets a shot |
| invalid states / seat drift | **0** | rules are sound |

### Four real bugs the harness caught

1. **Spillover exploit** — per-neighbour buzz meant aiming a roadshow at the
   five-neighbour region produced 114 buzz for one AP. Spillover became a fixed budget
   split between neighbours.
2. **Funds were worthless** — an ablation showed the two cash-income leaders adding
   **zero to −4 seats**: with a fundraiser action available, money was never the binding
   constraint, AP was. Bahi-Khata Madam's action became free (0 AP).
3. **One mandatory leader** — base cadre income was so tight that a cast without a cadre
   leader could not afford its own conversion actions.
4. **A single dominant passive** — Mitron Ji's buzz multiplier measured 2.5× any other
   leader's marginal value, because it compounded through the entire loop. His power
   moved into his action, where it must be paid for in AP.

### A measurement lesson worth recording

Three tuning rounds chased artifacts of the *test bot*, not the game: the bot never used
PRIME TIME DEBATE or JODO YATRA, and it spammed MEME BLITZ with spare AP — which
destroyed the credibility engine the "clean" casts depend on. Any leader whose power
needs a different plan will measure as weak against a fixed policy. The fix was to make
the bot's plan depend on the cast it drafted, which is exactly what the game asks a human
to do. **A balance harness measures the policy you gave it, not the design.**

Similarly, an early assertion demanded that a deliberately-bad "trap" draft score worse
than a good one, comparing two different casts. The correct experiment is a controlled
swap: replace one leader with a **higher**-solo-value leader that clashes with a
team-mate, and check the team gets worse. It does, by 20 seats.

## 8. The storyline layer

Research into emergent narrative in strategy games
([GDC: Emergent Stories in Crusader Kings II](https://gdcvault.com/play/1020774/Emergent-Stories-in-Crusader-Kings),
[Kill Screen on CK2's event chains](https://killscreen.com/previously/articles/fascinating-story-ai-behind-crusader-kings-2s-dark-chain-events/),
[PCGamesN on CK2](https://www.pcgamesn.com/crusader-kings-ii/how-crusader-kings-2-caught-paradox-by-surprise))
points at one mechanism: **scripted chapters dovetailing with emergent state**. Players
supply the meaning; the designer supplies chapters that happen to fit. A fixed linear
story would fight the strategy layer instead of feeding it.

So arcs here are *conditional*, not sequential:

* `trigger(st)` reads live state — heat, credibility, drafted cast, whether the alliance
  formed, which planks you ran. THE TAPE only exists if you played dirty.
* **THE BENCHED STAR reads `st.usage`** — a tally of which of your leaders you've actually
  given assignments to. Ignore a campaigner for three weeks and the story notices. That
  is the dovetail: a scripted chapter about *your* specific neglect.
* Choices set flags (`st.arcFlags`), and later beats are functions of those flags, so
  chapter 3 of THE TAPE is a vindication or an inquiry depending on chapter 1.
* One beat fires per week and running arcs get priority, so chains always finish.

Presentation carries the tone: weeks resolve into a **newspaper front page** whose
headline is selected from what actually happened that week, and story beats arrive as
**breaking-news slabs** sized to their own prose.

### Two bugs this layer produced, both caught by tests

1. **A dead-end screen.** Rewriting the week report as a newspaper silently dropped its
   CONTINUE button — the game rendered perfectly and became unplayable. This is now a
   permanent guard: `tools/screens-test.js` walks all eleven screens and asserts each
   registers at least one clickable target.
2. **A crash that froze the board.** `cloneLite` (used by the per-action seat previews)
   didn't copy the new `usage` map, so selecting a region threw *inside the render loop*,
   which killed `requestAnimationFrame` — one exception, permanent freeze. Fixed at the
   source, and the loop now catches draw errors and always re-arms, because no single bad
   frame should ever be able to end the session.

## 9. Tone and safety rails

* Characters are **nicknamed archetypes** (MITRON JI, MUFFLER MAN, SHABDKOSH SIR), not
  named individuals — recognisable as satire, while never putting invented words in a
  real person's mouth.
* Every quip, headline, dilemma and ending was written for this game.
* Rival fronts are fictional (MAHA VIPAKSH, KSHETRIYA MORCHA); regions are fictional
  (UTTAR BHARAT, MUFFLERPUR NCR, DOSA DELTA).
* Jokes target campaign *theatre* — loudspeakers, exit polls, resort politics, prime-time
  shouting, seat-sharing talks. Nothing touches religion, caste, community, family, or
  any allegation about a real person.
* A plain-language disclaimer sits on the title screen and in the README.

## 10. Extending it

* **A leader** → one entry in `SG.LEADERS` (passive key + action) + a case in
  `applyAction` + a face config in `faces.js`.
* **A region** → one entry in `SG.REGIONS` with hand-placed board coordinates.
* **A dilemma** → one entry in `SG.DILEMMAS`; effect keys are interpreted by
  `SG.applyFx` and auto-described in the UI by `effectText`.
* **A story arc** → one entry in `SG.ARCS`: a `trigger(st)` predicate plus beats, each
  with `q` (string or `(st, flags) => string`), options, optional `flag`, and the same
  `fx` vocabulary as dilemmas.

After any change, run `node tools/balance.js 250` and `node tools/screens-test.js` — it will tell you if you broke the
skill gap, made a manifesto dominant, or killed a draft.

---

## Appendix — MITRON MAYHEM (`arcade.html`)

The original build: a WarioWare-style gauntlet of 14 meme microgames plus an "8 PM
Address" boss, all procedurally drawn, with a synthesized tabla soundtrack. Rounds riff
on Mitron speech openers, the note-ban scramble, bear-hug and selfie diplomacy, cutting
chai, Yoga Day, the Swachh Bharat jhaadu, cloud-cover-beats-radar, 9-baje thali and diya
rituals, the Entire Political Science quiz, pakoda economy, the pothole road to Achhe
Din, and the Mann Ki Baat dial.

It is still fully playable and verified (a bot wins all 14 rounds plus the boss through
the real input layer). It is reachable from the strategy game's main menu, and it shares
`src/util.js`, `src/audio.js`, `src/input.js` and `src/fx.js` with it.
