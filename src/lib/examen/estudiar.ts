import { unaRespuesta } from "../una-respuesta";
import type { Attachment } from "../types";
import {
  leerCorreccion,
  leerLargas,
  leerMapa,
  leerPreguntas,
  type Correccion,
  type Examen,
  type Pregunta,
  type PreguntaLarga,
  type Trozo,
} from "./tipos";

/**
 * Lo que le pedimos al modelo en el Modo Examen.
 *
 * Un solo archivo para todos los encargos porque todos comparten la misma regla
 * y conviene que se lea junta: **lo que no está en los materiales no existe**.
 * Si esa regla está escrita en cinco sitios, dentro de tres meses estará escrita
 * distinta en cinco sitios.
 *
 * Los prompts son largos y rígidos a propósito. En el chat eso sería un
 * problema —se paga en cada mensaje— pero aquí se ejecuta un puñado de veces por
 * examen y lo que está en juego es que alguien estudie lo que no es. Aquí el
 * token es barato y la alucinación es cara, que es justo al revés que en el chat.
 *
 * Y el reparto de trabajo es el que pidió Carlos: LEER los materiales —fotos
 * torcidas de una libreta, PDF— se le da a quien mejor mira; lo demás —resumir,
 * preguntar, corregir— sale por `unaRespuesta`, que empieza por el motor de
 * siempre y va bajando si falla.
 */

const NO_TE_INVENTES = `REGLA QUE MANDA SOBRE TODAS LAS DEMÁS:

Solo existe lo que está en los materiales que te paso. Nada más. No añadas lo
que "suele entrar" en esta asignatura, ni lo que sepas del tema, ni lo que
parezca que falta. Si algo no aparece, no está: y si no está, no entra.

Quien lee esto se está jugando un examen. Una pregunta inventada no se nota:
se estudia. Es infinitamente mejor entregar menos y que todo sea verdad.`;

/* -------------------------------------------------------------------------- */
/*                         1. Leer lo que hay escrito                         */
/* -------------------------------------------------------------------------- */

const COMO_LEER = `Eres ECLIPSE leyendo los apuntes de un estudiante para
ayudarle a preparar un examen. Tu trabajo AHORA es solo leer y ordenar: no
resumir con tus palabras, no explicar, no opinar.

${NO_TE_INVENTES}

Devuelve SOLO un JSON, sin nada delante ni detrás, con esta forma:

{"temas":[{"nombre":"Mitosis","emoji":"🔬","cobertura":70}],
 "trozos":[{"tema":"Mitosis","texto":"…","archivo":"apuntes1.jpg","pagina":2,"seccion":"Fases"}]}

Los TEMAS son los que de verdad aparecen en los materiales, con el nombre que
tengan allí. "cobertura" es de 0 a 100: cuánto material hay de ese tema. Un tema
del que solo hay una frase suelta tiene poca cobertura, y decirlo así vale más
que fingir que está completo.

Los TROZOS son lo importante. Cada uno es una unidad de contenido —una
definición, una fórmula, una fecha, un proceso, un ejemplo, un dato— escrita con
LAS PALABRAS DEL MATERIAL, no con las tuyas. De 25 a 500 caracteres. Saca todos
los que haya: son lo único de lo que después se podrán hacer preguntas, así que
lo que no saques aquí es materia que se pierde.

En "archivo" pon el nombre EXACTO del archivo del que sale, de la lista que te
doy. En "pagina", el número si lo sabes; si no, quítalo.

Si una foto está borrosa, cortada o no se lee, NO adivines lo que pondría: no
saques trozos de ella y dilo en un tema llamado "NO LEGIBLE" con cobertura 0.`;

export interface Lectura {
  mapa: Examen["mapa"];
  extracto: Trozo[];
  /** Lo que no se ha podido leer, dicho para quien lo subió. */
  ilegibles: string[];
  error?: string;
}

/**
 * Leer los materiales y sacar de ellos el mapa y el extracto.
 *
 * Esto es el cimiento: todo lo demás mira este extracto y nada más. Si esto se
 * hace mal, no hay forma de que lo de después salga bien.
 */
