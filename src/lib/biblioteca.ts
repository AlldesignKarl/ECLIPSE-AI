/**
 * La biblioteca: imágenes para inspirarse.
 *
 * Conviene decir de dónde salen y por qué, porque la respuesta fácil habría
 * sido otra. Lo que más impresiona —Dribbble, Behance, Pinterest— no se puede
 * traer: sus términos prohíben justo esto, y montar un producto encima de algo
 * que te pueden cortar cualquier martes no es montar nada.
 *
 * Así que se busca en archivos y museos que publican su obra con licencia
 * libre. Hay fotografía y pintura extraordinarias ahí dentro, y además se
 * pueden usar de verdad —descargar, reutilizar, poner en tu web— que es más de
 * lo que se puede decir de una captura de Pinterest.
 *
 * Y se busca en VARIOS, no en uno. Esto empezó con Openverse solo, y un día
 * Openverse pasó a exigir cuenta: la pantalla entera se quedó con un "error
 * 401" y no había plan B. Ahora hay tres sitios y se prueban por orden; si el
 * primero falla o no trae nada, entra el siguiente. Una biblioteca que depende
 * de que una sola empresa no cambie de idea no es una biblioteca.
 *
 * Cada imagen viaja con su autor y su licencia. No es un adorno legal: es lo
 * que permite usarla, y esconderlo convertiría una biblioteca en un problema.
 */

const TIEMPO = 15_000;

/**
 * Quiénes somos, para quien sirve las imágenes.
 *
 * Wikimedia lo exige por escrito en su política de uso: una petición sin
 * identificar se rechaza. Y es lo correcto de todos modos —quien aguanta el
 * coste de servir esto tiene derecho a saber quién le pide—.
 */
const AGENTE = "ECLIPSE-IA/1.0 (https://eclipse-ia.vercel.app)";

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

export interface Resultado {
  imagenes: Imagen[];
  total: number;
  /** Qué archivo ha contestado, para poder decirlo en pantalla. */
  fuente: string;
}

/** Las estanterías. Cada una es una búsqueda pensada, no una palabra suelta. */
export const ESTANTES: {
  id: string;
  nombre: string;
  busqueda: string;
  /** Un museo antes que un archivo de fotos, cuando el tema lo pide. */
  prefiere?: string;
}[] = [
  { id: "arquitectura", nombre: "Arquitectura", busqueda: "architecture building facade" },
  { id: "naturaleza", nombre: "Naturaleza", busqueda: "landscape nature mountains" },
  { id: "retrato", nombre: "Retrato", busqueda: "portrait photography people" },
  { id: "arte", nombre: "Arte clásico", busqueda: "painting", prefiere: "artic" },
  { id: "espacio", nombre: "Espacio", busqueda: "astronomy nebula galaxy telescope" },
  { id: "diseno", nombre: "Diseño y color", busqueda: "poster graphic design pattern" },
  { id: "comida", nombre: "Comida", busqueda: "food photography dish" },
  { id: "animales", nombre: "Animales", busqueda: "wildlife animal photography" },
];

export function estanteDe(id: string) {
  return ESTANTES.find((e) => e.id === id);
}

export class ErrorBiblioteca extends Error {}

/* -------------------------------------------------------------------------- */
/*                               Cosas de andar                               */
/* -------------------------------------------------------------------------- */

const recorta = (v: unknown, pordefecto: string) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : pordefecto;

/**
 * Las entidades con nombre que de verdad aparecen en estos archivos.
 *
 * Que son, casi todas, letras acentuadas: los nombres de la gente. Sin esto,
 * una foto de Ana Gómez sale firmada por "Ana G&oacute;mez", que es peor que
 * no poner el autor.
 */
const LETRAS: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", yacute: "ý",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Yacute: "Ý",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  Agrave: "À", Egrave: "È", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù",
  auml: "ä", euml: "ë", iuml: "ï", ouml: "ö", uuml: "ü",
  Auml: "Ä", Euml: "Ë", Iuml: "Ï", Ouml: "Ö", Uuml: "Ü",
  acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
  Acirc: "Â", Ecirc: "Ê", Icirc: "Î", Ocirc: "Ô", Ucirc: "Û",
  atilde: "ã", ntilde: "ñ", otilde: "õ", Atilde: "Ã", Ntilde: "Ñ", Otilde: "Õ",
  ccedil: "ç", Ccedil: "Ç", aring: "å", Aring: "Å", oslash: "ø", Oslash: "Ø",
  aelig: "æ", AElig: "Æ", szlig: "ß", eth: "ð", thorn: "þ",
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  laquo: "«", raquo: "»", ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  ndash: "–", mdash: "—", hellip: "…", middot: "·", deg: "°", euro: "€", pound: "£",
  copy: "©", reg: "®", trade: "™",
};

