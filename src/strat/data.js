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
      passive: 'Schemes cost 25% less, and city-leaning regions convert 50% better for you.',
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
    { a: 'muffler', b: 'suit', name: 'DELHI DUO', good: true, text: 'Freebies cost 20% less.' },
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

  if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
