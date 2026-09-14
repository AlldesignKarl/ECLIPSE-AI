import { createHmac } from "node:crypto";

import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Los mercados: la cartera y los precios, en solo lectura. Siempre.
 *
 * Aquí hay una línea que no se cruza, y conviene que esté escrita donde se
 * escribe el código y no solo en una pantalla: ECLIPSE NO PONE ÓRDENES. No
 * compra, no vende, no cancela. Ni con permiso de escritura, porque para este
 * servicio ese permiso ni se ofrece.
 *
 * No es prudencia de más. Un modelo de lenguaje se equivoca de vez en cuando
 * —un cero de más, un par mal leído, una instrucción ambigua entendida al
 * revés— y en una tienda eso se corrige en un minuto, mientras que en un
 * mercado abierto se ejecuta al instante y con el dinero de alguien. Y no es
 * "una equivocación de la IA": sería nuestra, por haberle dado el botón.
 *
 * Lo que sí hace, que no es poco: leer la cartera, leer el mercado, y ayudar a
 * entender los dos. Analizar, comparar, calcular el riesgo de una posición,
 * explicar qué está pasando con un par y por qué. La decisión de pulsar el
 * botón se queda donde tiene que estar, que es en su dueño.
 *
 * Por eso además se pide la clave en modo "solo lectura" desde el propio
 * Binance: aunque alguien reventara este servidor, con esa clave no se puede
 * mover un euro.
 */

function url(camino: string): string {
  return `${baseDe("mercados", "https://api.binance.com")}/api/v3/${camino}`;
}

