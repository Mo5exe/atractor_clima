/*
 * Panel de control: tarjeta "Música".
 * Los ajustes se guardan en el servidor; el audio se escucha y analiza en la
 * ventana de salida, que manda los medidores de vuelta ("audio-levels").
 */
(function () {
  "use strict";

  const socket = window.appSocket;
  const { DEFAULT_SETTINGS } = window.EffectSchemas;
  const $ = (id) => document.getElementById(id);
  let settings = Object.assign({}, DEFAULT_SETTINGS);
  let lastLevelsAt = 0;
  let volAvg = 0; // volumen promedio (para no avisar "silencio" entre golpe y golpe)

  function set(key, value) {
    settings[key] = value;
    socket.emit("update-setting", { key, value });
  }
  function idle(el) { return document.activeElement !== el; }

  $("audioOn").addEventListener("change", (e) => set("audioEnabled", e.target.checked));
  $("audioSource").addEventListener("change", (e) => set("audioSource", e.target.value));
  $("audioDevice").addEventListener("change", (e) => set("audioDeviceId", e.target.value));
  $("audioSens").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("audioSensValue").textContent = v.toFixed(2);
    set("audioSensitivity", v);
  });
  $("beatSens").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("beatSensValue").textContent = v.toFixed(2);
    set("beatSensitivity", v);
  });
  ["audioSens", "beatSens"].forEach((id) => $(id).addEventListener("change", (e) => e.target.blur()));

  // Listar entradas de audio (micrófonos, placas, interfaces). Para ver los
  // nombres, el navegador pide permiso un instante.
  $("audioDevicesBtn").addEventListener("click", async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach((t) => t.stop());
    } catch (e) { /* sin permiso: se listan sin nombre */ }
    await fillDevices();
  });

  async function fillDevices() {
    let devices = [];
    try { devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput"); } catch (e) { /* nada */ }
    const sel = $("audioDevice");
    const current = settings.audioDeviceId || "";
    sel.innerHTML = '<option value="">Entrada predeterminada</option>';
    devices.forEach((d, i) => {
      if (d.deviceId === "default" || d.deviceId === "communications") return;
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || "Entrada " + (i + 1);
      sel.appendChild(opt);
    });
    sel.value = Array.from(sel.options).some((o) => o.value === current) ? current : "";
  }

  function updateHint() {
    const system = settings.audioSource === "system";
    $("audioDeviceRow").hidden = system;
    $("audioHint").innerHTML = system
      ? "En la ventana de salida apretá “🎵 Clic para capturar el sonido de la compu”, elegí <b>Toda la pantalla</b> y tildá <b>“Compartir audio del sistema”</b>."
      : "Micrófono de la notebook, o una entrada de línea / interfaz conectada a la consola del DJ (más preciso, no capta a la gente).";
  }

  socket.on("state", (state) => {
    settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
    $("audioOn").checked = !!settings.audioEnabled;
    if (idle($("audioSource"))) $("audioSource").value = settings.audioSource || "mic";
    if (idle($("audioSens"))) $("audioSens").value = settings.audioSensitivity;
    $("audioSensValue").textContent = Number(settings.audioSensitivity).toFixed(2);
    if (idle($("beatSens"))) $("beatSens").value = settings.beatSensitivity;
    $("beatSensValue").textContent = Number(settings.beatSensitivity).toFixed(2);
    const sel = $("audioDevice");
    if (idle(sel) && Array.from(sel.options).some((o) => o.value === (settings.audioDeviceId || ""))) sel.value = settings.audioDeviceId || "";
    updateHint();
    if (!settings.audioEnabled) showStatus("Audio apagado.", "");
  });

  function showStatus(text, kind) {
    const st = $("audioStatus");
    st.textContent = text;
    st.className = "status " + (kind || "");
  }

  socket.on("audio-levels", (l) => {
    lastLevelsAt = performance.now();
    volAvg = volAvg * 0.95 + (l.volume || 0) * 0.05;
    const pct = (v) => Math.round(Math.max(0, Math.min(1, v || 0)) * 100) + "%";
    $("mBass").style.width = pct(l.bass);
    $("mMid").style.width = pct(l.mid);
    $("mTreble").style.width = pct(l.treble);
    $("mVolume").style.width = pct(l.volume);
    $("beatDot").classList.toggle("on", (l.pulse || 0) > 0.35);
    $("bpmValue").textContent = l.bpm ? l.bpm + " BPM" : "— BPM";
    if (!settings.audioEnabled) return;
    if (l.error) showStatus(l.error, "error");
    else if (l.waitingClick) showStatus("Falta un clic: en la ventana de salida apretá el botón “🎵 Clic para…”.", "warn");
    else if (l.running) showStatus("Escuchando: " + (l.label || "audio") + (volAvg < 0.01 ? " · silencio (¿está sonando algo?)" : ""), "ok");
    else showStatus("Iniciando el audio…", "info");
  });

  // Si la salida no está abierta, avisar.
  setInterval(() => {
    if (!settings.audioEnabled) return;
    if (performance.now() - lastLevelsAt > 2000) {
      showStatus("Abrí la ventana de salida: el audio se escucha ahí.", "warn");
      ["mBass", "mMid", "mTreble", "mVolume"].forEach((id) => { $(id).style.width = "0%"; });
    }
  }, 1000);

  fillDevices();
})();
