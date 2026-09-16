import { NextRequest } from "next/server";

import { stripeAvailable } from "@/lib/stripe";
import { misConexiones } from "@/lib/conexiones/almacen";
import {
  agentesListos,
  cambiarConfig,
  cambiarEstado,
  contratar,
  contratoDe,
  contratosDe,
  pendientesDe,
  quien,
  registroDe,
  rescindir,
} from "@/lib/agentes/almacen";
import { aprobar, descartar, encargar } from "@/lib/agentes/ejecutar";
import { AGENTES, agenteDe, totalMensual } from "@/lib/agentes/catalogo";
import { estadoDe, serviciosDe } from "@/lib/agentes/tipos";

/**
 * El Catálogo de Agentes por fuera.
 *
 * Una regla manda sobre todas las demás aquí: **nada se da por hecho si no se
 * ha hecho**. Contratar sin cobro configurado deja el contrato pendiente de
 * pago y lo dice; una acción que espera aprobación se cuenta como pendiente y
 * no como ejecutada; y un agente al que le falta una conexión no "trabaja con
 * limitaciones": no trabaja, y se explica por qué.
 *
 * Y la separación entre clientes no se comprueba en la pantalla: se comprueba
 * aquí, en cada petición, con el correo de la sesión. Todo lo que se lee o se
 * escribe cuelga de ese correo.
 */

export const maxDuration = 60;

function no(error: string, status = 400, code?: string) {
  return Response.json({ error, code }, { status });
}

const texto = (v: unknown, tope: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, tope) : "";

/** El catálogo con el estado real para esta empresa. */
export async function GET(req: NextRequest) {
  const email = await quien();
  const conectados = email ? (await misConexiones(email)).map((c) => c.servicio) : [];
  const contratos = email ? await contratosDe(email) : [];

  const url = new URL(req.url);
  const uno = url.searchParams.get("id");

  if (uno) {
    const agente = agenteDe(uno);
    if (!agente) return no("Ese agente no existe.", 404);
    const contrato = contratos.find((c) => c.agenteId === uno) ?? null;

    return Response.json({
      agente,
      contrato,
      diagnostico: estadoDe(agente, conectados),
      servicios: serviciosDe(agente, conectados),
      registro: email && contrato ? await registroDe(email, uno) : [],
      pendientes: email ? (await pendientesDe(email)).filter((p) => p.agenteId === uno) : [],
      cobroListo: stripeAvailable(),
    });
  }

  return Response.json({
    agentes: AGENTES.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      precio: a.precio,
      periodo: a.periodo,
      resumen: a.resumen,
      tono: a.tono,
      integraciones: a.integraciones,
      diagnostico: estadoDe(a, conectados),
      contrato: contratos.find((c) => c.agenteId === a.id) ?? null,
    })),
    mensual: totalMensual(contratos.filter((c) => c.estado === "activo").map((c) => c.agenteId)),
    pendientes: email ? await pendientesDe(email) : [],
    sinCuenta: !email,
    cobroListo: stripeAvailable(),
    almacen: agentesListos(),
  });
}

export async function POST(req: NextRequest) {
  if (!agentesListos())
    return no("Los agentes necesitan la base de datos, y este servidor no la tiene.", 503, "no_store");

  const email = await quien();
  if (!email)
    return no("Para contratar agentes hay que entrar con la cuenta de la empresa.", 401, "sin_cuenta");

  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = texto(cuerpo.accion, 30);
  const id = texto(cuerpo.id, 40);

  /* ----------------------------- Contratar ---------------------------- */
  if (accion === "contratar") {
    const agente = agenteDe(id);
    if (!agente) return no("Ese agente no existe.", 404);

    /*
      Aquí está la línea que no se cruza.

      Sin Stripe configurado no hay forma de cobrar 500 € al mes, así que el
      contrato nace PENDIENTE DE PAGO y no ejecuta nada. Ponerlo activo sería
      regalar el agente y, peor, hacerle creer a alguien que ha contratado algo
      que nadie le ha cobrado. Cuando `STRIPE_SECRET_KEY` y el precio de este
      agente existan, el que lo active será la confirmación del cobro.
    */
    // Siempre pendiente de pago, haya Stripe o no: con Stripe, quien lo active
    // será la confirmación del cobro; sin Stripe, no hay cobro que confirmar.
    const contrato = await contratar(email, id, "pendiente_de_pago");
    return Response.json({
      contrato,
      cobroListo: stripeAvailable(),
      aviso: stripeAvailable()
        ? "Contrato creado. Falta completar el pago para activarlo."
        : "Contrato creado y PENDIENTE DE PAGO: en este servidor todavía no hay cobro configurado, así que nadie te ha cobrado nada y el agente no ejecutará encargos hasta que se active.",
    });
  }

  const contrato = await contratoDe(email, id);
  if (!contrato) return no("Ese agente no está contratado.", 404);

  /* ------------------------ Pausar y reactivar ------------------------ */
  if (accion === "pausar") return Response.json({ contrato: await cambiarEstado(email, id, "pausado") });

  if (accion === "reactivar") {
    /*
      Reactivar NO puede saltarse el pago.

      Si el contrato está pendiente de pago, volver a "activo" desde aquí sería
      la puerta trasera que convierte todo lo anterior en decoración.
    */
    if (contrato.estado === "pendiente_de_pago")
      return no(
        "Este contrato está pendiente de pago. No se puede activar desde aquí: falta configurar el cobro.",
        409,
        "sin_cobro",
      );
    return Response.json({ contrato: await cambiarEstado(email, id, "activo") });
  }

  /* ----------------------------- Ajustes ------------------------------ */
  if (accion === "config") {
    const cambios: Record<string, unknown> = {};
    if (typeof cuerpo.puedeEscribir === "boolean") cambios.puedeEscribir = cuerpo.puedeEscribir;
    if (typeof cuerpo.apruebaAntes === "boolean") cambios.apruebaAntes = cuerpo.apruebaAntes;
    if (Array.isArray(cuerpo.apagadas))
      cambios.apagadas = cuerpo.apagadas.map((h) => texto(h, 40)).filter(Boolean);

    return Response.json({ contrato: await cambiarConfig(email, id, cambios) });
  }

  /* ----------------------------- Encargar ----------------------------- */
  if (accion === "encargar" || accion === "probar") {
    const encargo = texto(cuerpo.encargo, 2000);
    if (!encargo) return no("¿Qué le encargo?");

    const r = await encargar({ email, agenteId: id, encargo, signal: req.signal });
    return r.ok ? Response.json(r) : Response.json(r, { status: 422 });
  }

  /* ---------------------------- Aprobaciones -------------------------- */
  if (accion === "aprobar") {
    const r = await aprobar(email, texto(cuerpo.pendiente, 40));
    return r.ok ? Response.json(r) : no(r.error ?? "No se ha podido.", 422);
  }

  if (accion === "descartar") {
    const hecho = await descartar(email, texto(cuerpo.pendiente, 40));
    return hecho ? Response.json({ ok: true }) : no("Eso ya no está esperando.", 404);
  }

  return no("No sé qué quieres hacer.");
}

/** Rescindir: se va el contrato con su registro y lo que tuviera pendiente. */
export async function DELETE(req: NextRequest) {
  if (!agentesListos()) return no("Los agentes necesitan la base de datos.", 503, "no_store");
  const email = await quien();
  if (!email) return no("Hay que entrar con tu cuenta.", 401, "sin_cuenta");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return no("¿Cuál rescindo?");
  await rescindir(email, id);
  return Response.json({ ok: true });
}
