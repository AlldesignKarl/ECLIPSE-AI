import { NextRequest } from "next/server";

import { currentUser } from "@/lib/auth";
import { guardarConexion } from "@/lib/conexiones/almacen";
import { servicioDe } from "@/lib/conexiones/registro";
import {
  canjearCodigo,
  dondeAutorizar,
  firmarEstado,
  leerEstado,
  oauthListo,
  proveedorDe,
} from "@/lib/conexiones/oauth";
import { currentPlan } from "@/lib/plan-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * El baile de OAuth, ida y vuelta, en una sola ruta.
 *
 * `?empezar=1` manda a la persona al proveedor; sin eso, es la vuelta con el
 * código. Las dos cosas juntas porque la dirección de vuelta hay que darla de
 * alta en el panel de Google letra por letra, y cuantas menos haya que dar de
 * alta, menos hay que cambiar el día que se añada Calendar o Drive.
 *
 * Lo que NO se hace aquí, y es lo que sostiene todo: fiarse de lo que trae el
 * navegador. El `code` se cambia por los testigos hablando con Google desde el
 * servidor, y de quién es la vuelta sale del `state` FIRMADO, no de una cookie
 * que podría ser de otra pestaña ni de un parámetro que se puede escribir a
 * mano.
 */

function vueltaConAviso(origen: string, aviso: string) {
  const url = new URL("/", origen);
  url.searchParams.set("conexion", aviso);
  return Response.redirect(url.toString(), 303);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ servicio: string }> }) {
  const { servicio: id } = await ctx.params;
  const servicio = servicioDe(id);
  const origen = req.nextUrl.origin;

  if (!servicio?.oauth) return vueltaConAviso(origen, "no_existe");

  // Quién da el permiso sale del servicio, no está escrito aquí: así el día que
  // haya un segundo proveedor esto no se conecta contra Google por inercia.
  const proveedor = proveedorDe(servicio.oauth);
  if (!proveedor) return vueltaConAviso(origen, "no_existe");
  if (!oauthListo(proveedor)) return vueltaConAviso(origen, "sin_configurar");

  const url = new URL(req.url);

  /* ------------------------------ La ida ------------------------------ */
  if (url.searchParams.get("empezar")) {
    // Las mismas puertas que conectar a mano: Pro y cuenta. Si no se comprueban
    // aquí, este camino sería la forma de saltárselas.
    if ((await currentPlan()) !== "pro") return vueltaConAviso(origen, "solo_pro");

    const email = await currentUser();
    if (!email) return vueltaConAviso(origen, "sin_cuenta");

    return Response.redirect(
      dondeAutorizar(proveedor, { origen, servicio: id, estado: firmarEstado(email) }),
      303,
    );
  }

  /* ----------------------------- La vuelta ---------------------------- */
  const error = url.searchParams.get("error");
  if (error) return vueltaConAviso(origen, error === "access_denied" ? "cancelada" : "fallo");

  const codigo = url.searchParams.get("code");
  const estado = url.searchParams.get("state") ?? "";
  if (!codigo) return vueltaConAviso(origen, "fallo");

  /*
    De quién es esta vuelta lo dice la FIRMA, no la sesión del navegador.

    Si se usara la cookie, una vuelta abierta en otro navegador —o en el mismo
    después de cambiar de cuenta— conectaría el correo de una persona a la
    cuenta de otra. El `state` va firmado con el secreto del servidor y caduca
    en cinco minutos.
  */
  const email = leerEstado(estado);
  if (!email) return vueltaConAviso(origen, "caducada");

  try {
    const testigos = await canjearCodigo(proveedor, { codigo, origen, servicio: id });

    const cred = {
      acceso: testigos.acceso,
      refresco: testigos.refresco,
      caduca: String(testigos.caduca),
    };

    // Se comprueba antes de guardar, igual que una clave pegada a mano: si los
    // testigos no sirven, guardarlos es condenar a alguien a descubrirlo luego.
    const prueba = await servicio.verificar(cred);
    if (!prueba.ok) return vueltaConAviso(origen, "fallo");

    /*
      Nace en SOLO LECTURA, como todas.

      Aunque Google haya concedido también el permiso de enviar —se pide junto
      para no tener que volver a molestar—, que ECLIPSE lo USE es una segunda
      decisión que se toma en Conexiones. El permiso del proveedor y el permiso
      de la aplicación son dos cosas distintas.
    */
    const guardada = await guardarConexion(id, cred, prueba.cuenta, "leer", email);
    return vueltaConAviso(origen, guardada ? `ok_${id}` : "fallo");
  } catch {
    return vueltaConAviso(origen, "fallo");
  }
}
