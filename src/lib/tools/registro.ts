import { herramientaConexion } from "../conexiones/herramienta";
import type { Mode, Plan } from "../types";
import { herramientaBuscar } from "./buscar";
import { herramientaDocumento } from "./documentos";
import { herramientaImagen } from "./imagen";
import { herramientaMapa } from "./mapa";
import { herramientaRecuerdos } from "./recuerdos";
import { herramientaSeo } from "./seo";
import type { Contexto, Herramienta, Resultado } from "./tipos";

/**
 * El catálogo de herramientas.
 *
 * Añadir una es escribir su archivo y meterla en esta lista. Nada más: ni el
 * bucle, ni la ruta del chat, ni la interfaz saben cuántas hay ni cuáles son.
 */
const TODAS: Herramienta[] = [
  herramientaBuscar,
  herramientaImagen,
  herramientaDocumento,
  herramientaSeo,
  herramientaMapa,
  herramientaRecuerdos,
];

/**
 * Qué herramientas puede usar cada modo. Lo que no está aquí, no se ofrece.
 *
 * En `code` solo se busca, y solo a veces. Se le quitó la búsqueda porque un
 * modelo con herramientas delante se distrae buscando en vez de escribir; pero
 * quitársela del todo tenía su precio: al pedirle una pirámide egipcia salía un
 * prisma con textura de pared de ladrillo, porque no sabía de memoria ni la
 * proporción ni el aparejo ni el ángulo de las caras. Para modelar algo que
 * existe de verdad, mirar cómo es no es distraerse.
 *
 * Crear imágenes y escribir documentos siguen fuera: ahí la respuesta son los
 * archivos del proyecto, y una imagen suelta no pinta nada.
 */
const POR_MODO: Record<Mode, string[]> = {
  chat: [
    "buscar_web",
    "crear_imagen",
    "crear_archivo",
    "auditar_seo",
    "conexion",
    "mapa",
    "mis_conversaciones",
  ],
  code: ["buscar_web"],
};

/**
 * Las que de verdad se le pueden ofrecer al modelo ahora mismo.
 *
 * Se filtra por modo, por plan y por si la herramienta puede funcionar en este
 * servidor. Ese último filtro es el que importa: ofrecerle una herramienta sin
 * su clave hace que la llame, falle y se quede sin respuesta que dar.
 */
/**
 * ¿Está pidiendo una imagen NUEVA, o preguntando por la que ha adjuntado?
 *
 * Distinguirlo importa mucho más de lo que parece. Alguien manda una foto de
 * unos edificios y pregunta de dónde son; si en ese momento se le ofrece la
 * herramienta de crear imágenes, el modelo la usa —y devuelve una foto
 * inventada de Nueva York como si fuera una respuesta—. Eso no es equivocarse:
 * es fabricar algo que parece información y no lo es.
 */
function pideUnaImagenNueva(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    /\b(crea|creame|crear|genera|generame|generar|dibuja|dibujame|haz|hazme|pinta|ilustra|quiero)\b/.test(t) &&
    /\b(imagen|imagenes|foto|fotos|fotografia|ilustracion|dibujo|render|poster|logo|cartel)\b/.test(t)
  );
}

export async function herramientasPara(
  modo: Mode,
  plan: Plan,
  /** El último mensaje del usuario, para saber qué tiene sentido ofrecerle. */
  ultimo?: { texto: string; conImagen: boolean },
  /**
   * De quién son las conexiones, cuando no hay nadie delante.
   *
   * En el chat se saca de la cookie. En un encargo programado no hay cookie, y
   * sin esto el modelo se quedaba sin la herramienta de conexiones justo en el
   * sitio donde el encargo hablaba de "mi tienda": el resultado era un parte
   * inventado. Se pasa el correo y deja de serlo.
   */
  dueno?: string,
): Promise<Herramienta[]> {
  const permitidas = POR_MODO[modo] ?? [];
  const candidatas = TODAS.filter(
    (h) => permitidas.includes(h.nombre) && (!h.soloPro || plan === "pro"),
  ).filter((h) => {
    // Con una foto adjunta y sin pedir una nueva, crear imágenes se retira: lo
    // que se quiere es que MIRE la suya, no que invente otra.
    if (h.nombre !== "crear_imagen" || !ultimo?.conImagen) return true;
    return pideUnaImagenNueva(ultimo.texto);
  });

  const vivas = await Promise.all(
    candidatas.map(async (h) => ((await h.disponible()) ? h : null)),
  );
  const lista = vivas.filter((h): h is Herramienta => h !== null);

  /*
    La de las conexiones se fabrica en el momento, no está en `TODAS`.

    Es la única que cambia de una persona a otra: su descripción son las cuentas
    que ESTA persona tiene conectadas y las acciones que su permiso le deja
    hacer. Una lista fija no podría decir eso, y decirlo es justo lo que evita
    que el modelo intente cosas que no puede.
  */
  if (permitidas.includes("conexion") && plan === "pro") {
    const conexion = await herramientaConexion(undefined, dueno);
    if (conexion) lista.push(conexion);
  }

  return lista;
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
  /*
    Las que se le ofrecieron en ESTA petición.

    Hace falta desde que existe `conexion`, que no está en el catálogo fijo
    porque se fabrica con lo que cada persona tiene conectado. Buscándola solo
    en `TODAS`, el modelo la pedía —se la habíamos anunciado— y le contestaban
    que no existe.
  */
  disponibles?: Herramienta[],
): Promise<Resultado> {
  const herramienta = disponibles?.find((h) => h.nombre === nombre) ?? buscarHerramienta(nombre);
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
