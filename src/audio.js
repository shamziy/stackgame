// Web Audio sound effects. Exposes one global: sound
const sound = (() => {
  let ctx = null;
  let muted = false;

  function init() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) ctx = new Ctor();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(value) { muted = value; }

  function tone(freq, dur, type = 'sine', vol = 0.15, slideTo = null) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pentatonic, climbs with each perfect

  const sfx = {
    drop() { tone(160, 0.12, 'triangle', 0.2, 80); },
    perfect(combo) {
      const step = SCALE[Math.min(combo - 1, SCALE.length - 1)];
      tone(440 * Math.pow(2, step / 12), 0.35, 'sine', 0.18);
    },
    record() {
      [0, 4, 7, 12].forEach((step, i) => {
        setTimeout(() => tone(523 * Math.pow(2, step / 12), 0.25, 'triangle', 0.15), i * 90);
      });
    },
    fail() { tone(220, 0.5, 'sawtooth', 0.12, 55); },
  };

  return { init, setMuted, sfx };
})();
