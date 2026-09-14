import { NextRequest } from "next/server";

import { personasConTareas, tareasListas } from "@/lib/tareas/almacen";
import { ejecutarPendientes } from "@/lib/tareas/ejecutar";
import { pendientes } from "@/lib/tareas/tipos";
import { tareasDe } from "@/lib/tareas/almacen";

export const runtime = "nodejs";
/* El plan gratuito corta a los sesenta pase lo que pase. Ver el presupuesto. */
export const maxDuration = 60;

/**
 * Cuánto se deja trabajar antes de devolver lo hecho.
 *
 * Cincuenta de los sesenta que da el hosting: los diez que sobran son para
 * leer la base de datos y contestar. Lo que no entre hoy no se pierde —queda
 * pendiente y lo hace la siguiente pasada, o la propia aplicación al abrirla—.
 */
const PRESUPUESTO_MS = 50_000;

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

/**
 * ¿Puede esta petición disparar los encargos de todo el mundo?
 *
 * Tres llaves, y la del medio es la que faltaba:
 *
 * 1. El secreto del cron, si está puesto. Es lo que recomienda Vercel.
 * 2. La marca de que la llamada viene del propio programador de Vercel. Esto
 *    es lo que estaba roto: sin CRON_SECRET configurado, el reloj de cada noche
 *    se encontraba un 401 y no se hacía nada, ningún día, y no había forma de
 *    enterarse mirando la aplicación. Vercel BORRA las cabeceras `x-vercel-*`
 *    que manda quien llama desde fuera, así que si llega, la ha puesto Vercel.
 * 3. Un secreto propio, para poder dispararlo a mano cuando haga falta.
 */
function autorizado(req: NextRequest): boolean {
  const cron = process.env.CRON_SECRET ?? "";
  if (cron && req.headers.get("authorization") === `Bearer ${cron}`) return true;

  if (req.headers.get("x-vercel-cron")) return true;
  if ((req.headers.get("user-agent") ?? "").startsWith("vercel-cron/")) return true;

  const secreto = cron || process.env.AUTH_SECRET || "";
  if (!secreto) return false;
  const dado =
    req.headers.get("x-eclipse-cron") ?? new URL(req.url).searchParams.get("clave") ?? "";
  return dado === secreto;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req))
    return Response.json({ error: "No autorizado." }, { status: 401 });

  if (!tareasListas())
    return Response.json({ error: "Sin base de datos." }, { status: 503 });

  const empezo = Date.now();
  const ahora = new Date();
  const personas = await personasConTareas();

  let hechas = 0;
  let fallidas = 0;
  let sinTiempo = 0;
  const detalle: { persona: string; tareas: number }[] = [];

  for (const email of personas) {
    // Se mira antes de ejecutar para no abrir el motor por nada: la mayoría de
    // los días, a la mayoría de la gente, no le toca ninguna.
    const toca = pendientes(await tareasDe(email), ahora);
    if (!toca.length) continue;

    const queda = PRESUPUESTO_MS - (Date.now() - empezo);
    if (queda <= 0) {
      // A quien no le ha dado tiempo NO se le pierde nada: sigue pendiente, y
      // lo hará la siguiente pasada o su propia aplicación al abrirla.
      sinTiempo++;
      continue;
    }

    const resultados = await ejecutarPendientes(email, ahora, queda);
    hechas += resultados.filter((r) => r.ok).length;
    fallidas += resultados.filter((r) => !r.ok).length;
    // Solo cuántas, nunca de quién ni de qué: esto acaba en el registro del
    // hosting, que es el último sitio donde debe quedar lo que alguien pidió.
    detalle.push({ persona: `${email.slice(0, 2)}…`, tareas: resultados.length });
  }

  return Response.json({ personas: personas.length, hechas, fallidas, sinTiempo, detalle });
}

/** Lo mismo, para quien prefiera POST. Algunos programadores solo hacen POST. */
export const POST = GET;
