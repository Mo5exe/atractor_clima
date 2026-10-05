/*
 * Atractor — servidor del Editor de Efectos Visuales v2.
 *
 * - Sirve /public (index.html = panel de control, output.html = salida visual).
 * - Mantiene el estado autoritativo: capas de efectos + ajustes globales.
 * - Reenvía en vivo la posición de la(s) mano(s) detectadas por la cámara.
 * - Guarda presets en data/presets.json.
 * - Trae palabras (lista propia, Wikipedia, diarios, Google, X) cada 3 minutos.
 */
"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const { Server } = require("socket.io");

const { SCHEMAS, NAMES, DEFAULT_SETTINGS } = require("./public/js/schemas.js");
const { getWords } = require("./word-sources.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
// MediaPipe se sirve desde node_modules para no depender de un CDN.
app.use("/mediapipe", express.static(path.join(__dirname, "node_modules", "@mediapipe", "tasks-vision")));

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let state = {
  layers: [], // { id, type, name, enabled, params, transform }
  settings: Object.assign({}, DEFAULT_SETTINGS)
};

const ROTATE_STEP = 45;

function defaultParams(type) {
  const params = {};
  (SCHEMAS[type] || []).forEach((def) => { params[def.key] = def.default; });
  return params;
}

function createLayer(type) {
  if (!SCHEMAS[type]) throw new Error("Tipo de efecto desconocido: " + type);
  return {
    id: randomUUID(),
    type,
    name: NAMES[type] || type,
    enabled: true,
    params: defaultParams(type),
    transform: { originX: 50, originY: 50, rotation: 0 }
  };
}

// Completa parámetros que falten (por ejemplo, presets guardados con una
// versión anterior) para que nada quede "undefined" en la salida.
function normalizeLayer(layer) {
  if (!layer || !SCHEMAS[layer.type]) return null;
  return {
    id: layer.id || randomUUID(),
    type: layer.type,
    name: layer.name || NAMES[layer.type],
    enabled: layer.enabled !== false,
    params: Object.assign(defaultParams(layer.type), layer.params || {}),
    transform: Object.assign({ originX: 50, originY: 50, rotation: 0 }, layer.transform || {})
  };
}

function clampPercent(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return 50;
  return Math.max(0, Math.min(100, num));
}

function broadcastState() {
  io.emit("state", state);
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "data");
const PRESETS_FILE = path.join(DATA_DIR, "presets.json");
let presets = [];

function loadPresets() {
  try {
    if (fs.existsSync(PRESETS_FILE)) {
      presets = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf-8"));
      if (!Array.isArray(presets)) presets = [];
    }
  } catch (err) {
    console.error("No se pudieron leer los presets:", err.message);
    presets = [];
  }
}

function savePresets() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
  } catch (err) {
    console.error("No se pudieron guardar los presets:", err.message);
  }
}

function presetSummaries() {
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    layerCount: (p.layers || []).length,
    types: (p.layers || []).map((l) => NAMES[l.type] || l.type)
  }));
}

loadPresets();

// ---------------------------------------------------------------------------
// Palabras (para la capa "Palabras")
// ---------------------------------------------------------------------------
let trendsInfo = { trends: [], source: "cargando", fetchedAt: 0, country: state.settings.trendsCountry, wordSource: state.settings.wordSource };
let wordsRequest = 0;

async function refreshTrends() {
  const req = ++wordsRequest;
  const settings = Object.assign({}, state.settings);
  const result = await getWords(settings);
  // Si mientras tanto cambiaron la fuente o el país, descartar este resultado.
  if (req !== wordsRequest) return;
  trendsInfo = Object.assign({ country: settings.trendsCountry, wordSource: settings.wordSource }, result);
  io.emit("trends", trendsInfo);
}

const WORD_SETTINGS = ["wordSource", "trendsCountry", "customWords"];

refreshTrends();
setInterval(refreshTrends, 3 * 60 * 1000);

