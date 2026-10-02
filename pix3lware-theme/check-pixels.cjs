const {chromium}=require('/home/liveuser/squashfs-root/resources/js-repl-runtime/node_modules/playwright-core');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
 for(const width of [1040,390]){
 const page=await browser.newPage({viewport:{width,height:680},deviceScaleFactor:width===390?2:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:8011/viewer.html',{waitUntil:'networkidle'});
 await page.locator('#status').getByText('Ready to explore',{exact:true}).waitFor({timeout:90000});
 await page.locator('#rotate').click();
 for(const value of ['4','7','0','2','4']){
 await page.locator('#pixel-style').selectOption(value);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:`/home/liveuser/Documents/pix3lware-theme/pixels-${width}-${value}.png`});
 }
 await page.locator('#reset').click();
 console.log(JSON.stringify({width,errors,status:await page.locator('#status').textContent(),overflow:await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth>innerWidth,vertical:document.documentElement.scrollHeight>innerHeight}))}));
 await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
