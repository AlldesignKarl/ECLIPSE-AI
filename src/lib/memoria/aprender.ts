import { resolveKey } from "../keys";
import { oneShotCompat, type CompatProvider } from "../openai-compat";
import { activeProvider } from "../provider";
import { anotarVisto, aprenderHechos, apuntarResumen } from "./almacen";
import { LARGO_HECHO } from "./tipos";

/**
 * Sacar de una conversación lo que merece recordarse.
 *
 * Lo hace el propio modelo, porque es lo único que sabe distinguir "mi tienda
 * es de ropa de montaña" —que vale para siempre— de "ponme eso en negrita" —que
 * no vale para nada dentro de diez minutos—.
 *
 * Y con una regla que es la que hace que esto no dé miedo: se aprende lo que
 * uno cuenta de sí mismo para que le ayuden mejor, no todo lo que dice. Una
 * cosa es acordarse de que tienes una tienda en Shopify y otra muy distinta
 * apuntar lo que le pasa a tu familia. Lo segundo está prohibido explícitamente
 * ahí abajo.
 */

const ENCARGO = `Lee esta conversación entre una persona y un asistente, y saca
dos cosas. Contesta SOLO con este formato, sin explicar nada:

HECHOS:
- (una frase por línea, máximo 4 líneas; si no hay ninguno, escribe "ninguno")

TEMA:
(dos líneas como mucho: de qué iba la conversación y en qué quedó)

Un HECHO tiene que cumplir las CUATRO cosas: es de esta persona, sigue siendo
verdad dentro de un mes, sirve para ayudarla mejor otro día, y cabe en una
frase corta en tercera persona.

Lo que sí merece guardarse:
- A qué se dedica, qué proyectos lleva, qué herramientas usa, qué nivel tiene.
- Una preferencia que ha dicho: cómo quiere las respuestas, en qué idioma, cómo
  quiere que le traten.
- Un proyecto al que va a volver, y en qué punto está, si hace falta para
  seguirlo otro día.
- Así de cortos: "Tiene una tienda de ropa de montaña en Shopify", "Prefiere
  respuestas cortas y sin listas", "Está desarrollando ECLIPSE".

Qué NO es un hecho, y no debes apuntar NUNCA:
- Nada de salud, religión, ideas políticas, orientación sexual, dinero que
  tiene, ni situación legal. Aunque lo haya contado.
- Nada sobre terceras personas: su familia, sus amigos, sus clientes, su jefe.
- Contraseñas, claves, tokens, direcciones, teléfonos ni números de tarjeta.
- Lo que solo vale para este rato ("hazlo más corto", "prueba otra vez"), ni lo
  que se resolvió y se acabó ahí.
- Trozos de la conversación copiados. Un hecho es una frase tuya que resume algo
  suyo, nunca "el usuario dijo que…" ni el mensaje entero.
- Lo que dijo el asistente. Solo cuenta lo que se sabe de la persona.
- Y en la duda, no lo guardes: una ficha corta y verdadera vale más que una
  larga llena de cosas que no sirven.

Si no hay nada que cumpla eso, escribe "ninguno". Es una respuesta perfectamente
buena y es mejor que inventarse algo.`;

export interface Turno {
  role: "user" | "assistant";
  content: string;
}

/** Lo que se le manda: los últimos turnos, recortados. */
function comoTexto(turnos: Turno[]): string {
  return turnos
    .slice(-12)
    .map((t) => `${t.role === "user" ? "PERSONA" : "ASISTENTE"}: ${t.content.slice(0, 700)}`)
    .join("\n\n");
}

/** Partir la respuesta del modelo en sus dos trozos. */
export function leerSalida(salida: string): { hechos: string[]; tema: string } {
  const texto = salida.replace(/\r/g, "");
  const corteTema = texto.search(/^\s*TEMA\s*:/im);
  const corteHechos = texto.search(/^\s*HECHOS\s*:/im);

  /*
    Sin la marca HECHOS no hay hechos. Punto.

    Parece excesivo y no lo es: si el modelo contesta cualquier otra cosa —"no
    puedo ayudarte con eso", un error, una frase suelta— sin este corte esa
    frase entraba tal cual en la memoria de alguien como si fuera un dato suyo.
    Guardar basura en la ficha de una persona es peor que no guardar nada.
  */
  if (corteHechos === -1) return { hechos: [], tema: "" };

  const zonaHechos = texto.slice(corteHechos, corteTema === -1 ? undefined : corteTema);
  const zonaTema = corteTema === -1 ? "" : texto.slice(corteTema).replace(/^\s*TEMA\s*:/i, "");

  const hechos = zonaHechos
    .replace(/^\s*HECHOS\s*:/im, "")
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    // "ninguno" es una respuesta válida, y hay que saber leerla.
    .filter((l) => !/^ningun[oa]s?\.?$/i.test(l))
    .filter((l) => l.length > 8 && l.length <= LARGO_HECHO)
    .slice(0, 4);

  const tema = zonaTema
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 400);

  return { hechos, tema };
}

/**
 * Aprender de una conversación.
 *
 * Devuelve qué se ha aprendido, o `null` si no había con qué: sin motor en el
 * servidor esto no puede funcionar, y no es un error que haya que enseñar a
 * nadie —el chat sigue yendo igual, simplemente no se acuerda—.
 */
export async function aprenderDe(
  email: string,
  conversacion: { id: string; titulo: string; turnos: Turno[] },
): Promise<{ hechos: string[]; tema: string } | null> {
  const provider = await activeProvider();
  if (!provider || provider === "anthropic" || provider === "google") return null;

  const key = await resolveKey(provider);
  if (!key) return null;

  let salida = "";
  try {
    salida = await oneShotCompat(
      provider as CompatProvider,
      key,
      `${ENCARGO}\n\nCONVERSACIÓN:\n${comoTexto(conversacion.turnos)}`,
      260,
    );
  } catch {
    // Que no se pueda aprender hoy no rompe nada: se intentará otro día.
    return null;
  }

  const { hechos, tema } = leerSalida(salida);
  if (hechos.length) await aprenderHechos(email, hechos);
  if (tema)
    await apuntarResumen(email, {
      id: conversacion.id,
      titulo: conversacion.titulo.slice(0, 80),
      texto: tema,
    });

  await anotarVisto(email, conversacion.id, conversacion.turnos.length);
  return { hechos, tema };
}
