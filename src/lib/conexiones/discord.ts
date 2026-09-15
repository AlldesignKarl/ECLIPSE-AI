import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Discord: la comunidad.
 *
 * Quien vende cursos, lleva un club o tiene clientes en un servidor, los tiene
 * aquí. Sirve para enterarse de qué se está diciendo y para avisar de algo sin
 * tener que entrar a escribirlo.
 *
 * Escribe si se le deja, y nada más: ni borra mensajes, ni echa a nadie, ni
 * toca los permisos del servidor. Esas son teclas de las que no se vuelve.
 */

function url(camino: string): string {
  return `${baseDe("discord", "https://discord.com")}/api/v10/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  // "Bot " delante: Discord distingue así el token de un bot del de una persona.
  return { Authorization: `Bot ${cred.token}` };
}

export const discord: Servicio = {
  id: "discord",
  nombre: "Discord",
  color: "#5865F2",
  marca: "Dc",
  familia: "mensajes",
  resumen: "Tu servidor: qué se está diciendo y —si le dejas— avisar en un canal.",
  pasos: [
    "Entra en discord.com/developers/applications y pulsa «New Application».",
    "En el menú de la izquierda, abre «Bot» y pulsa «Reset Token» para que te dé uno.",
    "Activa «Message Content Intent» en esa misma pantalla si quieres que pueda leer los mensajes.",
    "En «OAuth2 → URL Generator», marca «bot» y los permisos «View Channels» y «Send Messages». Abre la dirección que te da y mete el bot en tu servidor.",
    "Vuelve aquí y pega el token del bot.",
  ],
  enlace: "https://discord.com/developers/applications",
  campos: [
    {
      id: "token",
      etiqueta: "Token del bot",
      ayuda: "El de la pestaña «Bot». No el «client secret».",
      placeholder: "MTIz…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      const yo = await pedir<{ username?: string; discriminator?: string }>(
        "Discord",
        url("users/@me"),
        { cabeceras: cabeceras(cred), signal },
      );

      const servidores = await pedir<{ id: string; name: string }[]>(
        "Discord",
        url("users/@me/guilds"),
        { cabeceras: cabeceras(cred), signal },
      ).catch(() => []);

      if (!servidores.length)
        return {
          ok: false,
          error:
            "El token vale, pero el bot no está en ningún servidor. Métele primero en el tuyo con el enlace de OAuth2 y vuelve.",
        };

      return {
        ok: true,
        cuenta: `${yo.username ?? "tu bot"} · en ${servidores.length} servidor(es): ${servidores
          .slice(0, 2)
          .map((s) => s.name)
          .join(", ")}`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_canales",
      descripcion: "Los canales de tus servidores, con su identificador para poder leerlos o escribir.",
      argumentos: "servidor (id, opcional: sin él sale el primero)",
      async ejecutar({ cred, args, signal }) {
        const servidores = await pedir<{ id: string; name: string }[]>(
          "Discord",
          url("users/@me/guilds"),
          { cabeceras: cabeceras(cred), signal },
        );
        if (!servidores.length) return "El bot no está en ningún servidor.";

        const pedido = texto(args.servidor, 30);
        const cual = servidores.find((s) => s.id === pedido) ?? servidores[0];

        const canales = await pedir<{ id: string; name: string; type: number }[]>(
          "Discord",
          url(`guilds/${encodeURIComponent(cual.id)}/channels`),
          { cabeceras: cabeceras(cred), signal },
        );

        // El tipo 0 es un canal de texto. Los de voz no se pueden leer.
        const texto0 = canales.filter((c) => c.type === 0);
        if (!texto0.length) return `En «${cual.name}» no hay canales de texto a la vista.`;

        return [
          `Servidor «${cual.name}» (${cual.id}):`,
          ...texto0.map((c) => `#${c.name} (${c.id})`),
          servidores.length > 1
            ? `\nOtros servidores: ${servidores.filter((s) => s.id !== cual.id).map((s) => `${s.name} (${s.id})`).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      },
    },
    {
      nombre: "leer_canal",
      descripcion: "Los últimos mensajes de un canal, para ponerse al día de lo que se ha hablado.",
      argumentos: "canal (el id), limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const canal = texto(args.canal, 30);
        if (!canal) return "Falta el canal. Sácalo de listar_canales.";

        const r = await pedir<
          { content?: string; timestamp?: string; author?: { username?: string; bot?: boolean } }[]
        >("Discord", url(`channels/${encodeURIComponent(canal)}/messages?limit=${tope(args.limite, 20, 50)}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = (r ?? []).filter((m) => m.content);
        if (!lista.length)
          return "En ese canal no hay mensajes que el bot pueda leer. Comprueba que tiene activado «Message Content Intent».";

        return lista
          .reverse()
          .map(
            (m) =>
              `[${m.timestamp?.slice(0, 16).replace("T", " ") ?? ""}] ${m.author?.username ?? "alguien"}${
                m.author?.bot ? " (bot)" : ""
              }: ${m.content}`,
          )
          .join("\n");
      },
    },
    {
      nombre: "escribir_en_canal",
      descripcion: "Manda un mensaje a un canal del servidor. Solo escribe: no borra ni edita nada.",
      escribe: true,
      argumentos: "canal (el id), texto",
      async ejecutar({ cred, args, signal }) {
        const canal = texto(args.canal, 30);
        const mensaje = texto(args.texto, 1900);
        if (!canal) return "Falta el canal.";
        if (!mensaje) return "No hay nada que mandar.";

        await pedir("Discord", url(`channels/${encodeURIComponent(canal)}/messages`), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: { content: mensaje },
          signal,
        });
        return "Mensaje puesto en el canal.";
      },
    },
  ],
};
