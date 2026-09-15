# Estado del proyecto

Última actualización: **15 de septiembre de 2026** (tercera sesión del día)
Rama: `claude/multimodal-ai-free-pro-tbxhtn`, la de siempre · Versión que ve el
usuario: **2.41**

Este archivo cuenta **por dónde va el trabajo**. Para saber cómo está hecho el
proyecto y qué reglas tiene, lee `CLAUDE.md`.

---

## 1. Resumen en tres líneas

La aplicación está **en producción y funcionando**, con 70 pruebas en verde.
Lo último: Programar abre en un **calendario de quedadas** que te mete en su
chat, en los grupos ya se mandan **fotos** y se puede **borrar** lo que sobre
—mensajes y el grupo entero—, la **ubicación se pide una sola vez** y el eclipse
está de fondo. Lo que queda son mejoras, no averías.

---

## 2. Qué funciona ahora mismo

Todo esto está hecho, probado y desplegado.

### Chat y modelos
- Conversación con búsqueda web, fuentes ordenadas por fiabilidad y citas.
- Cinco motores con elección automática; si uno no ve imágenes y hay una foto
  delante, se cambia solo en vez de dar un error.
- Detección de "no puedo ver imágenes" y reintento con otro motor.
- Lectura de imágenes, PDF y archivos; conversión de formatos con marca de agua.
- ECLIPSE CODE: proyectos completos con vista previa en iframe aislado y ZIP.
- La respuesta aparece a un ritmo legible (~210 caracteres/s medidos en un
  navegador de verdad), no a tirones.

### Las nueve cosas grandes
| Zona | Estado |
|---|---|
| **Conexiones** (21 servicios) | Funciona. Catálogo con logos reales, buscador y categorías |
| **Programar** | Funciona. Calendario de 14 días y plan automático, nuevos en esta sesión |
| **Biblioteca** | Funciona. Arreglada en esta sesión: daba 401 |
| **Llamadas** | Funciona. Arranca con la primera frase; voz de hombre o mujer |
| **Grupos** | Funciona. ECLIPSE visible dentro, con interruptor de cuándo habla |
| **Memoria** | Funciona. Nuevo en esta sesión |
| **Ubicación** | Funciona sin claves (OpenStreetMap); mejor con Google Maps |
| **Tema claro** | Funciona. Contraste medido: 17,2 texto / 14,7 burbuja / 16,3 código |
| **Chat temporal** | Funciona. No se guarda, no sale en la lista, no usa memoria |

### Los 21 conectores
Comercio: `shopify`, `woocommerce`, `prestashop`, `wix`. Dinero: `stripe`.
Trabajo: `hubspot`, `notion`, `airtable`, `trello`, `slack`. Agenda: `todoist`,
`calendly`. Correo: `mailchimp`, `brevo`. Mensajes: `telegram`, `discord`.
Webs y dominios: `github`, `vercel`, `ionos`, `cloudflare`. Mercados:
`mercados` (Binance).

Todos nacen en solo lectura, ninguno puede borrar nada y Binance no puede
operar ni aunque se le pida. De los doce nuevos, nueve no tienen ni una acción
que escriba.

### Cuentas y cobro
Registro con correo y contraseña (el correo se guarda como hash con sal, porque
el repositorio es público), plan Pro por código, por lista o por Stripe.

---

## 3. Lo último: cómo contesta, y lo que cuesta cada mensaje

Objetivo de Carlos: que ECLIPSE se sienta inteligente, rápido y natural, sin
cambiar de modelo y sin gastar más tokens. Medido antes y después, en una
conversación con recorrido (30 turnos, 20 hechos en memoria):

| | Antes | Después |
|---|---|---|
| Instrucciones | 4.241 tokens | 3.604 |
| Memoria | 402 (20 hechos siempre) | dentro, y solo la que viene a cuento |
| Historial | 4.110 (entero) | 2.522 (recortado) |
| **Total por mensaje** | **8.753** | **6.315 (−28%)** |

Qué se ha hecho:

1. **El prompt, sin lo que decía dos veces.** `IDENTITY` repetía con otras
   palabras lo que ya dicen `AL_GRANO`, `ACERTAR` y el bloque de tono. Un prompt
   que dice dos veces lo mismo no obedece el doble: ocupa el sitio de la
   respuesta, en cada mensaje.
