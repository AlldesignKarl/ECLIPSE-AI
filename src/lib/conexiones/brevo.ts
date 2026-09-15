import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Brevo (el de antes Sendinblue): correo y SMS, y el que más se usa por aquí
 * cuando Mailchimp se hace caro.
 *
 * Solo lee, por lo mismo que Mailchimp: un envío a toda la lista no sale de una
 * conversación. Lo que sí resuelve es la pregunta de todos los lunes —cómo fue
 * lo que mandé, cuánta gente tengo— sin abrir el panel.
 */

function url(camino: string): string {
  return `${baseDe("brevo", "https://api.brevo.com")}/v3/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { "api-key": cred.clave ?? "" };
}

export const brevo: Servicio = {
  id: "brevo",
  nombre: "Brevo",
  color: "#0B996E",
  marca: "Bv",
  familia: "correo",
  resumen:
    "Tus listas de contactos y cómo fue cada envío. El que antes se llamaba Sendinblue. Solo mira.",
  pasos: [
    "Entra en Brevo y abre tu nombre (arriba a la derecha) → SMTP y API.",
    "En la pestaña «Claves de API», pulsa «Generar una nueva clave de API».",
    "Ponle nombre, por ejemplo ECLIPSE, y copia la clave que empieza por xkeysib-.",
  ],
  enlace: "https://app.brevo.com/settings/keys/api",
  campos: [
    {
      id: "clave",
      etiqueta: "Clave de API",
      ayuda: "Empieza por xkeysib-.",
      placeholder: "xkeysib-…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.clave?.trim()) return { ok: false, error: "Falta la clave." };

    try {
      const r = await pedir<{
        companyName?: string;
        email?: string;
        plan?: { type?: string; credits?: number }[];
      }>("Brevo", url("account"), { cabeceras: cabeceras(cred), signal });

      const credito = r.plan?.find((p) => typeof p.credits === "number");
      return {
        ok: true,
        cuenta: `${r.companyName || r.email || "tu cuenta"}${
          credito ? ` · ${credito.credits} créditos` : ""
        }`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_listas",
      descripcion: "Las listas de contactos con cuánta gente tiene cada una.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{
          lists?: { id: number; name: string; totalSubscribers?: number; totalBlacklisted?: number }[];
          count?: number;
        }>("Brevo", url("contacts/lists?limit=25"), { cabeceras: cabeceras(cred), signal });

        const lista = r.lists ?? [];
        if (!lista.length) return "No hay ninguna lista todavía.";

        return lista
          .map(
            (l) =>
              `${l.name} (id ${l.id}) · ${l.totalSubscribers ?? 0} contactos${
                l.totalBlacklisted ? ` · ${l.totalBlacklisted} en la lista negra` : ""
              }`,
          )
          .join("\n");
      },
    },
    {
      nombre: "listar_campanas",
      descripcion: "Los últimos correos enviados, con aperturas y clics.",
      argumentos: "limite (1-25)",
      async ejecutar({ cred, args, signal }) {
        const r = await pedir<{
          campaigns?: {
            name?: string;
            subject?: string;
            status?: string;
            sentDate?: string;
            statistics?: { globalStats?: { sent?: number; uniqueViews?: number; clickers?: number } };
          }[];
        }>("Brevo", url(`emailCampaigns?limit=${tope(args.limite, 10, 25)}&sort=desc`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = r.campaigns ?? [];
        if (!lista.length) return "No se ha enviado ninguna campaña todavía.";

        return lista
          .map((c) => {
            const s = c.statistics?.globalStats;
            const abiertos =
              s?.sent && s.uniqueViews ? ` · ${((s.uniqueViews / s.sent) * 100).toFixed(1)}% aperturas` : "";
            return `${c.subject || c.name || "(sin asunto)"} · ${c.status ?? "?"}${
              c.sentDate ? ` · ${c.sentDate.slice(0, 10)}` : ""
            }${s?.sent ? ` · ${s.sent} enviados` : ""}${abiertos}`;
          })
          .join("\n");
      },
    },
    {
      nombre: "ver_contacto",
      descripcion:
        "Si alguien está en tus listas y desde cuándo. Para responder «¿este cliente recibe mis correos?».",
      argumentos: "correo (la dirección que se busca)",
      async ejecutar({ cred, args, signal }) {
        const correo = texto(args.correo, 120);
        if (!correo) return "Falta el correo que hay que buscar.";

        try {
          const c = await pedir<{
            email?: string;
            emailBlacklisted?: boolean;
            createdAt?: string;
            listIds?: number[];
            attributes?: Record<string, unknown>;
          }>("Brevo", url(`contacts/${encodeURIComponent(correo)}`), {
            cabeceras: cabeceras(cred),
            signal,
          });

          const nombre = [c.attributes?.NOMBRE, c.attributes?.FIRSTNAME, c.attributes?.APELLIDOS]
            .filter(Boolean)
            .join(" ");
          return [
            `${c.email ?? correo}${nombre ? ` · ${nombre}` : ""}`,
            `En ${c.listIds?.length ?? 0} lista(s)${c.createdAt ? ` · desde ${c.createdAt.slice(0, 10)}` : ""}`,
            c.emailBlacklisted ? "OJO: está en la lista negra, no le llegan los correos." : "Recibe correos.",
          ].join("\n");
        } catch {
          // Un 404 aquí no es un fallo: es la respuesta.
          return `${correo} no está en tus contactos de Brevo.`;
        }
      },
    },
  ],
};
