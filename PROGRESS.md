# Estado del proyecto

Última actualización: **16 de septiembre de 2026**
Rama: `claude/multimodal-ai-free-pro-tbxhtn`, la de siempre · Versión que ve el
usuario: **2.49**

Este archivo cuenta **por dónde va el trabajo**. Para saber cómo está hecho el
proyecto y qué reglas tiene, lee `CLAUDE.md`.

---

## 1. Resumen en tres líneas

La aplicación está **en producción y funcionando**, con 82 pruebas en verde.
Lo último: **Gmail se conecta de verdad** (OAuth con Google, sin pedirle a nadie
ninguna contraseña), hay un **agente del correo incluido en el plan Pro**
(ECLIPSE INBOX) y **tus agentes contratados salen arriba del todo**. Antes: los
**agentes ya se cobran de verdad** por Stripe, con una instancia propia por
contratación. Antes: el **Catálogo de Agentes**, agentes de empresa
que trabajan dentro de las cuentas conectadas. Antes: **Grupos y Programar ya son gratis**, y
**Modo Examen**, para
estudiar con tus propios apuntes sin que se invente ni una pregunta; y un
**router de motores** que manda cada pregunta a donde mejor se
resuelve sin que se note por fuera. Antes: ECLIPSE **aprende cómo le gusta a
cada uno que le hablen** y se
adapta poco a poco, con personalidad propia de partida. Antes de eso: los
**encargos programados ya ven de verdad las cuentas conectadas** —no las veían, y por eso los partes traían cifras
inventadas—, hay **resumen entero de la tienda** en una sola pregunta, y las
**voces** cambian de verdad aunque el móvil solo tenga una. Lo que queda son
mejoras, no averías.

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
| **Conexiones** (22 servicios) | Funciona. Catálogo con logos reales, buscador y categorías. Gmail con botón de Google, los demás con clave |
| **Programar** | Funciona, y GRATIS. Calendario de quedadas + encargos con plan automático |
| **Biblioteca** | Funciona. Arreglada en esta sesión: daba 401 |
| **Llamadas** | Funciona. Arranca con la primera frase; voz de hombre o mujer |
| **Grupos** | Funciona, y GRATIS. ECLIPSE dentro con su interruptor, fotos y caras |
| **Memoria** | Funciona. Nuevo en esta sesión |
| **Ubicación** | Funciona sin claves (OpenStreetMap); mejor con Google Maps |
| **Tema claro** | Funciona. Contraste medido: 17,2 texto / 14,7 burbuja / 16,3 código |
| **Chat temporal** | Funciona. No se guarda, no sale en la lista, no usa memoria |

### Los 22 conectores
Comercio: `shopify`, `woocommerce`, `prestashop`, `wix`. Dinero: `stripe`.
Trabajo: `hubspot`, `notion`, `airtable`, `trello`, `slack`. Agenda: `todoist`,
`calendly`. Correo: `gmail`, `mailchimp`, `brevo`. Mensajes: `telegram`,
`discord`. Webs y dominios: `github`, `vercel`, `ionos`, `cloudflare`. Mercados:
`mercados` (Binance).

`gmail` es el único que no se conecta pegando una clave: se conecta dando
permiso a Google. Necesita `GOOGLE_OAUTH_ID` y `GOOGLE_OAUTH_SECRET` en el
servidor; sin ellas lo dice y no enseña un botón que no lleva a ninguna parte.

Todos nacen en solo lectura, ninguno puede borrar nada y Binance no puede
operar ni aunque se le pida. De los doce nuevos, nueve no tienen ni una acción
que escriba.

### Cuentas y cobro
Registro con correo y contraseña (el correo se guarda como hash con sal, porque
el repositorio es público), plan Pro por código, por lista o por Stripe.

---

## 3. Lo último: el correo, de verdad

Carlos pidió tres cosas: una sección con los agentes comprados, un agente de
Gmail gratis solo para quien tiene Pro, y que todo lo de los agentes funcione al
100% comprobado, *"no vaya a ser que hagan el pago y luego no les vaya bien el
asistente de IA"*.

