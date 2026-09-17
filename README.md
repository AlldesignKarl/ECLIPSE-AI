<p align="center">
  <img src="public/logo.png" width="120" alt="ECLIPSE" />
</p>

<p align="center">
  <a href="https://eclipse-ia.vercel.app"><strong>eclipse-ia.vercel.app</strong></a>
</p>

<h1 align="center">ECLIPSE AI</h1>

<p align="center">
  Un asistente de IA que responde cualquier pregunta, busca en la web priorizando
  universidades y publicaciones científicas, lee tus archivos, crea imágenes y
  construye bots.
</p>

---

## Qué hace

**Plan Gratis**

- Conversación con razonamiento.
- Búsqueda web con **prioridad a fuentes fiables**: universidades (`.edu`, `.ac.uk`),
  revistas revisadas por pares (Nature, Science, The Lancet…), repositorios
  académicos (arXiv, PubMed, doi.org) y organismos oficiales. Cada respuesta muestra
  las fuentes ordenadas por fiabilidad, con una etiqueta que dice de qué tipo son.
- Analizar **imágenes, PDF y archivos de texto o código** que subas.
- **Crear imágenes** a partir de una descripción.
- Redactar, resumir, traducir, dar ideas y razonar.

**Plan Pro**

- Todo lo anterior, más:
- **Modo Bot**: bots de Discord, Telegram y otros, con todos sus archivos y los
  pasos para arrancarlos. Se ven en un panel y se descargan en ZIP.
- **Modo Profundo** (máximo razonamiento) y **respuestas aceleradas**.

## Cómo se ve

Interfaz oscura pensada para el móvil. Arriba a la izquierda, el botón de
las tres rayas abre el menú con las conversaciones anteriores, el buscador,
el botón de nueva conversación, mejorar plan y ajustes.

Mientras la IA trabaja, el logo del eclipse se anima y al lado se lee qué está
haciendo exactamente: *Pensando*, *Buscando en la web*, *Leyendo fuentes*,
*Escribiendo*, *Creando la imagen*…

---

## Puesta en marcha

### 1. Consigue la clave

