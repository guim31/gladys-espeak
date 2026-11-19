// A fake EspeakEngine: answers with real eSpeak NG output (fixtures made in the
// image with `printf … | espeak-ng -b 1 -v fr-fr --stdout`), records requests.

import { readFileSync } from 'node:fs';

export const BONJOUR = readFileSync(new URL('../fixtures/bonjour-fr.wav', import.meta.url));
export const SILENCE = readFileSync(new URL('../fixtures/silence-fr.wav', import.meta.url));

/**
 * @param {(request: object) => Buffer|Promise<Buffer>} [answer] - Output per request.
 * @returns {{synthesize: Function, calls: object[]}} The engine.
 */
export function fakeEngine(answer = () => BONJOUR) {
  const calls = [];
  return {
    calls,
    async synthesize(request) {
      calls.push(request);
      return answer(request);
    },
  };
}
