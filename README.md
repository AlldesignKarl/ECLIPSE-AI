<p align="center">
  <img src="public/logo.png" width="120" alt="ECLIPSE" />
</p>

<h1 align="center">ECLIPSE AI</h1>

<p align="center">
  Un asistente de IA que responde cualquier pregunta, busca en la web priorizando
  universidades y publicaciones científicas, lee tus archivos y crea imágenes,
  vídeo y proyectos de código completos.
</p>

---

## Qué hace

**Plan Gratis**

- Conversación con razonamiento (modelo Claude Opus 5).
- Búsqueda web con **prioridad a fuentes fiables**: universidades (`.edu`, `.ac.uk`),
  revistas revisadas por pares (Nature, Science, The Lancet…), repositorios
  académicos (arXiv, PubMed, doi.org) y organismos oficiales. Cada respuesta muestra
  las fuentes ordenadas por fiabilidad, con una etiqueta que dice de qué tipo son.
- Analizar **imágenes, PDF y archivos de texto o código** que subas.
- **Crear imágenes** a partir de una descripción.
- Redactar, resumir, traducir, dar ideas, programar cosas sueltas, razonar.

**Plan Pro**

- Todo lo anterior, más:
- **Generación de vídeo** (Veo).
- **Modo código**: proyectos completos, con todos los archivos, listos para ejecutar.
  Se ven en un panel con árbol de archivos, se descargan en ZIP o se suben…
- **…directamente a GitHub**, creando el repositorio si hace falta.
- **Modo Profundo** (máximo razonamiento) y **respuestas aceleradas**.

## Cómo se ve

Interfaz oscura pensada para el móvil. Arriba a la izquierda, el botón de
las tres rayas abre el menú con las conversaciones anteriores, el buscador,
el botón de nueva conversación, mejorar plan, GitHub y ajustes.

Mientras la IA trabaja, el logo del eclipse se anima y al lado se lee qué está
haciendo exactamente: *Pensando*, *Buscando en la web*, *Leyendo fuentes*,
*Escribiendo*, *Creando la imagen*…

---

## Puesta en marcha

### 1. Consigue las claves

| Clave | Para qué | Dónde |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Obligatoria.** Es el cerebro. | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `PRO_ACCESS_CODE` | Tu contraseña para desbloquear el plan Pro. | La inventas tú |
| `GOOGLE_API_KEY` | Imágenes y vídeo. | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | Alternativa solo para imágenes. | [platform.openai.com](https://platform.openai.com) |

La búsqueda web no necesita ninguna clave extra: va incluida en la API de Anthropic.

### 2. Despliega (recomendado: Vercel, se hace desde el móvil)

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New → Project** y elige este repositorio.
3. En **Environment Variables** pega al menos `ANTHROPIC_API_KEY` y `PRO_ACCESS_CODE`.
4. **Deploy**. En un par de minutos tienes la URL.

Para activar el plan Pro: abre la app → menú → *Mejorar plan* → escribe tu
`PRO_ACCESS_CODE`. Queda guardado en una cookie firmada, así que el servidor
verifica el plan de verdad: no se puede desbloquear trucando el navegador.

### 3. O en local

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev                  # http://localhost:3000
```

---

## Conectar GitHub

Dos formas, la primera funciona sin configurar nada:

1. **Token personal** — en GitHub: Settings → Developer settings → Personal access
   tokens → *Fine-grained* o *classic* con permiso `repo`. Lo pegas en la app
   (menú → GitHub). Se guarda en una cookie `HttpOnly` del servidor.
2. **Entrar con GitHub** — crea una OAuth App con callback
   `https://TU-DOMINIO/api/github/oauth/callback` y define `GITHUB_CLIENT_ID`
   y `GITHUB_CLIENT_SECRET`.

Con la cuenta conectada, cualquier proyecto que genere el modo código se sube en
un solo commit (Git Data API), tanto a un repositorio existente como a uno nuevo.

---

## Cómo está hecho

```
src/
  app/
    page.tsx              Punto de entrada
    api/
      chat/               Streaming SSE: razonamiento, búsqueda y texto
      image/  video/      Generación de imagen y vídeo
      github/             Conexión, repositorios y push
      pro/                Activación del plan (cookie firmada con HMAC)
      title/              Titula la conversación automáticamente
  components/             Interfaz (React 19)
  lib/
    anthropic.ts          Cliente y traducción velocidad → esfuerzo
    sources.ts            Clasificación de fiabilidad de fuentes
    prompts.ts            Instrucciones del sistema por modo
    project.ts            Extrae los archivos de las respuestas de código
    storage.ts            Historial en el propio dispositivo
```

**Detalles que importan**

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
  El vídeo no se ve afectado porque la espera se hace desde el navegador, pero una
  respuesta en modo *Profundo* con muchas búsquedas puede cortarse al llegar al
  límite. Si te pasa a menudo, sube `maxDuration` en `src/app/api/*/route.ts` (hace
  falta un plan de pago de Vercel, o alojarlo tú).

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # compilar
npm start          # producción
npm run typecheck  # comprobar tipos
```
