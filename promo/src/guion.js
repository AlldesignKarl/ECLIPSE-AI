/*
  EL GUION DEL ANUNCIO
  ===========================================================================
  Aquí están los tiempos y los textos, y solo eso. Es el archivo que hay que
  tocar para cambiar una frase, alargar una escena o mover un corte: el motor
  (`motor.js`) no tiene ni un texto ni un segundo escrito dentro.

  Los tiempos van en segundos desde el principio. Cambiar `FIN` alarga o acorta
  el vídeo entero, pero si se mueve un tramo hay que mover el siguiente: las
  escenas se solapan a propósito en los cortes, y ahí es donde están las
  transiciones.

  Poco texto, y corto. Esto se ve en un móvil, de paso, y sin sonido la primera
  vez: una frase que no se lee de un vistazo no se lee.
*/

export const FIN = 28.0;

export const T = {
  /* 1 · HOOK ------------------------------------------------------------- */
  luz: [0.0, 1.05],        // la línea de luz que se abre en el negro
  anillo: [0.75, 2.05],    // el eclipse se forma
  nombre: [1.55, 2.35],    // ECLIPSE
  frase1: [2.25, 3.25],    // la frase del principio

  /* 2 · EL PROBLEMA ------------------------------------------------------ */
  papeles: [3.45, 5.15],   // entran las fotos de apuntes
  frase2: [4.25, 5.6],
  tragar: [5.6, 6.8],      // todo se va hacia el centro

  /* 3 · ECLIPSE EN ACCIÓN ------------------------------------------------ */
  telefono: [6.35, 7.55],  // el móvil sube a plano
  paso1: [7.05, 9.15],     // le das tus apuntes
  escaneo: [8.95, 10.35],  // los lee
  paso2: [10.25, 12.35],   // responde con fuentes
  paso3: [12.35, 14.15],   // qué entra

  /* 4 · ESTUDIO INTELIGENTE ---------------------------------------------- */
  paso4: [14.15, 15.75],   // te resume
  paso5: [15.75, 17.35],   // te pregunta
  paso6: [17.35, 18.95],   // te corrige
  paso7: [18.95, 20.55],   // sabe por dónde flojeas

  /* 5 · HERO ------------------------------------------------------------- */
  hero: [20.45, 24.15],
  fraseHero: [21.75, 24.15],

  /* 6 · CIERRE ----------------------------------------------------------- */
  cierre: [23.95, 28.0],
  url: [25.75, 28.0],
};

export const TEXTOS = {
  frase1: "La IA que estudia contigo.",
  frase2: "Demasiado que estudiar.",
  pasos: {
    paso1: "Le das tus apuntes.",
    paso2: "Responde con las fuentes delante.",
    paso3: "Y te dice qué entra.",
    paso4: "Te resume.",
    paso5: "Te pregunta.",
    paso6: "Te corrige.",
    paso7: "Y sabe por dónde flojeas.",
  },
  hero: "Nunca se lo inventa.",
  heroPie: "Solo lo que hay en tus apuntes.",
  nombre: "ECLIPSE",
  cierre: "La IA que estudia contigo.",
  url: "eclipse-ia.vercel.app",
};

/*
  Qué se ve en el móvil en cada paso.

  `zoom` es lo cerca que está la cámara: 1 es el móvil entero dentro del cuadro
  y 1,7 es un primer plano en el que el teléfono se sale por arriba. `y` dice
  qué punto de la pantalla queda centrado, de 0 (arriba) a 1 (abajo).

  Lo importante de hacerlo así: la captura NUNCA se recorta. Se acerca el
  teléfono, como se haría con una cámara de verdad. Recortando la imagen se
  ganaba tamaño de letra y se perdía la primera palabra de cada línea, que es
  exactamente lo que no puede pasar en un anuncio de una aplicación.
*/
export const PANTALLAS = {
  paso1: { imagen: "chat-adjuntos", zoom: 1.0, y: 0.5 },
  paso2: { imagen: "chat-respuesta", zoom: 1.62, y: 0.6 },
  paso3: { imagen: "examen-mapa", zoom: 1.68, y: 0.72 },
  paso4: { imagen: "examen-resumen", zoom: 1.68, y: 0.7 },
  paso5: { imagen: "examen-pregunta", zoom: 1.68, y: 0.68 },
  paso6: { imagen: "examen-acierto", zoom: 1.68, y: 0.7 },
  paso7: { imagen: "examen-progreso", zoom: 1.68, y: 0.66 },
};

/** Las fotos de apuntes que vuelan en la escena del problema. */
export const PAPELES = ["apuntes-tema4", "pizarra-clase", "apuntes-mendel"];
