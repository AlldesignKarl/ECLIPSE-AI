# ECLIPSE AI — instrucciones del proyecto

Léete esto entero antes de tocar nada. Está escrito para que una sesión nueva
pueda continuar sin haber visto las anteriores.

Para saber **en qué punto está el trabajo** (lo último hecho, lo que falla, lo
que queda), lee **`PROGRESS.md`**. Este archivo cuenta cómo es el proyecto y qué
reglas tiene; el otro cuenta por dónde va.

---

## 1. Qué es

ECLIPSE es una aplicación web de IA en castellano, en producción en
**https://eclipse-ia.vercel.app**. La hace **Carlos Lafuente Pueyo** (empresa
Eclipse); es el dueño del producto y quien decide.

No es un envoltorio de un chat. Hace, de menos a más raro:

- Conversación con búsqueda web y fuentes ordenadas por fiabilidad.
- Lee imágenes, PDF y archivos; crea imágenes; convierte formatos.
- **ECLIPSE CODE**: construye proyectos enteros con vista previa y ZIP.
- **Conexiones**: 21 servicios. Enchufa tu tienda, tu web, tu correo o tu
  agenda (Shopify, WooCommerce, PrestaShop, Wix, Stripe, HubSpot, Notion,
  Airtable, Trello, Todoist, Calendly, Mailchimp, Brevo, Slack, Telegram,
  Discord, GitHub, Vercel, IONOS, Cloudflare, Binance) y el modelo las consulta.
- **Programar**: encargos que se hacen solos, con calendario, y un plan entero
  que monta ECLIPSE cuando le dices qué quieres conseguir.
- **Biblioteca**: imágenes libres de museos y archivos, para inspirarse.
- **Llamadas**: hablar con ECLIPSE por voz, con interrupciones.
- **Grupos**: varias personas hablándole a ECLIPSE en el mismo sitio. Él está
  dentro contestando a todo de fábrica, se ve en la lista de gente, y el dueño
  puede pasarlo a "solo si le nombran" o apagarlo.
- **Memoria**: aprende de ti y puede mirar conversaciones anteriores.
- **Ubicación**: excursiones, sitios cerca y cómo llegar.

### Cómo escribe Carlos, y cómo hay que contestarle

Escribe desde el móvil, en castellano, rápido y con erratas ("quw", "oelin",
"conwctar"). Se entiende perfectamente: no le pidas que aclare lo que se
entiende. Quiere que las cosas **funcionen de verdad y comprobadas**, no
explicadas. Si pide algo y hay un problema, se arregla y se le cuenta en dos
líneas; no se le devuelve una lista de opciones.

---

## 2. Tecnología

| Qué | Cuál |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Estilos | Tailwind CSS v4 (`@theme` con variables CSS en `globals.css`) |
| Base de datos | Upstash Redis por API REST (opcional: sin ella la app va, pero sin cuentas) |
| Hosting | Vercel (plan gratuito) |
| Pagos | Stripe (opcional) |
| Pruebas | Node a pelo, sin framework (`pruebas/`) |

**No hay ORM, ni Prisma, ni base de datos SQL.** Todo lo que persiste en el
servidor son claves de Redis con JSON dentro.

### Los motores de IA

Se soportan cinco y se eligen solos por orden. El usuario también puede pegar su
clave desde Ajustes (se guarda en una cookie de su navegador).

- **Mistral** — el recomendado: 500.000 tokens por minuto. Es el único con el
  que ECLIPSE CODE entrega archivos largos sin cortarlos.
- **Groq** — el más rápido, ~1.000 mensajes al día. No busca ni ve imágenes.
- **Google (Gemini)** — el único que busca por su cuenta y lee imágenes y PDF.
  Cupo diario corto.
- **OpenRouter** — recambio.
- **Anthropic** — de pago por uso.

`src/lib/openai-compat.ts` habla con Mistral, Groq y OpenRouter (los tres usan
el dialecto de OpenAI). `src/lib/gemini.ts` y `src/lib/anthropic.ts` van aparte
porque su API es distinta.

---

## 3. Estructura

