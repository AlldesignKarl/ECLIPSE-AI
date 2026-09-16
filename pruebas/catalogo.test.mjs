// Las reglas del catálogo entero, servicio por servicio.
//
// Existe porque las reglas que de verdad protegen la cuenta de alguien no se
// pueden comprobar "en el que acabo de escribir": se comprueban en TODOS, y en
// los que se añadan mañana sin que nadie se acuerde de esta lista. Ninguna
// conexión borra nada, ninguna nace pudiendo escribir, y ninguna enseña su
// clave.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { SERVICIOS, admiteEscritura, puedeHacer, estadoDe } =
  await jiti.import(enSrc("lib/conexiones/registro.ts"));
const { LOGOS } = await jiti.import(enSrc("lib/conexiones/logos.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

console.log(`\nEl catálogo (${SERVICIOS.length} servicios)`);
ok(SERVICIOS.length >= 21, `hay ${SERVICIOS.length} servicios para conectar`);
ok(new Set(SERVICIOS.map((s) => s.id)).size === SERVICIOS.length, "ningún identificador está repetido");
ok(SERVICIOS.every((s) => s.nombre && s.resumen && s.enlace), "todos se presentan: nombre, para qué sirve y dónde se saca la clave");
ok(SERVICIOS.every((s) => s.pasos.length >= 2), "todos explican cómo conseguir la clave, paso a paso");
// Los de clave dicen qué hay que pegar. Los de OAuth no piden nada: lo que dan
// es un botón, y un formulario vacío ahí sería una pantalla sin nada dentro.
ok(SERVICIOS.every((s) => (s.oauth ? s.campos.length === 0 : s.campos.length >= 1)),
   "los de clave dicen qué hay que pegar, y los de permiso no piden nada que pegar");
ok(SERVICIOS.filter((s) => s.oauth).length >= 1, "y hay al menos uno que se conecta con permiso, no con clave");
ok(SERVICIOS.every((s) => s.acciones.length >= 1), "y todos saben hacer algo");

console.log("\nNadie borra nada");
const PELIGROSAS = /borrar|eliminar|delete|destruir|vaciar|cancelar_|reembolsar|devolver_/;
for (const s of SERVICIOS) {
  const malas = s.acciones.filter((a) => PELIGROSAS.test(a.nombre));
  if (malas.length) fallos.push(`${s.id} tiene acciones de borrar: ${malas.map((a) => a.nombre).join(", ")}`);
}
ok(!fallos.some((f) => f.includes("acciones de borrar")), "ninguna de las conexiones tiene una acción que elimine nada");

console.log("\nEscribir es una segunda decisión");
let todasProtegidas = true;
for (const s of SERVICIOS) {
  for (const a of s.acciones.filter((x) => x.escribe)) {
    const conLectura = puedeHacer(s, a.nombre, "leer");
    const conEscritura = puedeHacer(s, a.nombre, "escribir");
    if (conLectura.ok || !conEscritura.ok) {
      todasProtegidas = false;
      fallos.push(`${s.id}.${a.nombre} no está protegida por el permiso`);
    }
  }
}
ok(todasProtegidas, "TODA acción que escribe se cae si la conexión está en solo lectura");
ok(puedeHacer(SERVICIOS[0], "inventada", "escribir").ok === false, "y una acción que no existe se rechaza diciendo cuáles hay");

const mercados = SERVICIOS.find((s) => s.id === "mercados");
ok(!admiteEscritura(mercados), "a los mercados ni siquiera se les puede dar permiso de escritura");
ok(!mercados.acciones.some((a) => /compr|vend|orden_|retir/.test(a.nombre)), "y ninguna acción suya se parece a mover dinero");

console.log("\nLas claves no salen de dentro");
let secretosMarcados = true;
for (const s of SERVICIOS) {
  for (const c of s.campos) {
    // Lo que es una clave se escribe como una contraseña y no vuelve nunca al
    // navegador. Lo que no lo es (el dominio de la tienda) sí, porque hace
    // falta para enseñar a cuál está conectado.
    const pareceClave = /token|clave|secreto|password|api/i.test(c.id + c.etiqueta);
    if (pareceClave && !c.secreto) {
      secretosMarcados = false;
      fallos.push(`${s.id}.${c.id} parece una clave y no está marcada como secreta`);
    }
  }
}
ok(secretosMarcados, "todo campo que es una clave está marcado como secreto");

const estado = estadoDe(SERVICIOS[0], { cuenta: "la tienda de pruebas", permiso: "leer", conectadoEl: 1 });
// Lo que sale hacia el navegador se comprueba por lo que LLEVA, no buscando
// palabras: el formulario dice "Token de acceso" y eso está bien; lo que no
// puede haber es un sitio donde quepa el valor de esa clave.
const PERMITIDO = new Set([
  "id", "nombre", "color", "marca", "familia", "resumen", "pasos", "enlace",
  "campos", "conectado", "cuenta", "permiso", "conectadoEl", "acciones",
  // De los de OAuth sale QUÉ proveedor es y si el servidor lo tiene
  // configurado. Ni el identificador de cliente ni el secreto, que son del
  // servidor, ni por supuesto ningún testigo.
  "oauth", "oauthListo",
]);
const colados = Object.keys(estado).filter((k) => !PERMITIDO.has(k));
ok(!colados.length, `lo que se le manda al navegador solo lleva lo que tiene que llevar${colados.length ? `: se ha colado ${colados.join(", ")}` : ""}`);
ok(estado.campos.every((c) => !("valor" in c) && !("value" in c)),
   "y los campos del formulario viajan vacíos: son la pregunta, nunca la respuesta guardada");
ok(estado.acciones.every((a) => typeof a.escribe === "boolean"), "y se ve, antes de conectar, qué acciones escriben");

console.log("\nCada uno con su cara");
const sinLogo = SERVICIOS.filter((s) => !LOGOS[s.id]);
ok(!sinLogo.length, `los ${SERVICIOS.length} tienen su logo dibujado dentro${sinLogo.length ? `: faltan ${sinLogo.map((s) => s.id).join(", ")}` : ""}`);
ok(SERVICIOS.every((s) => /^#[0-9A-Fa-f]{6}$/.test(s.color)), "y su color de marca bien escrito");
ok(SERVICIOS.every((s) => LOGOS[s.id].trazo.length > 20 && !/</.test(LOGOS[s.id].trazo)),
   "los logos son trazos, no etiquetas: nada que se descargue de la web de la marca");

console.log("\nDe qué va cada acción, para el modelo");
ok(SERVICIOS.every((s) => s.acciones.every((a) => a.descripcion.length > 20)),
   "todas las acciones se explican de verdad: esa descripción es lo único que el modelo lee para decidir si la usa");
ok(SERVICIOS.every((s) => s.acciones.every((a) => /^[a-z_]+$/.test(a.nombre))),
   "y se llaman en minúsculas y con guion bajo, que es lo que el modelo escribe");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
