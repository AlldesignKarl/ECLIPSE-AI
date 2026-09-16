/**
 * Un Google de mentira: su pantalla de permisos, sus testigos y su Gmail.
 *
 * Aquí no hay internet, así que contra el Google de verdad no se puede probar
 * nada. Lo que sí se puede comprobar —y es lo que de verdad importa— es que
 * ECLIPSE hace el baile de OAuth ENTERO y bien:
 *
 * - que pide `access_type=offline`, sin lo cual la conexión dura una hora;
 * - que cambia el código por los testigos hablando desde el servidor;
 * - que cuando el de acceso caduca saca otro con el de refresco;
 * - y que NO pierde el de refresco al hacerlo, que es lo que haría que todo
 *   funcionara hoy y estuviera muerto mañana.
 *
 * Por eso este Google falso se comporta como el de verdad en lo que más duele:
 * al refrescar NO devuelve refresh_token, y rechaza un testigo caducado.
 */
import { createServer } from "node:http";

export const ESPERADO = {
  ID: "id-de-cliente-de-mentira.apps.googleusercontent.com",
  SECRETO: "secreto-de-mentira",
  CODIGO: "codigo-de-un-solo-uso",
};

/** Los correos que hay en el buzón de mentira. */
const b64 = (t) => Buffer.from(t, "utf8").toString("base64url");

const BUZON = [
  {
    id: "m1",
    threadId: "h1",
    internalDate: "1758000000000",
    snippet: "Os escribo por el pedido 1043, que no ha llegado",
    etiquetas: ["INBOX", "UNREAD"],
    de: "Ana Ruiz <ana@clienta.com>",
    para: "yo@miempresa.com",
    asunto: "Pedido 1043 sin llegar",
    // Anidado a propósito: el texto plano está dos niveles abajo, debajo de un
    // HTML. Es como llega un correo de verdad, y donde se cae un lector ingenuo.
    payload: {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/html", body: { data: b64("<p>Da igual lo que ponga el HTML</p>") } },
            { mimeType: "text/plain", body: { data: b64("Buenos días:\n\nEl pedido 1043 no ha llegado y ya van diez días.\n\nAna") } },
          ],
        },
      ],
    },
  },
  {
    id: "m2",
    threadId: "h2",
    internalDate: "1758100000000",
    snippet: "Factura de septiembre adjunta",
    etiquetas: ["INBOX"],
    de: "Facturación <facturas@proveedor.com>",
    para: "yo@miempresa.com",
    asunto: "Factura de septiembre",
    payload: { mimeType: "text/plain", body: { data: b64("Adjunto la factura de septiembre.") } },
  },
  {
    id: "m3",
    threadId: "h3",
    internalDate: "1758200000000",
    snippet: "Reunión del martes",
    etiquetas: ["INBOX", "UNREAD"],
    de: "Ana Ruiz <ana@clienta.com>",
    para: "yo@miempresa.com",
    asunto: "Reunión del martes",
    payload: { mimeType: "text/plain", body: { data: b64("¿Te va bien el martes a las diez?") } },
  },
];

function conCabeceras(m, completo) {
  const headers = [
    { name: "From", value: m.de },
    { name: "To", value: m.para },
    { name: "Subject", value: m.asunto },
    { name: "Date", value: new Date(Number(m.internalDate)).toUTCString() },
  ];
  return {
    id: m.id,
    threadId: m.threadId,
    snippet: m.snippet,
    internalDate: m.internalDate,
    payload: completo ? { ...m.payload, headers } : { headers },
  };
}

/**
 * El servidor.
 *
 * `estado` deja mirar desde fuera qué ha pasado: qué se ha enviado, con qué
 * testigo se ha llamado y cuántas veces se ha refrescado. Sin eso, "se ha
 * enviado el correo" sería otra vez una promesa en vez de una comprobación.
 */
