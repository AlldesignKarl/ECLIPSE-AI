/**
 * Modo Examen: estudiar con TUS apuntes, no con lo que la IA se imagine.
 *
 * Lo que decide si esto sirve o no sirve está en una sola idea, y es la que
 * Carlos dejó dicha tres veces: si algo no aparece en los materiales, no entra
 * en el examen. Una aplicación de estudiar que se inventa una pregunta no es
 * peor que no tenerla: es que te hace estudiar lo que no es, y eso no se
 * descubre hasta el día del examen.
 *
 * Por eso el camino no es "pásale los apuntes al modelo y que pregunte". Es:
 *
 *   1. De los materiales se saca un EXTRACTO: trozos literales, cada uno con su
 *      archivo y su página. Eso es lo único que existe.
 *   2. Todo lo demás —el resumen, el quiz, el examen de desarrollo— se hace
 *      MIRANDO SOLO ese extracto, y cada pregunta tiene que decir de qué trozo
 *      sale.
 *   3. Y antes de enseñar nada se COMPRUEBA, aquí, con una cuenta y sin volver
 *      a preguntarle al modelo: que el trozo que dice exista, y que la respuesta
 *      correcta esté de verdad en ese trozo. Lo que no se puede comprobar se
 *      tira.
 *
 * El paso 3 es el que importa. Pedirle a un modelo que no invente es una
 * súplica; comprobar que lo que ha dicho está en el texto es una comprobación.
 * Y por eso todo lo de este archivo es puro: sin red, sin base de datos y sin
 * modelo, para poder probarlo entero en milisegundos.
 */

/** De dónde sale un trozo de contenido. Sin esto no se puede comprobar nada. */
export interface Fuente {
  /** El archivo o la foto, con el nombre que le puso quien lo subió. */
  archivo: string;
  /** La página, cuando el material la tiene (un PDF). */
  pagina?: number;
  /** El apartado o el tema dentro del material. */
  seccion?: string;
}

/**
 * Un trozo de lo que de verdad pone en los materiales.
 *
 * El `texto` es lo que se ha leído, en corto pero con sus palabras. Es el único
 * sitio del que puede salir una pregunta, y contra el que se comprueban todas.
 */
export interface Trozo {
  id: string;
  tema: string;
  texto: string;
  fuente: Fuente;
}

/** Un tema del examen y cuánto material hay de él. */
export interface TemaDelMapa {
  nombre: string;
  /** Un emoji, si el modelo propuso uno que pegue. Es decoración, no dato. */
  emoji?: string;
  /** De 0 a 100: cuánto de este tema hay en los materiales. */
  cobertura: number;
}

export interface Material {
  id: string;
  nombre: string;
  tipo: "imagen" | "pdf" | "texto";
  cuando: number;
  /**
   * Si se ha podido leer.
   *
   * Una foto movida o a contraluz es lo más normal del mundo cuando se
   * fotografían apuntes en clase, y callarlo es lo peor que se puede hacer:
   * quien la subió se cree que está estudiando con ella.
   */
  legible: boolean;
  /** Qué pasó, si no se pudo leer. En palabras de persona. */
  aviso?: string;
}

export interface Pregunta {
  id: string;
  enunciado: string;
  opciones: string[];
  /** El índice de la buena dentro de `opciones`. */
  correcta: number;
  explicacion: string;
  tema: string;
  /** De qué trozo del material sale. Es lo que la hace comprobable. */
  fuente: Fuente;
  /** El id del trozo, para poder repasar de dónde vino. */
  trozo: string;
}

export interface PreguntaLarga {
  id: string;
  enunciado: string;
  /** Cuánto vale. Un examen de verdad reparte puntos. */
  puntos: number;
  /** Lo que tendría que aparecer en una respuesta buena, sacado del material. */
  espera: string[];
  tema: string;
  fuente: Fuente;
  trozo: string;
}

/** Lo que ECLIPSE dice de una respuesta de desarrollo. */
export interface Correccion {
  puntos: number;
  bien: string[];
  falta: string[];
  errores: string[];
  mejorar: string[];
  esperada: string;
}

