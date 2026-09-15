import { NextRequest } from "next/server";

import { memoriaApagada } from "@/lib/auth";
import {
  hechosDe,
  memoriaLista,
  olvidarHecho,
  olvidarTodo,
  quien,
  resumenesDe,
  tocaAprender,
} from "@/lib/memoria/almacen";
import { aprenderDe, type Turno } from "@/lib/memoria/aprender";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * La memoria: verla, alimentarla y borrarla.
 *
 * Las tres cosas en el mismo sitio y a propósito. Una memoria que solo se puede
 * alimentar es una caja negra; con el mismo botón se mira lo que sabe y se
 * borra entero.
 *
 * No hace falta plan Pro. Acordarse de con quién hablas no es una función de
 * pago: es lo mínimo para que hablar con algo dos veces no sea empezar de cero.
 */

/** Lo que sabe de ti, tal cual, para poder enseñarlo en Ajustes. */
export async function GET() {
  if (!memoriaLista()) return Response.json({ hechos: [], temas: [], hay: false });

  const email = await quien();
  if (!email) return Response.json({ hechos: [], temas: [], sinCuenta: true, hay: false });

  const apagada = await memoriaApagada(email);
  return Response.json({
    hechos: apagada ? [] : await hechosDe(email),
    temas: apagada ? [] : await resumenesDe(email),
    activa: !apagada,
    hay: true,
  });
}

/**
 * Aprender de una conversación.
 *
 * Lo llama la aplicación de vez en cuando, no en cada mensaje: aprender cuesta
 * una llamada al motor, y hacerlo diez veces seguidas de la misma charla es
 * tirar diez veces la cuota de quien escribe. El freno está en el servidor y no
 * en el navegador, porque el navegador se puede saltar.
 */
export async function POST(req: NextRequest) {
  if (!memoriaLista()) return Response.json({ aprendido: false });

  const email = await quien();
  if (!email) return Response.json({ aprendido: false });
  // Con la memoria apagada no se aprende nada, ni en silencio ni "por si
  // acaso": es lo único que hace que apagarla signifique algo.
  if (await memoriaApagada(email)) return Response.json({ aprendido: false, apagada: true });

  const cuerpo = (await req.json().catch(() => ({}))) as {
    id?: string;
    titulo?: string;
    turnos?: Turno[];
  };

  const id = String(cuerpo.id ?? "").slice(0, 80);
  const turnos = Array.isArray(cuerpo.turnos) ? cuerpo.turnos : [];
  if (!id || turnos.length < 2) return Response.json({ aprendido: false });

  const limpios: Turno[] = turnos
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }))
    .slice(-12);

  if (!(await tocaAprender(email, id, turnos.length))) return Response.json({ aprendido: false });

  const hecho = await aprenderDe(email, {
    id,
    titulo: String(cuerpo.titulo ?? "").slice(0, 80) || "Sin título",
    turnos: limpios,
  });

  return Response.json({ aprendido: Boolean(hecho), ...(hecho ?? {}) });
}

/** Olvidar: un hecho suelto, o todo. */
export async function DELETE(req: NextRequest) {
  const email = await quien();
  if (!email) return Response.json({ ok: false }, { status: 401 });

  const id = new URL(req.url).searchParams.get("hecho");
  if (id) await olvidarHecho(email, id);
  else await olvidarTodo(email);

  return Response.json({ ok: true });
}
