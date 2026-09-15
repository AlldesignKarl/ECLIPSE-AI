// Coser una respuesta cortada con su continuación.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const { pegarContinuacion, extractFiles } = await jiti.import(enSrc("lib/project.ts"));

const cortado = `Aquí tienes la escena.

\`\`\`html index.html
<!doctype html>
<script type="module">
  const escena = new THREE.Scene();
  const cubo = new THREE.Me`;

const casos = [
  ["sigue tal cual", "sh(geo, mat);\n</script>\n```"],
  ["reabre el bloque", "```html\nsh(geo, mat);\n</script>\n```"],
  ["saluda y reabre", "Continúo desde donde lo dejé:\n```html\nsh(geo, mat);\n</script>\n```"],
  ["repite el final", "  const cubo = new THREE.Mesh(geo, mat);\n</script>\n```"],
  ["salto de línea delante", "\n\n  sh(geo, mat);\n</script>\n```"],
];

const fallos = [];
for (const [nombre, continuacion] of casos) {
  const entero = pegarContinuacion(cortado, continuacion);
  const [archivo] = extractFiles(entero);
  const contenido = archivo?.content ?? "";
  const lineaMala = contenido.split("\n").find((l) => /THREE\.Me$|Mesh\(geo, mat\);.*Mesh\(geo, mat\)/.test(l));
  const bien =
    contenido.includes("new THREE.Mesh(geo, mat);") &&
    !contenido.includes("```") &&
    !/Contin[úu]o/i.test(contenido) &&
    !lineaMala;
  console.log(`  ${bien ? "✓" : "✗"} ${nombre.padEnd(24)} → ${JSON.stringify(contenido.split("\n").slice(-3).join(" ⏎ ").slice(0, 70))}`);
  if (!bien) fallos.push(nombre);
}

console.log("\n" + (fallos.length ? "FALLOS en: " + fallos.join(", ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
