import { credencialesDe } from "./almacen";
import { ErrorConexion } from "./http";
import { github } from "./github";
import { ionos } from "./ionos";
import { mercados } from "./mercados";
import { notion } from "./notion";
import { shopify } from "./shopify";
import { stripe } from "./stripe";
import { telegram } from "./telegram";
import type { EstadoConexion, Permiso, Servicio } from "./tipos";
import { wix } from "./wix";
import { woocommerce } from "./woocommerce";

/**
 * El catálogo de servicios a los que ECLIPSE se puede conectar.
 *
 * Añadir uno es escribir su archivo y meterlo en esta lista. Ni la pantalla de
 * Conexiones, ni la API, ni la herramienta que usa el modelo saben cuántos hay
 * ni cuáles son: todo sale de aquí.
 */
export const SERVICIOS: Servicio[] = [
  shopify,
  woocommerce,
  wix,
  ionos,
  notion,
  github,
  stripe,
  telegram,
  mercados,
];

export function servicioDe(id: string): Servicio | undefined {
  return SERVICIOS.find((s) => s.id === id);
}

/**
 * ¿Este servicio puede llegar a escribir?
 *
 * Sale de sus propias acciones, no de una lista aparte que se quedaría vieja.
 * Los mercados no tienen ninguna acción que escriba —a propósito, ahí no se
 * ponen órdenes— así que a Binance ni siquiera se le puede dar el permiso.
 */
export function admiteEscritura(servicio: Servicio): boolean {
  return servicio.acciones.some((a) => a.escribe);
}

export function accionDe(servicio: Servicio, nombre: string) {
  return servicio.acciones.find((a) => a.nombre === nombre);
}

/** Lo que se le enseña al navegador: todo menos las claves. */
export function estadoDe(
  servicio: Servicio,
  conectada?: { cuenta: string; permiso: Permiso; conectadoEl: number },
): EstadoConexion {
  return {
    id: servicio.id,
    nombre: servicio.nombre,
    color: servicio.color,
    marca: servicio.marca,
    familia: servicio.familia,
    resumen: servicio.resumen,
    pasos: servicio.pasos,
    enlace: servicio.enlace,
    campos: servicio.campos,
    conectado: Boolean(conectada),
    cuenta: conectada?.cuenta,
    permiso: conectada?.permiso,
    conectadoEl: conectada?.conectadoEl,
    acciones: servicio.acciones.map((a) => ({
      nombre: a.nombre,
      descripcion: a.descripcion,
      escribe: Boolean(a.escribe),
    })),
  };
}

/**
 * ¿Se puede hacer esto, con el permiso que hay dado?
 *
 * Aparte y sin red por medio, para que la regla que de verdad protege la cuenta
 * de alguien se pueda comprobar sola, sin levantar media aplicación. Es la
 * única que separa "ECLIPSE mira tu tienda" de "ECLIPSE cambia tu tienda".
 */
export function puedeHacer(
  servicio: Servicio,
  accion: string,
  permiso: Permiso,
): { ok: true } | { ok: false; error: string } {
  const cual = accionDe(servicio, accion);
  if (!cual)
    return {
      ok: false,
      error: `"${accion}" no es una acción de ${servicio.nombre}. Las que hay: ${servicio.acciones
        .map((a) => a.nombre)
        .join(", ")}.`,
    };

  if (cual.escribe && permiso !== "escribir")
    return {
      ok: false,
      error: `${servicio.nombre} está conectado en SOLO LECTURA, así que "${accion}" no se puede hacer. Dile al usuario que, si quiere, lo cambie en Conexiones → ${servicio.nombre} → dejar que haga cambios. No insistas ni lo intentes por otro camino.`,
    };

  return { ok: true };
}

export interface Peticion {
  servicio: string;
  accion: string;
  datos?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * Ejecutar una acción sobre la cuenta de alguien.
 *
 * Este es el único sitio por donde se pasa, y por eso las comprobaciones están
 * aquí y no repartidas: que el servicio exista, que esté conectado, que la
 * acción exista, y —la que importa— que si la acción escribe, el usuario haya
 * dado ese permiso a propósito.
 *
 * Nunca devuelve la credencial ni la deja asomar en un mensaje de error. Lo
 * que sale de aquí es texto para el modelo, y el modelo no tiene por qué saber
 * con qué clave se ha hecho nada.
 */
export async function ejecutarConexion({
  servicio: idServicio,
  accion: idAccion,
  datos = {},
  signal,
}: Peticion): Promise<{ texto: string; error?: string }> {
  const servicio = servicioDe(idServicio);
  if (!servicio)
    return {
      texto: "",
      error: `No existe ninguna conexión llamada "${idServicio}". Las que hay: ${SERVICIOS.map(
        (s) => s.id,
      ).join(", ")}.`,
    };

  const guardada = await credencialesDe(servicio.id);
  if (!guardada)
    return {
      texto: "",
      error: `${servicio.nombre} no está conectado. El usuario tiene que conectarlo desde Conexiones, en el menú.`,
    };

  const permitido = puedeHacer(servicio, idAccion, guardada.permiso);
  if (!permitido.ok) return { texto: "", error: permitido.error };

  const accion = accionDe(servicio, idAccion)!;

  try {
    const texto = await accion.ejecutar({ cred: guardada.cred, args: datos, signal });
    return { texto };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return {
      texto: "",
      error:
        err instanceof ErrorConexion
          ? err.message
          : `${servicio.nombre} ha fallado: ${
              err instanceof Error ? err.message : "motivo desconocido"
            }`,
    };
  }
}
