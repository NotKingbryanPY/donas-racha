// Uses the optional Playwright development runtime; no production dependencies.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const out=process.env.TEST_OUTPUT || path.resolve('test-output/profile-motion');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await page.clock.install({time:new Date('2026-09-26T12:00:00Z')});
  await page.clock.pauseAt(new Date('2026-09-26T12:00:01Z'));
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'deviceMemory',{value:8});
    Object.defineProperty(navigator,'connection',{value:{saveData:false,effectiveType:'4g'}});
    // Freeze the real production entrance for deterministic visual checkpoints.
    new MutationObserver(()=>{
      const intro=document.querySelector('.brand-intro');
      if(intro && !window.introAnimations){window.introAnimations=intro.getAnimations({subtree:true});window.introAnimations.forEach(a=>a.pause());}
    }).observe(document,{childList:true,subtree:true});
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8765');
  assert.equal(await page.locator('.brand-intro').count(),0,'no intro on page load');
  await page.evaluate(()=>{window.DonasMotion.customerWelcome({signal:new AbortController().signal,reveal:()=>{window.profileRevealed=true;}});});
  assert.equal(await page.locator('.brand-intro').count(),1);
  const snapshots=[];
  for(const ms of [200,375,650,950]){
    await page.evaluate(ms=>window.introAnimations.forEach(a=>a.currentTime=ms),ms);
    snapshots.push(await page.evaluate(()=>({
      donutX:document.querySelector('.intro-donut').getBoundingClientRect().x,
      wordOpacity:Number(getComputedStyle(document.querySelector('.brand-intro .brand-wordmark')).opacity),
      curtainY:document.querySelector('.brand-intro').getBoundingClientRect().y
    })));
    await page.screenshot({path:path.join(out,`intro-${ms}.png`)});
  }
  assert(snapshots[1].donutX < snapshots[0].donutX,'donut rolls left');
  assert.equal(snapshots[0].wordOpacity,0,'wordmark waits for the reveal');
  assert(snapshots[2].wordOpacity>0,'wordmark reveals after 500ms');
  assert(snapshots[3].curtainY<0,'curtain lifts after 800ms');
  await page.reload();
  assert.equal(await page.locator('.brand-intro').count(),0,'reload never triggers the customer login entrance');
  await context.close();
  for(const lite of ['reduce','saveData']){
    const c=await browser.newContext({reducedMotion:lite==='reduce'?'reduce':'no-preference'});
    const p=await c.newPage();
    if(lite==='saveData')await p.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,effectiveType:'4g'}}));
    await p.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await p.goto(process.env.TEST_URL || 'http://127.0.0.1:8765');
    await p.evaluate(()=>{window.DonasMotion.customerWelcome({signal:new AbortController().signal,reveal:()=>{window.profileRevealed=true;}});});
    assert.equal(await p.evaluate(()=>window.profileRevealed),true);
    assert.equal(await p.locator('.brand-intro').count(),0,`${lite} skips entrance`);
    await c.close();
  }
  console.log('PASS: four entrance stages, no page-load replay, reduced motion and data saver');
} finally { await browser.close(); }
