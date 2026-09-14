import {
  comoLlegar,
  distanciaKm,
  dondeEs,
  enlaceRuta,
  enlaceSitio,
  hayGoogleMaps,
  puntoValido,
  queHayCerca,
  type Punto,
  type Sitio,
  type Transporte,
} from "../mapa";
import { envolverAjeno } from "./ajeno";
import type { Herramienta, Resultado } from "./tipos";

/**
 * Mapas: dónde está, qué hay cerca y cómo se llega.
 *
 * La ubicación no se saca de ningún sitio a escondidas: la manda el navegador
 * en la petición, y solo si esa persona le dio permiso en Ajustes. Cuando no
 * la hay, la herramienta sigue sirviendo —"cómo llego de Zaragoza a Jaca" no
 * necesita saber dónde estás—, solo que hay que decirle de dónde se sale.
 *
 * Lo que devuelve va con enlaces de Google Maps porque es lo que la gente
 * tiene en el móvil: al tocarlo se abre la aplicación con la ruta puesta, sin
 * volver a escribir nada.
 */

function conNota(s: Sitio): string {
  const trozos = [s.nombre];
  if (s.km !== undefined) trozos.push(`a ${s.km} km`);
  if (s.nota) trozos.push(`${s.nota}/5${s.cuantasNotas ? ` (${s.cuantasNotas} opiniones)` : ""}`);
  if (s.abierto === true) trozos.push("abierto ahora");
  if (s.abierto === false) trozos.push("cerrado ahora");
  return trozos.join(" · ");
}

/**
 * Los nombres y direcciones los escribe quien puso ese sitio en el mapa, no
 * nosotros: van marcados como texto ajeno, igual que los resultados de buscar.
 */
function comoLista(sitios: Sitio[], fuente: string): string {
  return envolverAjeno(
    fuente,
    sitios
      .map((s, i) => `${i + 1}. ${conNota(s)}\n   ${s.direccion ?? ""}\n   ${enlaceSitio(s)}`)
      .join("\n\n"),
  );
}

const TRANSPORTES: Transporte[] = ["coche", "andando", "bici", "transporte"];

