/**
 * El perfil de comunicación: cómo le gusta a cada uno que le hablen.
 *
 * Carlos lo pidió así: que ECLIPSE no conteste siempre igual, que vaya
 * aprendiendo cómo prefiere comunicarse cada persona y se adapte poco a poco.
 * Y con dos condiciones suyas que son las que hacen que esto no dé grima: que
 * no se invente preferencias, y que el cambio sea GRADUAL, no que después de un
 * mensaje se convierta en otro.
 *
 * Esto es lo anterior —`lib/estilo.ts`— llevado a donde tenía que estar. Aquello
 * miraba los últimos ocho mensajes de la conversación abierta y se olvidaba al
 * cerrarla: abrías una nueva y volvía a empezar de cero. Aquí el perfil vive con
 * la cuenta y va creciendo conversación a conversación.
 *
 * Cómo funciona, en tres ideas:
 *
 * 1. Cada mensaje suyo deja SEÑALES, no frases. De "hazlo corto, que me lío"
 *    sale "pide ir al grano"; nunca sus palabras, que es lo que produce el
 *    efecto loro.
 * 2. Cada señal mueve un eje un poco: una media que se desplaza (`ALFA`), no un
 *    interruptor. Un mensaje raro no cambia nada; diez mensajes iguales sí. Eso
 *    es lo gradual, y está en la cuenta, no en una promesa del prompt.
 * 3. Un eje solo se USA cuando se ha visto lo bastante (`SUFICIENTE`) y además
 *    está claramente de un lado. Mientras no, no se dice nada: inventarse un
 *    perfil con dos mensajes es peor que no tener ninguno.
 *
 * Lo que sale de aquí es UNA línea para el modelo. Viaja en cada petición, así
 * que si costara un párrafo no compensaría por muy bonito que fuera.
 */

/** Los ejes que se aprenden. Cada uno va de 0 a 1. */
export type Eje =
  /** 0 = le gustan cortas · 1 = le gustan largas y con detalle */
  | "largo"
  /** 0 = informal y coloquial · 1 = formal, de usted */
  | "formal"
  /** 0 = no usa emojis · 1 = usa emojis */
  | "emojis"
  /** 0 = lenguaje llano · 1 = sabe del tema, se le puede hablar técnico */
  | "tecnico"
  /** 0 = le gusta que le expliques · 1 = quiere la respuesta y ya */
  | "directo"
  /** 0 = no los pide · 1 = pide ejemplos a menudo */
  | "ejemplos";

export const EJES: Eje[] = ["largo", "formal", "emojis", "tecnico", "directo", "ejemplos"];

export interface Medida {
  /** Dónde está ahora mismo, de 0 a 1. Empieza en la mitad: sin opinión. */
  valor: number;
  /** Cuántos mensajes han dicho algo de este eje. Es la confianza. */
  visto: number;
}

export interface Perfil {
  ejes: Partial<Record<Eje, Medida>>;
  /** En qué idioma escribe, contado. Solo se apunta cuando está claro. */
  idiomas: Record<string, number>;
  /** Cuántos mensajes suyos se han mirado en total. */
  mensajes: number;
  actualizado: number;
}

export function perfilVacio(): Perfil {
  return { ejes: {}, idiomas: {}, mensajes: 0, actualizado: 0 };
}

/**
 * Cuánto mueve un mensaje.
 *
 * Un quinto del camino. Con 1 (cada mensaje manda) esto sería un interruptor y
 * un "explícamelo bien" suelto borraría meses de "hazlo corto". Con 0,05 no se
 * adaptaría nunca. Un quinto tarda unos cuatro o cinco mensajes seguidos en
 * cruzar el umbral, que es lo que se pidió: gradual y que se note.
 */
const ALFA = 0.2;

/** Con menos señales que esto, un eje no se usa. No hay patrón, hay casualidad. */
const SUFICIENTE = 3;

/**
 * Cuándo se considera que un eje está de un lado.
 *
 * Lejos del centro a propósito. Un eje en 0,55 no es "le gustan largas": es que
 * no se sabe. Y actuar sobre algo que no se sabe es exactamente inventárselo.
 */
const CLARO_ARRIBA = 0.68;
const CLARO_ABAJO = 0.32;

