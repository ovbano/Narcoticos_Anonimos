/** Calendario editorial local. No descarga ni reproduce las meditaciones completas. */
(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const date = get('sph-date');
  const title = get('sph-title');
  const summary = get('sph-summary');
  if (!date || !title || !summary) return;
  const label = get('sph-summary-label');
  const audio = get('sph-audio');
  const listen = get('sph-listen');
  const stop = get('sph-stop');
  const rate = get('sph-rate');
  const status = get('sph-audio-status');
  const synth = window.speechSynthesis;
  const supportsAudio = !!(synth && window.SpeechSynthesisUtterance);
  const keyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dateFormatter = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: 'long', day: 'numeric'
  });
  let entries = {};
  let shownDate = '';
  let current = null;
  let utterance = null;
  let audioState = 'idle';

  function resetAudio() {
    // Invalidar antes de cancel(): algunos dispositivos disparan onend/onerror.
    const wasActive = !!utterance;
    utterance = null;
    if (supportsAudio && wasActive) synth.cancel();
    audioState = 'idle';
    listen.textContent = 'Escuchar resumen';
    stop.hidden = true;
    rate.disabled = false;
  }

  function update(force = false) {
    const now = new Date();
    const parts = keyFormatter.formatToParts(now);
    const part = type => parts.find(item => item.type === type).value;
    const key = part('month') + '-' + part('day');
    const fullDate = part('year') + '-' + key;
    if (!force && fullDate === shownDate) return;
    shownDate = fullDate;
    resetAudio();
    date.textContent = dateFormatter.format(now);
    date.dateTime = fullDate;
    const entry = entries[key];
    current = entry && typeof entry.title === 'string' && entry.title.trim() &&
      typeof entry.summary === 'string' && entry.summary.trim() ? entry : null;
    title.textContent = current ? current.title : 'Tu lectura de hoy';
    summary.textContent = current ? current.summary :
      'El resumen de esta fecha aún no está disponible. Puedes consultar la meditación de hoy en la fuente oficial.';
    label.hidden = !current;
    audio.hidden = !current || !supportsAudio;
    status.textContent = current ? (supportsAudio
      ? 'Voz automática del dispositivo · resumen del sitio.'
      : 'Este navegador no ofrece lectura en voz alta. Puedes leer el resumen aquí.') : '';
  }

  listen.addEventListener('click', () => {
    // Comprobar la fecha también al interactuar, por si la pestaña estuvo suspendida.
    update();
    if (!current || !supportsAudio) return;
    if (audioState === 'speaking') {
      synth.pause();
      audioState = 'paused';
      listen.textContent = 'Continuar resumen';
      status.textContent = 'Lectura en pausa.';
      return;
    }
    if (audioState === 'paused') {
      synth.resume();
      audioState = 'speaking';
      listen.textContent = 'Pausar';
      status.textContent = 'Escuchando el resumen del sitio.';
      return;
    }
    const speech = new window.SpeechSynthesisUtterance(
      date.textContent + '. ' + current.title + '. Resumen de la reflexión. ' + current.summary
    );
    speech.lang = 'es-EC';
    const voices = synth.getVoices();
    const voice = voices.find(item => item.lang === 'es-EC') ||
      voices.find(item => /^es(?:-|_)/i.test(item.lang));
    if (voice) speech.voice = voice;
    speech.rate = Number(rate.value);
    utterance = speech;
    audioState = 'speaking';
    listen.textContent = 'Pausar';
    stop.hidden = false;
    rate.disabled = true;
    status.textContent = 'Escuchando el resumen del sitio.';
    speech.onend = () => {
      if (utterance !== speech) return;
      utterance = null;
      resetAudio();
      status.textContent = 'Lectura finalizada.';
    };
    speech.onerror = () => {
      if (utterance !== speech) return;
      resetAudio();
      status.textContent = 'No se pudo reproducir la voz. Puedes intentarlo de nuevo o leer el resumen.';
    };
    try { synth.speak(speech); } catch { speech.onerror(); }
  });
  stop.addEventListener('click', () => {
    resetAudio();
    status.textContent = 'Lectura detenida.';
  });
  window.addEventListener('pagehide', resetAudio);
  window.addEventListener('pageshow', () => update(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) update();
  });
  update();
  window.setInterval(update, 1000);
  // Resolver respecto del script permite alojar el proyecto bajo una subcarpeta.
  const scriptUrl = document.currentScript && document.currentScript.src;
  const dataUrl = scriptUrl ? new URL('../data/solo-por-hoy.json', scriptUrl).href :
    'assets/data/solo-por-hoy.json';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  fetch(dataUrl, { signal: controller.signal })
    .then(response => {
      if (!response.ok) throw new Error('Calendar unavailable');
      return response.json();
    })
    .then(data => {
      if (data.schemaVersion !== 1 || !data.entries || Array.isArray(data.entries) ||
        typeof data.entries !== 'object') throw new Error('Invalid calendar');
      entries = data.entries;
      update(true);
    })
    .catch(() => {
      entries = {};
      update(true);
      summary.textContent = 'No pudimos cargar el resumen. Puedes abrir la meditación de hoy en la fuente oficial.';
    })
    .finally(() => window.clearTimeout(timeout));
})();
