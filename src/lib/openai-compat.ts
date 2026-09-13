import { crearSeparador } from "./pensamiento";
import type { Attachment, Mode, Speed } from "./types";

/**
 * Motores que hablan el dialecto de OpenAI (`/chat/completions`). Con una sola
 * implementación cubrimos varios proveedores con capa gratuita de verdad:
 *
 * - Groq: rápido y con el límite diario más generoso. Sin tarjeta.
 * - OpenRouter: muchos modelos, varios gratuitos. Sin tarjeta.
 *
 * Todos usan modelos abiertos (Llama, Qwen, Mistral…). No llegan al nivel de
 * Gemini o Claude, pero conversan, escriben y programan con soltura.
 */

export type CompatProvider = "groq" | "openrouter";

interface Preset {
  label: string;
  base: string;
  /** Modelo preferido; si no existe, se busca uno en la cuenta. */
  model: string;
  /** Cómo reconocer un modelo bueno para chat en la lista del proveedor. */
  prefer: RegExp;
  /** Qué modelos saben mirar imágenes. */
  vision: RegExp;
  keyUrl: string;
}

/**
 * Cómo se reconoce, por el nombre, un modelo que sabe mirar imágenes.
 *
 * Esta lista se queda corta cada dos por tres: las capas gratuitas retiran y
 * estrenan modelos cada pocas semanas, y un nombre nuevo que no esté aquí hace
 * que la aplicación crea que no tiene ojos cuando sí los tiene. Por eso, además
 * de la lista, se intenta mandar la imagen igualmente (ver más abajo): la lista
 * sirve para ELEGIR bien, no para decidir que no se puede.
 */
const OJOS =
  /llama-4|scout|maverick|vision|multimodal|[-/]vl[-\d]|vl-|pixtral|llava|gemma-?3|internvl|molmo|qwen.*(vl|omni)|gemini|gpt-4o|gpt-5|claude|nova-(lite|pro)/i;

export const PRESETS: Record<CompatProvider, Preset> = {
  groq: {
    label: "Groq · gratis, sin tarjeta",
    base: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    prefer: /llama.*70b|llama.*versatile|gpt-oss/i,
    vision: OJOS,
    keyUrl: "https://console.groq.com/keys",
  },
  openrouter: {
    label: "OpenRouter · modelos gratuitos",
    base: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    prefer: /:free$/i,
    vision: OJOS,
    keyUrl: "https://openrouter.ai/keys",
  },
};

export class CompatError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
  /** Las llamadas que pidió el modelo, cuando el turno es suyo. */
  tool_calls?: LlamadaCruda[];
  /** A qué llamada responde este turno, cuando el papel es `tool`. */
  tool_call_id?: string;
}