**1. Tus agentes, arriba del todo.** En Agentes, lo contratado sale primero, con
su estado (activo, en pausa, pendiente de pago) y lo que le falta para trabajar.
El catálogo pasa a ser "Añadir otro". Antes había que entrar agente por agente
para saber cuáles eran tuyos.

**2. Gmail se conecta DE VERDAD.** Es la primera conexión de ECLIPSE que no se
hace pegando una clave, porque Google no da ninguna: da un permiso, para una
cuenta concreta y revocable desde su panel. Eso son piezas nuevas enteras
(`lib/conexiones/oauth.ts` y `api/conexiones/oauth/[servicio]`):

- Se manda a la persona a Google con `access_type=offline` —sin eso la conexión
  dura una hora— y un `state` FIRMADO con el secreto del servidor.
- De quién es la vuelta lo dice esa firma, **no la cookie**. Con la cookie, una
  vuelta abierta en otro navegador conectaría el buzón de alguien a la cuenta de
  otro. Está comprobado en la prueba: se usa a propósito el estado de otra
  cuenta y el buzón NO cae en la del navegador.
- El código se cambia por los testigos hablando con Google **desde el servidor**.
  Al navegador no llega ni uno.
- Cuando el testigo de acceso caduca se saca otro solo, y se GUARDA. Y no se
  pierde el de refresco al hacerlo, que es el fallo que haría que todo
  funcionara hoy y estuviera muerto mañana sin ningún error por ninguna parte.

Y hace lo que tiene que hacer: `buscar_correo` con la sintaxis de Gmail,
`sin_leer`, `leer_correo` (el texto sale entero aunque venga anidado en tres
capas de MIME) y `enviar_correo`. **Ninguna acción borra nada**, como en todas.
Nace en solo lectura aunque Google haya concedido también el enviar: el permiso
del proveedor y el de ECLIPSE son dos cosas distintas.

**3. ECLIPSE INBOX, incluido con Pro.** El agente del correo. No cuesta nada
aparte y no abre pasarela; lo que hace es comprobar que de verdad eres Pro **en
el servidor**, al contratar y en cada acción después. Si dejas de ser Pro, deja
de trabajar y lo dice. Es el agente más fácil de probar porque no necesita nada
del negocio de nadie: solo el correo.

**Qué hace falta poner en Vercel para que esto funcione en producción:**
`GOOGLE_OAUTH_ID` y `GOOGLE_OAUTH_SECRET`, y dar de alta en el panel de Google
la dirección de vuelta `https://eclipse-ia.vercel.app/api/conexiones/oauth/gmail`
letra por letra. Sin esas dos variables, ECLIPSE lo dice en la pantalla en vez
de enseñar un botón que no lleva a ninguna parte.

**4. Cada agente dice qué conectarle y cómo.** Lo encontró Carlos en cinco
minutos: la ficha decía *"requiere conexión: Gmail"* y ahí se acababa; ni cómo,
ni dónde, ni qué te van a pedir. Ahora cada integración de cada agente llega con
lo suyo, sacado del conector de verdad (`comoSeConectan` en `api/agentes`):
Gmail dice que se conecta con tu cuenta de Google; Notion, que te va a pedir el
secreto de la integración y dónde se saca; Shopify, el dominio y el token. Y
cada una con su botón, que cierra Agentes y abre Conexiones **con esa ficha ya
abierta y subida a la vista**, en vez de soltarte en una lista de veintidós.
Lo ya conectado dice a qué cuenta y con qué permiso, y deja de ofrecer nada.

**5. Y quitado un enlace que llevaba al sitio equivocado.** La ficha de Gmail
tenía un «Abrir Gmail» que apuntaba a `myaccount.google.com/permissions`: la
lista de aplicaciones vinculadas de tu cuenta de Google, que es donde se QUITA
un permiso, no donde se da. Carlos lo pulsó y acabó buscando ECLIPSE en una
lista donde por definición todavía no podía estar. Ahora ese enlace sale solo en
los servicios de clave (donde lleva al panel del que se saca) y, en los de
permiso, solo DESPUÉS de conectar y diciendo lo que es. Y si el servidor no
tiene Google configurado no se enseñan ni el botón ni unos pasos que empiezan
por pulsarlo.

