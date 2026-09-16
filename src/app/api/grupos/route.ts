import { NextRequest } from "next/server";

import { currentPlan } from "@/lib/plan-server";
import {
  avatarDe,
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
  quienTieneFoto,
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
 * GRATIS, y lo decidió Carlos: "lo de grupos para chatear y programar quiero
 * que esté en gratis".
 *
 * Tiene todo el sentido y por eso el gratis aquí no es una rebaja: un grupo es
 * la única parte de ECLIPSE que no se usa solo. Cobrarle a quien monta la mesa
 * era cobrarle por traer a cinco personas que no pagaban nada, y el que se lo
 * pensaba dos veces dejaba fuera a los otros cinco. Lo único que hace falta es
 * cuenta, porque en un grupo hay que saber quién habla.
 */

function no(error: string, status: number, code?: string) {
  return Response.json({ error, code }, { status });
}

/** Lo que se le enseña a cada uno: el grupo sin los correos de los demás. */
function comoSeVe(grupo: Grupo, email: string, conFoto = new Set<string>()) {
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
      /*
        Si tiene foto de perfil, para ponerle su cara en el grupo.

        Va el SÍ o NO y no la foto. Una foto de perfil son hasta trescientos
        kilobytes, y esta lista se pide cada pocos segundos mientras el grupo
        está abierto: con ocho personas serían dos megas y medio cada vez, por
        una cara que no cambia en meses. La foto se pide aparte, una vez, y el
        navegador la guarda.
      */
      foto: conFoto.has(m.nombre),
    })),
    soyDueno: grupo.miembros.some((m) => m.email === email && m.dueno),
    // Si lleva día, es una quedada: el chat enseña arriba cuándo es y de qué va.
    fecha: grupo.fecha,
    nota: grupo.nota,
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
  const url = new URL(req.url);
  const invitacion = url.searchParams.get("invitacion");

  /*
    La cara de alguien del grupo.

    Aparte y por su cuenta, para que el navegador se la guarde: se pide una vez
    y ya no vuelve a viajar. Se busca por el nombre que se ve y nunca por el
    correo, que en un grupo no sale ni siquiera dentro de una dirección de
    imagen. Y solo contesta a quien está dentro: la foto de perfil de alguien
    es de la gente con la que habla, no de internet.
  */
  const avatar = url.searchParams.get("avatar");
  const deGrupo = url.searchParams.get("id");
  if (avatar && deGrupo) {
    const foto = await avatarDe(deGrupo, avatar);
    if (!foto) return no("No hay foto.", 404);

    const [cabeza, base64] = foto.split(",");
    const tipo = /^data:([^;]+)/.exec(cabeza ?? "")?.[1] ?? "image/jpeg";
    return new Response(Buffer.from(base64 ?? "", "base64"), {
      headers: {
        "Content-Type": tipo,
        // Cinco minutos: una foto de perfil no cambia casi nunca, pero cuando
        // alguien se la cambia tiene que verse el mismo rato, no mañana.
        "Cache-Control": "private, max-age=300",
      },
    });
  }

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
        // A una quedada se entra sabiendo qué día es, que es la mitad de la
        // información. "Te invitan a algo" no es una invitación.
        fecha: grupo.fecha,
        // Si ya estaba dentro, no hay nada que aceptar.
        yaDentro: Boolean(email && estaDentro(grupo, email)),
      },
    });
  }

  if (!email) return Response.json({ grupos: [], sinCuenta: true });
  const mios = await misGrupos();
  const caras = await Promise.all(mios.map((g) => quienTieneFoto(g)));
  return Response.json({
    grupos: mios.map((g, i) => comoSeVe(g, email, caras[i])),
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

  const cuerpo = (await req.json().catch(() => ({}))) as {
    nombre?: string;
    invitacion?: string;
    fecha?: string;
    nota?: string;
  };

  // Entrar. No hace falta Pro: paga quien monta la mesa, no quien se sienta.
  if (typeof cuerpo.invitacion === "string" && cuerpo.invitacion) {
    const r = await entrarConInvitacion(cuerpo.invitacion.trim());
    if (!r.ok) return no(r.error, 400);
    return Response.json({ grupo: comoSeVe(r.grupo, email), yaEstaba: r.yaEstaba });
  }


  const nombre = (cuerpo.nombre ?? "").replace(/\s+/g, " ").trim();
  if (!nombre) return no("Ponle un nombre al grupo.", 400);

  // Con día es una quedada; sin día, un grupo de siempre. Por dentro es lo
  // mismo, así que no hay dos caminos que mantener.
  const fecha = typeof cuerpo.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha)
    ? cuerpo.fecha
    : undefined;
  const nota = typeof cuerpo.nota === "string" ? cuerpo.nota.replace(/\s+/g, " ").trim() : "";

  const grupo = await crearGrupo(nombre, { fecha, nota });
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