2. **Reglas nuevas de comportamiento**: de uno a cuatro párrafos cortos por
   defecto; listas solo si se lee mejor; prohibidas por su nombre las muletillas
   de robot; no decir que ha hecho algo que no ha hecho; no inventarse IDs,
   precios, APIs ni funciones de la propia app; si falta un dato, pedir ese y
   solo ese.
3. **`REPASO`**: repasa por dentro antes de contestar (¿he entendido?, ¿es
   correcto?, ¿me invento algo?, ¿me alargo?) y **ese repaso no se escribe
   nunca**. Es una lista de comprobación, no un "piensa paso a paso": lo segundo
   es lo que hace que un modelo publique su razonamiento.
4. **`lib/memoria/relevancia.ts`**: en cada mensaje van las preferencias (cómo
   quiere las respuestas, en qué idioma) y lo que tenga que ver con lo que acaba
   de escribir. Con un mínimo de cuatro para las preguntas vagas.
5. **`lib/estilo.ts`**: saca de sus últimos mensajes si escribe corto o largo, si
   es formal o coloquial, si usa emojis y si es técnico, y se lo dice al modelo
   en una línea (80 tokens) con la orden expresa de no imitarle. No cuesta ni una
   llamada al modelo ni una lectura de base de datos.
6. **`compactarHistorial()`**: el primer mensaje y los doce últimos van enteros;
   lo de en medio, a una línea. Lo que lleva código no se toca.
7. **El extractor de memoria, más estricto**: un hecho tiene que cumplir las
   cuatro condiciones (es suyo, sigue siendo verdad dentro de un mes, sirve para
   ayudarle otro día, y cabe en una frase). Y en la duda, no se guarda.
8. **`pruebas/contexto.test.mjs`**: un presupuesto escrito de lo que puede
   ocupar todo esto. Si alguien añade reglas de más, falla ahí.

---

## 3 bis. Quedadas, fotos, borrar y la ubicación

Lo que pidió Carlos, entero:

1. **Un calendario para quedar.** `Programar` abre ahora en **Quedadas** (los
   encargos siguen ahí, en su pestaña). Se toca un día del mes, se escribe la
   nota y se cae **directo dentro del chat** de esa quedada, con el día escrito
   en cristiano ("martes, 21 de octubre") y la nota arriba, siempre a la vista.
   Por dentro **una quedada es un grupo con fecha**: nace con el invitar por
   enlace, las fotos, el borrar y ECLIPSE dentro con su interruptor. Un segundo
   chat paralelo habría sido mantener dos cosas iguales y que una se quedara
   atrás.
2. **Solo se entra con cuenta.** El enlace enseña de qué va la quedada y de
   quién es, y para pasar hay que estar registrado. Era condición suya.
3. **Fotos en los grupos y en las quedadas.** La foto se encoge en el móvil
   (1280 px, JPEG) y se guarda **en su propia clave de Redis**; el mensaje solo
   lleva su identificador. Metidas dentro del mensaje, abrir un grupo con
   cuarenta fotos se traería megabytes antes de enseñar nada. Se sirven con
   `Cache-Control: private` y solo a quien está dentro del grupo (a los demás,
   403). Tope de 40 por grupo: al entrar la 41, se va la más vieja con su foto.
4. **Borrar.** Tocas un mensaje tuyo y sale «Borrar». Quien montó el grupo puede
   borrar cualquiera, y el grupo entero —con sus mensajes y sus fotos—; los
   demás pueden salirse. Un sitio del que no se puede salir no es un sitio.
5. **La ubicación, una vez.** Se pedía dos veces por pregunta: había dos
   llamadas a la vez y ninguna sabía de la otra. Ahora comparte una sola promesa
   en curso, mira el permiso antes de pedirlo (si está denegado no enseña nada)
   y si falla se apunta 12 horas sin volver a molestar.
6. **El fondo.** El eclipse que mandó Carlos, en `public/fondo.webp` (10 KB: del
   PNG de 1,08 MB, que en un móvil con datos era medio segundo en blanco). Solo
   en tema oscuro, con una capa por encima para que el texto siga legible.

Y un fallo que salió al probarlo en un navegador de verdad: el chat de la
quedada se pintaba **dentro** del modal de Programar, y un modal dentro de otro
modal deja el fondo oscuro del de fuera por encima: se veía perfecto y no
respondía ni un toque. Ahora `ProgramarDialog` pinta el chat **en lugar de** su
modal.