// ---------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  socket.emit("state", state);
  socket.emit("presets", presetSummaries());
  socket.emit("trends", trendsInfo);

  socket.on("add-layer", (type) => {
    try {
      state.layers.push(createLayer(type));
      broadcastState();
    } catch (err) {
      socket.emit("error-message", err.message);
    }
  });

  socket.on("remove-layer", (id) => {
    state.layers = state.layers.filter((l) => l.id !== id);
    broadcastState();
  });

  socket.on("toggle-layer", (id) => {
    const layer = state.layers.find((l) => l.id === id);
    if (layer) {
      layer.enabled = !layer.enabled;
      broadcastState();
    }
  });

  socket.on("reorder-layer", (payload) => {
    const { id, direction } = payload || {};
    const idx = state.layers.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= state.layers.length) return;
    const [layer] = state.layers.splice(idx, 1);
    state.layers.splice(newIdx, 0, layer);
    broadcastState();
  });

  socket.on("update-param", (payload) => {
    const { id, key, value } = payload || {};
    const layer = state.layers.find((l) => l.id === id);
    if (layer && Object.prototype.hasOwnProperty.call(layer.params, key)) {
      layer.params[key] = value;
      broadcastState();
    }
  });

  socket.on("clear-layers", () => {
    state.layers = [];
    broadcastState();
  });

  socket.on("update-origin", (payload) => {
    const { id, x, y } = payload || {};
    const layer = state.layers.find((l) => l.id === id);
    if (layer) {
      layer.transform.originX = clampPercent(x);
      layer.transform.originY = clampPercent(y);
      broadcastState();
    }
  });

  socket.on("rotate-layer", (id) => {
    const layer = state.layers.find((l) => l.id === id);
    if (layer) {
      layer.transform.rotation = (layer.transform.rotation + ROTATE_STEP) % 360;
      broadcastState();
    }
  });

  socket.on("update-setting", (payload) => {
    const { key, value } = payload || {};
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return;
    const changedWords = WORD_SETTINGS.includes(key) && value !== state.settings[key];
    state.settings[key] = key === "customWords" ? String(value).slice(0, 5000) : value;
    broadcastState();
    if (changedWords) {
      if (key !== "customWords") {
        trendsInfo = Object.assign({}, trendsInfo, { source: "cargando", country: state.settings.trendsCountry, wordSource: state.settings.wordSource });
        io.emit("trends", trendsInfo);
      }
      refreshTrends();
    }
  });

  socket.on("refresh-trends", () => refreshTrends());

  // Posición de las manos (normalizada 0..1). Sólo se reenvía, no se guarda.
  socket.on("hands", (payload) => {
    socket.broadcast.volatile.emit("hands", payload);
  });

  // --- Presets ---
  socket.on("save-preset", (name) => {
    const clean = String(name || "").trim().slice(0, 60);
    if (!clean) return;
    presets.push({
      id: randomUUID(),
      name: clean,
      createdAt: new Date().toISOString(),
      layers: JSON.parse(JSON.stringify(state.layers)),
      settings: Object.assign({}, state.settings)
    });
    savePresets();
    io.emit("presets", presetSummaries());
  });

  socket.on("load-preset", (id) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    state.layers = (preset.layers || []).map(normalizeLayer).filter(Boolean);
    const prev = Object.assign({}, state.settings);
    state.settings = Object.assign({}, DEFAULT_SETTINGS, preset.settings || {});
    broadcastState();
    io.emit("preset-loaded", id);
    if (WORD_SETTINGS.some((k) => state.settings[k] !== prev[k])) refreshTrends();
  });

  socket.on("rename-preset", (payload) => {
    const { id, name } = payload || {};
    const preset = presets.find((p) => p.id === id);
    const clean = String(name || "").trim().slice(0, 60);
    if (!preset || !clean) return;
    preset.name = clean;
    savePresets();
    io.emit("presets", presetSummaries());
  });

  socket.on("delete-preset", (id) => {
    presets = presets.filter((p) => p.id !== id);
    savePresets();
    io.emit("presets", presetSummaries());
  });
});

// ---------------------------------------------------------------------------
// Arranque. Si lo lanza run.bat (ABRIR_NAVEGADOR=1), abre el panel en una
// pestaña nueva de Google Chrome (o en el navegador predeterminado si no hay Chrome).
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const PANEL_URL = "http://localhost:" + PORT + "/index.html";

function openBrowser(url) {
  if (process.env.ABRIR_NAVEGADOR !== "1") return;
  const { spawn, exec } = require("child_process");
  const chrome = process.env.CHROME_PATH;
  try {
    if (chrome && fs.existsSync(chrome)) {
      spawn(chrome, ["--new-tab", url], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "win32") {
      exec('start "" "' + url + '"');
    } else if (process.platform === "darwin") {
      exec('open "' + url + '"');
    } else {
      exec('xdg-open "' + url + '"');
    }
  } catch (err) {
    console.log("Abrí a mano: " + url);
  }
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log("");
    console.log("Atractor ya estaba abierto en otra ventana. Abro el panel en el navegador.");
    console.log("(Si querés reiniciarlo, cerrá la otra ventana negra primero.)");
    openBrowser(PANEL_URL);
    setTimeout(() => process.exit(0), 1500);
  } else {
    throw err;
  }
});

server.listen(PORT, () => {
  console.log("");
  console.log("=== ATRACTOR - Editor de Efectos Visuales v2 ===");
  console.log("Panel de control:  " + PANEL_URL);
  console.log("Salida visual:     http://localhost:" + PORT + "/output.html");
  console.log("(Para cerrar: cerrá esta ventana o apretá Ctrl + C)");
  console.log("");
  openBrowser(PANEL_URL);
});
