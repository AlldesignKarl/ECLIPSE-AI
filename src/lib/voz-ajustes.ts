"use client";

/**
 * Cómo suena ECLIPSE cuando habla.
 *
 * Cuatro cosas que se eligen, y una que no. Se elige la VOZ —de mujer o de
 * hombre—, el TIMBRE —suave o clara—, el IDIOMA y el RITMO. Lo que no se elige
 * es el catálogo: las voces las pone el móvil, y de un Android a un iPhone no
 * se parecen en nada. Así que en vez de listar nombres que no dicen nada
 * —"Microsoft Helena Desktop"— se elige lo que uno quiere oír y se busca en el
 * aparato cuál se le parece más.
 *
 * Suave es una voz más grave y algo más lenta, de las que se escuchan bien de
 * noche. Clara es la más neutra y articulada, la que se entiende con ruido de
 * fondo.
 */

export type Voz = "mujer" | "hombre" | "cualquiera";
export type Timbre = "suave" | "clara";
export type Ritmo = "lento" | "normal" | "rapido";

export interface AjustesVoz {
  voz: Voz;
  timbre: Timbre;
  /** Código de idioma completo, como `es-ES`. */
  idioma: string;
  ritmo: Ritmo;
}

export const VOZ_POR_DEFECTO: AjustesVoz = {
  voz: "mujer",
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

export const VOCES: { id: Voz; nombre: string }[] = [
  { id: "mujer", nombre: "Mujer" },
  { id: "hombre", nombre: "Hombre" },
  { id: "cualquiera", nombre: "La mejor" },
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

/* -------------------------------------------------------------------------- */
/*                     Conocer las voces de cada aparato                      */
/* -------------------------------------------------------------------------- */

/**
 * Los nombres de voz que se sabe de quién son.
 *
 * Esto es una lista a mano porque no hay otra: la norma del navegador NO dice
 * si una voz es de hombre o de mujer. Lo único que hay es el nombre, así que
 * se reconocen los que de verdad trae la gente —los de Apple, los de Microsoft
 * y los de Google en español e inglés, que son el 95% de los aparatos— y para
 * el resto se buscan las palabras "female"/"male" que muchos fabricantes sí
 * ponen.
 *
 * Que no se reconozca un nombre no rompe nada: se usa la mejor voz del idioma
 * y se avisa en la pantalla de que ese móvil no tiene las dos.
 */
const MUJERES =
  /\b(female|femenina|mujer|woman|m[oó]nica|paulina|marisol|helena|elvira|esperanza|conchita|lucia|luc[ií]a|sabina|ximena|dalia|lupe|pen[eé]lope|laura|elena|carmen|in[eé]s|samantha|karen|moira|tessa|fiona|victoria|allison|ava|susan|zira|aria|jenny|michelle|nora|amelie|am[eé]lie|anna|katja|alice|luciana|joana|ines|catherine|serena|kyoko|yuna|milena|zosia|ioana)\b/i;

const HOMBRES =
  /\b(male|masculina|hombre|man|jorge|diego|enrique|carlos|juan|pablo|[aá]lvaro|miguel|ra[uú]l|andr[eé]s|crist[oó]bal|alex|daniel|fred|tom|oliver|thomas|david|mark|guy|ryan|brian|aaron|arthur|gordon|rishi|reed|eddy|grandpa|yannick|thorsten|conrad|luca|felipe|ricardo|matthew|justin|joey)\b/i;

/**
 * El apaño para las voces de Google, que no llevan nombre de persona.
 *
 * Android las llama `es-es-x-eed-local` y Google Cloud `es-ES-Standard-A`. En
 * los dos casos la letra final alterna: A y C son de mujer, B y D de hombre.
 * No es una promesa de nadie, así que va la última, después de todo lo demás.
 */
function porLetraDeGoogle(nombre: string): Voz | null {
  const m = /-(?:standard|wavenet|neural2|news|polyglot|studio)-([a-f])\b/i.exec(nombre);
  if (!m) return null;
  return /[ace]/i.test(m[1]) ? "mujer" : "hombre";
}

/** ¿De quién parece esta voz? `null` si no hay forma de saberlo. */
export function vozDe(nombre: string): Voz | null {
  if (MUJERES.test(nombre)) return "mujer";
  if (HOMBRES.test(nombre)) return "hombre";
  return porLetraDeGoogle(nombre);
}

/**
 * Cómo de bien suena, a ojo.
 *
 * Las voces han mejorado muchísimo, pero conviven con las de hace quince años
 * en el mismo aparato: si no se elige, toca la vieja tan a menudo como la
 * buena. Se puntúan las señales que las distinguen —"neural", "premium", que
 * sea de Google, que no sea local (las de red suenan mejor)— y se coge la de
 * más puntos. Es la diferencia entre sonar a GPS de 2010 y sonar a persona.
 */
export function calidadDe(voz: { name: string; localService?: boolean }): number {
  const n = voz.name;
  let puntos = 0;
  if (/neural|natural/i.test(n)) puntos += 6;
  if (/premium|enhanced|siri/i.test(n)) puntos += 5;
  if (/wavenet|studio|polyglot/i.test(n)) puntos += 5;
  if (/google/i.test(n)) puntos += 3;
  // Las de red suenan mejor que las que trae el aparato dentro. Se nota sobre
  // todo en Android, donde la local es la de toda la vida.
  if (voz.localService === false) puntos += 2;
  if (/compact|eloquence|espeak|pico/i.test(n)) puntos -= 6;
  return puntos;
}

export interface VozDelAparato {
  name: string;
  lang: string;
  localService?: boolean;
}

/** Del idioma pedido; y si no hay, de la misma lengua aunque sea de otro país. */
function delIdioma(voces: VozDelAparato[], idioma: string): VozDelAparato[] {
  const pedido = idioma.toLowerCase();
  const lengua = pedido.split("-")[0];
  const normal = (v: VozDelAparato) => v.lang.toLowerCase().replace("_", "-");

  const exactas = voces.filter((v) => normal(v) === pedido);
  if (exactas.length) return exactas;
  // Un español de México leyendo castellano se entiende de sobra, y es
  // infinitamente mejor que una voz inglesa leyendo español, que es lo que
  // pasa cuando no se filtra.
  return voces.filter((v) => normal(v).startsWith(`${lengua}-`) || normal(v) === lengua);
}

/** ¿Tiene este aparato voz de mujer y de hombre en este idioma? */
export function loQueHay(voces: VozDelAparato[], idioma: string): { mujer: boolean; hombre: boolean } {
  const candidatas = delIdioma(voces, idioma);
  return {
    mujer: candidatas.some((v) => vozDe(v.name) === "mujer"),
    hombre: candidatas.some((v) => vozDe(v.name) === "hombre"),
  };
}

/**
 * Qué voz del aparato se parece más a lo que se ha pedido.
 *
 * Por orden: del idioma correcto, de quien se ha pedido, y de las que quedan,
 * la que mejor suene. Si en ese idioma no hay voz de quien se pidió, se usa la
 * mejor que haya: quedarse mudo por no tener voz de hombre en gallego sería
 * absurdo, y la pantalla ya avisa de lo que hay.
 */
export function elegirVoz(voces: VozDelAparato[], ajustes: AjustesVoz): VozDelAparato | null {
  if (!voces.length) return null;

  const candidatas = delIdioma(voces, ajustes.idioma);
  if (!candidatas.length) return null;

  const mejor = (lista: VozDelAparato[]) =>
    [...lista].sort((a, b) => calidadDe(b) - calidadDe(a))[0];

  if (ajustes.voz !== "cualquiera") {
    const suyas = candidatas.filter((v) => vozDe(v.name) === ajustes.voz);
    if (suyas.length) return mejor(suyas);
  }

  return mejor(candidatas);
}

export function leerAjustes(): AjustesVoz {
  try {
    const crudo = window.localStorage.getItem(GUARDADO);
    if (!crudo) return VOZ_POR_DEFECTO;
    const v = JSON.parse(crudo) as Partial<AjustesVoz>;
    return {
      voz: VOCES.some((o) => o.id === v.voz) ? (v.voz as Voz) : VOZ_POR_DEFECTO.voz,
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
