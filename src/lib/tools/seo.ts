import type { Herramienta } from "./tipos";

/**
 * Auditar una página como la ve Google.
 *
 * El SEO tiene fama de humo, y la parte que lo es no se arregla con una
 * herramienta. Pero debajo del humo hay una lista de cosas concretas que o
 * están o no están —el título, la descripción, un solo H1, las imágenes con
 * texto alternativo, la etiqueta canónica, el sitemap— y que en la mayoría de
 * las webs pequeñas no están. Eso sí se puede mirar, y mirarlo es lo que
 * convierte "mejórame el SEO" en una lista de cosas que hacer esta tarde.
 *
 * No hace falta conectar nada: se lee la página como la leería cualquiera.
 */

const LIMITE = 15_000;
const TIEMPO = 15_000;

function etiqueta(html: string, expresion: RegExp): string {
  return (html.match(expresion)?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function todas(html: string, expresion: RegExp): string[] {
  return [...html.matchAll(expresion)].map((m) => (m[1] ?? "").replace(/\s+/g, " ").trim());
}

function meta(html: string, nombre: string): string {
  const porNombre = new RegExp(
    `<meta[^>]+name=["']${nombre}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const alReves = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${nombre}["']`,
    "i",
  );
  return etiqueta(html, porNombre) || etiqueta(html, alReves);
}

function propiedad(html: string, nombre: string): string {
  const p = new RegExp(`<meta[^>]+property=["']${nombre}["'][^>]+content=["']([^"']*)["']`, "i");
  const alReves = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${nombre}["']`,
    "i",
  );
  return etiqueta(html, p) || etiqueta(html, alReves);
}

/** Qué se dice de un título o una descripción según lo que mide. */
function juicio(que: string, valor: string, min: number, max: number): string {
  if (!valor) return `❌ ${que}: NO HAY. Es lo primero que lee Google y lo que se ve en el buscador.`;
  const n = valor.length;
  if (n < min) return `⚠️ ${que} (${n} caracteres, se queda corto): «${valor}»`;
  if (n > max) return `⚠️ ${que} (${n} caracteres, Google lo cortará): «${valor}»`;
  return `✅ ${que} (${n}): «${valor}»`;
}

async function traer(url: string, signal?: AbortSignal): Promise<{ estado: number; cuerpo: string }> {
  const reloj = AbortSignal.timeout(TIEMPO);
  const res = await fetch(url, {
    redirect: "follow",
    signal: signal ? AbortSignal.any([signal, reloj]) : reloj,
    headers: { "User-Agent": "ECLIPSE-SEO/1.0 (+https://eclipse-ia.vercel.app)" },
  });
  const cuerpo = (await res.text()).slice(0, 400_000);
  return { estado: res.status, cuerpo };
}

export const herramientaSeo: Herramienta = {
  nombre: "auditar_seo",
  descripcion:
    "Mira una página web como la ve Google y devuelve qué está bien y qué falta: título, descripción, encabezados, imágenes sin texto alternativo, canónica, datos para redes sociales, robots.txt y sitemap. Úsala SIEMPRE antes de dar consejos de SEO sobre una web concreta: sin mirarla, los consejos son genéricos y no valen nada.",
  parametros: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "La dirección completa de la página, con https://",
      },
    },
    required: ["url"],
  },
  soloPro: true,
  disponible: () => true,

  async ejecutar(args, ctx) {
    const crudo = typeof args.url === "string" ? args.url.trim() : "";
    if (!crudo) return { texto: "", error: "Falta la dirección de la página." };

    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`);
    } catch {
      return { texto: "", error: `«${crudo}» no es una dirección válida.` };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:")
      return { texto: "", error: "Solo se pueden auditar direcciones http o https." };

    ctx.avisar?.(`Mirando ${url.hostname}`);

    let pagina: { estado: number; cuerpo: string };
    try {
      pagina = await traer(url.href, ctx.signal);
    } catch (err) {
      if ((err as Error)?.name === "AbortError" && ctx.signal?.aborted) throw err;
      return {
        texto: "",
        error: `No se ha podido abrir ${url.href}. Puede estar caída, o tardar demasiado en responder.`,
      };
    }

    if (pagina.estado >= 400)
      return {
        texto: "",
        error: `${url.href} responde con un error ${pagina.estado}. Google tampoco puede leerla, así que eso es lo primero que hay que arreglar.`,
      };

    const html = pagina.cuerpo;
    const titulo = etiqueta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const descripcion = meta(html, "description");
    const robots = meta(html, "robots");
    const canonica = etiqueta(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
    const h1 = todas(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((t) => t.replace(/<[^>]+>/g, ""));
    const h2 = todas(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map((t) => t.replace(/<[^>]+>/g, ""));
    const imagenes = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const sinAlt = imagenes.filter((i) => !/\balt\s*=\s*["'][^"']+["']/i.test(i));
    const lang = etiqueta(html, /<html[^>]+lang=["']([^"']*)["']/i);
    const ogTitulo = propiedad(html, "og:title");
    const ogImagen = propiedad(html, "og:image");
    const datos = /application\/ld\+json/i.test(html);
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const palabras = visible ? visible.split(" ").length : 0;

    // robots.txt y sitemap: dos peticiones más y responden a media auditoría.
    const raiz = `${url.protocol}//${url.host}`;
    const [txt, mapa] = await Promise.all([
      traer(`${raiz}/robots.txt`, ctx.signal).catch(() => null),
      traer(`${raiz}/sitemap.xml`, ctx.signal).catch(() => null),
    ]);
    const hayTxt = txt && txt.estado < 400;
    const bloquea = hayTxt && /^\s*Disallow:\s*\/\s*$/im.test(txt.cuerpo);
    const hayMapa = mapa && mapa.estado < 400 && /<(urlset|sitemapindex)/i.test(mapa.cuerpo);
    const urlsMapa = hayMapa ? (mapa.cuerpo.match(/<loc>/gi) ?? []).length : 0;

    const lineas = [
      `Auditoría de ${url.href}`,
      "",
      juicio("Título", titulo, 30, 60),
      juicio("Descripción", descripcion, 70, 160),
      "",
      h1.length === 1
        ? `✅ Un solo H1: «${h1[0].slice(0, 120)}»`
        : h1.length === 0
          ? "❌ No hay H1. Es el titular de la página: sin él, Google adivina de qué va."
          : `⚠️ Hay ${h1.length} H1 (${h1.map((t) => t.slice(0, 40)).join(" / ")}). Debería haber uno solo.`,
      h2.length
        ? `✅ ${h2.length} subtítulo(s) H2: ${h2.slice(0, 6).map((t) => t.slice(0, 40)).join(" · ")}`
        : "⚠️ No hay ningún H2. Una página sin subtítulos se lee peor y se posiciona peor.",
      "",
      imagenes.length === 0
        ? "— No hay imágenes."
        : sinAlt.length === 0
          ? `✅ Las ${imagenes.length} imágenes tienen texto alternativo.`
          : `⚠️ ${sinAlt.length} de ${imagenes.length} imágenes sin texto alternativo (alt). Google no ve las fotos: lee ese texto.`,
      canonica ? `✅ Canónica: ${canonica}` : "⚠️ Sin etiqueta canónica: si la página se puede abrir por varias direcciones, Google reparte la fuerza entre todas.",
      lang ? `✅ Idioma declarado: ${lang}` : "⚠️ El <html> no dice en qué idioma está.",
      robots
        ? /noindex/i.test(robots)
          ? `❌ La página lleva «noindex»: le está diciendo a Google que NO la incluya. Si no es a propósito, es el fallo más grave de la lista.`
          : `✅ Meta robots: ${robots}`
        : "— Sin meta robots (normal: por defecto se indexa).",
      "",
      ogTitulo || ogImagen
        ? `✅ Tarjeta para redes sociales: ${ogTitulo ? `título «${ogTitulo.slice(0, 80)}»` : "sin título"}${ogImagen ? ", con imagen" : ", SIN imagen"}`
        : "⚠️ Sin datos Open Graph: al compartirla en WhatsApp o en redes sale sin foto ni titular.",
      datos
        ? "✅ Tiene datos estructurados (JSON-LD): es lo que permite salir con estrellas, precio o preguntas en el buscador."
        : "⚠️ Sin datos estructurados. Para una ficha de producto o un negocio local, es de lo que más se nota.",
      `${palabras < 250 ? "⚠️" : "✅"} ${palabras} palabras de texto visible${palabras < 250 ? " (poco: a Google le cuesta entender de qué va una página tan corta)" : ""}.`,
      "",
      !hayTxt
        ? "⚠️ No hay robots.txt."
        : bloquea
          ? "❌ El robots.txt bloquea el sitio entero (Disallow: /). Google no puede entrar a ninguna página."
          : "✅ robots.txt correcto.",
      hayMapa
        ? `✅ Sitemap con ${urlsMapa} dirección(es).`
        : "⚠️ No hay sitemap.xml en la raíz. Sin él, Google descubre las páginas a su ritmo.",
    ];

    return { texto: lineas.join("\n") };
  },
};
