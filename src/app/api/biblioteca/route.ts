import { NextRequest } from "next/server";

import { buscarImagenes, ErrorBiblioteca, ESTANTES, estanteDe } from "@/lib/biblioteca";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * La biblioteca.
 *
 * Pasa por el servidor y no directa desde el navegador por dos motivos: así la
 * dirección del buscador no queda escrita en la página de nadie, y así se puede
 * guardar la respuesta un rato. Ocho estantes que todo el mundo abre y que
 * devuelven lo mismo: pedirlo cada vez sería gastar por gastar.
 *
 * Es gratis y sin cuenta, a propósito. Inspirarse no es una función de pago:
 * es de las cosas que hacen que alguien se quede.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const estante = url.searchParams.get("estante") ?? "";
  const busca = (url.searchParams.get("busca") ?? "").trim();
  const pagina = Number(url.searchParams.get("pagina") ?? "1");

  const ficha = estanteDe(estante);
  const consulta = busca || ficha?.busqueda || ESTANTES[0].busqueda;

  try {
    const { imagenes, total, fuente } = await buscarImagenes(consulta, {
      pagina: Number.isFinite(pagina) ? pagina : 1,
      // Buscando a mano no se prefiere ninguno: manda lo que haya escrito.
      prefiere: busca ? undefined : ficha?.prefiere,
      signal: req.signal,
    });

    return Response.json(
      { imagenes, total, fuente, estantes: ESTANTES },
      {
        headers: {
          // Media hora en el borde: lo que hay en un estante no cambia de un
          // minuto a otro, y así ochenta personas mirando lo mismo son una
          // sola petición.
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof ErrorBiblioteca
            ? err.message
            : "No se ha podido abrir la biblioteca ahora mismo.",
        imagenes: [],
        estantes: ESTANTES,
      },
      { status: 502 },
    );
  }
}
