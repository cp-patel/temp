# MITRON MAYHEM — design document

## 1. Research: what the memes actually are

Before designing anything I catalogued the recurring gags in Indian political meme
culture, because a meme game is only funny if every round makes the player go
"oh, THAT one". The recurring, widely-recognised material clusters into six families:

| Family | Material | Playable verb hiding inside it |
| --- | --- | --- |
| **Catchphrase** | "Mitron", "Achhe din aane waale hain", "Main fakir hoon", "Na khaunga na khane dunga" | *react at the right instant* |
| **Big-announcement dread** | the 8 PM television address, note-ban night, ATM queues, the ₹2000 note | *catch / dodge under pressure* |
| **Diplomacy theatre** | bear hugs with world leaders, selfies, foreign-trip photo ops | *timing and framing* |
| **Wholesome-uncle content** | chai stall origin story, Yoga Day, Mann Ki Baat radio, Swachh Bharat broom | *precision and rhythm* |
| **Tech / gaffe humour** | "clouds hide planes from radar", "Entire Political Science" | *quiz and evasion* |
| **Collective-ritual humour** | 9 baje 9 minute thali-banging and diya-lighting, "pakoda economy" jobs quip | *rhythm, tapping, cooking timing* |

The right-hand column *is* the game design. Every meme family already implies a verb,
which is exactly the raw material a WarioWare-style microgame gauntlet eats.

