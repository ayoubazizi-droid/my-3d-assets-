// Footer layout regression: node scripts/check-contact.cjs
// Uses the same browser setup as check-keyboard.cjs; skips unrelated intro playback.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/home/liveuser/squashfs-root/resources/js-repl-runtime/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || '/var/lib/flatpak/app/com.brave.Browser/current/active/files/brave/brave',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page=await browser.newPage();
  await page.goto('file://'+root+'/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
   clearTimeout(window.pix3lwareBootWatchdog);
   document.documentElement.classList.remove('booting');
   document.querySelector('.site-loader').style.display='none';
  });
  for(const width of [1440,390,320]) {
   await page.setViewportSize({width,height:1000});
   for(const mode of ['motion-ready','motion-off']) {
    await page.evaluate(mode=>{
     document.documentElement.classList.remove('motion-ready','motion-off');
     document.documentElement.classList.add(mode);
     window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
    },mode);
    await page.waitForTimeout(500);
    const layout=await page.evaluate(()=>{
     const footer=document.querySelector('#contact');
     const logo=footer.querySelector('.logo').getBoundingClientRect();
     const copyright=footer.querySelector('.copyright').getBoundingClientRect();
     const icons=[...footer.querySelectorAll('.contact-icon')].map(a=>{
      const r=a.getBoundingClientRect(),li=a.parentElement;
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,label:a.getAttribute('aria-label'),opacity:getComputedStyle(li).opacity,transform:getComputedStyle(li).transform};
     });
     return {icons,logoTop:logo.top,logoRight:logo.right,copyrightTop:copyright.top,viewport:innerWidth};
    });
    assert.equal(layout.icons.length,5);
    for(const icon of layout.icons) {
     assert.ok(icon.label,'accessible link name');
     assert.ok(icon.width>=44 && icon.height>=44,'touch target');
     assert.ok(icon.left>=0 && icon.right<=layout.viewport,'icon stays within viewport');
     assert.ok(icon.bottom<layout.logoTop && icon.bottom<layout.copyrightTop,'icon above branding');
     assert.equal(icon.opacity,'1');
     assert.equal(icon.transform,'none');
    }
    for(let i=1;i<layout.icons.length;i++) {
     const a=layout.icons[i-1],b=layout.icons[i];
     assert.ok(b.top>=a.bottom || b.left>=a.right,'icons do not overlap');
    }
    assert.ok(Math.abs(Math.max(...layout.icons.map(i=>i.right))-layout.logoRight)<2,'right alignment');
    const first=page.locator('.contact-icon').first();
    await first.focus();
    assert.equal(await first.evaluate(a=>getComputedStyle(a).outlineStyle),'solid');
    console.log(`${width}px ${mode}: five visible, non-overlapping, accessible links above branding`);
   }
   await page.locator('#contact').screenshot({path:`/tmp/contact-${width}.png`});
  }
  assert.ok(!fs.readFileSync(root+'/motion.js','utf8').includes(".eyebrow, .foot-links li"),'links excluded from scroll reveal');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
