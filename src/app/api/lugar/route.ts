import { NextResponse } from "next/server";
import { dondeEs, puntoValido } from "@/lib/mapa";

/**
 * De coordenadas a un nombre de sitio, y nada más.
 *
 * Está aparte del chat para que el navegador pueda preguntarlo una vez —al
 * encender la ubicación— y guardarse el nombre. Así, en cada mensaje viaja
 * "Zaragoza, Aragón, España" y no hay que traducir coordenadas otra vez.
 *
 * No escribe nada en ninguna base de datos: entra un punto, sale un nombre.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!puntoValido(cuerpo)) {
    return NextResponse.json({ error: "Faltan las coordenadas." }, { status: 400 });
  }

  try {
    const lugar = await dondeEs(cuerpo, req.signal);
    return NextResponse.json({ lugar });
  } catch {
    // Que el servicio de mapas esté caído no es un error del usuario: se queda
    // sin nombre y el chat sigue funcionando exactamente igual.
    return NextResponse.json({ lugar: null });
  }
}
