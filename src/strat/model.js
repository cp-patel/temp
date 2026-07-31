/* CHUNAV CHANAKYA — the rules engine. Pure logic, zero rendering, seeded RNG,
   so it runs headlessly in node for balance testing.

   Design notes that matter for play:
   • BUZZ is momentum (decays). VOTE SHARE is permanent. Converting one into the
     other is the whole game, and CADRE + CREDIBILITY set the exchange rate.
   • Seats use share^2.1 — leading a region pays a bonus, so concentrating
     beats spreading thin. Deciding *where* to concentrate is the strategy.
   • Rival plans are TELEGRAPHED one week ahead (INTEL), so blocking and
     counter-punching are real options rather than guesswork. */
(function (root) {
  'use strict';

  const SG = (root.SG = root.SG || {});
  const PL = ['P', 'A', 'B'];
  const ALL = ['P', 'A', 'B', 'O'];

  /* ------------------------------------------------------------------- rng */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SG.clamp = clamp;

  /* --------------------------------------------------------------- helpers */
  function region(st, id) {
    return st.regions[id];
  }
  SG.region = region;

  function addShare(st, rid, party, g) {
    const r = st.regions[rid];
    if (!g) return 0;
    // fortress: a rival gaining inside somebody's fortress only gets half
    for (const p of PL) {
      if (p !== party && r.fortress[p] > 0 && g > 0) g *= 0.55;
    }
    const others = ALL.filter((p) => p !== party);
    if (g > 0) {
      const pool = others.reduce((s, p) => s + Math.max(0, r.share[p] - 0.6), 0);
      g = Math.min(g, pool);
      if (g <= 0) return 0;
      const tot = others.reduce((s, p) => s + Math.max(0, r.share[p] - 0.6), 0) || 1;
      others.forEach((p) => (r.share[p] -= g * (Math.max(0, r.share[p] - 0.6) / tot)));
      r.share[party] += g;
    } else {
      const take = Math.min(-g, Math.max(0, r.share[party] - 0.6));
      if (take <= 0) return 0;
      const tot = others.reduce((s, p) => s + r.share[p], 0) || 1;
      others.forEach((p) => (r.share[p] += take * (r.share[p] / tot)));
      r.share[party] -= take;
      g = -take;
    }
    normalise(r);
    return g;
  }
  SG.addShare = addShare;

  function normalise(r) {
    ALL.forEach((p) => (r.share[p] = Math.max(0.4, r.share[p])));
    const t = ALL.reduce((s, p) => s + r.share[p], 0);
    ALL.forEach((p) => (r.share[p] = (r.share[p] / t) * 100));
  }

  function addBuzz(st, rid, party, v) {
    const r = st.regions[rid];
    r.buzz[party] = clamp(r.buzz[party] + v, 0, 160);
  }

  /* Spillover is a fixed budget shared between neighbours, so aiming at the
     most-connected region is no longer a free multiplier. */
  function spill(st, nb, party, total) {
    if (!nb.length) return;
    const each = total / nb.length;
    nb.forEach((n) => addBuzz(st, n, party, each));
  }

  /* --------------------------------------------------------- seat allocation
     share^GAMMA with largest-remainder rounding: a lead converts into a seat
     bonus, exactly like first-past-the-post does in aggregate. */
  const GAMMA = 2.1;
  SG.seatsInRegion = function (r, seats, allied) {
    const w = {};
    let tw = 0;
    if (allied) {
      // the opposition fights as one bloc: their shares add up before the
      // seat curve is applied, which is exactly why alliances are terrifying
      // allies never merge perfectly — seat-sharing friction keeps ~28% of the
      // junior partner's vote fighting the senior one
      const A0 = Math.max(0, r.share.A);
      const B0 = Math.max(0, r.share.B);
      const junior = Math.min(A0, B0);
      const ab = A0 + B0 - junior * 0.28;
      const wab = Math.pow(ab / 100, GAMMA);
      w.P = Math.pow(Math.max(0, r.share.P) / 100, GAMMA);
      w.O = Math.pow(Math.max(0, r.share.O) / 100, GAMMA);
      const sp = ab > 0 ? Math.max(0, r.share.A) / ab : 0.5;
      w.A = wab * sp;
      w.B = wab * (1 - sp);
      tw = w.P + w.O + wab;
    } else {
      ALL.forEach((p) => {
        w[p] = Math.pow(Math.max(0, r.share[p]) / 100, GAMMA);
        tw += w[p];
      });
    }
    const exact = {};
    const out = {};
    let used = 0;
    ALL.forEach((p) => {
      exact[p] = (seats * w[p]) / (tw || 1);
      out[p] = Math.floor(exact[p]);
      used += out[p];
    });
    const rem = ALL.slice().sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])));
    let i = 0;
    while (used < seats) {
      out[rem[i % rem.length]]++;
      used++;
      i++;
    }
    return out;
  };

  SG.allied = (st) => !!st.alliance && !(st.allianceBroken > 0);

  SG.seatTotals = function (st) {
    const tot = { P: 0, A: 0, B: 0, O: 0 };
    SG.REGIONS.forEach((def) => {
      const s = SG.seatsInRegion(st.regions[def.id], def.seats, SG.allied(st));
      ALL.forEach((p) => (tot[p] += s[p]));
    });
    if (st.seatTax) {
      const t = Math.min(st.seatTax, tot.P);
      tot.P -= t;
      tot.O += t;
    }
    return tot;
  };

  /* ------------------------------------------------------------- new game */
  SG.newGame = function (opts) {
    opts = opts || {};
    const seed = opts.seed === undefined ? Math.floor(Math.random() * 1e9) : opts.seed;
    const rng = mulberry32(seed);
    const myLeaders = (opts.leaders || ['chief', 'chanakya', 'yuvraj', 'suit']).slice(0, 4);
    const rest = SG.LEADERS.map((l) => l.id).filter((id) => !myLeaders.includes(id));
    // whoever you passed on lines up against you, split across two rival fronts
    const A = [];
    const B = [];
    rest.forEach((id, i) => (i % 2 ? B : A).push(id));

    const st = {
      seed,
      rng,
      week: 1,
      maxWeeks: opts.weeks || 10,
      difficulty: opts.difficulty === undefined ? 1 : opts.difficulty,
      apMax: 4,
      ap: 4,
      apNextBonus: 0,
      funds: 108,
      cadre: 45,
      cred: 55,
      heat: 0,
      seatTax: 0,
      planks: (opts.planks || ['JOBS', 'FAITH']).slice(0, 2),
      leaders: { P: myLeaders, A, B },
      cooldown: {},
      regions: {},
      queue: [],
      log: [],
      news: '',
      dilemma: null,
      pendingDilemma: null,
      aiPlans: [],
      intel: [],
      finished: false,
      result: null,
      weekReport: null,
    };

    SG.REGIONS.forEach((def) => {
      const jitter = (n) => (rng() - 0.5) * n;
      const share = {
        P: clamp(24 + jitter(12), 8, 40),
        A: clamp(27 + jitter(12), 8, 42),
        B: clamp(13 + jitter(14), 3, 34),
        O: clamp(30 + jitter(10), 12, 44),
      };
      const r = {
        id: def.id,
        share,
        buzz: { P: 0, A: 0, B: 0 },
        cadre: { P: clamp(28 + jitter(16), 8, 60), A: clamp(30 + jitter(16), 8, 62), B: clamp(24 + jitter(16), 6, 55) },
        fortress: { P: 0, A: 0, B: 0 },
        blocked: null,
        yatra: { P: 0, A: 0, B: 0 },
      };
      normalise(r);
      st.regions[def.id] = r;
    });

    // rivals get a home turf so the board is not flat
    const rivalHome = { A: 'uttar', B: 'bangla' };
    Object.entries(rivalHome).forEach(([p, rid]) => {
      addShare(st, rid, p, 8);
      st.regions[rid].cadre[p] = 62;
    });

    SG.planAI(st);
    st.intel = SG.visibleIntel(st);
    st.news = SG.HEADLINES[Math.floor(rng() * SG.HEADLINES.length)];
    return st;
  };

  /* --------------------------------------------------------------- modifiers
     Derived from the drafted cast + synergies. Recomputed on demand so the UI
     and the engine can never disagree. */
  SG.mods = function (st, party) {
    party = party || 'P';
    const ids = st.leaders[party] || [];
    const has = (x) => ids.includes(x);
    const syn = (a, b) => has(a) && has(b);
    const m = {
      buzzMul: 1,
      convMul: 1,
      schemeCostMul: 1,
      fundsIncome: 4,
      cadreIncome: 10,
      credIncome: 0,
      fortressAt: 34,
      fortressOn: has('maharaj'),
      intel: 1,
      homeShield: has('didi') ? 38 : 0,
      urbanConv: 0,
      flipMul: 1,
      debateShare: 0,
      apDrainEvery: 0,
      names: [],
    };
    if (has('chief')) m.buzzMul *= 1.1;
    if (has('chanakya')) m.convMul *= 1.24;
    if (has('yuvraj')) m.cadreIncome += 14;
    if (has('didi')) m.cadreIncome += 8;
    if (has('maharaj')) m.cadreIncome += 6;
    if (has('muffler')) ((m.schemeCostMul *= 0.75), (m.urbanConv = 1.5));
    if (has('suit')) m.credIncome += 4;
    if (has('thesaurus')) ((m.intel += 1), (m.credIncome += 2));
    if (has('palti')) m.fundsIncome += 14;
    if (has('khata')) m.fundsIncome += 26;

    if (syn('chief', 'chanakya')) (m.convMul *= 1.1), m.names.push('JODI No. 1');
    if (syn('chief', 'maharaj')) ((m.fortressAt = 28), m.names.push('DOUBLE ENGINE'));
    if (syn('muffler', 'suit')) ((m.freebieCostMul = 0.8), m.names.push('DELHI DUO'));
    if (syn('thesaurus', 'suit')) ((m.debateShare = 1.5), m.names.push('PRIME TIME PANEL'));
    if (syn('didi', 'palti')) ((m.fundsIncome += 20), m.names.push('REGIONAL FRONT'));
    if (syn('chanakya', 'palti')) ((m.flipMul = 1.6), m.names.push('OPERATION MATHEMATICS'));
    if (syn('yuvraj', 'thesaurus')) ((m.credIncome += 5), (m.buzzMul *= 0.96), m.names.push('ERUDITE YATRA'));
    if (syn('yuvraj', 'muffler')) ((m.apDrainEvery = 3), m.names.push('AWKWARD ALLIANCE'));
    if (syn('chief', 'yuvraj')) ((m.credIncome -= 9), m.names.push('IMPOSSIBLE GATHBANDHAN'));
    if (syn('didi', 'chief')) ((m.buzzMul *= 0.78), m.names.push('COLD WAR'));
    m.freebieCostMul = m.freebieCostMul || 1;
    return m;
  };

  /* ------------------------------------------------------- available actions */
  SG.actionsFor = function (st, party) {
    party = party || 'P';
    const m = SG.mods(st, party);
    const list = SG.GENERIC.map((a) => ({ ...a, owner: null }));
    (st.leaders[party] || []).forEach((id) => {
      const L = SG.leaderById(id);
      list.push({ ...L.action, owner: id, ownerNick: L.nick });
    });
    return list.map((a) => {
      const cost = SG.costOf(st, party, a, m);
      const cd = st.cooldown[a.id] || 0;
      return { ...a, cost, cooldownLeft: party === 'P' ? cd : 0 };
    });
  };

  SG.costOf = function (st, party, a, m) {
    m = m || SG.mods(st, party);
    let funds = a.funds || 0;
    if (a.id === 'scheme') funds = Math.round(funds * m.schemeCostMul);
    if (a.id === 'bijli') funds = Math.round(funds * m.freebieCostMul);
    return { ap: a.ap || 1, funds, cadre: a.cadre || 0 };
  };

  SG.canQueue = function (st, a, rid) {
    const c = a.cost || SG.costOf(st, 'P', a);
    if (st.ap < c.ap) return { ok: false, why: 'No action points left this week' };
    if (c.funds > 0 && st.funds < c.funds) return { ok: false, why: 'Not enough FUNDS' };
    if (c.cadre > 0 && st.cadre < c.cadre) return { ok: false, why: 'Not enough CADRE' };
    if ((st.cooldown[a.id] || 0) > 0) return { ok: false, why: `On cooldown (${st.cooldown[a.id]} wk)` };
    if (st.queue.some((q) => q.actionId === a.id && q.regionId === rid))
      return { ok: false, why: 'Already queued here' };
    if (a.cooldown && st.queue.some((q) => q.actionId === a.id))
      return { ok: false, why: 'Once per week only' };
    return { ok: true };
  };

  SG.queue = function (st, a, rid) {
    const chk = SG.canQueue(st, a, rid);
    if (!chk.ok) return chk;
    const c = a.cost || SG.costOf(st, 'P', a);
    st.ap -= c.ap;
    st.funds -= c.funds;
    st.cadre -= c.cadre;
    st.queue.push({ actionId: a.id, regionId: rid, owner: a.owner || null, cost: c, name: a.name, icon: a.icon });
    return { ok: true };
  };

  SG.unqueue = function (st, i) {
    const q = st.queue[i];
    if (!q) return;
    st.ap += q.cost.ap;
    st.funds += q.cost.funds;
    st.cadre += q.cost.cadre;
    st.queue.splice(i, 1);
  };

  /* ------------------------------------------------------------ apply action
     Party-agnostic: the AI calls exactly the same code the player does. */
  SG.applyAction = function (st, party, actionId, rid, log) {
    const r = st.regions[rid];
    if (!r) return;
    if (r.blocked && r.blocked !== party) {
      if (log) log.push({ t: `${SG.PARTIES[party].short}'s move in ${SG.REGIONS.find((x) => x.id === rid).name} was blocked on the streets!`, bad: party === 'P' });
      return;
    }
    const def = SG.REGIONS.find((x) => x.id === rid);
    const m = SG.mods(st, party);
    const nb = def.nb;
    const fit = SG.issueFit(st, party, def);

    switch (actionId) {
      case 'rally':
        addBuzz(st, rid, party, 22 * m.buzzMul);
        break;
      case 'roadshow':
        addBuzz(st, rid, party, 44 * m.buzzMul);
        spill(st, nb, party, 34 * m.buzzMul);
        break;
      case 'ads':
        addBuzz(st, rid, party, 13 * m.buzzMul);
        spill(st, nb, party, 20 * m.buzzMul);
        break;
      case 'meme':
        addBuzz(st, rid, party, 19 * m.buzzMul);
        if (party === 'P') {
          st.heat += 1.5;
          st.cred -= 3;
        }
        break;
      case 'ground': {
        const g = 0.105 * r.buzz[party] * (0.5 + 0.5 * (r.cadre[party] / 100)) * fit * SG.convFor(st, party, def) * SG.credFactor(st, party);
        addShare(st, rid, party, g);
        r.buzz[party] *= 0.45;
        r.cadre[party] = clamp(r.cadre[party] + 7, 0, 100);
        break;
      }
      case 'booth': {
        const g = 0.135 * r.buzz[party] * (0.5 + 0.5 * (r.cadre[party] / 100)) * fit * SG.convFor(st, party, def) * 1.12 * SG.credFactor(st, party);
        addShare(st, rid, party, g);
        r.buzz[party] *= 0.35;
        r.cadre[party] = clamp(r.cadre[party] + 22, 0, 100);
        break;
      }
      case 'scheme':
        addShare(st, rid, party, party === 'P' ? (st.planks.includes(def.issue) ? 3.2 : 1.3) : 2.3);
        if (party === 'P') st.heat += 0.5;
        break;
      case 'bijli':
        addShare(st, rid, party, 1.6 + 3.2 * def.urban);
        addBuzz(st, rid, party, 12 * m.buzzMul);
        if (party === 'P') st.heat += 1;
        break;
      case 'yatra':
        addBuzz(st, rid, party, 18 * m.buzzMul);
        spill(st, nb, party, 30 * m.buzzMul);
        r.yatra[party] = 2;
        if (party === 'P') st.cred += 3;
        break;
      case 'anushasan':
        r.fortress[party] = 3;
        r.cadre[party] = clamp(r.cadre[party] + 14, 0, 100);
        if (party === 'P') st.cred += 2;
        break;
      case 'debate': {
        const rival = PL.filter((p) => p !== party).sort((a, b) => r.buzz[b] - r.buzz[a])[0];
        const stolen = r.buzz[rival] * 0.55;
        r.buzz[rival] -= stolen;
        addBuzz(st, rid, party, stolen * 0.6 + 14 * m.buzzMul);
        if (m.debateShare) addShare(st, rid, party, m.debateShare);
        if (party === 'P') st.cred += 6;
        break;
      }
      case 'vocab': {
        [rid, ...nb].forEach((n) => {
          PL.filter((p) => p !== party).forEach((p) => (st.regions[n].buzz[p] *= 0.62));
        });
        addBuzz(st, rid, party, 15 * m.buzzMul); // the speech gets airtime too
        if (party === 'P') st.cred += 4;
        break;
      }
      case 'khela':
        addBuzz(st, rid, party, 13 * m.buzzMul); // street presence is visible
        r.blocked = party;
        r.blockedTurns = 1;
        break;
      case 'flip': {
        const lead = PL.filter((p) => p !== party).sort((a, b) => r.share[b] - r.share[a])[0];
        const take = Math.min(6 * m.flipMul, r.share[lead] - 1);
        if (take > 0) {
          r.share[lead] -= take;
          r.share[party] += take;
          normalise(r);
        }
        if (party === 'P') {
          st.heat += 1.5;
          if (m.flipMul > 1) st.heat += 0.5;
          // the acrobat's real value: he can crack the mahagathbandhan open
          if (st.alliance) {
            st.allianceBroken = m.flipMul > 1 ? 3 : 2;
            if (log) log.push({ t: 'PALTI JI has fractured the MAHAGATHBANDHAN. Allies are not speaking.', good: true });
          }
        }
        break;
      }
      case 'budget':
        if (party === 'P') {
          st.funds += 55;
          st.cooldown.budget = 3;
        }
        SG.REGIONS.filter((x) => x.urban < 0.5).forEach((x) => addShare(st, x.id, party, 0.7));
        break;
      case 'fund':
        if (party === 'P') {
          st.funds += 45;
          st.cred -= 3;
        }
        break;
      case 'org':
        if (party === 'P') {
          st.cadre += 20;
          st.cred += 6;
        } else st.regions[rid].cadre[party] = clamp(st.regions[rid].cadre[party] + 10, 0, 100);
        break;
    }

    if (log) {
      const nm = SG.actionById(actionId);
      log.push({
        t: `${party === 'P' ? 'YOU' : SG.PARTIES[party].name}: ${nm ? nm.name : actionId} → ${def.name}`,
        good: party === 'P',
        party,
      });
    }
  };

  /* Message-fit: your manifesto planks vs what the region actually cares about. */
  SG.issueFit = function (st, party, def) {
    if (party !== 'P') return 1.12;
    return st.planks.includes(def.issue) ? 1.6 : 0.55;
  };

  /* Two engines, deliberately: a LOUD campaign (buzz multipliers) and a CLEAN
     campaign (credibility). Credibility swings conversion from 0.72× to 1.27×,
     which is why MEME BLITZ is a genuine trade rather than free momentum. */
  SG.credFactor = function (st, party) {
    if (party !== 'P') return 1 + 0.1 * (st.difficulty || 1);
    return 0.72 + 0.55 * (clamp(st.cred, 0, 100) / 100);
  };

  /* Region-specific conversion edge (Muffler Man is an urban machine). */
  SG.convFor = function (st, party, def) {
    const m = SG.mods(st, party);
    let v = m.convMul;
    if (m.urbanConv && def.urban >= 0.45) v *= m.urbanConv;
    return v;
  };

  /* ------------------------------------------------------- weekly conversion */
  const CONV = 0.05;
  function convertBuzz(st) {
    SG.REGIONS.forEach((def) => {
      const r = st.regions[def.id];
      PL.forEach((p) => {
        const fit = SG.issueFit(st, p, def);
        const g = CONV * r.buzz[p] * (0.4 + 0.6 * (r.cadre[p] / 100)) * fit * SG.convFor(st, p, def) * SG.credFactor(st, p);
        if (g > 0) addShare(st, def.id, p, g);
      });
      // undecideds slowly pick a side: the two strongest parties absorb OTHERS
      // undecideds drift to whoever leads the region, but only slowly
      const rank = PL.slice().sort((a, b) => r.share[b] - r.share[a]);
      addShare(st, def.id, rank[0], Math.min(0.32, Math.max(0, r.share.O - 10) * 0.03));
    });
  }

  /* ------------------------------------------------------------- end of week */
  SG.endWeek = function (st) {
    if (st.finished) return null;
    const log = [];
    const report = { week: st.week, log, events: [], seatsBefore: SG.seatTotals(st) };

    // 1. telegraphed rival moves land first, so INTEL is actionable
    st.aiPlans.forEach((p) => SG.applyAction(st, p.party, p.actionId, p.regionId, log));

    // 2. your queued week
    st.queue.forEach((q) => SG.applyAction(st, 'P', q.actionId, q.regionId, log));
    st.queue = [];

    // 3. yatra keeps paying, blocks expire
    SG.REGIONS.forEach((def) => {
      const r = st.regions[def.id];
      PL.forEach((p) => {
        if (r.yatra[p] > 0) {
          addBuzz(st, def.id, p, 8);
          r.yatra[p]--;
        }
      });
      if (r.blockedTurns > 0) r.blockedTurns--;
      else r.blocked = null;
      PL.forEach((p) => {
        if (r.fortress[p] > 0) r.fortress[p]--;
      });
    });

    // 4. passive income for everyone
    PL.forEach((p) => {
      const m = SG.mods(st, p);
      if (p === 'P') {
        st.funds += m.fundsIncome;
        st.cadre += m.cadreIncome;
        st.cred += m.credIncome;
        // running a manifesto costs (or earns) something every single week
        st.planks.forEach((id) => {
          const pk = SG.plankById(id);
          if (!pk || !pk.econ) return;
          st.funds += pk.econ.funds || 0;
          st.cred += pk.econ.cred || 0;
          st.cadre += pk.econ.cadre || 0;
          st.heat += pk.econ.heat || 0;
        });
        st.funds = Math.max(0, st.funds);
      } else {
        // rivals bank their income as regional cadre + war chest
        st.rivalFunds = st.rivalFunds || { A: 90, B: 70 };
          st.rivalFunds[p] += 45 + 18 * st.difficulty;
      }
    });

    // 5. Maharaj's doctrine: leading regions harden automatically
    PL.forEach((p) => {
      const m = SG.mods(st, p);
      if (!m.fortressOn) return;
      SG.REGIONS.forEach((def) => {
        const r = st.regions[def.id];
        if (r.share[p] >= m.fortressAt) r.fortress[p] = Math.max(r.fortress[p], 1);
      });
    });

    // 6. votes move
    convertBuzz(st);

    // 7. Didi holds the fort
    const pm = SG.mods(st, 'P');
    if (pm.homeShield) {
      const best = SG.REGIONS.slice().sort((a, b) => st.regions[b.id].share.P - st.regions[a.id].share.P)[0];
      const r = st.regions[best.id];
      if (r.share.P < pm.homeShield) {
        addShare(st, best.id, 'P', pm.homeShield - r.share.P);
        report.events.push({ t: `DIDI holds ${best.name} at ${pm.homeShield}% — "Khela hobe!"`, good: true });
      }
    }

    // 8. buzz cools off
    SG.REGIONS.forEach((def) => PL.forEach((p) => (st.regions[def.id].buzz[p] *= 0.55)));

    // 9. the opposition finally agrees on one thing: you
    if (st.allianceBroken > 0) st.allianceBroken--;
    if (!st.alliance && st.week >= 3) {
      const proj = SG.seatTotals(st);
      if (proj.P >= SG.TOTAL_SEATS * 0.5) {
        st.alliance = true;
        report.events.push({
          t: 'MAHAGATHBANDHAN! Both rival fronts have merged against you. "Desh bachao" press conference at 5 PM.',
          bad: true,
        });
      }
    }

    // 10. bookkeeping + consequences
    st.cred = clamp(st.cred, 0, 100);
    st.heat = clamp(st.heat, 0, 10);
    if (st.heat >= 8) {
      const ec = SG.EC_EVENTS[Math.floor(st.rng() * SG.EC_EVENTS.length)];
      report.events.push({ t: 'ELECTION COMMISSION: ' + ec, bad: true });
      st.heat -= 4;
      st.cred -= 8;
      st.apNextBonus -= 1;
    }
    if (pm.apDrainEvery && st.week % pm.apDrainEvery === 0) {
      st.apNextBonus -= 1;
      report.events.push({ t: 'AWKWARD ALLIANCE: seat-sharing talks ate an action point.', bad: true });
    }

    // 10. Palti Ji's flight risk
    if (st.leaders.P.includes('palti') && st.rng() < 0.12) {
      st.leaders.P = st.leaders.P.filter((x) => x !== 'palti');
      st.leaders.A.push('palti');
      report.events.push({ t: 'PALTI JI HAS DEFECTED to the opposition. "Samay ki maang thi."', bad: true });
    }

    // 11. next week
    st.week++;
    st.ap = Math.max(1, st.apMax + st.apNextBonus);
    st.apNextBonus = 0;
    Object.keys(st.cooldown).forEach((k) => (st.cooldown[k] = Math.max(0, st.cooldown[k] - 1)));
    st.news = SG.HEADLINES[Math.floor(st.rng() * SG.HEADLINES.length)];

    if (st.week > st.maxWeeks) {
      SG.finish(st);
    } else {
      SG.planAI(st);
      st.intel = SG.visibleIntel(st);
      // a dilemma most weeks — the "think" beat between planning turns
      st.dilemma = st.rng() < 0.75 ? SG.DILEMMAS[Math.floor(st.rng() * SG.DILEMMAS.length)] : null;
    }

    report.seatsAfter = SG.seatTotals(st);
    st.weekReport = report;
    return report;
  };

  /* ------------------------------------------------------------- dilemmas */
  SG.resolveDilemma = function (st, optIndex) {
    const d = st.dilemma;
    if (!d) return null;
    const o = d.opts[optIndex];
    const fx = o.fx || {};
    if (fx.cred) st.cred = clamp(st.cred + fx.cred, 0, 100);
    if (fx.heat) st.heat = clamp(st.heat + fx.heat, 0, 10);
    if (fx.funds) st.funds = Math.max(0, st.funds + fx.funds);
    if (fx.cadre) st.cadre = Math.max(0, st.cadre + fx.cadre);
    if (fx.apNext) st.apNextBonus += fx.apNext;
    if (fx.seatTax) st.seatTax = (st.seatTax || 0) + fx.seatTax;
    if (fx.buzzAll) SG.REGIONS.forEach((r) => addBuzz(st, r.id, 'P', fx.buzzAll));
    if (fx.shareAll) SG.REGIONS.forEach((r) => addShare(st, r.id, 'P', fx.shareAll));
    if (fx.urbanShare) SG.REGIONS.filter((r) => r.urban >= 0.55).forEach((r) => addShare(st, r.id, 'P', fx.urbanShare));
    if (fx.stealBuzz)
      SG.REGIONS.forEach((r) => {
        ['A', 'B'].forEach((p) => (st.regions[r.id].buzz[p] = Math.max(0, st.regions[r.id].buzz[p] - fx.stealBuzz * 0.5)));
        addBuzz(st, r.id, 'P', fx.stealBuzz * 0.35);
      });
    if (fx.stealShare) {
      const target = SG.REGIONS.slice().sort((a, b) => b.seats - a.seats)[0];
      addShare(st, target.id, 'P', fx.stealShare);
    }
    if (fx.swingBuzz) {
      // the closest regions get the money
      SG.REGIONS.map((def) => {
        const r = st.regions[def.id];
        const lead = Math.max(r.share.A, r.share.B);
        return { def, gap: Math.abs(lead - r.share.P) };
      })
        .sort((a, b) => a.gap - b.gap)
        .slice(0, 4)
        .forEach((x) => addBuzz(st, x.def.id, 'P', fx.swingBuzz));
    }
    if (fx.regionShare) Object.entries(fx.regionShare).forEach(([rid, v]) => addShare(st, rid, 'P', v));
    st.dilemma = null;
    return o;
  };

  /* -------------------------------------------------------------- projection
     What the board looks like if the week ended right now, including whatever
     you have queued. This is the number players actually plan against. */
  SG.project = function (st) {
    const c = SG.cloneLite(st);
    c.queue.forEach((q) => SG.applyAction(c, 'P', q.actionId, q.regionId, null));
    c.queue = [];
    convertBuzz(c);
    const seats = SG.seatTotals(c);
    const margin = Math.round(clamp(46 - (st.week - 1) * 4.2, 8, 46));
    return { seats, margin };
  };

  SG.cloneLite = function (st) {
    const c = {
      week: st.week,
      maxWeeks: st.maxWeeks,
      difficulty: st.difficulty,
      planks: st.planks.slice(),
      leaders: { P: st.leaders.P.slice(), A: st.leaders.A.slice(), B: st.leaders.B.slice() },
      cred: st.cred,
      heat: st.heat,
      funds: st.funds,
      cadre: st.cadre,
      seatTax: st.seatTax,
      cooldown: { ...st.cooldown },
      queue: st.queue.map((q) => ({ ...q })),
      regions: {},
      rng: st.rng,
    };
    SG.REGIONS.forEach((def) => {
      const r = st.regions[def.id];
      c.regions[def.id] = {
        id: r.id,
        share: { ...r.share },
        buzz: { ...r.buzz },
        cadre: { ...r.cadre },
        fortress: { ...r.fortress },
        yatra: { ...r.yatra },
        blocked: r.blocked,
        blockedTurns: r.blockedTurns,
      };
    });
    return c;
  };

  /* ------------------------------------------------------------------ finish */
  SG.finish = function (st) {
    const seats = SG.seatTotals(st);
    const frac = seats.P / SG.TOTAL_SEATS;
    const ending = SG.ENDINGS.find((e) => frac >= e.min) || SG.ENDINGS[SG.ENDINGS.length - 1];
    const largest = ALL.slice().sort((a, b) => seats[b] - seats[a])[0];
    st.finished = true;
    st.result = {
      seats,
      frac,
      ending,
      majority: seats.P >= SG.MAJORITY,
      largest,
      coalitionPossible: seats.P < SG.MAJORITY && seats.P + seats.O >= SG.MAJORITY && largest === 'P',
      score: Math.round(seats.P * 100 + st.cred * 12 + st.funds * 2 - st.heat * 40),
    };
    return st.result;
  };

  /* --------------------------------------------------------------- coalition
     Hung house: buy support from OTHERS with ministries, money and dignity. */
  SG.coalitionOffers = function (st) {
    const seats = st.result.seats;
    const need = SG.MAJORITY - seats.P;
    return [
      { id: 'ministries', t: `Hand over 4 cabinet ministries`, cost: { cred: 0 }, gives: Math.round(need * 0.6), note: 'Home, Rail, Aviation and one they invent.' },
      { id: 'cash', t: `Open the war chest (₹${Math.max(40, Math.round(need * 3))} cr)`, cost: { funds: Math.max(40, Math.round(need * 3)) }, gives: Math.round(need * 0.75), note: 'Resorts are booked. Buses are ready.' },
      { id: 'deputy', t: `Promise a Deputy PM chair`, cost: { cred: 18 }, gives: need, note: 'The post does not exist. Yet.' },
      { id: 'principle', t: `Refuse to deal — sit in opposition`, cost: {}, gives: 0, note: 'Your workers will tell this story for 20 years.' },
    ];
  };

  SG.applyCoalition = function (st, offer) {
    const r = st.result;
    if (offer.cost.funds && st.funds < offer.cost.funds) return { ok: false, why: 'Not enough funds' };
    if (offer.cost.funds) st.funds -= offer.cost.funds;
    if (offer.cost.cred) st.cred = clamp(st.cred - offer.cost.cred, 0, 100);
    const gained = Math.min(offer.gives, r.seats.O);
    r.seats.O -= gained;
    r.seats.P += gained;
    r.allies = gained;
    r.majority = r.seats.P >= SG.MAJORITY;
    r.frac = r.seats.P / SG.TOTAL_SEATS;
    r.ending = SG.ENDINGS.find((e) => r.frac >= e.min) || SG.ENDINGS[SG.ENDINGS.length - 1];
    r.score = Math.round(r.seats.P * 100 + st.cred * 12 + st.funds * 2 - st.heat * 40);
    r.coalitionDone = offer.id;
    return { ok: true, gained };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
