"use client";

/**
 * Una llamada con ECLIPSE.
 *
 * Mandar audios es un turno de cada vez: grabas, sueltas, esperas. Una llamada
 * es otra cosa —hablas, te contesta, le interrumpes— y esa diferencia no está
 * en la tecnología, está en tres detalles que hay que acertar:
 *
 * 1. CUÁNDO HAS TERMINADO DE HABLAR. No hay botón, así que se mira el silencio.
 *    Corto y corta a media frase mientras piensas; largo y parece que no te
 *    oye. Además se espera un poco más si acabas con una coma o dudando, que es
 *    justo cuando la gente respira sin haber terminado.
 *
 * 2. PODER INTERRUMPIRLE. Si está hablando y empiezas a hablar tú, se calla al
 *    instante. Una llamada en la que hay que esperar a que el otro acabe no es
 *    una conversación, es un contestador.
 *
 * 3. QUE NO SE OIGA A SÍ MISMO. El micrófono sigue abierto mientras habla, y lo
 *    que dice entra por él. Sin esto se contesta solo, en bucle, y es lo primero
 *    que rompe una llamada.
 *
 * Todo lo de aquí es lógica sin navegador: se puede probar sin micrófono, que
 * es la única forma de fiarse de algo que solo falla cuando hay ruido.
 */

/** En qué punto está la llamada. */
export type Fase = "conectando" | "escuchando" | "pensando" | "hablando" | "colgada";

/**
 * Cuánto silencio significa "he terminado".
 *
 * Bajado de 1100 a 800: con 1100 lo que se notaba era un segundo largo de nada
 * entre que callas y que empieza a pensar, y en una llamada un segundo de nada
 * se siente como que el otro no te ha oído. 800 sigue estando por encima de la
 * pausa normal de quien respira a mitad de frase, y para quien de verdad se
 * queda pensando está el margen de abajo.
 */
export const SILENCIO_MS = 800;
/** Y cuánto más si la frase se quedó colgando. */
export const SILENCIO_DUDANDO_MS = 700;
/** Por debajo de esto no es un turno: es un carraspeo o un ruido. */
export const MINIMO_LETRAS = 2;

/**
 * ¿La frase suena a terminada?
 *
 * Quien acaba en coma, en "y", o en "eeeh" no ha terminado: está pensando. Con
 * un silencio fijo, a esa gente se le corta siempre. Se le da un poco más.
 */
export function frasePendiente(texto: string): boolean {
  const limpio = texto.trim().toLowerCase();
  if (!limpio) return false;
  if (/[,;:]$/.test(limpio)) return true;
  // Las dudas se alargan al decirlas: no es "eh", es "eeeh". Escritas con una
  // sola letra no se reconocería ninguna de las que la gente dice de verdad.
  return /\b(y|o|pero|que|de|en|con|para|porque|si|cuando|entonces|osea|o\s*sea|pues|e+h+|e+m+|m{2,}|a+h+)$/.test(
    limpio,
  );
}

/** Cuánto hay que esperar antes de dar el turno por cerrado. */
export function esperaPara(texto: string): number {
  return SILENCIO_MS + (frasePendiente(texto) ? SILENCIO_DUDANDO_MS : 0);
}

/** ¿Esto es un turno de verdad o un ruido? */
export function mereceRespuesta(texto: string): boolean {
  const limpio = texto.trim();
  if (limpio.replace(/[^\p{L}\p{N}]/gu, "").length < MINIMO_LETRAS) return false;
  // Lo que suelta el reconocedor cuando solo ha oído ruido.
  return !/^(eh+|mm+|ah+|uh+|hm+)$/i.test(limpio);
}

/**
 * Lo que ECLIPSE acaba de decir, para no contestárselo a sí mismo.
 *
 * El micrófono sigue abierto mientras habla, así que su propia voz vuelve a
 * entrar. Comparar palabra a palabra no vale —el reconocedor se come acentos y
 * signos— así que se comparan las palabras desnudas: si casi todo lo que ha
 * "oído" estaba en lo que acababa de decir, es su eco.
 */
export function esSuPropioEco(oido: string, dicho: string): boolean {
  const palabras = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2);

  const suyas = palabras(oido);
  if (suyas.length === 0) return false;

  const dichas = new Set(palabras(dicho));
  if (dichas.size === 0) return false;

  const repetidas = suyas.filter((p) => dichas.has(p)).length;
  return repetidas / suyas.length >= 0.7;
}