/** Una llamada a herramienta tal y como la escriben estos modelos. */
export interface LlamadaCruda {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Un turno más de los que van y vienen dentro del bucle de herramientas. */
export type TurnoExtra =
  | { role: "assistant"; content: string; tool_calls: LlamadaCruda[] }
  | { role: "tool"; tool_call_id: string; content: string };

function toMessages(
  system: string,
  turns: { role: "user" | "assistant"; content: string; attachments?: Attachment[] }[],
  vision: boolean,
  /** Lo que ya se ha hablado con las herramientas en esta misma respuesta. */
  extra: TurnoExtra[] = [],
): Message[] {
  const out: Message[] = [{ role: "system", content: system }];

  for (const turn of turns) {
    const images = (turn.attachments ?? []).filter((a) => a.kind === "image" && a.data);
    const videos = (turn.attachments ?? []).filter((a) => a.kind === "video");
    const texts = (turn.attachments ?? [])
      .filter((a) => a.kind === "text" && a.data)
      .map((a) => `<archivo nombre="${a.name}">\n${a.data}\n</archivo>`);

    const written =
      [
        ...texts,
        ...videos.map(
          (a) =>
            `(El usuario ha adjuntado el vídeo "${a.name}". Este motor no puede verlo: dilo con naturalidad y pídele una captura.)`,
        ),
        turn.content,
      ]
        .filter(Boolean)
        .join("\n\n") || "(sin texto)";

    if (turn.role === "user" && images.length && !vision) {
      out.push({
        role: "user",
        content: `${written}\n\n(AVISO DEL SISTEMA, no del usuario: se han adjuntado ${images.length} imagen(es) y el motor de ahora las ha rechazado, así que NO las tienes. Díselo tal cual —que este motor no puede ver imágenes— y dile que en Ajustes puede cambiar el motor a Google, que sí las ve. No le pidas que te describa la imagen: eso es hacerle a él el trabajo.)`,
      });
    } else if (turn.role === "user" && images.length) {
      out.push({
        role: "user",
        content: [
          ...images.map((a) => ({
            type: "image_url" as const,
            image_url: { url: `data:${a.mime};base64,${a.data}` },
          })),
          { type: "text" as const, text: written },
        ],
      });
    } else {
      out.push({ role: turn.role, content: written });
    }
  }

  // El ida y vuelta con las herramientas va al final, en el orden en que
  // ocurrió: el modelo necesita ver su propia llamada justo antes de la
  // respuesta que le dieron, o no sabe a qué corresponde cada resultado.
  for (const t of extra) {
    if (t.role === "assistant")
      out.push({ role: "assistant", content: t.content, tool_calls: t.tool_calls });
    else out.push({ role: "tool", tool_call_id: t.tool_call_id, content: t.content });
  }

  return out;
}

/**
 * Cuánto se le deja escribir.
 *
 * Una conversación se responde de sobra con unos miles de tokens. Un proyecto
 * de código, no: una página con diseño de verdad —tipografía, paleta, sus
 * secciones con contenido escrito— pasa de las seiscientas líneas, y eso no
 * cabe en 4.096 tokens. Con el presupuesto de charla, el modelo no es que
 * escriba una página fea: escribe la página que le cabe.
 */
function maxTokens(speed: Speed, modo: Mode = "chat"): number {
  // El techo de código va alto a propósito. No es lo que se pide siempre: es
  // lo máximo que se pediría si hubiera sitio, porque justo antes de mandarlo
  // se recorta a lo que quepa en el cupo del modelo. Con un motor de los que
  // dan margen de sobra, este número es el que decide lo largo que puede salir
  // un archivo de una sola vez; dejarlo corto era ponerle un techo de casa a
  // quien ya había pagado uno más alto.
  if (modo === "code") return speed === "rapido" ? 12288 : 32768;
  if (speed === "rapido") return 2048;
  if (speed === "profundo") return 8192;
  return 4096;
}

/**
 * El cupo por minuto: el proveedor cuenta la conversación entera MÁS el hueco
 * que se reserva para la respuesta, y si la suma pasa del tope no contesta.
 *
 * Pasa en modo código después de unos cuantos mensajes: cada respuesta lleva un
 * archivo completo, la conversación los arrastra todos y la cuenta sube sola.
 * El error dice literalmente "Limit 8000, Requested 8568", así que no hay que
 * adivinar nada: se lee cuánto sobra y se recorta exactamente eso.
 */
function esPeticionEnorme(detalle: string): boolean {
  if (/request too large/i.test(detalle)) return true;

  // Ojo con confundirlo con el otro: "Rate limit reached … Used 7500,
  // Requested 1000" no dice que la petición no quepa, dice que el cupo de este
  // minuto ya está gastado. Eso se arregla esperando o cambiando de modelo, y
  // recortar la respuesta no serviría de nada.
  if (/\bused\b/i.test(detalle)) return false;

  return /tokens per minute|\bTPM\b/i.test(detalle) && /requested\s+[\d.,]+/i.test(detalle);
}

/** Cuántos tokens sobran, si el proveedor los dice. */
function excesoPorMinuto(detalle: string): number | null {
  const limite = /limit\s+([\d.,]+)/i.exec(detalle);
  const pedido = /requested\s+([\d.,]+)/i.exec(detalle);
  if (!limite || !pedido) return null;

  const n = (t: string) => Number(t.replace(/[.,]/g, ""));
  const exceso = n(pedido[1]) - n(limite[1]);
  return Number.isFinite(exceso) && exceso > 0 ? exceso : null;
}

/**
 * El cupo por minuto que el propio proveedor anuncia en cada respuesta.
 *
 * Groq lo manda en una cabecera, y saberlo cambia mucho las cosas: en modo
 * código se piden 16.384 tokens de hueco, y si el cupo del plan gratuito es de
 * 8.000, ese primer intento está condenado antes de salir. Sabiéndolo, se pide
 * de entrada lo que cabe y no se gasta un viaje en aprenderlo cada vez.
 */
/*
  El cupo se guarda POR MODELO, no por proveedor.

  Cada modelo tiene el suyo y no se parecen: en el plan gratuito de Groq,
  gpt-oss-120b da 8.000 tokens por minuto y llama-3.3-70b-versatile da 12.000.
  Guardando un solo número por proveedor, el del último modelo usado pisaba al
  del siguiente y las cuentas salían mal. Y sabiéndolo por modelo se puede hacer
  algo mucho mejor: cuando hay que escribir un archivo largo, elegir el que más
  sitio deja.
*/
const cupoPorMinuto: Record<string, number> = {};

const claveCupo = (provider: CompatProvider, modelo: string) => `${provider}:${modelo}`;

function anotarCupo(provider: CompatProvider, modelo: string, res: Response) {
  const bruto = res.headers.get("x-ratelimit-limit-tokens");
  const n = bruto ? Number(bruto) : NaN;
  if (Number.isFinite(n) && n > 0) cupoPorMinuto[claveCupo(provider, modelo)] = n;
}

/** Lo que sabemos del cupo de un modelo, si ya se ha usado alguna vez. */
export function cupoDe(provider: CompatProvider, modelo: string): number | undefined {
  return cupoPorMinuto[claveCupo(provider, modelo)];
}

/**
 * Lo que cuesta una imagen, en tokens.
 *
 * Una foto viaja como base64, y medirla por caracteres es un disparate: 300 KB
 * de base64 parecen ochenta mil tokens cuando el modelo la cuenta como mil y
 * pico. Con la cuenta mala, el hueco para responder se venía abajo y hasta se
 * llegaba a soltar el mensaje que traía la foto por "no caber". Así que las
 * imágenes se cuentan aparte y a lo que valen.
 */
const TOKENS_POR_IMAGEN = 1400;

/** Cuántos tokens ocupa más o menos lo que se va a mandar. */
function estimarTokens(mensajes: Message[]): number {
  let imagenes = 0;

  const texto = JSON.stringify(mensajes, (clave, valor) => {
    if (clave === "url" && typeof valor === "string" && valor.startsWith("data:")) {
      imagenes++;
      return "";
    }
    return valor;
  });

  // Tres caracteres y medio por token es la regla de servilleta de siempre, y
  // aquí solo hace falta para no pasarse, no para acertar.
  return Math.ceil(texto.length / 3.5) + imagenes * TOKENS_POR_IMAGEN;
}

/** Por debajo de esto la respuesta ya no sirve: sobra la conversación, no el hueco. */
const MINIMO_UTIL = 1024;
/** Un poco de aire: el proveedor cuenta los tokens de forma algo distinta. */
const MARGEN = 256;

async function readError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const json = JSON.parse(raw) as { error?: { message?: string } | string };
    const err = json.error;
    return (typeof err === "string" ? err : err?.message) || raw.slice(0, 300);
  } catch {
    return raw.slice(0, 300) || `HTTP ${res.status}`;
  }
}

