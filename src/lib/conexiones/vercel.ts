import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Vercel: dónde está publicado lo que ECLIPSE CODE construye.
 *
 * Es la otra mitad de ECLIPSE CODE. Si el proyecto ya está publicado, la
 * pregunta deja de ser "cómo se hace" y pasa a ser "¿ha subido bien lo último?
 * ¿por qué falló?", y eso hasta ahora había que ir a mirarlo fuera.
 *
 * Solo lee. Publicar o tirar atrás una versión desde una conversación es poner
 * la web de alguien a merced de un malentendido.
 */

function url(camino: string): string {
  return `${baseDe("vercel", "https://api.vercel.com")}/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.token}` };
}

/** Cuánto hace, en cristiano. */
function hace(momento?: number): string {
  if (!momento) return "";
  const minutos = Math.round((Date.now() - momento) / 60000);
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 60 * 24) return `hace ${Math.round(minutos / 60)} h`;
  return `hace ${Math.round(minutos / 1440)} días`;
}

/** Los estados de Vercel, dichos como se entienden. */
function estado(v?: string): string {
  if (v === "READY") return "publicado";
  if (v === "ERROR") return "FALLÓ";
  if (v === "BUILDING") return "construyéndose";
  if (v === "CANCELED") return "cancelado";
  if (v === "QUEUED") return "esperando turno";
  return v?.toLowerCase() ?? "?";
}

export const vercel: Servicio = {
  id: "vercel",
  nombre: "Vercel",
  color: "#000000",
  marca: "Vc",
  familia: "web",
  resumen: "Tus webs publicadas: si el último despliegue subió bien o falló, y desde cuándo.",
  pasos: [
    "Entra en vercel.com/account/tokens.",
    "Pulsa «Create Token», ponle nombre y elige cuánto quieres que dure.",
    "Copia el token. Solo se enseña una vez.",
  ],
  enlace: "https://vercel.com/account/tokens",
  campos: [
    {
      id: "token",
      etiqueta: "Token de acceso",
      ayuda: "El de vercel.com/account/tokens.",
      placeholder: "letras y números",
      secreto: true,
    },
    {
      id: "equipo",
      etiqueta: "Equipo (opcional)",
      ayuda: "Solo si tus proyectos están en un equipo y no en tu cuenta personal.",
      placeholder: "team_…",
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      const yo = await pedir<{ user?: { username?: string; email?: string } }>("Vercel", url("v2/user"), {
        cabeceras: cabeceras(cred),
        signal,
      });
      return { ok: true, cuenta: yo.user?.username ?? yo.user?.email ?? "tu cuenta de Vercel" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_proyectos",
      descripcion: "Tus proyectos publicados en Vercel, con su dirección.",
      argumentos: "limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const equipo = cred.equipo ? `&teamId=${encodeURIComponent(cred.equipo)}` : "";
        const r = await pedir<{
          projects?: { name: string; framework?: string | null; targets?: { production?: { url?: string } } }[];
        }>("Vercel", url(`v9/projects?limit=${tope(args.limite, 20, 50)}${equipo}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = r.projects ?? [];
        if (!lista.length) return "No hay proyectos en esta cuenta.";

        return lista
          .map((p) => {
            const donde = p.targets?.production?.url;
            return `${p.name}${p.framework ? ` · ${p.framework}` : ""}${donde ? ` · https://${donde}` : ""}`;
          })
          .join("\n");
      },
    },
    {
      nombre: "ver_despliegues",
      descripcion:
        "Los últimos despliegues: si subieron bien o fallaron y cuándo. Para contestar «¿ha subido lo de antes?».",
      argumentos: "proyecto (el nombre, opcional), limite (1-20)",
      async ejecutar({ cred, args, signal }) {
        const proyecto = texto(args.proyecto, 80);
        const partes = [`limit=${tope(args.limite, 10, 20)}`];
        if (proyecto) partes.push(`app=${encodeURIComponent(proyecto)}`);
        if (cred.equipo) partes.push(`teamId=${encodeURIComponent(cred.equipo)}`);

        const r = await pedir<{
          deployments?: { name?: string; url?: string; state?: string; created?: number; target?: string | null }[];
        }>("Vercel", url(`v6/deployments?${partes.join("&")}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = r.deployments ?? [];
        if (!lista.length) return proyecto ? `«${proyecto}» no tiene despliegues.` : "No hay despliegues.";

        return lista
          .map(
            (d) =>
              `${d.name ?? "?"} · ${estado(d.state)}${d.target === "production" ? " · PRODUCCIÓN" : ""} · ${hace(
                d.created,
              )}${d.url ? ` · https://${d.url}` : ""}`,
          )
          .join("\n");
      },
    },
    {
      nombre: "ver_dominios",
      descripcion: "Los dominios de la cuenta y si están verificados.",
      async ejecutar({ cred, signal }) {
        const equipo = cred.equipo ? `?teamId=${encodeURIComponent(cred.equipo)}` : "";
        const r = await pedir<{ domains?: { name: string; verified?: boolean; expiresAt?: number | null }[] }>(
          "Vercel",
          url(`v5/domains${equipo}`),
          { cabeceras: cabeceras(cred), signal },
        );

        const lista = r.domains ?? [];
        if (!lista.length) return "No hay dominios en esta cuenta.";

        return lista
          .map(
            (d) =>
              `${d.name} · ${d.verified ? "verificado" : "SIN VERIFICAR"}${
                d.expiresAt ? ` · caduca el ${new Date(d.expiresAt).toISOString().slice(0, 10)}` : ""
              }`,
          )
          .join("\n");
      },
    },
  ],
};
