/*
 * Detectar la mano directamente en la ventana de salida.
 * Se activa abriendo  /output.html?camara=1  (botón "Abrir salida con cámara").
 * Sirve con una sola pantalla: el navegador pausa la cámara de las ventanas
 * tapadas, y la salida es la que siempre está visible.
 *
 * Tecla C: mostrar / ocultar una vista chica de la cámara.
 */
import { HandTracker } from "./hands.js";

const params = new URLSearchParams(location.search);
if (params.get("camara") === "1" || params.get("camera") === "1") {
  const badge = document.createElement("div");
  badge.style.cssText = "position:fixed;left:12px;bottom:10px;max-width:60vw;padding:6px 10px;border-radius:6px;" +
    "background:rgba(0,0,0,0.6);color:#8b93a7;font:13px 'Segoe UI',sans-serif;pointer-events:none;transition:opacity 1s";
  document.body.appendChild(badge);

  const preview = document.createElement("canvas");
  preview.width = 320;
  preview.height = 240;
  preview.style.cssText = "position:fixed;right:12px;bottom:12px;width:240px;height:auto;border:1px solid #2a2f3a;" +
    "border-radius:8px;display:none;pointer-events:none";
  document.body.appendChild(preview);
  window.addEventListener("keydown", (e) => {
    if (e.key === "c" || e.key === "C") preview.style.display = preview.style.display === "none" ? "block" : "none";
  });

  let hideTimer = null;
  window.localCameraHands = { hands: [], at: 0 };
  const tracker = new HandTracker({
    preview,
    getMirror: () => !window.appSettings || window.appSettings.mirror !== false,
    getPoint: () => (params.get("punto") === "indice" ? "index" : "palm"),
    onStatus: (text, kind) => {
      badge.textContent = "Cámara: " + text + (kind === "ok" ? "  (tecla C: ver cámara)" : "");
      badge.style.color = kind === "error" ? "#ff6b6b" : kind === "ok" ? "#4ade80" : "#8b93a7";
      badge.style.opacity = "1";
      clearTimeout(hideTimer);
      // Los errores quedan a la vista; lo demás se esconde solo.
      if (kind !== "error") hideTimer = setTimeout(() => { badge.style.opacity = "0"; }, 5000);
    },
    onHands: (hands) => {
      window.localCameraHands = { hands, at: performance.now() };
    }
  });
  tracker.start(params.get("deviceId") || undefined);
}