/** Modelos del proveedor, con los recomendables primero. */
async function listModels(preset: Preset, key: string): Promise<string[]> {
  try {
    const res = await fetch(`${preset.base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { data?: { id?: string }[] };
    const ids = (json.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));

    const good = ids.filter((id) => preset.prefer.test(id));
    const rest = ids.filter(
      (id) => !preset.prefer.test(id) && !/whisper|tts|embed|guard|vision-only/i.test(id),
    );
    return [...good, ...rest];
  } catch {
    return [];
  }
}

/**
 * Qué modelo se usa, comprobado contra lo que la cuenta tiene de verdad.
 *
 * Antes se empezaba por un identificador escrito a mano y solo se buscaba otro
 * cuando el proveedor contestaba con un error. Eso funciona hasta el día en que
 * el proveedor retira ese modelo —las capas gratuitas lo hacen cada pocas
 * semanas— y entonces el primer intento de cada conversación es un error en la
 * cara del usuario, con suerte recuperable y con mala suerte no.
 *
 * Así que ahora se pregunta primero. Se pide el catálogo de la cuenta, se elige
 * de ahí, y el nombre escrito a mano queda solo para cuando el catálogo no se
 * puede consultar. Lo elegido se guarda, de modo que esa consulta ocurre una
 * vez por arranque del servidor y no en cada mensaje.
 */

/**
 * Qué modelo se prefiere para cada cosa, por patrones de nombre.
 *
 * Antes, cuando el de siempre no estaba en la cuenta, se cogía "el primero de
 * la lista". Y el primero resultó ser uno pequeño: de ahí salían las páginas
 * pobres y el "no puedo ver la imagen". Un modelo pequeño no es un modelo
 * grande con menos ganas; hay cosas que directamente no sabe hacer.
 */
const PREFERENCIA_CHAT: RegExp[] = [
  /llama-4|maverick|scout/i,
  /kimi|k2/i,
  /70b|72b/i,
  /gpt-oss.*120/i,
  /qwen.*3/i,
  /versatile/i,
];

const PREFERENCIA_CODIGO: RegExp[] = [
  /kimi|k2/i,
  /qwen.*coder/i,
  /deepseek/i,
  /llama.*(405|90)b/i,
  /gpt-oss.*120/i,
  /maverick/i,
  /70b|72b/i,
  /qwen.*3/i,
  /qwen/i,
];

/**
 * Modelos pequeños, por lo que dice su propio nombre.
 *
 * Para programar, el tamaño se nota mucho más que en una conversación. Un
 * modelo de 27B contesta rápido y parece que ha entendido, pero entrega una
 * escena 3D sin luces y un cubo de Rubik negro: no es que se despiste, es que
 * no le da. Así que en modo código se dejan para el final, y solo se usan si no
 * hay nada mejor en la cuenta.
 */
const PEQUENO = (id: string) =>
  // Con una salvedad: los modelos de expertos ponen en el nombre los parámetros
  // que usan por token, no los que tienen. Maverick dice "17b" y son 400.
  !/maverick|scout|\bmoe\b|\d+e\b/i.test(id) && /\b([1-9]|[12]\d)\s*b\b/i.test(id);

const resolved: Partial<Record<CompatProvider, string>> = {};
const resueltoCodigo: Partial<Record<CompatProvider, string>> = {};
const resueltoVista: Partial<Record<CompatProvider, string>> = {};
/** El catálogo de la cuenta, para no pedirlo en cada mensaje. */
const catalogo: Partial<Record<CompatProvider, string[]>> = {};

async function modelosDeLaCuenta(
  provider: CompatProvider,
  preset: Preset,
  key: string,
): Promise<string[]> {
  if (catalogo[provider]) return catalogo[provider]!;
  const lista = await listModels(preset, key);
  // Una lista vacía no se guarda: sería recordar para siempre un fallo de red.
  if (lista.length) catalogo[provider] = lista;
  return lista;
}

async function elegirModelo(
  provider: CompatProvider,
  preset: Preset,
  key: string,
  modo: Mode,
  /** Hay imágenes en la conversación: hace falta uno que sepa mirarlas. */
  conVista = false,
): Promise<string> {
  const fijado = envModel(provider) || (modo === "code" ? process.env.CODE_MODEL || "" : "");
  if (fijado) return fijado;

  const disponibles = await modelosDeLaCuenta(provider, preset, key);

  // Sin catálogo (red caída, clave sin permiso para listarlo) queda el nombre
  // de siempre: peor que elegir bien, mejor que no intentarlo.
  if (disponibles.length === 0) return preset.model;

  // Con una imagen delante manda ver por encima de todo lo demás: el mejor
  // modelo del mundo que no mire imágenes, aquí no sirve para nada.
  if (conVista) {
    const conOjos = disponibles.filter((id) => preset.vision.test(id));
    if (conOjos.length) return resueltoVista[provider] ?? (resueltoVista[provider] = conOjos[0]);
  }

  const guardado = modo === "code" ? resueltoCodigo[provider] : resolved[provider];
  if (guardado) return guardado;

  // Los pequeños al final cuando hay que programar: así, entre dos que encajen
  // con el mismo patrón, gana el grande en vez de ganar el que salga antes.
  const candidatos =
    modo === "code"
      ? [...disponibles.filter((id) => !PEQUENO(id)), ...disponibles.filter(PEQUENO)]
      : disponibles;

  const preferencias = modo === "code" ? PREFERENCIA_CODIGO : PREFERENCIA_CHAT;
  for (const patron of preferencias) {
    const encontrado = candidatos.find((id) => patron.test(id));
    if (encontrado) {
      if (modo === "code") resueltoCodigo[provider] = encontrado;
      else resolved[provider] = encontrado;
      return encontrado;
    }
  }

  // Ninguno encaja con lo que se busca: el de siempre si está, y si no, el
  // primero que haya, que es mejor que no responder.
  const elegido = disponibles.includes(preset.model) ? preset.model : candidatos[0];
  if (modo === "code") resueltoCodigo[provider] = elegido;
  else resolved[provider] = elegido;
  return elegido;
}

/** Ese modelo ha fallado: se olvida para no volver a intentarlo con él. */
function olvidarModelo(provider: CompatProvider, modelo: string) {
  if (resolved[provider] === modelo) delete resolved[provider];
  if (resueltoCodigo[provider] === modelo) delete resueltoCodigo[provider];
  if (resueltoVista[provider] === modelo) delete resueltoVista[provider];
}

/** Permite fijar el modelo desde el hosting, sin tocar el código. */
function envModel(provider: CompatProvider): string {
  return (
    (provider === "groq" ? process.env.GROQ_MODEL : process.env.OPENROUTER_MODEL) || ""
  );
}

export interface CompatEvent {
  text?: string;
  /** El proveedor ha parado por quedarse sin espacio, no por terminar. */
  cortado?: boolean;
  /** Su deliberación, que va a otro sitio y no a la respuesta. */
  pensando?: string;
  /** Qué modelo acabó respondiendo. Se manda una vez, al abrir. */
  modelo?: string;
  /** El modelo ha pedido usar herramientas y ha dejado de escribir. */
  llamadas?: LlamadaCruda[];
  /**
   * Había fotos y este motor no ha podido con ellas. Se avisa ANTES de escribir
   * nada, para que quien llama pueda irse a otro motor a tiempo en vez de
   * entregar un "no puedo ver imágenes" que no le sirve a nadie.
   */
  sinVista?: boolean;
}

/** Conversa con el proveedor y va entregando lo que escribe. */
export async function* streamCompat(opts: {
  provider: CompatProvider;
  key: string;
  system: string;
  turns: { role: "user" | "assistant"; content: string; attachments?: Attachment[] }[];
  speed: Speed;
  signal?: AbortSignal;
  /** Catálogo de herramientas, en el formato de OpenAI. Vacío = sin herramientas. */
  tools?: unknown[];
  /** El ida y vuelta con las herramientas que ya ha ocurrido en esta respuesta. */
  extra?: TurnoExtra[];
  /** De él depende cuánto se le deja escribir. */
  modo?: Mode;
}): AsyncGenerator<CompatEvent> {
  const preset = PRESETS[opts.provider];
  if (!opts.key)
    throw new CompatError(
      `Falta la clave de ${preset.label.split(" ")[0]}. Consíguela gratis en ${preset.keyUrl}`,
      503,
    );

  /*
    La conversación que se manda, que no siempre es la entera.

    Cuando no cabe, antes se le decía al usuario que abriera una conversación
    nueva. Eso está mal: es pedirle que haga a mano lo que puede hacer el
    programa. Así que si no cabe, se suelta lo más viejo —que es lo que menos
    falta hace— y se vuelve a intentar. Solo se avisa si ni con el último
    mensaje solo hay sitio.
  */
  let turnos = opts.turns;

  /*
    Si la conversación trae fotos, se mandan. Punto.

    Antes esto lo decidía una lista de nombres de modelos: si el que había
    tocado no estaba en la lista, la foto no salía y en su lugar iba una nota
    pidiéndole al usuario que describiera su propia imagen. El problema es que
    esa lista caduca sola —las capas gratuitas retiran y estrenan modelos cada
    pocas semanas— y entonces la aplicación se declara ciega teniendo ojos.

    Así que ahora se intenta siempre, y si el proveedor la rechaza, ahí sí se
    repite sin ella. Preguntar y que te digan que no es mejor que dar por hecho
    que no.
  */
  const hayFotos = opts.turns.some(
    (t) => t.attachments?.some((a) => a.kind === "image" && a.data),
  );
  let mandarImagenes = hayFotos;

  const soltarLoMasViejo = () => {
    if (turnos.length <= 1) return false;
    // Se tira la mitad más antigua de golpe: ir de uno en uno serían cinco
    // viajes al proveedor para acabar en el mismo sitio.
    let resto = turnos.slice(Math.max(1, Math.ceil(turnos.length / 2)));
    // Y que empiece por el usuario: una conversación que arranca con una
    // respuesta suelta del asistente se lee como si faltara algo, porque falta.
    while (resto.length > 1 && resto[0].role !== "user") resto = resto.slice(1);
    turnos = resto;
    return true;
  };

  const open = (model: string, tope: number, nombreNuevo = false) =>
    fetch(`${preset.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.key}`,
        // OpenRouter los usa para identificar la aplicación en su panel.
        "HTTP-Referer": "https://eclipse-ai.vercel.app",
        "X-Title": "ECLIPSE",
      },
      signal: opts.signal,
      body: JSON.stringify({
        model,
        messages: toMessages(opts.system, turnos, mandarImagenes, opts.extra ?? []),
        // Los modelos nuevos piden `max_completion_tokens`; los de siempre,
        // `max_tokens`. Mandar el que no toca es un 400 que no habla del modelo.
        ...(nombreNuevo ? { max_completion_tokens: tope } : { max_tokens: tope }),
        temperature: 0.7,
        stream: true,
        ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
      }),
    });

  /** No hay sitio ni soltando conversación: esto sí hay que contarlo. */
  let sinSitio = false;

  /**
   * Pide la respuesta y, si lo que falla es el tamaño y no el modelo, insiste.
   *
   * Aquí se juntaban dos cosas que no tienen nada que ver. En modo código se
   * piden 16.384 tokens de respuesta, y hay modelos que no llegan a tanto o que
   * ya no aceptan ese nombre de parámetro: contestan 400. El código de antes
   * leía ese 400 como "este modelo no existe", cambiaba de modelo, y el
   * siguiente fallaba igual por lo mismo, y el siguiente, hasta quedarse sin
   * ninguno y decir que el proveedor había retirado todos sus modelos. No era
   * verdad: estaban todos ahí y lo que sobraba era el tamaño que se pedía.
   *
   * Así que ante un 400 se mira de qué habla: si habla de tokens, se reintenta
   * con el otro nombre del parámetro y bajando el tope a la mitad. Solo si el
   * error no va de eso se da el modelo por perdido.
   *
   * Y con el cupo por minuto, tres pasos en este orden: pedir de entrada lo que
   * cabe, recortar el hueco de la respuesta si aun así se pasa, y soltar
   * conversación vieja si ni eso basta. Rendirse es el cuarto, y casi nunca.
   */
  const pedir = async (model: string) => {
    const maximo = maxTokens(opts.speed, opts.modo);

    // Lo que cabe de entrada, sabiendo el cupo del proveedor. Sin esto, en el
    // plan gratuito de Groq —8.000 por minuto— cada petición de código nacía
    // pidiendo 16.384 y se gastaba un viaje entero en descubrirlo.
    const aMedida = () => {
      const cupo = cupoDe(opts.provider, model);
      if (!cupo) return maximo;
      const ocupado = estimarTokens(
        toMessages(opts.system, turnos, preset.vision.test(model), opts.extra ?? []),
      );
      return Math.max(MINIMO_UTIL, Math.min(maximo, cupo - ocupado - MARGEN));
    };

    let tope = aMedida();
    let nombreNuevo = false;
    let res = await open(model, tope, nombreNuevo);
    anotarCupo(opts.provider, model, res);

    for (let intento = 0; intento < 5 && !res.ok; intento++) {
      const detalle = await res.clone().text().catch(() => "");

      if (esPeticionEnorme(detalle)) {
        const exceso = excesoPorMinuto(detalle);
        const recortado = exceso === null ? Math.floor(tope / 2) : tope - exceso - MARGEN;

        if (recortado >= MINIMO_UTIL) {
          tope = recortado;
        } else if (soltarLoMasViejo()) {
          // Ya no cabe la respuesta ni al mínimo: entonces lo que sobra es
          // conversación. Se suelta la mitad más vieja y se vuelve a empezar
          // con el hueco entero.
          tope = aMedida();
        } else {
          sinSitio = true;
          break;
        }

        res = await open(model, tope, nombreNuevo);
        anotarCupo(opts.provider, model, res);
        continue;
      }

      // El proveedor dice que este modelo no traga imágenes. Entonces sí: se
      // repite sin ellas, y el usuario recibe la explicación de por qué.
      if (
        mandarImagenes &&
        (res.status === 400 || res.status === 415 || res.status === 422) &&
        /image|imagen|vision|multimodal|content.?type|not supported/i.test(detalle)
      ) {
        mandarImagenes = false;
        res = await open(model, tope, nombreNuevo);
        anotarCupo(opts.provider, model, res);
        continue;
      }

      if (res.status !== 400 || !/token/i.test(detalle)) break;

      if (!nombreNuevo) nombreNuevo = true;
      else tope = Math.max(MINIMO_UTIL, Math.floor(tope / 2));

      res = await open(model, tope, nombreNuevo);
      anotarCupo(opts.provider, model, res);
    }
    return res;
  };

  // Si en la conversación hay alguna imagen, se busca uno que sepa mirarla. Y
  // si ninguno lo dice en su nombre, se prueba igual con el que toque.
  const wanted = await elegirModelo(
    opts.provider,
    preset,
    opts.key,
    opts.modo ?? "chat",
    hayFotos,
  );
  let res = await pedir(wanted);
  // Por qué falló el PRIMER intento. Importa para el mensaje final: si el
  // primero fue "has llegado al límite" y los respaldos fallan por otra cosa,
  // contar lo último es contar el síntoma y esconder la causa.
  const primerEstado = res.ok ? 0 : res.status;

  /**
   * Otros modelos que la cuenta tenga, para cuando el elegido no sirve.
   * Siempre salen del catálogo: un nombre escrito en el código puede llevar
   * meses retirado, y entonces el respaldo falla peor que el intento original.
   */
  const alternativas = async () =>
    (await modelosDeLaCuenta(opts.provider, preset, opts.key)).filter((m) => m !== wanted);

  // Modelo desconocido o retirado: se olvida, se pide el catálogo de nuevo —el
  // guardado puede ser justo el que caducó— y se prueban varios antes de
  // rendirse.
  if (res.status === 404 || res.status === 400) {
    olvidarModelo(opts.provider, wanted);
    delete catalogo[opts.provider];

    for (const candidato of (await alternativas()).slice(0, 8)) {
      res = await pedir(candidato);
      if (res.ok) {
        if (opts.modo === "code") resueltoCodigo[opts.provider] = candidato;
        else resolved[opts.provider] = candidato;
        break;
      }
    }
  }

  /*
    Límite gratuito agotado en ese modelo.

    Los modelos grandes —los que se eligen para código— tienen el cupo más
    apretado, y se acaba antes. Aquí se prueba con otro que la cuenta tenga: un
    proyecto escrito por un modelo algo más flojo es mejor que ninguno.

    Antes el respaldo era el nombre escrito en el código, que Groq ya había
    retirado: el 429 se convertía en un 404 y la aplicación acababa diciendo
    que habían retirado todos los modelos. Ni era verdad ni ayudaba.
  */
  // El 413 entra aquí por lo mismo: en Groq el cupo por minuto es de cada
  // modelo, así que otro modelo tiene su propio cupo entero sin gastar.
  if (res.status === 429 || res.status === 413) {
    olvidarModelo(opts.provider, wanted);
    for (const candidato of (await alternativas()).slice(0, 4)) {
      res = await pedir(candidato);
      if (res.ok) {
        if (opts.modo === "code") resueltoCodigo[opts.provider] = candidato;
        else resolved[opts.provider] = candidato;
        break;
      }
    }
  }

  // Agotados los respaldos, se explica la causa PRIMERA, no la última.
  if (!res.ok && sinSitio)
    throw new CompatError(
      "Este mensaje es demasiado largo para mandarlo de una vez. Divídelo en dos, o quítale algún archivo adjunto, y vuelve a intentarlo.",
      413,
    );

  if (!res.ok && primerEstado === 429)
    throw new CompatError(
      `Has llegado al límite gratuito de ${preset.label.split(" ")[0]} por ahora. Se renueva solo en unos minutos. Mientras tanto puedes seguir en el chat normal, que gasta menos.`,
      429,
    );

  if (res.status === 404 || res.status === 400)
    throw new CompatError(
      `${preset.label.split(" ")[0]} no tiene ahora mismo ningún modelo que esta aplicación pueda usar. Prueba en unos minutos, o pon otro motor en Ajustes.`,
      res.status,
    );

  if (!res.ok) {
    const detail = await readError(res);
    if (res.status === 401)
      throw new CompatError("La clave no es válida. Revísala en Ajustes.", 401);
    if (res.status === 429)
      throw new CompatError(
        "Has llegado al límite gratuito de este proveedor. Espera un momento y vuelve a intentarlo.",
        429,
      );
    throw new CompatError(`${preset.label.split(" ")[0]}: ${detail}`, res.status);
  }

  if (!res.body) throw new CompatError("El proveedor no ha devuelto contenido.");

  // Cuál contestó de verdad: con la búsqueda del mejor modelo para código y los
  // respaldos, no tiene por qué ser el que se pidió, y sin esto no hay forma de
  // saber por qué una respuesta salió floja.
  yield { modelo: resolved[opts.provider] || wanted };

  // Había fotos y se han quedado por el camino: que se entere quien llama,
  // antes de que empiece a llegar texto.
  if (hayFotos && !mandarImagenes) yield { sinVista: true };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  /**
   * Las llamadas a herramientas no llegan enteras: llegan a trozos, y el
   * nombre puede venir en un fragmento y los argumentos repartidos entre
   * veinte. Se arman por su índice y no se entregan hasta que el flujo acaba.
   */
  const enObra = new Map<number, LlamadaCruda>();
  // Los modelos de razonamiento escriben su borrador entre <think> y </think>.
  const separador = crearSeparador();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut: number;
    while ((cut = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: {
            finish_reason?: string | null;
            delta?: {
              content?: string;
              tool_calls?: {
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
          }[];
          error?: { message?: string };
        };
        if (chunk.error?.message) throw new CompatError(chunk.error.message);

        // "length" quiere decir que se ha quedado a medias, no que haya
        // terminado: sin avisar, el usuario ve un archivo incompleto y no sabe
        // que solo hace falta pedirle que siga.
        if (chunk.choices?.[0]?.finish_reason === "length") yield { cortado: true };

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          const { texto, pensando } = separador.trozo(delta.content);
          if (pensando) yield { pensando };
          if (texto) yield { text: texto };
        }

        for (const trozo of delta?.tool_calls ?? []) {
          const i = trozo.index ?? 0;
          const actual = enObra.get(i) ?? {
            id: "",
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (trozo.id) actual.id = trozo.id;
          if (trozo.function?.name) actual.function.name = trozo.function.name;
          if (trozo.function?.arguments) actual.function.arguments += trozo.function.arguments;
          enObra.set(i, actual);
        }
      } catch (err) {
        if (err instanceof CompatError) throw err;
        // Fragmento partido entre lecturas: seguimos.
      }
    }
  }

  const final = separador.cerrar();
  if (final.pensando) yield { pensando: final.pensando };
  if (final.texto) yield { text: final.texto };

  const llamadas = [...enObra.values()].filter((l) => l.function.name);
  if (llamadas.length) {
    // Sin id no se puede emparejar la respuesta; algunos proveedores lo omiten.
    llamadas.forEach((l, i) => {
      if (!l.id) l.id = `llamada_${i}`;
    });
    yield { llamadas };
  }
}

/** Comprueba que la clave sirve, antes de guardarla. */
export async function verifyCompatKey(
  provider: CompatProvider,
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const preset = PRESETS[provider];
  try {
    const res = await fetch(`${preset.base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403)
      return { ok: false, error: "Esa clave no es válida. Cópiala entera, sin espacios." };
    return { ok: false, error: `El proveedor respondió ${res.status}. Inténtalo en un momento.` };
  } catch {
    return { ok: false, error: "No se ha podido contactar con el proveedor." };
  }
}

/** Una sola respuesta corta, sin streaming. Para títulos y cosas parecidas. */
export async function oneShotCompat(
  provider: CompatProvider,
  key: string,
  prompt: string,
  /** Los títulos caben en cuatro palabras; un prompt de imagen, no. */
  tope = 48,
): Promise<string> {
  const preset = PRESETS[provider];
  const res = await fetch(`${preset.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: envModel(provider) || resolved[provider] || preset.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: tope,
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new CompatError(await readError(res), res.status);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
