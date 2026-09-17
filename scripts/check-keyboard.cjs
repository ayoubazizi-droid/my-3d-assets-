// Browser integration check: node scripts/check-keyboard.cjs
// Override PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE outside the authoring machine.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/home/liveuser/squashfs-root/resources/js-repl-runtime/node_modules/playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || '/var/lib/flatpak/app/com.brave.Browser/current/active/files/brave/brave',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://keyboard.test/**',r=>{
   const pathname=new URL(r.request().url()).pathname;
   if(pathname==='/')return r.fulfill({contentType:'text/html',body:fs.readFileSync(root+'/index.html','utf8').replace(/src='\.\/viewer.html[^']*'/,"src='https://garage.test/viewer.html'")});
   return r.fulfill({path:root+pathname});
  });
  await page.route('https://garage.test/**',r=>{
   if(new URL(r.request().url()).pathname==='/viewer.html')return r.fulfill({contentType:'text/html',body:`<html><body><button id="surface">Garage surface</button><select id="look"><option>Pixel art</option><option>Smooth 3D</option></select><script src="keyboard-scroll.js" data-forward-to-parent="true"></script><script>parent.postMessage({type:'pix3lware:garage-ready'},'https://keyboard.test')</script></body></html>`});
   return r.fulfill({path:root+'/keyboard-scroll.js'});
  });
  await page.goto('https://keyboard.test/',{waitUntil:'domcontentloaded'});
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>scrollY),0,'loader stays at top');
   await page.locator('.loader-enter').waitFor({state:'visible'});
   await page.keyboard.press('Enter');

  await page.waitForFunction(()=>document.documentElement.classList.contains('intro-hero-visible'));
  await page.evaluate(()=>{
   window.keySamples=[]; window.recordKeys=true;
   function sample(t){if(recordKeys){keySamples.push({t,y:scrollY});requestAnimationFrame(sample)}}requestAnimationFrame(sample);
  });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1250);
  const tap=await page.evaluate(()=>{recordKeys=false;return keySamples});
  assert.ok(tap.filter((p,i,a)=>i&&p.y>a[i-1].y).length>=15,'tap moves across many frames');
  assert.ok(tap.at(-1).y>=77&&tap.at(-1).y<=81,'tap distance');
  const start=await page.evaluate(()=>scrollY);
  await page.evaluate(()=>{
   keySamples=[];recordKeys=true;
   function sample(t){if(recordKeys){keySamples.push({t,y:scrollY});requestAnimationFrame(sample)}}requestAnimationFrame(sample);
  });
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(550);
  for(let i=0;i<8;i++)await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(550);
  await page.keyboard.up('ArrowDown');
  const hold=(await page.evaluate(()=>{recordKeys=false;return keySamples})).filter((p,i,a)=>!i||p.t!==a[i-1].t);
  assert.ok(hold.at(-1).y-start>500,'held key advances without relying on repeats');
  const steady=hold.filter(p=>p.t>hold[0].t+200);
  assert.ok(steady.filter((p,i,a)=>i&&p.y>a[i-1].y).length>steady.length*.8,'continuous held motion');
  assert.ok(steady.every((p,i,a)=>!i||p.y-a[i-1].y<(p.t-a[i-1].t)*1.5+4),'no repeat-driven jumps');
  await page.waitForTimeout(1500);
  const stopped=await page.evaluate(()=>scrollY);
  await page.waitForTimeout(300);
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-stopped)<2,'keyup settles');
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1500);
  assert.ok(await page.evaluate(()=>scrollY)<stopped-350,'up arrow also eases');
  await page.keyboard.down('ArrowDown');await page.waitForTimeout(350);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(1700);const blurred=await page.evaluate(()=>scrollY);
  await page.waitForTimeout(300);
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-blurred)<2,'blur releases held keys');
  await page.keyboard.up('ArrowDown');
  await page.evaluate(()=>{
   const form=document.createElement('div');form.id='test-controls';form.style='position:fixed;top:100px;left:0;z-index:20000';
   form.innerHTML='<input id="test-input"/><textarea id="test-area"></textarea><div id="test-edit" contenteditable="true">Editable text</div><select id="test-select"><option>A</option><option>B</option></select><div id="test-nested" tabindex="0" style="height:50px;overflow-y:auto"><div style="height:400px">Scrollable panel</div></div>';
   document.body.append(form);window.lastPrevented=null;
   window.addEventListener('keydown',event=>window.lastPrevented=event.defaultPrevented);
  });
  for(const id of ['test-input','test-area','test-edit','test-select','test-nested']){
   await page.locator('#'+id).focus();await page.keyboard.press('ArrowDown');
   assert.equal(await page.evaluate(()=>lastPrevented),false,id+' preserves native arrows');
  }
  await page.locator('#test-controls').evaluate(e=>e.remove());
  const garage=page.frames().find(f=>f.url().includes('garage.test'));
  await garage.locator('#surface').focus();
  await page.waitForTimeout(1700);
  const frameStart=await page.evaluate(()=>scrollY);
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(600);await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1500);
  assert.ok(await page.evaluate(()=>scrollY)<frameStart-300,'cross-origin garage forwards held arrows');
  await garage.locator('#look').focus();await page.keyboard.press('ArrowDown');
  assert.equal(await garage.locator('#look').inputValue(),'Smooth 3D','garage Look selector still works');
  await page.locator('.motion-toggle').evaluate(e=>e.click());
  await page.locator('.motion-toggle').focus();await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>lastPrevented),false,'Motion off keeps native scrolling');
  assert.deepEqual(errors,[]);
  console.log({tapFrames:tap.length,heldFrames:hold.length,tapDistance:tap.at(-1).y,holdDistance:hold.at(-1).y-start,crossOriginGarage:true,controls:'preserved',blur:'settled',errors});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
