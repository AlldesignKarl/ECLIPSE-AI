import type { Plan } from "./types";

/**
 * Los topes diarios, en un archivo sin nada de servidor.
 *
 * Viven aquí y no en `limites.ts` porque esa lee cookies y cabeceras, y eso
 * ata el archivo al servidor. Los números, en cambio, hacen falta en tres
 * sitios: al aplicarlos, al explicárselos a ECLIPSE y al enseñarlos en la
 * pantalla de planes. Con una sola tabla no puede haber dos verdades.
 */

export type Recurso = "chat" | "imagen" | "voz";

export const TOPES: Record<Plan, Record<Recurso, number>> = {
  free: { chat: 60, imagen: 12, voz: 40 },
  pro: { chat: 600, imagen: 120, voz: 400 },
};

export const NOMBRE: Record<Recurso, string> = {
  chat: "mensajes",
  imagen: "imágenes",
  voz: "notas de voz",
};

/** "60 mensajes, 12 imágenes y 40 notas de voz al día". */
export function textoTopes(plan: Plan): string {
  const t = TOPES[plan];
  return `${t.chat} mensajes, ${t.imagen} imágenes y ${t.voz} notas de voz al día`;
}