```
src/
  app/
    page.tsx, layout.tsx        La página; casi todo vive en componentes
    api/
      chat/route.ts             EL CORAZÓN (~800 líneas). Todo el chat pasa por aquí
      auth, key, pro, billing   Cuentas, claves, plan y cobro
      conexiones                Conectar tiendas y webs
      tareas, tareas/ejecutar   Programar + el reloj diario
      grupos, grupos/mensajes   Grupos
      memoria                   Lo que sabe de cada uno
      biblioteca, lugar         Imágenes libres y coordenadas → nombre de sitio
      image, image/edit         Crear y retocar imágenes
      title, transcribe         Titular conversaciones, dictado
  components/                   Todo el interfaz. ChatApp.tsx es el centro
  lib/
    prompts.ts                  Las instrucciones del modelo (~1300 líneas)
    openai-compat.ts            Mistral/Groq/OpenRouter + elección de modelo
    gemini.ts, anthropic.ts     Los otros dos motores
    tools/                      Herramientas que el modelo puede usar
    conexiones/                 Un archivo por servicio + registro + almacén
    tareas/  grupos/  memoria/  Cada uno: tipos.ts + almacen.ts (+ lógica)
    tareas/planear.ts           El plan que monta ECLIPSE (y `leerPlan`, que
                                lee lo que conteste el modelo sin romperse)
    una-respuesta.ts            Una respuesta entera del motor que haya, sea
                                cual sea. Lo que NO es conversación pasa por aquí
    estilo.ts                   Cómo escribe esta persona, en una línea, sacado
                                de sus propios mensajes (sin llamar al modelo).
                                Es el recambio de `perfil/` para quien no tiene
                                cuenta o está en un chat temporal
    perfil/                     Cómo le gusta que le hablen, aprendido mensaje a
                                mensaje y guardado con la cuenta. `tipos.ts` es
                                toda la lógica y no toca la red
    memoria/relevancia.ts       Qué parte de la memoria se manda en ESTE mensaje
    cuenta.ts                   Borrar la cuenta y todo lo que hay de alguien
pruebas/                        73 pruebas. Ver pruebas/LEEME.md
```

### Por dónde empezar a leer, según lo que vayas a tocar

- **Cómo responde ECLIPSE** → `src/lib/prompts.ts`
- **El flujo de una respuesta** → `src/app/api/chat/route.ts`
- **Herramientas del modelo** → `src/lib/tools/registro.ts`
- **Interfaz** → `src/components/ChatApp.tsx`
- **Añadir un servicio conectable** → `src/lib/conexiones/shopify.ts` como
  plantilla, y registrarlo en `conexiones/registro.ts`

---

## 4. Cómo funciona cada parte

### El chat (`src/app/api/chat/route.ts`)

1. Llega el cuerpo: mensajes, modo (`chat` | `code`), velocidad, ubicación,
   si es temporal.
2. `aligerarHistorial()` recorta: quita los adjuntos de turnos viejos (si no,
   cada foto se reenvía en todos los mensajes y se revienta el cupo por minuto).
3. Se elige motor. Si hay imágenes, uno que **vea**.
4. Se lee la memoria de esa persona (una sola vez por petición).
5. `buildSystemPrompt()` monta las instrucciones según modo, plan, motor,
   herramientas, nombre, lugar y memoria.
6. `conversarConHerramientas()` (`lib/tools/bucle.ts`) habla con el modelo; si
   pide herramientas las ejecuta y le devuelve el resultado, hasta un tope de
   vueltas.
7. Todo sale por SSE con un protocolo propio (`lib/sse.ts`).

### Herramientas del modelo (`src/lib/tools/`)

Cada una es un archivo con `nombre`, `descripcion` (la lee el modelo: es lo que
decide si la usa bien), `parametros`, `disponible()` y `ejecutar()`. Se añaden
metiéndolas en la lista de `registro.ts` y en `POR_MODO`. Las que hay:
`buscar_web`, `crear_imagen`, `crear_archivo`, `auditar_seo`, `mapa`,
`mis_conversaciones` y `conexion` (esta se fabrica al vuelo con lo que cada
persona tiene conectado).

**En modo `code` solo va `buscar_web`.** Cada token de instrucciones es un token
menos de archivo.

### Dónde se guarda cada cosa

| Dato | Dónde | Por qué |
|---|---|---|
| Conversaciones | `localStorage` del navegador | Son suyas; no queremos copia |
| Claves de motor del usuario | Cookie de su navegador | Igual |
| Tema, voz, ubicación, avisos | `localStorage` | Es de la pantalla, no de la cuenta |
| Cuentas | Redis `eclipse:user:<correo>` | Correo guardado como hash con sal |
| Conexiones | Redis `eclipse:conexion:...` | Credenciales AES-256-GCM |
| Encargos y resultados | Redis `eclipse:tareas:...` | Corren sin nadie delante |
| Grupos y mensajes | Redis `eclipse:grupo:...` | Los ven varias personas |
| Memoria | Redis `eclipse:memoria:...` | Tiene que seguirte de móvil a móvil |

