// End-to-end entry check against the real local site: node scripts/check-gate.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/home/liveuser/squashfs-root/resources/js-repl-runtime/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || '/var/lib/flatpak/app/com.brave.Browser/current/active/files/brave/brave',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=document-user-activation-required','--enable-unsafe-swiftshader']});
 try {
  for(const reducedMotion of ['reduce','no-preference']) for(const gesture of ['click','key']) {
   const context=await browser.newContext({reducedMotion});
   const page=await context.newPage(), errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try {
    await page.goto(process.env.TEST_URL || 'http://localhost:8080/index.html',{waitUntil:'domcontentloaded'});
    const prompt=page.locator('.loader-enter');
    await prompt.waitFor({state:'visible',timeout:90000});
    assert.equal(await page.locator('.loader-percent').textContent(),'100%');
    await page.waitForTimeout(1200);
    const look=await page.evaluate(()=>{const b=document.querySelector('.loader-enter').getBoundingClientRect(),s=getComputedStyle(document.querySelector('.loader-enter'));return {cx:b.x+b.width/2,cy:b.y+b.height/2,btnH:b.height,w:innerWidth,h:innerHeight,anim:s.animationName,border:s.borderTopWidth,bg:s.backgroundColor};});
    assert.ok(Math.abs(look.cx-look.w/2)<3,'prompt centered horizontally');
    assert.ok(Math.abs(look.cy-(look.h/2+1.8*look.btnH))<4,'prompt center sits 1.8x its height below the exact center');
    assert.equal(look.anim,'enter-blink','prompt blinks like the boot cursor (CSS steps blink)');
    assert.ok(await page.evaluate(()=>document.querySelector('.loader-enter').getAnimations().some(a=>a.playState==='running')),'CSS blink is running');
    const blink=await prompt.evaluate(async el=>{
      const s=getComputedStyle(el), cursor=getComputedStyle(document.querySelector('.boot-line'),'::after');
      const timing={duration:s.animationDuration,easing:s.animationTimingFunction,cursorDuration:cursor.animationDuration,cursorEasing:cursor.animationTimingFunction};
      const samples=[];
      for(let i=0;i<24;i++) { samples.push(getComputedStyle(el).opacity); await new Promise(r=>setTimeout(r,60)); }
      return {...timing,samples};
    });
    assert.equal(blink.duration,'1s','one-second blink cycle');
    assert.equal(blink.easing,'steps(1)','hard on/off blink');
    if(reducedMotion==='no-preference') {
      assert.equal(blink.duration,blink.cursorDuration,'same duration as hero cursor');
      assert.equal(blink.easing,blink.cursorEasing,'same stepped timing as hero cursor');
    }
    assert.equal(await prompt.evaluate(e=>getComputedStyle(e).caretColor),'rgba(0, 0, 0, 0)','prompt caret is transparent');
    assert.deepEqual([...new Set(blink.samples)].sort(),['0','1'],'text actually switches fully off and on without fading');
    assert.equal(look.border,'0px','no borders');
    assert.equal(look.bg,'rgba(0, 0, 0, 0)','text only, no box');
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('booting')),true,'waits for gesture');
    await page.screenshot({path:`/tmp/gate-${gesture}-ready.png`});
    if(gesture==='click') await prompt.click();
    else await page.keyboard.press('a');
    await page.waitForFunction(()=>!document.documentElement.classList.contains('booting'),null,{timeout:10000});
    assert.equal(await page.locator('#site-loader').isVisible(),false,'loader closes');
    assert.equal(await prompt.isVisible(),false,'prompt disappears');
    await page.waitForFunction(()=>window.pix3lwareAudio?.state==='running' && window.pix3lwareAudio.gain>.01,null,{timeout:5000});
    assert.deepEqual(errors,[]);
    console.log(`${reducedMotion}/${gesture}: blink verified, ready at 100%, waited for gesture, loader closed, prompt hidden, audio running`);
   } catch(error) {
    console.error(await page.evaluate(()=>({classes:document.documentElement.className,status:document.querySelector('.loader-status')?.textContent,promptHidden:document.querySelector('.loader-enter')?.hidden,frame:document.querySelector('#site-loader')?.dataset.frame,audioState:window.pix3lwareAudio?.state,gain:window.pix3lwareAudio?.gain})),errors);
    await page.screenshot({path:'/tmp/gate-failure.png'});
    throw error;
   } finally { await context.close(); }
  }
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
