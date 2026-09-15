import { NextRequest } from "next/server";

import { resolveKey } from "@/lib/keys";
import { buildSystemPrompt } from "@/lib/prompts";
import { activeProvider } from "@/lib/provider";
import { conversarConHerramientas } from "@/lib/tools/bucle";
import type { CompatProvider } from "@/lib/openai-compat";
import { del as olvidar, tomarTurno } from "@/lib/store";
import { unaRespuesta } from "@/lib/una-respuesta";
import {
  apuntarMensaje,
  borrarMensaje,
  grupoDe,
  guardarImagen,
  imagenDe,
  mensajesDe,
  quien,
} from "@/lib/grupos/almacen";
import { comoSeLeVe, estaDentro, leHablanAEclipse, MODO_POR_DEFECTO } from "@/lib/grupos/tipos";

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

/**
 * Lo que se le añade cuando el grupo le ha puesto a contestar a TODO.
 *
 * Sin esto, "contesta a todo" se convierte en tres párrafos contestando a un
 * "jajaja", que es la forma más rápida de que alguien lo apague. Contestar a
 * todo es estar pendiente, no llenar la pantalla.
 */
const A_TODO = `En este grupo te han puesto a contestar a TODOS los mensajes, no
solo cuando te nombran. Eso cambia el tamaño de lo que dices, no las ganas:

- Si el mensaje no te pide nada (una risa, un «vale», dos que quedan a las ocho),
  contesta en una línea o menos, o di solo lo que haga falta para que sigan.
- Si te piden algo de verdad, entonces sí: contesta entero.
- No resumas la conversación cada vez ni repitas lo que acaban de decir.`;

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
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";

  /*
    Una foto del grupo.

    Se sirve aquí y no dentro de la lista de mensajes porque la lista se pide
    cada segundo y medio: mandar las fotos ahí dentro sería reenviarlas todas,
    a todos, todo el rato. Así cada foto se baja una vez y el navegador la
    guarda en su caché.
  */
  const foto = url.searchParams.get("foto");
  if (foto) {
    const paso = await puerta(id);
    if ("error" in paso) return Response.json({ error: paso.error }, { status: paso.status });
    // Que la foto sea de ESTE grupo: el identificador lleva el grupo delante.
    if (!foto.startsWith(`${id}:`))
      return Response.json({ error: "Esa foto no es de este grupo." }, { status: 403 });

    const datos = await imagenDe(foto);
    if (!datos) return Response.json({ error: "Esa foto ya no está." }, { status: 404 });

    const [cabecera, base64] = datos.split(",");
    const tipo = /data:([^;]+)/.exec(cabecera)?.[1] ?? "image/jpeg";
    return new Response(Buffer.from(base64, "base64"), {
      headers: {
        "Content-Type": tipo,
        // Una foto no cambia nunca: se guarda en el navegador y no se vuelve a
        // pedir. Privada, que es de un grupo y no de internet.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }

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
      imagen: m.imagen,
      // Se puede borrar lo tuyo; y quien creó el grupo puede quitar cualquiera,
      // que es lo que hace falta cuando alguien sube algo que no debía.
      borrable:
        m.de === paso.email ||
        paso.grupo.miembros.some((x) => x.email === paso.email && x.dueno),
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
    // Cómo está ECLIPSE ahora mismo. Va aquí porque lo puede cambiar el dueño
    // mientras los demás tienen el grupo abierto: si no se refresca, los otros
    // siguen viendo que calla cuando ya contesta a todo.
    eclipse: paso.grupo.eclipse ?? MODO_POR_DEFECTO,
  });
}

/**
 * Decir algo. Y nada más: esto NO espera a que conteste ECLIPSE.
 *
 * Era lo que hacía que un grupo pareciera lento hasta decir basta. El mensaje
 * se guardaba enseguida, pero la petición se quedaba abierta medio minuto
 * mientras el modelo escribía, así que el teléfono de quien lo mandaba no
 * soltaba el botón y los demás no veían nada hasta el siguiente vistazo. Ahora
 * esto guarda y contesta al instante; la respuesta de ECLIPSE se pide aparte y
 * cae sola en el grupo cuando está.
 */
/**
 * Quitar un mensaje.
 *
 * El tuyo siempre; y si creaste el grupo, cualquiera: es lo que hace falta
 * cuando alguien sube algo que no debía y no está para borrarlo él.
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const hecho = await borrarMensaje(
    url.searchParams.get("id") ?? "",
    url.searchParams.get("mensaje") ?? "",
  );
  if (!hecho) return Response.json({ error: "Ese mensaje no se puede borrar." }, { status: 403 });
  return Response.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("responder") === "1") return responder(req);

  const { id, texto, imagen } = (await req.json().catch(() => ({}))) as {
    id?: string;
    texto?: string;
    imagen?: string;
  };
  const paso = await puerta(String(id ?? ""));
  if ("error" in paso) return Response.json({ error: paso.error }, { status: paso.status });

  const dicho = (texto ?? "").trim().slice(0, 4000);
  // Con foto no hace falta texto: una foto ya es un mensaje.
  const foto = imagen ? await guardarImagen(paso.grupo.id, imagen) : null;
  if (imagen && !foto)
    return Response.json(
      { error: "Esa foto no se ha podido subir. Prueba con otra: tienen que ser JPG, PNG o WEBP." },
      { status: 400 },
    );
  if (!dicho && !foto) return Response.json({ error: "No has escrito nada." }, { status: 400 });

  const yo = paso.grupo.miembros.find((m) => m.email === paso.email);
  const anteriores = await mensajesDe(paso.grupo.id);

  const guardado = await apuntarMensaje(paso.grupo.id, {
    de: paso.email,
    nombre: yo?.nombre ?? "alguien",
    texto: dicho,
    ...(foto ? { imagen: foto } : {}),
  });

  const modo = paso.grupo.eclipse ?? MODO_POR_DEFECTO;
  return Response.json({
    ok: true,
    id: guardado.id,
    // Para que quien escribe vea "ECLIPSE está escribiendo…" en vez de mirar
    // una pantalla quieta sin saber si va a contestar o no.
    contesta: leHablanAEclipse(dicho, anteriores.length === 0, modo),
  });
}

/**
 * Que conteste ECLIPSE a lo último que se ha dicho.
 *
 * Petición aparte, y por eso el grupo va rápido: mandar un mensaje no espera a
 * nadie. Esta puede tardar sus segundos, y mientras tanto todo el mundo sigue
 * escribiendo.
 */
async function responder(req: NextRequest) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const paso = await puerta(String(id ?? ""));
  if ("error" in paso) return Response.json({ error: paso.error }, { status: paso.status });

  const modo = paso.grupo.eclipse ?? MODO_POR_DEFECTO;
  if (modo === "no") return Response.json({ contesta: false });

  const mensajes = await mensajesDe(paso.grupo.id);
  const ultimo = mensajes.at(-1);
  if (!ultimo) return Response.json({ contesta: false });

  /*
    Si ya ha contestado a esto, no vuelve a contestar.

    En un grupo escriben varios a la vez y cada uno pide la respuesta por su
    cuenta: sin esto, tres personas escribiendo seguido sacarían tres respuestas
    seguidas diciendo lo mismo.
  */
  if (ultimo.de === null) return Response.json({ contesta: false });
  if (!leHablanAEclipse(ultimo.texto, mensajes.length === 1, modo))
    return Response.json({ contesta: false });

  /*
    Un turno, para que conteste UNA vez aunque lo pidan cinco móviles.

    Lo pide quien escribe, pero también los demás si ven que lo último lleva un
    rato sin respuesta —si no, cerrar la aplicación justo después de escribir
    dejaría la pregunta sin contestar para siempre—. Con cinco teléfonos
    mirando, eso son cinco peticiones a la vez: la comprobación de "lo último ya
    es suyo" no basta, porque las cinco miran antes de que conteste ninguna.

    El turno caduca solo: si el servidor se cae a mitad, a los sesenta segundos
    vuelve a poder contestar.
  */
  const turno = `eclipse:grupo:pensando:${paso.grupo.id}:${ultimo.id}`;
  if (!(await tomarTurno(turno, 60))) return Response.json({ contesta: false, yaVa: true });

  const historia = mensajes
    .slice(-40)
    .map((m) => {
      const foto = m.imagen ? " [ha mandado una foto al grupo; tú no puedes verla]" : "";
      return m.de === null ? `ECLIPSE: ${m.texto}` : `${m.nombre}: ${m.texto}${foto}`;
    })
    .join("\n");

  const peticion = `Esto es lo que se ha dicho en el grupo «${paso.grupo.nombre}»:\n\n${historia}\n\nContesta a lo último.`;
  const sistema = `${buildSystemPrompt({ mode: "chat", plan: "pro", web: true })}\n\n${COMO_ESTAR}${
    modo === "siempre" ? `\n\n${A_TODO}` : ""
  }`;

  const reloj = AbortSignal.any([req.signal, AbortSignal.timeout(LIMITE_MS)]);
  let respuesta = "";

  /*
    Con herramientas si se puede, y si no, contestando igual.

    Con Mistral, Groq u OpenRouter puede buscar en la web y mirar lo que tengas
    conectado, que es lo que hace útil una respuesta en un grupo. Con Google o
    con Anthropic no hay bucle de herramientas, y hasta ahora eso significaba
    QUEDARSE CALLADO: el aviso "sin_motor" volvía al navegador y no se pintaba
    en ninguna parte. Contestar sin herramientas es infinitamente mejor que no
    contestar.
  */
  const provider = await activeProvider();
  if (provider === "groq" || provider === "mistral" || provider === "openrouter") {
    const key = await resolveKey(provider);
    if (key) {
      try {
        for await (const e of conversarConHerramientas({
          provider: provider as CompatProvider,
          key,
          system: sistema,
          turns: [{ role: "user", content: peticion }],
          speed: "equilibrado",
          mode: "chat",
          plan: "pro",
          signal: reloj,
        })) {
          if (e.texto) respuesta += e.texto;
        }
      } catch {
        respuesta = "";
      }
    }
  }

  if (!respuesta.trim()) {
    const r = await unaRespuesta({ sistema, mensaje: peticion, tope: 900, signal: reloj });
    if (r.ok) respuesta = r.texto;
    else {
      /*
        Y si tampoco, se dice EN EL GRUPO.

        Callarse era el peor de los finales posibles: quien escribía veía su
        mensaje ahí puesto, sin respuesta, sin aviso y sin saber si había que
        esperar. Un "no puedo, y por esto" se entiende y se arregla.
      */
      await apuntarMensaje(paso.grupo.id, {
        de: null,
        nombre: "ECLIPSE",
        texto: `No he podido contestar a eso. ${r.error}`,
      });
      await olvidar(turno);
      return Response.json({ contesta: false, error: r.error });
    }
  }

  await apuntarMensaje(paso.grupo.id, { de: null, nombre: "ECLIPSE", texto: respuesta.trim() });
  return Response.json({ contesta: true });
}
