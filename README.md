# 🇮🇳 MITRON MAYHEM

**A frantic meme-microgame gauntlet built on Indian internet meme culture.**
14 bite-sized minigames + a boss round, all procedurally drawn on a canvas with a
synthesized tabla-and-sitar soundtrack. No images, no audio files, no libraries,
no build step. Open the HTML file and play.

> Affectionate parody of meme culture, not a political statement. Every "quote"
> in here is meme fiction written for this game. Nothing is attributed to any
> real person, and nothing is meant to insult anyone.

---

## ▶ Play

```bash
# just open it
xdg-open index.html      # macOS: open index.html

# or serve it (any static server works)
npx http-server . -p 8080   # → http://localhost:8080
```

Works in any modern browser, offline, on desktop and phone.

## 🎮 Controls

| Input | Does |
| --- | --- |
| **SPACE / ENTER / TAP** | the do-it button — cheer, hug, clap, jump, pour, snap |
| **ARROWS / WASD / SWIPE** | move, aim, choose, strike the asana |
| **MOUSE / TOUCH DRAG** | sweep the jhaadu, pick a diya, grab a pakoda |
| **1 – 4** | answer the quiz, grab a numbered pakoda |
| **P / ESC** | pause · **M** mute |

On phones an on-screen d-pad and a big **MITRON** button appear automatically.

## 🌀 How a run works

```
TITLE → [ COMMAND SLAM ] → [ MICROGAME ] → [ SAHI / GALAT ] → …
          every 4 rounds: SPEED UP!      every 8 rounds: 8 PM ADDRESS boss
```

* **3 cups of chai = 3 lives.** Lose a round, lose a cup. Beat the boss, get one back (max 5).
* **Combo multiplier** climbs with every consecutive win, up to ×3.5 — the whole score
  lives or dies on your streak.
* **Speed** ramps every 4 rounds: shorter clocks, faster spawns, tighter timing windows,
  and the background music literally speeds up with you.
* **Meme Cards**: winning a microgame for the first time unlocks its collectible card.
  18 cards total, including four earned by feats (6-combo, boss kill, 12k score, full set).

## 🕹 The microgames

| # | Round | Meme it riffs on | What you do |
| --- | --- | --- | --- |
| 1 | **MITRON!** | the trademark speech opener | Cheer *only* when the word MITRON lands |
| 2 | **NOTEBANDI!** | note-ban ATM queues | Catch new notes in your jhola, dodge the demonetised ones |
| 3 | **JHAPPI!** | bear-hug diplomacy | Time the hug as the world leader enters the hug zone |
| 4 | **CHAI!** | chai-stall origin story · chai pe charcha | Hold to pour, release inside the green band |
| 5 | **YOGA DAY!** | International Yoga Day | Watch the asana sequence, then repeat it |
| 6 | **SAFAI!** | Swachh Bharat jhaadu photo-ops | Sweep every last piece of kachra |
| 7 | **CLOUD COVER!** | "clouds can hide a plane from radar" | Sit inside a cloud whenever the radar sweeps |
| 8 | **TAALI BAJAO!** | 9 baje, 9 minute thali-banging | Hit every beat on the line |
| 9 | **SELFIE!** | selfie diplomacy | Get two leaders inside the frame, then snap |
| 10 | **PARIKSHA!** | "Entire Political Science" | Rapid-fire meme quiz |
| 11 | **PAKODA!** | the pakoda-economy jobs quip | Scoop each pakoda out exactly when it's golden |
| 12 | **ACHHE DIN!** | good days are coming (still) | Run the pothole-and-GST obstacle road to the sign |
| 13 | **9 BAJE!** | diya-lighting night | Light every diya at once while the wind fights you |
| 14 | **MANN KI BAAT!** | the monthly radio address | Tune the dial and hold the signal steady |
| ★ | **THE 8 PM ADDRESS** | the dreaded 8 PM television appearance | Boss: obey every barked order — and when he says **CHUP**, do *nothing* |

## 🏗 Architecture

```
index.html          shell, styles, mobile pad, boot splash, script order
src/util.js         namespace, palette, math, canvas primitives (text/rrect/sunburst/bunting)
src/audio.js        WebAudio synth: tabla, tanpura drone, sitar plucks, SFX, adaptive music loop
src/input.js        one input model over keyboard + mouse + touch + swipe + on-screen pad
src/fx.js           particles, screen shake, hit-freeze, flashes, text pops, petals, CRT overlay
src/art.js          every sprite as vector paths — the caricature, world leaders, all props
src/scenes.js       8 reusable backdrops (rally, street, golden hour, night, sky, hall, road, bank)
src/cards.js        the 18 Meme Cards + card renderer
src/games-a.js      microgames 1–7
src/games-b.js      microgames 8–14
src/boss.js         the 8 PM Address boss round
src/main.js         engine: state machine, HUD, scoring, combos, menus, localStorage
```

Every microgame is one object registered with `MM.reg({...})`:

```js
MM.reg({
  id: 'chai', cmd: 'CHAI!', sub: 'Hold to pour…',
  time: 8,            // base clock in seconds; the engine shortens it as speed rises
  scene: 'golden',    // which backdrop
  card: 'chai',       // Meme Card unlocked on first win
  init(a) { a.st = {...} },        // a.st = your scratch state
  update(dt, a) { … a.win('msg') / a.lose('msg') },
  draw(g, a) { … },
});
```

The round context `a` hands you `a.t`, `a.timeLeft`, `a.speed`, `a.level`, `a.in`
(input), and juice helpers `a.sfx / a.pop / a.shake / a.flash / a.bonus`. Adding
a 15th microgame means appending one such object — the engine handles the command
slam, the clock, scoring, combos, cards and transitions.

## ✔ Verified

Driven headlessly through Playwright:

* every one of the 14 microgames **and** the boss round is winnable by a bot playing
  through the real input layer;
* a full run walks `command → play → result → speed up → boss intro` with no exceptions;
* audio graph builds, the music scheduler runs, all 17 SFX fire without throwing;
* pause and mute toggle and persist to `localStorage`;
* a touch device gets the pad and plays from a tap;
* canvas stays letterboxed at 16:10 from 640×480 up to 1920×1080.

## 🎨 Notes on the craft

* **Zero assets.** The caricature is ~200 lines of bezier work; the receding silver
  hairline is a full hair cap with a skin-coloured forehead cut back over it, and the
  mouth sits on a skin "muzzle" patch so it never disappears into the beard.
* **Audio is generated, not sampled.** Tabla hits are a pitched sine dropping fast plus a
  band-passed noise transient; the melody is a 16-step loop over a Bhairavi-flavoured
  scale whose tempo and density rise with your level.
* **Feel over content.** Screen shake, hit-freeze, particle bursts, floating hype text,
  a slamming command stamp, marigold petals and a subtle CRT vignette do most of the work.