/** Una petición firmada: Binance quiere HMAC-SHA256 de la propia consulta. */
function firmar(cred: Credenciales, consulta: string): string {
  const marca = `${consulta ? `${consulta}&` : ""}timestamp=${Date.now()}&recvWindow=10000`;
  const firma = createHmac("sha256", cred.secreto).update(marca).digest("hex");
  return `${marca}&signature=${firma}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { "X-MBX-APIKEY": cred.clave };
}

/**
 * Un número de Binance, escrito para leerlo.
 *
 * Llegan con ocho decimales siempre: "50.00000000 bloqueado en órdenes" es
 * ruido, y el ruido se lo come el modelo y se lo repite al usuario. Se quitan
 * los ceros del final sin tocar los decimales que sí dicen algo, que en una
 * cartera con 0.00034 BTC son todos.
 */
function numero(v: string | number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return String(Number(n.toFixed(8)));
}

/** El par, escrito como lo quiere Binance. */
function par(v: unknown, pordefecto = "BTCUSDT"): string {
  const s = texto(v, 20)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return s || pordefecto;
}

interface Saldo {
  asset: string;
  free: string;
  locked: string;
}

export const mercados: Servicio = {
  id: "mercados",
  nombre: "Binance (solo lectura)",
  color: "#F0B90B",
  marca: "B",
  familia: "mercado",
  resumen:
    "Tu cartera y el mercado, para analizarlos. ECLIPSE nunca compra, vende ni cancela: lee, calcula y te lo explica. Las órdenes las das tú.",
  pasos: [
    "Entra en Binance y ve a tu perfil → Gestión de API.",
    "Crea una clave nueva del tipo «Generada por el sistema» y ponle de nombre ECLIPSE.",
    "IMPORTANTE: deja marcado SOLO «Habilitar lectura». Desmarca cualquier permiso de trading, margen, futuros o retiros. ECLIPSE no los usa y así nadie puede usarlos aunque quiera.",
    "Copia la clave de API y la clave secreta. La secreta solo se enseña una vez.",
    "Pega aquí las dos.",
  ],
  enlace: "https://www.binance.com/es/my/settings/api-management",
  campos: [
    {
      id: "clave",
      etiqueta: "Clave de API",
      ayuda: "La pública, la que Binance llama API Key.",
      secreto: true,
    },
    {
      id: "secreto",
      etiqueta: "Clave secreta",
      ayuda: "La Secret Key. Solo se enseña una vez al crearla.",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.clave?.trim() || !cred.secreto?.trim())
      return { ok: false, error: "Faltan la clave o el secreto." };

    try {
      const r = await pedir<{
        balances?: Saldo[];
        canTrade?: boolean;
        accountType?: string;
      }>("Binance", `${url("account")}?${firmar(cred, "")}`, {
        cabeceras: cabeceras(cred),
        signal,
      });
      const conSaldo = (r.balances ?? []).filter(
        (b) => Number(b.free) + Number(b.locked) > 0,
      ).length;
      return {
        ok: true,
        cuenta: `${r.accountType || "cuenta"} · ${conSaldo} moneda(s) con saldo`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "ver_cartera",
      descripcion:
        "Lo que hay en la cuenta: cada moneda con su saldo disponible y su saldo bloqueado en órdenes.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{ balances?: Saldo[] }>(
          "Binance",
          `${url("account")}?${firmar(cred, "")}`,
          { cabeceras: cabeceras(cred), signal },
        );
        const conSaldo = (r.balances ?? [])
          .map((b) => ({ ...b, total: Number(b.free) + Number(b.locked) }))
          .filter((b) => b.total > 0)
          .sort((a, b) => b.total - a.total);

        if (!conSaldo.length) return "La cuenta no tiene saldo en ninguna moneda.";
        return `${conSaldo.length} moneda(s) con saldo:\n${conSaldo
          .map(
            (b) =>
              `${b.asset}: ${numero(b.total)}${
                Number(b.locked) > 0 ? ` (${numero(b.locked)} bloqueado en órdenes)` : ""
              }`,
          )
          .join("\n")}`;
      },
    },
    {
      nombre: "ver_ordenes_abiertas",
      descripcion: "Las órdenes que están puestas y sin ejecutar. Solo se leen: no se cancelan.",
      async ejecutar({ cred, signal }) {
        const lista = await pedir<
          { symbol: string; side: string; type: string; price: string; origQty: string; time?: number }[]
        >("Binance", `${url("openOrders")}?${firmar(cred, "")}`, {
          cabeceras: cabeceras(cred),
          signal,
        });
        if (!lista?.length) return "No hay ninguna orden abierta.";
        return `${lista.length} orden(es) abierta(s):\n${lista
          .map(
            (o) =>
              `${o.symbol} · ${o.side} ${o.type} · ${numero(o.origQty)} a ${numero(o.price)}${
                o.time ? ` · desde ${new Date(o.time).toISOString().slice(0, 10)}` : ""
              }`,
          )
          .join("\n")}`;
      },
    },
    {
      nombre: "ver_precio",
      descripcion:
        "El precio de un par y cómo se ha movido en las últimas 24 horas: máximo, mínimo, volumen y variación.",
      argumentos: "par (por ejemplo BTCUSDT o ETHEUR)",
      async ejecutar({ args, signal }) {
        const simbolo = par(args.par);
        const t = await pedir<{
          lastPrice?: string;
          priceChangePercent?: string;
          highPrice?: string;
          lowPrice?: string;
          volume?: string;
          quoteVolume?: string;
        }>("Binance", `${url("ticker/24hr")}?symbol=${simbolo}`, { signal });

        return [
          `${simbolo}: ${numero(t.lastPrice ?? "")}`,
          `24 h: ${Number(t.priceChangePercent) >= 0 ? "+" : ""}${t.priceChangePercent}%`,
          `Máximo ${numero(t.highPrice ?? "")} · Mínimo ${numero(t.lowPrice ?? "")}`,
          `Volumen: ${numero(t.volume ?? "")} (${numero(t.quoteVolume ?? "")} en la moneda de cotización)`,
        ].join("\n");
      },
    },
    {
      nombre: "ver_historico",
      descripcion:
        "Las velas de un par para poder analizarlo: apertura, máximo, mínimo, cierre y volumen de cada periodo.",
      argumentos:
        "par, intervalo (1h, 4h, 1d, 1w — 1d por defecto), limite (1-200, por defecto 30)",
      async ejecutar({ args, signal }) {
        const simbolo = par(args.par);
        const permitidos = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];
        const intervalo = permitidos.includes(String(args.intervalo))
          ? String(args.intervalo)
          : "1d";
        const limite = tope(args.limite, 30, 200);

        const velas = await pedir<(string | number)[][]>(
          "Binance",
          `${url("klines")}?symbol=${simbolo}&interval=${intervalo}&limit=${limite}`,
          { signal },
        );
        if (!velas?.length) return `No hay datos para ${simbolo}.`;

        const filas = velas.map((v) => ({
          fecha: new Date(Number(v[0])).toISOString().slice(0, 10),
          apertura: Number(v[1]),
          maximo: Number(v[2]),
          minimo: Number(v[3]),
          cierre: Number(v[4]),
          volumen: Number(v[5]),
        }));

        const primera = filas[0];
        const ultima = filas[filas.length - 1];
        const cambio = ((ultima.cierre - primera.apertura) / primera.apertura) * 100;

        return [
          `${simbolo} · ${intervalo} · ${filas.length} periodos`,
          `De ${primera.apertura} a ${ultima.cierre} (${cambio >= 0 ? "+" : ""}${cambio.toFixed(2)}%)`,
          `Máximo del tramo: ${Math.max(...filas.map((f) => f.maximo))} · Mínimo: ${Math.min(
            ...filas.map((f) => f.minimo),
          )}`,
          "",
          "fecha · apertura · máximo · mínimo · cierre · volumen",
          ...filas.map(
            (f) => `${f.fecha} · ${f.apertura} · ${f.maximo} · ${f.minimo} · ${f.cierre} · ${f.volumen}`,
          ),
        ].join("\n");
      },
    },
  ],
};