/**
 * Partir la respuesta en frases para poder decirlas de una en una.
 *
 * Dos motivos. Empieza a hablar antes, porque no espera a tenerlo todo. Y se
 * puede cortar en seco al interrumpirle: parar entre frases es instantáneo,
 * parar a mitad de un párrafo de doscientas palabras no.
 */
export function enFrases(texto: string): string[] {
  return texto
    // Lo que se lee no se dice: los asteriscos y las almohadillas del markdown
    // se pronunciarían, y en una llamada eso es ruido.
    .replace(/```[\s\S]*?```/g, " (te lo paso escrito) ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Saca del buffer las frases YA terminadas, y devuelve lo que queda a medias.
 *
 * Es lo que permite hablar mientras el modelo sigue escribiendo: en cuanto hay
 * un punto, esa frase se puede decir en alto sin riesgo de tener que
 * rectificar, porque una frase terminada ya no cambia.
 */
export function sacarFrases(buffer: string): { frases: string[]; resto: string } {
  // Hasta el último final de frase; lo de después sigue esperando.
  const corte = buffer.search(/[.!?…\n](?=[^.!?…\n]*$)/);
  if (corte === -1) return { frases: [], resto: buffer };

  const cerrado = buffer.slice(0, corte + 1);
  const resto = buffer.slice(corte + 1);
  return { frases: enFrases(cerrado), resto };
}

/** Lo que se le dice al modelo para que hable como se habla. */
export const COMO_HABLAR = `Esto es una LLAMADA de voz: lo que escribas se va a
leer en alto, y quien te escucha no puede ver la pantalla.

- Corto. Dos o tres frases. Si hace falta más, dilo y pregunta si sigues.
- Como se habla, no como se escribe: sin listas, sin títulos, sin negritas, sin
  emojis. Nada de eso se oye, y los asteriscos se pronuncian.
- Nada de enlaces ni de direcciones largas: al oído no sirven de nada. Di que se
  lo pasas escrito y ya.
- Números y cifras, redondeados y dichos como se dicen: "unos tres mil", no
  "3.247,58".
- Si no le has entendido, dilo en tres palabras y sigue. En una llamada se
  pregunta, no se pide que lo escriban otra vez.`;

/* -------------------------- El motor de la llamada ------------------------ */

export interface Turno {
  role: "user" | "assistant";
  content: string;
}

/** Lo que la llamada necesita del mundo. Se inyecta para poder probarla. */
export interface Entorno {
  /** Empieza a escuchar. Devuelve cómo parar. */
  escuchar: (onTexto: (texto: string) => void, onError: (m: string) => void) => () => void;
  /** Dice una frase. Se resuelve al terminarla, o antes si la cortan. */
  decir: (frase: string) => Promise<void>;
  /** Corta lo que se esté diciendo. */
  callar: () => void;
  /**
   * Le pregunta al modelo.
   *
   * `alTrozo` recibe lo que va llegando, para poder empezar a hablar con la
   * primera frase en vez de esperar a la respuesta entera. La diferencia se
   * nota muchísimo: una respuesta de cuatro frases tardaba en empezar lo que
   * tardaba en escribirse entera.
   */
  preguntar: (turnos: Turno[], alTrozo?: (trozo: string) => void) => Promise<string>;
  /** El reloj, para poder adelantarlo en las pruebas. */
  ahora: () => number;
  temporizador: (fn: () => void, ms: number) => () => void;
}

export interface Llamada {
  colgar: () => void;
  /** Silenciar el micrófono sin colgar. */
  silenciar: (v: boolean) => void;
  turnos: () => Turno[];
}

export function iniciarLlamada(
  entorno: Entorno,
  avisos: {
    onFase: (fase: Fase) => void;
    onTurno: (turnos: Turno[]) => void;
    onError: (mensaje: string) => void;
  },
): Llamada {
  const turnos: Turno[] = [];
  let fase: Fase = "conectando";
  let oido = "";
  let cancelarEspera: (() => void) | null = null;
  let ultimoDicho = "";
  let silenciado = false;
  let colgada = false;

  const cambiar = (nueva: Fase) => {
    if (colgada && nueva !== "colgada") return;
    fase = nueva;
    avisos.onFase(nueva);
  };

  const pararEspera = () => {
    cancelarEspera?.();
    cancelarEspera = null;
  };

  /** Se ha callado: va lo que ha dicho. */
  const cerrarTurno = async () => {
    pararEspera();
    const dicho = oido.trim();
    oido = "";
    if (!dicho || colgada) return;

    turnos.push({ role: "user", content: dicho });
    avisos.onTurno([...turnos]);
    cambiar("pensando");

    /*
      Hablar mientras contesta, no después.

      Las frases terminadas se van encolando según llegan y una sola tarea las
      va diciendo en orden. Así se empieza a oír a ECLIPSE en cuanto tiene la
      primera frase, y no cuando ha terminado de escribir las cuatro. Es el
      cambio que hace que la llamada deje de "costarle arrancar".
    */
    const cola: string[] = [];
    let buffer = "";
    /** Todo lo que ha ido llegando en trozos, para saber qué falta por decir. */
    let recibido = "";
    let hablandoYa = false;
    let hablado = "";

    const vaciarCola = async () => {
      if (hablandoYa) return;
      hablandoYa = true;
      while (cola.length && !colgada) {
        // Si le han interrumpido, lo que quedaba por decir ya no vale.
        if (fase !== "pensando" && fase !== "hablando") break;
        const frase = cola.shift() as string;
        if (fase !== "hablando") cambiar("hablando");
        // Lo que ya ha dicho, para reconocer su propio eco en el micrófono.
        hablado = `${hablado} ${frase}`.trim();
        ultimoDicho = hablado;
        await entorno.decir(frase);
      }
      hablandoYa = false;
      cola.length = 0;
    };

    let respuesta = "";
    try {
      respuesta = await entorno.preguntar([...turnos], (trozo) => {
        if (colgada) return;
        recibido += trozo;
        buffer += trozo;
        const { frases, resto } = sacarFrases(buffer);
        buffer = resto;
        if (!frases.length) return;
        cola.push(...frases);
        void vaciarCola();
      });
    } catch (err) {
      if (colgada) return;
      avisos.onError(err instanceof Error ? err.message : "No he podido contestar.");
      cambiar("escuchando");
      return;
    }
    if (colgada) return;

    const limpia = respuesta.trim();
    if (!limpia) {
      cambiar("escuchando");
      return;
    }

    turnos.push({ role: "assistant", content: limpia });
    avisos.onTurno([...turnos]);

    /*
      Lo que quede por decir.

      Dos casos. Si fue llegando en trozos, lo que falta es la cola del buffer:
      la última frase, que suele quedarse sin punto final. Y si el motor no
      mandó trozos —o mandó algo distinto de la respuesta final—, falta todo:
      más vale decirlo entero que quedarse a medias.
    */
    const queda = recibido.trim() ? buffer : limpia;
    for (const frase of enFrases(queda)) {
      if (colgada) break;
      if (fase !== "pensando" && fase !== "hablando") break;
      if (fase !== "hablando") cambiar("hablando");
      cola.push(frase);
    }
    await vaciarCola();
    ultimoDicho = limpia;

    if (!colgada) cambiar("escuchando");
  };

  const alOir = (texto: string) => {
    if (colgada || silenciado) return;

    /*
      Su propia voz, que ha entrado por el micrófono abierto.

      Se descarta sin más: ni cuenta como turno ni le interrumpe. Sin esto la
      llamada se convierte en ECLIPSE hablando consigo mismo, que es el fallo
      más ridículo que puede tener una llamada.
    */
    if (fase === "hablando" && esSuPropioEco(texto, ultimoDicho)) return;

    // Le está interrumpiendo: se calla al instante y le escucha.
    if (fase === "hablando") {
      entorno.callar();
      cambiar("escuchando");
    }

    if (fase === "pensando") return;

    oido = `${oido} ${texto}`.trim();
    pararEspera();
    if (!mereceRespuesta(oido)) return;

    cancelarEspera = entorno.temporizador(() => void cerrarTurno(), esperaPara(oido));
  };

  const parar = entorno.escuchar(alOir, (m) => avisos.onError(m));
  cambiar("escuchando");

  return {
    colgar() {
      colgada = true;
      pararEspera();
      entorno.callar();
      parar();
      cambiar("colgada");
    },
    silenciar(v) {
      silenciado = v;
      if (v) {
        pararEspera();
        oido = "";
      }
    },
    turnos: () => [...turnos],
  };
}
