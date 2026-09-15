import { baseDe, pedir, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Calendly: las citas que te ha cogido la gente.
 *
 * Quien vende su tiempo —consultas, clases, presupuestos— tiene aquí su agenda
 * de verdad. Con esto, un encargo de cada mañana puede decir "hoy tienes tres
 * citas y la primera es a las diez" en vez de suponerlo.
 *
 * Solo lee. Cancelar o mover la cita de otro es entrar en el día de alguien que
 * no está delante para decir que no.
 */

function url(camino: string): string {
  return `${baseDe("calendly", "https://api.calendly.com")}/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.token}` };
}

/** "2026-09-15T10:00:00.000000Z" → "15/09 a las 10:00". */
function cuando(iso?: string): string {
  if (!iso) return "sin hora";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} a las ${String(
    d.getUTCHours(),
  ).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export const calendly: Servicio = {
  id: "calendly",
  nombre: "Calendly",
  color: "#006BFF",
  marca: "Cy",
  familia: "agenda",
  resumen: "Las citas que te han cogido y con quién. Solo mira: no cancela ni mueve nada.",
  pasos: [
    "Entra en calendly.com/integrations/api_webhooks.",
    "En «Personal access tokens», pulsa «Generate new token» y ponle nombre.",
    "Copia el token. Solo se enseña una vez.",
  ],
  enlace: "https://calendly.com/integrations/api_webhooks",
  campos: [
    {
      id: "token",
      etiqueta: "Token personal",
      ayuda: "El «personal access token» de Calendly.",
      placeholder: "eyJ…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      const yo = await pedir<{ resource?: { name?: string; email?: string; uri?: string } }>(
        "Calendly",
        url("users/me"),
        { cabeceras: cabeceras(cred), signal },
      );

      if (!yo.resource?.uri)
        return { ok: false, error: "Calendly ha contestado, pero sin decir de quién es la cuenta." };

      // La dirección del usuario se guarda ahora: todas las consultas la piden
      // y volver a preguntarla en cada llamada sería un viaje de más cada vez.
      cred.usuario = yo.resource.uri;
      return { ok: true, cuenta: yo.resource.name || yo.resource.email || "tu agenda" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "ver_citas",
      descripcion:
        "Las próximas citas: cuándo, de qué y con quién. Para saber cómo viene el día o la semana.",
      argumentos: "limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        if (!cred.usuario) return "Falta saber de quién es la agenda. Vuelve a conectar Calendly.";

        const r = await pedir<{
          collection?: {
            name?: string;
            start_time?: string;
            status?: string;
            event_memberships?: { user_name?: string }[];
            invitees_counter?: { active?: number };
          }[];
        }>(
          "Calendly",
          url(
            `scheduled_events?user=${encodeURIComponent(cred.usuario)}&min_start_time=${new Date().toISOString()}&sort=start_time:asc&count=${tope(
              args.limite,
              10,
              50,
            )}`,
          ),
          { cabeceras: cabeceras(cred), signal },
        );

        const lista = (r.collection ?? []).filter((c) => c.status !== "canceled");
        if (!lista.length) return "No tienes ninguna cita por delante.";

        return [
          `${lista.length} cita(s):`,
          ...lista.map(
            (c) =>
              `${cuando(c.start_time)} · ${c.name ?? "cita"}${
                c.invitees_counter?.active ? ` · ${c.invitees_counter.active} persona(s)` : ""
              }`,
          ),
        ].join("\n");
      },
    },
    {
      nombre: "ver_tipos_de_cita",
      descripcion:
        "Qué puede reservarte la gente: los tipos de cita que tienes publicados, con su duración y su enlace.",
      async ejecutar({ cred, signal }) {
        if (!cred.usuario) return "Falta saber de quién es la agenda. Vuelve a conectar Calendly.";

        const r = await pedir<{
          collection?: { name?: string; duration?: number; active?: boolean; scheduling_url?: string }[];
        }>("Calendly", url(`event_types?user=${encodeURIComponent(cred.usuario)}&count=25`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = r.collection ?? [];
        if (!lista.length) return "No tienes ningún tipo de cita publicado.";

        return lista
          .map(
            (t) =>
              `${t.name ?? "(sin nombre)"} · ${t.duration ?? "?"} min${t.active === false ? " · APAGADO" : ""}${
                t.scheduling_url ? ` · ${t.scheduling_url}` : ""
              }`,
          )
          .join("\n");
      },
    },
  ],
};
