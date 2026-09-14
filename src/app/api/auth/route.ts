import { NextRequest } from "next/server";
import {
  authAvailable,
  CLEAR_SESSION_COOKIE,
  currentUser,
  guardarNombre,
  nombreActual,
  sessionCookieHeader,
  signIn,
  signUp,
} from "@/lib/auth";
import { storeStatus } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ¿Hay cuentas en este servidor y quién ha entrado? */
export async function GET() {
  const enabled = authAvailable();
  return Response.json({
    enabled,
    user: await currentUser(),
    // Cómo quiere que le llamen: se recuerda entre sesiones, así que al volver
    // a abrir la aplicación se recupera de aquí y no hay que preguntar otra vez.
    nombre: enabled ? await nombreActual() : "",
    // Para poder decirle al dueño qué le falta, sin enseñar ningún secreto.
    ...(enabled ? {} : { falta: storeStatus() }),
  });
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

  const { action, email, password, nombre } = (await req.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    password?: string;
    nombre?: string;
  };

  if (typeof email !== "string" || typeof password !== "string")
    return Response.json({ error: "Faltan el correo o la contraseña." }, { status: 400 });

  const result =
    action === "signup"
      ? await signUp(email, password, typeof nombre === "string" ? nombre : "")
      : await signIn(email, password);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  const res = Response.json({ user: result.email, nombre: result.nombre ?? "" });
  res.headers.append("Set-Cookie", sessionCookieHeader(result.email));
  return res;
}

/** Cambiar cómo quiere que le llamen. */
export async function PATCH(req: NextRequest) {
  const { nombre } = (await req.json().catch(() => ({}))) as { nombre?: string };
  if (typeof nombre !== "string")
    return Response.json({ error: "Falta el nombre." }, { status: 400 });

  const guardado = await guardarNombre(nombre);
  if (guardado === null)
    return Response.json(
      { error: "Para cambiar esto hay que haber entrado con una cuenta." },
      { status: 401 },
    );

  return Response.json({ nombre: guardado });
}

/** Cerrar sesión. */
export async function DELETE() {
  const res = Response.json({ user: null });
  res.headers.append("Set-Cookie", CLEAR_SESSION_COOKIE);
  return res;
}
