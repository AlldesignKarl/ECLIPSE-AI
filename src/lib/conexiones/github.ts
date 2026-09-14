import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * GitHub: el código y lo que queda por hacer en él.
 *
 * Encaja con ECLIPSE CODE de una forma que las demás conexiones no: aquí no se
 * trata de escribir un archivo nuevo, sino de mirar el que ya existe. "¿Por qué
 * falla esto?" con el archivo delante es otra pregunta distinta a la misma
 * pregunta a ciegas.
 *
 * Se conecta con un token personal de los finos, que se limita a los
 * repositorios que uno elija. Y no escribe código: lee, y abre incidencias.
 * Escribir en la rama de alguien es de las cosas que, si salen mal, salen muy
 * mal.
 */

function url(camino: string): string {
  return `${baseDe("github", "https://api.github.com")}/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return {
    Authorization: `Bearer ${cred.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** "duenno/repo", tal y como se pueda haber escrito. */
function repo(v: unknown): string {
  return texto(v, 140)
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
}

export const github: Servicio = {
  id: "github",
  nombre: "GitHub",
  color: "#24292F",
  marca: "Gh",
  familia: "trabajo",
  resumen:
    "Tus repositorios: leer el código que ya tienes, ver las incidencias y abrir una nueva. No toca tus ramas.",
  pasos: [
    "Entra en github.com/settings/personal-access-tokens y pulsa «Generate new token».",
    "Elige «Only select repositories» y marca los que quieras que vea. Si le das acceso a todos, lo verá todo.",
    "En permisos de repositorio, dale «Contents: Read-only» e «Issues: Read and write» si quieres que pueda abrir incidencias.",
    "Genera el token y cópialo: empieza por github_pat_ y solo se enseña una vez.",
  ],
  enlace: "https://github.com/settings/personal-access-tokens",
  campos: [
    {
      id: "token",
      etiqueta: "Token personal",
      ayuda: "Empieza por github_pat_ (o ghp_ si es de los antiguos).",
      placeholder: "github_pat_…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };
    try {
      const yo = await pedir<{ login?: string }>("GitHub", url("user"), {
        cabeceras: cabeceras(cred),
        signal,
      });
      const repos = await pedir<{ full_name: string }[]>(
        "GitHub",
        url("user/repos?per_page=100&sort=pushed"),
        { cabeceras: cabeceras(cred), signal },
      ).catch(() => []);
      return {
        ok: true,
        cuenta: `${yo.login ?? "tu cuenta"} · ${repos?.length ?? 0} repositorio(s)`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_repos",
      descripcion: "Los repositorios a los que tiene acceso, del más movido al menos.",
      argumentos: "limite (1-100)",
      async ejecutar({ cred, args, signal }) {
        const lista = await pedir<
          { full_name: string; private: boolean; language?: string; pushed_at?: string; description?: string }[]
        >("GitHub", url(`user/repos?per_page=${tope(args.limite, 30, 100)}&sort=pushed`), {
          cabeceras: cabeceras(cred),
          signal,
        });
        if (!lista?.length) return "No hay repositorios a la vista con este token.";
        return `${lista.length} repositorio(s):\n${lista
          .map(
            (r) =>
              `${r.full_name}${r.private ? " (privado)" : ""}${r.language ? ` · ${r.language}` : ""}${
                r.pushed_at ? ` · último cambio ${r.pushed_at.slice(0, 10)}` : ""
              }${r.description ? `\n    ${r.description}` : ""}`,
          )
          .join("\n")}`;
      },
    },
    {
      nombre: "ver_archivos",
      descripcion: "Qué hay dentro de un repositorio, o de una carpeta suya.",
      argumentos: 'repo ("duenno/repo"), ruta (vacío para la raíz)',
      async ejecutar({ cred, args, signal }) {
        const r = repo(args.repo);
        if (!r.includes("/")) return 'El repositorio se escribe "duenno/repo".';
        const ruta = texto(args.ruta, 300).replace(/^\/+/, "");
        const lista = await pedir<{ name: string; type: string; size?: number; path: string }[]>(
          "GitHub",
          url(`repos/${r}/contents/${encodeURI(ruta)}`),
          { cabeceras: cabeceras(cred), signal },
        );
        if (!Array.isArray(lista)) return "Eso es un archivo, no una carpeta: ábrelo con leer_archivo.";
        return `${r}/${ruta}:\n${lista
          .map((f) => `${f.type === "dir" ? "[carpeta]" : "[archivo]"} ${f.path}${f.size ? ` · ${f.size} B` : ""}`)
          .join("\n")}`;
      },
    },
    {
      nombre: "leer_archivo",
      descripcion: "El contenido de un archivo del repositorio, para poder mirarlo de verdad.",
      argumentos: 'repo ("duenno/repo"), ruta (la del archivo)',
      async ejecutar({ cred, args, signal }) {
        const r = repo(args.repo);
        const ruta = texto(args.ruta, 300).replace(/^\/+/, "");
        if (!r.includes("/") || !ruta) return "Hacen falta el repositorio y la ruta del archivo.";

        const f = await pedir<{ content?: string; encoding?: string; size?: number; name?: string }>(
          "GitHub",
          url(`repos/${r}/contents/${encodeURI(ruta)}`),
          { cabeceras: cabeceras(cred), signal },
        );
        if (!f.content) return "Ese archivo no tiene contenido legible (puede ser binario o muy grande).";

        const crudo = Buffer.from(f.content, "base64").toString("utf8");
        // Un archivo enorme se come el cupo del minuto entero y deja al modelo
        // sin sitio para contestar. Se manda el principio, que es donde está lo
        // que casi siempre se busca.
        const tope = 24_000;
        return crudo.length > tope
          ? `${crudo.slice(0, tope)}\n\n[…cortado: el archivo tiene ${crudo.length} caracteres]`
          : crudo;
      },
    },
    {
      nombre: "listar_incidencias",
      descripcion: "Las incidencias abiertas de un repositorio: lo que queda por arreglar.",
      argumentos: 'repo, estado (open, closed, all), limite (1-100)',
      async ejecutar({ cred, args, signal }) {
        const r = repo(args.repo);
        if (!r.includes("/")) return 'El repositorio se escribe "duenno/repo".';
        const estado = ["open", "closed", "all"].includes(String(args.estado))
          ? String(args.estado)
          : "open";
        const lista = await pedir<
          { number: number; title: string; state: string; user?: { login?: string }; created_at?: string; pull_request?: unknown }[]
        >("GitHub", url(`repos/${r}/issues?state=${estado}&per_page=${tope(args.limite, 25, 100)}`), {
          cabeceras: cabeceras(cred),
          signal,
        });
        // GitHub mete los pull requests entre las incidencias; no son lo mismo.
        const soloIncidencias = (lista ?? []).filter((i) => !i.pull_request);
        if (!soloIncidencias.length) return "No hay incidencias que encajen con eso.";
        return `${soloIncidencias.length} incidencia(s):\n${soloIncidencias
          .map(
            (i) =>
              `#${i.number} · ${i.title} · ${i.state}${i.user?.login ? ` · de ${i.user.login}` : ""}${
                i.created_at ? ` · ${i.created_at.slice(0, 10)}` : ""
              }`,
          )
          .join("\n")}`;
      },
    },
    {
      nombre: "abrir_incidencia",
      descripcion:
        "Abre una incidencia nueva. Para dejar apuntado un fallo o una idea donde se trabaja, en vez de en una nota suelta.",
      escribe: true,
      argumentos: "repo, titulo (obligatorio), cuerpo",
      async ejecutar({ cred, args, signal }) {
        const r = repo(args.repo);
        const titulo = texto(args.titulo, 250);
        if (!r.includes("/")) return 'El repositorio se escribe "duenno/repo".';
        if (!titulo) return "Una incidencia necesita al menos un título.";

        const creada = await pedir<{ number?: number; html_url?: string }>(
          "GitHub",
          url(`repos/${r}/issues`),
          {
            metodo: "POST",
            cabeceras: cabeceras(cred),
            cuerpo: { title: titulo, body: texto(args.cuerpo, 20000) || undefined },
            signal,
          },
        );
        return `Abierta la incidencia #${creada.number} en ${r}${creada.html_url ? `: ${creada.html_url}` : ""}.`;
      },
    },
  ],
};
