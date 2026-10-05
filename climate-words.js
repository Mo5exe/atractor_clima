/*
 * Palabras del clima para la capa "Palabras".
 *
 * Mezcla tres cosas (cada una se puede prender o apagar desde el panel):
 *   1. Estado del clima en vivo: "llovizna", "ráfagas de 45 km/h", "humedad 87%"...
 *   2. Frases populares: cómo habla la gente común del clima según lo que está pasando.
 *   3. Voces en vivo: fragmentos cortos de posteos públicos de Mastodon (en castellano)
 *      que hablan del clima, con un filtro de malas palabras.
 * Más las palabras propias por clima que se escriben en el panel.
 */
"use strict";

const { categories } = require("./weather.js");

// --------------------------------------------------------------- 1. estado
function stateWords(w) {
  const out = [];
  const add = (word, pop) => out.push({ word, popularity: pop, kind: "estado" });
  add(w.desc, 1);
  add(Math.round(w.temp) + "°C", 0.95);
  if (Math.abs(w.feels - w.temp) >= 2) add("sensación térmica " + Math.round(w.feels) + "°", 0.8);
  add("humedad " + Math.round(w.humidity) + "%", w.humidity >= 75 ? 0.9 : 0.6);
  if (w.wind < 5) add("calma", 0.5);
  else add("viento del " + w.windName, 0.5 + Math.min(0.5, w.wind / 60));
  if (w.wind >= 5) add(Math.round(w.wind) + " km/h", 0.5);
  if (w.gusts >= 30) add("ráfagas de " + Math.round(w.gusts) + " km/h", 0.9);
  if (w.precip > 0) add(w.precip.toFixed(1).replace(".", ",") + " mm", 0.8);
  if (w.cloud >= 85) add("cielo cubierto", 0.6);
  else if (w.cloud <= 10) add("cielo limpio", 0.6);
  else add("nubes " + Math.round(w.cloud) + "%", 0.5);
  if (w.dayLight > 0.05 && w.dayLight < 0.95) add(new Date().getHours() < 12 ? "amanecer" : "atardecer", 0.8);
  else if (w.dayLight <= 0.05) add("noche", 0.6);
  if (w.city && w.mode === "real") add(w.city, 0.7);
  return out;
}

// --------------------------------------------------------------- 2. frases populares
const PHRASES = {
  calor: ["¡qué calor!", "está pesado", "me derrito", "no se aguanta", "ola de calor", "pileta", "ventilador",
    "a la sombra", "tomá agua", "aire acondicionado", "se cortó la luz", "un helado", "ojotas", "bochorno",
    "el sol raja la tierra", "golpe de calor", "no corre aire", "calor agobiante"],
  templado: ["lindo día", "ni frío ni calor", "se está bien", "clima ideal", "día para salir", "solcito",
    "una campera por las dudas", "¿saco o no saco?"],
  fresco: ["refrescó", "fresquito", "una campera liviana", "a la mañana hace frío", "el tiempo está loco",
    "un día de cada estación"],
  frio: ["¡qué frío!", "frío bárbaro", "abrigate", "bufanda", "mate caliente", "estufa", "se me congelan las manos",
    "camperón", "hace un frío que pela", "una sopa", "medias de lana", "frazada", "no salgo ni loca"],
  helada: ["helada", "escarcha", "bajo cero", "se congeló el parabrisas", "ola polar", "frío polar", "el pasto blanco"],
  lluvia: ["se largó", "llueve a cántaros", "paraguas", "charcos", "día de tortas fritas", "se inundó la calle",
    "llueve sobre mojado", "no para de llover", "empapada", "olor a tierra mojada", "piloto", "botas de lluvia",
    "¿trajiste paraguas?", "se llueve todo", "día de siesta", "agua"],
  llovizna: ["garúa", "llovizna", "garúa finita", "cielo gris", "se viene el agua", "moja pero no tanto",
    "humedad", "no sé si llevar paraguas"],
  tormenta: ["se viene el agua", "relámpagos", "truenos", "alerta amarilla", "alerta naranja", "se cortó la luz",
    "granizo", "temporal", "rayos", "guardá el auto", "sacá la ropa", "cielo negro", "se viene feo"],
  nieve: ["nieva", "copos", "todo blanco", "muñeco de nieve", "nevada histórica"],
  viento: ["¡qué viento!", "se vuela todo", "sudestada", "pampero", "zonda", "despeinada", "ráfagas",
    "se dio vuelta el paraguas", "viento de locos", "se cayó un árbol", "puerta golpeando"],
  humedo: ["¡qué humedad!", "está pesado", "no es el calor, es la humedad", "pegajoso", "la ropa no se seca",
    "el pelo hecho un desastre", "se viene la lluvia", "aire espeso"],
  nublado: ["cielo gris", "nublado", "día feo", "parece que va a llover", "se nubló", "día de pelis", "gris"],
  despejado: ["día espectacular", "cielo celeste", "día hermoso", "ni una nube", "hay que salir", "qué sol"],
  niebla: ["niebla", "no se ve nada", "neblina", "bruma", "cerrado de niebla", "aeropuerto cerrado"],
  noche: ["noche fresca", "estrellas", "luna", "sereno", "noche"],
  dia: ["¿cómo está afuera?", "¿viste el pronóstico?", "dicen que llueve", "sensación térmica",
    "el tiempo está loco", "cambio climático"]
};

