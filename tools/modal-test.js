/* Run: node tools/modal-test.js
   Regression for the modal-briefing finding: with the overlay up, map clicks,
   END WEEK clicks and the ENTER shortcut must all be inert; the CHALO button
   must still work; afterwards everything must work again. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await b.newPage({viewport:{width:1400,height:880}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/user/temp/index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{
    localStorage.clear(); SG.store.data.coached=false;
    SG.G.draft=['chief','chanakya','khata','maharaj']; SG.G.planks=['WELFARE','FAITH'];
    SG.G.st=SG.newGame({leaders:SG.G.draft,planks:SG.G.planks,seed:11}); SG.G.screen='play';
  });
  await p.waitForTimeout(400);
  const box=await p.locator('canvas#game').boundingBox();
  const sc=await p.evaluate(()=>document.getElementById('game').getBoundingClientRect().width/1280);
  const click=async(x,y)=>{await p.mouse.click(box.x+x*sc,box.y+y*sc);await p.waitForTimeout(120);};

  // 1. click a map region THROUGH the overlay → must not select
  const rr=await p.evaluate(()=>{const d=SG.REGIONS.find(r=>r.id==='uttar');const R=SG.ui.regionRect(d);return{x:R.x+R.w/2,y:R.y+R.h/2};});
  await click(rr.x,rr.y);
  const sel1=await p.evaluate(()=>SG.G.sel);
  // 2. click END WEEK through the overlay → week must stay 1
  await click(1033,720);
  const wk1=await p.evaluate(()=>SG.G.st.week+'/'+SG.G.screen);
  // 3. ENTER through the overlay → week must stay 1
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  const wk2=await p.evaluate(()=>SG.G.st.week+'/'+SG.G.screen);
  console.log('through overlay → sel:',sel1,'| after END WEEK click:',wk1,'| after ENTER:',wk2);
  // 4. the CHALO button must dismiss it (centre: W/2, H/2-190+320)
  await click(640, 760 / 2 - 190 + 320);
  const dismissed=await p.evaluate(()=>SG.store.data.coached);
  // 5. now interactions must work
  await click(rr.x,rr.y);
  const sel2=await p.evaluate(()=>SG.G.sel);
  console.log('briefing dismissed:',dismissed,'| region selects after dismiss:',sel2);
  const pass = sel1===null && wk1==='1/play' && wk2==='1/play' && dismissed && sel2==='uttar';
  console.log(pass?'MODAL REGRESSION PASS':'MODAL REGRESSION FAIL');
  console.log(errs.length?'ERRORS: '+errs.join(';'):'no js errors');
  await b.close(); process.exit(pass?0:1);
})();
