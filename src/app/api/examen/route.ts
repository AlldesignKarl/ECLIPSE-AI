import { NextRequest } from "next/server";

import { currentPlan } from "@/lib/plan-server";
import {
  apuntarIntento,
  apuntarMaterial,
  borrarExamen,
  crearExamen,
  examenDe,
  examenesListos,
  guardar,
  misExamenes,
  quien,
} from "@/lib/examen/almacen";
import { corregir, hacerDesarrollo, hacerQuiz, hacerResumen, leerMateriales } from "@/lib/examen/estudiar";
import {
  MAX_MATERIAL,
  MAX_MATERIALES,
  notaDe,
  type Intento,
  type Material,
  type PreguntaLarga,
} from "@/lib/examen/tipos";
import type { Attachment } from "@/lib/types";

/**
 * El Modo Examen por fuera.
 *
 * Una sola ruta con una acción por cuerpo, como el resto de la aplicación. Y
 * con el trabajo pesado —leer los apuntes— en su propia acción y no dentro de
 * "crear": leer veinte fotos tarda, y una función de este hosting se corta a los
 * sesenta segundos. Así crear vuelve al instante y el análisis se pide aparte,
 * con su pantalla de "analizando" delante.
 */

export const maxDuration = 60;

function no(error: string, status = 400, code?: string) {
  return Response.json({ error, code }, { status });
}

const texto = (v: unknown, tope: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, tope) : "";

/** Mis exámenes, o uno concreto con todo dentro. */
export async function GET(req: NextRequest) {
  if (!examenesListos())
    return no("El Modo Examen necesita la base de datos, y este servidor no la tiene.", 503, "no_store");

  const email = await quien();
  if (!email) return Response.json({ examenes: [], sinCuenta: true });

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const examen = await examenDe(email, id);
    return examen ? Response.json({ examen }) : no("Ese examen ya no está.", 404);
  }

  /*
    En la lista van los exámenes SIN su extracto.

    El extracto de unos apuntes son miles de palabras, y esta lista se pide cada
    vez que se abre la pantalla para enseñar cuatro títulos y cuatro fechas.
    Mandarlo entero sería traerse los apuntes de veinte exámenes para pintar una
    lista.
  */
  const examenes = (await misExamenes(email)).map(({ extracto, resumen, ...resto }) => ({
    ...resto,
    trozos: extracto.length,
    conResumen: Boolean(resumen),
  }));
  return Response.json({ examenes, pro: (await currentPlan()) === "pro" });
}

