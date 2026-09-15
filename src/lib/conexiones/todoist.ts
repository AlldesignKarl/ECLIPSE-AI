import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Todoist: lo que tienes que hacer, con su día.
 *
 * Es la pieza que le faltaba a Programar. Un encargo de cada mañana que diga
 * "qué tengo hoy" vale mucho más leyendo la lista de verdad que inventándose
 * una; y poder apuntar algo hablando —"apúntame llamar al gestor el martes"—
 * es lo que hace que una lista de tareas se use.
 *
 * Crea tareas; no las completa ni las borra. Dar por hecho lo que no has hecho
 * es peor que no tenerlo apuntado.
 */

function url(camino: string): string {
  return `${baseDe("todoist", "https://api.todoist.com")}/rest/v2/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.token}` };
}

export const todoist: Servicio = {
  id: "todoist",
  nombre: "Todoist",
  color: "#E44332",
  marca: "Td",
  familia: "agenda",
  resumen: "Lo que tienes pendiente y para cuándo. Y apuntar cosas nuevas hablando.",
  pasos: [
    "Abre Todoist en el ordenador y ve a Ajustes → Integraciones → Para desarrolladores.",
    "Copia el «API token» que aparece ahí.",
  ],
  enlace: "https://app.todoist.com/app/settings/integrations/developer",
  campos: [
    {
      id: "token",
      etiqueta: "Token de API",
      ayuda: "El de Ajustes → Integraciones → Para desarrolladores.",
      placeholder: "40 letras y números",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      // Todoist no tiene una llamada de "quién soy" en esta API, así que se
      // comprueba con lo que se va a usar: si lista los proyectos, el token
      // vale. Y de paso se cuenta lo que ve, que es más honesto que un "ok".
      const proyectos = await pedir<{ id: string; name: string }[]>("Todoist", url("projects"), {
        cabeceras: cabeceras(cred),
        signal,
      });
      const lista = proyectos ?? [];
      return {
        ok: true,
        cuenta: `${lista.length} proyecto(s): ${lista.slice(0, 3).map((p) => p.name).join(", ")}${
          lista.length > 3 ? "…" : ""
        }`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_proyectos",
      descripcion: "Tus proyectos de Todoist, con su identificador.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{ id: string; name: string; is_favorite?: boolean }[]>(
          "Todoist",
          url("projects"),
          { cabeceras: cabeceras(cred), signal },
        );
        const lista = r ?? [];
        if (!lista.length) return "No hay proyectos.";
        return lista.map((p) => `${p.name} (${p.id})${p.is_favorite ? " ★" : ""}`).join("\n");
      },
    },
    {
      nombre: "listar_tareas",
      descripcion:
        "Lo que tienes pendiente, con su fecha y su prioridad. Se puede pedir solo lo de hoy, lo vencido o lo de un proyecto.",
      argumentos: "filtro (hoy | atrasado | semana, opcional), proyecto (id, opcional), limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const filtros: Record<string, string> = {
          hoy: "today",
          atrasado: "overdue",
          semana: "7 days",
        };
        const pedido = texto(args.filtro, 20).toLowerCase();
        const proyecto = texto(args.proyecto, 30);

        const partes: string[] = [];
        if (filtros[pedido]) partes.push(`filter=${encodeURIComponent(filtros[pedido])}`);
        if (proyecto) partes.push(`project_id=${encodeURIComponent(proyecto)}`);

        const r = await pedir<
          { id: string; content: string; due?: { date?: string; string?: string } | null; priority?: number }[]
        >("Todoist", url(`tasks${partes.length ? `?${partes.join("&")}` : ""}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = (r ?? []).slice(0, tope(args.limite, 25, 50));
        if (!lista.length)
          return pedido === "hoy" ? "Hoy no tienes nada apuntado." : "No hay tareas pendientes.";

        return lista
          .map((t) => {
            // En Todoist la prioridad 4 es la más alta, al revés de como suena.
            const urgente = t.priority === 4 ? " · URGENTE" : t.priority === 3 ? " · importante" : "";
            const cuando = t.due?.date ? ` · ${t.due.date}` : t.due?.string ? ` · ${t.due.string}` : "";
            return `- ${t.content}${cuando}${urgente}`;
          })
          .join("\n");
      },
    },
    {
      nombre: "crear_tarea",
      descripcion:
        "Apunta algo en Todoist, con fecha si se dice. La fecha se puede escribir como se habla: «mañana», «el martes», «cada lunes».",
      escribe: true,
      argumentos: "texto (qué hay que hacer), cuando (opcional), proyecto (id, opcional)",
      async ejecutar({ cred, args, signal }) {
        const contenido = texto(args.texto, 400);
        if (!contenido) return "Falta qué hay que apuntar.";

        const cuerpo: Record<string, unknown> = { content: contenido };
        const cuando = texto(args.cuando, 60);
        // Todoist entiende las fechas escritas en cristiano, y en castellano:
        // mandárselas tal cual acierta más que traducirlas nosotros a un día.
        if (cuando) cuerpo.due_string = cuando;
        const proyecto = texto(args.proyecto, 30);
        if (proyecto) cuerpo.project_id = proyecto;

        const r = await pedir<{ id?: string; due?: { date?: string } }>("Todoist", url("tasks"), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo,
          signal,
        });

        return `Apuntado: «${contenido}»${r.due?.date ? ` para el ${r.due.date}` : ""}.`;
      },
    },
  ],
};
