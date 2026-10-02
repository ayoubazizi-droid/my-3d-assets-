from pathlib import Path
import re, html, xml.etree.ElementTree as ET
out=Path('/home/liveuser/blogger-3d')
source=Path('/home/liveuser/Documents/pix3lware-theme/original.xml').read_text()
extra='''
  /* Interactive Bronco gallery */
  .garage{ margin-top:56px; scroll-margin-top:90px; }
  .foot-links{flex-wrap:wrap;}
  .garage .section-head{ margin-bottom:24px; }
  .garage-frame{ display:block; width:100%; height:640px; border:3px solid var(--ink); background:var(--bg-panel); box-shadow:var(--shadow); }
  .garage-link{ display:inline-block; margin-top:20px; font-size:13px; text-underline-offset:4px; }
  @media(max-width:600px){ .garage-frame{height:680px;} .wrap{padding-left:18px;padding-right:18px;} .hero-inner{padding-top:64px;} }
'''
block='''
  <div class='wrap garage' id='garage'>
    <div class='section-head'>
      <span class='eyebrow'>// 3D GARAGE</span>
      <h2>take it for a spin.</h2>
      <p>Our custom Ford Bronco Raptor. Drag to look around and zoom in on the details.</p>
    </div>
    <iframe class='garage-frame' src='https://ayoubazizi-droid.github.io/my-3d-assets-/viewer.html' title='Interactive Ford Bronco Raptor viewer' loading='lazy' allow='fullscreen'></iframe>
    <a class='garage-link' href='https://ayoubazizi-droid.github.io/my-3d-assets-/viewer.html' target='_blank' rel='noopener'>Open the 3D garage in a new tab &#8599;</a>
  </div>
'''
marker="</section>\n\n\n<div id='blog-section'>"
assert marker in source
updated=source.replace(']]></b:skin>',extra+']]></b:skin>',1).replace(marker,block+'\n'+marker,1)
updated=updated.replace("<li><a href='#gallery'>gallery</a></li>","<li><a href='#gallery'>gallery</a></li>\n      <li><a href='#garage'>3D garage</a></li>")
ET.fromstring(updated)
(out/'blogger-theme.xml').write_text(updated)
Path('/home/liveuser/Documents/pix3lware-theme/pix3lware-3d.xml').write_text(updated)
# Publish the same visual layout as static HTML; Blogger renders its own live posts.
css=re.search(r'<b:skin><!\[CDATA\[([\s\S]*?)\]\]></b:skin>',updated).group(1)
body=re.search(r'<body>([\s\S]*)</body>',updated).group(1)
start=body.index("<div id='blog-section'>"); end=body.index("<section class='newsletter'>",start)
body=body[:start]+body[end:]
body=body.replace("<li><a href='#blog-section'>blog</a></li>",'')
body=body.replace("expr:href='data:blog.homepageUrl'","href='./'").replace('<data:blog.title/>','pix3lware')
# Expand non-void XML tags for HTML parsing (palette divs and SVG rectangles).
body=re.sub(r'<(div|rect)(\b[^<>]*?)/>',r'<\1\2></\1>',body)
body=re.sub(r"<section class='newsletter'>[\s\S]*?</section>","""<section class='newsletter'><div class='wrap'><h2>one more dimension.</h2><p>Step inside the garage and explore every angle.</p><a class='pixel-btn red' href='#garage'>EXPLORE THE BRONCO</a></div></section>""",body,count=1)
font=re.search(r"<link href='https://fonts.googleapis.com/[^\n]+",updated).group(0)
(out/'theme.css').write_text(css)
(out/'index.html').write_text("<!doctype html>\n<html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>pix3lware — pixel art &amp; 3D garage</title>"+font+"\n<link rel='stylesheet' href='theme.css'></head><body>"+body+'</body></html>\n')
(out/'viewer.html').write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>pix3lware — 3D garage</title><link rel="stylesheet" href="style.css">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script>
</head><body><main>
<section class="viewer" aria-label="Interactive Ford Bronco Raptor">
<div class="viewer-top"><span><span class="dot"></span> PIX3LWARE / LIVE 3D</span><span id="counter">01 / 01</span></div>
<div id="canvas-wrap"></div>
<div class="viewer-bottom"><div><p class="eyebrow" id="category"></p><h1 id="object-title">Ford Bronco Raptor</h1></div><div class="controls"><button id="rotate" type="button" aria-pressed="true">Pause rotation</button><button id="reset" type="button">Reset view</button></div></div>
</section><div class="viewer-note"><span id="status" role="status">Loading the Bronco…</span><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div>
<nav id="collection" aria-label="Choose an object" hidden></nav>
<noscript>Enable JavaScript to explore this 3D model.</noscript></main>
<script type="module" src="app.js"></script><script>window.addEventListener('error',()=>{document.getElementById('status').textContent='The viewer could not start. Check your connection and WebGL support.';});</script>
</body></html>
''')
app=(out/'app.js').read_text()
app=re.sub(r"  \{ title: 'Soft geometry'.*\n",'',app)
app=re.sub(r"  \{ title: 'Full circle'.*\n",'',app)
app=app.replace('0x65744f','0x77778a').replace('0xe0f9b9','0xffffff')
(out/'app.js').write_text(app)
(out/'blogger-embed.html').write_text('''<!-- Optional standalone Blogger page embed. The full blogger-theme.xml already includes this viewer. -->
<iframe src="https://ayoubazizi-droid.github.io/my-3d-assets-/viewer.html" title="pix3lware — Ford Bronco Raptor" loading="lazy" style="display:block;width:100%;height:680px;border:3px solid #1b1b2f;" allow="fullscreen"></iframe>
''')