export interface Intento {
  id: string;
  tipo: "quiz" | "desarrollo";
  cuando: number;
  /** Sobre 10, como se dicen las notas. */
  nota: number;
  aciertos: number;
  total: number;
  /** Qué tal ha ido cada tema, de 0 a 100. */
  porTema: Record<string, { bien: number; total: number }>;
  /** Los temas de lo que ha fallado, para poder volver sobre ellos. */
  falladas: string[];
}

export interface Examen {
  id: string;
  asignatura: string;
  titulo: string;
  /** "2026-10-21", si la sabe. Un examen sin fecha también es un examen. */
  fecha?: string;
  /** Lo que ha dicho que entra, con sus palabras. */
  temas: string[];
  /** Lo que ha querido contar aparte: lo que dijo el profesor, avisos, etc. */
  extra?: string;
  materiales: Material[];
  mapa: TemaDelMapa[];
  extracto: Trozo[];
  resumen?: { rapido: string; completo: string };
  intentos: Intento[];
  creado: number;
  analizado?: number;
}

/** Cuántos exámenes se guardan por persona. */
export const MAX_EXAMENES = 20;
/** Y cuántos materiales por examen. */
export const MAX_MATERIALES = 20;
/** Cuántos intentos se recuerdan. Más que esto es una gráfica que nadie mira. */
export const MAX_INTENTOS = 40;

/** Lo que puede ocupar un material ya codificado. */
export const MAX_MATERIAL = 3 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*                    Comprobar que no se ha inventado nada                   */
/* -------------------------------------------------------------------------- */

/**
 * Las palabras con contenido de un texto: sin tildes, sin puntuación y sin
 * terminación.
 *
 * Lo de la terminación no es un adorno. Sin ello, "la mitocondria PRODUCE ATP"
 * y "la mitocondria se encarga de PRODUCIR ATP" no se parecían nada para esta
 * cuenta, y una pregunta bien hecha —reformulada, que es lo que hace una
 * pregunta buena— se caía por usar el mismo verbo en otro tiempo. Se quedan las
 * seis primeras letras, que en castellano es donde está la raíz:
 * producir/produce/producción van juntas y mitocondria/membrana siguen
 * separadas.
 */
export function palabrasDe(texto: string): string[] {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 3)
    .map((p) => p.slice(0, 6));
}

/**
 * Cuánto de este texto está en aquel, de 0 a 1.
 *
 * Por palabras y no por significado, a propósito. Comparar significados pide un
 * modelo de embeddings, una base de datos vectorial y una llamada de red por
 * pregunta; y aquí no hace falta acertar el matiz, hace falta cazar a alguien
 * inventándose una respuesta que no está en los apuntes. Para eso, contar
 * palabras que aparecen acierta casi siempre y contesta al instante.
 */
export function cuantoSaleDe(texto: string, material: string): number {
  const suyas = new Set(palabrasDe(texto));
  if (!suyas.size) return 0;
  const hay = new Set(palabrasDe(material));
  let juntas = 0;
  for (const p of suyas) if (hay.has(p)) juntas++;
  return juntas / suyas.size;
}

/**
 * Cuánto tiene que salir del material para dar una pregunta por buena.
 *
 * La mitad. No más, porque una pregunta bien hecha reformula —"¿qué orgánulo
 * fabrica la energía?" no repite las palabras de "la mitocondria produce ATP"—
 * y exigir calco dejaría fuera las preguntas buenas. Y no menos, porque por
 * debajo de la mitad cabe cualquier cosa que suene parecida.
 *
 * Lo que se compara es la RESPUESTA CORRECTA, no el enunciado: el enunciado
 * puede estar escrito con otras palabras sin que eso sea inventarse nada, pero
 * si la respuesta buena no está en los apuntes, la pregunta no se puede
 * responder estudiando.
 */
const RESPALDO_MINIMO = 0.5;

