import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { entregar, puedeEnviar } from "@/lib/entrega";
import { errores, limpiar, type Solicitud } from "@/lib/solicitud";

/**
 * El formulario de la web corporativa.
 * ---------------------------------------------------------------------------
 * Recibe, comprueba y entrega. La comprobación se hace OTRA VEZ aquí aunque el
 * navegador ya la haya hecho: a esta dirección se le puede llamar a mano.
 *
 * Dónde acaba cada solicitud lo decide `lib/entrega.ts`. Si no hay
 * ningún camino configurado se contesta 503 y se dice: el formulario enseña
 * entonces el correo directo en vez de dar las gracias por algo que se ha
 * perdido.
 */
export const runtime = "nodejs";
// El plan gratuito de Vercel corta a los 60 pase lo que pase; esto tarda dos
// segundos como mucho, así que con 20 va sobrado y falla antes si algo se cuelga.
export const maxDuration = 20;

/** Quién envía, sin guardar de nadie su dirección: solo una huella. */
function huellaDe(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desconocida";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

export async function POST(req: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "No hemos podido leer el formulario." }, { status: 400 });
  }

  const datos = (cuerpo ?? {}) as Partial<Solicitud> & { web?: string };

  // El campo trampa: está escondido para las personas y a la vista para los
  // robots, que lo rellenan siempre. Se contesta que sí y no se entrega nada,
  // porque decirle a un robot que le hemos pillado es enseñarle a colarse.
  if (typeof datos.web === "string" && datos.web.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const fallos = errores(datos);
  if (Object.keys(fallos).length > 0) {
    return NextResponse.json(
      { error: "Revisa los campos marcados.", campos: fallos },
      { status: 400 },
    );
  }

  if (!(await puedeEnviar(huellaDe(req)))) {
    return NextResponse.json(
      { error: "Acabas de enviarnos un mensaje. Espera un momento antes del siguiente." },
      { status: 429 },
    );
  }

  const solicitud = limpiar(datos);
  const resultado = await entregar(solicitud);

  if (!resultado.entregada) {
    return NextResponse.json(
      {
        error:
          "No hemos podido hacer llegar tu mensaje. Escríbenos directamente y lo vemos hoy mismo.",
        sinBuzon: true,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, referencia: resultado.id });
}