export function crear() {
  const estado = {
    /** Los testigos de acceso que ahora mismo valen. */
    vigentes: new Set(),
    /** Cuántas veces se ha canjeado el código y cuántas se ha refrescado. */
    canjes: 0,
    refrescos: 0,
    /** Lo que se ha mandado de verdad, crudo y ya descifrado. */
    enviados: [],
    /** El último testigo con el que alguien ha llamado a Gmail. */
    ultimoTestigo: "",
    /** Lo que se le ha pedido al endpoint de testigos, para poder mirarlo. */
    peticiones: [],
    /** Si se pone, el siguiente canje falla con este error. */
    fallarCanje: "",
    /**
     * Cuánto dura el testigo que da el canje.
     *
     * Bajarlo es la única forma de comprobar el refresco con la aplicación
     * levantada: un testigo que nace caducado obliga a renovarlo en la primera
     * llamada, que es justo el camino que hay que probar.
     */
    duracionCanje: 3600,
    /** Y cuánto dura el que da el refresco, por el mismo motivo. */
    duracionRefresco: 3600,
  };

  let n = 0;
  const nuevoAcceso = () => {
    const t = `acc-${++n}`;
    estado.vigentes.add(t);
    return t;
  };

  const servidor = createServer((req, res) => {
    let crudo = "";
    req.on("data", (d) => (crudo += d));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const json = (estadoHttp, cuerpo) => {
        res.writeHead(estadoHttp, { "content-type": "application/json" });
        res.end(JSON.stringify(cuerpo));
      };

      /* ------------------------- Los testigos ------------------------- */
      if (url.pathname === "/oauth/token") {
        const p = new URLSearchParams(crudo);
        estado.peticiones.push(Object.fromEntries(p));

        if (p.get("client_id") !== ESPERADO.ID || p.get("client_secret") !== ESPERADO.SECRETO)
          return json(401, { error: "invalid_client", error_description: "Cliente desconocido." });

        if (p.get("grant_type") === "authorization_code") {
          if (estado.fallarCanje)
            return json(400, { error: "invalid_grant", error_description: estado.fallarCanje });
          if (p.get("code") !== ESPERADO.CODIGO)
            return json(400, { error: "invalid_grant", error_description: "El código no vale." });
          estado.canjes++;
          return json(200, {
            access_token: nuevoAcceso(),
            refresh_token: "ref-1",
            expires_in: estado.duracionCanje,
            token_type: "Bearer",
          });
        }

        if (p.get("grant_type") === "refresh_token") {
          if (p.get("refresh_token") !== "ref-1")
            return json(400, { error: "invalid_grant", error_description: "Ese refresco no vale." });
          estado.refrescos++;
          // Google NO devuelve refresh_token al refrescar. Esto es exactamente
          // lo que rompía la conexión a la hora si se machacaba el que había.
          return json(200, {
            access_token: nuevoAcceso(),
            expires_in: estado.duracionRefresco,
            token_type: "Bearer",
          });
        }

        return json(400, { error: "unsupported_grant_type" });
      }

      /* --------------------------- Gmail ------------------------------ */
      if (url.pathname.startsWith("/gmail/v1/users/me")) {
        const testigo = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
        estado.ultimoTestigo = testigo;
        if (!estado.vigentes.has(testigo))
          return json(401, { error: { code: 401, message: "Invalid Credentials" } });

        const camino = url.pathname.slice("/gmail/v1/users/me".length);

        if (camino === "/profile")
          return json(200, { emailAddress: "yo@miempresa.com", messagesTotal: BUZON.length });

        if (camino === "/messages/send") {
          const cuerpo = JSON.parse(crudo || "{}");
          const texto = Buffer.from(cuerpo.raw ?? "", "base64url").toString("utf8");
          estado.enviados.push({ crudo: texto, hilo: cuerpo.threadId ?? null });
          return json(200, { id: `enviado-${estado.enviados.length}`, threadId: cuerpo.threadId ?? "h9" });
        }

        if (camino === "/messages") {
          const q = url.searchParams.get("q") ?? "";
          const tope = Number(url.searchParams.get("maxResults") ?? 10);
          let lista = BUZON;
          if (/is:unread/.test(q)) lista = lista.filter((m) => m.etiquetas.includes("UNREAD"));
          const from = /from:(\S+)/.exec(q);
          if (from) lista = lista.filter((m) => m.de.includes(from[1]));
          return json(200, {
            messages: lista.slice(0, tope).map((m) => ({ id: m.id, threadId: m.threadId })),
            resultSizeEstimate: lista.length,
          });
        }

        const uno = /^\/messages\/([^/]+)$/.exec(camino);
        if (uno) {
          const m = BUZON.find((x) => x.id === uno[1]);
          if (!m) return json(404, { error: { code: 404, message: "Not Found" } });
          return json(200, conCabeceras(m, url.searchParams.get("format") === "full"));
        }
      }

      json(404, { error: { message: `sin ruta: ${url.pathname}` } });
    });
  });

  return { servidor, estado, BUZON };
}
