// -----------------------------------------------------------------------------
// Configuration: defaults (mirrors the manifest), normalization, and the choice
// of the eSpeak NG voice (`-v <language>[+<variant>]`, `-s`, `-p`).
//
// Every voice name below was listed by `espeak-ng --voices` of the Alpine
// package of the image (eSpeak NG 1.52.0) and spoke a sentence there.
// -----------------------------------------------------------------------------

// Languages offered in the configuration: eSpeak NG voice names.
export const VOICE_LANGUAGES = [
  'ar',
  'bg',
  'ca',
  'cmn',
  'cs',
  'da',
  'de',
  'el',
  'en-gb',
  'en-us',
  'es',
  'es-419',
  'eu',
  'fi',
  'fr-fr',
  'fr-be',
  'fr-ch',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ko',
  'lb',
  'nb',
  'nl',
  'pl',
  'pt',
  'pt-br',
  'ro',
  'ru',
  'sk',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
];

// Voice variants of eSpeak NG (`+m1`, `+f2`…): same pronunciation, other timbre.
export const VARIANTS = [
  'm1',
  'm2',
  'm3',
  'm4',
  'f1',
  'f2',
  'f3',
  'f4',
  'klatt',
  'whisper',
  'croak',
];

// Speed in words per minute, pitch from 0 to 99: the bounds of eSpeak NG.
export const SPEED = Object.freeze({ min: 80, max: 450 });
export const PITCH = Object.freeze({ min: 0, max: 99 });

// Voice used when Gladys gives no language (an instance without administrator)
// or one eSpeak NG does not speak: the default of Guilhem's integrations.
export const FALLBACK_LANGUAGE = 'fr-fr';

// Language of a Gladys user (base code) -> voice, when the names differ.
const ALIASES = {
  en: 'en-gb',
  fr: 'fr-fr',
  zh: 'cmn',
  no: 'nb',
  nn: 'nb',
  iw: 'he',
  in: 'id',
};

// Regional voices chosen from the region of the user's language.
const REGIONAL = { 'en-us': 'en-us', 'pt-br': 'pt-br', 'fr-be': 'fr-be', 'fr-ch': 'fr-ch' };

export const DEFAULT_CONFIG = Object.freeze({
  language: 'auto',
  variant: 'default',
  speed: 160,
  pitch: 50,
});

/**
 * An integer within bounds, or the default. Gladys sends numbers, sometimes as
 * strings.
 * @param {unknown} value - Raw value.
 * @param {{min: number, max: number}} bounds - Accepted range.
 * @param {number} fallback - Default.
 * @returns {number} The value.
 */
function boundedInteger(value, { min, max }, fallback) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Normalize the raw configuration sent by Gladys: unknown values fall back to
 * the defaults, numbers are kept within the bounds of eSpeak NG.
 * @param {Record<string, unknown>} [raw] - Values from the configuration form.
 * @returns {{language: string, variant: string, speed: number, pitch: number}} The settings.
 * @example
 * normalizeConfig({ language: 'de', speed: '200' }); // { language: 'de', variant: 'default', speed: 200, pitch: 50 }
 */
export function normalizeConfig(raw = {}) {
  const value = raw ?? {};
  const language =
    value.language === 'auto' || VOICE_LANGUAGES.includes(value.language)
      ? value.language
      : DEFAULT_CONFIG.language;
  const variant = VARIANTS.includes(value.variant) ? value.variant : DEFAULT_CONFIG.variant;
  return {
    language,
    variant,
    speed: boundedInteger(value.speed, SPEED, DEFAULT_CONFIG.speed),
    pitch: boundedInteger(value.pitch, PITCH, DEFAULT_CONFIG.pitch),
  };
}

/**
 * The voice of the language Gladys asks for, or null when eSpeak NG has none
 * offered here. Accepts `fr`, `FR`, `fr-FR`, `fr_BE`, `en-US`, `zh-TW`…
 * @param {unknown} language - Language of the requesting user.
 * @returns {string|null} A name of VOICE_LANGUAGES.
 */
export function supportedLanguage(language) {
  if (typeof language !== 'string') {
    return null;
  }
  const [base = '', region = ''] = language.trim().replaceAll('_', '-').toLowerCase().split('-');
  const regional = REGIONAL[`${base}-${region}`];
  if (regional) {
    return regional;
  }
  if (base === 'es' && region !== '' && region !== 'es') {
    return 'es-419';
  }
  const code = ALIASES[base] ?? base;
  return VOICE_LANGUAGES.includes(code) ? code : null;
}

/**
 * The eSpeak NG voice of a request: the configured language (or the user's in
 * automatic mode), with the variant.
 * @param {{language: string, variant: string}} settings - Normalized settings.
 * @param {string|null} userLanguage - Language Gladys sent, null when unknown.
 * @returns {{language: string, voice: string}} E.g. `{ language: 'fr-fr', voice: 'fr-fr+f2' }`.
 * @example
 * voiceFor({ language: 'auto', variant: 'm3' }, 'de-DE'); // { language: 'de', voice: 'de+m3' }
 */
export function voiceFor(settings, userLanguage) {
  const language =
    settings.language === 'auto'
      ? (supportedLanguage(userLanguage) ?? FALLBACK_LANGUAGE)
      : settings.language;
  const voice = settings.variant === 'default' ? language : `${language}+${settings.variant}`;
  return { language, voice };
}
