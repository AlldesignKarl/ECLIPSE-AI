import { baseDe, pedir, texto } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Telegram: por donde te llega lo que ECLIPSE hace.
 *
 * Esta conexión mira al revés que las demás: no sirve para que ECLIPSE lea algo
 * tuyo, sino para que te mande cosas a ti. Un encargo programado que te llega
 * al móvil a las ocho de la mañana vale mucho más que uno que tienes que ir a
 * buscar, y montar notificaciones de verdad es meses de trabajo mientras que un
 * bot de Telegram son dos minutos.
 *
 * Solo escribe donde tú le digas: al chat que has puesto y a ninguno más.
 */

function url(cred: Credenciales, metodo: string): string {
  return `${baseDe("telegram", "https://api.telegram.org")}/bot${cred.token}/${metodo}`;
}

export const telegram: Servicio = {
  id: "telegram",
  nombre: "Telegram",
  color: "#229ED9",
  marca: "Tg",
  familia: "mensajes",
  resumen:
    "Que ECLIPSE te escriba al móvil. Para que lo que prepara de madrugada te llegue en vez de esperarte.",
  pasos: [
    "Abre Telegram y busca a @BotFather. Escríbele /newbot y ponle nombre a tu bot.",
    "Te dará un token largo con dos puntos en medio. Cópialo.",
    "Ahora abre una conversación con TU bot y escríbele cualquier cosa, un «hola» vale. Sin eso, un bot no puede escribirte primero.",
    "Vuelve aquí, pega el token y deja el chat en blanco: ECLIPSE lo encontrará solo.",
  ],
  enlace: "https://t.me/BotFather",
  campos: [
    {
      id: "token",
      etiqueta: "Token del bot",
      ayuda: "Lo que te da BotFather. Tiene dos puntos en medio.",
      placeholder: "123456789:AA…",
      secreto: true,
    },
    {
      id: "chat",
      etiqueta: "Chat (opcional)",
      ayuda: "Déjalo en blanco y se busca solo, con el «hola» que le escribiste.",
      placeholder: "se busca solo",
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.includes(":"))
      return { ok: false, error: "Ese token no parece de Telegram: le faltan los dos puntos." };

    try {
      const yo = await pedir<{ result?: { username?: string; first_name?: string } }>(
        "Telegram",
        url(cred, "getMe"),
        { signal },
      );

      // Si no ha dicho a qué chat, se mira quién le ha escrito.
      if (!cred.chat?.trim()) {
        const mensajes = await pedir<{
          result?: { message?: { chat?: { id?: number; first_name?: string } } }[];
        }>("Telegram", url(cred, "getUpdates?limit=10"), { signal }).catch(() => ({ result: [] }));

        const chat = mensajes.result?.map((u) => u.message?.chat).filter(Boolean).at(-1);
        if (!chat?.id)
          return {
            ok: false,
            error:
              "El bot existe, pero todavía nadie le ha escrito. Abre Telegram, búscalo por su nombre y mándale un «hola»; después vuelve aquí.",
          };
        cred.chat = String(chat.id);
        return { ok: true, cuenta: `@${yo.result?.username ?? "tu bot"} → ${chat.first_name ?? "tu chat"}` };
      }

      return { ok: true, cuenta: `@${yo.result?.username ?? "tu bot"}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "escribirme",
      descripcion:
        "Te manda un mensaje a Telegram. Para avisos, recordatorios y lo que prepare por la noche.",
      escribe: true,
      argumentos: "texto (lo que hay que mandar)",
      async ejecutar({ cred, args, signal }) {
        const mensaje = texto(args.texto, 3500);
        if (!mensaje) return "No hay nada que mandar.";
        if (!cred.chat) return "No hay ningún chat al que escribir. Vuelve a conectar Telegram.";

        await pedir("Telegram", url(cred, "sendMessage"), {
          metodo: "POST",
          cuerpo: { chat_id: cred.chat, text: mensaje, disable_web_page_preview: true },
          signal,
        });
        return "Mensaje enviado a tu Telegram.";
      },
    },
  ],
};
