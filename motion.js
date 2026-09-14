(() => {
  'use strict';
  window.pix3lwareMotionStarted = true;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, v));
  const loader = $('#site-loader');
  const video = $('.loader-film');
  const frame = $('.garage-frame');
  const header = $('.site-header');
  // The 148-frame intro is 24 fps; frame 74 starts at (74 - 1) / 24.
  const headerCueTime = 73 / 24;
  let headerFrameCallback;
  header?.setAttribute('inert', '');
  function revealHeaderLogo(mediaTime) {
    if (mediaTime + .0001 >= headerCueTime) root.classList.add('header-logo-visible');
  }
  const tasks = new Map();
  let dismissed = false, garageLoaded = false, introPlayed = false, slowTimer;
  // The requested animated experience starts enabled on every device. The visible
  // Motion control remains available to pause it without relying on OS settings.
  let motionChoice = true;
  let enabled = true;
  const status = $('.loader-status');
  const retry = $('.loader-retry');
  const playIntro = $('.loader-play');
  const garageOrigin = frame ? new URL(frame.src, location.href).origin : '';
  function progress() {
    const value = garageLoaded ? 1 : Math.min(.98, tasks.get('3D garage') || 0);
    loader?.style.setProperty('--load-progress', value);
    const percent = $('.loader-percent');
    if (percent) percent.textContent = `${Math.floor(value * 100).toString().padStart(2, '0')}%`;
  }
  function dismiss() {
    // No timeout and no skip may bypass the actual model's first successful render.
    if (dismissed || !garageLoaded || !introPlayed) return;
    dismissed = true;
    clearTimeout(slowTimer);
    clearTimeout(window.pix3lwareBootWatchdog);
    loader?.classList.add('loader-leaving');
    setTimeout(() => {
      root.classList.remove('booting');
      header?.removeAttribute('inert');
      if (headerFrameCallback !== undefined) video?.cancelVideoFrameCallback?.(headerFrameCallback);
      window.scrollTo({top: 0, left: 0, behavior: 'instant'});
      scroller?.scrollTo(0, {immediate:true, force:true});
      scroller?.start();
      if (loader) { loader.hidden = true; loader.style.display = 'none'; }
      video?.pause();
      document.dispatchEvent(new Event('pix3lware:entered'));
    }, enabled ? 900 : 0);
  }
  function garageError() {
    if (dismissed) return;
    if (status) status.textContent = 'Bronco could not load. Retry to enter.';
    if (retry) retry.hidden = false;
  }
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== garageOrigin) return;
    if (event.data?.type === 'pix3lware:garage-progress' && !garageLoaded) {
      tasks.set('3D garage', clamp(event.data.progress, 0, .98)); progress();
      if (status) status.textContent = event.data.progress >= .9 ? 'Preparing the Bronco…' : 'Loading the Ford Bronco…';
    }
    if (event.data?.type === 'pix3lware:garage-ready') {
      garageLoaded = true; progress();
      if (status) status.textContent = 'Your world is ready';
      if (retry) retry.hidden = true;
      frame.contentWindow?.postMessage({type:'pix3lware:motion', enabled}, garageOrigin);
      dismiss();
    }
    if (event.data?.type === 'pix3lware:garage-error') garageError();
    if (event.data?.type === 'pix3lware:page-wheel') handlePageWheel(event.data.deltaY);
  });
  if (frame) {
    frame.loading = 'eager';
    const ask = () => frame.contentWindow?.postMessage({type:'pix3lware:status-request'}, garageOrigin);
    frame.addEventListener('load', ask);
    frame.addEventListener('error', garageError);
    ask();
  } else garageError();
  retry?.addEventListener('click', () => location.reload());
  // Explicit muted playback is independent of reduced motion / the page motion control.
  async function playVideo() {
    if (!video || dismissed) return;
    video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
    try { await video.play(); if (playIntro) playIntro.hidden = true; }
    catch (_) { if (playIntro) playIntro.hidden = false; }
  }
  if (video) {
    // Use decoded frame timestamps rather than a timer that could outrun buffering.
    if (video.requestVideoFrameCallback) {
      const onVideoFrame = (_, metadata) => {
        revealHeaderLogo(metadata.mediaTime);
        if (!root.classList.contains('header-logo-visible')) headerFrameCallback = video.requestVideoFrameCallback(onVideoFrame);
      };
      headerFrameCallback = video.requestVideoFrameCallback(onVideoFrame);
    }
    let lastTime = 0;
    video.addEventListener('timeupdate', () => {
      if (!video.requestVideoFrameCallback) revealHeaderLogo(video.currentTime);
      // Show the supplied animation at least once, even on a warm model cache.
      if (video.currentTime >= Math.max(.1, video.duration - .3) || (lastTime > 1 && video.currentTime < lastTime)) {
        introPlayed = true; dismiss();
      }
      lastTime = video.currentTime;
    });
    video.addEventListener('error', () => {
      if (status) status.textContent = 'Intro could not load. Please retry.';
      if (retry) retry.hidden = false;
    });
    video.addEventListener('canplay', playVideo, {once:true});
    playIntro?.addEventListener('click', playVideo);
    document.addEventListener('pointerdown', () => { if (!dismissed && video.paused) playVideo(); }, {passive:true});
    playVideo();
  }
  slowTimer = setTimeout(() => {
    if (!garageLoaded) {
      if (status) status.textContent = 'Still preparing your Bronco. Please wait…';
      if (retry) retry.hidden = false;
    }
  }, 30000);
  progress();

  const nav = $('nav.wrap');
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'motion-toggle';
  nav?.append(toggle);
  const meter = document.createElement('span'); meter.className = 'scroll-meter'; meter.setAttribute('aria-hidden', 'true');
  $('header')?.append(meter);
  const orbit = document.createElement('div'); orbit.className = 'hero-orbit'; orbit.setAttribute('aria-hidden', 'true');
  $('.hero')?.prepend(orbit);
  const cue = document.createElement('a'); cue.className = 'scroll-cue'; cue.href = '#about'; cue.innerHTML = 'Scroll to explore <span aria-hidden="true">↓</span>';
  $('.hero-inner')?.append(cue);

  const story = document.createElement('section');
  story.className = 'scroll-story';
  story.setAttribute('aria-label', 'Small squares. Big ideas. Your next world.');
  story.innerHTML = `<div class="story-pin"><span class="story-label">01 / THE WORLD OF PIX3LWARE</span><div class="story-lines" aria-hidden="true"><div class="story-line">SMALL <em>SQUARES.</em></div><div class="story-line"><em>BIG</em> IDEAS.</div><div class="story-line">YOUR NEXT <em>WORLD.</em></div></div><div class="story-bottom"><span>SPRITES / TILESETS / 3D</span><span>KEEP SCROLLING ↓</span></div></div>`;
  const hero = $('.hero');
  const heroStage = document.createElement('div'); heroStage.className = 'hero-stage';
  hero?.before(heroStage); if (hero) heroStage.append(hero);
  heroStage.after(story);

  for (const [selector, words] of [['#about', 'PIXEL BY PIXEL'], ['.newsletter', 'SMALL SQUARES. BIG IDEAS.']]) {
    const target = $(selector); if (!target) continue;
    const band = document.createElement('div'); band.className = 'motion-band'; band.setAttribute('aria-hidden', 'true');
    const track = document.createElement('div'); track.className = 'motion-band-track';
    for (let i = 0; i < 6; i++) { const span = document.createElement('span'); span.textContent = words; const star = document.createElement('i'); star.textContent = '✳'; track.append(span, star); }
    band.append(track); target.before(band);
  }
  const footer = $('#contact .wrap');
  if (footer && !$('.contact-title', footer)) {
    const title = document.createElement('h2'); title.className = 'contact-title'; title.innerHTML = 'let’s make<br/>some pixels. <span class="contact-arrow" aria-hidden="true">↗</span>';
    footer.prepend(title);
  }

  const headings = $$('.section-head h2, .about-copy h2, .newsletter h2, .hero .tagline');
  headings.forEach(el => {
    // Split only text nodes, preserving original links, emphasis, and accessible words.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    let wordIndex = 0;
    nodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part.trim()) fragment.append(document.createTextNode(part));
        else { const word = document.createElement('span'); word.className = 'motion-word'; word.dataset.word = wordIndex++; word.textContent = part; fragment.append(word); }
      });
      node.replaceWith(fragment);
    });
  });

  const gallery = $('.gallery');
  let stage, pin, counter;
  if (gallery) {
    stage = document.createElement('div'); stage.className = 'gallery-stage';
    pin = document.createElement('div'); pin.className = 'gallery-pin';
    const caption = document.createElement('div'); caption.className = 'gallery-caption';
    caption.innerHTML = '<span>THE PIXEL ARCHIVE / SCROLL TO EXPLORE</span><span class="gallery-counter">01 — 08</span>';
    counter = $('.gallery-counter', caption);
    const line = document.createElement('div'); line.className = 'gallery-progress'; line.setAttribute('aria-hidden', 'true'); line.append(document.createElement('span'));
    gallery.before(stage); stage.append(pin); pin.append(caption, gallery, line);
    $$('.tile', gallery).forEach((tile, i) => { tile.dataset.index = `${String(i + 1).padStart(2, '0')} / PIX3LWARE`; });
  }

  let metrics = [], galleryMetric, raf = 0, active = true, lastY = -1;
  let scroller;
  function handlePageWheel(delta) {
    if (root.classList.contains('booting') || !Number.isFinite(delta)) return;
    if (scroller) scroller.scrollTo(scroller.targetScroll + delta * .9, {programmatic:false, lerp:.06});
    else window.scrollBy({top:delta, behavior:'instant'});
  }
  const styled = new Set();
  function transform(el, value, opacity) {
    if (!el) return;
    styled.add(el); el.style.transform = value;
    if (opacity !== undefined) el.style.opacity = opacity;
  }
  function measure() {
    root.style.setProperty('--header-height', `${$('header')?.offsetHeight || 70}px`);
    root.style.setProperty('--viewport-width', `${root.clientWidth}px`);
    // Remove previous transforms for stable layout-based scroll offsets.
    styled.forEach(el => { el.style.transform = ''; el.style.opacity = ''; });
    metrics = [];
    function add(selector, type) {
      $$(selector).forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        metrics.push({el, type, i, top: rect.top + scrollY, height: rect.height, words: type === 'heading' ? $$('.motion-word', el) : []});
      });
    }
    add('.section-head h2, .about-copy h2, .newsletter h2', 'heading');
    add('.hero .tagline', 'heroLayer');
    add('.section-head p, .about-copy p, .stat, .eyebrow, .foot-links li', 'reveal');
    add('.scroll-story', 'story');
    add('.cart', 'card'); add('.palette', 'palette'); add('.hero-banner', 'hero');
    add('.hero p.sub, .hero-ctas, .sprite-row', 'heroLayer');
    add('.motion-band-track', 'band'); add('.garage-frame', 'garage'); add('.contact-title', 'contact');
    if (stage) galleryMetric = { top: stage.getBoundingClientRect().top + scrollY, height: stage.offsetHeight, pinHeight: pin.offsetHeight, inset: parseFloat(getComputedStyle(pin).top) || 0, travel: Math.max(0, gallery.scrollWidth - (pin.clientWidth - parseFloat(getComputedStyle(pin).paddingLeft) - parseFloat(getComputedStyle(pin).paddingRight))) };
    lastY = -1; requestTick();
  }
  function render(time) {
    raf = 0;
    if (!enabled || !active) return;
    const vh = innerHeight, vw = innerWidth;
    scroller?.raf(time);
    // Page, text, gallery and particles share one continuous scroll coordinate.
    const y = scroller ? scroller.animatedScroll : scrollY;
    window.pix3lwareScroll = y;
    if (Math.abs(lastY - y) > .01) {
      root.style.setProperty('--page-progress', clamp(y / Math.max(1, document.documentElement.scrollHeight - vh)));
      for (const m of metrics) {
        const rel = m.top - y;
        if (rel > vh * 1.5 || rel + m.height < -vh) continue;
        const entry = clamp((vh * .97 - rel) / (vh * .6));
        const eased = 1 - Math.pow(1 - entry, 3);
        const through = clamp((vh - rel) / (vh + m.height));
        if (m.type === 'story') {
          const p = clamp((y - m.top + vh * .35) / (m.height - vh * .65));
          $$('.story-line', m.el).forEach((line, i) => {
            const t = clamp((p - i * .09) / .68);
            const arrival = clamp(t / .55);
            const departure = clamp((t - .65) / .35);
            const x = ((1 - arrival) * 1.05 - departure * .65) * vw * (i % 2 ? 1 : -1);
            transform(line, `translate3d(${x}px,0,0) rotate(${(1-arrival)*(i%2?5:-5)}deg)`, clamp(arrival*2)*(1-departure*.7));
          });
        } else if (m.type === 'heading') {
          m.words.forEach((word, i) => {
            const p = clamp((vh * .95 - rel) / (vh * .7) - i / Math.max(m.words.length, 1) * .16);
            const q = p * p * (3 - 2 * p);
            const drift = clamp((vh * .3 - rel) / vh, 0, 1) * Math.min(vw * .16, 180);
            const side = m.i % 2 ? 1 : -1;
            const x = ((1-q) * Math.min(vw * .95, 1000) - drift) * side;
            transform(word, `translate3d(${x}px,${(1-q)*65}px,0) rotate(${(1-q)*side*7}deg)`, clamp(p*2));
          });
        } else if (m.type === 'reveal') {
          const p = clamp((vh * .95 - rel) / (vh * .65));
          const side = m.i % 2 ? 1 : -1;
          const drift = clamp((vh * .25 - rel) / vh) * 45;
          transform(m.el, `translate3d(${((1-p)*Math.min(vw*.38,360)-drift)*side}px,${(1-p)*45}px,0)`, clamp(p*1.6));
        } else if (m.type === 'card') {
          const p = clamp(entry * 1.4 - (m.i % 3) * .12), q = 1-Math.pow(1-p,3);
          const drift = (through-.5) * (m.i%2? -28:28);
          transform(m.el, `translate3d(${(1-q)*(m.i%2?140:-140)}px,${(1-q)*100+drift}px,0) rotate(${(1-q)*(m.i%2?-9:9)+(through-.5)*3}deg)`, .15+.85*q);
        } else if (m.type === 'palette') {
          transform(m.el, `translate3d(${(1-eased)*130}px,${(through-.5)*-60}px,0) rotate(${(through-.5)*12}deg) scale(${.83+.17*eased})`);
          [...m.el.children].forEach((el,i) => transform(el, `translateY(${Math.sin(through*Math.PI*2+i*.8)*18}px)`));
        } else if (m.type === 'hero') {
          const p = clamp(y / (vh*1.15));
          transform(m.el, `translate3d(${p*-vw*.48}px,${p*-100}px,0) rotate(${-p*12}deg) scale(${1+p*.5})`, 1-p);
        } else if (m.type === 'heroLayer') {
          const p = clamp(y/(vh*1.15)); transform(m.el, `translate3d(${p*vw*(m.i%2?.55:-.55)}px,${p*(15+m.i*15)}px,0)`, 1-p);
        } else if (m.type === 'band') {
          transform(m.el, `translate3d(${-320+(through-.5)*(m.i%2?660:-660)}px,0,0)`);
        } else if (m.type === 'garage') {
          transform(m.el, `translate3d(0,${(1-eased)*60}px,0)`);
        } else if (m.type === 'contact') {
          transform(m.el, `translate3d(${(1-eased)*-180}px,0,0)`, .2+.8*eased);
          transform($('.contact-arrow',m.el), `rotate(${(through-.5)*70}deg)`);
        }
      }
      if (galleryMetric) {
        const m=galleryMetric, p=clamp((y-m.top+m.inset)/Math.max(1,m.height-m.pinHeight));
        transform(gallery, `translate3d(${-p*m.travel}px,0,0)`);
        stage.style.setProperty('--gallery-progress', p);
        const count = gallery.children.length;
        counter.textContent = `${String(Math.min(count,Math.round(p*(count-1))+1)).padStart(2,'0')} — ${String(count).padStart(2,'0')}`;
      }
      lastY=y;
    }
    requestTick();
  }
  function requestTick() { if (!raf && enabled && active) raf = requestAnimationFrame(render); }
  function applyMotion() {
    enabled = motionChoice;
    root.classList.toggle('motion-ready', enabled); root.classList.toggle('motion-off', !enabled);
    toggle.textContent = enabled ? 'MOTION ON' : 'MOTION OFF';
    toggle.setAttribute('aria-label', enabled ? 'Pause page motion' : 'Enable page motion');
    toggle.setAttribute('aria-pressed', String(enabled));
    styled.forEach(el => { el.style.transform=''; el.style.opacity=''; });
    scroller?.destroy(); scroller = undefined;
    if (enabled) {
      if (window.Lenis) {
        scroller = new Lenis({lerp:.06, wheelMultiplier:.9, smoothWheel:true,
          syncTouch:false, autoRaf:false, anchors:true, allowNestedScroll:true,
          respectReducedMotion:false, stopInertiaOnNavigate:true});
        if (root.classList.contains('booting')) scroller.stop();
      }
      measure();
    } else { if (raf) cancelAnimationFrame(raf); raf=0; window.pix3lwareScroll = undefined; }
    // Keep the embedded scene's auto-rotation in step with the page motion preference.
    frame?.contentWindow?.postMessage({type:'pix3lware:motion',enabled}, garageOrigin);
    document.dispatchEvent(new CustomEvent('pix3lware:motion-change', {detail:{enabled}}));
  }
  toggle.addEventListener('click', () => { motionChoice=!enabled; applyMotion(); });
  window.addEventListener('scroll',requestTick,{passive:true});
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(measure,120);});
  window.addEventListener('load',measure,{once:true});
  document.fonts?.ready.then(measure);
  document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(active){requestTick();if(!dismissed)playVideo();}});
  document.addEventListener('pix3lware:entered',()=>{measure();});
  window.addEventListener('pageshow',event=>{if(event.persisted){dismiss();measure();}});
  applyMotion();
  document.dispatchEvent(new Event('pix3lware:motion-ready'));
})();