/**
 * Los archivos devuelven el nombre del autor con etiquetas dentro —un enlace a
 * su ficha, casi siempre— y con las letras acentuadas escapadas. En una
 * cuadrícula eso se lee como código.
 */
function sinEtiquetas(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    // Primero los números (&#243; y &#xF3;), que no tienen misterio.
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // Y luego los nombres conocidos. Lo que no esté en la lista se queda tal
    // cual: enseñar "&foo;" es feo, pero inventarse un carácter es peor.
    .replace(/&([a-zA-Z]+);/g, (entera, nombre) => LETRAS[nombre] ?? entera)
    .replace(/\s+/g, " ")
    .trim();
}

/** Una imagen por http no se pinta en una página segura: no vale de nada. */
const segura = (u: unknown): u is string => typeof u === "string" && u.startsWith("https://");

async function traerJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const reloj = AbortSignal.timeout(TIEMPO);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": AGENTE },
    signal: signal ? AbortSignal.any([signal, reloj]) : reloj,
  });
  if (res.status === 429) throw new ErrorBiblioteca("429");
  if (!res.ok) throw new ErrorBiblioteca(String(res.status));
  return res.json();
}

/* -------------------------------------------------------------------------- */
/*                          Wikimedia Commons                                 */
/* -------------------------------------------------------------------------- */

const BASE_COMMONS = process.env.BIBLIOTECA_BASE_COMMONS ?? "https://commons.wikimedia.org";

/**
 * Wikimedia Commons: cien millones de archivos, todos de uso libre, y sin
 * pedir cuenta a nadie. Es el más grande que existe con estas condiciones, así
 * que es el que va primero.
 *
 * A la búsqueda se le añaden dos filtros que no se ven pero se notan:
 * `filetype:bitmap` quita los PDF, los SVG de iconos y los mapas vectoriales, y
 * `fileres:>1200` deja fuera las miniaturas. Una biblioteca de inspiración con
 * imágenes de 300 píxeles no inspira nada.
 */