function phraseWords(cats) {
  const out = [];
  const seen = new Set();
  cats.forEach((cat) => {
    (PHRASES[cat] || []).forEach((p) => {
      if (seen.has(p)) return;
      seen.add(p);
      out.push({ word: p, popularity: 0.6, kind: "frase" });
    });
  });
  return out;
}

// --------------------------------------------------------------- palabras propias por clima
// Formato (una línea por clima):   lluvia: charco, paraguas, tierra mojada
const CATEGORY_ALIASES = {
  "lluvia": "lluvia", "llueve": "lluvia", "llovizna": "llovizna", "garua": "llovizna", "garúa": "llovizna",
  "tormenta": "tormenta", "calor": "calor", "frio": "frio", "frío": "frio", "helada": "helada",
  "viento": "viento", "humedad": "humedo", "humedo": "humedo", "húmedo": "humedo", "nublado": "nublado",
  "nubes": "nublado", "despejado": "despejado", "sol": "despejado", "niebla": "niebla", "nieve": "nieve",
  "noche": "noche", "dia": "dia", "día": "dia", "templado": "templado", "fresco": "fresco",
  "siempre": "*", "todo": "*", "todos": "*"
};

function parseClimateWords(text) {
  const map = {};
  String(text || "").split(/\n+/).forEach((line) => {
    const m = line.match(/^\s*([^:]+):(.*)$/);
    if (!m) return;
    const cat = CATEGORY_ALIASES[m[1].trim().toLowerCase()];
    if (!cat) return;
    const words = m[2].split(/[,;]+/).map((w) => w.trim()).filter((w) => w && w.length <= 60);
    map[cat] = (map[cat] || []).concat(words);
  });
  return map;
}

function customClimateWords(text, cats) {
  const map = parseClimateWords(text);
  const words = [].concat(map["*"] || []);
  cats.forEach((c) => { words.push(...(map[c] || [])); });
  return Array.from(new Set(words)).map((word) => ({ word, popularity: 0.8, kind: "propia" }));
}

const { DEFAULT_CLIMATE_WORDS } = require("./public/js/schemas.js");

// --------------------------------------------------------------- 3. voces (Mastodon)
const VOICE_TAGS = {
  lluvia: ["lluvia", "llueve"], llovizna: ["lluvia", "llovizna"], tormenta: ["tormenta", "lluvia"],
  calor: ["calor"], frio: ["frio", "frío"], helada: ["frio", "helada"], viento: ["viento"],
  humedo: ["humedad"], nublado: ["clima"], despejado: ["clima"], niebla: ["niebla"], nieve: ["nieve"],
  templado: ["clima"], fresco: ["clima"]
};
const INSTANCES = ["https://mastodon.social", "https://masto.es"];
const WEATHER_WORDS = /(lluv|llov|llue|garú|garu|tormenta|calor|frí|frio|helad|viento|ráfag|rafag|humedad|húmed|nubl|nube|sol\b|niebla|nieve|nieva|clima|tiempo|temperatura|grados|°|paraguas|charco|trueno|rayo|relámp)/i;

