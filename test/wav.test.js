import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WavError,
  durationSeconds,
  encodeWav,
  fitWav,
  halveRate,
  isAudible,
  parseWav,
  toEightBits,
} from '../src/wav.js';
import { BONJOUR, SILENCE } from './helpers/fakeEngine.js';

test('the placeholder sizes of eSpeak NG are replaced by the real ones', () => {
  // As written by `espeak-ng --stdout` into a pipe.
  assert.equal(BONJOUR.readUInt32LE(40), 0x7ffff000);
  const pcm = parseWav(BONJOUR);
  assert.equal(pcm.sampleRate, 22050);
  assert.equal(pcm.channels, 1);
  assert.equal(pcm.data.length, BONJOUR.length - 44);
  assert.equal(durationSeconds(pcm).toFixed(2), '0.82');
  const file = encodeWav(pcm);
  assert.equal(file.readUInt32LE(4), file.length - 8);
  assert.equal(file.readUInt32LE(40), file.length - 44);
  assert.equal(file.readUInt32LE(28), 44100);
  assert.deepEqual(parseWav(file).data, pcm.data);
});

test('a WAV file with an extra chunk or an odd tail is read', () => {
  const pcm = parseWav(BONJOUR);
  const file = encodeWav(pcm);
  const list = Buffer.from('LIST\x03\x00\x00\x00abc\x00', 'latin1');
  const withList = Buffer.concat([file.subarray(0, 36), list, file.subarray(36), Buffer.from([1])]);
  assert.deepEqual(parseWav(withList).data, pcm.data);
});

test('what is not 16-bit PCM WAV is refused', () => {
  assert.throws(() => parseWav(Buffer.from('nothing')), WavError);
  assert.throws(() => parseWav(BONJOUR.subarray(0, 36)), /no audio data/);
  const eight = Buffer.from(BONJOUR);
  eight.writeUInt16LE(8, 34);
  assert.throws(() => parseWav(eight), /16-bit/);
});

test('silence is told apart from speech', () => {
  assert.equal(isAudible(parseWav(BONJOUR)), true);
  assert.equal(isAudible(parseWav(SILENCE)), false);
});

test('a clip too large is resampled, then cut to 8 bits, then refused', () => {
  const pcm = parseWav(BONJOUR);
  const size = pcm.data.length + 44;
  assert.equal(fitWav(pcm, size).sampleRate, 22050);
  const half = fitWav(pcm, size - 1);
  assert.equal(half.sampleRate, 11025);
  assert.equal(half.bitsPerSample, 16);
  assert.equal(half.file.readUInt32LE(24), 11025);
  const eight = fitWav(pcm, Math.ceil(size / 2));
  assert.equal(eight.bitsPerSample, 8);
  assert.equal(eight.file.readUInt16LE(34), 8);
  assert.equal(fitWav(pcm, Math.ceil(size / 4)), null);
});

test('resampling averages pairs, 8 bits are unsigned around 128', () => {
  const data = Buffer.alloc(8);
  [100, 200, -32768, 32767].forEach((value, i) => data.writeInt16LE(value, i * 2));
  const pcm = { sampleRate: 22050, channels: 1, bitsPerSample: 16, data };
  const half = halveRate(pcm);
  assert.equal(half.sampleRate, 11025);
  assert.deepEqual([half.data.readInt16LE(0), half.data.readInt16LE(2)], [150, 0]);
  assert.deepEqual([...toEightBits(pcm).data], [128, 129, 0, 255]);
});
