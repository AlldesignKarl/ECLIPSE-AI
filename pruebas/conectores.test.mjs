// Cada conector entero, contra un servidor que habla como su API de verdad:
// que comprueba la clave antes de guardarla, que lee bien, que escribe bien, y
// que una clave mala se rechaza en vez de guardarse.
import { crear, ESPERADO, escrituras } from "./apis-falsas.mjs";
import { SRC, crearJiti, enSrc } from "./entorno.mjs";

const servidor = crear();
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${servidor.address().port}`;
for (const id of ["SHOPIFY", "WOOCOMMERCE", "WIX", "IONOS", "MERCADOS", "NOTION", "GITHUB"])
  process.env[`CONEXION_BASE_${id}`] = base;

const jiti = await crearJiti(import.meta.url, { alias: { "@": SRC }, moduleCache: false });
const { shopify } = await jiti.import(enSrc("lib/conexiones/shopify.ts"));
const { woocommerce } = await jiti.import(enSrc("lib/conexiones/woocommerce.ts"));
const { wix } = await jiti.import(enSrc("lib/conexiones/wix.ts"));
const { ionos } = await jiti.import(enSrc("lib/conexiones/ionos.ts"));
const { mercados } = await jiti.import(enSrc("lib/conexiones/mercados.ts"));
const { notion } = await jiti.import(enSrc("lib/conexiones/notion.ts"));
const { github } = await jiti.import(enSrc("lib/conexiones/github.ts"));

const fallos = [];
const ok = (cond, que) => {
  console.log(`  ${cond ? "✓" : "✗"} ${que}`);
  if (!cond) fallos.push(que);
};

const correr = async (servicio, cred, accion, args = {}) => {
  const a = servicio.acciones.find((x) => x.nombre === accion);
  if (!a) throw new Error(`${servicio.id} no tiene la acción ${accion}`);
  return a.ejecutar({ cred, args });
};

/* ------------------------------- Shopify ------------------------------- */
console.log("\nShopify");
const credShopify = { tienda: "mitienda.myshopify.com", token: ESPERADO.TOKEN_SHOPIFY };
const vShopify = await shopify.verificar(credShopify);
ok(vShopify.ok && /Mi Tienda/.test(vShopify.cuenta), `verifica y dice a qué tienda (${vShopify.cuenta ?? vShopify.error})`);

const malShopify = await shopify.verificar({ tienda: "mitienda.myshopify.com", token: "shpat_falso" });
ok(!malShopify.ok, "rechaza un token que no vale");
ok(malShopify.ok === false && /clave/i.test(malShopify.error), `y lo dice en cristiano: "${malShopify.error?.slice(0, 60)}…"`);

const prods = await correr(shopify, credShopify, "listar_productos");
ok(/Camiseta importada/.test(prods) && /19\.90/.test(prods), "lista productos con precio");
ok(/stock 40/.test(prods), "y con su stock");

const buscados = await correr(shopify, credShopify, "listar_productos", { buscar: "taza" });
ok(/Taza/.test(buscados) && !/Camiseta/.test(buscados), "filtra por texto");

const ficha = await correr(shopify, credShopify, "ver_producto", { id: "1" });
ok(/Título SEO: Camiseta \| Mi Tienda/.test(ficha), "la ficha trae el título SEO de verdad");
ok(/Descripción SEO: \(vacía/.test(ficha), "y avisa de que la descripción SEO está vacía");
ok(/High quality t-shirt/.test(ficha) && !/<p>/.test(ficha), "la descripción llega sin etiquetas HTML");

const ped = await correr(shopify, credShopify, "listar_pedidos");
ok(/#1001/.test(ped) && /28\.40 EUR en total/.test(ped), "suma los pedidos");

escrituras.length = 0;
const act = await correr(shopify, credShopify, "actualizar_producto", {
  id: "1", titulo: "Camiseta de algodón orgánico", seo_titulo: "Camiseta de algodón | Mi Tienda",
});
const w = escrituras.find((e) => e.servicio === "shopify" && e.tipo === "actualizar");
ok(/actualizado/.test(act), "actualiza y lo cuenta");
ok(w?.cuerpo?.product?.title === "Camiseta de algodón orgánico", "manda el título nuevo");
ok(w?.cuerpo?.product?.metafields?.[0]?.key === "title_tag", "y el SEO donde Shopify lo guarda (metafields)");

const sinNada = await correr(shopify, credShopify, "actualizar_producto", { id: "1" });
ok(/al menos un campo/.test(sinNada), "no manda una petición vacía si no se dice qué cambiar");

escrituras.length = 0;
await correr(shopify, credShopify, "crear_producto", { titulo: "Producto nuevo", precio: "9,99" });
const creado = escrituras.find((e) => e.tipo === "crear");
ok(creado?.cuerpo?.product?.status === "draft", "un producto nuevo nace como BORRADOR, no publicado");
ok(creado?.cuerpo?.product?.variants?.[0]?.price === "9.99", "y la coma del precio se convierte en punto");

/* ----------------------------- WooCommerce ----------------------------- */
console.log("\nWooCommerce");
const credWoo = { sitio: "https://mitienda.com", clave: ESPERADO.CLAVE_WOO, secreto: ESPERADO.SECRETO_WOO };
const vWoo = await woocommerce.verificar(credWoo);
ok(vWoo.ok, `verifica (${vWoo.cuenta ?? vWoo.error})`);
ok(!(await woocommerce.verificar({ ...credWoo, secreto: "cs_malo" })).ok, "rechaza un secreto que no vale");
ok(/Zapatillas/.test(await correr(woocommerce, credWoo, "listar_productos")), "lista productos");
ok(/Running shoes/.test(await correr(woocommerce, credWoo, "ver_producto", { id: "7" })), "abre una ficha");
ok(/49\.00 EUR en total/.test(await correr(woocommerce, credWoo, "listar_pedidos")), "suma los pedidos");

escrituras.length = 0;
await correr(woocommerce, credWoo, "actualizar_producto", { id: "7", nombre: "Zapatillas de running" });
ok(escrituras.at(-1)?.cuerpo?.name === "Zapatillas de running", "actualiza el nombre");

/* --------------------------------- Wix --------------------------------- */
console.log("\nWix");
const credWix = { token: ESPERADO.TOKEN_WIX, sitio: ESPERADO.SITIO_WIX };
const vWix = await wix.verificar(credWix);
ok(vWix.ok && /Mi Web/.test(vWix.cuenta), `verifica y nombra el sitio (${vWix.cuenta ?? vWix.error})`);
ok(!(await wix.verificar({ token: "otro", sitio: ESPERADO.SITIO_WIX })).ok, "rechaza un token que no vale");
ok(!(await wix.verificar({ token: ESPERADO.TOKEN_WIX, sitio: "otro-sitio" })).ok, "y un ID de sitio que no es el suyo");
ok(/Europe\/Madrid/.test(await correr(wix, credWix, "ver_sitio")), "lee los datos del sitio");
ok(/Vela aromática/.test(await correr(wix, credWix, "listar_productos")), "lista los productos de la tienda");
ok(/elegir-vela/.test(await correr(wix, credWix, "listar_entradas_blog")), "lista el blog");

escrituras.length = 0;
await correr(wix, credWix, "actualizar_producto", { id: "p1", descripcion: "Vela de soja, 40 horas." });
ok(escrituras.at(-1)?.cuerpo?.product?.description === "Vela de soja, 40 horas.", "actualiza la descripción");

/* -------------------------------- IONOS -------------------------------- */
console.log("\nIONOS");
const credIonos = { prefijo: "pref", secreto: "secreto" };
const vIonos = await ionos.verificar(credIonos);
ok(vIonos.ok && /mitienda\.com/.test(vIonos.cuenta), `verifica y lista los dominios (${vIonos.cuenta ?? vIonos.error})`);
ok((await ionos.verificar({ prefijo: "", secreto: "pref.secreto" })).ok, "acepta la clave pegada entera, con el punto");
ok(!(await ionos.verificar({ prefijo: "x", secreto: "y" })).ok, "rechaza una clave que no vale");

const dns = await correr(ionos, credIonos, "ver_dns", { dominio: "mitienda.com" });
ok(/A:/.test(dns) && /1\.2\.3\.4/.test(dns), "lee los registros y los agrupa por tipo");
ok(/shops\.myshopify\.com/.test(dns), "incluye el CNAME de la tienda");
ok(/no hay ningún dominio/i.test(await correr(ionos, credIonos, "ver_dns", { dominio: "otro.com" })), "dice que no cuando el dominio no es suyo");

escrituras.length = 0;
const creadoDns = await correr(ionos, credIonos, "crear_registro_dns", {
  dominio: "mitienda.com", tipo: "txt", nombre: "mitienda.com", contenido: "google-site-verification=abc",
});
ok(escrituras.at(-1)?.cuerpo?.[0]?.type === "TXT", "crea el registro, con el tipo en mayúsculas");
ok(escrituras.at(-1)?.cuerpo?.[0]?.ttl === 3600, "y con un TTL razonable por defecto");
ok(/tarda en extenderse/.test(creadoDns), "avisa de que el DNS tarda");

const raro = await correr(ionos, credIonos, "crear_registro_dns", { dominio: "mitienda.com", tipo: "NS", contenido: "x" });
ok(/no se puede crear/.test(raro), "no deja tocar los servidores de nombres");

/* ------------------------------- Binance ------------------------------- */
console.log("\nBinance (solo lectura)");
const credBnb = { clave: ESPERADO.CLAVE_BINANCE, secreto: ESPERADO.SECRETO_BINANCE };
const vBnb = await mercados.verificar(credBnb);
ok(vBnb.ok && /2 moneda/.test(vBnb.cuenta), `verifica con firma y cuenta los saldos (${vBnb.cuenta ?? vBnb.error})`);
ok(!(await mercados.verificar({ clave: ESPERADO.CLAVE_BINANCE, secreto: "otro" })).ok, "una firma mal hecha se rechaza");

const cartera = await correr(mercados, credBnb, "ver_cartera");
ok(/BTC: 0\.05/.test(cartera) && /EUR: 370\.1/.test(cartera), "suma disponible y bloqueado");
ok(!/DOGE/.test(cartera), "y no enseña monedas a cero");
ok(/50 bloqueado/.test(cartera), "avisa de lo que está bloqueado en órdenes");
ok(/BTCEUR/.test(await correr(mercados, credBnb, "ver_ordenes_abiertas")), "lee las órdenes abiertas");
ok(/58000/.test(await correr(mercados, credBnb, "ver_precio", { par: "btc/eur" })), "el par se limpia y se pone en mayúsculas");
const historico = await correr(mercados, credBnb, "ver_historico", { par: "BTCEUR", limite: 5 });
ok(/5 periodos/.test(historico) && /\+8\.00%/.test(historico), "calcula la variación del tramo");

// La línea que no se cruza.
ok(!mercados.acciones.some((a) => a.escribe), "NINGUNA acción de mercados escribe");
ok(!mercados.acciones.some((a) => /compr|vend|orden_|cancel/.test(a.nombre)), "y ninguna se parece a poner una orden");

/* ------------------------------- Notion -------------------------------- */
console.log("\nNotion");
const credNotion = { token: ESPERADO.TOKEN_NOTION };
const vNotion = await notion.verificar(credNotion);
ok(vNotion.ok && /Mi espacio/.test(vNotion.cuenta), `verifica y dice el espacio (${vNotion.cuenta ?? vNotion.error})`);
ok(/ve 2 p[áa]gina/.test(vNotion.cuenta ?? ""), "y cuántas páginas VE de verdad, que es lo que falla siempre");
ok(!(await notion.verificar({ token: "ntn_malo" })).ok, "rechaza un secreto que no vale");

const busqueda = await correr(notion, credNotion, "buscar", {});
ok(/Ideas de v[íi]deos/.test(busqueda) && /\[base\] Clientes/.test(busqueda), "busca páginas y bases, y distingue cuál es cuál");
const pagina = await correr(notion, credNotion, "leer_pagina", { id: "pag-1" });
ok(/# Ideas/.test(pagina) && /- \[ \] Grabar el unboxing/.test(pagina), "lee la página con sus encabezados y sus tareas");
const filasNotion = await correr(notion, credNotion, "consultar_base", { id: "bd-1" });
ok(/Panader[íi]a Ruiz/.test(filasNotion) && /Activo/.test(filasNotion), "lee las filas de una base con sus campos");

escrituras.length = 0;
await correr(notion, credNotion, "escribir_en_pagina", { id: "pag-1", texto: "Una idea\nY otra" });
const enNotion = escrituras.at(-1)?.cuerpo?.children ?? [];
ok(enNotion.length === 2, `escribe una línea por párrafo (${enNotion.length})`);
ok(enNotion[0]?.paragraph?.rich_text?.[0]?.text?.content === "Una idea", "y con el texto que toca");

/* ------------------------------- GitHub -------------------------------- */
console.log("\nGitHub");
const credGh = { token: ESPERADO.TOKEN_GITHUB };
const vGh = await github.verificar(credGh);
ok(vGh.ok && /alldesignkarl/.test(vGh.cuenta), `verifica y dice de quién es (${vGh.cuenta ?? vGh.error})`);
ok(!(await github.verificar({ token: "ghp_malo" })).ok, "rechaza un token que no vale");
ok(/eclipse-ai.*privado/s.test(await correr(github, credGh, "listar_repos")), "lista los repositorios y marca los privados");
ok(/\[carpeta\] src/.test(await correr(github, credGh, "ver_archivos", { repo: "alldesignkarl/eclipse-ai" })), "ve lo que hay dentro");
ok(/# ECLIPSE/.test(await correr(github, credGh, "leer_archivo", { repo: "https://github.com/alldesignkarl/eclipse-ai", ruta: "README.md" })), "lee un archivo, y acepta la URL entera del repo");

const incidencias = await correr(github, credGh, "listar_incidencias", { repo: "alldesignkarl/eclipse-ai" });
ok(/#7 · La foto no se ve/.test(incidencias), "lista las incidencias");
ok(!/#8/.test(incidencias), "y deja fuera los pull requests, que GitHub mete en el mismo saco");

escrituras.length = 0;
const abierta = await correr(github, credGh, "abrir_incidencia", { repo: "alldesignkarl/eclipse-ai", titulo: "Probando" });
ok(escrituras.at(-1)?.cuerpo?.title === "Probando", "abre una incidencia con su título");
ok(/#9/.test(abierta), "y devuelve el número para poder seguirla");

// GitHub no toca el código de nadie.
ok(!github.acciones.some((a) => /escribir_archivo|commit|push|rama|branch/.test(a.nombre)), "ninguna acción escribe en el código");

servidor.close();
console.log("\n" + (fallos.length ? `FALLOS (${fallos.length}):\n- ` + fallos.join("\n- ") : "TODO CORRECTO"));
process.exit(fallos.length ? 1 : 0);
