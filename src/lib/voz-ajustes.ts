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
  /**
   * Una voz concreta del aparato, elegida a mano y por el oído.
   *
   * Existe porque adivinar falla más de lo que parece. En un Android las voces
   * se llaman `es-es-x-eed-local`: ahí no hay nombre de persona, ni "female",
   * ni nada de donde deducir de quién es. Con eso, pedir "hombre" o "mujer"
   * devolvía LA MISMA VOZ las dos veces, y desde fuera lo que se ve es que el
   * botón no hace nada. Elegir la que suena bien escuchándolas siempre
   * funciona, en cualquier móvil y sin adivinar nada.
   */
  vozExacta?: string;
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

/**
 * El tono de verdad, contando con lo que este móvil TIENE.
 *
 * Esto es lo que arregla el "pongo hombre y sigue sonando la de mujer".
 *
 * La causa no estaba en el código que elige: estaba en el aparato. Muchos
 * móviles traen UNA sola voz por idioma —el de Carlos tiene una en castellano—,
 * así que pedir "hombre" y pedir "mujer" devolvían forzosamente la misma, y
 * desde fuera lo que se ve es un botón que no hace nada.
 *
 * Con una sola voz no se puede traer otra persona, pero sí se puede cambiar
 * cómo suena: bajarle el tono de verdad si se pidió hombre, subirlo si se pidió
 * mujer. No es un actor distinto, pero se oye distinto a la primera sílaba, que
 * es lo que se estaba pidiendo.
 *
 * Y cuando el móvil SÍ tiene las dos voces no se toca nada, porque ahí el
 * cambio de voz ya se nota y el tono solo estropearía una voz buena. Lo mismo
 * si se ha elegido una a mano: esa la ha elegido el oído, y el oído gana.
 *
 * El desplazamiento es grande a propósito. Con un 5% no se nota, y una opción
 * que no se nota es una opción rota.
 */