export async function leerMateriales(opts: {
  examen: Pick<Examen, "asignatura" | "titulo" | "temas" | "extra">;
  adjuntos: Attachment[];
  nombres: string[];
  signal?: AbortSignal;
}): Promise<Lectura> {
  const dice = [
    `Asignatura: ${opts.examen.asignatura}`,
    `Examen: ${opts.examen.titulo}`,
    opts.examen.temas.length ? `Lo que ha dicho que entra: ${opts.examen.temas.join(", ")}` : "",
    opts.examen.extra ? `Lo que ha contado aparte: ${opts.examen.extra}` : "",
    `Archivos que te paso: ${opts.nombres.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const r = await unaRespuesta({
    sistema: COMO_LEER,
    mensaje: `${dice}\n\nLee los materiales y devuelve el JSON.`,
    adjuntos: opts.adjuntos,
    // Generoso: aquí se saca TODO el contenido del examen, y lo que no quepa
    // aquí es materia que ya no se podrá preguntar nunca.
    tope: 8000,
    signal: opts.signal,
  });

  if (!r.ok) return { mapa: [], extracto: [], ilegibles: [], error: r.error };

  const { mapa, extracto } = leerMapa(r.texto, opts.nombres);

  /*
    Qué archivos no han dado ni un trozo.

    Es la forma honesta de detectar la foto movida: si de un archivo no ha
    salido nada, o no se leía o no tenía nada dentro. En los dos casos hay que
    decirlo, porque quien la subió se cree que está estudiando con ella.
  */
  const conContenido = new Set(extracto.map((t) => t.fuente.archivo));
  const ilegibles = opts.nombres.filter((n) => !conContenido.has(n));

  return { mapa, extracto, ilegibles };
}

/* -------------------------------------------------------------------------- */
/*                              2. El resumen                                 */
/* -------------------------------------------------------------------------- */

const COMO_RESUMIR = `Eres ECLIPSE preparando a alguien para un examen. Te paso
el contenido REAL de sus materiales, ya leído y troceado.

${NO_TE_INVENTES}

Escribe el resumen en Markdown, con estos apartados y SOLO los que tengan algo
de verdad que poner (si no hay fórmulas, no pongas el apartado de fórmulas):

## 📚 De qué va
## ⭐ Lo importante
## 🔑 Definiciones
## 📌 Fórmulas
## 📅 Fechas y datos
## 🧠 Explicado fácil
## ⚠️ Con lo que se suele meter la pata
## 📝 Lo que ha dicho que cae

Reglas de cómo escribirlo:
- Al grano. Esto se lee la noche antes, no es un libro.
- Frases cortas. Nada de párrafos de ocho líneas.
- Las definiciones y las fórmulas, tal y como están en el material.
- "Con lo que se suele meter la pata" solo si en el material hay dos cosas que
  se parecen y se confunden (mitosis y meiosis, por ejemplo). Si no, fuera.
- Nada de introducciones ni de despedidas. Se empieza por el contenido.`;

export async function hacerResumen(opts: {
  examen: Examen;
  largo: "rapido" | "completo";
  signal?: AbortSignal;
}): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const material = comoSeLoPaso(opts.examen.extracto);
  if (!material) return { ok: false, error: "Todavía no hay materiales leídos." };

  const medida =
    opts.largo === "rapido"
      ? "RESUMEN RÁPIDO: lo que hay que saber sí o sí, en menos de 300 palabras. Solo lo esencial."
      : "RESUMEN COMPLETO: todo lo que entra, ordenado por temas. Completo, pero sin rellenar.";

  const r = await unaRespuesta({
    sistema: COMO_RESUMIR,
    mensaje: `${medida}\n\nAsignatura: ${opts.examen.asignatura}\nExamen: ${opts.examen.titulo}\n\nCONTENIDO DE SUS MATERIALES:\n${material}`,
    tope: opts.largo === "rapido" ? 1200 : 3500,
    signal: opts.signal,
  });

  return r.ok ? { ok: true, texto: r.texto } : { ok: false, error: r.error };
}

/* -------------------------------------------------------------------------- */
/*                                3. El quiz                                  */
/* -------------------------------------------------------------------------- */

const COMO_PREGUNTAR = `Eres ECLIPSE haciéndole un test a alguien sobre SU
examen. Te paso el contenido real de sus materiales, troceado y numerado.

${NO_TE_INVENTES}

Cada pregunta tiene que salir de UN trozo concreto, y tienes que decir de cuál.

Devuelve SOLO un JSON con esta forma:

{"preguntas":[{"enunciado":"…","opciones":["…","…","…","…"],"correcta":0,
"explicacion":"…","trozo":"t3"}]}

- "trozo" es el identificador del trozo del que sale, tal cual te lo doy (t0, t1…).
- "correcta" es la POSICIÓN de la buena dentro de "opciones", empezando en 0.
- Cuatro opciones. Las tres malas tienen que ser creíbles y del mismo tema: una
  opción absurda no se pregunta, se descarta sola y no enseña nada.
- La respuesta correcta tiene que estar DENTRO del trozo que citas. Si para
  responder hace falta saber algo que no está en ese trozo, esa pregunta no vale:
  no la pongas.
- "explicacion": por qué es esa, en una o dos frases, con lo que dice el material.
- Puedes reformular para preguntar. Lo que no puedes es añadir contenido nuevo.

Si con los trozos que te doy no salen tantas preguntas como te piden, devuelve
MENOS. Devolver menos es correcto; rellenar, no.`;

const CUANTAS: Record<string, number> = { rapido: 5, repaso: 10, dificil: 8, fallos: 8 };

export async function hacerQuiz(opts: {
  examen: Examen;
  tipo: "rapido" | "repaso" | "dificil" | "fallos";
  /** Los temas en los que ha fallado, para el modo «mis fallos». */
  temas?: string[];
  signal?: AbortSignal;
}): Promise<{ ok: true; preguntas: Pregunta[] } | { ok: false; error: string }> {
  /*
    En «mis fallos» se le pasa SOLO el material de lo que falló.

    Es lo que hace que ese botón signifique algo. Pasarle todo y pedirle que se
    centre en unos temas es confiar en que haga caso; pasarle solo esos trozos
    es que no pueda preguntar otra cosa.
  */
  const trozos =
    opts.tipo === "fallos" && opts.temas?.length
      ? opts.examen.extracto.filter((t) => opts.temas!.includes(t.tema))
      : opts.examen.extracto;

  const material = comoSeLoPaso(trozos);
  if (!material)
    return {
      ok: false,
      error:
        opts.tipo === "fallos"
          ? "De eso que fallaste no hay bastante material para preguntarte más."
          : "Todavía no hay materiales leídos.",
    };

  const como = {
    rapido: "Preguntas directas de lo más importante.",
    repaso: "Un repaso que toque todos los temas que haya, repartido.",
    dificil: "Las difíciles: matices, cosas que se confunden entre sí, detalles que se pasan por alto.",
    fallos: "Solo de lo que falló la última vez, con otro enfoque para que no sea de memoria.",
  }[opts.tipo];

  const r = await unaRespuesta({
    sistema: COMO_PREGUNTAR,
    mensaje: `Haz ${CUANTAS[opts.tipo]} preguntas. ${como}\n\nAsignatura: ${opts.examen.asignatura}\n\nSUS MATERIALES:\n${material}`,
    tope: 3500,
    signal: opts.signal,
  });
  if (!r.ok) return { ok: false, error: r.error };

  // Y aquí se cae lo que no se puede comprobar, sin volver a preguntarle a nadie.
  const preguntas = leerPreguntas(r.texto, opts.examen.extracto);
  if (!preguntas.length)
    return {
      ok: false,
      error:
        "No he podido sacar ni una pregunta que pueda respaldar con tus apuntes. Añade más material y lo intento otra vez.",
    };

  return { ok: true, preguntas };
}

/* -------------------------------------------------------------------------- */
/*                         4. El examen de desarrollo                         */
/* -------------------------------------------------------------------------- */

const COMO_DESARROLLO = `Eres ECLIPSE poniéndole un examen de desarrollo a
alguien sobre SU materia. Te paso sus materiales troceados y numerados.

${NO_TE_INVENTES}

Devuelve SOLO un JSON:

{"preguntas":[{"enunciado":"Explica …","puntos":2,
"espera":["…","…","…"],"trozo":"t3"}]}

- "espera" es la lista de cosas que tienen que aparecer en una respuesta buena.
  Cada una sale del trozo que citas, con el contenido del material. Es lo que
  después se usa para corregir, así que tiene que ser concreto: no "explica bien
  el proceso", sino "que la mitocondria produce ATP".
- "puntos": lo que vale, de 1 a 3, según lo que haya que escribir.
- Preguntas de desarrollar, no de una palabra. "Explica", "compara", "describe".`;

export async function hacerDesarrollo(opts: {
  examen: Examen;
  cuantas?: number;
  temas?: string[];
  signal?: AbortSignal;
}): Promise<{ ok: true; preguntas: PreguntaLarga[] } | { ok: false; error: string }> {
  const trozos = opts.temas?.length
    ? opts.examen.extracto.filter((t) => opts.temas!.includes(t.tema))
    : opts.examen.extracto;

  const material = comoSeLoPaso(trozos);
  if (!material) return { ok: false, error: "Todavía no hay materiales leídos." };

  const r = await unaRespuesta({
    sistema: COMO_DESARROLLO,
    mensaje: `Pon ${opts.cuantas ?? 3} preguntas de desarrollo.\n\nAsignatura: ${opts.examen.asignatura}\n\nSUS MATERIALES:\n${material}`,
    tope: 2500,
    signal: opts.signal,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const preguntas = leerLargas(r.texto, opts.examen.extracto);
  if (!preguntas.length)
    return {
      ok: false,
      error: "Con este material no me salen preguntas de desarrollo que pueda respaldar. Añade más apuntes.",
    };

  return { ok: true, preguntas };
}

/* -------------------------------------------------------------------------- */
/*                              5. Corregir                                   */
/* -------------------------------------------------------------------------- */

const COMO_CORREGIR = `Eres ECLIPSE corrigiendo la respuesta de un estudiante.

${NO_TE_INVENTES}

Corriges comparando su respuesta con LO QUE PONE EN SU MATERIAL, que te paso.
No con lo que tú sepas del tema. Si escribe algo que es verdad en general pero
no está en su material, no cuenta como acierto ni como error: no entra.

Devuelve SOLO un JSON:

{"puntos":1.5,"bien":["…"],"falta":["…"],"errores":["…"],"mejorar":["…"],
"esperada":"…"}

- "puntos": lo que le das sobre lo que vale la pregunta. Con medios puntos vale.
- "bien": lo que SÍ ha puesto, de lo que se esperaba. Concreto.
- "falta": lo que se esperaba y no ha puesto.
- "errores": lo que ha dicho MAL, o sea que contradice el material. Si no hay
  ninguno, lista vacía. No busques errores para rellenar.
- "mejorar": uno o dos consejos de cómo escribirlo mejor la próxima vez.
- "esperada": cómo sería una respuesta completa, sacada del material. Corta.

Sé justo. Ni regalar la nota ni buscarle las cosquillas: quien estudia con esto
necesita saber de verdad por dónde va.`;

export async function corregir(opts: {
  pregunta: PreguntaLarga;
  respuesta: string;
  extracto: Trozo[];
  signal?: AbortSignal;
}): Promise<{ ok: true; correccion: Correccion } | { ok: false; error: string }> {
  const trozo = opts.extracto.find((t) => t.id === opts.pregunta.trozo);
  const material = trozo ? trozo.texto : opts.pregunta.espera.join(". ");

  const r = await unaRespuesta({
    sistema: COMO_CORREGIR,
    mensaje: [
      `PREGUNTA (vale ${opts.pregunta.puntos} puntos): ${opts.pregunta.enunciado}`,
      ``,
      `LO QUE PONE EN SU MATERIAL:`,
      material,
      ``,
      `LO QUE SE ESPERABA QUE DIJERA:`,
      opts.pregunta.espera.map((e) => `- ${e}`).join("\n"),
      ``,
      `LO QUE HA ESCRITO:`,
      opts.respuesta.slice(0, 4000),
    ].join("\n"),
    tope: 1400,
    signal: opts.signal,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const correccion = leerCorreccion(r.texto, opts.pregunta.puntos);
  if (!correccion) return { ok: false, error: "No he podido corregirlo bien. Prueba otra vez." };

  return { ok: true, correccion };
}

/* -------------------------------------------------------------------------- */

/**
 * El extracto, escrito para el modelo.
 *
 * Con el identificador delante de cada trozo, que es lo que después permite
 * comprobar de dónde salió cada pregunta. Sin numerar, el modelo no tiene cómo
 * citar y la comprobación se queda sin nada contra lo que comparar.
 */
function comoSeLoPaso(trozos: Trozo[]): string {
  return trozos
    .map((t) => `[${t.id}] (${t.tema}) ${t.texto}`)
    .join("\n")
    .slice(0, 24000);
}
