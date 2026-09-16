/**
 * Agentes de ECLIPSE: qué es un agente y qué puede hacer de verdad.
 *
 * Un agente NO es "ECLIPSE con otro texto delante". Si lo fuera, cinco tarjetas
 * con cinco prompts distintos darían exactamente el mismo trabajo hecho por el
 * mismo sitio, y el cliente lo notaría el primer día. Un agente aquí es:
 *
 *   modelo + instrucciones + HERRAMIENTAS RECORTADAS + integraciones que
 *   necesita + permisos + memoria de lo que ha hecho + registro + aprobación
 *   humana para lo que toca fuera.
 *
 * Y de todo eso, lo que de verdad lo convierte en un agente distinto es el
 * recorte de herramientas: ECLIPSE COMMS no tiene delante las acciones de la
 * tienda, así que no puede tocarlas aunque quisiera. Pedírselo por prompt es
 * confiar en que haga caso; quitárselo de la lista es que no exista.
 *
 * La otra regla de esta casa está aquí abajo, en `estadoDe`: un agente que
 * necesita Gmail y no tiene Gmail conectado NO está "listo con limitaciones".
 * Está en REQUIERE CONEXIÓN, se dice así, y sus acciones no se ofrecen. Nada de
 * aparentar.
 *
 * Todo este archivo es puro —sin red, sin base de datos y sin modelo— para
 * poder comprobarlo entero en milisegundos.
 */

/** Cada cuánto se cobra. De momento solo hay mensual, pero se dice. */
export type Periodo = "mes";

/**
 * Una integración que un agente necesita o aprovecha.
 *
 * `servicio` es el id de un conector de `lib/conexiones` cuando existe. Cuando
 * todavía NO existe —Gmail, Outlook, WhatsApp: piden OAuth, que es un trabajo
 * aparte— se pone igual, con `pendiente: true`. Eso es lo que hace que la
 * pantalla pueda decir la verdad en vez de esconderlo.
 */
export interface Integracion {
  servicio: string;
  nombre: string;
  /** Sin esto el agente no puede trabajar; con las opcionales, hace más. */
  necesaria: boolean;
  /**
   * El conector todavía no existe en ECLIPSE.
   *
   * No es un fallo: es el estado real. Gmail, Outlook, Google Calendar, Drive y
   * WhatsApp Business se conectan por OAuth, que es montar la pantalla de
   * permisos, la vuelta con el código, el refresco del testigo y dónde
   * guardarlo. Hasta que eso exista, decir que el agente "ya puede mandar
   * correos" sería mentir.
   */
  pendiente?: boolean;
}

export interface Agente {
  id: string;
  nombre: string;
  /** En euros al mes. Se cambia aquí y cambia en toda la aplicación. */
  precio: number;
  periodo: Periodo;
  /** Una línea, la de la tarjeta. */
  resumen: string;
  /** Qué hace, para la ficha. Un párrafo. */
  descripcion: string;
  /** Lo que sabe hacer, en frases que entiende quien paga. */
  funciones: string[];
  /** Ejemplos de encargos de verdad, de los que se le pueden dar hoy. */
  ejemplos: string[];
  integraciones: Integracion[];
  /**
   * Las herramientas del catálogo de ECLIPSE que puede usar.
   *
   * `conexion` es la de las cuentas conectadas y se fabrica al vuelo con SUS
   * servicios y ninguno más.
   */
  herramientas: string[];
  /** Sus instrucciones. Lo que le hace especialista. */
  instrucciones: string;
  /**
   * Si por defecto necesita que un humano apruebe lo que escribe fuera.
   *
   * Los que tocan clientes vienen con esto encendido: un correo mal mandado no
   * se puede recoger. Se puede apagar, pero se apaga a propósito.
   */
  apruebaPorDefecto: boolean;
  /** El color de su tarjeta. Del tema, no inventado. */
  tono: "pro" | "ok" | "halo" | "tuyo";
}

