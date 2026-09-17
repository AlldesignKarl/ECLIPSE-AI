import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * El logotipo de la marca, si está puesto.
 * ---------------------------------------------------------------------------
 * Se busca el archivo en `public/` en vez de escribir su ruta en el código, y
 * es a propósito: poner el logo tiene que ser arrastrar un archivo a una
 * carpeta, no editar un componente. En cuanto exista `public/logo.svg` (o .png,
 * .webp, .jpg) aparece en la cabecera y en el pie; mientras no exista, se pinta
 * el sello con el monograma y no se rompe nada.
 *
 * El SVG va primero porque es el que se ve nítido en cualquier tamaño y en
 * pantallas de mucha densidad, que es donde un PNG pequeño se nota borroso.
 *
 * Esto usa el disco, así que solo puede llamarse desde el servidor. Lo hace el
 * `layout` una vez y reparte la ruta como propiedad.
 */
const CANDIDATOS = ["logo.svg", "logo.png", "logo.webp", "logo.jpg"];

export function rutaDelLogo(): string | null {
  for (const nombre of CANDIDATOS) {
    if (existsSync(join(process.cwd(), "public", nombre))) return `/${nombre}`;
  }
  return null;
}
