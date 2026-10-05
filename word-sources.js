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
const { COUNTRIES, NEWS_SOURCES } = require("./public/js/schemas.js");

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
// Los diarios están en public/js/schemas.js (NEWS_SOURCES), para que el panel los muestre.

const STOPWORDS_ES = new Set((
  "a al algo algún alguna algunas alguno algunos ante antes aquel aquella aquellas aquellos aquí así aún aunque bajo bien cada casi " +
  "como cómo con contra cual cuál cuales cuando cuándo cuanto de del desde donde dónde dos durante e el él ella ellas ellos en entre " +
  "era eran es esa esas ese eso esos esta está están estas este esto estos fue fueron ha había han hasta hay la las le les lo los " +
  "más mas me mi mientras muy nada ni no nos nosotros nueva nuevo nuevos nuevas o otra otras otro otros para pero poco por porque qué que " +
  "quien quién quienes se sea según ser será si sí sido sin sobre son su sus también tan tanto te tiene tienen todo todos todas tras " +
  "tu tus un una unas uno unos y ya yo años año día días hoy ayer mañana vez veces hace puede pueden van va fue tras cuáles qué cómo " +
  "dijo dice dicen así tras luego entre además ahora según cuatro tres cinco seis siete ocho nueve diez mil millones millón " +
  "video videos foto fotos últimas última último minuto vivo directo cuál quiénes cuánto cuánta hacer tener estar"
).split(/\s+/));

const STOPWORDS_EN = new Set((
  "the a an and or but of to in on at for with from by as is are was were be been being has have had do does did " +
  "this that these those it its it's he she they them his her their we our you your i me my not no yes will would " +
  "can could should may might must shall than then there here what when where which who whom whose why how all any " +
  "some more most other such only own same so too very just also into over after before about against between " +
  "through during under again further once out up down off new says said say amid over year years day days week " +
  "weeks first last after video watch live latest update updates news report reports explained analysis how why " +
  "inside turns opens makes make takes take gets get finds find look looks behind meet meets back best top"
).split(/\s+/));

const STOPWORDS_DE = new Set((
  "der die das den dem des ein eine einer eines einem einen und oder aber nicht kein keine ist sind war waren wird " +
  "werden wurde wurden hat haben hatte hatten sein seine ihr ihre wir sie ich du er es man mit von zu zum zur bei " +
  "nach vor aus auf für über unter durch gegen ohne um an im in am als wie was wer wo wann warum auch noch nur schon " +
  "sehr mehr neue neuer neues neuen jahr jahre tag tage heute gestern morgen dass denn doch wenn weil soll sollen " +
  "kann können muss müssen will wollen video live news ticker"
).split(/\s+/));

const STOPWORDS_FR = new Set((
  "le la les un une des du de d l et ou mais pas ne ni est sont était étaient sera être a ont avait avoir ce cet " +
  "cette ces il elle ils elles on nous vous je tu son sa ses leur leurs dans en sur sous pour par avec sans chez " +
  "entre vers après avant contre plus moins très aussi encore déjà comme que qui quoi dont où quand pourquoi comment " +
  "tout tous toute toutes nouveau nouvelle nouveaux an ans jour jours fait faire selon direct vidéo"
).split(/\s+/));

// En las revistas de arte estas palabras aparecen en casi todo: no aportan.
const ART_STOPWORDS = new Set(("art arts artist artists artwork artworks exhibition exhibitions show shows museum museums gallery galleries " +
  "work works new open opens opening review reviews interview design designs designer designers project projects studio " +
  "arte artista artistas obra obras muestra muestras exposición exposiciones museo museos galería galerías").split(/\s+/));

const STOPWORDS = { es: STOPWORDS_ES, en: STOPWORDS_EN, de: STOPWORDS_DE, fr: STOPWORDS_FR, pt: STOPWORDS_ES };

