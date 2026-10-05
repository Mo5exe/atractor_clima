/*
 * Atractor Clima — servidor del Editor de Efectos Visuales vinculado al clima.
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
const { getRealWeather, manualWeather, searchCity, categories } = require("./weather.js");
const { getClimateWords } = require("./climate-words.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
// MediaPipe se sirve desde node_modules para no depender de un CDN.
app.use("/mediapipe", express.static(path.join(__dirname, "node_modules", "@mediapipe", "tasks-vision")));

// ---------------------------------------------------------------------------
// Imágenes subidas (para la capa "Imágenes"). Se guardan en data/images.
// ---------------------------------------------------------------------------
const IMAGES_DIR = path.join(__dirname, "data", "images");
fs.mkdirSync(IMAGES_DIR, { recursive: true });
app.use("/uploads", express.static(IMAGES_DIR, { maxAge: "1h" }));

// Reconocer el tipo por los primeros bytes (no confiar en el nombre).
function imageType(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 6 && buf.slice(0, 3).toString("ascii") === "GIF") return "gif";
  if (buf.length > 12 && buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

function listImages() {
  try {
    return fs.readdirSync(IMAGES_DIR)
      .filter((f) => /\.(png|jpg|gif|webp)$/i.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(IMAGES_DIR, f));
        const label = f.replace(/^[0-9a-f]{8}-/, "").replace(/\.[a-z]+$/i, "");
        return { id: f, url: "/uploads/" + encodeURIComponent(f), name: label, at: st.mtimeMs };
      })
      .sort((a, b) => a.at - b.at);
  } catch (e) {
    return [];
  }
}

app.post("/api/images", express.raw({ type: () => true, limit: "20mb" }), (req, res) => {
  const buf = req.body;
  const type = Buffer.isBuffer(buf) ? imageType(buf) : null;
  if (!type) return res.status(400).json({ ok: false, error: "No es una imagen PNG, JPG, GIF o WebP." });
  const original = String(req.get("X-Filename") || "imagen");
  let base = decodeURIComponent(original).replace(/\.[a-z0-9]+$/i, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "imagen";
  const id = randomUUID().slice(0, 8) + "-" + base + "." + type;
  fs.writeFileSync(path.join(IMAGES_DIR, id), buf);
  io.emit("images", listImages());
  res.json({ ok: true, id });
});

// ---------------------------------------------------------------------------
// Animaciones subidas (capa "Animaciones"): GIF, PNG animado (APNG), WebP
// animado, y videos MP4 / MOV (H.264) / WebM (VP9, con transparencia).
// Se guardan en data/animations. Los videos pueden ser grandes: se reciben
// en partes directo al disco.
// ---------------------------------------------------------------------------
const ANIMS_DIR = path.join(__dirname, "data", "animations");
fs.mkdirSync(ANIMS_DIR, { recursive: true });
app.use("/anims", express.static(ANIMS_DIR, { maxAge: "1h" }));
const ANIM_EXT = /\.(gif|png|webp|mp4|mov|webm)$/i;
const MAX_ANIM_BYTES = 500 * 1024 * 1024;

function animType(buf) {
  const img = imageType(buf);
  if (img && img !== "jpg") return img;
  if (buf.length > 12 && buf.slice(4, 8).toString("ascii") === "ftyp") {
    return buf.slice(8, 12).toString("ascii") === "qt  " ? "mov" : "mp4";
  }
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}

function listAnimations() {
  try {
    return fs.readdirSync(ANIMS_DIR)
      .filter((f) => ANIM_EXT.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(ANIMS_DIR, f));
        const ext = f.split(".").pop().toLowerCase();
        const label = f.replace(/^[0-9a-f]{8}-/, "").replace(/\.[a-z0-9]+$/i, "");
        return {
          id: f, url: "/anims/" + encodeURIComponent(f), name: label, at: st.mtimeMs,
          kind: ["mp4", "mov", "webm"].includes(ext) ? "video" : "frames",
          size: st.size
        };
      })
      .sort((a, b) => a.at - b.at);
  } catch (e) {
    return [];
  }
}

app.post("/api/animations", (req, res) => {
  const tmp = path.join(ANIMS_DIR, randomUUID() + ".part");
  const out = fs.createWriteStream(tmp);
  let bytes = 0;
  let head = Buffer.alloc(0);
  let failed = false;
  const fail = (status, error) => {
    if (failed) return;
    failed = true;
    out.destroy();
    fs.unlink(tmp, () => {});
    res.status(status).json({ ok: false, error });
  };
  req.on("data", (chunk) => {
    bytes += chunk.length;
    if (head.length < 64) head = Buffer.concat([head, chunk.slice(0, 64 - head.length)]);
    if (bytes > MAX_ANIM_BYTES) { req.destroy(); fail(413, "El archivo es muy grande (máximo 500 MB)."); }
  });
  req.pipe(out);
  out.on("finish", () => {
    if (failed) return;
    const type = animType(head);
    if (!type) return fail(400, "No es una animación GIF, PNG, WebP, MP4, MOV o WebM.");
    const original = String(req.get("X-Filename") || "animacion");
    const base = decodeURIComponent(original).replace(/\.[a-z0-9]+$/i, "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "animacion";
    const id = randomUUID().slice(0, 8) + "-" + base + "." + type;
    fs.rename(tmp, path.join(ANIMS_DIR, id), (err) => {
      if (err) return fail(500, "No se pudo guardar el archivo.");
      io.emit("animations", listAnimations());
      res.json({ ok: true, id });
    });
  });
  out.on("error", () => fail(500, "No se pudo guardar el archivo."));
  req.on("aborted", () => fail(400, "Se cortó la subida."));
});

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
  (SCHEMAS[type] || []).forEach((def) => { params[def.key] = Array.isArray(def.default) ? def.default.slice() : def.default; });
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
  const result = settings.wordSource === "clima"
    ? await getClimateWords(weatherInfo, settings)
    : await getWords(settings);
  // Si mientras tanto cambiaron la fuente o el país, descartar este resultado.
  if (req !== wordsRequest) return;
  trendsInfo = Object.assign({ country: settings.trendsCountry, wordSource: settings.wordSource }, result);
  io.emit("trends", trendsInfo);
}

const WORD_SETTINGS = ["wordSource", "trendsCountry", "newsSource", "customWords", "climateState", "climatePhrases", "climateVoices", "climateWords"];

// ---------------------------------------------------------------------------
// Clima
// ---------------------------------------------------------------------------
let weatherInfo = { ok: false, mode: state.settings.weatherMode, city: state.settings.city.name, error: null };
let realWeatherCache = null; // último clima real que funcionó
let lastCategories = "";

function emitWeather() {
  io.emit("weather", weatherInfo);
  // Si cambió el "tipo" de clima (llueve, hace calor...), actualizar las palabras.
  const cats = weatherInfo.ok ? categories(weatherInfo).join(",") : "";
  if (state.settings.wordSource === "clima" && cats !== lastCategories) {
    lastCategories = cats;
    refreshTrends();
  }
}

async function refreshWeather() {
  const s = state.settings;
  if (s.weatherMode === "manual") {
    weatherInfo = manualWeather(s.manualWeather, s.city && s.city.name);
    emitWeather();
    return;
  }
  const city = s.city;
  try {
    const w = await getRealWeather(city);
    if (state.settings.weatherMode !== "real" || state.settings.city !== city) return; // cambió mientras tanto
    realWeatherCache = w;
    weatherInfo = w;
    console.log("[clima] " + city.name + ": " + w.desc + ", " + Math.round(w.temp) + "°C, viento " + Math.round(w.wind) + " km/h");
  } catch (err) {
    console.warn("[clima] No se pudo leer el clima de " + city.name + ": " + err.message);
    if (realWeatherCache && realWeatherCache.city === city.name) {
      weatherInfo = Object.assign({}, realWeatherCache, { stale: true });
    } else {
      // Sin internet: usar los valores del modo manual para que todo siga funcionando.
      weatherInfo = Object.assign(manualWeather(s.manualWeather, city.name), { mode: "real", offline: true, error: err.message });
    }
  }
  emitWeather();
}

refreshWeather();
setInterval(() => { if (state.settings.weatherMode === "real") refreshWeather(); }, 10 * 60 * 1000);
// La luz del día cambia aunque el clima no: recalcularla cada minuto.
setInterval(() => {
  if (state.settings.weatherMode === "real" && weatherInfo.ok && weatherInfo.sunrise) {
    const { dayLightFrom } = require("./weather.js");
    weatherInfo.dayLight = dayLightFrom(new Date(), weatherInfo.sunrise, weatherInfo.sunset, weatherInfo.isDay);
    emitWeather();
  }
}, 60 * 1000);

const WEATHER_SETTINGS = ["weatherMode", "manualWeather", "city"];

refreshTrends();
setInterval(refreshTrends, 3 * 60 * 1000);

// ---------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  socket.emit("state", state);
  socket.emit("presets", presetSummaries());
  socket.emit("trends", trendsInfo);
  socket.emit("weather", weatherInfo);
  socket.emit("images", listImages());
  socket.emit("animations", listAnimations());

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
    const key = payload && payload.key;
    let value = payload && payload.value;
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return;
    const changedWords = WORD_SETTINGS.includes(key) && value !== state.settings[key];
    if (key === "manualWeather" || key === "city") {
      if (!value || typeof value !== "object") return;
      if (key === "city" && (!isFinite(value.lat) || !isFinite(value.lon))) return;
      value = key === "manualWeather" ? Object.assign({}, state.settings.manualWeather, value) : value;
    }
    state.settings[key] = (key === "customWords" || key === "climateWords") ? String(value).slice(0, 5000) : value;
    broadcastState();
    if (WEATHER_SETTINGS.includes(key)) refreshWeather();
    if (changedWords) {
      if (key !== "customWords") {
        trendsInfo = Object.assign({}, trendsInfo, { source: "cargando", country: state.settings.trendsCountry, wordSource: state.settings.wordSource });
        io.emit("trends", trendsInfo);
      }
      refreshTrends();
    }
  });

  socket.on("refresh-trends", () => refreshTrends());
  socket.on("refresh-weather", () => refreshWeather());

  socket.on("delete-animation", (id) => {
    const file = path.basename(String(id || ""));
    if (!ANIM_EXT.test(file)) return;
    try { fs.unlinkSync(path.join(ANIMS_DIR, file)); } catch (e) { /* ya no estaba */ }
    state.layers.forEach((l) => {
      if (Array.isArray(l.params.animations)) l.params.animations = l.params.animations.filter((x) => x !== file);
    });
    io.emit("animations", listAnimations());
    broadcastState();
  });

  socket.on("delete-image", (id) => {
    const file = path.basename(String(id || ""));
    if (!/\.(png|jpg|gif|webp)$/i.test(file)) return;
    try { fs.unlinkSync(path.join(IMAGES_DIR, file)); } catch (e) { /* ya no estaba */ }
    // Sacarla también de las capas que la usaban.
    state.layers.forEach((l) => {
      if (Array.isArray(l.params.images)) l.params.images = l.params.images.filter((x) => x !== file);
    });
    io.emit("images", listImages());
    broadcastState();
  });

  socket.on("search-city", async (name) => {
    try {
      socket.emit("city-results", { query: name, results: await searchCity(name) });
    } catch (err) {
      socket.emit("city-results", { query: name, results: [], error: err.message });
    }
  });

  // Medidores de audio que manda la salida, para verlos en el panel.
  socket.on("audio-levels", (payload) => {
    socket.broadcast.volatile.emit("audio-levels", payload);
  });

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
    if (WEATHER_SETTINGS.some((k) => JSON.stringify(state.settings[k]) !== JSON.stringify(prev[k]))) refreshWeather();
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
// Una instalación tiene que seguir andando: si algo falla, se anota y sigue.
process.on("uncaughtException", (err) => console.error("[error]", err && err.stack ? err.stack : err));
process.on("unhandledRejection", (err) => console.error("[error]", err && err.stack ? err.stack : err));

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
  console.log("=== ATRACTOR CLIMA - Editor de Efectos Visuales ===");
  console.log("Panel de control:  " + PANEL_URL);
  console.log("Salida visual:     http://localhost:" + PORT + "/output.html");
  console.log("(Para cerrar: cerrá esta ventana o apretá Ctrl + C)");
  console.log("");
  openBrowser(PANEL_URL);
});