const EMOJI = /\p{Extended_Pictographic}/u;

const INFORMAL =
  /\b(bro|tío|tia|tía|colega|chaval|máquina|crack|jaja+|jeje+|porfa|vale|guay|joder|buah|xd|q|pq|xq|tqm)\b/i;
const FORMAL =
  /\b(usted|ustedes|le agradecería|cordialmente|estimad[oa]|quedo a la espera|atentamente|sería tan amable)\b/i;

const TECNICO =
  /\b(api|endpoint|json|deploy|build|commit|css|html|sql|token|servidor|repositorio|función|variable|dominio|dns|framework|webhook|tsx?|componente|backend|frontend|query|middleware|regex|docker|typescript|python)\b/i;

/** Pedir ir al grano, con las palabras con las que se pide de verdad. */
const AL_GRANO =
  /\b(al grano|hazlo corto|más corto|mas corto|en corto|resúmelo|resumelo|resumido|resumen|breve|brevemente|no te enrolles|sin rollo|sin tanta|menos texto|una línea|una linea|directo|escueto|sin explicar|concreto)\b/i;

/** Y lo contrario, que también es una señal y de las buenas. */
const CON_DETALLE =
  /\b(explícamelo|explicamelo|explícame|explicame|con detalle|en detalle|detalladamente|más largo|mas largo|amplía|amplia|extiéndete|extiendete|paso a paso|en profundidad|desarróllalo|desarrollalo|no lo entiendo|no entiendo)\b/i;

const EJEMPLOS =
  /\b(ejemplos?|por ejemplo|un caso|casos? práctico|muéstrame|muestrame|enséñame|ensename|cómo sería|como seria|ponme uno)\b/i;

/**
 * Palabras que solo salen en un idioma, para saber en cuál escribe.
 *
 * Es a propósito una lista corta de palabras muy frecuentes y muy exclusivas.
 * Detectar idioma bien pide una biblioteca entera; lo que hace falta aquí es
 * distinguir "escribe siempre en catalán" de "un día escribió una palabra en
 * inglés", y para eso basta con esto. Lo que no esté claro no se apunta, que es
 * mejor que apuntarlo mal.
 */
