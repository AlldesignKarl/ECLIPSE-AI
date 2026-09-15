// Lo que el modelo llega a ver y a poder hacer. Es la capa que importa: si aquí
// se le anuncia algo que no puede, lo intentará; y si la regla de solo lectura
// se le escapa, cambiará cosas en la tienda de alguien sin permiso.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { herramientaConexion } = await jiti.import(enSrc("lib/conexiones/herramienta.ts"));
const { SERVICIOS, servicioDe, puedeHacer, admiteEscritura } = await jiti.import(enSrc("lib/conexiones/registro.ts"));

const fallos = [];
const ok = (cond, que) => {
  console.log(`  ${cond ? "✓" : "✗"} ${que}`);
  if (!cond) fallos.push(que);
};

const conexion = (servicio, permiso, cuenta = "la cuenta") => ({
  servicio, permiso, cuenta, conectadoEl: Date.now(),
});

console.log("\nSin nada conectado");
ok((await herramientaConexion([])) === null, "la herramienta ni existe: no se le anuncia al modelo");

console.log("\nSolo lectura");
const soloLeer = await herramientaConexion([conexion("shopify", "leer", "Mi Tienda · EUR")]);
ok(soloLeer !== null, "con algo conectado, la herramienta aparece");
ok(/listar_productos/.test(soloLeer.descripcion), "anuncia las acciones de lectura");
ok(!/actualizar_producto/.test(soloLeer.descripcion), "y NO anuncia las que escriben");
ok(!/crear_producto/.test(soloLeer.descripcion), "ninguna de ellas");
// La línea del servicio, no las reglas generales (que hablan de solo lectura
// siempre, y con razón).
const lineaDe = (h, id) => h.descripcion.split("\n").find((l) => l.trim().startsWith(`${id} —`)) ?? "";
ok(/SOLO LECTURA/.test(lineaDe(soloLeer, "shopify")), "le dice claramente en qué modo está");
ok(/Mi Tienda/.test(soloLeer.descripcion), "y a qué cuenta está conectado");
ok(soloLeer.parametros.properties.servicio.enum.join() === "shopify", "el enum solo trae lo conectado");
ok(soloLeer.soloPro === true, "la herramienta es del plan Pro");

console.log("\nCon permiso de escritura");
const conEscribir = await herramientaConexion([conexion("shopify", "escribir")]);
ok(/actualizar_producto/.test(conEscribir.descripcion), "ahora sí anuncia las de escritura");
ok(!/SOLO LECTURA/.test(lineaDe(conEscribir, "shopify")), "y la línea del servicio ya no lleva el aviso");
ok(/SOLO LECTURA/.test(conEscribir.descripcion), "aunque la regla general sobre el solo lectura se queda siempre");
ok(/Mira antes de tocar/i.test(conEscribir.descripcion), "y le recuerda mirar antes de tocar");

console.log("\nVarias cuentas a la vez");
const varias = await herramientaConexion([
  conexion("shopify", "escribir", "Mi Tienda"),
  conexion("ionos", "leer", "1 dominio"),
  conexion("mercados", "leer", "SPOT"),
]);
const ids = varias.parametros.properties.servicio.enum;
ok(ids.length === 3 && ids.includes("ionos") && ids.includes("mercados"), `las tres en el enum (${ids.join(", ")})`);
ok(/crear_registro_dns/.test(varias.descripcion) === false, "IONOS en lectura: no se anuncia crear registros DNS");
ok(/ver_cartera/.test(varias.descripcion), "los mercados sí anuncian leer la cartera");

console.log("\nUna conexión de un servicio que ya no existe");
const fantasma = await herramientaConexion([conexion("un-servicio-retirado", "leer")]);
ok(fantasma === null, "se ignora en vez de romper la conversación");

console.log("\nLa regla de los permisos, sola");
const sh = servicioDe("shopify");
ok(puedeHacer(sh, "listar_productos", "leer").ok, "leer con permiso de lectura: sí");
ok(!puedeHacer(sh, "actualizar_producto", "leer").ok, "escribir con permiso de lectura: NO");
ok(/SOLO LECTURA/.test(puedeHacer(sh, "actualizar_producto", "leer").error), "y se explica para que el modelo sepa qué decir");
ok(/No insistas/.test(puedeHacer(sh, "crear_producto", "leer").error), "diciéndole además que no lo intente por otro lado");
ok(puedeHacer(sh, "actualizar_producto", "escribir").ok, "escribir con permiso de escritura: sí");
ok(!puedeHacer(sh, "accion_inventada", "escribir").ok, "una acción inventada se rechaza");
ok(/Las que hay/.test(puedeHacer(sh, "accion_inventada", "escribir").error), "y se le dice cuáles hay de verdad");

console.log("\nLos mercados, otra vez");
const mk = servicioDe("mercados");
ok(!admiteEscritura(mk), "no admiten escritura ni en teoría");
for (const a of mk.acciones) {
  if (a.escribe) fallos.push(`la acción ${a.nombre} de mercados escribe`);
}
ok(mk.acciones.every((a) => puedeHacer(mk, a.nombre, "leer").ok), "todas sus acciones funcionan en solo lectura");

console.log("\nNinguna acción borra nada, en ningún servicio");
const borradoras = SERVICIOS.flatMap((s) =>
  s.acciones.filter((a) => /borrar|eliminar|delete|quitar/i.test(a.nombre)).map((a) => `${s.id}.${a.nombre}`),
);
ok(borradoras.length === 0, `no hay ninguna acción de borrado (${borradoras.join(", ") || "ninguna"})`);

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
