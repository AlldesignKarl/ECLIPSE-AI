"use client";

/**
 * Cómo suena ECLIPSE cuando habla.
 *
 * Tres cosas que se eligen, y una que no. Se elige el TIMBRE —suave o clara—,
 * el IDIOMA y el RITMO. Lo que no se elige es el catálogo de voces: eso lo pone
 * el móvil, y de un Android a un iPhone no se parecen en nada. Así que en vez
 * de listar voces con nombres que no dicen nada —"Microsoft Helena Desktop"—,
 * se eligen dos caracteres y se busca en el aparato cuál se les parece más.
 *
 * Suave es una voz más grave y algo más lenta, de las que se escuchan bien de
 * noche. Clara es la más neutra y articulada, la que se entiende con ruido de
 * fondo. Son las dos formas en que la gente quiere que le hablen, y ponerle
 * nombre a eso vale más que una lista de treinta voces desconocidas.
 */

export type Timbre = "suave" | "clara";
export type Ritmo = "lento" | "normal" | "rapido";

export interface AjustesVoz {
  timbre: Timbre;
  /** Código de idioma completo, como `es-ES`. */
  idioma: string;
  ritmo: Ritmo;
}

export const VOZ_POR_DEFECTO: AjustesVoz = {
  timbre: "suave",
  idioma: "es-ES",
  ritmo: "normal",
};

export const GUARDADO = "eclipse.voz";

/** Los idiomas que se ofrecen. Los que de verdad se usan, no los 90 que hay. */
export const IDIOMAS: { id: string; nombre: string }[] = [
  { id: "es-ES", nombre: "Español (España)" },
  { id: "es-MX", nombre: "Español (Latinoamérica)" },
  { id: "en-US", nombre: "Inglés (EE. UU.)" },
  { id: "en-GB", nombre: "Inglés (Reino Unido)" },
  { id: "fr-FR", nombre: "Francés" },
  { id: "pt-BR", nombre: "Portugués (Brasil)" },
  { id: "it-IT", nombre: "Italiano" },
  { id: "de-DE", nombre: "Alemán" },
  { id: "ca-ES", nombre: "Catalán" },
  { id: "gl-ES", nombre: "Gallego" },
  { id: "eu-ES", nombre: "Euskera" },
];

export const RITMOS: { id: Ritmo; nombre: string; valor: number }[] = [
  { id: "lento", nombre: "Pausado", valor: 0.86 },
  { id: "normal", nombre: "Normal", valor: 1.04 },
  { id: "rapido", nombre: "Rápido", valor: 1.26 },
];

export function velocidadDe(ritmo: Ritmo): number {
  return RITMOS.find((r) => r.id === ritmo)?.valor ?? 1.04;
}

/** Suave habla un poco más grave; clara, un punto más alta y más marcada. */
export function tonoDe(timbre: Timbre): number {
  return timbre === "suave" ? 0.92 : 1.06;
}

/**
 * Qué voz del aparato se parece más a lo que se ha pedido.
 *
 * Primero las del idioma exacto; si no hay, las de la misma lengua aunque sea
 * de otro país —un español de México leyendo castellano se entiende de sobra, y
 * es infinitamente mejor que una voz inglesa leyendo español, que es lo que
 * pasa cuando no se filtra—. Dentro de las que quedan, se prefiere una de las
 * buenas: las que el sistema llama "premium", "enhanced" o las de Google suenan
 * a otro nivel que la de por defecto.
 */
export function elegirVoz(
  voces: { name: string; lang: string }[],
  ajustes: AjustesVoz,
): { name: string; lang: string } | null {
  if (!voces.length) return null;

  const idioma = ajustes.idioma.toLowerCase();
  const lengua = idioma.split("-")[0];
  const normal = (v: { lang: string }) => v.lang.toLowerCase().replace("_", "-");

  const exactas = voces.filter((v) => normal(v) === idioma);
  const mismaLengua = voces.filter((v) => normal(v).startsWith(`${lengua}-`) || normal(v) === lengua);
  const candidatas = exactas.length ? exactas : mismaLengua;
  if (!candidatas.length) return null;

  const buena = /google|premium|enhanced|natural|neural|siri/i;
  const conNombre = (re: RegExp) => candidatas.find((v) => re.test(v.name));

  // Para "suave" se buscan las voces de mujer que suelen ser más cálidas; para
  // "clara", cualquiera de las buenas. Es una aproximación, y por eso hay
  // respaldos: lo importante es que siempre salga una voz del idioma correcto.
  if (ajustes.timbre === "suave") {
    const suave = candidatas.find((v) => buena.test(v.name) && /female|mujer|helena|mónica|monica|paulina|sabina|lucía|lucia/i.test(v.name));
    if (suave) return suave;
  }

  return conNombre(buena) ?? candidatas[0];
}

export function leerAjustes(): AjustesVoz {
  try {
    const crudo = window.localStorage.getItem(GUARDADO);
    if (!crudo) return VOZ_POR_DEFECTO;
    const v = JSON.parse(crudo) as Partial<AjustesVoz>;
    return {
      timbre: v.timbre === "clara" ? "clara" : "suave",
      idioma: IDIOMAS.some((i) => i.id === v.idioma) ? (v.idioma as string) : VOZ_POR_DEFECTO.idioma,
      ritmo: RITMOS.some((r) => r.id === v.ritmo) ? (v.ritmo as Ritmo) : VOZ_POR_DEFECTO.ritmo,
    };
  } catch {
    return VOZ_POR_DEFECTO;
  }
}

export function guardarAjustes(ajustes: AjustesVoz): void {
  try {
    window.localStorage.setItem(GUARDADO, JSON.stringify(ajustes));
  } catch {
    /* se usa igual en esta sesión */
  }
}
