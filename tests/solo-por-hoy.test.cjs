const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'assets/js/solo-por-hoy.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/solo-por-hoy.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (let day = 1; day <= 30; day++) {
  const entry = data.entries['09-' + String(day).padStart(2, '0')];
  assert.ok(entry.title && entry.summary && entry.source && entry.verifiedOn);
  assert.ok(['official', 'secondary'].includes(entry.sourceType));
}
assert.equal(Object.keys(data.entries).length, 30);
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
  assert.equal(app.nodes['sph-title'].textContent, 'Tu lectura de hoy');
  assert.equal(app.nodes['sph-audio'].hidden, true);
  assert.equal(app.nodes['sph-summary-label'].hidden, true);
  for (const iso of ['2028-02-29T05:00:00Z', '2027-01-01T05:00:00Z']) {
    app.advance(iso);
    assert.equal(app.nodes['sph-date'].dateTime, iso.slice(0, 10));
    assert.equal(app.nodes['sph-title'].textContent, 'Tu lectura de hoy');
  }
  const noAudio = await setup('2026-09-17T15:00:00Z', { noAudio: true });
  assert.equal(noAudio.nodes['sph-audio'].hidden, true);
  assert.equal(noAudio.nodes['sph-summary-label'].hidden, false);
  for (const options of [{ reject: true }, { payload: { schemaVersion: 7 } }]) {
    const failed = await setup('2026-09-17T15:00:00Z', options);
    assert.match(failed.nodes['sph-summary'].textContent, /No pudimos cargar/);
    assert.equal(failed.nodes['sph-audio'].hidden, true);
  }
  console.log('OK: cobertura, HTML, medianoche de Ecuador, cambio de mes/año, bisiesto, audio y fallos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
