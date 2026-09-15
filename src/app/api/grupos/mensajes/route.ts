import { NextRequest } from "next/server";

import { resolveKey } from "@/lib/keys";
import { buildSystemPrompt } from "@/lib/prompts";
import { activeProvider } from "@/lib/provider";
import { conversarConHerramientas } from "@/lib/tools/bucle";
import type { CompatProvider } from "@/lib/openai-compat";
import { apuntarMensaje, grupoDe, mensajesDe, quien } from "@/lib/grupos/almacen";
import { comoSeLeVe, estaDentro, leHablanAEclipse } from "@/lib/grupos/tipos";

export const runtime = "nodejs";
/*
  Sesenta, que es lo que hay.

  Decía 120 y eso era pedir algo que el plan gratuito de Vercel no da: corta a
  los 60 pase lo que pase. Con 120 escrito aquí, una respuesta larga de ECLIPSE
  en un grupo se moría a mitad sin guardarse ni dejar rastro, y en el grupo no
  aparecía nada. Con el número de verdad, lo de dentro se puede dimensionar
  para caber.
*/
export const maxDuration = 60;

/**
 * Cuánto se le deja pensar antes de dar la respuesta por perdida.
 *
 * Cuarenta y cinco de los sesenta: los quince que sobran son para guardar el
 * mensaje y contestarle al navegador. Cortar nosotros y no el hosting es la
 * diferencia entre "no ha contestado" y que no se entere nadie.
 */
const LIMITE_MS = 45_000;

/**
 * Lo que se dice en un grupo.
 *
 * ECLIPSE aquí no es un chat con uno: es alguien sentado en una mesa donde
 * hablan varios. Eso cambia dos cosas.
 *
 * La primera es que tiene que saber QUIÉN dice cada cosa. "Yo ya lo he hecho"
 * no significa lo mismo dicho por Ana que por Luis, y sin los nombres delante
 * no puede seguir una conversación de cuatro personas.
 *
 * La segunda es cuándo abrir la boca. Si contesta a todo, el grupo es
 * inhabitable; si no contesta nunca, no pinta nada. Contesta cuando le nombran
 * o cuando le piden algo directamente. El resto lo lee y se calla, que es lo
 * que haría alguien educado en esa mesa.
 */

const COMO_ESTAR = `Estás en un GRUPO: aquí hablan varias personas, no una.

- Cada mensaje viene con el nombre de quien lo escribió. Úsalos: dirígete a la
  persona que ha preguntado y no al aire.
- Lee lo que se han dicho entre ellos aunque no fuera para ti: el contexto de lo
  que te preguntan suele estar ahí.
- Contesta a quien te ha hablado, no a todos a la vez. Y si dos han pedido cosas
  distintas, ocúpate de las dos y di cuál es de quién.
- Corto. En un grupo, un párrafo de veinte líneas lo tienen que leer todos.
- No repitas lo que ya ha dicho alguien del grupo para rellenar. Si alguien ya
  ha respondido bien, dilo y añade solo lo que falte.
- Y no tomes partido en lo suyo. Si están decidiendo entre dos planes, dales lo
  que haga falta para decidir; la decisión es de ellos.`;

async function puerta(id: string) {
  const email = await quien();
  if (!email) return { error: "Hay que entrar con tu cuenta.", status: 401 } as const;

  const grupo = await grupoDe(id);
  if (!grupo) return { error: "Ese grupo ya no existe.", status: 404 } as const;
  if (!estaDentro(grupo, email))
    return { error: "No estás en ese grupo.", status: 403 } as const;

  return { email, grupo } as const;
}

/** Lo que se ha dicho. El navegador lo pide cada pocos segundos. */
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const paso = await puerta(id);
  if ("error" in paso) return Response.json({ error: paso.error }, { status: paso.status });

  const mensajes = await mensajesDe(id);
  return Response.json({
    // El correo de quien escribió no sale nunca: solo el nombre con el que se
    // le ve, y si es tuyo o no.
    mensajes: mensajes.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      texto: m.texto,
      cuando: m.cuando,
      mio: m.de === paso.email,
      deEclipse: m.de === null,
    })),
    /*
      Y quién hay dentro ahora mismo.

      Va aquí y no en otra petición porque esto se pide cada pocos segundos de
      todas formas. Sin ello, quien tiene el grupo abierto seguía viendo "1
      persona" después de que entrara alguien: la lista de miembros se había
      leído al abrir y no se volvía a mirar nunca.
    */
    miembros: paso.grupo.miembros.map((m) => ({
      nombre: comoSeLeVe(m.email, m.nombre),
      dueno: m.dueno,
      yo: m.email === paso.email,
    })),
  });
}

/** Decir algo. Y, si le hablan a ECLIPSE, que conteste. */
export async function POST(req: NextRequest) {
  const { id, texto } = (await req.json().catch(() => ({}))) as { id?: string; texto?: string };
  const paso = await puerta(String(id ?? ""));
  if ("error" in paso) return Response.json({ error: paso.error }, { status: paso.status });

  const dicho = (texto ?? "").trim().slice(0, 4000);
  if (!dicho) return Response.json({ error: "No has escrito nada." }, { status: 400 });

  const yo = paso.grupo.miembros.find((m) => m.email === paso.email);
  const anteriores = await mensajesDe(paso.grupo.id);

  await apuntarMensaje(paso.grupo.id, {
    de: paso.email,
    nombre: yo?.nombre ?? "alguien",
    texto: dicho,
  });

  if (!leHablanAEclipse(dicho, anteriores.length === 0))
    return Response.json({ contesta: false });

  const provider = await activeProvider();
  if (!provider || provider === "anthropic" || provider === "google")
    return Response.json({ contesta: false, aviso: "sin_motor" });

  const key = await resolveKey(provider);
  if (!key) return Response.json({ contesta: false, aviso: "sin_clave" });

  /*
    Lo que ha pasado en la mesa, con los nombres delante.

    Todo va como un solo turno de "usuario" y no como una conversación de ida y
    vuelta, porque no lo es: son cuatro personas hablando. Poniendo el nombre
    delante de cada frase, el modelo puede seguir quién dijo qué, que es lo
    único que hace falta para que conteste como alguien que estaba escuchando.
  */
  const historia = [...anteriores.slice(-40), { de: paso.email, nombre: yo?.nombre ?? "alguien", texto: dicho }]
    .map((m) => (m.de === null ? `ECLIPSE: ${m.texto}` : `${m.nombre}: ${m.texto}`))
    .join("\n");

  let respuesta = "";
  try {
    for await (const e of conversarConHerramientas({
      provider: provider as CompatProvider,
      key,
      system: `${buildSystemPrompt({
        mode: "chat",
        plan: "pro",
        web: true,
        engine: provider,
      })}\n\n${COMO_ESTAR}`,
      turns: [
        {
          role: "user",
          content: `Esto es lo que se ha dicho en el grupo «${paso.grupo.nombre}»:\n\n${historia}\n\nContesta a lo último que te han pedido.`,
        },
      ],
      speed: "equilibrado",
      mode: "chat",
      plan: "pro",
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(LIMITE_MS)]),
    })) {
      if (e.texto) respuesta += e.texto;
    }
  } catch {
    return Response.json({ contesta: false, aviso: "fallo" });
  }

  const limpia = respuesta.trim();
  if (!limpia) return Response.json({ contesta: false });

  await apuntarMensaje(paso.grupo.id, { de: null, nombre: "ECLIPSE", texto: limpia });
  return Response.json({ contesta: true });
}
