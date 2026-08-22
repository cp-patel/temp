# ACHHE DIN SIMULATOR — concept v2, from scratch

*Supersedes the "strategy refine" proposal (git history `03a91b6`). That doc fixed
legibility but kept the wrong game: a static screen you read. This one starts
from the original intent — **a playable satire of the Modi-era tenure, built
from its most meme-able real moments.***

Status: **concept, awaiting feedback. No code yet.**

---

## 1. Why both earlier versions missed

- **v1 (arcade)** had energy but the minigames were generic reflex tests — the
  satire was a mascot, not the mechanic.
- **v2 (strategy)** had depth but was a spreadsheet: 210 numbers, walls of text,
  and clicking a button changed a *number* somewhere instead of making
  something *happen* on screen.
- Neither was actually **about the tenure**. The memes were costumes on an
  abstract election. The source material — demonetization, thali-banging,
  pakoda employment, "abki baar 400 paar" — never appeared.

## 2. The game in one line

> **Ten years in power. Twelve infamous moments. You don't read about them —
> you perform them.**

You play the Supreme Leader through 2014–2024. Each episode is one real,
instantly-recognizable moment turned into a 2–3 minute interactive set-piece
where **the mechanic IS the joke**. Every episode mints a shareable **meme
card**. It all converges on election night 2024: you promised 400 paar — the
counter has other plans.

Working title: **ACHHE DIN SIMULATOR** (alts: MITRON!, JUMLA RAJ, NEW INDIA
SPEEDRUN).

## 3. The loop

```
EPISODE (2–3 min, one mechanic, zero rules text)
   → SPIN IT (one of three spin cards at the press conference)
   → MEME CARD minted (a real shareable PNG — your run's stats baked in)
   → METERS lurch: IMAGE ↑ vs REALITY ↓ (the gap is the game)
   → next episode unlocks on the tenure timeline
   → FINALE: election night 2024, seats computed from your whole run
```

Two meters, not six:

- **IMAGE** — the spectacle. Every stunt raises it.
- **REALITY** — petrol price, jobs, the queue outside. It drifts down in the
  *background of every episode* whether you look or not.

The wider the gap, the louder the **JUMLA ALERT** events — and the finale reads
the gap.

## 4. The episodes (the real instances, playable)

| # | Year | The moment | You literally… | The screen… |
|---|------|-----------|----------------|-------------|
| 1 | 2014 | **15 LAKH EXPRESS** — the campaign promise | shovel promises (₹15 lakh, 2 cr jobs, achhe din, bullet train) as coal into a rally engine | crowd multiplies with every shovelful; a "PROMISE LEDGER" quietly files everything for later |
| 2 | 2016 | **MITRON O'CLOCK** — demonetization, 8 PM | pull the big red lever, then run 90 seconds of chaos control | 86% of the notes on screen turn grey instantly; queues coil; a fat-cat tiptoes off with suitcases, untouchable |
| 3 | 2017 | **ONE NATION, FOUR SLABS** — GST | flick products into 0/5/12/18/28% chutes as rules mutate mid-round ("caramel popcorn is 18%, salted is 5%!") | accountants faint in the background; a combo meter files returns |
| 4 | 2018 | **PAKODANOMICS** — "frying pakodas is employment" | hand frying pans to arriving graduates and keep the oil going | the GDP-OF-PAKODAS counter spins gloriously; degrees float in the oil as garnish |
| 5 | 2015–19 | **HUG DIPLOMACY** — the summit bear-hugs | time your approach and land the perfect hug on a world leader charging a HUG-O-METER | leaders' alarm-faces escalate; a perfect hug goes slow-mo with rose petals; VISHWAGURU +1 |
| 6 | 2015–21 | **STAMP RAJ** — the face on everything | drag-stamp the face onto a conveyor: vaccine certs, ration bags, a cricket stadium, the monogrammed suit | each stamp lands with a thunk and a flashbulb; the PERSONALITY CULT meter swells |
| 7 | 2019 | **MANGO INTERVIEW** — the softball celebrity interview | you are the teleprompter: feed MANGO questions, or risk slipping in one HARD one | the room literally freezes on a hard question; the ACCESS meter dangles |
| 8 | 2019 | **CLOUD COVER** — "clouds hide us from radar" | fly the jet and stay inside clouds to remain "invisible" | physics textbooks bounce off the cockpit; the co-pilot's face slowly falls |
| 9 | 2020 | **THALI ORCHESTRA** — 5 PM, balconies | conduct the nation's taali-thali to the beat | a whole housing block lights up per combo; someone's uncle starts an off-tempo conch solo; a tiny "vaccine progress" bar does nothing |
| 10 | 2020 | **PEACOCK SHOOT** — the slow-mo photoshoot | frame the perfect shot while issues (petrol balloon, unemployment kite) drift into frame — tilt them out | a magazine cover mints itself when framed clean |
| 11 | 2016–23 | **RENAME RAJ** — cities, stadiums, schemes | slap new-name stickers on signboards before the timer; bonk popping historians with a "New History" book | signboards flip with a satisfying ka-chunk; a map redraws itself live |
| 12 | 2024 | **400 PAAR** — the finale | election night: the seat counter races your whole run's Image-vs-Reality gap | stalls at ~240 → you play **COALITION JENGA**: keep two kingmaker blocks from flip-flopping to cross 272 |

