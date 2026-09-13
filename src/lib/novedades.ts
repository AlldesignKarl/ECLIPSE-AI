/**
 * Qué ha cambiado en ECLIPSE, y desde cuándo.
 *
 * Una aplicación que cambia cada semana sin decirlo hace que la gente no se
 * entere de la mitad de lo que tiene. Esto lo cuenta una vez por versión: se
 * enseña cuando la versión guardada en el móvil no es la de ahora, y no vuelve
 * a salir hasta la siguiente.
 *
 * Para añadir una versión: se pone arriba del todo y se sube VERSION. Nada más.
 */

export interface Novedad {
  version: string;
  /** El titular, lo que se lee en grande. */
  titulo: string;
  /** Dos o tres cosas, en lenguaje de persona y no de programador. */
  puntos: string[];
}

export const NOVEDADES: Novedad[] = [
  {
    version: "2.1",
    titulo: "Imágenes, 3D y animaciones",
    puntos: [
      "Pídele una imagen en la conversación y la crea, sin cambiar de sitio.",
      "Las animaciones y las escenas 3D se ven funcionando y se descargan.",
      "Si una vista previa falla, ahora te dice por qué en vez de quedarse en negro.",
      "Tus mensajes van en azul, y la letra es un punto mayor.",
    ],
  },
  {
    version: "2.0",
    titulo: "ECLIPSE aprende a usar herramientas",
    puntos: [
      "Busca en internet de verdad y te enseña las fuentes ordenadas por fiabilidad.",
      "Escribe archivos descargables: texto, Markdown, CSV y JSON.",
      "ECLIPSE CODE, en el menú, construye proyectos de programación enteros.",
    ],
  },
];

export const VERSION = NOVEDADES[0].version;
