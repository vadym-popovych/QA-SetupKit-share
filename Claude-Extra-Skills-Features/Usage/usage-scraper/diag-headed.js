const { chromium } = require('playwright');
(async () => {
  const ctx = await chromium.launchPersistentContext(__dirname+'/profile', {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 950 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://claude.ai/settings/usage', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(e=>console.log('goto:',e.message.split('\n')[0]));
  await page.waitForTimeout(13000); // let Cloudflare verify + SPA render
  console.log('URL:', page.url());
  const t = await page.evaluate(()=>document.body.innerText);
  const cf = /security verification|malicious bots|Cloudflare/i.test(t);
  console.log('Cloudflare wall:', cf);
  console.log('--- innerText (first 1500) ---'); console.log(t.slice(0,1500));
  await page.screenshot({ path: '/tmp/usage-headed.png' });
  await ctx.close();
})();
