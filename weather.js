/*
 * Clima para Atractor Clima.
 *
 * - getRealWeather(city)   -> datos actuales de Open-Meteo (gratis, sin registro)
 * - manualWeather(values)  -> el mismo formato, armado con los sliders del panel
 * - searchCity(name)       -> buscador de ciudades (geocoding de Open-Meteo)
 * - describe(weather)      -> descripción en castellano
 * - categories(weather)    -> ["lluvia", "viento", "humedo", ...] para elegir palabras
 *
 * Formato de "weather":
 * {
 *   mode: "real" | "manual", ok, city, temp, feels, humidity (%), precip (mm/h),
 *   cloud (%), wind (km/h), windDir (grados, de dónde VIENE el viento), gusts (km/h),
 *   isDay, code (WMO), desc, sunrise, sunset, dayLight (0 noche .. 1 pleno día),
 *   fetchedAt
 * }
 */
"use strict";

const UA = "Atractor-Clima/1.0 (instalación artística)";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// --------------------------------------------------------------- códigos WMO
const WMO = {
  0: "despejado", 1: "mayormente despejado", 2: "parcialmente nublado", 3: "cielo cubierto",
  45: "niebla", 48: "niebla con escarcha",
  51: "llovizna débil", 53: "llovizna", 55: "llovizna intensa",
  56: "llovizna helada", 57: "llovizna helada intensa",
  61: "lluvia débil", 63: "lluvia", 65: "lluvia fuerte",
  66: "lluvia helada", 67: "lluvia helada fuerte",
  71: "nevada débil", 73: "nevada", 75: "nevada fuerte", 77: "granizo fino",
  80: "chaparrones", 81: "chaparrones fuertes", 82: "chaparrones violentos",
  85: "chaparrones de nieve", 86: "chaparrones de nieve fuertes",
  95: "tormenta", 96: "tormenta con granizo", 99: "tormenta con granizo fuerte"
};

function describe(w) {
  return WMO[w.code] || "clima";
}

// Rosa de los vientos: de dónde viene el viento.
function windName(deg) {
  const names = ["norte", "noreste", "este", "sudeste", "sur", "sudoeste", "oeste", "noroeste"];
  return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

function dayLightFrom(now, sunrise, sunset, isDay) {
  if (!sunrise || !sunset) return isDay ? 1 : 0;
  const t = now.getTime();
  const rise = new Date(sunrise).getTime();
  const set = new Date(sunset).getTime();
  const ramp = 50 * 60 * 1000; // ~50 min de amanecer / atardecer
  if (t < rise - ramp || t > set + ramp) return 0;
  if (t < rise + ramp) return (t - (rise - ramp)) / (2 * ramp);
  if (t > set - ramp) return 1 - (t - (set - ramp)) / (2 * ramp);
  return 1;
}

// Código WMO aproximado a partir de los sliders (modo manual).
function codeFromValues(v) {
  if (v.precip >= 6 && v.wind >= 40) return 95;
  if (v.precip >= 6) return 65;
  if (v.precip >= 2) return 63;
  if (v.precip >= 0.5) return 61;
  if (v.precip > 0) return 53;
  if (v.humidity >= 97 && v.cloud >= 60) return 45;
  if (v.cloud >= 85) return 3;
  if (v.cloud >= 45) return 2;
  if (v.cloud >= 15) return 1;
  return 0;
}

function finish(w) {
  w.desc = describe(w);
  w.windName = windName(w.windDir);
  return w;
}

async function getRealWeather(city) {
  const params = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    daily: "sunrise,sunset",
    timezone: "auto",
    forecast_days: "1",
    wind_speed_unit: "kmh"
  });
  const data = await fetchJson("https://api.open-meteo.com/v1/forecast?" + params.toString());
  const c = data.current || {};
  const sunrise = data.daily && data.daily.sunrise ? data.daily.sunrise[0] : null;
  const sunset = data.daily && data.daily.sunset ? data.daily.sunset[0] : null;
  // Open-Meteo devuelve horas locales sin zona; convertirlas con el offset de la ciudad.
  const offset = data.utc_offset_seconds || 0;
  const toDate = (s) => (s ? new Date(new Date(s + "Z").getTime() - offset * 1000) : null);
  const rise = toDate(sunrise);
  const set = toDate(sunset);
  return finish({
    mode: "real",
    ok: true,
    city: city.name,
    temp: Number(c.temperature_2m),
    feels: Number(c.apparent_temperature),
    humidity: Number(c.relative_humidity_2m),
    precip: Number(c.precipitation) || 0,
    cloud: Number(c.cloud_cover) || 0,
    wind: Number(c.wind_speed_10m) || 0,
    windDir: Number(c.wind_direction_10m) || 0,
    gusts: Number(c.wind_gusts_10m) || 0,
    isDay: c.is_day === 1,
    code: Number(c.weather_code) || 0,
    sunrise: rise ? rise.toISOString() : null,
    sunset: set ? set.toISOString() : null,
    dayLight: dayLightFrom(new Date(), rise, set, c.is_day === 1),
    fetchedAt: Date.now()
  });
}

function manualWeather(v, cityName) {
  const w = {
    mode: "manual",
    ok: true,
    city: cityName || "manual",
    temp: Number(v.temp),
    feels: Number(v.temp),
    humidity: Number(v.humidity),
    precip: Number(v.precip),
    cloud: Number(v.cloud),
    wind: Number(v.wind),
    windDir: Number(v.windDir),
    gusts: Math.round(Number(v.wind) * 1.5),
    isDay: Number(v.dayLight) > 0.5,
    dayLight: Number(v.dayLight),
    sunrise: null,
    sunset: null,
    fetchedAt: Date.now()
  };
  w.code = codeFromValues(w);
  return finish(w);
}

async function searchCity(name) {
  const q = String(name || "").trim();
  if (!q) return [];
  const data = await fetchJson("https://geocoding-api.open-meteo.com/v1/search?count=8&language=es&format=json&name=" + encodeURIComponent(q));
  return (data.results || []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country || "",
    region: r.admin1 || ""
  }));
}

// --------------------------------------------------------------- categorías
function categories(w) {
  const cats = new Set();
  const code = w.code;
  if (code >= 95) cats.add("tormenta");
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) cats.add("nieve");
  else if (code >= 51 && code <= 57) cats.add("llovizna");
  else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82) || w.precip >= 0.3) cats.add("lluvia");
  if (code === 45 || code === 48) cats.add("niebla");
  if (w.temp >= 28) cats.add("calor");
  else if (w.temp <= 2) { cats.add("helada"); cats.add("frio"); }
  else if (w.temp <= 9) cats.add("frio");
  else if (w.temp >= 15 && w.temp < 28) cats.add("templado");
  else cats.add("fresco");
  if (w.wind >= 30 || w.gusts >= 45) cats.add("viento");
  if (w.humidity >= 80 && !cats.has("lluvia")) cats.add("humedo");
  if (w.cloud >= 70 && !cats.has("lluvia") && !cats.has("tormenta")) cats.add("nublado");
  if (w.cloud <= 20 && w.precip === 0) cats.add("despejado");
  cats.add(w.dayLight < 0.3 ? "noche" : "dia");
  return Array.from(cats);
}

module.exports = { getRealWeather, manualWeather, searchCity, describe, windName, categories, dayLightFrom, codeFromValues };
