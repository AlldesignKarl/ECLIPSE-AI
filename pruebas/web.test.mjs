// La web corporativa de artesanía: lo que NO se puede romper.
//
// Tres cosas se comprueban aquí, y las tres son de las que no dan error cuando
// fallan —simplemente dejan de funcionar y nadie se entera—:
//   1. El formulario valida IGUAL en el navegador y en el servidor.
//   2. Un dato que no tenemos no se inventa: ni un enlace de teléfono vacío.
//   3. Si no hay dónde entregar una solicitud, se DICE. Nunca "gracias" por un
//      mensaje que se ha perdido.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { errores, limpiar, comoTexto, esValida, ASUNTOS } = await jiti.import(
  enSrc("lib/solicitud.ts"),
);
const { EMPRESA, monograma, enlaceCorreo, enlaceTelefono, enlaceWhatsApp, loQueFalta } =
  await jiti.import(enSrc("lib/config.ts"));
const { PRODUCTOS, CATEGORIAS, ordenados } = await jiti.import(enSrc("lib/productos.ts"));
const { entregar, hayDondeEntregar } = await jiti.import(enSrc("lib/entrega.ts"));

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

/* ------------------------------ La paleta -------------------------------- */

/*
  Que los colores de la marca se PUEDAN LEER.
  Esto no es una prueba de gusto: es la que habría cazado el fallo que tuvimos,
  con el texto de los párrafos en gris oscuro sobre el azul de la noche. Se veía
  "elegante" en una captura y no se leía en un móvil a pleno sol.
*/
const css = readFileSync(enSrc("app/globals.css"), "utf8");

/** Saca un color de la paleta por su nombre de variable. */
function color(nombre) {
  const m = css.match(new RegExp(`--arte-${nombre}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`No existe --arte-${nombre} en globals.css`);
  const hex = m[1];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** El contraste tal y como lo define la norma de accesibilidad (WCAG). */
function contraste(a, b) {
  const luz = (rgb) =>
    rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

console.log("\nLos colores de la marca se leen");
const pares = [
  ["marfil", "noche", 7, "los titulares sobre la noche de la portada"],
  ["marfil", "azul", 7, "los titulares sobre el azul profundo"],
  ["texto-claro-suave", "noche", 4.5, "el gris azulado sobre la noche"],
  ["texto-claro-suave", "azul", 4.5, "el gris azulado sobre el azul profundo"],
  ["texto-suave", "marfil", 4.5, "el texto de párrafo sobre marfil"],
  ["texto", "marfil", 7, "los titulares oscuros sobre marfil"],
  ["oro", "noche", 4.5, "el oro sobre la noche"],
];
for (const [frente, fondo, minimo, que] of pares) {
  const r = contraste(color(frente), color(fondo));
  ok(r >= minimo, `${que}: ${r.toFixed(1)} (hace falta ${minimo})`);
}

ok(
  css.includes(".fondo-portada") &&
    css.includes(".fondo-ciudad") &&
    css.includes(".fondo-contacto"),
  "cada acto de la web tiene su fondo propio",
);
ok(
  /\.fondo-\w+[^}]*linear-gradient\(\s*180deg/.test(css),
  "y los fondos son degradados, no colores planos",
);

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
delete process.env.WEBHOOK_SOLICITUDES;
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
process.env.WEBHOOK_SOLICITUDES = `http://127.0.0.1:${buzon.address().port}/entra`;

ok(hayDondeEntregar() === true, "con un webhook puesto ya hay buzón");
const entregada = await entregar(limpiar(BUENA));
ok(entregada.entregada === true, "y la solicitud se entrega");
ok(entregada.caminos.includes("webhook"), "por el webhook");
ok(recibidas.length === 1 && recibidas[0].empresa === "Tienda del Museo", "con todos los datos dentro");
ok(Boolean(recibidas[0].id), "y con una referencia para poder buscarla luego");
buzon.close();

console.log(fallos.length ? `\n${fallos.length} fallos\n` : "\nTodo bien\n");
process.exit(fallos.length ? 1 : 0);
