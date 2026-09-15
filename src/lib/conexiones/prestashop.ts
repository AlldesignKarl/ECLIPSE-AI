import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * PrestaShop: la otra tienda que tiene media España.
 *
 * Shopify y WooCommerce se llevan las portadas, pero mucha tienda pequeña de
 * aquí está montada sobre PrestaShop y no tenía por dónde entrar.
 *
 * Solo lee, y no por prudencia genérica: PrestaShop escribe en XML, con un
 * formato distinto en cada versión, y una escritura mal formada en el catálogo
 * del que alguien vive no es un fallo que se arregle pidiendo perdón. Leer se
 * puede hacer bien hoy; escribir, no.
 */

function url(cred: Credenciales, camino: string): string {
  const sitio = baseDe("prestashop", (cred.sitio ?? "").replace(/\/+$/, ""));
  const separador = camino.includes("?") ? "&" : "?";
  return `${sitio}/api/${camino}${separador}output_format=JSON`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  // PrestaShop usa autenticación básica con la clave como usuario y la
  // contraseña vacía. No es una rareza nuestra: es lo que documentan ellos.
  return { Authorization: `Basic ${Buffer.from(`${cred.clave}:`).toString("base64")}` };
}

/** Un precio de PrestaShop viene como "19.900000". Nadie lee eso. */
function precio(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v ?? "");
}

/** Los nombres vienen a veces sueltos y a veces por idioma. */
function enCastellano(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return String((v[0] as { value?: string })?.value ?? "");
  const uno = v as { value?: string } | null;
  return String(uno?.value ?? "");
}

export const prestashop: Servicio = {
  id: "prestashop",
  nombre: "PrestaShop",
  color: "#DF0067",
  marca: "Ps",
  familia: "tienda",
  resumen:
    "Tu tienda PrestaShop: productos, stock y pedidos. Solo mira; no toca el catálogo.",
  pasos: [
    "Entra en el panel de tu tienda y ve a Parámetros avanzados → Servicio web.",
    "Activa el servicio web si no lo está y pulsa «Añadir nueva clave de servicio web».",
    "Marca permiso de VER (GET) en Productos, Pedidos, Clientes y Stock. Deja el resto sin marcar.",
    "Guarda, copia la clave larga que te da y pega aquí la dirección de tu tienda y esa clave.",
  ],
  enlace: "https://devdocs.prestashop-project.org/8/webservice/",
  campos: [
    {
      id: "sitio",
      etiqueta: "Dirección de la tienda",
      ayuda: "La de siempre, con https:// delante.",
      placeholder: "https://mitienda.com",
    },
    {
      id: "clave",
      etiqueta: "Clave del servicio web",
      ayuda: "La que te da PrestaShop al crear la clave. Son letras y números en mayúscula.",
      placeholder: "A1B2C3…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!cred.sitio?.trim()) return { ok: false, error: "Falta la dirección de la tienda." };
    if (!cred.clave?.trim()) return { ok: false, error: "Falta la clave del servicio web." };
    if (!/^https?:\/\//.test(cred.sitio))
      return { ok: false, error: "La dirección tiene que empezar por https://" };

    try {
      const r = await pedir<{ api?: Record<string, unknown> }>("PrestaShop", url(cred, ""), {
        cabeceras: cabeceras(cred),
        signal,
      });
      const recursos = Object.keys(r.api ?? {});
      if (!recursos.length)
        return {
          ok: false,
          error:
            "La clave vale, pero no tiene permiso para ver nada. Vuelve al panel y márcale al menos «ver» en Productos y Pedidos.",
        };
      const host = new URL(cred.sitio).host;
      return { ok: true, cuenta: `la tienda ${host} (ve ${recursos.length} cosas)` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "listar_productos",
      descripcion:
        "Los productos de la tienda, con precio y stock. Se puede filtrar por texto para encontrar uno.",
      argumentos: "buscar (texto, opcional), limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const buscar = texto(args.buscar, 60);
        const camino = `products?display=[id,name,price,quantity,active]&limit=${tope(
          args.limite,
          20,
          50,
        )}${buscar ? `&filter[name]=%[${encodeURIComponent(buscar)}]%` : ""}`;

        const r = await pedir<{
          products?: { id: number; name: unknown; price: string; quantity?: string; active?: string }[];
        }>("PrestaShop", url(cred, camino), { cabeceras: cabeceras(cred), signal });

        const lista = r.products ?? [];
        if (!lista.length)
          return buscar ? `No hay ningún producto que se llame «${buscar}».` : "La tienda no tiene productos.";

        return lista
          .map(
            (p) =>
              `#${p.id} · ${enCastellano(p.name)} · ${precio(p.price)} € · stock ${p.quantity ?? "?"}${
                p.active === "0" ? " · DESACTIVADO" : ""
              }`,
          )
          .join("\n");
      },
    },
    {
      nombre: "ver_producto",
      descripcion: "La ficha completa de un producto: descripción, referencia, precio y stock.",
      argumentos: "id (el número del producto)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 20);
        if (!id) return "Falta el número del producto.";

        const r = await pedir<{
          product?: {
            id: number;
            name: unknown;
            price: string;
            reference?: string;
            quantity?: string;
            description_short?: unknown;
            meta_title?: unknown;
          };
        }>("PrestaShop", url(cred, `products/${encodeURIComponent(id)}`), {
          cabeceras: cabeceras(cred),
          signal,
        });

        const p = r.product;
        if (!p) return "Ese producto no existe.";

        const resumen = enCastellano(p.description_short).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return [
          `#${p.id} · ${enCastellano(p.name)}`,
          `Precio: ${precio(p.price)} €`,
          `Referencia: ${p.reference || "(sin referencia)"}`,
          `Stock: ${p.quantity ?? "?"}`,
          `Título SEO: ${enCastellano(p.meta_title) || "(vacío, y eso es lo primero que hay que arreglar)"}`,
          resumen ? `Descripción: ${resumen.slice(0, 400)}` : "Descripción: (vacía)",
        ].join("\n");
      },
    },
    {
      nombre: "listar_pedidos",
      descripcion: "Los últimos pedidos con su importe, para saber cómo va el día o la semana.",
      argumentos: "limite (1-50)",
      async ejecutar({ cred, args, signal }) {
        const r = await pedir<{
          orders?: { id: number; reference?: string; total_paid?: string; date_add?: string }[];
        }>(
          "PrestaShop",
          url(
            cred,
            `orders?display=[id,reference,total_paid,date_add]&sort=[id_DESC]&limit=${tope(
              args.limite,
              20,
              50,
            )}`,
          ),
          { cabeceras: cabeceras(cred), signal },
        );

        const lista = r.orders ?? [];
        if (!lista.length) return "No hay pedidos todavía.";

        const total = lista.reduce((s, p) => s + (Number(p.total_paid) || 0), 0);
        return [
          `${lista.length} pedido(s), ${total.toFixed(2)} € en total:`,
          ...lista.map(
            (p) =>
              `${p.reference ?? `#${p.id}`} · ${precio(p.total_paid)} €${
                p.date_add ? ` · ${p.date_add.slice(0, 10)}` : ""
              }`,
          ),
        ].join("\n");
      },
    },
  ],
};
