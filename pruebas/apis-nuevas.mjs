// Un servidor que habla como PrestaShop, Mailchimp, Brevo, Airtable, Trello,
// Todoist, Slack, Discord, HubSpot, Calendly, Cloudflare y Vercel.
//
// Va aparte de `apis-falsas.mjs` y no dentro por una razón práctica: aquel
// sirve a siete pruebas que ya funcionan, y meterle doce servicios más lo
// convierte en un archivo de seiscientas líneas donde tocar una llave rompe
// algo que no tiene nada que ver. Cada uno responde en su propio prefijo, así
// que un conector que se equivoque de ruta se ve en el acto en vez de caer en
// la respuesta de otro.
import { createServer } from "node:http";

export const ESPERADO = {
  CLAVE_PRESTASHOP: "PRESTA123",
  CLAVE_MAILCHIMP: "mc-secreto-us21",
  CLAVE_BREVO: "xkeysib-secreto",
  TOKEN_AIRTABLE: "patSecreto",
  CLAVE_TRELLO: "trello-clave",
  TOKEN_TRELLO: "trello-token",
  TOKEN_TODOIST: "todoist-secreto",
  TOKEN_SLACK: "xoxb-secreto",
  TOKEN_DISCORD: "discord-secreto",
  TOKEN_HUBSPOT: "pat-eu1-secreto",
  TOKEN_CALENDLY: "calendly-secreto",
  TOKEN_CLOUDFLARE: "cf-secreto",
  TOKEN_VERCEL: "vercel-secreto",
};

/** Lo que le han escrito, para comprobar que llegó y con qué datos. */
export const escrituras = [];

