(() => {
  'use strict';
  window.pix3lwareMotionStarted = true;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, v));
  const loader = $('#site-loader');
  const video = $('.loader-film');
  const frame = $('.garage-frame');
  const tasks = new Map();
  const failures = new Set();
  let dismissed = false, slowTimer, deadlineTimer, bootStarted = performance.now();
  let manualPause = false;
  try { manualPause = sessionStorage.getItem('pix3lware-motion') === 'off'; } catch (_) {}
  let enabled = !reduced.matches && !manualPause;

  function progress() {
    const value = [...tasks.values()].reduce((a, b) => a + b, 0) / Math.max(tasks.size, 1);
    loader?.style.setProperty('--load-progress', value);
    if ($('.loader-percent')) $('.loader-percent').textContent = `${Math.floor(value * 100).toString().padStart(2, '0')}%`;
  }
  function finishTask(name, failed = false) {
    if (failed) failures.add(name);
    tasks.set(name, 1);
    progress();
  }
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(slowTimer);
    clearTimeout(deadlineTimer);
    if (window.pix3lwareBootWatchdog) clearTimeout(window.pix3lwareBootWatchdog);
    if (enabled && loader && root.classList.contains('booting')) {
      loader.classList.add('loader-leaving');
      setTimeout(removeLoader, 760);
    } else removeLoader();
    if (failures.size) {
      const note = document.createElement('div');
      note.className = 'asset-notice'; note.setAttribute('role', 'status');
      note.textContent = 'Some media could not load. You can still explore the page.';
      const retry = document.createElement('a'); retry.href = location.href; retry.textContent = 'Retry';
      note.append(retry); $('header').after(note);
    }
  }
  function removeLoader() {
    root.classList.remove('booting');
    if (loader) { loader.hidden = true; loader.style.display = 'none'; }
    video?.pause();
    document.dispatchEvent(new Event('pix3lware:entered'));
  }
  const waitEvent = (el, good, bad = 'error') => new Promise(resolve => {
    const done = event => { el.removeEventListener(good, done); el.removeEventListener(bad, done); resolve(event.type === good); };
    el.addEventListener(good, done, { once: true }); el.addEventListener(bad, done, { once: true });
  });

  // Install the cross-origin handshake BEFORE making the garage eager.
  let resolveGarage;
  const garageReady = new Promise(resolve => { resolveGarage = resolve; });
  const garageOrigin = frame ? new URL(frame.src, location.href).origin : '';
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== garageOrigin) return;
    if (event.data?.type === 'pix3lware:garage-progress' && !dismissed) {
      tasks.set('3D garage', clamp(event.data.progress, 0, .95)); progress();
    }
    if (event.data?.type === 'pix3lware:garage-ready') resolveGarage(true);
    if (event.data?.type === 'pix3lware:garage-error') resolveGarage(false);
  });
  if (frame) {
    frame.loading = 'eager';
    const ask = () => frame.contentWindow?.postMessage({ type: 'pix3lware:status-request' }, garageOrigin);
    frame.addEventListener('load', ask);
    frame.addEventListener('error', () => resolveGarage(false));
    ask();
  } else resolveGarage(true);

  async function boot() {
    const jobs = [
      ['Page', document.readyState === 'complete' ? Promise.resolve(true) : waitEvent(window, 'load')],
      ['Fonts', document.fonts ? document.fonts.ready.then(() => true) : Promise.resolve(true)],
      ['Images', Promise.all($$('img').map(img => img.decode ? img.decode().then(() => true, () => false) : (img.complete ? Promise.resolve(!!img.naturalWidth) : waitEvent(img, 'load')))).then(values => values.every(Boolean))],
      ['3D garage', garageReady]
    ];
    if (video) {
      jobs.push(['Intro', video.readyState >= 2 ? Promise.resolve(true) : waitEvent(video, 'loadeddata')]);
      if (enabled) video.play().catch(() => {});
    }
    jobs.forEach(([name]) => tasks.set(name, 0)); progress();
    deadlineTimer = setTimeout(() => {
      for (const [name, value] of tasks) if (value < 1) failures.add(name);
      dismiss();
    }, 20000);
    slowTimer = setTimeout(() => {
      const status = $('.loader-status');
      if (status) status.textContent = 'Still loading your world…';
      const skip = $('.loader-continue'); if (skip) skip.hidden = false;
    }, 12000);
    $('.loader-continue')?.addEventListener('click', () => {
      for (const [name, value] of tasks) if (value < 1) failures.add(name);
      dismiss();
    });
    await Promise.all(jobs.map(async ([name, job]) => {
      try { finishTask(name, !(await job)); } catch (_) { finishTask(name, true); }
    }));
    if ($('.loader-status')) $('.loader-status').textContent = 'Ready to explore';
    // A tiny paint window, no artificial full-loop delay after the actual assets are ready.
    setTimeout(dismiss, Math.max(0, 500 - (performance.now() - bootStarted)));
  }

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
  $('.hero')?.after(story);

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

  let metrics = [], galleryMetric, raf = 0, active = true, lastY = -1, scrollTarget = scrollY, smoothY = scrollY;
  const styled = new Set();
  function transform(el, value, opacity) {
    if (!el) return;
    styled.add(el); el.style.transform = value;
    if (opacity !== undefined) el.style.opacity = opacity;
  }
  function measure() {
    // Remove previous transforms for stable layout-based scroll offsets.
    styled.forEach(el => { el.style.transform = ''; el.style.opacity = ''; });
    metrics = [];
    function add(selector, type) {
      $$(selector).forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        metrics.push({el, type, i, top: rect.top + scrollY, height: rect.height, words: type === 'heading' ? $$('.motion-word', el) : []});
      });
    }
    add('.section-head h2, .about-copy h2, .newsletter h2, .hero .tagline', 'heading');
    add('.section-head p, .about-copy p, .stat, .eyebrow, .foot-links li', 'reveal');
    add('.scroll-story', 'story');
    add('.cart', 'card'); add('.palette', 'palette'); add('.hero-banner', 'hero');
    add('.hero p.sub, .hero-ctas, .sprite-row', 'heroLayer');
    add('.motion-band-track', 'band'); add('.garage-frame', 'garage'); add('.contact-title', 'contact');
    if (stage) galleryMetric = { top: stage.getBoundingClientRect().top + scrollY, height: stage.offsetHeight, pinHeight: pin.offsetHeight, inset: parseFloat(getComputedStyle(pin).top) || 0, travel: Math.max(0, gallery.scrollWidth - (pin.clientWidth - parseFloat(getComputedStyle(pin).paddingLeft) - parseFloat(getComputedStyle(pin).paddingRight))) };
    lastY = -1; requestTick();
  }
  function render() {
    raf = 0;
    if (!enabled || !active) return;
    const vh = innerHeight, vw = innerWidth;
    scrollTarget = scrollY;
    smoothY += (scrollTarget - smoothY) * .16;
    if (Math.abs(scrollTarget - smoothY) < .15) smoothY = scrollTarget;
    if (Math.abs(lastY - smoothY) > .05) {
      const y = smoothY;
      root.style.setProperty('--page-progress', clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - vh)));
      for (const m of metrics) {
        const rel = m.top - y;
        if (rel > vh * 1.5 || rel + m.height < -vh) continue;
        const entry = clamp((vh * .97 - rel) / (vh * .6));
        const eased = 1 - Math.pow(1 - entry, 3);
        const through = clamp((vh - rel) / (vh + m.height));
        if (m.type === 'story') {
          const p = clamp((y - m.top + vh * .65) / (m.height - vh * .35));
          $$('.story-line', m.el).forEach((line, i) => {
            const enter = clamp((p - i * .13) / .35);
            const q = 1 - Math.pow(1 - enter, 2);
            const exit = clamp((p - .88) / .12);
            transform(line, `translate3d(${((1-q)*.95-exit*.15)*vw*(i%2?1:-1)}px,0,0)`, .08+.92*q);
          });
        } else if (m.type === 'heading') {
          m.words.forEach((word, i) => {
            const p = clamp(entry * 1.45 - (i / Math.max(m.words.length, 1)) * .42);
            const q = 1 - Math.pow(1 - p, 3);
            const x = (1 - q) * Math.min(vw * .7, 780) * (m.i % 2 ? 1 : -1);
            transform(word, `translate3d(${x}px,${(1-q)*35}px,0) rotate(${(1-q)*(m.i%2?4:-4)}deg)`, .12 + .88*q);
          });
        } else if (m.type === 'reveal') {
          const side = m.i % 2 ? 1 : -1;
          transform(m.el, `translate3d(${(1-eased)*side*70}px,${(1-eased)*30}px,0)`, .12+.88*eased);
        } else if (m.type === 'card') {
          const p = clamp(entry * 1.4 - (m.i % 3) * .12), q = 1-Math.pow(1-p,3);
          const drift = (through-.5) * (m.i%2? -28:28);
          transform(m.el, `translate3d(${(1-q)*(m.i%2?140:-140)}px,${(1-q)*100+drift}px,0) rotate(${(1-q)*(m.i%2?-9:9)+(through-.5)*3}deg)`, .15+.85*q);
        } else if (m.type === 'palette') {
          transform(m.el, `translate3d(${(1-eased)*130}px,${(through-.5)*-60}px,0) rotate(${(through-.5)*12}deg) scale(${.83+.17*eased})`);
          [...m.el.children].forEach((el,i) => transform(el, `translateY(${Math.sin(through*Math.PI*2+i*.8)*18}px)`));
        } else if (m.type === 'hero') {
          const p = clamp(y / vh);
          transform(m.el, `translate3d(${p*-70}px,${p*110}px,0) rotate(${-p*7}deg) scale(${1+p*.2})`, 1-p*.7);
        } else if (m.type === 'heroLayer') {
          const p = clamp(y/vh); transform(m.el, `translate3d(${p*(m.i%2?65:-65)}px,${p*(35+m.i*20)}px,0)`, 1-p*.85);
        } else if (m.type === 'band') {
          transform(m.el, `translate3d(${-320+(through-.5)*(m.i%2?660:-660)}px,0,0)`);
        } else if (m.type === 'garage') {
          transform(m.el, `translate3d(0,${(1-eased)*60}px,0) scale(${.9+.1*eased})`);
        } else if (m.type === 'contact') {
          transform(m.el, `translate3d(${(1-eased)*-180}px,0,0)`, .2+.8*eased);
          transform($('.contact-arrow',m.el), `rotate(${(through-.5)*70}deg)`);
        }
      }
      if (galleryMetric) {
        const m=galleryMetric, p=clamp((scrollY-m.top+m.inset)/Math.max(1,m.height-m.pinHeight));
        transform(gallery, `translate3d(${-p*m.travel}px,0,0)`);
        stage.style.setProperty('--gallery-progress', p);
        const count = gallery.children.length;
        counter.textContent = `${String(Math.min(count,Math.round(p*(count-1))+1)).padStart(2,'0')} — ${String(count).padStart(2,'0')}`;
      }
      lastY=y;
    }
    if (smoothY !== scrollTarget) requestTick();
  }
  function requestTick() { if (!raf && enabled && active) raf = requestAnimationFrame(render); }
  function applyMotion() {
    enabled = !reduced.matches && !manualPause;
    root.classList.toggle('motion-ready', enabled); root.classList.toggle('motion-off', !enabled);
    toggle.textContent = enabled ? 'MOTION ON' : 'MOTION OFF';
    toggle.setAttribute('aria-label', enabled ? 'Pause page motion' : 'Enable page motion');
    toggle.setAttribute('aria-pressed', String(enabled));
    styled.forEach(el => { el.style.transform=''; el.style.opacity=''; });
    if (enabled) { smoothY=scrollY; measure(); if (!dismissed) video?.play().catch(()=>{}); }
    else { video?.pause(); if (raf) cancelAnimationFrame(raf); raf=0; }
    // Keep the embedded scene's auto-rotation in step with the page motion preference.
    frame?.contentWindow?.postMessage({type:'pix3lware:motion',enabled}, garageOrigin);
  }
  toggle.addEventListener('click', () => { manualPause=enabled; try {sessionStorage.setItem('pix3lware-motion',manualPause?'off':'on');} catch (_) {} applyMotion(); });
  reduced.addEventListener('change',applyMotion);
  window.addEventListener('scroll',requestTick,{passive:true});
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(measure,120);});
  window.addEventListener('load',measure,{once:true});
  document.fonts?.ready.then(measure);
  document.addEventListener('visibilitychange',()=>{active=!document.hidden;if(active)requestTick();});
  document.addEventListener('pix3lware:entered',()=>{measure();});
  window.addEventListener('pageshow',event=>{if(event.persisted){dismiss();measure();}});
  applyMotion();
  boot().catch(dismiss);
})();
