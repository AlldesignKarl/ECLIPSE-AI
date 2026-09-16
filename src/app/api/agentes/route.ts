import { NextRequest } from "next/server";

import { currentPlan } from "@/lib/plan-server";
import { stripeAvailable } from "@/lib/stripe";
import { abrirPasarela, comprobarPago, gratisPara, suscripcionViva } from "@/lib/agentes/cobro";
import { misConexiones } from "@/lib/conexiones/almacen";
import { servicioDe } from "@/lib/conexiones/registro";
import { oauthListo, proveedorDe } from "@/lib/conexiones/oauth";
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

/**
 * Cómo se conecta CADA cosa que este agente necesita.
 *
 * Esto existe porque faltaba lo más obvio: la ficha decía "requiere conexión:
 * Gmail" y ahí se acababa. Ni cómo, ni dónde, ni qué te van a pedir. Carlos lo
 * dijo tal cual: *"te dice que no está conectado a Google, pero tampoco aparece
 * nada de cómo hacerlo"*.
 *
 * Y no vale una instrucción genérica, porque no se parecen: Gmail se conecta
 * dando permiso a Google y no pide nada que copiar; Shopify pide el dominio de
 * la tienda y un token; Telegram pide el token del bot. Así que lo que sale de
 * aquí es lo de CADA servicio, sacado del conector de verdad —sus pasos, sus
 * campos, dónde se saca— y no una frase escrita a mano que se quedaría vieja el
 * día que ese servicio cambie su panel.
 */
function comoSeConectan(
  agente: { integraciones: { servicio: string; nombre: string; necesaria: boolean; pendiente?: boolean }[] },
  mias: { servicio: string; cuenta: string; permiso: string }[],
) {
  const porId = new Map(mias.map((c) => [c.servicio, c]));

  return agente.integraciones.map((i) => {
    const servicio = servicioDe(i.servicio);
    const puesta = porId.get(i.servicio);
    const proveedor = servicio?.oauth ? proveedorDe(servicio.oauth) : undefined;

    return {
      servicio: i.servicio,
      nombre: i.nombre,
      necesaria: i.necesaria,
      // `pendiente` en el catálogo es una promesa; que NO exista el conector es
      // un hecho. Se manda el hecho, para que no puedan desviarse.
      pendiente: Boolean(i.pendiente) || !servicio,
      conectado: Boolean(puesta),
      cuenta: puesta?.cuenta,
      permiso: puesta?.permiso,
      /** Se conecta dando permiso (Google) en vez de pegando una clave. */
      oauth: servicio?.oauth,
      /** Y si ese permiso está configurado en ESTE servidor. */
      oauthListo: proveedor ? oauthListo(proveedor) : undefined,
      /** Qué te van a pedir, con las palabras del propio conector. */
      pide: (servicio?.campos ?? []).map((c) => c.etiqueta),
      pasos: servicio?.pasos ?? [],
      enlace: servicio?.enlace,
    };
  });
}

/** El catálogo con el estado real para esta empresa. */
export async function GET(req: NextRequest) {
  const email = await quien();
  const mias = email ? await misConexiones(email) : [];
  const conectados = mias.map((c) => c.servicio);
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
      conectores: comoSeConectan(agente, mias),
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
      // Sin esto, un agente incluido en Pro se anuncia en la lista como
      // "0 €/mes", que se lee como una tarifa rara y no como lo que es.
      conPro: a.conPro,
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
      Tres caminos, y ninguno de ellos es dar un agente por pagado sin pago.

      1. Si este correo está en la lista de regalo (`AGENTES_GRATIS`), se activa
         directamente. Existe para poder probar la plataforma entera sin
         cobrarse a uno mismo, y se dice en la respuesta para que quede claro
         que es un regalo y no un pago.
      2. Con Stripe configurado, se abre la pasarela DE VERDAD y se devuelve su
         dirección. El contrato nace pendiente y lo activa la vuelta del pago,
         después de preguntarle a Stripe si existe.
      3. Sin Stripe, pendiente de pago y se explica. Nadie cobra nada y el
         agente no ejecuta nada.
    */
    /*
      Los que van incluidos en Pro no abren pasarela: no hay nada que cobrar.

      Y se comprueba que de verdad sea Pro AQUÍ, en el servidor. Si esto se
      quedara en la pantalla, cualquiera podría activarlo llamando a la API.
    */
    if (agente.conPro) {
      if ((await currentPlan()) !== "pro")
        return no(
          `${agente.nombre} va incluido con el plan Pro. Mejora el plan y lo tienes sin coste aparte.`,
          402,
          "solo_pro",
        );
      const contrato = await contratar(email, id, "activo");
      return Response.json({
        contrato,
        conPro: true,
        aviso: `${agente.nombre} activado: va incluido en tu plan Pro, no se cobra aparte.`,
      });
    }

    if (gratisPara(email)) {
      const contrato = await contratar(email, id, "activo");
      return Response.json({
        contrato,
        regalado: true,
        aviso: `${agente.nombre} activado sin coste para esta cuenta. Es un regalo configurado en el servidor, no un pago.`,
      });
    }

    const contrato = await contratar(email, id, "pendiente_de_pago");
    if (!contrato) return no("Ese agente no existe.", 404);

    if (!stripeAvailable())
      return Response.json({
        contrato,
        cobroListo: false,
        aviso:
          "Contrato creado y PENDIENTE DE PAGO: en este servidor todavía no hay cobro configurado, así que nadie te ha cobrado nada y el agente no ejecutará encargos hasta que se active.",
      });

    try {
      const pasarela = await abrirPasarela({
        agente,
        email,
        instancia: contrato.instancia,
        origen: req.nextUrl.origin,
      });
      return Response.json({ contrato, cobroListo: true, url: pasarela.url });
    } catch (err) {
      return no(
        err instanceof Error ? err.message : "No se ha podido abrir el pago.",
        502,
      );
    }
  }

  const contrato = await contratoDe(email, id);
  if (!contrato) return no("Ese agente no está contratado.", 404);

  /*
    Un agente incluido en Pro se apaga si se deja de ser Pro.

    Es lo mismo que hace la suscripción de Stripe con los de pago: lo que
    sostiene el contrato se comprueba antes de trabajar, no solo al contratar.
    Sin esto, quien contrata siendo Pro y luego lo deja se quedaría con el
    agente para siempre.
  */
  const suAgente = agenteDe(id);
  if (suAgente?.conPro && (await currentPlan()) !== "pro" && accion !== "rescindir")
    return no(
      `${suAgente.nombre} va incluido con el plan Pro, y ahora mismo no lo tienes. Vuelve a Pro y sigue donde lo dejaste.`,
      402,
      "solo_pro",
    );

  /* ------------------------- Volver del pago -------------------------- */
  if (accion === "confirmar") {
    const r = await comprobarPago({ sesion: texto(cuerpo.sesion, 120), email, agenteId: id });
    if (!r.ok) return no(r.error, 402, "sin_pago");

    // Solo AQUÍ, y solo después de que Stripe diga que sí, un contrato pasa a
    // activo. Es el único camino que existe, y por eso `reactivar` de abajo se
    // niega cuando el contrato está pendiente de pago.
    const contrato = await cambiarEstado(email, id, "activo", r.suscripcion);
    return Response.json({ contrato, pagado: true });
  }

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
