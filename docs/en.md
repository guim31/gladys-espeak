# eSpeak NG

Gives Gladys an **offline voice**: the scene announcements are spoken by
**eSpeak NG**, an open-source speech engine that runs inside this integration.
No Internet, no account, no server: the voice keeps working when the Internet
is down.

## What you get

- A **voice for Gladys** (Gladys 5.3.0 or later): once selected, the **Talk on a
  speaker** scene action speaks with eSpeak NG on your speakers (Sonos, Google
  Cast, AirPlay…).
- **38 languages and accents**, in the language of each user automatically,
  with a choice of timbres (male, female, whisper…), speed and pitch.
- Nothing leaves your network: the texts are spoken on the machine of Gladys.

## Before you start: what this voice is

- eSpeak NG is a **formant synthesizer**: the voice is **robotic**, far from
  the natural voices of online services, but clear, very light and always
  available. It is a good backup voice, or a main one for those who want
  nothing to leave the house.
- The engine is included in the integration (about 20 MB): nothing else to
  install.
- Not affiliated with the eSpeak NG project.
- Tested inside the integration image, not yet on every speaker: feedback
  welcome on the forum.

## Configuration

1. Install the integration from the catalog, then open its **Configuration**
   tab.
2. **Language of the voice**: **Automatic** speaks the language of the user
   Gladys answers, and the language of the first administrator for a scene
   announcement (French when Gladys does not know it). Or force one language or
   accent (English of the United Kingdom or the United States, French of
   France, Belgium or Switzerland, Spanish of Spain or Latin America,
   Portuguese of Portugal or Brazil…).
3. **Voice**: the timbre (default, male 1 to 4, female 1 to 4, Klatt, whisper,
   croaky). The pronunciation stays that of the language.
4. **Speed**: from 80 to 450 words per minute, 160 by default.
5. **Pitch**: from 0 (low) to 99 (high), 50 by default.
6. Save, then press **Test the voice**: it speaks a test sentence and shows the
   length of the clip.
7. Open **Integrations → Artificial Intelligence** and choose **eSpeak NG** in
   the **Voice** card.

## Using it in scenes

Add a **Talk on a speaker** action to a scene, pick a speaker and type the
text. Gladys asks this integration for the clip, then serves it to the speaker
on your local network.

The voice assistant of Gladys stays text-only with a voice integration: its
page runs over HTTPS, and the clip is served over the local network in HTTP,
which the browser blocks. This is a limit of Gladys, the same for every voice
integration.

## Limits

- The clips are **WAV** files (22,050 Hz, 16-bit, mono), 44 KB per second.
  Gladys takes 5 MB at most: a very long text read slowly (more than about
  2 minutes of speech) is sent at 11,025 Hz, then in 8 bits, which sounds a bit
  duller. The 2,000 characters Gladys sends at most take about 0.2 s to speak
  on a mini PC.
- Japanese and a few other languages are not offered: eSpeak NG reads them
  poorly.
- One announcement on several speakers is synthesized once.

## Troubleshooting

- **Supervision** shows whether the engine speaks, with the voice in use.
- A failed announcement is written in the **logs** of the integration, and the
  scene action fails in the scene log.
- "There is nothing to say in the text": the text is empty, or only
  punctuation.
- Start the container with `LOG_LEVEL=debug` to see every clip made.
