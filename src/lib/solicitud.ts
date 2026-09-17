/**
 * Una solicitud del formulario: qué es, qué vale y qué no.
 * ---------------------------------------------------------------------------
 * Es lógica pura: no toca la red ni la base de datos, así que la usan LAS DOS
 * PARTES. El navegador valida con esto para avisar antes de enviar, y el
 * servidor vuelve a validar con esto mismo porque la validación del navegador
 * es una cortesía, no una defensa: al `POST` se le puede llamar a mano.
 *
 * Los mensajes están escritos para leerse, no para depurarse. Nunca sale un
 * código ni un nombre de campo en inglés.
 */

export type Asunto = "catalogo" | "presupuesto" | "informacion";

export interface Solicitud {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  mensaje: string;
  asunto: Asunto;
  /** El producto por el que pregunta, si ha entrado desde una tarjeta. */
  producto?: string;
}

export const ASUNTOS: Record<Asunto, string> = {
  catalogo: "Solicitud de catálogo",
  presupuesto: "Solicitud de presupuesto",
  informacion: "Información general",
};

export const LIMITES = {
  nombre: 80,
  empresa: 100,
  email: 160,
  telefono: 32,
  mensaje: 2000,
  producto: 80,
};

/** Suficiente para descartar lo que no es un correo, sin pelearse con el resto. */
const CORREO = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

/** Un teléfono de verdad: dígitos, con prefijo o sin él. Vacío vale: es opcional. */
const TELEFONO = /^\+?[\d\s().-]{6,}$/;

export function esAsunto(v: unknown): v is Asunto {
  return v === "catalogo" || v === "presupuesto" || v === "informacion";
}

/**
 * Qué le pasa a cada campo, por su nombre. Vacío significa que está bien.
 *
 * Se devuelve un mapa y no un "primer error" porque el formulario los enseña
 * todos a la vez: corregir de uno en uno, enviando y fallando, es lo que hace
 * que alguien cierre la pestaña.
 */
export function errores(s: Partial<Solicitud>): Partial<Record<keyof Solicitud, string>> {
  const e: Partial<Record<keyof Solicitud, string>> = {};
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const nombre = texto(s.nombre);
  if (nombre.length < 2) e.nombre = "Dinos cómo te llamas.";
  else if (nombre.length > LIMITES.nombre) e.nombre = "El nombre es demasiado largo.";

  const empresa = texto(s.empresa);
  if (empresa.length < 2) e.empresa = "Dinos el nombre de tu empresa o tienda.";
  else if (empresa.length > LIMITES.empresa) e.empresa = "El nombre es demasiado largo.";

  const email = texto(s.email);
  if (!email) e.email = "Hace falta un correo para poder contestarte.";
  else if (email.length > LIMITES.email) e.email = "Ese correo es demasiado largo.";
  else if (!CORREO.test(email)) e.email = "Ese correo no parece completo. Revísalo.";

  const telefono = texto(s.telefono);
  if (telefono && !TELEFONO.test(telefono)) e.telefono = "Ese teléfono no parece correcto.";
  else if (telefono.length > LIMITES.telefono) e.telefono = "Ese teléfono es demasiado largo.";

  const mensaje = texto(s.mensaje);
  if (mensaje.length < 10) e.mensaje = "Cuéntanos un poco más: qué buscas y qué cantidad.";
  else if (mensaje.length > LIMITES.mensaje) e.mensaje = "El mensaje es demasiado largo.";

  if (s.asunto !== undefined && !esAsunto(s.asunto)) e.asunto = "Elige para qué escribes.";

  return e;
}

export function esValida(s: Partial<Solicitud>): boolean {
  return Object.keys(errores(s)).length === 0;
}

/**
 * Deja la solicitud lista para guardar: recortada, con el asunto puesto y sin
 * los saltos de línea de más que trae un móvil al pegar.
 */
export function limpiar(s: Partial<Solicitud>): Solicitud {
  const t = (v: unknown, max: number) =>
    (typeof v === "string" ? v : "").replace(/\r\n/g, "\n").trim().slice(0, max);

  return {
    nombre: t(s.nombre, LIMITES.nombre),
    empresa: t(s.empresa, LIMITES.empresa),
    email: t(s.email, LIMITES.email).toLowerCase(),
    telefono: t(s.telefono, LIMITES.telefono),
    mensaje: t(s.mensaje, LIMITES.mensaje),
    asunto: esAsunto(s.asunto) ? s.asunto : "informacion",
    producto: s.producto ? t(s.producto, LIMITES.producto) : undefined,
  };
}

/**
 * La solicitud escrita como la leería una persona en su correo.
 *
 * Va aparte del envío porque la usan los tres caminos de entrega —correo,
 * webhook y base de datos— y porque así se puede probar sin red.
 */
export function comoTexto(s: Solicitud, cuando = new Date()): string {
  const lineas = [
    `Asunto: ${ASUNTOS[s.asunto]}`,
    s.producto ? `Producto: ${s.producto}` : null,
    "",
    `Nombre: ${s.nombre}`,
    `Empresa: ${s.empresa}`,
    `Email: ${s.email}`,
    s.telefono ? `Teléfono: ${s.telefono}` : "Teléfono: no lo ha dejado",
    "",
    "Mensaje:",
    s.mensaje,
    "",
    `Recibido: ${cuando.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`,
  ];
  return lineas.filter((l) => l !== null).join("\n");
}