**6. Y el botón de conectar conecta.** Pulsarlo en un servicio de permiso
desplegaba la ficha y ya: *"solo abre y cierra eso con las instrucciones"*. En
los de clave desplegar está bien —dentro hay un formulario— pero en los de
permiso no hay nada que rellenar, así que ahora va DERECHO a la pantalla de
Google, desde el catálogo y desde la ficha del agente. Y cuando el servidor no
tiene Google configurado, el botón deja de poner "Conectar": pone "Sin
configurar", y lo que impide conectar se lee ARRIBA de la ficha en vez de
debajo de las cuatro cosas que el servicio sabe hacer.

**Comprobado, no prometido.** `pruebas/gmail.test.mjs` (el baile de OAuth y las
acciones de Gmail, pieza a pieza) y `pruebas/gmail-api.test.mjs` (la aplicación
levantada: conectar exige Pro y cuenta, la firma manda sobre la cookie, INBOX se
activa sin pasarela, lee el correo de verdad, en solo lectura no sale ni un
correo, con aprobación se PARA y al aprobar sale, y sin Pro se apaga). Y
`pruebas/agentes-ui.test.mjs`, en un móvil de verdad: que la ficha diga cómo se
conecta cada cosa, que cada una diga algo DISTINTO, y que el botón aterrice en
la ficha de Conexiones que era.

---

## 3 bis. Antes: los agentes se cobran de verdad

Tres cosas que pidió Carlos, y las tres están.

**1. Cobro real con su Stripe.** Contratar abre la pasarela con el precio del
catálogo y una suscripción mensual. Al volver, se le PREGUNTA a Stripe si el
pago existe, y además si esa sesión es de ESTA cuenta y de ESTE agente —va en
`metadata`—: un identificador de sesión copiado de otro sitio no activa nada.
Comprobado en la prueba con un Stripe de mentira: pago a medias → 402; sesión
inventada → 402; pago de otro agente → no sirve; pago bueno → activo.

Y no hace falta crear cinco productos en el panel de Stripe: se cobra con
`price_data`, que es lo que ya hacía el plan Pro. Con `STRIPE_SECRET_KEY`
puesta, los cinco agentes cobran. `STRIPE_PRICE_OMNI` y compañía siguen ganando
si algún día se quieren gestionar desde el panel.

Además, antes de trabajar se comprueba que la suscripción sigue viva. Dar de
baja en Stripe para el agente solo, sin tocar nada aquí.

**2. Gratis para una cuenta.** `AGENTES_GRATIS` (correos separados por comas).
Esa cuenta contrata y se activa directo, sin pasarela y sin cobro, y la
respuesta dice que es un regalo y no un pago. Va en variable de entorno y NO
escrito en el código: este repositorio es público.

**3. Una instancia por contratación.** *"Que cada compra sea un ID distinto, que
no tenga el mismo asistente a 100 empresas y que se les junte todo"*. La
separación ya estaba —todo cuelga del correo de la cuenta— pero ahora cada
contrato lleva su `instancia` (un UUID por compra), que viaja en el pago de
Stripe y en el registro. Dos empresas con el mismo agente son dos instancias que
no se parecen en nada, y quien rescinde y vuelve a contratar empieza otra.

Lo importante es que el aislamiento está COMPROBADO, no prometido: en la prueba,
dos empresas contratan SUPPORT, las dos conectan Notion, y se verifica que al
agente de la segunda no le llega ni una palabra de los encargos de la primera —
ni en sus instrucciones, ni en su historial, ni en su registro—. Cada encargo se
monta desde cero con los datos de ese correo y nada más; no hay estado
compartido entre clientes en ninguna parte.

---

## 3 bis. Antes: Catálogo de Agentes

Convertir ECLIPSE en una plataforma de agentes para empresas. La condición de
Carlos era la de siempre y aquí pesa más que nunca: *"no quiero demos,
simulaciones, datos falsos ni botones que aparenten hacer cosas"*.

**Lo que ya había, y por eso esto es una capa y no un proyecto nuevo.** ECLIPSE
ya tenía 21 conectores reales con credenciales cifradas y permiso de
lectura/escritura, un bucle de herramientas que ejecuta de verdad, encargos que
corren sin nadie delante, y persistencia por cuenta. Un agente no necesitaba un
motor nuevo: necesitaba **límites**.

