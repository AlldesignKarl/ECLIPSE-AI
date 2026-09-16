# Las pruebas de ECLIPSE

82 archivos. Todas pasan.

```bash
npm run prueba           # todas (~5,8 min)
npm run prueba:ligeras   # las 60 que no abren navegador (~12 s)
node pruebas/correr.mjs pesadas   # solo las 23 lentas
node pruebas/correr.mjs mapa      # las que lleven "mapa" en el nombre
node pruebas/mapa.test.mjs        # una suelta, con toda su salida
```

## Por qué no hay framework

Cada prueba es un programa de Node que imprime lo que comprueba y sale con 0 si
todo va bien. Eso da tres cosas que aquí importan más que las que da un
framework: se lanza una sola para depurarla, la salida se lee en castellano y
sin descifrar, y no hay una capa de magia entre el fallo y lo que lo causó.

Lo que sí hay es lo que hace falta de verdad: servidores de mentira que hablan
como los servicios reales.

## Cómo están montadas

**`entorno.mjs`** — dónde está todo. La raíz del proyecto se saca de dónde está
este archivo, así que el proyecto se puede mover o clonar y las pruebas siguen
encontrándolo. También trae `crearJiti()` (para importar el TypeScript de `src`
tal cual está, sin compilarlo a mano ni mantener una copia) y `abrirNavegador()`
(que busca el Chromium que haya instalado, sin fijar la versión).

**`apis-falsas.mjs`** — un servidor que habla como Shopify, WooCommerce, Wix,
IONOS, Notion, GitHub y Binance a la vez. Guarda lo que le escriben, así que se
puede comprobar que un cambio llegó de verdad y con qué datos.

**`apis-nuevas.mjs`** — lo mismo para los doce conectores de después
(PrestaShop, Mailchimp, Brevo, Airtable, Trello, Todoist, Slack, Discord,
HubSpot, Calendly, Cloudflare y Vercel). Va aparte y no dentro del anterior
porque aquel sirve a siete pruebas que ya funcionan y meterle doce servicios más
lo convierte en un archivo donde tocar una llave rompe algo que no tiene nada
que ver. Cada uno contesta en su propio prefijo, así que un conector que se
equivoque de ruta se ve en el acto en vez de caer en la respuesta de otro. Imita
también las dos rarezas que importan: Slack y Cloudflare contestan 200 con el
fallo metido dentro del cuerpo.

**`google-falso.mjs`** — un Google con su pantalla de permisos, su endpoint de
testigos y su Gmail. Se comporta como el de verdad en lo que más duele: al
refrescar NO devuelve `refresh_token` y rechaza un testigo caducado, que es
exactamente lo que hace que una conexión OAuth mal escrita funcione hoy y esté
muerta mañana. `estado.duracionCanje` deja dar un testigo que nace caducado,
que es la única forma de probar el refresco con la aplicación levantada.

**`redis-falso.mjs`** — un Redis con API REST que entiende lo que usa la app
(GET, SET, INCR, EXPIRE, DEL, KEYS y `/pipeline`). Tiene `KEYS` a propósito:
sin poder mirar desde fuera qué quedó escrito, una prueba de "el token no está
en claro" se cumpliría mirando una lista vacía, que es no comprobar nada.

Las pesadas levantan la aplicación de verdad (`next start` en un puerto libre)
apuntando al Redis falso y a las APIs falsas, con variables de entorno que
redirigen cada servicio externo: `MOTOR_BASE_GROQ`, `CONEXION_BASE_SHOPIFY`,
`MAPA_BASE_OSM`, `BIBLIOTECA_BASE_COMMONS`…

## Reglas al escribir una prueba nueva

- **Puerto libre de verdad, nunca uno fijo.** Con uno fijo, una ejecución que
  deje el servidor colgado hace que la siguiente hable con el servidor viejo y
  falle por todas partes menos por la que es.
- **Matar el grupo de procesos** al terminar: `process.kill(-app.pid)`. Si no,
  quedan servidores vivos comiéndose el puerto y la memoria.
- **Comprobar lo que se ve, no lo que se llamó.** "Se llamó a la función de
  cifrar" no prueba nada; "en la base de datos no está el token en claro, ni en
  base64" sí.
- **Nada de red de verdad.** En este contenedor está bloqueada, y una prueba que
  depende de que un servicio ajeno esté levantado falla por motivos que no son
  el código.
- **El texto de las comprobaciones, en castellano y contando qué se pierde si
  falla.** Se leen cuando algo se rompe, normalmente con prisa.

## Lo que las pruebas NO cubren

Ninguna ha hablado nunca con la API real de Shopify, Wikimedia, Google Maps,
Stripe ni los modelos de imagen: están todas contra servidores de mentira. Si
algo falla en producción, mira primero la forma de la respuesta real.
