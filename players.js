/*
 * Multijugador: cada persona entra desde su celular a /mano.html (con el QR)
 * y su dedo —o su mano, con la cámara del celu— aparece en la proyección como
 * una mano más. Cada jugador puede escribir su propia palabra.
 *
 * El celular manda "player" con { x, y, down, word } (x, y de 0 a 1).
 * El servidor junta a todos y manda "players" a las salidas, 20 veces por segundo.
 * No se guarda nada: si alguien cierra la página, desaparece.
 */
"use strict";

const os = require("os");
const QRCode = require("qrcode");
const { isBad } = require("./climate-words.js");

const COLORS = ["#ff5c8a", "#5cc8ff", "#ffd23f", "#4ade80", "#c084fc", "#ff9f43",
  "#2dd4bf", "#f472b6", "#a3e635", "#60a5fa", "#fb7185", "#facc15"];
const SILENCE_MS = 1500; // si el celu deja de mandar, se suelta

// Dirección de la red local (para que los celus entren cuando corre en la compu).
function lanAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === "IPv4" && !n.internal && !/^169\.254\./.test(n.address)) return n.address;
    }
  }
  return null;
}

// Link para sumarse, según desde dónde se abrió el panel.
function joinUrl(req) {
  const proto = req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]).split(",")[0] : req.protocol;
  let host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost");
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host)) {
    const ip = lanAddress();
    if (ip) host = host.replace(/^(localhost|127\.0\.0\.1|\[::1\])/, ip);
  }
  return proto + "://" + host + "/mano.html";
}

function cleanWord(word) {
  const w = String(word || "").replace(/[\u0000-\u001f<>{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  if (!w || isBad(w)) return "";
  return w;
}

function setup(app, io, getSettings) {
  const players = new Map(); // socket.id -> jugador
  let changed = false;

  app.get("/api/join", (req, res) => res.json({ url: joinUrl(req) }));
  app.get("/qr.svg", async (req, res) => {
    try {
      const svg = await QRCode.toString(joinUrl(req), { type: "svg", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
      res.type("image/svg+xml").set("Cache-Control", "no-cache").send(svg);
    } catch (err) {
      res.status(500).send("");
    }
  });

  function freeNumber() {
    const used = new Set(Array.from(players.values()).map((p) => p.n));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }

  function list() {
    const s = getSettings();
    const now = Date.now();
    const out = [];
    for (const p of players.values()) {
      if (!p.down || now - p.at > SILENCE_MS) continue;
      out.push({ n: p.n, x: p.x, y: p.y, color: p.color, word: s.playerWords !== false ? p.word : "" });
    }
    return out;
  }

  // 20 veces por segundo, sólo si algo cambió (o alguien se soltó por silencio).
  let lastSent = "[]";
  setInterval(() => {
    const data = list();
    const json = JSON.stringify(data);
    if (!changed && json === lastSent) return;
    changed = false;
    lastSent = json;
    io.volatile.emit("players", data);
  }, 50);

  function countInfo() {
    return { count: players.size, active: list().length };
  }
  let countTimer = null;
  function sendCount() {
    clearTimeout(countTimer);
    countTimer = setTimeout(() => io.emit("players-count", countInfo()), 300);
  }

  function onSocket(socket) {
    socket.emit("players-count", countInfo());

    socket.on("player-join", () => {
      const s = getSettings();
      if (s.players === false) return socket.emit("player-info", { ok: false, reason: "off" });
      if (players.has(socket.id)) {
        const p = players.get(socket.id);
        return socket.emit("player-info", { ok: true, n: p.n, color: p.color });
      }
      if (players.size >= (s.maxPlayers || 12)) return socket.emit("player-info", { ok: false, reason: "full" });
      const n = freeNumber();
      const p = { n, color: COLORS[(n - 1) % COLORS.length], x: 0.5, y: 0.5, down: false, word: "", at: 0, last: 0, tokens: 40 };
      players.set(socket.id, p);
      socket.emit("player-info", { ok: true, n, color: p.color });
      sendCount();
    });

    socket.on("player", (msg) => {
      const p = players.get(socket.id);
      if (!p || !msg || typeof msg !== "object") return;
      if (getSettings().players === false) return;
      // Freno: como mucho ~40 mensajes por segundo por celular.
      const now = Date.now();
      p.tokens = Math.min(40, p.tokens + ((now - p.last) / 1000) * 40);
      p.last = now;
      if (p.tokens < 1) return;
      p.tokens -= 1;
      const x = Number(msg.x), y = Number(msg.y);
      if (isFinite(x) && isFinite(y)) {
        p.x = Math.max(0, Math.min(1, x));
        p.y = Math.max(0, Math.min(1, y));
      }
      p.down = !!msg.down;
      if (typeof msg.word === "string") p.word = cleanWord(msg.word);
      p.at = now;
      changed = true;
    });

    socket.on("disconnect", () => {
      if (players.delete(socket.id)) { changed = true; sendCount(); }
    });
  }

  // Si se apaga el multijugador desde el panel, se va todo el mundo.
  function onSettingChanged(key) {
    if (key === "players" && getSettings().players === false) {
      for (const id of players.keys()) io.to(id).emit("player-info", { ok: false, reason: "off" });
      players.clear();
      changed = true;
      sendCount();
    }
  }

  return { onSocket, onSettingChanged };
}

module.exports = { setup, joinUrl, cleanWord };
