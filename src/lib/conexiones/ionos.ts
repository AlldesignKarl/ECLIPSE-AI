import { baseDe, pedir, texto } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * IONOS: los dominios y el DNS.
 *
 * Esta es la conexión que menos brilla y más problemas resuelve. El DNS es
 * donde la gente se atasca de verdad: conectar un dominio comprado en un sitio
 * con una tienda alojada en otro es tocar cuatro registros que no se parecen a
 * nada, con nombres como CNAME y TTL, y equivocarse deja la web caída sin
 * decirte por qué. ECLIPSE puede leer la zona entera, explicar qué hay, decir
 * qué falta y —con permiso— añadirlo.
 *
 * Dos cosas que no hace, a propósito:
 *
 * - No borra registros. Un registro de más estorba; uno de menos tira el correo
 *   de una empresa entera y nadie se entera hasta que un cliente se queja.
 * - No toca los servidores de nombres. Eso es la raíz: si se equivoca ahí, ya
 *   no hay DNS desde el que arreglarlo.
 */

function url(cred: Credenciales, camino: string): string {
  return `${baseDe("ionos", "https://api.hosting.ionos.com")}/dns/v1/${camino}`;
}

/**
 * La clave de IONOS son dos trozos que van pegados por un punto.
 *
 * El panel los enseña separados —"public prefix" y "secret"— y así es como los
 * copia la gente; la API los quiere juntos. Se aceptan de las dos formas para
 * que nadie se quede fuera por un punto.
 */
function cabeceras(cred: Credenciales): Record<string, string> {
  const prefijo = (cred.prefijo || "").trim();
  const secreto = (cred.secreto || "").trim();
  const clave = secreto.includes(".") && !prefijo ? secreto : `${prefijo}.${secreto}`;
  return { "X-API-Key": clave };
}

interface Zona {
  id: string;
  name: string;
  type?: string;
}

interface Registro {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl?: number;
  disabled?: boolean;
}

/** Los tipos que se pueden crear. Fuera quedan los que rompen cosas al tocarlos. */
const TIPOS = ["A", "AAAA", "CNAME", "TXT", "MX", "CAA", "SRV"];

async function zonaDe(cred: Credenciales, dominio: string, signal?: AbortSignal) {
  const zonas = await pedir<Zona[]>("IONOS", url(cred, "zones"), {
    cabeceras: cabeceras(cred),
    signal,
  });
  const limpio = dominio.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return (zonas ?? []).find((z) => z.name?.toLowerCase() === limpio) ?? null;
}

