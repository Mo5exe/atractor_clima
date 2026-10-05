/*
 * Cámara en el panel de control: detecta la mano y manda su posición
 * (normalizada 0..1) a la salida visual por socket.
 */
import { HandTracker, listCameras } from "./hands.js";

const socket = window.appSocket;
const $ = (id) => document.getElementById(id);

const camBtn = $("camBtn");
const camSelect = $("camSelect");
const camStatus = $("camStatus");
const pointSelect = $("pointSelect");

function setStatus(text, kind) {
  camStatus.textContent = text;
  camStatus.className = "status " + (kind || "info");
}

function savePref(key, value) {
  try { localStorage.setItem("atractor." + key, value); } catch (e) { /* sin almacenamiento */ }
}
function loadPref(key) {
  try { return localStorage.getItem("atractor." + key); } catch (e) { return null; }
}

pointSelect.value = loadPref("point") || "palm";
pointSelect.addEventListener("change", () => savePref("point", pointSelect.value));

let lastSentEmpty = false;
let lastEmptyAt = 0;

const tracker = new HandTracker({
  preview: $("camPreview"),
  getMirror: () => window.appSettings.mirror !== false,
  getPoint: () => pointSelect.value,
  onStatus: setStatus,
  onHands: (hands) => {
    window.showHandLive && window.showHandLive(hands);
    const now = performance.now();
    if (hands.length > 0) {
      socket.volatile.emit("hands", { hands });
      lastSentEmpty = false;
    } else if (!lastSentEmpty || now - lastEmptyAt > 300) {
      socket.volatile.emit("hands", { hands: [] });
      lastSentEmpty = true;
      lastEmptyAt = now;
    }
  }
});

let running = false;

async function fillCameras() {
  const cams = await listCameras();
  const current = camSelect.value || loadPref("camera") || "";
  camSelect.innerHTML = "";
  cams.forEach((cam, i) => {
    const opt = document.createElement("option");
    opt.value = cam.deviceId;
    opt.textContent = cam.label || "Cámara " + (i + 1);
    camSelect.appendChild(opt);
  });
  if (cams.some((c) => c.deviceId === current)) camSelect.value = current;
  camSelect.hidden = cams.length < 2;
}

async function startCamera() {
  camBtn.disabled = true;
  const ok = await tracker.start(camSelect.value || loadPref("camera") || undefined);
  camBtn.disabled = false;
  running = ok;
  camBtn.textContent = ok ? "Apagar cámara" : "Activar cámara";
  if (ok) {
    await fillCameras();
    savePref("autostart", "1");
  }
}

function stopCamera(message) {
  tracker.stop();
  running = false;
  camBtn.textContent = "Activar cámara";
  setStatus(message || "Cámara apagada.", "info");
  savePref("autostart", "0");
}

window.stopPanelCamera = () => {
  if (running) stopCamera("Cámara del panel apagada: ahora la usa la ventana de salida.");
};

camBtn.addEventListener("click", async () => {
  if (running) stopCamera();
  else await startCamera();
});

camSelect.addEventListener("change", async () => {
  savePref("camera", camSelect.value);
  if (running) await startCamera();
});

// Si la pestaña del panel queda oculta, el navegador frena la cámara.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) {
    setStatus("⚠️ El panel quedó oculto: el navegador pausa la cámara. Dejá esta ventana visible (por ejemplo en la notebook, y la salida en el proyector), o abrí la salida con la cámara: /output.html?camara=1", "warn");
  } else if (running) {
    setStatus("Cámara activa. Mostrá la mano.", "ok");
  }
});

// Si la última vez estaba prendida, volver a prenderla sola.
if (loadPref("autostart") === "1") startCamera();
