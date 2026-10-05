/*
 * Ventana de salida (output.html).
 * Recibe capas, ajustes, manos y trending topics por socket.io y dibuja todo
 * sobre un canvas a pantalla completa.
 *
 * Para probar sin cámara: mantené apretado el clic y mové el mouse sobre
 * esta ventana; funciona como si fuera la mano.
 */
(function () {
  "use strict";

  const socket = io();
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const hint = document.getElementById("hint");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  let currentState = { layers: [], settings: {} };
  let trends = [];
  let cameraHands = [];       // normalizadas 0..1, llegan del panel de control
  let cameraHandsAt = 0;
  let mouseHand = null;       // normalizada 0..1
  const instances = new Map(); // layerId -> instancia de efecto

  socket.on("state", (state) => {
    currentState = state || { layers: [], settings: {} };
    window.appSettings = currentState.settings || {};
    const activeIds = new Set(currentState.layers.map((l) => l.id));
    for (const id of Array.from(instances.keys())) {
      if (!activeIds.has(id)) instances.delete(id);
    }
    currentState.layers.forEach((layer) => {
      const existing = instances.get(layer.id);
      if (!existing || existing.__type !== layer.type) {
        const factory = EffectFactories[layer.type];
        if (factory) {
          const inst = factory();
          inst.__type = layer.type;
          instances.set(layer.id, inst);
        }
      }
    });
    hint.style.display = currentState.layers.length === 0 ? "block" : "none";
  });

  socket.on("trends", (info) => {
    if (info && Array.isArray(info.trends) && info.trends.length > 0) trends = info.trends;
  });

  socket.on("hands", (payload) => {
    cameraHands = (payload && Array.isArray(payload.hands)) ? payload.hands : [];
    cameraHandsAt = performance.now();
  });

  // --- Mouse / touch como mano de prueba ---
  function setMouse(evt) {
    mouseHand = { x: evt.clientX / window.innerWidth, y: evt.clientY / window.innerHeight };
  }
  canvas.addEventListener("pointerdown", (evt) => { canvas.setPointerCapture(evt.pointerId); setMouse(evt); });
  canvas.addEventListener("pointermove", (evt) => { if (mouseHand) setMouse(evt); });
  canvas.addEventListener("pointerup", () => { mouseHand = null; });
  canvas.addEventListener("pointercancel", () => { mouseHand = null; });

  // Doble clic = pantalla completa
  canvas.addEventListener("dblclick", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  });

  function screenHands(w, h) {
    const list = [];
    // Si la cámara deja de mandar datos, a los 0,5 s se considera que no hay mano.
    if (performance.now() - cameraHandsAt < 500) {
      for (const hnd of cameraHands) list.push({ x: hnd.x * w, y: hnd.y * h });
    }
    // Cámara propia de la salida (output.html?camara=1)
    const local = window.localCameraHands;
    if (local && performance.now() - local.at < 500) {
      for (const hnd of local.hands) list.push({ x: hnd.x * w, y: hnd.y * h });
    }
    if (mouseHand) list.push({ x: mouseHand.x * w, y: mouseHand.y * h });
    return list;
  }

  // Transformación de capa: mueve el "cero" del efecto y lo rota.
  function applyLayerTransform(c, w, h, t) {
    const ox = (t.originX / 100) * w;
    const oy = (t.originY / 100) * h;
    const a = ((t.rotation || 0) * Math.PI) / 180;
    c.translate(ox, oy);
    c.rotate(a);
    c.translate(-ox, -oy);
    c.translate(ox - w / 2, oy - h / 2);
  }

  // Lo inverso: lleva un punto de la pantalla al espacio de la capa, así la
  // mano "toca" en el lugar correcto aunque la capa esté movida o rotada.
  function toLayerSpace(pt, w, h, t) {
    const ox = (t.originX / 100) * w;
    const oy = (t.originY / 100) * h;
    const a = -((t.rotation || 0) * Math.PI) / 180;
    const x = pt.x - ox;
    const y = pt.y - oy;
    const rx = x * Math.cos(a) - y * Math.sin(a);
    const ry = x * Math.sin(a) + y * Math.cos(a);
    return { x: rx + ox - (ox - w / 2), y: ry + oy - (oy - h / 2) };
  }

  function drawCursor(hands) {
    for (const hnd of hands) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(92,200,255,0.9)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#5cc8ff";
      ctx.shadowBlur = 14;
      const r = 16 + Math.sin(performance.now() / 160) * 3;
      ctx.beginPath();
      ctx.arc(hnd.x, hnd.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = now / 1000;
    const w = canvas.width;
    const h = canvas.height;
    const settings = currentState.settings || {};
    const hands = screenHands(w, h);
    const diag = Math.hypot(w, h);
    const radius = ((settings.attractorRadius != null ? settings.attractorRadius : 60) / 100) * diag;
    const globalStrength = settings.attractorStrength != null ? settings.attractorStrength : 0.8;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    currentState.layers.forEach((layer) => {
      if (!layer.enabled) return;
      const inst = instances.get(layer.id);
      if (!inst) return;
      const transform = layer.transform || { originX: 50, originY: 50, rotation: 0 };
      const attract = layer.params.attract != null ? layer.params.attract : 1;
      const env = {
        hands: hands.map((pt) => toLayerSpace(pt, w, h, transform)),
        strength: globalStrength * attract,
        radius,
        words: trends
      };
      try {
        inst.update(dt, t, w, h, layer.params, env);
        ctx.save();
        applyLayerTransform(ctx, w, h, transform);
        inst.draw(ctx, w, h, layer.params, env);
        ctx.restore();
      } catch (err) {
        ctx.restore();
        console.error("Error dibujando capa", layer.type, err);
      }
    });

    if (settings.showCursor !== false) drawCursor(hands);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
