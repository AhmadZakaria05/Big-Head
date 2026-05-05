/**
 * game.js  –  Core Whack-a-Mole engine (v3 — Scalable & Responsive)
 * Uses an Event-Driven Architecture and centralized state.
 * Depends on: audio.js, ui.js
 */

// ─────────────────────────────────────────────────────────────
//  CONFIGURATION SYSTEM
// ─────────────────────────────────────────────────────────────

const GameConfig = {
  duration: 20,           // total seconds
  spawn: {
    easyMin: 750, easyMax: 1000,
    hardMin: 280, hardMax: 450,
  },
  lifetime: {
    easyMin: 1200, easyMax: 1600,
    hardMin: 550,  hardMax: 900,
  },
  faceProb: {
    easy: 0.22, hard: 0.38
  },
  maxActive: 3,
  score: {
    mole: 1, face: -2
  },
  headGrowth: {
    baseStep: 0.04,
    penalty: 0.08,
    maxScale: 2.5
  }
};

// ─────────────────────────────────────────────────────────────
//  CENTRAL STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────

const GameState = {
  score:          0,
  streak:         0,
  timeRemaining:  GameConfig.duration,
  elapsedSeconds: 0,
  isPlaying:      false,
  faceDataUrl:    '',
  holes:          [],
  spawnTimer:     null,
  countdownTimer: null,
  headGrowth:     0,
};

let _gridEl;

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────

/** Build the grid once on page load. */
function initGame() {
  _gridEl = document.getElementById('mole-grid');
  _buildGrid();
}

/** Start a new round. */
function startGame(faceDataUrl) {
  GameState.score          = 0;
  GameState.streak         = 0;
  GameState.timeRemaining  = GameConfig.duration;
  GameState.elapsedSeconds = 0;
  GameState.isPlaying      = true;
  GameState.faceDataUrl    = faceDataUrl || '';
  GameState.headGrowth     = 0;

  _clearAllTimers();
  _resetAllHoles();
  
  document.dispatchEvent(new CustomEvent('GAME_START'));
  _dispatchUpdate();

  GameState.countdownTimer = setInterval(_tickCountdown, 1000);
  _scheduleNextSpawn();
}

function _dispatchUpdate() {
  document.dispatchEvent(new CustomEvent('SCORE_UPDATE', {
    detail: { 
      score: GameState.score, 
      timeRemaining: GameState.timeRemaining, 
      streak: GameState.streak 
    }
  }));
}

// ─────────────────────────────────────────────────────────────
//  DIFFICULTY SCALING
// ─────────────────────────────────────────────────────────────

function _difficultyFactor() {
  return GameState.elapsedSeconds / GameConfig.duration;
}

function _lerp(easy, hard) {
  return easy + (_difficultyFactor() * (hard - easy));
}

function _spawnInterval() {
  const min = _lerp(GameConfig.spawn.easyMin, GameConfig.spawn.hardMin);
  const max = _lerp(GameConfig.spawn.easyMax, GameConfig.spawn.hardMax);
  return min + Math.random() * (max - min);
}

function _itemLifetime() {
  const min = _lerp(GameConfig.lifetime.easyMin, GameConfig.lifetime.hardMin);
  const max = _lerp(GameConfig.lifetime.easyMax, GameConfig.lifetime.hardMax);
  return min + Math.random() * (max - min);
}

function _faceProbability() {
  return _lerp(GameConfig.faceProb.easy, GameConfig.faceProb.hard);
}

// ─────────────────────────────────────────────────────────────
//  GRID CONSTRUCTION
// ─────────────────────────────────────────────────────────────

