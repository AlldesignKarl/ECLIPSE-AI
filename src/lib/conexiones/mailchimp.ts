import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Mailchimp: la lista de correo, que para mucha tienda es el activo de verdad.
 *
 * Solo lee. Mandar un correo a diez mil personas no es una acción que pueda
 * salir de una conversación: se escribe, se mira dos veces y se envía desde su
 * panel. Lo que aquí falta no es poder, es prisa.
 *
 * La clave de Mailchimp lleva dentro en qué centro de datos está la cuenta
 * —lo que va detrás del guion— y sin eso la dirección no existe. Por eso se
 * saca de la propia clave en vez de preguntárselo al usuario, que no tiene por
 * qué saber qué es un "us21".
 */

function centro(cred: Credenciales): string {
  return (cred.clave ?? "").split("-")[1] ?? "";
}

function url(cred: Credenciales, camino: string): string {
  return `${baseDe("mailchimp", `https://${centro(cred)}.api.mailchimp.com/3.0`)}/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  // Autenticación básica: cualquier usuario y la clave como contraseña. Es lo
  // que documenta Mailchimp, por raro que se lea.
  return { Authorization: `Basic ${Buffer.from(`eclipse:${cred.clave}`).toString("base64")}` };
}

export const mailchimp: Servicio = {
  id: "mailchimp",
  nombre: "Mailchimp",
  color: "#FFE01B",
  marca: "Mc",
  familia: "correo",
  resumen:
    "Cuánta gente tienes en tus listas, cómo fue el último envío y quién lo abrió. Solo mira: no manda correos.",
  pasos: [
    "Entra en Mailchimp y abre tu cuenta (arriba a la derecha) → Extras → API keys.",
    "Pulsa «Create A Key» y ponle un nombre, por ejemplo ECLIPSE.",
    "Copia la clave entera, con el guion y las letras del final (algo como -us21): esa parte dice dónde está tu cuenta y hace falta.",
  ],
  enlace: "https://admin.mailchimp.com/account/api/",
  campos: [
    {
      id: "clave",
      etiqueta: "Clave de API",
      ayuda: "Cópiala entera, incluido lo que va detrás del guion.",
      placeholder: "abc123…-us21",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.clave?.trim()) return { ok: false, error: "Falta la clave." };
    if (!centro(cred) && !process.env.CONEXION_BASE_MAILCHIMP)
      return {
        ok: false,
        error:
          "A esa clave le falta el final: tiene que llevar un guion y unas letras (como -us21). Cópiala entera desde Mailchimp.",
      };

    try {
      const r = await pedir<{ account_name?: string; total_subscribers?: number; email?: string }>(
        "Mailchimp",
        url(cred, ""),
        { cabeceras: cabeceras(cred), signal },
      );
      return {
        ok: true,
        cuenta: `${r.account_name || r.email || "tu cuenta"}${
          typeof r.total_subscribers === "number" ? ` · ${r.total_subscribers} suscriptores` : ""
        }`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_listas",
      descripcion:
        "Las listas de correo (audiencias) con cuánta gente tiene cada una y cuántos se han dado de baja.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{
          lists?: {
            id: string;
            name: string;
            stats?: { member_count?: number; unsubscribe_count?: number; open_rate?: number };
          }[];
        }>("Mailchimp", url(cred, "lists?count=20"), { cabeceras: cabeceras(cred), signal });

        const lista = r.lists ?? [];
        if (!lista.length) return "No hay ninguna lista todavía.";

        return lista
          .map(
            (l) =>
              `${l.name} (id ${l.id}) · ${l.stats?.member_count ?? 0} suscriptores · ${
                l.stats?.unsubscribe_count ?? 0
              } bajas${
                typeof l.stats?.open_rate === "number"
                  ? ` · se abre el ${(l.stats.open_rate * 100).toFixed(1)}% de las veces`
                  : ""
              }`,
          )
          .join("\n");
      },
    },
    {
      nombre: "listar_campanas",
      descripcion:
        "Los últimos correos enviados, con cuántos se abrieron y cuántos hicieron clic. Para saber qué funcionó.",
      argumentos: "limite (1-25)",
      async ejecutar({ cred, args, signal }) {
        const r = await pedir<{
          campaigns?: {
            id: string;
            status: string;
            send_time?: string;
            emails_sent?: number;
            settings?: { subject_line?: string; title?: string };
            report_summary?: { open_rate?: number; click_rate?: number };
          }[];
        }>(
          "Mailchimp",
          url(cred, `campaigns?count=${tope(args.limite, 10, 25)}&sort_field=send_time&sort_dir=DESC`),
          { cabeceras: cabeceras(cred), signal },
        );

        const lista = r.campaigns ?? [];
        if (!lista.length) return "No se ha enviado ninguna campaña todavía.";

        return lista
          .map((c) => {
            const abierto = c.report_summary?.open_rate;
            const clic = c.report_summary?.click_rate;
            return [
              `${c.settings?.subject_line || c.settings?.title || "(sin asunto)"} · ${c.status}`,
              c.send_time ? ` · ${c.send_time.slice(0, 10)}` : "",
              c.emails_sent ? ` · ${c.emails_sent} enviados` : "",
              typeof abierto === "number" ? ` · ${(abierto * 100).toFixed(1)}% aperturas` : "",
              typeof clic === "number" ? ` · ${(clic * 100).toFixed(1)}% clics` : "",
            ].join("");
          })
          .join("\n");
      },
    },
    {
      nombre: "ver_lista",
      descripcion: "Una lista por dentro: crecimiento, bajas y cómo responde la gente.",
      argumentos: "id (el de la lista)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 40);
        if (!id) return "Falta el id de la lista. Sácalo de listar_listas.";

        const l = await pedir<{
          name?: string;
          stats?: {
            member_count?: number;
            unsubscribe_count?: number;
            cleaned_count?: number;
            open_rate?: number;
            click_rate?: number;
            campaign_count?: number;
          };
        }>("Mailchimp", url(cred, `lists/${encodeURIComponent(id)}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const s = l.stats ?? {};
        return [
          `${l.name ?? "La lista"}:`,
          `${s.member_count ?? 0} suscriptores · ${s.unsubscribe_count ?? 0} bajas · ${
            s.cleaned_count ?? 0
          } correos que rebotan`,
          `${s.campaign_count ?? 0} campañas enviadas`,
          typeof s.open_rate === "number"
            ? `Aperturas ${(s.open_rate * 100).toFixed(1)}% · clics ${((s.click_rate ?? 0) * 100).toFixed(1)}%`
            : "Todavía no hay datos de aperturas.",
        ].join("\n");
      },
    },
  ],
};
