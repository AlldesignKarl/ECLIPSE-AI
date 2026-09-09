import { NextRequest } from "next/server";
import { commitFiles, createRepo, GitHubError, requireToken, whoami } from "@/lib/github";
import { currentPlan } from "@/lib/plan-server";

export const runtime = "nodejs";
// El plan gratuito de Vercel corta las funciones a los 60 s. Si despliegas en
// un plan de pago o en tu propio servidor, puedes subir este número.
export const maxDuration = 60;

interface Body {
  /** `owner/repo` de un repositorio existente. */
  repo?: string;
  /** Nombre para crear uno nuevo. */
  newRepo?: string;
  private?: boolean;
  branch?: string;
  message?: string;
  files: { path: string; content: string }[];
}

export async function POST(req: NextRequest) {
  if ((await currentPlan()) !== "pro")
    return Response.json(
      { error: "Subir proyectos a GitHub es del plan Pro.", code: "pro_required" },
      { status: 402 },
    );

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.files?.length)
    return Response.json({ error: "No hay archivos que subir." }, { status: 400 });

  try {
    const token = await requireToken();
    let owner: string;
    let repo: string;
    let created = false;
    let repoUrl: string;

    if (body.newRepo?.trim()) {
      const user = await whoami(token);
      const name = body.newRepo.trim().replace(/[^\w.-]+/g, "-");
      const fresh = await createRepo(token, name, body.private !== false, "Creado con ECLIPSE AI");
      owner = user.login;
      repo = name;
      created = true;
      repoUrl = fresh.html_url;
    } else if (body.repo?.includes("/")) {
      [owner, repo] = body.repo.split("/");
      repoUrl = `https://github.com/${owner}/${repo}`;
    } else {
      return Response.json({ error: "Elige un repositorio o crea uno nuevo." }, { status: 400 });
    }

    const result = await commitFiles({
      token,
      owner,
      repo,
      branch: body.branch?.trim() || "main",
      message: body.message?.trim() || "Cambios generados con ECLIPSE AI",
      files: body.files,
    });

    return Response.json({ ...result, repo: `${owner}/${repo}`, repoUrl, created });
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    return Response.json(
      { error: err instanceof Error ? err.message : "No se pudo subir el proyecto." },
      { status },
    );
  }
}
