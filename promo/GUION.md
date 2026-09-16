# ECLIPSE · anuncio vertical

**1080 × 1920 · 30 fps · 28 s · H.264 · sin copyright de nadie.**
Para TikTok, Instagram Reels y YouTube Shorts.

Archivo final: `promo/salida/eclipse-promo.mp4`.
Portada para la miniatura: `promo/salida/eclipse-promo-portada.jpg`.

---

## La idea

Un anuncio de veintiocho segundos no puede explicar nueve funciones. Cuenta
**una** cosa, y aquí la cosa es la que hace distinto a ECLIPSE:

> Estudia contigo, con TUS apuntes, y **nunca se lo inventa**.

Todo lo demás está al servicio de eso. Por eso el anuncio va del Modo Examen y
del chat con fuentes, y no de las veintiuna conexiones ni de ECLIPSE CODE: son
buenos, pero no son la frase.

## La regla que no se rompe

**No sale ni una pantalla dibujada.** Todas las capturas son la aplicación de
verdad, corriendo en un navegador de verdad, fotografiada por `capturar.mjs`. Lo
único que se sustituye son las respuestas del servidor —no hay claves de modelo
ni base de datos en el contenedor donde se monta esto—, y se sustituyen
respetando exactamente las formas de `src/lib/types.ts` y `src/lib/examen/tipos.ts`.

Y no se anuncia nada que la aplicación no haga. Lo que sale es, en orden:
adjuntar fotos de apuntes en el chat, la respuesta con las fuentes ordenadas por
fiabilidad, y del Modo Examen el mapa de "qué entra", el resumen, el test, la
corrección con su explicación y el progreso por temas. Las siete pantallas
existen. Tampoco se dice el precio: el Modo Examen es del plan Pro y un "gratis"
en pantalla sería mentira a medias.

---

## Storyboard

| Escena | Tiempo | Qué se ve | Texto en pantalla |
|---|---|---|---|
| **1 · Hook** | 0,0 – 3,4 s | Negro. Una línea de luz se abre a lo ancho y florece: de ella se traza el anillo del eclipse, con sus llamaradas y su luz de detrás. | `ECLIPSE` · *La IA que estudia contigo.* |
| **2 · El problema** | 3,4 – 6,8 s | El eclipse se apaga. Nueve fotos de apuntes entran de lejos, desenfocadas por la velocidad, y se amontonan. Luego el eclipse vuelve y se las traga hacia el centro. | *Demasiado que estudiar.* |
| **3 · En acción** | 6,8 – 14,2 s | El móvil sube a plano con la aplicación dentro. Dos apuntes adjuntos y la pregunta escrita. Una barra de luz recorre la pantalla: los está leyendo. La cámara entra a la respuesta y a sus fuentes, y de ahí al mapa de temas. | *Le das tus apuntes.* → *Responde con las fuentes delante.* → *Y te dice qué entra.* |
| **4 · Estudio** | 14,2 – 20,5 s | Cuatro pantallas del Modo Examen, 1,6 s cada una, con la cámara moviéndose entre ellas. | *Te resume.* → *Te pregunta.* → *Te corrige.* → *Y sabe por dónde flojeas.* |
| **5 · Hero** | 20,5 – 24,2 s | La cámara se aleja, el móvil se pone de frente y entero, y el eclipse aparece **detrás** de él, más ancho que el teléfono, con las llamaradas cruzando el cuadro. | *Nunca se lo inventa.* · Solo lo que hay en tus apuntes. |
| **6 · Cierre** | 24,0 – 28,0 s | Fondo limpio. El eclipse, el nombre y la dirección. | `ECLIPSE` · *La IA que estudia contigo.* · `eclipse-ia.vercel.app` |

Los tiempos exactos están en `src/guion.js`, que es el archivo que hay que tocar
para cambiarlos.

---

## Las decisiones de dirección

**La cámara nunca recorta la interfaz.** El primer planteamiento ampliaba la
captura para que se leyera la letra, y se comía la primera palabra de cada línea.
Ahora lo que se acerca es el teléfono, como haría una cámara: se sale del cuadro
por arriba y por abajo, pero lo que se ve se ve entero. En un anuncio de una
aplicación, una palabra cortada es peor que una letra pequeña.

