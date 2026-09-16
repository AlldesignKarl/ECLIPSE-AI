import { baseDe, pedir, texto, tope } from "./http";
import { accesoVigente, GOOGLE, oauthListo } from "./oauth";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Gmail: el correo de la empresa.
 *
 * Es la primera conexión de ECLIPSE que NO se hace pegando una clave. Google no
 * da una: da un permiso, para una cuenta concreta y revocable desde su panel.
 * Por eso esta va por OAuth (`conexiones/oauth.ts`) y por eso tiene `oauth`
 * puesto: la pantalla enseña un botón de "Conectar con Google" en vez de un
 * formulario donde no habría nada que escribir.
 *
 * Lo que puede hacer, y lo que no:
 *
 * - LEER: buscar en el correo, listar los últimos y abrir uno entero. Es lo que
 *   de verdad cambia el trabajo de alguien: "¿qué me ha escrito este cliente?"
 *   sin salir de la aplicación.
 * - ENVIAR: sí, y por eso está marcado `escribe`. Una conexión nace en solo
 *   lectura como todas, así que mandar correo es una segunda decisión, aparte y
 *   explícita. Y un agente encima puede exigir aprobación humana: mandar un
 *   correo equivocado a un cliente no se recoge.
 * - BORRAR: no. Como en todas las conexiones de esta casa, no hay ni una acción
 *   que elimine nada. En un buzón de trabajo, menos todavía.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

function url(camino: string): string {
  return `${baseDe("gmail", API)}/${camino}`;
}

interface Cabecera {
  name: string;
  value: string;
}

interface Mensaje {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Cabecera[];
    mimeType?: string;
    body?: { data?: string };
    parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[];
  };
}

function cabecera(m: Mensaje, cual: string): string {
  return (m.payload?.headers ?? []).find((h) => h.name.toLowerCase() === cual.toLowerCase())?.value ?? "";
}

function cuando(m: Mensaje): string {
  const t = Number(m.internalDate ?? 0);
  return t ? new Date(t).toISOString().slice(0, 16).replace("T", " ") : "";
}

/**
 * El texto de un correo, buscándolo donde de verdad está.
 *
 * Un correo de Gmail casi nunca tiene el texto en un solo sitio: viene en
 * partes anidadas, con una versión en texto plano y otra en HTML, y a veces la
 * de texto plano está tres niveles más abajo. Recorrerlo entero es lo que hace
 * la diferencia entre leer el correo y leer "(sin contenido)".
 */
function cuerpoDe(m: Mensaje): string {
  const trozos: string[] = [];

  const mirar = (parte: unknown, profundidad = 0) => {
    if (!parte || typeof parte !== "object" || profundidad > 6) return;
    const p = parte as { mimeType?: string; body?: { data?: string }; parts?: unknown[] };

    if (p.body?.data && (p.mimeType === "text/plain" || p.mimeType === "text/html")) {
      const claro = Buffer.from(p.body.data, "base64url").toString("utf8");
      trozos.push(p.mimeType === "text/html" ? claro.replace(/<[^>]+>/g, " ") : claro);
    }
    for (const hija of p.parts ?? []) mirar(hija, profundidad + 1);
  };

  mirar(m.payload);
  const todo = trozos.join("\n").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return todo || m.snippet || "(sin contenido)";
}

/** Una línea por correo, para las listas. */
function enUnaLinea(m: Mensaje): string {
  return `[${m.id}] ${cuando(m)} · de ${cabecera(m, "From") || "?"} · ${
    cabecera(m, "Subject") || "(sin asunto)"
  }${m.snippet ? ` — ${m.snippet.slice(0, 120)}` : ""}`;
}

/**
 * El testigo de acceso, renovándolo si toca y guardando el nuevo.
 *
 * Lo de guardar importa: sin ello se renovaría en cada llamada, que funciona
 * pero gasta un viaje de más siempre y multiplica por dos el tiempo de cada
 * acción.
 */
