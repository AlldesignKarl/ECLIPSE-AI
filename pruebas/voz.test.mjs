// Elegir voz. El catálogo lo pone el móvil y no se parece de un Android a un
// iPhone, así que lo que importa es acertar el idioma SIEMPRE y el timbre
// cuando se pueda.
import { SRC, crearJiti, enSrc } from "./entorno.mjs";
const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC } });
const V = await jiti.import(enSrc("lib/voz-ajustes.ts"));

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

// Un Android real.
const ANDROID = [
  { name: "English United States", lang: "en-US" },
  { name: "Google español", lang: "es-ES" },
  { name: "Google español de Estados Unidos", lang: "es-US" },
  { name: "Google français", lang: "fr-FR" },
];
// Un iPhone real.
const IPHONE = [
  { name: "Mónica", lang: "es-ES" },
  { name: "Paulina", lang: "es-MX" },
  { name: "Samantha", lang: "en-US" },
  { name: "Siri Voz 2 (Premium)", lang: "es-ES" },
];

console.log("\nEl idioma, siempre");
for (const [nombre, voces] of [["Android", ANDROID], ["iPhone", IPHONE]]) {
  const es = V.elegirVoz(voces, { timbre: "clara", idioma: "es-ES", ritmo: "normal" });
  ok(es?.lang.toLowerCase().startsWith("es"), `${nombre}: pidiendo español, sale española (${es?.name})`);
  const en = V.elegirVoz(voces, { timbre: "clara", idioma: "en-US", ritmo: "normal" });
  ok(en?.lang.toLowerCase().startsWith("en"), `${nombre}: pidiendo inglés, sale inglesa (${en?.name})`);
}

console.log("\nCuando no está el idioma exacto");
const soloMexico = [{ name: "Paulina", lang: "es-MX" }, { name: "Samantha", lang: "en-US" }];
const caida = V.elegirVoz(soloMexico, { timbre: "suave", idioma: "es-ES", ritmo: "normal" });
ok(caida?.lang === "es-MX", `un español de México antes que una voz inglesa (${caida?.name})`);
const sinNada = V.elegirVoz([{ name: "Samantha", lang: "en-US" }], { timbre: "suave", idioma: "eu-ES", ritmo: "normal" });
ok(sinNada === null, "y si no hay nada parecido, se dice que no en vez de leer euskera en inglés");
ok(V.elegirVoz([], V.VOZ_POR_DEFECTO) === null, "sin voces en el aparato, null");

console.log("\nPrefiere las buenas");
const mezcla = [
  { name: "es-ES-standard", lang: "es-ES" },
  { name: "Google español", lang: "es-ES" },
];
ok(/Google/.test(V.elegirVoz(mezcla, { timbre: "clara", idioma: "es-ES", ritmo: "normal" })?.name ?? ""),
  "entre una normal y una de Google, la de Google");

console.log("\nTimbre y ritmo");
ok(V.tonoDe("suave") < V.tonoDe("clara"), "«suave» habla más grave que «clara»");
ok(V.velocidadDe("lento") < V.velocidadDe("normal"), "«pausado» va más lento");
ok(V.velocidadDe("rapido") > V.velocidadDe("normal"), "y «rápido», más rápido");
ok(V.velocidadDe("inventado") === V.velocidadDe("normal"), "un ritmo inventado cae en el normal");

console.log("\nLo que se guarda");
const disco = new Map();
globalThis.window = { localStorage: { getItem: (k) => disco.get(k) ?? null, setItem: (k, v) => disco.set(k, v) } };
ok(JSON.stringify(V.leerAjustes()) === JSON.stringify(V.VOZ_POR_DEFECTO), "sin nada guardado, lo de por defecto");
V.guardarAjustes({ timbre: "clara", idioma: "en-GB", ritmo: "rapido" });
const leido = V.leerAjustes();
ok(leido.timbre === "clara" && leido.idioma === "en-GB" && leido.ritmo === "rapido", "se guarda y se lee");
disco.set("eclipse.voz", '{"timbre":"gritona","idioma":"klingon","ritmo":"turbo"}');
const basura = V.leerAjustes();
ok(basura.idioma === "es-ES" && basura.ritmo === "normal", "y lo inventado se ignora, no rompe nada");
disco.set("eclipse.voz", "no soy json");
ok(V.leerAjustes().idioma === "es-ES", "ni lo que no es JSON");

