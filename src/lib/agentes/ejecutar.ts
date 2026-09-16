import { misConexiones } from "../conexiones/almacen";
import { herramientaConexion } from "../conexiones/herramienta";
import { ejecutarConexion, servicioDe } from "../conexiones/registro";
import { resolveKey } from "../keys";
import { activeProvider } from "../provider";
import { conversarConHerramientas } from "../tools/bucle";
import { herramientasPara } from "../tools/registro";
import type { Herramienta } from "../tools/tipos";
import type { CompatProvider } from "../openai-compat";
import { agenteDe } from "./catalogo";
import { apuntar, contratoDe, dejarPendiente, pendientesDe, quitarPendiente } from "./almacen";
import {
  estadoDe,
  herramientasDe,
  puedeTrabajar,
  serviciosDe,
  type Agente,
  type ConfigAgente,
} from "./tipos";

/**
 * Poner a trabajar a un agente. De verdad.
 *
 * Aquí es donde un agente deja de ser una tarjeta con un precio. Lo que hace
 * esta función, por orden, es lo que lo convierte en un agente:
 *
 * 1. Comprueba que está contratado, activo y con lo que necesita conectado. Si
 *    no, NO trabaja: devuelve el motivo. Nada de "hecho con limitaciones".
 * 2. Le monta un juego de herramientas RECORTADO: las suyas, y dentro de las
 *    conexiones, solo sus servicios. Lo que no está en esa lista no existe para
 *    él, y eso no depende de que obedezca.
 * 3. Si el cliente ha pedido aprobación humana, las acciones que ESCRIBEN no se
 *    ejecutan: se dejan en la cola y al modelo se le dice que están paradas. No
 *    se hacen y luego se avisa: no se hacen.
 * 4. Apunta en el registro lo que ha pasado de verdad, acierto o fallo.
 *
 * El trabajo pesado lo hace el bucle de herramientas de ECLIPSE, que ya existía
 * y ya funciona. Un agente no necesitaba un motor nuevo: necesitaba límites.
 */

export interface Resultado {
  ok: boolean;
  texto: string;
  /** Lo que ha tocado de verdad, para poder enseñarlo. */
  acciones: { nombre: string; detalle: string; ok: boolean }[];
  /** Lo que se ha quedado esperando aprobación. */
  enEspera: number;
  error?: string;
}

/**
 * Cuánto se le deja trabajar de una vez.
 *
 * Cuarenta y cinco segundos de los sesenta del hosting. El mismo número que los
 * encargos programados, y por lo mismo: con noventa, quien mata la función es
 * el hosting, y una función muerta no apunta nada —ni el resultado, ni el
 * fallo, ni que se intentó—.
 */
const LIMITE_MS = 45_000;

/**
 * La herramienta de conexiones de ESTE agente.
 *
 * Dos recortes encima de la de siempre, y los dos importan:
 *
 * - Solo sus servicios. A ECLIPSE COMMS no se le ponen delante las acciones de
 *   la tienda: no es que no deba usarlas, es que no las tiene.
 * - Si el cliente no le ha dado permiso de escritura, o ha pedido aprobar antes,
 *   lo que escribe se intercepta AQUÍ. El modelo recibe "queda pendiente de
 *   aprobación" y eso es exactamente lo que ha pasado.
 */