export const ionos: Servicio = {
  id: "ionos",
  nombre: "IONOS",
  color: "#003D8F",
  marca: "IO",
  familia: "dominio",
  resumen:
    "Tus dominios y su DNS. Conectar un dominio con una tienda, apuntar el correo o arreglar una web caída sin pelearte con los registros.",
  pasos: [
    "Entra en tu cuenta de IONOS y abre el Centro de desarrolladores (developer.hosting.ionos.es).",
    "Ve a «API Keys» y pulsa «Crear clave».",
    "Copia las dos partes que salen: el «Public Prefix» y el «Secret». El secreto solo se enseña una vez.",
    "Pega aquí las dos.",
  ],
  enlace: "https://developer.hosting.ionos.es/keys",
  campos: [
    {
      id: "prefijo",
      etiqueta: "Public Prefix",
      ayuda: "La primera parte de la clave, la corta.",
      placeholder: "a1b2c3d4…",
    },
    {
      id: "secreto",
      etiqueta: "Secret",
      ayuda: "La segunda parte, la larga. Solo se enseña una vez.",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.secreto?.trim()) return { ok: false, error: "Falta el secreto de la clave." };
    try {
      const zonas = await pedir<Zona[]>("IONOS", url(cred, "zones"), {
        cabeceras: cabeceras(cred),
        signal,
      });
      const n = zonas?.length ?? 0;
      return {
        ok: true,
        cuenta: n
          ? `${n} dominio(s): ${zonas.slice(0, 3).map((z) => z.name).join(", ")}${n > 3 ? "…" : ""}`
          : "sin dominios todavía",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_dominios",
      descripcion: "Los dominios de la cuenta, con su identificador de zona.",
      async ejecutar({ cred, signal }) {
        const zonas = await pedir<Zona[]>("IONOS", url(cred, "zones"), {
          cabeceras: cabeceras(cred),
          signal,
        });
        if (!zonas?.length) return "No hay ningún dominio en esta cuenta.";
        return `${zonas.length} dominio(s):\n${zonas
          .map((z) => `${z.name} · zona ${z.id}`)
          .join("\n")}`;
      },
    },
    {
      nombre: "ver_dns",
      descripcion:
        "Todos los registros DNS de un dominio. Lo primero que hay que mirar cuando una web o un correo no funcionan.",
      argumentos: "dominio (obligatorio)",
      async ejecutar({ cred, args, signal }) {
        const dominio = texto(args.dominio, 253);
        if (!dominio) return "Falta el dominio.";

        const zona = await zonaDe(cred, dominio, signal);
        if (!zona) return `En esta cuenta no hay ningún dominio llamado ${dominio}.`;

        const r = await pedir<{ records?: Registro[] }>("IONOS", url(cred, `zones/${zona.id}`), {
          cabeceras: cabeceras(cred),
          signal,
        });
        const registros = r.records ?? [];
        if (!registros.length) return `${dominio} no tiene ningún registro. La web no cargará.`;

        const porTipo = registros.reduce<Record<string, Registro[]>>((acc, reg) => {
          (acc[reg.type] ??= []).push(reg);
          return acc;
        }, {});

        return [
          `${dominio} · ${registros.length} registro(s):`,
          ...Object.entries(porTipo).map(
            ([tipo, lista]) =>
              `${tipo}:\n${lista
                .map(
                  (reg) =>
                    `  ${reg.name} → ${reg.content}${reg.ttl ? ` (TTL ${reg.ttl})` : ""}${
                      reg.disabled ? " [desactivado]" : ""
                    } · id ${reg.id}`,
                )
                .join("\n")}`,
          ),
        ].join("\n");
      },
    },
    {
      nombre: "crear_registro_dns",
      descripcion:
        "Añade un registro DNS. Para apuntar un dominio a una tienda, verificar una propiedad en Google o configurar el correo.",
      escribe: true,
      argumentos:
        "dominio, tipo (A, AAAA, CNAME, TXT, MX, CAA, SRV), nombre (el subdominio completo, o el dominio a secas para la raíz), contenido, ttl (segundos, 3600 por defecto), prioridad (solo MX)",
      async ejecutar({ cred, args, signal }) {
        const dominio = texto(args.dominio, 253);
        const tipo = texto(args.tipo, 10).toUpperCase();
        const nombre = texto(args.nombre, 253) || dominio;
        const contenido = texto(args.contenido, 2000);

        if (!dominio) return "Falta el dominio.";
        if (!TIPOS.includes(tipo))
          return `Ese tipo no se puede crear desde aquí. Los que sí: ${TIPOS.join(", ")}.`;
        if (!contenido) return "Falta el contenido del registro (a dónde apunta).";

        const zona = await zonaDe(cred, dominio, signal);
        if (!zona) return `En esta cuenta no hay ningún dominio llamado ${dominio}.`;

        const ttl = Number(args.ttl);
        await pedir("IONOS", url(cred, `zones/${zona.id}/records`), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: [
            {
              name: nombre,
              type: tipo,
              content: contenido,
              ttl: Number.isFinite(ttl) && ttl >= 60 ? Math.floor(ttl) : 3600,
              ...(tipo === "MX" && Number.isFinite(Number(args.prioridad))
                ? { prio: Number(args.prioridad) }
                : {}),
              disabled: false,
            },
          ],
          signal,
        });

        return `Creado el registro ${tipo} ${nombre} → ${contenido} en ${dominio}. El DNS tarda en extenderse: cuenta con unos minutos, y hasta unas horas si el TTL anterior era alto.`;
      },
    },
  ],
};
