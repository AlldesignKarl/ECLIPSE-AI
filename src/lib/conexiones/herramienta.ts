import { misConexiones, type Resumen } from "./almacen";
import { ejecutarConexion, servicioDe } from "./registro";
import type { Herramienta } from "../tools/tipos";

/**
 * Una sola herramienta para todas las conexiones, y no una por acción.
 *
 * Con cinco servicios y cuatro o cinco acciones cada uno saldrían más de veinte
 * herramientas, y cada una viaja entera —nombre, descripción y esquema— en cada
 * mensaje. Eso son miles de tokens del cupo por minuto gastados en anunciar
 * cosas que casi nunca se usan, y en las capas gratuitas ese cupo es justo lo
 * que falta para terminar una respuesta larga.
 *
 * Así que hay una: `conexion`. Y su descripción se escribe en el momento, con
 * lo que esta persona tiene conectado de verdad. Quien no ha conectado nada no
 * la ve siquiera; quien tiene Shopify ve las acciones de Shopify y ninguna más.
 * Anunciarle a un modelo cosas que no puede hacer es pedirle que las intente.
 */
export async function herramientaConexion(
  /** Las conexiones ya leídas, si quien llama las tiene. Si no, se leen aquí. */
  yaLeidas?: Resumen[],
): Promise<Herramienta | null> {
  const conectadas = yaLeidas ?? (await misConexiones());
  if (!conectadas.length) return null;

  const vivas = conectadas
    .map((c) => ({ conexion: c, servicio: servicioDe(c.servicio) }))
    .filter((x): x is { conexion: (typeof conectadas)[number]; servicio: NonNullable<ReturnType<typeof servicioDe>> } =>
      Boolean(x.servicio),
    );
  if (!vivas.length) return null;

  const catalogo = vivas
    .map(({ conexion, servicio }) => {
      const acciones = servicio.acciones
        // Lo que no se puede hacer no se anuncia: si está en solo lectura, las
        // acciones que escriben ni aparecen. Así no las intenta y no se lleva
        // un error que tenga que explicar.
        .filter((a) => !a.escribe || conexion.permiso === "escribir")
        .map((a) => `    · ${a.nombre}: ${a.descripcion}${a.argumentos ? ` [${a.argumentos}]` : ""}`)
        .join("\n");

      const soloLectura =
        conexion.permiso === "escribir"
          ? ""
          : " (SOLO LECTURA: puede mirarlo todo, pero no cambiar nada)";

      return `  ${servicio.id} — ${servicio.nombre}, ${conexion.cuenta}${soloLectura}\n${acciones}`;
    })
    .join("\n");

  const ids = vivas.map((v) => v.servicio.id);

  return {
    nombre: "conexion",
    descripcion: `Trabaja de verdad en las cuentas que el usuario ha conectado: su tienda, su web, sus dominios, su cartera. No devuelve consejos: hace la cosa y te cuenta qué ha pasado.

Conectado ahora mismo:
${catalogo}

Cómo usarla: servicio + accion + datos. Por ejemplo servicio "shopify", accion "listar_productos", datos {"limite": 20}.

Reglas:
- Mira antes de tocar. Para cambiar un producto hace falta saber cómo está: primero listar o ver, después actualizar.
- Una acción por llamada, y con los datos que pide. Si te falta un id, búscalo antes con la acción de listar.
- Lo que no esté en la lista de arriba, no existe: no te inventes acciones ni servicios.
- Si algo está en SOLO LECTURA y el usuario quiere cambios, dile que lo active en Conexiones. No lo intentes por otro camino.`,
    parametros: {
      type: "object",
      properties: {
        servicio: {
          type: "string",
          enum: ids,
          description: "Cuál de las cuentas conectadas.",
        },
        accion: {
          type: "string",
          description: "El nombre exacto de una de las acciones de ese servicio.",
        },
        datos: {
          type: "object",
          description: "Los datos que pida la acción. Vacío si no pide ninguno.",
        },
      },
      required: ["servicio", "accion"],
    },
    soloPro: true,
    disponible: () => true,

    async ejecutar(args, ctx) {
      const servicio = typeof args.servicio === "string" ? args.servicio : "";
      const accion = typeof args.accion === "string" ? args.accion : "";
      const datos =
        args.datos && typeof args.datos === "object" && !Array.isArray(args.datos)
          ? (args.datos as Record<string, unknown>)
          : {};

      if (!servicio || !accion)
        return { texto: "", error: "Hay que decir qué servicio y qué acción." };

      ctx.avisar?.(`${servicioDe(servicio)?.nombre ?? servicio}: ${accion.replace(/_/g, " ")}`);

      const r = await ejecutarConexion({ servicio, accion, datos, signal: ctx.signal });
      return r.error ? { texto: "", error: r.error } : { texto: r.texto };
    },
  };
}
