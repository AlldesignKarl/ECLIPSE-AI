/**
 * Saber dónde está algo, y cómo se llega.
 *
 * Dos caminos, y el que hay se elige solo:
 *
 * - Con `GOOGLE_MAPS_API_KEY` puesta se usa Google Maps Platform, que es lo
 *   que pidió quien encargó esto: direcciones reales, sitios con su nota y su
 *   horario, y rutas con sus tramos.
 * - Sin clave se usa OpenStreetMap —Nominatim para buscar, y la distancia en
 *   línea recta— que es gratis y no hay que dar de alta nada. Da menos, pero
 *   da lo suficiente para planear un fin de semana, y lo dice claramente en
 *   vez de fingir que sabe el tiempo exacto del trayecto.
 *
 * En los dos casos la respuesta lleva SIEMPRE un enlace de Google Maps, que no
 * necesita clave ninguna: aunque aquí solo se sepa la distancia a ojo, el
 * enlace abre el mapa de verdad con la ruta puesta.
 *
 * Nada de esto se guarda. Las coordenadas llegan, se usan para contestar y se
 * van con la petición.
 */

/** Para poder probarlo contra un servidor de mentira. */
const BASE_GOOGLE = process.env.MAPA_BASE_GOOGLE ?? "https://maps.googleapis.com";
const BASE_OSM = process.env.MAPA_BASE_OSM ?? "https://nominatim.openstreetmap.org";

/**
 * Nominatim pide identificarse y no pasar de una consulta por segundo. Se
 * cumple: cabecera con el nombre de la aplicación y de dónde sale, y una sola
 * consulta por cada cosa que pregunte el usuario.
 */
const AGENTE = "ECLIPSE-IA/1.0 (https://eclipse-ia.vercel.app)";

export function hayGoogleMaps(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export interface Punto {
  lat: number;
  lon: number;
}

export interface Sitio {
  nombre: string;
  direccion?: string;
  /** De 0 a 5, si quien lo sirve la da. */
  nota?: number;
  cuantasNotas?: number;
  abierto?: boolean;
  punto?: Punto;
  /** Kilómetros en línea recta desde donde se preguntó. */
  km?: number;
  tipo?: string;
}

/** Redondeo a ~100 m. Ni se necesita más, ni se quiere tener más. */
export function aproximar(p: Punto): Punto {
  return { lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000 };
}

export function puntoValido(p: unknown): p is Punto {
  const q = p as Punto;
  return (
    !!q &&
    typeof q.lat === "number" &&
    typeof q.lon === "number" &&
    Number.isFinite(q.lat) &&
    Number.isFinite(q.lon) &&
    Math.abs(q.lat) <= 90 &&
    Math.abs(q.lon) <= 180
  );
}

/** Distancia en línea recta, en kilómetros (fórmula del semiverseno). */
export function distanciaKm(a: Punto, b: Punto): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

async function traer(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": AGENTE, Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`El servicio de mapas respondió ${res.status}`);
  return res.json();
}

/* -------------------------- De coordenadas a sitio ------------------------ */

/**
 * Qué hay en estas coordenadas, en palabras: "Zaragoza, Aragón, España".
 *
 * Se queda con el municipio y arriba, nunca con la calle y el número. Es lo
 * que hace falta para hablar de planes, y es también lo único que hace falta:
 * para decirle a alguien qué hacer un sábado no se necesita saber su portal.
 */
export async function dondeEs(p: Punto, signal?: AbortSignal): Promise<string | null> {
  const a = aproximar(p);

  if (hayGoogleMaps()) {
    const url = `${BASE_GOOGLE}/maps/api/geocode/json?latlng=${a.lat},${a.lon}&language=es&result_type=locality|administrative_area_level_2|administrative_area_level_1|country&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const json = (await traer(url, signal)) as {
      results?: { formatted_address?: string }[];
    };
    const nombre = json.results?.[0]?.formatted_address;
    if (nombre) return nombre;
  }

  const url = `${BASE_OSM}/reverse?format=jsonv2&lat=${a.lat}&lon=${a.lon}&zoom=12&accept-language=es`;
  const json = (await traer(url, signal)) as {
    address?: Record<string, string>;
    display_name?: string;
  };
  const d = json.address;
  if (d) {
    const partes = [
      d.city || d.town || d.village || d.municipality || d.county,
      d.state || d.region,
      d.country,
    ].filter(Boolean);
    if (partes.length) return partes.join(", ");
  }
  return json.display_name ?? null;
}

/* --------------------------- De un nombre a punto ------------------------- */

/** Dónde cae un sitio escrito a mano: "Museo del Prado", "Jaca". */
export async function buscarSitio(
  texto: string,
  cerca?: Punto,
  signal?: AbortSignal,
): Promise<Sitio | null> {
  if (hayGoogleMaps()) {
    const cercaDe = cerca ? `&location=${cerca.lat},${cerca.lon}&radius=50000` : "";
    const url = `${BASE_GOOGLE}/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
      texto,
    )}&inputtype=textquery&language=es&fields=name,formatted_address,geometry,rating,user_ratings_total&locationbias=${
      cerca ? `circle:50000@${cerca.lat},${cerca.lon}` : "ipbias"
    }${cercaDe}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const json = (await traer(url, signal)) as {
      candidates?: {
        name?: string;
        formatted_address?: string;
        rating?: number;
        user_ratings_total?: number;
        geometry?: { location?: { lat: number; lng: number } };
      }[];
    };
    const c = json.candidates?.[0];
    if (c?.name) {
      const loc = c.geometry?.location;
      return {
        nombre: c.name,
        direccion: c.formatted_address,
        nota: c.rating,
        cuantasNotas: c.user_ratings_total,
        punto: loc ? { lat: loc.lat, lon: loc.lng } : undefined,
      };
    }
  }

  const alrededor = cerca
    ? `&viewbox=${cerca.lon - 0.7},${cerca.lat + 0.7},${cerca.lon + 0.7},${cerca.lat - 0.7}`
    : "";
  const url = `${BASE_OSM}/search?format=jsonv2&q=${encodeURIComponent(
    texto,
  )}&limit=1&accept-language=es${alrededor}`;
  const json = (await traer(url, signal)) as {
    display_name?: string;
    name?: string;
    lat?: string;
    lon?: string;
    type?: string;
  }[];
  const r = Array.isArray(json) ? json[0] : null;
  if (!r?.lat || !r?.lon) return null;
  return {
    nombre: r.name || (r.display_name ?? texto).split(",")[0],
    direccion: r.display_name,
    punto: { lat: Number(r.lat), lon: Number(r.lon) },
    tipo: r.type,
  };
}

