"""Sync motion and boot UI into the static page and self-contained Blogger XML."""
from pathlib import Path
import re, shutil, xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
base='https://ayoubazizi-droid.github.io/my-3d-assets-/'
version='scroll-20260913-v2'
critical=""".site-loader{display:none}html.booting{overflow:hidden}.booting .site-loader{display:grid;position:fixed;inset:0;z-index:10000;background:#000;color:#f3efe1;place-items:center}.loader-shell{width:min(86vw,560px)}.loader-film{width:100%;aspect-ratio:1;object-fit:contain}body.crt-text{filter:none}"""
bootstrap="""document.documentElement.classList.add('booting');window.pix3lwareBootWatchdog=setTimeout(function(){if(!window.pix3lwareMotionStarted)document.documentElement.classList.remove('booting');},15000);"""
loader="""<div class='site-loader' id='site-loader' aria-label='Loading pix3lware'>
  <div class='loader-shell'>
    <div class='loader-top'><span><span class='loader-led'></span>PIX3LWARE</span><span>PLEASE STAND BY</span></div>
    <video class='loader-film' autoplay='autoplay' muted='muted' playsinline='playsinline' loop='loop' preload='auto' poster='{base}assets/loader/poster.jpg' aria-label='Original pix3lware pixel animation'>
      <source src='{base}assets/loader/pix3lware.mp4' type='video/mp4'/>
      <source src='{base}assets/loader/pix3lware.webm' type='video/webm'/>
    </video>
    <div class='loader-bottom'><span class='loader-status' role='status'>Loading your world</span><span class='loader-percent' aria-hidden='true'>00%</span></div>
    <div class='loader-bar' aria-hidden='true'><span></span></div>
    <div class='loader-caption'>SMALL SQUARES. BIG IDEAS.</div>
    <button class='loader-continue' type='button' hidden='hidden'>Continue while media loads &#8599;</button>
  </div>
</div>"""
def block(name, text): return f'<!-- {name}:start -->\n{text}\n<!-- {name}:end -->'
def remove_block(s,name): return re.sub(r'<!-- '+name+r':start -->.*?<!-- '+name+r':end -->\n?', '',s,flags=re.S)
for filename in ['index.html','blogger-theme.xml']:
 p=root/filename; s=p.read_text(); blogger=filename.endswith('.xml')
 for name in ['pix-motion-head','pix-loader','pix-motion-script']: s=remove_block(s,name)
 s=s.replace('mailto:hello@pix3lware.com','mailto:pix3lware@gmail.com').replace('>hello@pix3lware.com<','>pix3lware@gmail.com<')
 if "href='https://pix3lware.blogspot.com/'" not in s:
  s=s.replace("<li><a href='mailto:pix3lware@gmail.com'>pix3lware@gmail.com</a></li>","<li><a href='mailto:pix3lware@gmail.com'>pix3lware@gmail.com</a></li>\n      <li><a href='https://pix3lware.blogspot.com/' target='_blank' rel='noopener noreferrer'>Blog</a></li>")
 s=s.replace("title='Interactive Ford Bronco Raptor viewer' loading='lazy'", "title='Interactive Ford Bronco Raptor viewer' loading='eager'")
 s=re.sub(r"(class='garage-frame' src=')[^']+",lambda m:m[1]+(base if blogger else './')+'viewer.html?v='+version,s)
 if blogger:
  css=(root/'motion.css').read_text()
  s=re.sub(r'/\* pix-motion:start \*/.*?/\* pix-motion:end \*/\n?', '',s,flags=re.S)
  s=s.replace(']]></b:skin>',f'\n/* pix-motion:start */\n{css}\n/* pix-motion:end */\n]]></b:skin>')
  head=f'<style>{critical}</style>\n<script>//<![CDATA[\n{bootstrap}\n//]]></script>'
  script='<script>//<![CDATA[\n'+(root/'motion.js').read_text()+'\n//]]></script>'
 else:
  head=f"<style>{critical}</style>\n<script>{bootstrap}</script>\n<link rel='stylesheet' href='motion.css?v={version}'/>"
  script=f"<script src='motion.js?v={version}'></script>"
 s=s.replace('</head>',block('pix-motion-head',head)+'\n</head>')
 s=s.replace("<body class='crt-text'>","<body class='crt-text'>\n"+block('pix-loader',loader.format(base=base if blogger else './'))+'\n')
 s=s.replace('</body>',block('pix-motion-script',script)+'\n</body>')
 p.write_text(s)

ET.parse(root/'blogger-theme.xml')
for target in ['/home/liveuser/Documents/pix3lware-theme/pix3lware-3d.xml','/home/liveuser/Downloads/pix3lware-blogger-theme.xml']:
 shutil.copy2(root/'blogger-theme.xml',target)
print('Static page, Blogger XML, and install copies synchronized. XML parses.')
