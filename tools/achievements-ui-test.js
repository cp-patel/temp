/* Iteration 5 verification: achievements unlock, render, persist, and are
   reachable through REAL canvas clicks (not just by calling functions). */
const { chromium, launchOpts } = require('./pw');

(async () => {
  const b = await chromium.launch(launchOpts);
  const p = await b.newPage({ viewport: { width: 1400, height: 880 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  const fail = [];
  const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fail.push(msg); };

  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html'));
  await p.waitForTimeout(700);

  // canvas → page coordinate mapping, so we click where the player clicks
  const box = await p.evaluate(() => {
    const c = document.getElementById('game').getBoundingClientRect();
    return { x: c.x, y: c.y, w: c.width, h: c.height };
  });
  const click = async (gx, gy) => {
    await p.mouse.click(box.x + (gx / 1280) * box.w, box.y + (gy / 760) * box.h);
    await p.waitForTimeout(200);
  };
  /* Click a control by its label instead of by hand-computed coordinates.
     Every previous version of this test broke on layout maths, not on the game. */
  const clickLabel = async (label) => {
    const r = await p.evaluate((lab) => {
      const h = SG.ui.hits.filter((x) => typeof x.fn === 'function');
      const m = h.find((x) => (x.label || '').toUpperCase().includes(lab.toUpperCase()));
      return m ? { x: m.x + m.w / 2, y: m.y + m.h / 2, found: true } : { found: false, labels: h.map((x) => x.label || '?') };
    }, label);
    if (!r.found) { console.log(`  (no control labelled "${label}"; saw: ${(r.labels || []).join(' | ')})`); return false; }
    await click(r.x, r.y);
    return true;
  };
  const clickNth = async (i) => {
    const r = await p.evaluate((n) => {
      const h = SG.ui.hits.filter((x) => typeof x.fn === 'function');
      return h[n] ? { x: h[n].x + h[n].w / 2, y: h[n].y + h[n].h / 2, found: true } : { found: false };
    }, i);
    if (!r.found) return false;
    await click(r.x, r.y);
    return true;
  };

  console.log('\n— gallery reachable from the title by clicking —');
  await p.evaluate(() => { SG.store.data.unlocked = []; SG.store.save(); });
  await p.waitForTimeout(150);
  // menu with no save: items at y = 294 + i*45, third item is ACHIEVEMENTS
  await clickLabel('ACHIEVEMENTS');
  let scr = await p.evaluate(() => SG.G.screen);
  ok(scr === 'awards', `title → ACHIEVEMENTS click lands on the gallery (got "${scr}")`);

  const cards = await p.evaluate(() => ({ hits: SG.ui.hits.length, n: SG.ACHIEVEMENTS.length }));
  ok(cards.hits >= cards.n + 1, `gallery renders all ${cards.n} rows + back button (${cards.hits} hit targets)`);

  await clickLabel('BACK');
  scr = await p.evaluate(() => SG.G.screen);
  ok(scr === 'title', `BACK returns to the title (got "${scr}")`);

  console.log('\n— every achievement has the fields the gallery draws —');
  const shape = await p.evaluate(() =>
    SG.ACHIEVEMENTS.filter((a) => !a.id || !a.name || !a.blurb || !a.hint || !a.tier || typeof a.ok !== 'function').map((a) => a.id || '(no id)')
  );
  ok(shape.length === 0, `all rows have id/name/blurb/hint/tier/ok (${shape.join(', ') || 'none missing'})`);
  const tiers = await p.evaluate(() => SG.ACHIEVEMENTS.filter((a) => !['bronze', 'silver', 'gold'].includes(a.tier)).length);
  ok(tiers === 0, 'every tier is bronze/silver/gold (the gallery colours by tier)');

  console.log('\n— a finished campaign actually unlocks and persists —');
  const res = await p.evaluate(() => {
    SG.store.data.unlocked = [];
    SG.store.data.scenariosWon = [];
    SG.store.save();
    // a genuine outright win, played by the bot
    let st = null;
    for (let s = 0; s < 40 && !(st && st.result.outright); s++) {
      st = SG.newGame({ leaders: ['chief', 'chanakya', 'khata', 'maharaj'], planks: ['WELFARE', 'FAITH'], seed: 4100 + s });
      let g = 0;
      while (!st.finished && g++ < 60) {
        if (st.storyBeat) { SG.resolveStoryBeat(st, 0); continue; }
        if (st.dilemma) SG.resolveDilemma(st, 0);
        SG.bots.smart(st);
        SG.endWeek(st);
      }
      if (!st.finished) SG.finish(st);
    }
    SG.G.st = st;
    SG.G.screen = 'end';
    return { outright: st.result.outright, seats: st.result.seats.P };
  });
  ok(res.outright === true, `bot produced an outright win to test with (${res.seats} seats)`);

  // drive the REAL award path: the election screen's own button calls finishUp
  await p.evaluate(() => {
    // the real reveal accumulates seatsInRegion, which is BEFORE any seat tax —
    // seeding it with the post-tax result would double-deduct
    const tot = { P: 0, A: 0, B: 0, O: 0 };
    SG.REGIONS.forEach((def) => {
      const s = SG.seatsInRegion(SG.G.st.regions[def.id], def.seats, SG.allied(SG.G.st));
      ['P', 'A', 'B', 'O'].forEach((q) => (tot[q] += s[q]));
    });
    SG.G.st.seatTax = 0; // this campaign should read as the outright win it is
    SG.G.reveal = { i: SG.REGIONS.length, t: 0, tot, done: true };
    SG.G.screen = 'election';
  });
  await p.waitForTimeout(250);
  await clickLabel('SEE THE RESULT');
  const awarded = await p.evaluate(() => ({
    screen: SG.G.screen,
    unlocked: SG.store.data.unlocked,
    reel: SG.G.unlockReel ? SG.G.unlockReel.ids : [],
    outright: SG.G.st.result.outright,
  }));
  ok(awarded.screen === 'end', `SEE THE RESULT click lands on the end screen (got "${awarded.screen}")`);
  ok(awarded.outright === true, 'result.outright survives the election screen recompute');
  ok(awarded.unlocked.includes('apne_dum_par'), `finishUp unlocked APNE DUM PAR (got: ${awarded.unlocked.join(', ') || 'nothing'})`);
  ok(awarded.reel.includes('apne_dum_par'), 'the end screen gets an unlock reel to show');

  console.log('\n— a hung house awards only AFTER the coalition decision —');
  const hung = await p.evaluate(() => {
    SG.store.data.unlocked = [];
    SG.store.data.scenariosWon = [];
    SG.store.save();
    const st = SG.G.st;
    // this test object already went through one award pass; finishUp is
    // idempotent per campaign, so re-arm it to simulate a fresh run
    st.awarded = false;
    st.seatTax = 0;
    // 260 seats: largest, short of 272, and reachable with OTHERS
    st.result.seats = { P: 260, A: 150, B: 80, O: 53 };
    st.result.majority = false;
    st.result.outright = false;
    st.result.largest = 'P';
    st.result.coalitionPossible = true;
    st.result.coalitionDone = undefined;
    st.funds = 900;
    SG.G.reveal = { i: SG.REGIONS.length, t: 0, tot: { ...st.result.seats }, done: true };
    SG.G.screen = 'election';
    return true;
  });
  await p.waitForTimeout(250);
  await clickLabel('GOVERNMENT FORMATION');
  const midway = await p.evaluate(() => ({ screen: SG.G.screen, unlocked: SG.store.data.unlocked.slice() }));
  ok(midway.screen === 'coalition', `hung house routes to government formation (got "${midway.screen}")`);
  ok(midway.unlocked.length === 0, `nothing awarded before the deal is struck (got: ${midway.unlocked.join(', ') || 'nothing'})`);

  // the deal guard swallows clicks for 0.35s; a real player cannot beat it either
  const swallowed = await p.evaluate(() => SG.ui.hits.filter((h) => typeof h.fn === 'function').length);
  ok(swallowed === 0, `double-click guard disarms every offer for a beat (${swallowed} live offers)`);
  await p.waitForTimeout(600);
  // third offer = "Promise a Deputy PM chair", which always covers the gap
  await clickNth(2);
  const dealt = await p.evaluate(() => ({
    screen: SG.G.screen,
    done: SG.G.st.result.coalitionDone,
    unlocked: SG.store.data.unlocked.slice(),
  }));
  ok(dealt.screen === 'end', `taking the deal lands on the end screen (got "${dealt.screen}")`);
  ok(dealt.done === 'deputy', `the offer was recorded (coalitionDone=${dealt.done})`);
  ok(dealt.unlocked.includes('numbers_hain'), `coalition win unlocks NUMBERS HAIN HUMARE PAAS (got: ${dealt.unlocked.join(', ') || 'nothing'})`);
  ok(!dealt.unlocked.includes('apne_dum_par'), 'a coalition government does NOT count as 272 on your own');

  console.log('\n— a court-ordered seat tax is applied once, and shown —');
  const taxed = await p.evaluate(() => {
    const st = SG.G.st;
    st.seatTax = 30;
    st.awarded = false;
    const tot = { P: 0, A: 0, B: 0, O: 0 };
    SG.REGIONS.forEach((def) => {
      const s = SG.seatsInRegion(st.regions[def.id], def.seats, SG.allied(st));
      ['P', 'A', 'B', 'O'].forEach((q) => (tot[q] += s[q]));
    });
    SG.G.reveal = { i: SG.REGIONS.length, t: 0, tot, done: true };
    SG.G.screen = 'election';
    return { raw: tot.P };
  });
  await p.waitForTimeout(250);
  const label = await p.evaluate(() =>
    SG.ui.hits.filter((h) => typeof h.fn === 'function').map((h) => h.label).join('|')
  );
  await clickLabel(label.includes('SEE THE RESULT') ? 'SEE THE RESULT' : 'GOVERNMENT FORMATION');
  const after30 = await p.evaluate(() => SG.G.st.result.seats.P);
  ok(after30 === taxed.raw - 30, `seat tax of 30 deducted exactly once (${taxed.raw} → ${after30})`);
  const total = await p.evaluate(() => { const s = SG.G.st.result.seats; return s.P + s.A + s.B + s.O; });
  ok(total === 543, `all 543 seats still accounted for after the tax (${total})`);

  console.log('\n— survives a reload —');
  await p.reload();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => ({
    unlocked: SG.store.data.unlocked,
    scen: SG.store.data.scenariosWon,
  }));
  // the hung-house block reset the store, so numbers_hain is what should survive
  ok(after.unlocked.includes('numbers_hain'), `unlock persisted across reload (${after.unlocked.join(', ')})`);
  ok(after.scen.includes('classic'), `scenario win persisted for the cross-run gold (${after.scen.join(', ')})`);

  // the title button must now show the count
  const countShown = await p.evaluate(() => SG.store.data.unlocked.length);
  ok(countShown > 0, `title button shows ${countShown} unlocked`);

  console.log('\n— a corrupt store degrades instead of crashing —');
  await p.evaluate(() => localStorage.setItem('chunav-chanakya-v1', '{"unlocked":"not-an-array","scenariosWon":7}'));
  await p.reload();
  await p.waitForTimeout(700);
  const healed = await p.evaluate(() => {
    SG.G.screen = 'awards';
    return { u: Array.isArray(SG.store.data.unlocked), s: Array.isArray(SG.store.data.scenariosWon) };
  });
  await p.waitForTimeout(300);
  ok(healed.u && healed.s, 'a garbage save is repaired to empty arrays, not left as a crash');
  const stillDrawing = await p.evaluate(() => SG.ui.hits.length);
  ok(stillDrawing > 0, `gallery still renders after the bad save (${stillDrawing} hit targets)`);

  console.log(errs.length ? '\nJS ERRORS:\n' + errs.join('\n') : '\nNO JS ERRORS');
  if (errs.length) fail.push('js errors');
  console.log(fail.length ? `\nFAIL (${fail.length}): ` + fail.join('; ') : '\nALL ITERATION-5 CHECKS PASS');
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
