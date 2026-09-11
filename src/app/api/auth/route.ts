import { NextRequest } from "next/server";
import {
  authAvailable,
  CLEAR_SESSION_COOKIE,
  currentUser,
  sessionCookieHeader,
  signIn,
  signUp,
} from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ¿Hay cuentas en este servidor y quién ha entrado? */
export async function GET() {
  return Response.json({ enabled: authAvailable(), user: await currentUser() });
}

/** Crear cuenta o entrar. */
export async function POST(req: NextRequest) {
  if (!authAvailable())
    return Response.json(
      {
        error:
          "Las cuentas todavía no están activadas en este servidor. Falta conectar la base de datos.",
        code: "no_store",
      },
      { status: 503 },
    );

  const { action, email, password } = (await req.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    password?: string;
  };

  if (typeof email !== "string" || typeof password !== "string")
    return Response.json({ error: "Faltan el correo o la contraseña." }, { status: 400 });

  const result = action === "signup" ? await signUp(email, password) : await signIn(email, password);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  const res = Response.json({ user: result.email });
  res.headers.append("Set-Cookie", sessionCookieHeader(result.email));
  return res;
}

/** Cerrar sesión. */
export async function DELETE() {
  const res = Response.json({ user: null });
  res.headers.append("Set-Cookie", CLEAR_SESSION_COOKIE);
  return res;
}
