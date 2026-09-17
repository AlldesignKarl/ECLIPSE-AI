// La web corporativa de artesanía: lo que NO se puede romper.
//
// Tres cosas se comprueban aquí, y las tres son de las que no dan error cuando
// fallan —simplemente dejan de funcionar y nadie se entera—:
//   1. El formulario valida IGUAL en el navegador y en el servidor.
//   2. Un dato que no tenemos no se inventa: ni un enlace de teléfono vacío.
//   3. Si no hay dónde entregar una solicitud, se DICE. Nunca "gracias" por un
//      mensaje que se ha perdido.
import { createServer } from "node:http";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { errores, limpiar, comoTexto, esValida, ASUNTOS } = await jiti.import(
  enSrc("lib/artesania/solicitud.ts"),
);
const { EMPRESA, monograma, enlaceCorreo, enlaceTelefono, enlaceWhatsApp, loQueFalta } =
  await jiti.import(enSrc("lib/artesania/config.ts"));
const { PRODUCTOS, CATEGORIAS, ordenados } = await jiti.import(enSrc("lib/artesania/productos.ts"));
const { entregar, hayDondeEntregar } = await jiti.import(enSrc("lib/artesania/entrega.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

const BUENA = {
  nombre: "Ana Pérez",
  empresa: "Tienda del Museo",
  email: "ana@tiendadelmuseo.es",
  telefono: "+34 976 000 000",
  mensaje: "Nos interesa la colección de cerámica para la tienda del museo. ¿Mínimos?",
  asunto: "catalogo",
};

console.log("\nEl formulario valida lo que tiene que validar");
ok(esValida(BUENA), "una solicitud completa pasa");
ok(errores({ ...BUENA, nombre: "" }).nombre, "sin nombre no pasa");
ok(errores({ ...BUENA, empresa: "" }).empresa, "sin empresa no pasa: esto es venta a empresas");
ok(errores({ ...BUENA, email: "ana@sitio" }).email, "un correo sin dominio completo no pasa");
ok(errores({ ...BUENA, email: "ana arroba sitio.es" }).email, "y uno sin arroba tampoco");
ok(!errores({ ...BUENA, telefono: "" }).telefono, "el teléfono es opcional de verdad");
ok(errores({ ...BUENA, telefono: "llámame" }).telefono, "pero si lo pone, tiene que ser un teléfono");
ok(errores({ ...BUENA, mensaje: "hola" }).mensaje, "un mensaje de cuatro letras no es una consulta");
ok(
  Object.keys(errores({ nombre: "", empresa: "", email: "", mensaje: "" })).length >= 4,
  "salen TODOS los errores a la vez, no de uno en uno",
);

console.log("\nLo que entra se limpia antes de guardarse");
const limpia = limpiar({ ...BUENA, email: "  ANA@Tiendadelmuseo.ES ", nombre: "  Ana Pérez  " });
ok(limpia.email === "ana@tiendadelmuseo.es", "el correo se guarda en minúsculas y sin espacios");
ok(limpia.nombre === "Ana Pérez", "los espacios de los lados se van");
ok(limpiar({ ...BUENA, asunto: "otra-cosa" }).asunto === "informacion", "un asunto inventado cae en el genérico");
ok(limpiar({ ...BUENA, mensaje: "x".repeat(9000) }).mensaje.length <= 2000, "un mensaje enorme se corta");

console.log("\nEl correo que le llega a la empresa se lee");
const texto = comoTexto(limpiar(BUENA));
ok(texto.includes("Tienda del Museo"), "lleva la empresa");
ok(texto.includes("ana@tiendadelmuseo.es"), "lleva el correo para poder contestar");
ok(texto.includes(ASUNTOS.catalogo), "y dice para qué escriben");
ok(comoTexto(limpiar({ ...BUENA, telefono: "" })).includes("no lo ha dejado"), "sin teléfono lo dice, no deja un hueco");

console.log("\nLo que no sabemos de la empresa NO se inventa");
ok(EMPRESA.email === null, "el correo sigue sin rellenar (marcador, no un correo falso)");
ok(enlaceCorreo("Hola") === null, "sin correo no hay enlace de correo");
ok(enlaceTelefono() === null, "sin teléfono no hay enlace de teléfono");
ok(enlaceWhatsApp("hola") === null, "sin número no hay botón de WhatsApp");
ok(loQueFalta().includes("email") && loQueFalta().includes("CIF"), "y lo que falta sale listado para rellenarlo");
ok(monograma().length === 2, "el monograma del sello siempre son dos letras");

console.log("\nEl catálogo está bien montado");
ok(new Set(PRODUCTOS.map((p) => p.id)).size === PRODUCTOS.length, "no hay dos productos con el mismo id");
ok(PRODUCTOS.every((p) => CATEGORIAS.includes(p.categoria)), "todas las categorías existen en el filtro");
ok(PRODUCTOS.every((p) => p.nombre && p.descripcion && p.detalle), "ninguna ficha está a medias");
ok(ordenados()[0].destacado === true, "los destacados se pintan primero");
ok(ordenados("Cerámica").every((p) => p.categoria === "Cerámica"), "el filtro filtra");

console.log("\nUna solicitud acaba en algún sitio, o se dice que no");
delete process.env.ARTESANIA_WEBHOOK_URL;
delete process.env.RESEND_API_KEY;
ok(hayDondeEntregar() === false, "sin nada configurado, no hay buzón");
const perdida = await entregar(limpiar(BUENA));
ok(perdida.entregada === false, "y una solicitud NO se da por entregada");
ok(perdida.caminos[0] === "ninguno", "se dice por dónde no ha salido");

const recibidas = [];
const buzon = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    recibidas.push(JSON.parse(c || "{}"));
    res.writeHead(200).end("{}");
  });
});
await new Promise((r) => buzon.listen(0, "127.0.0.1", r));
process.env.ARTESANIA_WEBHOOK_URL = `http://127.0.0.1:${buzon.address().port}/entra`;

ok(hayDondeEntregar() === true, "con un webhook puesto ya hay buzón");
const entregada = await entregar(limpiar(BUENA));
ok(entregada.entregada === true, "y la solicitud se entrega");
ok(entregada.caminos.includes("webhook"), "por el webhook");
ok(recibidas.length === 1 && recibidas[0].empresa === "Tienda del Museo", "con todos los datos dentro");
ok(Boolean(recibidas[0].id), "y con una referencia para poder buscarla luego");
buzon.close();

console.log(fallos.length ? `\n${fallos.length} fallos\n` : "\nTodo bien\n");
process.exit(fallos.length ? 1 : 0);