function json(res, cuerpo, estado = 200) {
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

/** El "Bearer xxx" de una cabecera, o cadena vacía. */
function portador(h) {
  return String(h.authorization ?? "").replace(/^Bearer\s+/i, "");
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
      const metodo = req.method;

      /* ------------------------- PrestaShop ------------------------- */
      if (ruta.startsWith("/presta/")) {
        const esperada = Buffer.from(`${ESPERADO.CLAVE_PRESTASHOP}:`).toString("base64");
        if (h.authorization !== `Basic ${esperada}`)
          return json(res, { errors: [{ message: "Invalid authentication key" }] }, 401);

        if (ruta === "/presta/api/") return json(res, { api: { products: {}, orders: {}, customers: {} } });
        if (ruta === "/presta/api/products") {
          const buscado = u.searchParams.get("filter[name]");
          const todos = [
            { id: 1, name: "Vela de soja", price: "12.500000", quantity: "8", active: "1" },
            { id: 2, name: "Jabón artesano", price: "6.000000", quantity: "0", active: "0" },
          ];
          const lista = buscado ? todos.filter((p) => p.name.toLowerCase().includes("vela")) : todos;
          return json(res, { products: lista });
        }
        if (ruta === "/presta/api/products/1")
          return json(res, {
            product: {
              id: 1,
              name: [{ id: 1, value: "Vela de soja" }],
              price: "12.500000",
              reference: "VEL-1",
              quantity: "8",
              description_short: [{ id: 1, value: "<p>Cuarenta horas de luz</p>" }],
              meta_title: [{ id: 1, value: "" }],
            },
          });
        if (ruta === "/presta/api/orders")
          return json(res, {
            orders: [
              { id: 10, reference: "ABCDEF", total_paid: "34.900000", date_add: "2026-09-01 10:00:00" },
              { id: 11, reference: "GHIJKL", total_paid: "12.500000", date_add: "2026-09-02 12:00:00" },
            ],
          });
        return json(res, { errors: [{ message: "no existe" }] }, 404);
      }

      /* -------------------------- Mailchimp -------------------------- */
      if (ruta.startsWith("/mc/3.0")) {
        const esperada = Buffer.from(`eclipse:${ESPERADO.CLAVE_MAILCHIMP}`).toString("base64");
        if (h.authorization !== `Basic ${esperada}`)
          return json(res, { title: "API Key Invalid", status: 401 }, 401);

        if (ruta === "/mc/3.0/") return json(res, { account_name: "Eclipse SL", total_subscribers: 1240 });
        if (ruta === "/mc/3.0/lists")
          return json(res, {
            lists: [
              { id: "l1", name: "Clientes", stats: { member_count: 1200, unsubscribe_count: 8, open_rate: 0.42 } },
            ],
          });
        if (ruta === "/mc/3.0/lists/l1")
          return json(res, {
            name: "Clientes",
            stats: { member_count: 1200, unsubscribe_count: 8, cleaned_count: 3, open_rate: 0.42, click_rate: 0.11, campaign_count: 9 },
          });
        if (ruta === "/mc/3.0/campaigns")
          return json(res, {
            campaigns: [
              {
                id: "c1", status: "sent", send_time: "2026-09-10T08:00:00+00:00", emails_sent: 1180,
                settings: { subject_line: "Novedades de septiembre" },
                report_summary: { open_rate: 0.38, click_rate: 0.07 },
              },
            ],
          });
        return json(res, { status: 404 }, 404);
      }

      /* ---------------------------- Brevo ---------------------------- */
      if (ruta.startsWith("/brevo/v3")) {
        if (h["api-key"] !== ESPERADO.CLAVE_BREVO)
          return json(res, { code: "unauthorized", message: "Key not found" }, 401);

        if (ruta === "/brevo/v3/account")
          return json(res, { companyName: "Eclipse SL", email: "hola@eclipse.es", plan: [{ type: "free", credits: 300 }] });
        if (ruta === "/brevo/v3/contacts/lists")
          return json(res, { lists: [{ id: 3, name: "Boletín", totalSubscribers: 540, totalBlacklisted: 4 }], count: 1 });
        if (ruta === "/brevo/v3/emailCampaigns")
          return json(res, {
            campaigns: [
              { name: "Verano", subject: "Rebajas de verano", status: "sent", sentDate: "2026-07-01T09:00:00Z",
                statistics: { globalStats: { sent: 500, uniqueViews: 200, clickers: 30 } } },
            ],
          });
        if (ruta === "/brevo/v3/contacts/ana%40ejemplo.com" || ruta === "/brevo/v3/contacts/ana@ejemplo.com")
          return json(res, { email: "ana@ejemplo.com", emailBlacklisted: false, createdAt: "2025-02-03T10:00:00Z", listIds: [3], attributes: { NOMBRE: "Ana" } });
        return json(res, { code: "document_not_found" }, 404);
      }

      /* --------------------------- Airtable --------------------------- */
      if (ruta.startsWith("/at/v0")) {
        if (portador(h) !== ESPERADO.TOKEN_AIRTABLE)
          return json(res, { error: { type: "AUTHENTICATION_REQUIRED" } }, 401);

        if (ruta === "/at/v0/meta/bases")
          return json(res, { bases: [{ id: "appUno", name: "Pedidos" }, { id: "appDos", name: "Clientes" }] });
        if (ruta === "/at/v0/meta/bases/appUno/tables")
          return json(res, {
            tables: [{ id: "tbl1", name: "Encargos", fields: [{ name: "Nombre", type: "singleLineText" }, { name: "Estado", type: "singleSelect" }] }],
          });
        if (ruta === "/at/v0/appUno/Encargos" && metodo === "GET")
          return json(res, {
            records: [{ id: "rec1", fields: { Nombre: "Tarta de manzana", Estado: "En horno", Etiquetas: ["urgente", "local"] } }],
          });
        if (ruta === "/at/v0/appUno/Encargos" && metodo === "POST") {
          escrituras.push({ servicio: "airtable", cuerpo });
          return json(res, { id: "recNuevo" });
        }
        return json(res, { error: "NOT_FOUND" }, 404);
      }

      /* ---------------------------- Trello ---------------------------- */
      if (ruta.startsWith("/trello/1")) {
        if (u.searchParams.get("key") !== ESPERADO.CLAVE_TRELLO || u.searchParams.get("token") !== ESPERADO.TOKEN_TRELLO) {
          res.writeHead(401, { "content-type": "text/plain" });
          return res.end("invalid key");
        }
        if (ruta === "/trello/1/members/me") return json(res, { fullName: "Karl", username: "karl" });
        if (ruta === "/trello/1/members/me/boards")
          return json(res, [{ id: "b1", name: "Tienda", closed: false }, { id: "b2", name: "Viejo", closed: true }]);
        if (ruta === "/trello/1/boards/b1/lists")
          return json(res, [{ id: "li1", name: "Por hacer" }, { id: "li2", name: "Hecho" }]);
        if (ruta === "/trello/1/boards/b1/cards")
          return json(res, [
            { id: "t1", name: "Cambiar las fotos", idList: "li1", due: "2026-09-20T12:00:00Z", dueComplete: false },
            { id: "t2", name: "Subir precios", idList: "li2", due: null },
          ]);
        if (ruta === "/trello/1/cards" && metodo === "POST") {
          escrituras.push({ servicio: "trello", consulta: Object.fromEntries(u.searchParams) });
          return json(res, { id: "tNueva", shortUrl: "https://trello.com/c/nueva" });
        }
        return json(res, { error: "no existe" }, 404);
      }

      /* ---------------------------- Todoist ---------------------------- */
      if (ruta.startsWith("/todoist/rest/v2")) {
        if (portador(h) !== ESPERADO.TOKEN_TODOIST) {
          res.writeHead(401, { "content-type": "text/plain" });
          return res.end("Invalid token");
        }
        if (ruta === "/todoist/rest/v2/projects")
          return json(res, [{ id: "p1", name: "Casa", is_favorite: true }, { id: "p2", name: "Tienda" }]);
        if (ruta === "/todoist/rest/v2/tasks" && metodo === "GET") {
          const filtro = u.searchParams.get("filter");
          const todas = [
            { id: "t1", content: "Llamar al gestor", due: { date: "2026-09-15" }, priority: 4 },
            { id: "t2", content: "Pedir cajas", due: { date: "2026-09-30" }, priority: 1 },
          ];
          return json(res, filtro === "today" ? [todas[0]] : todas);
        }
        if (ruta === "/todoist/rest/v2/tasks" && metodo === "POST") {
          escrituras.push({ servicio: "todoist", cuerpo });
          return json(res, { id: "tNueva", content: cuerpo.content, due: { date: "2026-09-22" } });
        }
        return json(res, {}, 404);
      }

      /* ----------------------------- Slack ----------------------------- */
      if (ruta.startsWith("/slack/api")) {
        // Slack contesta 200 aunque haya fallado, con el fallo dentro. Es justo
        // lo que hay que imitar: si el conector mirara solo el código, una
        // clave mala pasaría por buena.
        if (portador(h) !== ESPERADO.TOKEN_SLACK) return json(res, { ok: false, error: "invalid_auth" });

        if (ruta === "/slack/api/auth.test") return json(res, { ok: true, team: "Eclipse", user: "eclipse-bot" });
        if (ruta === "/slack/api/conversations.list")
          return json(res, {
            ok: true,
            channels: [
              { id: "C1", name: "general", is_member: true, num_members: 12 },
              { id: "C2", name: "ventas", is_member: false, num_members: 4 },
            ],
          });
        if (ruta === "/slack/api/conversations.history") {
          if (u.searchParams.get("channel") === "C9") return json(res, { ok: false, error: "channel_not_found" });
          return json(res, {
            ok: true,
            messages: [
              { text: "y mañana lo subimos", user: "U2", ts: "1757000200" },
              { text: "he cambiado las fotos", user: "U1", ts: "1757000100" },
            ],
          });
        }
        if (ruta === "/slack/api/chat.postMessage" && metodo === "POST") {
          escrituras.push({ servicio: "slack", cuerpo });
          return json(res, { ok: true, ts: "1757000300" });
        }
        return json(res, { ok: false, error: "unknown_method" });
      }

      /* ---------------------------- Discord ---------------------------- */
      if (ruta.startsWith("/discord/api/v10")) {
        if (h.authorization !== `Bot ${ESPERADO.TOKEN_DISCORD}`)
          return json(res, { message: "401: Unauthorized", code: 0 }, 401);

        if (ruta === "/discord/api/v10/users/@me") return json(res, { username: "eclipse", discriminator: "0" });
        if (ruta === "/discord/api/v10/users/@me/guilds")
          return json(res, [{ id: "g1", name: "Comunidad Eclipse" }]);
        if (ruta === "/discord/api/v10/guilds/g1/channels")
          return json(res, [
            { id: "c1", name: "anuncios", type: 0 },
            { id: "c2", name: "voz", type: 2 },
          ]);
        if (ruta === "/discord/api/v10/channels/c1/messages" && metodo === "GET")
          return json(res, [
            { content: "¿alguien sabe cuándo abre?", timestamp: "2026-09-14T10:05:00Z", author: { username: "ana" } },
            { content: "bienvenidos", timestamp: "2026-09-14T09:00:00Z", author: { username: "eclipse", bot: true } },
          ]);
        if (ruta === "/discord/api/v10/channels/c1/messages" && metodo === "POST") {
          escrituras.push({ servicio: "discord", cuerpo });
          return json(res, { id: "m1" });
        }
        return json(res, { message: "404" }, 404);
      }

      /* ---------------------------- HubSpot ---------------------------- */
      if (ruta.startsWith("/hs/")) {
        if (portador(h) !== ESPERADO.TOKEN_HUBSPOT)
          return json(res, { status: "error", message: "Authentication credentials not found" }, 401);

        // A propósito: casi nadie marca este permiso, así que el conector tiene
        // que apañarse sin él en vez de dar la conexión por mala.
        if (ruta === "/hs/account-info/v3/details") return json(res, { status: "error" }, 403);

        if (ruta === "/hs/crm/v3/objects/contacts")
          return json(res, {
            results: [
              { id: "1", properties: { firstname: "Ana", lastname: "Ruiz", email: "ana@ejemplo.com", company: "Panadería Ruiz", createdate: "2026-01-04T10:00:00Z" } },
            ],
          });
        if (ruta === "/hs/crm/v3/objects/contacts/search" && metodo === "POST")
          return json(res, {
            results: cuerpo?.query?.includes("ana")
              ? [{ id: "1", properties: { firstname: "Ana", lastname: "Ruiz", email: "ana@ejemplo.com", phone: "600000000", lifecyclestage: "customer" } }]
              : [],
          });
        if (ruta === "/hs/crm/v3/objects/deals")
          return json(res, {
            results: [
              { id: "9", properties: { dealname: "Web nueva", amount: "2500", dealstage: "presentación", closedate: "2026-10-01T00:00:00Z" } },
              { id: "10", properties: { dealname: "Mantenimiento", amount: "500", dealstage: "cerrado" } },
            ],
          });
        return json(res, { status: "error" }, 404);
      }

      /* ---------------------------- Calendly ---------------------------- */
      if (ruta.startsWith("/cal/")) {
        if (portador(h) !== ESPERADO.TOKEN_CALENDLY)
          return json(res, { title: "Unauthenticated", message: "The access token is invalid" }, 401);

        if (ruta === "/cal/users/me")
          return json(res, { resource: { name: "Karl", email: "karl@eclipse.es", uri: "https://api.calendly.com/users/UNO" } });
        if (ruta === "/cal/scheduled_events")
          return json(res, {
            collection: [
              { name: "Consulta de 30 min", start_time: "2026-09-16T09:00:00.000000Z", status: "active", invitees_counter: { active: 1 } },
              { name: "Cancelada", start_time: "2026-09-17T09:00:00.000000Z", status: "canceled" },
            ],
          });
        if (ruta === "/cal/event_types")
          return json(res, {
            collection: [{ name: "Consulta de 30 min", duration: 30, active: true, scheduling_url: "https://calendly.com/karl/30min" }],
          });
        return json(res, { title: "Not found" }, 404);
      }

      /* --------------------------- Cloudflare --------------------------- */
      if (ruta.startsWith("/cf/client/v4")) {
        if (portador(h) !== ESPERADO.TOKEN_CLOUDFLARE)
          // Cloudflare también mete el fallo dentro del cuerpo.
          return json(res, { success: false, errors: [{ message: "Invalid access token" }], result: null }, 400);

        if (ruta === "/cf/client/v4/user/tokens/verify")
          return json(res, { success: true, errors: [], result: { status: "active" } });
        if (ruta === "/cf/client/v4/zones") {
          const nombre = u.searchParams.get("name");
          const zonas = [{ id: "z1", name: "mitienda.com", status: "active", paused: false }];
          return json(res, { success: true, errors: [], result: nombre ? zonas.filter((z) => z.name === nombre) : zonas });
        }
        if (ruta === "/cf/client/v4/zones/z1/dns_records" && metodo === "GET")
          return json(res, {
            success: true, errors: [],
            result: [
              { type: "A", name: "mitienda.com", content: "1.2.3.4", proxied: true },
              { type: "MX", name: "mitienda.com", content: "correo.mitienda.com" },
            ],
          });
        if (ruta === "/cf/client/v4/zones/z1/dns_records" && metodo === "POST") {
          escrituras.push({ servicio: "cloudflare", cuerpo });
          return json(res, { success: true, errors: [], result: { id: "dns1" } });
        }
        return json(res, { success: false, errors: [{ message: "no existe" }] }, 404);
      }

      /* ----------------------------- Vercel ----------------------------- */
      if (ruta.startsWith("/vercel/")) {
        if (portador(h) !== ESPERADO.TOKEN_VERCEL)
          return json(res, { error: { code: "forbidden", message: "Not authorized" } }, 403);

        if (ruta === "/vercel/v2/user")
          return json(res, { user: { username: "alldesignkarl", email: "karl@eclipse.es" } });
        if (ruta === "/vercel/v9/projects")
          return json(res, {
            projects: [{ name: "eclipse-ia", framework: "nextjs", targets: { production: { url: "eclipse-ia.vercel.app" } } }],
          });
        if (ruta === "/vercel/v6/deployments")
          return json(res, {
            deployments: [
              { name: "eclipse-ia", url: "eclipse-ia-abc.vercel.app", state: "READY", target: "production", created: Date.now() - 3600000 },
              { name: "eclipse-ia", url: "eclipse-ia-def.vercel.app", state: "ERROR", created: Date.now() - 7200000 },
            ],
          });
        if (ruta === "/vercel/v5/domains")
          return json(res, { domains: [{ name: "eclipse-ia.com", verified: true, expiresAt: 1790000000000 }] });
        return json(res, { error: { code: "not_found" } }, 404);
      }

      json(res, { error: "ruta desconocida", ruta }, 404);
    });
  });
}
