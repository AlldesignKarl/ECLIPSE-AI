import { rankSources } from "../sources";
import type { Herramienta, Resultado } from "./tipos";

/**
 * Búsqueda web de verdad, como herramienta propia.
 *
 * Hasta ahora ECLIPSE solo sabía buscar cuando el motor lo hacía por su cuenta
 * (Gemini y Anthropic traen buscador dentro). Con Groq —que es el motor por
 * defecto, el gratis— no había búsqueda ninguna. Eso hace imposible cualquier
 * investigación real, así que la búsqueda pasa a ser algo nuestro: una llamada
 * a un buscador con API, que funciona con el motor que sea.
 *
 * Hay tres proveedores porque ninguno es claramente el mejor y las capas
 * gratuitas cambian cada temporada. Se usa el primero que tenga clave. Si no
 * hay ninguna, la herramienta NO se le ofrece al modelo: es mejor que no la
 * tenga a que la llame y se quede esperando un resultado que no va a llegar.
 */

interface Hallazgo {
  titulo: string;
  url: string;
  extracto: string;
}

type Buscador = (consulta: string, cuantos: number, signal?: AbortSignal) => Promise<Hallazgo[]>;

/* --------------------------------- Tavily -------------------------------- */
/** Pensado para IA: devuelve extractos ya limpios. 1.000 al mes gratis. */
async function tavily(consulta: string, cuantos: number, signal?: AbortSignal): Promise<Hallazgo[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query: consulta,
      max_results: cuantos,
      search_depth: "basic",
      include_answer: false,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Tavily respondió ${res.status}`);

  const json = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
  return (json.results ?? []).map((r) => ({
    titulo: r.title ?? "",
    url: r.url ?? "",
    extracto: (r.content ?? "").slice(0, 900),
  }));
}

/* ---------------------------------- Brave -------------------------------- */
async function brave(consulta: string, cuantos: number, signal?: AbortSignal): Promise<Hallazgo[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", consulta);
  url.searchParams.set("count", String(cuantos));

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_API_KEY ?? "",
    },
    signal,
  });
  if (!res.ok) throw new Error(`Brave respondió ${res.status}`);

  const json = (await res.json()) as {
    web?: { results?: { title?: string; url?: string; description?: string }[] };
  };
  return (json.web?.results ?? []).map((r) => ({
    titulo: r.title ?? "",
    url: r.url ?? "",
    extracto: (r.description ?? "").replace(/<[^>]+>/g, "").slice(0, 900),
  }));
}

/* --------------------------------- Serper -------------------------------- */
async function serper(consulta: string, cuantos: number, signal?: AbortSignal): Promise<Hallazgo[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": process.env.SERPER_API_KEY ?? "" },
    body: JSON.stringify({ q: consulta, num: cuantos }),
    signal,
  });
  if (!res.ok) throw new Error(`Serper respondió ${res.status}`);

  const json = (await res.json()) as {
    organic?: { title?: string; link?: string; snippet?: string }[];
  };
  return (json.organic ?? []).map((r) => ({
    titulo: r.title ?? "",
    url: r.link ?? "",
    extracto: (r.snippet ?? "").slice(0, 900),
  }));
}

/** El primero que tenga clave puesta. */
function elegido(): { nombre: string; buscar: Buscador } | null {
  if (process.env.TAVILY_API_KEY) return { nombre: "Tavily", buscar: tavily };
  if (process.env.BRAVE_API_KEY) return { nombre: "Brave", buscar: brave };
  if (process.env.SERPER_API_KEY) return { nombre: "Serper", buscar: serper };
  return null;
}

export function busquedaPropiaDisponible(): boolean {
  return elegido() !== null;
}

/** Qué claves acepta, para poder decírselo a quien monta el servidor. */
export const CLAVES_BUSQUEDA = ["TAVILY_API_KEY", "BRAVE_API_KEY", "SERPER_API_KEY"] as const;

/**
 * Busca y devuelve los resultados ya ordenados por fiabilidad, con la misma
 * clasificación que usa el resto de la aplicación: universidades y organismos
 * arriba, blogs abajo. Ordenar aquí y no al enseñarlo importa, porque lo que
 * el modelo lee primero es lo que más pesa en su respuesta.
 */
export async function buscarEnLaWeb(
  consulta: string,
  cuantos = 6,
  signal?: AbortSignal,
): Promise<Resultado> {
  const proveedor = elegido();
  if (!proveedor)
    return {
      texto: "",
      error:
        "No hay ningún buscador configurado en este servidor, así que no puedo consultar internet.",
    };

  let hallazgos: Hallazgo[];
  try {
    hallazgos = await proveedor.buscar(consulta, Math.min(10, Math.max(1, cuantos)), signal);
  } catch (err) {
    return {
      texto: "",
      error: `La búsqueda ha fallado (${err instanceof Error ? err.message : "motivo desconocido"}).`,
    };
  }

  const conUrl = hallazgos.filter((h) => h.url);
  if (conUrl.length === 0)
    return { texto: `La búsqueda de "${consulta}" no ha devuelto ningún resultado.` };

  const fuentes = rankSources(
    conUrl.map((h) => ({ url: h.url, title: h.titulo })),
  );

  // Se le entregan en el orden de fiabilidad, no en el del buscador.
  const porUrl = new Map(conUrl.map((h) => [h.url, h]));
  const texto = fuentes
    .map((f, i) => {
      const h = porUrl.get(f.url);
      return `[${i + 1}] ${f.title}\nFuente: ${f.domain} (${f.label}, fiabilidad ${f.trust}/100)\nURL: ${f.url}\n${h?.extracto ?? ""}`;
    })
    .join("\n\n");

  return {
    texto: `Resultados para "${consulta}":\n\n${texto}`,
    fuentes,
  };
}

export const herramientaBuscar: Herramienta = {
  nombre: "buscar_web",
  descripcion: `Busca en internet y devuelve resultados con su URL, un extracto y una nota de
fiabilidad de la fuente. Úsala cuando la respuesta dependa de datos que cambian o que
no dominas con certeza: noticias, precios, versiones, leyes, estudios, personas u
organizaciones concretas. Haz varias búsquedas con formulaciones distintas si el tema
lo merece. NO la uses para conocimiento estable, razonamiento, redacción ni cálculo:
ahí eres más rápido y mejor tú solo.`,
  parametros: {
    type: "object",
    properties: {
      consulta: {
        type: "string",
        description:
          "Qué buscar. Palabras clave, como se le escribiría a un buscador, no una pregunta larga.",
      },
      cuantos: {
        type: "integer",
        description: "Cuántos resultados quieres, de 1 a 10. Por defecto 6.",
      },
    },
    required: ["consulta"],
  },
  disponible: busquedaPropiaDisponible,
  async ejecutar(args, ctx) {
    const consulta = String(args.consulta ?? "").trim();
    if (!consulta) return { texto: "", error: "No has dicho qué buscar." };

    ctx.avisar?.(`Buscando: ${consulta}`);
    return buscarEnLaWeb(consulta, Number(args.cuantos) || 6, ctx.signal);
  },
};
