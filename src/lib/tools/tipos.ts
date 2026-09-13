import type { Plan, Source } from "../types";

/**
 * El contrato de una herramienta de ECLIPSE.
 *
 * Una herramienta es algo que el modelo puede *hacer*, no algo que puede
 * decir: buscar en la web, leer un archivo, generar un documento. El modelo
 * pide la llamada, el servidor la ejecuta y le devuelve el resultado; el
 * modelo nunca toca claves ni red por su cuenta.
 *
 * Todo lo que necesita una herramienta nueva está en esta interfaz. Añadir una
 * es escribir un archivo y registrarlo: no hay que tocar el bucle, ni la ruta
 * del chat, ni la interfaz.
 */

/** Un trozo de esquema JSON, que es como los modelos declaran parámetros. */
export interface EsquemaParametros {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/** Lo que la herramienta sabe del mundo cuando se ejecuta. */
export interface Contexto {
  plan: Plan;
  /** Para cortar si el usuario se cansa de esperar. */
  signal?: AbortSignal;
  /** Cuenta lo que va pasando, para poder enseñarlo en pantalla. */
  avisar?: (texto: string) => void;
}

export interface Resultado {
  /** Lo que ve el modelo. Texto, porque es lo que sabe leer. */
  texto: string;
  /** Fuentes encontradas, si las hubo: se pintan aparte en la interfaz. */
  fuentes?: Source[];
  /** Un archivo generado, listo para descargar. */
  archivo?: { nombre: string; mime: string; contenido: string; base64?: boolean };
  /** Si la herramienta no pudo hacer su trabajo, y por qué en cristiano. */
  error?: string;
}

export interface Herramienta {
  /** En minúsculas y sin espacios: es lo que escribe el modelo al llamarla. */
  nombre: string;
  /**
   * Para qué sirve, escrito para el modelo. Es el texto que decide si la usa
   * bien o mal, así que dice también CUÁNDO no usarla.
   */
  descripcion: string;
  parametros: EsquemaParametros;
  /**
   * Si hace falta preguntar antes. Se reserva para lo que sale de la
   * conversación —gastar cuota cara, escribir fuera— no para leer.
   */
  confirmar?: boolean;
  /** Solo para el plan Pro. */
  soloPro?: boolean;
  /**
   * Si en este servidor puede funcionar de verdad. Una herramienta sin su
   * clave no se le ofrece al modelo: prometerle algo que va a fallar es peor
   * que no tenerlo, porque lo intenta igual y se queda sin respuesta.
   */
  disponible: () => boolean | Promise<boolean>;
  ejecutar: (args: Record<string, unknown>, ctx: Contexto) => Promise<Resultado>;
}