async function conAcceso(cred: Credenciales): Promise<Record<string, string>> {
  const { acceso, nuevas } = await accesoVigente(GOOGLE, cred);
  if (nuevas) {
    // Se actualiza el objeto que tiene quien llama: el almacén lo vuelve a
    // guardar cifrado al terminar la acción.
    for (const [k, v] of Object.entries(nuevas)) cred[k] = v;
  }
  return { Authorization: `Bearer ${acceso}` };
}

export const gmail: Servicio = {
  id: "gmail",
  nombre: "Gmail",
  color: "#EA4335",
  marca: "Gm",
  familia: "correo",
  resumen:
    "El correo de tu empresa: buscar, leer y —si se lo permites— responder. Se conecta con tu cuenta de Google, sin darle ninguna contraseña.",
  pasos: [
    "Pulsa «Conectar con Google».",
    "Elige la cuenta de correo que quieres que ECLIPSE pueda mirar.",
    "Google te dirá exactamente qué permisos pide: leer el correo y enviarlo.",
    "Al volver ya está conectado. Puedes quitarle el permiso cuando quieras, desde aquí o desde tu cuenta de Google.",
  ],
  enlace: "https://myaccount.google.com/permissions",
  // Sin campos: no hay nada que escribir. Lo que hay es un botón.
  campos: [],
  oauth: "google",

  async verificar(cred) {
    if (!oauthListo(GOOGLE))
      return {
        ok: false,
        error:
          "Este servidor todavía no tiene configurado el acceso con Google. Hacen falta GOOGLE_OAUTH_ID y GOOGLE_OAUTH_SECRET.",
      };
    try {
      const r = await pedir<{ emailAddress?: string; messagesTotal?: number }>(
        "Gmail",
        url("profile"),
        { cabeceras: await conAcceso(cred) },
      );
      return {
        ok: true,
        cuenta: r.emailAddress || "tu cuenta de Google",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "buscar_correo",
      descripcion:
        "Busca en el correo con la misma sintaxis que la caja de Gmail: from:, to:, subject:, is:unread, newer_than:7d, has:attachment. Es por donde hay que empezar casi siempre.",
      argumentos: "consulta (la búsqueda), limite (1-50, por defecto 10)",
      async ejecutar({ cred, args, signal }) {
        const consulta = texto(args.consulta, 200);
        const limite = tope(args.limite, 10, 50);
        const cabeceras = await conAcceso(cred);

        const lista = await pedir<{ messages?: { id: string }[]; resultSizeEstimate?: number }>(
          "Gmail",
          url(`messages?maxResults=${limite}${consulta ? `&q=${encodeURIComponent(consulta)}` : ""}`),
          { cabeceras, signal },
        );
        const ids = (lista.messages ?? []).map((m) => m.id);
        if (!ids.length) return "No hay ningún correo que encaje con esa búsqueda.";

        /*
          Gmail devuelve SOLO identificadores: hay que pedir cada correo aparte.

          Se piden a la vez y no en fila. Diez correos en fila son diez viajes
          seguidos a Google dentro de una función que se corta a los sesenta
          segundos; a la vez es un viaje.
        */
        const correos = await Promise.all(
          ids.map((id) =>
            pedir<Mensaje>(
              "Gmail",
              url(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
              { cabeceras, signal },
            ).catch(() => null),
          ),
        );

        const buenos = correos.filter((m): m is Mensaje => m !== null);
        return `${buenos.length} correo(s):\n${buenos.map(enUnaLinea).join("\n")}`;
      },
    },

    {
      nombre: "leer_correo",
      descripcion:
        "Abre un correo entero por su identificador: quién lo manda, a quién, el asunto y el texto completo. Los identificadores salen de buscar_correo.",
      argumentos: "id (el identificador del correo)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 60);
        if (!id) return "Falta el identificador del correo.";

        const m = await pedir<Mensaje>("Gmail", url(`messages/${id}?format=full`), {
          cabeceras: await conAcceso(cred),
          signal,
        });

        return [
          `De: ${cabecera(m, "From") || "?"}`,
          `Para: ${cabecera(m, "To") || "?"}`,
          `Asunto: ${cabecera(m, "Subject") || "(sin asunto)"}`,
          `Fecha: ${cuando(m)}`,
          `Identificador del hilo: ${m.threadId ?? "?"}`,
          "",
          cuerpoDe(m).slice(0, 6000),
        ].join("\n");
      },
    },

    {
      nombre: "sin_leer",
      descripcion:
        "Los correos sin leer de la bandeja de entrada. Para saber qué hay pendiente de un vistazo.",
      argumentos: "limite (1-50, por defecto 15)",
      async ejecutar({ cred, args, signal }) {
        const limite = tope(args.limite, 15, 50);
        const cabeceras = await conAcceso(cred);

        const lista = await pedir<{ messages?: { id: string }[] }>(
          "Gmail",
          url(`messages?maxResults=${limite}&q=${encodeURIComponent("is:unread in:inbox")}`),
          { cabeceras, signal },
        );
        const ids = (lista.messages ?? []).map((m) => m.id);
        if (!ids.length) return "No hay nada sin leer en la bandeja de entrada.";

        const correos = await Promise.all(
          ids.map((id) =>
            pedir<Mensaje>(
              "Gmail",
              url(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
              { cabeceras, signal },
            ).catch(() => null),
          ),
        );
        const buenos = correos.filter((m): m is Mensaje => m !== null);
        return `${buenos.length} sin leer:\n${buenos.map(enUnaLinea).join("\n")}`;
      },
    },

    {
      nombre: "enviar_correo",
      descripcion:
        "Manda un correo desde la cuenta conectada. Si respondes a uno, pasa también su hilo para que llegue en la misma conversación.",
      escribe: true,
      argumentos: "para (destinatario), asunto, texto, hilo (opcional, el threadId al que responder)",
      async ejecutar({ cred, args, signal }) {
        const para = texto(args.para, 200);
        const asunto = texto(args.asunto, 200);
        const cuerpo = typeof args.texto === "string" ? args.texto.slice(0, 20_000) : "";
        const hilo = texto(args.hilo, 60);

        if (!para || !cuerpo) return "Hacen falta al menos el destinatario y el texto.";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para))
          return `"${para}" no parece una dirección de correo. Comprueba el destinatario.`;

        /*
          El asunto va codificado en base64 si lleva algo que no sea ASCII.

          Es la norma del correo desde hace treinta años: una cabecera con una
          tilde o un emoji sin codificar llega rota o no llega. "Últimas
          novedades ✨" es un asunto perfectamente normal en castellano.
        */
        const asuntoLimpio = /^[\x20-\x7E]*$/.test(asunto)
          ? asunto
          : `=?UTF-8?B?${Buffer.from(asunto, "utf8").toString("base64")}?=`;

        const crudo = [
          `To: ${para}`,
          `Subject: ${asuntoLimpio}`,
          "MIME-Version: 1.0",
          'Content-Type: text/plain; charset="UTF-8"',
          "Content-Transfer-Encoding: base64",
          "",
          Buffer.from(cuerpo, "utf8").toString("base64"),
        ].join("\r\n");

        const r = await pedir<{ id?: string; threadId?: string }>("Gmail", url("messages/send"), {
          metodo: "POST",
          cabeceras: await conAcceso(cred),
          cuerpo: {
            raw: Buffer.from(crudo, "utf8").toString("base64url"),
            ...(hilo ? { threadId: hilo } : {}),
          },
          signal,
        });

        return r.id
          ? `Correo enviado a ${para} (identificador ${r.id}).`
          : "Gmail no ha confirmado el envío. Comprueba en tu bandeja de enviados antes de volver a mandarlo.";
      },
    },
  ],
};
