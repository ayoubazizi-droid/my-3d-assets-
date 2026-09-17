(() => {
  'use strict';
  window.pix3lwareMotionStarted = true;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, v));
  const loader = $('#site-loader');
  const video = $('.loader-film');
  const loaderLogo = $('.loader-logo img');
  const logoPlane = $('.loader-logo');
  const frame = $('.garage-frame');
  const intro = JSON.parse($('#pix-intro-data').textContent);
  const filmPlane = intro.planes.find(p => p.role === 'video');
  const logoData = intro.planes.find(p => p.role === 'logo');
  const websitePlane = intro.planes.find(p => p.role === 'website');
  const firstHidden = plane => plane.curves.find(c => c.path === 'hide_render').points.find(p => p.value === 1).frame;
  const logoStart = firstHidden(filmPlane);
  const websiteStart = firstHidden(logoData);
  const cueFrame = logoStart - 1;
  const heroCueTime = (cueFrame - 1) / intro.fps;
  let heroFrameCallback;
  let introClock, currentIntroFrame = intro.start;
  let cueReached = false, logoReady = false, entering = false;
  function place(element, bounds) {
    Object.assign(element.style, {left:`${bounds.x}px`,top:`${bounds.y}px`,
      width:`${bounds.width}px`,height:`${bounds.height}px`});
  }
  function drawIntro(atFrame) {
    currentIntroFrame = atFrame;
    for (const [plane, element] of [[filmPlane,video],[logoData,logoPlane]]) {
      const bounds = PixIntro.rect(intro,plane,atFrame,innerWidth,innerHeight);
      place(element,bounds);
      element.style.visibility = bounds.state.hide_render ? 'hidden' : 'visible';
      element.style.zIndex = String(Math.round(1000-bounds.vertices[0].depth*100));
    }
    loader.dataset.frame = atFrame.toFixed(3);
  }
  function alignHero() {
    const target = $('.hero-banner'), inner = $('.hero-inner');
    if (!target || !inner) return;
    const bounds = PixIntro.rect(intro,logoData,websiteStart,innerWidth,innerHeight);
    PixIntro.crop(logoData,target.querySelector('img'));
    target.style.width = `${bounds.width}px`;
    target.style.height = `${bounds.height}px`;
    inner.style.top = '0px'; inner.style.left = '0px';
    const actual = target.getBoundingClientRect();
    const heroElement = $('.hero'), stageElement = $('.hero-stage');
    const stageTop = stageElement.getBoundingClientRect().top + scrollY;
    const layoutTop = actual.top - heroElement.getBoundingClientRect().top + stageTop;
    inner.style.top = `${bounds.y-layoutTop}px`;
    inner.style.left = `${bounds.x-actual.left}px`;
  }
  let preparingEntry = false, entryReady = false, entryAccepted = false;
  function showIntroLogo() {
    if (!cueReached || !logoReady || !garageLoaded || entering) return;
    if (!entryReady) {
      if (preparingEntry) return;
      preparingEntry = true;
      Promise.allSettled([document.fonts?.ready,$('.hero-banner img')?.decode()]).then(() => {
        entryReady = true;
        if (status) status.textContent = 'Your world is ready';
        if (matchMedia('(max-width: 600px), (pointer: coarse) and (max-height: 600px)').matches) {
          // Phones proceed automatically, but only after all entry prerequisites are ready.
          enterSite();
        } else if (enter) {
          enter.hidden = false; enter.focus({preventScroll:true});
          // Prompt blinks exactly like the █ cursor after "LOADING PIX3LWARE.EXE"
          // via CSS (motion.css: enter-blink 1s steps(1) infinite) — no JS needed.
        }
      });
      return;
    }
    if (!entryAccepted) return;
    entering = true;
    {
      alignHero();
      root.classList.add('intro-morphing');
      // Hold the last movie frame for its full 1/24 second, then evaluate Blender time.
      introClock = performance.now();
      function tick(now) {
        const atFrame = Math.min(intro.end,cueFrame+(now-introClock)*intro.fps/1000);
        drawIntro(atFrame);
        if (!PixIntro.evaluate(websitePlane,atFrame).hide_render) dismiss();
        if (atFrame < intro.end) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  }
  function revealHero(mediaTime) {
    if (mediaTime + .0001 < heroCueTime || cueReached) return;
    cueReached = true;
    video?.pause();
    video.currentTime = heroCueTime;
    drawIntro(cueFrame);
    showIntroLogo();
  }
  const tasks = new Map();
  let dismissed = false, garageLoaded = false, slowTimer;
  // The requested animated experience starts enabled on every device. The visible
  // Motion control remains available to pause it without relying on OS settings.
  let motionChoice = true;
  let enabled = true;
  const status = $('.loader-status');
  const retry = $('.loader-retry');
  const playIntro = $('.loader-play');
  const enter = $('.loader-enter');
  loaderLogo?.decode().then(() => { logoReady = true; showIntroLogo(); }).catch(() => {
    if (status) status.textContent = 'Logo could not load. Please retry.';
    if (retry) retry.hidden = false;
  });
  const garageOrigin = frame ? new URL(frame.src, location.href).origin : '';
  function progress() {
    const value = garageLoaded ? 1 : Math.min(.98, tasks.get('3D garage') || 0);
    loader?.style.setProperty('--load-progress', value);
    const percent = $('.loader-percent');
    if (percent) percent.textContent = `${Math.floor(value * 100).toString().padStart(2, '0')}%`;
  }
  function dismiss() {
    // No timeout and no skip may bypass the actual model's first successful render.
    if (dismissed || !garageLoaded || !entering || currentIntroFrame < websiteStart) return;
    dismissed = true;
    clearTimeout(slowTimer);
    clearTimeout(window.pix3lwareBootWatchdog);
    window.scrollTo({top:0,left:0,behavior:'instant'});
    scroller?.scrollTo(0, {immediate:true, force:true});
    measure();
    alignHero();
    // The real interactive page replaces the screenshot plane on its visibility key.
    root.classList.add('intro-hero-visible');
    root.classList.remove('booting');
    if (heroFrameCallback !== undefined) video?.cancelVideoFrameCallback?.(heroFrameCallback);
    window.scrollTo({top: 0, left: 0, behavior: 'instant'});
    scroller?.scrollTo(0, {immediate:true, force:true});
    scroller?.start();
    if (loader) { loader.hidden = true; loader.style.display = 'none'; }
    root.classList.remove('intro-morphing');
    video?.pause();
    document.dispatchEvent(new Event('pix3lware:entered'));
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
      showIntroLogo();
    }
    if (event.data?.type === 'pix3lware:garage-error') garageError();
    if (event.data?.type === 'pix3lware:page-wheel') handlePageWheel(event.data.deltaY);
    if (event.data?.type === 'pix3lware:page-key') handlePageKey(event.data.key, event.data.pressed === true, event.data.repeat === true);
    if (event.data?.type === 'pix3lware:page-key-reset') resetKeys();
  });
  if (frame) {
    frame.loading = 'eager';
    const ask = () => frame.contentWindow?.postMessage({type:'pix3lware:status-request'}, garageOrigin);
    frame.addEventListener('load', ask);
    frame.addEventListener('error', garageError);
    ask();
  } else garageError();
  retry?.addEventListener('click', () => location.reload());
  // Interaction gate: once the world is ready, the site enters on the first
  // click or keypress. That same gesture lets the browser start the music.
  const gateControls = new AbortController();
  function gateKey(event) {
    if (!entryReady || entryAccepted || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['Tab','Shift','Control','Alt','Meta','Escape'].includes(event.key)) return;
    event.preventDefault();
    enterSite();
  }
  function enterSite() {
    if (!entryReady || entryAccepted) return;
    entryAccepted = true;
    gateControls.abort();
    if (enter) { enter.getAnimations().forEach(a => a.cancel()); enter.blur(); enter.hidden = true; }
    // Desktop gestures request audio synchronously; phone auto-entry only attempts autoplay.
    document.dispatchEvent(new Event('pix3lware:enter-request'));
    showIntroLogo();
  }
  document.addEventListener('keydown', gateKey, {capture:true, signal: gateControls.signal});
  loader?.addEventListener('click', enterSite, {signal: gateControls.signal});
  // Explicit muted playback is independent of reduced motion / the page motion control.
  async function playVideo() {
    if (!video || dismissed || cueReached) return;
    video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
    try { await video.play(); if (playIntro) playIntro.hidden = true; }
    catch (_) { if (playIntro) playIntro.hidden = false; }
  }
  if (video) {
    PixIntro.crop(logoData,loaderLogo);
    drawIntro(intro.start);
    // Use decoded frame timestamps rather than a timer that could outrun buffering.
    if (video.requestVideoFrameCallback) {
      const onVideoFrame = (_, metadata) => {
        if (!cueReached) drawIntro(Math.min(cueFrame,metadata.mediaTime*intro.fps+1));
        revealHero(metadata.mediaTime);
        if (!cueReached) heroFrameCallback = video.requestVideoFrameCallback(onVideoFrame);
      };
      heroFrameCallback = video.requestVideoFrameCallback(onVideoFrame);
    }
    video.addEventListener('timeupdate', () => {
      if (!video.requestVideoFrameCallback) revealHero(video.currentTime);
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
    caption.innerHTML = `<span>PIXEL ART STYLES / SCROLL TO EXPLORE</span><span class="gallery-counter">01 — ${String(gallery.children.length).padStart(2,'0')}</span>`;
    counter = $('.gallery-counter', caption);
    const line = document.createElement('div'); line.className = 'gallery-progress'; line.setAttribute('aria-hidden', 'true'); line.append(document.createElement('span'));
    gallery.before(stage); stage.append(pin); pin.append(caption, gallery, line);
  }

  let metrics = [], galleryMetric, raf = 0, active = true, lastY = -1;
  let scroller;
  const heldKeys = new Set();
  let lastKeyTime = 0;
  const keyDirection = key => key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  function resetKeys() { heldKeys.clear(); lastKeyTime = 0; }
  function handlePageKey(key, pressed, repeat = false) {
    const direction = keyDirection(key);
    if (!direction) return false;
    if (!pressed) { heldKeys.delete(key); if (!heldKeys.size) lastKeyTime = 0; return true; }
    if (root.classList.contains('booting')) return true;
    if (!scroller) {
      // The iframe has no page of its own to scroll when motion is switched off.
      window.scrollBy({top:direction*40,behavior:'instant'});
      return true;
    }
    if (repeat || heldKeys.has(key)) return true;
    if (!heldKeys.size) lastKeyTime = performance.now();
    heldKeys.add(key);
    scroller.scrollTo(scroller.targetScroll + direction*80, {programmatic:false,lerp:.06});
    requestTick();
    return true;
  }
  PixKeyboard.listen({
    down: event => {
      if (!scroller && !root.classList.contains('booting')) return false;
      return handlePageKey(event.key,true,event.repeat);
    },
    up: key => handlePageKey(key,false),
    reset: resetKeys
  });
  function advanceKeys(time) {
    if (!heldKeys.size || !scroller || root.classList.contains('booting')) return;
    const elapsed = clamp(time-lastKeyTime,0,100)/1000;
    lastKeyTime = time;
    // Held arrows advance every rendered frame, independent of OS key repeat.
    const direction = keyDirection([...heldKeys].at(-1));
    const speed = clamp(innerHeight*.9,480,960);
    scroller.scrollTo(scroller.targetScroll + direction*speed*elapsed, {programmatic:false,lerp:.06});
  }
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
    add('.section-head p, .about-copy p, .stat, .eyebrow', 'reveal');
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
    advanceKeys(time);
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
    resetKeys();
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
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
    measure(); alignHero(); if (!dismissed) drawIntro(currentIntroFrame);
  },120);});
  window.addEventListener('load',measure,{once:true});
  document.fonts?.ready.then(measure);
  document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(active){requestTick();if(!dismissed)playVideo();}});
  document.addEventListener('pix3lware:entered',()=>{measure();});
  window.addEventListener('pageshow',event=>{if(event.persisted){dismiss();measure();}});
  applyMotion();
  document.dispatchEvent(new Event('pix3lware:motion-ready'));
})();
