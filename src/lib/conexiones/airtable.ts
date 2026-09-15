import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Airtable: la hoja de cálculo que mucha gente usa de base de datos.
 *
 * Aquí hay pedidos, clientes, contenido pendiente y stock de medio mundo que no
 * ha montado nunca una base de datos. Leer de ahí es leer cómo va el trabajo.
 *
 * Puede escribir, pero solo AÑADIR filas: ni cambiar ni borrar una existente.
 * Añadir de más deja una fila que se ve y se quita a mano en dos segundos;
 * cambiar una que estaba bien no se nota hasta que alguien la busca.
 */

function url(camino: string): string {
  return `${baseDe("airtable", "https://api.airtable.com")}/v0/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.token}` };
}

/** Un valor de celda puede ser texto, número, lista o ficha enlazada. */
function celda(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(celda).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as { name?: string; email?: string; url?: string };
    return o.name ?? o.email ?? o.url ?? "";
  }
  return String(v);
}

export const airtable: Servicio = {
  id: "airtable",
  nombre: "Airtable",
  color: "#18BFFF",
  marca: "At",
  familia: "trabajo",
  resumen:
    "Tus bases de Airtable: mirar filas, buscar y añadir. No cambia ni borra lo que ya está.",
  pasos: [
    "Entra en airtable.com/create/tokens y pulsa «Create new token».",
    "Ponle nombre y dale los permisos data.records:read y schema.bases:read (y data.records:write solo si quieres que pueda añadir filas).",
    "En «Access», elige las bases a las que quieres que llegue. Con las que necesites basta.",
    "Copia el token que empieza por pat. No se vuelve a enseñar.",
  ],
  enlace: "https://airtable.com/create/tokens",
  campos: [
    {
      id: "token",
      etiqueta: "Token de acceso",
      ayuda: "Empieza por pat. Es el que Airtable llama «personal access token».",
      placeholder: "pat…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      const bases = await pedir<{ bases?: { id: string; name: string }[] }>(
        "Airtable",
        url("meta/bases"),
        { cabeceras: cabeceras(cred), signal },
      );

      const lista = bases.bases ?? [];
      if (!lista.length)
        return {
          ok: false,
          error:
            "El token vale, pero no le has dado acceso a ninguna base. Vuelve a Airtable y añádele las bases que quieras que vea.",
        };

      return {
        ok: true,
        cuenta: `${lista.length} base(s): ${lista.slice(0, 3).map((b) => b.name).join(", ")}${
          lista.length > 3 ? "…" : ""
        }`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_bases",
      descripcion: "Las bases a las que ECLIPSE tiene acceso, con su identificador.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{ bases?: { id: string; name: string }[] }>(
          "Airtable",
          url("meta/bases"),
          { cabeceras: cabeceras(cred), signal },
        );
        const lista = r.bases ?? [];
        if (!lista.length) return "El token no tiene acceso a ninguna base.";
        return lista.map((b) => `${b.name} (${b.id})`).join("\n");
      },
    },
    {
      nombre: "ver_tablas",
      descripcion: "Qué tablas tiene una base y qué columnas tiene cada tabla.",
      argumentos: "base (el identificador, empieza por app)",
      async ejecutar({ cred, args, signal }) {
        const base = texto(args.base, 40);
        if (!base) return "Falta el identificador de la base. Sácalo de listar_bases.";

        const r = await pedir<{
          tables?: { id: string; name: string; fields?: { name: string; type: string }[] }[];
        }>("Airtable", url(`meta/bases/${encodeURIComponent(base)}/tables`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const tablas = r.tables ?? [];
        if (!tablas.length) return "Esa base no tiene tablas.";

        return tablas
          .map(
            (t) =>
              `${t.name}: ${(t.fields ?? []).map((f) => `${f.name} (${f.type})`).join(", ") || "sin columnas"}`,
          )
          .join("\n");
      },
    },
    {
      nombre: "listar_filas",
      descripcion:
        "Las filas de una tabla. Para responder qué hay pendiente, qué clientes hay o cómo va algo.",
      argumentos: "base, tabla (el nombre), limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const base = texto(args.base, 40);
        const tabla = texto(args.tabla, 80);
        if (!base || !tabla) return "Hacen falta la base y la tabla.";

        const r = await pedir<{ records?: { id: string; fields?: Record<string, unknown> }[] }>(
          "Airtable",
          url(
            `${encodeURIComponent(base)}/${encodeURIComponent(tabla)}?maxRecords=${tope(
              args.limite,
              20,
              50,
            )}`,
          ),
          { cabeceras: cabeceras(cred), signal },
        );

        const filas = r.records ?? [];
        if (!filas.length) return `«${tabla}» está vacía.`;

        return filas
          .map((f) => {
            const campos = Object.entries(f.fields ?? {})
              .map(([k, v]) => `${k}: ${celda(v)}`)
              .filter((t) => !t.endsWith(": "))
              .join(" · ");
            return `${campos || "(fila vacía)"} [${f.id}]`;
          })
          .join("\n");
      },
    },
    {
      nombre: "crear_fila",
      descripcion:
        "Añade una fila a una tabla. Solo añade: no cambia ni borra nada de lo que ya estaba.",
      escribe: true,
      argumentos: "base, tabla, campos (objeto con columna: valor)",
      async ejecutar({ cred, args, signal }) {
        const base = texto(args.base, 40);
        const tabla = texto(args.tabla, 80);
        const campos = args.campos as Record<string, unknown> | undefined;
        if (!base || !tabla) return "Hacen falta la base y la tabla.";
        if (!campos || typeof campos !== "object" || !Object.keys(campos).length)
          return "No hay nada que escribir: faltan los campos de la fila.";

        const r = await pedir<{ id?: string }>(
          "Airtable",
          url(`${encodeURIComponent(base)}/${encodeURIComponent(tabla)}`),
          {
            metodo: "POST",
            cabeceras: cabeceras(cred),
            cuerpo: { fields: campos, typecast: true },
            signal,
          },
        );

        return `Fila añadida a «${tabla}»${r.id ? ` (${r.id})` : ""}.`;
      },
    },
  ],
};
