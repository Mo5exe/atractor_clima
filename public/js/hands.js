/*
 * Detección de manos con la cámara (MediaPipe Hand Landmarker).
 *
 * Uso:
 *   import { HandTracker } from "./js/hands.js";
 *   const tracker = new HandTracker({ onHands, onStatus, preview, getMirror, getPoint });
 *   await tracker.start(deviceId);
 *
 * onHands([{ x, y }])  -> posiciones normalizadas 0..1 (ya espejadas si corresponde)
 * onStatus(text, kind) -> kind: "info" | "ok" | "warn" | "error"
 *
 * MediaPipe se sirve desde el propio servidor (/mediapipe, desde node_modules).
 * El modelo se busca primero en /models/hand_landmarker.task y si no está,
 * se descarga de Google (necesita internet la primera vez).
 */

const MEDIAPIPE_BASE = "/mediapipe";
const MODEL_LOCAL = "/models/hand_landmarker.task";
const MODEL_REMOTE = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Índices de MediaPipe: 0 muñeca, 5/9/13/17 nudillos, 8 punta del índice.
const PALM_POINTS = [0, 5, 9, 13, 17];
const INDEX_TIP = 8;

let landmarkerPromise = null;

async function modelUrl() {
  try {
    const res = await fetch(MODEL_LOCAL, { method: "HEAD" });
    if (res.ok) return MODEL_LOCAL;
  } catch (e) { /* no hay copia local */ }
  return MODEL_REMOTE;
}

async function loadLandmarker(onStatus) {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    onStatus("Cargando detector de manos…", "info");
    const vision = await import(MEDIAPIPE_BASE + "/vision_bundle.mjs");
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_BASE + "/wasm");
    const options = (modelAssetPath, delegate) => ({
      baseOptions: { modelAssetPath, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    const first = await modelUrl();
    const urls = first === MODEL_REMOTE ? [MODEL_REMOTE] : [first, MODEL_REMOTE];
    let lastErr = null;
    for (const url of urls) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          return await vision.HandLandmarker.createFromOptions(fileset, options(url, delegate));
        } catch (err) {
          console.warn("MediaPipe no pudo iniciar con", url, delegate, err);
          lastErr = err;
        }
      }
    }
    throw lastErr || new Error("No se pudo crear el detector de manos");
  })();
  try {
    return await landmarkerPromise;
  } catch (err) {
    landmarkerPromise = null; // permitir reintentar
    throw err;
  }
}

export async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput");
  } catch (e) {
    return [];
  }
}

export class HandTracker {
  constructor(opts) {
    this.onHands = opts.onHands || (() => {});
    this.onStatus = opts.onStatus || (() => {});
    this.preview = opts.preview || null; // <canvas> opcional para ver la cámara
    this.getMirror = opts.getMirror || (() => true);
    this.getPoint = opts.getPoint || (() => "palm");
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
    this.stream = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.smoothed = [];
    this.landmarker = null;
    this._loop = this._loop.bind(this);
  }

  async start(deviceId) {
    this.stop();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onStatus("Este navegador no permite usar la cámara. Usá Chrome o Edge.", "error");
      return false;
    }
    try {
      this.onStatus("Pidiendo permiso para la cámara…", "info");
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
    } catch (err) {
      console.error(err);
      const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
      this.onStatus(denied
        ? "Permiso de cámara denegado. Hacé clic en el candado de la barra de direcciones y permití la cámara."
        : "No se encontró cámara o está siendo usada por otro programa (cerrá Zoom, Meet, OBS…).", "error");
      return false;
    }
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});

    try {
      this.landmarker = await loadLandmarker(this.onStatus);
    } catch (err) {
      console.error("No se pudo cargar MediaPipe", err);
      this.onStatus("No se pudo cargar el detector de manos (¿sin internet la primera vez?). La cámara se ve, pero sin detección. Podés simular la mano con el mouse en la salida.", "error");
      this.landmarker = null;
    }

    this.running = true;
    if (this.landmarker) this.onStatus("Cámara activa. Mostrá la mano.", "ok");
    requestAnimationFrame(this._loop);
    return true;
  }

  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.smoothed = [];
    this.onHands([]);
    if (this.preview) {
      const c = this.preview.getContext("2d");
      c.fillStyle = "#000";
      c.fillRect(0, 0, this.preview.width, this.preview.height);
    }
  }

  _handPoint(landmarks) {
    if (this.getPoint() === "index") {
      return { x: landmarks[INDEX_TIP].x, y: landmarks[INDEX_TIP].y };
    }
    let x = 0, y = 0;
    for (const i of PALM_POINTS) { x += landmarks[i].x; y += landmarks[i].y; }
    return { x: x / PALM_POINTS.length, y: y / PALM_POINTS.length };
  }

  _loop() {
    if (!this.running) return;
    const video = this.video;
    let results = null;

    if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      if (this.landmarker) {
        try {
          results = this.landmarker.detectForVideo(video, performance.now());
        } catch (err) {
          console.error("Error de detección", err);
        }
      }

      if (results) {
        const mirror = this.getMirror();
        const raw = (results.landmarks || []).map((lm) => {
          const pt = this._handPoint(lm);
          return { x: mirror ? 1 - pt.x : pt.x, y: pt.y };
        });
        // Suavizado para que el punto no tiemble.
        const smoothed = raw.map((pt, i) => {
          const prev = this.smoothed[i];
          if (!prev) return pt;
          return { x: prev.x + (pt.x - prev.x) * 0.55, y: prev.y + (pt.y - prev.y) * 0.55 };
        });
        this.smoothed = smoothed;
        this.onHands(smoothed);
        this._drawPreview(results, mirror);
      } else {
        this._drawPreview(null, this.getMirror());
      }
    }

    requestAnimationFrame(this._loop);
  }

  _drawPreview(results, mirror) {
    const canvas = this.preview;
    if (!canvas) return;
    const video = this.video;
    if (canvas.width !== video.videoWidth && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const c = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    c.save();
    if (mirror) { c.translate(w, 0); c.scale(-1, 1); }
    c.drawImage(video, 0, 0, w, h);
    c.restore();

    if (!results || !results.landmarks) return;
    results.landmarks.forEach((lm) => {
      c.fillStyle = "rgba(92,200,255,0.9)";
      for (const p of lm) {
        const x = (mirror ? 1 - p.x : p.x) * w;
        c.beginPath();
        c.arc(x, p.y * h, 3, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.smoothed.forEach((pt) => {
      c.strokeStyle = "#ff3d8b";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(pt.x * w, pt.y * h, 14, 0, Math.PI * 2);
      c.stroke();
    });
  }
}
