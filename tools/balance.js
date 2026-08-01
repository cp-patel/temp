/* Headless balance harness for CHUNAV CHANAKYA.
   Runs many full campaigns with scripted players to check that
     (a) the rules never produce NaN / impossible states,
     (b) a thinking player beats a flailing one by a wide margin,
     (c) results spread across outcomes instead of collapsing to always-win.
   Run: node tools/balance.js [games]  */
const path = require('path');
require(path.join(__dirname, '..', 'src', 'strat', 'data.js'));
require(path.join(__dirname, '..', 'src', 'strat', 'model.js'));
require(path.join(__dirname, '..', 'src', 'strat', 'ai.js'));
const SG = globalThis.SG;

const N = parseInt(process.argv[2] || '300', 10);

/* Four of these are meant to be viable-but-different routes to power.
   `chaos` is a deliberate TRAP: it stacks COLD WAR and AWKWARD ALLIANCE, the
   two anti-synergies, so a player who ignores the synergy panel gets punished.
   The test asserts the viable ones work and lets the trap be a trap. */
const DRAFTS = {
  meta: { ids: ['chief', 'chanakya', 'khata', 'maharaj'], viable: true },
  urban: { ids: ['muffler', 'suit', 'chanakya', 'khata'], viable: true },
  fortress: { ids: ['maharaj', 'didi', 'chanakya', 'yuvraj'], viable: true },
  talky: { ids: ['suit', 'thesaurus', 'yuvraj', 'khata'], viable: true },
  chaos: { ids: ['chief', 'yuvraj', 'muffler', 'didi'], viable: false },
};

function playGame(botName, draft, planks, seed, difficulty) {
  const st = SG.newGame({ leaders: draft, planks, seed, difficulty });
  let guard = 0;
  while (!st.finished && guard++ < 60) {
    SG.bots[botName](st);
    SG.endWeek(st);
  }
  if (!st.finished) SG.finish(st);
  return st;
}

function issueWeights() {
  const w = {};
  SG.REGIONS.forEach((r) => (w[r.issue] = (w[r.issue] || 0) + r.seats));
  return Object.entries(w).sort((a, b) => b[1] - a[1]);
}
// what a thinking player picks: the issues covering the most seats
function planksFor() {
  return issueWeights().slice(0, 2).map((x) => x[0]);
}
// the careless pick: issues covering the fewest seats
function planksWorst() {
  return issueWeights().slice(-2).map((x) => x[0]);
}

function stats(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    mean: +(sum / s.length).toFixed(1),
    min: s[0],
    p25: s[Math.floor(s.length * 0.25)],
    med: s[Math.floor(s.length * 0.5)],
    p75: s[Math.floor(s.length * 0.75)],
    max: s[s.length - 1],
  };
}

function run(label, botName, draft, smartPlanks, difficulty) {
  const seats = [];
  const wins = { majority: 0, coalition: 0, largest: 0, lost: 0 };
  const endings = {};
  let bad = 0;
  for (let i = 0; i < N; i++) {
    const seed = 1000 + i;
    const planks = smartPlanks ? planksFor() : planksWorst();
    const st = playGame(botName, draft, planks, seed, difficulty);
    const r = st.result;
    if (!isFinite(r.seats.P) || r.seats.P < 0) bad++;
    const tot = r.seats.P + r.seats.A + r.seats.B + r.seats.O;
    if (tot !== SG.TOTAL_SEATS) bad++;
    seats.push(r.seats.P);
    if (r.majority) wins.majority++;
    else if (r.coalitionPossible) wins.coalition++;
    else if (r.largest === 'P') wins.largest++;
    else wins.lost++;
    endings[r.ending.title] = (endings[r.ending.title] || 0) + 1;
  }
  const s = stats(seats);
  console.log(
    `${label.padEnd(26)} seats med ${String(s.med).padStart(3)}  mean ${String(s.mean).padStart(5)}  ` +
      `range ${s.min}–${s.max}  | majority ${((wins.majority / N) * 100).toFixed(0)}%  ` +
      `coalition-shot ${((wins.coalition / N) * 100).toFixed(0)}%  lost ${((wins.lost / N) * 100).toFixed(0)}%` +
      (bad ? `  ** ${bad} INVALID STATES **` : '')
  );
  return { s, wins, endings, bad };
}

console.log(`board: ${SG.REGIONS.length} regions, ${SG.TOTAL_SEATS} seats, majority ${SG.MAJORITY}`);
console.log(`games per row: ${N}\n`);

const rnd = run('RANDOM player', 'random', DRAFTS.meta.ids, false, 1);
const smart = run('SMART player (meta draft)', 'smart', DRAFTS.meta.ids, true, 1);
console.log(`  planks: best=${planksFor().join('+')}  worst=${planksWorst().join('+')}`);
const smartChaos = run('SMART player (chaos draft)', 'smart', DRAFTS.chaos.ids, true, 1);
const smartTalky = run('SMART player (talky draft)', 'smart', DRAFTS.talky.ids, true, 1);
const smartUrban = run('SMART (urban/DELHI DUO)', 'smart', DRAFTS.urban.ids, true, 1);
const smartFort = run('SMART (fortress cast)', 'smart', DRAFTS.fortress.ids, true, 1);
const smartHard = run('SMART player, hard rivals', 'smart', DRAFTS.meta.ids, true, 2);
const smartNoFit = run('SMART, wrong manifesto', 'smart', DRAFTS.meta.ids, false, 1);

