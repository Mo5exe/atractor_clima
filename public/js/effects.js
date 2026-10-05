/*
 * Efectos visuales (sólo navegador, se dibujan en un <canvas> 2D).
 *
 * Cada efecto expone:
 *   update(dt, t, w, h, params, env)
 *   draw(ctx, w, h, params, env)
 *
 * env (lo arma output.js en cada cuadro):
 *   env.hands    -> [{ x, y }] posición de cada mano en píxeles, ya convertida
 *                   al espacio de la capa (respeta origen y rotación)
 *   env.strength -> fuerza efectiva del atractor (global × "Atracción" de la capa)
 *   env.radius   -> radio de acción de la mano en píxeles
 *   env.words    -> trending topics [{ word, popularity }]
 */

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const bigint = parseInt(full, 16) || 0;
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function lerpColorRgb(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return "rgb(" + Math.round(a.r + (b.r - a.r) * t) + "," + Math.round(a.g + (b.g - a.g) * t) + "," + Math.round(a.b + (b.b - a.b) * t) + ")";
}

function hexToRgba(hex, alpha) {
  const c = hexToRgb(hex);
  return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
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

// --- Atractor -------------------------------------------------------------
// Devuelve la mano más cercana al punto (x, y) y cuánto "tira" de él (0..1).
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
  // Fuerte dentro del radio, con una cola suave hacia afuera.
  const falloff = 1 / (1 + (dist / (r * 0.5)) * (dist / (r * 0.5)));
  best.dist = dist;
  best.ux = best.dx / dist;
  best.uy = best.dy / dist;
  best.force = Math.min(1, env.strength * falloff);
  return best;
}

