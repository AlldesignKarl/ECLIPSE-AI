// Que la foto se pueda retocar aunque se mandara unos mensajes antes.
import { readFileSync } from "node:fs";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { leerRetoque } = await jiti.import(enSrc("lib/project.ts"));

// 1) La orden de retoque se lee bien y no queda en la respuesta.
const respuesta = `Le subiría el contraste y calentaría un poco la luz.

[EDITAR: same photo, higher contrast, warmer golden light, richer sky]`;
const { limpio, encargo } = leerRetoque(respuesta);
console.log("visible:", JSON.stringify(limpio));
console.log("encargo:", JSON.stringify(encargo));

// 2) La condición del servidor: ¿ve la foto de hace dos mensajes?
const fuente = readFileSync(enSrc("app/api/chat/route.ts"), "utf8");
const cuerpo = fuente.slice(fuente.indexOf("function ultimaConImagen"), fuente.indexOf("/** Lo que ECLIPSE tiene"));
const ultimaConImagen = new Function("return " + cuerpo.replace(/: Turn\[\]/, "").replace(/: boolean/, ""))();

const FOTO = { kind: "image", name: "a.jpg", mime: "image/jpeg", data: "x" };
const casos = [
  ["la foto en el último mensaje", [{ role: "user", content: "mira", attachments: [FOTO] }], true],
  ["foto, respuesta, y ahora la pregunta", [
    { role: "user", content: "mira", attachments: [FOTO] },
    { role: "assistant", content: "veo unas torres" },
    { role: "user", content: "¿le cambiarías algo?" },
  ], true],
  ["foto de hace mucho", [
    { role: "user", content: "mira", attachments: [FOTO] },
    ...Array.from({ length: 8 }, (_, i) => [
      { role: "assistant", content: "ya" },
      { role: "user", content: `otra cosa ${i}` },
    ]).flat(),
  ], false],
  ["sin foto ninguna", [{ role: "user", content: "hola" }], false],
];

const fallos = [];
if (limpio !== "Le subiría el contraste y calentaría un poco la luz.")
  fallos.push("la línea de la orden debería desaparecer de la respuesta");
if (!encargo?.includes("higher contrast")) fallos.push("no ha leído el encargo");

console.log();
for (const [nombre, msgs, esperado] of casos) {
  const r = ultimaConImagen(msgs);
  console.log(`   ${nombre.padEnd(38)} → ${r ? "puede retocar" : "no ofrece retoque"}`);
  if (r !== esperado) fallos.push(`${nombre}: esperaba ${esperado}`);
}

console.log("\n" + (fallos.length ? "FALLOS:\n- " + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
