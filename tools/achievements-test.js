/* Achievement reachability harness for CHUNAV CHANAKYA.
   An unreachable achievement is the worst kind of bug: it looks fine, and it
   costs a player hours before they suspect the game rather than themselves.
   So we measure. Scripted bots play every scenario across several drafts and
   manifestos; anything that never fires under any of them is reported.

   Some achievements are deliberately out of reach for an unguided bot — the
   bot never sets out to keep HEAT at zero, and it does not accept story beats
   the way a player does. Those carry an `intent` line: a scripted player that
   plays for that achievement specifically. If the intentional run cannot get
   it either, it is genuinely impossible and the test fails.

   Run: node tools/achievements-test.js [gamesPerCell]  */
const path = require('path');
require(path.join(__dirname, '..', 'src', 'strat', 'data.js'));
require(path.join(__dirname, '..', 'src', 'strat', 'model.js'));
require(path.join(__dirname, '..', 'src', 'strat', 'ai.js'));
const SG = globalThis.SG;

/* Below ~10 games per cell the intentional runs are pure noise: several
   achievements sit at a 25-40% intent rate, so a 4-game sample reports zero and
   the test "fails" on sampling, not on the game. Floor it rather than lie. */
const N = Math.max(10, parseInt(process.argv[2] || '40', 10));

const DRAFTS = {
  meta: ['chief', 'chanakya', 'khata', 'maharaj'],
  urban: ['muffler', 'suit', 'chanakya', 'khata'],
  fortress: ['maharaj', 'didi', 'chanakya', 'yuvraj'],
  acrobat: ['chief', 'chanakya', 'palti', 'maharaj'],
  clashing: ['chief', 'didi', 'chanakya', 'khata'], // COLD WAR — the harshest clash
  awkward: ['yuvraj', 'muffler', 'chanakya', 'khata'], // AWKWARD ALLIANCE — the mildest
  three: ['chief', 'chanakya', 'khata'],
};

function bigPlanks() {
  const w = {};
  SG.REGIONS.forEach((r) => (w[r.issue] = (w[r.issue] || 0) + r.seats));
  return Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
}

/* Play one campaign. `opts.choose` picks story/dilemma options by intent;
   `opts.policy` can override the bot for a turn. */
function play(opts) {
  const st = SG.newGame({
    leaders: opts.draft,
    planks: opts.planks || bigPlanks(),
    seed: opts.seed,
    scenario: opts.scenario || 'classic',
    difficulty: 1,
  });
  let guard = 0;
  while (!st.finished && guard++ < 60) {
    if (st.storyBeat) {
      SG.resolveStoryBeat(st, opts.choose ? opts.choose('story', st) : 0);
      continue;
    }
    if (st.dilemma) SG.resolveDilemma(st, opts.choose ? opts.choose('dilemma', st) : 0);
    (opts.policy || SG.bots.smart)(st);
    SG.endWeek(st);
  }
  if (!st.finished) SG.finish(st);
  if (opts.coalition && st.result.coalitionPossible) {
    const offers = SG.coalitionOffers(st);
    const pick = offers.find((o) => o.id === opts.coalition);
    if (pick) SG.applyCoalition(st, pick);
  }
  return st;
}

/* ---------------------------------------------------- intentional players
   Each returns a finished state chasing exactly one achievement. These
   double as a spec: this is what the achievement actually asks a player to do. */

// never take a heat-raising action, and always pick the coolest story option
const CLEAN = new Set(['meme', 'scheme', 'bijli', 'flip']);
function cleanPolicy(st) {
  let guard = 0;
  while (st.ap > 0 && guard++ < 12) {
    const acts = SG.actionsFor(st, 'P').filter((a) => !CLEAN.has(a.id));
    let best = null;
    acts.forEach((a) => {
      SG.REGIONS.forEach((def) => {
        if (!SG.canQueue(st, a, def.id).ok) return;
        const c = SG.cloneLite(st);
        SG.applyAction(c, 'P', a.id, def.id, null);
        const gain = SG.seatTotals(c).P + st.regions[def.id].share.P * 0.2;
        if (!best || gain > best.gain) best = { a, rid: def.id, gain };
      });
    });
    if (!best) break;
    SG.queue(st, best.a, best.rid);
  }
}
const coolestOption = (kind, st) => {
  if (kind === 'story') {
    const arc = SG.ARCS.find((a) => a.id === st.storyBeat.arcId);
    const opts = arc.beats[st.storyBeat.beat].opts;
    let bi = 0;
    opts.forEach((o, i) => {
      const h = (o.fx && o.fx.heat) || 0;
      if (h < ((opts[bi].fx && opts[bi].fx.heat) || 0)) bi = i;
    });
    return bi;
  }
  const opts = st.dilemma.opts;
  let bi = 0;
  opts.forEach((o, i) => {
    const h = (o.fx && o.fx.heat) || 0;
    if (h < ((opts[bi].fx && opts[bi].fx.heat) || 0)) bi = i;
  });
  return bi;
};