console.log("\nLos idiomas que se ofrecen");
ok(V.IDIOMAS.length >= 10, `hay ${V.IDIOMAS.length} idiomas`);
ok(V.IDIOMAS.some((i) => i.id === "ca-ES") && V.IDIOMAS.some((i) => i.id === "gl-ES"), "incluidos catalán y gallego");
ok(V.IDIOMAS.every((i) => /^[a-z]{2}-[A-Z]{2}$/.test(i.id)), "todos con código completo, que es lo que pide el navegador");

/* -------------------------------------------------------------------------- */
/*                        De mujer o de hombre, y buena                       */
/* -------------------------------------------------------------------------- */

const { vozDe, loQueHay, calidadDe, VOCES, elegirVoz } = V;

console.log("\nDe quién es cada voz");
ok(vozDe("Mónica") === "mujer", "Mónica, de mujer");
ok(vozDe("Jorge") === "hombre", "Jorge, de hombre");
ok(vozDe("Microsoft Helena Desktop - Spanish (Spain)") === "mujer", "Helena, aunque venga con coletillas");
ok(vozDe("Google español") === null, "de «Google español» no se puede saber, y se admite");
ok(vozDe("es-ES-Standard-A") === "mujer", "las de Google por letra: la A es de mujer");
ok(vozDe("es-ES-Wavenet-B") === "hombre", "y la B de hombre");
ok(vozDe("Spanish (Spain) Female") === "mujer", "y si lo pone en el nombre, mejor");

console.log("\nSe elige de quién quieres oírla");
const aparato = [
  { name: "Mónica", lang: "es-ES", localService: true },
  { name: "Jorge", lang: "es-ES", localService: true },
  { name: "Google español", lang: "es-ES", localService: false },
  { name: "Daniel", lang: "en-GB", localService: true },
];
ok(elegirVoz(aparato, { voz: "hombre", timbre: "clara", idioma: "es-ES", ritmo: "normal" }).name === "Jorge", "pidiendo hombre, sale Jorge");
ok(elegirVoz(aparato, { voz: "mujer", timbre: "clara", idioma: "es-ES", ritmo: "normal" }).name === "Mónica", "pidiendo mujer, sale Mónica");
ok(
  elegirVoz(aparato, { voz: "cualquiera", timbre: "clara", idioma: "es-ES", ritmo: "normal" }).name === "Google español",
  "sin preferencia, la que mejor suena",
);
ok(
  elegirVoz(aparato, { voz: "hombre", timbre: "clara", idioma: "es-ES", ritmo: "normal" }).lang === "es-ES",
  "y nunca se cruza de idioma para contentar el género",
);

const soloMujeres = [{ name: "Mónica", lang: "es-ES" }, { name: "Paulina", lang: "es-MX" }];
ok(
  elegirVoz(soloMujeres, { voz: "hombre", timbre: "clara", idioma: "es-ES", ritmo: "normal" }).name === "Mónica",
  "si no hay voz de hombre, se usa la que hay en vez de quedarse mudo",
);

console.log("\nY se sabe qué tiene el aparato, para poder decirlo");
ok(loQueHay(aparato, "es-ES").mujer && loQueHay(aparato, "es-ES").hombre, "en español hay de las dos");
ok(!loQueHay(soloMujeres, "es-ES").hombre, "en un móvil sin voz de hombre, se sabe");
ok(loQueHay([], "es-ES").mujer === false, "y sin voces, no hay ninguna");

console.log("\nLa calidad se nota en el nombre");
ok(calidadDe({ name: "Microsoft Elvira Online (Natural)" }) > calidadDe({ name: "Elvira" }), "una «Natural» puntúa más que la de siempre");
ok(calidadDe({ name: "Mónica", localService: false }) > calidadDe({ name: "Mónica", localService: true }), "y una de red más que una local");
ok(calidadDe({ name: "Eloquence Spanish compact" }) < 0, "las viejas de verdad puntúan en negativo");
ok(VOCES.length === 3, "y en pantalla hay tres opciones: mujer, hombre y la mejor");

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