/* -------------------------------------------------------------------------- */
/*                        Lo que cada cliente contrata                        */
/* -------------------------------------------------------------------------- */

export type EstadoContrato =
  /** Contratado y trabajando. */
  | "activo"
  /** Contratado y parado por su dueño. No ejecuta nada. */
  | "pausado"
  /**
   * Contratado pero sin cobrar.
   *
   * Existe porque cobrar de verdad necesita Stripe configurado, y mientras no
   * lo esté, lo honesto es dejar el contrato en este estado y decirlo. Lo que
   * NO se hace nunca es dar un contrato por pagado sin que haya habido un pago.
   */
  | "pendiente_de_pago";

export interface ConfigAgente {
  /** Herramientas apagadas a mano por el cliente. */
  apagadas: string[];
  /** Si puede ESCRIBIR en las cuentas conectadas, o solo mirar. */
  puedeEscribir: boolean;
  /** Si lo que escribe fuera espera a que alguien lo apruebe. */
  apruebaAntes: boolean;
}

export interface Contratado {
  agenteId: string;
  estado: EstadoContrato;
  desde: number;
  config: ConfigAgente;
  /** El identificador de la suscripción de Stripe, cuando la haya. */
  suscripcion?: string;
}

/** Una línea del registro. Lo que pasó de verdad, con su hora. */
export interface Apunte {
  id: string;
  agenteId: string;
  cuando: number;
  tipo: "encargo" | "accion" | "error" | "aprobacion" | "estado";
  /** Lo que se cuenta, en una línea. */
  texto: string;
  /** Qué herramienta o acción fue, si la hubo. */
  detalle?: string;
  ok: boolean;
}

/**
 * Algo que el agente quiere hacer fuera y espera aprobación.
 *
 * Esto NO está hecho. Está pedido y parado. Se guarda lo justo para poder
 * ejecutarlo después tal cual, sin que el agente tenga que volver a decidirlo.
 */
export interface Pendiente {
  id: string;
  agenteId: string;
  cuando: number;
  servicio: string;
  accion: string;
  datos: Record<string, unknown>;
  /** Por qué lo pedía, con las palabras del agente. */
  porque: string;
}

export const MAX_APUNTES = 200;
export const MAX_PENDIENTES = 50;

export function configPorDefecto(agente: Agente): ConfigAgente {
  return {
    apagadas: [],
    // Solo lectura de salida, como toda conexión nueva de ECLIPSE. Escribir en
    // las cuentas de una empresa es una segunda decisión, no una herencia.
    puedeEscribir: false,
    apruebaAntes: agente.apruebaPorDefecto,
  };
}

/* -------------------------------------------------------------------------- */
/*                   Qué puede hacer HOY, sin aparentar nada                  */
/* -------------------------------------------------------------------------- */

export type Estado = "listo" | "requiere_conexion" | "sin_conector";

export interface Diagnostico {
  estado: Estado;
  /** Las necesarias que no están conectadas. */
  faltan: Integracion[];
  /** Las que aún no existen en ECLIPSE y hay que construir. */
  sinConector: Integracion[];
  /** Las que sí están conectadas y funcionando. */
  listas: Integracion[];
  /** Qué se le dice a quien lo mira. Una frase. */
  dice: string;
}

/**
 * En qué estado está este agente para ESTE cliente.
 *
 * Tres estados y no dos, y la diferencia importa mucho:
 *
 * - `listo`: puede trabajar de verdad ahora mismo.
 * - `requiere_conexion`: el conector existe, pero esta empresa no ha pegado su
 *   clave. Lo arregla el cliente en dos minutos.
 * - `sin_conector`: ECLIPSE todavía no sabe hablar con ese servicio. Eso NO lo
 *   arregla el cliente: lo arreglamos nosotros, y hay que decirlo así en vez de
 *   dejarle buscando un botón que no existe.
 */