export async function POST(req: NextRequest) {
  if (!examenesListos()) return no("El Modo Examen necesita la base de datos.", 503, "no_store");

  const email = await quien();
  if (!email)
    return no("Para el Modo Examen hay que entrar con tu cuenta: los apuntes se guardan en ella.", 401, "sin_cuenta");

  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = texto(cuerpo.accion, 30);
  const id = texto(cuerpo.id, 40);

  /* ------------------------------ Crear ------------------------------ */
  if (accion === "crear") {
    const asignatura = texto(cuerpo.asignatura, 60);
    const titulo = texto(cuerpo.titulo, 80);
    if (!asignatura) return no("Ponle al menos la asignatura.");

    const temas = (Array.isArray(cuerpo.temas) ? cuerpo.temas : [])
      .map((t) => texto(t, 80))
      .filter(Boolean)
      .slice(0, 20);

    const fecha = texto(cuerpo.fecha, 10);
    const examen = await crearExamen(email, {
      asignatura,
      titulo: titulo || `Examen de ${asignatura}`,
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined,
      temas,
      extra: texto(cuerpo.extra, 2000) || undefined,
    });
    return Response.json({ examen });
  }

  const examen = id ? await examenDe(email, id) : null;
  if (!examen) return no("Ese examen ya no está.", 404);

  /* --------------------------- Analizar ----------------------------- */
  if (accion === "analizar") {
    const crudos = Array.isArray(cuerpo.materiales) ? cuerpo.materiales : [];
    if (!crudos.length && !examen.extracto.length && !examen.extra)
      return no("Sube al menos una foto o un archivo, o cuéntame qué entra.");

    const adjuntos: Attachment[] = [];
    const nuevos: Material[] = [];

    for (const c of crudos.slice(0, MAX_MATERIALES)) {
      const uno = c as { nombre?: unknown; mime?: unknown; datos?: unknown; kind?: unknown };
      const nombre = texto(uno.nombre, 120) || "material";
      const datos = typeof uno.datos === "string" ? uno.datos : "";
      if (!datos || datos.length > MAX_MATERIAL) continue;

      const kind = uno.kind === "pdf" ? "pdf" : uno.kind === "text" ? "text" : "image";
      adjuntos.push({
        id: nombre,
        name: nombre,
        mime: texto(uno.mime, 60) || "image/jpeg",
        size: datos.length,
        kind,
        data: datos,
      });
      nuevos.push({
        id: nombre,
        nombre,
        tipo: kind === "pdf" ? "pdf" : kind === "text" ? "texto" : "imagen",
        cuando: Date.now(),
        legible: true,
      });
    }

    const lectura = await leerMateriales({
      examen,
      adjuntos,
      // Se le pasan también los que ya había leído antes: así los nombres de
      // archivo que cite siguen existiendo aunque esto sea una segunda tanda.
      nombres: [...examen.materiales.map((m) => m.nombre), ...nuevos.map((m) => m.nombre)],
      signal: req.signal,
    });
    if (lectura.error) return no(lectura.error, 502);

    for (const m of nuevos) {
      m.legible = !lectura.ilegibles.includes(m.nombre);
      if (!m.legible)
        m.aviso = "No he podido leer nada de aquí. Si es una foto, prueba con más luz y sin mover.";
      await apuntarMaterial(email, id, m);
    }

    const actualizado = (await examenDe(email, id))!;
    actualizado.mapa = lectura.mapa;
    /*
      Se SUMA al extracto que hubiera, no se sustituye.

      Subir más apuntes añade materia. Perder lo de la semana pasada por subir
      una foto hoy sería exactamente lo que nadie espera de un botón que pone
      "añadir material".
    */
    const conocidos = new Set(actualizado.extracto.map((t) => t.texto));
    actualizado.extracto = [
      ...actualizado.extracto,
      ...lectura.extracto
        .filter((t) => !conocidos.has(t.texto))
        .map((t, i) => ({ ...t, id: `t${actualizado.extracto.length + i}` })),
    ];
    actualizado.analizado = Date.now();
    // El resumen de antes ya no vale: hay materia nueva.
    actualizado.resumen = undefined;
    await guardar(email, actualizado);

    return Response.json({ examen: actualizado, ilegibles: lectura.ilegibles });
  }

  /* ---------------------------- Resumen ----------------------------- */
  if (accion === "resumen") {
    const largo = cuerpo.largo === "completo" ? "completo" : "rapido";
    const yaEsta = examen.resumen?.[largo];
    if (yaEsta && cuerpo.rehacer !== true) return Response.json({ texto: yaEsta });

    const r = await hacerResumen({ examen, largo, signal: req.signal });
    if (!r.ok) return no(r.error, 502);

    examen.resumen = { rapido: "", completo: "", ...examen.resumen, [largo]: r.texto };
    await guardar(email, examen);
    return Response.json({ texto: r.texto });
  }

  /* ------------------------------ Quiz ------------------------------ */
  if (accion === "quiz") {
    const tipo = ["rapido", "repaso", "dificil", "fallos"].includes(String(cuerpo.tipo))
      ? (cuerpo.tipo as "rapido" | "repaso" | "dificil" | "fallos")
      : "rapido";

    const temas = (Array.isArray(cuerpo.temas) ? cuerpo.temas : [])
      .map((t) => texto(t, 60))
      .filter(Boolean);

    const r = await hacerQuiz({ examen, tipo, temas, signal: req.signal });
    if (!r.ok) return no(r.error, 502);
    return Response.json({ preguntas: r.preguntas });
  }

  /* --------------------------- Desarrollo --------------------------- */
  if (accion === "desarrollo") {
    const temas = (Array.isArray(cuerpo.temas) ? cuerpo.temas : [])
      .map((t) => texto(t, 60))
      .filter(Boolean);

    const r = await hacerDesarrollo({ examen, temas, signal: req.signal });
    if (!r.ok) return no(r.error, 502);
    return Response.json({ preguntas: r.preguntas });
  }

  /* --------------------------- Corregir ----------------------------- */
  if (accion === "corregir") {
    const pregunta = cuerpo.pregunta as PreguntaLarga | undefined;
    const respuesta = typeof cuerpo.respuesta === "string" ? cuerpo.respuesta : "";
    if (!pregunta?.enunciado || !respuesta.trim()) return no("Falta la pregunta o la respuesta.");

    const r = await corregir({ pregunta, respuesta, extracto: examen.extracto, signal: req.signal });
    if (!r.ok) return no(r.error, 502);
    return Response.json({ correccion: r.correccion });
  }

  /* ---------------------------- Resultado --------------------------- */
  if (accion === "resultado") {
    const tipo = cuerpo.tipo === "desarrollo" ? "desarrollo" : "quiz";
    const porTema = (cuerpo.porTema ?? {}) as Intento["porTema"];
    const aciertos = Number(cuerpo.aciertos) || 0;
    const total = Number(cuerpo.total) || 0;

    const intento: Intento = {
      id: `${Date.now()}`,
      tipo,
      cuando: Date.now(),
      nota: Number(cuerpo.nota) >= 0 ? Math.min(10, Number(cuerpo.nota)) : notaDe(aciertos, total),
      aciertos,
      total,
      porTema,
      falladas: (Array.isArray(cuerpo.falladas) ? cuerpo.falladas : [])
        .map((t) => texto(t, 60))
        .filter(Boolean),
    };

    const actualizado = await apuntarIntento(email, id, intento);
    return Response.json({ examen: actualizado });
  }

  return no("No sé qué quieres hacer.");
}

export async function DELETE(req: NextRequest) {
  if (!examenesListos()) return no("El Modo Examen necesita la base de datos.", 503, "no_store");
  const email = await quien();
  if (!email) return no("Hay que entrar con tu cuenta.", 401, "sin_cuenta");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return no("¿Cuál borro?");
  await borrarExamen(email, id);
  return Response.json({ ok: true });
}
