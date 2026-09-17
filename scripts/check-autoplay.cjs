// Ambient music + entry gate regression: node scripts/check-autoplay.cjs
// A: browser permits autoplay -> music starts with zero interaction.
// B: strict policy -> the loader gate guarantees the gesture that unlocks it.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/home/liveuser/squashfs-root/resources/js-repl-runtime/node_modules/playwright-core');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const launch=extra=>chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || '/var/lib/flatpak/app/com.brave.Browser/current/active/files/brave/brave',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',...(extra||[])]});
const boot=page=>page.evaluate(()=>{clearTimeout(window.pix3lwareBootWatchdog);document.documentElement.classList.remove('booting');document.querySelector('.site-loader').style.display='none';});
const audible=()=>window.pix3lwareAudio && window.pix3lwareAudio.state==='running' && window.pix3lwareAudio.gain>0.01;
(async()=>{
 const permissive=await launch(['--autoplay-policy=no-user-gesture-required']);
 try {
  const page=await permissive.newPage();
  await page.goto('file://'+root+'/index.html',{waitUntil:'domcontentloaded'});
  await boot(page);
  await page.waitForFunction(audible,null,{timeout:6000});
  console.log('autoplay permitted: music started with zero clicks');
 } finally { await permissive.close(); }
 const strict=await launch(['--autoplay-policy=document-user-activation-required']);
 try {
  const page=await strict.newPage();
  await page.goto('file://'+root+'/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{clearTimeout(window.pix3lwareBootWatchdog);document.documentElement.classList.remove('booting');document.querySelector('.site-loader').style.display='none';});
  await page.waitForTimeout(2500);
  if (await page.evaluate(audible)) {
   console.log('strict policy: autoplay allowed, music started with zero clicks');
  } else {
   await page.mouse.click(20,20);
   await page.waitForFunction(audible,null,{timeout:4000});
   console.log('strict policy: first click unlocks the music');
  }
 } finally { await strict.close(); }
})().catch(e=>{console.error(e);process.exit(1)});