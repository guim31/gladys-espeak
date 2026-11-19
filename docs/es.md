# eSpeak NG

Da a Gladys una **voz sin conexión**: los anuncios de las escenas los pronuncia
**eSpeak NG**, un motor de síntesis de voz libre que funciona dentro de esta
integración. Sin Internet, sin cuenta, sin servidor: la voz sigue hablando
cuando se corta Internet.

## Lo que obtiene

- Una **voz para Gladys** (Gladys 5.3.0 o posterior): una vez elegida, la
  acción de escena **Hablar en un altavoz** habla con eSpeak NG en sus
  altavoces (Sonos, Google Cast, AirPlay…).
- **38 idiomas y acentos**, en el idioma de cada usuario automáticamente, con
  una elección de timbres (masculino, femenino, susurro…), velocidad y tono.
- Nada sale de su red: los textos se pronuncian en la máquina de Gladys.

## Antes de empezar: qué es esta voz

- eSpeak NG es un **sintetizador por formantes**: la voz es **robótica**, lejos
  de las voces naturales de los servicios en línea, pero clara, muy ligera y
  siempre disponible. Es una buena voz de respaldo, o la voz principal para
  quien no quiere que nada salga de casa.
- El motor viene incluido en la integración (unos 20 MB): no hay nada más que
  instalar.
- Sin relación con el proyecto eSpeak NG.
- Probada en la imagen de la integración, todavía no en todos los altavoces:
  sus comentarios son bienvenidos en el foro.

## Configuración

1. Instale la integración desde el catálogo y abra su pestaña
   **Configuración**.
2. **Idioma de la voz**: **Automático** habla el idioma del usuario al que
   responde Gladys, y el del primer administrador para un anuncio de escena
   (francés si Gladys no lo conoce). O imponga un idioma o un acento (inglés del
   Reino Unido o de Estados Unidos, francés de Francia, Bélgica o Suiza, español
   de España o de Latinoamérica, portugués de Portugal o de Brasil…).
3. **Voz**: el timbre (predeterminada, masculina 1 a 4, femenina 1 a 4, Klatt,
   susurro, ronca). La pronunciación sigue siendo la del idioma.
4. **Velocidad**: de 80 a 450 palabras por minuto, 160 por defecto.
5. **Tono**: de 0 (grave) a 99 (agudo), 50 por defecto.
6. Guarde y pulse **Probar la voz**: pronuncia una frase de prueba y muestra la
   duración del clip.
7. Abra **Integraciones → Inteligencia artificial** y elija **eSpeak NG** en la
   tarjeta **Voz**.

## Uso en escenas

Añada una acción **Hablar en un altavoz** a una escena, elija un altavoz y
escriba el texto. Gladys pide el clip a esta integración y luego lo sirve al
altavoz en su red local.

El asistente de voz de Gladys se queda en texto con una integración de voz: su
página funciona en HTTPS, y el clip se sirve en la red local en HTTP, lo que el
navegador bloquea. Es un límite de Gladys, igual para todas las integraciones
de voz.

## Límites

- Los clips son archivos **WAV** (22 050 Hz, 16 bits, mono), 44 KB por segundo.
  Gladys acepta 5 MB como máximo: un texto muy largo leído despacio (más de unos
  2 minutos de voz) se envía a 11 025 Hz y luego en 8 bits, con un sonido algo
  más apagado. Los 2000 caracteres que Gladys envía como máximo se pronuncian en
  unos 0,2 s en un mini PC.
- El japonés y algunos otros idiomas no se ofrecen: eSpeak NG los lee mal.
- Un anuncio en varios altavoces se sintetiza una sola vez.

## Solución de problemas

- La **Supervisión** indica si el motor habla, con la voz utilizada.
- Un anuncio fallido queda escrito en los **registros** de la integración, y la
  acción de escena falla en el registro de escenas.
- «No hay nada que decir en el texto»: el texto está vacío o solo contiene
  signos de puntuación.
- Inicie el contenedor con `LOG_LEVEL=debug` para ver cada clip producido.