// ---------------------------------------------------------------------------
// 1) PARTICULAS — salen del origen y, si hay mano, convergen hacia ella
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
      np.age = Math.random() * np.life; // que no nazcan todas a la vez
      this.particles.push(np);
    }
    if (this.particles.length > count) this.particles.length = count;
    const k = dt * 60;
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
        // Al llegar a la mano, renace en el origen: flujo continuo hacia la mano.
        if (pull.dist < 10) { Object.assign(particle, this.spawn(w, h, p)); continue; }
      }
      particle.vy += p.gravity * dt * 30;
      particle.x += particle.vx * k;
      particle.y += particle.vy * k;
    }
  }
  draw(ctx, w, h, p) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = p.color;
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
// 2) ARBOL FRACTAL — las ramas se doblan hacia la mano
// ---------------------------------------------------------------------------
class FractalTreeEffect {
  constructor() { this.time = 0; this.env = null; }
  update(dt, t, w, h, p, env) { this.time = t; this.env = env; }
  draw(ctx, w, h, p) {
    ctx.lineCap = "round";
    this._drawBranch(ctx, w / 2, h, -Math.PI / 2, p.initialLength, p.lineWidth, Math.round(p.depth), p, 0);
  }
  _drawBranch(ctx, x, y, angle, len, width, depthLeft, p, depthIndex) {
    if (depthLeft <= 0 || len < 2) return;
    const swayRad = ((p.sway || 0) * Math.PI) / 180;
    let a = angle + swayRad * Math.sin(this.time * 1.3 + depthIndex * 0.6);

    const pull = pullToward(this.env, x, y);
    if (pull) {
      let diff = Math.atan2(pull.dy, pull.dx) - a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalizar a -PI..PI
      a += diff * pull.force * 0.22;
    }

    const endX = x + Math.cos(a) * len;
    const endY = y + Math.sin(a) * len;
    const colorT = 1 - depthLeft / Math.max(1, p.depth);
    ctx.strokeStyle = lerpColorRgb(p.colorStart, p.colorEnd, colorT);
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
// 3) FLOW FIELD — las líneas siguen el ruido y se curvan hacia la mano
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
    this.z += p.noiseSpeed * dt * 60;
    const count = Math.round(p.particleCount);
    while (this.particles.length < count) this.particles.push(this.spawn(w, h));
    if (this.particles.length > count) this.particles.length = count;
    for (const particle of this.particles) {
      const angle = this.noise(particle.x * p.noiseScale, particle.y * p.noiseScale + this.z) * Math.PI * 4;
      let vx = Math.cos(angle);
      let vy = Math.sin(angle);
      let speed = p.particleSpeed;
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
  draw(ctx, w, h, p) {
    ctx.strokeStyle = p.color;
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
// 4) FUEGO — las llamas se inclinan y viajan hacia la mano
// ---------------------------------------------------------------------------
class FireEffect {
  constructor() { this.particles = []; }
  spawn(w, h, p) {
    const baseX = (p.baseX / 100) * w;
    const baseY = (p.baseY / 100) * h;
    const spread = (p.baseWidth / 100) * w;
    return {
      x: baseX + (Math.random() - 0.5) * spread,
      y: baseY,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(1 + Math.random()) * p.height,
      age: 0,
      life: 0.6 + Math.random() * 0.8,
      seed: Math.random() * 100
    };
  }
  update(dt, t, w, h, p, env) {
    const count = Math.round(p.intensity);
    while (this.particles.length < count) this.particles.push(this.spawn(w, h, p));
    if (this.particles.length > count) this.particles.length = count;
    const k = dt * 60;
    for (const particle of this.particles) {
      particle.age += dt;
      if (particle.age >= particle.life) { Object.assign(particle, this.spawn(w, h, p)); continue; }
      particle.x += particle.vx * k + Math.sin(t * 3 + particle.seed) * p.turbulence * 0.5;
      particle.y += particle.vy * k;
      particle.vy -= 0.01 * p.height;
      const pull = pullToward(env, particle.x, particle.y);
      if (pull) {
        particle.x += pull.ux * pull.force * 6 * k;
        particle.y += pull.uy * pull.force * 6 * k;
      }
    }
  }
  draw(ctx, w, h, p) {
    ctx.globalCompositeOperation = "lighter";
    for (const particle of this.particles) {
      const lifeRatio = 1 - particle.age / particle.life;
      if (lifeRatio <= 0) continue;
      ctx.fillStyle = fireColor(lifeRatio);
      ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio * 1.3));
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(0.5, p.size * lifeRatio), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 5) AGUA — el agua sube (o baja) hacia la mano
// ---------------------------------------------------------------------------
class WaterEffect {
  constructor() { this.time = 0; this.env = null; this.lift = 0; this.liftX = 0; }
  update(dt, t, w, h, p, env) {
    this.time = t;
    this.env = env;
    const hand = env && env.hands && env.hands[0];
    // La "ola de la mano" crece y se apaga suavemente.
    const target = hand ? env.strength : 0;
    this.lift += (target - this.lift) * Math.min(1, dt * 4);
    if (hand) {
      this.liftX = hand.x;
      this.liftY = hand.y;
    }
  }
  draw(ctx, w, h, p) {
    const levelY = (p.levelY / 100) * h;
    ctx.globalCompositeOperation = "source-over";
    const waveCount = Math.round(p.waveCount);
    const step = Math.max(4, Math.floor(w / 160));
    const sigma = w * 0.09;
    const reach = this.liftY !== undefined ? (this.liftY - levelY) : 0;
    for (let i = 0; i < waveCount; i++) {
      const phase = this.time * p.speed + i * 1.3;
      const amp = p.amplitude * (1 - i * 0.15);
      const freq = p.frequency * (1 + i * 0.12);
      const yOffset = i * (p.amplitude * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, levelY + yOffset);
      for (let x = 0; x <= w + step; x += step) {
        let y = levelY + yOffset + Math.sin((x / w) * Math.PI * 2 * freq + phase) * amp;
        if (this.lift > 0.001) {
          const g = Math.exp(-((x - this.liftX) * (x - this.liftX)) / (2 * sigma * sigma));
          y += reach * 0.85 * this.lift * g * (1 - i * 0.12);
        }
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(p.color, p.opacity * (1 - i * 0.15));
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// 6) PALABRAS TRENDING — la mano toca, surge una palabra, se queda un momento,
//    sale volando hacia un lado al azar; si la mano sigue ahí, aparece otra.
// ---------------------------------------------------------------------------
class TrendingWordsEffect {
  constructor() {
    this.items = [];
    this.waitTimer = 0;   // tiempo desde que la última palabra salió volando
    this.recent = [];
  }
  pickWord(words) {
    if (!words || words.length === 0) return null;
    // Al azar, pero las más populares salen más seguido. Evita repetir las últimas.
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
    if (this.recent.length > Math.min(6, Math.floor(words.length / 2))) this.recent.shift();
    return chosen;
  }
  spawn(hand, p, env) {
    const word = this.pickWord(env.words);
    if (!word) return;
    const popularity = word.popularity || 0.5;
    const size = p.size * ((1 - p.popularityScale) + p.popularityScale * (0.35 + 0.65 * popularity));
    const angle = Math.random() * Math.PI * 2; // hacia dónde va a volar
    this.items.push({
      text: word.word,
      popularity,
      size,
      x: hand.x,
      y: hand.y,
      age: 0,
      hold: p.hold,
      flyTime: p.flyTime,
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
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

    // ¿Hay una palabra todavía "en la mano" (surgiendo o quieta)?
    const current = this.items.find((it) => !it.flying);
    if (!current) this.waitTimer += dt;

    if (hands.length > 0 && !current && this.waitTimer >= p.interval) {
      this.spawn(hands[0], p, env);
      this.waitTimer = 0;
    }

    for (const it of this.items) {
      it.age += dt;
      if (!it.flying) {
        // Mientras está quieta sigue suavemente a la mano y crece si está cerca.
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
        // Vuela acelerando hacia su dirección al azar.
        it.flyAge += dt;
        it.vel += p.flySpeed * 2200 * dt;
        it.x += it.dirX * it.vel * dt;
        it.y += it.dirY * it.vel * dt;
        it.rot += it.spin * dt;
        it.near += (0 - it.near) * Math.min(1, dt * 3);
      }
    }
    this.items = this.items.filter((it) => !it.flying || (it.flyAge < it.flyTime &&
      it.x > -w * 0.5 && it.x < w * 1.5 && it.y > -h * 0.5 && it.y < h * 1.5));
  }
  draw(ctx, w, h, p) {
    ctx.globalCompositeOperation = "source-over";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const APPEAR = 0.35;
    for (const it of this.items) {
      // soft: 0 = recién surgida (nítida y brillante), 1 = translúcida y difuminada
      let scale, alpha, soft, blur;
      const fadeTo = p.fadeTo != null ? p.fadeTo : 0.4;
      const maxBlur = p.blur != null ? p.blur : 4;
      if (!it.flying) {
        const a = Math.min(1, it.age / APPEAR);
        scale = 1 + 2.2 * Math.pow(a - 1, 3) + 1.2 * Math.pow(a - 1, 2); // surge con un leve rebote
        soft = Math.max(0, Math.min(1, (it.age - APPEAR) / 0.5));
        soft = soft * soft * (3 - 2 * soft);
        alpha = Math.min(1, a * 1.5) * (1 - (1 - fadeTo) * soft);
        blur = maxBlur * soft;
      } else {
        const f = it.flyAge / it.flyTime;
        soft = 1;
        scale = 1 + f * 0.35;
        alpha = fadeTo * Math.max(0, 1 - f * f);
        blur = maxBlur * (1 + f); // se difumina más mientras se va
      }
      let size = it.size * Math.max(0.01, scale) * (1 + 0.4 * it.near);
      ctx.font = "800 " + Math.round(size) + "px 'Segoe UI', system-ui, sans-serif";
      let width = ctx.measureText(it.text).width;
      if (width > w * 0.92) {
        size *= (w * 0.92) / width;
        ctx.font = "800 " + Math.round(size) + "px 'Segoe UI', system-ui, sans-serif";
        width = ctx.measureText(it.text).width;
      }
      // Mientras está quieta, que no se salga de la pantalla.
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
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 24 + 30 * soft;
      }
      ctx.fillStyle = p.color;
      ctx.fillText(it.text, 0, 0);
      ctx.shadowBlur = 0;
      // Brillo blanco en el centro sólo al surgir.
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
// Fábrica de efectos por tipo
// ---------------------------------------------------------------------------
const EffectFactories = {
  particles: () => new ParticlesEffect(),
  fractalTree: () => new FractalTreeEffect(),
  flowfield: () => new FlowFieldEffect(),
  fire: () => new FireEffect(),
  water: () => new WaterEffect(),
  trending: () => new TrendingWordsEffect()
};
