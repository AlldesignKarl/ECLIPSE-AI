// Los doce conectores nuevos, cada uno entero contra un servidor que habla como
// su API: que comprueba la clave antes de guardarla, que lee bien, que escribe
// donde tiene que escribir, y que una clave mala se rechaza en cristiano.
import { crear, ESPERADO, escrituras } from "./apis-nuevas.mjs";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const servidor = crear();
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${servidor.address().port}`;

// Cada uno en su prefijo: si un conector se equivoca de ruta, se ve en el acto
// en vez de caer en la respuesta de otro servicio.
const PREFIJOS = {
  PRESTASHOP: "/presta", MAILCHIMP: "/mc/3.0", BREVO: "/brevo", AIRTABLE: "/at",
  TRELLO: "/trello", TODOIST: "/todoist", SLACK: "/slack", DISCORD: "/discord",
  HUBSPOT: "/hs", CALENDLY: "/cal", CLOUDFLARE: "/cf", VERCEL: "/vercel",
};
for (const [id, prefijo] of Object.entries(PREFIJOS)) process.env[`CONEXION_BASE_${id}`] = base + prefijo;

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const cargar = async (archivo, nombre) => (await jiti.import(enSrc(`lib/conexiones/${archivo}.ts`)))[nombre];

const prestashop = await cargar("prestashop", "prestashop");
const mailchimp = await cargar("mailchimp", "mailchimp");
const brevo = await cargar("brevo", "brevo");
const airtable = await cargar("airtable", "airtable");
const trello = await cargar("trello", "trello");
const todoist = await cargar("todoist", "todoist");
const slack = await cargar("slack", "slackServicio");
const discord = await cargar("discord", "discord");
const hubspot = await cargar("hubspot", "hubspot");
const calendly = await cargar("calendly", "calendly");
const cloudflare = await cargar("cloudflare", "cloudflare");
const vercel = await cargar("vercel", "vercel");

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const correr = async (servicio, cred, accion, args = {}) => {
  const a = servicio.acciones.find((x) => x.nombre === accion);
  if (!a) throw new Error(`${servicio.id} no tiene la acción ${accion}`);
  return a.ejecutar({ cred, args });
};

/* ----------------------------- PrestaShop ----------------------------- */
console.log("\nPrestaShop");
const credPresta = { sitio: "https://mitienda.com", clave: ESPERADO.CLAVE_PRESTASHOP };
const vPresta = await prestashop.verificar(credPresta);
ok(vPresta.ok && /mitienda\.com/.test(vPresta.cuenta), `verifica y dice qué tienda (${vPresta.cuenta ?? vPresta.error})`);
ok(!(await prestashop.verificar({ ...credPresta, clave: "otra" })).ok, "rechaza una clave que no vale");
ok(!(await prestashop.verificar({ sitio: "mitienda.com", clave: "x" })).ok, "y una dirección sin https, antes de salir a la red");
const prodPresta = await correr(prestashop, credPresta, "listar_productos");
ok(/Vela de soja · 12\.50 €/.test(prodPresta), "lista productos con el precio en euros, no en «12.500000»");
ok(/stock 0/.test(prodPresta) && /DESACTIVADO/.test(prodPresta), "y marca lo que está agotado o apagado");
const fichaPresta = await correr(prestashop, credPresta, "ver_producto", { id: "1" });
ok(/Cuarenta horas de luz/.test(fichaPresta) && !/<p>/.test(fichaPresta), "la ficha llega sin etiquetas HTML");
ok(/Título SEO: \(vacío/.test(fichaPresta), "y avisa de que el título SEO está vacío, que es lo primero que hay que arreglar");
ok(/47\.40 € en total/.test(await correr(prestashop, credPresta, "listar_pedidos")), "suma los pedidos");
ok(!prestashop.acciones.some((a) => a.escribe), "PrestaShop no escribe nada: su API escribe en XML y equivocarse ahí no tiene vuelta");

/* ------------------------------ Mailchimp ------------------------------ */
console.log("\nMailchimp");
const credMc = { clave: ESPERADO.CLAVE_MAILCHIMP };
const vMc = await mailchimp.verificar(credMc);
ok(vMc.ok && /Eclipse SL/.test(vMc.cuenta) && /1240/.test(vMc.cuenta), `verifica y cuenta los suscriptores (${vMc.cuenta ?? vMc.error})`);
ok(!(await mailchimp.verificar({ clave: "mc-malo-us21" })).ok, "rechaza una clave que no vale");
const listasMc = await correr(mailchimp, credMc, "listar_listas");
ok(/Clientes \(id l1\) · 1200 suscriptores/.test(listasMc), "lista las audiencias con su gente");
ok(/42\.0%/.test(listasMc), "y qué porcentaje abre los correos");
ok(/Novedades de septiembre/.test(await correr(mailchimp, credMc, "listar_campanas")), "lista las campañas enviadas");
ok(/3 correos que rebotan/.test(await correr(mailchimp, credMc, "ver_lista", { id: "l1" })), "abre una lista por dentro");
ok(!mailchimp.acciones.some((a) => a.escribe), "y no manda correos: eso se hace mirando dos veces, desde su panel");

/* -------------------------------- Brevo -------------------------------- */
console.log("\nBrevo");
const credBrevo = { clave: ESPERADO.CLAVE_BREVO };
const vBrevo = await brevo.verificar(credBrevo);
ok(vBrevo.ok && /Eclipse SL/.test(vBrevo.cuenta), `verifica (${vBrevo.cuenta ?? vBrevo.error})`);
ok(!(await brevo.verificar({ clave: "xkeysib-malo" })).ok, "rechaza una clave que no vale");
ok(/Boletín \(id 3\) · 540 contactos/.test(await correr(brevo, credBrevo, "listar_listas")), "lista los contactos por lista");
ok(/40\.0% aperturas/.test(await correr(brevo, credBrevo, "listar_campanas")), "calcula el porcentaje de aperturas del envío");
ok(/Ana/.test(await correr(brevo, credBrevo, "ver_contacto", { correo: "ana@ejemplo.com" })), "encuentra a un contacto por su correo");
ok(/no está en tus contactos/.test(await correr(brevo, credBrevo, "ver_contacto", { correo: "nadie@ejemplo.com" })),
   "y cuando no está lo dice, en vez de soltar un error");

/* ------------------------------- Airtable ------------------------------- */
console.log("\nAirtable");
const credAt = { token: ESPERADO.TOKEN_AIRTABLE };
const vAt = await airtable.verificar(credAt);
ok(vAt.ok && /Pedidos/.test(vAt.cuenta), `verifica y dice a qué bases llega (${vAt.cuenta ?? vAt.error})`);
ok(!(await airtable.verificar({ token: "patMalo" })).ok, "rechaza un token que no vale");
ok(/Pedidos \(appUno\)/.test(await correr(airtable, credAt, "listar_bases")), "lista las bases con su identificador");
ok(/Nombre \(singleLineText\)/.test(await correr(airtable, credAt, "ver_tablas", { base: "appUno" })), "enseña las columnas de cada tabla");
const filas = await correr(airtable, credAt, "listar_filas", { base: "appUno", tabla: "Encargos" });
ok(/Tarta de manzana/.test(filas) && /urgente, local/.test(filas), "lee las filas, y una celda con lista se lee del tirón");
escrituras.length = 0;
await correr(airtable, credAt, "crear_fila", { base: "appUno", tabla: "Encargos", campos: { Nombre: "Pan de pueblo" } });
ok(escrituras.at(-1)?.cuerpo?.fields?.Nombre === "Pan de pueblo", "crea la fila con sus campos");
ok(/faltan los campos/.test(await correr(airtable, credAt, "crear_fila", { base: "appUno", tabla: "Encargos" })),
   "y no manda una fila vacía si no se le dice qué poner");
ok(!airtable.acciones.some((a) => /borrar|eliminar|actualizar|cambiar/.test(a.nombre)), "no cambia ni borra lo que ya estaba");

/* -------------------------------- Trello -------------------------------- */
console.log("\nTrello");
const credTrello = { clave: ESPERADO.CLAVE_TRELLO, token: ESPERADO.TOKEN_TRELLO };
const vTrello = await trello.verificar(credTrello);
ok(vTrello.ok && /Karl/.test(vTrello.cuenta), `verifica (${vTrello.cuenta ?? vTrello.error})`);
ok(!(await trello.verificar({ clave: "x", token: "y" })).ok, "rechaza una pareja que no vale");
const tableros = await correr(trello, credTrello, "listar_tableros");
ok(/Tienda \(b1\)/.test(tableros) && !/Viejo/.test(tableros), "lista los tableros abiertos y deja fuera los archivados");
const tablero = await correr(trello, credTrello, "ver_tablero", { tablero: "b1" });
ok(/Por hacer \(1\)/.test(tablero) && /Cambiar las fotos/.test(tablero), "reparte las tarjetas en su columna");
ok(/para el 2026-09-20/.test(tablero), "y dice para cuándo es cada una");
ok(/\(vacía\)/.test(tablero) === false || /Hecho \(1\)/.test(tablero), "las columnas con tarjetas no salen vacías");
escrituras.length = 0;
await correr(trello, credTrello, "crear_tarjeta", { columna: "li1", titulo: "Pedir cajas", fecha: "2026-10-01" });
ok(escrituras.at(-1)?.consulta?.name === "Pedir cajas", "crea la tarjeta con su título");
ok(escrituras.at(-1)?.consulta?.due === "2026-10-01", "y con su fecha de entrega");

/* -------------------------------- Todoist -------------------------------- */
console.log("\nTodoist");
const credTd = { token: ESPERADO.TOKEN_TODOIST };
const vTd = await todoist.verificar(credTd);
ok(vTd.ok && /2 proyecto/.test(vTd.cuenta), `verifica contando lo que ve de verdad (${vTd.cuenta ?? vTd.error})`);
ok(!(await todoist.verificar({ token: "malo" })).ok, "rechaza un token que no vale");
const tareasTd = await correr(todoist, credTd, "listar_tareas");
ok(/Llamar al gestor · 2026-09-15 · URGENTE/.test(tareasTd), "lee las tareas con su fecha, y la prioridad 4 se dice «urgente»");
ok(!/Pedir cajas · 2026-09-30 · URGENTE/.test(tareasTd), "y lo que no es urgente no lo marca");
const hoy = await correr(todoist, credTd, "listar_tareas", { filtro: "hoy" });
ok(/Llamar al gestor/.test(hoy) && !/Pedir cajas/.test(hoy), "«hoy» pide solo lo de hoy");
escrituras.length = 0;
await correr(todoist, credTd, "crear_tarea", { texto: "Llamar al fontanero", cuando: "el martes" });
ok(escrituras.at(-1)?.cuerpo?.content === "Llamar al fontanero", "apunta la tarea");
ok(escrituras.at(-1)?.cuerpo?.due_string === "el martes", "y la fecha va escrita como se habla: Todoist entiende castellano mejor que nosotros");
ok(!todoist.acciones.some((a) => /completar|cerrar|borrar/.test(a.nombre)), "no da por hecho lo que no has hecho");

/* --------------------------------- Slack --------------------------------- */
console.log("\nSlack");
const credSlack = { token: ESPERADO.TOKEN_SLACK };
const vSlack = await slack.verificar(credSlack);
ok(vSlack.ok && /Eclipse/.test(vSlack.cuenta), `verifica y dice en qué espacio está (${vSlack.cuenta ?? vSlack.error})`);
const malSlack = await slack.verificar({ token: "xoxb-malo" });
ok(!malSlack.ok && /rechazado el token/.test(malSlack.error),
   "una clave mala se rechaza AUNQUE Slack conteste 200: el fallo va dentro del cuerpo");
ok(!(await slack.verificar({ token: "xoxp-personal" })).ok, "y avisa de que el token personal (xoxp) no sirve, antes de salir a la red");
const canales = await correr(slack, credSlack, "listar_canales");
ok(/#general \(C1\)/.test(canales), "lista los canales con su id");
ok(/el bot NO está dentro/.test(canales), "y avisa de los canales donde no está, que es el fallo de siempre");
const leido = await correr(slack, credSlack, "leer_canal", { canal: "C1" });
ok(leido.indexOf("he cambiado las fotos") < leido.indexOf("y mañana lo subimos"),
   "los mensajes se leen del más viejo al más nuevo: al revés no se entiende una conversación");
let errorCanal = "";
try { await correr(slack, credSlack, "leer_canal", { canal: "C9" }); } catch (e) { errorCanal = e.message; }
ok(/no existe o el bot no está dentro/.test(errorCanal), "un canal que no ve se explica en cristiano");
escrituras.length = 0;
await correr(slack, credSlack, "escribir_en_canal", { canal: "C1", texto: "Ya está subido" });
ok(escrituras.at(-1)?.cuerpo?.text === "Ya está subido", "escribe en el canal que se le dice");

/* -------------------------------- Discord -------------------------------- */
console.log("\nDiscord");
const credDc = { token: ESPERADO.TOKEN_DISCORD };
const vDc = await discord.verificar(credDc);
ok(vDc.ok && /Comunidad Eclipse/.test(vDc.cuenta), `verifica y dice en qué servidores está (${vDc.cuenta ?? vDc.error})`);
ok(!(await discord.verificar({ token: "malo" })).ok, "rechaza un token que no vale");
const canalesDc = await correr(discord, credDc, "listar_canales");
ok(/#anuncios \(c1\)/.test(canalesDc) && !/voz/.test(canalesDc), "lista los canales de texto y deja fuera los de voz, que no se leen");
ok(/ana: ¿alguien sabe cuándo abre\?/.test(await correr(discord, credDc, "leer_canal", { canal: "c1" })), "lee los mensajes");
escrituras.length = 0;
await correr(discord, credDc, "escribir_en_canal", { canal: "c1", texto: "Abrimos a las 9" });
ok(escrituras.at(-1)?.cuerpo?.content === "Abrimos a las 9", "escribe en el canal");
ok(!discord.acciones.some((a) => /expulsar|banear|borrar/.test(a.nombre)), "no echa a nadie ni borra mensajes");

/* -------------------------------- HubSpot -------------------------------- */
console.log("\nHubSpot");
const credHs = { token: ESPERADO.TOKEN_HUBSPOT };
const vHs = await hubspot.verificar(credHs);
ok(vHs.ok, `verifica aunque le falte el permiso de ver los datos de la cuenta (${vHs.cuenta ?? vHs.error})`);
ok(!(await hubspot.verificar({ token: "pat-malo" })).ok, "rechaza un token que no vale");
ok(/Ana Ruiz · ana@ejemplo\.com · Panadería Ruiz/.test(await correr(hubspot, credHs, "listar_contactos")), "lista los contactos");
ok(/600000000/.test(await correr(hubspot, credHs, "buscar_contacto", { buscar: "ana" })), "busca a alguien y trae su teléfono");
ok(/cuadre con «zzz»/.test(await correr(hubspot, credHs, "buscar_contacto", { buscar: "zzz" })), "y cuando no hay nadie, lo dice");
const negocios = await correr(hubspot, credHs, "listar_negocios");
ok(/3000\.00 € en juego/.test(negocios), "suma lo que hay en juego");
ok(!hubspot.acciones.some((a) => a.escribe), "y no toca el CRM: es la memoria comercial de una empresa");

/* -------------------------------- Calendly -------------------------------- */
console.log("\nCalendly");
const credCal = { token: ESPERADO.TOKEN_CALENDLY };
const vCal = await calendly.verificar(credCal);
ok(vCal.ok && /Karl/.test(vCal.cuenta), `verifica (${vCal.cuenta ?? vCal.error})`);
ok(credCal.usuario === "https://api.calendly.com/users/UNO", "y se guarda de quién es la agenda, para no preguntarlo en cada consulta");
ok(!(await calendly.verificar({ token: "malo" })).ok, "rechaza un token que no vale");
const citas = await correr(calendly, credCal, "ver_citas");
ok(/16\/09 a las 09:00/.test(citas), "las citas se leen con día y hora, no en formato de máquina");
ok(!/Cancelada/.test(citas), "y las canceladas no cuentan como citas");
ok(/30 min/.test(await correr(calendly, credCal, "ver_tipos_de_cita")), "lee lo que te puede reservar la gente");
ok(!calendly.acciones.some((a) => a.escribe), "no cancela ni mueve la cita de nadie");

/* ------------------------------- Cloudflare ------------------------------- */
console.log("\nCloudflare");
const credCf = { token: ESPERADO.TOKEN_CLOUDFLARE };
const vCf = await cloudflare.verificar(credCf);
ok(vCf.ok && /mitienda\.com/.test(vCf.cuenta), `verifica y dice a qué dominios llega (${vCf.cuenta ?? vCf.error})`);
const malCf = await cloudflare.verificar({ token: "malo" });
ok(!malCf.ok, "rechaza un token que no vale, con el fallo metido dentro del cuerpo");
const dnsCf = await correr(cloudflare, credCf, "ver_dns", { dominio: "mitienda.com" });
ok(/A:/.test(dnsCf) && /1\.2\.3\.4/.test(dnsCf) && /por Cloudflare/.test(dnsCf), "agrupa los registros por tipo y marca los que pasan por su red");
ok(/no hay ningún dominio/.test(await correr(cloudflare, credCf, "ver_dns", { dominio: "otro.com" })), "dice que no cuando el dominio no es suyo");
escrituras.length = 0;
const creado = await correr(cloudflare, credCf, "crear_registro_dns", { dominio: "mitienda.com", tipo: "txt", contenido: "google-site-verification=abc" });
ok(escrituras.at(-1)?.cuerpo?.type === "TXT", "crea el registro con el tipo en mayúsculas");
ok(escrituras.at(-1)?.cuerpo?.ttl === 1, "y con el TTL automático, que es lo que quiere casi todo el mundo");
ok(/tarda un rato en extenderse/.test(creado), "avisa de que el DNS tarda");
ok(/sostiene el dominio entero/.test(await correr(cloudflare, credCf, "crear_registro_dns", { dominio: "mitienda.com", tipo: "NS", contenido: "x" })),
   "y no deja tocar los servidores de nombres");
ok(!cloudflare.acciones.some((a) => /borrar|eliminar|editar/.test(a.nombre)), "no borra ni edita registros");

/* --------------------------------- Vercel --------------------------------- */
console.log("\nVercel");
const credVc = { token: ESPERADO.TOKEN_VERCEL };
const vVc = await vercel.verificar(credVc);
ok(vVc.ok && /alldesignkarl/.test(vVc.cuenta), `verifica y dice de quién es (${vVc.cuenta ?? vVc.error})`);
ok(!(await vercel.verificar({ token: "malo" })).ok, "rechaza un token que no vale");
ok(/eclipse-ia · nextjs/.test(await correr(vercel, credVc, "listar_proyectos")), "lista los proyectos con su dirección");
const despliegues = await correr(vercel, credVc, "ver_despliegues");
ok(/publicado · PRODUCCIÓN/.test(despliegues), "dice si el último subió bien, en castellano y no en READY");
ok(/FALLÓ/.test(despliegues) && /hace 1 h/.test(despliegues), "señala el que falló y cuánto hace");
ok(/verificado/.test(await correr(vercel, credVc, "ver_dominios")), "lee los dominios");
ok(!vercel.acciones.some((a) => a.escribe), "no publica ni tira atrás nada: eso es la web de alguien");

servidor.close();
console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
