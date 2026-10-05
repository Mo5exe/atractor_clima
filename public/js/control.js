/*
 * Panel de control (index.html).
 * El servidor es la única fuente de verdad: este script manda cambios por
 * socket y redibuja lo que recibe de vuelta.
 *
 * La cámara vive en control-camera.js (módulo aparte) y usa el mismo socket
 * a través de window.appSocket.
 */
(function () {
  "use strict";

  const { SCHEMAS, NAMES, COUNTRIES, WORD_SOURCES, DEFAULT_CUSTOM_WORDS } = window.EffectSchemas;
  const socket = io();
  window.appSocket = socket;
  window.appSettings = {};

  const $ = (id) => document.getElementById(id);

  let currentState = { layers: [], settings: {} };
  let structureKey = "";
  // Inputs de cada capa para poder actualizarlos sin reconstruir todo
  // (así un slider no se "suelta" mientras lo arrastrás).
  let layerInputs = new Map(); // layerId -> { params: {key: {input, valueSpan, def}}, dot, rotateValue }
  let activePresetId = null;

  // ------------------------------------------------------------------ toolbar
  Object.keys(SCHEMAS).forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = NAMES[type];
    $("effectType").appendChild(opt);
  });

  $("addLayerBtn").addEventListener("click", () => socket.emit("add-layer", $("effectType").value));
  $("clearBtn").addEventListener("click", () => {
    if (currentState.layers.length === 0) return;
    if (confirm("¿Eliminar todas las capas?")) socket.emit("clear-layers");
  });
  $("openOutputBtn").addEventListener("click", () => window.open("/output.html", "atractor-salida"));
  $("openOutputCamBtn").addEventListener("click", () => {
    // Si la cámara del panel está prendida, la apago para que no haya dos manos repetidas.
    if (window.stopPanelCamera) window.stopPanelCamera();
    const point = $("pointSelect").value === "index" ? "&punto=indice" : "";
    window.open("/output.html?camara=1" + point, "atractor-salida");
  });

  socket.on("error-message", (msg) => alert(msg));

  // ------------------------------------------------------------------ ajustes
  COUNTRIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    $("countrySelect").appendChild(opt);
  });

  function setSetting(key, value) {
    window.appSettings[key] = value;
    socket.emit("update-setting", { key, value });
  }

  $("strengthRange").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("strengthValue").textContent = v.toFixed(2);
    setSetting("attractorStrength", v);
  });
  $("radiusRange").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("radiusValue").textContent = v;
    setSetting("attractorRadius", v);
  });
  $("cursorChk").addEventListener("change", (e) => setSetting("showCursor", e.target.checked));
  $("mirrorChk").addEventListener("change", (e) => setSetting("mirror", e.target.checked));
  $("countrySelect").addEventListener("change", (e) => setSetting("trendsCountry", e.target.value));
  $("refreshTrendsBtn").addEventListener("click", () => socket.emit("refresh-trends"));

  WORD_SOURCES.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    $("sourceSelect").appendChild(opt);
  });
  $("sourceSelect").addEventListener("change", (e) => {
    setSetting("wordSource", e.target.value);
    updateSourceUi(e.target.value);
  });
  let customDirty = false;
  $("customWords").addEventListener("input", () => {
    customDirty = true;
    $("saveWordsBtn").textContent = "Usar estas palabras •";
  });
  $("saveWordsBtn").addEventListener("click", () => {
    setSetting("customWords", $("customWords").value);
    customDirty = false;
    $("saveWordsBtn").textContent = "Usar estas palabras";
  });
  $("resetWordsBtn").addEventListener("click", () => {
    if (!confirm("¿Reemplazar tu lista por la lista de ejemplo?")) return;
    $("customWords").value = DEFAULT_CUSTOM_WORDS;
    setSetting("customWords", DEFAULT_CUSTOM_WORDS);
    customDirty = false;
    $("saveWordsBtn").textContent = "Usar estas palabras";
  });

  function updateSourceUi(source) {
    const info = WORD_SOURCES.find((s) => s.id === source) || WORD_SOURCES[0];
    $("sourceHint").textContent = info.hint;
    $("customBox").hidden = source !== "custom";
    $("countryRow").hidden = source === "custom";
  }

  function setIfIdle(el, prop, value) {
    if (document.activeElement === el) return;
    el[prop] = value;
  }

  function renderSettings(s) {
    window.appSettings = Object.assign({}, s);
    setIfIdle($("strengthRange"), "value", s.attractorStrength);
    $("strengthValue").textContent = Number(s.attractorStrength).toFixed(2);
    setIfIdle($("radiusRange"), "value", s.attractorRadius);
    $("radiusValue").textContent = s.attractorRadius;
    $("cursorChk").checked = !!s.showCursor;
    $("mirrorChk").checked = !!s.mirror;
    setIfIdle($("countrySelect"), "value", s.trendsCountry);
    setIfIdle($("sourceSelect"), "value", s.wordSource);
    updateSourceUi(s.wordSource);
    // No pisar lo que la persona está escribiendo.
    if (!customDirty && document.activeElement !== $("customWords")) $("customWords").value = s.customWords || "";
  }

  // ------------------------------------------------------------------ trends
  socket.on("trends", (info) => {
    const status = $("trendsStatus");
    const list = $("trendsList");
    const country = (COUNTRIES.find((c) => c.id === info.country) || {}).label || "—";
    const label = info.label || "Palabras";
    const n = (info.trends || []).length;
    if (info.source === "cargando") {
      status.className = "status info";
      status.textContent = "Buscando " + label.toLowerCase() + " (" + country + ")…";
    } else if (info.source === "respaldo") {
      status.className = "status warn";
      status.textContent = "No se pudo leer " + label + " (¿sin internet?). Mientras tanto uso tu lista propia.";
    } else if (info.source === "propias") {
      status.className = n ? "status ok" : "status warn";
      status.textContent = n ? n + " palabras de tu lista." : "Tu lista está vacía: escribí algunas palabras.";
    } else {
      const time = info.fetchedAt ? new Date(info.fetchedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";
      status.className = "status ok";
      status.textContent = n + " palabras · " + label + " · " + country + (time ? " · " + time : "") +
        (info.source === "cache" ? " (guardadas)" : "");
    }
    list.innerHTML = "";
    (info.trends || []).slice(0, 20).forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = t.word;
      chip.style.fontSize = (11 + t.popularity * 6).toFixed(1) + "px";
      chip.style.opacity = (0.55 + t.popularity * 0.45).toFixed(2);
      list.appendChild(chip);
    });
  });

  // ------------------------------------------------------------------ presets
  $("presetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("presetName").value.trim();
    if (!name) { $("presetName").focus(); return; }
    if (currentState.layers.length === 0 && !confirm("No hay capas. ¿Guardar igual?")) return;
    socket.emit("save-preset", name);
    $("presetName").value = "";
  });

  socket.on("preset-loaded", (id) => {
    activePresetId = id;
    highlightPreset();
  });

  function highlightPreset() {
    document.querySelectorAll(".preset-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === activePresetId);
    });
  }

  socket.on("presets", (presets) => {
    const list = $("presetsList");
    list.innerHTML = "";
    if (presets.length === 0) {
      const p = document.createElement("p");
      p.className = "muted small";
      p.textContent = "Todavía no guardaste ningún preset.";
      list.appendChild(p);
      return;
    }
    presets.slice().reverse().forEach((preset) => {
      const item = document.createElement("div");
      item.className = "preset-item";
      item.dataset.id = preset.id;
      item.title = "Cargar este preset";

      const info = document.createElement("div");
      info.className = "preset-info";
      const name = document.createElement("div");
      name.className = "preset-name";
      name.textContent = preset.name;
      const meta = document.createElement("div");
      meta.className = "preset-meta";
      meta.textContent = preset.layerCount + (preset.layerCount === 1 ? " capa" : " capas") +
        (preset.types.length ? " · " + Array.from(new Set(preset.types)).join(", ") : "");
      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "preset-actions";
      const renameBtn = document.createElement("button");
      renameBtn.textContent = "✎";
      renameBtn.title = "Renombrar";
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const n = prompt("Nuevo nombre:", preset.name);
        if (n && n.trim()) socket.emit("rename-preset", { id: preset.id, name: n.trim() });
      });
      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.className = "remove-btn";
      delBtn.title = "Borrar preset";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("¿Borrar el preset “" + preset.name + "”?")) socket.emit("delete-preset", preset.id);
      });
      actions.append(renameBtn, delBtn);

      item.append(info, actions);
      item.addEventListener("click", () => {
        if (currentState.layers.length > 0 && activePresetId !== preset.id &&
            !confirm("Cargar “" + preset.name + "” reemplaza las capas actuales. ¿Seguir?")) return;
        socket.emit("load-preset", preset.id);
      });
      list.appendChild(item);
    });
    highlightPreset();
  });

  // ------------------------------------------------------------------ capas
  socket.on("state", (state) => {
    currentState = state;
    renderSettings(state.settings || {});
    const key = state.layers.map((l) => l.id + ":" + l.type + ":" + l.enabled).join("|");
    if (key !== structureKey) {
      structureKey = key;
      renderLayers();
    } else {
      updateLayerValues();
    }
  });

  function renderLayers() {
    const container = $("layersContainer");
    container.innerHTML = "";
    layerInputs = new Map();
    if (currentState.layers.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = 'No hay capas todavía. Elegí un efecto arriba y presioná "+ Añadir capa".';
      container.appendChild(p);
      return;
    }
    currentState.layers.forEach((layer, index) => container.appendChild(buildLayerCard(layer, index)));
  }

  function updateLayerValues() {
    currentState.layers.forEach((layer) => {
      const refs = layerInputs.get(layer.id);
      if (!refs) return;
      Object.keys(refs.params).forEach((k) => {
        const { input, valueSpan, def } = refs.params[k];
        const v = layer.params[k];
        if (document.activeElement === input) return;
        if (def.type === "checkbox") input.checked = !!v;
        else input.value = v;
        if (valueSpan) valueSpan.textContent = formatValue(v);
      });
      const t = layer.transform || { originX: 50, originY: 50, rotation: 0 };
      if (!refs.dragging) setDotPosition(refs.dot, t.originX, t.originY);
      refs.rotateValue.textContent = "Rotación: " + t.rotation + "°";
    });
  }

  function buildLayerCard(layer, index) {
    const schema = SCHEMAS[layer.type] || [];
    const refs = { params: {}, dot: null, rotateValue: null, dragging: false };
    layerInputs.set(layer.id, refs);

    const card = document.createElement("div");
    card.className = "layer-card" + (layer.enabled ? "" : " disabled");

    const header = document.createElement("div");
    header.className = "layer-header";
    const title = document.createElement("span");
    title.className = "layer-title";
    title.textContent = (index + 1) + ". " + layer.name;

    const controls = document.createElement("div");
    controls.className = "layer-controls";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = layer.enabled;
    toggle.title = "Activar / desactivar capa";
    toggle.addEventListener("change", () => socket.emit("toggle-layer", layer.id));
    const upBtn = document.createElement("button");
    upBtn.textContent = "▲";
    upBtn.title = "Subir capa";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => socket.emit("reorder-layer", { id: layer.id, direction: "up" }));
    const downBtn = document.createElement("button");
    downBtn.textContent = "▼";
    downBtn.title = "Bajar capa";
    downBtn.disabled = index === currentState.layers.length - 1;
    downBtn.addEventListener("click", () => socket.emit("reorder-layer", { id: layer.id, direction: "down" }));
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.className = "remove-btn";
    removeBtn.title = "Eliminar capa";
    removeBtn.addEventListener("click", () => socket.emit("remove-layer", layer.id));
    controls.append(toggle, upBtn, downBtn, removeBtn);
    header.append(title, controls);
    card.appendChild(header);

    if (layer.type === "trending") {
      const tip = document.createElement("p");
      tip.className = "muted small layer-tip";
      tip.textContent = "Cuando la mano toca, surge una palabra ahí, se queda “Tiempo quieta”, y sale volando hacia un lado al azar. Si la mano sigue ahí, aparece otra después de la “Espera entre palabras”.";
      card.appendChild(tip);
    }

    card.appendChild(buildTransformControl(layer, refs));

    const grid = document.createElement("div");
    grid.className = "params-grid";
    schema.forEach((def) => grid.appendChild(buildParamControl(layer, def, refs)));
    card.appendChild(grid);
    return card;
  }

  function buildTransformControl(layer, refs) {
    const transform = layer.transform || { originX: 50, originY: 50, rotation: 0 };
    const wrap = document.createElement("div");
    wrap.className = "transform-control";
    const label = document.createElement("div");
    label.className = "transform-label";
    label.textContent = "Origen del efecto (arrastrá el punto)";
    const picker = document.createElement("div");
    picker.className = "origin-picker";
    const dot = document.createElement("div");
    dot.className = "origin-dot";
    setDotPosition(dot, transform.originX, transform.originY);
    picker.appendChild(dot);
    refs.dot = dot;

    function handlePointer(evt) {
      const rect = picker.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((evt.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((evt.clientY - rect.top) / rect.height) * 100));
      setDotPosition(dot, x, y);
      socket.emit("update-origin", { id: layer.id, x, y });
    }
    picker.addEventListener("pointerdown", (evt) => {
      refs.dragging = true;
      picker.setPointerCapture(evt.pointerId);
      handlePointer(evt);
    });
    picker.addEventListener("pointermove", (evt) => { if (refs.dragging) handlePointer(evt); });
    picker.addEventListener("pointerup", (evt) => {
      refs.dragging = false;
      picker.releasePointerCapture(evt.pointerId);
    });
    picker.addEventListener("pointercancel", () => { refs.dragging = false; });
    picker.addEventListener("dblclick", () => {
      setDotPosition(dot, 50, 50);
      socket.emit("update-origin", { id: layer.id, x: 50, y: 50 });
    });

    const rotateRow = document.createElement("div");
    rotateRow.className = "rotate-row";
    const rotateBtn = document.createElement("button");
    rotateBtn.type = "button";
    rotateBtn.textContent = "⟳ Rotar 45°";
    rotateBtn.addEventListener("click", () => socket.emit("rotate-layer", layer.id));
    const rotateValue = document.createElement("span");
    rotateValue.className = "rotate-value";
    rotateValue.textContent = "Rotación: " + transform.rotation + "°";
    refs.rotateValue = rotateValue;
    rotateRow.append(rotateBtn, rotateValue);

    wrap.append(label, picker, rotateRow);
    return wrap;
  }

  function setDotPosition(dot, x, y) {
    dot.style.left = x + "%";
    dot.style.top = y + "%";
  }

  function buildParamControl(layer, def, refs) {
    const wrap = document.createElement("div");
    wrap.className = "param-control";
    const labelRow = document.createElement("span");
    labelRow.className = "param-label";
    const labelText = document.createElement("span");
    labelText.textContent = def.label;
    const valueSpan = document.createElement("span");
    valueSpan.className = "param-value";
    labelRow.append(labelText, valueSpan);
    wrap.appendChild(labelRow);

    const currentValue = layer.params[def.key];
    const input = document.createElement("input");

    if (def.type === "range") {
      input.type = "range";
      input.min = def.min;
      input.max = def.max;
      input.step = def.step;
      input.value = currentValue;
      valueSpan.textContent = formatValue(currentValue);
      input.addEventListener("input", () => {
        const value = parseFloat(input.value);
        valueSpan.textContent = formatValue(value);
        socket.emit("update-param", { id: layer.id, key: def.key, value });
      });
      // Al soltar, quitar el foco para que siga sincronizándose desde el servidor.
      input.addEventListener("change", () => input.blur());
    } else if (def.type === "color") {
      input.type = "color";
      input.value = currentValue;
      input.addEventListener("input", () => socket.emit("update-param", { id: layer.id, key: def.key, value: input.value }));
    } else if (def.type === "checkbox") {
      input.type = "checkbox";
      input.checked = !!currentValue;
      wrap.classList.add("param-check");
      input.addEventListener("change", () => socket.emit("update-param", { id: layer.id, key: def.key, value: input.checked }));
    }

    wrap.appendChild(input);
    refs.params[def.key] = { input, valueSpan: def.type === "range" ? valueSpan : null, def };
    return wrap;
  }

  function formatValue(v) {
    return Math.round(v * 1000) / 1000;
  }

  // Mostrar en vivo dónde está la mano (lo actualiza control-camera.js).
  window.showHandLive = function (hands) {
    const el = $("handLive");
    if (!hands || hands.length === 0) {
      el.className = "status";
      el.textContent = "Mano: no detectada";
    } else {
      el.className = "status ok";
      el.textContent = "Mano" + (hands.length > 1 ? "s" : "") + ": " +
        hands.map((h) => Math.round(h.x * 100) + "%, " + Math.round(h.y * 100) + "%").join("  ·  ");
    }
  };

  renderLayers();
})();