function headlinesFromRss(xml) {
  const titles = [];
  const re = /<item[\s>][\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/gi;
  let m;
  while ((m = re.exec(xml))) titles.push(decodeEntities(m[1]).replace(/<[^>]*>/g, "").trim());
  return titles.filter(Boolean);
}

function keywordsFromHeadlines(headlines, lang, art) {
  const stop = STOPWORDS[lang] || STOPWORDS_ES;
  const counts = new Map();
  const display = new Map();
  const isCap = (t) => /^\p{Lu}/u.test(t);
  const isStop = (k) => stop.has(k) || (art && ART_STOPWORDS.has(k));
  for (const h of headlines) {
    const seenInThis = new Set();
    const tokens = h.split(/[^\p{L}\p{N}'’-]+/u)
      .map((t) => t.replace(/['’]s$/i, "").replace(/['’]/g, "").replace(/^-+|-+$/g, ""))
      .filter(Boolean);
    const add = (key, shown) => {
      if (seenInThis.has(key)) return;
      seenInThis.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
      // Preferir la forma con mayúscula si aparece (nombres propios).
      if (!display.has(key) || isCap(shown)) display.set(key, shown);
    };
    // Nombres de 2-3 palabras con mayúscula ("Refik Anadol", "Ars Electronica"),
    // salvo en titulares escritos Todo Con Mayúscula, donde no se distinguen.
    const rest = tokens.slice(1);
    const capRatio = rest.length ? rest.filter(isCap).length / rest.length : 0;
    const used = new Set();
    if (capRatio < 0.7) {
      for (let i = 0; i < tokens.length; i++) {
        if (!isCap(tokens[i]) || (isStop(tokens[i].toLowerCase()) && !(i + 1 < tokens.length && isCap(tokens[i + 1])))) continue;
        // La primera palabra del titular sólo cuenta si la sigue otra con mayúscula.
        if (i === 0 && !(tokens.length > 1 && isCap(tokens[1]))) continue;
        let j = i;
        while (j + 1 < tokens.length && j - i < 2 && isCap(tokens[j + 1]) && !isStop(tokens[j + 1].toLowerCase())) j++;
        // Sacar palabras comunes del principio o del final ("La Bienal" → "Bienal").
        let a = i, b = j;
        while (a < b && isStop(tokens[a].toLowerCase())) a++;
        while (b > a && isStop(tokens[b].toLowerCase())) b--;
        if (b > a) {
          const phrase = tokens.slice(a, b + 1).join(" ");
          add(phrase.toLowerCase(), phrase);
          for (let k = a; k <= b; k++) used.add(k);
        }
        i = j;
      }
    }
    tokens.forEach((tok, idx) => {
      if (used.has(idx) || tok.length < 4) return;
      const key = tok.toLowerCase();
      if (isStop(key) || /^\d+$/.test(key)) return;
      add(key, tok);
    });
  }
  // En fuentes chicas (como las revistas de arte) casi nada se repite: si con
  // "al menos 2 veces" quedan pocas, se suman las que aparecen una vez,
  // primero las que empiezan con mayúscula (nombres de artistas, obras, lugares).
  let entries = Array.from(counts.entries()).filter(([, c]) => c >= 2);
  if (entries.length < 15) {
    const singles = Array.from(counts.entries()).filter(([, c]) => c === 1)
      .sort((a, b) => (/^\p{Lu}/u.test(display.get(b[0])) ? 1 : 0) - (/^\p{Lu}/u.test(display.get(a[0])) ? 1 : 0));
    entries = entries.concat(singles.slice(0, 30 - entries.length));
  }
  const list = entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([key, count]) => {
      const w = display.get(key);
      return { word: w.charAt(0).toUpperCase() + w.slice(1), count };
    });
  return rankToPopularity(list);
}

async function newsWords(newsSource) {
  const src = NEWS_SOURCES.find((n) => n.id === newsSource) || NEWS_SOURCES[0];
  const feeds = src.feeds;
  const results = await Promise.allSettled(feeds.map((url) => fetchText(url)));
  const headlines = [];
  let ok = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") { ok++; headlines.push(...headlinesFromRss(r.value)); }
    else console.warn("[palabras] diario no disponible: " + feeds[i] + " (" + r.reason.message + ")");
  });
  if (ok === 0) throw new Error("ningún diario respondió");
  return keywordsFromHeadlines(headlines, src.lang, !!src.art);
}

// --------------------------------------------------------------- general
const SOURCE_LABELS = {
  trends: "Trending de X",
  google: "Búsquedas de Google",
  wikipedia: "Lo más leído en Wikipedia",
  news: "Titulares de diarios",
  custom: "Mis palabras"
};

async function fetchSource(source, country, newsSource) {
  if (source === "trends") {
    const r = await getTrends(country);
    if (r.source === "respaldo") throw new Error("trends24 no disponible");
    return r.trends.map((t) => ({ word: t.word, popularity: t.popularity }));
  }
  if (source === "google") return googleTrends(country);
  if (source === "wikipedia") return wikipediaMostRead(country);
  if (source === "news") return newsWords(newsSource);
  throw new Error("fuente desconocida: " + source);
}

async function getWords(settings) {
  const source = settings.wordSource || "trends";
  const country = settings.trendsCountry || "";
  const label = SOURCE_LABELS[source] || source;

  if (source === "custom") {
    return { trends: customWords(settings.customWords), source: "propias", label, fetchedAt: Date.now() };
  }

  const newsSource = settings.newsSource || "ar";
  const key = source + ":" + (source === "news" ? newsSource : country);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { trends: cached.trends, source: "ok", label, fetchedAt: cached.at };
  }
  try {
    const trends = await fetchSource(source, country, newsSource);
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
