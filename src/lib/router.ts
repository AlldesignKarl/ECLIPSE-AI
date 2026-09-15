import type { Mode } from "./types";

/**
 * El router de ECLIPSE: qué motor conviene para ESTE mensaje.
 *
 * Carlos lo pidió así: que Mistral siga siendo el cerebro general y que Gemini
 * entre solo cuando aporte una ventaja clara —programar, depurar, razonar de
 * verdad, o tragarse un texto muy largo—, sin que quien escribe se entere nunca
 * de quién ha contestado.
 *
 * Y con una condición suya que manda sobre todo lo demás: NADA de preguntarle a
 * una IA qué IA usar. Eso es una llamada más, medio segundo más y tokens que se
 * pagan en cada mensaje para no responder nada. Así que aquí solo hay reglas
 * locales: expresiones regulares y cuentas, sin red y sin modelo.
 *
 * Cómo está pensado, que es lo que importa cuando haya que tocarlo:
 *
 * - Solo SUBE, nunca baja. Si no hay señal clara, no se toca nada y contesta el
 *   motor de siempre. Un router que en la duda cambia de motor es un router que
 *   cambia de motor casi siempre.
 * - Las señales fuertes son las que no se pueden fingir: un bloque de código,
 *   una traza de error, un mensaje larguísimo. Las de palabras van después y
 *   piden más de una coincidencia.
 * - Hay frenos explícitos. "¿y el código?" lleva la palabra código y no es una
 *   petición de programación; "¿cuál es la capital de Francia?" no necesita a
 *   nadie especial. Sin frenos, el especialista acaba contestándolo todo, que es
 *   justo lo contrario de lo que se pedía.
 */

/** Por qué se ha elegido al especialista. Sirve para explicarlo y para probarlo. */
export type Motivo = "codigo" | "razonar" | "contexto";

export interface Decision {
  /** ¿Conviene el motor especialista para este mensaje? */
  especialista: boolean;
  motivo: Motivo | null;
}

const NORMAL: Decision = { especialista: false, motivo: null };

/* ------------------------------- Programar ------------------------------- */

