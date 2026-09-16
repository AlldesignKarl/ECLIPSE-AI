# El anuncio de ECLIPSE — cómo se monta y cómo se cambia

Esta carpeta es el proyecto entero del vídeo promocional. No hace falta ningún
programa de edición: se monta con Node, un Chromium y ffmpeg.

El archivo que se sube a las redes es **`salida/eclipse-promo.mp4`**.
Qué cuenta y por qué está montado así: **`GUION.md`**.

---

## Montarlo entero

```bash
npm install                    # una vez
npx next dev -p 3100           # en otra terminal: hace falta para las capturas
npm run promo                  # apuntes → capturas → música → render → montaje
```

Tarda unos quince minutos, casi todos en el render (1.680 fotogramas). Si las
capturas ya están hechas y solo se han tocado textos o tiempos:

```bash
npm run promo -- --rapido      # se salta las capturas; no necesita el servidor
```

**Hace falta un ffmpeg con H.264.** Si no está en el PATH:

```bash
npm i -D ffmpeg-static         # se encuentra solo
# o
FFMPEG=/ruta/a/ffmpeg node promo/src/montar.mjs
```

El que trae Playwright NO vale: está recortado a WebM.

---

## Cambiar cosas

| Quiero… | Toco… |
|---|---|
| Una frase | `src/guion.js` → `TEXTOS` |
| Cuánto dura una escena | `src/guion.js` → `T` (segundos desde el principio) |
| Qué pantalla sale en cada paso, y cómo de cerca | `src/guion.js` → `PANTALLAS` |
| Que salga otra pantalla de la aplicación | `src/capturar.mjs` (grábala) y luego `PANTALLAS` |
| Lo que ECLIPSE contesta en las capturas | `src/datos-demo.mjs` |
| La música | `src/musica.mjs` |
| Colores, tipos, el móvil, el eclipse | `src/escena.html` |
| Cómo se mueve todo | `src/motor.js` |

Después de tocar algo, **mirar antes de renderizar**:

```bash
node promo/src/ojear.mjs 2.9 6.9 14.4 21.9   # instantes sueltos
node promo/src/ojear.mjs --tira 13 21 8      # ocho repartidos entre 13 y 21 s
```
Salen en `.ojeadas/`. Renderizar el vídeo entero para comprobar una frase son
doce minutos por prueba; esto son ocho segundos.

Y antes de renderizar, pasar el revisor:

```bash
node promo/src/revisar.mjs
```

Recorre los 1.680 fotogramas midiendo dónde cae cada texto y dónde está el
móvil, y falla si algo se sale del cuadro, si un texto no cabe en su caja, si
hay un fotograma en negro donde no toca o si el móvil da un tirón. No es
decorado: encontró que en cada corte la cámara se teletransportaba durante un
fotograma, y eso no se ve mirando ochocientas imágenes de una en una.

---

## Qué hace cada archivo

```
src/
  guion.js          Los tiempos y los textos. Es el archivo de Carlos
  escena.html       El lienzo de 1080×1920: colores, tipos, el móvil, el eclipse
  motor.js          pintar(t): deja el lienzo como tiene que verse en el segundo t
  ajustes.mjs       Los fotogramas por segundo y las submuestras
  lienzo.mjs        Abre la escena en un Chromium (con su servidor, que hace falta)
  renderizar.mjs    Fotograma a fotograma, a 60 por segundo → .fotogramas/
  musica.mjs        La banda sonora, sintetizada aquí → .audio/banda.wav
  montar.mjs        ffmpeg: desenfoque de movimiento, H.264 y audio → salida/
  capturar.mjs      Fotografía la aplicación de verdad → capturas/
  datos-demo.mjs    Lo que contesta el servidor durante esas capturas
  apuntes.mjs       Dibuja las fotos de apuntes → material/
  ojear.mjs         Mirar instantes sueltos sin renderizar
  revisar.mjs       Comprueba los 1.680 fotogramas: textos cortados, cosas
                    fuera del cuadro, fotogramas vacíos y saltos del móvil
  todo.mjs          Todo lo anterior seguido
  fuentes/          Hanken Grotesk, Newsreader y Caveat, en local (licencia OFL)
capturas/           La interfaz de ECLIPSE, fotografiada. NO se dibuja a mano
material/           Las fotos de apuntes
salida/             El vídeo y su portada
```

Las carpetas que empiezan por punto (`.fotogramas`, `.audio`, `.ojeadas`) son
intermedias y no van al repositorio: se regeneran solas.

---

## Por qué está hecho así

**Nada de animaciones de CSS.** El motor es una función `pintar(t)` y ya. Una
animación de CSS avanza con el reloj del navegador, no con el del vídeo: cada
captura pillaría la animación donde le apeteciera y el resultado saldría a
tirones. Así, el fotograma 431 es idéntico cada vez que se vuelve a renderizar,
y se puede comparar, corregir y volver a lanzar.

**Las pantallas son capturas de la aplicación de verdad.** Cuesta más que
maquetar una pantalla falsa y es la única forma de que lo que se anuncia sea lo
que hay. Si un día cambia el diseño de ECLIPSE, se vuelve a lanzar
`capturar.mjs` y el anuncio se actualiza solo.

**La música está sintetizada.** Una música de biblioteca tiene licencia, y una
licencia mal leída es un anuncio retirado o un canal con un aviso.
