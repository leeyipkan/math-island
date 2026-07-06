import { chromium } from 'playwright';

const URL = 'https://leeyipkan.github.io/math-island/';
const results = [];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 480, height: 850 } });
  const page = await ctx.newPage();

  // Clear localStorage
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // ── HELPER ──
  async function playIsland(islandIndex, levelCount, playFn) {
    results.push(`\n=== Island ${islandIndex + 1} ===`);
    for (let lv = 0; lv < levelCount; lv++) {
      // Click the island card on map
      const islands = await page.$$('.island:not(.locked)');
      if (islands.length <= islandIndex) {
        results.push(`  Level ${lv+1}: ❌ FAIL - island ${islandIndex} not available (only ${islands.length} unlocked)`);
        return;
      }
      await islands[islandIndex].click();
      await sleep(800);
      await page.waitForSelector('#gameLevel', { timeout: 3000 });

      const levelTitle = await page.textContent('#gameLevel');
      
      // Click the back button if the game-done overlay is showing from previous run
      const doneBtn = await page.$('.game-done-btn');
      if (doneBtn && await doneBtn.isVisible()) {
        await doneBtn.click();
        await sleep(300);
        // Re-click island
        const isls2 = await page.$$('.island:not(.locked)');
        if (isls2.length > islandIndex) {
          await isls2[islandIndex].click();
          await sleep(800);
        }
      }

      // Play the level
      let success = false;
      try {
        success = await playFn(page, lv);
      } catch (e) {
        results.push(`  Level ${lv+1} (${levelTitle}): ❌ ERROR - ${e.message}`);
        continue;
      }

      results.push(`  Level ${lv+1} (${levelTitle}): ${success ? '✅' : '❌'}`);

      // Wait for game-done overlay and click back
      try {
        await page.waitForSelector('.game-done-btn', { timeout: 5000 });
        await sleep(200);
        await page.click('.game-done-btn');
        await sleep(500);
      } catch (e) {
        results.push(`  ↳ ⚠️ No game-done overlay appeared`);
        // Try clicking back
        const backBtn = await page.$('.game-back');
        if (backBtn) await backBtn.click();
        await sleep(500);
      }
    }
  }

  // ── ISLAND 1: COUNTING GAMES ──
  function makeCountPlayFn() {
    return async (page, lv) => {
      await sleep(300);
      const ans = await page.evaluate(() => window._countAns);
      if (ans === undefined || ans === null) {
        // Try to read from button's onclick attribute
        const btns = await page.$$('.count-btn');
        for (const btn of btns) {
          const onclick = await btn.getAttribute('onclick');
          if (!onclick) continue;
          const parts = onclick.match(/checkCount\((\d+),(\d+)/);
          if (parts && parseInt(parts[1]) === parseInt(parts[2])) {
            await btn.click();
            return true;
          }
        }
        return false;
      }
      const btns = await page.$$('.count-btn');
      for (const btn of btns) {
        const text = await btn.textContent();
        if (parseInt(text.trim()) === ans) {
          await btn.click();
          return true;
        }
      }
      return false;
    };
  }

  function makeSequencePlayFn() {
    return async (page) => {
      await sleep(300);
      const ans = await page.evaluate(() => window._seqAns);
      const btns = await page.$$('.count-btn');
      for (const btn of btns) {
        const text = await btn.textContent();
        if (parseInt(text.trim()) === ans) {
          await btn.click();
          return true;
        }
      }
      return false;
    };
  }

  function makeOddEvenPlayFn() {
    return async (page) => {
      await sleep(400);
      const btns = await page.$$('.count-btn');
      for (const btn of btns) {
        const disabled = await btn.isDisabled();
        if (disabled) continue;
        const text = await btn.textContent();
        const num = parseInt(text.trim());
        const targets = await page.evaluate(() => window._oeTargets || []);
        if (targets.includes(num)) {
          await btn.click();
          await sleep(100);
        }
      }
      await sleep(500);
      const doneBtn = await page.$('.game-done-btn');
      return doneBtn && await doneBtn.isVisible();
    };
  }

  function makeDecomposePlayFn() {
    return async (page) => {
      await sleep(300);
      const ans = await page.evaluate(() => window._decAns || []);
      const btns = await page.$$('.count-btn');
      for (const btn of btns) {
        const disabled = await btn.isDisabled();
        if (disabled) continue;
        const text = await btn.textContent();
        const num = parseInt(text.trim());
        if (ans.includes(num)) {
          await btn.click();
          await sleep(100);
        }
      }
      await sleep(500);
      const doneBtn = await page.$('.game-done-btn');
      return doneBtn && await doneBtn.isVisible();
    };
  }

  // ── ISLAND 2: FISHING ──
  function makeFishPlayFn() {
    return async (page) => {
      await sleep(500);
      const ans = await page.evaluate(() => window._fishAns);
      const fishLabels = await page.$$('.fish-label');
      for (const label of fishLabels) {
        const text = await label.textContent();
        if (parseInt(text.trim()) === ans) {
          const fish = await label.$('xpath=..');
          // Click the parent .fish element
          const parent = await label.evaluateHandle(el => el.closest('.fish'));
          if (parent.asElement()) {
            await parent.asElement().click();
            return true;
          }
        }
      }
      return false;
    };
  }

  // ── ISLAND 3: SHOP ──
  function makeCoinIDPlayFn() {
    return async (page) => {
      await sleep(400);
      const qText = await page.textContent('.count-question');
      const match = qText.match(/邊個係 (.+?)？/);
      if (!match) return false;
      const correctLabel = match[1];
      const btns = await page.$$('.shop-coin');
      for (const btn of btns) {
        const onclick = await btn.getAttribute('onclick');
        if (onclick && onclick.includes("'" + correctLabel + "'")) {
          await btn.click();
          return true;
        }
      }
      return false;
    };
  }

  function makePayPlayFn() {
    return async (page) => {
      await sleep(400);
      const target = await page.evaluate(() => window._payTarget);
      const coinEls = await page.$$('.shop-coin:not(.used)');
      let total = 0;
      for (const el of coinEls) {
        const val = parseInt(await el.getAttribute('data-val'));
        if (total + val <= target) {
          await el.click();
          total += val;
          await sleep(100);
        }
        if (total === target) break;
      }
      await sleep(200);
      const payBtn = await page.$('#payBtn');
      if (payBtn) {
        const isDisabled = await payBtn.isDisabled();
        if (!isDisabled) {
          await payBtn.click();
          return true;
        }
      }
      return false;
    };
  }

  // ── RUN ALL ISLANDS ──
  // Island 1: 數字海灘 (8 levels: 3 count, 2 sequence, 2 oddeven, 1 decompose)
  await playIsland(0, 8, async (page, lv) => {
    if (lv < 3) return makeCountPlayFn()(page, lv);
    if (lv < 5) return makeSequencePlayFn()(page);
    if (lv < 7) return makeOddEvenPlayFn()(page);
    return makeDecomposePlayFn()(page);
  });

  const s1 = await page.evaluate(() => state.stickers.length);
  results.push(`  → Stickers after Island 1: ${s1}/24`);

  // Island 2: 釣魚樂園 (8 levels: all addSub)
  await playIsland(1, 8, makeFishPlayFn());
  const s2 = await page.evaluate(() => state.stickers.length);
  results.push(`  → Stickers after Island 2: ${s2}/24`);

  // Island 3: 購物小鎮 (8 levels: 1 coinID, 7 pay)
  await playIsland(2, 8, async (page, lv) => {
    if (lv === 0) return makeCoinIDPlayFn()(page);
    return makePayPlayFn()(page);
  });
  const s3 = await page.evaluate(() => state.stickers.length);
  results.push(`  → Stickers after Island 3: ${s3}/24`);

  // ── FINAL VERIFICATION ──
  results.push(`\n═══ FINAL RESULTS ═══`);
  results.push(`Total stickers: ${s3}/24 ${s3 === 24 ? '✅ ALL UNLOCKED!' : '❌ MISSING ' + (24-s3)}`);
  
  // Check sticker book
  await page.evaluate(() => toggleStickers());
  await sleep(500);
  const filledSlots = await page.$$('.sticker-slot.filled');
  const totalSlots = await page.$$('.sticker-slot');
  results.push(`Sticker book: ${filledSlots.length}/${totalSlots.length} filled`);
  
  // Check all islands status
  const progress = await page.evaluate(() => state.progress);
  results.push(`Progress: ${JSON.stringify(progress)}`);
  
  await browser.close();

  // Print report
  console.log('='.repeat(50));
  console.log('  數 學 探 險 島 — Full E2E Test Report');
  console.log('='.repeat(50));
  results.forEach(r => console.log(r));
  console.log('='.repeat(50));
}

run().catch(e => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