export function estadoDe(agente: Agente, conectados: string[]): Diagnostico {
  const tiene = new Set(conectados);

  const necesarias = agente.integraciones.filter((i) => i.necesaria);
  const faltan = necesarias.filter((i) => !i.pendiente && !tiene.has(i.servicio));
  const listas = agente.integraciones.filter((i) => !i.pendiente && tiene.has(i.servicio));

  /*
    Lo que todavía no se puede conectar se cuenta SIEMPRE, sea necesario o no.

    Un agente de comunicaciones puede trabajar con Slack aunque Gmail no exista
    todavía —Gmail es opcional— pero si se calla, quien lo contrata se cree que
    va a mandar correos. Así que el ESTADO lo deciden solo las necesarias, y lo
    que se DICE cuenta todas: es la diferencia entre "no puede trabajar" y "esto
    concreto todavía no está".
  */
  const sinConector = agente.integraciones.filter((i) => i.pendiente);
  const bloquea = sinConector.filter((i) => i.necesaria);

  /*
    Manda lo que el cliente NO puede arreglar.

    Si a un agente le falta Gmail —que no existe— y además Notion —que sí—, lo
    honesto es decir primero que Gmail no está hecho. Enseñarle "conecta Notion"
    y que después siga sin funcionar es la peor forma de contarlo.
  */
  // Lo que no se puede conectar todavía, dicho siempre que lo haya.
  const aviso = sinConector.length
    ? ` Todavía no se puede conectar ${sinConector.map((i) => i.nombre).join(", ")}.`
    : "";

  if (bloquea.length)
    return {
      estado: "sin_conector",
      faltan,
      sinConector,
      listas,
      dice: `No puede trabajar: todavía no se puede conectar ${bloquea
        .map((i) => i.nombre)
        .join(", ")}.`,
    };

  if (faltan.length)
    return {
      estado: "requiere_conexion",
      faltan,
      sinConector,
      listas,
      dice: `Requiere conexión: ${faltan.map((i) => i.nombre).join(", ")}.${aviso}`,
    };

  return {
    estado: "listo",
    faltan,
    sinConector,
    listas,
    dice:
      (listas.length
        ? `Listo, con ${listas.map((i) => i.nombre).join(", ")}.`
        : "Listo, pero sin ninguna cuenta conectada todavía: conecta alguna para que pueda trabajar con tus datos.") + aviso,
  };
}

/**
 * Los servicios que este agente puede tocar para este cliente.
 *
 * La intersección de tres cosas: los que el agente usa, los que existen de
 * verdad, y los que esta empresa tiene conectados. Lo que sale de aquí es lo
 * único que se le pone delante.
 */
export function serviciosDe(agente: Agente, conectados: string[]): string[] {
  const tiene = new Set(conectados);
  return agente.integraciones
    .filter((i) => !i.pendiente && tiene.has(i.servicio))
    .map((i) => i.servicio);
}

/** Las herramientas que le quedan después de lo que el cliente haya apagado. */
export function herramientasDe(agente: Agente, config: ConfigAgente): string[] {
  const apagadas = new Set(config.apagadas);
  return agente.herramientas.filter((h) => !apagadas.has(h));
}

/**
 * ¿Puede ejecutar ahora mismo, o hay que decir por qué no?
 *
 * Devuelve el motivo en cristiano cuando no. Nunca devuelve "listo" por si
 * acaso: si no puede, no puede, y quien lo lee tiene que saber qué hacer.
 */
export function puedeTrabajar(
  contrato: Contratado | null,
  diagnostico: Diagnostico,
): { puede: true } | { puede: false; porque: string } {
  if (!contrato) return { puede: false, porque: "Este agente no está contratado." };
  if (contrato.estado === "pausado")
    return { puede: false, porque: "Está en pausa. Se reactiva desde su panel." };
  if (contrato.estado === "pendiente_de_pago")
    return {
      puede: false,
      porque:
        "El contrato está pendiente de pago: el cobro todavía no está activado en este servidor.",
    };
  if (diagnostico.estado !== "listo") return { puede: false, porque: diagnostico.dice };
  return { puede: true };
}
