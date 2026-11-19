# eSpeak NG for Gladys Assistant

An **offline voice** for [Gladys Assistant](https://gladysassistant.com): a
text-to-speech provider that runs the open-source
[eSpeak NG](https://github.com/espeak-ng/espeak-ng) engine inside its own
container. No Internet, no account, no server: once selected as the voice of
Gladys, the **Talk on a speaker** scene action announces your texts on Sonos,
Google Cast or AirPlay speakers, even when the Internet is down.

> **A robotic voice, on purpose.** eSpeak NG is a formant synthesizer: far from
> the natural voices of [OpenAI TTS](https://github.com/guim31/gladys-openai-tts)
> or of neural engines such as Piper, but tiny (about 20 MB), instant and always
> available. Use it as the main voice if nothing should leave the house, or as
> a backup.

## Features

- A `tts` provider for Gladys 5.3.0 or later, selected on the Artificial
  Intelligence page.
- 38 languages and accents, in the language of each user automatically
  (French when unknown), or a fixed one.
- Timbre (male, female, Klatt, whisper, croaky), speed (80 to 450 words per
  minute) and pitch settings, and a **Test the voice** button.
- WAV clips with a correct header; long texts are resampled to fit the 5 MB
  Gladys accepts.
- One announcement on several speakers is synthesized once.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Nothing else: the engine and its voices are in the image (amd64 and arm64).

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-espeak`. Then open its **Configuration**
tab, press **Test the voice**, and select **eSpeak NG** in the **Voice** card
of **Integrations → Artificial Intelligence**.

The user documentation is in [`docs/`](docs/en.md) (English, French, German,
Spanish).

## How it works

Gladys sends each text (2,000 characters at most) with the language of the
user. The integration runs `espeak-ng --stdout` with the text on stdin (no
markup, no shell), one process at a time with a 25-second budget, rebuilds the
WAV header that eSpeak NG leaves with placeholder sizes when writing to a pipe,
and answers `audio/wav`. A clip over 5 MB (more than about 113 s of speech) is
resampled at 11,025 Hz, then cut to 8 bits; beyond that, the request fails
visibly.

Measured in the locked container (256 MB, read-only, no capabilities) on an
x86 mini PC: 2,000 characters in about 0.2 s (104 s of speech, 4.6 MB), 17 MB
of memory at rest. Image: 195 MB, of which about 20 MB for eSpeak NG.

## Limits

- The voice is robotic. Japanese and some other languages are not offered:
  eSpeak NG reads them poorly.
- Pico TTS (`libttspico`) is not packaged for Alpine Linux, the base of the
  image: it is not offered for now.
- The voice assistant of Gladys stays text-only with any voice integration
  (HTTPS page, HTTP clip): a limit of Gladys.
- Tested inside the integration image against the fake Gladys of the SDK, not
  yet on every speaker: feedback welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests never touch the network. `test/fixtures/` holds real outputs of
eSpeak NG 1.52.0; the test that runs the real program is skipped where
`espeak-ng` is not installed, and runs in the image:

```bash
docker build -t gladys-espeak .
docker run --rm -v "$PWD/test:/app/test:ro" --entrypoint sh gladys-espeak \
  -c 'cd /app && node --test test/espeak.test.js'
```

See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [eSpeak NG](https://github.com/espeak-ng/espeak-ng) (GPL-3.0-or-later), run
  as a separate program from the Alpine Linux package, and its voices.
- The `espeak` and `picotts` text-to-speech integrations of
  [Home Assistant](https://github.com/home-assistant/core) (Apache-2.0), for
  the idea of an offline voice.
- Built on the official
  [JavaScript template](https://github.com/GladysAssistant/integration-template-js)
  and [SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys.

Not affiliated with the eSpeak NG project.

## License

Apache-2.0 for the code of this repository. The Docker image also contains
eSpeak NG, under its own license (GPL-3.0-or-later).