console.log('\nplank pairs (smart, meta draft) — coverage vs running cost:');
const plankMeds = [];
[['WELFARE', 'FAITH'], ['BUSINESS', 'JOBS'], ['IDENTITY', 'FREEBIES'], ['ROADS', 'FARMERS'], ['BUSINESS', 'WELFARE']].forEach((pk) => {
  const seats = [];
  for (let i = 0; i < Math.min(N, 120); i++) {
    const st = playGame('smart', DRAFTS.meta.ids, pk, 4200 + i, 1);
    seats.push(st.result.seats.P);
  }
  const cov = pk.reduce((a, x) => a + SG.plankSeats(x), 0);
  plankMeds.push(stats(seats).med);
  console.log(`  ${pk.join('+').padEnd(18)} covers ${String(cov).padStart(3)} seats → median ${stats(seats).med}`);
});
const plankSpread = Math.max(...plankMeds) - Math.min(...plankMeds);
console.log(`  → spread ${plankSpread} seats (small spread = coverage and running cost cancel out, no dominant manifesto)`);

console.log('\nscenarios (smart play):');
const problemsScen = [];
const scenMeds = {};
[['classic', DRAFTS.meta.ids], ['snap', DRAFTS.meta.ids], ['underdog', ['chief', 'chanakya', 'khata']], ['heatwave', DRAFTS.meta.ids]].forEach(([sc, draft]) => {
  const seats = [];
  let bad = 0;
  for (let i = 0; i < Math.min(N, 100); i++) {
    const st = SG.newGame({ leaders: draft, planks: planksFor(), seed: 6000 + i, scenario: sc });
    let guard = 0;
    while (!st.finished && guard++ < 60) {
      SG.bots.smart(st);
      SG.endWeek(st);
      if (st.storyBeat) SG.resolveStoryBeat(st, 0);
    }
    if (!st.finished) SG.finish(st);
    const t = st.result.seats.P + st.result.seats.A + st.result.seats.B + st.result.seats.O;
    if (t !== SG.TOTAL_SEATS || !isFinite(st.result.seats.P)) bad++;
    seats.push(st.result.seats.P);
  }
  scenMeds[sc] = stats(seats).med;
  console.log(`  ${sc.padEnd(10)} median ${stats(seats).med}${bad ? '  ** ' + bad + ' INVALID **' : ''}`);
  if (bad) problemsScen.push(sc + ' produced invalid states');
});
if (!(scenMeds.snap < scenMeds.classic && scenMeds.underdog < scenMeds.classic))
  problemsScen.push('challenge scenarios are not harder than classic');
if (Math.abs(scenMeds.heatwave - (scenMeds.classic + scenMeds.snap) / 2) > 70)
  problemsScen.push('heatwave difficulty drifted out of band');

console.log('\nendings spread (smart, meta draft):');
Object.entries(smart.endings)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${((v / N) * 100).toFixed(0)}%`));

const skillGap = smart.s.med - rnd.s.med;
const fitGap = smart.s.med - smartNoFit.s.med;
console.log(`\nskill gap (smart − random median seats): ${skillGap}`);
const viable = [smart.s.med, smartUrban.s.med, smartFort.s.med, smartTalky.s.med];
const drafts = viable.concat([smartChaos.s.med]);
console.log(`draft spread across 4 casts: ${Math.min(...drafts)}–${Math.max(...drafts)} median seats`);

const problems = problemsScen || [];
const pathToPower = (smart.wins.majority + smart.wins.coalition) / N;
console.log(`path to power (majority or coalition shot), smart+meta: ${(pathToPower * 100).toFixed(0)}%`);
if (rnd.bad || smart.bad) problems.push('invalid states produced');
if (skillGap < 40) problems.push(`skill gap too small (${skillGap} seats) — thinking barely matters`);
if (plankSpread > 35) problems.push(`one manifesto dominates (${plankSpread}-seat spread across plank pairs)`);
if (smart.wins.majority / N > 0.6) problems.push('outright majorities are too cheap');
if (smart.wins.majority / N < 0.08) problems.push('outright majority effectively impossible');
if (pathToPower < 0.6) problems.push('good play rarely even reaches coalition talks');
if (rnd.wins.majority / N > 0.1) problems.push('flailing wins majorities');
const weakestViable = Math.min(...viable);
if (weakestViable < rnd.s.med + 30)
  problems.push(`weakest VIABLE draft (${weakestViable}) barely beats random play (${rnd.s.med})`);
if (Math.max(...viable) - weakestViable > 95)
  problems.push(`viable drafts too unequal (${weakestViable}–${Math.max(...viable)}) — only one cast really works`);
/* Isolate the anti-synergy: swap ONE leader in the meta cast for a leader with a
   HIGHER solo value that happens to clash with a team-mate. If the anti-synergy
   is real, the "better" leader makes the team worse. */
const clash = [];
for (let i = 0; i < Math.min(N, 120); i++) {
  const st = playGame('smart', ['chief', 'chanakya', 'khata', 'yuvraj'], planksFor(), 5500 + i, 1);
  clash.push(st.result.seats.P);
}
const clashMed = stats(clash).med;
const antiCost = smart.s.med - clashMed;
console.log(`viable drafts: ${weakestViable}–${Math.max(...viable)} median seats | trap draft: ${smartChaos.s.med}`);
console.log(
  `anti-synergy check: swapping maharaj → yuvraj (higher solo value, but clashes with chief) ` +
    `moves the median ${smart.s.med} → ${clashMed} (${antiCost > 0 ? '−' : '+'}${Math.abs(antiCost)} seats)`
);
if (antiCost < 15)
  problems.push(`anti-synergies do not bite (a clashing but stronger leader costs only ${antiCost} seats)`);
console.log(problems.length ? '\nFAIL: ' + problems.join('; ') : '\nOK: rules stable, strategy pays, outcomes spread.');
