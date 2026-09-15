// Que las imágenes salgan a foto y no a dibujo por defecto — y que cuando
// alguien pide un logo o un dibujo, NO se le cuele una fotografía.
import { createServer } from "node:http";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

// Un motor de texto de mentira que devuelve lo que se le ha pedido, para poder
// leer las instrucciones que se le mandan.
let ultimoEncargo = "";
const motor = createServer((req, res) => {
  let c = "";
  req.on("data", (d) => (c += d));
  req.on("end", () => {
    const b = JSON.parse(c || "{}");
    ultimoEncargo = b.messages?.map((m) => m.content).join("\n") ?? "";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      choices: [{ message: { content: "A weathered fisherman mending nets on a harbour wall, shot on a Canon EOS R5, 85mm f/1.8, overcast daylight, salt-stained hands, natural skin texture." } }],
    }));
  });
});
await new Promise((r) => motor.listen(0, "127.0.0.1", r));
process.env.MOTOR_BASE_GROQ = `http://127.0.0.1:${motor.address().port}`;
process.env.GROQ_API_KEY = "gsk_prueba";

const jiti = await crearJiti(import.meta.url, {
  alias: { "@": SRC },
  moduleCache: false,
});
const { prepararPrompt } = await jiti.import(enSrc("lib/imgprompt.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

try {
  console.log("\nLo que se le pide al que escribe el prompt");
  const salida = await prepararPrompt("un pescador remendando redes");
  ok(salida.length > 20, "devuelve un prompt");
  ok(!/^(sure|here)/i.test(salida), "sin el «Sure, here's…» del principio");

  ok(/DEFAULT TO A REAL PHOTOGRAPH/.test(ultimoEncargo), "por defecto, fotografía de verdad");
  ok(/camera and a lens/.test(ultimoEncargo), "con cámara y óptica concretas");
  ok(/window light|golden hour|overcast/.test(ultimoEncargo), "y luz de verdad, no «cinematográfica»");
  ok(/pores|flyaway|dust|worn edges/.test(ultimoEncargo), "pidiendo lo que hace que una foto parezca tomada");

  // Esto es lo contraintuitivo: esas palabras ESTROPEAN el realismo.
  ok(/Do NOT use "hyperrealistic"/.test(ultimoEncargo), "y prohibiendo «hyperrealistic», «8k» y compañía");
  ok(/octane render|artstation/.test(ultimoEncargo), "que son las que dan el acabado de plástico");

  console.log("\nPero un logo sigue siendo un logo");
  ok(/WHEN NOT TO DO THAT/.test(ultimoEncargo), "hay una excepción escrita");
  ok(/cartoon|illustration|anime/.test(ultimoEncargo), "para dibujos y caricaturas");
  ok(/A logo has to be a logo/.test(ultimoEncargo), "y para logos, con todas las letras");
  ok(/flat,\s*\n?clean/.test(ultimoEncargo) || /flat, clean/.test(ultimoEncargo), "planos y sin profundidad de campo");

  console.log("\nCambiar una imagen ya hecha");
  await prepararPrompt("ponla de noche", "A fisherman at noon, 85mm");
  ok(/PREVIOUS PROMPT/.test(ultimoEncargo), "se le pasa la imagen anterior");
  ok(/A fisherman at noon/.test(ultimoEncargo), "con su descripción entera");
  ok(/keep\s*\n?\s*its subject/.test(ultimoEncargo), "y la orden de conservar el tema");

  console.log("\nSi no hay motor de texto, imagen igual");
  delete process.env.GROQ_API_KEY;
  const jiti2 = await crearJiti(import.meta.url, {
    alias: { "@": SRC },
    moduleCache: false,
  });
  const { prepararPrompt: sinMotor } = await jiti2.import(enSrc("lib/imgprompt.ts"));
  const crudo = await sinMotor("un pescador");
  ok(crudo === "un pescador", "se usa lo que escribió la persona, tal cual");
  const conAnterior = await sinMotor("de noche", "A fisherman at noon");
  ok(/A fisherman at noon/.test(conAnterior), "y al cambiar, sin perder lo anterior");
} finally {
  motor.close();
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
