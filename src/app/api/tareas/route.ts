import { NextRequest } from "next/server";

import { currentUser } from "@/lib/auth";
import { currentPlan } from "@/lib/plan-server";
import {
  borrarResultado,
  borrarTarea,
  cambiarTarea,
  crearTarea,
  marcarLeidos,
  misResultados,
  misTareas,
  tareasListas,
} from "@/lib/tareas/almacen";
import { ejecutarPendientes } from "@/lib/tareas/ejecutar";
import { DIAS, MAX_TAREAS, pendientes, type Cuando } from "@/lib/tareas/tipos";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Programar: los encargos que ECLIPSE hace solo.
 *
 * Del plan Pro y con cuenta, por lo mismo que las conexiones: esto vive en el
 * servidor y corre cuando no hay nadie delante, así que necesita saber de quién
 * es. Se comprueba aquí en cada petición y no en la pantalla.
 */

async function puerta(): Promise<{ error: string; code: string; status: number } | { email: string }> {
  if (!tareasListas())
    return {
      error: "Programar necesita la base de datos, y este servidor todavía no la tiene conectada.",
      code: "no_store",
      status: 503,
    };
  if ((await currentPlan()) !== "pro")
    return { error: "Programar encargos es del plan Pro.", code: "solo_pro", status: 402 };

  const email = await currentUser();
  if (!email)
    return {
      error:
        "Para programar algo hay que haber entrado con tu cuenta: el encargo corre en el servidor cuando tú no estás.",
      code: "sin_cuenta",
      status: 401,
    };
  return { email };
}

/** Lo que llega del navegador, puesto en su sitio y sin sorpresas. */
function leerCuando(v: unknown): Cuando | null {
  const c = v as { tipo?: string; dia?: unknown };
  if (c?.tipo === "diario") return { tipo: "diario" };
  if (c?.tipo === "laborables") return { tipo: "laborables" };
  if (c?.tipo === "semanal") {
    const dia = Number(c.dia);
    if (Number.isInteger(dia) && dia >= 0 && dia <= 6) return { tipo: "semanal", dia };
  }
  return null;
}

function limpio(v: unknown, maximo: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, maximo) : "";
}

/**
 * Las tareas y lo que han producido.
 *
 * Y de paso, ponerse al día. El reloj del servidor corre una vez al día; si ese
 * día no llegó a sonar —o la tarea se creó después— al abrir la aplicación se
 * hace lo que faltaba. Así nada se queda sin hacer por un reloj que falló, que
 * es lo que convierte esto en algo de lo que uno se puede fiar.
 */
export async function GET(req: NextRequest) {
  const paso = await puerta();
  if ("error" in paso)
    return Response.json(
      { error: paso.error, code: paso.code, tareas: [], resultados: [] },
      { status: paso.status },
    );

  const alDia = new URL(req.url).searchParams.get("aldia") === "1";
  if (alDia) {
    const toca = pendientes(await misTareas(), new Date());
    // Solo si hay algo pendiente: abrir la aplicación no puede costar una
    // llamada al motor por sistema.
    if (toca.length) await ejecutarPendientes(paso.email);
  }

  return Response.json({
    tareas: await misTareas(),
    resultados: await misResultados(),
    dias: DIAS,
    maximo: MAX_TAREAS,
  });
}

/** Crear un encargo. */
export async function POST(req: NextRequest) {
  const paso = await puerta();
  if ("error" in paso) return Response.json({ error: paso.error, code: paso.code }, { status: paso.status });

  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const titulo = limpio(cuerpo.titulo, 60);
  const instruccion = limpio(cuerpo.instruccion, 1000);
  const cuando = leerCuando(cuerpo.cuando);

  if (!instruccion) return Response.json({ error: "Falta qué quieres que haga." }, { status: 400 });
  if (!cuando) return Response.json({ error: "Falta cada cuánto." }, { status: 400 });

  const tarea = await crearTarea({
    // Sin título, se usa el principio del encargo: nadie quiere rellenar dos
    // campos para decir una sola cosa.
    titulo: titulo || `${instruccion.slice(0, 48)}${instruccion.length > 48 ? "…" : ""}`,
    instruccion,
    cuando,
  });
  if (!tarea)
    return Response.json(
      { error: `Ya tienes ${MAX_TAREAS} encargos. Borra alguno para añadir otro.` },
      { status: 400 },
    );

  return Response.json({ tarea });
}

/** Encender, apagar o cambiar un encargo; y dar por leídos los resultados. */
export async function PATCH(req: NextRequest) {
  const paso = await puerta();
  if ("error" in paso) return Response.json({ error: paso.error, code: paso.code }, { status: paso.status });

  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (cuerpo.leidos === true) {
    await marcarLeidos();
    return Response.json({ ok: true });
  }

  const id = limpio(cuerpo.id, 80);
  if (!id) return Response.json({ error: "Falta el encargo." }, { status: 400 });

  const cambios: Record<string, unknown> = {};
  if (typeof cuerpo.activa === "boolean") cambios.activa = cuerpo.activa;
  if (cuerpo.titulo !== undefined) cambios.titulo = limpio(cuerpo.titulo, 60);
  if (cuerpo.instruccion !== undefined) cambios.instruccion = limpio(cuerpo.instruccion, 1000);
  if (cuerpo.cuando !== undefined) {
    const cuando = leerCuando(cuerpo.cuando);
    if (!cuando) return Response.json({ error: "Ese «cada cuánto» no vale." }, { status: 400 });
    cambios.cuando = cuando;
  }

  const tarea = await cambiarTarea(id, cambios);
  if (!tarea) return Response.json({ error: "Ese encargo no existe." }, { status: 404 });
  return Response.json({ tarea });
}

/** Borrar un encargo, o uno de sus resultados. */
export async function DELETE(req: NextRequest) {
  const paso = await puerta();
  if ("error" in paso) return Response.json({ error: paso.error, code: paso.code }, { status: paso.status });

  const url = new URL(req.url);
  const resultado = url.searchParams.get("resultado");
  if (resultado) {
    await borrarResultado(resultado);
    return Response.json({ ok: true });
  }

  const id = url.searchParams.get("id") ?? "";
  if (!id) return Response.json({ error: "Falta el encargo." }, { status: 400 });
  await borrarTarea(id);
  return Response.json({ ok: true });
}
