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
    const k = dt * 60;
    const wind = windOf(env);
    const rain = weatherOf(env).rainNorm * (env.climate != null ? env.climate : 1);
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
    this.swayBoost = 1 + wind.n * 4;
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
      let speed = p.particleSpeed * (1 + wind.n * 1.5);
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
    for (const particle of this.particles) {
      particle.age += dt;
      if (particle.age >= particle.life) { Object.assign(particle, this.spawn(w, h, p, rain)); continue; }
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
      ctx.arc(particle.x, particle.y, Math.max(0.5, p.size * lifeRatio), 0, Math.PI * 2);
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
    const bump = (x) => {
      if (st.lift <= 0.001 || st.liftY === undefined) return 0;
      const g = Math.exp(-((x - st.liftX) * (x - st.liftX)) / (2 * sigma * sigma));
      return g * st.lift * (1 - i * 0.12);
    };
    ctx.beginPath();
    if (band) {
      // Hacia la mano la banda se hincha (arriba y abajo a la vez).
      const reach = Math.min(Math.abs(st.liftY - levelY), h * 0.45) * 0.85;
      const top = [];
      for (let x = x0; x <= x1 + step; x += step) {
        const y = levelY - half + inset + wave(x) - reach * bump(x);
        top.push([x, y]);
      }
      ctx.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) ctx.lineTo(x, y);
      // Borde de abajo: espejo del de arriba respecto del centro.
      for (let j = top.length - 1; j >= 0; j--) ctx.lineTo(top[j][0], 2 * levelY - top[j][1]);
    } else {
      const reach = st.liftY !== undefined ? (st.liftY - levelY) : 0;
      ctx.moveTo(x0, h + margin);
      for (let x = x0; x <= x1 + step; x += step) {
        ctx.lineTo(x, levelY + inset + wave(x) + reach * 0.85 * bump(x));
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
    this.phase += dt * p.speed * (1 + wind.n * 2.5) * (wind.x < -0.05 ? -1 : 1);
    this.ampBoost = 1 + wind.n * 2;
    // La lluvia sube el nivel poco a poco (hasta 18% de la pantalla).
    const targetLevel = weatherOf(env).rainNorm * c * 0.18 * h;
    this.level += (targetLevel - this.level) * Math.min(1, dt * 0.3);
    const hand = env && env.hands && env.hands[0];
    const target = hand ? env.strength : 0;
    this.lift += (target - this.lift) * Math.min(1, dt * 4);
    if (hand) { this.liftX = hand.x; this.liftY = hand.y; }
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
    const current = this.items.find((it) => !it.flying);
    if (!current) this.waitTimer += dt;
    if (hands.length > 0 && !current && this.waitTimer >= p.interval) {
      this.spawn(hands[0], p, env);
      this.waitTimer = 0;
    }
    const wind = windOf(env);
    for (const it of this.items) {
      it.age += dt;
      if (!it.flying) {
        const pull = pullToward(env, it.x, it.y);
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
  draw(ctx, w, h, p, env) {
    ctx.globalCompositeOperation = "source-over";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const APPEAR = 0.35;
    const color = climateColor(p.color, env);
    // Con humedad las palabras se difuminan un poco más.
    const c = env.climate != null ? env.climate : 1;
    const humidBlur = Math.max(0, weatherOf(env).humidity - 0.6) * 10 * c;
    for (const it of this.items) {
      let scale, alpha, soft, blur;
      const fadeTo = p.fadeTo != null ? p.fadeTo : 0.4;
      const maxBlur = (p.blur != null ? p.blur : 4) + humidBlur;
      if (!it.flying) {
        const a = Math.min(1, it.age / APPEAR);
        scale = 1 + 2.2 * Math.pow(a - 1, 3) + 1.2 * Math.pow(a - 1, 2);
        soft = Math.max(0, Math.min(1, (it.age - APPEAR) / 0.5));
        soft = soft * soft * (3 - 2 * soft);
        alpha = Math.min(1, a * 1.5) * (1 - (1 - fadeTo) * soft);
        blur = maxBlur * soft;
      } else {
        const f = it.flyAge / it.flyTime;
        soft = 1;
        scale = 1 + f * 0.35;
        alpha = fadeTo * Math.max(0, 1 - f * f);
        blur = maxBlur * (1 + f);
      }
      let size = it.size * Math.max(0.01, scale) * (1 + 0.4 * it.near);
      ctx.font = "800 " + Math.round(size) + "px 'Segoe UI', system-ui, sans-serif";
      let width = ctx.measureText(it.text).width;
      if (width > w * 0.92) {
        size *= (w * 0.92) / width;
        ctx.font = "800 " + Math.round(size) + "px 'Segoe UI', system-ui, sans-serif";
        width = ctx.measureText(it.text).width;
      }
      let x = it.x, y = it.y;
      if (!it.flying) {
        x = Math.max(width / 2 + 8, Math.min(w - width / 2 - 8, x));
        y = Math.max(size / 2 + 8, Math.min(h - size / 2 - 8, y));
        it.x = x; it.y = y;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(it.rot);
      ctx.globalAlpha = alpha;
      if (blur > 0.3) ctx.filter = "blur(" + blur.toFixed(1) + "px)";
      if (p.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 24 + 30 * soft;
      }
      ctx.fillStyle = color;
      ctx.fillText(it.text, 0, 0);
      ctx.shadowBlur = 0;
      if (soft < 1) {
        ctx.fillStyle = "rgba(255,255,255," + (0.35 * alpha * (1 - soft)) + ")";
        ctx.fillText(it.text, 0, 0);
      }
      ctx.filter = "none";
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
      d.y += p.speed * d.s * k;
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
    const k = dt * 60;
    const wind = windOf(env);
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
      s.pos += (s.vel * p.speed + windAlong * 4) * k;
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
    if (mode === "rainbow") return "hsl(" + Math.floor((s.colorIndex * 360 + this.time * 20) % 360) + ",90%,60%)";
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
      const width = (p.minWidth + (p.maxWidth - p.minWidth) * wave) * (1 + s.near * 1.5);
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
    const current = this.items.find((it) => !it.flying);
    if (!current) this.waitTimer += dt;
    if (hands.length > 0 && !current && this.waitTimer >= p.interval) {
      this.spawn(hands[0], p, env);
      this.waitTimer = 0;
    }
    const wind = windOf(env);
    for (const it of this.items) {
      it.age += dt;
      if (!it.flying) {
        const pull = pullToward(env, it.x, it.y);
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
  stripesV: () => new StripesEffect(true),
  stripesH: () => new StripesEffect(false)
};
