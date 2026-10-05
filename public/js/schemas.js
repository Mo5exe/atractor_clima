/*
 * Esquema de parámetros de cada efecto visual.
 * Se usa tanto en el navegador (control.js) como en Node (server.js),
 * para que ambos lados conozcan los mismos parámetros y valores por defecto.
 *
 * Todos los efectos tienen además el parámetro "attract" (0..1): cuánto
 * responde esa capa al atractor (la mano). 0 = la ignora, 1 = máximo.
 */
(function (root) {
  "use strict";

  var ATTRACT = { key: "attract", label: "Atracción a la mano", type: "range", min: 0, max: 1, step: 0.05, default: 1 };
  // Cuánto le afecta el clima a esa capa (viento, lluvia, temperatura, humedad).
  var CLIMATE = { key: "climate", label: "Influencia del clima", type: "range", min: 0, max: 1, step: 0.05, default: 1 };
  // Cuánto reacciona esa capa a la música (sólo si el audio está activado).
  var MUSIC = { key: "music", label: "Reacción a la música", type: "range", min: 0, max: 1, step: 0.05, default: 1 };

  var SCHEMAS = {
    particles: [
      { key: "count", label: "Cantidad", type: "range", min: 10, max: 2000, step: 10, default: 300 },
      { key: "speed", label: "Velocidad", type: "range", min: 0, max: 6, step: 0.1, default: 1.6 },
      { key: "spread", label: "Dispersión (°)", type: "range", min: 5, max: 360, step: 1, default: 360 },
      { key: "size", label: "Tamaño", type: "range", min: 1, max: 24, step: 0.5, default: 4 },
      { key: "life", label: "Vida (s)", type: "range", min: 0.2, max: 10, step: 0.1, default: 2.5 },
      { key: "gravity", label: "Gravedad", type: "range", min: -2, max: 2, step: 0.05, default: 0 },
      { key: "originX", label: "Origen X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
      { key: "originY", label: "Origen Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#66ccff" }
    ],
    fractalTree: [
      { key: "depth", label: "Profundidad", type: "range", min: 2, max: 13, step: 1, default: 9 },
      { key: "angle", label: "Ángulo de rama (°)", type: "range", min: 5, max: 60, step: 1, default: 25 },
      { key: "lengthRatio", label: "Reducción de rama", type: "range", min: 0.5, max: 0.9, step: 0.01, default: 0.72 },
      { key: "initialLength", label: "Largo inicial", type: "range", min: 40, max: 260, step: 1, default: 130 },
      { key: "lineWidth", label: "Grosor tronco", type: "range", min: 1, max: 14, step: 0.5, default: 7 },
      { key: "sway", label: "Balanceo (viento)", type: "range", min: 0, max: 30, step: 1, default: 6 },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "colorStart", label: "Color tronco", type: "color", default: "#5c3a21" },
      { key: "colorEnd", label: "Color hojas", type: "color", default: "#7cfc00" }
    ],
    flowfield: [
      { key: "particleCount", label: "Partículas", type: "range", min: 50, max: 2500, step: 10, default: 600 },
      { key: "noiseScale", label: "Escala del ruido", type: "range", min: 0.001, max: 0.05, step: 0.001, default: 0.008 },
      { key: "noiseSpeed", label: "Velocidad de evolución", type: "range", min: 0, max: 0.02, step: 0.0005, default: 0.002 },
      { key: "particleSpeed", label: "Velocidad de partícula", type: "range", min: 0.5, max: 10, step: 0.1, default: 2.5 },
      { key: "lineLength", label: "Largo de estela", type: "range", min: 1, max: 24, step: 1, default: 5 },
      { key: "lineWidth", label: "Grosor de línea", type: "range", min: 0.3, max: 5, step: 0.1, default: 1.2 },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#ffffff" }
    ],
    fire: [
      { key: "intensity", label: "Intensidad (partículas)", type: "range", min: 10, max: 500, step: 5, default: 140 },
      { key: "baseWidth", label: "Ancho de base (%)", type: "range", min: 5, max: 100, step: 1, default: 28 },
      { key: "height", label: "Altura de llama", type: "range", min: 0.3, max: 3, step: 0.05, default: 1.3 },
      { key: "turbulence", label: "Turbulencia", type: "range", min: 0, max: 5, step: 0.1, default: 1.2 },
      { key: "size", label: "Tamaño de partícula", type: "range", min: 2, max: 32, step: 1, default: 15 },
      { key: "baseX", label: "Posición X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
      { key: "baseY", label: "Posición base Y (%)", type: "range", min: 0, max: 100, step: 1, default: 100 },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "colorCore", label: "Color del centro", type: "color", default: "#ffffc8" },
      { key: "colorMid", label: "Color medio", type: "color", default: "#ffaa28" },
      { key: "colorTip", label: "Color de las puntas", type: "color", default: "#e63c14" }
    ],
    water: [
      { key: "waveCount", label: "Cantidad de olas", type: "range", min: 1, max: 6, step: 1, default: 3 },
      { key: "amplitude", label: "Amplitud", type: "range", min: 2, max: 100, step: 1, default: 24 },
      { key: "frequency", label: "Frecuencia", type: "range", min: 0.3, max: 8, step: 0.1, default: 2.2 },
      { key: "speed", label: "Velocidad", type: "range", min: 0, max: 5, step: 0.05, default: 1.0 },
      { key: "levelY", label: "Nivel / centro del agua (%)", type: "range", min: 0, max: 100, step: 1, default: 60 },
      { key: "band", label: "Banda espejada (olas arriba y abajo)", type: "checkbox", default: true },
      { key: "thickness", label: "Grosor de la banda (%)", type: "range", min: 2, max: 120, step: 1, default: 35 },
      { key: "opacity", label: "Opacidad", type: "range", min: 0.1, max: 1, step: 0.05, default: 0.55 },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#1e6fd9" }
    ],
    trending: [
      { key: "size", label: "Tamaño de palabra", type: "range", min: 12, max: 200, step: 1, default: 72 },
      { key: "hold", label: "Tiempo quieta (s)", type: "range", min: 0, max: 5, step: 0.05, default: 0.7 },
      { key: "interval", label: "Espera entre palabras (s)", type: "range", min: 0, max: 5, step: 0.05, default: 0.5 },
      { key: "flySpeed", label: "Velocidad de vuelo", type: "range", min: 0.2, max: 4, step: 0.05, default: 1.2 },
      { key: "flyTime", label: "Duración del vuelo (s)", type: "range", min: 0.3, max: 5, step: 0.05, default: 1.4 },
      { key: "fadeTo", label: "Transparencia al quedarse", type: "range", min: 0.05, max: 1, step: 0.05, default: 0.4 },
      { key: "blur", label: "Difuminado (bordes suaves)", type: "range", min: 0, max: 20, step: 0.5, default: 4 },
      { key: "popularityScale", label: "Peso de la popularidad", type: "range", min: 0, max: 1, step: 0.05, default: 0.6 },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#ff3d8b" },
      { key: "glow", label: "Brillo", type: "checkbox", default: true }
    ],
    rain: [
      { key: "minDrops", label: "Gotas sin lluvia real", type: "range", min: 0, max: 1500, step: 10, default: 120 },
      { key: "maxDrops", label: "Gotas con lluvia fuerte", type: "range", min: 50, max: 4000, step: 10, default: 1600 },
      { key: "speed", label: "Velocidad de caída", type: "range", min: 2, max: 40, step: 0.5, default: 16 },
      { key: "slant", label: "Inclinación (°) — diagonal", type: "range", min: -60, max: 60, step: 1, default: 22 },
      { key: "length", label: "Largo de gota", type: "range", min: 2, max: 60, step: 1, default: 18 },
      { key: "lineWidth", label: "Grosor", type: "range", min: 0.3, max: 4, step: 0.1, default: 1 },
      { key: "splash", label: "Salpicaduras", type: "checkbox", default: true },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#a8c8ff" }
    ],
    clouds: [
      { key: "minClouds", label: "Nubes con cielo despejado", type: "range", min: 0, max: 30, step: 1, default: 2 },
      { key: "maxClouds", label: "Nubes con cielo cubierto", type: "range", min: 1, max: 60, step: 1, default: 22 },
      { key: "size", label: "Tamaño", type: "range", min: 40, max: 600, step: 5, default: 260 },
      { key: "opacity", label: "Opacidad", type: "range", min: 0.02, max: 1, step: 0.01, default: 0.22 },
      { key: "speed", label: "Velocidad (además del viento)", type: "range", min: 0, max: 3, step: 0.05, default: 0.3 },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#c9d4e6" }
    ],
    pixels: [
      { key: "count", label: "Cantidad", type: "range", min: 10, max: 4000, step: 10, default: 600 },
      { key: "speed", label: "Velocidad", type: "range", min: 0, max: 8, step: 0.1, default: 2 },
      { key: "spread", label: "Dispersión (°)", type: "range", min: 5, max: 360, step: 1, default: 360 },
      { key: "size", label: "Tamaño del píxel", type: "range", min: 1, max: 40, step: 1, default: 6 },
      { key: "life", label: "Vida (s)", type: "range", min: 0.3, max: 15, step: 0.1, default: 5 },
      { key: "originX", label: "Origen X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
      { key: "originY", label: "Origen Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
      { key: "colorMode", label: "Colores de los píxeles", type: "select", default: "single", options: [
        { value: "single", label: "Un solo color (el de abajo)" },
        { value: "rainbow", label: "Todos los colores" },
        { value: "palette", label: "Tonos del color elegido" },
        { value: "climate", label: "Según la temperatura" }
      ] },
      { key: "snap", label: "Alinear a grilla (pixel art)", type: "checkbox", default: true },
      { key: "sizeVariation", label: "Tamaños distintos", type: "checkbox", default: false },
      { key: "flicker", label: "Parpadeo", type: "checkbox", default: false },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color de los píxeles", type: "color", default: "#39ff9c" }
    ],
    images: [
      { key: "images", label: "Imágenes de esta capa", type: "images", default: [] },
      { key: "removeBg", label: "Quitar fondo / cuadraditos", type: "checkbox", default: true },
      { key: "bgTolerance", label: "Tolerancia al quitar el fondo", type: "range", min: 2, max: 120, step: 1, default: 30 },
      { key: "mode", label: "Cuándo aparecen", type: "select", default: "touch", options: [
        { value: "touch", label: "Al tocar (mano o clic)" },
        { value: "always", label: "Siempre visibles (flotando)" }
      ] },
      { key: "size", label: "Tamaño (px)", type: "range", min: 20, max: 1200, step: 5, default: 260 },
      { key: "sizeVariation", label: "Variación de tamaño", type: "range", min: 0, max: 1, step: 0.05, default: 0.3 },
      { key: "hold", label: "Tiempo quieta (s)", type: "range", min: 0, max: 8, step: 0.05, default: 0.9 },
      { key: "interval", label: "Espera entre imágenes (s)", type: "range", min: 0, max: 5, step: 0.05, default: 0.5 },
      { key: "flySpeed", label: "Velocidad de vuelo", type: "range", min: 0.1, max: 4, step: 0.05, default: 1 },
      { key: "flyTime", label: "Duración del vuelo (s)", type: "range", min: 0.3, max: 6, step: 0.05, default: 1.6 },
      { key: "fadeTo", label: "Transparencia al quedarse", type: "range", min: 0.05, max: 1, step: 0.05, default: 0.7 },
      { key: "blur", label: "Difuminado", type: "range", min: 0, max: 20, step: 0.5, default: 0 },
      { key: "spin", label: "Girar al volar", type: "checkbox", default: true },
      { key: "colorMode", label: "Color", type: "select", default: "original", options: [
        { value: "original", label: "Colores originales" },
        { value: "tint", label: "Teñir con un color" },
        { value: "climate", label: "Según la temperatura" },
        { value: "rainbow", label: "Todos los colores (una distinta cada vez)" }
      ] },
      { key: "tintAmount", label: "Cuánto se tiñe (1 = silueta del color)", type: "range", min: 0, max: 1, step: 0.05, default: 0.6 },
      { key: "color", label: "Color para teñir", type: "color", default: "#ff3d8b" },
      ATTRACT,
      CLIMATE,
      MUSIC
    ],
    animations: [
      { key: "animations", label: "Animaciones de esta capa", type: "animations", default: [] },
      { key: "mode", label: "Cuándo aparecen", type: "select", default: "touch", options: [
        { value: "touch", label: "Al tocar (mano o clic)" },
        { value: "always", label: "Siempre visibles (flotando)" },
        { value: "fullscreen", label: "Pantalla completa (fondo / loop de VJ)" }
      ] },
      { key: "blend", label: "Mezcla", type: "select", default: "normal", options: [
        { value: "normal", label: "Normal (respeta la transparencia)" },
        { value: "screen", label: "Quitar el fondo negro (screen)" },
        { value: "lighter", label: "Sumar luz (brilla más)" },
        { value: "multiply", label: "Quitar el fondo blanco (multiply)" }
      ] },
      { key: "fit", label: "Ajuste en pantalla completa", type: "select", default: "cover", options: [
        { value: "cover", label: "Llenar la pantalla (recorta)" },
        { value: "contain", label: "Entera (sin recortar)" }
      ] },
      { key: "size", label: "Tamaño (px)", type: "range", min: 20, max: 1600, step: 5, default: 320 },
      { key: "sizeVariation", label: "Variación de tamaño", type: "range", min: 0, max: 1, step: 0.05, default: 0.2 },
      { key: "playSpeed", label: "Velocidad de reproducción", type: "range", min: 0.1, max: 4, step: 0.05, default: 1 },
      { key: "opacity", label: "Opacidad", type: "range", min: 0.05, max: 1, step: 0.05, default: 1 },
      { key: "hold", label: "Tiempo quieta (s)", type: "range", min: 0, max: 10, step: 0.05, default: 1.5 },
      { key: "interval", label: "Espera entre animaciones (s)", type: "range", min: 0, max: 5, step: 0.05, default: 0.5 },
      { key: "flySpeed", label: "Velocidad de vuelo", type: "range", min: 0.1, max: 4, step: 0.05, default: 0.8 },
      { key: "flyTime", label: "Duración del vuelo (s)", type: "range", min: 0.3, max: 6, step: 0.05, default: 1.6 },
      { key: "spin", label: "Girar al volar", type: "checkbox", default: false },
      { key: "beatAction", label: "Con el beat", type: "select", default: "jump", options: [
        { value: "jump", label: "Saltar a otro momento" },
        { value: "restart", label: "Volver al principio" },
        { value: "none", label: "Nada" }
      ] },
      ATTRACT,
      CLIMATE,
      MUSIC
    ],
    glitch: [
      { key: "variant", label: "Variante", type: "select", default: "mixed", options: [
        { value: "mixed", label: "Todas mezcladas" },
        { value: "slices", label: "Cortes desplazados" },
        { value: "rgb", label: "Separación RGB" },
        { value: "blocks", label: "Bloques" },
        { value: "scanlines", label: "Líneas de TV" },
        { value: "noise", label: "Ruido digital" },
        { value: "invert", label: "Inversión de color" }
      ] },
      { key: "area", label: "Zona", type: "select", default: "full", options: [
        { value: "full", label: "Toda la pantalla" },
        { value: "part", label: "Una parte (rectángulo en el punto de origen)" },
        { value: "hand", label: "Alrededor de la mano" }
      ] },
      { key: "timing", label: "Cuándo", type: "select", default: "bursts", options: [
        { value: "bursts", label: "Por ráfagas al azar" },
        { value: "always", label: "Siempre" },
        { value: "touch", label: "Sólo al tocar (mano o clic)" }
      ] },
      { key: "intensity", label: "Intensidad", type: "range", min: 0.05, max: 1, step: 0.05, default: 0.5 },
      { key: "width", label: "Ancho de la zona (%)", type: "range", min: 5, max: 100, step: 1, default: 40 },
      { key: "height", label: "Alto de la zona (%)", type: "range", min: 5, max: 100, step: 1, default: 30 },
      { key: "branches", label: "Ramitas ortogonales (en “una parte” / “mano”)", type: "range", min: 0, max: 16, step: 1, default: 6 },
      { key: "branchLength", label: "Largo de las ramitas", type: "range", min: 0.1, max: 2, step: 0.05, default: 0.8 },
      { key: "frequency", label: "Ráfagas por segundo", type: "range", min: 0.05, max: 5, step: 0.05, default: 0.7 },
      { key: "burstLength", label: "Duración de cada ráfaga (s)", type: "range", min: 0.05, max: 3, step: 0.05, default: 0.35 },
      { key: "speed", label: "Velocidad del glitch (cambios por segundo)", type: "range", min: 1, max: 60, step: 1, default: 18 },
      { key: "color", label: "Color de bloques", type: "color", default: "#ff3d8b" },
      { key: "color2", label: "Segundo color", type: "color", default: "#5cc8ff" },
      ATTRACT,
      CLIMATE,
      MUSIC
    ],
    stripesV: [
      { key: "count", label: "Cantidad de rayas", type: "range", min: 1, max: 80, step: 1, default: 14 },
      { key: "minWidth", label: "Grosor mínimo", type: "range", min: 0.5, max: 200, step: 0.5, default: 2 },
      { key: "maxWidth", label: "Grosor máximo", type: "range", min: 1, max: 400, step: 1, default: 60 },
      { key: "pulse", label: "Velocidad de engorde", type: "range", min: 0, max: 5, step: 0.05, default: 0.8 },
      { key: "speed", label: "Velocidad de movimiento", type: "range", min: 0, max: 10, step: 0.1, default: 1.5 },
      { key: "randomness", label: "Cambios de dirección", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
      { key: "opacity", label: "Opacidad", type: "range", min: 0.05, max: 1, step: 0.05, default: 0.55 },
      { key: "colorMode", label: "Colores", type: "select", default: "two", options: [
        { value: "single", label: "Un color" },
        { value: "two", label: "Dos colores" },
        { value: "rainbow", label: "Todos los colores" },
        { value: "climate", label: "Según la temperatura" }
      ] },
      { key: "blend", label: "Sumar luz al cruzarse", type: "checkbox", default: true },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#5cc8ff" },
      { key: "color2", label: "Segundo color", type: "color", default: "#ff3d8b" }
    ],
    stripesH: [
      { key: "count", label: "Cantidad de rayas", type: "range", min: 1, max: 80, step: 1, default: 14 },
      { key: "minWidth", label: "Grosor mínimo", type: "range", min: 0.5, max: 200, step: 0.5, default: 2 },
      { key: "maxWidth", label: "Grosor máximo", type: "range", min: 1, max: 400, step: 1, default: 60 },
      { key: "pulse", label: "Velocidad de engorde", type: "range", min: 0, max: 5, step: 0.05, default: 0.8 },
      { key: "speed", label: "Velocidad de movimiento", type: "range", min: 0, max: 10, step: 0.1, default: 1.5 },
      { key: "randomness", label: "Cambios de dirección", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
      { key: "opacity", label: "Opacidad", type: "range", min: 0.05, max: 1, step: 0.05, default: 0.55 },
      { key: "colorMode", label: "Colores", type: "select", default: "two", options: [
        { value: "single", label: "Un color" },
        { value: "two", label: "Dos colores" },
        { value: "rainbow", label: "Todos los colores" },
        { value: "climate", label: "Según la temperatura" }
      ] },
      { key: "blend", label: "Sumar luz al cruzarse", type: "checkbox", default: true },
      ATTRACT,
      CLIMATE,
      MUSIC,
      { key: "color", label: "Color", type: "color", default: "#ffb13d" },
      { key: "color2", label: "Segundo color", type: "color", default: "#7a5cff" }
    ]
  };

  var NAMES = {
    particles: "Partículas",
    fractalTree: "Árbol Fractal",
    flowfield: "Flow Field",
    fire: "Fuego",
    water: "Agua",
    trending: "Palabras",
    rain: "Lluvia",
    clouds: "Nubes",
    pixels: "Píxeles",
    images: "Imágenes",
    glitch: "Glitch",
    animations: "Animaciones",
    stripesV: "Rayas verticales",
    stripesH: "Rayas horizontales"
  };

  // Ajustes globales de la escena (no pertenecen a una capa).
  // geo: código para Google Trends · wiki: idioma de Wikipedia
  var COUNTRIES = [
    { id: "", label: "Mundial", geo: "US", wiki: "es" },
    { id: "argentina", label: "Argentina", geo: "AR", wiki: "es" },
    { id: "spain", label: "España", geo: "ES", wiki: "es" },
    { id: "mexico", label: "México", geo: "MX", wiki: "es" },
    { id: "chile", label: "Chile", geo: "CL", wiki: "es" },
    { id: "colombia", label: "Colombia", geo: "CO", wiki: "es" },
    { id: "united-states", label: "Estados Unidos (inglés)", geo: "US", wiki: "en" },
    { id: "united-kingdom", label: "Reino Unido (inglés)", geo: "GB", wiki: "en" },
    { id: "germany", label: "Alemania (alemán)", geo: "DE", wiki: "de" },
    { id: "france", label: "Francia (francés)", geo: "FR", wiki: "fr" },
    { id: "brazil", label: "Brasil (portugués)", geo: "BR", wiki: "pt" }
  ];

  // Diarios para "Titulares de diarios" (las palabras que más se repiten en sus titulares).
  var NEWS_SOURCES = [
    { id: "ar", label: "Diarios argentinos (Página/12, Clarín, La Nación, Infobae, Perfil)", lang: "es", feeds: [
      "https://www.pagina12.com.ar/rss/portada",
      "https://www.clarin.com/rss/lo-ultimo/",
      "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml",
      "https://www.infobae.com/feeds/rss/",
      "https://www.perfil.com/feed"] },
    { id: "bbc_mundo", label: "BBC Mundo (castellano)", lang: "es", feeds: ["https://feeds.bbci.co.uk/mundo/rss.xml"] },
    { id: "dw_es", label: "DW Español (castellano)", lang: "es", feeds: ["https://rss.dw.com/rdf/rss-sp-all"] },
    { id: "elpais", label: "El País (España)", lang: "es", feeds: ["https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada"] },
    { id: "bbc", label: "BBC News (inglés)", lang: "en", feeds: ["https://feeds.bbci.co.uk/news/rss.xml", "https://feeds.bbci.co.uk/news/world/rss.xml"] },
    { id: "dw_en", label: "DW — Deutsche Welle (inglés)", lang: "en", feeds: ["https://rss.dw.com/rdf/rss-en-all"] },
    { id: "guardian", label: "The Guardian (inglés)", lang: "en", feeds: ["https://www.theguardian.com/world/rss", "https://www.theguardian.com/environment/rss"] },
    { id: "aljazeera", label: "Al Jazeera (inglés)", lang: "en", feeds: ["https://www.aljazeera.com/xml/rss/all.xml"] },
    { id: "npr", label: "NPR (inglés)", lang: "en", feeds: ["https://feeds.npr.org/1001/rss.xml"] },
    { id: "dw_de", label: "DW Deutsch (alemán)", lang: "de", feeds: ["https://rss.dw.com/rdf/rss-de-all"] },
    { id: "spiegel", label: "Der Spiegel (alemán)", lang: "de", feeds: ["https://www.spiegel.de/schlagzeilen/index.rss"] },
    { id: "lemonde", label: "Le Monde (francés)", lang: "fr", feeds: ["https://www.lemonde.fr/rss/une.xml"] },
    { id: "world_en", label: "Mezcla internacional en inglés (BBC, DW, Guardian, Al Jazeera)", lang: "en", feeds: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://rss.dw.com/rdf/rss-en-all",
      "https://www.theguardian.com/world/rss",
      "https://www.aljazeera.com/xml/rss/all.xml"] }
  ];

  // De dónde salen las palabras de la capa "Palabras".
  var WORD_SOURCES = [
    { id: "clima", label: "Palabras del clima", hint: "El estado del clima en vivo, frases populares sobre el clima, tus palabras para cada clima y (opcional) voces de la gente en Mastodon." },
    { id: "custom", label: "Mis palabras (lista propia)", hint: "Las palabras que escribas abajo, separadas por coma o en renglones." },
    { id: "wikipedia", label: "Lo más leído en Wikipedia", hint: "Los artículos más visitados ayer: temas del día, personas, lugares, ideas." },
    { id: "news", label: "Titulares de diarios", hint: "Las palabras que más se repiten hoy en los titulares del diario que elijas: argentinos, BBC, DW, The Guardian, Le Monde, Der Spiegel…" },
    { id: "google", label: "Búsquedas en Google", hint: "Lo que más se está buscando en Google ahora." },
    { id: "trends", label: "Trending de X (Twitter)", hint: "Los trending topics de X, leídos de trends24.in." }
  ];

  var DEFAULT_CUSTOM_WORDS = [
    "posthumano", "post-naturaleza", "nuevos materialismos", "ecología", "simbiosis", "micelio",
    "compost", "raíz", "enjambre", "sedimento", "glaciar", "fósil", "residuo", "metabolismo",
    "mutación", "cyborg", "especie", "devenir", "ensamblaje", "Antropoceno", "interfaz",
    "algoritmo", "latencia", "ruido", "umbral", "deriva", "tierra", "agua", "cuerpo", "máquina"
  ].join(", ");

  // Palabras propias por clima: una línea por clima, "clima: palabra, palabra".
  // Climas: siempre, lluvia, llovizna, tormenta, calor, templado, fresco, frio, helada,
  //         viento, humedad, nublado, despejado, niebla, nieve, noche, dia
  var DEFAULT_CLIMATE_WORDS = [
    "siempre: atmósfera, intemperie, pronóstico",
    "lluvia: charco, tierra mojada, gotera, cauce",
    "calor: evaporación, isla de calor, asfalto",
    "frio: escarcha, aliento, vapor",
    "viento: polen, semillas, deriva",
    "humedad: moho, condensación, musgo",
    "nublado: gris, umbral, espera",
    "noche: rocío, silencio"
  ].join("\n");

  var DEFAULT_SETTINGS = {
    attractorStrength: 0.8, // 0..1
    attractorRadius: 60,    // % de la diagonal de la pantalla donde actúa la mano
    mirror: true,           // espejar la cámara (como un espejo)
    showCursor: true,       // dibujar un círculo donde está la mano
    maxHands: 4,            // cuántas manos detecta la cámara a la vez (1 a 6)
    wordSource: "clima",
    trendsCountry: "argentina",
    newsSource: "ar",
    customWords: DEFAULT_CUSTOM_WORDS,

    // --- Clima ---
    city: { name: "Buenos Aires", lat: -34.6037, lon: -58.3816, country: "Argentina", region: "" },
    weatherMode: "real",           // "real" (Open-Meteo) o "manual" (sliders del panel)
    manualWeather: { temp: 18, humidity: 60, precip: 0, cloud: 30, wind: 10, windDir: 180, dayLight: 1 },
    climateColor: 0.5,             // cuánto tiñe la temperatura los colores (frío azul, calor naranja)
    fog: 0.6,                      // niebla según humedad y nubes
    sky: true,                     // teñir el fondo según la hora (noche / amanecer / día)
    bgColor: "#000000",            // color de fondo de la salida
    climateState: true,            // palabras: estado del clima
    climatePhrases: true,          // palabras: frases populares
    climateVoices: true,           // palabras: voces de Mastodon
    climateWords: DEFAULT_CLIMATE_WORDS,

    // --- Música (audio reactivo) ---
    audioEnabled: false,           // apagado hasta que lo actives
    audioSource: "mic",            // "mic" (micrófono / entrada de audio) o "system" (sonido de la compu)
    audioDeviceId: "",             // entrada elegida ("" = la predeterminada)
    audioSensitivity: 1.2,         // ganancia de los medidores
    beatSensitivity: 0.5           // 0 = sólo golpes muy marcados, 1 = detecta más golpes
  };

  var api = {
    SCHEMAS: SCHEMAS, NAMES: NAMES, COUNTRIES: COUNTRIES, WORD_SOURCES: WORD_SOURCES, NEWS_SOURCES: NEWS_SOURCES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS, DEFAULT_CUSTOM_WORDS: DEFAULT_CUSTOM_WORDS,
    DEFAULT_CLIMATE_WORDS: DEFAULT_CLIMATE_WORDS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.EffectSchemas = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
