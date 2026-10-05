/*
 * Fuentes de palabras para la capa "Palabras".
 *
 * getWords(settings) -> Promise<{ trends, source, label, fetchedAt }>
 *   trends: [{ word, popularity (0..1) }]
 *   source: "ok" | "cache" | "respaldo" | "propias"
 *
 * Fuentes (settings.wordSource):
 *   "trends"    -> trending topics de X/Twitter (trends24.in)
 *   "google"    -> búsquedas en tendencia de Google (RSS de Google Trends)
 *   "wikipedia" -> artículos más leídos ayer en Wikipedia
 *   "news"      -> palabras más repetidas en los titulares de diarios (RSS)
 *   "custom"    -> lista propia (settings.customWords)
 *
 * Todo lo que viene de internet se cachea 3 minutos. Si algo falla se usa
 * lo último que funcionó o, si no hay nada, la lista propia.
 */
"use strict";

const { getTrends } = require("./trending-scraper.js");
const { COUNTRIES } = require("./public/js/schemas.js");

const CACHE_MS = 3 * 60 * 1000;
const cache = new Map(); // clave -> { at, trends }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

function decodeEntities(str) {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function rankToPopularity(list) {
  // list: [{ word, count? }] ordenada de más a menos popular
  const maxCount = Math.max(0, ...list.map((t) => t.count || 0));
  const n = list.length || 1;
  return list.map((t, i) => {
    const byRank = 1 - i / n;
    const byCount = maxCount > 0 && t.count > 0 ? t.count / maxCount : byRank;
    return { word: t.word, popularity: Math.max(0.05, Math.min(1, 0.5 * byRank + 0.5 * byCount)) };
  });
}

function countryInfo(id) {
  return COUNTRIES.find((c) => c.id === id) || COUNTRIES[0];
}

// --------------------------------------------------------------- lista propia
function customWords(text) {
  const words = String(text || "")
    .split(/[\n,;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w.length <= 60);
  const unique = Array.from(new Set(words));
  // En la lista propia todas pesan igual (no hay "popularidad").
  return unique.map((word) => ({ word, popularity: 0.7 }));
}

// --------------------------------------------------------------- Google Trends
function parseGoogleTrendsRss(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const title = m[1].match(/<title>([\s\S]*?)<\/title>/i);
    if (!title) continue;
    const word = decodeEntities(title[1]).trim();
    if (!word) continue;
    const traffic = m[1].match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i);
    const count = traffic ? Number(decodeEntities(traffic[1]).replace(/[^\d]/g, "")) || 0 : 0;
    items.push({ word, count });
  }
  items.sort((a, b) => b.count - a.count);
  return rankToPopularity(items.slice(0, 30));
}

async function googleTrends(country) {
  const geo = countryInfo(country).geo || "US";
  const xml = await fetchText("https://trends.google.com/trending/rss?geo=" + geo);
  return parseGoogleTrendsRss(xml);
}

// --------------------------------------------------------------- Wikipedia
const WIKI_SKIP = /^(Especial|Special|Wikipedia|Portal|Archivo|File|Ayuda|Help|Categoría|Category):|^(Portada|Main Page|Wikipedia)$/i;

async function wikipediaMostRead(country) {
  const lang = countryInfo(country).wiki || "es";
  // Ayer (UTC): el ranking del día completo.
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ymd = d.getUTCFullYear() + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCDate()).padStart(2, "0");
  const json = JSON.parse(await fetchText("https://" + lang + ".wikipedia.org/api/rest_v1/feed/featured/" + ymd));
  const articles = (json.mostread && json.mostread.articles) || [];
  const list = articles
    .map((a) => ({ word: (a.normalizedtitle || a.title || "").replace(/_/g, " ").trim(), count: a.views || 0 }))
    .filter((a) => a.word && !WIKI_SKIP.test(a.word) && a.word.length <= 60);
  return rankToPopularity(list.slice(0, 30));
}

// --------------------------------------------------------------- Diarios
const NEWS_FEEDS = {
  argentina: [
    "https://www.pagina12.com.ar/rss/portada",
    "https://www.clarin.com/rss/lo-ultimo/",
    "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml",
    "https://www.infobae.com/feeds/rss/",
    "https://www.perfil.com/feed"
  ],
  spain: [
    "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
    "https://www.elmundo.es/rss/portada.xml"
  ],
  mexico: ["https://www.jornada.com.mx/rss/edicion.xml"],
  default: [
    "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
    "https://www.pagina12.com.ar/rss/portada",
    "https://www.infobae.com/feeds/rss/"
  ]
};

