/*
 * Efectos visuales de Atractor Clima (sólo navegador, canvas 2D).
 *
 * Cada efecto expone:
 *   update(dt, t, w, h, params, env)
 *   draw(ctx, w, h, params, env)
 *
 * env (lo arma output.js en cada cuadro):
 *   env.hands    -> [{ x, y }] manos en píxeles, en el espacio de la capa
 *   env.strength -> fuerza del atractor (global × "Atracción a la mano" de la capa)
 *   env.radius   -> radio de acción de la mano en píxeles
 *   env.words    -> palabras [{ word, popularity }]
 *   env.weather  -> clima normalizado (ver output.js → normalizeWeather)
 *   env.climate  -> "Influencia del clima" de la capa (0..1)
 *   env.tint     -> cuánto tiñe la temperatura los colores (global × capa)
 */

// ---------------------------------------------------------------------------
// Utilidades de color
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const bigint = parseInt(full, 16) || 0;
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToCss(c, a) {
  return a == null ? "rgb(" + c.r + "," + c.g + "," + c.b + ")" : "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
}
function mixRgb(a, b, t) {
  return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
}
function lerpColorRgb(hexA, hexB, t) {
  return rgbToCss(mixRgb(hexToRgb(hexA), hexToRgb(hexB), t));
}
function hexToRgba(hex, alpha) {
  return rgbToCss(hexToRgb(hex), alpha);
}
function fireColor(ratio) {
  const stops = [
    { t: 1.0, c: [255, 255, 200] },
    { t: 0.6, c: [255, 170, 40] },
    { t: 0.3, c: [230, 60, 20] },
    { t: 0.0, c: [40, 10, 10] }
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (ratio <= a.t && ratio >= b.t) {
      const localT = (ratio - b.t) / (a.t - b.t || 1);
      return "rgb(" + Math.round(b.c[0] + (a.c[0] - b.c[0]) * localT) + "," + Math.round(b.c[1] + (a.c[1] - b.c[1]) * localT) + "," + Math.round(b.c[2] + (a.c[2] - b.c[2]) * localT) + ")";
    }
  }
  return "rgb(255,255,200)";
}

// --- Clima → color -----------------------------------------------------------
// Paleta de temperatura: frío = azules, templado = el color propio, calor = naranjas.
const COLD = { r: 90, g: 170, b: 255 };
const HOT = { r: 255, g: 110, b: 40 };
function tempTarget(base, tempNorm) {
  if (tempNorm < 0.42) return mixRgb(COLD, base, tempNorm / 0.42);
  if (tempNorm > 0.62) return mixRgb(base, HOT, (tempNorm - 0.62) / 0.38);
  return base;
}
// Devuelve el color de la capa teñido por la temperatura según env.tint.
function climateRgb(hex, env) {
  const base = hexToRgb(hex);
  if (!env || !env.weather || !env.tint) return base;
  return mixRgb(base, tempTarget(base, env.weather.tempNorm), Math.min(1, env.tint));
}
function climateColor(hex, env, alpha) {
  return rgbToCss(climateRgb(hex, env), alpha);
}

const NEUTRAL_WEATHER = { windX: 0, windY: 0, windNorm: 0, gustNorm: 0, rainNorm: 0, cloud: 0, humidity: 0.5, tempNorm: 0.5, dayLight: 1 };
function weatherOf(env) {
  return (env && env.weather) || NEUTRAL_WEATHER;
}
// Viento efectivo de la capa (ya multiplicado por su "Influencia del clima").
function windOf(env) {
  const w = weatherOf(env);
  const c = env && env.climate != null ? env.climate : 1;
  // Ráfagas: el viento pulsa un poco.
  const gust = 1 + w.gustNorm * 0.6 * Math.sin(performance.now() / 700) * Math.sin(performance.now() / 1900);
  return { x: w.windX * w.windNorm * c * gust, y: w.windY * w.windNorm * c * gust, n: w.windNorm * c };
}

function makeNoise2D() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  function grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }
  return function noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[X + perm[Y]];
    const ab = perm[X + perm[Y + 1]];
    const ba = perm[X + 1 + perm[Y]];
    const bb = perm[X + 1 + perm[Y + 1]];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return (lerp(x1, x2, v) + 1) / 2;
  };
}

// --- Música -------------------------------------------------------------------
// env.audio = { bass, mid, treble, volume, pulse, beat, m } o null si no hay audio.
function musicOf(env) { return (env && env.audio) || null; }
// Multiplicador de velocidad por volumen ("intensidad general").
function musicSpeed(env, amount) {
  const a = musicOf(env);
  return a ? 1 + a.volume * (amount != null ? amount : 1) : 1;
}

// --- Atractor (mano) ----------------------------------------------------------
function pullToward(env, x, y) {
  if (!env || !env.hands || env.hands.length === 0 || env.strength <= 0) return null;
  let best = null;
  let bestD2 = Infinity;
  for (const hand of env.hands) {
    const dx = hand.x - x;
    const dy = hand.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = { hand, dx, dy }; }
  }
  const dist = Math.sqrt(bestD2) || 0.0001;
  const r = Math.max(20, env.radius);
  const falloff = 1 / (1 + (dist / (r * 0.5)) * (dist / (r * 0.5)));
  best.dist = dist;
  best.ux = best.dx / dist;
  best.uy = best.dy / dist;
  best.force = Math.min(1, env.strength * falloff);
  return best;
}


// --- Multitouch: aparición por mano -------------------------------------------
// Cada mano (o dedo) tiene su propia palabra/imagen/animación: cuando toca
// aparece una; mientras sigue ahí, aparece otra después de "interval".
// Además, con la música, el beat hace aparecer una en un lugar al azar.
function spawnPerHand(fx, hands, dt, p, env, w, h) {
  if (!fx.slots) fx.slots = new Map();
  const seen = new Set();
  for (const hnd of hands) {
    const id = hnd.id != null ? hnd.id : "h0";
    seen.add(id);
    let slot = fx.slots.get(id);
    if (!slot) { slot = { wait: Infinity }; fx.slots.set(id, slot); } // mano nueva: aparece ya
    if (fx.items.some((it) => !it.flying && it.owner === id)) { slot.wait = 0; continue; }
    slot.wait += dt;
    if (slot.wait >= p.interval) {
      const before = fx.items.length;
      fx.spawn(hnd, p, env);
      if (fx.items.length > before) fx.items[fx.items.length - 1].owner = id;
      slot.wait = 0;
    }
  }
  for (const id of Array.from(fx.slots.keys())) if (!seen.has(id)) fx.slots.delete(id);

  const au = musicOf(env);
  const beatBusy = fx.items.some((it) => !it.flying && it.owner === "beat");
  if (beatBusy) fx.waitTimer = 0; else fx.waitTimer += dt;
  if (!beatBusy && fx.waitTimer >= p.interval && au && au.beat && Math.random() < au.m) {
    const before = fx.items.length;
    fx.spawn({ x: w * (0.15 + Math.random() * 0.7), y: h * (0.2 + Math.random() * 0.6) }, p, env);
    if (fx.items.length > before) fx.items[fx.items.length - 1].owner = "beat";
    fx.waitTimer = 0;
  }
}
// Mientras está quieta, cada palabra/imagen sigue a SU mano.
function ownerPull(env, hands, it) {
  const own = it.owner && hands.find((hh) => hh.id === it.owner);
  if (own) return { dx: own.x - it.x, dy: own.y - it.y };
  if (it.owner === "beat") return null;
  return pullToward(env, it.x, it.y);
}

// ---------------------------------------------------------------------------
// 1) PARTICULAS — salen del origen; convergen a la mano; el viento las arrastra
// ---------------------------------------------------------------------------
class ParticlesEffect {
  constructor() { this.particles = []; }
  spawn(w, h, p) {
    const spread = p.spread || 360;
    const angle = ((Math.random() * spread - spread / 2) * Math.PI) / 180 - Math.PI / 2;
    const sp = p.speed * (0.5 + Math.random() * 0.9);
    return {
      x: (p.originX / 100) * w,
      y: (p.originY / 100) * h,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      age: 0,
      life: Math.max(0.05, p.life * (0.6 + Math.random() * 0.8))
    };
  }
  update(dt, t, w, h, p, env) {
    const count = Math.round(p.count);
    while (this.particles.length < count) {
      const np = this.spawn(w, h, p);
      np.age = Math.random() * np.life;
      this.particles.push(np);
    }
    if (this.particles.length > count) this.particles.length = count;
    const k = dt * 60 * musicSpeed(env, 1.2);
    const wind = windOf(env);
    const rain = weatherOf(env).rainNorm * (env.climate != null ? env.climate : 1);
    // Beat: explota un golpe de partículas desde el origen.
    const au = musicOf(env);
    if (au && au.beat) {
      const n = Math.round(this.particles.length * 0.3 * au.m);
      for (let i = 0; i < n; i++) {
        const q = this.particles[Math.floor(Math.random() * this.particles.length)];
        Object.assign(q, this.spawn(w, h, p));
        const boost = 2.5 + au.bass * 3;
        q.vx *= boost; q.vy *= boost;
      }
    }
    for (const particle of this.particles) {
      particle.age += dt;
      if (particle.age >= particle.life) { Object.assign(particle, this.spawn(w, h, p)); continue; }
      const pull = pullToward(env, particle.x, particle.y);
      if (pull) {
        const accel = pull.force * 0.9;
        particle.vx += pull.ux * accel * k;
        particle.vy += pull.uy * accel * k;
        const damp = 1 - 0.035 * pull.force;
        particle.vx *= damp;
        particle.vy *= damp;
        if (pull.dist < 10) { Object.assign(particle, this.spawn(w, h, p)); continue; }
      }
      particle.vx += wind.x * 0.08 * k;
      particle.vy += wind.y * 0.08 * k + rain * 0.05 * k; // la lluvia las hace "pesar"
      particle.vy += p.gravity * dt * 30;
      particle.x += particle.vx * k;
      particle.y += particle.vy * k;
    }
  }
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = climateColor(p.color, env);
    for (const particle of this.particles) {
      const lifeRatio = 1 - particle.age / particle.life;
      if (lifeRatio <= 0) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio));
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(0.5, p.size * lifeRatio), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 2) ARBOL FRACTAL — se dobla hacia la mano; el viento lo hamaca e inclina
// ---------------------------------------------------------------------------
class FractalTreeEffect {
  constructor() { this.time = 0; this.env = null; }
  update(dt, t, w, h, p, env) { this.time = t; this.env = env; }
  draw(ctx, w, h, p, env) {
    ctx.lineCap = "round";
    const wind = windOf(env);
    this.windBend = wind.x * 0.35;
    const au = musicOf(env);
    this.swayBoost = 1 + wind.n * 4 + (au ? au.bass * 6 : 0);
    this.shake = au ? au.bass * 0.09 + au.pulse * 0.06 : 0;
    this.colStart = climateColor(p.colorStart, env);
    this.rgbStart = climateRgb(p.colorStart, env);
    this.rgbEnd = climateRgb(p.colorEnd, env);
    this._drawBranch(ctx, w / 2, h, -Math.PI / 2, p.initialLength, p.lineWidth, Math.round(p.depth), p, 0);
  }
  _drawBranch(ctx, x, y, angle, len, width, depthLeft, p, depthIndex) {
    if (depthLeft <= 0 || len < 2) return;
    const swayRad = ((p.sway || 0) * Math.PI) / 180 * this.swayBoost;
    const depthT = depthIndex / Math.max(1, p.depth);
    let a = angle + swayRad * Math.sin(this.time * (1.3 + this.swayBoost * 0.4) + depthIndex * 0.6) + this.windBend * depthT * 0.5;
    if (this.shake) a += (Math.random() - 0.5) * this.shake * depthT * 2; // graves: se sacude

    const pull = pullToward(this.env, x, y);
    if (pull) {
      let diff = Math.atan2(pull.dy, pull.dx) - a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a += diff * pull.force * 0.22;
    }

    const endX = x + Math.cos(a) * len;
    const endY = y + Math.sin(a) * len;
    const colorT = 1 - depthLeft / Math.max(1, p.depth);
    ctx.strokeStyle = rgbToCss(mixRgb(this.rgbStart, this.rgbEnd, colorT));
    ctx.lineWidth = Math.max(0.6, width);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const nextLen = len * p.lengthRatio;
    const nextWidth = width * 0.72;
    const spread = (p.angle * Math.PI) / 180;
    this._drawBranch(ctx, endX, endY, a - spread, nextLen, nextWidth, depthLeft - 1, p, depthIndex + 1);
    this._drawBranch(ctx, endX, endY, a + spread, nextLen, nextWidth, depthLeft - 1, p, depthIndex + 2);
  }
}

