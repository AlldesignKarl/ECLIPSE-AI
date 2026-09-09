import { NextRequest } from "next/server";
import { COOKIE_HEADER } from "@/lib/github";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("eclipse_gh_state")?.value;

  const fail = (reason: string) =>
    Response.redirect(`${req.nextUrl.origin}/?github=error&reason=${encodeURIComponent(reason)}`, 302);

  if (!code) return fail("Falta el código de autorización");
  if (!state || state !== expected) return fail("La sesión de autorización no coincide");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${req.nextUrl.origin}/api/github/oauth/callback`,
    }),
  });

  const data = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };

  if (!data.access_token) return fail(data.error_description || "GitHub no devolvió el token");

  const res = Response.redirect(`${req.nextUrl.origin}/?github=ok`, 302);
  res.headers.append("Set-Cookie", COOKIE_HEADER(data.access_token));
  res.headers.append("Set-Cookie", "eclipse_gh_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  return res;
}
