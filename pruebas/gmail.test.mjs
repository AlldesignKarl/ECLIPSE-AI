// Gmail y el baile de OAuth, enteros, contra un Google de mentira.
//
// Gmail es la primera conexión de ECLIPSE que no se hace pegando una clave, y
// eso trae piezas nuevas que, si fallan, fallan en silencio y días después:
//
//   1. El `state` firmado. Es lo único que impide que una vuelta ajena conecte
//      el correo de una persona a la cuenta de otra.
//   2. `access_type=offline`. Sin eso no hay testigo de refresco y la conexión
//      dura una hora.
//   3. El refresco. Y sobre todo: que al refrescar NO se pierda el testigo de
//      refresco, porque Google no lo devuelve otra vez.
//   4. Que un correo se lea de verdad aunque venga anidado en tres capas.
//   5. Que enviar sea `escribe`, y que no haya NI UNA acción que borre.
import { createHmac } from "node:crypto";
import { crear, ESPERADO } from "./google-falso.mjs";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const { servidor, estado } = crear();
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${servidor.address().port}`;

process.env.AUTH_SECRET = "secreto-de-pruebas-gmail";
process.env.CONEXION_BASE_OAUTH_GOOGLE = `${base}/oauth/auth`;
process.env.CONEXION_BASE_OAUTH_GOOGLE_TOKEN = `${base}/oauth/token`;
process.env.CONEXION_BASE_GMAIL = `${base}/gmail/v1/users/me`;

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const oauth = await jiti.import(enSrc("lib/conexiones/oauth.ts"));
const { gmail } = await jiti.import(enSrc("lib/conexiones/gmail.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const correr = async (cred, accion, args = {}) => {
  const a = gmail.acciones.find((x) => x.nombre === accion);
  if (!a) throw new Error(`Gmail no tiene la acción ${accion}`);
  return a.ejecutar({ cred, args });
};

try {
  /* --------------------- Sin configurar, no se miente ------------------- */
  console.log("\nSin configurar el servidor, se dice, no se aparenta");
  delete process.env.GOOGLE_OAUTH_ID;
  delete process.env.GOOGLE_OAUTH_SECRET;
  ok(oauth.oauthListo(oauth.GOOGLE) === false, "sin las variables, el proveedor no está listo");
  const sinNada = await gmail.verificar({});
  ok(!sinNada.ok && /GOOGLE_OAUTH_ID/.test(sinNada.error), `y lo dice con lo que falta: ${sinNada.error}`);

  process.env.GOOGLE_OAUTH_ID = ESPERADO.ID;
  process.env.GOOGLE_OAUTH_SECRET = ESPERADO.SECRETO;
  ok(oauth.oauthListo(oauth.GOOGLE) === true, "con las dos variables puestas, sí");

  /* ------------------------------ El estado ----------------------------- */
  console.log("\nEl `state` firmado: de quién es la vuelta");
  const estadoFirmado = oauth.firmarEstado("ana@ejemplo.com");
  ok(oauth.leerEstado(estadoFirmado) === "ana@ejemplo.com", "ida y vuelta: sale el mismo correo");
  ok(oauth.firmarEstado("ana@ejemplo.com") !== estadoFirmado,
     "dos estados del mismo correo no son iguales: llevan un azar dentro");

  const [cuerpo, firma] = estadoFirmado.split(".");
  ok(oauth.leerEstado(`${cuerpo}.${"a".repeat(firma.length)}`) === null, "una firma cambiada no vale");
  const otroCuerpo = Buffer.from(JSON.stringify({ e: "otro@ejemplo.com", t: Date.now(), n: "x" })).toString("base64url");
  ok(oauth.leerEstado(`${otroCuerpo}.${firma}`) === null,
     "y cambiar el correo dejando la firma tampoco: es justo el ataque que esto para");
  ok(oauth.leerEstado("") === null && oauth.leerEstado("basura") === null, "una cadena cualquiera, tampoco");

  // Uno firmado de verdad pero de hace media hora: la firma cuadra y aun así
  // no vale. Sin caducidad, un enlace de vuelta serviría para siempre.
  const viejo = Buffer.from(
    JSON.stringify({ e: "ana@ejemplo.com", t: Date.now() - 30 * 60 * 1000, n: "x" }),
  ).toString("base64url");
  const firmaVieja = createHmac("sha256", process.env.AUTH_SECRET).update(viejo).digest("base64url");
  ok(oauth.leerEstado(`${viejo}.${firmaVieja}`) === null, "un estado bien firmado pero caducado tampoco vale");

  /* ---------------------------- A dónde se manda ------------------------ */
  console.log("\nA dónde se manda a la persona");
  const destino = new URL(oauth.dondeAutorizar(oauth.GOOGLE, {
    origen: "https://eclipse-ia.vercel.app",
    servicio: "gmail",
    estado: estadoFirmado,
  }));
  ok(destino.searchParams.get("access_type") === "offline",
     "pide `offline`: sin eso no hay refresco y la conexión dura una hora");
  ok(destino.searchParams.get("prompt") === "consent",
     "y `consent`, para que lo dé también quien ya había autorizado antes");
  ok(destino.searchParams.get("redirect_uri") === "https://eclipse-ia.vercel.app/api/conexiones/oauth/gmail",
     `la vuelta es la que hay que dar de alta en Google: ${destino.searchParams.get("redirect_uri")}`);
  ok(destino.searchParams.get("client_id") === ESPERADO.ID, "con el identificador del servidor");
  ok(destino.searchParams.get("state") === estadoFirmado, "y el estado firmado");
  const permisos = destino.searchParams.get("scope").split(" ");
  ok(permisos.includes("https://www.googleapis.com/auth/gmail.readonly"), "pide leer el correo");
  ok(permisos.includes("https://www.googleapis.com/auth/gmail.send"), "y enviarlo");
  ok(!permisos.some((p) => /\.modify|mail\.google\.com/.test(p)),
     "y NO pide el permiso total de Gmail, que es el que deja borrar");
  ok(!destino.searchParams.get("client_secret"), "el secreto no viaja en la dirección: eso es del servidor");

  /* ------------------------------ El canje ------------------------------ */
  console.log("\nCambiar el código por los testigos");
  let malCanje = null;
  try {
    await oauth.canjearCodigo(oauth.GOOGLE, { codigo: "inventado", origen: "https://x.com", servicio: "gmail" });
  } catch (err) { malCanje = err; }
  ok(malCanje !== null, "un código que no vale no devuelve testigos: lanza");

  const testigos = await oauth.canjearCodigo(oauth.GOOGLE, {
    codigo: ESPERADO.CODIGO, origen: "https://x.com", servicio: "gmail",
  });
  ok(Boolean(testigos.acceso) && testigos.refresco === "ref-1", "con el código bueno vienen los dos testigos");
  ok(testigos.caduca > Date.now() && testigos.caduca < Date.now() + 3600_000,
     "y la caducidad se guarda con un minuto de margen, no pelada");
  ok(estado.peticiones.at(-1).grant_type === "authorization_code", "se pide como código de autorización");
  ok(estado.peticiones.at(-1).client_secret === ESPERADO.SECRETO, "y el secreto va por detrás, servidor a servidor");

  const cred = { acceso: testigos.acceso, refresco: testigos.refresco, caduca: String(testigos.caduca) };

  /* ---------------------------- Verificar ------------------------------ */
  console.log("\nComprobar la conexión antes de guardarla");
  const v = await gmail.verificar(cred);
  ok(v.ok && v.cuenta === "yo@miempresa.com", `dice a qué cuenta se ha conectado (${v.cuenta ?? v.error})`);
  ok(!(await gmail.verificar({ acceso: "inventado", caduca: String(Date.now() + 9e6) })).ok,
     "un testigo inventado se rechaza");

  /* ----------------------------- Leer correo ---------------------------- */
  console.log("\nLeer el correo de verdad");
  const busca = await correr(cred, "buscar_correo", { consulta: "from:ana@clienta.com" });
  ok(/m1/.test(busca) && /m3/.test(busca), "busca con la sintaxis de Gmail y trae los dos de esa persona");
  ok(!/m2/.test(busca), "y no trae los de los demás");
  ok(/Pedido 1043 sin llegar/.test(busca), "con el asunto, que es lo que se mira de un vistazo");

  const vacio = await correr(cred, "buscar_correo", { consulta: "from:nadie@ninguna.com" });
  ok(/No hay ningún correo/.test(vacio), "y si no hay nada lo dice, no devuelve una lista vacía");

  const sinLeer = await correr(cred, "sin_leer");
  ok(/m1/.test(sinLeer) && /m3/.test(sinLeer) && !/m2/.test(sinLeer), "los sin leer son solo los sin leer");

  const uno = await correr(cred, "leer_correo", { id: "m1" });
  ok(/El pedido 1043 no ha llegado/.test(uno),
     "el texto sale entero aunque venga anidado en tres capas");
  ok(!/<p>/.test(uno), "y sin etiquetas HTML por medio");
  ok(/De: Ana Ruiz/.test(uno) && /Identificador del hilo: h1/.test(uno),
     "con quién escribe y el hilo, que es lo que hace falta para responder");
  ok(/Falta el identificador/.test(await correr(cred, "leer_correo", {})), "sin identificador lo dice en cristiano");

  /* ------------------------------- Enviar ------------------------------- */
  console.log("\nEnviar, que es lo que no tiene vuelta atrás");
  const mal = await correr(cred, "enviar_correo", { para: "ana(arroba)clienta.com", texto: "hola" });
  ok(/no parece una dirección/.test(mal) && estado.enviados.length === 0,
     "una dirección mal escrita se para aquí, sin llamar a Google");
  ok(/Hacen falta/.test(await correr(cred, "enviar_correo", { para: "ana@clienta.com" })),
     "y un correo sin texto tampoco sale");

  const enviado = await correr(cred, "enviar_correo", {
    para: "ana@clienta.com",
    asunto: "Últimas novedades ✨",
    texto: "Hola Ana:\n\nEl pedido sale mañana.",
    hilo: "h1",
  });
  ok(/Correo enviado a ana@clienta\.com/.test(enviado), "el envío se confirma con el destinatario");
  ok(estado.enviados.length === 1, "y ha llegado a Google una sola vez");
  const salido = estado.enviados[0];
  ok(/^To: ana@clienta\.com/m.test(salido.crudo), "con el destinatario donde toca");
  ok(/^Subject: =\?UTF-8\?B\?/m.test(salido.crudo),
     "el asunto con tildes y emoji va codificado: sin eso llega roto y no es cosa de Google");
  ok(Buffer.from(/\n\n([A-Za-z0-9+/=]+)\s*$/.exec(salido.crudo.replace(/\r/g, ""))[1], "base64").toString("utf8")
       .includes("El pedido sale mañana"),
     "y el texto llega entero, con sus eñes");
  ok(salido.hilo === "h1", "respondiendo en el hilo que era, no abriendo uno nuevo");

  /* ------------------------------ Refrescar ----------------------------- */
  console.log("\nCuando el testigo caduca, se saca otro sin molestar a nadie");
  const antesRefrescos = estado.refrescos;
  const caducada = { acceso: testigos.acceso, refresco: "ref-1", caduca: String(Date.now() - 1000) };
  const conCaducada = await correr(caducada, "sin_leer");
  ok(estado.refrescos === antesRefrescos + 1, "se ha refrescado una vez");
  ok(/sin leer/.test(conCaducada), "y la acción ha salido adelante igualmente");
  ok(caducada.acceso !== testigos.acceso, "las credenciales de quien llama se han actualizado con el nuevo");
  ok(Number(caducada.caduca) > Date.now(), "con su caducidad nueva");
  /*
    Lo que más duele si se rompe.

    Google NO devuelve refresh_token al refrescar. Si se machaca con lo que
    viene (la cadena vacía), la conexión funciona hoy y está muerta dentro de
    una hora, sin ningún error por ninguna parte.
  */
  ok(caducada.refresco === "ref-1", "y el testigo de REFRESCO se conserva, que es lo que mantiene viva la conexión");

  const segunda = await correr(caducada, "sin_leer");
  ok(estado.refrescos === antesRefrescos + 1, "la siguiente acción NO vuelve a refrescar: se guardó el nuevo");
  ok(/sin leer/.test(segunda), "y sigue funcionando");

  let sinRefresco = null;
  try {
    await oauth.accesoVigente(oauth.GOOGLE, { acceso: "x", caduca: "0" });
  } catch (err) { sinRefresco = err; }
  ok(sinRefresco !== null && /vuelve a conectarla/i.test(sinRefresco.message),
     "y una conexión sin refresco pide reconectar en cristiano, sin códigos");

  /* ------------------------------ El contrato --------------------------- */
  console.log("\nLo que Gmail no puede hacer");
  ok(gmail.oauth === "google", "está marcado como OAuth: la pantalla enseña un botón, no un formulario");
  ok(gmail.campos.length === 0, "y no pide ninguna clave, porque no hay ninguna que pedir");
  ok(!gmail.acciones.some((a) => /borrar|eliminar|papelera|trash|delete/i.test(a.nombre)),
     "no hay NI UNA acción que borre: en un buzón de trabajo, menos que en ningún sitio");
  ok(gmail.acciones.filter((a) => a.escribe).map((a) => a.nombre).join() === "enviar_correo",
     "y la única que escribe es enviar, así que en solo lectura no sale nada de aquí");
} finally {
  servidor.close();
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
