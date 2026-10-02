const {chromium}=require('/home/liveuser/squashfs-root/resources/js-repl-runtime/node_modules/playwright-core');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
 const page=await browser.newPage({viewport:{width:1365,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8011/',{waitUntil:'networkidle'});
 await page.screenshot({path:'/home/liveuser/Documents/pix3lware-theme/desktop.png',fullPage:true});
 await page.locator('#garage').scrollIntoViewIfNeeded();
 const frame=page.frameLocator('.garage-frame');
 // Use local viewer while checking the unpublished version.
 await page.locator('.garage-frame').evaluate(f=>f.src='http://127.0.0.1:8011/viewer.html');
 await frame.locator('#status').getByText('Ready to explore',{exact:true}).waitFor({timeout:90000});
 await page.screenshot({path:'/home/liveuser/Documents/pix3lware-theme/garage.png'});
 await frame.locator('#rotate').click();
 await frame.locator('#rotate').getByText('Resume rotation',{exact:true}).waitFor();
 await frame.locator('#reset').click();
 console.log('Desktop overflow:',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.setViewportSize({width:390,height:844});
 await page.locator('#garage').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/home/liveuser/Documents/pix3lware-theme/mobile.png'});
 console.log('Mobile overflow:',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 console.log('Viewer status:',await frame.locator('#status').textContent());
 console.log('Page errors:',JSON.stringify(errors));
 await page.close();await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
