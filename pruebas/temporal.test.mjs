// El chat temporal: la promesa es que NO se guarda, así que se comprueba
// mirando el disco, no la pantalla.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

// Un localStorage de mentira para ver qué se escribe de verdad.
const disco = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (disco.has(k) ? disco.get(k) : null),
    setItem: (k, v) => disco.set(k, v),
    removeItem: (k) => disco.delete(k),
  },
};

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { saveConversations, loadConversations } = await jiti.import(enSrc("lib/storage.ts"));

const conv = (id, temporal) => ({
  id, title: temporal ? "Chat temporal" : `Charla ${id}`,
  createdAt: 1, updatedAt: 2, temporal: temporal || undefined,
  messages: [
    { id: `${id}u`, role: "user", content: `secreto de ${id}`, createdAt: 1 },
    { id: `${id}a`, role: "assistant", content: "ya", createdAt: 2 },
  ],
});

console.log("\nLo que se escribe en el disco");
saveConversations([conv("a", false), conv("b", true), conv("c", false)]);
const crudo = disco.get("eclipse.conversations.v1") ?? "";
ok(crudo.includes("secreto de a"), "la conversación normal se guarda");
ok(!crudo.includes("secreto de b"), "la TEMPORAL no aparece por ningún lado");
ok(!crudo.includes("Chat temporal"), "ni su título");
ok(crudo.includes("secreto de c"), "y las de después se siguen guardando");

console.log("\nAl volver a abrir la aplicación");
const leidas = loadConversations();
ok(leidas.length === 2, `solo vuelven las que se guardaron (${leidas.length})`);
ok(!leidas.some((c) => c.temporal), "ninguna temporal ha sobrevivido");

console.log("\nUna conversación solo temporal no borra lo que había");
disco.clear();
saveConversations([conv("x", false)]);
saveConversations([conv("y", true), conv("x", false)]);
const tras = loadConversations();
ok(tras.some((c) => c.id === "x"), "lo normal sigue ahí");
ok(!tras.some((c) => c.id === "y"), "y lo temporal no se ha colado");

console.log("\nEstá filtrado en el sitio por el que pasan todas");
const fuente = (await import("node:fs")).readFileSync(enSrc("lib/storage.ts"), "utf8");
ok(/saveConversations\(list[\s\S]{0,900}c\.temporal/.test(fuente), "el filtro vive dentro de saveConversations");

// Y la respuesta a medias tampoco puede escribirse.
const chat = (await import("node:fs")).readFileSync(enSrc("components/ChatApp.tsx"), "utf8");
ok(/temporalRef\.current\) return;[\s\S]{0,200}saveEnCurso/.test(chat), "la respuesta a medias tampoco se guarda si es temporal");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
