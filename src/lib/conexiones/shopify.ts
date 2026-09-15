import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Shopify: la tienda.
 *
 * Es el sitio donde vive el negocio de quien vende por internet, y por eso es
 * la conexión que más rinde: el catálogo, los pedidos, el stock y —lo que casi
 * nadie toca porque está escondido en un desplegable— los títulos y
 * descripciones que Google lee de cada producto. Un dropshipper con
 * cuatrocientos productos importados de golpe tiene cuatrocientas fichas con el
 * texto del proveedor, en inglés y repetido. Eso es exactamente lo que ECLIPSE
 * puede arreglar de una tacada.
 *
 * Se conecta con una "app personalizada" de la propia tienda, que da un token
 * permanente. No es OAuth: no hay que publicar nada en su tienda de apps ni
 * pasar revisión, y el usuario lo saca solo desde su panel en dos minutos.
 */

const VERSION = "2024-10";

/** El dominio de la tienda, tal y como se pueda haber escrito. */
function tienda(cred: Credenciales): string {
  return (cred.tienda || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function url(cred: Credenciales, camino: string): string {
  return `${baseDe("shopify", `https://${tienda(cred)}`)}/admin/api/${VERSION}/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return { "X-Shopify-Access-Token": cred.token };
}

interface Producto {
  id: number;
  title: string;
  handle: string;
  status: string;
  product_type?: string;
  vendor?: string;
  body_html?: string;
  variants?: { id: number; price: string; inventory_quantity?: number; sku?: string }[];
}

interface Pedido {
  id: number;
  name: string;
  created_at: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  total_price?: string;
  currency?: string;
  line_items?: { title: string; quantity: number }[];
}

function unProducto(p: Producto): string {
  const v = p.variants?.[0];
  const precio = v ? `${v.price}` : "sin precio";
  const stock =
    v?.inventory_quantity === undefined ? "" : ` · stock ${v.inventory_quantity}`;
  return `#${p.id} · ${p.title} · ${precio}${stock} · ${p.status}${
    p.product_type ? ` · ${p.product_type}` : ""
  } · /products/${p.handle}`;
}

export const shopify: Servicio = {
  id: "shopify",
  nombre: "Shopify",
  color: "#7AB55C",
  marca: "Sh",
  familia: "tienda",
  resumen:
    "Tu tienda: catálogo, pedidos, stock y el SEO de cada ficha. ECLIPSE puede reescribirte cuatrocientos títulos mientras desayunas.",
  pasos: [
    "Entra en el panel de tu tienda y ve a Configuración → Aplicaciones y canales de venta.",
    "Pulsa «Desarrollar aplicaciones» y luego «Crear una aplicación». Ponle de nombre ECLIPSE.",
    "En «Configuración» marca los permisos de la API de administración que quieras darle: read_products y write_products para el catálogo, read_orders para los pedidos, read_inventory para el stock.",
    "Instala la aplicación y copia el «token de acceso de la API de administración». Empieza por shpat_ y solo se enseña una vez.",
    "Pega aquí ese token y el dominio de tu tienda (el que acaba en .myshopify.com).",
  ],
  enlace: "https://admin.shopify.com/",
  campos: [
    {
      id: "tienda",
      etiqueta: "Dominio de la tienda",
      ayuda: "El que acaba en .myshopify.com, no tu dominio bonito.",
      placeholder: "mitienda.myshopify.com",
    },
    {
      id: "token",
      etiqueta: "Token de la app personalizada",
      ayuda: "Empieza por shpat_. Solo se enseña una vez al crear la app.",
      placeholder: "shpat_…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!/^[a-z0-9-]+\.myshopify\.com$/.test(tienda(cred)) && !process.env.CONEXION_BASE_SHOPIFY)
      return {
        ok: false,
        error: "El dominio tiene que ser el de Shopify, el que acaba en .myshopify.com.",
      };
    if (!cred.token?.trim()) return { ok: false, error: "Falta el token." };

    try {
      const r = await pedir<{ shop?: { name?: string; domain?: string; currency?: string } }>(
        "Shopify",
        url(cred, "shop.json"),
        { cabeceras: cabeceras(cred), signal },
      );
      const nombre = r.shop?.name || tienda(cred);
      return { ok: true, cuenta: `${nombre}${r.shop?.currency ? ` · ${r.shop.currency}` : ""}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "resumen_tienda",
      descripcion:
        "TODA la tienda de un vistazo y en UNA llamada: cuántos productos hay y cuántos están sin publicar, qué se ha quedado sin stock o va justo, cuántos pedidos ha habido en los últimos días, cuánto suman, qué está pendiente de enviar o de cobrar y qué se vende más. Es por donde hay que empezar cuando alguien pregunta cómo va su tienda.",
      argumentos: "dias (cuántos días de pedidos mirar, 1-90, por defecto 30)",
      async ejecutar({ cred, args, signal }) {
        const dias = tope(args.dias, 30, 90);
        const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

        /*
          Las tres consultas a la vez, y no una detrás de otra.

          Esto corre dentro de una función del plan gratuito que se corta a los
          sesenta segundos, y encadenadas eran tres viajes seguidos a Shopify.
          En paralelo es un viaje.
        */
        const [tiendaInfo, productos, pedidos] = await Promise.all([
          pedir<{ shop?: { name?: string; currency?: string; domain?: string; plan_name?: string } }>(
            "Shopify",
            url(cred, "shop.json"),
            { cabeceras: cabeceras(cred), signal },
          ).catch(() => ({ shop: undefined })),
          pedir<{ products?: Producto[] }>("Shopify", url(cred, "products.json?limit=250"), {
            cabeceras: cabeceras(cred),
            signal,
          }).catch(() => ({ products: [] })),
          pedir<{ orders?: Pedido[] }>(
            "Shopify",
            url(cred, `orders.json?limit=250&status=any&created_at_min=${encodeURIComponent(desde)}`),
            { cabeceras: cabeceras(cred), signal },
          ).catch(() => ({ orders: [] })),
        ]);

        const lista = productos.products ?? [];
        const ventas = pedidos.orders ?? [];
        const moneda = ventas[0]?.currency || tiendaInfo.shop?.currency || "";

        const variantes = lista.flatMap((p) =>
          (p.variants ?? []).map((v) => ({ producto: p, variante: v })),
        );
        const agotados = variantes.filter(({ variante }) => (variante.inventory_quantity ?? 0) <= 0);
        const justos = variantes.filter(
          ({ variante }) =>
            (variante.inventory_quantity ?? 0) > 0 && (variante.inventory_quantity ?? 0) <= 5,
        );
        const borradores = lista.filter((p) => p.status !== "active");
        const sinDescripcion = lista.filter((p) => !(p.body_html || "").replace(/<[^>]+>/g, "").trim());

        const total = ventas.reduce((suma, o) => suma + Number(o.total_price || 0), 0);
        const sinEnviar = ventas.filter((o) => !o.fulfillment_status);
        const sinCobrar = ventas.filter((o) => o.financial_status && o.financial_status !== "paid");

        // Lo más vendido, contando unidades y no pedidos: dos camisetas en un
        // pedido son dos camisetas.
        const unidades = new Map<string, number>();
        for (const o of ventas)
          for (const l of o.line_items ?? [])
            unidades.set(l.title, (unidades.get(l.title) ?? 0) + (l.quantity || 0));
        const masVendido = [...unidades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

        const trozo = (titulo: string, lineas: string[]) =>
          lineas.length ? `\n${titulo}\n${lineas.join("\n")}` : "";

        return [
          `${tiendaInfo.shop?.name || tienda(cred)}${tiendaInfo.shop?.domain ? ` (${tiendaInfo.shop.domain})` : ""}${
            tiendaInfo.shop?.plan_name ? ` · plan ${tiendaInfo.shop.plan_name}` : ""
          }`,
          "",
          `CATÁLOGO: ${lista.length} producto(s)${lista.length === 250 ? " (tope de la consulta; puede haber más)" : ""}, ${variantes.length} variante(s).`,
          `  Sin publicar: ${borradores.length}. Sin descripción: ${sinDescripcion.length}.`,
          `  Sin stock: ${agotados.length}. Con 5 o menos: ${justos.length}.`,
          "",
          `VENTAS (últimos ${dias} días): ${ventas.length} pedido(s), ${total.toFixed(2)} ${moneda}.`,
          `  Media por pedido: ${ventas.length ? (total / ventas.length).toFixed(2) : "0.00"} ${moneda}.`,
          `  Pendientes de enviar: ${sinEnviar.length}. Pendientes de cobro: ${sinCobrar.length}.`,
          trozo(
            "SIN STOCK (hasta 15):",
            agotados.slice(0, 15).map(({ producto, variante }) =>
              `  · ${producto.title}${variante.sku ? ` [${variante.sku}]` : ""}`,
            ),
          ),
          trozo(
            "STOCK JUSTO (hasta 15):",
            justos.slice(0, 15).map(({ producto, variante }) =>
              `  · ${producto.title}${variante.sku ? ` [${variante.sku}]` : ""} — quedan ${variante.inventory_quantity}`,
            ),
          ),
          trozo("LO QUE MÁS SE VENDE:", masVendido.map(([t, n]) => `  · ${n} uds · ${t}`)),
        ]
          .filter((l) => l !== null)
          .join("\n");
      },
    },
    {
      nombre: "listar_productos",
      descripcion:
        "Los productos de la tienda, con precio, stock, estado y enlace. Empieza siempre por aquí antes de cambiar nada.",
      argumentos: "limite (1-250, por defecto 50), buscar (texto en el título)",
      async ejecutar({ cred, args, signal }) {
        const limite = tope(args.limite, 50, 250);
        const buscar = texto(args.buscar, 100).toLowerCase();
        const r = await pedir<{ products?: Producto[] }>(
          "Shopify",
          url(cred, `products.json?limit=${limite}`),
          { cabeceras: cabeceras(cred), signal },
        );
        const todos = r.products ?? [];
        const lista = buscar
          ? todos.filter((p) => p.title.toLowerCase().includes(buscar))
          : todos;
        if (!lista.length) return "La tienda no tiene productos que encajen con eso.";
        return `${lista.length} producto(s):\n${lista.map(unProducto).join("\n")}`;
      },
    },
    {
      nombre: "ver_producto",
      descripcion:
        "Una ficha entera: descripción, variantes, precios y los campos que lee Google (título y descripción SEO).",
      argumentos: "id (el número del producto)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 40);
        if (!id) return "Falta el id del producto.";
        const r = await pedir<{ product?: Producto }>("Shopify", url(cred, `products/${id}.json`), {
          cabeceras: cabeceras(cred),
          signal,
        });
        const p = r.product;
        if (!p) return "No existe ese producto.";

        const seo = await pedir<{ metafields?: { key: string; value: string }[] }>(
          "Shopify",
          url(cred, `products/${id}/metafields.json?namespace=global`),
          { cabeceras: cabeceras(cred), signal },
        ).catch(() => ({ metafields: [] }));

        const meta = Object.fromEntries(
          (seo.metafields ?? []).map((m) => [m.key, m.value]),
        ) as Record<string, string>;

        return [
          `#${p.id} · ${p.title}`,
          `Estado: ${p.status} · Tipo: ${p.product_type || "—"} · Marca: ${p.vendor || "—"}`,
          `Enlace: /products/${p.handle}`,
          `Título SEO: ${meta.title_tag || "(vacío: hereda el del producto)"}`,
          `Descripción SEO: ${meta.description_tag || "(vacía: Google se inventa el resumen)"}`,
          `Descripción: ${(p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200) || "(vacía)"}`,
          `Variantes: ${(p.variants ?? [])
            .map((v) => `${v.sku || "sin SKU"} ${v.price}${v.inventory_quantity === undefined ? "" : ` (stock ${v.inventory_quantity})`}`)
            .join(" · ") || "—"}`,
        ].join("\n");
      },
    },
    {
      nombre: "listar_pedidos",
      descripcion: "Los últimos pedidos con su importe y su estado de pago y envío.",
      argumentos: "limite (1-250, por defecto 25), estado (any, open, closed)",
      async ejecutar({ cred, args, signal }) {
        const limite = tope(args.limite, 25, 250);
        const estado = ["any", "open", "closed"].includes(String(args.estado))
          ? String(args.estado)
          : "any";
        const r = await pedir<{ orders?: Pedido[] }>(
          "Shopify",
          url(cred, `orders.json?limit=${limite}&status=${estado}`),
          { cabeceras: cabeceras(cred), signal },
        );
        const lista = r.orders ?? [];
        if (!lista.length) return "No hay pedidos que encajen con eso.";

        const total = lista.reduce((s, o) => s + Number(o.total_price || 0), 0);
        const moneda = lista[0]?.currency || "";
        return [
          `${lista.length} pedido(s), ${total.toFixed(2)} ${moneda} en total:`,
          ...lista.map(
            (o) =>
              `${o.name} · ${o.created_at?.slice(0, 10)} · ${o.total_price} ${o.currency || ""} · pago ${
                o.financial_status || "?"
              } · envío ${o.fulfillment_status || "pendiente"} · ${(o.line_items ?? [])
                .map((l) => `${l.quantity}× ${l.title}`)
                .join(", ")}`,
          ),
        ].join("\n");
      },
    },
    {
      nombre: "actualizar_producto",
      descripcion:
        "Cambia el título, la descripción o el SEO de un producto. Para reescribir fichas importadas de un proveedor, que es donde más se nota.",
      escribe: true,
      argumentos:
        "id (obligatorio), titulo, descripcion (HTML sencillo), seo_titulo (máx. 60 caracteres), seo_descripcion (máx. 160)",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 40);
        if (!id) return "Falta el id del producto.";

        const titulo = texto(args.titulo, 255);
        const descripcion = texto(args.descripcion, 20000);
        const seoTitulo = texto(args.seo_titulo, 120);
        const seoDescripcion = texto(args.seo_descripcion, 400);

        if (!titulo && !descripcion && !seoTitulo && !seoDescripcion)
          return "No has dicho qué cambiar. Hace falta al menos un campo.";

        const cambios: Record<string, unknown> = { id: Number(id) };
        if (titulo) cambios.title = titulo;
        if (descripcion) cambios.body_html = descripcion;
        // Los campos que lee Google viven en metafields, no en el producto.
        const metafields: Record<string, string>[] = [];
        if (seoTitulo)
          metafields.push({
            namespace: "global",
            key: "title_tag",
            value: seoTitulo,
            type: "single_line_text_field",
          });
        if (seoDescripcion)
          metafields.push({
            namespace: "global",
            key: "description_tag",
            value: seoDescripcion,
            type: "single_line_text_field",
          });
        if (metafields.length) cambios.metafields = metafields;

        await pedir("Shopify", url(cred, `products/${id}.json`), {
          metodo: "PUT",
          cabeceras: cabeceras(cred),
          cuerpo: { product: cambios },
          signal,
        });

        const hecho = [
          titulo && "el título",
          descripcion && "la descripción",
          seoTitulo && "el título SEO",
          seoDescripcion && "la descripción SEO",
        ].filter(Boolean);
        return `Producto #${id} actualizado: ${hecho.join(", ")}.`;
      },
    },
    {
      nombre: "crear_producto",
      descripcion: "Da de alta un producto nuevo con su precio y su descripción.",
      escribe: true,
      argumentos:
        "titulo (obligatorio), descripcion, precio, tipo, marca, borrador (true para dejarlo sin publicar)",
      async ejecutar({ cred, args, signal }) {
        const titulo = texto(args.titulo, 255);
        if (!titulo) return "Un producto necesita al menos un título.";

        const precio = texto(args.precio, 20).replace(",", ".");
        const r = await pedir<{ product?: Producto }>("Shopify", url(cred, "products.json"), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: {
            product: {
              title: titulo,
              body_html: texto(args.descripcion, 20000) || undefined,
              product_type: texto(args.tipo, 100) || undefined,
              vendor: texto(args.marca, 100) || undefined,
              // Nace como borrador salvo que digan lo contrario: publicar en la
              // tienda de alguien algo a medio hacer es peor que no crearlo.
              status: args.borrador === false ? "active" : "draft",
              ...(precio ? { variants: [{ price: precio }] } : {}),
            },
          },
          signal,
        });
        const p = r.product;
        return p
          ? `Creado #${p.id} «${p.title}» como ${p.status === "active" ? "publicado" : "borrador"}.`
          : "Creado.";
      },
    },
  ],
};
