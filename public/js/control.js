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
    $("climateBox").hidden = source !== "clima";
    $("countryRow").hidden = source === "custom" || source === "clima";
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
    } else if (info.wordSource === "clima" && info.parts) {
      const p = info.parts;
      const bits = [];
      if (p.estado) bits.push(p.estado + " del estado");
      if (p.frase) bits.push(p.frase + " frases");
      if (p.propia) bits.push(p.propia + " tuyas");
      if (p.voz) bits.push(p.voz + " voces");
      status.className = info.voicesFailed ? "status warn" : "status ok";
      status.textContent = n + " palabras del clima (" + bits.join(", ") + ")" +
        (info.categories ? " · " + info.categories.filter((c) => c !== "dia" && c !== "noche").join(", ") : "") +
        (info.voicesFailed ? " · Mastodon no respondió" : "");
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
    (info.trends || []).slice().sort((a, b) => (b.kind === "voz") - (a.kind === "voz")).slice(0, 28).forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (t.kind === "voz" ? " chip-voz" : "");
      chip.textContent = t.kind === "voz" ? "«" + t.word + "»" : t.word;
      if (t.kind === "voz") chip.title = "Voz de la gente (Mastodon)";
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
    imageWidgets.clear();
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
        if (def.type === "images") { refs.params[k].render(); return; }
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

    const TIPS = {
      trending: "Cuando la mano toca, surge una palabra ahí, se queda “Tiempo quieta”, se vuelve translúcida y sale volando (hacia donde sopla el viento, si hay). Si la mano sigue ahí, aparece otra después de la “Espera entre palabras”.",
      rain: "La cantidad de gotas sigue a la lluvia real (o a la del modo manual). Con “Influencia del clima” en 0, siempre llueve con las “Gotas sin lluvia real”.",
      clouds: "La cantidad de nubes sigue a la nubosidad y la humedad; el viento las arrastra.",
      images: "Subí PNG con fondo transparente. “Al tocar”: aparece una imagen donde toca la mano (o el clic), se queda y sale volando. “Siempre visibles”: flotan en el centro (movelo con el punto de origen), la mano las atrae y el viento las hamaca.",
      glitch: "El glitch distorsiona lo que dibujan las capas que están ARRIBA de ésta en la lista: ponela última (con ▼) para que afecte a todo. “Una parte” usa el punto de origen como centro del rectángulo. Con viento fuerte o tormenta el glitch aumenta.",
      pixels: "Los píxeles salen del Origen X/Y y se expanden por la pantalla. El viento los arrastra y la mano los atrae.",
      stripesV: "Cada raya engorda y adelgaza a su ritmo y se mueve hacia un costado u otro, cambiando de rumbo al azar. El viento las empuja; la mano las atrae y las engorda.",
      stripesH: "Cada raya engorda y adelgaza a su ritmo y se mueve hacia arriba o abajo, cambiando de rumbo al azar. El viento las empuja; la mano las atrae y las engorda."
    };
    if (TIPS[layer.type]) {
      const tip = document.createElement("p");
      tip.className = "muted small layer-tip";
      tip.textContent = TIPS[layer.type];
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

  // ------------------------------------------------------------------ imágenes
  let imageLibrary = [];
  const imageWidgets = new Set();
  socket.on("images", (list) => {
    imageLibrary = Array.isArray(list) ? list : [];
    imageWidgets.forEach((render) => render());
  });

  async function uploadFiles(files, statusEl) {
    const list = Array.from(files || []).filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp)$/i.test(f.name));
    if (list.length === 0) { statusEl.textContent = "Elegí archivos PNG, JPG, GIF o WebP."; return; }
    let ok = 0;
    for (const file of list) {
      statusEl.textContent = "Subiendo " + file.name + "…";
      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "X-Filename": encodeURIComponent(file.name), "Content-Type": file.type || "application/octet-stream" },
          body: file
        });
        const data = await res.json();
        if (data.ok) ok++;
        else statusEl.textContent = file.name + ": " + data.error;
      } catch (err) {
        statusEl.textContent = "No se pudo subir " + file.name + ".";
      }
    }
    if (ok) statusEl.textContent = ok === 1 ? "Imagen subida." : ok + " imágenes subidas.";
  }

  function buildImagesControl(layer, def, refs) {
    const wrap = document.createElement("div");
    wrap.className = "param-control param-images";

    const head = document.createElement("div");
    head.className = "images-head";
    const title = document.createElement("span");
    title.textContent = def.label;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/webp,image/gif,image/jpeg";
    fileInput.multiple = true;
    fileInput.hidden = true;
    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "primary";
    uploadBtn.textContent = "+ Subir imágenes";
    uploadBtn.addEventListener("click", () => fileInput.click());
    head.append(title, uploadBtn, fileInput);

    const note = document.createElement("p");
    note.className = "muted small";
    const grid = document.createElement("div");
    grid.className = "images-grid";
    const status = document.createElement("p");
    status.className = "muted small";

    fileInput.addEventListener("change", async () => {
      await uploadFiles(fileInput.files, status);
      fileInput.value = "";
    });
    // Arrastrar y soltar archivos sobre la grilla.
    ["dragenter", "dragover"].forEach((ev) => grid.addEventListener(ev, (e) => { e.preventDefault(); grid.classList.add("drop"); }));
    ["dragleave", "drop"].forEach((ev) => grid.addEventListener(ev, () => grid.classList.remove("drop")));
    grid.addEventListener("drop", (e) => { e.preventDefault(); uploadFiles(e.dataTransfer.files, status); });

    function selected() {
      const l = currentState.layers.find((x) => x.id === layer.id);
      return l && Array.isArray(l.params.images) ? l.params.images : [];
    }
    function render() {
      if (!document.body.contains(wrap) && wrap.isConnected === false && grid.childElementCount) { imageWidgets.delete(render); return; }
      const sel = selected();
      grid.innerHTML = "";
      if (imageLibrary.length === 0) {
        grid.innerHTML = '<p class="muted small">Todavía no hay imágenes. Subí PNG con fondo transparente (o arrastralas acá).</p>';
      }
      imageLibrary.forEach((im) => {
        const item = document.createElement("div");
        const on = sel.includes(im.id);
        item.className = "image-item" + (on ? " on" : "") + (sel.length === 0 ? " all" : "");
        item.title = im.name + (on ? " (elegida)" : "");
        const img = document.createElement("img");
        img.src = im.url;
        img.alt = im.name;
        img.loading = "lazy";
        const del = document.createElement("button");
        del.type = "button";
        del.className = "image-del";
        del.textContent = "✕";
        del.title = "Borrar esta imagen de la biblioteca";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("¿Borrar “" + im.name + "” de la biblioteca? (se saca de todas las capas)")) socket.emit("delete-image", im.id);
        });
        item.append(img, del);
        item.addEventListener("click", () => {
          const cur = selected();
          const next = cur.includes(im.id) ? cur.filter((x) => x !== im.id) : cur.concat(im.id);
          socket.emit("update-param", { id: layer.id, key: def.key, value: next });
        });
        grid.appendChild(item);
      });
      note.textContent = imageLibrary.length === 0 ? "" :
        sel.length === 0 ? "Usa todas las imágenes. Tocá una para elegir sólo algunas." :
        "Usa " + sel.length + " de " + imageLibrary.length + ". Tocá para sumar o sacar.";
    }
    imageWidgets.add(render);
    render();
    wrap.append(head, note, grid, status);
    refs.params[def.key] = { input: fileInput, valueSpan: null, def, render };
    return wrap;
  }

  function buildParamControl(layer, def, refs) {
    if (def.type === "images") return buildImagesControl(layer, def, refs);
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
    const input = document.createElement(def.type === "select" ? "select" : "input");

    if (def.type === "select") {
      (def.options || []).forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label;
        input.appendChild(opt);
      });
      input.value = currentValue;
      input.addEventListener("change", () => {
        socket.emit("update-param", { id: layer.id, key: def.key, value: input.value });
        input.blur();
      });
    } else if (def.type === "range") {
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