---

## 3 bis. Antes: arreglar lo que estaba roto en producción

Carlos lo probó en su móvil y falló casi todo lo de la sesión anterior. Las
causas, y lo que se ha hecho:

1. **ECLIPSE no contestaba en los grupos y Programar no podía planificar.**
   Mismo motivo: las dos cosas están escritas sobre el bucle de herramientas y
   solo hablaban con Mistral, Groq y OpenRouter. Con Google de motor devolvían
   un aviso (`sin_motor`) que no se pintaba en ninguna parte. Ahora existe
   `lib/una-respuesta.ts`, que consigue una respuesta entera del motor que haya
   —los cinco— y prueba el siguiente si el primero falla. Y cuando no puede,
   **dice por qué**, con las palabras del motor que falló.

2. **Un fallo que no se veía:** las respuestas de una sola pieza (el título, el
   plan) pedían el modelo escrito a mano en el preset, mientras que el chat
   resuelve cuál tiene la cuenta. Con una clave gratuita que no llega a ese
   modelo, el chat iba y lo demás fallaba en silencio. Ahora todo usa
   `modeloSuelto()`.

3. **Los mensajes de grupo tardaban una eternidad.** Mandar uno esperaba a que
   el modelo escribiera la respuesta entera. Ahora son dos peticiones: guardar
   vuelve en **15 ms medidos**, y responder va aparte. Además el mensaje se
   pinta al momento, el vistazo pasó de 3 s a 1,5 (0,9 mientras escribe) y hay
   puntitos de "escribiendo".

4. **ECLIPSE viene de fábrica en cada grupo contestando a todo.** Era "solo si
   le nombras" y la realidad es que nadie daba con la palabra: escribió
   «ECLIPSE» dos veces y no contestó nadie. El modo de antes sigue, a dos
   toques.

5. **Las voces.** Cambiar de voz a mitad de llamada no hacía nada: los ajustes
   se leían al descolgar y no se volvían a mirar. Y en Android las voces se
   llaman `es-es-x-eed-local`, así que "hombre" y "mujer" devolvían la MISMA
   voz. Ahora los cambios entran al momento, se reconoce el patrón de Android,
   y —lo que de verdad lo arregla— se pueden **escuchar y elegir una por una**
   las voces del móvil, marcando las de red, que son las que no suenan a robot.

6. **Ajustes**: perfil con foto (se recorta y encoge en el navegador: 6 KB en
   vez de la foto entera), interruptor de memoria que apaga las dos cosas —usar
   y aprender—, seguridad (cambiar contraseña y borrar la cuenta con todo lo que
   hay de ti) y la voz de las llamadas.

7. **Más rápido**: las ocho pantallas grandes se traen solo al abrirlas (la
   primera carga baja de 166 kB a 151 kB) y la aplicación **se actualiza sola**
   cuando el servidor tiene otra versión.

### Lo de los logos, que no era un fallo del código

Carlos vio las conexiones nuevas con pastillas de iniciales en vez de logos.
El código estaba bien —se comprobó en un navegador de verdad—: lo que tenía
cargado el móvil era la página vieja hablando con el servidor nuevo. Los datos
vienen del servidor y los logos viven en el JavaScript de la página. De ahí la
recarga automática por versión: el fallo no era el dibujo, era no enterarse de
que había una versión nueva.

---

## 3 bis. Lo que se hizo en la sesión anterior

Carlos pidió tres cosas. Las tres están hechas y probadas.

1. **ECLIPSE dentro de los grupos, a la vista.** Estaba desde el principio,
   pero no se veía en ninguna parte: no salía en la lista de gente y la única
   forma de descubrir que contestaba era nombrarle por casualidad. Ahora aparece
   junto a la gente, con su marca, y quien creó el grupo elige cómo está: **a
   todo**, **si le nombráis** (lo de antes, y sigue siendo lo normal) o **no
   está**. En modo "a todo" se le añade un bloque de instrucciones aparte, porque
   contestar a todo sin más se convierte en tres párrafos contestando a un
   "jajaja". Los grupos que ya existían no llevan el dato guardado y se les
   supone "si le nombráis", que es como se estaban comportando.

