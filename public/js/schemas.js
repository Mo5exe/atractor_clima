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
      ATTRACT
    ],
    water: [
      { key: "waveCount", label: "Cantidad de olas", type: "range", min: 1, max: 6, step: 1, default: 3 },
      { key: "amplitude", label: "Amplitud", type: "range", min: 2, max: 100, step: 1, default: 24 },
      { key: "frequency", label: "Frecuencia", type: "range", min: 0.3, max: 8, step: 0.1, default: 2.2 },
      { key: "speed", label: "Velocidad", type: "range", min: 0, max: 5, step: 0.05, default: 1.0 },
      { key: "levelY", label: "Nivel de agua (%)", type: "range", min: 0, max: 100, step: 1, default: 60 },
      { key: "opacity", label: "Opacidad", type: "range", min: 0.1, max: 1, step: 0.05, default: 0.55 },
      ATTRACT,
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
      { key: "color", label: "Color", type: "color", default: "#ff3d8b" },
      { key: "glow", label: "Brillo", type: "checkbox", default: true }
    ]
  };

  var NAMES = {
    particles: "Partículas",
    fractalTree: "Árbol Fractal",
    flowfield: "Flow Field",
    fire: "Fuego",
    water: "Agua",
    trending: "Palabras"
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
    { id: "united-states", label: "Estados Unidos", geo: "US", wiki: "en" }
  ];

  // De dónde salen las palabras de la capa "Palabras".
  var WORD_SOURCES = [
    { id: "custom", label: "Mis palabras (lista propia)", hint: "Las palabras que escribas abajo, separadas por coma o en renglones." },
    { id: "wikipedia", label: "Lo más leído en Wikipedia", hint: "Los artículos más visitados ayer: temas del día, personas, lugares, ideas." },
    { id: "news", label: "Titulares de diarios", hint: "Las palabras que más se repiten hoy en los titulares de los diarios." },
    { id: "google", label: "Búsquedas en Google", hint: "Lo que más se está buscando en Google ahora." },
    { id: "trends", label: "Trending de X (Twitter)", hint: "Los trending topics de X, leídos de trends24.in." }
  ];

  var DEFAULT_CUSTOM_WORDS = [
    "posthumano", "post-naturaleza", "nuevos materialismos", "ecología", "simbiosis", "micelio",
    "compost", "raíz", "enjambre", "sedimento", "glaciar", "fósil", "residuo", "metabolismo",
    "mutación", "cyborg", "especie", "devenir", "ensamblaje", "Antropoceno", "interfaz",
    "algoritmo", "latencia", "ruido", "umbral", "deriva", "tierra", "agua", "cuerpo", "máquina"
  ].join(", ");

  var DEFAULT_SETTINGS = {
    attractorStrength: 0.8, // 0..1
    attractorRadius: 60,    // % de la diagonal de la pantalla donde actúa la mano
    mirror: true,           // espejar la cámara (como un espejo)
    showCursor: true,       // dibujar un círculo donde está la mano
    wordSource: "custom",
    trendsCountry: "argentina",
    customWords: DEFAULT_CUSTOM_WORDS
  };

  var api = {
    SCHEMAS: SCHEMAS, NAMES: NAMES, COUNTRIES: COUNTRIES, WORD_SOURCES: WORD_SOURCES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS, DEFAULT_CUSTOM_WORDS: DEFAULT_CUSTOM_WORDS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.EffectSchemas = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
