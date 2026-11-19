import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { EspeakEngine, EspeakError } from '../src/espeak.js';
import { durationSeconds, isAudible, parseWav } from '../src/wav.js';
import { BONJOUR } from './helpers/fakeEngine.js';

/** A fake child_process.spawn; `behave(child, stdinText)` plays the process. */
function fakeSpawn(behave) {
  const calls = [];
  const spawn = (command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.killed = null;
    child.kill = (signal) => {
      child.killed = signal;
    };
    let input = '';
    child.stdin.on('data', (chunk) => {
      input += chunk;
    });
    child.stdin.on('end', () => behave(child, input));
    calls.push({ command, args, child, input: () => input });
    return child;
  };
  return { spawn, calls };
}

const request = { text: '--help; rm -rf /', voice: 'fr-fr+f2', speed: 160, pitch: 40 };

test('the text goes through stdin, the settings as arguments', async () => {
  const { spawn, calls } = fakeSpawn((child) => {
    child.stdout.end(BONJOUR);
    child.stdout.on('end', () => child.emit('close', 0, null));
  });
  const out = await new EspeakEngine({ spawn }).synthesize(request);
  assert.deepEqual(out, BONJOUR);
  assert.equal(calls[0].command, 'espeak-ng');
  assert.deepEqual(calls[0].args, [
    '-b',
    '1',
    '-v',
    'fr-fr+f2',
    '-s',
    '160',
    '-p',
    '40',
    '--stdout',
  ]);
  assert.equal(calls[0].input(), '--help; rm -rf /');
});

test('a missing program, a failure and a timeout are told apart', async () => {
  const missing = fakeSpawn((child) => {
    const err = new Error('spawn espeak-ng ENOENT');
    err.code = 'ENOENT';
    child.emit('error', err);
  });
  await assert.rejects(new EspeakEngine({ spawn: missing.spawn }).synthesize(request), {
    kind: 'missing',
  });

  const failing = fakeSpawn((child) => {
    child.stderr.write('Error: voice does not exist\n');
    setImmediate(() => child.emit('close', 1, null));
  });
  await assert.rejects(new EspeakEngine({ spawn: failing.spawn }).synthesize(request), {
    kind: 'failed',
    message: 'espeak-ng: Error: voice does not exist',
  });

  const hanging = fakeSpawn(() => {});
  const engine = new EspeakEngine({ spawn: hanging.spawn, timeoutMs: 20 });
  await assert.rejects(engine.synthesize(request), (err) => {
    assert.ok(err instanceof EspeakError);
    assert.equal(err.kind, 'timeout');
    return true;
  });
  assert.equal(hanging.calls[0].child.killed, 'SIGKILL');
});

test('one process at a time, and a failure does not block the next one', async () => {
  let running = 0;
  let most = 0;
  let count = 0;
  const { spawn } = fakeSpawn((child) => {
    running += 1;
    most = Math.max(most, running);
    count += 1;
    const fail = count === 1;
    setTimeout(() => {
      running -= 1;
      child.emit('close', fail ? 1 : 0, null);
    }, 5);
  });
  const engine = new EspeakEngine({ spawn });
  const results = await Promise.allSettled([1, 2, 3].map(() => engine.synthesize(request)));
  assert.deepEqual(
    results.map((result) => result.status),
    ['rejected', 'fulfilled', 'fulfilled'],
  );
  assert.equal(most, 1);
});

// The real program, when present (it is in the Docker image, rarely on a
// developer machine or a CI runner).
const hasEspeak = spawnSync('espeak-ng', ['--version']).status === 0;

test('the real eSpeak NG speaks the four languages', { skip: !hasEspeak }, async () => {
  const engine = new EspeakEngine();
  for (const voice of ['fr-fr', 'en-gb', 'de', 'es']) {
    const pcm = parseWav(await engine.synthesize({ text: 'Gladys', voice, speed: 160, pitch: 50 }));
    assert.equal(pcm.sampleRate, 22050);
    assert.ok(isAudible(pcm), voice);
    assert.ok(durationSeconds(pcm) > 0.2, voice);
  }
  await assert.rejects(engine.synthesize({ text: 'x', voice: 'xx-nope', speed: 160, pitch: 50 }), {
    kind: 'failed',
  });
});