Three endings: **400 PAAR** (fantasy — near-impossible), **COALITION JENGA**
(the real 2024 — most runs), **ACHHE DIN CANCELLED** (you tanked it).

## 5. One episode, beat by beat — MITRON O'CLOCK

- **0:00** — TV chyron: `8 PM · NOV 8 · 2016`. One word onscreen: **"Mitron…"**
  (sting + national flinch). That's the whole intro. Skippable.
- **0:05 — THE LEVER.** You physically drag it down. Every ₹500/1000 note on
  screen greys out at once; blackout blink; screenshake; sirens. In the corner,
  a fat-cat with suitcases tiptoes away — you cannot click him. That's the joke.
- **0:20 — CHAOS CONTROL (90s).** Queues coil around the block. You drag pink
  ₹2000s into ATMs before they jam (whack a jammed one to fix it), swat flying
  old notes, pop "shell company" balloons that burst into receipts. A queue-mood
  meter slides 😊→😡. The ticker never stops: *"WEDDING SEASON POSTPONED SINE
  DIE" · "MAN DEPOSITS 40 YEARS OF SAVINGS, FRAMES NEW PINK NOTE."*
- **1:50 — PRESS CONFERENCE.** Pick one of three spin cards — *"Cashless
  India!"* / *"Short-term pain, long-term gain"* / *"The queues are
  anti-national"* — IMAGE and REALITY lurch visibly as you pick.
- **2:00 — MEME CARD MINTED.** Your stats baked into the template: queue length,
  notes swatted, fat-cats caught: **0 (of 0 attempted)**.

At no point is there more than **15 words on screen**. Everything else is
motion, sound, and numbers reacting.

## 6. The living screen — nothing waits, nothing sits still

The game is not turn-based and no screen is a static card. **The world
simulates whether you act or not**:

- **The backdrop is a running diorama.** The petrol-price board ticks up digit
  by digit. The ATM queue grows person by person. TV chyrons rotate. Crowds
  wander, cluster, and react. The ticker literally never stops.
- **State drives the scenery.** REALITY low → queues longer, streetlights
  dimmer, more autorickshaws honking. IMAGE high → bigger cutouts, more
  garlands, a camera drone circling. You *read the meters in the world* before
  you read them in the HUD.
- **The idle rule:** at any moment, at least **3 things are in motion** on
  screen. And if the player does nothing for ~3 seconds, the world escalates —
  an ambient event fires. Idleness is punished by the fiction, never by a popup.
- **Ambient event pool.** Every episode carries 6–10 scripted micro-surprises
  on independent timers — a wedding party of 40 arrives at the ATM with one
  pink note; an anchor goes live outside; a cow walks into the frame — and only
  2–3 fire per run, picked at random. No two runs of the same episode are
  identical.

## 7. The anticipation engine — think → commit → held breath → payoff

The player must "get a chance to think about what they are going to see."
That's a four-beat loop, and **every meaningful action in the game runs it**:

1. **TELEGRAPH (the think).** Before committing you see the stakes and the
   odds: the virality wheel's wedge composition, a rival's declared intent
   ("the anchor is preparing a queue exposé — 5s"), the incoming event icon.
   You are always betting with the odds on the table, never guessing blind.
2. **COMMIT.** The input.
3. **THE HELD BREATH.** 300–900 ms where the outcome is visibly being decided:
   the needle swings, the wheel slows, the crowd hushes, the music ducks.
   Tap-skippable for pace — never skipped for information.
4. **PAYOFF.** The outcome lands with juice proportional to its rarity.
   **Crits exist**: a meme can go INTERNATIONAL (3× effect, gold flash,
   fireworks). **Funny failures exist**: a meme can be EXPOSED — the
   opposition mints a counter-meme *from your own template*. Failure is a
   punchline, never a lecture.

