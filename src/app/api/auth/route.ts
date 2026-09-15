import { NextRequest } from "next/server";
import {
  authAvailable,
  cambiarContrasena,
  CLEAR_SESSION_COOKIE,
  currentUser,
  guardarPerfil,
  perfilActual,
  sessionCookieHeader,
  signIn,
  signUp,
} from "@/lib/auth";
import { borrarTodoLoMio } from "@/lib/cuenta";
import { VERSION } from "@/lib/novedades";
import { storeStatus } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ¿Hay cuentas en este servidor y quién ha entrado? */
export async function GET() {
  const enabled = authAvailable();
  const perfil = enabled ? await perfilActual() : null;

  return Response.json({
    enabled,
    // Qué versión hay PUESTA en el servidor. Se compara con la que lleva la
    // página cargada para poder actualizarla sola: ver `Shell.tsx`.
    version: VERSION,
    user: await currentUser(),
    // Cómo quiere que le llamen: se recuerda entre sesiones, así que al volver
    // a abrir la aplicación se recupera de aquí y no hay que preguntar otra vez.
    nombre: perfil?.nombre ?? "",
    // Y su foto y si tiene la memoria encendida, que también son suyas y tienen
    // que seguirle de un móvil a otro.
    foto: perfil?.foto ?? "",
    memoria: perfil?.memoria ?? true,
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

/** Tu perfil: el nombre, la foto, la memoria y la contraseña. */
export async function PATCH(req: NextRequest) {
  const cuerpo = (await req.json().catch(() => ({}))) as {
    nombre?: string;
    foto?: string | null;
    memoria?: boolean;
    contrasena?: { actual?: string; nueva?: string };
  };

  if (cuerpo.contrasena) {
    const r = await cambiarContrasena(
      String(cuerpo.contrasena.actual ?? ""),
      String(cuerpo.contrasena.nueva ?? ""),
    );
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    return Response.json({ ok: true });
  }

  const perfil = await guardarPerfil(cuerpo);
  if (perfil === null)
    return Response.json(
      {
        error:
          "No se ha podido guardar. Si era una foto, prueba con otra: tienen que ser JPG, PNG o WEBP.",
      },
      { status: 400 },
    );

  return Response.json({ nombre: perfil.nombre, foto: perfil.foto, memoria: perfil.memoria });
}

/** Cerrar sesión; o, con `?todo=1`, borrar la cuenta y todo lo que hay de ti. */
export async function DELETE(req: NextRequest) {
  if (new URL(req.url).searchParams.get("todo") === "1") {
    const { contrasena } = (await req.json().catch(() => ({}))) as { contrasena?: string };
    const r = await borrarTodoLoMio(String(contrasena ?? ""));
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });

    const res = Response.json({ user: null, borrado: true });
    res.headers.append("Set-Cookie", CLEAR_SESSION_COOKIE);
    return res;
  }

  const res = Response.json({ user: null });
  res.headers.append("Set-Cookie", CLEAR_SESSION_COOKIE);
  return res;
}
