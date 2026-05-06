/**
 * main.js  –  Application entry point & screen navigation.
 * All functions are plain globals – no import/export needed.
 * Depends on: audio.js, ui.js, leaderboard.js, camera.js, game.js
 *             (all loaded via <script> tags before this file)
 */

// ── Central app state ─────────────────────────────────────────
const _app = {
  playerName:  '',
  faceDataUrl: '',
};

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Build the 3×3 mole grid
  initGame();

  // Start background particle canvas
  _initParticles();

  // Grab shared DOM refs
  const videoEl        = document.getElementById('camera-video');
  const canvasEl       = document.getElementById('camera-canvas');
  const statusEl       = document.getElementById('camera-status');
  const captureBtn     = document.getElementById('btn-capture');
  const retakeBtn      = document.getElementById('btn-retake');
  const playFaceBtn    = document.getElementById('btn-play-with-face');
  const facePreview    = document.getElementById('face-preview-wrap');
  const facePreviewImg = document.getElementById('face-preview-img');
  const scanLine       = document.getElementById('scan-line');
  const leaderListEl   = document.getElementById('leaderboard-list');

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

  // ── START SCREEN ────────────────────────────────────────────

  document.getElementById('btn-start').addEventListener('click', () => {
    // 1. Get exact name without modifying or normalizing
    const rawName = document.getElementById('player-name').value;

    // 2. Validation Rules: Not empty, at least 2 chars
    if (!rawName || rawName.length < 2) {
      alert('Name must be at least 2 characters long.');
      return;
    }

    // 3. Duplicate Check: Exact match (case-sensitive)
    if (typeof getScores === 'function') {
      const scores = getScores();
      const isDuplicate = scores.some(entry => entry.name === rawName);
      
      if (isDuplicate) {
        alert('This name is already used');
        return;
      }
    }

    initAudio(); // unlock AudioContext on first user gesture
    
    // 4. Store exactly as entered
    _app.playerName = rawName;

    // Navigate to camera screen
    _goToCamera(videoEl, canvasEl, captureBtn, retakeBtn, playFaceBtn, facePreview, setStatus);
  });

  document.getElementById('btn-show-leaderboard').addEventListener('click', () => {
    renderLeaderboard(leaderListEl);
    showScreen('screen-leaderboard');
  });

  // ── CAMERA SCREEN ───────────────────────────────────────────

  captureBtn.addEventListener('click', async () => {
    initAudio();
    captureBtn.disabled     = true;
    captureBtn.textContent  = '⏳ Detecting…';
    if (scanLine) scanLine.style.display = 'block';
    setStatus('Detecting face…');

    try {
      const dataUrl = await captureFace(videoEl, canvasEl);
      _app.faceDataUrl = dataUrl;

      if (facePreviewImg) facePreviewImg.src = dataUrl;
      if (facePreview)    facePreview.style.display = 'block';

      captureBtn.style.display  = 'none';
      if (retakeBtn)    retakeBtn.style.display   = 'block';
      if (playFaceBtn)  playFaceBtn.style.display = 'block';
      if (scanLine)     scanLine.style.display    = 'none';
      setStatus('Face captured! ✅');
    } catch (err) {
      console.error(err);
      captureBtn.disabled    = false;
      captureBtn.textContent = '📷 Take Photo';
      if (scanLine) scanLine.style.display = 'none';
      setStatus('Could not detect face. Try again.');
    }
  });

  if (retakeBtn) {
    retakeBtn.addEventListener('click', () => {
      if (facePreview)  facePreview.style.display  = 'none';
      captureBtn.style.display  = 'block';
      captureBtn.disabled       = false;
      captureBtn.textContent    = '📷 Take Photo';
      if (retakeBtn)   retakeBtn.style.display   = 'none';
      if (playFaceBtn) playFaceBtn.style.display = 'none';
      _app.faceDataUrl = '';
      setStatus('Position your face and take a photo.');
    });
  }

  if (playFaceBtn) {
    playFaceBtn.addEventListener('click', () => {
      stopCamera(videoEl);
      showScreen('screen-game');
      startGame(_app.faceDataUrl);
    });
  }

  // ── RESULT SCREEN ───────────────────────────────────────────

  document.getElementById('btn-play-again').addEventListener('click', () => {
    showScreen('screen-start');
    const nameInput = document.getElementById('player-name');
    if (nameInput) nameInput.value = _app.playerName === 'Anonymous' ? '' : _app.playerName;
  });

  document.getElementById('btn-leaderboard-from-result').addEventListener('click', () => {
    renderLeaderboard(leaderListEl);
    showScreen('screen-leaderboard');
  });

  // ── LEADERBOARD SCREEN ──────────────────────────────────────

  document.getElementById('btn-home').addEventListener('click', () => {
    showScreen('screen-start');
  });

  function handleResetLeaderboard() {
    if (!confirm('Are you sure you want to reset the leaderboard?')) {
      return;
    }

    const password = prompt('Enter password to reset leaderboard:');
    if (password !== 'AZAA2005') {
      alert('Wrong password');
      return;
    }

    // Required by user instruction
    localStorage.removeItem('leaderboard');
    // Maintain existing leaderboard logic
    if (typeof clearScores === 'function') clearScores();
    
    if (typeof renderLeaderboard === 'function') renderLeaderboard(leaderListEl);
    
    alert('Leaderboard has been reset');
  }

  const btnResetLb = document.getElementById('btn-reset-leaderboard');
  if (btnResetLb) {
    btnResetLb.addEventListener('click', handleResetLeaderboard);
  }
});

// ── Camera flow ───────────────────────────────────────────────

async function _goToCamera(videoEl, canvasEl, captureBtn, retakeBtn, playFaceBtn, facePreview, setStatus) {
  showScreen('screen-camera');

  // Reset camera screen UI
  if (captureBtn)  { captureBtn.style.display  = 'block'; captureBtn.disabled = true; captureBtn.textContent = '📷 Take Photo'; }
  if (retakeBtn)   retakeBtn.style.display   = 'none';
  if (playFaceBtn) playFaceBtn.style.display = 'none';
  if (facePreview) facePreview.style.display = 'none';
  setStatus('Initializing camera…');

  const ok = await startCamera(videoEl);
  if (!ok) {
    setStatus('❌ Camera unavailable. Please allow camera permissions.');
    if (captureBtn) captureBtn.disabled = false;
    return;
  }

  setStatus('Loading face detection…');
  const modelsOk = await loadFaceModels();
  setStatus(modelsOk
    ? 'Ready! Center your face and take a photo. 📸'
    : 'Ready! Photo will be cropped automatically. 📸');

  if (captureBtn) captureBtn.disabled = false;
}

// ── Game Event Handlers ───────────────────────────────────────

document.addEventListener('GAME_END', (e) => {
  const { score, finalScale } = e.detail;
  if (typeof playGameOver === 'function') playGameOver();
  saveScore(_app.playerName, score);
  showScreen('screen-result');
  showResult(score, _app.faceDataUrl, finalScale);
});

// ── Background particles ──────────────────────────────────────

function _initParticles() {
  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  Math.random() * 1.8 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      a:  Math.random() * 0.6 + 0.1,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H) / 1.5);
    grad.addColorStop(0, 'rgba(30,20,60,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,180,255,${p.a})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = W;  if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;  if (p.y > H) p.y = 0;
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  particles = Array.from({ length: 80 }, makeParticle);
  draw();
}