**Qué es un agente aquí.** `lib/agentes/catalogo.ts` es la configuración
central: añadir uno es añadir una entrada, con su precio, sus instrucciones, sus
herramientas y qué integraciones usa. De ahí leen la pantalla, la API y la
ejecución.

Lo que lo convierte en un agente de verdad y no en cinco prompts:

- **Herramientas recortadas.** `ejecutar.ts` le monta un juego con SUS
  herramientas, y la de conexiones se fabrica solo con SUS servicios
  conectados. A COMMS no se le ponen delante las acciones de la tienda. Medido
  en la prueba: el enum que recibe el modelo trae `["notion"]` y nada más.
- **Dos frenos para escribir, independientes.** El permiso de la conexión (de
  toda la vida) y el del agente. Con uno solo, dar permiso a un agente sería
  dárselo a todos.
- **Aprobación humana que PARA.** La acción no se ejecuta y luego se avisa: se
  queda en cola con sus datos, y al aprobarla se ejecuta ESA acción con ESOS
  datos, sin volver a preguntarle al modelo —que podría devolver otra cosa
  distinta de la que la persona aprobó—.
- **Registro de todo**: lo que salió bien, lo que falló con su error, y lo que
  se quedó esperando. Lo pendiente NO figura como hecho.

**Lo que no se hace, y se dice.** Gmail, Outlook, Google Calendar, Drive y
WhatsApp Business van marcados `pendiente: true`: piden OAuth y eso no está
construido. `estadoDe()` los cuenta siempre en lo que dice, aunque sean
opcionales, porque si no, quien contrata COMMS se cree que va a mandar correos.

**El pago.** Sin Stripe configurado no hay forma de cobrar 500 € al mes, así que
un contrato nace `pendiente_de_pago`, no ejecuta nada, y la API devuelve 409 si
se intenta activar. Esa puerta trasera es la que convertiría todo lo anterior en
decoración.

Pruebas nuevas: `agentes.test.mjs` (la lógica, incluida una que comprueba que
ningún agente declara una integración inventada) y `agentes-api.test.mjs`, que
levanta la aplicación y recorre el caso entero contra un Notion de mentira que
apunta lo que se le escribe: contratar sin cobro, no trabajar sin conexión,
trabajar con ella, el freno de solo lectura, la acción parada por aprobación,
la ejecución real al aprobarla, y que lo de una empresa no lo ve otra.

---

## 3 bis. Antes: Grupos y Programar, gratis

Carlos: *"lo de grupos para chatear y programar quiero que esté en gratis"*.
Hecho, y quitado de todas partes: la puerta del servidor en las dos rutas, las
cartelas de "es del plan Pro" en Grupos, en Programar y en las Quedadas, y las
etiquetas PRO del menú.

Los dos siguen pidiendo **cuenta**, y eso no es una puerta de pago disfrazada:
en un grupo hay que saber quién habla, y un encargo corre de madrugada sin nadie
delante, así que sin saber de quién es no hay a quién entregarle el parte. El
tope diario de mensajes sigue siendo el de cada plan, así que esto no abre una
puerta trasera al cupo.

Siguen siendo de Pro: ECLIPSE CODE, modo Profundo, respuestas aceleradas,
Conexiones y Modo Examen.

Dos pruebas cambiaron a propósito, y aquí se dice: `grupos.test.mjs` comprobaba
que crear sin Pro devolvía 402 y ahora comprueba lo contrario —que se crea—, y
`programar-api.test.mjs` recorre ahora TODO el flujo con el plan gratis, sin
desbloquear Pro en ningún momento.

---

## 3 bis. Antes: Modo Examen

Estudiar con TUS apuntes. Lo que decide si esto sirve o no está en una sola
idea, y Carlos la dejó dicha tres veces: **si algo no aparece en los materiales,
no entra en el examen**. Una aplicación de estudiar que se inventa una pregunta
no es peor que no tenerla: te hace estudiar lo que no es, y eso no se descubre
hasta el día del examen.

**Cómo se consigue.** No pasándole los apuntes al modelo y pidiéndole que
pregunte. En tres pasos:

