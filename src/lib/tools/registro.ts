import type { Mode, Plan } from "../types";
import { herramientaBuscar } from "./buscar";
import { herramientaDocumento } from "./documentos";
import type { Contexto, Herramienta, Resultado } from "./tipos";

/**
 * El catálogo de herramientas.
 *
 * Añadir una es escribir su archivo y meterla en esta lista. Nada más: ni el
 * bucle, ni la ruta del chat, ni la interfaz saben cuántas hay ni cuáles son.
 */
const TODAS: Herramienta[] = [herramientaBuscar, herramientaDocumento];

/** Qué herramientas puede usar cada modo. Lo que no está aquí, no se ofrece. */
const POR_MODO: Record<Mode, string[]> = {
  chat: ["buscar_web", "crear_archivo"],
  search: ["buscar_web", "crear_archivo"],
  image: [],
  bot: [],
};

/**
 * Las que de verdad se le pueden ofrecer al modelo ahora mismo.
 *
 * Se filtra por modo, por plan y por si la herramienta puede funcionar en este
 * servidor. Ese último filtro es el que importa: ofrecerle una herramienta sin
 * su clave hace que la llame, falle y se quede sin respuesta que dar.
 */
export async function herramientasPara(modo: Mode, plan: Plan): Promise<Herramienta[]> {
  const permitidas = POR_MODO[modo] ?? [];
  const candidatas = TODAS.filter(
    (h) => permitidas.includes(h.nombre) && (!h.soloPro || plan === "pro"),
  );

  const vivas = await Promise.all(
    candidatas.map(async (h) => ((await h.disponible()) ? h : null)),
  );
  return vivas.filter((h): h is Herramienta => h !== null);
}

export function buscarHerramienta(nombre: string): Herramienta | undefined {
  return TODAS.find((h) => h.nombre === nombre);
}

/**
 * Ejecuta una herramienta protegiéndose de ella.
 *
 * Una herramienta que lance una excepción no puede tumbar la conversación
 * entera: el modelo tiene que poder enterarse de que falló y seguir, o
 * explicárselo al usuario. Por eso todo error se convierte en un resultado
 * con `error`, que es algo que el modelo sabe leer.
 */
export async function ejecutarHerramienta(
  nombre: string,
  args: Record<string, unknown>,
  ctx: Contexto,
): Promise<Resultado> {
  const herramienta = buscarHerramienta(nombre);
  if (!herramienta) return { texto: "", error: `No existe ninguna herramienta llamada "${nombre}".` };

  if (herramienta.soloPro && ctx.plan !== "pro")
    return { texto: "", error: `"${nombre}" es del plan Pro.` };

  if (!(await herramienta.disponible()))
    return { texto: "", error: `"${nombre}" no está disponible en este servidor.` };

  try {
    return await herramienta.ejecutar(args, ctx);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return {
      texto: "",
      error: `La herramienta "${nombre}" ha fallado: ${
        err instanceof Error ? err.message : "motivo desconocido"
      }`,
    };
  }
}

/** El catálogo en el formato que entienden los modelos compatibles con OpenAI. */
export function comoEsquemaOpenAI(herramientas: Herramienta[]) {
  return herramientas.map((h) => ({
    type: "function" as const,
    function: {
      name: h.nombre,
      description: h.descripcion,
      parameters: h.parametros,
    },
  }));
}
