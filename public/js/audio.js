/*
 * Audio reactivo (ventana de salida).
 *
 * Escucha una entrada de audio y calcula en cada cuadro:
 *   bass, mid, treble, volume  -> 0..1 (con ganancia automática)
 *   beat                       -> true en el cuadro en que hay un golpe (bombo)
 *   pulse                      -> 1 al golpe y se apaga en ~0,3 s
 *   bpm                        -> tempo aproximado
 *
 * Fuentes:
 *   "mic"    -> micrófono o entrada de audio (placa / interfaz / consola)
 *   "system" -> el sonido de la compu (Chrome: compartir pantalla + "compartir audio")
 *
 * El navegador sólo deja arrancar el audio después de un clic en la página,
 * por eso la salida muestra un botón "activar audio" la primera vez.
 */
(function () {
  "use strict";

  const state = {
    ctx: null, analyser: null, stream: null, source: null,
    freq: null, time: null,
    running: false, wanting: null, error: null, label: "",
    peaks: { bass: 0.05, mid: 0.05, treble: 0.05, volume: 0.02 },
    smooth: { bass: 0, mid: 0, treble: 0, volume: 0 },
    bassAvg: 0, lastBeat: 0, intervals: [], pulse: 0, bpm: 0
  };

  function bandEnergy(freq, sampleRate, lo, hi) {
    const binHz = sampleRate / 2 / freq.length;
    const a = Math.max(0, Math.floor(lo / binHz));
    const b = Math.min(freq.length - 1, Math.ceil(hi / binHz));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += freq[i];
    return sum / ((b - a + 1) * 255);
  }

  async function start(cfg) {
    stop();
    state.wanting = cfg;
    state.error = null;
    try {
      let stream;
      if (cfg.source === "system") {
        // Capturar el sonido de la compu: Chrome pide elegir pantalla/pestaña y "compartir audio".
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        stream.getVideoTracks().forEach((t) => t.stop()); // sólo queremos el audio
        if (stream.getAudioTracks().length === 0) throw new Error("no-audio-track");
        state.label = "sonido de la compu";
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: Object.assign(
            { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            cfg.deviceId ? { deviceId: { exact: cfg.deviceId } } : {}
          ),
          video: false
        });
        const track = stream.getAudioTracks()[0];
        state.label = (track && track.label) || "micrófono";
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      state.ctx = new AC();
      if (state.ctx.state === "suspended") await state.ctx.resume();
      state.analyser = state.ctx.createAnalyser();
      state.analyser.fftSize = 2048;
      state.analyser.smoothingTimeConstant = 0.55;
      state.source = state.ctx.createMediaStreamSource(stream);
      state.source.connect(state.analyser); // no se conecta a los parlantes: sólo se analiza
      state.freq = new Uint8Array(state.analyser.frequencyBinCount);
      state.time = new Uint8Array(state.analyser.fftSize);
      state.stream = stream;
      state.running = true;
      stream.getAudioTracks().forEach((t) => t.addEventListener("ended", () => { state.running = false; state.error = "La captura de audio se cortó."; }));
      return true;
    } catch (err) {
      console.error("Audio:", err);
      const name = err && err.name;
      state.error = name === "NotAllowedError" ? "Permiso de audio denegado (o se canceló la elección)."
        : err && err.message === "no-audio-track" ? "No se compartió el audio: al elegir la pantalla, tildá “Compartir audio del sistema”."
        : name === "NotFoundError" || name === "OverconstrainedError" ? "No se encontró esa entrada de audio."
        : "No se pudo abrir el audio.";
      state.running = false;
      return false;
    }
  }

  function stop() {
    state.running = false;
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    if (state.ctx) state.ctx.close().catch(() => {});
    state.stream = null; state.ctx = null; state.analyser = null; state.source = null;
  }

  // Llamar una vez por cuadro. sensitivity: 0.2..5 · beatSensitivity: 0..1
  function features(dt, sensitivity, beatSensitivity) {
    if (!state.running || !state.analyser) return null;
    if (state.ctx.state === "suspended") return null;
    const a = state.analyser;
    a.getByteFrequencyData(state.freq);
    a.getByteTimeDomainData(state.time);
    const sr = state.ctx.sampleRate;
    const raw = {
      bass: bandEnergy(state.freq, sr, 30, 150),
      mid: bandEnergy(state.freq, sr, 250, 2000),
      treble: bandEnergy(state.freq, sr, 4000, 12000)
    };
    let sum = 0;
    for (let i = 0; i < state.time.length; i++) { const v = (state.time[i] - 128) / 128; sum += v * v; }
    raw.volume = Math.sqrt(sum / state.time.length);

    // Ganancia automática: cada banda se compara con su propio pico reciente,
    // así funciona igual con música baja o muy fuerte.
    const out = {};
    for (const k of ["bass", "mid", "treble", "volume"]) {
      state.peaks[k] = Math.max(raw[k], state.peaks[k] * Math.pow(0.5, dt / 4)); // el pico baja a la mitad en 4 s
      const floor = k === "volume" ? 0.01 : 0.03;
      let v = raw[k] / Math.max(floor, state.peaks[k]);
      v = Math.max(0, Math.min(1, Math.pow(v, 1.6) * sensitivity));
      // Sube rápido, baja más lento.
      const s = state.smooth[k];
      state.smooth[k] = v > s ? s + (v - s) * Math.min(1, dt * 30) : s + (v - s) * Math.min(1, dt * 6);
      out[k] = state.smooth[k];
    }
    // Silencio: todo a cero.
    if (raw.volume < 0.004) { out.bass = out.mid = out.treble = out.volume = 0; }

    // Beat: el grave sube de golpe por encima de su promedio.
    const now = performance.now() / 1000;
    state.bassAvg = state.bassAvg * Math.pow(0.5, dt / 0.4) + raw.bass * (1 - Math.pow(0.5, dt / 0.4));
    const threshold = 1.15 + (1 - beatSensitivity) * 0.6;
    let beat = false;
    if (raw.bass > state.bassAvg * threshold && raw.bass > 0.12 && now - state.lastBeat > 0.28 && raw.volume > 0.01) {
      beat = true;
      const interval = now - state.lastBeat;
      if (interval < 2) {
        state.intervals.push(interval);
        if (state.intervals.length > 16) state.intervals.shift();
        if (state.intervals.length >= 4) {
          // Mediana de los últimos intervalos (ignora golpes de más o de menos).
          const sorted = state.intervals.slice().sort((x, y) => x - y);
          const med = sorted[Math.floor(sorted.length / 2)];
          let bpm = 60 / med;
          while (bpm < 70) bpm *= 2;
          while (bpm > 180) bpm /= 2;
          state.bpm = state.bpm ? Math.round(state.bpm * 0.6 + bpm * 0.4) : Math.round(bpm);
        }
      }
      state.lastBeat = now;
      state.pulse = 1;
    }
    state.pulse *= Math.exp(-dt * 7);
    out.beat = beat;
    out.pulse = state.pulse;
    out.bpm = now - state.lastBeat < 3 ? state.bpm : 0;
    return out;
  }

  window.AudioReact = {
    start, stop, features,
    get running() { return state.running; },
    get suspended() { return !!(state.ctx && state.ctx.state === "suspended"); },
    get error() { return state.error; },
    get label() { return state.label; },
    get wanting() { return state.wanting; }
  };
})();