const IDIOMAS: { id: string; señal: RegExp }[] = [
  { id: "es", señal: /\b(qué|que|para|cómo|como|porque|puedes|quiero|esto|hacer|tengo|está|muy)\b/i },
  { id: "en", señal: /\b(the|what|you|and|with|about|please|could|this|have|from)\b/i },
  { id: "ca", señal: /\b(això|amb|però|perquè|vull|fes|aquest|meu|nosaltres|tinc)\b/i },
  { id: "gl", señal: /\b(isto|onde|máis|grazas|quero|facer|teño|moito)\b/i },
  { id: "eu", señal: /\b(zer|nola|mesedez|egin|nahi|dut|zure|hau)\b/i },
  { id: "fr", señal: /\b(le|les|pour|avec|pourquoi|je veux|c'est|merci|faire)\b/i },
  { id: "it", señal: /\b(perché|perche|come|grazie|voglio|fare|questo|sono)\b/i },
  { id: "pt", señal: /\b(você|voce|obrigado|quero|fazer|isso|muito|porque)\b/i },
  { id: "de", señal: /\b(ich|und|nicht|bitte|danke|machen|dieses|kann)\b/i },
];

/** Lo que un mensaje dice de cada eje. Lo que no dice nada, no aparece. */
export type Observacion = Partial<Record<Eje, number>> & { idioma?: string };

/**
 * Leer un mensaje y sacar sus señales.
 *
 * La regla de oro está aquí: un eje solo aparece cuando el mensaje dice algo de
 * él. Un "ok" no es prueba de que no le gusten los ejemplos, así que en un "ok"
 * el eje de ejemplos no existe. Sin esto, cada mensaje corto arrastraría todos
 * los ejes hacia cero y el perfil acabaría diciendo cosas que nadie ha hecho.
 */
export function observar(mensaje: string): Observacion {
  const texto = (mensaje ?? "").trim();
  if (!texto) return {};

  const o: Observacion = {};
  const palabras = texto.split(/\s+/).length;

  /*
    Lo largo que escribe. Lo de en medio no dice nada: ni corto ni largo.

    Y solo si ha escrito algo. Un "vale", un "ok" o un "gracias" son cortos
    porque son un acuse de recibo, no porque esa persona quiera las respuestas
    cortas; contándolos, cuatro monosílabos seguidos bastaban para decidirlo, y
    eso es exactamente inventárselo.
  */
  if (palabras >= 4) {
    if (texto.length < 60) o.largo = 0;
    else if (texto.length > 320) o.largo = 1;
  }

  // Pedir expresamente ir al grano o lo contrario pesa TAMBIÉN en "largo": es
  // la señal más honesta que hay, porque no se deduce, se ha dicho.
  if (AL_GRANO.test(texto)) {
    o.directo = 1;
    o.largo = 0;
  } else if (CON_DETALLE.test(texto)) {
    o.directo = 0;
    o.largo = 1;
  }

  const formal = FORMAL.test(texto);
  const informal = INFORMAL.test(texto);
  if (formal && !informal) o.formal = 1;
  else if (informal && !formal) o.formal = 0;

  /*
    Los emojis se miran en cualquier mensaje con algo escrito.

    Aquí no hace falta que el mensaje "hable del tema": un mensaje sin emojis
    ES la prueba de que no los usa. Pero en los de una palabra no cuenta, que
    nadie pone un emoji en un "vale".
  */
  if (palabras >= 3) o.emojis = EMOJI.test(texto) ? 1 : 0;

  // El nivel técnico, solo en mensajes con suficiente texto: en cuatro palabras
  // no se ve si alguien sabe o no sabe.
  if (palabras >= 6) o.tecnico = TECNICO.test(texto) ? 1 : 0;

  if (EJEMPLOS.test(texto)) o.ejemplos = 1;

  if (palabras >= 4) {
    const votos = IDIOMAS.map((i) => ({
      id: i.id,
      puntos: (texto.match(new RegExp(i.señal.source, "gi")) ?? []).length,
    })).sort((a, b) => b.puntos - a.puntos);
    // Solo si gana con claridad: si dos idiomas empatan, no se sabe.
    if (votos[0].puntos >= 2 && votos[0].puntos > (votos[1]?.puntos ?? 0)) o.idioma = votos[0].id;
  }

  return o;
}

/**
 * Meter lo observado en el perfil, moviendo cada eje un poco.
 *
 * La media desplazada es lo que hace que esto sea gradual de verdad y no una
 * promesa: cada mensaje empuja un quinto del camino, así que hace falta
 * insistir para mover un eje y hace falta insistir para volverlo a mover. Y
 * `visto` sube solo cuando ha habido señal, que es lo que luego decide si el
 * eje se usa o se calla.
 */
export function acumular(perfil: Perfil, obs: Observacion): Perfil {
  const ejes = { ...perfil.ejes };

  for (const eje of EJES) {
    const visto = obs[eje];
    if (visto === undefined) continue;
    const antes = ejes[eje] ?? { valor: 0.5, visto: 0 };
    ejes[eje] = {
      valor: Number((antes.valor + (visto - antes.valor) * ALFA).toFixed(4)),
      visto: antes.visto + 1,
    };
  }

  const idiomas = { ...perfil.idiomas };
  if (obs.idioma) idiomas[obs.idioma] = (idiomas[obs.idioma] ?? 0) + 1;

  return {
    ejes,
    idiomas,
    mensajes: perfil.mensajes + 1,
    actualizado: Date.now(),
  };
}

/** ¿Este eje se sabe ya, y está claramente de un lado? */
function lado(m: Medida | undefined): "arriba" | "abajo" | null {
  if (!m || m.visto < SUFICIENTE) return null;
  if (m.valor >= CLARO_ARRIBA) return "arriba";
  if (m.valor <= CLARO_ABAJO) return "abajo";
  return null;
}

/** El idioma en el que escribe casi siempre, si es que hay uno. */
export function idiomaHabitual(perfil: Perfil): string | null {
  const total = Object.values(perfil.idiomas).reduce((s, n) => s + n, 0);
  if (total < 4) return null;
  const [mejor] = Object.entries(perfil.idiomas).sort((a, b) => b[1] - a[1]);
  // Tres de cada cuatro: alguien que escribe en dos idiomas no tiene "el suyo".
  return mejor && mejor[1] / total >= 0.75 ? mejor[0] : null;
}

const COMO_SE_LLAMA: Record<string, string> = {
  es: "castellano",
  en: "inglés",
  ca: "catalán",
  gl: "gallego",
  eu: "euskera",
  fr: "francés",
  it: "italiano",
  pt: "portugués",
  de: "alemán",
};

/**
 * El perfil, dicho en una línea para el modelo.
 *
 * Instrucciones, no descripción: "contéstale corto" sirve, "escribe corto" hay
 * que interpretarlo. Y solo lo que se sabe: si de alguien solo se sabe que no
 * usa emojis, va eso y nada más.
 */
export function comoLinea(perfil: Perfil | null): string {
  if (!perfil) return "";

  const reglas: string[] = [];

  const largo = lado(perfil.ejes.largo);
  if (largo === "abajo") reglas.push("contéstale corto, sin desarrollar de más");
  else if (largo === "arriba") reglas.push("agradece el detalle: desarrolla, no te quedes en el titular");

  const directo = lado(perfil.ejes.directo);
  if (directo === "arriba") reglas.push("la respuesta primero y el porqué después");

  const formal = lado(perfil.ejes.formal);
  if (formal === "arriba") reglas.push("trátale de usted");
  else if (formal === "abajo") reglas.push("es coloquial: de tú y sin envaramiento");

  const emojis = lado(perfil.ejes.emojis);
  if (emojis === "arriba") reglas.push("usa emojis, así que alguno tuyo encaja");
  else if (emojis === "abajo") reglas.push("no usa emojis; tú tampoco");

  const tecnico = lado(perfil.ejes.tecnico);
  if (tecnico === "arriba") reglas.push("sabe de tecnología: no le expliques lo básico");
  else if (tecnico === "abajo") reglas.push("no es técnico: sin jerga");

  const ejemplos = lado(perfil.ejes.ejemplos);
  if (ejemplos === "arriba") reglas.push("suele pedir ejemplos: dáselos sin que los pida");

  const idioma = idiomaHabitual(perfil);
  if (idioma && idioma !== "es") reglas.push(`te escribe en ${COMO_SE_LLAMA[idioma] ?? idioma}: contéstale en ese idioma`);

  if (!reglas.length) return "";

  return `Cómo le gusta que le hablen, aprendido de sus mensajes: ${reglas.join("; ")}.
Es su registro, no su voz: NO copies sus palabras ni sus erratas ni le imites.
Si en este mensaje pide otra cosa, manda lo que pide ahora.`;
}

/**
 * El perfil dicho para una persona, que pueda verlo en Ajustes.
 *
 * No es un adorno: la regla de esta casa es que lo que ECLIPSE aprende de ti se
 * puede mirar y se puede borrar. Un perfil que decide el tono de todas las
 * respuestas y que no se puede ver sería justo lo contrario.
 */
export function comoLista(perfil: Perfil | null): string[] {
  if (!perfil) return [];
  const dicho: string[] = [];

  const di = (m: Medida | undefined, arriba: string, abajo: string) => {
    const l = lado(m);
    if (l === "arriba") dicho.push(arriba);
    else if (l === "abajo") dicho.push(abajo);
  };

  di(perfil.ejes.largo, "Prefiere respuestas largas y con detalle", "Prefiere respuestas cortas");
  di(perfil.ejes.directo, "Prefiere que vayas al grano", "Prefiere que le expliques las cosas");
  di(perfil.ejes.formal, "Prefiere un trato formal, de usted", "Prefiere un trato cercano, de tú");
  di(perfil.ejes.emojis, "Usa emojis", "No usa emojis");
  di(perfil.ejes.tecnico, "Sabe de tecnología", "Prefiere explicaciones sin jerga");
  di(perfil.ejes.ejemplos, "Suele pedir ejemplos", "");

  const idioma = idiomaHabitual(perfil);
  if (idioma) dicho.push(`Escribe en ${COMO_SE_LLAMA[idioma] ?? idioma}`);

  return dicho.filter(Boolean);
}