// Filtro básico: lo que se proyecta en una pared tiene que poder verlo cualquiera.
// Se busca al principio de cada palabra (así "película" o "computadora" no se filtran).
const BAD_WORDS = [
  "boludo", "boluda", "pelotud", "mierda", "carajo", "puta", "puto", "concha", "forro", "culo", "verga", "pija",
  "poronga", "cagar", "cagad", "cagando", "cago", "choto", "chota", "mogolic", "mogólic", "idiota", "imbecil",
  "imbécil", "estupid", "estúpid", "tarad", "pajer", "joder", "gilipoll", "coño", "hdp", "ptm", "fuck", "shit",
  "bitch", "nazi", "matar", "mataron", "muerto", "muerta", "suicid", "violac", "violad", "odio", "odiar"
];
const BAD = new RegExp("(^|[^a-záéíóúñü])(" + BAD_WORDS.join("|") + ")", "i");

const voiceCache = { at: 0, key: "", list: [] };
const VOICE_CACHE_MS = 5 * 60 * 1000;

function cleanPost(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+(@[\w.-]+)?/g, "")
    .replace(/#(\w+)/g, "$1");
}

function fragmentsFrom(text) {
  return text
    .split(/[.!?¡¿\n…;:]+/)
    .map((s) => s.replace(/\s+/g, " ").replace(/^[\s,–—-]+|[\s,–—-]+$/g, "").trim())
    .filter((s) => {
      const n = s.split(" ").length;
      return n >= 2 && n <= 7 && s.length <= 48 && WEATHER_WORDS.test(s) && !BAD.test(s) && !/\d{4,}/.test(s);
    });
}

async function fetchVoices(cats) {
  const tags = Array.from(new Set(cats.flatMap((c) => VOICE_TAGS[c] || []))).slice(0, 3);
  if (tags.length === 0) tags.push("clima");
  const key = tags.join(",");
  if (voiceCache.key === key && Date.now() - voiceCache.at < VOICE_CACHE_MS) return voiceCache.list;

  const urls = [];
  INSTANCES.forEach((base) => tags.forEach((t) => urls.push(base + "/api/v1/timelines/tag/" + encodeURIComponent(t) + "?limit=40")));
  const results = await Promise.allSettled(urls.map((u) =>
    fetch(u, { headers: { "User-Agent": "Atractor-Clima/1.0" }, signal: AbortSignal.timeout(10000) })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })));

  const seen = new Set();
  const list = [];
  let ok = 0;
  results.forEach((r) => {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;
    ok++;
    r.value.forEach((post) => {
      if (post.language && post.language !== "es") return;
      if (post.sensitive || post.spoiler_text) return;
      fragmentsFrom(cleanPost(post.content)).forEach((f) => {
        const k = f.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        list.push({ word: f.charAt(0).toUpperCase() + f.slice(1), popularity: 0.75, kind: "voz" });
      });
    });
  });
  if (ok === 0) throw new Error("Mastodon no respondió");
  const picked = list.slice(0, 20);
  voiceCache.at = Date.now();
  voiceCache.key = key;
  voiceCache.list = picked;
  console.log("[clima] " + picked.length + " voces de Mastodon (" + key + ")");
  return picked;
}

// --------------------------------------------------------------- todo junto
async function getClimateWords(weather, settings) {
  if (!weather || !weather.ok) {
    return { trends: [], source: "cargando", label: "Palabras del clima", fetchedAt: Date.now(), parts: {} };
  }
  const cats = categories(weather);
  const parts = { estado: 0, frase: 0, propia: 0, voz: 0 };
  let words = [];
  let voicesFailed = false;

  if (settings.climateState !== false) words = words.concat(stateWords(weather));
  if (settings.climatePhrases !== false) words = words.concat(phraseWords(cats));
  words = words.concat(customClimateWords(settings.climateWords, cats));
  if (settings.climateVoices) {
    try {
      words = words.concat(await fetchVoices(cats));
    } catch (err) {
      voicesFailed = true;
      console.warn("[clima] voces: " + err.message);
    }
  }
  const seen = new Set();
  words = words.filter((w) => {
    const k = w.word.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    parts[w.kind] = (parts[w.kind] || 0) + 1;
    return true;
  });
  return {
    trends: words,
    source: "ok",
    label: "Palabras del clima",
    fetchedAt: Date.now(),
    categories: cats,
    parts,
    voicesFailed
  };
}

module.exports = { getClimateWords, stateWords, phraseWords, parseClimateWords, fragmentsFrom, cleanPost, DEFAULT_CLIMATE_WORDS, PHRASES };
