import { NextRequest } from "next/server";

import { currentPlan } from "@/lib/plan-server";
import {
  borrarGrupo,
  cambiarEclipse,
  crearGrupo,
  echar,
  entrarConInvitacion,
  grupoDe,
  gruposListos,
  grupoDeInvitacion,
  misGrupos,
  quien,
  renovarInvitacion,
  salirse,
} from "@/lib/grupos/almacen";
import {
  estaDentro,
  MAX_PERSONAS,
  MODO_POR_DEFECTO,
  MODOS,
  type Grupo,
  type ModoEclipse,
} from "@/lib/grupos/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Los grupos.
 *
 * Una decisión que importa: CREAR un grupo es del plan Pro, pero ENTRAR en uno
 * no. Si para unirte a un grupo hiciera falta pagar, los grupos no existirían:
 * quien lo crea invita a cinco amigos y cinco de cinco se dan la vuelta en la
 * puerta. Paga quien monta la mesa, no quien se sienta.
 */

function no(error: string, status: number, code?: string) {
  return Response.json({ error, code }, { status });
}

/** Lo que se le enseña a cada uno: el grupo sin los correos de los demás. */
function comoSeVe(grupo: Grupo, email: string) {
  return {
    id: grupo.id,
    nombre: grupo.nombre,
    creado: grupo.creado,
    // El correo solo del propio, para saber cuál eres tú en la lista.
    miembros: grupo.miembros.map((m) => ({
      nombre: m.nombre,
      dueno: m.dueno,
      entro: m.entro,
      yo: m.email === email,
    })),
    soyDueno: grupo.miembros.some((m) => m.email === email && m.dueno),
    // Los grupos de antes de que esto existiera no lo tienen guardado, y se
    // estaban comportando exactamente como el modo por defecto.
    eclipse: grupo.eclipse ?? MODO_POR_DEFECTO,
    // La invitación solo la ve el dueño: es la llave de entrar.
    invitacion: grupo.miembros.some((m) => m.email === email && m.dueno)
      ? grupo.invitacion
      : undefined,
    hueco: grupo.miembros.length < MAX_PERSONAS,
  };
}

/** Mis grupos; o, con `?invitacion=`, qué hay detrás de una invitación. */
export async function GET(req: NextRequest) {
  if (!gruposListos())
    return no("Los grupos necesitan la base de datos, y este servidor no la tiene.", 503, "no_store");

  const email = await quien();
  const invitacion = new URL(req.url).searchParams.get("invitacion");

  // Antes de entrar se puede mirar: quién invita y si queda sitio. Sin cuenta
  // también, porque si no, el enlace no se entiende hasta después de
  // registrarse y nadie se registra a ciegas.
  if (invitacion) {
    const grupo = await grupoDeInvitacion(invitacion);
    if (!grupo) return no("Esa invitación ya no vale.", 404);
    return Response.json({
      ojeada: {
        id: grupo.id,
        nombre: grupo.nombre,
        personas: grupo.miembros.length,
        hueco: grupo.miembros.length < MAX_PERSONAS,
        // Si ya estaba dentro, no hay nada que aceptar.
        yaDentro: Boolean(email && estaDentro(grupo, email)),
      },
    });
  }

  if (!email) return Response.json({ grupos: [], sinCuenta: true });
  return Response.json({
    grupos: (await misGrupos()).map((g) => comoSeVe(g, email)),
    maximo: MAX_PERSONAS,
    pro: (await currentPlan()) === "pro",
  });
}

/** Crear un grupo, o entrar en uno con su invitación. */
export async function POST(req: NextRequest) {
  if (!gruposListos()) return no("Los grupos necesitan la base de datos.", 503, "no_store");

  const email = await quien();
  if (!email)
    return no("Para los grupos hay que entrar con tu cuenta: es cómo te ven los demás.", 401, "sin_cuenta");

  const cuerpo = (await req.json().catch(() => ({}))) as { nombre?: string; invitacion?: string };

  // Entrar. No hace falta Pro: paga quien monta la mesa, no quien se sienta.
  if (typeof cuerpo.invitacion === "string" && cuerpo.invitacion) {
    const r = await entrarConInvitacion(cuerpo.invitacion.trim());
    if (!r.ok) return no(r.error, 400);
    return Response.json({ grupo: comoSeVe(r.grupo, email), yaEstaba: r.yaEstaba });
  }

  if ((await currentPlan()) !== "pro") return no("Crear grupos es del plan Pro.", 402, "solo_pro");

  const nombre = (cuerpo.nombre ?? "").replace(/\s+/g, " ").trim();
  if (!nombre) return no("Ponle un nombre al grupo.", 400);

  const grupo = await crearGrupo(nombre);
  if (!grupo) return no("Ya tienes demasiados grupos. Sal de alguno para crear otro.", 400);
  return Response.json({ grupo: comoSeVe(grupo, email) });
}

/** Renovar la invitación, o echar a alguien. Las dos, solo el dueño. */
export async function PATCH(req: NextRequest) {
  const email = await quien();
  if (!email) return no("Hay que entrar con tu cuenta.", 401, "sin_cuenta");

  const cuerpo = (await req.json().catch(() => ({}))) as {
    id?: string;
    accion?: string;
    aQuien?: string;
    modo?: ModoEclipse;
  };
  const { id, accion, aQuien } = cuerpo;
  if (!id) return no("Falta el grupo.", 400);

  if (accion === "eclipse") {
    const modo = MODOS.find((m) => m.id === cuerpo.modo)?.id;
    if (!modo) return no("Eso no es una forma de estar en el grupo.", 400);
    const hecho = await cambiarEclipse(id, modo);
    if (!hecho) return no("Solo quien creó el grupo puede decidir cómo está ECLIPSE dentro.", 403);
    return Response.json({ eclipse: modo });
  }

  if (accion === "renovar") {
    const nueva = await renovarInvitacion(id);
    if (!nueva) return no("Solo quien creó el grupo puede cambiar la invitación.", 403);
    return Response.json({ invitacion: nueva });
  }

  if (accion === "echar") {
    const grupo = await grupoDe(id);
    // Se recibe el nombre visible, no el correo: el navegador nunca ve correos.
    const victima = grupo?.miembros.find((m) => m.nombre === aQuien && !m.dueno);
    if (!victima) return no("No se ha encontrado a esa persona en el grupo.", 404);
    const hecho = await echar(id, victima.email);
    if (!hecho) return no("Solo quien creó el grupo puede echar a alguien.", 403);
    return Response.json({ ok: true });
  }

  return no("Eso no se puede hacer.", 400);
}

/** Salirse de un grupo, o borrarlo si eres quien lo creó. */
export async function DELETE(req: NextRequest) {
  const email = await quien();
  if (!email) return no("Hay que entrar con tu cuenta.", 401, "sin_cuenta");

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) return no("Falta el grupo.", 400);

  if (url.searchParams.get("borrar") === "1") {
    const hecho = await borrarGrupo(id);
    if (!hecho) return no("Solo quien creó el grupo puede borrarlo.", 403);
    return Response.json({ ok: true });
  }

  await salirse(id);
  return Response.json({ ok: true });
}