async function enCommons(
  busqueda: string,
  pagina: number,
  porPagina: number,
  signal?: AbortSignal,
): Promise<Resultado> {
  const p = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${busqueda} filetype:bitmap fileres:>1200`,
    gsrnamespace: "6",
    gsrlimit: String(porPagina),
    gsroffset: String((pagina - 1) * porPagina),
    gsrinfo: "totalhits",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "480",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|ObjectName",
    origin: "*",
  });

  const cuerpo = (await traerJson(`${BASE_COMMONS}/w/api.php?${p}`, signal)) as {
    query?: {
      searchinfo?: { totalhits?: number };
      pages?: {
        title?: string;
        pageid?: number;
        imageinfo?: {
          url?: string;
          thumburl?: string;
          descriptionurl?: string;
          width?: number;
          height?: number;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }[];
    };
  };

  const paginas = cuerpo.query?.pages ?? [];
  const imagenes: Imagen[] = [];

  for (const pag of paginas) {
    const info = pag.imageinfo?.[0];
    if (!info || !segura(info.url)) continue;

    const meta = info.extmetadata ?? {};
    const autor = sinEtiquetas(meta.Artist?.value ?? "");
    const licencia = sinEtiquetas(meta.LicenseShortName?.value ?? "");

    // "File:Catedral de León 01.jpg" -> "Catedral de León 01"
    const titulo = (pag.title ?? "")
      .replace(/^(File|Archivo|Fichero):/i, "")
      .replace(/\.(jpe?g|png|tiff?|webp|gif)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();

    imagenes.push({
      id: `commons-${pag.pageid ?? info.url}`,
      titulo: recorta(titulo, "Sin título"),
      url: info.url,
      miniatura: segura(info.thumburl) ? info.thumburl : info.url,
      autor: recorta(autor, "Autor desconocido"),
      licencia: recorta(licencia, "Licencia libre"),
      origen: segura(info.descriptionurl) ? info.descriptionurl : info.url,
      fuente: "Wikimedia Commons",
      ancho: typeof info.width === "number" ? info.width : undefined,
      alto: typeof info.height === "number" ? info.height : undefined,
    });
  }

  return {
    imagenes,
    total: cuerpo.query?.searchinfo?.totalhits ?? imagenes.length,
    fuente: "Wikimedia Commons",
  };
}

/* -------------------------------------------------------------------------- */
/*                       Art Institute of Chicago                             */
/* -------------------------------------------------------------------------- */

const BASE_ARTIC = process.env.BIBLIOTECA_BASE_ARTIC ?? "https://api.artic.edu";

/**
 * El Instituto de Arte de Chicago publica su colección entera, en altísima
 * resolución y sin pedir clave. Para "arte clásico" no hay color: un archivo
 * de fotos te da la foto de un cuadro colgado en una pared; esto te da el
 * cuadro escaneado.
 */
async function enArtic(
  busqueda: string,
  pagina: number,
  porPagina: number,
  signal?: AbortSignal,
): Promise<Resultado> {
  const p = new URLSearchParams({
    q: busqueda,
    limit: String(porPagina),
    page: String(pagina),
    fields: "id,title,image_id,artist_title,date_display,is_public_domain,term_titles",
  });

  const cuerpo = (await traerJson(`${BASE_ARTIC}/api/v1/artworks/search?${p}`, signal)) as {
    pagination?: { total?: number };
    data?: {
      id?: number;
      title?: string;
      image_id?: string | null;
      artist_title?: string | null;
      date_display?: string | null;
      is_public_domain?: boolean;
    }[];
    config?: { iiif_url?: string };
  };

  const iiif = cuerpo.config?.iiif_url ?? "https://www.artic.edu/iiif/2";
  const imagenes: Imagen[] = [];

  for (const obra of cuerpo.data ?? []) {
    // Sin imagen no hay nada que enseñar, y sin dominio público no se puede
    // prometer que se pueda usar: las dos cosas descartan la obra.
    if (!obra.image_id || obra.is_public_domain !== true) continue;

    const grande = `${iiif}/${obra.image_id}/full/1686,/0/default.jpg`;
    const mini = `${iiif}/${obra.image_id}/full/400,/0/default.jpg`;
    if (!segura(grande)) continue;

    imagenes.push({
      id: `artic-${obra.id}`,
      titulo: recorta(obra.title, "Sin título"),
      url: grande,
      miniatura: mini,
      autor: recorta(
        [obra.artist_title, obra.date_display].filter(Boolean).join(", "),
        "Autor desconocido",
      ),
      licencia: "Dominio público (CC0)",
      origen: `https://www.artic.edu/artworks/${obra.id}`,
      fuente: "Art Institute of Chicago",
    });
  }

  return {
    imagenes,
    total: cuerpo.pagination?.total ?? imagenes.length,
    fuente: "Art Institute of Chicago",
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Openverse                                  */
/* -------------------------------------------------------------------------- */

const BASE_OPENVERSE =
  process.env.BIBLIOTECA_BASE_OPENVERSE ?? process.env.BIBLIOTECA_BASE ?? "https://api.openverse.org";

/**
 * Openverse sigue aquí, pero solo con credenciales.
 *
 * Es el buscador de obra libre de Wikimedia y reúne Flickr, museos y Commons
 * en uno. Dejó de responder a quien no se identifica —de ahí el 401 que veía
 * la gente—, así que ahora solo se usa si alguien ha dado de alta la
 * aplicación y ha puesto las dos claves en el servidor. Sin ellas no se
 * intenta siquiera: llamar para que te digan que no es gastar dos segundos de
 * la espera de alguien.
 */
function hayOpenverse(): boolean {
  return Boolean(process.env.OPENVERSE_CLIENT_ID && process.env.OPENVERSE_CLIENT_SECRET);
}

let vale: { token: string; caduca: number } | null = null;

async function tokenOpenverse(signal?: AbortSignal): Promise<string> {
  const ahora = Date.now();
  if (vale && vale.caduca > ahora + 30_000) return vale.token;

  const res = await fetch(`${BASE_OPENVERSE}/v1/auth_tokens/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": AGENTE },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.OPENVERSE_CLIENT_ID ?? "",
      client_secret: process.env.OPENVERSE_CLIENT_SECRET ?? "",
    }),
    signal,
  });
  if (!res.ok) throw new ErrorBiblioteca(String(res.status));

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new ErrorBiblioteca("sin token");

  vale = { token: json.access_token, caduca: ahora + (json.expires_in ?? 3600) * 1000 };
  return vale.token;
}

async function enOpenverse(
  busqueda: string,
  pagina: number,
  porPagina: number,
  signal?: AbortSignal,
): Promise<Resultado> {
  const token = await tokenOpenverse(signal);
  const p = new URLSearchParams({
    q: busqueda.slice(0, 200),
    page: String(pagina),
    page_size: String(porPagina),
    license_type: "all-cc",
    size: "large",
    mature: "false",
  });

  const reloj = AbortSignal.timeout(TIEMPO);
  const res = await fetch(`${BASE_OPENVERSE}/v1/images/?${p}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": AGENTE,
      Authorization: `Bearer ${token}`,
    },
    signal: signal ? AbortSignal.any([signal, reloj]) : reloj,
  });
  if (res.status === 401) {
    // El vale ha caducado antes de tiempo: se tira y que lo pida el siguiente.
    vale = null;
    throw new ErrorBiblioteca("401");
  }
  if (!res.ok) throw new ErrorBiblioteca(String(res.status));

  const cuerpo = (await res.json()) as {
    results?: Record<string, unknown>[];
    result_count?: number;
  };

  const imagenes: Imagen[] = [];
  for (const r of cuerpo.results ?? []) {
    if (!r || typeof r !== "object") continue;
    if (!segura(r.url)) continue;

    const licencia = recorta(r.license, "").toUpperCase();
    const version = recorta(r.license_version, "");

    imagenes.push({
      id: `openverse-${recorta(r.id, r.url)}`,
      titulo: recorta(r.title, "Sin título"),
      url: r.url,
      miniatura: segura(r.thumbnail) ? r.thumbnail : r.url,
      autor: recorta(r.creator, "Autor desconocido"),
      licencia: licencia ? `${licencia}${version ? ` ${version}` : ""}` : "Licencia libre",
      origen: recorta(r.foreign_landing_url, r.url),
      fuente: recorta(r.source, "Openverse"),
      ancho: typeof r.width === "number" ? r.width : undefined,
      alto: typeof r.height === "number" ? r.height : undefined,
    });
  }

  return {
    imagenes,
    total: typeof cuerpo.result_count === "number" ? cuerpo.result_count : imagenes.length,
    fuente: "Openverse",
  };
}

