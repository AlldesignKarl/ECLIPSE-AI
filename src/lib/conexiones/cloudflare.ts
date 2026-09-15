import { baseDe, ErrorConexion, pedir, texto } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Cloudflare: los dominios que no están en IONOS.
 *
 * Es el sitio donde más gente tiene hoy su DNS, y donde más miedo da tocar: un
 * registro mal puesto tumba el correo de una empresa hasta que alguien se da
 * cuenta. Por eso puede crear registros pero no cambiar ni borrar los que ya
 * están, y los que sostienen el dominio entero (NS, SOA) no se tocan ni
 * pidiéndolo.
 *
 * Cloudflare también contesta 200 con el fallo dentro, así que se mira el
 * cuerpo y no el código.
 */

function url(camino: string): string {
  return `${baseDe("cloudflare", "https://api.cloudflare.com")}/client/v4/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.token}` };
}

interface Sobre<T> {
  success?: boolean;
  errors?: { message?: string }[];
  result?: T;
}

async function cf<T>(
  camino: string,
  cred: Credenciales,
  opciones: { metodo?: string; cuerpo?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const r = await pedir<Sobre<T>>("Cloudflare", url(camino), {
    cabeceras: cabeceras(cred),
    ...opciones,
  });
  if (r.success === false)
    throw new ErrorConexion(`Cloudflare ha dicho que no: ${r.errors?.[0]?.message ?? "sin motivo"}.`);
  return r.result as T;
}

/** De "mitienda.com" a la zona de Cloudflare que la lleva. */
async function zonaDe(cred: Credenciales, dominio: string, signal?: AbortSignal) {
  const zonas = await cf<{ id: string; name: string }[]>(
    `zones?name=${encodeURIComponent(dominio.toLowerCase())}`,
    cred,
    { signal },
  );
  return zonas?.[0];
}

export const cloudflare: Servicio = {
  id: "cloudflare",
  nombre: "Cloudflare",
  color: "#F38020",
  marca: "Cf",
  familia: "dominio",
  resumen:
    "Tus dominios y sus registros DNS. Puede añadir un registro; no cambia ni borra los que hay.",
  pasos: [
    "Entra en dash.cloudflare.com/profile/api-tokens y pulsa «Create Token».",
    "Elige la plantilla «Edit zone DNS» (o «Read» si solo quieres que mire).",
    "En «Zone Resources», elige los dominios a los que quieres que llegue.",
    "Crea el token y cópialo. Solo se enseña una vez.",
  ],
  enlace: "https://dash.cloudflare.com/profile/api-tokens",
  campos: [
    {
      id: "token",
      etiqueta: "Token de API",
      ayuda: "El de «Create Token». No la «Global API Key», que lo puede todo.",
      placeholder: "40 letras y números",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      const estado = await cf<{ status?: string }>("user/tokens/verify", cred, { signal });
      if (estado?.status && estado.status !== "active")
        return { ok: false, error: `Ese token está ${estado.status} en Cloudflare, así que no sirve.` };

      const zonas = await cf<{ id: string; name: string }[]>("zones?per_page=50", cred, { signal });
      if (!zonas?.length)
        return {
          ok: false,
          error:
            "El token vale, pero no llega a ningún dominio. Vuelve a Cloudflare y dale acceso a las zonas que quieras.",
        };

      return {
        ok: true,
        cuenta: `${zonas.length} dominio(s): ${zonas.slice(0, 3).map((z) => z.name).join(", ")}${
          zonas.length > 3 ? "…" : ""
        }`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_dominios",
      descripcion: "Los dominios de la cuenta y si están activos en Cloudflare.",
      async ejecutar({ cred, signal }) {
        const zonas = await cf<{ name: string; status?: string; paused?: boolean }[]>(
          "zones?per_page=50",
          cred,
          { signal },
        );
        if (!zonas?.length) return "El token no llega a ningún dominio.";
        return zonas
          .map((z) => `${z.name} · ${z.status ?? "?"}${z.paused ? " · en pausa" : ""}`)
          .join("\n");
      },
    },
    {
      nombre: "ver_dns",
      descripcion:
        "Los registros DNS de un dominio, agrupados por tipo. Para comprobar a dónde apunta la web o el correo.",
      argumentos: "dominio (mitienda.com)",
      async ejecutar({ cred, args, signal }) {
        const dominio = texto(args.dominio, 100);
        if (!dominio) return "Falta el dominio.";

        const zona = await zonaDe(cred, dominio, signal);
        if (!zona) return `En esta cuenta de Cloudflare no hay ningún dominio llamado «${dominio}».`;

        const registros = await cf<
          { type: string; name: string; content: string; ttl?: number; proxied?: boolean }[]
        >(`zones/${zona.id}/dns_records?per_page=100`, cred, { signal });

        if (!registros?.length) return `${dominio} no tiene registros DNS.`;

        const porTipo = registros.reduce<Record<string, string[]>>((acc, r) => {
          (acc[r.type] ??= []).push(
            `  ${r.name} → ${r.content}${r.proxied ? " (por Cloudflare)" : ""}`,
          );
          return acc;
        }, {});

        return Object.entries(porTipo)
          .map(([tipo, lineas]) => `${tipo}:\n${lineas.join("\n")}`)
          .join("\n");
      },
    },
    {
      nombre: "crear_registro_dns",
      descripcion:
        "Añade un registro DNS. Para verificar un dominio o apuntar un subdominio. No cambia ni borra los que ya están.",
      escribe: true,
      argumentos: "dominio, tipo (A, AAAA, CNAME, TXT, MX), nombre, contenido, ttl (opcional)",
      async ejecutar({ cred, args, signal }) {
        const dominio = texto(args.dominio, 100);
        const tipo = texto(args.tipo, 10).toUpperCase();
        const contenido = texto(args.contenido, 500);
        const nombre = texto(args.nombre, 200) || dominio;

        if (!dominio || !contenido) return "Hacen falta el dominio y el contenido del registro.";

        /*
          Los que sostienen el dominio entero, fuera.

          NS y SOA son los que dicen quién manda en el dominio: tocarlos desde
          una conversación es la forma más rápida de dejar una web y un correo
          sin servicio sin que nadie sepa por qué.
        */
        if (["NS", "SOA"].includes(tipo))
          return `Un registro ${tipo} no se puede crear desde aquí: es el que sostiene el dominio entero y se toca en el panel, a mano.`;
        if (!["A", "AAAA", "CNAME", "TXT", "MX", "SRV"].includes(tipo))
          return `«${tipo}» no es un tipo de registro que se pueda crear desde aquí.`;

        const zona = await zonaDe(cred, dominio, signal);
        if (!zona) return `En esta cuenta de Cloudflare no hay ningún dominio llamado «${dominio}».`;

        const ttl = Number(args.ttl);
        await cf(`zones/${zona.id}/dns_records`, cred, {
          metodo: "POST",
          cuerpo: {
            type: tipo,
            name: nombre,
            content: contenido,
            // 1 es "automático" en Cloudflare, que es lo que quiere casi todo
            // el mundo casi siempre.
            ttl: Number.isFinite(ttl) && ttl >= 60 ? Math.floor(ttl) : 1,
          },
          signal,
        });

        return `Registro ${tipo} creado en ${dominio}. El DNS tarda un rato en extenderse por internet: si no se ve al momento, no está mal puesto, está viajando.`;
      },
    },
  ],
};