The concrete systems built on this loop:

- **THE VIRALITY WHEEL.** Minting a meme spins a visible wheel — FLOP / LOCAL /
  TRENDING / NATIONAL / INTERNATIONAL INCIDENT. Before spinning you can *load*
  the wheel (spend IMAGE or funds to widen the good wedges) — informed
  gambling, odds always visible. This is the game's signature moment.
- **TELEGRAPHED COUNTERS.** Rivals and anchors announce intent seconds ahead.
  You counter, brace, or eat it — the strategy game's best mechanic, kept.
- **NEAR-MISS CHOREOGRAPHY.** Thresholds wobble on purpose. The finale's seat
  counter stalls at 269… 270… 271… before it resolves. Meters overshoot and
  settle.
- **BANK OR RIDE.** Streak mechanics ask the oldest good question: cash out
  the flashbulb combo now, or double it and risk the drop.

## 8. The juice mandate (the non-negotiables)

1. **Every input reacts within 100 ms** — motion + sound + a number moving.
   A click that changes nothing visible is a bug.
2. **≤15 words on screen** at any moment during play. Jokes land through play,
   not prose.
3. **The world is alive** — the idle rule above: ≥3 things in motion, always;
   nothing waits for input.
4. **Every meaningful action runs the anticipation loop** — telegraph, commit,
   held breath, payoff.
5. **Every episode teaches by doing** — the first 5 seconds demonstrate the
   verb; there is no "how to play" text, ever.
6. **Every payoff is shareable** — the meme card PNG is the score screen.

## 9. Meta & replay

- **Meme card grades** per episode — *Certified WhatsApp Forward* (bronze) →
  *National Trend* (silver) → *International Incident* (gold). Runs on the
  existing achievements/store tech.
- **The collection album** is the meta-game: 12 moments × 3 grades.
- Ambient event pools + the virality wheel make every replay different.
- A full run is **~35 minutes**; any episode replays in ~3.

## 10. Toolchain — what we build on

The current engine (canvas kit + `fx.js` particles/shake + WebAudio synth) was
enough for the arcade, but the living screen + anticipation loop need real
**timeline choreography, scene management, and camera work**. Options, with a
recommendation:

| Need | Tool | Notes |
| --- | --- | --- |
| Scenes, tweens, particles, camera shake/flash/zoom, timers | **Phaser 3** ⭐ recommended | The standard 2D web-game framework. One vendored `.min.js`, no build step, works from `file://`. Each episode = one Phaser Scene. Buys the most development speed for exactly the juice we've specced. |
| Timeline/easing choreography only (stay on our engine) | **GSAP** | The minimal-change option: keep our canvas kit, add world-class tween timelines for the held-breath beats. |
| Crowd-scale rendering (hundreds of animated entities, shaders) | **PixiJS** | Adopt only if canvas 2D hits limits. Phaser uses WebGL already, so likely moot. |
| Audio | **keep our WebAudio synth** | It's the game's sonic identity. `jsfxr` optionally for quick retro SFX variants. |
| Playtest distribution | **itch.io** (private page) | Shareable builds for "is it fun" feedback without hosting anything. |

All libraries are MIT and get **vendored into the repo** — this trades the
"zero-dependency" purity for "no build, no network, works offline," which is
the part that actually matters. Nothing here needs an account, API key, or
integration from you today (itch.io only when we want outside playtesters).

## 11. Tone & guardrails

Satire aims **up**: public policies, public statements, public spectacle. We
keep the parody-name convention (the Leader is unmistakable, never named) while
the *events* are the real, recognizable instances. We skip tragedy (migrant
crisis, oxygen shortage) and communal flashpoints — not funny, not our lane.
The fun of every episode is the absurdity of power, never the suffering of the
queue.

## 12. Next step — your four calls

1. **Name**: ACHHE DIN SIMULATOR / MITRON! / JUMLA RAJ / other?
2. **Spice level**: gentle ribbing ↔ properly savage. Where on the dial?
3. **Engine**: Phaser 3 (recommended — fastest route to the juice mandate) or
   stay vanilla + GSAP (smallest change)?
4. **Pick the vertical slice**: I build ONE episode fully juiced as the proof —
   recommend **MITRON O'CLOCK** (iconic + chaos + the lever) or **THALI
   ORCHESTRA** (rhythm + the audio engine). You play it, then we decide
   whether the whole season gets made.
