import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Trello: los tableros donde media oficina tiene lo que hay que hacer.
 *
 * Sirve para lo que nadie quiere hacer a mano: mirar qué hay en cada columna y
 * apuntar una tarjeta sin salir de la conversación. Puede crear tarjetas, que
 * es lo único que se puede deshacer de un vistazo; mover, cambiar o archivar lo
 * de otro, no.
 */

function url(cred: Credenciales, camino: string): string {
  const separador = camino.includes("?") ? "&" : "?";
  return `${baseDe("trello", "https://api.trello.com")}/1/${camino}${separador}key=${encodeURIComponent(
    cred.clave ?? "",
  )}&token=${encodeURIComponent(cred.token ?? "")}`;
}

export const trello: Servicio = {
  id: "trello",
  nombre: "Trello",
  color: "#0052CC",
  marca: "Tr",
  familia: "trabajo",
  resumen: "Tus tableros: qué hay en cada columna y apuntar una tarjeta nueva sin abrir Trello.",
  pasos: [
    "Entra en trello.com/power-ups/admin y crea un Power-Up (te da una clave de API). Si ya tienes una, salta este paso.",
    "Copia la «API key».",
    "En esa misma página, pulsa el enlace «Token» que hay junto a la clave y autoriza el acceso.",
    "Copia el token largo que aparece y pega aquí los dos.",
  ],
  enlace: "https://trello.com/power-ups/admin",
  campos: [
    {
      id: "clave",
      etiqueta: "Clave de API",
      ayuda: "La «API key» del Power-Up.",
      placeholder: "32 letras y números",
      secreto: true,
    },
    {
      id: "token",
      etiqueta: "Token",
      ayuda: "El que sale al pulsar «Token» y autorizar.",
      placeholder: "ATTA…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.clave?.trim() || !cred.token?.trim())
      return { ok: false, error: "Hacen falta la clave y el token." };

    try {
      const yo = await pedir<{ fullName?: string; username?: string }>(
        "Trello",
        url(cred, "members/me?fields=fullName,username"),
        { signal },
      );
      return { ok: true, cuenta: yo.fullName || `@${yo.username ?? "tu cuenta"}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_tableros",
      descripcion: "Tus tableros de Trello, con su identificador para poder mirarlos dentro.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{ id: string; name: string; closed?: boolean }[]>(
          "Trello",
          url(cred, "members/me/boards?fields=name,closed"),
          { signal },
        );
        const lista = (r ?? []).filter((b) => !b.closed);
        if (!lista.length) return "No tienes tableros abiertos.";
        return lista.map((b) => `${b.name} (${b.id})`).join("\n");
      },
    },
    {
      nombre: "ver_tablero",
      descripcion:
        "Un tablero por dentro: sus columnas y las tarjetas de cada una, con la fecha de entrega si la tienen.",
      argumentos: "tablero (el identificador), limite (tarjetas por columna, 1-30)",
      async ejecutar({ cred, args, signal }) {
        const tablero = texto(args.tablero, 40);
        if (!tablero) return "Falta el identificador del tablero. Sácalo de listar_tableros.";
        const cuantas = tope(args.limite, 10, 30);

        const [columnas, tarjetas] = await Promise.all([
          pedir<{ id: string; name: string }[]>(
            "Trello",
            url(cred, `boards/${encodeURIComponent(tablero)}/lists?fields=name`),
            { signal },
          ),
          pedir<{ id: string; name: string; idList: string; due?: string | null; dueComplete?: boolean }[]>(
            "Trello",
            url(cred, `boards/${encodeURIComponent(tablero)}/cards?fields=name,idList,due,dueComplete`),
            { signal },
          ),
        ]);

        if (!columnas?.length) return "Ese tablero no tiene columnas.";

        return columnas
          .map((c) => {
            const suyas = (tarjetas ?? []).filter((t) => t.idList === c.id);
            const cabecera = `${c.name} (${suyas.length}) [id ${c.id}]`;
            if (!suyas.length) return `${cabecera}\n  (vacía)`;
            return [
              cabecera,
              ...suyas.slice(0, cuantas).map((t) => {
                const fecha = t.due ? ` · para el ${t.due.slice(0, 10)}${t.dueComplete ? " (hecha)" : ""}` : "";
                return `  - ${t.name}${fecha}`;
              }),
              suyas.length > cuantas ? `  …y ${suyas.length - cuantas} más` : "",
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n");
      },
    },
    {
      nombre: "crear_tarjeta",
      descripcion:
        "Apunta una tarjeta nueva en una columna. Solo crea: no mueve ni cambia las que ya están.",
      escribe: true,
      argumentos: "columna (el id de la lista), titulo, descripcion (opcional), fecha (AAAA-MM-DD, opcional)",
      async ejecutar({ cred, args, signal }) {
        const columna = texto(args.columna, 40);
        const titulo = texto(args.titulo, 200);
        if (!columna) return "Falta la columna. Sácala de ver_tablero, que trae el id de cada una.";
        if (!titulo) return "Falta el título de la tarjeta.";

        const partes = [`idList=${encodeURIComponent(columna)}`, `name=${encodeURIComponent(titulo)}`];
        const descripcion = texto(args.descripcion, 1000);
        if (descripcion) partes.push(`desc=${encodeURIComponent(descripcion)}`);
        const fecha = texto(args.fecha, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) partes.push(`due=${fecha}`);

        const r = await pedir<{ id?: string; shortUrl?: string }>(
          "Trello",
          url(cred, `cards?${partes.join("&")}`),
          { metodo: "POST", signal },
        );

        return `Tarjeta «${titulo}» creada${r.shortUrl ? `: ${r.shortUrl}` : ""}.`;
      },
    },
  ],
};
