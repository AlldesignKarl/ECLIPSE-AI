/**
 * El catálogo.
 * ---------------------------------------------------------------------------
 * Esto es lo ÚNICO que hay que tocar para cambiar los productos de la web: ni
 * un nombre de producto está escrito dentro de un componente. Añadir uno es
 * añadir una entrada aquí; el filtro de categorías, el orden de las tarjetas,
 * el botón de "Solicitar información" y los datos que lee Google salen solos.
 *
 * Las fichas que vienen de fábrica son EJEMPLOS con datos genéricos de oficio
 * (qué es, de qué material, en qué formato se sirve) y `imagen: null`. No son
 * el catálogo real de nadie: en cuanto haya fotos y referencias se sustituyen
 * aquí mismo. Mientras tanto, cada tarjeta pinta una lámina de color en vez de
 * un hueco gris, que es lo que distingue un borrador de un sitio sin acabar.
 */

/** El tinte de la lámina cuando todavía no hay fotografía. */
export type Tono = "oro" | "terracota" | "cielo" | "burdeos" | "azul";

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  /** Una línea. Es lo que se lee en la tarjeta. */
  descripcion: string;
  /** El detalle de oficio: material, acabado, formato de servicio. */
  detalle: string;
  /**
   * Ruta de la fotografía, p. ej. "/fotos/ceramica.webp" para un archivo
   * en `public/fotos/`. Con `null` se pinta la lámina de color.
   */
  imagen: string | null;
  tono: Tono;
  /** Se pinta primero y sale más grande en el mosaico. */
  destacado?: boolean;
}

export const CATEGORIAS = [
  "Cerámica",
  "Textil",
  "Papelería",
  "Gourmet",
  "Recuerdo",
] as const;

export const PRODUCTOS: Producto[] = [
  {
    id: "ceramica-pilar",
    nombre: "Colección Pilar",
    categoria: "Cerámica",
    descripcion:
      "Piezas de cerámica esmaltada con el motivo del manto, pintadas a mano una a una.",
    detalle: "Barro blanco · esmalte al agua · caja individual · mínimo 24 uds.",
    imagen: null,
    tono: "azul",
    destacado: true,
  },
  {
    id: "azulejo-pintado",
    nombre: "Azulejo pintado",
    categoria: "Cerámica",
    descripcion:
      "Azulejo de 15 × 15 decorado a mano, con soporte de madera o para colgar.",
    detalle: "Pintura bajo cubierta · apto para exterior · mínimo 36 uds.",
    imagen: null,
    tono: "cielo",
  },
  {
    id: "panuelo-mantilla",
    nombre: "Pañuelo de mantón",
    categoria: "Textil",
    descripcion:
      "Estampado inspirado en el mantón de flores, tejido y rematado en taller.",
    detalle: "Algodón peinado · dobladillo a mano · dos tamaños · mínimo 20 uds.",
    imagen: null,
    tono: "burdeos",
    destacado: true,
  },
  {
    id: "bolsa-lino",
    nombre: "Bolsa de lino serigrafiada",
    categoria: "Textil",
    descripcion:
      "Bolsa de lino crudo con serigrafía de la ciudad, pensada para tienda de museo.",
    detalle: "Lino 100 % · serigrafía al agua · personalizable con tu marca.",
    imagen: null,
    tono: "oro",
  },
  {
    id: "cuaderno-cosido",
    nombre: "Cuaderno cosido a mano",
    categoria: "Papelería",
    descripcion:
      "Cuadernos de costura vista con cubierta estampada y papel de gramaje alto.",
    detalle: "Cosido japonés · papel 120 g · tres formatos · mínimo 30 uds.",
    imagen: null,
    tono: "oro",
  },
  {
    id: "lamina-ilustrada",
    nombre: "Lámina ilustrada",
    categoria: "Papelería",
    descripcion:
      "Ilustraciones de la ciudad impresas en papel de algodón, firmadas y numeradas.",
    detalle: "Impresión giclée · papel 300 g · con o sin marco · series cortas.",
    imagen: null,
    tono: "cielo",
  },
  {
    id: "dulce-obrador",
    nombre: "Dulce de obrador",
    categoria: "Gourmet",
    descripcion:
      "Elaboración tradicional en estuche de regalo, lista para el lineal.",
    detalle: "Receta de obrador · estuche personalizable · etiquetado completo.",
    imagen: null,
    tono: "terracota",
    destacado: true,
  },
  {
    id: "conserva-tierra",
    nombre: "Conserva de la tierra",
    categoria: "Gourmet",
    descripcion:
      "Producto de temporada envasado en vidrio, con etiqueta diseñada a medida.",
    detalle: "Materia prima de proximidad · vidrio 212 ml · lote y caducidad.",
    imagen: null,
    tono: "terracota",
  },
  {
    id: "medalla-recuerdo",
    nombre: "Medalla y llavero",
    categoria: "Recuerdo",
    descripcion:
      "Piezas de recuerdo con acabado en metal noble, en expositor de mostrador.",
    detalle: "Zamak bañado · expositor incluido · mínimo 50 uds.",
    imagen: null,
    tono: "oro",
  },
  {
    id: "caja-regalo",
    nombre: "Caja de empresa",
    categoria: "Recuerdo",
    descripcion:
      "Lote de obsequio montado a medida: eliges las piezas y nosotros lo presentamos.",
    detalle: "Montaje a medida · tarjeta impresa con tu marca · sin mínimo fijo.",
    imagen: null,
    tono: "burdeos",
  },
];

/** Los que se pintan primero, para que el mosaico empiece fuerte. */
export function ordenados(categoria?: string): Producto[] {
  const lista = categoria
    ? PRODUCTOS.filter((p) => p.categoria === categoria)
    : PRODUCTOS;
  return [...lista].sort((a, b) => Number(!!b.destacado) - Number(!!a.destacado));
}