**El rótulo va sobre un velo, no sobre la interfaz.** Cuando la cámara está
cerca, el móvil ocupa el cuadro entero. Un degradado oscuro por arriba deja el
texto legible sin tapar lo que hay debajo. Es lo que hace el cine con los
rótulos, y por eso no se nota.

**Nada se mueve porque sí.** El teléfono entra de canto y va girando hasta
ponerse de frente en el plano hero: el movimiento tiene un destino. El eclipse
del principio se apaga cuando llegan los apuntes justo para poder volver a
tragárselos. Las siete pantallas no se funden: la cámara se mueve entre ellas,
porque un fundido con la cámara quieta es un pase de diapositivas.

**Desenfoque de movimiento de verdad.** Se graba a 60 y se monta a 30
promediando cada dos fotogramas. Eso es un obturador de 180°, lo mismo que hace
una cámara de cine, y es la diferencia entre una carta que cruza la pantalla y
cuatro copias de una carta.

**Dos golpes, y solo dos.** A los 6,8 s (llega el producto) y a los 20,5 s (se
abre el hero). Un anuncio con un golpe cada dos segundos no tiene ninguno.

**Se comprueba solo.** `promo/src/revisar.mjs` recorre los 1.680 fotogramas y
mide dónde cae cada texto y dónde está el móvil: falla si algo se sale del
cuadro, si un texto no cabe, si hay un fotograma vacío o si el móvil da un
tirón. Encontró un fallo que no se ve mirando imágenes sueltas —en cada corte
la cámara saltaba durante un fotograma— y por eso ahora la cámara va aparte de
las pantallas y es continua.

---

## La música

Está **sintetizada nota a nota** en `src/musica.mjs`: no viene de ninguna
biblioteca, así que no tiene licencia que leer ni aviso que recibir. Se genera
igual cada vez y sus tiempos salen de `guion.js`, así que si se mueve una escena
la música se mueve con ella.

| Momento | Qué suena |
|---|---|
| 0,0 – 0,8 s | Subida de ruido muy baja. Silencio casi. |
| 0,75 s | Golpe suave: nace el eclipse. |
| 0,8 – 3,3 s | Subgrave en La y colchón de cuerdas. Campana en Mi al aparecer el nombre. |
| 3,3 – 5,3 s | El colchón cambia de acorde. Tensión que sube con los apuntes. |
| 5,3 – 6,8 s | **Subida** de ruido filtrado, abriéndose. |
| **6,8 s** | **GOLPE.** Subgrave de 74 a 28 Hz. Cambia a Fa. |
| 7,75 – 20,5 s | Entra el **pulso**: compás de 1,6 s clavado en los cortes del montaje. Cada cambio de pantalla cae en un compás. |
| 19,2 – 20,5 s | Segunda subida. |
| **20,5 s** | **GOLPE GRANDE** y el pulso **se para en seco**. Do mayor —el único acorde alegre— y dos campanas. El silencio del ritmo es el golpe más fuerte que tiene la pieza. |
| 23,9 – 28,0 s | Vuelve La menor, campana del cierre, otra en la dirección web, y se apaga antes de que acabe la imagen. |

Debajo de todo, desde los 2,6 s, hay una capa de aire (ruido muy filtrado) que
no se oye y que se nota cuando falta: sin ella hay agujeros de silencio entre
acorde y acorde.

Si en algún momento se quiere cambiar la música por otra, el vídeo **sin audio**
sale quitando `-map 1:a` en `src/montar.mjs`, y los puntos de sincronía son los
de la tabla de arriba.

---

## Los textos

Siete frases, ninguna de más de cinco palabras salvo dos. Están todas juntas en
`TEXTOS`, en `src/guion.js`. Cambiar una es cambiar una línea.

La frase de apertura y la de cierre son **la misma** a propósito: es lo que hace
que un anuncio de veintiocho segundos se recuerde como una idea y no como una
lista.
