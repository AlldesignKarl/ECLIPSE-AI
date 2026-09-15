// Un servidor que habla como Shopify, WooCommerce, Wix, IONOS y Binance.
//
// Sirve para comprobar los conectores enteros —la ruta, las cabeceras, el
// cuerpo, la firma— sin tocar la tienda de nadie y sin necesitar una cuenta de
// cada servicio. Guarda lo que le escriben, así que también se puede comprobar
// que un cambio llegó de verdad y con qué datos.
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";

const TOKEN_SHOPIFY = "shpat_secreto";
const CLAVE_WOO = "ck_clave";
const SECRETO_WOO = "cs_secreto";
const TOKEN_WIX = "wix-token";
const SITIO_WIX = "sitio-123";
const CLAVE_IONOS = "pref.secreto";
const TOKEN_NOTION = "ntn_secreto";
const TOKEN_GITHUB = "github_pat_secreto";
const CLAVE_BINANCE = "bnb-clave";
const SECRETO_BINANCE = "bnb-secreto";

export const ESPERADO = {
  TOKEN_SHOPIFY, CLAVE_WOO, SECRETO_WOO, TOKEN_WIX, SITIO_WIX,
  CLAVE_IONOS, CLAVE_BINANCE, SECRETO_BINANCE, TOKEN_NOTION, TOKEN_GITHUB,
};

// Lo que han cambiado, para poder comprobarlo desde la prueba.
export const escrituras = [];

const productos = [
  { id: 1, title: "Camiseta importada", handle: "camiseta", status: "active", product_type: "Ropa", body_html: "<p>High quality t-shirt</p>", variants: [{ id: 11, price: "19.90", inventory_quantity: 40, sku: "CAM-1" }] },
  { id: 2, title: "Taza", handle: "taza", status: "draft", body_html: "", variants: [{ id: 21, price: "8.50", inventory_quantity: 0, sku: "TAZ-1" }] },
];