/* ----------------------------- Qué hay alrededor -------------------------- */

/** Sitios de un tipo cerca de un punto: "museos", "restaurantes", "rutas". */
export async function queHayCerca(
  que: string,
  cerca: Punto,
  radioKm = 5,
  cuantos = 8,
  signal?: AbortSignal,
): Promise<Sitio[]> {
  const a = aproximar(cerca);

  if (hayGoogleMaps()) {
    const url = `${BASE_GOOGLE}/maps/api/place/textsearch/json?query=${encodeURIComponent(
      que,
    )}&location=${a.lat},${a.lon}&radius=${Math.round(radioKm * 1000)}&language=es&key=${
      process.env.GOOGLE_MAPS_API_KEY
    }`;
    const json = (await traer(url, signal)) as {
      results?: {
        name?: string;
        formatted_address?: string;
        rating?: number;
        user_ratings_total?: number;
        types?: string[];
        opening_hours?: { open_now?: boolean };
        geometry?: { location?: { lat: number; lng: number } };
      }[];
    };
    const sitios = (json.results ?? []).slice(0, cuantos).map((r) => {
      const loc = r.geometry?.location;
      const punto = loc ? { lat: loc.lat, lon: loc.lng } : undefined;
      return {
        nombre: r.name ?? "",
        direccion: r.formatted_address,
        nota: r.rating,
        cuantasNotas: r.user_ratings_total,
        abierto: r.opening_hours?.open_now,
        tipo: r.types?.[0],
        punto,
        km: punto ? distanciaKm(a, punto) : undefined,
      };
    });
    if (sitios.length) return sitios;
  }

  const url = `${BASE_OSM}/search?format=jsonv2&q=${encodeURIComponent(
    que,
  )}&limit=${cuantos}&accept-language=es&viewbox=${a.lon - radioKm / 70},${a.lat + radioKm / 110},${
    a.lon + radioKm / 70
  },${a.lat - radioKm / 110}&bounded=1`;
  const json = (await traer(url, signal)) as {
    display_name?: string;
    name?: string;
    lat?: string;
    lon?: string;
    type?: string;
  }[];
  return (Array.isArray(json) ? json : [])
    .filter((r) => r.lat && r.lon)
    .map((r) => {
      const punto = { lat: Number(r.lat), lon: Number(r.lon) };
      return {
        nombre: r.name || (r.display_name ?? "").split(",")[0],
        direccion: r.display_name,
        tipo: r.type,
        punto,
        km: distanciaKm(a, punto),
      };
    });
}

