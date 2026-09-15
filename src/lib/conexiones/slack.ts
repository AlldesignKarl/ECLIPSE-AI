import { baseDe, ErrorConexion, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Slack: donde trabaja la gente que trabaja con otra gente.
 *
 * Sirve para dos cosas de verdad: enterarse de lo que se dijo en un canal sin
 * leerse doscientos mensajes, y que lo que ECLIPSE prepara aparezca donde el
 * equipo está, en vez de en una pantalla que hay que ir a abrir.
 *
 * Escribe solo si se le da permiso, y solo escribe: no borra mensajes ni edita
 * los de nadie. Un mensaje de más se ve y se corrige; uno borrado, no.
 *
 * Slack tiene una costumbre propia: contesta 200 aunque haya fallado, y el
 * fallo va dentro. Por eso aquí se mira el cuerpo y no el código, que si no,
 * "la clave no vale" llegaría como un éxito vacío.
 */

function url(camino: string): string {
  return `${baseDe("slack", "https://slack.com")}/api/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.token}` };
}

/** Lo que dice Slack cuando dice que no, en cristiano. */
function explicar(error?: string): string {
  if (error === "invalid_auth" || error === "not_authed" || error === "token_revoked")
    return "Slack ha rechazado el token. Vuelve a conectarlo desde Conexiones.";
  if (error === "missing_scope")
    return "Al bot le falta un permiso para esto. Añádeselo en la configuración de la app en Slack y vuelve a instalarla.";
  if (error === "channel_not_found") return "Ese canal no existe o el bot no está dentro.";
  if (error === "not_in_channel")
    return "El bot no está en ese canal. Invítalo escribiendo /invite @tu-bot dentro del canal.";
  return `Slack ha dicho que no: ${error ?? "sin motivo"}.`;
}

async function slack<T extends { ok?: boolean; error?: string }>(
  camino: string,
  cred: Credenciales,
  opciones: { metodo?: string; cuerpo?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const r = await pedir<T>("Slack", url(camino), { cabeceras: cabeceras(cred), ...opciones });
  if (r.ok === false) throw new ErrorConexion(explicar(r.error));
  return r;
}

export const slackServicio: Servicio = {
  id: "slack",
  nombre: "Slack",
  color: "#4A154B",
  marca: "Sl",
  familia: "trabajo",
  resumen: "Leer lo que se ha dicho en un canal y —si le dejas— escribir en él.",
  pasos: [
    "Entra en api.slack.com/apps y pulsa «Create New App» → «From scratch». Ponle nombre y elige tu espacio.",
    "En «OAuth & Permissions», baja a «Scopes» → «Bot Token Scopes» y añade: channels:read, channels:history y chat:write.",
    "Arriba, pulsa «Install to Workspace» y acepta.",
    "Copia el «Bot User OAuth Token», que empieza por xoxb-.",
    "Por último, en Slack, entra en los canales que quieras y escribe /invite @el-nombre-de-tu-app. Sin eso no ve nada.",
  ],
  enlace: "https://api.slack.com/apps",
  campos: [
    {
      id: "token",
      etiqueta: "Token del bot",
      ayuda: "Empieza por xoxb-. Es el «Bot User OAuth Token».",
      placeholder: "xoxb-…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };
    if (!cred.token.startsWith("xoxb-") && !process.env.CONEXION_BASE_SLACK)
      return {
        ok: false,
        error:
          "Ese no parece el token del bot: el que vale empieza por xoxb-. El que empieza por xoxp- es el tuyo personal, y para esto no sirve.",
      };

    try {
      const yo = await slack<{ ok?: boolean; team?: string; user?: string }>("auth.test", cred, {
        signal,
      });
      return { ok: true, cuenta: `${yo.team ?? "tu espacio"} · como @${yo.user ?? "el bot"}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_canales",
      descripcion: "Los canales del espacio, con su identificador y si el bot está dentro.",
      async ejecutar({ cred, signal }) {
        const r = await slack<{
          ok?: boolean;
          channels?: { id: string; name: string; is_member?: boolean; num_members?: number }[];
        }>("conversations.list?limit=100&exclude_archived=true", cred, { signal });

        const lista = r.channels ?? [];
        if (!lista.length) return "No hay canales a la vista.";

        return lista
          .map(
            (c) =>
              `#${c.name} (${c.id}) · ${c.num_members ?? "?"} personas${
                c.is_member ? "" : " · el bot NO está dentro"
              }`,
          )
          .join("\n");
      },
    },
    {
      nombre: "leer_canal",
      descripcion:
        "Los últimos mensajes de un canal. Para ponerse al día de algo sin leerse doscientos mensajes.",
      argumentos: "canal (el id, empieza por C), limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const canal = texto(args.canal, 30);
        if (!canal) return "Falta el canal. Sácalo de listar_canales, que trae el id de cada uno.";

        const r = await slack<{
          ok?: boolean;
          messages?: { text?: string; user?: string; ts?: string; bot_id?: string }[];
        }>(
          `conversations.history?channel=${encodeURIComponent(canal)}&limit=${tope(args.limite, 20, 50)}`,
          cred,
          { signal },
        );

        const lista = (r.messages ?? []).filter((m) => m.text);
        if (!lista.length) return "En ese canal no hay mensajes.";

        // Del revés: Slack los da del más nuevo al más viejo y una conversación
        // al revés no se entiende.
        return lista
          .reverse()
          .map((m) => {
            const fecha = m.ts ? new Date(Number(m.ts) * 1000).toISOString().slice(0, 16).replace("T", " ") : "";
            return `[${fecha}] ${m.bot_id ? "un bot" : m.user ?? "alguien"}: ${m.text}`;
          })
          .join("\n");
      },
    },
    {
      nombre: "escribir_en_canal",
      descripcion:
        "Manda un mensaje a un canal. Solo escribe: no borra ni edita nada de lo que ya hay.",
      escribe: true,
      argumentos: "canal (el id), texto",
      async ejecutar({ cred, args, signal }) {
        const canal = texto(args.canal, 30);
        const mensaje = texto(args.texto, 3000);
        if (!canal) return "Falta el canal.";
        if (!mensaje) return "No hay nada que mandar.";

        await slack("chat.postMessage", cred, {
          metodo: "POST",
          cuerpo: { channel: canal, text: mensaje },
          signal,
        });
        return "Mensaje puesto en el canal.";
      },
    },
  ],
};