function _buildGrid() {
  if (!_gridEl) return;
  _gridEl.innerHTML = '';
  GameState.holes  = [];

  for (let i = 0; i < 9; i++) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    hole.id        = `hole-${i}`;

    const target = document.createElement('div');
    target.className = 'hole-target';
    hole.appendChild(target);
    _gridEl.appendChild(hole);

    const holeData = {
      el:        hole,
      targetEl:  target,
      active:    false,
      type:      null,
      isHit:     false,
      hideTimer: null,
    };
    GameState.holes.push(holeData);

    // Use pointerdown instead of click for instant touch response
    target.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      _handleTargetClick(holeData);
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  SPAWNING
// ─────────────────────────────────────────────────────────────

function _scheduleNextSpawn() {
  if (!GameState.isPlaying) return;
  const delay = _spawnInterval();
  GameState.spawnTimer = setTimeout(_spawnTarget, delay);
}

function _spawnTarget() {
  if (!GameState.isPlaying) return;

  const activeCount = GameState.holes.filter(h => h.active).length;
  if (activeCount >= GameConfig.maxActive) {
    GameState.spawnTimer = setTimeout(_spawnTarget, 200);
    return;
  }

  const inactive = GameState.holes.filter(h => !h.active);
  if (inactive.length === 0) {
    _scheduleNextSpawn();
    return;
  }

  const activeIndexes = GameState.holes
    .map((h, i) => (h.active ? i : -1))
    .filter(i => i !== -1);

  const nearbyInactive = inactive.filter(h => {
    const idx = GameState.holes.indexOf(h);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    return activeIndexes.some(ai => {
      const ar = Math.floor(ai / 3);
      const ac = ai % 3;
      return Math.abs(ar - row) <= 1 && Math.abs(ac - col) <= 1;
    });
  });

  const candidates =
    (nearbyInactive.length > 0 && Math.random() < 0.40)
      ? nearbyInactive
      : inactive;

  const holeData = candidates[Math.floor(Math.random() * candidates.length)];
  const isFace = Math.random() < _faceProbability();
  
  _activateHole(holeData, isFace ? 'face' : 'mole');
  _scheduleNextSpawn();
}

// ─────────────────────────────────────────────────────────────
//  HOLE ACTIVATION / DEACTIVATION
// ─────────────────────────────────────────────────────────────

function _activateHole(holeData, type) {
  holeData.active = true;
  holeData.type   = type;
  holeData.isHit  = false;

  const target = holeData.targetEl;
  target.className = `hole-target ${type === 'mole' ? 'mole' : 'face-target'}`;
  target.style.pointerEvents = '';

  if (type === 'mole') {
    target.innerHTML = '🐭';
  } else {
    const img = document.createElement('img');
    img.src = GameState.faceDataUrl || '';
    img.alt = 'Your face';
    target.innerHTML = '';
    target.appendChild(img);
  }

  holeData.el.classList.add('active');

  const lifetime = _itemLifetime();
  holeData.hideTimer = setTimeout(() => {
    if (holeData.active && !holeData.isHit) {
      _deactivateHole(holeData);
    }
  }, lifetime);
}

function _deactivateHole(holeData) {
  clearTimeout(holeData.hideTimer);
  holeData.active    = false;
  holeData.type      = null;
  holeData.isHit     = false;
  holeData.hideTimer = null;
  holeData.el.classList.remove('active');
  holeData.targetEl.className        = 'hole-target';
  holeData.targetEl.innerHTML        = '';
  holeData.targetEl.style.pointerEvents = '';
}

function _resetAllHoles() {
  GameState.holes.forEach(h => {
    clearTimeout(h.hideTimer);
    h.active    = false;
    h.type      = null;
    h.isHit     = false;
    h.hideTimer = null;
    h.el.classList.remove('active');
    h.targetEl.className          = 'hole-target';
    h.targetEl.innerHTML          = '';
    h.targetEl.style.pointerEvents = '';
  });
}

// ─────────────────────────────────────────────────────────────
//  INPUT HANDLING
// ─────────────────────────────────────────────────────────────

function _handleTargetClick(holeData) {
  if (!GameState.isPlaying) return;
  if (!holeData.active) return;
  if (holeData.isHit) return;
  
  holeData.isHit = true;
  holeData.targetEl.style.pointerEvents = 'none';
  clearTimeout(holeData.hideTimer);

  const type = holeData.type;
  holeData.targetEl.classList.add('whacked');

  let hitType = '';
  let scoreDelta = 0;

  if (type === 'mole') {
    scoreDelta = GameConfig.score.mole;
    GameState.score += scoreDelta;
    GameState.streak += 1;
    hitType = 'good';

    const currentScale = 1 + GameState.headGrowth;
    const diminishing = 1 - (currentScale / GameConfig.headGrowth.maxScale);
    GameState.headGrowth += GameConfig.headGrowth.baseStep * Math.max(0, diminishing);
    GameState.headGrowth = Math.min(GameConfig.headGrowth.maxScale - 1, GameState.headGrowth);

    if (typeof playHit === 'function') playHit();
  } else {
    scoreDelta = GameConfig.score.face;
    GameState.score = Math.max(0, GameState.score + scoreDelta);
    GameState.streak = 0;
    hitType = 'bad';

    GameState.headGrowth -= GameConfig.headGrowth.penalty;
    GameState.headGrowth = Math.max(0, GameState.headGrowth);

    if (typeof playPenalty === 'function') playPenalty();
  }

  // Dispatch TARGET_HIT event for UI
  document.dispatchEvent(new CustomEvent('TARGET_HIT', {
    detail: { 
      holeEl: holeData.el, 
      targetEl: holeData.targetEl, 
      hitType: hitType, 
      scoreDelta: scoreDelta 
    }
  }));

  _dispatchUpdate();
  setTimeout(() => _deactivateHole(holeData), 250);
}

// ─────────────────────────────────────────────────────────────
//  COUNTDOWN & GAME END
// ─────────────────────────────────────────────────────────────

function _tickCountdown() {
  GameState.timeRemaining--;
  GameState.elapsedSeconds++;
  _dispatchUpdate();

  if (GameState.timeRemaining <= 0) {
    _endGame();
  }
}

function _endGame() {
  GameState.isPlaying = false;
  _clearAllTimers();
  _resetAllHoles();
  
  const finalScale = 1 + GameState.headGrowth;
  
  document.dispatchEvent(new CustomEvent('GAME_END', {
    detail: {
      score: GameState.score,
      finalScale: finalScale
    }
  }));
}

function _clearAllTimers() {
  clearTimeout(GameState.spawnTimer);
  clearInterval(GameState.countdownTimer);
  GameState.spawnTimer     = null;
  GameState.countdownTimer = null;
}

