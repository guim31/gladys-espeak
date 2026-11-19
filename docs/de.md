# eSpeak NG

Gibt Gladys eine **Offline-Stimme**: Die Ansagen der Szenen spricht
**eSpeak NG**, eine freie Sprachsynthese, die in dieser Integration läuft.
Ohne Internet, ohne Konto, ohne Server: Die Stimme spricht weiter, wenn das
Internet ausfällt.

## Was du bekommst

- Eine **Stimme für Gladys** (Gladys 5.3.0 oder neuer): Sobald sie gewählt
  ist, spricht die Szenenaktion **Auf einem Lautsprecher sprechen** mit
  eSpeak NG auf deinen Lautsprechern (Sonos, Google Cast, AirPlay…).
- **38 Sprachen und Akzente**, automatisch in der Sprache des jeweiligen
  Benutzers, mit einer Auswahl an Klangfarben (männlich, weiblich, Flüstern…),
  Geschwindigkeit und Tonhöhe.
- Nichts verlässt dein Netzwerk: Die Texte werden auf dem Rechner von Gladys
  gesprochen.

## Bevor du anfängst: was diese Stimme ist

- eSpeak NG ist ein **Formant-Synthesizer**: Die Stimme klingt **robotisch**,
  weit weg von den natürlichen Stimmen der Online-Dienste, aber deutlich, sehr
  leicht und immer verfügbar. Eine gute Ersatzstimme, oder die Hauptstimme für
  alle, die nichts aus dem Haus lassen wollen.
- Die Engine ist in der Integration enthalten (etwa 20 MB): Es gibt nichts
  weiter zu installieren.
- Nicht mit dem Projekt eSpeak NG verbunden.
- Im Image der Integration getestet, noch nicht auf jedem Lautsprecher:
  Rückmeldungen im Forum sind willkommen.

## Konfiguration

1. Installiere die Integration aus dem Katalog und öffne den Reiter
   **Konfiguration**.
2. **Sprache der Stimme**: **Automatisch** spricht die Sprache des Benutzers,
   dem Gladys antwortet, bei einer Szenenansage die des ersten Administrators
   (Französisch, wenn Gladys sie nicht kennt). Oder lege eine Sprache oder
   einen Akzent fest (Englisch aus dem Vereinigten Königreich oder den USA,
   Französisch aus Frankreich, Belgien oder der Schweiz, Spanisch aus Spanien
   oder Lateinamerika, Portugiesisch aus Portugal oder Brasilien…).
3. **Stimme**: die Klangfarbe (Standard, männlich 1 bis 4, weiblich 1 bis 4,
   Klatt, Flüstern, krächzend). Die Aussprache bleibt die der Sprache.
4. **Geschwindigkeit**: von 80 bis 450 Wörtern pro Minute, standardmäßig 160.
5. **Tonhöhe**: von 0 (tief) bis 99 (hoch), standardmäßig 50.
6. Speichere und drücke dann **Stimme testen**: Die Integration spricht einen Testsatz und
   zeigt die Länge des Clips.
7. Öffne **Integrationen → Künstliche Intelligenz** und wähle **eSpeak NG** in
   der Karte **Stimme**.

## Verwendung in Szenen

Füge einer Szene eine Aktion **Auf einem Lautsprecher sprechen** hinzu, wähle
einen Lautsprecher und gib den Text ein. Gladys fragt den Clip bei dieser
Integration an und stellt ihn dem Lautsprecher in deinem lokalen Netzwerk
bereit.

Der Sprachassistent von Gladys bleibt mit einer Stimmen-Integration bei Text:
Seine Seite läuft über HTTPS, der Clip wird im lokalen Netzwerk über HTTP
bereitgestellt, was der Browser blockiert. Das ist eine Grenze von Gladys, für
alle Stimmen-Integrationen gleich.

## Grenzen

- Die Clips sind **WAV**-Dateien (22.050 Hz, 16 Bit, mono), 44 KB pro Sekunde.
  Gladys nimmt höchstens 5 MB an: Ein sehr langer, langsam gelesener Text (mehr
  als etwa 2 Minuten Sprache) wird mit 11.025 Hz, dann mit 8 Bit gesendet und
  klingt etwas dumpfer. Die höchstens 2.000 Zeichen, die Gladys sendet, sind auf
  einem Mini-PC in etwa 0,2 s gesprochen.
- Japanisch und einige andere Sprachen werden nicht angeboten: eSpeak NG liest
  sie schlecht.
- Eine Ansage auf mehreren Lautsprechern wird nur einmal synthetisiert.

## Fehlerbehebung

- Die **Überwachung** zeigt, ob die Engine spricht, mit der verwendeten Stimme.
- Eine fehlgeschlagene Ansage steht in den **Protokollen** der Integration, und
  die Szenenaktion schlägt im Szenenprotokoll fehl.
- „Im Text gibt es nichts zu sagen“: Der Text ist leer oder enthält nur
  Satzzeichen.
- Starte den Container mit `LOG_LEVEL=debug`, um jeden erzeugten Clip zu sehen.
