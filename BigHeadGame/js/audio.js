/**
 * audio.js  –  Web Audio API sound effects (no external files)
 * All functions are plain globals – no import/export needed.
 */

let _ctx = null;

function _getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

/** Call once on first user interaction to unlock the AudioContext. */
function initAudio() {
  try { _getCtx(); } catch (e) { /* ignore */ }
}

// ── Mobile Compatibility: Unlock AudioContext ─────────────────
function _unlockAudioMobile() {
  try {
    const ctx = _getCtx();
    if (ctx.state === 'suspended') {
      // Resume context and fail silently if blocked
      ctx.resume().catch(() => {}); 
    }
  } catch (e) { /* ignore */ }
}

// Attach ONE-TIME listeners to unlock audio on first interaction
document.addEventListener('pointerdown', _unlockAudioMobile, { once: true });
document.addEventListener('touchstart', _unlockAudioMobile, { once: true });

// ── Internal tone helper ──────────────────────────────────────

function _playTone({ freq = 440, type = 'sine', duration = 0.12, gain = 0.3, decay = 0.1, delay = 0 } = {}) {
  try {
    const ctx = _getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.connect(env);
    env.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    env.gain.setValueAtTime(0, ctx.currentTime + delay);
    env.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration + decay);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + decay + 0.05);
  } catch (e) { /* audio not available */ }
}

// ── Public sound effects ──────────────────────────────────────

/** Satisfying "pop" on hitting a mole */
function playHit() {
  _playTone({ freq: 600, type: 'sine', duration: 0.07, gain: 0.25, decay: 0.08 });
  _playTone({ freq: 900, type: 'sine', duration: 0.05, gain: 0.15, decay: 0.06, delay: 0.05 });
}

/** Penalty "thud" on hitting own face */
function playPenalty() {
  _playTone({ freq: 180, type: 'sawtooth', duration: 0.15, gain: 0.3, decay: 0.2 });
  _playTone({ freq: 120, type: 'square', duration: 0.1, gain: 0.2, decay: 0.15, delay: 0.06 });
}

/** Short tick played on each result-screen countdown step — pitch rises each call */
function playTick(pitch) {
  _playTone({ freq: pitch || 520, type: 'sine', duration: 0.03, gain: 0.18, decay: 0.04 });
}

/** Three-note descending fanfare on game over */
function playGameOver() {
  [0, 0.12, 0.24].forEach((delay, i) => {
    _playTone({ freq: [400, 320, 250][i], type: 'square', duration: 0.15, gain: 0.2, decay: 0.12, delay });
  });
}
