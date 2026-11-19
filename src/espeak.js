// -----------------------------------------------------------------------------
// EspeakEngine: runs the `espeak-ng` program of the image, one text at a time.
//
// The text goes through stdin, never the command line: no quoting, no option
// injection, no length limit of the arguments. Without `-m`, SSML and other
// markup are read as plain text. `-b 1`: the input is UTF-8.
// -----------------------------------------------------------------------------

import { spawn as defaultSpawn } from 'node:child_process';

// Gladys waits 30 s for a clip; eSpeak NG needs well under a second for the
// 2,000 characters Gladys sends, even on a Raspberry Pi.
export const SYNTHESIS_TIMEOUT_MS = 25_000;
// 2,000 characters read at the slowest speed make about 12 MB of WAV.
export const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

/** A failure of the engine; `kind` says which (`missing`, `timeout`, `failed`). */
export class EspeakError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

export class EspeakEngine {
  /**
   * @param {object} [deps]
   * @param {typeof defaultSpawn} [deps.spawn] - Injectable for tests.
   * @param {string} [deps.command] - The program.
   * @param {number} [deps.timeoutMs] - Time budget of one text.
   */
  constructor({
    spawn = defaultSpawn,
    command = 'espeak-ng',
    timeoutMs = SYNTHESIS_TIMEOUT_MS,
  } = {}) {
    this.spawn = spawn;
    this.command = command;
    this.timeoutMs = timeoutMs;
    // One process at a time: steady CPU and memory in the 256 MB sandbox.
    this.queue = Promise.resolve();
  }

  /**
   * Speak a text as WAV (with placeholder sizes, see src/wav.js).
   * @param {{text: string, voice: string, speed: number, pitch: number}} request - What to say, how.
   * @returns {Promise<Buffer>} The WAV output of eSpeak NG.
   * @throws {EspeakError} When the program is missing, too slow or fails.
   * @example
   * await engine.synthesize({ text: 'Bonjour', voice: 'fr-fr+f2', speed: 160, pitch: 50 });
   */
  synthesize(request) {
    const run = this.queue.then(() => this.run(request));
    this.queue = run.catch(() => {});
    return run;
  }

  /**
   * One process.
   * @param {{text: string, voice: string, speed: number, pitch: number}} request - What to say, how.
   * @returns {Promise<Buffer>} The WAV output.
   */
  run({ text, voice, speed, pitch }) {
    const args = ['-b', '1', '-v', voice, '-s', String(speed), '-p', String(pitch), '--stdout'];
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = this.spawn(this.command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err) {
        reject(new EspeakError('missing', `cannot start ${this.command}: ${err.message}`));
        return;
      }
      const chunks = [];
      let size = 0;
      let stderr = '';
      let settled = false;
      const finish = (err, value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (err) {
          child.kill('SIGKILL');
          reject(err);
        } else {
          resolve(value);
        }
      };
      const timer = setTimeout(
        () => finish(new EspeakError('timeout', `no clip after ${this.timeoutMs} ms`)),
        this.timeoutMs,
      );
      child.on('error', (err) => {
        const kind = err.code === 'ENOENT' ? 'missing' : 'failed';
        finish(new EspeakError(kind, `${this.command}: ${err.message}`));
      });
      child.stdout.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_OUTPUT_BYTES) {
          finish(new EspeakError('failed', `more than ${MAX_OUTPUT_BYTES} bytes of audio`));
          return;
        }
        chunks.push(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr = (stderr + chunk).slice(-500);
      });
      child.on('close', (code, signal) => {
        if (code === 0) {
          finish(null, Buffer.concat(chunks));
        } else {
          const detail = stderr.trim().split('\n')[0] || `exit ${code ?? signal}`;
          finish(new EspeakError('failed', `${this.command}: ${detail}`));
        }
      });
      // A process that dies before reading everything closes the pipe: the
      // write error is the same failure, reported by `close`.
      child.stdin.on('error', () => {});
      child.stdin.end(text, 'utf8');
    });
  }
}