Sources consulted for the meme inventory:
[Scroll — words the era added to the dictionary](https://scroll.in/article/916438/bhakt-mitron-demonetisation-10-words-or-phrases-that-entered-our-dictionaries-with-the-modi-era) ·
[Achhe Din Aane Waale Hain (Wikipedia)](https://en.wikipedia.org/wiki/Achhe_din_aane_waale_hain) ·
[ScrollDroll — Modi meme templates](https://scrolldroll.com/narendra-modi-meme-templates/) ·
[The Week — cloud-theory memes](https://www.theweek.in/news/india/2019/05/12/modis-cloud-theory-triggers-jokes-memes-ec-complaint.html) ·
[Al Jazeera — the tech-gaffe jokes](https://www.aljazeera.com/news/2019/5/13/no-laughing-matter-indias-modi-mocked-for-tech-gaffes) ·
[Indian Meme Templates](https://indianmemetemplates.com/modi-funny-photos/)

## 2. Genre choice

**WarioWare-style microgame gauntlet.** Reasons:

1. **Meme humour is punchline-shaped.** A joke gets 5 seconds, lands, and leaves.
   A 20-minute level would kill it. A microgame is a punchline you can play.
2. **Breadth beats depth here.** 14 short rounds let me hit 14 different memes; one
   big game would only hit one.
3. **Immersion comes free from pace.** Constant command slams, speed-ups and
   near-death chai counts create flow without needing a story.
4. It gives a natural, escalating difficulty curve and an obvious boss slot.

## 3. Component breakdown

```
                 ┌───────────────────────────────────────────┐
                 │              main.js — ENGINE             │
                 │  state machine · clock · scoring · combo  │
                 │  lives · levels · menus · HUD · storage   │
                 └───────┬───────────────────────┬───────────┘
                         │ round context `a`     │ renders
        ┌────────────────▼──────────┐   ┌────────▼──────────────────┐
        │ 14 microgames + boss      │   │ scenes.js — 8 backdrops   │
        │ (games-a/b.js, boss.js)   │   │ cards.js  — 18 meme cards │
        └────────────┬──────────────┘   └───────────────────────────┘
                     │ uses
     ┌───────────────┼──────────────┬───────────────┬──────────────┐
     ▼               ▼              ▼               ▼              ▼
 input.js        audio.js        fx.js          art.js         util.js
 kbd/mouse/      tabla+drone+    particles,     procedural      palette,
 touch/swipe/    plucks, 17      shake, freeze, vector sprites  math,
 on-screen pad   SFX, adaptive   pops, petals,  & props         canvas
                 music loop      CRT overlay                    helpers
```

### Layer responsibilities

* **util.js** — the `MM` namespace, tricolour palette, easings, and the drawing
  primitives every other file leans on (outlined text, rounded rects, rotating
  sunbursts, halftone dot fields, festive bunting).
* **input.js** — collapses four input devices into three questions: is a key *held*,
  was it *just pressed*, where is the *pointer*. Swipes synthesize d-pad presses, so
  every microgame is phone-playable without per-game touch code.
* **audio.js** — a small synth. `tabla()` = pitched sine dropping fast + band-passed
  noise transient. `pluck()` = detuned saw/triangle stack through a sweeping lowpass
  (sitar-ish). A tanpura-style drone holds the tonic and fifth. A 25 ms look-ahead
  scheduler plays a 16-step loop whose **tempo and density scale with the player's
  level**, so the music tightens as the game does.
* **fx.js** — the "juice" budget: particle bursts, confetti, ripples, screen shake with
  decay, hit-freeze, colour flashes, floating hype text, marigold petals, scanline +
  vignette overlay.
* **art.js** — everything visible, as vector paths. Key trick for the caricature: draw a
  full silver hair cap, then cut a skin-coloured forehead back over it (instant receding
  hairline), and place the mouth on a skin "muzzle" ellipse so it can never be swallowed
  by the beard. Arms are drawn *in front* of the torso with an outward-positive angle
  convention, so both arms mirror correctly across every pose.
* **scenes.js** — 8 shared backdrops keep 14 games feeling like one world.
* **cards.js** — the meta-progression: 18 collectible cards with rarity tiers.
* **main.js** — the engine described below.

## 4. Engine: the round loop

```
TITLE ──▶ CMD ──▶ PLAY ──▶ RESULT ──┬─▶ CMD (next round)
   ▲       ▲                        ├─▶ SPEED   (round % 4 == 0)
   │       │                        ├─▶ BOSSINTRO (round % 8 == 0)
   └───────┴── OVER ◀───────────────┴─ (lives == 0)
```

* **CMD** — a 0.7–1.2 s command slam: tricolour bands wipe across, the verb lands with
  an elastic overshoot, a hint line follows. This is the single most important screen in
  the game: it teaches an entire mechanic in one word.
* **PLAY** — the microgame owns the frame; the engine only runs the clock, HUD and juice.
* **RESULT** — "SAHI HAI!" or "GALAT!" stamp, the flavour line, the score gain with the
  combo multiplier shown, confetti or a lost chai cup.
* **SPEED / BOSSINTRO** — pacing beats that also reset the player's hands.

### Difficulty model

One number, `speed = 1 + (level-1) × 0.13` (capped 2.3), drives everything:

* the round clock shrinks: `clock = time / (1 + (speed-1) × 0.55)`;
* microgames read `a.speed` to scale spawn rates, walk speeds, dial drift and note gaps;
* microgames read `a.level` to scale *quantity* and tighten tolerance bands
  (more cheers needed, more diyas, more quiz questions, thinner chai band);
* the music tempo and melody density rise with the level.

### Scoring

```
gain = (260 [boss: 900] + level×45 + timeLeft×12) × (1 + min(2.5, combo×0.15))
```

Time bonus rewards decisiveness; the combo multiplier makes a streak worth far more
than any single round, which is what makes a near-death run tense.

## 5. Immersion checklist (what actually makes it feel good)

| Technique | Where |
| --- | --- |
| Command slam with elastic overshoot + tricolour wipe | every round start |
| Screen shake, scaled by event weight | hits, hugs, fails, boss orders |
| Hit-freeze support (`fx.freeze`) | available to any microgame for impact frames |
| Particle bursts, stars, confetti, dust, marigold petals | wins, catches, sweeps, boss |
| Floating text pops + escalating hype lines | combos ≥ 2 |
| Diegetic HUD — lives are literally cups of chai | always |
| Timer bar that turns gold → red and strobes under 25 % | always |
| Adaptive music that speeds up with the level | always |
| Sunbursts, bunting, crowd silhouettes, halftone print texture | rally scenes |
| CRT scanlines + vignette | final composite |
| Rank + "Meme Report Card" payoff screen | game over |

## 6. Tone and safety rails

The whole thing is written as affectionate parody of *meme culture*, not attack content:

* the caricature is cuddly-chibi, never grotesque;
* no real speech is quoted — every line is obviously invented for the game
  ("Yeh note band ho gaya!", "Pakoda jal gaya! Economy down.");
* world leaders are generic archetypes ("PRESIDENT", "CHANCELLOR", "CEO SAHAB");
* the title screen carries a plain-language disclaimer;
* nothing targets a religion, a community, or a private individual.

## 7. Extending it

Adding a microgame is one object appended to `games-a.js` / `games-b.js`:

```js
MM.reg({
  id, cmd, sub, time, scene, card,
  init(a) {},            // a.st = your state
  update(dt, a) {},      // a.win('flavour') / a.lose('flavour')
  draw(g, a) {},
});
```

Then add its Meme Card to `cards.js` (the card gallery paginates automatically). The
engine picks it up on the next reload — no registration list to update, no build.

## 8. Verification approach

Because timing games are easy to break silently, the build is checked by a headless
**bot that plays every round correctly through the real input layer** (it presses the
same keys a human would, via `MM.input`) and asserts each round can be *won* — not
merely that it renders. A second pass drives a whole run to confirm the engine walks
command → play → result → speed-up → boss without exceptions, and separate checks cover
the audio graph, all 17 SFX, pause/mute persistence, touch play, and letterboxing from
640×480 to 1920×1080.
