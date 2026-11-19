// -----------------------------------------------------------------------------
// EspeakTts: everything the SDK handlers of src/app.js call.
//
// - applyConfig(): takes the settings, then speaks one word to check the engine,
//   shown as the status in Supervision. Never throws.
// - handleSynthesize(): turns a text Gladys wants spoken into a WAV clip.
//   Throwing acks the command as failed: the scene action fails visibly, the
//   voice assistant answers in text only.
// - testVoice(): the "Test the voice" button of the configuration screen.
//
// Identical requests running at the same time (one announcement on several
// speakers) share one synthesis. No clip is kept afterwards: eSpeak NG is
// faster than a lookup is worth, and WAV clips are heavy in 256 MB.
// -----------------------------------------------------------------------------

import { logger as defaultLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, voiceFor } from './config.js';
import { EspeakEngine } from './espeak.js';
import { durationSeconds, fitWav, isAudible, parseWav } from './wav.js';

// What Gladys accepts (5 MB decoded).
export const MAX_CLIP_BYTES = 5 * 1000 * 1000;

/** A failure of the "Test the voice" button: Gladys shows the message in red. */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/** A failure of one synthesis; `kind` is a key of MESSAGES. */
class SpeechError extends Error {
  constructor(kind, detail) {
    super(detail);
    this.kind = kind;
  }
}

export const MESSAGES = {
  missing: {
    en: 'The eSpeak NG engine is missing from the image of the integration: reinstall it or check for an update.',
    fr: "Le moteur eSpeak NG manque dans l'image de l'intégration : réinstallez-la ou cherchez une mise à jour.",
    de: 'Die Engine eSpeak NG fehlt im Image der Integration: Installiere sie neu oder such nach einem Update.',
    es: 'Falta el motor eSpeak NG en la imagen de la integración: reinstálela o busque una actualización.',
  },
  failed: {
    en: 'eSpeak NG could not speak this text. The logs of the integration give the detail.',
    fr: "eSpeak NG n'a pas pu prononcer ce texte. Les journaux de l'intégration donnent le détail.",
    de: 'eSpeak NG konnte diesen Text nicht sprechen. Die Protokolle der Integration nennen die Details.',
    es: 'eSpeak NG no pudo pronunciar este texto. Los registros de la integración dan el detalle.',
  },
  timeout: {
    en: 'eSpeak NG did not finish in time: the machine of Gladys may be overloaded.',
    fr: "eSpeak NG n'a pas fini à temps : la machine de Gladys est peut-être surchargée.",
    de: 'eSpeak NG ist nicht rechtzeitig fertig geworden: Der Rechner von Gladys ist vielleicht überlastet.',
    es: 'eSpeak NG no terminó a tiempo: puede que la máquina de Gladys esté sobrecargada.',
  },
  too_long: {
    en: 'The text is too long to fit in the 5 MB clip Gladys accepts: speed up the voice or shorten it.',
    fr: 'Le texte est trop long pour tenir dans le clip de 5 Mo que Gladys accepte : accélérez la voix ou raccourcissez-le.',
    de: 'Der Text ist zu lang für den Clip von 5 MB, den Gladys annimmt: Sprich schneller oder kürze ihn.',
    es: 'El texto es demasiado largo para caber en el clip de 5 MB que acepta Gladys: acelere la voz o acórtelo.',
  },
  empty: {
    en: 'There is nothing to say in the text.',
    fr: "Il n'y a rien à dire dans le texte.",
    de: 'Im Text gibt es nichts zu sagen.',
    es: 'No hay nada que decir en el texto.',
  },
};

// Sentence of the "Test the voice" button, per language family.
const SAMPLES = {
  en: 'Hello, this is Gladys, speaking without the Internet.',
  fr: 'Bonjour, ici Gladys, je parle sans Internet.',
  de: 'Hallo, hier ist Gladys, ich spreche ohne Internet.',
  es: 'Hola, soy Gladys y hablo sin Internet.',
};

