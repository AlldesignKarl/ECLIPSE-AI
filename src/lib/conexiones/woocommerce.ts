import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * WooCommerce: la otra mitad del comercio electrónico.
 *
 * Shopify se paga todos los meses; WooCommerce es un complemento gratuito de
 * WordPress, y por eso es donde empieza casi todo el que monta una tienda sin
 * dinero por delante. Dejarlo fuera habría sido dejar fuera justo a quien más
 * falta le hace que alguien le escriba cuatrocientas fichas.
 *
 * Se conecta con una pareja de claves que se generan en el propio WordPress.
 * Van por cabecera y no por la URL: en la URL acabarían escritas en el registro
 * del servidor de su hosting, que es el sitio donde menos falta hacen.
 */

function sitio(cred: Credenciales): string {
  return (cred.sitio || "").trim().replace(/\/+$/, "");
}

function url(cred: Credenciales, camino: string): string {
  return `${baseDe("woocommerce", sitio(cred))}/wp-json/wc/v3/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  const par = Buffer.from(`${cred.clave}:${cred.secreto}`).toString("base64");
  return { Authorization: `Basic ${par}` };
}

interface Producto {
  id: number;
  name: string;
  slug: string;
  status: string;
  price?: string;
  stock_quantity?: number | null;
  sku?: string;
  description?: string;
  short_description?: string;
}

interface Pedido {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency?: string;
  line_items?: { name: string; quantity: number }[];
}

export const woocommerce: Servicio = {
  id: "woocommerce",
  nombre: "WooCommerce",
  color: "#96588A",
  marca: "Wo",
  familia: "tienda",
  resumen:
    "La tienda de WordPress: productos, pedidos, stock y los textos que lee Google. Lo mismo que Shopify, sin cuota mensual.",
  pasos: [
    "Entra en tu WordPress y ve a WooCommerce → Ajustes → Avanzado → API REST.",
    "Pulsa «Añadir clave», ponle de descripción ECLIPSE y elige el permiso: «Lectura» para que solo mire, «Lectura/Escritura» si quieres que también cambie cosas.",
    "Genera la clave y copia las dos cadenas que salen: la que empieza por ck_ y la que empieza por cs_. Solo se enseñan una vez.",
    "Pega aquí las dos y la dirección de tu tienda, con https:// delante.",
  ],
  enlace: "https://woocommerce.com/document/woocommerce-rest-api/",
  campos: [
    {
      id: "sitio",
      etiqueta: "Dirección de la tienda",
      ayuda: "Con https:// delante y sin barra al final.",
      placeholder: "https://mitienda.com",
    },
    {
      id: "clave",
      etiqueta: "Clave de cliente",
      ayuda: "La que empieza por ck_.",
      placeholder: "ck_…",
      secreto: true,
    },
    {
      id: "secreto",
      etiqueta: "Secreto de cliente",
      ayuda: "La que empieza por cs_.",
      placeholder: "cs_…",
      secreto: true,
    },
  ],

  async verificar(cred, signal) {
    if (!/^https?:\/\/.+/.test(sitio(cred)))
      return { ok: false, error: "La dirección tiene que empezar por https://." };
    if (!cred.clave?.trim() || !cred.secreto?.trim())
      return { ok: false, error: "Faltan la clave o el secreto." };

    try {
      // `system_status` pide permisos de más en algunas instalaciones; pedir un
      // producto es la comprobación más pequeña que sirve igual.
      await pedir("WooCommerce", url(cred, "products?per_page=1"), {
        cabeceras: cabeceras(cred),
        signal,
      });
      return { ok: true, cuenta: sitio(cred).replace(/^https?:\/\//, "") };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "resumen_tienda",
      descripcion:
        "TODA la tienda de un vistazo y en UNA llamada: cuántos productos hay y cuántos sin publicar, qué se ha quedado sin stock o va justo, cuántos pedidos ha habido en los últimos días, cuánto suman, qué está pendiente y qué se vende más. Por aquí se empieza cuando alguien pregunta cómo va su tienda.",
      argumentos: "dias (cuántos días de pedidos mirar, 1-90, por defecto 30)",
      async ejecutar({ cred, args, signal }) {
        const dias = tope(args.dias, 30, 90);
        const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 19);

        // Las dos a la vez: encadenadas son dos viajes al WordPress de alguien,
        // que no siempre es rápido, dentro de una función que se corta a los 60s.
        const [productos, pedidos] = await Promise.all([
          pedir<Producto[]>("WooCommerce", url(cred, "products?per_page=100"), {
            cabeceras: cabeceras(cred),
            signal,
          }).catch(() => [] as Producto[]),
          pedir<Pedido[]>(
            "WooCommerce",
            url(cred, `orders?per_page=100&after=${encodeURIComponent(desde)}`),
            { cabeceras: cabeceras(cred), signal },
          ).catch(() => [] as Pedido[]),
        ]);

        const lista = productos ?? [];
        const ventas = pedidos ?? [];
        const moneda = ventas[0]?.currency || "";

        const conStock = lista.filter((p) => typeof p.stock_quantity === "number");
        const agotados = conStock.filter((p) => (p.stock_quantity ?? 0) <= 0);
        const justos = conStock.filter(
          (p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 5,
        );
        const borradores = lista.filter((p) => p.status !== "publish");
        const sinDescripcion = lista.filter(
          (p) => !`${p.description || ""}${p.short_description || ""}`.replace(/<[^>]+>/g, "").trim(),
        );

        const total = ventas.reduce((suma, o) => suma + Number(o.total || 0), 0);
        const pendientes = ventas.filter((o) => ["pending", "on-hold", "processing"].includes(o.status));

        const unidades = new Map<string, number>();
        for (const o of ventas)
          for (const l of o.line_items ?? [])
            unidades.set(l.name, (unidades.get(l.name) ?? 0) + (l.quantity || 0));
        const masVendido = [...unidades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

        const trozo = (titulo: string, lineas: string[]) =>
          lineas.length ? `\n${titulo}\n${lineas.join("\n")}` : "";

        return [
          `${sitio(cred)}`,
          "",
          `CATÁLOGO: ${lista.length} producto(s)${lista.length === 100 ? " (tope de la consulta; puede haber más)" : ""}.`,
          `  Sin publicar: ${borradores.length}. Sin descripción: ${sinDescripcion.length}.`,
          `  Con control de stock: ${conStock.length}. Sin stock: ${agotados.length}. Con 5 o menos: ${justos.length}.`,
          "",
          `VENTAS (últimos ${dias} días): ${ventas.length} pedido(s), ${total.toFixed(2)} ${moneda}.`,
          `  Media por pedido: ${ventas.length ? (total / ventas.length).toFixed(2) : "0.00"} ${moneda}.`,
          `  Sin terminar (pendientes, en espera o en curso): ${pendientes.length}.`,
          trozo(
            "SIN STOCK (hasta 15):",
            agotados.slice(0, 15).map((p) => `  · ${p.name}${p.sku ? ` [${p.sku}]` : ""}`),
          ),
          trozo(
            "STOCK JUSTO (hasta 15):",
            justos
              .slice(0, 15)
              .map((p) => `  · ${p.name}${p.sku ? ` [${p.sku}]` : ""} — quedan ${p.stock_quantity}`),
          ),
          trozo("LO QUE MÁS SE VENDE:", masVendido.map(([t, n]) => `  · ${n} uds · ${t}`)),
        ].join("\n");
      },
    },
    {
      nombre: "listar_productos",
      descripcion: "Los productos con su precio, su stock y su estado.",
      argumentos: "limite (1-100, por defecto 50), buscar (texto)",
      async ejecutar({ cred, args, signal }) {
        const limite = tope(args.limite, 50, 100);
        const buscar = texto(args.buscar, 100);
        const lista = await pedir<Producto[]>(
          "WooCommerce",
          url(cred, `products?per_page=${limite}${buscar ? `&search=${encodeURIComponent(buscar)}` : ""}`),
          { cabeceras: cabeceras(cred), signal },
        );
        if (!lista?.length) return "La tienda no tiene productos que encajen con eso.";
        return `${lista.length} producto(s):\n${lista
          .map(
            (p) =>
              `#${p.id} · ${p.name} · ${p.price || "sin precio"}${
                p.stock_quantity === null || p.stock_quantity === undefined
                  ? ""
                  : ` · stock ${p.stock_quantity}`
              } · ${p.status} · /${p.slug}`,
          )
          .join("\n")}`;
      },
    },
    {
      nombre: "ver_producto",
      descripcion: "La ficha entera de un producto, con sus dos descripciones.",
      argumentos: "id",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 40);
        if (!id) return "Falta el id del producto.";
        const p = await pedir<Producto>("WooCommerce", url(cred, `products/${id}`), {
          cabeceras: cabeceras(cred),
          signal,
        });
        const limpio = (s?: string) =>
          (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return [
          `#${p.id} · ${p.name}`,
          `Estado: ${p.status} · SKU: ${p.sku || "—"} · Precio: ${p.price || "—"}`,
          `Enlace: /${p.slug}`,
          `Descripción corta: ${limpio(p.short_description).slice(0, 400) || "(vacía)"}`,
          `Descripción: ${limpio(p.description).slice(0, 1200) || "(vacía)"}`,
        ].join("\n");
      },
    },
    {
      nombre: "listar_pedidos",
      descripcion: "Los últimos pedidos con su importe y su estado.",
      argumentos: "limite (1-100, por defecto 25)",
      async ejecutar({ cred, args, signal }) {
        const limite = tope(args.limite, 25, 100);
        const lista = await pedir<Pedido[]>("WooCommerce", url(cred, `orders?per_page=${limite}`), {
          cabeceras: cabeceras(cred),
          signal,
        });
        if (!lista?.length) return "No hay pedidos.";
        const total = lista.reduce((s, o) => s + Number(o.total || 0), 0);
        return [
          `${lista.length} pedido(s), ${total.toFixed(2)} ${lista[0]?.currency || ""} en total:`,
          ...lista.map(
            (o) =>
              `#${o.number} · ${o.date_created?.slice(0, 10)} · ${o.total} ${o.currency || ""} · ${
                o.status
              } · ${(o.line_items ?? []).map((l) => `${l.quantity}× ${l.name}`).join(", ")}`,
          ),
        ].join("\n");
      },
    },
    {
      nombre: "actualizar_producto",
      descripcion:
        "Cambia el nombre o las descripciones de un producto. Para reescribir fichas importadas de un proveedor.",
      escribe: true,
      argumentos: "id (obligatorio), nombre, descripcion, descripcion_corta",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 40);
        if (!id) return "Falta el id del producto.";

        const cambios: Record<string, unknown> = {};
        const nombre = texto(args.nombre, 255);
        const descripcion = texto(args.descripcion, 20000);
        const corta = texto(args.descripcion_corta, 2000);
        if (nombre) cambios.name = nombre;
        if (descripcion) cambios.description = descripcion;
        if (corta) cambios.short_description = corta;
        if (!Object.keys(cambios).length)
          return "No has dicho qué cambiar. Hace falta al menos un campo.";

        await pedir("WooCommerce", url(cred, `products/${id}`), {
          metodo: "PUT",
          cabeceras: cabeceras(cred),
          cuerpo: cambios,
          signal,
        });
        return `Producto #${id} actualizado: ${Object.keys(cambios).join(", ")}.`;
      },
    },
    {
      nombre: "crear_producto",
      descripcion: "Da de alta un producto nuevo.",
      escribe: true,
      argumentos: "nombre (obligatorio), precio, descripcion, borrador (true por defecto)",
      async ejecutar({ cred, args, signal }) {
        const nombre = texto(args.nombre, 255);
        if (!nombre) return "Un producto necesita al menos un nombre.";
        const p = await pedir<Producto>("WooCommerce", url(cred, "products"), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: {
            name: nombre,
            type: "simple",
            regular_price: texto(args.precio, 20).replace(",", ".") || undefined,
            description: texto(args.descripcion, 20000) || undefined,
            status: args.borrador === false ? "publish" : "draft",
          },
          signal,
        });
        return `Creado #${p.id} «${p.name}» como ${p.status === "publish" ? "publicado" : "borrador"}.`;
      },
    },
  ],
};