/* --------------------------------- Ir allí -------------------------------- */

export type Transporte = "coche" | "andando" | "bici" | "transporte";

const EN_GOOGLE: Record<Transporte, string> = {
  coche: "driving",
  andando: "walking",
  bici: "bicycling",
  transporte: "transit",
};

export interface Ruta {
  desde: string;
  hasta: string;
  transporte: Transporte;
  /** Kilómetros. Reales si hay Google; en línea recta si no. */
  km: number;
  /** Cuánto se tarda, en palabras. Solo cuando es de verdad. */
  duracion?: string;
  /** Si el kilometraje es el del camino o el de la línea recta. */
  exacto: boolean;
  pasos?: string[];
  enlace: string;
}

/** El enlace de Google Maps, que no necesita clave y abre la app del móvil. */
export function enlaceRuta(desde: string, hasta: string, transporte: Transporte): string {
  const modo = { coche: "driving", andando: "walking", bici: "bicycling", transporte: "transit" }[
    transporte
  ];
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    desde,
  )}&destination=${encodeURIComponent(hasta)}&travelmode=${modo}`;
}

/** El enlace de un sitio suelto. */
export function enlaceSitio(sitio: Sitio): string {
  const q = sitio.punto
    ? `${sitio.punto.lat},${sitio.punto.lon}`
    : `${sitio.nombre} ${sitio.direccion ?? ""}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export async function comoLlegar(
  desde: Punto | string,
  hasta: string,
  transporte: Transporte = "coche",
  signal?: AbortSignal,
): Promise<Ruta | null> {
  const textoDesde = typeof desde === "string" ? desde : `${aproximar(desde).lat},${aproximar(desde).lon}`;

  if (hayGoogleMaps()) {
    const url = `${BASE_GOOGLE}/maps/api/directions/json?origin=${encodeURIComponent(
      textoDesde,
    )}&destination=${encodeURIComponent(hasta)}&mode=${
      EN_GOOGLE[transporte]
    }&language=es&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const json = (await traer(url, signal)) as {
      routes?: {
        legs?: {
          distance?: { value?: number };
          duration?: { text?: string };
          start_address?: string;
          end_address?: string;
          steps?: { html_instructions?: string; distance?: { text?: string } }[];
        }[];
      }[];
    };
    const tramo = json.routes?.[0]?.legs?.[0];
    if (tramo) {
      return {
        desde: tramo.start_address ?? textoDesde,
        hasta: tramo.end_address ?? hasta,
        transporte,
        km: Math.round(((tramo.distance?.value ?? 0) / 1000) * 10) / 10,
        duracion: tramo.duration?.text,
        exacto: true,
        pasos: (tramo.steps ?? [])
          .slice(0, 12)
          .map(
            (s) =>
              `${(s.html_instructions ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}${
                s.distance?.text ? ` (${s.distance.text})` : ""
              }`,
          )
          .filter(Boolean),
        enlace: enlaceRuta(textoDesde, hasta, transporte),
      };
    }
  }

  // Sin clave: se localizan los dos extremos y se da la distancia en línea
  // recta, diciendo que lo es. El enlace lleva a la ruta de verdad.
  const destino = await buscarSitio(hasta, typeof desde === "string" ? undefined : desde, signal);
  if (!destino?.punto) return null;

  const origen =
    typeof desde === "string" ? (await buscarSitio(desde, undefined, signal))?.punto : desde;
  if (!origen) return null;

  return {
    desde: typeof desde === "string" ? desde : "donde estás",
    hasta: destino.direccion ?? destino.nombre,
    transporte,
    km: distanciaKm(origen, destino.punto),
    exacto: false,
    enlace: enlaceRuta(textoDesde, destino.direccion ?? destino.nombre, transporte),
  };
}
