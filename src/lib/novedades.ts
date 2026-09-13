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
  /**
   * El nombre de la actualización. Un número no se recuerda ni se cuenta; un
   * nombre sí. Van todos del mismo sitio —las partes de un eclipse— para que
   * se note que pertenecen a la misma familia.
   */
  nombre: string;
  /** El titular, lo que se lee en grande. */
  titulo: string;
  /** De qué va, en una frase. */
  entrada: string;
  /** Dos o tres cosas, en lenguaje de persona y no de programador. */
  puntos: string[];
}

export const NOVEDADES: Novedad[] = [
  {
    version: "2.2",
    // La corona es el anillo de luz que solo se ve cuando hay eclipse: lo que
    // estaba ahí todo el rato y por fin se puede mirar.
    nombre: "Corona",
    titulo: "ECLIPSE CODE construye de verdad",
    entrada:
      "Le pides algo y te lo entrega funcionando: no un ejemplo para copiar, sino el proyecto hecho, con su vista previa y su descarga.",
    puntos: [
      "Páginas, herramientas, juegos, animaciones y bots. Escritos enteros, no a medias.",
      "Elige solo el mejor modelo que tenga tu cuenta para programar, y escribe con cuatro veces más espacio: páginas completas, con su carta, sus precios y sus horarios.",
      "Lo ves funcionando antes de descargarlo. Las escenas 3D se giran con el dedo y las animaciones se mueven.",
      "Si algo falla te dice qué: si no cargó una librería, si el código dio error o si no se pintó nada.",
      "Le pides un cambio y cambia eso, conservando el resto. Y lo que tú digas manda sobre su criterio de diseño.",
    ],
  },
  {
    version: "2.1",
    nombre: "Halo",
    entrada: "Crear imágenes deja de ser un modo aparte y pasa a ser algo que ECLIPSE hace cuando se lo pides.",
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
    nombre: "Umbra",
    entrada: "ECLIPSE deja de solo escribir y empieza a hacer cosas por su cuenta.",
    titulo: "ECLIPSE aprende a usar herramientas",
    puntos: [
      "Busca en internet de verdad y te enseña las fuentes ordenadas por fiabilidad.",
      "Escribe archivos descargables: texto, Markdown, CSV y JSON.",
      "ECLIPSE CODE, en el menú, construye proyectos de programación enteros.",
    ],
  },
];

export const VERSION = NOVEDADES[0].version;