/* -------------------------------------------------------------------------- */
/*                              Buscar de verdad                              */
/* -------------------------------------------------------------------------- */

interface Fuente {
  id: string;
  hay: () => boolean;
  buscar: (
    busqueda: string,
    pagina: number,
    porPagina: number,
    signal?: AbortSignal,
  ) => Promise<Resultado>;
}

const FUENTES: Fuente[] = [
  { id: "commons", hay: () => true, buscar: enCommons },
  { id: "artic", hay: () => true, buscar: enArtic },
  { id: "openverse", hay: hayOpenverse, buscar: enOpenverse },
];

/**
 * Buscar, probando los archivos por orden hasta que uno conteste algo.
 *
 * Que uno falle no es motivo para enseñar un error: lo que quiere quien mira
 * son imágenes, y el siguiente archivo tiene. Solo cuando no queda ninguno se
 * dice que no hay, y entonces se dice por qué.
 */
export async function buscarImagenes(
  busqueda: string,
  opciones: {
    pagina?: number;
    porPagina?: number;
    signal?: AbortSignal;
    /** El archivo que mejor le va a este estante, si alguno le va mejor. */
    prefiere?: string;
  } = {},
): Promise<Resultado> {
  const pagina = Math.max(1, Math.min(20, Math.floor(opciones.pagina ?? 1)));
  const porPagina = Math.max(1, Math.min(40, Math.floor(opciones.porPagina ?? 24)));

  const orden = [...FUENTES].sort((a, b) => {
    if (a.id === opciones.prefiere) return -1;
    if (b.id === opciones.prefiere) return 1;
    return 0;
  });

  let ultimo: unknown = null;
  let hubo429 = false;

  for (const fuente of orden) {
    if (!fuente.hay()) continue;
    try {
      const r = await fuente.buscar(busqueda, pagina, porPagina, opciones.signal);
      if (r.imagenes.length > 0) return r;
      // Sin resultados no es un fallo: puede que ahí no haya nada de esto.
      // Se sigue probando, y si nadie tiene nada se devuelve vacío y ya.
      ultimo = r;
    } catch (err) {
      if (opciones.signal?.aborted) throw err;
      if (err instanceof ErrorBiblioteca && err.message === "429") hubo429 = true;
      ultimo = err;
    }
  }

  if (ultimo && !(ultimo instanceof Error)) return ultimo as Resultado;
  if (hubo429) throw new ErrorBiblioteca("Demasiadas búsquedas seguidas. Espera unos segundos.");
  throw new ErrorBiblioteca(
    "Los archivos de imágenes no responden ahora mismo. Prueba en un momento.",
  );
}
