import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * HubSpot: la ficha de cada cliente y cada trato.
 *
 * La pregunta que contesta es "¿cómo va el mes?" mirando el embudo de verdad:
 * qué hay abierto, por cuánto y desde cuándo. Y "¿quién era este?" antes de
 * llamar a alguien.
 *
 * Solo lee. Un CRM es la memoria comercial de una empresa: meter ahí una ficha
 * a medias o un trato inventado ensucia lo que otros usan para decidir, y eso
 * no se limpia con un botón.
 */

function url(camino: string): string {
  return `${baseDe("hubspot", "https://api.hubapi.com")}/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.token}` };
}

/** HubSpot da los importes como texto. */
function euros(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : "sin importe";
}

export const hubspot: Servicio = {
  id: "hubspot",
  nombre: "HubSpot",
  color: "#FF7A59",
  marca: "Hs",
  familia: "trabajo",
  resumen: "Tus contactos y tus tratos abiertos, con importes. Solo mira: no toca el CRM.",
  pasos: [
    "Entra en tu HubSpot y ve a Configuración (la rueda) → Integraciones → Aplicaciones privadas.",
    "Pulsa «Crear aplicación privada» y ponle nombre, por ejemplo ECLIPSE.",
    "En la pestaña «Alcances», marca solo los de LECTURA: crm.objects.contacts.read y crm.objects.deals.read.",
    "Crea la aplicación y copia el token de acceso.",
  ],
  enlace: "https://app.hubspot.com/private-apps",
  campos: [
    {
      id: "token",
      etiqueta: "Token de la aplicación privada",
      ayuda: "Empieza por pat-. Con permisos de lectura.",
      placeholder: "pat-eu1-…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      // Primero se pregunta de qué cuenta es; si ese permiso no lo tiene —es
      // habitual, porque no se marca por defecto— se comprueba con lo que sí
      // va a usar. Fallar por un permiso que no hace falta sería absurdo.
      const cuenta = await pedir<{ portalId?: number; timeZone?: string }>(
        "HubSpot",
        url("account-info/v3/details"),
        { cabeceras: cabeceras(cred), signal },
      ).catch(() => null);

      const contactos = await pedir<{ results?: unknown[] }>(
        "HubSpot",
        url("crm/v3/objects/contacts?limit=1"),
        { cabeceras: cabeceras(cred), signal },
      );

      if (!contactos.results)
        return {
          ok: false,
          error:
            "El token no puede ver los contactos. Vuelve a la aplicación privada y márcale el alcance crm.objects.contacts.read.",
        };

      return { ok: true, cuenta: cuenta?.portalId ? `cuenta ${cuenta.portalId}` : "tu CRM de HubSpot" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_contactos",
      descripcion: "Los últimos contactos que han entrado en el CRM, con su correo y su empresa.",
      argumentos: "limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const r = await pedir<{
          results?: { properties?: Record<string, string | null> }[];
        }>(
          "HubSpot",
          url(
            `crm/v3/objects/contacts?limit=${tope(
              args.limite,
              20,
              50,
            )}&properties=firstname,lastname,email,company,phone,createdate`,
          ),
          { cabeceras: cabeceras(cred), signal },
        );

        const lista = r.results ?? [];
        if (!lista.length) return "No hay contactos en el CRM.";

        return lista
          .map((c) => {
            const p = c.properties ?? {};
            const nombre = [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "(sin nombre)";
            return `${nombre}${p.email ? ` · ${p.email}` : ""}${p.company ? ` · ${p.company}` : ""}${
              p.createdate ? ` · desde ${p.createdate.slice(0, 10)}` : ""
            }`;
          })
          .join("\n");
      },
    },
    {
      nombre: "buscar_contacto",
      descripcion: "Busca a alguien por su correo o su nombre antes de llamarle o escribirle.",
      argumentos: "buscar (correo o nombre)",
      async ejecutar({ cred, args, signal }) {
        const busca = texto(args.buscar, 120);
        if (!busca) return "Falta a quién hay que buscar.";

        const r = await pedir<{ results?: { properties?: Record<string, string | null> }[] }>(
          "HubSpot",
          url("crm/v3/objects/contacts/search"),
          {
            metodo: "POST",
            cabeceras: cabeceras(cred),
            cuerpo: {
              query: busca,
              limit: 10,
              properties: ["firstname", "lastname", "email", "company", "phone", "lifecyclestage"],
            },
            signal,
          },
        );

        const lista = r.results ?? [];
        if (!lista.length) return `No hay nadie en el CRM que cuadre con «${busca}».`;

        return lista
          .map((c) => {
            const p = c.properties ?? {};
            return [
              [p.firstname, p.lastname].filter(Boolean).join(" ") || "(sin nombre)",
              p.email,
              p.phone,
              p.company,
              p.lifecyclestage,
            ]
              .filter(Boolean)
              .join(" · ");
          })
          .join("\n");
      },
    },
    {
      nombre: "listar_negocios",
      descripcion:
        "Los tratos abiertos con su importe y en qué fase están. Lo que de verdad dice cómo va el mes.",
      argumentos: "limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const r = await pedir<{ results?: { properties?: Record<string, string | null> }[] }>(
          "HubSpot",
          url(
            `crm/v3/objects/deals?limit=${tope(
              args.limite,
              20,
              50,
            )}&properties=dealname,amount,dealstage,closedate`,
          ),
          { cabeceras: cabeceras(cred), signal },
        );

        const lista = r.results ?? [];
        if (!lista.length) return "No hay negocios en el CRM.";

        const total = lista.reduce((s, d) => s + (Number(d.properties?.amount) || 0), 0);
        return [
          `${lista.length} negocio(s), ${euros(total)} en juego:`,
          ...lista.map((d) => {
            const p = d.properties ?? {};
            return `${p.dealname ?? "(sin nombre)"} · ${euros(p.amount)} · ${p.dealstage ?? "sin fase"}${
              p.closedate ? ` · cierra ${p.closedate.slice(0, 10)}` : ""
            }`;
          }),
        ].join("\n");
      },
    },
  ],
};
