const { chromium } = require('playwright');
(async () => {
  const ctx = await chromium.launchPersistentContext(__dirname+'/profile', {
    headless: true, channel: 'chrome', viewport: { width: 1280, height: 950 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  for (const u of ['https://claude.ai/settings/usage','https://claude.ai/']) {
    try { await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 25000 }); }
    catch(e){ console.log('goto',u,'->',e.message.split('\n')[0]); continue; }
    await page.waitForTimeout(6000);
    console.log('URL:', page.url());
    const t = await page.evaluate(()=>document.body.innerText);
    console.log('--- innerText (first 1000) ---'); console.log(t.slice(0,1000));
    await page.screenshot({ path: '/tmp/usage-'+(u.includes('usage')?'usage':'root')+'.png' });
    console.log('=== shot saved ===\n');
  }
  await ctx.close();
})();
