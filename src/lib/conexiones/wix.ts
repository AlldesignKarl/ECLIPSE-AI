import { baseDe, pedir, texto, tope } from "./http";
import type { Credenciales, Servicio } from "./tipos";

/**
 * Wix: la web hecha sin programar.
 *
 * Quien tiene su negocio en Wix suele no tener a nadie que le lleve la web:
 * la montó él, con plantillas, y desde entonces la toca poco porque cada
 * cambio da pereza. Ahí es donde una conexión vale: pedir "revísame los textos
 * de la tienda y ponme descripciones decentes" y que pase de verdad.
 *
 * La clave de Wix es de la cuenta entera, no de un sitio, así que además del
 * token hay que decir en qué sitio trabajar. Va en una cabecera aparte.
 */

function url(camino: string): string {
  return `${baseDe("wix", "https://www.wixapis.com")}/${camino}`;
}

function cabeceras(cred: Credenciales): Record<string, string> {
  return {
    Authorization: cred.token,
    "wix-site-id": cred.sitio,
  };
}

interface Producto {
  id: string;
  name?: string;
  description?: string;
  sku?: string;
  visible?: boolean;
  priceData?: { price?: number; currency?: string; formatted?: { price?: string } };
  stock?: { inStock?: boolean; quantity?: number };
}

interface Entrada {
  id: string;
  title?: string;
  slug?: string;
  firstPublishedDate?: string;
  excerpt?: string;
}

export const wix: Servicio = {
  id: "wix",
  nombre: "Wix",
  familia: "web",
  resumen:
    "Tu web y tu tienda de Wix: productos, textos y entradas del blog, sin entrar al editor.",
  pasos: [
    "Entra en manage.wix.com y abre el gestor de claves de API de tu cuenta (Configuración → Claves de API).",
    "Pulsa «Generar clave de API», ponle de nombre ECLIPSE y dale permisos de Wix Stores y Wix Blog. Si quieres que también escriba, marca los de gestión además de los de lectura.",
    "Copia la clave: solo se enseña una vez.",
    "Copia también el ID del sitio. Está en el panel del sitio, en Configuración, o en la propia pantalla de claves al elegir a qué sitio dar acceso.",
    "Pega aquí las dos cosas.",
  ],
  enlace: "https://manage.wix.com/account/api-keys",
  campos: [
    {
      id: "token",
      etiqueta: "Clave de API",
      ayuda: "La cadena larga que genera Wix. Solo se enseña una vez.",
      secreto: true,
    },
    {
      id: "sitio",
      etiqueta: "ID del sitio",
      ayuda: "El identificador del sitio concreto con el que quieres trabajar.",
      placeholder: "12345678-abcd-…",
    },
  ],

  async verificar(cred, signal) {
    if (!cred.token?.trim()) return { ok: false, error: "Falta la clave de API." };
    if (!cred.sitio?.trim()) return { ok: false, error: "Falta el ID del sitio." };

    try {
      const r = await pedir<{ properties?: { siteDisplayName?: string; url?: string } }>(
        "Wix",
        url("site-properties/v4/properties"),
        { cabeceras: cabeceras(cred), signal },
      );
      const p = r.properties;
      return { ok: true, cuenta: p?.siteDisplayName || p?.url || "el sitio de Wix" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se ha podido conectar." };
    }
  },

  acciones: [
    {
      nombre: "ver_sitio",
      descripcion: "Los datos del sitio: nombre, dirección, idioma, moneda y zona horaria.",
      async ejecutar({ cred, signal }) {
        const r = await pedir<{
          properties?: {
            siteDisplayName?: string;
            url?: string;
            language?: string;
            paymentCurrency?: string;
            timeZone?: string;
            businessName?: string;
          };
        }>("Wix", url("site-properties/v4/properties"), { cabeceras: cabeceras(cred), signal });
        const p = r.properties ?? {};
        return [
          `Sitio: ${p.siteDisplayName || "—"}`,
          `Dirección: ${p.url || "—"}`,
          `Negocio: ${p.businessName || "—"}`,
          `Idioma: ${p.language || "—"} · Moneda: ${p.paymentCurrency || "—"} · Zona horaria: ${p.timeZone || "—"}`,
        ].join("\n");
      },
    },
    {
      nombre: "listar_productos",
      descripcion: "Los productos de la tienda de Wix, con precio y stock.",
      argumentos: "limite (1-100, por defecto 50)",
      async ejecutar({ cred, args, signal }) {
        const limite = tope(args.limite, 50, 100);
        const r = await pedir<{ products?: Producto[] }>("Wix", url("stores-reader/v1/products/query"), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: { query: { paging: { limit: limite } } },
          signal,
        });
        const lista = r.products ?? [];
        if (!lista.length) return "La tienda de Wix no tiene productos.";
        return `${lista.length} producto(s):\n${lista
          .map(
            (p) =>
              `${p.id} · ${p.name || "sin nombre"} · ${
                p.priceData?.formatted?.price ?? p.priceData?.price ?? "sin precio"
              }${p.stock?.quantity === undefined ? "" : ` · stock ${p.stock.quantity}`} · ${
                p.visible === false ? "oculto" : "visible"
              }`,
          )
          .join("\n")}`;
      },
    },
    {
      nombre: "listar_entradas_blog",
      descripcion: "Las entradas del blog, para saber qué hay publicado y qué falta por escribir.",
      argumentos: "limite (1-100, por defecto 25)",
      async ejecutar({ cred, args, signal }) {
        const limite = tope(args.limite, 25, 100);
        const r = await pedir<{ posts?: Entrada[] }>("Wix", url("blog/v3/posts/query"), {
          metodo: "POST",
          cabeceras: cabeceras(cred),
          cuerpo: { paging: { limit: limite } },
          signal,
        });
        const lista = r.posts ?? [];
        if (!lista.length) return "El blog no tiene entradas.";
        return `${lista.length} entrada(s):\n${lista
          .map(
            (e) =>
              `${e.title || "sin título"} · ${e.firstPublishedDate?.slice(0, 10) || "sin publicar"} · /${
                e.slug || ""
              }`,
          )
          .join("\n")}`;
      },
    },
    {
      nombre: "actualizar_producto",
      descripcion: "Cambia el nombre o la descripción de un producto de la tienda de Wix.",
      escribe: true,
      argumentos: "id (obligatorio), nombre, descripcion",
      async ejecutar({ cred, args, signal }) {
        const id = texto(args.id, 80);
        if (!id) return "Falta el id del producto.";

        const cambios: Record<string, unknown> = {};
        const nombre = texto(args.nombre, 255);
        const descripcion = texto(args.descripcion, 8000);
        if (nombre) cambios.name = nombre;
        if (descripcion) cambios.description = descripcion;
        if (!Object.keys(cambios).length)
          return "No has dicho qué cambiar. Hace falta al menos un campo.";

        await pedir("Wix", url(`stores/v1/products/${id}`), {
          metodo: "PATCH",
          cabeceras: cabeceras(cred),
          cuerpo: { product: cambios },
          signal,
        });
        return `Producto ${id} actualizado: ${Object.keys(cambios).join(", ")}.`;
      },
    },
  ],
};