| Clave | Para qué | Coste | Dónde |
|---|---|---|---|
| `GROQ_API_KEY` | **La recomendada para empezar.** Chat rápido, ~1.000 mensajes al día. No navega ni ve imágenes. | **Gratis**, sin tarjeta | [console.groq.com/keys](https://console.groq.com/keys) |
| `GOOGLE_API_KEY` | Chat, **búsqueda en Google con fuentes**, lectura de imágenes y PDF, creación de imágenes. Límite diario corto. | **Gratis**, sin tarjeta | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `OPENROUTER_API_KEY` | Modelos abiertos variados, ~50 mensajes al día. Recambio. | **Gratis**, sin tarjeta | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `PRO_ACCESS_CODE` | Tu contraseña para desbloquear el plan Pro. | — | La inventas tú |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Cuentas con correo y contraseña. Sin esto la app va sin registro. | **Gratis**, sin tarjeta | Vercel → Storage → Upstash Redis, o [console.upstash.com](https://console.upstash.com) |

> **Si las cuentas no se activan**, abre `/api/auth` en tu propio dominio. Cuando
> están apagadas responde además `falta: { url, token }`, que dice cuál de las dos
> claves no ha llegado al despliegue. Los dos en `false` casi siempre significan
> que la base de datos está conectada a otro proyecto —fácil de hacer si tienes
> varias cuentas de Vercel—; la solución es copiar las dos variables a mano en el
> proyecto correcto, el que tiene el dominio que estás abriendo. Y recuerda que
> las variables de entorno solo entran en despliegues **nuevos**: después de
> añadirlas hay que redesplegar.
| `ANTHROPIC_API_KEY` | Motor alternativo. | De pago por uso, sin capa gratuita | [console.anthropic.com](https://console.anthropic.com) |

No hace falta ponerlas aquí: desde **Ajustes**, dentro de la aplicación, se elige
el motor y se pega la clave, que se guarda en una cookie `HttpOnly` del navegador.
Si pones varias, se prueban en este orden — `groq`, `google`, `openrouter`,
`anthropic` — y se puede fijar una con `AI_PROVIDER`.

Con `GOOGLE_API_KEY` funciona todo: es el único motor que busca en
la web y lee imágenes. Con `GROQ_API_KEY` se conversa y se programa mucho más
rato antes de topar con el límite, pero sin búsqueda ni archivos adjuntos.

**Los límites de la capa gratuita de Google** son de peticiones por minuto y por
día. Para uso personal sobran; si te pasas, la aplicación te lo dice y basta con
esperar un momento.

La clave se puede poner de dos maneras:

- **Variable de entorno** en el hosting: vale para todo el que entre en la app.
- **Desde la propia app**: menú → *Ajustes* → *Conecta la IA*. Se comprueba con
  Google y se guarda en una cookie `HttpOnly` de ese navegador. Útil cuando
  configurar el panel del hosting desde el móvil se hace cuesta arriba, o para
  probar sin tocar el despliegue. La variable de entorno siempre manda.

### 2. Despliega (recomendado: Vercel, se hace desde el móvil)

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New → Project** y elige este repositorio.
3. En **Environment Variables** pega `GOOGLE_API_KEY` y `PRO_ACCESS_CODE`.
4. **Deploy**. En un par de minutos tienes la URL.

Para activar el plan Pro: abre la app → menú → *Mejorar plan* → escribe tu
`PRO_ACCESS_CODE`. Queda guardado en una cookie firmada, así que el servidor
verifica el plan de verdad: no se puede desbloquear trucando el navegador.

### Cobrar la suscripción (opcional)

El plan Pro puede venderse por suscripción mensual. **Stripe** gestiona el dinero:
las tarjetas, las facturas y las cancelaciones pasan por ellos, y en el servidor de
ECLIPSE nunca entra un número de tarjeta.

1. Crea una cuenta en [stripe.com](https://stripe.com) (gratis; cobran comisión por
   transacción). Para cobrar de verdad hay que verificar identidad y añadir una
   cuenta bancaria.
2. Copia la clave secreta desde **Developers → API keys**.
3. Añade `STRIPE_SECRET_KEY` a las variables de entorno. El precio son 10,00 € al
   mes por defecto; se cambia con `PRO_PRICE_CENTS`.

No hace falta crear productos ni webhooks: el precio se define en la propia
petición y el plan se comprueba consultando la suscripción a Stripe, con una caché
de cinco minutos. Al cancelar desde el portal de Stripe, el acceso Pro decae solo.

`PRO_ACCESS_CODE` sigue funcionando en paralelo como acceso manual, útil para ti
mismo o para dar Pro a alguien sin cobrarle.

### Instalarla en el móvil

Abre la dirección en el navegador y usa **Compartir → Añadir a pantalla de inicio**
(o el menú del navegador en Android). Queda el icono del eclipse junto al resto de
tus apps y se abre a pantalla completa, sin barra de direcciones.

### 3. O en local

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev                  # http://localhost:3000
```

---

## Cómo está hecho

```
src/
  app/
    page.tsx              Punto de entrada
    api/
      chat/               Streaming SSE: razonamiento, búsqueda y texto
      image/              Generación de imagen
      pro/                Activación del plan (cookie firmada con HMAC)
      billing/            Pago con Stripe: checkout, confirmación y portal
      title/              Titula la conversación automáticamente
  components/             Interfaz (React 19)
  lib/
    stripe.ts             Suscripción Pro: pago y verificación
    provider.ts           Elige el motor: Google (gratis) o Anthropic
    gemini.ts             Motor de Google: streaming y búsqueda con fuentes
    anthropic.ts          Motor de Anthropic: cliente y velocidad → esfuerzo
    sources.ts            Clasificación de fiabilidad de fuentes
    prompts.ts            Instrucciones del sistema por modo
    project.ts            Archivos de los proyectos guardados de antes
    storage.ts            Historial en el propio dispositivo
```

**Detalles que importan**

- Hay dos motores: Google (gratis, con búsqueda de Google) y Anthropic (de pago).
  `src/lib/provider.ts` elige, prefiriendo el gratuito. Si el modelo de Google
  configurado deja de existir, la aplicación consulta los disponibles en tu
  cuenta y elige uno en vez de quedarse muerta.

- El historial vive en `localStorage`: no hay base de datos ni cuentas. Lo único que
  sale del dispositivo es el mensaje que estás preguntando.
- Los adjuntos se mandan al modelo pero **no** se guardan en disco (ocuparían megas
  en base64); al recargar queda la ficha del archivo, no su contenido.
- El plan se comprueba **en el servidor** en cada petición. La cookie va firmada con
  HMAC-SHA256 y caduca al año.
- La velocidad del composer se traduce a esfuerzo real del modelo: *Rápido* piensa
  poco y contesta ya, *Profundo* razona a fondo.
- El bucle de herramientas del servidor puede pausarse (`pause_turn`) en búsquedas
  largas; la ruta de chat lo reanuda automáticamente hasta 4 veces.
- Las funciones declaran 60 s de máximo, que es el tope del plan gratuito de Vercel.
  límite. Si te pasa a menudo, sube `maxDuration` en `src/app/api/*/route.ts` (hace
  falta un plan de pago de Vercel, o alojarlo tú).

## La web corporativa de artesanía (`/artesania`)

En el mismo despliegue vive una segunda web, independiente de la aplicación: la
web corporativa de venta de producto artesanal al por mayor. Está en
**`/artesania`** y no toca nada de ECLIPSE.

Para dejarla lista hay que cambiar dos archivos y, si se quiere, poner una
variable:

| Qué | Dónde |
|---|---|
| Nombre, correo, teléfono, WhatsApp, dirección, redes y datos fiscales | `src/lib/artesania/config.ts` |
| Productos: nombre, categoría, descripción, detalle y **foto** | `src/lib/artesania/productos.ts` |
| A dónde llega el formulario | variables de entorno (ver `.env.example`) |

- Lo que no esté puesto **no se pinta**: sin teléfono no sale el botón de
  llamar, sin número no sale WhatsApp. No hay datos de relleno en ningún sitio.
  En desarrollo, abajo a la izquierda, sale una nota con lo que falta.
- Las fotos: deja el archivo en `public/artesania/` y pon la ruta en el producto
  (`imagen: "/artesania/ceramica.webp"`). Mientras sea `null` se pinta una
  lámina de color con el motivo del oficio.
- El formulario prueba tres salidas y usa todas las que estén configuradas:
  `ARTESANIA_WEBHOOK_URL` (Zapier, Make, n8n, tu CRM), Resend
  (`RESEND_API_KEY` + `ARTESANIA_EMAIL_DESTINO`) y la base de datos de ECLIPSE.
  Si no hay ninguna, el formulario **avisa de que no ha podido enviarse** y
  ofrece el correo directo, en lugar de dar las gracias por un mensaje perdido.

---

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # compilar
npm start          # producción
npm run typecheck  # comprobar tipos
```

---

ECLIPSE es un producto de **Eclipse**, empresa fundada por **Carlos Lafuente Pueyo**.
