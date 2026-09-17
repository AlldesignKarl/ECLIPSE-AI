/**
 * Todos los datos de la empresa, en un solo archivo.
 * ---------------------------------------------------------------------------
 * La web corporativa no tiene ni un teléfono ni un correo escritos por dentro:
 * los saca de aquí. Cambiar este archivo cambia la web entera —cabecera, pie,
 * botones de WhatsApp, enlaces del formulario y los datos que ve Google—, y no
 * hace falta tocar ni un componente.
 *
 * Lo que todavía NO sabemos no se inventa. Va como `null` (los enlaces que
 * dependen de ello simplemente no se pintan) o entre corchetes, que se ve a la
 * primera. `loQueFalta()` los reúne y `AvisoDeDatos` lo canta EN DESARROLLO,
 * nunca en producción: así no se publica un dato de mentira sin que nadie se
 * entere.
 */

/** Un dato que hay que rellenar. Se marcan así para poder listarlos. */
export const PENDIENTE = null;

export interface Redes {
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
}

export const EMPRESA = {
  /** El nombre comercial. Lo eligió Carlos. */
  nombre: "AlldesignKarl",
  /** La versión corta, la del logotipo. Aquí es la misma. */
  nombreCorto: "AlldesignKarl",
  /**
   * Las dos letras del sello. Escritas y no deducidas: de "AlldesignKarl"
   * saldría "AL", y las iniciales que dice el nombre son Alldesign + Karl.
   */
  monograma: "AK",

  /** La frase de la portada. Esta la eligió Carlos. */
  reclamo: "Tradición que llega más lejos.",
  /** Una línea para buscadores y para el pie. */
  descripcion:
    "Elaboración y distribución al por mayor de producto artesanal de Zaragoza: series cortas, hechas a mano, para tiendas, distribuidores y empresas.",

  /** ⚠️ SUSTITUIR: correo de pedidos y presupuestos. */
  email: PENDIENTE as string | null,
  /** ⚠️ SUSTITUIR: teléfono en formato internacional, p. ej. "+34 976 000 000". */
  telefono: PENDIENTE as string | null,
  /**
   * ⚠️ SUSTITUIR: el número de WhatsApp SOLO con dígitos y prefijo de país,
   * p. ej. "34600000000". Es lo que pide wa.me; con espacios o "+" no abre.
   */
  whatsapp: PENDIENTE as string | null,

  /** ⚠️ SUSTITUIR: calle y número del taller o del almacén. */
  direccion: PENDIENTE as string | null,
  ciudad: "Zaragoza, España",
  /** ⚠️ SUSTITUIR: horario de atención comercial. */
  horario: PENDIENTE as string | null,

  redes: {
    instagram: PENDIENTE,
    facebook: PENDIENTE,
    linkedin: PENDIENTE,
  } as Redes,

  /**
   * Lo que exige la ley de servicios de la sociedad de la información (LSSI)
   * para el aviso legal. Sin estos datos la web no se puede publicar como
   * tienda B2B, así que están aquí y no perdidos dentro de una página.
   */
  legal: {
    razonSocial: PENDIENTE as string | null,
    cif: PENDIENTE as string | null,
    domicilioSocial: PENDIENTE as string | null,
    registroMercantil: PENDIENTE as string | null,
    /** Correo para ejercer los derechos de protección de datos. */
    emailPrivacidad: PENDIENTE as string | null,
  },
} as const;

/** Las dos letras del sello. Del monograma si lo hay; si no, del nombre. */
export function monograma(): string {
  if (EMPRESA.monograma) return EMPRESA.monograma;
  // Del nombre corto —el del logotipo— y sin signos: si un día se cambia por un
  // marcador entre corchetes, las iniciales de los corchetes darían dos letras
  // que no significan nada y que encima parecerían de verdad.
  const limpio = EMPRESA.nombreCorto.replace(/[^\p{L}\s]/gu, "").trim();
  const palabras = limpio ? limpio.split(/\s+/) : [];
  const iniciales = palabras.length > 1 ? palabras.map((p) => p[0]).join("") : limpio.slice(0, 2);
  return (iniciales || "AR").slice(0, 2).toUpperCase();
}

/* --------------------------- Enlaces que funcionan ------------------------ */

/**
 * El `mailto:` con asunto y cuerpo ya escritos.
 *
 * Un botón que pone "Solicitar catálogo" y abre un correo en blanco deja el
 * trabajo a quien iba a comprar. Con el asunto puesto, el cliente solo escribe
 * lo suyo, y el correo llega clasificado.
 */
export function enlaceCorreo(asunto?: string, cuerpo?: string): string | null {
  if (!EMPRESA.email) return null;
  const partes: string[] = [];
  if (asunto) partes.push(`subject=${encodeURIComponent(asunto)}`);
  if (cuerpo) partes.push(`body=${encodeURIComponent(cuerpo)}`);
  return `mailto:${EMPRESA.email}${partes.length ? `?${partes.join("&")}` : ""}`;
}

/** `tel:` sin espacios: con ellos, algunos móviles no marcan. */
export function enlaceTelefono(): string | null {
  if (!EMPRESA.telefono) return null;
  return `tel:${EMPRESA.telefono.replace(/[^\d+]/g, "")}`;
}

/** WhatsApp con el primer mensaje escrito. `wa.me` abre la app si está. */
export function enlaceWhatsApp(texto?: string): string | null {
  if (!EMPRESA.whatsapp) return null;
  const numero = EMPRESA.whatsapp.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/* ------------------------------ Lo que falta ------------------------------ */

/**
 * Qué datos siguen sin rellenar.
 *
 * Solo se enseña en desarrollo. En producción no aparece por ningún lado: es
 * una nota para quien monta la web, no para quien la visita.
 */
export function loQueFalta(): string[] {
  const falta: string[] = [];
  const marcado = (v: string | null | undefined) => !v || /^\[.*\]$/.test(v);

  if (marcado(EMPRESA.nombre)) falta.push("nombre de la empresa");
  if (marcado(EMPRESA.nombreCorto)) falta.push("nombre corto (logotipo)");
  if (marcado(EMPRESA.email)) falta.push("email");
  if (marcado(EMPRESA.telefono)) falta.push("teléfono");
  if (marcado(EMPRESA.whatsapp)) falta.push("WhatsApp");
  if (marcado(EMPRESA.direccion)) falta.push("dirección");
  if (marcado(EMPRESA.horario)) falta.push("horario");
  if (!EMPRESA.redes.instagram && !EMPRESA.redes.facebook && !EMPRESA.redes.linkedin)
    falta.push("redes sociales");
  if (marcado(EMPRESA.legal.razonSocial)) falta.push("razón social");
  if (marcado(EMPRESA.legal.cif)) falta.push("CIF");
  if (marcado(EMPRESA.legal.domicilioSocial)) falta.push("domicilio social");
  if (marcado(EMPRESA.legal.emailPrivacidad)) falta.push("email de privacidad");

  return falta;
}

/** La dirección pública de la web corporativa (para canónicos y Schema.org). */
export const RUTA_BASE = "/artesania";
