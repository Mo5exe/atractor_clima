/*
 * Contraseña para el panel de control.
 *
 * Si la variable de entorno PANEL_PASSWORD está definida (por ejemplo en Render),
 * para usar el panel (index.html), subir archivos o cambiar algo hay que entrar
 * con esa contraseña. La ventana de salida (output.html) queda pública: se puede
 * proyectar, pero no cambia nada.
 *
 * Sin PANEL_PASSWORD (uso en la compu, con run.bat) todo queda abierto como siempre.
 */
"use strict";

const crypto = require("crypto");
const express = require("express");
const path = require("path");

const PASSWORD = process.env.PANEL_PASSWORD || "";
const PROTECTED = PASSWORD.length > 0;
const COOKIE = "atractor_panel";
const MAX_AGE_S = 30 * 24 * 60 * 60; // 30 días
// La firma depende de la contraseña: si la cambiás, todas las sesiones se cierran.
const SECRET = crypto.createHash("sha256").update("atractor|" + PASSWORD + "|" + (process.env.SESSION_SECRET || "")).digest();

function sign(value) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

function makeToken() {
  const ts = String(Date.now());
  return ts + "." + sign(ts);
}

function validToken(token) {
  if (!token || typeof token !== "string") return false;
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const expected = sign(ts);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  return Date.now() - Number(ts) < MAX_AGE_S * 1000;
}

function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function isAuthedCookie(cookieHeader) {
  if (!PROTECTED) return true;
  return validToken(parseCookies(cookieHeader)[COOKIE]);
}

function isAuthed(req) {
  return isAuthedCookie(req.headers.cookie);
}

// Para las rutas que modifican algo (subidas, presets).
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ ok: false, error: "Necesitás entrar al panel con la contraseña." });
}

// Comparación de contraseña sin filtrar su largo por el tiempo de respuesta.
function passwordMatches(given) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// Freno simple a los intentos: 8 errores por IP → esperar 5 minutos.
const attempts = new Map();
function tooMany(ip) {
  const a = attempts.get(ip);
  return a && a.count >= 8 && Date.now() - a.at < 5 * 60 * 1000;
}
function fail(ip) {
  const a = attempts.get(ip) || { count: 0, at: 0 };
  if (Date.now() - a.at > 5 * 60 * 1000) a.count = 0;
  a.count++;
  a.at = Date.now();
  attempts.set(ip, a);
}

function mount(app) {
  if (!PROTECTED) return;

  // El panel (y "/") piden la contraseña; el resto de los archivos es público.
  app.use((req, res, next) => {
    if ((req.path === "/" || req.path === "/index.html") && !isAuthed(req)) {
      return res.redirect("/login.html");
    }
    next();
  });

  app.post("/login", express.urlencoded({ extended: false, limit: "4kb" }), (req, res) => {
    const ip = req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : req.socket.remoteAddress;
    if (tooMany(ip)) return res.redirect("/login.html?espera=1");
    if (!passwordMatches(req.body && req.body.password)) {
      fail(ip);
      return res.redirect("/login.html?error=1");
    }
    attempts.delete(ip);
    const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.setHeader("Set-Cookie", COOKIE + "=" + encodeURIComponent(makeToken()) +
      "; Path=/; Max-Age=" + MAX_AGE_S + "; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : ""));
    res.redirect("/index.html");
  });

  app.get("/logout", (req, res) => {
    res.setHeader("Set-Cookie", COOKIE + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
    res.redirect("/login.html");
  });
}

// Eventos del panel que cambian algo: sólo con sesión.
const ADMIN_EVENTS = new Set([
  "add-layer", "remove-layer", "toggle-layer", "reorder-layer", "update-param", "clear-layers",
  "update-origin", "rotate-layer", "update-setting", "refresh-trends", "refresh-weather", "search-city",
  "hands", "save-preset", "load-preset", "rename-preset", "delete-preset", "delete-image", "delete-animation"
]);

function guardSocket(socket) {
  socket.data.admin = isAuthedCookie(socket.handshake.headers.cookie);
  if (!PROTECTED) return;
  socket.use(([event], next) => {
    if (ADMIN_EVENTS.has(event) && !socket.data.admin) {
      socket.emit("error-message", "Para cambiar algo tenés que entrar al panel con la contraseña.");
      return; // se ignora el evento
    }
    next();
  });
}

module.exports = { PROTECTED, mount, requireAuth, guardSocket, isAuthed };
