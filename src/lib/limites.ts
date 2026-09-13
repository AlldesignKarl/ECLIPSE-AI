import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { currentUser } from "./auth";
import { NOMBRE, TOPES, type Recurso } from "./limites-tabla";
import { storeAvailable, StoreError } from "./store";
import type { Plan } from "./types";

/**
 * Cuánto puede gastar cada persona al día.
 *
 * ECLIPSE responde con las claves del servidor, no con las de cada visitante.
 * Eso es lo que hace que se pueda usar sin configurar nada, y también lo que
 * la deja expuesta: una sola persona con un bucle agota la cuota gratuita del
 * día y entonces la aplicación deja de funcionar PARA TODOS. No hace falta
 * mala intención, basta una pestaña olvidada pidiendo imágenes.
 *
 * Así que se cuenta lo que gasta cada uno. El contador vive en el mismo Redis
 * de las cuentas y caduca solo al acabar el día.
 */

export type { Recurso };

export function topeDiario(plan: Plan, recurso: Recurso): number {
  return TOPES[plan][recurso];
}

/**
 * Quién es esta persona, a efectos de contar.
 *
 * Con sesión, su correo; sin ella, la IP. Ninguna de las dos se guarda tal
 * cual: lo que va a la base de datos es un hash con sal, que sirve igual para
 * contar y no deja una lista de correos ni de direcciones de nadie.
 *
 * La IP se mira en `x-forwarded-for`, que es lo que pone el proxy de Vercel
 * delante. La cabecera es falsificable —quien quiera saltarse el límite puede
 * inventarse una—, pero eso no la hace inútil: frena el caso real, que es el
 * bucle accidental y el curioso, sin molestar a nadie.
 */
async function quien(): Promise<string> {
  const usuario = await currentUser();
  if (usuario) return huella(`u:${usuario}`);

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "desconocida";
  return huella(`ip:${ip}`);
}

function huella(valor: string): string {
  return createHash("sha256").update(`eclipse:limites:${valor}`).digest("hex").slice(0, 24);
}

/** El día de hoy en UTC, que es cuando se reinician los contadores. */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface Veredicto {
  permitido: boolean;
  /** Cuántos le quedan después de esta. */
  restantes: number;
  /** Qué contarle a la persona cuando se le acaban. */
  mensaje?: string;
}

/**
 * Suma uno al contador y dice si puede seguir.
 *
 * Se cuenta ANTES de gastar, no después: contar después significa que la
 * petición que revienta el límite sí se paga. Y se hace con INCR, que es
 * atómico, porque leer-sumar-escribir por separado deja pasar de más a quien
 * manda varias peticiones a la vez, que es justo el caso del que nos estamos
 * defendiendo.
 *
 * Sin base de datos configurada no hay límite. Es una decisión: un servidor a
 * medio montar tiene que seguir sirviendo la aplicación, no dejar de responder.
 */
export async function gastar(recurso: Recurso, plan: Plan): Promise<Veredicto> {
  const tope = TOPES[plan][recurso];
  if (!storeAvailable()) return { permitido: true, restantes: tope };

  try {
    const clave = `lim:${hoy()}:${recurso}:${await quien()}`;
    const usados = await incrementarConCaducidad(clave);

    if (usados > tope)
      return {
        permitido: false,
        restantes: 0,
        mensaje:
          plan === "pro"
            ? `Has llegado al límite diario de ${tope} ${NOMBRE[recurso]}. Se reinicia a medianoche.`
            : `Has gastado las ${tope} ${NOMBRE[recurso]} de hoy del plan Gratis. Se reinician a medianoche, y con el plan Pro tienes diez veces más.`,
      };

    return { permitido: true, restantes: tope - usados };
  } catch (err) {
    // Si la base de datos falla, se deja pasar. Quedarse sin contador es un
    // problema; dejar a todo el mundo sin aplicación por eso, uno mayor.
    if (err instanceof StoreError) return { permitido: true, restantes: tope };
    throw err;
  }
}

/**
 * `INCR` y, la primera vez, `EXPIRE`. Van en una sola ida y vuelta con el
 * pipeline de Upstash: dos peticiones HTTP por cada mensaje se notarían.
 */
async function incrementarConCaducidad(clave: string): Promise<number> {
  const { pipeline } = await import("./store");
  const [usados] = await pipeline<[number, number]>([
    ["INCR", clave],
    // 36 horas: cubre el día de sobra con cualquier huso horario.
    ["EXPIRE", clave, 129600, "NX"],
  ]);
  return usados;
}