async function conexionesDelAgente(opts: {
  email: string;
  agente: Agente;
  config: ConfigAgente;
  servicios: string[];
}): Promise<Herramienta | null> {
  const todas = await misConexiones(opts.email);
  const suyas = todas.filter((c) => opts.servicios.includes(c.servicio));
  if (!suyas.length) return null;

  const base = await herramientaConexion(suyas, opts.email);
  if (!base) return null;

  return {
    ...base,
    async ejecutar(args, ctx) {
      const servicio = typeof args.servicio === "string" ? args.servicio : "";
      const accion = typeof args.accion === "string" ? args.accion : "";
      const datos =
        args.datos && typeof args.datos === "object" && !Array.isArray(args.datos)
          ? (args.datos as Record<string, unknown>)
          : {};

      // Doble llave: aunque el modelo se invente un servicio, aquí no pasa.
      if (!opts.servicios.includes(servicio))
        return {
          texto: "",
          error: `Este agente no tiene acceso a ${servicio}. Sus cuentas son: ${opts.servicios.join(", ")}.`,
        };

      const definicion = servicioDe(servicio);
      const laAccion = definicion?.acciones.find((a) => a.nombre === accion);
      const escribe = Boolean(laAccion?.escribe);

      if (escribe && !opts.config.puedeEscribir)
        return {
          texto: "",
          error:
            "Este agente está en solo lectura: puede mirarlo todo, pero no cambiar nada. Se activa la escritura en su panel.",
        };

      /*
        Aprobación humana: se PARA, no se hace y se avisa.

        Es la diferencia entre un aviso y un freno. Si se ejecutara y después se
        pidiera permiso, el permiso no sería permiso: sería una notificación de
        algo que ya no tiene vuelta atrás.
      */
      if (escribe && opts.config.apruebaAntes) {
        const pendiente = await dejarPendiente(opts.email, {
          agenteId: opts.agente.id,
          servicio,
          accion,
          datos,
          porque: `${opts.agente.nombre} quería ${accion.replace(/_/g, " ")} en ${definicion?.nombre ?? servicio}.`,
        });
        return {
          texto: `NO EJECUTADO. Esta acción escribe en ${definicion?.nombre ?? servicio} y este agente necesita aprobación humana. Queda pendiente (${pendiente.id}) para que alguien la apruebe desde el panel. Cuéntaselo así a quien te lo ha pedido: que está preparada y esperando, NO que está hecha.`,
        };
      }

      ctx.avisar?.(`${definicion?.nombre ?? servicio}: ${accion.replace(/_/g, " ")}`);
      const r = await ejecutarConexion({ servicio, accion, datos, signal: ctx.signal, dueno: opts.email });

      await apuntar(opts.email, opts.agente.id, {
        tipo: r.error ? "error" : "accion",
        texto: `${definicion?.nombre ?? servicio}: ${accion.replace(/_/g, " ")}`,
        detalle: r.error ?? `${r.texto.slice(0, 200)}${r.texto.length > 200 ? "…" : ""}`,
        ok: !r.error,
      });

      return r.error ? { texto: "", error: r.error } : { texto: r.texto };
    },
  };
}

/** Las herramientas que le tocan a este agente, montadas de verdad. */
async function herramientasDelAgente(opts: {
  email: string;
  agente: Agente;
  config: ConfigAgente;
  servicios: string[];
}): Promise<Herramienta[]> {
  const permitidas = new Set(herramientasDe(opts.agente, opts.config));

  // Las del catálogo fijo: se piden todas las del chat y se filtran por las
  // suyas. Así una herramienta nueva de ECLIPSE no hay que apuntarla aquí.
  const delCatalogo = (await herramientasPara("chat", "pro", undefined, opts.email)).filter(
    (h) => h.nombre !== "conexion" && permitidas.has(h.nombre),
  );

  const salida = [...delCatalogo];
  if (permitidas.has("conexion")) {
    const suya = await conexionesDelAgente(opts);
    if (suya) salida.push(suya);
  }
  return salida;
}

