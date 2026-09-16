/**
 * Los dos números que comparten el grabador y el montaje.
 *
 * Están aquí y no en `renderizar.mjs` por una razón que costó un render entero:
 * importar un módulo lo EJECUTA, y `renderizar.mjs` borra la carpeta de
 * fotogramas nada más arrancar. El montaje solo quería leer dos constantes y se
 * llevó por delante veinte minutos de trabajo.
 */

/** Los fotogramas por segundo del vídeo final. */
export const FPS = 30;

/**
 * Cuántas capturas se hacen por cada fotograma final.
 *
 * Con 2, se graba a 60 y el montaje promedia cada dos: eso es un obturador de
 * 180°, el desenfoque de movimiento de una cámara de cine. Con 1 no hay
 * desenfoque y los movimientos rápidos saltan; con 3 o 4 se nota poco más y
 * cuesta el doble o el triple de render.
 */
export const SUBMUESTRAS = 2;