2. **Doce conexiones nuevas, de 9 a 21.** PrestaShop, HubSpot, Airtable, Trello,
   Todoist, Calendly, Mailchimp, Brevo, Slack, Discord, Vercel y Cloudflare. Dos
   categorías nuevas en el catálogo (Agenda y Correo) y los logos de verdad,
   trazo a trazo, sacados de Simple Icons (CC0) como los otros nueve.

   Slack y Cloudflare contestan 200 **con el fallo metido dentro del cuerpo**:
   si se mirara solo el código de estado, una clave mala se guardaría como
   buena. Los dos conectores miran el cuerpo, y hay una prueba de eso.

3. **Programar: calendario y plan automático.** Dos cosas:
   - **Calendario** de los próximos 14 días con lo que cae en cada uno, y
     encargos para **un día concreto** ("el 3, prepárame lo del viaje") y para
     un **día del mes**. La cuenta la hace `proximosDias()`, la misma función
     que usa el servidor para decidir qué ejecuta: lo que se ve es lo que va a
     pasar.
   - **Que lo planifique él**: dices qué quieres conseguir y devuelve un plan
     repartido por días, en segundos y **sin guardar nada**. Se mira, se le quita
     lo que no y se acepta entero de un toque; y si no cuadra, se le pide el
     cambio con palabras ("mejor los martes", "uno menos", "¿tú qué harías?").
   - **"Hacerlo ahora"** en cada encargo, para ver lo que da sin esperar a
     mañana.

4. **Cinco pruebas nuevas** (62 → 67): `eclipse-grupo`, `conectores-nuevos`,
   `catalogo`, `planear` y `programar-ui` (esta última, la pantalla nueva en un
   navegador de verdad), más ampliaciones en `tareas`, `programar-api` y
   `grupos-ui`.

## 4. Decisiones importantes que están tomadas

Para no volver a discutirlas, y para poder cambiarlas sabiendo lo que se cambia.

- **Los logos se dibujan, no se enlazan.** Enlazarlos desde la web de cada marca
  gasta su ancho de banda, se rompe el día que muevan un archivo y les cuenta
  quién abre esa pantalla.
- **La Biblioteca usa varias fuentes por diseño.** Depender de una sola fue
  exactamente lo que produjo el 401.
- **Programar hace un encargo por petición.** No es una optimización: es la
  única forma de caber en los 60 s de Vercel.
- **La ubicación se redondea dos veces.** El redondeo es la promesa de que no
  guardamos el portal de nadie, y una promesa que solo se cumple en el navegador
  no es una promesa.
- **La memoria guarda frases, no conversaciones.** Es lo que permite que la app
  mejore con el uso sin convertirse en un archivo de todo lo que dices.
- **La memoria está ENCENDIDA por defecto** porque Carlos lo pidió así. Está
  pendiente de que él decida si prefiere que haya que activarla (ver sección 7).
- **Un grupo nace con ECLIPSE callado hasta que le nombran**, no contestando a
  todo. Es lo que hace que una conversación de cinco personas siga siendo una
  conversación; quien quiera lo otro, lo enciende en dos toques.
- **Planificar no ejecuta.** Es lo que hace que conteste en segundos, y lo que
  permite enseñar el plan antes de que exista nada.
- **Un encargo de un día concreto se apaga solo al hacerse.** Como esos encargos
  siguen tocando aunque su día ya pasara —para no perderse si el reloj no
  sonó—, sin apagarlos se repetirían cada día para siempre.
- **`AL_GRANO` no entra en modo `code`.** Pedir brevedad donde la respuesta es un
  archivo entero es pedir un archivo cortado.
- **Fundir hechos parecidos usa umbral 0,8 y mínimo 3 palabras.** Con 0,7,
  "tienda de ropa en Shopify" y "tienda de bicis en Shopify" se comían la una a
  la otra. Fundir de más pierde un dato; de menos solo deja una línea repetida.

---

## 5. Problemas conocidos

Ninguno bloquea nada, pero conviene saberlos.

1. **Lo que no se ha podido probar contra el servicio real.** El contenedor
   tiene casi todo internet bloqueado, así que estas integraciones están
   probadas contra servidores de mentira que hablan como ellas, pero **nunca se
   han visto funcionar contra la API de verdad**:
   - Wikimedia Commons y Art Institute (Biblioteca)
   - OpenStreetMap / Nominatim y Google Maps (ubicación)
   - Los 21 conectores (Shopify, Stripe, Telegram…). Los doce nuevos, más aún:
     están escritos contra la documentación de cada API y probados contra un
     servidor que habla como ella, pero nadie ha visto todavía una respuesta de
     verdad de PrestaShop, Slack o HubSpot.
   - Los modelos de imagen (Pollinations, Cloudflare)
   Si algo de esto falla en producción, el fallo estará en la forma de la
   respuesta real, no en la lógica.

