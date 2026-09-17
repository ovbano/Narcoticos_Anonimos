const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'assets/js/solo-por-hoy.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/solo-por-hoy.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pad = number => String(number).padStart(2, '0');
const monthLengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
for (let month = 1; month <= 12; month++) {
  for (let day = 1; day <= monthLengths[month - 1]; day++) {
    const key = pad(month) + '-' + pad(day);
    const entry = data.entries[key];
    assert.ok(entry, 'Falta la fecha ' + key);
    assert.ok(entry.title.trim() && entry.summary.trim() && entry.source && entry.verifiedOn, key);
    assert.ok(['official', 'secondary'].includes(entry.sourceType), key);
    assert.equal(new URL(entry.source).protocol, 'https:');
    assert.ok(!/<[^>]+>/.test(entry.title + entry.summary), 'No HTML en ' + key);
  }
}
assert.equal(Object.keys(data.entries).length, 366);
assert.equal(new Set(Object.values(data.entries).map(entry => entry.summary)).size, 366);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length);

async function setup(iso, options = {}) {
  let now = iso;
  const nodes = Object.fromEntries([
    'date', 'title', 'summary', 'summary-label', 'audio', 'listen', 'stop', 'rate', 'audio-status'
  ].map(name => ['sph-' + name, {
    textContent: '', hidden: false, value: '1', disabled: false, events: {},
    addEventListener(event, fn) { this.events[event] = fn; }
  }]));
  const events = {};
  const spoken = [];
  let cancellations = 0;
  const synth = {
    getVoices: () => [{ lang: 'es-EC' }], speak: speech => spoken.push(speech),
    pause() {}, resume() {}, cancel() { cancellations++; }
  };
  let tick;
  const window = {
    setInterval(fn) { tick = fn; }, setTimeout() { return 1; }, clearTimeout() {},
    addEventListener(event, fn) { events[event] = fn; },
    ...(options.noAudio ? {} : { speechSynthesis: synth, SpeechSynthesisUtterance: class {
      constructor(text) { this.text = text; }
    } })
  };
  const context = {
    window, Intl, URL, AbortController,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } },
    document: {
      currentScript: { src: 'https://example.org/group/assets/js/solo-por-hoy.js' },
      getElementById: id => nodes[id], hidden: false,
      addEventListener(event, fn) { events[event] = fn; }
    },
    fetch: async url => {
      assert.equal(url, 'https://example.org/group/assets/data/solo-por-hoy.json');
      if (options.reject) throw new Error('offline');
      return { ok: true, json: async () => options.payload || data };
    }
  };
  vm.runInNewContext(code, context);
  await new Promise(resolve => setImmediate(resolve));
  return {
    nodes, spoken, events,
    click(id) { nodes['sph-' + id].events.click(); },
    advance(iso) { now = iso; tick(); },
    get cancellations() { return cancellations; }
  };
}

(async () => {
  const app = await setup('2026-09-18T04:59:59Z');
  assert.equal(app.nodes['sph-date'].dateTime, '2026-09-17');
  assert.equal(app.nodes['sph-title'].textContent, 'Ir más allá del Quinto Paso');
  assert.equal(app.spoken.length, 0, 'No autoplay');
  app.click('listen');
  assert.equal(app.spoken.length, 1);
  assert.ok(app.spoken[0].text.includes(data.entries['09-17'].summary));
  app.click('listen');
  assert.equal(app.nodes['sph-listen'].textContent, 'Continuar resumen');
  app.click('listen');
  assert.equal(app.nodes['sph-listen'].textContent, 'Pausar');
  app.advance('2026-09-18T05:00:00Z');
  assert.equal(app.nodes['sph-date'].dateTime, '2026-09-18');
  assert.equal(app.nodes['sph-title'].textContent, 'Relaciones honestas');
  assert.equal(app.cancellations, 1);
  app.nodes['sph-rate'].value = '1.2';
  app.click('listen');
  assert.equal(app.spoken[1].rate, 1.2);
  app.spoken[0].onend(); // Evento tardío de una voz cancelada.
  assert.equal(app.nodes['sph-listen'].textContent, 'Pausar');
  app.click('stop');
  assert.equal(app.nodes['sph-stop'].hidden, true);
  app.advance('2026-10-01T05:00:00Z');
  assert.equal(app.nodes['sph-title'].textContent, 'No sólo una motivación para crecer');
  assert.equal(app.nodes['sph-audio'].hidden, false);
  assert.equal(app.nodes['sph-summary-label'].hidden, false);
  const boundaries = [
    ['2027-01-01T04:59:59Z', '2026-12-31', 'Prestar servicio'],
    ['2027-01-01T05:00:00Z', '2027-01-01', 'Vigilancia'],
    ['2027-03-01T04:59:59Z', '2027-02-28', 'El mayor don'],
    ['2027-03-01T05:00:00Z', '2027-03-01', '¡Ataque de ansiedad!'],
    ['2028-02-29T04:59:59Z', '2028-02-28', 'El mayor don'],
    ['2028-02-29T05:00:00Z', '2028-02-29', '¡Todo!'],
    ['2028-03-01T04:59:59Z', '2028-02-29', '¡Todo!'],
    ['2028-03-01T05:00:00Z', '2028-03-01', '¡Ataque de ansiedad!']
  ];
  for (const [iso, expectedDate, expectedTitle] of boundaries) {
    app.advance(iso);
    assert.equal(app.nodes['sph-date'].dateTime, expectedDate);
    assert.equal(app.nodes['sph-title'].textContent, expectedTitle);
  }
  // Ejecutar el render real para cada día de años comunes, bisiestos y siglos.
  let renderedDays = 0;
  for (const year of [2026, 2027, 2028, 2029, 2030, 2100, 2400]) {
    for (let month = 1; month <= 12; month++) {
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let day = 1; day <= days; day++) {
        const key = pad(month) + '-' + pad(day);
        const isoDate = year + '-' + key;
        app.advance(isoDate + 'T05:00:00Z');
        assert.equal(app.nodes['sph-date'].dateTime, isoDate);
        assert.equal(app.nodes['sph-title'].textContent, data.entries[key].title);
        assert.equal(app.nodes['sph-summary'].textContent, data.entries[key].summary);
        assert.equal(app.nodes['sph-audio'].hidden, false);
        renderedDays++;
      }
    }
  }
  assert.equal(renderedDays, 2557);
  const incomplete = structuredClone(data);
  delete incomplete.entries['10-01'];
  const missing = await setup('2028-10-01T05:00:00Z', { payload: incomplete });
  assert.equal(missing.nodes['sph-title'].textContent, 'Tu lectura de hoy');
  assert.equal(missing.nodes['sph-audio'].hidden, true);
  assert.equal(missing.nodes['sph-summary-label'].hidden, true);
  const noAudio = await setup('2026-09-17T15:00:00Z', { noAudio: true });
  assert.equal(noAudio.nodes['sph-audio'].hidden, true);
  assert.equal(noAudio.nodes['sph-summary-label'].hidden, false);
  for (const options of [{ reject: true }, { payload: { schemaVersion: 7 } }]) {
    const failed = await setup('2026-09-17T15:00:00Z', options);
    assert.match(failed.nodes['sph-summary'].textContent, /No pudimos cargar/);
    assert.equal(failed.nodes['sph-audio'].hidden, true);
  }
  console.log('OK: 366 entradas; 2557 días simulados; medianoche de Ecuador, 2027/2028, siglos, audio y fallos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
