// Run against the static site with the optional Playwright development runtime.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_URL || 'http://127.0.0.1:8765';
const out = process.env.TEST_OUTPUT || path.resolve('test-output/customer-tour-motion');
fs.mkdirSync(out, { recursive:true });

(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({viewport:{width,height:800}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(width => {
        if (width === 320 || width === 390) {
          window.syntheticHidden = width === 390;
          Object.defineProperty(document, 'hidden', {configurable:true,get:() => window.syntheticHidden});
        }
        window.tourSequence = [];
        new MutationObserver(records => records.forEach(record => {
          for (const node of record.removedNodes) if (node.classList?.contains('brand-intro')) window.tourSequence.push('brand-end');
          for (const node of record.addedNodes) {
            if (node.classList?.contains('brand-intro')) window.tourSequence.push('brand-start');
            if (node.classList?.contains('client-tour-layer')) {
              window.tourSequence.push('tour-start');
              window.tourStartedWhileProgressRuns = document.getElementById('levelProgress')?.getAnimations().some(animation => animation.playState === 'running');
            }
          }
        })).observe(document, {childList:true,subtree:true});
      }, width);
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) return route.fulfill({body:'',contentType:'text/javascript'});
        if (url.pathname === '/api/customer/session') return route.fulfill({json:{ok:true,data:{accessToken:'fixture',customer:{publicId:'C-TOUR'}}}});
        if (url.pathname === '/api/backend') return route.fulfill({json:{ok:true,data:{ok:true,client:{id:'C-TOUR',name:'Ana',pointsTotal:120,pointsAvailable:80,currentStreak:3,progressLevelPct:60,shopItems:[],recentHistory:[]}}}});
        if (url.pathname === '/api/customer/onboarding') return route.fulfill({json:{ok:true,data:{progress:null}}});
        if (url.pathname.startsWith('/api/')) return route.fulfill({json:{ok:true,data:{products:[],orders:[],flavors:[],ranking:[]}}});
        return route.continue();
      });
      await page.goto(base+'?profile=1&id=C-TOUR');
      await page.locator('#userEnterBtn').click();
      if (width === 320) {
        await page.locator('.brand-intro').waitFor();
        await page.evaluate(() => { window.syntheticHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(1200); // Longer than the entrance, to prove it pauses while hidden.
        assert.equal(await page.locator('.brand-intro').count(),1,'entrance pauses when the tab is hidden');
        assert.equal(await page.locator('.client-tour-layer').count(),0,'tutorial stays behind the paused entrance');
        await page.evaluate(() => { window.syntheticHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      }
      if (width === 390) {
        await page.waitForFunction(() => document.getElementById('userLoginStatus').textContent === 'Acceso confirmado');
        await page.waitForTimeout(480); // The login confirmation has a 450 ms duration.
        assert.equal(await page.locator('.brand-intro,.client-tour-layer').count(),0,'hidden tab waits before showing either entrance');
        await page.evaluate(() => { window.syntheticHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      }
      await page.locator('.client-tour-layer.is-welcome').waitFor();
      const sequence = await page.evaluate(() => window.tourSequence);
      assert(sequence.indexOf('brand-start') !== -1, 'the brand entrance runs');
      assert(sequence.indexOf('brand-end') < sequence.indexOf('tour-start'), 'tutorial waits until brand entrance ends');
      assert.equal(await page.evaluate(() => window.tourStartedWhileProgressRuns), false, 'tutorial waits for profile motion');
      const card = page.locator('.client-tour-card');
      const box = await card.boundingBox();
      assert(box.x >= 0 && box.x+box.width <= width, 'tour card stays inside viewport');
      assert((await card.evaluate(el => getComputedStyle(el).backgroundColor)).includes('0.72'), 'card remains translucent');
      await page.screenshot({path:path.join(out, `welcome-${width}.png`)});
      await page.getByRole('button', {name:'Conocer mi perfil'}).click();
      assert.equal(await page.locator('.client-tour-count').textContent(),'Paso 1 de 8');
      await page.screenshot({path:path.join(out, `step-1-${width}.png`)});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.client-tour-layer').count(),0);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS customer tour waits for brand and profile motion; glass card fits mobile and desktop');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