/**
 * Status shown in Supervision once the engine spoke.
 * @param {{language: string, variant: string, speed: number, pitch: number}} settings - Normalized settings.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function readyMessage(settings) {
  const fixed = settings.language === 'auto' ? null : settings.language;
  const variant = settings.variant === 'default' ? '' : ` +${settings.variant}`;
  const voice = {
    en: fixed ? `"${fixed}"${variant}` : `the language of each user${variant}`,
    fr: fixed ? `« ${fixed} »${variant}` : `la langue de chaque utilisateur${variant}`,
    de: fixed ? `„${fixed}“${variant}` : `die Sprache des jeweiligen Benutzers${variant}`,
    es: fixed ? `«${fixed}»${variant}` : `el idioma de cada usuario${variant}`,
  };
  const { speed, pitch } = settings;
  return {
    en: `eSpeak NG is ready, offline. Voice: ${voice.en}, ${speed} words/min, pitch ${pitch}.`,
    fr: `eSpeak NG est prêt, hors ligne. Voix : ${voice.fr}, ${speed} mots/min, hauteur ${pitch}.`,
    de: `eSpeak NG ist bereit, offline. Stimme: ${voice.de}, ${speed} Wörter/min, Tonhöhe ${pitch}.`,
    es: `eSpeak NG está listo, sin conexión. Voz: ${voice.es}, ${speed} palabras/min, tono ${pitch}.`,
  };
}

/**
 * Answer of the "Test the voice" button.
 * @param {string} voice - The eSpeak NG voice used.
 * @param {{audio: Buffer, seconds: number}} clip - The clip made.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function testMessage(voice, clip) {
  const kb = Math.max(1, Math.round(clip.audio.length / 1024));
  const en = clip.seconds.toFixed(1);
  const comma = en.replace('.', ',');
  return {
    en: `eSpeak NG spoke the test sentence with the voice "${voice}": a ${en}-second clip (${kb} KB). Select this voice on the Artificial Intelligence page of Gladys.`,
    fr: `eSpeak NG a prononcé la phrase de test avec la voix « ${voice} » : un clip de ${comma} s (${kb} Ko). Choisissez cette voix sur la page Intelligence Artificielle de Gladys.`,
    de: `eSpeak NG hat den Testsatz mit der Stimme „${voice}“ gesprochen: ein Clip von ${comma} s (${kb} KB). Wähle diese Stimme auf der Seite Künstliche Intelligenz von Gladys.`,
    es: `eSpeak NG pronunció la frase de prueba con la voz «${voice}»: un clip de ${comma} s (${kb} KB). Elija esta voz en la página Inteligencia artificial de Gladys.`,
  };
}

/**
 * The message of a failure, for the administrator.
 * @param {unknown} err - Usually an EspeakError or a SpeechError.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function describeError(err) {
  return MESSAGES[err?.kind] ?? MESSAGES.failed;
}

export class EspeakTts {
  /**
   * @param {object} gladys - The SDK instance (GladysIntegration).
   * @param {object} [deps]
   * @param {EspeakEngine} [deps.engine] - Injectable for tests.
   * @param {{info: Function, warn: Function, debug: Function}} [deps.logger] - Injectable for tests.
   */
  constructor(gladys, { engine = new EspeakEngine(), logger = defaultLogger } = {}) {
    this.gladys = gladys;
    this.engine = engine;
    this.logger = logger;
    this.settings = normalizeConfig({});
    this.loaded = false;
    this.loading = null;
    // Synthesis key -> pending synthesis, shared by identical requests.
    this.inFlight = new Map();
    this.status = null;
    // Kind of the last failed synthesis: a repeated failure is logged once.
    this.lastFailure = null;
  }

  /**
   * Take the settings into account, then check that the engine speaks.
   * @param {Record<string, unknown>} rawConfig - Configuration from the SDK.
   * @returns {Promise<void>} Never rejects.
   * @example
   * await tts.applyConfig(gladys.config);
   */
  async applyConfig(rawConfig) {
    this.useConfig(rawConfig);
    await this.check();
  }

  /**
   * Take the settings into account, synchronously: a request arriving meanwhile
   * already uses them.
   * @param {Record<string, unknown>} rawConfig - Configuration from the SDK.
   * @returns {void}
   */
  useConfig(rawConfig) {
    this.settings = normalizeConfig(rawConfig);
    this.loaded = true;
    const { language, variant, speed, pitch } = this.settings;
    this.logger.info(
      `Voice settings: language ${language}, variant ${variant}, speed ${speed}, pitch ${pitch}`,
    );
  }

  /**
   * Speak one word, and show the outcome as the status.
   * @returns {Promise<void>} Never rejects.
   */
  async check() {
    const settings = this.settings;
    try {
      await this.speak('Gladys', null);
      await this.reportStatus(true, readyMessage(settings));
    } catch (err) {
      await this.reportStatus(false, describeError(err), err);
    }
  }

  /**
   * Read the configuration when a command arrives before the SDK
   * resynchronized it (Gladys relays right after the WebSocket authenticates).
   * @returns {Promise<void>}
   */
  async load() {
    if (this.loaded) {
      return;
    }
    this.loading ??= this.gladys.getConfig().then(
      (config) => {
        this.useConfig(config);
        // Not awaited: the waiting request has its own time budget.
        this.check();
      },
      (err) => {
        this.loading = null;
        throw err;
      },
    );
    await this.loading;
  }

  /**
   * Synthesize a text Gladys wants spoken.
   * @param {string} text - The text (≤ 2,000 characters, capped by Gladys).
   * @param {string|null} language - Language of the requesting user (the first
   *   administrator's for an announcement), null when unknown.
   * @returns {Promise<string>} The clip, as `audio/wav;base64,…`.
   * @throws {Error} When no clip can be made.
   * @example
   * await tts.handleSynthesize('La porte est ouverte.', 'fr');
   */
  async handleSynthesize(text, language) {
    try {
      await this.load();
      const clip = await this.speak(typeof text === 'string' ? text : '', language);
      if (this.lastFailure) {
        this.logger.info('Speech synthesized again');
        this.lastFailure = null;
      }
      if (this.status?.connected === false) {
        await this.reportStatus(true, readyMessage(this.settings));
      }
      return `audio/wav;base64,${clip.audio.toString('base64')}`;
    } catch (err) {
      // The failed ack only reaches the Gladys server log: say it here too,
      // in the integration logs the administrator can open from Gladys, once
      // per kind of failure. A text with nothing to say is not a failure of
      // the integration (an AI answer made of emojis).
      const kind = err?.kind ?? 'failed';
      if (kind === 'empty') {
        this.logger.debug(`Speech not synthesized: ${err.message}`);
      } else if (kind !== this.lastFailure) {
        this.lastFailure = kind;
        this.logger.warn(`Speech not synthesized: ${err.message}`);
      } else {
        this.logger.debug(`Speech not synthesized again: ${err.message}`);
      }
      if (err?.kind === 'missing') {
        await this.reportStatus(false, MESSAGES.missing, err);
      }
      // Only the message reaches Gladys: the actionable text and the detail.
      throw new Error(`${describeError(err).en} [${err.message}]`, { cause: err });
    }
  }

  /**
   * The "Test the voice" button: speaks a sentence in the configured voice.
   * @returns {Promise<{en: string, fr: string, de: string, es: string}>} The message shown under the button.
   * @throws {ActionFailure} When the engine does not speak.
   */
  async testVoice() {
    try {
      await this.load();
      // Automatic mode: the voice the first administrator would hear, unknown
      // here; the test speaks the fallback language.
      const { language, voice } = voiceFor(this.settings, null);
      const clip = await this.speak(SAMPLES[language.slice(0, 2)] ?? SAMPLES.en, null);
      this.logger.info(`Voice tested: ${voice}, ${clip.seconds.toFixed(1)} s`);
      await this.reportStatus(true, readyMessage(this.settings));
      return testMessage(voice, clip);
    } catch (err) {
      this.logger.warn(`Voice test failed: ${err.message}`);
      throw new ActionFailure(describeError(err));
    }
  }

  /**
   * The clip of a text, from a synthesis already running or from eSpeak NG.
   * @param {string} text - The text.
   * @param {string|null} language - Language of the requesting user.
   * @returns {Promise<{audio: Buffer, seconds: number, voice: string}>} The clip.
   * @throws {Error} With a `kind` of MESSAGES.
   */
  async speak(text, language) {
    const trimmed = text.trim();
    if (trimmed === '') {
      throw new SpeechError('empty', 'empty text');
    }
    const { speed, pitch } = this.settings;
    const { voice } = voiceFor(this.settings, language);
    const key = JSON.stringify([voice, speed, pitch, trimmed]);
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.make({ text: trimmed, voice, speed, pitch });
      this.inFlight.set(key, pending);
      pending
        .finally(() => {
          if (this.inFlight.get(key) === pending) {
            this.inFlight.delete(key);
          }
        })
        .catch(() => {});
    }
    return pending;
  }

  /**
   * One synthesis: eSpeak NG, then a WAV file Gladys accepts.
   * @param {{text: string, voice: string, speed: number, pitch: number}} request - What to say, how.
   * @returns {Promise<{audio: Buffer, seconds: number, voice: string}>} The clip.
   */
  async make(request) {
    const raw = await this.engine.synthesize(request);
    let pcm;
    try {
      pcm = parseWav(raw);
    } catch (err) {
      throw new SpeechError('failed', `unreadable output of eSpeak NG: ${err.message}`);
    }
    if (pcm.channels !== 1 || !isAudible(pcm)) {
      throw new SpeechError(pcm.channels !== 1 ? 'failed' : 'empty', 'no audible speech');
    }
    const seconds = durationSeconds(pcm);
    const fitted = fitWav(pcm, MAX_CLIP_BYTES);
    if (!fitted) {
      throw new SpeechError('too_long', `${seconds.toFixed(0)} s of speech`);
    }
    this.logger.debug(
      `Clip synthesized with "${request.voice}": ${request.text.length} characters, ${seconds.toFixed(1)} s, ${fitted.sampleRate} Hz ${fitted.bitsPerSample}-bit, ${fitted.file.length} bytes`,
    );
    return { audio: fitted.file, seconds, voice: request.voice };
  }

  /**
   * Publish the status, only when it changes (it is pushed to every open
   * Gladys page), and log the transitions only. A failure is logged, never
   * thrown: a synthesis must not fail because the status could not be shown.
   * @param {boolean} connected - Whether the engine speaks.
   * @param {{en: string, fr: string, de: string, es: string}} message - Shown to the administrator.
   * @param {Error} [err] - The failure, for the log.
   * @returns {Promise<void>}
   */
  async reportStatus(connected, message, err) {
    if (this.status?.connected === connected && this.status?.message.en === message.en) {
      return;
    }
    const wasConnected = this.status?.connected;
    const previous = this.status;
    this.status = { connected, message };
    if (connected && wasConnected === false) {
      this.logger.info('eSpeak NG speaks again');
    } else if (connected && wasConnected === undefined) {
      this.logger.info('eSpeak NG is ready');
    } else if (!connected) {
      this.logger.warn(`eSpeak NG unavailable: ${err?.message ?? message.en}`);
    }
    try {
      await this.gladys.setConnectionStatus(connected, message);
    } catch (statusErr) {
      // Not shown: the next report of the same status must try again.
      if (this.status?.message === message) {
        this.status = previous;
      }
      this.logger.warn(`Unable to publish the status: ${statusErr.message}`);
    }
  }
}
