"use client";

import { irA } from "./movimiento";
import type { Asunto } from "@/lib/solicitud";

/**
 * "Quiero esto": del botón que se pulsa al formulario, sin pasar por React.
 * ---------------------------------------------------------------------------
 * Los botones de "Solicitar información" están repartidos por toda la página
 * —en cada tarjeta de producto, en la sección de por mayor, en la cabecera— y
 * el formulario está al final. Subir ese estado hasta la página obligaría a
 * convertir en cliente secciones enteras que hoy se pintan en el servidor y no
 * necesitan ni una línea de JavaScript.
 *
 * Un evento del navegador lo resuelve en diez líneas: quien pulsa lo lanza,
 * el formulario lo escucha. Y si el formulario no estuviera montado, el botón
 * sigue llevando a la sección de contacto igual.
 */

const EVENTO = "ak:pedir";

export interface Peticion {
  asunto: Asunto;
  /** El producto por el que se pregunta, si viene de una tarjeta. */
  producto?: string;
}

export function pedir(p: Peticion) {
  window.dispatchEvent(new CustomEvent<Peticion>(EVENTO, { detail: p }));
  irA("contacto");
}

/** Lo mismo desde una página sin formulario: lleva a la portada, al contacto. */
export function pedirDesdeFuera() {
  window.location.href = "/#contacto";
}

export function alPedir(escuchar: (p: Peticion) => void): () => void {
  const mano = (e: Event) => escuchar((e as CustomEvent<Peticion>).detail);
  window.addEventListener(EVENTO, mano);
  return () => window.removeEventListener(EVENTO, mano);
}
