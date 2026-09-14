/**
 * La biblioteca: imágenes para inspirarse.
 *
 * Conviene decir de dónde salen y por qué, porque la respuesta fácil habría
 * sido otra. Lo que más impresiona —Dribbble, Behance, Pinterest— no se puede
 * traer: sus términos prohíben justo esto, y montar un producto encima de algo
 * que te pueden cortar cualquier martes no es montar nada.
 *
 * Así que se busca en Openverse, que es el buscador de obra con licencia libre
 * de la fundación Wikimedia: reúne museos, archivos, Flickr y Wikimedia
 * Commons. Hay fotografía extraordinaria ahí dentro, y además se puede usar de
 * verdad —descargar, reutilizar, poner en tu web— que es más de lo que se puede
 * decir de una captura de Pinterest.
 *
 * Cada imagen viaja con su autor y su licencia. No es un adorno legal: es lo
 * que permite usarla, y esconderlo convertiría una biblioteca en un problema.
 */

const BASE = process.env.BIBLIOTECA_BASE || "https://api.openverse.org";
const TIEMPO = 15_000;

export interface Imagen {
  id: string;
  titulo: string;
  /** La grande, para verla. */
  url: string;
  /** La pequeña, para la cuadrícula. */
  miniatura: string;
  autor: string;
  licencia: string;
  /** De dónde viene, para poder ir al original. */
  origen: string;
  fuente: string;
  ancho?: number;
  alto?: number;
}

/** Las estanterías. Cada una es una búsqueda pensada, no una palabra suelta. */
export const ESTANTES: { id: string; nombre: string; busqueda: string }[] = [
  { id: "arquitectura", nombre: "Arquitectura", busqueda: "architecture building facade" },
  { id: "naturaleza", nombre: "Naturaleza", busqueda: "landscape nature mountains" },
  { id: "retrato", nombre: "Retrato", busqueda: "portrait photography people" },
  { id: "arte", nombre: "Arte clásico", busqueda: "painting museum art" },
  { id: "espacio", nombre: "Espacio", busqueda: "astronomy nebula galaxy telescope" },
  { id: "diseno", nombre: "Diseño y color", busqueda: "poster graphic design pattern" },
  { id: "comida", nombre: "Comida", busqueda: "food photography dish" },
  { id: "animales", nombre: "Animales", busqueda: "wildlife animal photography" },
];

export function estanteDe(id: string) {
  return ESTANTES.find((e) => e.id === id);
}

/**
 * Leer un resultado sin fiarse de su forma.
 *
 * La API es de otro y puede cambiar sin avisar. Lo que no se entienda se
 * descarta en silencio, y lo que se entienda a medias se completa como se
 * pueda: una imagen sin autor conocido es mejor que una cuadrícula vacía por
 * un campo que hoy se llama distinto.
 */
function leerImagen(crudo: unknown): Imagen | null {
  const r = crudo as Record<string, unknown>;
  if (!r || typeof r !== "object") return null;

  const url = typeof r.url === "string" ? r.url : "";
  const id = typeof r.id === "string" ? r.id : url;
  if (!url || !id) return null;
  // Solo por https: una imagen por http en una página segura no se pinta.
  if (!url.startsWith("https://")) return null;

  const texto = (v: unknown, pordefecto: string) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : pordefecto;

  const licencia = texto(r.license, "").toUpperCase();
  const version = texto(r.license_version, "");

  return {
    id,
    titulo: texto(r.title, "Sin título"),
    url,
    miniatura: typeof r.thumbnail === "string" && r.thumbnail.startsWith("https://") ? r.thumbnail : url,
    autor: texto(r.creator, "Autor desconocido"),
    licencia: licencia ? `${licencia}${version ? ` ${version}` : ""}` : "Licencia libre",
    origen: texto(r.foreign_landing_url, url),
    fuente: texto(r.source, "Openverse"),
    ancho: typeof r.width === "number" ? r.width : undefined,
    alto: typeof r.height === "number" ? r.height : undefined,
  };
}

export class ErrorBiblioteca extends Error {}

/**
 * Buscar.
 *
 * Se piden solo imágenes grandes y de uso libre: una biblioteca de inspiración
 * con fotos pequeñas y pixeladas no inspira nada, y una con licencias que no
 * dejan usarlas es una trampa.
 */
export async function buscarImagenes(
  busqueda: string,
  opciones: { pagina?: number; porPagina?: number; signal?: AbortSignal } = {},
): Promise<{ imagenes: Imagen[]; total: number }> {
  const pagina = Math.max(1, Math.min(20, Math.floor(opciones.pagina ?? 1)));
  const porPagina = Math.max(1, Math.min(40, Math.floor(opciones.porPagina ?? 24)));

  const parametros = new URLSearchParams({
    q: busqueda.slice(0, 200),
    page: String(pagina),
    page_size: String(porPagina),
    // Lo que se puede usar de verdad, y en grande.
    license_type: "all-cc",
    size: "large",
    mature: "false",
  });

  const reloj = AbortSignal.timeout(TIEMPO);
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/images/?${parametros}`, {
      headers: {
        Accept: "application/json",
        // Openverse pide identificarse; sin clave hay un límite más bajo, que
        // para lo que se hace aquí sobra.
        "User-Agent": "ECLIPSE/1.0 (+https://eclipse-ia.vercel.app)",
      },
      signal: opciones.signal ? AbortSignal.any([opciones.signal, reloj]) : reloj,
    });
  } catch (err) {
    if (opciones.signal?.aborted) throw err;
    throw new ErrorBiblioteca("La biblioteca no responde ahora mismo. Prueba en un momento.");
  }

  if (res.status === 429)
    throw new ErrorBiblioteca("Demasiadas búsquedas seguidas. Espera unos segundos.");
  if (!res.ok) throw new ErrorBiblioteca(`La biblioteca ha respondido con un error ${res.status}.`);

  let cuerpo: unknown;
  try {
    cuerpo = await res.json();
  } catch {
    throw new ErrorBiblioteca("La biblioteca ha contestado algo que no se entiende.");
  }

  const datos = cuerpo as { results?: unknown[]; result_count?: number };
  const imagenes = (datos.results ?? [])
    .map(leerImagen)
    .filter((i): i is Imagen => i !== null);

  return {
    imagenes,
    total: typeof datos.result_count === "number" ? datos.result_count : imagenes.length,
  };
}