/** Ponerle un encargo a un agente y devolver lo que ha hecho. */
export async function encargar(opts: {
  email: string;
  agenteId: string;
  encargo: string;
  signal?: AbortSignal;
}): Promise<Resultado> {
  const agente = agenteDe(opts.agenteId);
  if (!agente) return { ok: false, texto: "", acciones: [], enEspera: 0, error: "Ese agente no existe." };

  const contrato = await contratoDe(opts.email, opts.agenteId);
  const conectados = (await misConexiones(opts.email)).map((c) => c.servicio);
  const diagnostico = estadoDe(agente, conectados);

  const permiso = puedeTrabajar(contrato, diagnostico);
  if (!permiso.puede)
    return { ok: false, texto: "", acciones: [], enEspera: 0, error: permiso.porque };

  const provider = await activeProvider();
  if (!provider || provider === "anthropic" || provider === "google")
    return {
      ok: false,
      texto: "",
      acciones: [],
      enEspera: 0,
      error:
        "Los agentes necesitan un motor con herramientas puesto en el servidor (Mistral, Groq u OpenRouter).",
    };

  const key = await resolveKey(provider);
  if (!key)
    return {
      ok: false,
      texto: "",
      acciones: [],
      enEspera: 0,
      error: "La clave del motor no está en el servidor. Un agente trabaja sin nadie delante y la necesita ahí.",
    };

  const servicios = serviciosDe(agente, conectados);
  const config = contrato!.config;
  const herramientas = await herramientasDelAgente({ email: opts.email, agente, config, servicios });

  const sistema = [
    agente.instrucciones,
    servicios.length
      ? `Cuentas conectadas de esta empresa, y las ÚNICAS que puedes tocar:\n${servicios
          .map((s) => `- ${servicioDe(s)?.nombre ?? s}`)
          .join("\n")}`
      : `Esta empresa no tiene ninguna cuenta conectada todavía. No puedes consultar sus datos: dilo así y di qué haría falta conectar.`,
    config.puedeEscribir
      ? config.apruebaAntes
        ? "Puedes escribir en esas cuentas, pero cada cambio espera aprobación humana. Cuando dejes algo pendiente, dilo como lo que es: preparado y esperando, no hecho."
        : "Puedes escribir en esas cuentas. Mira antes de tocar."
      : "Estás en SOLO LECTURA: puedes mirarlo todo y no cambiar nada. Si te piden un cambio, dilo y prepara lo que haga falta.",
  ].join("\n\n");

  const reloj = AbortSignal.timeout(LIMITE_MS);
  const acciones: Resultado["acciones"] = [];
  let texto = "";

  /*
    Cuántas quedan esperando se cuenta mirando la COLA, antes y después.
    Adivinarlo por el texto de la herramienta era leer un resumen de la llamada,
    no del resultado: decía cuántas veces se pidió, no cuántas se pararon.
  */
  const colaAntes = (await pendientesDe(opts.email)).length;

  try {
    for await (const evento of conversarConHerramientas({
      provider: provider as CompatProvider,
      key,
      system: sistema,
      turns: [{ role: "user", content: opts.encargo }],
      speed: "equilibrado",
      mode: "chat",
      plan: "pro",
      dueno: opts.email,
      herramientas,
      signal: opts.signal ?? reloj,
    })) {
      if (evento.texto) texto += evento.texto;
      if (evento.hecha)
        acciones.push({ nombre: evento.hecha.nombre, detalle: evento.hecha.detalle, ok: evento.hecha.ok });
    }
  } catch (err) {
    const porque =
      (err as Error)?.name === "TimeoutError"
        ? "Ha tardado demasiado y se ha cortado."
        : err instanceof Error
          ? err.message
          : "Ha fallado sin decir por qué.";
    await apuntar(opts.email, agente.id, { tipo: "error", texto: "El encargo ha fallado.", detalle: porque, ok: false });
    return { ok: false, texto, acciones, enEspera: (await pendientesDe(opts.email)).length - colaAntes, error: porque };
  }

  const enEspera = (await pendientesDe(opts.email)).length - colaAntes;
  const limpio = texto.trim();
  await apuntar(opts.email, agente.id, {
    tipo: "encargo",
    texto: opts.encargo.slice(0, 160),
    detalle: limpio.slice(0, 300),
    ok: Boolean(limpio),
  });

  return limpio
    ? { ok: true, texto: limpio, acciones, enEspera }
    : { ok: false, texto: "", acciones, enEspera, error: "No ha escrito nada." };
}

/**
 * Aprobar algo que estaba esperando, y ejecutarlo ahora de verdad.
 *
 * Ejecutar aquí y no volver a pedírselo al modelo es lo correcto: lo que se
 * aprueba es ESTA acción con ESTOS datos, y volver a preguntarle podría
 * devolver otra cosa distinta de la que la persona aprobó.
 */
export async function aprobar(
  email: string,
  id: string,
): Promise<{ ok: boolean; texto?: string; error?: string }> {
  const pendiente = await quitarPendiente(email, id);
  if (!pendiente) return { ok: false, error: "Eso ya no está esperando." };

  const contrato = await contratoDe(email, pendiente.agenteId);
  if (!contrato || contrato.estado !== "activo")
    return { ok: false, error: "Ese agente ya no está activo." };

  const r = await ejecutarConexion({
    servicio: pendiente.servicio,
    accion: pendiente.accion,
    datos: pendiente.datos,
    dueno: email,
  });

  await apuntar(email, pendiente.agenteId, {
    tipo: r.error ? "error" : "accion",
    texto: `Aprobado y ejecutado: ${pendiente.accion.replace(/_/g, " ")} en ${pendiente.servicio}`,
    detalle: r.error ?? r.texto.slice(0, 200),
    ok: !r.error,
  });

  return r.error ? { ok: false, error: r.error } : { ok: true, texto: r.texto };
}

/** Descartar algo que esperaba. No se ejecuta y queda dicho que se descartó. */
export async function descartar(email: string, id: string): Promise<boolean> {
  const pendiente = await quitarPendiente(email, id);
  if (!pendiente) return false;
  await apuntar(email, pendiente.agenteId, {
    tipo: "aprobacion",
    texto: `Descartado: ${pendiente.accion.replace(/_/g, " ")} en ${pendiente.servicio}`,
    detalle: "No se ha ejecutado.",
    ok: true,
  });
  return true;
}
