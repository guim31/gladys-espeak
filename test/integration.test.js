import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { EspeakError } from '../src/espeak.js';
import { EspeakTts, MAX_CLIP_BYTES, MESSAGES } from '../src/integration.js';
import { encodeWav, parseWav } from '../src/wav.js';
import { BONJOUR, SILENCE, fakeEngine } from './helpers/fakeEngine.js';

/** A logger that records, by level. */
function recordingLogger() {
  const lines = { info: [], warn: [], debug: [], error: [] };
  const logger = Object.fromEntries(
    Object.keys(lines).map((level) => [level, (message) => lines[level].push(message)]),
  );
  return { logger, lines };
}

async function setup({ config = {}, answer } = {}) {
  const gladys = createFakeGladys({ config });
  const engine = fakeEngine(answer);
  const { logger, lines } = recordingLogger();
  const tts = new EspeakTts(gladys, { engine, logger });
  registerHandlers(gladys, tts, { logger });
  await gladys.connect();
  return { gladys, engine, tts, lines };
}

const decoded = (ack) => {
  const [type, payload] = ack.data.audio.split(';base64,');
  return { type, audio: Buffer.from(payload, 'base64') };
};

test('at startup, one word checks the engine and the status says so', async () => {
  const { gladys, engine, lines } = await setup();
  assert.deepEqual(engine.calls, [{ text: 'Gladys', voice: 'fr-fr', speed: 160, pitch: 50 }]);
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.deepEqual(Object.keys(status.message), ['en', 'fr', 'de', 'es']);
  assert.match(status.message.fr, /hors ligne\. Voix : la langue de chaque utilisateur, 160/);
  assert.ok(lines.info.includes('eSpeak NG is ready'));
});

test('a text is spoken in the language of the user, as a WAV clip with real sizes', async () => {
  const { gladys, engine } = await setup();
  const ack = await gladys.fake.ttsSynthesize('  The garage door is open. ', 'en-US');
  assert.equal(ack.success, true);
  const { type, audio } = decoded(ack);
  assert.equal(type, 'audio/wav');
  assert.equal(audio.readUInt32LE(4), audio.length - 8);
  assert.deepEqual(parseWav(audio).data, parseWav(BONJOUR).data);
  assert.deepEqual(engine.calls.at(-1), {
    text: 'The garage door is open.',
    voice: 'en-us',
    speed: 160,
    pitch: 50,
  });
});

test('the settings choose the voice, and a new configuration applies at once', async () => {
  const { gladys, engine } = await setup({
    config: { language: 'de', variant: 'f3', speed: 220, pitch: 30 },
  });
  await gladys.fake.ttsSynthesize('Das Essen ist fertig.', 'fr');
  assert.deepEqual(engine.calls.at(-1), {
    text: 'Das Essen ist fertig.',
    voice: 'de+f3',
    speed: 220,
    pitch: 30,
  });
  assert.match(gladys.fake.connectionStatus.message.en, /Voice: "de" \+f3, 220 words\/min/);
  await gladys.fake.configUpdated({ language: 'auto', variant: 'default', speed: 160, pitch: 50 });
  await gladys.fake.ttsSynthesize('Dinner is ready.', null);
  assert.equal(engine.calls.at(-1).voice, 'fr-fr');
});

test('the same announcement on several speakers is synthesized once', async () => {
  const { gladys, engine } = await setup();
  const before = engine.calls.length;
  const acks = await Promise.all([
    gladys.fake.ttsSynthesize('Le linge est sec.', 'fr'),
    gladys.fake.ttsSynthesize('Le linge est sec.', 'fr'),
  ]);
  assert.ok(acks.every((ack) => ack.success));
  assert.equal(engine.calls.length - before, 1);
  await gladys.fake.ttsSynthesize('Le linge est sec.', 'de');
  assert.equal(engine.calls.length - before, 2);
});

test('an empty or silent text fails without touching the status', async () => {
  const { gladys, engine } = await setup({ answer: (r) => (r.text === '...' ? SILENCE : BONJOUR) });
  const statuses = gladys.fake.connectionStatuses.length;
  const before = engine.calls.length;
  const empty = await gladys.fake.ttsSynthesize('   ', 'fr');
  assert.equal(empty.success, false);
  assert.match(empty.error, /nothing to say/);
  assert.equal(engine.calls.length, before);
  const silent = await gladys.fake.ttsSynthesize('...', 'fr');
  assert.equal(silent.success, false);
  assert.match(silent.error, /nothing to say/);
  assert.equal(gladys.fake.connectionStatuses.length, statuses);
});