2. **El `README.md` está desfasado.** Describe la app de hace varias versiones:
   no menciona Conexiones, Programar, Biblioteca, Llamadas, Grupos, Memoria ni
   Ubicación. Es lo primero que ve quien llega al repositorio.

3. **`src/components/ChatApp.tsx` tiene 1478 líneas** y `prompts.ts` 1306.
   Funcionan y están comentados, pero son los dos archivos donde es más fácil
   equivocarse.

4. **La memoria depende de que haya motor en el SERVIDOR.** Si la clave está
   solo en la cookie del navegador de alguien, no se aprende nada. No falla:
   simplemente no se acuerda, y no hay forma de que el usuario se entere.

5. **Vercel gratuito corta a 60 s.** Con muchos usuarios con encargos
   programados, el reloj nocturno no dará abasto (deja lo que no entre para la
   siguiente pasada o para cuando abran la app, así que no se pierde nada, pero
   se retrasa).

6. **`ubicacion.test.mjs` tarda 139 s**, casi la mitad de lo que tarda la suite
   entera. Espera a diálogos de permiso del navegador.

---

## 6. Las pruebas

**70 archivos, todas en verde.** Viven en `pruebas/`.

```bash
npm run prueba           # todas (~6 min)
npm run prueba:ligeras   # las 53 sin navegador (~10 s) ← para trabajar
node pruebas/mapa.test.mjs   # una suelta
```

No hay framework a propósito: cada prueba es un programa de Node que sale con 0
si va bien, así que se puede lanzar sola y lo que falla se lee en cristiano.
Levantan servidores de mentira (`apis-falsas.mjs`, `redis-falso.mjs`) y, cuando
hace falta, la aplicación entera con Playwright. Detalles en `pruebas/LEEME.md`.

---

## 7. Qué hay pendiente

### Dos decisiones de Carlos (no son trabajo, son respuestas)

1. **¿La memoria encendida por defecto, o que cada uno la active?** Ahora está
   encendida, que es lo que pidió. Ponerle un interruptor son ~10 minutos.
2. **¿Plan de pago en Vercel?** Solo hace falta el día que haya bastante gente
   con encargos programados.

### Mejoras que tienen sentido, por orden

1. **Actualizar el `README.md`** con lo que hace la app hoy. Es lo que ve quien
   llega al repositorio, y miente.
2. **Los conectores que faltan piden OAuth.** Los que quedan por interés
   —Google Calendar, Gmail, Google Analytics, Etsy, Amazon Seller— no se
   conectan pegando una clave: hay que montar el baile de OAuth (pantalla de
   permisos, vuelta con el código, refresco del testigo y dónde guardarlo). Eso
   es un trabajo aparte del de escribir un conector, y hasta que exista no se
   pueden añadir. Los que sí se pueden hacer como los 21 de ahora: Etsy no,
   Mailerlite sí, Sendgrid sí, BigCommerce sí, Webflow sí.
3. **Partir `ChatApp.tsx`.** 1478 líneas. Los diálogos ya están fuera; lo que
   queda por separar es el envío y el estado de la conversación.
4. **Que la memoria avise cuando no puede aprender** (problema 4 de arriba), o
   al menos que se vea en Ajustes.
5. **Notificaciones push** cuando termina un encargo programado.

### Lo que NO hay que hacer aunque parezca buena idea

- Meter las conversaciones en el servidor "para sincronizarlas". Es una promesa
  del producto y hay que hablarlo con Carlos antes.
- Hacer que las conexiones puedan borrar. Ninguna puede, y es deliberado.
- Dejar que Binance opere. Nunca.

---

## 8. Si empiezas una sesión nueva

1. Lee `CLAUDE.md` entero.
2. `npm install && npm run build && npm run prueba:ligeras` para ver que el
   proyecto está sano antes de tocar nada.
3. Mira `git log --oneline | head -20`: los mensajes de commit cuentan el porqué
   de cada cambio con detalle.
4. Si Carlos pide algo que parece ya hecho, búscalo primero: puede que esté y no
   lo encuentre en la interfaz, que es un problema distinto y más fácil.