### El plan Pro

Cookie `eclipse_plan` firmada. Se desbloquea con `PRO_ACCESS_CODE`, con
`PRO_EMAILS`, o pagando por Stripe. Son de Pro: ECLIPSE CODE, modo Profundo,
respuestas aceleradas, Conexiones, Programar y crear grupos (entrar en un grupo
no lo es: paga quien monta la mesa).

---

## 5. Reglas que hay que respetar

### Seguridad y privacidad — esto no se negocia

1. **Las credenciales de las conexiones nunca vuelven al navegador ni se le
   enseñan al modelo.** Están cifradas con AES-256-GCM y solo las descifra el
   servidor para llamar a la API de ese servicio.
2. **Ninguna conexión tiene acción de borrar.** Ni una. Y toda conexión nace en
   **solo lectura**; escribir es una segunda decisión, aparte y explícita.
3. **Binance/mercados NUNCA opera.** El permiso de escritura ni se ofrece.
   Stripe solo admite clave restringida (`rk_`) y rechaza la secreta (`sk_`).
4. **En los grupos nadie ve el correo de nadie**, solo el nombre elegido.
5. **La ubicación se redondea a 3 decimales** (~1 km) en el navegador Y otra vez
   en el servidor. Al modelo se le prohíbe mencionar calle o barrio.
6. **La memoria no guarda conversaciones**, solo frases sueltas y un resumen de
   dos líneas. Al extractor se le prohíbe apuntar salud, religión, política,
   orientación sexual, dinero, situación legal, terceras personas y claves.
7. **El chat temporal no guarda NI USA la memoria.** Las dos cosas.
8. **El iframe de la vista previa** mantiene
   `sandbox="allow-scripts allow-forms allow-popups allow-modals"` **sin**
   `allow-same-origin`. Quitar esa restricción deja que el código generado lea
   la sesión de quien lo mira.
9. **El texto que viene de fuera** (web, mapas, conexiones) va envuelto en
   `<contenido_externo>` con `envolverAjeno()`, y las instrucciones dicen que
   eso son datos y nunca órdenes.
10. **Nunca escribas tokens ni claves en el código generado** ni en ejemplos:
    variables de entorno siempre.

### De producto

11. **Nunca mandes al usuario a "cambiar el motor en Ajustes".** Carlos lo dijo
    expresamente: *"eso NO"*. Si un motor no puede con algo, se cambia solo por
    dentro y se contesta.
12. **No hay generador de vídeo.** El modelo no puede decir que sí lo hay.
13. **No se enlazan logos de marcas desde sus servidores.** Están dibujados en
    `src/lib/conexiones/logos.ts` (trazos SVG de Simple Icons, CC0).
14. **Los identificadores de modelo no se escriben en commits, PR ni en nada que
    se suba al repositorio.** Solo en la conversación.

### De código

15. **Los comentarios explican POR QUÉ, no qué.** Todo el proyecto está
    comentado en castellano contando la decisión y qué pasaba antes. Sigue ese
    tono: un comentario que repite lo que dice la línea sobra.
16. **Todo en castellano**: nombres de variables, funciones, archivos y
    comentarios. `buscarImagenes`, no `searchImages`.
17. **Los mensajes de error se leen como los diría una persona**, y dicen qué
    hacer. Nunca un código de estado en la cara del usuario.
18. **`maxDuration` de una ruta no pasa de 60.** El plan gratuito de Vercel corta
    ahí pase lo que pase; pedir más no da más, da un corte silencioso.
19. **Antes de dar algo por hecho: `npm run build` y las pruebas.**

---

## 6. Lo que NO debes romper

Cosas que costaron encontrar y que un cambio descuidado vuelve a romper:

- **`aligerarHistorial()`** (`lib/project.ts`) — quita los adjuntos de turnos
  viejos. Sin eso, cada foto se reenvía en cada mensaje (medido: 1172 KB → 586
  KB) y la conversación choca con el límite por minuto.
- **`crearFiltroDeNegativa()`** (`lib/negativa.ts`) — retiene el principio de la
  respuesta cuando hay foto para detectar "no puedo ver imágenes" y cambiar de
  motor. Quitarlo devuelve el fallo que más molestó a Carlos.
