import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Stripe: el dinero.
 *
 * Es la conexión que contesta la pregunta que de verdad importa —"¿cómo va el
 * mes?"— sin abrir un panel lleno de gráficas. Y la que más cuidado pide: aquí
 * no se mueve un euro. Se lee, se suma y se cuenta.
 *
 * Por eso se pide la clave RESTRINGIDA y no la secreta: Stripe deja crear una
 * que solo puede leer, y con esa, aunque alguien reventara este servidor, no se
 * puede cobrar ni devolver nada. Se explica en los pasos, porque es la
 * diferencia entre una conexión prudente y una imprudente.
 */

function url(camino: string): string {
  return `${baseDe("stripe", "https://api.stripe.com")}/v1/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { Authorization: `Bearer ${cred.clave}` };
}

/** Stripe cuenta en céntimos: 1990 son 19,90. */
function euros(cantidad: number, moneda = "eur"): string {
  return `${(cantidad / 100).toFixed(2)} ${moneda.toUpperCase()}`;
}

export const stripe: Servicio = {
  id: "stripe",
  nombre: "Stripe",
  color: "#635BFF",
  marca: "St",
  familia: "dinero",
  resumen:
    "Cuánto has facturado, qué se ha cobrado hoy y quién te paga cada mes. Solo lee: no mueve un euro.",
  pasos: [
    "Entra en tu panel de Stripe y ve a Desarrolladores → Claves de API.",
    "Pulsa «Crear clave restringida». NO uses la clave secreta normal.",
    "Dale permiso de LECTURA a: Cargos, Clientes, Suscripciones y Saldo. Deja todo lo demás en «Ninguno».",
    "Copia la clave, que empieza por rk_live_ (o rk_test_ si estás probando).",
  ],
  enlace: "https://dashboard.stripe.com/apikeys",
  campos: [
    {
      id: "clave",
      etiqueta: "Clave restringida",
      ayuda: "Empieza por rk_. Con permisos de lectura, nunca de escritura.",
      placeholder: "rk_live_…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.clave?.trim()) return { ok: false, error: "Falta la clave." };
    if (cred.clave.startsWith("sk_"))
      return {
        ok: false,
        error:
          "Esa es la clave secreta, que puede cobrar y devolver dinero. Crea una RESTRINGIDA de solo lectura (empieza por rk_) y pega esa.",
      };

    try {
      const saldo = await pedir<{ available?: { amount: number; currency: string }[] }>(
        "Stripe",
        url("balance"),
        { cabeceras: cabeceras(cred), signal },
      );
      const disponible = saldo.available?.[0];
      return {
        ok: true,
        cuenta: disponible ? `saldo ${euros(disponible.amount, disponible.currency)}` : "conectada",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "ver_saldo",
      descripcion: "El dinero disponible y el que todavía está en camino.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{
          available?: { amount: number; currency: string }[];
          pending?: { amount: number; currency: string }[];
        }>("Stripe", url("balance"), { cabeceras: cabeceras(cred), signal });

        const linea = (lista: { amount: number; currency: string }[] | undefined, que: string) =>
          (lista ?? []).map((s) => `${que}: ${euros(s.amount, s.currency)}`).join("\n");

        return [linea(r.available, "Disponible"), linea(r.pending, "En camino")]
          .filter(Boolean)
          .join("\n") || "La cuenta no tiene saldo todavía.";
      },
    },
    {
      nombre: "ver_cobros",
      descripcion:
        "Los últimos cobros, con su importe y si salieron bien. Para saber cómo va el día o la semana.",
      argumentos: "limite (1-100, por defecto 25)",
      async ejecutar({ cred, args, signal }) {
        const r = await pedir<{
          data?: {
            amount: number;
            currency: string;
            status: string;
            created: number;
            description?: string;
            refunded?: boolean;
          }[];
        }>("Stripe", url(`charges?limit=${tope(args.limite, 25, 100)}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = r.data ?? [];
        if (!lista.length) return "No hay cobros todavía.";

        const buenos = lista.filter((c) => c.status === "succeeded" && !c.refunded);
        const total = buenos.reduce((s, c) => s + c.amount, 0);

        return [
          `${lista.length} cobro(s), ${euros(total, lista[0]?.currency)} cobrados de verdad:`,
          ...lista.map(
            (c) =>
              `${new Date(c.created * 1000).toISOString().slice(0, 10)} · ${euros(c.amount, c.currency)} · ${
                c.refunded ? "DEVUELTO" : c.status
              }${c.description ? ` · ${c.description}` : ""}`,
          ),
        ].join("\n");
      },
    },
    {
      nombre: "ver_suscripciones",
      descripcion:
        "Quién te paga todos los meses, cuántos son y cuántos se han dado de baja. Lo que de verdad dice cómo va el negocio.",
      argumentos: "limite (1-100)",
      async ejecutar({ cred, args, signal }) {
        const r = await pedir<{
          data?: { status: string; current_period_end?: number; items?: { data?: { price?: { unit_amount?: number; currency?: string; recurring?: { interval?: string } } }[] } }[];
        }>("Stripe", url(`subscriptions?status=all&limit=${tope(args.limite, 50, 100)}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const lista = r.data ?? [];
        if (!lista.length) return "No hay suscripciones.";

        const activas = lista.filter((s) => s.status === "active" || s.status === "trialing");
        const mensual = activas.reduce((suma, s) => {
          const precio = s.items?.data?.[0]?.price;
          const importe = precio?.unit_amount ?? 0;
          // Lo anual, repartido entre doce: si no, un cliente anual parece
          // doce veces más de lo que aporta cada mes.
          return suma + (precio?.recurring?.interval === "year" ? importe / 12 : importe);
        }, 0);

        const porEstado = lista.reduce<Record<string, number>>((acc, s) => {
          acc[s.status] = (acc[s.status] ?? 0) + 1;
          return acc;
        }, {});

        return [
          `${activas.length} suscripción(es) activa(s).`,
          `Ingreso recurrente mensual: ${euros(Math.round(mensual), activas[0]?.items?.data?.[0]?.price?.currency ?? "eur")}`,
          `Por estado: ${Object.entries(porEstado).map(([e, n]) => `${e} ${n}`).join(" · ")}`,
        ].join("\n");
      },
    },
  ],
};
