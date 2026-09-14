import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Notion: donde mucha gente tiene TODO.
 *
 * Notas, tareas, clientes, inventario, el calendario editorial. Es el sitio
 * donde se apunta lo que luego hay que hacer, y por eso conectarlo cambia el
 * tipo de pregunta que se le puede hacer a ECLIPSE: deja de ser "¿cómo
 * organizo esto?" y pasa a ser "mira lo que tengo pendiente y ordénamelo".
 *
 * Se conecta con una integración interna, que da un token permanente. Lo que
 * mucha gente no sabe —y es donde se atasca— es que además hay que COMPARTIR
 * cada página con la integración: el token por sí solo no ve nada.
 */

function url(camino: string): string {
  return `${baseDe("notion", "https://api.notion.com")}/v1/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return {
    Authorization: `Bearer ${cred.token}`,
    "Notion-Version": "2022-06-28",
  };
}

interface Objeto {
  id: string;
  object: string;
  url?: string;
  properties?: Record<string, unknown>;
  title?: { plain_text?: string }[];
  parent?: { type?: string };
}

/** El título de una página o base de datos, que Notion esconde de mil maneras. */
function tituloDe(o: Objeto): string {
  if (Array.isArray(o.title) && o.title.length)
    return o.title.map((t) => t.plain_text ?? "").join("").trim() || "sin título";

  for (const valor of Object.values(o.properties ?? {})) {
    const p = valor as { type?: string; title?: { plain_text?: string }[] };
    if (p?.type === "title" && Array.isArray(p.title))
      return p.title.map((t) => t.plain_text ?? "").join("").trim() || "sin título";
  }
  return "sin título";
}

/** El texto llano de un bloque, sea del tipo que sea. */
function textoDeBloque(b: Record<string, unknown>): string {
  const tipo = String(b.type ?? "");
  const cuerpo = b[tipo] as { rich_text?: { plain_text?: string }[] } | undefined;
  const escrito = (cuerpo?.rich_text ?? []).map((t) => t.plain_text ?? "").join("");
  if (!escrito) return "";
  if (tipo === "heading_1") return `# ${escrito}`;
  if (tipo === "heading_2") return `## ${escrito}`;
  if (tipo === "heading_3") return `### ${escrito}`;
  if (tipo === "bulleted_list_item" || tipo === "numbered_list_item") return `- ${escrito}`;
  if (tipo === "to_do")
    return `- [${(cuerpo as { checked?: boolean })?.checked ? "x" : " "}] ${escrito}`;
  return escrito;
}