// ---------------------------------------------------------------------------
// 3) FLOW FIELD — líneas que siguen el ruido, el viento y la mano
// ---------------------------------------------------------------------------
class FlowFieldEffect {
  constructor() {
    this.noise = makeNoise2D();
    this.particles = [];
    this.z = Math.random() * 1000;
  }
  spawn(w, h) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    return { x, y, px: x, py: y, age: Math.random() * 2 };
  }
  update(dt, t, w, h, p, env) {
    const wind = windOf(env);
    this.z += p.noiseSpeed * dt * 60 * (1 + wind.n * 2);
    const count = Math.round(p.particleCount);
    while (this.particles.length < count) this.particles.push(this.spawn(w, h));
    if (this.particles.length > count) this.particles.length = count;
    const windLen = Math.hypot(wind.x, wind.y);
    const wb = Math.min(0.75, windLen * 0.9);
    for (const particle of this.particles) {
      const angle = this.noise(particle.x * p.noiseScale, particle.y * p.noiseScale + this.z) * Math.PI * 4;
      let vx = Math.cos(angle);
      let vy = Math.sin(angle);
      let speed = p.particleSpeed * (1 + wind.n * 1.5) * musicSpeed(env, 1.5);
      if (windLen > 0.001) {
        vx = vx * (1 - wb) + (wind.x / windLen) * wb;
        vy = vy * (1 - wb) + (wind.y / windLen) * wb;
      }
      const pull = pullToward(env, particle.x, particle.y);
      if (pull) {
        const b = Math.min(0.95, pull.force * 1.6);
        vx = vx * (1 - b) + pull.ux * b;
        vy = vy * (1 - b) + pull.uy * b;
        speed *= 1 + b * 1.5;
      }
      particle.px = particle.x;
      particle.py = particle.y;
      particle.x += vx * speed;
      particle.y += vy * speed;
      particle.age += dt;
      const absorbed = pull && pull.dist < 8;
      if (absorbed || particle.x < 0 || particle.x > w || particle.y < 0 || particle.y > h || particle.age > 8) {
        Object.assign(particle, this.spawn(w, h));
      }
    }
  }
  draw(ctx, w, h, p, env) {
    ctx.strokeStyle = climateColor(p.color, env);
    ctx.lineWidth = p.lineWidth;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (const particle of this.particles) {
      const dx = particle.x - particle.px;
      const dy = particle.y - particle.py;
      const len = Math.hypot(dx, dy) || 1;
      const scale = p.lineLength / len;
      ctx.moveTo(particle.x - dx * scale, particle.y - dy * scale);
      ctx.lineTo(particle.x, particle.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 4) FUEGO — se inclina con el viento, la lluvia lo achica, el frío lo vuelve azul
// ---------------------------------------------------------------------------
// Paleta de fuego a partir de 3 colores (centro → medio → puntas → casi negro).
function fireGradient(p) {
  const core = hexToRgb(p.colorCore || "#ffffc8");
  const mid = hexToRgb(p.colorMid || "#ffaa28");
  const tip = hexToRgb(p.colorTip || "#e63c14");
  const dark = { r: Math.round(tip.r * 0.17), g: Math.round(tip.g * 0.17), b: Math.round(tip.b * 0.17) };
  const stops = [{ t: 1, c: core }, { t: 0.6, c: mid }, { t: 0.3, c: tip }, { t: 0, c: dark }];
  const lut = [];
  for (let i = 0; i <= 32; i++) {
    const r = i / 32;
    let c = core;
    for (let j = 0; j < stops.length - 1; j++) {
      const a = stops[j], b = stops[j + 1];
      if (r <= a.t && r >= b.t) {
        const k = (r - b.t) / (a.t - b.t || 1);
        c = { r: Math.round(b.c.r + (a.c.r - b.c.r) * k), g: Math.round(b.c.g + (a.c.g - b.c.g) * k), b: Math.round(b.c.b + (a.c.b - b.c.b) * k) };
        break;
      }
    }
    lut.push("rgb(" + c.r + "," + c.g + "," + c.b + ")");
  }
  return lut;
}

class FireEffect {
  constructor() { this.particles = []; }
  spawn(w, h, p, rain) {
    const baseX = (p.baseX / 100) * w;
    const baseY = (p.baseY / 100) * h;
    const spread = (p.baseWidth / 100) * w;
    return {
      x: baseX + (Math.random() - 0.5) * spread,
      y: baseY,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(1 + Math.random()) * p.height * (1 - 0.55 * rain),
      age: 0,
      life: (0.6 + Math.random() * 0.8) * (1 - 0.5 * rain),
      seed: Math.random() * 100
    };
  }
  update(dt, t, w, h, p, env) {
    const c = env.climate != null ? env.climate : 1;
    const rain = weatherOf(env).rainNorm * c;
    const count = Math.round(p.intensity);
    while (this.particles.length < count) this.particles.push(this.spawn(w, h, p, rain));
    if (this.particles.length > count) this.particles.length = count;
    const k = dt * 60;
    const wind = windOf(env);
    const au = musicOf(env);
    this.pulse = au ? au.bass * 0.9 + au.pulse * 0.4 : 0; // graves: el fuego pulsa
    for (const particle of this.particles) {
      particle.age += dt;
      if (particle.age >= particle.life) {
        Object.assign(particle, this.spawn(w, h, p, rain));
        particle.vy *= 1 + this.pulse;
        continue;
      }
      particle.x += particle.vx * k + Math.sin(t * 3 + particle.seed) * p.turbulence * 0.5 * (1 + wind.n);
      particle.y += particle.vy * k;
      particle.vy -= 0.01 * p.height;
      // El viento empuja más a las llamas que ya subieron.
      const age = particle.age / particle.life;
      particle.x += wind.x * 5 * age * k;
      particle.y += wind.y * 2 * age * k;
      const pull = pullToward(env, particle.x, particle.y);
      if (pull) {
        particle.x += pull.ux * pull.force * 6 * k;
        particle.y += pull.uy * pull.force * 6 * k;
      }
    }
  }
  draw(ctx, w, h, p, env) {
    const key = (p.colorCore || "") + (p.colorMid || "") + (p.colorTip || "");
    if (key !== this.lutKey) { this.lutKey = key; this.lut = fireGradient(p); }
    const lut = this.lut;
    ctx.globalCompositeOperation = "lighter";
    // Con frío las llamas viran al azul (girando el tono).
    const tn = weatherOf(env).tempNorm;
    const hue = env.tint && tn < 0.42 ? Math.round((1 - tn / 0.42) * 190 * Math.min(1, env.tint)) : 0;
    if (hue > 4) ctx.filter = "hue-rotate(" + hue + "deg)";
    for (const particle of this.particles) {
      const lifeRatio = 1 - particle.age / particle.life;
      if (lifeRatio <= 0) continue;
      ctx.fillStyle = lut[Math.max(0, Math.min(32, Math.round(lifeRatio * 32)))];
      ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio * 1.3));
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(0.5, p.size * lifeRatio * (1 + (this.pulse || 0))), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 5) AGUA — sube hacia la mano; el viento agita las olas; la lluvia sube el nivel
// ---------------------------------------------------------------------------
// Dibuja el agua. Con "Banda espejada" es una franja con olas arriba y abajo
// (la de abajo es el espejo de la de arriba); si no, llena hasta el borde.
// Se dibuja más allá de los bordes para que al rotar la capa no se vean cortes.
function drawWaterShape(ctx, w, h, p, st, rgb) {
  const band = p.band !== false;
  const levelY = (p.levelY / 100) * h - (st.level || 0);
  const margin = Math.max(w, h);
  const x0 = -margin;
  const x1 = w + margin;
  const step = Math.max(4, Math.floor(w / 160));
  const sigma = w * 0.09;
  const waveCount = Math.round(p.waveCount);
  const half = band ? ((p.thickness != null ? p.thickness : 35) / 100) * h / 2 : 0;
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < waveCount; i++) {
    const phase = st.phase + i * 1.3;
    const amp = p.amplitude * (st.ampBoost || 1) * (1 - i * 0.15);
    const freq = p.frequency * (1 + i * 0.12);
    // Capas internas: en la banda se van achicando hacia el centro.
    const inset = i * (p.amplitude * 0.3);
    const wave = (x) => Math.sin((x / w) * Math.PI * 2 * freq + phase) * amp;
    // Una ola por cada mano (st.lifts: [{ x, y, lift }]).
    const lifts = st.lifts || [];
    const k = 1 - i * 0.12;
    ctx.beginPath();
    if (band) {
      // Hacia cada mano la banda se hincha (arriba y abajo a la vez).
      const swell = (x) => {
        let sum = 0;
        for (const L of lifts) {
          if (L.lift <= 0.001) continue;
          const g = Math.exp(-((x - L.x) * (x - L.x)) / (2 * sigma * sigma));
          sum += g * L.lift * Math.min(Math.abs(L.y - levelY), h * 0.45) * 0.85;
        }
        return sum * k;
      };
      const top = [];
      for (let x = x0; x <= x1 + step; x += step) {
        const y = levelY - half + inset + wave(x) - swell(x);
        top.push([x, y]);
      }
      ctx.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) ctx.lineTo(x, y);
      // Borde de abajo: espejo del de arriba respecto del centro.
      for (let j = top.length - 1; j >= 0; j--) ctx.lineTo(top[j][0], 2 * levelY - top[j][1]);
    } else {
      const lift = (x) => {
        let sum = 0;
        for (const L of lifts) {
          if (L.lift <= 0.001) continue;
          const g = Math.exp(-((x - L.x) * (x - L.x)) / (2 * sigma * sigma));
          sum += g * L.lift * (L.y - levelY) * 0.85;
        }
        return sum * k;
      };
      ctx.moveTo(x0, h + margin);
      for (let x = x0; x <= x1 + step; x += step) {
        ctx.lineTo(x, levelY + inset + wave(x) + lift(x));
      }
      ctx.lineTo(x1 + step, h + margin);
    }
    ctx.closePath();
    ctx.fillStyle = rgbToCssW(rgb, p.opacity * (1 - i * 0.15));
    ctx.fill();
  }
}
function rgbToCssW(c, a) { return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")"; }