// pick a specific flag when a given arc beat comes up, else play normally
function flagChooser(arcId, flags) {
  return (kind, st) => {
    if (kind !== 'story') return 0;
    const b = st.storyBeat;
    if (b.arcId !== arcId) return 0;
    const arc = SG.ARCS.find((a) => a.id === arcId);
    const opts = arc.beats[b.beat].opts;
    const idx = opts.findIndex((o) => flags.includes(o.flag));
    return idx >= 0 ? idx : 0;
  };
}

// play well, then make sure not one action point is left on the table:
// the cheapest affordable action beats an unspent AP every single time
function frugalPolicy(st) {
  SG.bots.smart(st);
  let guard = 0;
  while (st.ap > 0 && guard++ < 12) {
    const acts = SG.actionsFor(st, 'P').sort((a, b) => a.cost.funds - b.cost.funds);
    let placed = false;
    for (const a of acts) {
      const region = SG.REGIONS.slice()
        .sort((x, y) => st.regions[y.id].share.P - st.regions[x.id].share.P)
        .find((def) => SG.canQueue(st, a, def.id).ok);
      if (region) {
        SG.queue(st, a, region.id);
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
}

/* Hold the dam: play well, but spend two action points a week on the two
   regions that have fallen furthest below where they started. Measured: one AP
   of broad defence is not enough (best run holds 11/12), two is (12/12, and
   still 316 seats) — which is the lesson the achievement is there to teach. */
function defendLaggardPolicy(st) {
  const rank = SG.REGIONS.slice().sort(
    (a, b) =>
      st.regions[a.id].share.P - (st.startShareByRegion[a.id] || 0) -
      (st.regions[b.id].share.P - (st.startShareByRegion[b.id] || 0))
  );
  const acts = SG.actionsFor(st, 'P');
  rank.slice(0, 2).forEach((laggard) => {
    for (const id of ['booth', 'ground', 'rally', 'ads']) {
      const a = acts.find((x) => x.id === id);
      if (a && SG.canQueue(st, a, laggard.id).ok) {
        SG.queue(st, a, laggard.id);
        break;
      }
    }
  });
  SG.bots.smart(st);
}

// the acrobat's whole purpose: crack a standing mahagathbandhan open
function fracturePolicy(st) {
  if (SG.allied(st) && st.leaders.P.includes('palti')) {
    const flip = SG.actionsFor(st, 'P').find((a) => a.owner === 'palti');
    const target = SG.REGIONS.slice().sort((a, b) => b.seats - a.seats).find((def) => flip && SG.canQueue(st, flip, def.id).ok);
    if (target) SG.queue(st, flip, target.id);
  }
  SG.bots.smart(st);
}

// rotate the cast: the least-used leader gets the next assignment
function rotatePolicy(st) {
  const u = st.usage || {};
  const mine = st.leaders.P.slice().sort((a, b) => (u[a] || 0) - (u[b] || 0));
  const acts = SG.actionsFor(st, 'P');
  for (const id of mine) {
    if ((u[id] || 0) >= 2) continue;
    const a = acts.find((x) => x.owner === id);
    const target = a && SG.REGIONS.slice()
      .sort((x, y) => st.regions[y.id].share.P - st.regions[x.id].share.P)
      .find((def) => SG.canQueue(st, a, def.id).ok);
    if (target) SG.queue(st, a, target.id);
  }
  SG.bots.smart(st);
}

// bank everything in the final week
function bankLatePolicy(st) {
  if (st.week === st.maxWeeks) {
    let guard = 0;
    while (st.ap > 0 && guard++ < 12) {
      const acts = SG.actionsFor(st, 'P').filter((a) => a.id === 'ground' || a.id === 'booth');
      let placed = false;
      for (const a of acts) {
        const region = SG.REGIONS.slice()
          .sort((x, y) => st.regions[y.id].buzz.P - st.regions[x.id].buzz.P)
          .find((def) => SG.canQueue(st, a, def.id).ok);
        if (region) {
          SG.queue(st, a, region.id);
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }
    return;
  }
  SG.bots.smart(st);
}

/* NOTE: a clean campaign has to avoid the FAITH plank too — it bills +0.9 HEAT
   every week, which is exactly the kind of quiet running cost the manifesto
   screen is there to make you read. */
const INTENTS = {
  saaf_suthra: (seed) =>
    play({ draft: DRAFTS.meta, seed, planks: ['WELFARE', 'JOBS'], policy: cleanPolicy, choose: coolestOption }),
  numbers_hain: (seed) => play({ draft: DRAFTS.urban, seed, coalition: 'deputy' }),
  vipaksh_mein: (seed) => play({ draft: DRAFTS.meta, seed, coalition: 'principle' }),
  poori_tape: (seed) => play({ draft: DRAFTS.meta, seed, choose: flagChooser('tape', ['released', 'faced']) }),
  sadak_par_baithe: (seed) =>
    play({ draft: DRAFTS.meta, seed, planks: ['FARMERS', 'JOBS'], choose: flagChooser('march', ['met']) }),
  gathbandhan_toot: (seed) => play({ draft: DRAFTS.acrobat, seed, policy: fracturePolicy }),
  cold_war_cabinet: (seed) => play({ draft: DRAFTS.awkward, seed }),
  dam_holds: (seed) => play({ draft: DRAFTS.meta, seed, scenario: 'heatwave', policy: defendLaggardPolicy }),
  aakhri_push: (seed) => play({ draft: DRAFTS.meta, seed, scenario: 'snap', policy: bankLatePolicy }),
  saare_paanch: (seed) => play({ draft: DRAFTS.three, seed, scenario: 'underdog', policy: frugalPolicy }),
  pehle_saakh: (seed) => play({ draft: ['suit', 'thesaurus', 'chanakya', 'yuvraj'], seed }),
  koi_bench_nahi: (seed) => play({ draft: DRAFTS.meta, seed, policy: rotatePolicy }),
};

/* ------------------------------------------------------------------- run */
const counts = {};
const meta = { scenariosWon: [] };
SG.ACHIEVEMENTS.forEach((a) => (counts[a.id] = { unguided: 0, intent: 0, tries: 0 }));

console.log(`achievement reachability — ${N} games per cell\n`);

// 1. unguided sweep: does normal strong play stumble into these?
let unguidedGames = 0;
const scenarios = ['classic', 'snap', 'underdog', 'heatwave'];
scenarios.forEach((sc) => {
  Object.entries(DRAFTS).forEach(([dn, draft]) => {
    if (sc === 'underdog' && draft.length !== 3) return;
    if (sc !== 'underdog' && draft.length === 3) return;
    for (let i = 0; i < N; i++) {
      const st = play({ draft, seed: 9000 + i, scenario: sc });
      unguidedGames++;
      SG.checkAchievements(st, st.result, meta).forEach((id) => counts[id].unguided++);
      // a bot that always takes the first coalition offer, to exercise that path
      if (st.result.coalitionPossible) {
        const st2 = play({ draft, seed: 9000 + i, scenario: sc, coalition: 'ministries' });
        SG.checkAchievements(st2, st2.result, meta).forEach((id) => counts[id].unguided++);
        unguidedGames++;
      }
    }
  });
});

// 2. intentional runs: can a player who is TRYING get each one?
Object.entries(INTENTS).forEach(([id, fn]) => {
  for (let i = 0; i < N; i++) {
    const st = fn(7000 + i);
    counts[id].tries++;
    if (SG.checkAchievements(st, st.result, meta).includes(id)) counts[id].intent++;
  }
});

// 3. the cross-run gold: four scenario wins accumulated across campaigns
const wonScenarios = [];
scenarios.forEach((sc) => {
  for (let i = 0; i < N * 3; i++) {
    const draft = sc === 'underdog' ? DRAFTS.three : DRAFTS.meta;
    const st = play({ draft, seed: 3000 + i, scenario: sc, coalition: 'deputy' });
    if (st.result.majority) {
      wonScenarios.push(sc);
      break;
    }
  }
});
const crossOk = scenarios.every((s) => wonScenarios.includes(s));
counts.har_haal_sarkar.intent = crossOk ? N : 0;
counts.har_haal_sarkar.tries = N;

/* ---------------------------------------------------------------- report */
const problems = [];
console.log('id                    tier    unguided      intentional');
SG.ACHIEVEMENTS.forEach((a) => {
  const c = counts[a.id];
  const up = ((c.unguided / unguidedGames) * 100).toFixed(1);
  const ip = c.tries ? ((c.intent / c.tries) * 100).toFixed(0) + '%' : '—';
  console.log(`${a.id.padEnd(20)}  ${a.tier.padEnd(6)}  ${String(up).padStart(5)}%  ${String(ip).padStart(14)}`);
  if (c.unguided === 0 && c.intent === 0)
    problems.push(`${a.id} never fired — unreachable in ${unguidedGames} unguided + ${c.tries} intentional runs`);
  if (c.unguided / unguidedGames > 0.75)
    problems.push(`${a.id} fires in ${up}% of ordinary runs — it is wallpaper, not an achievement`);
});

console.log(`\nunguided campaigns played: ${unguidedGames}`);
console.log(`cross-run scenarios won:   ${wonScenarios.join(', ') || 'none'}`);
if (!crossOk) problems.push('har_haal_sarkar is unreachable: a bot could not win every scenario');

const tiers = { bronze: 0, silver: 0, gold: 0 };
SG.ACHIEVEMENTS.forEach((a) => tiers[a.tier]++);
console.log(`tiers: ${tiers.bronze} bronze · ${tiers.silver} silver · ${tiers.gold} gold`);
if (SG.ACHIEVEMENTS.length !== 14) problems.push(`expected 14 achievements, found ${SG.ACHIEVEMENTS.length}`);
const ids = SG.ACHIEVEMENTS.map((a) => a.id);
if (new Set(ids).size !== ids.length) problems.push('duplicate achievement ids');

console.log(problems.length ? '\nFAIL: ' + problems.join('; ') : '\nOK: every achievement is reachable and none is wallpaper.');
process.exit(problems.length ? 1 : 0);