export const notion: Servicio = {
  id: "notion",
  nombre: "Notion",
  color: "#000000",
  marca: "N",
  familia: "trabajo",
  resumen:
    "Tus notas, tareas y bases de datos. Que ECLIPSE lea lo que tienes apuntado y escriba dentro, en vez de darte consejos sobre organizarte.",
  pasos: [
    "Entra en notion.so/my-integrations y pulsa «Nueva integración».",
    "Ponle de nombre ECLIPSE, elige tu espacio de trabajo y créala.",
    "Copia el «Internal Integration Secret»: empieza por ntn_ o secret_.",
    "IMPORTANTE y es donde se atasca todo el mundo: abre en Notion cada página o base de datos que quieras que vea, pulsa los tres puntos de arriba a la derecha → «Conexiones» → y elige ECLIPSE. Sin esto, el token no ve absolutamente nada.",
    "Pega aquí el secreto.",
  ],
  enlace: "https://www.notion.so/my-integrations",
  campos: [
    {
      id: "token",
      etiqueta: "Secreto de la integración",
      ayuda: "Empieza por ntn_ o secret_.",
      placeholder: "ntn_…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el secreto." };
    try {
      const yo = await pedir<{ name?: string; bot?: { workspace_name?: string } }>(
        "Notion",
        url("users/me"),
        { cabeceras: cabeceras(cred), signal },
      );
      const sitio = yo.bot?.workspace_name || yo.name || "tu espacio";

      // Cuántas páginas VE de verdad, que no es lo mismo que tener token.
      const visibles = await pedir<{ results?: Objeto[] }>("Notion", url("search"), {
        metodo: "POST",
        cabeceras: cabeceras(cred),
        cuerpo: { page_size: 5 },
        signal,
      }).catch(() => ({ results: [] }));

      const n = visibles.results?.length ?? 0;
      return {
        ok: true,
        cuenta: n
          ? `${sitio} · ve ${n === 5 ? "5 o más" : n} página(s)`
          : `${sitio} · TODAVÍA NO VE NINGUNA PÁGINA: compártelas con la integración desde Notion`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "buscar",
      descripcion:
        "Busca entre las páginas y bases de datos que se han compartido con ECLIPSE. Empieza siempre por aquí para encontrar el id de lo que quieras abrir.",
      argumentos: "texto (lo que se busca; vacío para listarlo todo), limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const q = texto(args.texto, 200);
        const r = await pedir<{ results?: Objeto[] }>("Notion", url("search"), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: { ...(q ? { query: q } : {}), page_size: tope(args.limite, 25, 50) },
          signal,
        });
        const lista = r.results ?? [];
        if (!lista.length)
          return "No hay nada. Recuerda: en Notion hay que compartir cada página con la integración para que ECLIPSE la vea.";
        return `${lista.length} resultado(s):\n${lista
          .map((o) => `${o.object === "database" ? "[base]" : "[página]"} ${tituloDe(o)} · id ${o.id}`)
          .join("\n")}`;
      },
    },
    {
      nombre: "leer_pagina",
      descripcion: "El contenido de una página, en texto.",
      argumentos: "id (el de la página, sale de buscar)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 80);
        if (!id) return "Falta el id de la página.";
        const r = await pedir<{ results?: Record<string, unknown>[] }>(
          "Notion",
          url(`blocks/${id}/children?page_size=100`),
          { cabeceras: cabeceras(cred), signal },
        );
        const lineas = (r.results ?? []).map(textoDeBloque).filter(Boolean);
        return lineas.length ? lineas.join("\n") : "La página está vacía.";
      },
    },
    {
      nombre: "consultar_base",
      descripcion:
        "Las filas de una base de datos de Notion: tareas, clientes, lo que sea que tenga.",
      argumentos: "id (el de la base), limite (1-100)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 80);
        if (!id) return "Falta el id de la base de datos.";
        const r = await pedir<{ results?: Objeto[] }>("Notion", url(`databases/${id}/query`), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: { page_size: tope(args.limite, 50, 100) },
          signal,
        });
        const filas = r.results ?? [];
        if (!filas.length) return "La base de datos no tiene filas.";

        return `${filas.length} fila(s):\n${filas
          .map((f) => {
            const campos = Object.entries(f.properties ?? {})
              .map(([nombre, valor]) => {
                const v = valor as Record<string, unknown>;
                const tipo = String(v.type ?? "");
                const crudo = v[tipo];
                let texto = "";
                if (Array.isArray(crudo))
                  texto = crudo
                    .map((x) => (x as { plain_text?: string; name?: string }).plain_text ?? (x as { name?: string }).name ?? "")
                    .filter(Boolean)
                    .join(", ");
                else if (crudo && typeof crudo === "object")
                  texto = String((crudo as { name?: string; start?: string }).name ?? (crudo as { start?: string }).start ?? "");
                else if (crudo !== null && crudo !== undefined) texto = String(crudo);
                return texto ? `${nombre}: ${texto}` : "";
              })
              .filter(Boolean)
              .join(" · ");
            return `${campos || tituloDe(f)} · id ${f.id}`;
          })
          .join("\n")}`;
      },
    },
    {
      nombre: "escribir_en_pagina",
      descripcion:
        "Añade texto al final de una página. Para dejar notas, resúmenes o listas donde el usuario ya trabaja.",
      escribe: true,
      argumentos: "id (la página), texto (una línea por párrafo)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 80);
        const cuerpo = texto(args.texto, 8000);
        if (!id) return "Falta el id de la página.";
        if (!cuerpo) return "No hay nada que escribir.";

        const parrafos = cuerpo
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 80);

        await pedir("Notion", url(`blocks/${id}/children`), {
          metodo: "PATCH",
          cabeceras: cabeceras(cred),
          cuerpo: {
            children: parrafos.map((linea) => ({
              object: "block",
              type: "paragraph",
              paragraph: { rich_text: [{ type: "text", text: { content: linea.slice(0, 1900) } }] },
            })),
          },
          signal,
        });
        return `Escritas ${parrafos.length} línea(s) al final de la página.`;
      },
    },
  ],
};