class WaterEffect {
  constructor() { this.time = 0; this.lift = 0; this.liftX = 0; this.level = 0; this.phase = 0; this.ampBoost = 1; }
  update(dt, t, w, h, p, env) {
    const wind = windOf(env);
    const c = env.climate != null ? env.climate : 1;
    this.time = t;
    // Las olas corren hacia donde sopla el viento.
    this.phase += dt * p.speed * (1 + wind.n * 2.5) * musicSpeed(env, 1.5) * (wind.x < -0.05 ? -1 : 1);
    const au = musicOf(env);
    this.ampBoost = (1 + wind.n * 2) * (1 + (au ? au.bass * 2.2 + au.pulse * 0.8 : 0)); // graves: el agua pulsa
    // La lluvia sube el nivel poco a poco (hasta 18% de la pantalla).
    const targetLevel = weatherOf(env).rainNorm * c * 0.18 * h;
    this.level += (targetLevel - this.level) * Math.min(1, dt * 0.3);
    // Una ola por mano: crece mientras la mano está y se apaga sola al irse.
    if (!this.liftMap) this.liftMap = new Map();
    const present = new Set();
    for (const hnd of (env && env.hands) || []) {
      const id = hnd.id != null ? hnd.id : "h0";
      present.add(id);
      let L = this.liftMap.get(id);
      if (!L) { L = { x: hnd.x, y: hnd.y, lift: 0 }; this.liftMap.set(id, L); }
      L.x = hnd.x; L.y = hnd.y;
      L.lift += (env.strength - L.lift) * Math.min(1, dt * 4);
    }
    for (const [id, L] of this.liftMap) {
      if (!present.has(id)) {
        L.lift += (0 - L.lift) * Math.min(1, dt * 4);
        if (L.lift < 0.002) this.liftMap.delete(id);
      }
    }
    this.lifts = Array.from(this.liftMap.values());
  }
  draw(ctx, w, h, p, env) {
    drawWaterShape(ctx, w, h, p, this, climateRgb(p.color, env));
  }
}

