import { NextRequest } from "next/server";
import { COOKIE_HEADER, GH_COOKIE, getToken, GitHubError, whoami } from "@/lib/github";

export const runtime = "nodejs";

/** ¿Hay una cuenta conectada? */
export async function GET() {
  const token = await getToken();
  if (!token)
    return Response.json({
      connected: false,
      oauthAvailable: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    });

  try {
    const user = await whoami(token);
    return Response.json({ connected: true, user });
  } catch {
    return Response.json({ connected: false, error: "El token guardado ya no es válido." });
  }
}

/** Conectar con un token personal (PAT con permiso `repo`). */
export async function POST(req: NextRequest) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token?.trim())
    return Response.json({ error: "Pega tu token de acceso personal." }, { status: 400 });

  try {
    const user = await whoami(token.trim());
    const res = Response.json({ connected: true, user });
    res.headers.append("Set-Cookie", COOKIE_HEADER(token.trim()));
    return res;
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    return Response.json(
      {
        error:
          status === 401
            ? "El token no es válido o ha caducado."
            : err instanceof Error
              ? err.message
              : "No se pudo verificar el token.",
      },
      { status },
    );
  }
}

export async function DELETE() {
  const res = Response.json({ connected: false });
  res.headers.append("Set-Cookie", `${GH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