- **El orden de `PREFERENCIA_CHAT`** (`lib/openai-compat.ts`) — los modelos
  grandes van ANTES que Pixtral. Invertirlo vuelve a elegir un modelo peor.
- **El acumulador fraccionario de `lib/ritmo.ts`** — con `Math.floor` por
  fotograma se pierde velocidad y la respuesta aparece a tirones.
- **Que `GET /api/tareas` NO ejecute nada.** Ejecutar ahí es exactamente el
  fallo que hacía que Programar pareciera roto.
- **Que el reloj acepte la cabecera `x-vercel-cron`.** Sin eso, y sin
  `CRON_SECRET` puesto, ningún encargo se ejecuta nunca.
- **`GUION_ANTES_DE_PINTAR`** (`lib/tema.ts`) — va en el `<head>` y evita el
  fogonazo blanco al cargar en tema claro.
- **El `line-clamp-2` del catálogo de conexiones sin un `block` detrás** — el
  `block` le pisa el `display` y cada fila se estira a cinco líneas.
- **Que `leHablanAEclipse()` siga teniendo un modo por defecto** (`nombrado`).
  Los grupos creados antes de que existiera el interruptor no llevan el dato
  guardado; sin ese defecto, ECLIPSE se callaría para siempre en todos ellos.
- **Que un encargo de un día concreto (`unavez`) se apague al hacerse**
  (`anotarEjecucion`). Si no, como esos encargos tocan también cuando ya pasó su
  día —para no perderse si el reloj no sonó—, se repetirían cada día para
  siempre.
- **Que todo lo que NO es conversación pase por `una-respuesta.ts`.** Los
  grupos y Programar hablaban solo con Mistral/Groq/OpenRouter porque están
  escritos sobre el bucle de herramientas; con Google de motor se quedaban
  mudos y el aviso no se pintaba en ninguna parte. Ahí no hacen falta
  herramientas: es escribir.
- **Que `oneShotCompat`/`unaVezCompat` resuelvan el modelo con `modeloSuelto`.**
  Pedirlo al modelo escrito a mano en el preset es lo que hacía que el chat
  funcionara y el plan fallara con la misma clave.
- **Que mandar un mensaje a un grupo NO espere a la respuesta del modelo.**
  Son dos peticiones a propósito: guardar vuelve en milisegundos y responder va
  aparte. Juntarlas otra vez es devolver el "los grupos van lentísimos".
- **El presupuesto de lo que se le manda al modelo** (`pruebas/contexto.test.mjs`).
  Las instrucciones, la memoria y el historial crecen solos, y lo que se paga se
  paga en CADA mensaje. Hay un techo escrito en esa prueba: crecer de más falla
  ahí en vez de notarse tres semanas después en respuestas cortadas.
- **Que la memoria se filtre con `hechosRelevantes()`** y no se manden los
  veinte hechos siempre. Con un relleno mínimo de cuatro para cuando la pregunta
  no tiene nada que buscar ("¿por dónde íbamos?"), que si no se queda a ciegas
  justo cuando le piden memoria.
- **Que `compactarHistorial()` deje enteros el primer mensaje y los doce
  últimos.** El primero dice de qué va todo y los últimos son lo que se está
  hablando; lo de en medio se recorta a una línea.
- **Que el repaso de antes de contestar NO se escriba** (`REPASO` en
  `prompts.ts`). Es una lista de comprobación en silencio, no un "piensa paso a
  paso": lo segundo hace que el modelo publique su propio razonamiento.
- **Que `planear.ts` NO ejecute nada.** Planificar contesta en segundos porque
  solo escribe; ejecutar cuesta medio minuto por encargo, y esperar eso era
  justo lo que había que quitar de en medio.
- **Que el chat de una quedada NO se pinte dentro del modal de Programar.**
  Dos modales anidados es un fondo oscuro `fixed inset-0` por encima del de
  dentro: se ve todo perfecto y no responde ni un toque. Por eso `ProgramarDialog`
  guarda la quedada abierta y, cuando la hay, pinta `Sala` EN LUGAR de su modal.
- **Que las fotos de un grupo vivan en su propia clave de Redis** y que el
  mensaje solo lleve el identificador. Metidas dentro del mensaje, abrir un
  grupo con cuarenta fotos se trae megabytes antes de enseñar nada.
- **Que `pedirUbicacion()` comparta una sola promesa en curso** y se acuerde de
  que acaba de fallar. Sin eso el navegador enseña el cartel del permiso dos
  veces por pregunta, que es justo lo que hace que se diga que no.
