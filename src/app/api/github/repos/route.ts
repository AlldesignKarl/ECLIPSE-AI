import { GitHubError, listRepos, requireToken } from "@/lib/github";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ repos: await listRepos(await requireToken()) });
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    return Response.json(
      { error: err instanceof Error ? err.message : "No se pudieron leer los repositorios." },
      { status },
    );
  }
}
