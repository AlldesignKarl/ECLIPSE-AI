# Estado del proyecto

Última actualización: **15 de septiembre de 2026**
Rama: `claude/eclipse-context-review-a9rx0q` (sale de
`claude/multimodal-ai-free-pro-tbxhtn`, que está en el mismo sitio) · Versión que
ve el usuario: **2.38**

Este archivo cuenta **por dónde va el trabajo**. Para saber cómo está hecho el
proyecto y qué reglas tiene, lee `CLAUDE.md`.

---

## 1. Resumen en tres líneas

La aplicación está **en producción y funcionando**, con 66 pruebas en verde.
En esta sesión se han hecho las tres cosas que pidió Carlos: ECLIPSE se ve y se
configura dentro de los grupos, hay 21 conexiones en vez de 9, y Programar tiene
calendario y monta el plan él solo. Lo que queda son mejoras y dos decisiones
suyas pendientes, no averías.

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

## 3. Lo que se hizo en la última sesión

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

4. **Cuatro pruebas nuevas** (62 → 66): `eclipse-grupo`, `conectores-nuevos`,
   `catalogo` y `planear`, más ampliaciones en `tareas` y `programar-api`.

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

**66 archivos, todas en verde.** Viven en `pruebas/`.

```bash
npm run prueba           # todas (~4,7 min)
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
5. **Adjuntar imágenes en los grupos.** Ahora solo texto.
6. **Notificaciones push** cuando termina un encargo programado.

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