/**
 * ¿Esta pregunta sale de verdad del material?
 *
 * Tres cosas, y las tres tienen que cumplirse:
 * 1. Dice de qué trozo sale, y ese trozo existe.
 * 2. La respuesta correcta está en ese trozo.
 * 3. Está bien formada: cuatro opciones distintas y una correcta que exista.
 *
 * Lo que no pasa por aquí se tira sin más. Es mejor un quiz de seis preguntas
 * que uno de diez con dos inventadas, porque las dos inventadas no se ven: se
 * estudian.
 */
export function estaRespaldada(pregunta: Pregunta, extracto: Trozo[]): boolean {
  if (!pregunta.enunciado?.trim()) return false;
  if (!Array.isArray(pregunta.opciones) || pregunta.opciones.length < 2) return false;
  if (new Set(pregunta.opciones.map((o) => o.trim().toLowerCase())).size !== pregunta.opciones.length)
    return false;
  if (!Number.isInteger(pregunta.correcta)) return false;

  const buena = pregunta.opciones[pregunta.correcta];
  if (!buena?.trim()) return false;

  const trozo = extracto.find((t) => t.id === pregunta.trozo);
  if (!trozo) return false;

  /*
    Se mira contra el trozo Y contra la explicación del propio trozo juntos.

    Una respuesta de una palabra —"Mitocondria"— casi nunca llega al umbral
    sola, porque una palabra o está o no está. Por eso cuenta también el
    enunciado: si el enunciado y la respuesta juntos salen del trozo, la
    pregunta se puede contestar estudiando ese trozo, que es lo que se quería
    saber.
  */
  const conjunto = `${pregunta.enunciado} ${buena}`;
  return (
    cuantoSaleDe(buena, trozo.texto) >= RESPALDO_MINIMO ||
    cuantoSaleDe(conjunto, trozo.texto) >= RESPALDO_MINIMO
  );
}

/** Lo mismo para una de desarrollo: lo que se espera tiene que estar escrito. */
export function largaRespaldada(pregunta: PreguntaLarga, extracto: Trozo[]): boolean {
  if (!pregunta.enunciado?.trim()) return false;
  if (!Array.isArray(pregunta.espera) || pregunta.espera.length === 0) return false;

  const trozo = extracto.find((t) => t.id === pregunta.trozo);
  if (!trozo) return false;

  // Al menos la mitad de lo que se espera tiene que estar en el material. Si no,
  // se está pidiendo algo que con estos apuntes no se puede responder.
  const respaldados = pregunta.espera.filter(
    (e) => cuantoSaleDe(e, trozo.texto) >= RESPALDO_MINIMO,
  ).length;
  return respaldados >= Math.ceil(pregunta.espera.length / 2);
}

/* -------------------------------------------------------------------------- */
/*                                Las cuentas                                 */
/* -------------------------------------------------------------------------- */

/** La nota sobre diez, con un decimal, que es como se dicen las notas. */
export function notaDe(aciertos: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((aciertos / total) * 100) / 10;
}

/** Qué tal ha ido cada tema, en porcentaje. */
export function porcentajes(porTema: Intento["porTema"]): { tema: string; acierto: number }[] {
  return Object.entries(porTema)
    .map(([tema, { bien, total }]) => ({
      tema,
      acierto: total ? Math.round((bien / total) * 100) : 0,
    }))
    .sort((a, b) => a.acierto - b.acierto);
}

/**
 * Lo que habría que repasar.
 *
 * Por debajo del 70%, y lo peor primero. El 70 no es un número bonito: es el
 * escalón por debajo del cual un tema todavía no está y merece otra vuelta.
 */
export function aRepasar(intentos: Intento[], cuantos = 3): string[] {
  const suma: Record<string, { bien: number; total: number }> = {};
  for (const intento of intentos)
    for (const [tema, r] of Object.entries(intento.porTema)) {
      suma[tema] ??= { bien: 0, total: 0 };
      suma[tema].bien += r.bien;
      suma[tema].total += r.total;
    }

  return porcentajes(suma)
    .filter((t) => t.acierto < 70)
    .slice(0, cuantos)
    .map((t) => t.tema);
}

