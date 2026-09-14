(() => {
  'use strict';
  const root = document.documentElement;
  // Original, gently synthesized game ambience. It is ready by default and
  // unlocks as soon as the browser permits audio after the first interaction.
  const sound = document.createElement('button');
  sound.type = 'button'; sound.className = 'sound-toggle';
  sound.setAttribute('aria-label', 'Mute ambient game music');
  sound.setAttribute('aria-pressed', 'true');
  sound.classList.add('sound-on');
  sound.innerHTML = '<span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="sound-label">SOUND ON</span>';
  document.body.append(sound);
  let audio, master, wet, musicOn = true, nextChord = 0, chordIndex = 0, scheduler, unlocked = false;
  const chords = [[57,60,64,69], [53,57,60,65], [48,55,60,64], [55,59,62,67]];
  const melody = [0, 2, 3, 1, 2, 0, 3, 2];
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  function voice(midi, start, length, volume, type = 'sine') {
    const oscillator = audio.createOscillator(), envelope = audio.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency(midi);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(1.6, length * .2));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
    oscillator.connect(envelope); envelope.connect(master); envelope.connect(wet);
    oscillator.start(start); oscillator.stop(start + length + .05);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  function scheduleMusic() {
    if (!musicOn || audio.state !== 'running') return;
    if (nextChord < audio.currentTime) nextChord = audio.currentTime + .08;
    while (nextChord < audio.currentTime + 1) {
      const chord = chords[chordIndex % chords.length];
      chord.forEach((note, i) => voice(note, nextChord + i * .06, 9.8, .045));
      voice(chord[0] - 12, nextChord, 7.8, .04);
      melody.forEach((index, i) => voice(chord[index] + 12, nextChord + i + .35, 2.1, .018, 'triangle'));
      nextChord += 8; chordIndex++;
    }
  }
  function createAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Audio unavailable');
    audio = new Audio();
    master = audio.createGain(); master.gain.value = 0;
    const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2600;
    const compressor = audio.createDynamicsCompressor();
    master.connect(filter); filter.connect(compressor); compressor.connect(audio.destination);
    const reverb = audio.createConvolver();
    const impulse = audio.createBuffer(2, audio.sampleRate * 3, audio.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * (1-i/data.length)**3 * .35;
    }
    reverb.buffer = impulse; wet = audio.createGain(); wet.gain.value = .3;
    wet.connect(reverb); reverb.connect(master);
    scheduler = setInterval(scheduleMusic, 250);
  }
  async function unlockMusic() {
    if (unlocked || !musicOn) return;
    try {
      if (!audio) createAudio();
      await audio.resume();
      master.gain.setTargetAtTime(.38, audio.currentTime, .2);
      nextChord = audio.currentTime + .05;
      scheduleMusic();
      unlocked = true;
    } catch (_) {}
  }
  // Browsers require a user gesture before audible audio; the first tap/click starts it.
  document.addEventListener('pointerdown', unlockMusic, {once:false, passive:true});
  sound.addEventListener('click', async () => {
    try {
      if (!audio) createAudio();
      await audio.resume();
      musicOn = !musicOn;
      unlocked = true;
      master.gain.cancelScheduledValues(audio.currentTime);
      master.gain.setTargetAtTime(musicOn ? .38 : 0, audio.currentTime, .2);
      if (musicOn) { nextChord = audio.currentTime + .05; scheduleMusic(); }
      sound.classList.toggle('sound-on', musicOn);
      sound.querySelector('.sound-label').textContent = musicOn ? 'SOUND ON' : 'SOUND OFF';
      sound.setAttribute('aria-pressed', String(musicOn));
      sound.setAttribute('aria-label', musicOn ? 'Mute ambient game music' : 'Play ambient game music');
    } catch (_) { sound.querySelector('.sound-label').textContent = 'SOUND UNAVAILABLE'; }
  });
  unlockMusic();

  const canvas = document.createElement('canvas'); canvas.className = 'pixel-atmosphere';
  canvas.setAttribute('aria-hidden', 'true'); document.body.append(canvas);
  const context = canvas.getContext('2d');
  const cursor = document.createElement('div'); cursor.className = 'cursor-ring';
  cursor.setAttribute('aria-hidden', 'true'); document.body.append(cursor);
  const finePointer = matchMedia('(pointer: fine)');
  let width = innerWidth, height = innerHeight, pointerX = -100, pointerY = -100;
  let cursorX = pointerX, cursorY = pointerY, tick = 0, previousTime = 0;
  let motion = root.classList.contains('motion-ready');
  const particles = Array.from({length: 64}, (_, i) => ({
    x: Math.random(), y: Math.random(), depth: .1 + Math.random()*.65,
    size: 2 + (i%3)*2, color: ['#2fbd8e','#ffce3d','#ff4d5e'][i%3]
  }));
  function resize() {
    width = innerWidth; height = innerHeight;
    const scale = Math.min(devicePixelRatio, 2);
    canvas.width = width*scale; canvas.height = height*scale;
    context?.setTransform(scale,0,0,scale,0,0);
  }
  function draw(time) {
    tick = 0;
    if (document.hidden || !motion) return;
    const ease = 1 - Math.exp(-16 * Math.min((time - previousTime) / 1000, .05));
    previousTime = time;
    cursorX += (pointerX-cursorX)*ease; cursorY += (pointerY-cursorY)*ease;
    cursor.style.transform = `translate3d(${cursorX-cursor.offsetWidth/2}px,${cursorY-cursor.offsetHeight/2}px,0) rotate(45deg)`;
    if (context) {
      context.clearRect(0,0,width,height);
      for (const p of particles) {
        const x = (p.x*width + Math.sin(time*.00015+p.y*10)*35 + (pointerX-width/2)*p.depth*.015 + width) % width;
        const y = ((p.y*height - (window.pix3lwareScroll ?? scrollY)*p.depth*.55 - time*.004*p.depth) % height + height) % height;
        context.globalAlpha = .15+p.depth*.4; context.fillStyle = p.color;
        context.fillRect(Math.round(x),Math.round(y),p.size,p.size);
      }
    }
    tick = requestAnimationFrame(draw);
  }
  function start() { if (!tick && motion && !document.hidden) tick = requestAnimationFrame(draw); }
  window.addEventListener('pointermove', event => {
    if (!finePointer.matches) return;
    pointerX = event.clientX; pointerY = event.clientY;
    cursor.classList.toggle('cursor-visible', motion);
    cursor.classList.toggle('cursor-link', !!event.target.closest('a,button,input,select'));
  }, {passive:true});
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) cursor.classList.remove('cursor-visible'); });
  document.addEventListener('pix3lware:motion-change', event => {
    motion = event.detail.enabled;
    canvas.hidden = !motion;
    if (!motion) { cancelAnimationFrame(tick); tick=0; cursor.classList.remove('cursor-visible'); }
    else start();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (audio) audio.suspend().catch(()=>{}); }
    else { if (audio && musicOn) audio.resume().then(scheduleMusic).catch(()=>{}); start(); }
  });
  window.addEventListener('pagehide', () => { if (scheduler) clearInterval(scheduler); });
  window.addEventListener('pageshow', event => { if (event.persisted && audio) scheduler = setInterval(scheduleMusic,250); });
  window.addEventListener('resize', resize, {passive:true});
  resize(); start();
})();