test('a very long clip is reduced to fit in 5 MB, a longer one is refused', async () => {
  const pcm = parseWav(BONJOUR);
  // About 150 s of speech: over 5 MB at 22,050 Hz, under once resampled.
  const long = encodeWav({ ...pcm, data: Buffer.concat(Array(190).fill(pcm.data)) });
  const huge = encodeWav({ ...pcm, data: Buffer.concat(Array(700).fill(pcm.data)) });
  const { gladys } = await setup({
    answer: (r) => ({ long, huge })[r.text] ?? BONJOUR,
  });
  const ack = await gladys.fake.ttsSynthesize('long', 'fr');
  assert.equal(ack.success, true);
  const { audio } = decoded(ack);
  assert.ok(audio.length <= MAX_CLIP_BYTES);
  assert.equal(audio.readUInt32LE(24), 11025);
  const refused = await gladys.fake.ttsSynthesize('huge', 'fr');
  assert.equal(refused.success, false);
  assert.match(refused.error, /too long/);
});

test('an engine failure fails the synthesis; a missing engine shows in Supervision', async () => {
  let failure = null;
  const { gladys, lines } = await setup({
    answer: () => {
      if (failure) {
        throw failure;
      }
      return BONJOUR;
    },
  });
  failure = new EspeakError('timeout', 'no clip after 25000 ms');
  const slow = await gladys.fake.ttsSynthesize('Alerte.', 'fr');
  assert.equal(slow.success, false);
  assert.match(slow.error, /did not finish in time/);
  assert.equal(gladys.fake.connectionStatus.connected, true);

  failure = new EspeakError('missing', 'spawn espeak-ng ENOENT');
  const missing = await gladys.fake.ttsSynthesize('Alerte.', 'fr');
  assert.equal(missing.success, false);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: false, message: MESSAGES.missing });
  assert.equal(lines.warn.filter((line) => line.startsWith('eSpeak NG unavailable')).length, 1);

  failure = null;
  assert.equal((await gladys.fake.ttsSynthesize('Alerte.', 'fr')).success, true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(lines.info.includes('eSpeak NG speaks again'));
});

test('a normal synthesis writes nothing at info level', async () => {
  const { gladys, lines } = await setup();
  const before = lines.info.length;
  await gladys.fake.ttsSynthesize('Bonne nuit.', 'fr');
  await gladys.fake.ttsSynthesize('Bonne nuit.', 'fr');
  assert.equal(lines.info.length, before);
  assert.equal(lines.warn.length, 0);
});

test('the "Test the voice" button speaks a sentence and says what came back', async () => {
  const { gladys, engine } = await setup({ config: { language: 'es', variant: 'm2' } });
  const ack = await gladys.fake.action('test_voice');
  assert.equal(ack.success, true);
  assert.equal(engine.calls.at(-1).text, 'Hola, soy Gladys y hablo sin Internet.');
  assert.match(ack.data.message.fr, /avec la voix « es\+m2 » : un clip de 0,8 s \(35 Ko\)/);
  assert.match(ack.data.message.en, /"es\+m2": a 0\.8-second clip/);
});

test('a failed voice test is shown in red, in the four languages', async () => {
  const { gladys } = await setup({
    answer: () => {
      throw new EspeakError('missing', 'spawn espeak-ng ENOENT');
    },
  });
  const ack = await gladys.fake.action('test_voice');
  assert.equal(ack.success, false);
  assert.equal(ack.error.fr, MESSAGES.missing.fr);
  assert.equal(ack.error.es, MESSAGES.missing.es);
});

test('a request arriving before the configuration is read waits for it', async () => {
  const gladys = createFakeGladys({ config: { language: 'it' } });
  const engine = fakeEngine();
  const { logger } = recordingLogger();
  const tts = new EspeakTts(gladys, { engine, logger });
  const clip = await tts.handleSynthesize('Ciao.', 'fr');
  assert.match(clip, /^audio\/wav;base64,/);
  assert.equal(engine.calls[0].voice, 'it');
});
