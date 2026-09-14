/**
 * Conectar ECLIPSE a las aplicaciones donde la gente tiene su negocio.
 *
 * Hasta ahora ECLIPSE sabía *decir* cosas sobre una tienda: qué producto falta,
 * cómo mejorar un título para Google, qué registro DNS hay que tocar. Pero
 * había que salir de la aplicación, abrir el panel de Shopify o de IONOS y
 * hacerlo a mano. Una conexión es el puente que faltaba: el usuario pega la
 * clave de su servicio una vez, y a partir de ahí ECLIPSE lee y —si le da
 * permiso— cambia las cosas él mismo.
 *
 * Tres reglas que no se saltan:
 *
 * 1. La clave nunca sale de aquí. No se le enseña al modelo, no vuelve al
 *    navegador y no se escribe en ningún registro. El modelo pide "lista los
 *    productos"; quien tiene la clave y llama a Shopify es el servidor.
 * 2. Escribir se pide aparte. Cada conexión nace en SOLO LECTURA. Tocar el
 *    negocio de alguien es un permiso que se da a propósito, no algo que se
 *    hereda por haber conectado la cuenta.
 * 3. No se borra nada. No hay ni una acción que elimine un producto, una zona
 *    o un registro. Equivocarse creando es un momento; equivocarse borrando,
 *    en la tienda de la que alguien vive, no tiene vuelta atrás.
 */

/** Qué se le deja hacer a ECLIPSE en esta cuenta. */
export type Permiso = "leer" | "escribir";

/** Un dato que hay que pedirle al usuario para conectar. */
export interface Campo {
  /** Clave interna, la que viaja en el JSON. */
  id: string;
  etiqueta: string;
  ayuda: string;
  placeholder?: string;
  /**
   * Se escribe como una contraseña y no vuelve NUNCA al navegador. Lo que no
   * es secreto (el dominio de la tienda) sí, porque hace falta para enseñar a
   * cuál está conectado.
   */
  secreto?: boolean;
}

/** Las credenciales de una conexión, tal y como las guarda el almacén. */
export type Credenciales = Record<string, string>;

/** Lo que sabe una acción cuando se ejecuta. */
export interface CtxAccion {
  cred: Credenciales;
  args: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Accion {
  /** `listar_productos`. En minúsculas: es lo que escribe el modelo. */
  nombre: string;
  /** Para qué sirve, escrito para el modelo. */
  descripcion: string;
  /** Cambia algo en la cuenta del usuario: exige permiso de escritura. */
  escribe?: boolean;
  /** Qué argumentos acepta, en cristiano, para la descripción de la herramienta. */
  argumentos?: string;
  ejecutar: (ctx: CtxAccion) => Promise<string>;
}

export interface Servicio {
  /** `shopify`. Es la clave de todo: URL, almacén y llamadas del modelo. */
  id: string;
  nombre: string;
  /**
   * Su color oficial y sus iniciales.
   *
   * El logo que se ve en pantalla NO es esto: está dibujado en
   * `conexiones/logos.ts`, trazo a trazo, porque enlazarlo desde la web de cada
   * marca sería usar su ancho de banda y dejar la pantalla dependiendo de que
   * no muevan un archivo. Esto es el recambio para un servicio que todavía no
   * tenga su dibujo: su color exacto con sus iniciales encima, que se reconoce
   * y nunca se rompe.
   */
  color: string;
  marca: string;
  /** Para agrupar en la pantalla de Conexiones. */
  familia: "tienda" | "web" | "dominio" | "mercado" | "trabajo" | "dinero" | "mensajes";
  /** Una línea de qué se puede hacer conectándolo. */
  resumen: string;
  /** Cómo conseguir la clave, paso a paso y sin dar nada por sabido. */
  pasos: string[];
  /** Dónde se saca, para poder pulsarlo. */
  enlace: string;
  campos: Campo[];
  /**
   * Comprueba que las credenciales sirven ANTES de guardarlas, y devuelve a
   * qué cuenta pertenecen. Guardar una clave mala es condenar al usuario a
   * descubrirlo tres días después, cuando le falle algo por otro motivo.
   */
  verificar: (
    cred: Credenciales,
    signal?: AbortSignal,
  ) => Promise<{ ok: true; cuenta: string } | { ok: false; error: string }>;
  acciones: Accion[];
}

/** Lo que se le cuenta al navegador de una conexión. Nunca la clave. */
export interface EstadoConexion {
  id: string;
  nombre: string;
  color: string;
  marca: string;
  familia: Servicio["familia"];
  resumen: string;
  pasos: string[];
  enlace: string;
  campos: Campo[];
  conectado: boolean;
  /** A qué cuenta: "la tienda mitienda.myshopify.com". */
  cuenta?: string;
  permiso?: Permiso;
  conectadoEl?: number;
  /** Qué sabe hacer, para que se vea antes de conectar. */
  acciones: { nombre: string; descripcion: string; escribe: boolean }[];
}
