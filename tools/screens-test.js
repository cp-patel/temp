/* Guard test (run: node tools/screens-test.js): every screen must render at least one WORKING exit control.
   A screen that draws but registers no clickable target is a dead end. */
const { chromium, launchOpts } = require('./pw');
(async()=>{
  const b=await chromium.launch(launchOpts);
  const p=await b.newPage({viewport:{width:1400,height:880}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html')); await p.waitForTimeout(700);
  await p.evaluate(()=>{SG.store.data.coached=true;});

  // build a mid-campaign state that has a story beat, a dilemma and a report ready
  await p.evaluate(()=>{
    SG.G.draft=['chief','chanakya','khata','maharaj']; SG.G.planks=['FARMERS','JOBS'];
    const st=SG.newGame({leaders:SG.G.draft,planks:SG.G.planks,seed:31337});
    SG.G.st=st;
    for(let i=0;i<4;i++){SG.bots.smart(st);SG.G.report=SG.endWeek(st);if(st.storyBeat&&i<3)SG.resolveStoryBeat(st,0);}
    if(!st.storyBeat){st.arcs={};SG.advanceArcs(st);}
    if(!st.dilemma)st.dilemma=SG.DILEMMAS[0];
    SG.G.reveal={i:0,t:0,tot:{P:200,A:150,B:100,O:93},done:true};
    SG.finish(st);
    st.result.coalitionPossible=true; st.result.majority=false;
  });
  const screens=['title','howto','scenario','draft','planks','play','story','dilemma','resolve','election','coalition','end','diary','awards'];
  let bad=[];
  for(const sc of screens){
    await p.evaluate(x=>{SG.G.screen=x;},sc);
    await p.waitForTimeout(260);
    const r=await p.evaluate(()=>({all:SG.ui.hits.length,live:SG.ui.hits.filter(h=>typeof h.fn==='function').length}));
    console.log(`${sc.padEnd(10)} hit targets ${String(r.all).padStart(3)}  clickable ${String(r.live).padStart(3)}` + (r.live?'':'   ** DEAD END **'));
    if(!r.live) bad.push(sc);
  }
  console.log(bad.length?`\nFAIL: dead-end screens: ${bad.join(', ')}`:'\nOK: every screen has a working exit');
  console.log(errs.length?'ERRORS:\n'+errs.join('\n'):'NO JS ERRORS');
  await b.close();
  process.exit(bad.length?1:0);
})();
