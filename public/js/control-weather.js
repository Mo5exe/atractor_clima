/*
 * Panel de control: tarjeta del clima.
 *  - ciudad (buscador), clima real / manual, datos en vivo
 *  - sliders del modo manual y climas de ejemplo
 *  - color por temperatura, niebla, color de fondo, cielo según la hora
 *  - opciones de "Palabras del clima"
 */
(function () {
  "use strict";

  const socket = window.appSocket;
  const { DEFAULT_SETTINGS, DEFAULT_CLIMATE_WORDS } = window.EffectSchemas;
  const $ = (id) => document.getElementById(id);
  let settings = Object.assign({}, DEFAULT_SETTINGS);

  function set(key, value) {
    settings[key] = value;
    socket.emit("update-setting", { key, value });
  }
  function idle(el) { return document.activeElement !== el; }

  // ------------------------------------------------------------ modo
  $("modeReal").addEventListener("click", () => set("weatherMode", "real"));
  $("modeManual").addEventListener("click", () => set("weatherMode", "manual"));

  // ------------------------------------------------------------ ciudad
  $("cityChangeBtn").addEventListener("click", () => {
    $("cityForm").hidden = !$("cityForm").hidden;
    if (!$("cityForm").hidden) $("cityInput").focus();
  });
  $("cityForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("cityInput").value.trim();
    if (!q) return;
    $("cityResults").innerHTML = '<p class="muted small">Buscando…</p>';
    socket.emit("search-city", q);
  });
  socket.on("city-results", ({ results, error }) => {
    const box = $("cityResults");
    box.innerHTML = "";
    if (error || !results.length) {
      box.innerHTML = '<p class="muted small">' + (error ? "No se pudo buscar (¿sin internet?)." : "No encontré esa ciudad.") + "</p>";
      return;
    }
    results.forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "city-option";
      b.textContent = r.name + (r.region ? ", " + r.region : "") + (r.country ? " · " + r.country : "");
      b.addEventListener("click", () => {
        set("city", r);
        box.innerHTML = "";
        $("cityForm").hidden = true;
        $("cityInput").value = "";
      });
      box.appendChild(b);
    });
  });

  // ------------------------------------------------------------ manual
  const MANUAL = [
    { key: "temp", label: "Temperatura (°C)", min: -10, max: 45, step: 1 },
    { key: "humidity", label: "Humedad (%)", min: 0, max: 100, step: 1 },
    { key: "precip", label: "Lluvia (mm/h)", min: 0, max: 20, step: 0.1 },
    { key: "cloud", label: "Nubes (%)", min: 0, max: 100, step: 1 },
    { key: "wind", label: "Viento (km/h)", min: 0, max: 100, step: 1 },
    { key: "windDir", label: "Viento desde (°) 0=N 90=E 180=S", min: 0, max: 359, step: 1 },
    { key: "dayLight", label: "Luz (0 noche · 1 día)", min: 0, max: 1, step: 0.05 }
  ];
  const manualInputs = {};
  MANUAL.forEach((m) => {
    const wrap = document.createElement("div");
    wrap.className = "param-control";
    const label = document.createElement("span");
    label.className = "param-label";
    const t = document.createElement("span");
    t.textContent = m.label;
    const v = document.createElement("span");
    v.className = "param-value";
    label.append(t, v);
    const input = document.createElement("input");
    input.type = "range";
    input.min = m.min; input.max = m.max; input.step = m.step;
    input.addEventListener("input", () => {
      const value = parseFloat(input.value);
      v.textContent = value;
      set("manualWeather", { [m.key]: value });
    });
    input.addEventListener("change", () => input.blur());
    wrap.append(label, input);
    $("manualGrid").appendChild(wrap);
    manualInputs[m.key] = { input, v };
  });

  const EXAMPLES = [
    { label: "☀️ Soleado", v: { temp: 24, humidity: 40, precip: 0, cloud: 5, wind: 8, windDir: 0, dayLight: 1 } },
    { label: "🌧️ Lluvia", v: { temp: 15, humidity: 92, precip: 4, cloud: 95, wind: 18, windDir: 135, dayLight: 0.8 } },
    { label: "⛈️ Tormenta", v: { temp: 22, humidity: 95, precip: 14, cloud: 100, wind: 55, windDir: 200, dayLight: 0.5 } },
    { label: "💨 Viento", v: { temp: 12, humidity: 50, precip: 0, cloud: 40, wind: 70, windDir: 225, dayLight: 1 } },
    { label: "🥶 Frío", v: { temp: 1, humidity: 75, precip: 0, cloud: 20, wind: 12, windDir: 180, dayLight: 0.7 } },
    { label: "🥵 Calor húmedo", v: { temp: 36, humidity: 88, precip: 0, cloud: 50, wind: 5, windDir: 45, dayLight: 1 } },
    { label: "🌫️ Niebla", v: { temp: 9, humidity: 99, precip: 0, cloud: 90, wind: 2, windDir: 90, dayLight: 0.6 } },
    { label: "🌙 Noche", v: { temp: 14, humidity: 70, precip: 0, cloud: 15, wind: 6, windDir: 90, dayLight: 0 } }
  ];
  EXAMPLES.forEach((ex) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = ex.label;
    b.addEventListener("click", () => {
      if (settings.weatherMode !== "manual") set("weatherMode", "manual");
      set("manualWeather", ex.v);
    });
    $("wxPresets").appendChild(b);
  });

  // ------------------------------------------------------------ aspecto
  $("climateColorRange").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("climateColorValue").textContent = v.toFixed(2);
    set("climateColor", v);
  });
  $("fogRange").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("fogValue").textContent = v.toFixed(2);
    set("fog", v);
  });
  ["climateColorRange", "fogRange"].forEach((id) => $(id).addEventListener("change", (e) => e.target.blur()));
  $("bgColorInput").addEventListener("input", (e) => set("bgColor", e.target.value));
  $("skyChk").addEventListener("change", (e) => set("sky", e.target.checked));

  // ------------------------------------------------------------ palabras del clima
  $("climateStateChk").addEventListener("change", (e) => set("climateState", e.target.checked));
  $("climatePhrasesChk").addEventListener("change", (e) => set("climatePhrases", e.target.checked));
  $("climateVoicesChk").addEventListener("change", (e) => set("climateVoices", e.target.checked));
  let wordsDirty = false;
  $("climateWords").addEventListener("input", () => {
    wordsDirty = true;
    $("saveClimateWordsBtn").textContent = "Usar estas palabras •";
  });
  $("saveClimateWordsBtn").addEventListener("click", () => {
    set("climateWords", $("climateWords").value);
    wordsDirty = false;
    $("saveClimateWordsBtn").textContent = "Usar estas palabras";
  });
  $("resetClimateWordsBtn").addEventListener("click", () => {
    if (!confirm("¿Reemplazar tus palabras del clima por las de ejemplo?")) return;
    $("climateWords").value = DEFAULT_CLIMATE_WORDS;
    set("climateWords", DEFAULT_CLIMATE_WORDS);
    wordsDirty = false;
    $("saveClimateWordsBtn").textContent = "Usar estas palabras";
  });

  // ------------------------------------------------------------ estado → interfaz
  socket.on("state", (state) => {
    settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
    const manual = settings.weatherMode === "manual";
    $("modeReal").classList.toggle("on", !manual);
    $("modeManual").classList.toggle("on", manual);
    $("manualBox").classList.toggle("dim", !manual);
    $("cityName").textContent = settings.city ? settings.city.name + (settings.city.country ? ", " + settings.city.country : "") : "—";

    MANUAL.forEach((m) => {
      const { input, v } = manualInputs[m.key];
      const val = settings.manualWeather[m.key];
      if (idle(input)) input.value = val;
      v.textContent = val;
    });
    if (idle($("climateColorRange"))) $("climateColorRange").value = settings.climateColor;
    $("climateColorValue").textContent = Number(settings.climateColor).toFixed(2);
    if (idle($("fogRange"))) $("fogRange").value = settings.fog;
    $("fogValue").textContent = Number(settings.fog).toFixed(2);
    if (idle($("bgColorInput"))) $("bgColorInput").value = settings.bgColor || "#000000";
    $("skyChk").checked = !!settings.sky;
    $("climateStateChk").checked = settings.climateState !== false;
    $("climatePhrasesChk").checked = settings.climatePhrases !== false;
    $("climateVoicesChk").checked = !!settings.climateVoices;
    if (!wordsDirty && idle($("climateWords"))) $("climateWords").value = settings.climateWords || "";
  });

  function icon(w) {
    const night = w.dayLight < 0.3;
    if (w.code >= 95) return "⛈️";
    if ((w.code >= 71 && w.code <= 77) || w.code >= 85 && w.code <= 86) return "❄️";
    if (w.code >= 51 && w.code <= 67) return "🌧️";
    if (w.code >= 80) return "🌦️";
    if (w.code === 45 || w.code === 48) return "🌫️";
    if (w.code === 3) return "☁️";
    if (w.code === 2) return night ? "☁️" : "⛅";
    if (w.code === 1) return night ? "🌙" : "🌤️";
    return night ? "🌙" : "☀️";
  }

  socket.on("weather", (w) => {
    if (!w || !w.ok) {
      $("wxStatus").className = "status warn";
      $("wxStatus").textContent = "Buscando el clima…";
      return;
    }
    $("wxIcon").textContent = icon(w);
    $("wxTemp").textContent = Math.round(w.temp) + "°C" + (Math.abs(w.feels - w.temp) >= 2 ? "  ·  ST " + Math.round(w.feels) + "°" : "");
    $("wxDesc").textContent = w.desc;
    $("wxWind").textContent = Math.round(w.wind) + " km/h del " + w.windName;
    $("wxWindArrow").style.transform = "rotate(" + (w.windDir + 180) + "deg)";
    $("wxGusts").textContent = Math.round(w.gusts) + " km/h";
    $("wxHumidity").textContent = Math.round(w.humidity) + "%";
    $("wxRain").textContent = (w.precip || 0).toFixed(1).replace(".", ",") + " mm";
    $("wxCloud").textContent = Math.round(w.cloud) + "%";
    $("wxLight").textContent = w.dayLight <= 0.05 ? "noche" : w.dayLight >= 0.95 ? "día" : (new Date().getHours() < 12 ? "amanecer" : "atardecer");
    const st = $("wxStatus");
    if (w.mode === "manual") {
      st.className = "status info";
      st.textContent = "Modo manual: el clima lo ponés vos con los sliders.";
    } else if (w.offline) {
      st.className = "status warn";
      st.textContent = "No se pudo leer el clima real (¿sin internet?). Mientras tanto uso los valores del modo manual.";
    } else {
      const time = new Date(w.fetchedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      st.className = w.stale ? "status warn" : "status ok";
      st.textContent = "Clima real de " + w.city + " · actualizado " + time + (w.stale ? " (sin conexión, último dato)" : "") + " · se renueva cada 10 min";
    }
  });
})();
