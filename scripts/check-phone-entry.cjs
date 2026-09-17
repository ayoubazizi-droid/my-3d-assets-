// Run against the local site: node scripts/check-phone-entry.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/home/liveuser/squashfs-root/resources/js-repl-runtime/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 for(const policy of ['no-user-gesture-required','document-user-activation-required']) {
  const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || '/var/lib/flatpak/app/com.brave.Browser/current/active/files/brave/brave',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader',`--autoplay-policy=${policy}`]});
  try {
   for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    try {
     const page=await context.newPage(),errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.addInitScript(()=>{
      window.phoneEntryEvents=[];
      document.addEventListener('pix3lware:enter-request',()=>window.phoneEntryEvents.push({progress:document.querySelector('.loader-percent')?.textContent,promptHidden:document.querySelector('.loader-enter')?.hidden}));
     });
     await page.goto(process.env.TEST_URL || 'http://localhost:8080/index.html',{waitUntil:'domcontentloaded'});
     // Intentionally send no clicks, taps, or keys.
     await page.waitForFunction(()=>document.querySelector('#site-loader')?.hidden===true,null,{timeout:90000});
     assert.equal(await page.locator('.loader-enter').isVisible(),false);
     assert.deepEqual(await page.evaluate(()=>window.phoneEntryEvents),[{progress:'100%',promptHidden:true}]);
     assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('booting')),false);
     if(policy==='no-user-gesture-required') await page.waitForFunction(()=>window.pix3lwareAudio?.state==='running' && window.pix3lwareAudio.gain>.01,null,{timeout:5000});
     assert.deepEqual(errors,[]);
     console.log(`${viewport.width}x${viewport.height}, ${policy}: zero-input entry at 100%, prompt never revealed, audio=${await page.evaluate(()=>window.pix3lwareAudio?.state)}`);
    } finally {await context.close();}
   }
  } finally {await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