- **Que el eclipse de fondo (`.fondo-grupo`) vaya SOLO en los chats de grupo y
  de quedada.** Carlos lo pidió así con estas palabras: *"lo quiero solo en los
  chats de grupo no en lo demas"*. En la portada y en el chat de uno hay ya un
  eclipse de protagonista, y dos anillos cruzándose no dejan leer ninguno.
- **Que las conexiones se puedan leer con un correo explícito** (`misConexiones(email)`,
  `credencialesDe(servicio, email)`, `ejecutarConexion({..., dueno})`). Sin eso
  se buscan por la cookie, y un encargo programado lo dispara el reloj de
  madrugada: sin cookie no encontraba nada, el modelo se quedaba sin la tienda
  que el encargo daba por conectada, y el parte salía INVENTADO. Es el fallo que
  más se notó en producción y no daba ningún error por ninguna parte.
- **Que un encargo diga qué puede mirar y qué no** (`loQuePuedeMirar` en
  `tareas/ejecutar.ts`). Un modelo con un encargo que pide datos y sin forma de
  conseguirlos escribe cifras plausibles: parece bueno y es falso, que es lo peor
  posible en algo que se lee por la mañana y sobre lo que se decide.
- **Que `tonoPara()` mire si el móvil SUENA distinto**, no si cree tener voz de
  hombre. En un Android el género se adivina por una letra de un código
  (`es-es-x-eed-local`) y acierta a medias; y con una sola voz instalada —lo
  normal— hombre y mujer devuelven forzosamente la misma. Ahí el único cambio
  posible es el tono, y hay que hacerlo o el botón no hace nada.
- **Que el perfil de comunicación se aprenda del ÚLTIMO mensaje y solo de ese**
  (`perfil/almacen.ts`). El chat manda el historial entero en cada petición: si
  se aprende de todo lo que llega, el primer mensaje se cuenta una vez por turno
  y el perfil se clava en lo que alguien escribió el primer día.
- **Que un eje del perfil no se use hasta tener `SUFICIENTE` señales y estar
  claramente de un lado** (`perfil/tipos.ts`). Es lo que pidió Carlos con
  "no debe inventarse preferencias". Y que `observar()` NO apunte un eje cuando
  el mensaje no dice nada de él: un "vale" no es prueba de nada, y contándolo,
  cuatro monosílabos bastaban para decidir que alguien quiere respuestas cortas.
- **Que el perfil obedezca el interruptor de la memoria y se borre con ella.**
  Un perfil que decide el tono de TODAS las respuestas y que no se puede mirar
  ni borrar no es adaptarse: por eso sale en Ajustes y lo borra `olvidarTodo()`.
- **Las 73 pruebas.** Si una falla después de un cambio tuyo, el roto es el
  cambio, no la prueba. Solo se toca una prueba cuando el comportamiento
  correcto ha cambiado a propósito, y entonces se dice.

---

## 7. Cómo trabajar aquí

```bash
npm install
npm run dev              # desarrollo
npm run build            # SIEMPRE antes de dar algo por hecho
npx tsc --noEmit         # comprobar tipos
npm run prueba           # las 73 pruebas (~6 min)
npm run prueba:ligeras   # las 53 que no abren navegador (~10 s)
node pruebas/mapa.test.mjs   # una suelta, para depurar
```

**Rama de trabajo**: `claude/multimodal-ai-free-pro-tbxhtn`. No subas a `main`
sin que Carlos lo diga.

**Ojo con lo que se ve en su móvil.** Lo que viene del servidor (la lista de
conexiones, los encargos) se actualiza solo; lo que vive en el JavaScript de la
página (los logos, las pantallas) se queda guardado en el navegador. Un móvil
con la página vieja y el servidor nuevo enseña mezclas imposibles —conexiones
nuevas con logos viejos— que parecen un fallo del código y no lo son. Por eso
`Shell.tsx` compara la versión del servidor con la suya y recarga una vez.

**Al terminar algo**: entrada nueva arriba en `src/lib/novedades.ts` (sube la
versión; la aplicación se la enseña a la gente una vez), y actualizar
`PROGRESS.md`.

### Sin red

En este contenedor casi todo internet está bloqueado por política de salida.
Por eso las pruebas levantan **servidores de mentira** que hablan como Shopify,
Groq, Wikimedia o Redis. Si necesitas comprobar algo contra un servicio real, no
podrás: dilo claramente en vez de suponer que funciona.
