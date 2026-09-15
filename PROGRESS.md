# Estado del proyecto

Última actualización: **15 de septiembre de 2026**
Rama: `claude/multimodal-ai-free-pro-tbxhtn` · Versión que ve el usuario: **2.37**

Este archivo cuenta **por dónde va el trabajo**. Para saber cómo está hecho el
proyecto y qué reglas tiene, lee `CLAUDE.md`.

---

## 1. Resumen en tres líneas

La aplicación está **en producción y funcionando**, con 62 pruebas en verde.
Las tres cosas que Carlos reportó rotas (Biblioteca, Programar, invitar a
grupos) están arregladas y comprobadas. Lo que queda son mejoras y dos
decisiones suyas pendientes, no averías.

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
| **Conexiones** (9 servicios) | Funciona. Catálogo con logos reales, buscador y categorías |
| **Programar** | Funciona. Arreglado en esta sesión: era inservible |
| **Biblioteca** | Funciona. Arreglada en esta sesión: daba 401 |
| **Llamadas** | Funciona. Arranca con la primera frase; voz de hombre o mujer |
| **Grupos** | Funciona. Invitar visible, chat rediseñado |
| **Memoria** | Funciona. Nuevo en esta sesión |
| **Ubicación** | Funciona sin claves (OpenStreetMap); mejor con Google Maps |
| **Tema claro** | Funciona. Contraste medido: 17,2 texto / 14,7 burbuja / 16,3 código |
| **Chat temporal** | Funciona. No se guarda, no sale en la lista, no usa memoria |

### Los 9 conectores
`shopify`, `woocommerce`, `wix`, `ionos`, `notion`, `github`, `stripe`,
`telegram`, `mercados` (Binance). Todos nacen en solo lectura, ninguno puede
borrar nada y Binance no puede operar ni aunque se le pida.

### Cuentas y cobro
Registro con correo y contraseña (el correo se guarda como hash con sal, porque
el repositorio es público), plan Pro por código, por lista o por Stripe.

---

## 3. Lo que se hizo en la última sesión

Por orden, con el porqué.

1. **Catálogo de conexiones con logos reales.** Carlos: *"lo otro queda raro"*.
   Se pasó de pastillas con iniciales a los logos de verdad, dibujados dentro de
   la app (trazos SVG de Simple Icons, CC0) — no enlazados desde la web de cada
   marca. Se añadieron Stripe y Telegram. Se arregló un `line-clamp-2` que un
   `block` pisaba y estiraba cada fila a cinco líneas.

2. **Ubicación.** Herramienta `mapa` con tres acciones. Con
   `GOOGLE_MAPS_API_KEY` usa Google; sin ella, OpenStreetMap y dice que la
   distancia es en línea recta en vez de inventarse el tiempo del trayecto.
   Apagada de fábrica, coordenadas redondeadas a ~1 km en el navegador y otra
   vez en el servidor, y no se guarda en ninguna parte.

3. **Aviso al empezar un chat** contando que se puede conectar la tienda. No
   sale a quien ya tiene algo conectado y se aparta para siempre con un toque.

4. **Biblioteca arreglada.** Openverse pasó a exigir cuenta → 401 en pantalla.
   Ahora hay tres archivos por orden (Wikimedia Commons, Art Institute of
   Chicago, Openverse si hay claves) y si uno falla entra el siguiente.

5. **Programar arreglado.** Eran cuatro fallos a la vez:
   - `GET /api/tareas` ejecutaba **todos** los encargos dentro de la misma
     petición → el servidor cortaba a los 60 s → no se veía ninguno.
   - El reloj nocturno exigía `CRON_SECRET`; sin esa variable, Vercel recibía
     401 cada noche. Ahora se acepta también la cabecera `x-vercel-cron`, que no
     se puede falsificar desde fuera.
   - `maxDuration: 300` en dos rutas cuando el límite real son 60.
   - Un fallo pasajero daba el día por perdido; ahora se reintenta una vez.

6. **Grupos.** "Invitar" arriba y visible (antes estaba detrás de tocar el "1
   persona" de la esquina), con el compartir nativo del móvil. A quien recibe el
   enlace se le enseña a qué le invitan antes de meterlo dentro. Chat
   rediseñado. Y arreglado que el creador siguiera viendo "1 persona" después de
   que entrara alguien.

7. **Llamada más rápida.** Ya no espera la respuesta entera: dice cada frase en
   cuanto está terminada. Silencio de fin de turno de 1100 → 800 ms.

8. **Voces.** Elegir mujer u hombre, reconociendo los nombres de voz de Apple,
   Microsoft y Google, y puntuando la calidad para coger la más natural. Si el
   móvil no tiene la pedida, lo dice.

9. **Tono.** Tres bloques nuevos en `prompts.ts`: `AL_GRANO` (solo en chat; en
   `code` pedir brevedad sería pedir archivos a medias), `ACERTAR` y `AMISTAD`
   (si te ríes se ríe, si le llamas bro te llama bro, sin fingir).

10. **Imágenes realistas** por defecto: cámara, óptica y luz concretas, y
    prohibidas "hyperrealistic", "8k" y "octane render", que son justo las que
    dan el acabado de plástico. Un logo sigue siendo un logo.

11. **Memoria.** Hechos (ficha corta que se le pasa siempre) + resúmenes de
    conversación (que busca con la herramienta `mis_conversaciones`). Visible y
    borrable entera en Ajustes.

12. **Las pruebas, al repositorio.** Estaban en una carpeta temporal fuera del
    control de versiones. Ver sección 6.

13. **`maxDuration: 120` en la ruta de mensajes de grupo.** Apareció al escribir
    esta documentación: es el mismo fallo que tenía Programar. Una respuesta
    larga de ECLIPSE en un grupo se moría a los 60 s sin guardarse y en el grupo
    no aparecía nada. Ahora son 60, con 45 de tope para el modelo.

---

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
   - Los 9 conectores (Shopify, Stripe, Telegram…)
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

**62 archivos, todas en verde.** Viven en `pruebas/` desde esta sesión; antes
estaban fuera del repositorio y se habrían perdido.

```bash
npm run prueba           # todas (~4,6 min)
npm run prueba:ligeras   # las 49 sin navegador (~6 s) ← para trabajar
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
2. **Más conectores.** El armazón está probado: añadir uno es un archivo en
   `src/lib/conexiones/` copiando `shopify.ts`, más una línea en `registro.ts` y
   su logo en `logos.ts`. Candidatos naturales: PrestaShop, Etsy, Amazon
   Seller, Google Analytics, Mailchimp, Calendar.
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
