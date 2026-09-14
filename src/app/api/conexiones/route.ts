import { NextRequest } from "next/server";

import { currentUser } from "@/lib/auth";
import {
  almacenListo,
  cambiarPermiso,
  guardarConexion,
  misConexiones,
  olvidarConexion,
} from "@/lib/conexiones/almacen";
import { admiteEscritura, estadoDe, servicioDe, SERVICIOS } from "@/lib/conexiones/registro";
import type { Credenciales, Permiso } from "@/lib/conexiones/tipos";
import { currentPlan } from "@/lib/plan-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Conectar ECLIPSE con las aplicaciones donde la gente tiene su negocio.
 *
 * Tres puertas, y las tres se comprueban AQUÍ, en el servidor, en cada
 * petición. Ninguna de ellas vive en el navegador: un botón escondido no es una
 * puerta, es una cortina.
 *
 * 1. Plan Pro. Es lo que se ha prometido y es lo que se cumple.
 * 2. Cuenta. Las credenciales van cifradas en la base de datos colgando de un
 *    correo; sin correo no hay de dónde colgarlas. Y así siguen a su dueño del
 *    móvil al ordenador, que es lo que se espera de la llave de tu tienda.
 * 3. La clave se comprueba antes de guardarla. Guardar una que no sirve es
 *    condenar a alguien a descubrirlo tres días después y por otro motivo.
 */

type Fallo = { error: string; code?: string; status: number };

async function puerta(): Promise<Fallo | { email: string }> {
  if (!almacenListo())
    return {
      error:
        "Las conexiones necesitan la base de datos, y este servidor todavía no la tiene conectada.",
      code: "no_store",
      status: 503,
    };

  if ((await currentPlan()) !== "pro")
    return {
      error: "Conectar tus aplicaciones es del plan Pro.",
      code: "solo_pro",
      status: 402,
    };

  const email = await currentUser();
  if (!email)
    return {
      error:
        "Para conectar una cuenta hay que haber entrado con la tuya: es donde se guardan las claves para que te sigan a cualquier dispositivo.",
      code: "sin_cuenta",
      status: 401,
    };

  return { email };
}

function no(f: Fallo) {
  return Response.json({ error: f.error, code: f.code }, { status: f.status });
}

/** El catálogo entero, y qué hay conectado de quien pregunta. */
export async function GET() {
  const pro = (await currentPlan()) === "pro";
  const conCuenta = Boolean(await currentUser());
  const conectadas = pro && conCuenta ? await misConexiones() : [];
  const porId = new Map(conectadas.map((c) => [c.servicio, c]));

  return Response.json({
    pro,
    conCuenta,
    almacen: almacenListo(),
    servicios: SERVICIOS.map((s) => ({
      ...estadoDe(s, porId.get(s.id)),
      admiteEscritura: admiteEscritura(s),
    })),
  });
}

/** Conectar: se comprueba la clave contra el servicio y solo entonces se guarda. */
export async function POST(req: NextRequest) {
  const paso = await puerta();
  if ("error" in paso) return no(paso);

  const { servicio: id, campos, permiso } = (await req.json().catch(() => ({}))) as {
    servicio?: string;
    campos?: Record<string, unknown>;
    permiso?: string;
  };

  const servicio = servicioDe(String(id ?? ""));
  if (!servicio) return Response.json({ error: "Ese servicio no existe." }, { status: 400 });

  const cred: Credenciales = {};
  for (const campo of servicio.campos) {
    const v = campos?.[campo.id];
    if (typeof v !== "string" || !v.trim())
      return Response.json({ error: `Falta ${campo.etiqueta.toLowerCase()}.` }, { status: 400 });
    // Una clave con salto de línea es una clave mal copiada, y el error que da
    // después no se parece en nada a la causa.
    cred[campo.id] = v.trim().replace(/\s+/g, campo.secreto ? "" : " ").slice(0, 2000);
  }

  // Escribir solo si el servicio puede, y solo si lo han pedido a propósito.
  const quiereEscribir = permiso === "escribir" && admiteEscritura(servicio);
  const nivel: Permiso = quiereEscribir ? "escribir" : "leer";

  const prueba = await servicio.verificar(cred, req.signal);
  if (!prueba.ok) return Response.json({ error: prueba.error }, { status: 400 });

  const guardado = await guardarConexion(servicio.id, cred, prueba.cuenta, nivel);
  if (!guardado)
    return Response.json({ error: "No se ha podido guardar la conexión." }, { status: 500 });

  return Response.json({ servicio: servicio.id, cuenta: prueba.cuenta, permiso: nivel });
}

/** Cambiar el permiso sin volver a pegar la clave. */
export async function PATCH(req: NextRequest) {
  const paso = await puerta();
  if ("error" in paso) return no(paso);

  const { servicio: id, permiso } = (await req.json().catch(() => ({}))) as {
    servicio?: string;
    permiso?: string;
  };

  const servicio = servicioDe(String(id ?? ""));
  if (!servicio) return Response.json({ error: "Ese servicio no existe." }, { status: 400 });

  if (permiso === "escribir" && !admiteEscritura(servicio))
    return Response.json(
      {
        error: `${servicio.nombre} es de solo lectura siempre: no tiene ninguna acción que cambie nada.`,
      },
      { status: 400 },
    );

  const nivel: Permiso = permiso === "escribir" ? "escribir" : "leer";
  const hecho = await cambiarPermiso(servicio.id, nivel);
  if (!hecho) return Response.json({ error: "Ese servicio no está conectado." }, { status: 404 });

  return Response.json({ servicio: servicio.id, permiso: nivel });
}

/** Desconectar: la clave se borra, no se guarda apagada. */
export async function DELETE(req: NextRequest) {
  const paso = await puerta();
  if ("error" in paso) return no(paso);

  const id = new URL(req.url).searchParams.get("servicio") ?? "";
  const servicio = servicioDe(id);
  if (!servicio) return Response.json({ error: "Ese servicio no existe." }, { status: 400 });

  await olvidarConexion(servicio.id);
  return Response.json({ servicio: servicio.id, conectado: false });
}
