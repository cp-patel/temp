/* CHUNAV CHANAKYA — static content: the board, the cast, actions, events.
   Pure data + tiny helpers, no rendering. Loads in the browser (window.SG)
   and in node (global.SG) so the rules engine can be unit-tested headlessly.

   THE CAST IS PARODY. Every character is an affectionate archetype drawn from
   public political personas and meme culture — the nicknames, the "quotes" and
   the abilities are all invented for this game. Nothing here is a real
   statement by a real person. */
(function (root) {
  'use strict';

  const SG = (root.SG = root.SG || {});

  /* ------------------------------------------------------------------ issues
     A message only lands if it matches what a region cares about. This is the
     core "think before you spend" lever. */
  SG.ISSUES = {
    JOBS: { name: 'JOBS', icon: '💼', blurb: 'Naukri kab milegi?' },
    FARMERS: { name: 'FARMERS', icon: '🌾', blurb: 'MSP aur karza maafi.' },
    FAITH: { name: 'TRADITION', icon: '🛕', blurb: 'Aastha aur asmita.' },
    FREEBIES: { name: 'FREEBIES', icon: '🔌', blurb: 'Bijli-paani-bus free!' },
    BUSINESS: { name: 'BUSINESS', icon: '🏭', blurb: 'Ease of doing dhandha.' },
    WELFARE: { name: 'WELFARE', icon: '🍚', blurb: 'Ration aur pension.' },
    ROADS: { name: 'INFRA', icon: '🛣️', blurb: 'Sadak, pul, flyover.' },
    IDENTITY: { name: 'PRIDE', icon: '🪷', blurb: 'Apni bhasha, apna gaurav.' },
  };

  /* Manifesto planks the player picks two of at setup. */
  SG.PLANKS = [
    { id: 'JOBS', name: 'ROZGAAR GUARANTEE', issue: 'JOBS', econ: {}, blurb: '2 crore jobs. Per year. Trust us.', cost: 'No side effects. Suspiciously clean.' },
    { id: 'FARMERS', name: 'KISAN SAMMAN', issue: 'FARMERS', econ: { funds: -5 }, blurb: 'Direct benefit transfer, direct votes.', cost: '−5 FUNDS a week (transfers are not free).' },
    { id: 'FAITH', name: 'SANSKRITI RAKSHA', issue: 'FAITH', econ: { heat: 0.9 }, blurb: 'Heritage corridors and grand ceremonies.', cost: '+0.9 HEAT a week (it polarises).' },
    { id: 'FREEBIES', name: 'SAB KUCH FREE', issue: 'FREEBIES', econ: { funds: -11 }, blurb: 'Bijli, paani, bus, WiFi. Budget? Later.', cost: '−11 FUNDS a week. The treasury notices.' },
    { id: 'BUSINESS', name: 'MAKE IN BHARAT', issue: 'BUSINESS', econ: { funds: 16, cred: -1.5 }, blurb: 'Ribbon-cutting as a service.', cost: '+16 FUNDS a week from grateful donors, −1.5 CREDIBILITY.' },
    { id: 'WELFARE', name: 'GARIB KALYAN', issue: 'WELFARE', econ: { funds: -8, cred: 1 }, blurb: 'Free ration till the next election.', cost: '−8 FUNDS a week, +1 CREDIBILITY.' },
    { id: 'ROADS', name: 'VIKAS EXPRESSWAY', issue: 'ROADS', econ: { funds: -6, cadre: 4 }, blurb: 'Every speech mentions a flyover.', cost: '−6 FUNDS a week, +4 CADRE (contractors bring crowds).' },
    { id: 'IDENTITY', name: 'ASMITA ABHIYAAN', issue: 'IDENTITY', econ: { cred: 3 }, blurb: 'Regional pride, national ambition.', cost: '+3 CREDIBILITY a week. Cheap and sincere.' },
  ];

  SG.plankById = (id) => SG.PLANKS.find((p) => p.id === id);
  SG.plankSeats = (id) => SG.REGIONS.filter((r) => r.issue === id).reduce((s, r) => s + r.seats, 0);

  /* ----------------------------------------------------------------- regions
     12 fictional regions of "Bharat" — 543 seats, laid out to loosely evoke
     the board. `nb` = neighbours (adjacency drives yatras and ad spillover). */
  SG.REGIONS = [
    { id: 'sarson', name: 'SARSON FIELDS', seats: 27, issue: 'FARMERS', urban: 0.3, bx: 150, by: 97, short: 'SARSON', nb: ['desert', 'mufflerpur', 'uttar'] },
    { id: 'mufflerpur', name: 'MUFFLERPUR NCR', seats: 27, issue: 'FREEBIES', urban: 0.95, bx: 320, by: 86, short: 'MUFFLERPUR', nb: ['sarson', 'uttar', 'desert'] },
    { id: 'uttar', name: 'UTTAR BHARAT', seats: 96, issue: 'FAITH', urban: 0.28, bx: 330, by: 213, short: 'UTTAR BHARAT', nb: ['mufflerpur', 'sarson', 'madhya', 'coal', 'desert'] },
    { id: 'tea', name: 'TEA VALLEY', seats: 27, issue: 'ROADS', urban: 0.2, bx: 640, by: 125, short: 'TEA VALLEY', nb: ['bangla'] },
    { id: 'desert', name: 'DESERT CIRCLE', seats: 30, issue: 'ROADS', urban: 0.32, bx: 105, by: 229, short: 'DESERT', nb: ['sarson', 'mufflerpur', 'uttar', 'madhya', 'chaipur'] },
    { id: 'coal', name: 'COAL BELT', seats: 62, issue: 'JOBS', urban: 0.25, bx: 480, by: 279, short: 'COAL BELT', nb: ['uttar', 'bangla', 'madhya'] },
    { id: 'bangla', name: 'BANGLA BASIN', seats: 48, issue: 'IDENTITY', urban: 0.4, bx: 630, by: 268, short: 'BANGLA', nb: ['coal', 'tea'] },
    { id: 'madhya', name: 'MADHYA BHOOMI', seats: 34, issue: 'FARMERS', urban: 0.3, bx: 300, by: 350, short: 'MADHYA', nb: ['uttar', 'desert', 'coal', 'filmistan', 'chaipur'] },
    { id: 'chaipur', name: 'CHAIPUR', seats: 28, issue: 'BUSINESS', urban: 0.62, bx: 110, by: 350, short: 'CHAIPUR', nb: ['desert', 'madhya', 'filmistan'] },
    { id: 'filmistan', name: 'FILMISTAN', seats: 52, issue: 'BUSINESS', urban: 0.78, bx: 200, by: 460, short: 'FILMISTAN', nb: ['chaipur', 'madhya', 'konkan', 'dosa'] },
    { id: 'dosa', name: 'DOSA DELTA', seats: 72, issue: 'WELFARE', urban: 0.5, bx: 380, by: 548, short: 'DOSA DELTA', nb: ['filmistan', 'konkan', 'ghats'] },
    { id: 'konkan', name: 'COASTAL KONKAN', seats: 40, issue: 'WELFARE', urban: 0.45, bx: 205, by: 581, short: 'KONKAN', nb: ['filmistan', 'dosa', 'ghats'] },
  ];
  // 'ghats' referenced above is folded into dosa/konkan; keep adjacency clean:
  SG.REGIONS.forEach((r) => (r.nb = r.nb.filter((n) => SG.REGIONS.some((z) => z.id === n))));

  SG.TOTAL_SEATS = SG.REGIONS.reduce((s, r) => s + r.seats, 0);
  SG.MAJORITY = Math.floor(SG.TOTAL_SEATS / 2) + 1;

  /* -------------------------------------------------------------- scenarios
     Different openings, same board — each one bends the campaign's shape:
     time pressure, a handicap, or baggage to manage. Balance-tested. */
  SG.SCENARIOS = [
    {
      id: 'classic',
      name: 'GENERAL ELECTION',
      tag: 'the full campaign',
      blurb: '10 weeks, 4 campaigners, a level field. The way democracy intended (roughly).',
      icon: '🗳️',
      mods: {},
    },
    {
      id: 'snap',
      name: 'SNAP ELECTION',
      tag: 'no time to think — think faster',
      blurb: 'The government fell over a Tuesday. 6 weeks to polling day. Buzz you don\'t cash out is buzz you never had.',
      icon: '⚡',
      mods: { weeks: 6, funds: 150, cadre: 62 },
    },
    {
      id: 'underdog',
      name: 'THE UNDERDOG',
      tag: 'three of you against all of them',
      blurb: 'Only 3 campaigners — seven sit opposite. The rivals start ahead everywhere. You start hungrier: 5 AP a week.',
      icon: '🥊',
      mods: { maxLeaders: 3, apMax: 5, funds: 92, rivalHead: 4 },
    },
    {
      id: 'heatwave',
      name: 'ANTI-INCUMBENCY',
      tag: 'you are the government. sorry.',
      blurb: 'Ten years in power: you start ahead, rich — and bleeding. Anti-incumbency erodes your share EVERY week. Hold the dam.',
      icon: '🔥',
      mods: { heat: 5, cred: 38, funds: 145, playerHead: 6, erosion: 0.55 },
    },
  ];
  SG.scenarioById = (id) => SG.SCENARIOS.find((x) => x.id === id) || SG.SCENARIOS[0];

  /* ----------------------------------------------------------------- parties */
  SG.PARTIES = {
    P: { id: 'P', name: 'YOUR FRONT', short: 'YOU', color: '#ff9933' },
    A: { id: 'A', name: 'MAHA VIPAKSH', short: 'OPP', color: '#2f8fe0' },
    B: { id: 'B', name: 'KSHETRIYA MORCHA', short: 'REG', color: '#22b573' },
    O: { id: 'O', name: 'OTHERS & INDEPENDENTS', short: 'OTH', color: '#8a8fa3' },
  };

  /* ------------------------------------------------------------------ leaders
     Each leader is a mechanic: their meme persona IS their ability. */
  SG.LEADERS = [
    {
      id: 'chief',
      nick: 'MITRON JI',
      tag: 'The 56-Inch Orator',
      face: 'chief',
      passive: 'Every rally and roadshow you run generates +10% BUZZ.',
      passiveKey: 'buzzBoost',
      action: {
        id: 'roadshow',
        name: 'MEGA ROADSHOW',
        ap: 1,
        funds: 34,
        icon: '🚌',
        desc: 'Enormous BUZZ here, plus a spillover into every neighbouring region.',
      },
      quips: ['Mitron, aaj ek badi ghoshna karne wala hoon!', '56 inch ka confidence!', 'Yeh desh badal raha hai… aur main bhi.'],
      draft: 'Turns a bus stop into a stadium. Nobody moves a crowd like this.',
    },
    {
      id: 'chanakya',
      nick: 'CHANAKYA JI',
      tag: 'The Booth Machine',
      face: 'chanakya',
      passive: 'All BUZZ→VOTE conversion is 24% more efficient. Numbers, not vibes.',
      passiveKey: 'convBoost',
      action: {
        id: 'booth',
        name: 'BOOTH MANAGEMENT',
        ap: 1,
        funds: 16,
        cadre: 12,
        icon: '📋',
        desc: 'Instantly bank the BUZZ in a region as real vote share, and plant permanent CADRE.',
      },
      quips: ['Booth number 214 mein 38 vote kam hain. Kyon?', 'Maths se jeetenge, mood se nahi.', 'Panna pramukh ready hai.'],
      draft: 'Knows your polling booth better than you know your own street.',
    },
    {
      id: 'yuvraj',
      nick: 'YUVRAJ BHAIYA',
      tag: 'The Yatra Yodha',
      face: 'yuvraj',
      passive: '+12 CADRE every week. The workers genuinely love the walk.',
      passiveKey: 'cadreIncome',
      action: {
        id: 'yatra',
        name: 'JODO YATRA',
        ap: 1,
        funds: 10,
        icon: '🥾',
        desc: 'Walk into a region and its neighbours: steady BUZZ in all of them that keeps paying next week. +CREDIBILITY.',
      },
      quips: ['T-shirt chal rahi hai, chalne do.', 'Kanyakumari se Kashmir, paidal.', 'Sawaal poochhne se darta nahi hoon.'],
      draft: 'Same white tee, 4,000 kilometres. Slow, sincere, surprisingly sticky.',
    },
    {
      id: 'muffler',
      nick: 'MUFFLER MAN',
      tag: 'The Freebie Fakir',
      face: 'muffler',
      passive: 'Schemes cost 25% less, and city-leaning regions convert 65% better for you.',
      passiveKey: 'schemeDiscount',
      action: {
        id: 'bijli',
        name: 'FREE BIJLI-PAANI',
        ap: 1,
        funds: 42,
        icon: '🔌',
        desc: 'Straight vote share in a region, scaled hard by how URBAN it is. Empties the treasury.',
      },
      quips: ['Bijli free, paani free — muffler mera free nahi hai.', 'Main to aam aadmi hoon ji.', 'Dharna kal subah 9 baje.'],
      draft: 'Wins cities with a calculator and a woollen muffler.',
    },
    {
      id: 'maharaj',
      nick: 'MAHARAJ JI',
      tag: 'The 4 AM Monk',
      face: 'maharaj',
      passive: 'Regions you lead (34%+) become FORTRESSES — rivals gain 45% less there. +6 CADRE a week.',
      passiveKey: 'fortress',
      action: {
        id: 'anushasan',
        name: 'ANUSHASAN DRIVE',
        ap: 1,
        funds: 12,
        icon: '⏰',
        desc: 'Discipline: locks a region as a FORTRESS for 3 weeks and hardens your CADRE there.',
      },
      quips: ['Subah 4 baje se kaam shuru.', 'Anushasan sabse pehle.', 'Yahan sab niyam se hoga.'],
      draft: 'Awake before your alarm, and your excuses.',
    },
    {
      id: 'suit',
      nick: 'SUITED SIR',
      tag: 'The Prime-Time Prodigy',
      face: 'suit',
      passive: '+3 CREDIBILITY every week, and rival smear attacks land 50% softer.',
      passiveKey: 'credShield',
      action: {
        id: 'debate',
        name: 'PRIME TIME DEBATE',
        ap: 1,
        funds: 6,
        icon: '📺',
        desc: 'Out-argue the leading rival in a region: steal a chunk of their BUZZ and gain CREDIBILITY. Dirt cheap.',
      },
      quips: ['Point of order, chairperson sir!', 'Slide 4 dekhiye — data yeh kehta hai.', 'Main CA hoon, hisaab samajhta hoon.'],
      draft: 'Young, suited, and armed with a spreadsheet at 9 PM.',
    },
    {
      id: 'didi',
      nick: 'DIDI',
      tag: 'The Street Fighter',
      face: 'didi',
      passive: 'Your best region never drops below 38% share. +8 CADRE a week.',
      passiveKey: 'homeShield',
      action: {
        id: 'khela',
        name: 'KHELA HOBE',
        ap: 1,
        funds: 9,
        icon: '🩴',
        desc: 'Occupy the streets: every rival action aimed at that region next week simply fails.',
      },
      quips: ['Khela hobe!', 'Ekta, ekta, ekta!', 'Amar Bangla — koi chhoo nahi sakta.'],
      draft: 'Chappal in hand, ground held. Denial is a strategy.',
    },
    {
      id: 'thesaurus',
      nick: 'SHABDKOSH SIR',
      tag: 'The Walking Thesaurus',
      face: 'thesaurus',
      passive: '+1 extra INTEL report and +2 CREDIBILITY every week.',
      passiveKey: 'intel',
      action: {
        id: 'vocab',
        name: 'VOCABULARY BOMB',
        ap: 1,
        funds: 11,
        icon: '📖',
        desc: 'A word nobody can spell drops rival BUZZ across a region and its neighbours. +CREDIBILITY.',
      },
      quips: [
        'This campaign is an exercise in floccinaucinihilipilification.',
        'Kindly consult a lexicon before responding.',
        'My prose is not the problem; your patience is.',
      ],
      draft: 'Rivals need a dictionary to know whether they were insulted.',
    },
    {
      id: 'palti',
      nick: 'PALTI JI',
      tag: 'The Alliance Acrobat',
      face: 'palti',
      passive: '+18 FUNDS every week from "friends". Also: 12% chance per week he defects.',
      passiveKey: 'fundsFriends',
      action: {
        id: 'flip',
        name: 'ALLIANCE FLIP',
        ap: 1,
        funds: 22,
        icon: '🔄',
        desc: 'Peel 6% vote share straight off the regional leader — and it can FRACTURE the opposition alliance. Adds HEAT.',
      },
      quips: ['Samay ki maang hai, gathbandhan badal raha hai.', 'Main sirf vikas ke saath hoon.', 'Kal ki baat kal dekhenge.'],
      draft: 'Brings seats, sunshine, and a permanent flight risk.',
    },
    {
      id: 'khata',
      nick: 'BAHI-KHATA MADAM',
      tag: 'The Ledger Lady',
      face: 'khata',
      passive: '+30 FUNDS every week. Somebody has to balance this circus.',
      passiveKey: 'fundsIncome',
      action: {
        id: 'budget',
        name: 'BUDGET BONANZA',
        ap: 0,
        funds: 0,
        icon: '📒',
        desc: 'FREE ACTION (no AP): a nudge in every RURAL region plus a cash injection. Once every 3 weeks.',
        cooldown: 3,
      },
      quips: ['Bahi-khata nikalo.', 'Rajkoshiya ghata control mein hai.', 'Ek naya… scheme. Cess nahi, scheme.'],
      draft: 'The only person in the room who has read the numbers.',
    },
  ];

  SG.leaderById = (id) => SG.LEADERS.find((l) => l.id === id);

  /* --------------------------------------------------------------- synergies
     Draft tension: some pairs sing, some pairs bicker. Both are funny. */
  SG.SYNERGIES = [
    { a: 'chief', b: 'chanakya', name: 'JODI No. 1', good: true, text: 'Conversion +15% on top of everything.' },
    { a: 'chief', b: 'maharaj', name: 'DOUBLE ENGINE', good: true, text: 'Fortresses trigger at 30% instead of 38%.' },
    { a: 'muffler', b: 'suit', name: 'DELHI DUO', good: true, text: 'Freebies cost 30% less, +2 CREDIBILITY a week.' },
    { a: 'thesaurus', b: 'suit', name: 'PRIME TIME PANEL', good: true, text: 'Debates also chip 1.5% share off the rival.' },
    { a: 'didi', b: 'palti', name: 'REGIONAL FRONT', good: true, text: '+20 FUNDS a week from state units.' },
    { a: 'chanakya', b: 'palti', name: 'OPERATION MATHEMATICS', good: true, text: 'Alliance Flip is 60% stronger (+1 HEAT).' },
    { a: 'yuvraj', b: 'thesaurus', name: 'ERUDITE YATRA', good: true, text: '+5 CREDIBILITY a week, but −4% BUZZ everywhere.' },
    { a: 'yuvraj', b: 'muffler', name: 'AWKWARD ALLIANCE', good: false, text: 'Seat-sharing talks eat 1 AP every third week.' },
    { a: 'chief', b: 'yuvraj', name: 'IMPOSSIBLE GATHBANDHAN', good: false, text: 'Historic. Chaotic. −9 CREDIBILITY a week.' },
    { a: 'didi', b: 'chief', name: 'COLD WAR', good: false, text: 'They refuse to share a stage: −22% BUZZ on everything.' },
  ];

  SG.synergiesFor = (ids) =>
    SG.SYNERGIES.filter((s) => ids.includes(s.a) && ids.includes(s.b));

  /* ------------------------------------------------------- generic actions
     Available to everyone, every week. The bread and butter of a campaign. */
  SG.GENERIC = [
    { id: 'rally', name: 'PUBLIC RALLY', ap: 1, funds: 14, icon: '🎤', desc: 'Solid BUZZ in one region. The workhorse.' },
    { id: 'ground', name: 'GROUND PUSH', ap: 1, funds: 7, cadre: 8, icon: '👣', desc: 'Convert the BUZZ you already have into locked-in vote share.' },
    { id: 'ads', name: 'AD BLITZ', ap: 1, funds: 20, icon: '📻', desc: 'Moderate BUZZ here and a little in every neighbour.' },
    { id: 'meme', name: 'MEME BLITZ', ap: 1, funds: 4, icon: '📱', desc: 'Cheapest BUZZ in the game. +HEAT, −CREDIBILITY. Everyone does it, nobody admits it.' },
    { id: 'scheme', name: 'ANNOUNCE SCHEME', ap: 1, funds: 22, icon: '📜', desc: 'Permanent share bump — huge if it matches your manifesto AND the region.' },
    { id: 'fund', name: 'DONOR CHAI MEET', ap: 1, funds: -45, icon: '💰', desc: 'Raise FUNDS instead of spending them. Slight CREDIBILITY cost.' },
    { id: 'org', name: 'ORG MEETING', ap: 1, funds: 5, icon: '🧩', desc: 'Build CADRE nationally and repair CREDIBILITY. The boring turn that wins weeks 8–10.' },
  ];

  SG.actionById = function (id) {
    const g = SG.GENERIC.find((a) => a.id === id);
    if (g) return g;
    const l = SG.LEADERS.find((x) => x.action.id === id);
    return l ? l.action : null;
  };

  /* -------------------------------------------------------------- headlines
     Pure flavour, one per week in the ticker. */
  SG.HEADLINES = [
    'Anchor breaks own record: 41 minutes of shouting without inhaling.',
    'Party spokesperson storms off panel, returns during ad break for chai.',
    'Rival announces a scheme so large the printer refused to print it.',
    'Exit poll agency now offers "any result you like" packages.',
    'WhatsApp uncle forwards a 2014 photo as breaking news. 40k shares.',
    'Local MLA promises a flyover to a village with no road.',
    'Two parties accidentally book the same ground. Joint rally happens.',
    'Manifesto found to contain 11 fonts and one actual number.',
    'Poll pundit predicts landslide, adds "but anything can happen".',
    'Rally attendee interviewed on 6 channels, becomes a national expert.',
    'Freebie war escalates: someone has promised free biryani on Sundays.',
    'Drone footage of crowd revealed to be footage of a different crowd.',
    'Candidate garlanded with such a heavy mala he sat down mid-speech.',
    'Journalist asks a real question. Studio audio "develops a fault".',
    'IT cell of every party trending the same hashtag against each other.',
    'Astrologer on prime time gives seat count to the decimal point.',
    'Independent candidate campaigns entirely from a chai tapri. Leads locally.',
    'Both fronts claim the same crowd photo. Photographer confused.',
    'Sting video released. It is 4 seconds long and mostly a ceiling fan.',
    'Party releases campaign song. It is the last one with new lyrics.',
  ];

  /* --------------------------------------------------------------- dilemmas
     Weekly strategic choice. Real trade-offs, silly framing. */
  SG.DILEMMAS = [
    {
      q: 'A clip of your worker dancing at a very solemn event goes viral.',
      opts: [
        { t: 'Apologise immediately', fx: { cred: 8, buzzAll: -8 }, note: 'Boring. Effective.' },
        { t: 'Claim the video is AI-generated', fx: { heat: 2, cred: -4 }, note: 'Nobody believes it. Buzz survives.' },
        { t: 'Make it an official dance trend', fx: { buzzAll: 16, cred: -8, heat: 1 }, note: 'Chaos. Glorious chaos.' },
      ],
    },
    {
      q: 'A 9 PM anchor demands you appear "or the nation will assume the worst".',
      opts: [
        { t: 'Send your sharpest debater', fx: { cred: 10, stealBuzz: 18 }, note: 'Clips of it run for 3 days.' },
        { t: 'Send an empty chair', fx: { buzzAll: 12, cred: -6, heat: 1 }, note: 'The chair trends. Somehow.' },
        { t: 'Boycott all channels this week', fx: { apNext: 1, cred: 3 }, note: 'Saves energy for the ground.' },
      ],
    },
    {
      q: 'An ally demands 40 seats in the COAL BELT or they walk.',
      opts: [
        { t: 'Give them the seats', fx: { regionShare: { coal: 5 }, seatTax: 6 }, note: 'Share up there, seats shared everywhere.' },
        { t: 'Refuse flatly', fx: { cadre: -18, cred: 6 }, note: 'They sulk. Workers hear about it.' },
        { t: 'Offer a Rajya Sabha seat instead', fx: { funds: -40, cred: 4 }, note: 'The oldest trick, still works.' },
      ],
    },
    {
      q: 'Your manifesto leaks a week early. Every promise is public.',
      opts: [
        { t: 'Own it — "transparency!"', fx: { buzzAll: 14, cred: 4 }, note: 'Bold. Confident. Free coverage.' },
        { t: 'Blame the printer', fx: { heat: 2 }, note: 'The printer gives an interview.' },
        { t: 'Rewrite it with bigger numbers', fx: { funds: -45, shareAll: 1.2 }, note: 'Two crore becomes four crore.' },
      ],
    },
    {
      q: 'A rival promises free scooters. Cities are listening.',
      opts: [
        { t: 'Promise free EVs, obviously', fx: { funds: -50, urbanShare: 2.4 }, note: 'Escalation is a policy.' },
        { t: 'Call it revdi culture', fx: { cred: 12, urbanShare: -1.2 }, note: 'Editorials love you. Cities do not.' },
        { t: 'Ignore it entirely', fx: {}, note: 'Silence. Occasionally underrated.' },
      ],
    },
    {
      q: 'A sitting rival MP offers to defect to you. Tonight.',
      opts: [
        { t: 'Welcome him with a garland', fx: { stealShare: 3.5, cred: -10, heat: 1 }, note: 'Camera-ready. Principles-light.' },
        { t: 'Politely decline', fx: { cred: 14 }, note: 'Your workers stand a little taller.' },
        { t: 'Leak the offer to the media', fx: { buzzAll: 18, heat: 2, cred: -4 }, note: 'His party spends 3 days on damage control.' },
      ],
    },
    {
      q: 'Unseasonal rain is about to wash out your mega rally.',
      opts: [
        { t: 'Speak in the rain anyway', fx: { buzzAll: 18, cred: 8, funds: -18 }, note: 'The photo runs on every front page.' },
        { t: 'Postpone, recover the money', fx: { funds: 25 }, note: 'Sensible. Forgettable.' },
        { t: 'Blame the weather department', fx: { heat: 2, buzzAll: 6 }, note: 'The Met Office issues a rebuttal.' },
      ],
    },
    {
      q: 'A leaked internal survey says you are 40 seats short.',
      opts: [
        { t: 'Attack the pollsters', fx: { heat: 2, buzzAll: 8 }, note: 'Pollster becomes a martyr on TV.' },
        { t: 'Dump funds into swing regions', fx: { swingBuzz: 26, funds: -30 }, note: 'Cold, correct, unglamorous.' },
        { t: 'Announce one enormous scheme', fx: { funds: -60, shareAll: 1.8, heat: 1 }, note: 'The treasury weeps.' },
      ],
    },
    {
      q: 'Your IT cell posts a meme from the OFFICIAL handle. It is not subtle.',
      opts: [
        { t: 'Delete and deny', fx: { heat: 2, cred: -4 }, note: 'Screenshots exist. They always exist.' },
        { t: '"We were hacked"', fx: { heat: 3 }, note: 'Nobody is hacking your intern.' },
        { t: 'Own the joke, post another', fx: { buzzAll: 20, cred: -6 }, note: 'Followers +200k. Elders horrified.' },
      ],
    },
    {
      q: 'Election Commission notice: your loudspeakers were 40dB over the limit.',
      opts: [
        { t: 'Comply immediately', fx: { heat: -3, buzzAll: -10 }, note: 'Quiet rallies. Clean record.' },
        { t: 'Ignore the notice', fx: { heat: 3, buzzAll: 6 }, note: 'Louder. Riskier.' },
        { t: 'Fight it in court', fx: { funds: -35, heat: -2, cred: 4 }, note: 'Lawyers bill by the decibel.' },
      ],
    },
    {
      q: 'A superstar wants to campaign for you — for a "small" fee.',
      opts: [
        { t: 'Pay the fee', fx: { funds: -55, urbanShare: 2.2, buzzAll: 14 }, note: 'Cities scream. Ledger screams louder.' },
        { t: 'Ask for a free tweet', fx: { buzzAll: 8 }, note: 'He tweets. Misspells your party name.' },
        { t: 'Decline; use local artists', fx: { cadre: 16, cred: 6 }, note: 'Cheaper, warmer, slower.' },
      ],
    },
    {
      q: 'Rival releases a 90-second video of your old promises, side by side.',
      opts: [
        { t: 'Release one about theirs', fx: { stealBuzz: 22, heat: 1 }, note: 'Mutually assured embarrassment.' },
        { t: 'Answer with a delivery report', fx: { cred: 12, shareAll: 0.6 }, note: 'A chart. An actual chart.' },
        { t: 'Say the video is "out of context"', fx: { cred: -6, heat: 1 }, note: 'The full context is worse.' },
      ],
    },
  ];


  /* ================================================================= STORY
     Multi-week arcs. Each beat triggers off the ACTUAL state of your campaign
     (your heat, your credibility, who you drafted, who is leading), and choices
     set flags that change later beats. Scripted chains dovetailing with
     emergent state is what makes a campaign feel like *your* story.

     trigger(st) → may this arc start now?
     beats[].q may be a function(st) so the prose can name your own people. */
  SG.ARCS = [
    {
      id: 'tape',
      name: 'THE TAPE',
      trigger: (st) => st.heat >= 4.5,
      beats: [
        {
          q: 'A grainy 40-second clip of your war room is on every channel. In it, someone says the words "manage the booth".',
          opts: [
            { t: '"Deepfake. Obviously."', flag: 'denied', fx: { heat: 2, cred: -5 }, note: 'The clip trends for three days instead of one.' },
            { t: 'Admit it, blame an over-eager volunteer', flag: 'blamed', fx: { cred: 6, buzzAll: -8 }, note: 'A 22-year-old is now nationally famous.' },
            { t: 'Release the FULL tape yourself, unedited', flag: 'released', fx: { cred: 12, buzzAll: 14, funds: -30 }, note: 'Astonishing. Nobody does this. It works.' },
          ],
        },
        {
          wait: 2,
          q: (st, f) =>
            f.denied
              ? 'The second half of the tape has leaked. Your voice is clearly on it, saying the quiet part loudly.'
              : f.released
              ? 'Your full-tape gamble has made you a folk hero. A rival front is now demanding YOUR opponents release theirs.'
              : 'The volunteer you blamed has given a tearful interview. He is very likeable.',
          opts: [
            { t: 'Go on prime time and take every question', flag: 'faced', fx: { cred: 14, buzzAll: 10 }, note: 'Four hours. No water break. Respect.' },
            { t: 'Send a spokesperson to shout over everyone', flag: 'shouted', fx: { heat: 1.5, buzzAll: 16, cred: -6 }, note: 'Ratings gold. Dignity, less so.' },
            { t: 'Say nothing and campaign twice as hard', flag: 'ignored', fx: { swingBuzz: 22 }, note: 'The story dies of boredom. Mostly.' },
          ],
        },
        {
          wait: 2,
          q: (st, f) =>
            f.faced || f.released
              ? 'The tape story has fully inverted: a channel is running "THE HONEST CAMPAIGN" as a prime-time special about you.'
              : 'The Election Commission has "sought a clarification" about the tape. The letter is two pages long and entirely questions.',
          opts: [
            { t: 'Reply in writing, page for page', fx: { cred: 10, heat: -3 }, note: 'Boring. Correct. Ends it.' },
            { t: 'Turn the letter into a campaign poster', fx: { buzzAll: 20, heat: 2, cred: -4 }, note: 'The poster is genuinely funny. The EC is not laughing.' },
            { t: 'Ignore it; there are nine days left', fx: { heat: 1, swingBuzz: 18 }, note: 'A calculated risk, calculated on a napkin.' },
          ],
        },
      ],
    },
    {
      id: 'defector',
      name: 'THE MIDNIGHT PHONE CALL',
      trigger: (st) => st.week >= 2 && (st.leaders.P.includes('palti') || st.cred < 45),
      beats: [
        {
          q: 'A sitting rival MP calls at 11:40 PM. He is "deeply concerned about the direction of his party" and also about a Rajya Sabha seat.',
          opts: [
            { t: 'Send a car immediately', flag: 'took', fx: { stealShare: 3, cred: -8, heat: 1 }, note: 'The car is a white Fortuner. It is always a white Fortuner.' },
            { t: 'Ask him to resign publicly first', flag: 'principled', fx: { cred: 10 }, note: 'He hangs up. Your workers hear about it and stand taller.' },
            { t: 'Record the call', flag: 'recorded', fx: { heat: 2, buzzAll: 12 }, note: 'You now own a small, radioactive asset.' },
          ],
        },
        {
          wait: 2,
          q: (st, f) =>
            f.took
              ? 'Your new MP wants a rally in his own district — and a photo with your biggest name.'
              : f.recorded
              ? 'The recording is burning a hole in your pocket. A journalist has heard it exists.'
              : 'The MP you turned away has stayed put, and is now attacking you by name every evening.',
          opts: [
            { t: 'Give him the rally and the photo', fx: { regionShare: { coal: 4 }, funds: -25 }, note: 'The photo is used against you for a decade.' },
            { t: 'Leak everything to the press', fx: { stealBuzz: 26, heat: 2, cred: -5 }, note: 'His party spends four days on damage control.' },
            { t: 'Do nothing. Let it sit.', fx: { cred: 6, cadre: 12 }, note: 'Restraint. Unfashionable, occasionally lethal.' },
          ],
        },
        {
          wait: 2,
          q: 'Three more MPs from the same district want in. Their combined baggage would fill the Fortuner.',
          opts: [
            { t: 'Take all three', fx: { shareAll: 0.9, cred: -12, heat: 2 }, note: 'Numbers now. Headlines later.' },
            { t: 'Take the cleanest one', fx: { stealShare: 2, cred: 2 }, note: 'A judgement call, made in a corridor.' },
            { t: 'Take none and say so loudly', fx: { cred: 16, buzzAll: 8 }, note: 'Editorials use the word "refreshing".' },
          ],
        },
      ],
    },
    {
      id: 'star',
      name: 'THE BENCHED STAR',
      // fires when a drafted leader has gone unused — the story notices your habits
      trigger: (st) => st.week >= 3 && SG.idleLeader(st) !== null,
      beats: [
        {
          q: (st) => {
            const L = SG.leaderById(SG.idleLeader(st) || st.leaders.P[0]);
            return `${L.nick} has not been given a single assignment. He has started giving interviews about "internal democracy".`;
          },
          opts: [
            { t: 'Give him the next big rally', flag: 'appeased', fx: { cadre: 20, cred: 5 }, note: 'He is insufferable about it. He is also very good.' },
            { t: 'Tell him to wait his turn', flag: 'benched', fx: { cred: -6, funds: 20 }, note: 'He waits. Loudly.' },
            { t: 'Put him in charge of the manifesto', flag: 'promoted', fx: { cred: 8, buzzAll: -6 }, note: 'It is now 94 pages long.' },
          ],
        },
        {
          wait: 3,
          q: (st, f) =>
            f.benched
              ? 'Your benched star has been photographed having tea with the opposition. Just tea, he says. Excellent tea.'
              : 'Your once-benched star has become the campaign\'s breakout act. Crowds are asking for him by name.',
          opts: [
            { t: 'Make him the face of the final week', fx: { buzzAll: 22, cred: 4 }, note: 'The posters are reprinted overnight.' },
            { t: 'Keep him close and quiet', fx: { cadre: 18, cred: 6 }, note: 'A stable, unglamorous, winning choice.' },
            { t: 'Let him go and wish him well', fx: { cred: -10, funds: 45 }, note: 'His seat, his problem. Your money, your gain.' },
          ],
        },
      ],
    },
    {
      id: 'merger',
      name: 'THE MERGER',
      trigger: (st) => !!st.alliance,
      beats: [
        {
          q: 'Both rival fronts have merged against you. Their joint press conference has nine leaders, one microphone and no agreed candidate.',
          opts: [
            { t: 'Welcome it: "one against many"', flag: 'framed', fx: { buzzAll: 18, cred: 6 }, note: 'It is a genuinely strong frame. Use it everywhere.' },
            { t: 'Attack the arithmetic of their seat-sharing', flag: 'arithmetic', fx: { stealBuzz: 24, heat: 1 }, note: 'Two of their allies start briefing against each other.' },
            { t: 'Ignore them and flood the swing regions', flag: 'flooded', fx: { swingBuzz: 30, funds: -35 }, note: 'Unromantic. Effective.' },
          ],
        },
        {
          wait: 2,
          q: (st, f) =>
            f.arithmetic
              ? 'Their seat-sharing talks have collapsed in a five-star lobby. Two allies are contesting the same seats.'
              : 'The merged front has announced a joint rally of unprecedented size. The stage alone cost more than your week.',
          opts: [
            { t: 'Hold a bigger rally 2 km away', fx: { buzzAll: 20, funds: -55 }, note: 'Traffic in that city has still not recovered.' },
            { t: 'Release a 90-second ad about their contradictions', fx: { stealBuzz: 28, cred: 4 }, note: 'It is 90 seconds of them insulting each other. You added nothing.' },
            { t: 'Go door to door in the 20 closest seats', fx: { swingBuzz: 26, cadre: -14 }, note: 'No cameras. Just arithmetic.' },
          ],
        },
      ],
    },
    {
      id: 'march',
      name: 'THE LONG MARCH',
      trigger: (st) => st.week >= 4 && (st.planks.includes('FARMERS') || st.planks.includes('JOBS')),
      beats: [
        {
          q: 'Forty thousand people are walking towards the capital with a list of demands and an alarming amount of food.',
          opts: [
            { t: 'Meet them personally at the edge of the city', flag: 'met', fx: { cred: 14, buzzAll: 12, funds: -20 }, note: 'The photograph of you sitting on the road runs everywhere.' },
            { t: 'Send a committee', flag: 'committee', fx: { cred: -4, heat: 1 }, note: 'The committee will report after the election. Obviously.' },
            { t: 'Announce their headline demand outright', flag: 'conceded', fx: { shareAll: 1.4, funds: -60 }, note: 'The treasury makes a small, wounded noise.' },
          ],
        },
        {
          wait: 2,
          q: (st, f) =>
            f.met
              ? 'The march has turned into a festival that keeps mentioning your name. Somebody is selling t-shirts with your face on them.'
              : 'The march has camped outside the capital for two weeks and become the only story on television.',
          opts: [
            { t: 'Walk the last 3 km with them', fx: { buzzAll: 24, cred: 10, funds: -15 }, note: 'Your shoes are ruined. Your week is made.' },
            { t: 'Offer a written guarantee, signed', fx: { shareAll: 1.2, cred: 8, funds: -45 }, note: 'A signature is cheaper than a scheme and lands almost as hard.' },
            { t: 'Let it run its course', fx: { heat: 1, funds: 25 }, note: 'It runs its course. Straight through your rural numbers.' },
          ],
        },
      ],
    },
  ];

  /* Which drafted leader has been most ignored? Used by THE BENCHED STAR so the
     narrative reacts to how you have actually been playing. */
  SG.idleLeader = function (st) {
    const u = st.usage || {};
    const idle = st.leaders.P.filter((id) => !u[id]);
    if (!idle.length) return null;
    return idle[0];
  };

  /* Weekly jab from whichever rival is doing best. Pure flavour, real needle. */
  SG.TAUNTS = [
    'They have a manifesto. We have a photocopier and a dream.',
    'Our friends opposite have promised 2 crore jobs. We have counted 14.',
    'This is not an election, it is a rerun. We have seen the ending.',
    'He talks of development. Ask him where. Ask him when. Ask him for the file.',
    'The people are not fooled. The people are simply not consulted.',
    'They have booked 400 helicopters. We have booked 400 buses. Guess who lands where.',
    'Every week a new scheme. Every scheme a new hoarding. Every hoarding a new bill.',
    'We welcome their star campaigner. He has been very effective — for us.',
    'Their arithmetic is beautiful. Their geography is imaginary.',
    'They call it momentum. In our language it is called a press release.',
  ];

  SG.MASTHEADS = ['THE DAILY BHARAT', 'RASHTRA TIMES', 'THE MORNING CHAI', 'JANTA EXPRESS'];

  /* Front-page headline chosen from what actually happened this week. */
  SG.frontPage = function (st, rep) {
    const d = rep.delta;
    if (rep.events.some((e) => /MAHAGATHBANDHAN/.test(e.t))) return 'THEY HAVE JOINED HANDS AGAINST HIM';
    if (rep.events.some((e) => /ELECTION COMMISSION/.test(e.t))) return 'NOTICE SERVED: COMMISSION STEPS IN';
    if (rep.events.some((e) => /DEFECTED/.test(e.t))) return 'HE HAS SWITCHED SIDES. AGAIN.';
    if (rep.events.some((e) => /fractured/i.test(e.t))) return 'ALLIANCE CRACKS OPEN IN PUBLIC';
    if (d >= 18) return 'SURGE: THE GROUND HAS SHIFTED';
    if (d >= 8) return 'STEADY GAINS AS RIVALS SQUABBLE';
    if (d >= 1) return 'A QUIET WEEK OF SMALL MERCIES';
    if (d > -8) return 'CAMPAIGN STALLS, WORKERS RESTLESS';
    return 'SLIDE CONTINUES: PANIC IN WAR ROOM';
  };

  /* ------------------------------------------------------------- EC penalties */
  SG.EC_EVENTS = [
    'MODEL CODE BREACH: your convoy handed out pressure cookers. AP cut, credibility hit.',
    'EC NOTICE: your ad claimed a bridge that does not exist yet. Campaign paused a day.',
    'EC RAP: paid trends traced to your office. Fine paid, dignity not recovered.',
  ];

  /* -------------------------------------------------------------- endings */
  SG.ENDINGS = [
    { min: 0.62, title: 'PRACHAND BAHUMAT', text: 'A landslide. Analysts who predicted otherwise now praise your "ground connect".' },
    { min: 0.5, title: 'SPASHT BAHUMAT', text: 'Clean majority. You govern without a single 2 AM phone call to an ally.' },
    { min: 0.44, title: 'GATHBANDHAN SARKAR', text: 'You made it — with help. Three allies, four ministries, one permanent headache.' },
    { min: 0.34, title: 'SINGLE LARGEST PARTY', text: 'Biggest, not enough. You watch someone else take oath on live TV.' },
    { min: 0.2, title: 'MAIN OPPOSITION', text: 'A respectable defeat. Prime time now invites you to explain everyone else.' },
    { min: 0, title: 'DEPOSIT FORFEITED', text: 'Historic. Statisticians will study this. Your workers have already left.' },
  ];

  /* --------------------------------------------------------- achievements
     Designed as a ladder, not a checklist: a wide bronze rung almost every
     first campaign earns, silver rungs that each teach one mechanic the
     efficient line skips, and golds that need a whole draft or several runs.

     `ok(st, r, meta)` is pure — st is the finished state, r the result, and
     meta carries the cross-run counters kept in localStorage. That purity is
     what lets tools/achievements-test.js measure how often each one fires. */
  const badPairs = (ids) => SG.SYNERGIES.filter((s) => !s.good && ids.includes(s.a) && ids.includes(s.b));

  SG.ACHIEVEMENTS = [
    {
      id: 'numbers_hain',
      name: 'NUMBERS HAIN HUMARE PAAS',
      tier: 'bronze',
      blurb: 'Short of 272, long on friends. Somewhere a resort is fully booked and nobody remembers whose idea it was.',
      hint: 'Form a government from a hung house.',
      ok: (st, r) => r.majority && ['ministries', 'cash', 'deputy'].includes(r.coalitionDone),
    },
    {
      id: 'pehle_saakh',
      name: 'PEHLE SAAKH',
      tier: 'bronze',
      blurb: 'Nobody has ever cheered for an ORG MEETING. The arithmetic cheers.',
      hint: 'Reach 100 CREDIBILITY by the end of week 4, then finish as the largest bloc.',
      ok: (st, r) => st.credHit100Week > 0 && st.credHit100Week <= 4 && r.largest === 'P',
    },
    {
      id: 'aakhri_push',
      name: 'AAKHRI PUSH',
      tier: 'bronze',
      blurb: 'The last rally is a photograph. The last ground push is a seat. Six weeks in, only one of those gets counted.',
      hint: 'SNAP ELECTION: spend the whole final week banking buzz, and finish largest.',
      ok: (st, r) => st.scenario === 'snap' && st.finalWeekBanked && r.largest === 'P',
    },
    {
      id: 'saare_paanch',
      name: 'SAARE PAANCH',
      tier: 'bronze',
      blurb: 'Five action points a week is the entire apology for being outnumbered seven to three. Spend the apology.',
      hint: 'THE UNDERDOG: never end a week with an unspent action point, and finish largest.',
      ok: (st, r) => st.scenario === 'underdog' && (st.maxApWasted || 0) === 0 && r.largest === 'P',
    },
    {
      id: 'koi_bench_nahi',
      name: 'KOI BENCH PAR NAHI',
      tier: 'bronze',
      blurb: 'Every campaigner sent out at least twice, and not one of them gave a single interview about internal democracy.',
      hint: 'Win with every leader on your final roster used at least twice.',
      ok: (st, r) => r.majority && st.leaders.P.length > 0 && st.leaders.P.every((id) => ((st.usage || {})[id] || 0) >= 2),
    },
    {
      id: 'apne_dum_par',
      name: 'APNE DUM PAR',
      tier: 'silver',
      blurb: '272 on your own. Not one 2 AM phone call, not one ministry promised to a man you have met twice.',
      hint: 'Win an outright majority — no coalition.',
      ok: (st, r) => !!r.outright,
    },
    {
      id: 'vipaksh_mein',
      name: 'VIPAKSH MEIN BAITHENGE',
      tier: 'silver',
      blurb: 'Fourteen short. Four offers on the table, including a Deputy PM chair for a post that does not exist yet. You went home instead.',
      hint: 'Come within 20 seats of power in a hung house — and refuse to deal.',
      ok: (st, r) => r.coalitionPossible && r.coalitionDone === 'principle' && SG.MAJORITY - r.seats.P <= 20,
    },
    {
      id: 'saaf_suthra',
      name: 'SAAF-SUTHRA ABHIYAAN',
      tier: 'silver',
      blurb: 'No meme cell, no midnight scheme, no cousin with a printing press. Your file at the Commission is one thank-you note.',
      hint: 'Form a government having never let HEAT rise above zero.',
      ok: (st, r) => (st.maxHeat || 0) === 0 && r.majority,
    },
    {
      id: 'poori_tape',
      name: 'POORI TAPE CHALAO',
      tier: 'silver',
      blurb: 'They ran forty seconds of your war room, so you released the other thirty-nine minutes. Then took every question.',
      hint: 'THE TAPE: release the full tape, face the questions, and still win outright.',
      ok: (st, r) => {
        const f = (st.arcFlags || {}).tape || {};
        return !!f.released && !!f.faced && !!r.outright;
      },
    },
    {
      id: 'sadak_par_baithe',
      name: 'SADAK PAR BAITHE',
      tier: 'silver',
      blurb: 'Two planks, both about work. Forty thousand people walked to the capital, and you went and sat down on the road with them.',
      hint: 'Run a FARMERS + JOBS manifesto, meet THE LONG MARCH, and win outright.',
      ok: (st, r) =>
        st.planks.length === 2 &&
        st.planks.includes('FARMERS') &&
        st.planks.includes('JOBS') &&
        !!((st.arcFlags || {}).march || {}).met &&
        !!r.outright,
    },
    {
      id: 'dam_holds',
      name: 'THE DAM HOLDS',
      tier: 'silver',
      blurb: 'Ten years in office and not one region worse off than the day you called the election. Suspicious. Impressive.',
      hint: 'ANTI-INCUMBENCY: end with your share in all twelve regions at or above week 1.',
      ok: (st) =>
        st.scenario === 'heatwave' &&
        !!st.startShareByRegion &&
        SG.REGIONS.every((def) => st.regions[def.id].share.P >= (st.startShareByRegion[def.id] || 0) - 0.001),
    },
    {
      id: 'gathbandhan_toot',
      name: 'GATHBANDHAN TOOT GAYA',
      tier: 'gold',
      blurb: 'Nine leaders, one microphone, no agreed candidate — and one acrobat in your camp who has all nine phone numbers.',
      hint: 'Fracture a mahagathbandhan with ALLIANCE FLIP, then win outright anyway.',
      ok: (st, r) => !!st.everFractured && !!r.outright,
    },
    {
      id: 'cold_war_cabinet',
      name: 'COLD WAR CABINET',
      tier: 'gold',
      blurb: 'They refuse to share a stage. Fine — you will run two campaigns, pay for both, and win anyway.',
      hint: 'Win outright with a cast carrying one of the three clashing pairs.',
      ok: (st, r) => badPairs(st.leaders.P).length > 0 && !!r.outright,
    },
    {
      id: 'har_haal_sarkar',
      name: 'HAR HAAL MEIN SARKAR',
      tier: 'gold',
      blurb: 'Ten weeks, six weeks, outnumbered three to seven, or ten years of anti-incumbency. Same chair at the end of all four.',
      hint: 'Form a government in all four scenarios (across campaigns).',
      crossRun: true,
      ok: (st, r, meta) => {
        const won = new Set(meta.scenariosWon || []);
        if (r.majority) won.add(st.scenario);
        return SG.SCENARIOS.every((s) => won.has(s.id));
      },
    },
  ];

  SG.achievementById = (id) => SG.ACHIEVEMENTS.find((a) => a.id === id);

  /* Which achievements does this finished campaign earn? Pure: hand it the
     cross-run counters and it tells you, without touching storage. */
  SG.checkAchievements = function (st, result, meta) {
    result = result || st.result;
    meta = meta || {};
    if (!result) return [];
    return SG.ACHIEVEMENTS.filter((a) => {
      try {
        return !!a.ok(st, result, meta);
      } catch (e) {
        return false;
      }
    }).map((a) => a.id);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