1. De los materiales se saca un **extracto**: trozos literales, cada uno con su
   archivo y su página. Eso es lo único que existe.
2. Todo lo demás —resumen, quiz, desarrollo, corrección— mira SOLO ese extracto,
   y cada pregunta tiene que decir de qué trozo sale.
3. Antes de enseñar nada se **comprueba**, en `examen/tipos.ts`, con una cuenta
   y sin volver a preguntarle al modelo: que el trozo exista y que la respuesta
   correcta esté de verdad en él. Lo que no se puede comprobar se tira.

El paso 3 es el que importa. Pedirle a un modelo que no invente es una súplica;
comprobar que lo que ha dicho está en el texto es una comprobación. Medido en la
prueba: de tres preguntas que devuelve el modelo, la de Darwin —cierta, pero que
no está en esos apuntes— no llega nunca a la pantalla. Y si no queda ninguna, se
dice, en vez de preguntar cultura general.

**Lo que hay dentro.** Crear examen (asignatura, título, fecha, temas, lo que
dijo el profesor), subir fotos/PDF/textos, mapa del examen con la cobertura de
cada tema, resumen rápido o completo, quiz con los cuatro modos que pidió
—rápido, repaso, difícil y «mis fallos»—, examen de desarrollo con corrección
por puntos (lo que has hecho bien, lo que falta, errores, cómo mejorar y la
respuesta esperada), y progreso con la evolución de la nota y qué repasar.

**El reparto de modelos** es el que pidió: LEER los apuntes —fotos torcidas de
una libreta, PDF— va a quien mejor mira (Gemini, que se pone delante cuando hay
adjuntos); resumir, preguntar y corregir salen por `una-respuesta.ts`, que
empieza por Mistral y baja si falla. Sin endpoints ni claves nuevas: se reutiliza
todo lo que ya había.

**Tres cosas que se cuidaron y no se ven:**

- Analizar material **suma** al extracto; subir una foto hoy no borra lo que se
  leyó la semana pasada.
- Del archivo del que no sale ni un trozo se avisa: una foto movida de unos
  apuntes es lo más normal del mundo, y callarlo deja a alguien estudiando con
  material que no está.
- `palabrasDe()` corta a seis letras. Sin eso "produce" y "producir" no se
  parecían, y una pregunta bien reformulada —que es lo que hace buena a una
  pregunta— se caía por usar el mismo verbo en otro tiempo. Lo destapó la propia
  prueba.

**Y las caras en los grupos.** Lo pidió a la vez: "que la gente tenga la foto de
perfil que tenga dentro de la app". Se sirven por el NOMBRE que se ve —nunca por
el correo, ni siquiera dentro de la dirección de la imagen— y solo a quien está
dentro del grupo. La foto no viaja dentro de la lista de gente, que se refresca
cada pocos segundos: va aparte y la guarda el navegador. Quien no tiene foto
sigue con su inicial y su color de siempre.

Pruebas nuevas: `examen.test.mjs` (la lógica entera sin red, incluida la que
tira lo inventado) y `examen-api.test.mjs`, que levanta la aplicación y recorre
crear → subir apuntes → resumen → quiz → desarrollo → corrección → progreso,
comprobando de paso que lo de cada uno es de cada uno.

---

## 3 bis. Antes: el router de motores

Carlos: *"Mistral = cerebro general, Gemini = especialista cuando aporte una
ventaja clara, router que decide automáticamente"*, y con una condición que
manda sobre el diseño entero: **nada de preguntarle a una IA qué IA usar**.

**Lo que ya había** (y por eso esto es más pequeño de lo que parece): Gemini ya
estaba soportado, con su `runGoogle` en la ruta del chat, su clave en
`GEMINI_API_KEY`/`GOOGLE_API_KEY` y el MISMO `buildSystemPrompt` que los demás
—o sea, la personalidad ya era compartida—. También había recambio de motor por
cupo. Lo que faltaba era la pieza del medio: decidir por el CONTENIDO del
mensaje.

**`lib/router.ts`.** Reglas locales, sin red y sin modelo: ni un token ni un
milisegundo de más. Sube al especialista por tres motivos, y devuelve cuál:

