/*
 * Página del celular (/mano.html): cada persona que escanea el QR es un jugador.
 * Su dedo —o su mano, con la cámara del celu— es una mano más en la proyección.
 */
import { HandTracker } from "./hands.js";

const socket = io();
const $ = (id) => document.getElementById(id);
const pad = $("pad");
const finger = $("finger");
const msg = $("msg");

let joined = false;
let pos = { x: 0.5, y: 0.5 };
let down = false;
let pointerId = null;
let camOn = false;
let tracker = null;

function say(text, error) {
  msg.textContent = text || "";
  msg.className = error ? "err" : "";
}

// La palabra se recuerda en este celular (si el navegador deja).
try { $("word").value = localStorage.getItem("atractorWord") || ""; } catch (e) { /* sin almacenamiento */ }
$("word").addEventListener("input", () => {
  try { localStorage.setItem("atractorWord", $("word").value); } catch (e) { /* nada */ }
  send();
});
$("word").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

function send() {
  if (!joined) return;
  socket.emit("player", { x: pos.x, y: pos.y, down, word: $("word").value });
}

socket.on("connect", () => socket.emit("player-join"));
socket.on("disconnect", () => { joined = false; $("who").textContent = "Sin conexión… reintentando"; });

socket.on("player-info", (info) => {
  if (!info || !info.ok) {
    joined = false;
    $("who").textContent = info && info.reason === "full" ? "Está lleno" : "El juego está pausado";
    say(info && info.reason === "full" ? "Ya hay muchos jugadores. Probá de nuevo en un rato." : "Quien maneja el panel apagó el multijugador.", true);
    if (info && info.reason === "full") setTimeout(() => socket.emit("player-join"), 8000);
    return;
  }
  joined = true;
  document.documentElement.style.setProperty("--c", info.color);
  $("who").textContent = "Sos el jugador " + info.n;
  say("");
  send();
});

socket.on("state", (state) => {
  const s = (state && state.settings) || {};
  $("word").hidden = s.playerWords === false;
  if (s.players !== false && !joined && socket.connected) socket.emit("player-join");
});

// --- Dedo ---
function setFromEvent(evt) {
  const r = pad.getBoundingClientRect();
  pos = {
    x: Math.max(0, Math.min(1, (evt.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (evt.clientY - r.top) / r.height))
  };
  finger.style.left = (pos.x * r.width) + "px";
  finger.style.top = (pos.y * r.height) + "px";
}
pad.addEventListener("pointerdown", (evt) => {
  if (camOn || pointerId !== null) return;
  pointerId = evt.pointerId;
  try { pad.setPointerCapture(evt.pointerId); } catch (e) { /* nada */ }
  $("word").blur();
  $("help").style.display = "none";
  down = true;
  finger.style.display = "block";
  setFromEvent(evt);
  send();
});
pad.addEventListener("pointermove", (evt) => {
  if (evt.pointerId !== pointerId) return;
  setFromEvent(evt);
  send();
});
function release(evt) {
  if (evt.pointerId !== pointerId) return;
  pointerId = null;
  down = false;
  finger.style.display = "none";
  send();
}
pad.addEventListener("pointerup", release);
pad.addEventListener("pointercancel", release);
pad.addEventListener("contextmenu", (e) => e.preventDefault());

// Mientras se toca, avisar cada tanto que seguimos (si no, el servidor nos suelta).
setInterval(() => { if (down) send(); }, 400);

// --- Cámara del celu ---
$("camBtn").addEventListener("click", async () => {
  if (camOn) {
    camOn = false;
    tracker && tracker.stop();
    $("cam").style.display = "none";
    $("camBtn").classList.remove("on");
    $("help").style.display = "";
    down = false;
    send();
    say("");
    return;
  }
  if (!window.isSecureContext) {
    say("La cámara del celu sólo anda con https (por ejemplo en Render). Usá el dedo.", true);
    return;
  }
  camOn = true;
  $("camBtn").classList.add("on");
  $("cam").style.display = "block";
  $("help").innerHTML = "Mostrale la mano a la cámara de adelante.<br>Moverla mueve tu mano en la proyección.";
  tracker = tracker || new HandTracker({
    preview: $("cam"),
    facingMode: "user",
    getMirror: () => true,
    getMaxHands: () => 1,
    getPoint: () => "palm",
    onStatus: (text, kind) => say(text, kind === "error"),
    onHands: (hands) => {
      if (!camOn) return;
      if (hands && hands.length) {
        pos = { x: hands[0].x, y: hands[0].y };
        down = true;
      } else down = false;
      send();
    }
  });
  const ok = await tracker.start();
  if (!ok) {
    camOn = false;
    $("camBtn").classList.remove("on");
    $("cam").style.display = "none";
  }
});

// Que la pantalla no se apague mientras se juega.
async function keepAwake() {
  try { if (navigator.wakeLock) await navigator.wakeLock.request("screen"); } catch (e) { /* no importa */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });
keepAwake();
