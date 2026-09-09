import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

/** Inicia el login con GitHub (si hay una OAuth App configurada). */
export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET)
    return Response.json(
      {
        error:
          "No hay OAuth de GitHub configurado. Usa un token personal o define GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET.",
      },
      { status: 503 },
    );

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/github/oauth/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "repo read:user");
  url.searchParams.set("state", state);

  const res = Response.redirect(url.toString(), 302);
  res.headers.append(
    "Set-Cookie",
    `eclipse_gh_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return res;
}