/** Un bloque de código pegado. No hay señal más clara que esta. */
const BLOQUE = /```/;

/**
 * Una traza de error de verdad, de las que se pegan tal cual.
 *
 * Esto vale por sí solo: nadie escribe "Traceback (most recent call last)" en
 * una conversación casual.
 */
const TRAZA =
  /(TypeError|ReferenceError|SyntaxError|RangeError|NullPointerException|IndexError|KeyError|ValueError|Traceback \(most recent call last\)|Unhandled (?:Runtime )?Error|Segmentation fault|panic:|npm ERR!|ERR_[A-Z_]+|Cannot read propert|is not a function|is not defined|undefined is not|Module not found|Unexpected token|at .+:\d+:\d+|\bline \d+, in )/;

/** Lenguajes, marcos y herramientas. Nombrarlos es hablar de código. */
const TECNOLOGIA =
  /\b(javascript|typescript|python|java|kotlin|swift|c\+\+|c#|golang|rust|php|ruby|sql|bash|shell|html|css|react|vue|angular|svelte|next\.?js|node\.?js|express|django|flask|laravel|spring|tailwind|docker|kubernetes|postgres|postgresql|mysql|mongodb|redis|regex|json|yaml|git)\b/i;

/** Lo que se le pide a algo que programa. */
const VERBO_CODIGO =
  /\b(program[ae]|implementa|refactoriza|depura|debug|compila|despliega|desplegar|optimiza el c[oó]digo|arregla|corrige|repara|migra|testea|refactorizar|implementar|depurar)\b/i;

/** Las cosas que se programan. */
const COSA_CODIGO =
  /\b(funci[oó]n|funciones|clase|clases|m[eé]todo|componente|script|programa|consulta sql|query|endpoint|api|webhook|test|tests|hook|algoritmo|bucle|array|objeto|variable|librer[ií]a|paquete|dependencia|compilador|stack trace|excepci[oó]n|c[oó]digo|codigo)\b/i;

/** "No funciona", dicho de las mil maneras en las que se dice. */
const FALLA =
  /\b(me da (?:este |un )?error|da error|este error|no compila|no funciona|deja de funcionar|falla|petando|se rompe|se cae|por qu[eé] falla|qu[eé] est[aá] mal|no me sale|no tira|crashe?a)\b/i;

/* -------------------------------- Razonar -------------------------------- */

const VERBO_RAZONAR =
  /\b(anal[ií]za|anal[ií]zame|analizar|demuestra|demu[eé]strame|razona|raz[oó]name|resuelve|res[uú]elveme|deduce|deduc[eí]r|compara a fondo|eval[uú]a|dise[ñn]a (?:la )?arquitectura|planifica la arquitectura|optimiza|calcula)\b/i;

const PIDE_RAZONAMIENTO =
  /\b(explica (?:el|tu) razonamiento|paso a paso|justif[ií]ca(?:lo|melo)?|por qu[eé] funciona as[ií]|demu[eé]stralo|con el desarrollo|razonadamente|argum[eé]ntalo)\b/i;

const COMPLEJO =
  /\b(complejidad|big ?o|notaci[oó]n o|algoritmo|demostraci[oó]n|teorema|ecuaci[oó]n|integral|derivada|matriz|probabilidad|combinatoria|optimizaci[oó]n|rendimiento|cuello de botella|concurrencia|deadlock|race condition|arquitectura)\b/i;

/* --------------------------------- Frenos -------------------------------- */

/**
 * Preguntas de dato suelto: quién, cuándo, dónde, cuánto.
 *
 * No necesitan a nadie especial por mucho que hablen de un lenguaje de
 * programación: "¿en qué año salió Python?" es una pregunta de cultura general.
 */
const DATO_SUELTO =
  /^\s*(?:¿|\?)?\s*(cu[aá]l es|cu[aá]les son|qui[eé]n (?:es|fue|era)|cu[aá]ndo (?:es|fue|sali[oó]|naci[oó])|d[oó]nde (?:est[aá]|queda)|cu[aá]nto (?:es|cuesta|mide|vale)|qu[eé] (?:es|significa|quiere decir)|c[oó]mo se (?:dice|escribe|llama)|en qu[eé] a[ñn]o)\b/i;

/** Saludos y charla. Aquí no hay nada que decidir. */
const CHARLA =
  /^\s*(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|qu[eé] tal|c[oó]mo (?:est[aá]s|va)|gracias|vale|ok|gena?ial|perfecto|adi[oó]s|hasta luego|jaja+)\b/i;

/**
 * Por debajo de esto, un mensaje no pide un especialista.
 *
 * "arréglalo", "y el código?", "falla" son continuaciones de algo que ya se
 * está hablando, no encargos. Sin este freno, media conversación sobre un
 * programa se iba al especialista mensaje a mensaje.
 */
const CORTO = 28;

/* ------------------------------- Contexto -------------------------------- */

/**
 * Cuándo un texto es lo bastante largo como para que compense cambiar.
 *
 * La ventaja de Gemini aquí no es que escriba mejor: es que le cabe más. Con
 * cuatro mil caracteres pegados de golpe —un contrato, un registro de errores,
 * un artículo— ya se nota, y por debajo de eso cambiar de motor no gana nada.
 */
const TEXTO_LARGO = 4000;
/** Y una conversación con mucho recorrido, aunque cada mensaje sea corto. */
const CONVERSACION_LARGA = 20000;

/**
 * Qué motor pide este mensaje.
 *
 * Devuelve si conviene el especialista y por qué. Quien llama decide luego si
 * puede dárselo —hace falta clave— y si le dejan; aquí solo se opina.
 */
export function decidirMotor(opts: {
  /** Lo último que ha escrito la persona. */
  ultimo: string;
  /** La conversación entera, para saber si ya hay mucho encima de la mesa. */
  historial?: { role: string; content: string }[];
  modo?: Mode;
}): Decision {
  const texto = (opts.ultimo ?? "").trim();

  /*
    ECLIPSE CODE se queda como está, y es a propósito.

    Ahí la respuesta es un archivo entero, y el motor lo elige el usuario en
    Ajustes justo para eso: es lo que decide si un archivo largo sale completo o
    cortado. Mandarlo a otro sitio por nuestra cuenta sería volver a romper lo
    que costó arreglar. El router es del chat.
  */
  if (opts.modo === "code") return NORMAL;

  // Un texto enorme pegado: eso ya es señal, diga lo que diga.
  if (texto.length >= TEXTO_LARGO) return { especialista: true, motivo: "contexto" };

  const historial = opts.historial ?? [];
  const pesoTotal = historial.reduce((s, t) => s + (t?.content?.length ?? 0), 0);
  if (pesoTotal >= CONVERSACION_LARGA) return { especialista: true, motivo: "contexto" };

  // Un bloque de código o una traza valen por sí solos, aunque el mensaje sea
  // corto: ahí no hay ambigüedad ninguna.
  if (BLOQUE.test(texto) || TRAZA.test(texto)) return { especialista: true, motivo: "codigo" };

  if (!texto || texto.length < CORTO) return NORMAL;
  if (CHARLA.test(texto)) return NORMAL;
  if (DATO_SUELTO.test(texto)) return NORMAL;

  /*
    De aquí para abajo son señales de palabras, y piden DOS coincidencias.

    Con una sola, "quiero abrir una tienda online con una web bonita" se iba al
    especialista por la palabra "web". Dos señales distintas ya es alguien
    hablando de programar de verdad.
  */
  const señalesCodigo = [
    VERBO_CODIGO.test(texto),
    COSA_CODIGO.test(texto),
    TECNOLOGIA.test(texto),
    FALLA.test(texto),
  ].filter(Boolean).length;
  if (señalesCodigo >= 2) return { especialista: true, motivo: "codigo" };

  const señalesRazonar = [
    VERBO_RAZONAR.test(texto),
    PIDE_RAZONAMIENTO.test(texto),
    COMPLEJO.test(texto),
  ].filter(Boolean).length;
  if (señalesRazonar >= 2) return { especialista: true, motivo: "razonar" };

  return NORMAL;
}