- `codigo`: un bloque ``` pegado o una traza de error valen solos —nadie escribe
  "Traceback (most recent call last)" charlando—; por palabras hacen falta DOS
  señales de cuatro (verbo de programar, cosa que se programa, tecnología, "no
  funciona").
- `razonar`: dos señales de tres (verbo de analizar/resolver, petición explícita
  de razonamiento, vocabulario de complejidad).
- `contexto`: más de 4.000 caracteres pegados de golpe, o una conversación que
  ya pesa más de 20.000.

Y frenos, que es lo que decide si un router sirve: mensajes de menos de 28
caracteres ("arréglalo", "¿y el código?"), saludos, y preguntas de dato suelto
("¿en qué año salió Python?"). Sin ellos, el especialista acaba contestándolo
todo.

**Dos cosas que este cambio podía romper, y no rompe:**

1. **ECLIPSE cambiando de identidad.** Si al Gemini que coge una pregunta de
   código se le dice "eres el motor Google", contesta que es Google cuando le
   preguntan —contradiciendo Ajustes— y da una respuesta distinta según lo que
   se le pregunte. Ahora, cuando el motor lo pone el router, se le cuenta el
   motor CONFIGURADO (`motorQueDice`). Por dentro cambia; por fuera es la misma.
2. **Un fallo del especialista dejando a alguien sin respuesta.** El recambio de
   antes solo saltaba con errores de cupo. Cuando el motor lo eligió el usuario
   eso está bien —es su cuenta—; cuando lo elegimos nosotros, el error es
   nuestro. Con el router, CUALQUIER fallo vuelve al motor de siempre.

**ECLIPSE CODE se queda como estaba**, a propósito: ahí el motor lo elige el
usuario en Ajustes porque es lo que decide si un archivo largo sale entero o
cortado, y eso costó encontrarlo. El router es del chat.

**La interfaz.** Fuera el nombre del modelo debajo de cada respuesta: ECLIPSE es
una sola IA y así se tiene que ver. Quien lo quiera —para saber por qué una
respuesta salió floja— lo enciende con «Mostrar el razonamiento» en Ajustes.

**El modelo de Gemini no está escrito a mano en ninguna parte**, y es lo
correcto: `gemini.ts` le pregunta a Google por los modelos de ESA cuenta
(`ListModels`) y elige un `flash`, que es la familia de la capa gratuita. Si el
que hay deja de existir, se vuelve a resolver solo.

Pruebas nuevas: `router.test.mjs` (las reglas, con los ejemplos de Carlos uno
por uno y los frenos) y `router-motores.test.mjs`, que levanta la aplicación con
DOS motores de mentira —uno que habla como Mistral y otro como Google— y
comprueba quién recibe cada mensaje, que las instrucciones son idénticas, que el
historial llega entero al cambiar de motor, que el recambio funciona y que
ninguna clave asoma.

---

## 3 bis. Antes: personalidad propia y adaptación de verdad

Carlos: *"que ECLIPSE tenga una personalidad natural y adaptable… que aprenda de
forma controlada cómo prefiere comunicarse esa persona"*, con dos condiciones
suyas: que no se invente preferencias y que la adaptación sea GRADUAL.

**Lo que había.** `lib/estilo.ts` sacaba una línea de los últimos ocho mensajes
de la conversación abierta. Funcionaba, pero se olvidaba al cerrarla: abrías un
chat nuevo y ECLIPSE volvía a hablarte como a un desconocido.

**Lo que hay ahora.** `lib/perfil/`, un perfil de comunicación que vive con la
cuenta y crece conversación a conversación. Seis ejes de 0 a 1 —largo, formal,
emojis, técnico, directo, ejemplos— más el idioma habitual.

- **Gradual de verdad, y en la cuenta y no en una promesa del prompt.** Cada
  mensaje mueve un eje un quinto del camino (media desplazada, `ALFA = 0,2`).
  Un mensaje raro no cambia nada; cinco seguidos sí. Medido en la prueba: con
  uno no dice nada, con dos tampoco, a la quinta ya contesta corto. Y se puede
  volver atrás igual de gradualmente.
- **No se inventa.** Un eje solo se usa con `SUFICIENTE` señales (3) Y estando
  claramente de un lado (≤0,32 o ≥0,68). Lo tibio no se usa. Y `observar()` no
  apunta un eje cuando el mensaje no dice nada de él: un "vale" no prueba nada.
  Eso último salió de la propia prueba —cuatro monosílabos seguidos bastaban
  para decidir que alguien quería respuestas cortas— y era exactamente lo que
  Carlos pidió que no pasara.
- **Solo de su último mensaje.** El chat manda el historial entero cada vez; si
  se aprende de todo lo que llega, el primer mensaje se cuenta una vez por turno
  y el perfil se clava en el primer día.
- **Se puede ver y borrar.** En Ajustes → Memoria, "Cómo ha aprendido a
  hablarte", en frases y no en números. Obedece el interruptor de la memoria, se
  borra con ella, y en un chat temporal ni se usa ni se aprende. Un perfil que
  decide el tono de todas las respuestas y no se puede mirar no es adaptarse.
- **Recambio.** Quien no tiene cuenta o está en temporal sigue teniendo el
  `estilo.ts` de siempre, que mira los mensajes de la petición. Nadie pierde
  nada.

**Personalidad base.** ECLIPSE ya tenía tono; ahora lo tiene dicho: natural,
cercano, espabilado y directo, seguro cuando sabe y capaz de decir "no lo sé"
sin adornarlo, y con la línea que faltaba: adaptarse a alguien no es dejar de
ser él.

**Lo que cuesta.** El perfil entero, en el caso peor —alguien de quien se sabe
todo—, son 102 tokens por mensaje, y las instrucciones pasan de 3.696 a 3.798
sobre un techo de 3.900. Está escrito en `pruebas/contexto.test.mjs`, así que
crecer de más falla ahí.

Pruebas nuevas: `perfil.test.mjs` (la lógica entera, sin red) y el recorrido de
punta a punta dentro de `memoria.test.mjs`: cinco conversaciones distintas, el
perfil aparece en la sexta, el chat temporal no lo recibe y el botón de borrar
lo borra.

---

## 3 bis. Antes: que lo conectado estuviera conectado de verdad

Carlos lo probó y dijo tres cosas. Las tres tenían causa, y las tres eran de
verdad:

1. **«En el calendario pone cosas falsas… y los datos que no se los invente».**
   Esto no era el calendario: era que los encargos programados NO veían sus
   cuentas conectadas. Las conexiones se buscaban por la cookie de quien está
   delante, y un encargo lo dispara el reloj de madrugada, cuando no hay nadie
   ni cookie. Resultado: un encargo que dice "mira los pedidos de ayer" se
   ejecutaba sin la tienda, y el modelo rellenaba el hueco con cifras
   plausibles. No daba ningún error en ninguna parte.

   Arreglado por donde había que arreglarlo: `misConexiones(email)`,
   `credencialesDe(servicio, email)` y `ejecutarConexion({..., dueno})` aceptan
   ahora un dueño explícito, y `ejecutarUna` lo pasa. Además, antes de escribir
   nada se le dice al modelo QUÉ tiene conectado de verdad y qué hacer cuando no
   puede mirar algo: decirlo en una línea y parar. Nada de rangos, ni ejemplos,
   ni "lo habitual en una tienda como la tuya". Y el planificador ya solo
   propone encargos que podrá cumplir el día que toquen.

2. **«Quiero que se conecte a todo realmente, que vea absolutamente toda tu
   tienda».** Los conectores ya llamaban a las APIs de verdad, pero ver la
   tienda entera eran cinco preguntas seguidas. Ahora hay `resumen_tienda` en
   Shopify y en WooCommerce: en UNA llamada trae el catálogo, lo que está sin
   publicar y sin descripción, lo agotado y lo que va justo con nombre y SKU,
   los pedidos de los últimos N días con su importe y su media, lo pendiente de
   enviar y de cobrar, y lo más vendido por unidades.

3. **«Las voces no funcionan: pongo hombre y suena la de mujer».** Su móvil
   tiene UNA sola voz en castellano —se ve en la captura: "Voz 1"—, así que
   pedir hombre y pedir mujer devolvían forzosamente la misma y el botón no
   podía hacer nada. Ahora `tonoPara()` comprueba lo que de verdad va a pasar
   —si pidiendo hombre y pidiendo mujer sale la misma voz— y en ese caso le
   mueve el tono de verdad (0,57 contra 1,27: se oye a la primera sílaba). Y la
   pantalla dice lo que hay y cómo instalar más voces, en vez de dejar un botón
   que aparenta funcionar.

   Se dejó de fiar del truco de adivinar el género por el nombre: en un Android
   las voces se llaman `es-es-x-eed-local` y eso es una letra de un código, no
   un dato.

Pruebas nuevas: `encargos-reales.test.mjs` (una tienda conectada que se lee sin
cookie, y el resumen con los números que hay de verdad contra la tienda de
mentira), más las de voces y las del encargo sin nada conectado.

---

## 3 bis. Antes: cómo contesta, y lo que cuesta cada mensaje

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
6. **El fondo, en los grupos.** El eclipse que mandó Carlos, de fondo **dentro
   del chat de grupo y de quedada, y en ningún otro sitio**: lo pidió así
   —*"lo quiero solo en los chats de grupo no en lo demas"*— y además encaja,
   porque la portada y el chat de uno ya tienen su propio eclipse delante y dos
   anillos cruzándose no dejan leer ninguno. Va en `public/fondo.webp`: 10 KB,
   del PNG de 1,08 MB que era medio segundo en blanco en un móvil con datos.
   Solo en tema oscuro (la foto es casi negra) y con un velo del 58% para que
   lo escrito mande.

   La primera versión lo puso en todas las pantallas y **no se veía en
   ninguna**, y Carlos lo dijo. Dos causas a la vez: encima del `body` va la
   aplicación entera en un `div` con su propio negro, y la capa iba con
   `z-index: -1`, que se pinta ANTES que el fondo de quien la contiene. Ahora
   es una clase en el panel del grupo y no hay nada que la tape. Y hay prueba:
   `fondo.test.mjs` no mira el CSS —hace una foto de la pantalla y compara
   brillos— porque esto se veía perfecto en el código.

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
   - Los 22 conectores (Shopify, Stripe, Telegram…). Los doce nuevos, más aún:
     están escritos contra la documentación de cada API y probados contra un
     servidor que habla como ella, pero nadie ha visto todavía una respuesta de
     verdad de PrestaShop, Slack o HubSpot.
   - **Gmail y el OAuth de Google**, que es lo más nuevo y lo que más piezas
     tiene. La pantalla de permisos de Google no se ha visto nunca desde aquí.
     Lo primero que hay que mirar si falla en producción: que la dirección de
     vuelta dada de alta en el panel de Google sea EXACTAMENTE
     `https://eclipse-ia.vercel.app/api/conexiones/oauth/gmail`, y que la
     aplicación de Google tenga aprobados los permisos de Gmail (Google los
     considera sensibles y puede pedir verificación antes de abrirlos a
     cualquiera que no sea el dueño de la aplicación).
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

**82 archivos, todas en verde.** Viven en `pruebas/`.

```bash
npm run prueba           # todas (~6 min)
npm run prueba:ligeras   # las 60 sin navegador (~12 s) ← para trabajar
node pruebas/mapa.test.mjs   # una suelta
```

No hay framework a propósito: cada prueba es un programa de Node que sale con 0
si va bien, así que se puede lanzar sola y lo que falla se lee en cristiano.
Levantan servidores de mentira (`apis-falsas.mjs`, `google-falso.mjs`,
`redis-falso.mjs`) y, cuando
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
2. **Los conectores de Google que faltan ya son fáciles.** El baile de OAuth
   está construido (`lib/conexiones/oauth.ts`) y Gmail lo estrena. Google
   Calendar, Drive y Analytics son ahora un archivo de conector más: añadir sus
   permisos a `GOOGLE.permisos` y escribir sus acciones. Outlook y WhatsApp
   Business necesitan su propio proveedor (otro `Proveedor` en `oauth.ts`, con
   sus variables de entorno), no uno nuevo desde cero. Los que se pueden hacer
   como los de clave: Mailerlite sí, Sendgrid sí, BigCommerce sí, Webflow sí;
   Etsy y Amazon Seller no.
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
