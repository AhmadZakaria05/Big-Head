/**
 * camera.js  –  Webcam access + face-api.js face detection & crop.
 * All functions are plain globals – no import/export needed.
 * Depends on: face-api.js global (loaded via <script> in index.html)
 */

let _stream = null;

const _MODELS_URL = 'https://vladmandic.github.io/face-api/model';

// ── Face model loading ────────────────────────────────────────

/**
 * Load the TinyFaceDetector model from CDN.
 * Returns true on success, false on failure.
 */
async function loadFaceModels() {
  try {
    if (typeof faceapi === 'undefined') {
      console.warn('face-api.js not loaded yet');
      return false;
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri(_MODELS_URL);
    return true;
  } catch (err) {
    console.error('Face model load failed:', err);
    return false;
  }
}

// ── Camera ────────────────────────────────────────────────────

/** Start the webcam and pipe it into videoElement. */
async function startCamera(videoElement) {
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
    });
    videoElement.srcObject = _stream;
    await new Promise(resolve => { videoElement.onloadedmetadata = () => resolve(); });
    return true;
  } catch (err) {
    console.error('Camera error:', err);
    return false;
  }
}

/** Stop all webcam tracks. */
function stopCamera(videoElement) {
  if (_stream) {
    _stream.getTracks().forEach(t => t.stop());
    _stream = null;
  }
  if (videoElement) videoElement.srcObject = null;
}

// ── Face capture & crop ───────────────────────────────────────

/**
 * Capture a frame, detect a face, crop around it, return 300×300 data-URL.
 * Falls back to a centre-square crop if face detection fails.
 */
async function captureFace(videoEl, canvasEl) {
  const vw = videoEl.videoWidth  || 640;
  const vh = videoEl.videoHeight || 640;

  // Draw mirrored frame (matches CSS scaleX(-1) preview)
  canvasEl.width  = vw;
  canvasEl.height = vh;
  const ctx = canvasEl.getContext('2d');
  ctx.save();
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, vw, vh);
  ctx.restore();

  let cropRect = null;

  // Try face detection
  try {
    if (typeof faceapi !== 'undefined' && faceapi.nets.tinyFaceDetector.isLoaded) {
      const detection = await faceapi.detectSingleFace(
        canvasEl,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
      );
      if (detection) {
        const { x, y, width, height } = detection.box;
        const pad = Math.max(width, height) * 0.40;
        cropRect = {
          x: Math.max(0, x - pad),
          y: Math.max(0, y - pad),
          w: Math.min(vw, width  + pad * 2),
          h: Math.min(vh, height + pad * 2),
        };
      }
    }
  } catch (e) {
    console.warn('Face detection error, using fallback:', e);
  }

  // Fallback: centre square crop
  if (!cropRect) {
    const size = Math.min(vw, vh) * 0.7;
    cropRect = { x: (vw - size) / 2, y: (vh - size) / 2, w: size, h: size };
  }

  // Make square by using larger dimension, re-centred
  const side = Math.max(cropRect.w, cropRect.h);
  const cx   = cropRect.x + cropRect.w / 2;
  const cy   = cropRect.y + cropRect.h / 2;
  const sx   = Math.max(0, cx - side / 2);
  const sy   = Math.max(0, cy - side / 2);
  const sw   = Math.min(vw - sx, side);
  const sh   = Math.min(vh - sy, side);

  // Render into a 300×300 output canvas
  const out = document.createElement('canvas');
  out.width  = 300;
  out.height = 300;
  out.getContext('2d').drawImage(canvasEl, sx, sy, sw, sh, 0, 0, 300, 300);

  return out.toDataURL('image/png');
}