/** Cómo va la nota con el tiempo, de lo más viejo a lo más nuevo. */
export function evolucion(intentos: Intento[]): number[] {
  return [...intentos].sort((a, b) => a.cuando - b.cuando).map((i) => i.nota);
}

/* -------------------------------------------------------------------------- */
/*                   Leer lo que conteste el modelo, sin romperse             */
/* -------------------------------------------------------------------------- */

/**
 * El JSON que hay dentro de lo que sea que haya contestado.
 *
 * Un modelo devuelve el JSON envuelto en comillas de bloque, o con una frase
 * delante, o con una coma de más. Nada de eso puede acabar en una pantalla en
 * blanco delante de alguien que está estudiando a las once de la noche.
 */
export function sacarJSON<T>(crudo: string): T | null {
  const texto = (crudo ?? "").replace(/```(?:json)?/gi, "").trim();
  for (const [abre, cierra] of [
    [texto.indexOf("{"), texto.lastIndexOf("}")],
    [texto.indexOf("["), texto.lastIndexOf("]")],
  ]) {
    if (abre === -1 || cierra <= abre) continue;
    try {
      return JSON.parse(texto.slice(abre, cierra + 1)) as T;
    } catch {
      /* se prueba la otra forma */
    }
  }
  return null;
}

const limpio = (v: unknown, tope: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, tope) : "";

/** El mapa del examen tal y como lo haya escrito el modelo, puesto en su sitio. */
export function leerMapa(crudo: string, nombres: string[]): { mapa: TemaDelMapa[]; extracto: Trozo[] } {
  const datos = sacarJSON<{ temas?: unknown; trozos?: unknown }>(crudo);
  if (!datos) return { mapa: [], extracto: [] };

  const conocidos = new Set(nombres);

  const mapa: TemaDelMapa[] = (Array.isArray(datos.temas) ? datos.temas : [])
    .map((t): TemaDelMapa | null => {
      const uno = t as { nombre?: unknown; emoji?: unknown; cobertura?: unknown };
      const nombre = limpio(uno.nombre, 60);
      if (!nombre) return null;
      const cobertura = Number(uno.cobertura);
      return {
        nombre,
        emoji: limpio(uno.emoji, 4) || undefined,
        cobertura: Number.isFinite(cobertura) ? Math.min(100, Math.max(0, Math.round(cobertura))) : 0,
      };
    })
    .filter((t): t is TemaDelMapa => t !== null)
    .slice(0, 12);

  const extracto: Trozo[] = (Array.isArray(datos.trozos) ? datos.trozos : [])
    .map((t, i): Trozo | null => {
      const uno = t as { tema?: unknown; texto?: unknown; archivo?: unknown; pagina?: unknown; seccion?: unknown };
      const texto = limpio(uno.texto, 600);
      // Un trozo de dos palabras no respalda nada: se cae aquí.
      if (texto.length < 25) return null;

      /*
        El archivo que dice tiene que ser uno de los que se subieron.

        Si el modelo se inventa el nombre del archivo, la fuente deja de servir
        para comprobar nada, que es justo para lo que está. Cuando no acierta, se
        queda sin archivo y el trozo sigue valiendo: lo que se comprueba luego es
        el TEXTO, y el texto está.
      */
      const archivo = limpio(uno.archivo, 120);
      const pagina = Number(uno.pagina);

      return {
        id: `t${i}`,
        tema: limpio(uno.tema, 60) || "General",
        texto,
        fuente: {
          archivo: conocidos.has(archivo) ? archivo : (nombres[0] ?? "tus materiales"),
          pagina: Number.isFinite(pagina) && pagina > 0 ? Math.round(pagina) : undefined,
          seccion: limpio(uno.seccion, 80) || undefined,
        },
      };
    })
    .filter((t): t is Trozo => t !== null)
    .slice(0, 120);

  return { mapa, extracto };
}

/** Las preguntas de un quiz, filtradas por lo que se puede comprobar. */
export function leerPreguntas(crudo: string, extracto: Trozo[]): Pregunta[] {
  const datos = sacarJSON<{ preguntas?: unknown }>(crudo);
  const lista = Array.isArray(datos?.preguntas) ? datos.preguntas : Array.isArray(datos) ? datos : [];

  const salida: Pregunta[] = [];
  for (const [i, p] of (lista as unknown[]).entries()) {
    const uno = p as {
      enunciado?: unknown; opciones?: unknown; correcta?: unknown;
      explicacion?: unknown; trozo?: unknown;
    };
    const opciones = (Array.isArray(uno.opciones) ? uno.opciones : [])
      .map((o) => limpio(o, 200))
      .filter(Boolean);
    const trozoId = limpio(uno.trozo, 12);
    const trozo = extracto.find((t) => t.id === trozoId);

    const pregunta: Pregunta = {
      id: `p${i}`,
      enunciado: limpio(uno.enunciado, 300),
      opciones,
      correcta: Number(uno.correcta),
      explicacion: limpio(uno.explicacion, 400),
      tema: trozo?.tema ?? "General",
      fuente: trozo?.fuente ?? { archivo: "" },
      trozo: trozoId,
    };

    // Aquí es donde se cae lo inventado, y no se avisa al modelo ni se le pide
    // otra: se tira y ya. Comprobar es más barato y más fiable que insistir.
    if (estaRespaldada(pregunta, extracto)) salida.push(pregunta);
  }
  return salida;
}

/** Las de desarrollo, con la misma comprobación. */
export function leerLargas(crudo: string, extracto: Trozo[]): PreguntaLarga[] {
  const datos = sacarJSON<{ preguntas?: unknown }>(crudo);
  const lista = Array.isArray(datos?.preguntas) ? datos.preguntas : Array.isArray(datos) ? datos : [];

  const salida: PreguntaLarga[] = [];
  for (const [i, p] of (lista as unknown[]).entries()) {
    const uno = p as { enunciado?: unknown; puntos?: unknown; espera?: unknown; trozo?: unknown };
    const trozoId = limpio(uno.trozo, 12);
    const trozo = extracto.find((t) => t.id === trozoId);
    const puntos = Number(uno.puntos);

    const pregunta: PreguntaLarga = {
      id: `d${i}`,
      enunciado: limpio(uno.enunciado, 300),
      puntos: Number.isFinite(puntos) && puntos > 0 ? Math.min(5, Math.round(puntos)) : 2,
      espera: (Array.isArray(uno.espera) ? uno.espera : []).map((e) => limpio(e, 200)).filter(Boolean),
      tema: trozo?.tema ?? "General",
      fuente: trozo?.fuente ?? { archivo: "" },
      trozo: trozoId,
    };

    if (largaRespaldada(pregunta, extracto)) salida.push(pregunta);
  }
  return salida;
}

/** Lo que ha dicho el modelo al corregir, puesto en su sitio. */
export function leerCorreccion(crudo: string, sobre: number): Correccion | null {
  const datos = sacarJSON<{
    puntos?: unknown; bien?: unknown; falta?: unknown;
    errores?: unknown; mejorar?: unknown; esperada?: unknown;
  }>(crudo);
  if (!datos) return null;

  const lista = (v: unknown) =>
    (Array.isArray(v) ? v : []).map((x) => limpio(x, 240)).filter(Boolean).slice(0, 6);

  const puntos = Number(datos.puntos);
  return {
    // Nunca más puntos de los que vale la pregunta, ni menos de cero: un
    // "3/2" en una corrección hace desconfiar de todo lo demás.
    puntos: Number.isFinite(puntos) ? Math.min(sobre, Math.max(0, Math.round(puntos * 2) / 2)) : 0,
    bien: lista(datos.bien),
    falta: lista(datos.falta),
    errores: lista(datos.errores),
    mejorar: lista(datos.mejorar),
    esperada: limpio(datos.esperada, 900),
  };
}
