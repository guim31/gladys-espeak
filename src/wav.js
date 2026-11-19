// -----------------------------------------------------------------------------
// WAV helpers.
//
// `espeak-ng --stdout` cannot seek back into a pipe, so it leaves placeholder
// sizes in the RIFF header (0x7ffff024 and 0x7ffff000 with eSpeak NG 1.52.0):
// some players refuse such a file or wait for 2 GB of audio. The header is
// rebuilt from the bytes really received.
//
// eSpeak NG speaks 16-bit mono PCM at 22,050 Hz, 44 KB per second: Gladys takes
// 5 MB at most, about 113 seconds. A longer clip is resampled at 11,025 Hz
// (226 s), then also cut to 8 bits (453 s): eSpeak NG's formant voice keeps most
// of its energy below 5 kHz, so it stays understandable.
// -----------------------------------------------------------------------------

export class WavError extends Error {}

/**
 * Read a WAV file, trusting the bytes rather than the declared sizes.
 * @param {Buffer} buffer - The file.
 * @returns {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} PCM.
 * @throws {WavError} When it is not 16-bit PCM WAV.
 */
export function parseWav(buffer) {
  if (
    buffer.length < 12 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new WavError('not a WAV file');
  }
  let offset = 12;
  let format = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const declared = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      if (start + 16 > buffer.length) {
        break;
      }
      format = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      if (!format || format.audioFormat !== 1 || format.bitsPerSample !== 16) {
        throw new WavError('not 16-bit PCM');
      }
      // The placeholder size runs past the end: everything left is audio.
      const end = Math.min(buffer.length, start + declared);
      const usable = end - start - ((end - start) % (2 * format.channels));
      return {
        sampleRate: format.sampleRate,
        channels: format.channels,
        bitsPerSample: 16,
        data: buffer.subarray(start, start + usable),
      };
    }
    offset = start + declared + (declared % 2);
  }
  throw new WavError('no audio data');
}

/**
 * Write a canonical 44-byte-header WAV file.
 * @param {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} pcm - PCM.
 * @returns {Buffer} The file.
 */
export function encodeWav({ sampleRate, channels, bitsPerSample, data }) {
  const header = Buffer.alloc(44);
  const blockAlign = channels * (bitsPerSample / 8);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/**
 * Halve the sample rate of 16-bit mono PCM, averaging each pair of samples (a
 * crude low-pass filter that limits aliasing).
 * @param {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} pcm - 16-bit mono PCM.
 * @returns {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} Half the rate.
 */
export function halveRate(pcm) {
  const count = Math.floor(pcm.data.length / 4);
  const data = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    const a = pcm.data.readInt16LE(i * 4);
    const b = pcm.data.readInt16LE(i * 4 + 2);
    data.writeInt16LE(Math.round((a + b) / 2), i * 2);
  }
  return { ...pcm, sampleRate: Math.floor(pcm.sampleRate / 2), data };
}

/**
 * Cut 16-bit PCM to 8 bits (unsigned, as WAV stores them).
 * @param {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} pcm - 16-bit PCM.
 * @returns {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} 8-bit PCM.
 */
export function toEightBits(pcm) {
  const count = Math.floor(pcm.data.length / 2);
  const data = Buffer.alloc(count);
  for (let i = 0; i < count; i += 1) {
    data[i] = Math.min(255, Math.round(pcm.data.readInt16LE(i * 2) / 256) + 128);
  }
  return { ...pcm, bitsPerSample: 8, data };
}

/**
 * Length of PCM audio, in seconds.
 * @param {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} pcm - PCM.
 * @returns {number} Seconds.
 */
export function durationSeconds({ sampleRate, channels, bitsPerSample, data }) {
  return data.length / (sampleRate * channels * (bitsPerSample / 8));
}

/**
 * Whether the audio holds anything above near-silence (16-bit PCM).
 * @param {{data: Buffer}} pcm - 16-bit PCM.
 * @returns {boolean} True when something is heard.
 */
export function isAudible({ data }) {
  for (let i = 0; i + 1 < data.length; i += 2) {
    if (Math.abs(data.readInt16LE(i)) > 64) {
      return true;
    }
  }
  return false;
}

/**
 * The WAV file of the clip, reduced until it fits in `maxBytes`, or null.
 * @param {{sampleRate: number, channels: number, bitsPerSample: number, data: Buffer}} pcm - 16-bit mono PCM.
 * @param {number} maxBytes - Largest file accepted.
 * @returns {{file: Buffer, sampleRate: number, bitsPerSample: number}|null} The file and its format.
 */
export function fitWav(pcm, maxBytes) {
  const half = pcm.data.length + 44 > maxBytes ? halveRate(pcm) : null;
  const candidates = half ? [half, toEightBits(half)] : [pcm];
  for (const candidate of candidates) {
    if (candidate.data.length + 44 <= maxBytes) {
      return {
        file: encodeWav(candidate),
        sampleRate: candidate.sampleRate,
        bitsPerSample: candidate.bitsPerSample,
      };
    }
  }
  return null;
}
