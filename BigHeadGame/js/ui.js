/**
 * ui.js  –  Screen switching, HUD updates, score popups, result animation.
 * Listens to CustomEvents dispatched by game.js.
 */

// ── DOM References ────────────────────────────────────────────
let _scoreEl, _timeEl, _streakEl, _comboBanner, _timeBox;

document.addEventListener('DOMContentLoaded', () => {
  _scoreEl     = document.getElementById('game-score');
  _timeEl      = document.getElementById('game-time');
  _streakEl    = document.getElementById('game-streak');
  _comboBanner = document.getElementById('combo-banner');
  _timeBox     = document.getElementById('hud-time-box');
});

// ── Screen navigation ─────────────────────────────────────────

/** Show a screen by ID, hide all others. */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  else console.error(`Screen "${screenId}" not found`);
}

// ── Event Listeners (Decoupled from game logic) ───────────────

document.addEventListener('GAME_START', () => {
  if (_timeBox) _timeBox.classList.remove('danger');
  if (_comboBanner) _comboBanner.textContent = '';
});

document.addEventListener('SCORE_UPDATE', (e) => {
  const { score, timeRemaining, streak } = e.detail;
  
  if (_scoreEl)  _scoreEl.textContent  = score;
  if (_timeEl)   _timeEl.textContent   = timeRemaining;
  if (_streakEl) _streakEl.textContent = streak;

  if (timeRemaining <= 5) {
    if (_timeBox) _timeBox.classList.add('danger');
  }

  if (_comboBanner) {
    if      (streak >= 5) _comboBanner.textContent = `🔥 ${streak}× COMBO!`;
    else if (streak >= 3) _comboBanner.textContent = `⚡ ${streak}× Combo!`;
    else                  _comboBanner.textContent = '';
  }
});

document.addEventListener('TARGET_HIT', (e) => {
  const { holeEl, targetEl, hitType, scoreDelta } = e.detail;
  flashHole(holeEl, hitType);
  showScorePopup(targetEl, scoreDelta);
});

// ── Result animation ──────────────────────────────────────────

const _TICK_MS    = 65;    // ms between score decrement steps
const _BASE_PITCH = 460;   // starting frequency for tick sound
const _PITCH_RISE = 3;     // Hz added to pitch each tick

function showResult(score, faceDataUrl, targetScale = 1) {
  const counterEl     = document.getElementById('final-score');
  const msgEl         = document.getElementById('result-message');
  const btnGroup      = document.querySelector('#screen-result .btn-group');
  const headContainer = document.getElementById('result-head-container');
  const headImg       = document.getElementById('result-head-img');

  // Place face image
  if (headImg && faceDataUrl) headImg.src = faceDataUrl;

  // Hide message + buttons until animation ends
  if (msgEl)    msgEl.style.visibility    = 'hidden';
  if (btnGroup) btnGroup.style.visibility = 'hidden';

  // Instant-reset head scale before animation starts
  if (headContainer) {
    headContainer.style.transition = 'none';
    headContainer.style.transform  = 'translate(-50%, -50%) scale(1)';
  }

  // Edge case: zero or negative score — skip animation
  if (score <= 0) {
    if (counterEl) counterEl.textContent = 0;
    _revealResultMessage(0, msgEl, btnGroup);
    if (headContainer) {
      headContainer.style.transform = `translate(-50%, -50%) scale(${targetScale.toFixed(3)})`;
    }
    return;
  }

  const scaleStep  = (targetScale - 1) / score;
  let currentScore = score;
  let currentScale = 1;
  let pitch        = _BASE_PITCH;

  if (counterEl) counterEl.textContent = currentScore;

  // Small delay so screen fade-in finishes before animation starts
  setTimeout(() => {
    if (headContainer) headContainer.style.transition = 'transform 0.1s ease-out';

    const interval = setInterval(() => {
      currentScore--;
      currentScale += scaleStep;
      pitch = Math.min(_BASE_PITCH + 300, pitch + _PITCH_RISE);

      if (counterEl) counterEl.textContent = Math.max(0, currentScore);

      if (headContainer) {
        headContainer.style.transform = `translate(-50%, -50%) scale(${currentScale.toFixed(4)})`;
      }

      if (typeof playTick === 'function') playTick(pitch);

      if (currentScore <= 0) {
        clearInterval(interval);
        _revealResultMessage(score, msgEl, btnGroup);
        if (headContainer) {
          headContainer.style.transform = `translate(-50%, -50%) scale(${targetScale.toFixed(3)})`;
        }
      }
    }, _TICK_MS);
  }, 350);
}

function _revealResultMessage(score, msgEl, btnGroup) {
  if (msgEl) {
    if      (score <= 0)  msgEl.textContent = '😅 Better luck next time!';
    else if (score < 5)   msgEl.textContent = '🐭 Tiny score, tiny head. Keep practicing!';
    else if (score < 10)  msgEl.textContent = '😊 Not bad! Your head is growing…';
    else if (score < 20)  msgEl.textContent = '🔥 Nice work! That\'s a respectable big head!';
    else if (score < 35)  msgEl.textContent = '💥 Wow! You\'re a whacking machine!';
    else                  msgEl.textContent = '🏆 LEGENDARY! Your head is ENORMOUS!';

    msgEl.style.visibility = 'visible';
    msgEl.style.animation  = 'fadeInUp .4s ease both';
  }

  if (btnGroup) {
    btnGroup.style.visibility = 'visible';
    btnGroup.style.animation  = 'fadeInUp .4s ease .15s both';
  }
}

// ── Score popups ──────────────────────────────────────────────

function showScorePopup(nearEl, delta) {
  const container = document.getElementById('score-popups');
  if (!container) return;

  const rect  = nearEl.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className   = `score-popup ${delta > 0 ? 'plus' : 'minus'}`;
  popup.textContent = delta > 0 ? `+${delta}` : `${delta}`;
  popup.style.left  = `${rect.left + rect.width / 2 - 20}px`;
  popup.style.top   = `${rect.top - 10}px`;

  container.appendChild(popup);
  popup.addEventListener('animationend', () => popup.remove());
}

// ── Hole flash overlay ────────────────────────────────────────

function flashHole(holeEl, type) {
  const flash = document.createElement('div');
  flash.className = `hole-hit-flash ${type}`;
  holeEl.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove());
}