const STOPWORDS = new Set((
  "a al algo algún alguna algunas alguno algunos ante antes aquel aquella aquellas aquellos aquí así aún aunque bajo bien cada casi " +
  "como cómo con contra cual cuál cuales cuando cuándo cuanto de del desde donde dónde dos durante e el él ella ellas ellos en entre " +
  "era eran es esa esas ese eso esos esta está están estas este esto estos fue fueron ha había han hasta hay la las le les lo los " +
  "más mas me mi mientras muy nada ni no nos nosotros nueva nuevo nuevos nuevas o otra otras otro otros para pero poco por porque qué que " +
  "quien quién quienes se sea según ser será si sí sido sin sobre son su sus también tan tanto te tiene tienen todo todos todas tras " +
  "tu tus un una unas uno unos y ya yo años año día días hoy ayer mañana vez veces hace puede pueden van va fue tras cuáles qué cómo " +
  "dijo dice dicen así tras luego entre además ahora según cuatro tres cinco seis siete ocho nueve diez mil millones millón " +
  "video videos foto fotos últimas última último minuto vivo directo cuál quiénes cuánto cuánta hacer tener estar"
).split(/\s+/));

function headlinesFromRss(xml) {
  const titles = [];
  const re = /<item[\s>][\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/gi;
  let m;
  while ((m = re.exec(xml))) titles.push(decodeEntities(m[1]).replace(/<[^>]*>/g, "").trim());
  return titles.filter(Boolean);
}

function keywordsFromHeadlines(headlines) {
  const counts = new Map();
  const display = new Map();
  for (const h of headlines) {
    const seenInThis = new Set();
    const tokens = h.split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9-]+/);
    for (const raw of tokens) {
      const tok = raw.replace(/^-+|-+$/g, "");
      if (tok.length < 4) continue;
      const key = tok.toLowerCase();
      if (STOPWORDS.has(key) || /^\d+$/.test(key)) continue;
      if (seenInThis.has(key)) continue;
      seenInThis.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
      // Preferir la forma con mayúscula si aparece (nombres propios).
      if (!display.has(key) || /^[A-ZÁÉÍÓÚÑ]/.test(tok)) display.set(key, tok);
    }
  }
  const list = Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([key, count]) => {
      const w = display.get(key);
      return { word: w.charAt(0).toUpperCase() + w.slice(1), count };
    });
  return rankToPopularity(list);
}

async function newsWords(country) {
  const feeds = NEWS_FEEDS[country] || NEWS_FEEDS.default;
  const results = await Promise.allSettled(feeds.map((url) => fetchText(url)));
  const headlines = [];
  let ok = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") { ok++; headlines.push(...headlinesFromRss(r.value)); }
    else console.warn("[palabras] diario no disponible: " + feeds[i] + " (" + r.reason.message + ")");
  });
  if (ok === 0) throw new Error("ningún diario respondió");
  return keywordsFromHeadlines(headlines);
}

// --------------------------------------------------------------- general
const SOURCE_LABELS = {
  trends: "Trending de X",
  google: "Búsquedas de Google",
  wikipedia: "Lo más leído en Wikipedia",
  news: "Titulares de diarios",
  custom: "Mis palabras"
};

async function fetchSource(source, country) {
  if (source === "trends") {
    const r = await getTrends(country);
    if (r.source === "respaldo") throw new Error("trends24 no disponible");
    return r.trends.map((t) => ({ word: t.word, popularity: t.popularity }));
  }
  if (source === "google") return googleTrends(country);
  if (source === "wikipedia") return wikipediaMostRead(country);
  if (source === "news") return newsWords(country);
  throw new Error("fuente desconocida: " + source);
}

async function getWords(settings) {
  const source = settings.wordSource || "trends";
  const country = settings.trendsCountry || "";
  const label = SOURCE_LABELS[source] || source;

  if (source === "custom") {
    return { trends: customWords(settings.customWords), source: "propias", label, fetchedAt: Date.now() };
  }

  const key = source + ":" + country;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { trends: cached.trends, source: "ok", label, fetchedAt: cached.at };
  }
  try {
    const trends = await fetchSource(source, country);
    if (!trends || trends.length === 0) throw new Error("no se encontraron palabras");
    cache.set(key, { at: Date.now(), trends });
    console.log("[palabras] " + trends.length + " de " + label + " (" + (countryInfo(country).label) + ")");
    return { trends, source: "ok", label, fetchedAt: Date.now() };
  } catch (err) {
    console.warn("[palabras] " + label + ": " + err.message);
    if (cached) return { trends: cached.trends, source: "cache", label, fetchedAt: cached.at };
    return { trends: customWords(settings.customWords), source: "respaldo", label, fetchedAt: Date.now() };
  }
}

module.exports = { getWords, parseGoogleTrendsRss, keywordsFromHeadlines, headlinesFromRss, customWords, SOURCE_LABELS };
