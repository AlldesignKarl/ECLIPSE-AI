/**
 * La ubicación, en el lado del navegador.
 *
 * Tres reglas, y las tres son del usuario:
 *
 * 1. No se pide nada hasta que lo enciende en Ajustes. El navegador enseña su
 *    propio permiso encima, así que nadie acaba compartiendo su sitio sin
 *    haber dicho que sí dos veces.
 * 2. Se redondea a tres decimales antes de que salga del móvil. Eso es un
 *    kilómetro escaso: bastante para saber en qué ciudad estás y para medir
 *    distancias, insuficiente para saber en qué calle vives.
 * 3. No se guarda en el servidor. Viaja con el mensaje, se usa para contestar
 *    y se va. Aquí se recuerda un rato para no estar pidiendo el GPS cada vez
 *    que se escribe, y al apagarlo se borra.
 */

export type PermisoUbicacion = "si" | "no";

export const GUARDADO = "eclipse.ubicacion";
const CACHE = "eclipse.ubicacion.ultima";

/** Cuánto vale lo último que se supo antes de volver a preguntarle al GPS. */
export const CADUCA_MS = 30 * 60 * 1000;

export interface Ubicacion {
  lat: number;
  lon: number;
  /** "Zaragoza, Aragón, España". Lo resuelve el servidor una vez. */
  lugar?: string;
  /** Cuándo se supo, en milisegundos. */
  momento: number;
}

/** A tres decimales: ~110 metros en latitud, menos aún en longitud. */
export function redondear(lat: number, lon: number): { lat: number; lon: number } {
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 };
}

export function permiso(): PermisoUbicacion {
  try {
    return window.localStorage.getItem(GUARDADO) === "si" ? "si" : "no";
  } catch {
    return "no";
  }
}

/** ¿Este navegador sabe dónde está? En un escritorio viejo, puede que no. */
export function sePuede(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function ultima(): Ubicacion | null {
  try {
    const crudo = window.localStorage.getItem(CACHE);
    if (!crudo) return null;
    const u = JSON.parse(crudo) as Ubicacion;
    if (typeof u?.lat !== "number" || typeof u?.lon !== "number") return null;
    return u;
  } catch {
    return null;
  }
}

function recordar(u: Ubicacion): void {
  try {
    window.localStorage.setItem(CACHE, JSON.stringify(u));
  } catch {
    /* sin almacenamiento se vuelve a preguntar, que tampoco es grave */
  }
}

/** Apagarlo borra lo que se sabía. Apagar algo que deja rastro no es apagarlo. */
export function olvidar(): void {
  try {
    window.localStorage.removeItem(CACHE);
  } catch {
    /* nada que borrar */
  }
}

export function guardarPermiso(p: PermisoUbicacion): void {
  try {
    window.localStorage.setItem(GUARDADO, p);
  } catch {
    /* se aplica igual en esta sesión */
  }
  if (p === "no") olvidar();
}

/**
 * Preguntarle al navegador dónde estamos.
 *
 * Con `timeout` corto a propósito: esto va colgado del envío de un mensaje, y
 * un GPS que tarda veinte segundos convierte "hola" en una espera absurda. Si
 * no llega a tiempo se manda el mensaje sin ubicación, que es lo de siempre.
 */
export function preguntarAlNavegador(msEspera = 8000): Promise<{ lat: number; lon: number } | null> {
  if (!sePuede()) return Promise.resolve(null);
  return new Promise((resolver) => {
    let contestado = false;
    const responder = (v: { lat: number; lon: number } | null) => {
      if (contestado) return;
      contestado = true;
      resolver(v);
    };
    // Red de seguridad: hay navegadores que no llaman a ninguna de las dos
    // funciones si el usuario deja el diálogo del permiso abierto y se va.
    const reloj = setTimeout(() => responder(null), msEspera + 1000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(reloj);
        responder(redondear(p.coords.latitude, p.coords.longitude));
      },
      () => {
        clearTimeout(reloj);
        responder(null);
      },
      { enableHighAccuracy: false, timeout: msEspera, maximumAge: CADUCA_MS },
    );
  });
}

/** Traducir coordenadas a un nombre. Lo hace el servidor, que tiene el mapa. */
async function nombreDelSitio(lat: number, lon: number): Promise<string | undefined> {
  try {
    const res = await fetch("/api/lugar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { lugar?: string };
    return json.lugar || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lo que se manda con el mensaje.
 *
 * Devuelve `null` en cuanto algo no está: sin permiso, sin navegador que lo
 * sepa, o sin respuesta a tiempo. Nunca espera lo suficiente como para que se
 * note al enviar.
 */
export async function paraElMensaje(ahora = Date.now()): Promise<Ubicacion | null> {
  if (permiso() !== "si") return null;

  const guardada = ultima();
  if (guardada && ahora - guardada.momento < CADUCA_MS) return guardada;

  const punto = await preguntarAlNavegador();
  if (!punto) return guardada; // lo de antes sirve más que nada

  // El nombre solo se vuelve a pedir si nos hemos movido de verdad; entre dos
  // mensajes desde el sofá no hace falta molestar al servicio de mapas.
  const lejos = !guardada || Math.abs(guardada.lat - punto.lat) > 0.05 || Math.abs(guardada.lon - punto.lon) > 0.05;
  const lugar = lejos ? await nombreDelSitio(punto.lat, punto.lon) : guardada?.lugar;

  const nueva: Ubicacion = { ...punto, lugar, momento: ahora };
  recordar(nueva);
  return nueva;
}
