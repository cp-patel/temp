/* CHUNAV CHANAKYA — rival AI, intel, and scripted bots used for balance tests.

   The rivals commit to next week's moves at the end of this week and those
   moves are partially leaked to you as INTEL. That is deliberate: a strategy
   game should let you counter a known threat, not guess at a coin flip. */
(function (root) {
  'use strict';

  const SG = (root.SG = root.SG || {});
  const clamp = SG.clamp;

  /* How badly does party `p` want to act in this region? */
  function regionValue(st, p, def) {
    const r = st.regions[def.id];
    const rivals = ['P', 'A', 'B'].filter((x) => x !== p);
    const best = Math.max(...rivals.map((x) => r.share[x]));
    const gap = Math.abs(best - r.share[p]);
    const marginal = 1 / (1 + gap / 9); // close races are worth most
    const size = def.seats / 96;
    const threat = r.share.P > r.share[p] ? 1.45 : 1; // gang up on the front-runner
    return size * (0.55 + marginal) * threat;
  }

  SG.planAI = function (st) {
    const plans = [];
    ['A', 'B'].forEach((p) => {
      const ids = st.leaders[p] || [];
      const budget = 3 + (st.difficulty >= 2 ? 1 : 0) + (st.week > 6 ? 1 : 0);
      const ranked = SG.REGIONS.map((def) => ({ def, v: regionValue(st, p, def) + st.rng() * 0.25 })).sort((a, b) => b.v - a.v);
      const used = new Set();
      for (let i = 0; i < ranked.length && plans.filter((x) => x.party === p).length < budget; i++) {
        const def = ranked[i].def;
        if (used.has(def.id)) continue;
        used.add(def.id);
        const r = st.regions[def.id];
        let actionId;
        // bank momentum if there is any, otherwise build it
        if (r.buzz[p] > 18 && ids.includes('chanakya')) actionId = 'booth';
        else if (r.buzz[p] > 22) actionId = 'ground';
        else if (ids.includes('chief') && st.rng() < 0.5) actionId = 'roadshow';
        else if (ids.includes('muffler') && def.urban > 0.6 && st.rng() < 0.6) actionId = 'bijli';
        else if (ids.includes('yuvraj') && st.rng() < 0.35) actionId = 'yatra';
        else if (ids.includes('maharaj') && r.share[p] > 33 && st.rng() < 0.5) actionId = 'anushasan';
        else if (ids.includes('palti') && r.share.P > r.share[p] + 6 && st.rng() < 0.4) actionId = 'flip';
        else if (ids.includes('thesaurus') && r.buzz.P > 34 && st.rng() < 0.6) actionId = 'vocab';
        else if (ids.includes('suit') && r.buzz.P > 26 && st.rng() < 0.5) actionId = 'debate';
        else if (ids.includes('didi') && r.share[p] > 30 && st.rng() < 0.3) actionId = 'khela';
        else if (st.rng() < 0.28) actionId = 'scheme';
        else actionId = 'rally';
        plans.push({ party: p, actionId, regionId: def.id });
      }
    });
    st.aiPlans = plans;
    return plans;
  };

  /* What the player is allowed to see of the above. */
  SG.visibleIntel = function (st) {
    const n = SG.mods(st, 'P').intel + 1;
    const shuffled = st.aiPlans.slice().sort(() => st.rng() - 0.5);
    return shuffled.slice(0, n).map((p) => {
      const a = SG.actionById(p.actionId);
      const def = SG.REGIONS.find((x) => x.id === p.regionId);
      return {
        party: p.party,
        regionId: p.regionId,
        text: `${SG.PARTIES[p.party].name} → ${a ? a.name : p.actionId} in ${def.name}`,
      };
    });
  };

  /* --------------------------------------------------------------- test bots
     Used by tools/balance.js to prove the game rewards thinking. */
  SG.bots = {};

  SG.bots.random = function (st) {
    let guard = 0;
    while (st.ap > 0 && guard++ < 20) {
      const acts = SG.actionsFor(st, 'P').filter((a) => SG.canQueue(st, a, SG.REGIONS[0].id).ok || true);
      const a = acts[Math.floor(st.rng() * acts.length)];
      const def = SG.REGIONS[Math.floor(st.rng() * SG.REGIONS.length)];
      if (SG.canQueue(st, a, def.id).ok) SG.queue(st, a, def.id);
      else if (st.funds < 30) {
        const f = acts.find((x) => x.id === 'fund');
        if (f && SG.canQueue(st, f, def.id).ok) SG.queue(st, f, def.id);
        else break;
      }
    }
    if (st.dilemma) SG.resolveDilemma(st, Math.floor(st.rng() * st.dilemma.opts.length));
  };

  /* A competent human's playbook: match the message to the region, build buzz
     where seats are cheap, bank it before it decays, counter known threats,
     and keep the treasury alive. */
  SG.bots.smart = function (st) {
    const acts = SG.actionsFor(st, 'P');
    const byId = (id) => acts.find((a) => a.id === id);
    const has = (id) => !!byId(id);

    // targets: big regions where our message fits and the race is winnable —
    // weighted by what THIS cast is actually good at
    const cast = st.leaders.P;
    const targets = SG.REGIONS.map((def) => {
      const r = st.regions[def.id];
      const rivals = Math.max(r.share.A, r.share.B);
      const gap = rivals - r.share.P;
      const fit = st.planks.includes(def.issue) ? 1.6 : 0.8;
      let castFit = 1;
      if (cast.includes('muffler') && def.urban >= 0.45) castFit *= 1.55; // urban machine
      if (cast.includes('maharaj') && r.share.P >= 30) castFit *= 1.3; // defend the fortress
      if (cast.includes('didi') && r.share.P >= 34) castFit *= 1.2; // hold the home turf
      const score = (def.seats / 96) * fit * castFit * (gap > 16 ? 0.35 : 1.25 - Math.abs(gap) / 40);
      return { def, r, score, gap };
    }).sort((a, b) => b.score - a.score);

    // keep the lights on
    if (st.funds < 45 && st.ap > 0 && has('fund')) SG.queue(st, byId('fund'), targets[0].def.id);
    // credibility is an engine, not a vanity stat: repair it before it bites
    if ((st.cred < 45 || st.heat >= 6) && st.ap > 0 && has('org')) SG.queue(st, byId('org'), targets[0].def.id);
    // free actions are always worth taking
    if (has('budget') && SG.canQueue(st, byId('budget'), targets[0].def.id).ok) SG.queue(st, byId('budget'), targets[0].def.id);

    // counter a telegraphed threat with a block or a vocabulary bomb
    if (st.ap > 0 && st.intel.length) {
      const threat = st.intel[0];
      if (has('khela') && SG.canQueue(st, byId('khela'), threat.regionId).ok) SG.queue(st, byId('khela'), threat.regionId);
      else if (has('vocab') && SG.canQueue(st, byId('vocab'), threat.regionId).ok) SG.queue(st, byId('vocab'), threat.regionId);
    }

    for (const t of targets) {
      if (st.ap <= 0) break;
      const buzz = t.r.buzz.P;
      const rivalBuzz = Math.max(t.r.buzz.A, t.r.buzz.B);
      const order = [];
      if (buzz > 34) order.push('booth', 'ground');
      else order.push('roadshow', 'yatra', 'rally', 'ads');
      // stealing a rival's momentum is the cheapest buzz in the game
      if (rivalBuzz > 20) order.unshift('debate');
      // schemes are permanent but pricey: only worth an AP when cash-rich and
      // the message matches the region
      if (st.planks.includes(t.def.issue) && st.funds > 70) order.unshift('scheme');
      if (t.def.urban >= 0.45 && st.funds > 80) order.unshift('bijli');
      if (st.week >= st.maxWeeks - 1) order.unshift('booth', 'ground'); // cash out at the end
      for (const id of order) {
        if (st.ap <= 0) break;
        const a = byId(id);
        if (a && SG.canQueue(st, a, t.def.id).ok) {
          SG.queue(st, a, t.def.id);
          break;
        }
      }
    }

    // spend leftovers: memes are the cheapest buzz but they burn credibility,
    // so only reach for them when there is credibility to spare
    let guard = 0;
    while (st.ap > 0 && guard++ < 8) {
      const t = targets[guard % Math.min(4, targets.length)];
      const cheap = st.cred >= 65 && st.heat <= 4 ? ['meme', 'rally', 'ads'] : ['rally', 'ads', 'org'];
      const a = cheap.map(byId).find((x) => x && SG.canQueue(st, x, t.def.id).ok);
      if (a) SG.queue(st, a, t.def.id);
      else break;
    }

    // dilemmas: prefer credibility and share, avoid heat
    if (st.dilemma) {
      let best = 0;
      let bestV = -1e9;
      st.dilemma.opts.forEach((o, i) => {
        const f = o.fx || {};
        const v =
          (f.cred || 0) * 0.9 +
          (f.shareAll || 0) * 26 +
          (f.urbanShare || 0) * 9 +
          (f.buzzAll || 0) * 0.55 +
          (f.stealBuzz || 0) * 0.5 +
          (f.stealShare || 0) * 6 +
          (f.swingBuzz || 0) * 0.7 +
          (f.funds || 0) * 0.22 +
          (f.cadre || 0) * 0.3 +
          (f.apNext || 0) * 22 -
          (f.heat || 0) * 12 -
          (f.seatTax || 0) * 9;
        if (v > bestV) {
          bestV = v;
          best = i;
        }
      });
      SG.resolveDilemma(st, best);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