function json(res, cuerpo, estado = 200) {
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

export function crear() {
  return createServer((req, res) => {
    let crudo = "";
    req.on("data", (c) => (crudo += c));
    req.on("end", () => {
      const u = new URL(req.url, "http://x");
      const ruta = u.pathname;
      const cuerpo = crudo ? JSON.parse(crudo) : null;
      const h = req.headers;

      /* ---------------------------- Shopify ---------------------------- */
      if (ruta.startsWith("/admin/api/")) {
        if (h["x-shopify-access-token"] !== TOKEN_SHOPIFY)
          return json(res, { errors: "[API] Invalid API key or access token" }, 401);

        if (ruta.endsWith("/shop.json"))
          return json(res, { shop: { name: "Mi Tienda", domain: "mitienda.com", currency: "EUR" } });

        if (ruta.endsWith("/products.json") && req.method === "GET")
          return json(res, { products: productos });

        if (ruta.endsWith("/products.json") && req.method === "POST") {
          escrituras.push({ servicio: "shopify", tipo: "crear", cuerpo });
          const p = cuerpo.product;
          return json(res, { product: { id: 99, title: p.title, handle: "nuevo", status: p.status } });
        }
        const mMeta = ruta.match(/\/products\/(\d+)\/metafields\.json$/);
        if (mMeta) return json(res, { metafields: [{ key: "title_tag", value: "Camiseta | Mi Tienda" }] });

        const mProd = ruta.match(/\/products\/(\d+)\.json$/);
        if (mProd && req.method === "GET") {
          const p = productos.find((x) => String(x.id) === mProd[1]);
          return p ? json(res, { product: p }) : json(res, { errors: "Not Found" }, 404);
        }
        if (mProd && req.method === "PUT") {
          escrituras.push({ servicio: "shopify", tipo: "actualizar", id: mProd[1], cuerpo });
          return json(res, { product: { id: Number(mProd[1]) } });
        }
        if (ruta.endsWith("/orders.json"))
          return json(res, { orders: [{ id: 5, name: "#1001", created_at: "2026-09-01T10:00:00Z", financial_status: "paid", fulfillment_status: null, total_price: "28.40", currency: "EUR", line_items: [{ title: "Camiseta importada", quantity: 1 }] }] });

        return json(res, { errors: "no existe" }, 404);
      }

      /* -------------------------- WooCommerce -------------------------- */
      if (ruta.startsWith("/wp-json/wc/v3/")) {
        const auth = String(h.authorization || "");
        const par = Buffer.from(auth.replace("Basic ", ""), "base64").toString();
        if (par !== `${CLAVE_WOO}:${SECRETO_WOO}`)
          return json(res, { message: "consumer key is invalid" }, 401);

        if (ruta.endsWith("/products") && req.method === "GET")
          return json(res, [{ id: 7, name: "Zapatillas", slug: "zapatillas", status: "publish", price: "49.00", stock_quantity: 12, sku: "ZAP", description: "<p>Running shoes</p>", short_description: "" }]);
        if (ruta.endsWith("/products") && req.method === "POST") {
          escrituras.push({ servicio: "woocommerce", tipo: "crear", cuerpo });
          return json(res, { id: 77, name: cuerpo.name, status: cuerpo.status });
        }
        const m = ruta.match(/\/products\/(\d+)$/);
        if (m && req.method === "GET")
          return json(res, { id: 7, name: "Zapatillas", slug: "zapatillas", status: "publish", price: "49.00", sku: "ZAP", description: "<p>Running shoes</p>", short_description: "Ligeras" });
        if (m && req.method === "PUT") {
          escrituras.push({ servicio: "woocommerce", tipo: "actualizar", id: m[1], cuerpo });
          return json(res, { id: Number(m[1]) });
        }
        if (ruta.endsWith("/orders"))
          return json(res, [{ id: 3, number: "3", status: "processing", date_created: "2026-09-02T09:00:00", total: "49.00", currency: "EUR", line_items: [{ name: "Zapatillas", quantity: 1 }] }]);
        return json(res, { message: "no existe" }, 404);
      }

      /* ------------------------------ Wix ------------------------------ */
      if (ruta.startsWith("/site-properties/") || ruta.startsWith("/stores") || ruta.startsWith("/blog/")) {
        if (h.authorization !== TOKEN_WIX || h["wix-site-id"] !== SITIO_WIX)
          return json(res, { message: "Missing or invalid authorization" }, 401);

        if (ruta.startsWith("/site-properties/"))
          return json(res, { properties: { siteDisplayName: "Mi Web", url: "https://miweb.wixsite.com", language: "es", paymentCurrency: "EUR", timeZone: "Europe/Madrid", businessName: "Eclipse" } });
        if (ruta.includes("/products/query"))
          return json(res, { products: [{ id: "p1", name: "Vela aromática", visible: true, priceData: { price: 12, currency: "EUR", formatted: { price: "12,00 €" } }, stock: { quantity: 8 } }] });
        if (ruta.includes("/posts/query"))
          return json(res, { posts: [{ id: "b1", title: "Cómo elegir una vela", slug: "elegir-vela", firstPublishedDate: "2026-05-02T00:00:00Z" }] });
        const m = ruta.match(/\/stores\/v1\/products\/(.+)$/);
        if (m && req.method === "PATCH") {
          escrituras.push({ servicio: "wix", tipo: "actualizar", id: m[1], cuerpo });
          return json(res, { product: { id: m[1] } });
        }
        return json(res, { message: "no existe" }, 404);
      }

      /* ----------------------------- IONOS ----------------------------- */
      if (ruta.startsWith("/dns/v1/")) {
        if (h["x-api-key"] !== CLAVE_IONOS) return json(res, { message: "Unauthorized" }, 401);

        if (ruta === "/dns/v1/zones")
          return json(res, [{ id: "z1", name: "mitienda.com", type: "NATIVE" }]);
        if (ruta === "/dns/v1/zones/z1")
          return json(res, { id: "z1", name: "mitienda.com", records: [
            { id: "r1", name: "mitienda.com", type: "A", content: "1.2.3.4", ttl: 3600 },
            { id: "r2", name: "www.mitienda.com", type: "CNAME", content: "shops.myshopify.com", ttl: 3600 },
          ] });
        if (ruta === "/dns/v1/zones/z1/records" && req.method === "POST") {
          escrituras.push({ servicio: "ionos", tipo: "crear", cuerpo });
          return json(res, {}, 201);
        }
        return json(res, { message: "no existe" }, 404);
      }

      /* ----------------------------- Notion ---------------------------- */
      if (ruta.startsWith("/v1/")) {
        if (h.authorization !== "Bearer ntn_secreto" || !h["notion-version"])
          return json(res, { message: "API token is invalid." }, 401);

        if (ruta === "/v1/users/me")
          return json(res, { name: "ECLIPSE", bot: { workspace_name: "Mi espacio" } });
        if (ruta === "/v1/search")
          return json(res, { results: [
            { id: "pag-1", object: "page", properties: { Nombre: { type: "title", title: [{ plain_text: "Ideas de vídeos" }] } } },
            { id: "bd-1", object: "database", title: [{ plain_text: "Clientes" }] },
          ] });
        if (ruta === "/v1/blocks/pag-1/children" && req.method === "GET")
          return json(res, { results: [
            { type: "heading_1", heading_1: { rich_text: [{ plain_text: "Ideas" }] } },
            { type: "to_do", to_do: { checked: false, rich_text: [{ plain_text: "Grabar el unboxing" }] } },
          ] });
        if (ruta === "/v1/blocks/pag-1/children" && req.method === "PATCH") {
          escrituras.push({ servicio: "notion", tipo: "escribir", cuerpo });
          return json(res, { results: [] });
        }
        if (ruta === "/v1/databases/bd-1/query")
          return json(res, { results: [
            { id: "f1", properties: {
              Nombre: { type: "title", title: [{ plain_text: "Panadería Ruiz" }] },
              Estado: { type: "select", select: { name: "Activo" } },
            } },
          ] });
        return json(res, { message: "no existe" }, 404);
      }

      /* ----------------------------- GitHub ---------------------------- */
      if (ruta === "/user" || ruta.startsWith("/user/repos") || ruta.startsWith("/repos/")) {
        if (h.authorization !== "Bearer github_pat_secreto")
          return json(res, { message: "Bad credentials" }, 401);

        if (ruta === "/user") return json(res, { login: "alldesignkarl" });
        if (ruta.startsWith("/user/repos"))
          return json(res, [{ full_name: "alldesignkarl/eclipse-ai", private: true, language: "TypeScript", pushed_at: "2026-09-14T10:00:00Z", description: "La app" }]);
        if (ruta === "/repos/alldesignkarl/eclipse-ai/contents/")
          return json(res, [{ name: "src", type: "dir", path: "src" }, { name: "README.md", type: "file", path: "README.md", size: 120 }]);
        if (ruta === "/repos/alldesignkarl/eclipse-ai/contents/README.md")
          return json(res, { name: "README.md", encoding: "base64", content: Buffer.from("# ECLIPSE\nHola.").toString("base64") });
        if (ruta.includes("/issues") && req.method === "GET")
          return json(res, [
            { number: 7, title: "La foto no se ve", state: "open", user: { login: "karl" }, created_at: "2026-09-01T00:00:00Z" },
            { number: 8, title: "Un PR", state: "open", pull_request: {} },
          ]);
        if (ruta.includes("/issues") && req.method === "POST") {
          escrituras.push({ servicio: "github", tipo: "incidencia", cuerpo });
          return json(res, { number: 9, html_url: "https://github.com/x/y/issues/9" });
        }
        return json(res, { message: "no existe" }, 404);
      }

      /* ---------------------------- Binance ---------------------------- */
      if (ruta.startsWith("/api/v3/")) {
        const firmadas = ["/api/v3/account", "/api/v3/openOrders"];
        if (firmadas.includes(ruta)) {
          if (h["x-mbx-apikey"] !== CLAVE_BINANCE)
            return json(res, { code: -2015, msg: "Invalid API-key" }, 401);
          // La firma tiene que cuadrar con el resto de la consulta.
          const params = u.search.slice(1);
          const sinFirma = params.replace(/&signature=[^&]*/, "");
          const esperada = createHmac("sha256", SECRETO_BINANCE).update(sinFirma).digest("hex");
          if (u.searchParams.get("signature") !== esperada)
            return json(res, { code: -1022, msg: "Signature for this request is not valid." }, 401);
        }
        if (ruta === "/api/v3/account")
          return json(res, { accountType: "SPOT", canTrade: true, balances: [
            { asset: "BTC", free: "0.05000000", locked: "0.00000000" },
            { asset: "EUR", free: "320.10000000", locked: "50.00000000" },
            { asset: "DOGE", free: "0.00000000", locked: "0.00000000" },
          ] });
        if (ruta === "/api/v3/openOrders")
          return json(res, [{ symbol: "BTCEUR", side: "BUY", type: "LIMIT", price: "50000.00", origQty: "0.001", time: 1757000000000 }]);
        if (ruta === "/api/v3/ticker/24hr")
          return json(res, { lastPrice: "58000.00", priceChangePercent: "2.35", highPrice: "59000.00", lowPrice: "56500.00", volume: "1200.5", quoteVolume: "69000000" });
        if (ruta === "/api/v3/klines")
          return json(res, Array.from({ length: 5 }, (_, i) => [
            1757000000000 + i * 86400000, "100", "110", "95", String(100 + i * 2), "5000",
          ]));
        return json(res, { msg: "no existe" }, 404);
      }

      json(res, { error: "ruta desconocida", ruta }, 404);
    });
  });
}

// Arrancable a mano: node apis-falsas.mjs puerto.txt
if (process.argv[1]?.endsWith("apis-falsas.mjs") && process.argv[2]) {
  const s = crear();
  s.listen(0, () => {
    writeFileSync(process.argv[2], String(s.address().port));
    console.log("apis falsas en", s.address().port);
  });
}
