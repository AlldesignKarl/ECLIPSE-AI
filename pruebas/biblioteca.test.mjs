// La biblioteca. Ni Commons ni el museo se pueden alcanzar desde aquí, así que
// se prueba contra servidores que hablan como ellos: el trabajo de verdad está
// en leer su respuesta sin fiarse de su forma, y —desde que Openverse empezó a
// contestar 401— en que la pantalla NO se quede en blanco porque uno falle.
import { createServer } from "node:http";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const pedidas = [];
let commons = "bien";
let artic = "bien";

const s = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  pedidas.push(u);
  const responder = (estado, cuerpo) => {
    res.writeHead(estado, { "content-type": "application/json" });
    res.end(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo));
  };

  /* ------------------------- Wikimedia Commons ------------------------- */
  if (u.pathname === "/w/api.php") {
    if (commons === "401") return responder(401, { error: "sin cuenta" });
    if (commons === "429") return responder(429, { error: "calma" });
    if (commons === "basura") return responder(200, "esto no es json");
    if (commons === "vacio")
      return responder(200, { query: { searchinfo: { totalhits: 0 }, pages: [] } });
    return responder(200, {
      query: {
        searchinfo: { totalhits: 1234 },
        pages: [
          {
            pageid: 7, title: "File:Catedral_de_León 01.jpg",
            imageinfo: [{
              url: "https://upload.example/grande.jpg",
              thumburl: "https://upload.example/mini.jpg",
              descriptionurl: "https://commons.example/File:Catedral",
              width: 4000, height: 3000,
              extmetadata: {
                Artist: { value: '<a href="/wiki/User:Ana" title="Ana">Ana G&oacute;mez &#8211; Jos&#233; Mu&ntilde;oz</a>' },
                LicenseShortName: { value: "CC BY-SA 4.0" },
              },
            }],
          },
          // Por http: no se puede pintar en una página segura.
          { pageid: 8, title: "File:Vieja.jpg", imageinfo: [{ url: "http://inseguro/a.jpg" }] },
          // Sin imageinfo: no es nada.
          { pageid: 9, title: "File:Rota.jpg" },
          // A medias: se completa como se pueda, no se tira.
          { pageid: 10, title: "File:Media.jpg", imageinfo: [{ url: "https://upload.example/b.jpg" }] },
        ],
      },
    });
  }

  /* -------------------- Art Institute of Chicago ----------------------- */
  if (u.pathname === "/api/v1/artworks/search") {
    if (artic === "500") return responder(500, { error: "boom" });
    if (artic === "vacio") return responder(200, { pagination: { total: 0 }, data: [] });
    return responder(200, {
      pagination: { total: 42 },
      config: { iiif_url: "https://iiif.example/2" },
      data: [
        { id: 111, title: "Los bañistas", image_id: "abc", artist_title: "Georges Seurat", date_display: "1884", is_public_domain: true },
        // Con derechos: no se puede prometer que se pueda usar.
        { id: 222, title: "Cuadro moderno", image_id: "def", artist_title: "Alguien", is_public_domain: false },
        // Sin imagen: no hay nada que enseñar.
        { id: 333, title: "Sin foto", image_id: null, is_public_domain: true },
      ],
    });
  }

  /* ---------------------------- Openverse ------------------------------ */
  if (u.pathname === "/v1/auth_tokens/token/")
    return responder(200, { access_token: "vale-de-mentira", expires_in: 3600 });
  if (u.pathname === "/v1/images/") {
    if (req.headers.authorization !== "Bearer vale-de-mentira")
      return responder(401, { detail: "sin credenciales" });
    return responder(200, {
      result_count: 9,
      results: [{
        id: "ov1", title: "Nebulosa", url: "https://ov.example/n.jpg",
        thumbnail: "https://ov.example/n-mini.jpg", creator: "NASA",
        license: "by", license_version: "4.0", source: "flickr",
        foreign_landing_url: "https://flickr.example/n", width: 3000, height: 2000,
      }],
    });
  }

  responder(404, {});
});
await new Promise((r) => s.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${s.address().port}`;
process.env.BIBLIOTECA_BASE_COMMONS = BASE;
process.env.BIBLIOTECA_BASE_ARTIC = BASE;
process.env.BIBLIOTECA_BASE_OPENVERSE = BASE;
delete process.env.OPENVERSE_CLIENT_ID;
delete process.env.OPENVERSE_CLIENT_SECRET;

const cargar = async () => {
  const jiti = await crearJiti(import.meta.url, {
    alias: { "@": SRC },
    moduleCache: false,
  });
  return jiti.import(enSrc("lib/biblioteca.ts"));
};

const fallos = [];
const ok = (cond, que) => { console.log(`  ${cond ? "✓" : "✗"} ${que}`); if (!cond) fallos.push(que); };

try {
  let { buscarImagenes, ESTANTES, estanteDe, ErrorBiblioteca } = await cargar();

  console.log("\nLos estantes");
  ok(ESTANTES.length >= 8, `hay ${ESTANTES.length} estantes`);
  ok(ESTANTES.every((e) => e.id && e.nombre && e.busqueda), "todos con nombre y búsqueda");
  ok(estanteDe("arquitectura")?.nombre === "Arquitectura", "se encuentran por id");
  ok(!estanteDe("inventado"), "y uno inventado no existe");
  ok(estanteDe("arte")?.prefiere === "artic", "el de arte tira del museo, no del archivo de fotos");

  console.log("\nWikimedia Commons, que es el primero");
  const r = await buscarImagenes("catedrales");
  ok(r.fuente === "Wikimedia Commons", `contesta Commons (${r.fuente})`);
  ok(r.total === 1234, `trae el total (${r.total})`);
  ok(r.imagenes.length === 2, `se queda con las que sirven, 2 de 4 (${r.imagenes.length})`);
  const uno = r.imagenes[0];
  ok(uno.titulo === "Catedral de León 01", `el título sale limpio: "${uno.titulo}"`);
  ok(uno.autor === "Ana Gómez – José Muñoz", `y el autor sin etiquetas ni escapes: "${uno.autor}"`);
  ok(uno.licencia === "CC BY-SA 4.0", "con su licencia");
  ok(uno.origen.includes("commons.example"), "y el enlace al original");
  ok(uno.miniatura !== uno.url, "hay miniatura para la cuadrícula");
  ok(r.imagenes.every((i) => i.url.startsWith("https://")), "ninguna por http");
  ok(r.imagenes[1].autor === "Autor desconocido", "a la que le falta el autor se le pone uno");

  const consulta = pedidas.find((p) => p.pathname === "/w/api.php");
  ok(/fileres:>1200/.test(consulta.searchParams.get("gsrsearch")), "solo pide imágenes grandes");
  ok(/filetype:bitmap/.test(consulta.searchParams.get("gsrsearch")), "y solo fotos, ni PDF ni iconos");

  console.log("\nSi Commons se cae, no se ve un error: se ve el museo");
  commons = "401";
  const r2 = await buscarImagenes("retratos");
  ok(r2.fuente === "Art Institute of Chicago", `entra el siguiente archivo (${r2.fuente})`);
  ok(r2.imagenes.length === 1, `y trae obra (${r2.imagenes.length})`);
  ok(r2.imagenes[0].autor.includes("Seurat"), "con su autor y su año");
  ok(/dominio p[úu]blico/i.test(r2.imagenes[0].licencia), "y su licencia");
  ok(r2.imagenes[0].url.startsWith("https://iiif.example/2/abc/"), "la imagen sale del museo");

  console.log("\nLo que no se puede usar no se enseña");
  ok(!r2.imagenes.some((i) => i.titulo === "Cuadro moderno"), "una obra con derechos se descarta");
  ok(!r2.imagenes.some((i) => i.titulo === "Sin foto"), "y una sin imagen también");

  console.log("\nCuando se caen todos");
  commons = "401";
  artic = "500";
  let pete = null;
  try { await buscarImagenes("lo que sea"); } catch (e) { pete = e; }
  ok(pete instanceof ErrorBiblioteca, "se avisa con un error de biblioteca");
  ok(!/401|500/.test(pete?.message ?? ""), `sin números de servidor en la cara (${pete?.message})`);
  ok(/prueba|momento/i.test(pete?.message ?? ""), "y diciendo qué hacer");

  console.log("\nCuando piden calma");
  commons = "429";
  artic = "500";
  pete = null;
  try { await buscarImagenes("lo que sea"); } catch (e) { pete = e; }
  ok(/segundos/i.test(pete?.message ?? ""), `un 429 se explica aparte: "${pete?.message}"`);

  console.log("\nSi nadie tiene nada, no es un fallo");
  commons = "vacio";
  artic = "vacio";
  const vacio = await buscarImagenes("asdkjhasd");
  ok(vacio.imagenes.length === 0, "devuelve cero imágenes");
  ok(vacio.total === 0, "y cero de total, sin reventar");

  console.log("\nUna respuesta que no es JSON no tumba nada");
  commons = "basura";
  artic = "bien";
  const tras = await buscarImagenes("catedrales");
  ok(tras.imagenes.length === 1, "se pasa al siguiente archivo y sigue habiendo imágenes");

  console.log("\nOpenverse solo si hay credenciales");
  commons = "bien";
  ok(pedidas.every((p) => p.pathname !== "/v1/images/"), "sin claves NO se le llama siquiera");

  process.env.OPENVERSE_CLIENT_ID = "id-de-mentira";
  process.env.OPENVERSE_CLIENT_SECRET = "secreto-de-mentira";
  ({ buscarImagenes } = await cargar());
  commons = "401";
  artic = "500";
  const ov = await buscarImagenes("nebulosa");
  ok(ov.fuente === "Openverse", `con claves entra Openverse (${ov.fuente})`);
  ok(ov.imagenes[0].titulo === "Nebulosa", "y trae sus imágenes");
  ok(pedidas.some((p) => p.pathname === "/v1/auth_tokens/token/"), "pidiendo antes su vale de acceso");
} finally {
  s.close();
}

console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