export const herramientaMapa: Herramienta = {
  nombre: "mapa",
  descripcion: `Mapas y sitios reales: dónde está el usuario, qué hay cerca y cómo se llega
de un sitio a otro. Úsala cuando pregunte por lugares concretos —"qué hago este fin de
semana", "planifícame una excursión", "cómo llego a...", "algo para comer por aquí",
"qué ver en esta ciudad"—, en vez de tirar de memoria: los horarios, las distancias y
los sitios que han abierto o cerrado no te los sabes.

Acciones:
- "donde_estoy": en qué ciudad o pueblo está. Sin parámetros. Úsala primero cuando
  diga "aquí", "por la zona" o "en mi ciudad" y no sepas dónde es.
- "cerca": qué hay alrededor. En "que" pon lo que buscas tal cual ("museos",
  "restaurantes con terraza", "rutas de senderismo", "parques infantiles").
- "como_llegar": la ruta. "hasta" es obligatorio; "desde" solo si NO sale de donde
  está ahora.

Si te dice que no sabe dónde está el usuario, pregúntale desde dónde sale o de qué
ciudad hablamos; no te lo inventes ni supongas que sigue donde estaba ayer.`,
  parametros: {
    type: "object",
    properties: {
      accion: { type: "string", enum: ["donde_estoy", "cerca", "como_llegar"] },
      que: {
        type: "string",
        description: 'Para "cerca": qué se busca. Por ejemplo "museos" o "dónde desayunar".',
      },
      desde: {
        type: "string",
        description:
          'Para "como_llegar": de dónde sale, si no es de donde está ahora. Un sitio o una ciudad.',
      },
      hasta: { type: "string", description: 'Para "como_llegar": el destino.' },
      transporte: { type: "string", enum: TRANSPORTES },
      radio_km: { type: "number", description: 'Para "cerca": cuánto alrededor. Por defecto 5.' },
    },
    required: ["accion"],
  },
  // Sin clave de Google funciona igual con OpenStreetMap, así que siempre está.
  disponible: () => true,
  async ejecutar(args, ctx): Promise<Resultado> {
    const aqui: Punto | undefined = puntoValido(ctx.ubicacion) ? ctx.ubicacion : undefined;
    const accion = String(args.accion ?? "");
    const fuente = hayGoogleMaps() ? "Google Maps" : "OpenStreetMap";

    const sinUbicacion =
      "No sé dónde está esta persona: no ha dado permiso de ubicación, o no ha llegado. " +
      "Pregúntale de qué ciudad o desde qué sitio hablamos. Puede activarla en Ajustes → Ubicación.";

    try {
      if (accion === "donde_estoy") {
        if (!aqui) return { texto: sinUbicacion };
        ctx.avisar?.("Mirando dónde estás");
        const nombre = await dondeEs(aqui, ctx.signal);
        return {
          texto: nombre
            ? `Está en ${nombre}. (Ubicación aproximada, redondeada a un kilómetro.)`
            : "No he podido traducir sus coordenadas a un lugar con nombre.",
        };
      }

      if (accion === "cerca") {
        const que = String(args.que ?? "").trim();
        if (!que) return { texto: "", error: "No has dicho qué buscar cerca." };
        if (!aqui) return { texto: sinUbicacion };

        ctx.avisar?.(`Buscando ${que} cerca`);
        const radio = Math.min(50, Math.max(0.5, Number(args.radio_km) || 5));
        const sitios = await queHayCerca(que, aqui, radio, ctx.modo === "code" ? 4 : 8, ctx.signal);
        if (sitios.length === 0)
          return { texto: `No he encontrado nada de "${que}" en ${radio} km a la redonda.` };

        return {
          texto: `${sitios.length} resultados de "${que}" a menos de ${radio} km (${fuente}):\n\n${comoLista(
            sitios,
            fuente,
          )}`,
        };
      }

      if (accion === "como_llegar") {
        const hasta = String(args.hasta ?? "").trim();
        if (!hasta) return { texto: "", error: "No has dicho a dónde." };
        const desdeTexto = String(args.desde ?? "").trim();
        if (!desdeTexto && !aqui) return { texto: sinUbicacion };

        const transporte = (
          TRANSPORTES.includes(args.transporte as Transporte) ? args.transporte : "coche"
        ) as Transporte;

        ctx.avisar?.(`Calculando cómo llegar a ${hasta}`);
        const ruta = await comoLlegar(desdeTexto || aqui!, hasta, transporte, ctx.signal);
        if (!ruta)
          return {
            texto: `No he encontrado "${hasta}" en el mapa. Aquí tienes el enlace por si el nombre es otro: ${enlaceRuta(
              desdeTexto || "mi ubicación",
              hasta,
              transporte,
            )}`,
          };

        const distancia = ruta.exacto
          ? `${ruta.km} km por carretera${ruta.duracion ? `, unos ${ruta.duracion}` : ""}`
          : `${ruta.km} km en línea recta (por carretera será más; no tengo la ruta exacta, dilo así y no te inventes el tiempo del trayecto)`;

        return {
          texto: [
            `De ${ruta.desde} a ${ruta.hasta}, ${
              { coche: "en coche", andando: "andando", bici: "en bici", transporte: "en transporte público" }[
                transporte
              ]
            }: ${distancia}.`,
            ruta.pasos?.length ? `\nPor dónde:\n${ruta.pasos.map((p) => `- ${p}`).join("\n")}` : "",
            `\nEnlace para abrirlo en Google Maps: ${ruta.enlace}`,
          ]
            .filter(Boolean)
            .join("\n"),
        };
      }

      return { texto: "", error: `Acción desconocida: "${accion}".` };
    } catch (err) {
      return {
        texto: "",
        error: `El servicio de mapas ha fallado (${
          err instanceof Error ? err.message : "motivo desconocido"
        }).`,
      };
    }
  },
};

/** Para la ficha de "qué sé hacer" y para las pruebas. */
export const DISTANCIA = distanciaKm;
