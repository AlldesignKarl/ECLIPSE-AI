import { NextRequest } from "next/server";

import { personasConTareas, tareasListas } from "@/lib/tareas/almacen";
import { ejecutarPendientes } from "@/lib/tareas/ejecutar";
import { pendientes } from "@/lib/tareas/tipos";
import { tareasDe } from "@/lib/tareas/almacen";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * El reloj: lo que hace las tareas cuando no hay nadie delante.
 *
 * Lo llama el programador del hosting una vez al día (está en vercel.json). No
 * hay sesión, así que no se puede preguntar "¿quién eres?": se recorre la lista
 * de quién tiene encargos, que se mantiene sola al crearlos y borrarlos.
 *
 * Cómo se protege: con un secreto. Sin él, cualquiera podría pedir esta
 * dirección una y otra vez y gastar el cupo del motor de todo el mundo. Vercel
 * manda su propia cabecera en los cron, y además se acepta un secreto propio
 * para poder dispararlo a mano si hace falta.
 *
 * Y es a prueba de repetirse: cada tarea se marca con el día en que se hizo, y
 * las que ya se hicieron hoy no vuelven a salir. Que esto se llame dos veces no
 * duplica nada.
 */

function autorizado(req: NextRequest): boolean {
  // Vercel firma sus propias llamadas de cron con esta cabecera.
  const deVercel = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const secreto = process.env.CRON_SECRET || process.env.AUTH_SECRET || "";
  if (!secreto) return false;

  const dado =
    req.headers.get("x-eclipse-cron") ?? new URL(req.url).searchParams.get("clave") ?? "";
  return deVercel || dado === secreto;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req))
    return Response.json({ error: "No autorizado." }, { status: 401 });

  if (!tareasListas())
    return Response.json({ error: "Sin base de datos." }, { status: 503 });

  const ahora = new Date();
  const personas = await personasConTareas();

  let hechas = 0;
  let fallidas = 0;
  const detalle: { persona: string; tareas: number }[] = [];

  for (const email of personas) {
    // Se mira antes de ejecutar para no abrir el motor por nada: la mayoría de
    // los días, a la mayoría de la gente, no le toca ninguna.
    const toca = pendientes(await tareasDe(email), ahora);
    if (!toca.length) continue;

    const resultados = await ejecutarPendientes(email, ahora);
    hechas += resultados.filter((r) => r.ok).length;
    fallidas += resultados.filter((r) => !r.ok).length;
    // Solo cuántas, nunca de quién ni de qué: esto acaba en el registro del
    // hosting, que es el último sitio donde debe quedar lo que alguien pidió.
    detalle.push({ persona: `${email.slice(0, 2)}…`, tareas: resultados.length });
  }

  return Response.json({ personas: personas.length, hechas, fallidas, detalle });
}

/** Lo mismo, para quien prefiera POST. Algunos programadores solo hacen POST. */
export const POST = GET;
