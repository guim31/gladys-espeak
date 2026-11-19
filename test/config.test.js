import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, supportedLanguage, voiceFor } from '../src/config.js';

test('unknown values fall back to the defaults, numbers stay within the bounds', () => {
  assert.deepEqual(normalizeConfig(undefined), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
  assert.deepEqual(
    normalizeConfig({ language: 'xx', variant: 'robot', speed: 'fast', pitch: '' }),
    {
      ...DEFAULT_CONFIG,
    },
  );
  assert.deepEqual(normalizeConfig({ language: 'de', variant: 'f2', speed: '200', pitch: 70.4 }), {
    language: 'de',
    variant: 'f2',
    speed: 200,
    pitch: 70,
  });
  assert.equal(normalizeConfig({ speed: 10 }).speed, 80);
  assert.equal(normalizeConfig({ speed: 1000 }).speed, 450);
  assert.equal(normalizeConfig({ pitch: -5 }).pitch, 0);
  assert.equal(normalizeConfig({ pitch: 150 }).pitch, 99);
});

test('the language of a Gladys user picks an eSpeak NG voice', () => {
  assert.equal(supportedLanguage('fr'), 'fr-fr');
  assert.equal(supportedLanguage('FR_be'), 'fr-be');
  assert.equal(supportedLanguage('en'), 'en-gb');
  assert.equal(supportedLanguage('en-US'), 'en-us');
  assert.equal(supportedLanguage('de-AT'), 'de');
  assert.equal(supportedLanguage('es'), 'es');
  assert.equal(supportedLanguage('es-MX'), 'es-419');
  assert.equal(supportedLanguage('pt-BR'), 'pt-br');
  assert.equal(supportedLanguage('zh-TW'), 'cmn');
  assert.equal(supportedLanguage('no'), 'nb');
  assert.equal(supportedLanguage('ja'), null);
  assert.equal(supportedLanguage(null), null);
});

test('the voice is the configured language, or the user one, with the variant', () => {
  assert.deepEqual(voiceFor({ language: 'auto', variant: 'default' }, null), {
    language: 'fr-fr',
    voice: 'fr-fr',
  });
  assert.deepEqual(voiceFor({ language: 'auto', variant: 'm3' }, 'de-DE'), {
    language: 'de',
    voice: 'de+m3',
  });
  assert.deepEqual(voiceFor({ language: 'auto', variant: 'm3' }, 'ja'), {
    language: 'fr-fr',
    voice: 'fr-fr+m3',
  });
  assert.deepEqual(voiceFor({ language: 'es-419', variant: 'f1' }, 'en'), {
    language: 'es-419',
    voice: 'es-419+f1',
  });
});
