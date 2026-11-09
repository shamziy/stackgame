// Input, HUD, best score, sky and stars, camera follow and the render loop.
(function () {
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score');
  const toastEl = $('toast');
  const overlay = $('overlay');
  const titleEl = $('title');
  const subEl = $('sub');
  const overlayBest = $('overlay-best');
  const bestEl = $('best');
  const bestChip = $('bestchip');
  const muteBtn = $('mute');
  const starsCanvas = $('stars');

  function fatal(message) {
    titleEl.textContent = 'Could not start the game';
    subEl.textContent = message;
    overlay.classList.remove('hidden');
  }

  window.addEventListener('error', (e) => fatal(e.message));

  if (typeof THREE === 'undefined') {
    fatal('Three.js did not load. Check your internet connection and reload.');
    return;
  }

  const BEST_KEY = 'tower-stack-best';
  const MUTE_KEY = 'tower-stack-muted';
  const SLAB_HALF = 0.5;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, String(value)); } catch (e) { /* storage blocked */ } }

  let best = Number(read(BEST_KEY)) || 0;
  let muted = read(MUTE_KEY) === '1';
  let brokeRecord = false;
  let lockedUntil = 0;

  function syncMuteButton() {
    muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
    muteBtn.setAttribute('aria-pressed', String(muted));
  }

  bestEl.textContent = best;
  sound.setMuted(muted);
  syncMuteButton();

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }

  function showToast(text, gold) {
    toastEl.textContent = text;
    toastEl.classList.toggle('gold', !!gold);
    restart(toastEl, 'show');
  }

  let three;
  try {
    three = createScene($('game'));
  } catch (e) {
    fatal('WebGL is not available in this browser. Try Chrome, Edge, Firefox or Safari.');
    return;
  }
  const { renderer, scene, camera } = three;

  const game = new Game(scene, {
    onScore(n) {
      scoreEl.textContent = n;
      if (n === 0) {
        brokeRecord = false;
        bestChip.classList.remove('record');
        return;
      }
      if (n > best) {
        const firstBreak = !brokeRecord && best > 0;
        best = n;
        brokeRecord = true;
        write(BEST_KEY, best);
        bestEl.textContent = best;
        bestChip.classList.add('record');
        restart(bestChip, 'bump');
        if (firstBreak) {
          showToast('New best!', true);
          sound.sfx.record();
        }
      }
    },
    onPerfect(combo) {
      showToast(combo > 1 ? 'Perfect x' + combo : 'Perfect');
      sound.sfx.perfect(combo);
    },
    onDrop() { sound.sfx.drop(); },
    onOver(score) {
      sound.sfx.fail();
      titleEl.textContent = brokeRecord && score > 0 ? 'New best: ' + score : 'Fell at ' + score;
      subEl.textContent = 'Tap, click or press Space to restart.';
      overlayBest.textContent = 'Best: ' + best;
      overlay.classList.remove('hidden');
      lockedUntil = performance.now() + 500;
    },
  });

  overlayBest.textContent = best ? 'Best: ' + best : '';

  function input() {
    sound.init();
    if (performance.now() < lockedUntil) return;
    if (game.state === 'over') game.reset();
    game.tap();
    if (game.state === 'play') overlay.classList.add('hidden');
  }

  window.addEventListener('pointerdown', input);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) input();
    }
  });

  muteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    write(MUTE_KEY, muted ? '1' : '0');
    sound.setMuted(muted);
    syncMuteButton();
    muteBtn.blur();
  });

  // Sky: dusk at the bottom of the tower, deep space as it climbs
  const SKY = {
    dusk: [[28, 27, 58], [91, 58, 107], [232, 148, 106]],
    night: [[6, 5, 22], [24, 18, 62], [70, 46, 120]],
  };
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  let skyK = 0;
  let appliedK = -1;

  function applySky(k) {
    const c = SKY.dusk.map((dusk, i) => 'rgb(' + mix(dusk, SKY.night[i], k).join(',') + ')');
    document.body.style.background = 'linear-gradient(' + c[0] + ' 0%, ' + c[1] + ' 55%, ' + c[2] + ' 100%)';
    starsCanvas.style.opacity = Math.min(1, k * 1.4);
  }

  const starsCtx = starsCanvas.getContext('2d');
  let stars = [];

  function sizeStars() {
    starsCanvas.width = window.innerWidth;
    starsCanvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random() * starsCanvas.width,
        y: Math.random() * starsCanvas.height,
        r: Math.random() * 1.4 + 0.3,
        p: Math.random() * Math.PI * 2,
      });
    }
  }
  sizeStars();
  window.addEventListener('resize', sizeStars);

  function drawStars(now) {
    if (skyK < 0.05) return;
    starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
    starsCtx.fillStyle = '#fff';
    for (const s of stars) {
      starsCtx.globalAlpha = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(now / 700 + s.p);
      starsCtx.beginPath();
      starsCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      starsCtx.fill();
    }
  }

  let camY = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    game.update(dt);

    const targetY = Math.max(0, game.height - SLAB_HALF);
    camY += (targetY - camY) * Math.min(dt * 4, 1);
    camera.position.set(4, camY + 4, 4);
    camera.lookAt(0, camY, 0);

    skyK += (Math.min(game.score / 60, 1) - skyK) * Math.min(dt * 1.5, 1);
    if (Math.abs(skyK - appliedK) > 0.002) {
      applySky(skyK);
      appliedK = skyK;
    }
    drawStars(now);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