// ---------------------------------------------------------------------------
// 6) PALABRAS — la mano toca, surge una palabra, se queda, se vuelve translúcida
//    y sale volando (hacia donde sopla el viento si hay viento).
// ---------------------------------------------------------------------------
class TrendingWordsEffect {
  constructor() {
    this.items = [];
    this.waitTimer = 0;
    this.recent = [];
  }
  pickWord(words) {
    if (!words || words.length === 0) return null;
    const candidates = words.filter((w) => !this.recent.includes(w.word));
    const pool = candidates.length > 0 ? candidates : words;
    const total = pool.reduce((s, w) => s + (w.popularity || 0.1), 0);
    let r = Math.random() * total;
    let chosen = pool[pool.length - 1];
    for (const w of pool) {
      r -= (w.popularity || 0.1);
      if (r <= 0) { chosen = w; break; }
    }
    this.recent.push(chosen.word);
    if (this.recent.length > Math.min(8, Math.floor(words.length / 2))) this.recent.shift();
    return chosen;
  }
  spawn(hand, p, env) {
    const word = this.pickWord(env.words);
    if (!word) return;
    const popularity = word.popularity || 0.5;
    const size = p.size * ((1 - p.popularityScale) + p.popularityScale * (0.35 + 0.65 * popularity));
    // Dirección de vuelo: al azar, pero empujada por el viento.
    const wind = windOf(env);
    const a = Math.random() * Math.PI * 2;
    let dx = Math.cos(a) + wind.x * 2.5;
    let dy = Math.sin(a) + wind.y * 2.5;
    const len = Math.hypot(dx, dy) || 1;
    this.items.push({
      text: word.word,
      popularity,
      size,
      x: hand.x,
      y: hand.y,
      age: 0,
      hold: p.hold,
      flyTime: p.flyTime,
      dirX: dx / len,
      dirY: dy / len,
      spin: (Math.random() - 0.5) * 1.6,
      rot: (Math.random() - 0.5) * 0.1,
      flying: false,
      vel: 0,
      near: 0
    });
  }
  update(dt, t, w, h, p, env) {
    const hands = (env && env.hands) || [];
    const APPEAR = 0.35;
    spawnPerHand(this, hands, dt, p, env, w, h);
    const wind = windOf(env);
    for (const it of this.items) {
      it.age += dt;
      if (!it.flying) {
        const pull = ownerPull(env, hands, it);
        if (pull) {
          const follow = Math.min(1, dt * 6 * Math.min(1, env.strength));
          it.x += pull.dx * follow;
          it.y += pull.dy * follow;
        }
        const target = pull ? Math.min(1, env.strength) : 0;
        it.near += (target - it.near) * Math.min(1, dt * 6);
        if (it.age >= APPEAR + it.hold) {
          it.flying = true;
          it.flyAge = 0;
          this.waitTimer = 0;
        }
      } else {
        it.flyAge += dt;
        it.vel += p.flySpeed * 2200 * dt;
        it.x += it.dirX * it.vel * dt + wind.x * 120 * dt;
        it.y += it.dirY * it.vel * dt + wind.y * 120 * dt;
        it.rot += it.spin * dt;
        it.near += (0 - it.near) * Math.min(1, dt * 3);
      }
    }
    this.items = this.items.filter((it) => !it.flying || (it.flyAge < it.flyTime &&
      it.x > -w * 0.5 && it.x < w * 1.5 && it.y > -h * 0.5 && it.y < h * 1.5));
  }
  // Cada palabra se dibuja una sola vez en dos versiones (nítida y difuminada)
  // y después sólo se mueve, escala y mezcla: mucho más liviano que difuminar
  // el texto en cada cuadro.
  sprite(it, color, glow, blurPx) {
    const R = Math.round(it.size * 1.5); // resolución de sobra para cuando crece
    const key = it.text + "|" + R + "|" + color + "|" + glow + "|" + Math.round(blurPx * 2);
    if (it.spriteKey === key) return it.sprites;
    const font = "800 " + R + "px 'Segoe UI', system-ui, sans-serif";
    const meas = document.createElement("canvas").getContext("2d");
    meas.font = font;
    const textW = Math.ceil(meas.measureText(it.text).width);
    const pad = Math.ceil(R * 0.45 + blurPx * 4 + (glow ? 60 : 10));
    const make = (soft) => {
      const c = document.createElement("canvas");
      c.width = textW + pad * 2;
      c.height = R + pad * 2;
      const x = c.getContext("2d");
      x.font = font;
      x.textAlign = "center";
      x.textBaseline = "middle";
      if (soft && blurPx > 0.3) x.filter = "blur(" + (blurPx * 1.5).toFixed(1) + "px)";
      if (glow) { x.shadowColor = color; x.shadowBlur = (24 + 30 * soft) * 1.5; }
      x.fillStyle = color;
      x.fillText(it.text, c.width / 2, c.height / 2);
      x.shadowBlur = 0;
      if (!soft) { x.fillStyle = "rgba(255,255,255,0.35)"; x.fillText(it.text, c.width / 2, c.height / 2); }
      return c;
    };
    it.sprites = { sharp: make(0), soft: make(1), textW, R };
    it.spriteKey = key;
    return it.sprites;
  }
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = "source-over";
    const APPEAR = 0.35;
    const color = climateColor(p.color, env);
    // Con humedad las palabras se difuminan un poco más.
    const c = env.climate != null ? env.climate : 1;
    const humidBlur = Math.max(0, weatherOf(env).humidity - 0.6) * 10 * c;
    const fadeTo = p.fadeTo != null ? p.fadeTo : 0.4;
    const maxBlur = (p.blur != null ? p.blur : 4) + humidBlur;
    for (const it of this.items) {
      let scale, alpha, soft;
      if (!it.flying) {
        const a = Math.min(1, it.age / APPEAR);
        scale = 1 + 2.2 * Math.pow(a - 1, 3) + 1.2 * Math.pow(a - 1, 2); // surge con un leve rebote
        soft = Math.max(0, Math.min(1, (it.age - APPEAR) / 0.5));
        soft = soft * soft * (3 - 2 * soft);
        alpha = Math.min(1, a * 1.5) * (1 - (1 - fadeTo) * soft);
      } else {
        const f = it.flyAge / it.flyTime;
        soft = 1;
        scale = 1 + f * 0.45;
        alpha = fadeTo * Math.max(0, 1 - f * f);
      }
      if (alpha <= 0.003) continue;
      const sp = this.sprite(it, color, !!p.glow, maxBlur);
      let size = it.size * Math.max(0.01, scale) * (1 + 0.4 * it.near);
      // Que nunca sea más ancha que la pantalla.
      const textWAtSize = sp.textW * (size / sp.R);
      if (textWAtSize > w * 0.92) size *= (w * 0.92) / textWAtSize;
      const k = size / sp.R;
      const width = sp.textW * k;
      let x = it.x, y = it.y;
      if (!it.flying) {
        x = Math.max(width / 2 + 8, Math.min(w - width / 2 - 8, x));
        y = Math.max(size / 2 + 8, Math.min(h - size / 2 - 8, y));
        it.x = x; it.y = y;
      }
      const dw = sp.sharp.width * k;
      const dh = sp.sharp.height * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(it.rot);
      if (soft < 0.999) {
        ctx.globalAlpha = alpha * (1 - soft);
        ctx.drawImage(sp.sharp, -dw / 2, -dh / 2, dw, dh);
      }
      if (soft > 0.001) {
        ctx.globalAlpha = alpha * soft;
        ctx.drawImage(sp.soft, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 7) LLUVIA — la cantidad de gotas sigue a la lluvia real; el viento las inclina
// ---------------------------------------------------------------------------
class RainEffect {
  constructor() { this.drops = []; this.splashes = []; }
  spawn(w, h, top) {
    // Más ancho que la pantalla para que las diagonales la cubran entera.
    return {
      x: Math.random() * w * 2.2 - w * 0.6,
      y: top ? -Math.random() * h * 0.3 : Math.random() * h,
      s: 0.7 + Math.random() * 0.6,
      l: 0.6 + Math.random() * 0.8
    };
  }
  update(dt, t, w, h, p, env) {
    const c = env.climate != null ? env.climate : 1;
    const rainNorm = weatherOf(env).rainNorm;
    const target = Math.round(p.minDrops + (p.maxDrops - p.minDrops) * rainNorm * c);
    while (this.drops.length < target) this.drops.push(this.spawn(w, h, false));
    if (this.drops.length > target) this.drops.length = target;
    const wind = windOf(env);
    // Inclinación propia (líneas diagonales) + lo que sume el viento real.
    const slant = Math.max(-75, Math.min(75, p.slant || 0)) * Math.PI / 180;
    this.vx = Math.tan(slant) * p.speed + wind.x * p.speed * 0.9;
    const k = dt * 60;
    for (const d of this.drops) {
      let vx = this.vx;
      const pull = pullToward(env, d.x, d.y);
      if (pull) vx += pull.ux * pull.force * p.speed * 0.8;
      d.vx = vx;
      d.x += vx * d.s * k;
      d.y += p.speed * d.s * k * musicSpeed(env, 0.6);
      if (d.y > h) {
        if (p.splash && this.splashes.length < 300 && Math.random() < 0.5) {
          this.splashes.push({ x: d.x, y: h - 2, age: 0 });
        }
        Object.assign(d, this.spawn(w, h, true));
      }
    }
    for (const s of this.splashes) s.age += dt;
    this.splashes = this.splashes.filter((s) => s.age < 0.35);
  }
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = "source-over";
    const color = climateColor(p.color, env);
    ctx.strokeStyle = color;
    ctx.lineWidth = p.lineWidth;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const d of this.drops) {
      const len = p.length * d.l;
      const ang = Math.atan2(p.speed, d.vx || 0);
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - Math.cos(ang) * len, d.y - Math.sin(ang) * len);
    }
    ctx.stroke();
    for (const s of this.splashes) {
      const f = s.age / 0.35;
      ctx.globalAlpha = 0.5 * (1 - f);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 2 + f * 12, 1 + f * 3, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 8) NUBES — la cantidad sigue a la nubosidad real; el viento las arrastra
// ---------------------------------------------------------------------------
class CloudsEffect {
  constructor() { this.clouds = []; }
  spawn(w, h, p, offscreen, dirX) {
    const size = p.size * (0.6 + Math.random() * 0.9);
    const puffs = [];
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      puffs.push({ dx: (Math.random() - 0.5) * size * 1.6, dy: (Math.random() - 0.5) * size * 0.5, r: size * (0.35 + Math.random() * 0.45) });
    }
    return {
      x: offscreen ? (dirX >= 0 ? -size * 1.5 : w + size * 1.5) : Math.random() * w,
      y: Math.random() * h * 0.85,
      size,
      puffs,
      drift: 0.5 + Math.random(),
      alpha: 0,
      seed: Math.random() * 100
    };
  }
  update(dt, t, w, h, p, env) {
    const c = env.climate != null ? env.climate : 1;
    const wx = weatherOf(env);
    const amount = Math.min(1, wx.cloud * c + Math.max(0, wx.humidity - 0.7) * c);
    const target = Math.round(p.minClouds + (p.maxClouds - p.minClouds) * amount);
    const wind = windOf(env);
    const dirX = wind.x !== 0 ? wind.x : 1;
    while (this.clouds.length < target) this.clouds.push(this.spawn(w, h, p, this.clouds.length > 0 && this.inited, dirX));
    this.inited = true;
    // Las que sobran se desvanecen.
    this.clouds.forEach((cl, i) => { cl.leaving = i >= target; });
    const k = dt * 60;
    for (const cl of this.clouds) {
      const vx = (p.speed * Math.sign(dirX) + wind.x * 6) * cl.drift;
      cl.x += vx * k * 0.5;
      cl.y += (wind.y * 1.5 + Math.sin(t * 0.2 + cl.seed) * 0.1) * k * 0.5;
      const pull = pullToward(env, cl.x, cl.y);
      if (pull) {
        cl.x += pull.ux * pull.force * 1.5 * k;
        cl.y += pull.uy * pull.force * 1.5 * k;
      }
      cl.alpha += ((cl.leaving ? 0 : 1) - cl.alpha) * Math.min(1, dt * 0.6);
      const m = cl.size * 2;
      if (cl.x < -m * 1.2) cl.x = w + m;
      if (cl.x > w + m * 1.2) cl.x = -m;
      if (cl.y < -m) cl.y = h * 0.85;
      if (cl.y > h + m) cl.y = 0;
    }
    this.clouds = this.clouds.filter((cl) => !(cl.leaving && cl.alpha < 0.02));
  }
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = "source-over";
    const wx = weatherOf(env);
    // De noche las nubes son más oscuras.
    const rgb = mixRgb(hexToRgb("#3a4152"), climateRgb(p.color, env), 0.35 + 0.65 * wx.dayLight);
    for (const cl of this.clouds) {
      for (const pf of cl.puffs) {
        const x = cl.x + pf.dx;
        const y = cl.y + pf.dy;
        const g = ctx.createRadialGradient(x, y, 0, x, y, pf.r);
        g.addColorStop(0, rgbToCss(rgb, p.opacity * cl.alpha));
        g.addColorStop(1, rgbToCss(rgb, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, pf.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 9) PÍXELES — cuadraditos sueltos que salen del origen y se expanden
// ---------------------------------------------------------------------------
class PixelsEffect {
  constructor() { this.pixels = []; }
  pickColor(p, env) {
    const mode = p.colorMode || "single";
    if (mode === "rainbow") return "hsl(" + Math.floor(Math.random() * 360) + ",95%,60%)";
    if (mode === "palette") {
      // Variaciones de tono alrededor del color elegido.
      const c = hexToRgb(p.color);
      const f = 0.55 + Math.random() * 0.7;
      return rgbToCss({ r: Math.min(255, Math.round(c.r * f)), g: Math.min(255, Math.round(c.g * f)), b: Math.min(255, Math.round(c.b * f)) });
    }
    if (mode === "climate") {
      const tn = weatherOf(env).tempNorm;
      const base = tempTarget(hexToRgb(p.color), tn);
      const j = (Math.random() - 0.5) * 60;
      return rgbToCss({ r: clamp255(base.r + j), g: clamp255(base.g + j), b: clamp255(base.b + j) });
    }
    return null; // un solo color: se pinta en draw()
  }
  spawn(w, h, p, env) {
    const spread = p.spread || 360;
    const angle = ((Math.random() * spread - spread / 2) * Math.PI) / 180 - Math.PI / 2;
    const sp = p.speed * (0.3 + Math.random() * 1.1);
    return {
      x: (p.originX / 100) * w,
      y: (p.originY / 100) * h,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      age: 0,
      life: Math.max(0.2, p.life * (0.5 + Math.random())),
      size: Math.max(1, Math.round(p.size * (p.sizeVariation ? 0.5 + Math.random() : 1))),
      color: this.pickColor(p, env),
      flicker: Math.random() * 10
    };
  }
  update(dt, t, w, h, p, env) {
    const count = Math.round(p.count);
    while (this.pixels.length < count) {
      const px = this.spawn(w, h, p, env);
      px.age = Math.random() * px.life;
      this.pixels.push(px);
    }
    if (this.pixels.length > count) this.pixels.length = count;
    if (this.lastMode !== p.colorMode || this.lastColor !== p.color) {
      this.lastMode = p.colorMode;
      this.lastColor = p.color;
      this.pixels.forEach((px) => { px.color = this.pickColor(p, env); });
    }
    const k = dt * 60 * musicSpeed(env, 1.2);
    const wind = windOf(env);
    // Beat: explota un golpe de píxeles desde el origen.
    const au = musicOf(env);
    if (au && au.beat) {
      const n = Math.round(this.pixels.length * 0.3 * au.m);
      for (let i = 0; i < n; i++) {
        const q = this.pixels[Math.floor(Math.random() * this.pixels.length)];
        Object.assign(q, this.spawn(w, h, p, env));
        const boost = 2.5 + au.bass * 3;
        q.vx *= boost; q.vy *= boost;
      }
    }
    this.treble = au ? au.treble : 0;
    for (const px of this.pixels) {
      px.age += dt;
      if (px.age >= px.life) { Object.assign(px, this.spawn(w, h, p, env)); continue; }
      const pull = pullToward(env, px.x, px.y);
      if (pull) {
        px.vx += pull.ux * pull.force * 0.8 * k;
        px.vy += pull.uy * pull.force * 0.8 * k;
        px.vx *= 1 - 0.03 * pull.force;
        px.vy *= 1 - 0.03 * pull.force;
        if (pull.dist < 8) { Object.assign(px, this.spawn(w, h, p, env)); continue; }
      }
      px.vx += wind.x * 0.06 * k;
      px.vy += wind.y * 0.06 * k;
      px.x += px.vx * k;
      px.y += px.vy * k;
    }
  }
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = "source-over";
    const single = climateColor(p.color, env);
    const grid = p.snap ? Math.max(1, Math.round(p.size)) : 0;
    const now = performance.now() / 1000;
    for (const px of this.pixels) {
      const lifeRatio = 1 - px.age / px.life;
      if (lifeRatio <= 0) continue;
      let alpha = Math.min(1, lifeRatio * 1.6);
      if (p.flicker) alpha *= 0.55 + 0.45 * (Math.sin(now * 12 + px.flicker) > 0 ? 1 : 0.2);
      // Agudos: los píxeles titilan.
      if (this.treble > 0.15 && Math.random() < this.treble * 0.45) alpha *= 0.15;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = px.color || single;
      const s = px.size;
      let x = px.x - s / 2;
      let y = px.y - s / 2;
      if (grid) { x = Math.round(x / grid) * grid; y = Math.round(y / grid) * grid; }
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }
}

function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// ---------------------------------------------------------------------------
// 10/11) RAYAS — verticales u horizontales; engordan y adelgazan; cada una
//        se mueve hacia un costado o el otro y cambia de rumbo al azar.
// ---------------------------------------------------------------------------
class StripesEffect {
  constructor(vertical) {
    this.vertical = vertical;
    this.stripes = [];
  }
  spawn(len, p) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      pos: Math.random() * len,
      phase: Math.random() * Math.PI * 2,
      freq: 0.4 + Math.random() * 1.2,
      vel: dir * (0.3 + Math.random()),
      targetVel: dir * (0.3 + Math.random()),
      nextTurn: 1 + Math.random() * 4,
      colorIndex: Math.random(),
      near: 0
    };
  }
  update(dt, t, w, h, p, env) {
    const len = this.vertical ? w : h;
    const au = musicOf(env);
    this.bass = au ? au.bass : 0;
    // Beat: las rayas cambian de color.
    if (au && au.beat) {
      this.beatFlash = 1;
      for (const s of this.stripes) if (Math.random() < 0.6 * au.m) s.colorIndex = Math.random();
      this.hueShift = (this.hueShift || 0) + 40 + Math.random() * 100;
    }
    this.beatFlash = (this.beatFlash || 0) * Math.exp(-dt * 6);
    const count = Math.round(p.count);
    while (this.stripes.length < count) this.stripes.push(this.spawn(len, p));
    if (this.stripes.length > count) this.stripes.length = count;
    const k = dt * 60;
    const wind = windOf(env);
    const windAlong = this.vertical ? wind.x : wind.y;
    for (const s of this.stripes) {
      // Cambiar de dirección (o de velocidad) cada tanto.
      s.nextTurn -= dt * Math.max(0.05, p.randomness);
      if (s.nextTurn <= 0) {
        const flip = Math.random() < 0.5 ? -1 : 1;
        s.targetVel = flip * (0.2 + Math.random() * 1.3);
        s.nextTurn = 1 + Math.random() * 4;
      }
      s.vel += (s.targetVel - s.vel) * Math.min(1, dt * 1.5);
      s.pos += (s.vel * p.speed * musicSpeed(env, 1.5) + windAlong * 4) * k;
      // La mano atrae a las rayas cercanas y las engorda.
      const cx = this.vertical ? s.pos : w / 2;
      const cy = this.vertical ? h / 2 : s.pos;
      const handPull = pullToward(env, cx, cy);
      let near = 0;
      if (handPull) {
        const along = this.vertical ? handPull.dx : handPull.dy;
        const dist = Math.abs(along);
        const f = env.strength / (1 + (dist / Math.max(40, env.radius * 0.3)) ** 2);
        s.pos += Math.sign(along) * Math.min(dist, f * 6 * k);
        near = Math.min(1, f);
      }
      s.near += (near - s.near) * Math.min(1, dt * 5);
      const m = p.maxWidth;
      if (s.pos < -m) s.pos = len + m;
      if (s.pos > len + m) s.pos = -m;
    }
    this.time = t;
  }
  stripeColor(s, p, env) {
    const mode = p.colorMode || "single";
    if (mode === "rainbow") return "hsl(" + Math.floor((s.colorIndex * 360 + this.time * 20 + (this.hueShift || 0)) % 360) + ",90%,60%)";
    // Un solo color: con el beat se aclara un instante.
    if (mode === "single" && this.beatFlash > 0.05) {
      return rgbToCss(mixRgb(climateRgb(p.color, env), { r: 255, g: 255, b: 255 }, this.beatFlash * 0.6));
    }
    if (mode === "two") return climateColor(s.colorIndex < 0.5 ? p.color : p.color2, env);
    if (mode === "climate") {
      const base = tempTarget(hexToRgb(p.color), weatherOf(env).tempNorm);
      const j = (s.colorIndex - 0.5) * 70;
      return rgbToCss({ r: clamp255(base.r + j), g: clamp255(base.g + j), b: clamp255(base.b + j) });
    }
    return climateColor(p.color, env);
  }
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = p.blend ? "lighter" : "source-over";
    ctx.globalAlpha = p.opacity;
    for (const s of this.stripes) {
      const wave = 0.5 + 0.5 * Math.sin(this.time * p.pulse * s.freq + s.phase);
      // Graves: las rayas engordan.
      const width = (p.minWidth + (p.maxWidth - p.minWidth) * wave) * (1 + s.near * 1.5) * (1 + (this.bass || 0) * 1.6);
      ctx.fillStyle = this.stripeColor(s, p, env);
      if (this.vertical) ctx.fillRect(s.pos - width / 2, 0, width, h);
      else ctx.fillRect(0, s.pos - width / 2, w, width);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 12) IMÁGENES — PNG (con transparencia) que aparecen al tocar y salen
//     volando, o que flotan siempre en el punto de origen.
// ---------------------------------------------------------------------------
const imageCache = new Map(); // url -> HTMLImageElement
function getImage(url) {
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = url;
    imageCache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// Quitar el fondo de una imagen que NO tiene transparencia real (por ejemplo,
// un PNG con los "cuadraditos" de transparencia dibujados, o un fondo blanco):
//  1. mira los colores del borde de la imagen (ahí está el fondo),
//  2. desde el borde "inunda" hacia adentro sólo por píxeles de esos colores,
//  3. los vuelve transparentes. Lo que no toca el borde (el dibujo) queda igual.
// Si la imagen ya tiene transparencia de verdad en el borde, no hace nada.
const cleanCache = new Map(); // "url|tol" -> canvas
function cleanedImage(img, url, tol) {
  const key = url + "|" + tol;
  let c = cleanCache.get(key);
  if (c) return c;
  if (cleanCache.size > 60) cleanCache.clear();
  const maxSide = 1200;
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(1, Math.round(img.naturalWidth * k));
  const H = Math.max(1, Math.round(img.naturalHeight * k));
  c = document.createElement("canvas");
  c.width = W; c.height = H;
  c.naturalWidth = W; c.naturalHeight = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0, W, H);
  let data;
  try { data = x.getImageData(0, 0, W, H); } catch (e) { cleanCache.set(key, img); return img; }
  const px = data.data;

  // 1. Colores del borde.
  const border = [];
  for (let i = 0; i < W; i++) { border.push(i, (H - 1) * W + i); }
  for (let j = 1; j < H - 1; j++) { border.push(j * W, j * W + W - 1); }
  let transparent = 0;
  const bins = new Map();
  for (const idx of border) {
    const o = idx * 4;
    if (px[o + 3] < 16) { transparent++; continue; }
    const bin = ((px[o] >> 4) << 8) | ((px[o + 1] >> 4) << 4) | (px[o + 2] >> 4);
    const b = bins.get(bin) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += px[o]; b.g += px[o + 1]; b.b += px[o + 2];
    bins.set(bin, b);
  }
  const opaque = border.length - transparent;
  if (opaque < border.length * 0.5) { cleanCache.set(key, img); return img; } // ya es transparente
  const sorted = Array.from(bins.values()).sort((a, b) => b.n - a.n);
  const palette = [];
  let covered = 0;
  for (const b of sorted) {
    palette.push([b.r / b.n, b.g / b.n, b.b / b.n]);
    covered += b.n;
    if (covered >= opaque * 0.92 || palette.length >= 8) break;
  }
  const tol2 = tol * tol;
  const isBg = (o) => {
    if (px[o + 3] < 16) return true;
    for (const q of palette) {
      const dr = px[o] - q[0], dg = px[o + 1] - q[1], db = px[o + 2] - q[2];
      if (dr * dr + dg * dg + db * db <= tol2) return true;
    }
    return false;
  };

  // 2. Inundar desde el borde.
  const seen = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  for (const idx of border) {
    if (!seen[idx] && isBg(idx * 4)) { seen[idx] = 1; queue[tail++] = idx; }
  }
  while (head < tail) {
    const idx = queue[head++];
    px[idx * 4 + 3] = 0; // 3. transparente
    const cx = idx % W, cy = (idx / W) | 0;
    if (cx > 0) { const n = idx - 1; if (!seen[n] && isBg(n * 4)) { seen[n] = 1; queue[tail++] = n; } }
    if (cx < W - 1) { const n = idx + 1; if (!seen[n] && isBg(n * 4)) { seen[n] = 1; queue[tail++] = n; } }
    if (cy > 0) { const n = idx - W; if (!seen[n] && isBg(n * 4)) { seen[n] = 1; queue[tail++] = n; } }
    if (cy < H - 1) { const n = idx + W; if (!seen[n] && isBg(n * 4)) { seen[n] = 1; queue[tail++] = n; } }
  }
  // Suavizar el borde del dibujo: los píxeles pegados al fondo quedan semitransparentes.
  for (let idx = 0; idx < W * H; idx++) {
    if (seen[idx]) continue;
    const cx = idx % W, cy = (idx / W) | 0;
    const nearBg = (cx > 0 && seen[idx - 1]) || (cx < W - 1 && seen[idx + 1]) || (cy > 0 && seen[idx - W]) || (cy < H - 1 && seen[idx + W]);
    if (nearBg) px[idx * 4 + 3] = Math.round(px[idx * 4 + 3] * 0.6);
  }
  x.putImageData(data, 0, 0);
  cleanCache.set(key, c);
  return c;
}

// Imagen teñida: se pinta el color encima respetando la transparencia del PNG.
const tintCache = new Map(); // "url|color|amount" -> canvas
function tintedImage(img, url, color, amount) {
  if (amount <= 0.001) return img;
  const key = url + "|" + color + "|" + amount.toFixed(2);
  let c = tintCache.get(key);
  if (c) return c;
  if (tintCache.size > 150) tintCache.clear();
  const maxSide = 900; // tope para que no pese
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.naturalWidth = c.width;   // para que drawImage() la trate igual que una imagen
  c.naturalHeight = c.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, c.width, c.height);
  x.globalCompositeOperation = "source-atop";
  x.globalAlpha = Math.min(1, amount);
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}

const RAINBOW_STEPS = 12;
function rainbowColor(step) {
  return "hsl(" + Math.round((step % RAINBOW_STEPS) * (360 / RAINBOW_STEPS)) + ",95%,60%)";
}

class ImagesEffect {
  constructor() { this.items = []; this.waitTimer = 0; this.lastIndex = -1; this.floating = new Map(); }
  pick(urls) {
    if (!urls || urls.length === 0) return null;
    if (urls.length === 1) return urls[0];
    let i;
    do { i = Math.floor(Math.random() * urls.length); } while (i === this.lastIndex);
    this.lastIndex = i;
    return urls[i];
  }
  scaleFor(p) { return 1 + (Math.random() * 2 - 1) * p.sizeVariation; }
  spawn(hand, p, env) {
    const url = this.pick(env.images);
    if (!url) return;
    getImage(url); // empezar a cargarla
    const wind = windOf(env);
    const a = Math.random() * Math.PI * 2;
    let dx = Math.cos(a) + wind.x * 2.5;
    let dy = Math.sin(a) + wind.y * 2.5;
    const len = Math.hypot(dx, dy) || 1;
    this.items.push({
      url, x: hand.x, y: hand.y, age: 0, hold: p.hold, flyTime: p.flyTime,
      hueStep: Math.floor(Math.random() * RAINBOW_STEPS),
      dirX: dx / len, dirY: dy / len, vel: 0, flying: false,
      scale: this.scaleFor(p), rot: (Math.random() - 0.5) * 0.25, spin: (Math.random() - 0.5) * 2.4
    });
  }
  update(dt, t, w, h, p, env) {
    this.t = t;
    const hands = (env && env.hands) || [];
    const urls = env.images || [];
    if (p.mode === "always") {
      // Una imagen flotante por cada imagen elegida, repartidas alrededor del centro.
      const keep = new Set(urls);
      for (const k of Array.from(this.floating.keys())) if (!keep.has(k)) this.floating.delete(k);
      urls.forEach((url, i) => {
        if (!this.floating.has(url)) {
          const ang = (i / Math.max(1, urls.length)) * Math.PI * 2;
          const r = urls.length > 1 ? Math.min(w, h) * 0.22 : 0;
          this.floating.set(url, { url, hueStep: i * 5, hx: w / 2 + Math.cos(ang) * r, hy: h / 2 + Math.sin(ang) * r, x: w / 2, y: h / 2, seed: Math.random() * 10, scale: this.scaleFor(p), near: 0 });
        }
      });
      const wind = windOf(env);
      for (const f of this.floating.values()) {
        // Vuelve a su lugar, flota un poco, la mano la atrae, el viento la corre.
        let tx = f.hx + Math.sin(t * 0.6 + f.seed) * 14 + wind.x * 60;
        let ty = f.hy + Math.cos(t * 0.5 + f.seed) * 10 + wind.y * 40;
        const pull = pullToward(env, f.x, f.y);
        if (pull) { tx += pull.dx * pull.force; ty += pull.dy * pull.force; }
        f.x += (tx - f.x) * Math.min(1, dt * 3);
        f.y += (ty - f.y) * Math.min(1, dt * 3);
        f.near += ((pull ? pull.force : 0) - f.near) * Math.min(1, dt * 5);
        f.rot = Math.sin(t * (0.8 + wind.n * 3) + f.seed) * (0.04 + wind.n * 0.25);
      }
      this.items = [];
      return;
    }
    this.floating.clear();
    spawnPerHand(this, hands, dt, p, env, w, h);
    const wind = windOf(env);
    for (const it of this.items) {
      it.age += dt;
      if (!it.flying) {
        const pull = ownerPull(env, hands, it);
        if (pull) {
          const follow = Math.min(1, dt * 6 * Math.min(1, env.strength));
          it.x += pull.dx * follow;
          it.y += pull.dy * follow;
        }
        if (it.age >= 0.35 + it.hold) { it.flying = true; it.flyAge = 0; this.waitTimer = 0; }
      } else {
        it.flyAge += dt;
        it.vel += p.flySpeed * 2000 * dt;
        it.x += it.dirX * it.vel * dt + wind.x * 120 * dt;
        it.y += it.dirY * it.vel * dt + wind.y * 120 * dt;
        if (p.spin) it.rot += it.spin * dt;
      }
    }
    this.items = this.items.filter((it) => !it.flying || (it.flyAge < it.flyTime &&
      it.x > -w * 0.6 && it.x < w * 1.6 && it.y > -h * 0.6 && it.y < h * 1.6));
  }
  drawImage(ctx, img, x, y, maxSide, rot, alpha, blur) {
    const ratio = img.naturalWidth / img.naturalHeight;
    const dw = ratio >= 1 ? maxSide : maxSide * ratio;
    const dh = ratio >= 1 ? maxSide / ratio : maxSide;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (blur > 0.3) ctx.filter = "blur(" + blur.toFixed(1) + "px)";
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = "none";
    ctx.restore();
  }
  // Versión de la imagen con el color que corresponda según "Color".
  colored(img, url, p, env, hueStep) {
    if (p.removeBg !== false) url = url + "#sin-fondo" + Math.round(p.bgTolerance || 30);
    const mode = p.colorMode || "original";
    if (mode === "original") return img;
    let color;
    if (mode === "tint") color = climateColor(p.color || "#ffffff", env);
    else if (mode === "climate") color = rgbToCss(tempTarget(hexToRgb(p.color || "#ffffff"), weatherOf(env).tempNorm));
    else color = rainbowColor(hueStep || 0);
    const amount = p.tintAmount != null ? p.tintAmount : 0.6;
    return tintedImage(img, url, color, amount);
  }
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = "source-over";
    if (p.mode === "always") {
      for (const f of this.floating.values()) {
        let img = getImage(f.url);
        if (!img) continue;
        if (p.removeBg !== false) img = cleanedImage(img, f.url, Math.round(p.bgTolerance || 30));
        img = this.colored(img, f.url, p, env, f.hueStep);
        this.drawImage(ctx, img, f.x, f.y, p.size * f.scale * (1 + 0.25 * f.near), f.rot || 0, p.fadeTo, p.blur);
      }
      return;
    }
    for (const it of this.items) {
      let img = getImage(it.url);
      if (!img) continue;
      if (p.removeBg !== false) img = cleanedImage(img, it.url, Math.round(p.bgTolerance || 30));
      img = this.colored(img, it.url, p, env, it.hueStep);
      let scale, alpha, blur;
      if (!it.flying) {
        const a = Math.min(1, it.age / 0.35);
        scale = 1 + 2.2 * Math.pow(a - 1, 3) + 1.2 * Math.pow(a - 1, 2); // surge con un leve rebote
        let soft = Math.max(0, Math.min(1, (it.age - 0.35) / 0.5));
        soft = soft * soft * (3 - 2 * soft);
        alpha = Math.min(1, a * 1.5) * (1 - (1 - p.fadeTo) * soft);
        blur = p.blur * soft;
      } else {
        const f = it.flyAge / it.flyTime;
        scale = 1 + f * 0.3;
        alpha = p.fadeTo * Math.max(0, 1 - f * f);
        blur = p.blur * (1 + f);
      }
      this.drawImage(ctx, img, it.x, it.y, p.size * it.scale * Math.max(0.01, scale), it.rot, alpha, blur);
    }
  }
}

// ---------------------------------------------------------------------------
// 13) GLITCH — un filtro: distorsiona lo que YA dibujaron las capas de arriba
//     en la lista (conviene ponerla última). Zona: toda la pantalla, un
//     rectángulo en el punto de origen, o alrededor de la mano.
// ---------------------------------------------------------------------------
class GlitchEffect {
  constructor() {
    this.burstLeft = 0;
    this.lastRoll = -1;
    this.pattern = null;
    this.buf = document.createElement("canvas");
    this.bufR = document.createElement("canvas");
    this.bufGB = document.createElement("canvas");
    this.wasTouching = false;
  }
  update(dt, t, w, h, p, env) {
    this.t = t;
    const hands = (env && env.hands) || [];
    const touching = hands.length > 0;
    const c = env.climate != null ? env.climate : 1;
    const wx = weatherOf(env);
    // Tormenta y ráfagas de viento: más glitch.
    this.climateBoost = 1 + c * (wx.gustNorm * 0.8 + wx.windNorm * 0.4 + wx.rainNorm * 0.5);
    if (p.timing === "always") this.active = true;
    else if (p.timing === "touch") {
      if (touching) this.burstLeft = Math.max(this.burstLeft, p.burstLength);
      this.burstLeft -= dt;
      this.active = touching || this.burstLeft > 0;
    } else {
      this.burstLeft -= dt;
      const rate = p.frequency * this.climateBoost;
      if (this.burstLeft <= 0 && Math.random() < rate * dt) this.burstLeft = p.burstLength * (0.5 + Math.random());
      this.active = this.burstLeft > 0;
    }
    this.handBoost = touching ? 1 + (env.strength || 0) * 0.8 : 1;
    // Música: el beat dispara el glitch; el volumen lo intensifica; los agudos suman ruido.
    const au = musicOf(env);
    if (au) {
      if (au.beat && p.timing !== "always" && Math.random() < au.m) {
        this.burstLeft = Math.max(this.burstLeft, p.burstLength * 0.7);
        this.active = true;
        this.epoch = (this.epoch || 0) + 1; // patrón nuevo con el golpe
      }
      this.handBoost *= 1 + au.volume * 0.8;
      this.treble = au.treble;
    } else this.treble = 0;
    this.wasTouching = touching;
  }
  region(ctx, w, h, p, env, handArg) {
    const m = ctx.getTransform();
    if (p.area === "full") return { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height };
    let cx, cy;
    if (p.area === "hand") {
      const hand = handArg || (env && env.hands && env.hands[0]);
      if (!hand) return null;
      const pt = new DOMPoint(hand.x, hand.y).matrixTransform(m);
      cx = pt.x; cy = pt.y;
    } else {
      const pt = new DOMPoint(w / 2, h / 2).matrixTransform(m); // el punto de origen de la capa
      cx = pt.x; cy = pt.y;
    }
    const rw = (p.width / 100) * ctx.canvas.width;
    const rh = (p.height / 100) * ctx.canvas.height;
    const x = Math.max(0, Math.round(cx - rw / 2));
    const y = Math.max(0, Math.round(cy - rh / 2));
    return { x, y, w: Math.min(ctx.canvas.width - x, Math.round(rw)), h: Math.min(ctx.canvas.height - y, Math.round(rh)), cx, cy, part: true };
  }
  // Forma de la zona: el rectángulo (con bordes un poco movidos) más ramitas
  // ortogonales que salen de sus lados, algunas con un quiebre en L.
  shape(r, p, W, H) {
    if (!r.part) return [r];
    const rects = [];
    const j = () => (Math.random() - 0.5) * Math.min(r.w, r.h) * 0.08;
    rects.push({ x: r.x + j(), y: r.y + j(), w: r.w + j(), h: r.h + j() });
    const n = Math.round(p.branches != null ? p.branches : 6);
    const L = p.branchLength != null ? p.branchLength : 0.8;
    for (let i = 0; i < n; i++) {
      const side = Math.floor(Math.random() * 4); // 0 arriba, 1 derecha, 2 abajo, 3 izquierda
      const thick = 3 + Math.random() * Math.min(r.w, r.h) * 0.12;
      const len = (0.2 + Math.random()) * Math.max(r.w, r.h) * L;
      let b;
      if (side === 0) { const x = r.x + Math.random() * (r.w - thick); b = { x, y: r.y - len, w: thick, h: len }; }
      else if (side === 2) { const x = r.x + Math.random() * (r.w - thick); b = { x, y: r.y + r.h, w: thick, h: len }; }
      else if (side === 1) { const y = r.y + Math.random() * (r.h - thick); b = { x: r.x + r.w, y, w: len, h: thick }; }
      else { const y = r.y + Math.random() * (r.h - thick); b = { x: r.x - len, y, w: len, h: thick }; }
      rects.push(b);
      // A veces la ramita dobla en ángulo recto.
      if (Math.random() < 0.45) {
        const len2 = len * (0.3 + Math.random() * 0.6);
        const dir = Math.random() < 0.5 ? -1 : 1;
        if (side === 0 || side === 2) {
          const ey = side === 0 ? b.y : b.y + b.h - thick;
          rects.push({ x: dir > 0 ? b.x : b.x - len2 + thick, y: ey, w: len2, h: thick });
        } else {
          const ex = side === 1 ? b.x + b.w - thick : b.x;
          rects.push({ x: ex, y: dir > 0 ? b.y : b.y - len2 + thick, w: thick, h: len2 });
        }
      }
    }
    // Recortar a la pantalla.
    return rects.map((q) => {
      const x = Math.max(0, Math.round(q.x)), y = Math.max(0, Math.round(q.y));
      return { x, y, w: Math.round(Math.min(W, q.x + q.w) - x), h: Math.round(Math.min(H, q.y + q.h) - y) };
    }).filter((q) => q.w > 1 && q.h > 1);
  }
  roll(r, p, amount) {
    // Un "cuadro" de glitch nuevo (cambia "Velocidad" veces por segundo).
    const v = p.variant || "mixed";
    const pick = (name) => v === name || (v === "mixed" && Math.random() < 0.55);
    const pat = { slices: [], blocks: [], noise: [], rgb: 0, invert: [], scan: false };
    if (pick("slices")) {
      const n = 2 + Math.floor(Math.random() * 10 * amount);
      for (let i = 0; i < n; i++) {
        const sh = Math.max(2, Math.random() * r.h * 0.12 * (0.3 + amount));
        pat.slices.push({ y: r.y + Math.random() * (r.h - sh), h: sh, dx: (Math.random() * 2 - 1) * r.w * 0.12 * amount });
      }
    }
    if (pick("rgb")) pat.rgb = (4 + Math.random() * 26) * amount * (Math.random() < 0.5 ? -1 : 1);
    if (pick("blocks")) {
      const n = 1 + Math.floor(Math.random() * 8 * amount);
      for (let i = 0; i < n; i++) {
        const bw = 10 + Math.random() * r.w * 0.25, bh = 6 + Math.random() * r.h * 0.18;
        pat.blocks.push({
          sx: r.x + Math.random() * (r.w - bw), sy: r.y + Math.random() * (r.h - bh),
          dx: r.x + Math.random() * (r.w - bw), dy: r.y + Math.random() * (r.h - bh),
          w: bw, h: bh, tint: Math.random() < 0.45 ? (Math.random() < 0.5 ? 1 : 2) : 0
        });
      }
    }
    if (pick("noise")) {
      const n = Math.floor(40 + 400 * amount + 600 * (this.treble || 0));
      for (let i = 0; i < n; i++) {
        pat.noise.push({ x: r.x + Math.random() * r.w, y: r.y + Math.random() * r.h, w: 1 + Math.random() * 6, h: 1 + Math.random() * 3, c: Math.random() });
      }
    }
    if (pick("invert") && (v === "invert" || Math.random() < 0.35)) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const iw = r.w * (0.1 + Math.random() * 0.6), ih = r.h * (0.04 + Math.random() * 0.3);
        pat.invert.push({ x: r.x + Math.random() * (r.w - iw), y: r.y + Math.random() * (r.h - ih), w: iw, h: ih });
      }
    }
    pat.scan = pick("scanlines");
    return pat;
  }
  draw(ctx, w, h, p, env) {
    if (!this.active) return;
    const amount = Math.min(1, p.intensity * this.climateBoost * this.handBoost);
    if (!this.zones) this.zones = new Map();
    if (p.area === "hand") {
      // Una zona (con sus ramitas) por cada mano.
      const hands = (env && env.hands) || [];
      const seen = new Set();
      for (const hnd of hands) {
        const id = hnd.id != null ? hnd.id : "h0";
        seen.add(id);
        if (!this.zones.has(id)) this.zones.set(id, {});
        const r = this.region(ctx, w, h, p, env, hnd);
        if (r) this.drawZone(ctx, p, env, this.zones.get(id), r, amount);
      }
      for (const id of Array.from(this.zones.keys())) if (!seen.has(id)) this.zones.delete(id);
      return;
    }
    if (!this.zones.has("main")) this.zones.set("main", {});
    const r = this.region(ctx, w, h, p, env);
    if (r) this.drawZone(ctx, p, env, this.zones.get("main"), r, amount);
  }
  drawZone(ctx, p, env, Z, r, amount) {
    if (!r || r.w < 4 || r.h < 4) return;
    const canvas = ctx.canvas;
    if (Z.epoch !== this.epoch || Z.lastRoll == null || this.t - Z.lastRoll >= 1 / Math.max(1, p.speed) || !Z.pattern) {
      // Nueva forma (con ramitas) y nuevo patrón de glitch dentro de ella.
      Z.rects = this.shape(r, p, canvas.width, canvas.height);
      if (!Z.rects.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of Z.rects) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + q.w); y1 = Math.max(y1, q.y + q.h); }
      Z.box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      Z.pattern = this.roll(Z.box, p, amount);
      Z.lastRoll = this.t;
      Z.epoch = this.epoch;
      Z.anchorX = r.x; Z.anchorY = r.y;
    }
    const pat = Z.pattern;
    // Si la zona se mueve (mano), la forma acompaña sin esperar al próximo cambio.
    const ox = r.part ? Math.round(r.x - Z.anchorX) : 0;
    const oy = r.part ? Math.round(r.y - Z.anchorY) : 0;
    r = { x: Z.box.x + ox, y: Z.box.y + oy, w: Z.box.w, h: Z.box.h };
    if (r.w < 4 || r.h < 4) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(ox, oy);
    ctx.beginPath();
    for (const q of Z.rects) ctx.rect(q.x, q.y, q.w, q.h);
    ctx.clip();
    ctx.translate(-ox, -oy);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";

    // Copia de la zona antes de tocarla.
    const buf = this.buf;
    if (buf.width !== r.w || buf.height !== r.h) { buf.width = r.w; buf.height = r.h; }
    const bctx = buf.getContext("2d");
    bctx.clearRect(0, 0, r.w, r.h);
    bctx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);

    // Separación RGB: rojo corrido para un lado, verde+azul para el otro.
    if (pat.rgb) {
      for (const [b, col] of [[this.bufR, "#ff0000"], [this.bufGB, "#00ffff"]]) {
        if (b.width !== r.w || b.height !== r.h) { b.width = r.w; b.height = r.h; }
        const x = b.getContext("2d");
        x.globalCompositeOperation = "source-over";
        x.drawImage(buf, 0, 0);
        x.globalCompositeOperation = "multiply";
        x.fillStyle = col;
        x.fillRect(0, 0, r.w, r.h);
        x.globalCompositeOperation = "destination-in";
        x.drawImage(buf, 0, 0);
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(this.bufR, r.x + pat.rgb, r.y);
      ctx.drawImage(this.bufGB, r.x - pat.rgb, r.y + pat.rgb * 0.15);
      ctx.globalCompositeOperation = "source-over";
    }
    // Cortes: tiras horizontales corridas.
    for (const sl of pat.slices) {
      const sy = Math.round(sl.y - r.y);
      ctx.drawImage(buf, 0, sy, r.w, sl.h, r.x + sl.dx, sl.y, r.w, sl.h);
    }
    // Bloques: pedazos copiados de otro lado, algunos teñidos.
    for (const b of pat.blocks) {
      ctx.drawImage(buf, b.sx - r.x, b.sy - r.y, b.w, b.h, b.dx, b.dy, b.w, b.h);
      if (b.tint) {
        ctx.globalAlpha = 0.35 + 0.4 * amount;
        ctx.fillStyle = climateColor(b.tint === 1 ? p.color : p.color2, env);
        ctx.fillRect(b.dx, b.dy, b.w, b.h);
        ctx.globalAlpha = 1;
      }
    }
    // Inversión de color.
    if (pat.invert.length) {
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "#ffffff";
      for (const iv of pat.invert) ctx.fillRect(iv.x, iv.y, iv.w, iv.h);
      ctx.globalCompositeOperation = "source-over";
    }
    // Ruido digital.
    if (pat.noise.length) {
      const c1 = climateColor(p.color, env), c2 = climateColor(p.color2, env);
      for (const n of pat.noise) {
        ctx.fillStyle = n.c < 0.6 ? "rgba(255,255,255,0.85)" : n.c < 0.8 ? c1 : c2;
        ctx.fillRect(n.x, n.y, n.w, n.h);
      }
    }
    // Líneas de TV + una franja brillante que baja.
    if (pat.scan) {
      ctx.fillStyle = "rgba(0,0,0," + (0.18 + 0.3 * amount) + ")";
      for (let y = r.y; y < r.y + r.h; y += 3) ctx.fillRect(r.x, y, r.w, 1);
      const band = r.y + ((this.t * 220) % (r.h + 80)) - 40;
      const g = ctx.createLinearGradient(0, band - 40, 0, band + 40);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255," + (0.08 + 0.12 * amount) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(r.x, band - 40, r.w, 80);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 14) ANIMACIONES — GIF, PNG animado, WebP animado y videos (MP4 / MOV / WebM).
//     Al tocar (como las imágenes), flotando, o a pantalla completa (loop de VJ).
// ---------------------------------------------------------------------------
// Carga compartida: cada archivo se carga una sola vez.
//  - videos: un <video> silenciado en loop.
//  - GIF / PNG / WebP: se decodifican todos los cuadros con ImageDecoder (Chrome),
//    para poder reproducirlos a cualquier velocidad y saltar de momento.
const animCache = new Map(); // url -> { kind, ready, frames, durations, total, video, error }
const ANIM_MAX_SIDE = 900;
const ANIM_MAX_FRAMES = 600;

function animMime(url) {
  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  return { gif: "image/gif", png: "image/png", webp: "image/webp" }[ext] || "image/gif";
}

function loadAnim(media) {
  let a = animCache.get(media.url);
  if (a) return a;
  a = { kind: media.kind, ready: false, frames: [], durations: [], total: 0, video: null, error: null };
  animCache.set(media.url, a);
  if (media.kind === "video") {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = media.url;
    v.addEventListener("loadeddata", () => { a.ready = true; v.play().catch(() => {}); });
    v.addEventListener("error", () => { a.error = "no se pudo reproducir el video (¿códec no soportado? usá H.264 o WebM)"; });
    a.video = v;
    v.load();
    return a;
  }
  (async () => {
    try {
      if (!("ImageDecoder" in window)) throw new Error("sin ImageDecoder");
      const res = await fetch(media.url);
      const dec = new ImageDecoder({ data: res.body, type: animMime(media.url) });
      await dec.tracks.ready;
      await dec.completed;
      const count = Math.min(ANIM_MAX_FRAMES, dec.tracks.selectedTrack.frameCount || 1);
      for (let i = 0; i < count; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        const w = image.displayWidth, h = image.displayHeight;
        const k = Math.min(1, ANIM_MAX_SIDE / Math.max(w, h));
        const bmp = await createImageBitmap(image, k < 1 ? { resizeWidth: Math.round(w * k), resizeHeight: Math.round(h * k) } : {});
        const dur = image.duration ? image.duration / 1e6 : 0.1; // microsegundos → segundos
        image.close();
        a.frames.push(bmp);
        a.durations.push(dur > 0.005 ? dur : 0.1);
        if (i === 0) a.ready = true; // ya se puede mostrar mientras carga el resto
      }
      a.total = a.durations.reduce((x, y) => x + y, 0) || 0.1;
      dec.close();
    } catch (err) {
      // Plan B: una imagen común (Chrome igual anima los GIF).
      const img = new Image();
      img.onload = () => { a.img = img; a.ready = true; a.total = 1; };
      img.onerror = () => { a.error = "no se pudo abrir"; };
      img.src = media.url;
    }
  })();
  return a;
}

// Cuadro a mostrar en el tiempo t (segundos).
function animFrame(a, t) {
  if (!a || !a.ready) return null;
  if (a.video) return a.video.readyState >= 2 ? a.video : null;
  if (a.img && !a.frames.length) return a.img;
  if (a.frames.length === 1 || !a.total) return a.frames[0];
  let tt = ((t % a.total) + a.total) % a.total;
  for (let i = 0; i < a.frames.length; i++) {
    tt -= a.durations[i];
    if (tt < 0) return a.frames[i];
  }
  return a.frames[a.frames.length - 1];
}
function sourceSize(src) {
  return {
    w: src.videoWidth || src.naturalWidth || src.width || 1,
    h: src.videoHeight || src.naturalHeight || src.height || 1
  };
}
const BLENDS = { normal: "source-over", screen: "screen", lighter: "lighter", multiply: "multiply" };

class AnimationsEffect {
  constructor() {
    this.items = [];
    this.floating = new Map();
    this.waitTimer = 0;
    this.clock = 0;
    this.lastJump = 0;
    this.fullIndex = 0;
    this.fullSince = 0;
  }
  pick(list) {
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }
  spawn(at, p, env) {
    const media = this.pick(env.animations);
    if (!media) return;
    loadAnim(media);
    const wind = windOf(env);
    const ang = Math.random() * Math.PI * 2;
    let dx = Math.cos(ang) + wind.x * 2.5, dy = Math.sin(ang) + wind.y * 2.5;
    const len = Math.hypot(dx, dy) || 1;
    this.items.push({
      media, x: at.x, y: at.y, age: 0, t0: this.clock, flying: false, vel: 0,
      dirX: dx / len, dirY: dy / len, scale: 1 + (Math.random() * 2 - 1) * p.sizeVariation,
      rot: (Math.random() - 0.5) * 0.15, spin: (Math.random() - 0.5) * 2, hold: p.hold, flyTime: p.flyTime
    });
  }
  update(dt, t, w, h, p, env) {
    const list = env.animations || [];
    list.forEach((m) => loadAnim(m));
    const au = musicOf(env);
    const speed = p.playSpeed * musicSpeed(env, 1);
    this.clock += dt * speed;
    // Videos: velocidad de reproducción.
    list.forEach((m) => {
      const a = animCache.get(m.url);
      if (a && a.video) {
        const rate = Math.max(0.1, Math.min(4, speed));
        if (Math.abs(a.video.playbackRate - rate) > 0.05) a.video.playbackRate = rate;
        if (a.video.paused && a.ready) a.video.play().catch(() => {});
      }
    });
    // Beat: saltar a otro momento o volver al principio.
    if (au && au.beat && p.beatAction !== "none" && t - this.lastJump > 0.35 && Math.random() < au.m) {
      this.lastJump = t;
      list.forEach((m) => {
        const a = animCache.get(m.url);
        if (!a || !a.ready) return;
        if (a.video && a.video.duration) a.video.currentTime = p.beatAction === "restart" ? 0 : Math.random() * a.video.duration;
      });
      if (p.beatAction === "restart") { this.clock = 0; this.items.forEach((it) => { it.t0 = 0; }); }
      else this.clock += Math.random() * 5;
      if (p.mode === "fullscreen" && list.length > 1 && p.beatAction === "jump" && Math.random() < 0.3) {
        this.fullIndex = (this.fullIndex + 1) % list.length;
      }
    }

    if (p.mode === "fullscreen") {
      // Si hay varias, van cambiando cada ~ (tiempo quieta × 5) segundos.
      if (list.length > 1 && t - this.fullSince > Math.max(2, p.hold * 5)) {
        this.fullIndex = (this.fullIndex + 1) % list.length;
        this.fullSince = t;
      }
      this.items = [];
      this.floating.clear();
      return;
    }

    if (p.mode === "always") {
      const keep = new Set(list.map((m) => m.url));
      for (const k of Array.from(this.floating.keys())) if (!keep.has(k)) this.floating.delete(k);
      list.forEach((m, i) => {
        if (!this.floating.has(m.url)) {
          const ang = (i / Math.max(1, list.length)) * Math.PI * 2;
          const r = list.length > 1 ? Math.min(w, h) * 0.24 : 0;
          this.floating.set(m.url, { media: m, hx: w / 2 + Math.cos(ang) * r, hy: h / 2 + Math.sin(ang) * r, x: w / 2, y: h / 2,
            seed: Math.random() * 10, scale: 1 + (Math.random() * 2 - 1) * p.sizeVariation, near: 0, t0: Math.random() * 3 });
        }
      });
      const wind = windOf(env);
      for (const f of this.floating.values()) {
        let tx = f.hx + Math.sin(t * 0.6 + f.seed) * 14 + wind.x * 60;
        let ty = f.hy + Math.cos(t * 0.5 + f.seed) * 10 + wind.y * 40;
        const pull = pullToward(env, f.x, f.y);
        if (pull) { tx += pull.dx * pull.force; ty += pull.dy * pull.force; }
        f.x += (tx - f.x) * Math.min(1, dt * 3);
        f.y += (ty - f.y) * Math.min(1, dt * 3);
        f.near += ((pull ? pull.force : 0) - f.near) * Math.min(1, dt * 5);
        f.rot = Math.sin(t * (0.8 + wind.n * 3) + f.seed) * (0.03 + wind.n * 0.2);
      }
      this.items = [];
      return;
    }

    // Al tocar (y también con el beat, si hay música).
    this.floating.clear();
    const hands = (env && env.hands) || [];
    spawnPerHand(this, hands, dt, p, env, w, h);
    const wind = windOf(env);
    for (const it of this.items) {
      it.age += dt;
      if (!it.flying) {
        const pull = ownerPull(env, hands, it);
        if (pull) {
          const follow = Math.min(1, dt * 6 * Math.min(1, env.strength));
          it.x += pull.dx * follow;
          it.y += pull.dy * follow;
        }
        if (it.age >= 0.35 + it.hold) { it.flying = true; it.flyAge = 0; this.waitTimer = 0; }
      } else {
        it.flyAge += dt;
        it.vel += p.flySpeed * 2000 * dt;
        it.x += it.dirX * it.vel * dt + wind.x * 120 * dt;
        it.y += it.dirY * it.vel * dt + wind.y * 120 * dt;
        if (p.spin) it.rot += it.spin * dt;
      }
    }
    this.items = this.items.filter((it) => !it.flying || (it.flyAge < it.flyTime &&
      it.x > -w * 0.6 && it.x < w * 1.6 && it.y > -h * 0.6 && it.y < h * 1.6));
  }
  drawSrc(ctx, src, x, y, maxSide, rot, alpha) {
    const { w: sw, h: sh } = sourceSize(src);
    const ratio = sw / sh;
    const dw = ratio >= 1 ? maxSide : maxSide * ratio;
    const dh = ratio >= 1 ? maxSide / ratio : maxSide;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
  draw(ctx, w, h, p, env) {
    const list = env.animations || [];
    ctx.globalCompositeOperation = BLENDS[p.blend] || "source-over";
    if (p.mode === "fullscreen") {
      const media = list[this.fullIndex % Math.max(1, list.length)];
      if (!media) return;
      const src = animFrame(loadAnim(media), this.clock);
      if (!src) return;
      const { w: sw, h: sh } = sourceSize(src);
      const k = p.fit === "contain" ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
      const dw = sw * k, dh = sh * k;
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      return;
    }
    if (p.mode === "always") {
      for (const f of this.floating.values()) {
        const src = animFrame(loadAnim(f.media), this.clock + f.t0);
        if (src) this.drawSrc(ctx, src, f.x, f.y, p.size * f.scale * (1 + 0.25 * f.near), f.rot, p.opacity);
      }
      return;
    }
    for (const it of this.items) {
      const src = animFrame(loadAnim(it.media), this.clock - it.t0);
      if (!src) continue;
      let scale, alpha;
      if (!it.flying) {
        const a = Math.min(1, it.age / 0.35);
        scale = 1 + 2.2 * Math.pow(a - 1, 3) + 1.2 * Math.pow(a - 1, 2);
        alpha = Math.min(1, a * 1.5);
      } else {
        const f = it.flyAge / it.flyTime;
        scale = 1 + f * 0.3;
        alpha = Math.max(0, 1 - f * f);
      }
      this.drawSrc(ctx, src, it.x, it.y, p.size * it.scale * Math.max(0.01, scale), it.rot, alpha * p.opacity);
    }
  }
}

// ---------------------------------------------------------------------------
// Fábrica de efectos por tipo
// ---------------------------------------------------------------------------
const EffectFactories = {
  particles: () => new ParticlesEffect(),
  fractalTree: () => new FractalTreeEffect(),
  flowfield: () => new FlowFieldEffect(),
  fire: () => new FireEffect(),
  water: () => new WaterEffect(),
  trending: () => new TrendingWordsEffect(),
  rain: () => new RainEffect(),
  clouds: () => new CloudsEffect(),
  pixels: () => new PixelsEffect(),
  images: () => new ImagesEffect(),
  glitch: () => new GlitchEffect(),
  animations: () => new AnimationsEffect(),
  stripesV: () => new StripesEffect(true),
  stripesH: () => new StripesEffect(false)
};