export function tonoPara(ajustes: AjustesVoz, voces: VozDelAparato[]): number {
  const base = tonoDe(ajustes.timbre);
  if (ajustes.voz === "cualquiera" || ajustes.vozExacta) return base;

  /*
    La pregunta correcta no es "¿hay voz de hombre?", es "¿suena distinto?".

    Se comprueba ejecutando lo que de verdad va a pasar: qué voz saldría
    pidiendo hombre y cuál pidiendo mujer. Si son la MISMA —el móvil solo tiene
    una, o no sabe de quién es ninguna— el botón por sí solo no puede cambiar
    nada y hay que mover el tono. Si son distintas, ya se nota y no se toca.

    Preguntarlo así evita fiarse de adivinar el género por el nombre, que en un
    Android es una letra de un código (`es-es-x-eed-local`) y acierta a medias.
    Ahí estaba el "pongo hombre y suena la de mujer": se daba por buena una
    suposición y encima se dejaba de hacer lo único que sí se podía hacer.
  */
  const conHombre = elegirVoz(voces, { ...ajustes, voz: "hombre", vozExacta: undefined });
  const conMujer = elegirVoz(voces, { ...ajustes, voz: "mujer", vozExacta: undefined });
  if (conHombre && conMujer && conHombre.name !== conMujer.name) return base;

  const movido = ajustes.voz === "hombre" ? base * 0.62 : base * 1.38;
  return Math.min(1.9, Math.max(0.4, Number(movido.toFixed(3))));
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
 * Son dos formas distintas de lo mismo. Google Cloud las llama
 * `es-ES-Standard-A` y Android `es-es-x-eed-local`. En las dos, la última letra
 * del código alterna entre una voz y otra, así que sirve para repartirlas en
 * dos grupos y que "hombre" y "mujer" al menos suenen DISTINTO, que es lo que
 * fallaba: sin esto, las dos opciones devolvían la misma voz y el botón parecía
 * roto.
 *
 * No es una promesa de nadie —Google no publica de quién es cada una—, así que
 * va la última, después de todo lo demás, y por eso existe también la lista de
 * voces a mano: lo que de verdad acierta es el oído de quien escucha.
 */
function porLetraDeGoogle(nombre: string): Voz | null {
  const nube = /-(?:standard|wavenet|neural2|news|polyglot|studio|chirp\d?[a-z-]*)-([a-z])\b/i.exec(nombre);
  if (nube) return /[ace]/i.test(nube[1]) ? "mujer" : "hombre";

  // Android: es-es-x-eed-local → la letra que cuenta es la última del código.
  const android = /-x-[a-z]{2}([a-z])(?:-(?:local|network))?$/i.exec(nombre.trim());
  if (android) return /[aceg]/i.test(android[1]) ? "mujer" : "hombre";

  return null;
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
  if (/wavenet|studio|polyglot|chirp/i.test(n)) puntos += 5;
  /*
    Las de red, muy por encima de todo lo demás.

    Es la diferencia que de verdad se oye en un Android: la voz `-local` es la
    de hace quince años, la que suena a GPS, y la `-network` es la que suena a
    persona. Las dos están instaladas en el mismo móvil y con el mismo nombre
    salvo esa palabra, así que si no se mira, toca la mala la mitad de las
    veces.
  */
  if (/-network\b/i.test(n)) puntos += 8;
  if (/-local\b/i.test(n)) puntos -= 3;
  if (/google/i.test(n)) puntos += 3;
  if (voz.localService === false) puntos += 3;
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

/**
 * Las voces del idioma pedido, de la que mejor suena a la que peor.
 *
 * Para poder enseñarlas y que se elija por el oído, que es lo único que no
 * falla nunca.
 */
export function vocesDelIdioma(voces: VozDelAparato[], idioma: string): VozDelAparato[] {
  return [...delIdioma(voces, idioma)].sort((a, b) => calidadDe(b) - calidadDe(a));
}

/**
 * El nombre de una voz, dicho para una persona.
 *
 * `es-es-x-eed-network` no le dice nada a nadie. "Voz 4 · suena mejor" sí.
 */
export function nombreDeVoz(voz: VozDelAparato, numero: number): string {
  const n = voz.name;
  // Las que ya tienen nombre de persona se dejan como están: "Mónica" se
  // entiende mejor que cualquier cosa que pongamos nosotros.
  const bonito = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(n) && !/^[a-z]{2}-[a-z]{2}-/i.test(n)
    ? n
    : `Voz ${numero}`;

  const quien = vozDe(n);
  const pistas = [
    quien === "mujer" ? "mujer" : quien === "hombre" ? "hombre" : "",
    /-network\b/i.test(n) || voz.localService === false ? "suena mejor" : "",
  ].filter(Boolean);

  return pistas.length ? `${bonito} · ${pistas.join(" · ")}` : bonito;
}

/**
 * ¿Puede este aparato sonar a dos personas distintas en este idioma?
 *
 * Es la pregunta que decide qué se le dice a la gente, y es la MISMA que usa
 * `tonoPara`: si pidiendo hombre y pidiendo mujer sale la misma voz, no. Que la
 * pantalla y el sonido contesten lo mismo es justo lo que faltaba: antes la
 * pantalla decía que se podía elegir y el altavoz decía que no.
 */
export function suenanDistinto(voces: VozDelAparato[], idioma: string): boolean {
  const base = { timbre: "suave", idioma, ritmo: "normal" } as const;
  const h = elegirVoz(voces, { ...base, voz: "hombre" });
  const m = elegirVoz(voces, { ...base, voz: "mujer" });
  return Boolean(h && m && h.name !== m.name);
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

  /*
    Lo que se haya elegido a mano manda sobre cualquier cosa que adivinemos.

    Salvo que ya no esté: las voces de un móvil cambian cuando se actualiza el
    sistema o se borra un idioma, y quedarse mudo porque falta una voz que se
    eligió hace tres meses sería absurdo.
  */
  if (ajustes.vozExacta) {
    const suya = voces.find((v) => v.name === ajustes.vozExacta);
    if (suya) return suya;
  }

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
      vozExacta: typeof v.vozExacta === "string" ? v.vozExacta : undefined,
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
