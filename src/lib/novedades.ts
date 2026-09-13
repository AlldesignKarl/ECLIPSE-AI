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
    version: "2.7",
    // El primer contacto: el instante en que la luna toca el sol y empieza el
    // eclipse. Aquí, que ECLIPSE CODE deje de quedarse a medias.
    nombre: "Contacto",
    titulo: "Se acabó el bucle de errores",
    entrada:
      "El error en una línea que no existe, el botón de arreglar que no arreglaba nunca y el archivo que se cortaba: eran todo lo mismo, y ya está resuelto.",
    puntos: [
      "ECLIPSE tiene ahora el doble de espacio para escribir. Las instrucciones que no hacen falta para lo que le pides ya no viajan: una escena 3D no carga las reglas de diseño web, y una página web no carga el manual de 3D.",
      "Un archivo que se cortó a medias ya no se ofrece para verlo. Antes daba un error de sintaxis en la última línea escrita, pulsabas arreglar, se volvía a cortar por el mismo sitio, y así sin fin.",
      "Y cuando sí hay un error de verdad, el botón le manda las líneas de código donde está, no solo el número. Va directo en vez de buscar a ciegas.",
      "Las figuras en 3D dejan de ser una caja con una esfera encima: hay reglas de cómo se modela un animal o un coche de verdad, con sus piezas, sus proporciones y su luz.",
    ],
  },
  {
    version: "2.6",
    // La totalidad: el rato en que la luna tapa el sol del todo y se ve la
    // corona entera. Aquí, todo lo que se puede hacer en 3D y estaba escondido.
    nombre: "Totalidad",
    titulo: "3D de verdad, no solo cubos girando",
    entrada:
      "ECLIPSE ya podía hacer mucho más en 3D de lo que hacía: simplemente no sabía que lo tenía. Ahora sí.",
    puntos: [
      "Texto en 3D, brillos y resplandores, sombras, niebla, materiales que emiten luz, bordes redondeados, miles de objetos a la vez y física real.",
      "Texturas dibujadas al momento: cuadros, vetas, degradados, lo que haga falta, sin depender de ninguna imagen de fuera.",
      "Las piezas que se mueven ya se llevan su orientación consigo. Antes cambiaban de sitio pero no de giro, y el cubo salía lleno de manchas negras.",
      "Y antes de entregar una escena repasa cinco cosas —fondo, luces, cámara, tamaño y piezas— que no se ven leyendo el código pero estropean el resultado entero.",
    ],
  },
  {
    version: "2.5",
    // Las perlas de Baily: los últimos puntos de luz que quedan colándose por
    // los valles de la luna. Los detalles pequeños que se veían mal.
    nombre: "Baily",
    titulo: "Más conversación, menos tirones",
    entrada:
      "Tres cosas que molestaban cada día: las conversaciones se cortaban pronto, el móvil se atascaba y los errores señalaban una línea que no existía.",
    puntos: [
      "Las conversaciones duran mucho más. Cuando ya no cabe todo, ECLIPSE suelta lo más antiguo y sigue, en vez de pedirte que empieces de cero.",
      "Y pide de entrada lo que cabe: antes gastaba un viaje entero en descubrir el límite en cada mensaje.",
      "El móvil ya no se atasca con varios proyectos abiertos: la vista previa se para cuando la dejas de ver y arranca sola al volver.",
      "Los errores del código señalan la línea de tu archivo. Antes contaban también lo que ECLIPSE añade por dentro y decían \"línea 218\" de un archivo de 184.",
    ],
  },
  {
    version: "2.4",
    // El anillo de diamante: el destello del segundo justo antes de que la luna
    // tape el sol del todo. Va de que las escenas 3D por fin se vean.
    nombre: "Diamante",
    titulo: "Las escenas 3D salen como tienen que salir",
    entrada:
      "Pedías un cubo de Rubik y salía un bloque negro con pinchos. Ya no: ECLIPSE sabe ahora qué es lo que lo rompía y, si aun así sale mal, te avisa.",
    puntos: [
      "Luces y fondo siempre. Un material sin luz sale negro entero, y eso era lo que pasaba: el cubo tenía sus colores puestos, pero no había con qué verlos.",
      "Los colores van en las caras del propio cubo, no en placas pegadas encima. Esas placas eran los pinchos que asomaban por los bordes.",
      "Y cuando las caras giran para resolverse, el cubo aguanta entero: cada pieza vuelve a su casilla exacta después de cada giro, en vez de ir descuadrándose hasta romperse.",
      "Si una escena sale de un solo color, la vista previa te lo dice y puedes pedirle que lo arregle en un toque, en vez de quedarte mirando un cuadro negro.",
      "Y para programar elige siempre el modelo más grande que tenga tu cuenta: uno pequeño responde rápido, pero entrega escenas a medias.",
    ],
  },
  {
    version: "2.3",
    // La penumbra es la sombra de fuera, la que deja pasar parte de la luz:
    // aquí es justo eso, dejar pasar solo lo que hace falta de lo hablado.
    nombre: "Penumbra",
    titulo: "Conversaciones largas que no se atascan",
    entrada:
      "Podías pedirle tres o cuatro proyectos seguidos y al quinto se paraba. Ya no: ahora se lleva de la conversación solo lo que necesita.",
    puntos: [
      "En ECLIPSE CODE ya no arrastra los archivos de todas las versiones anteriores, así que le queda mucho más sitio para escribir el nuevo entero.",
      "Si la petición se pasa del cupo del minuto, recorta lo justo y lo reintenta sola, sin enseñarte un error.",
      "Y cuando de verdad no cabe, te lo dice en cristiano y te propone qué hacer, en vez de soltarte el error en inglés del proveedor.",
    ],
  },
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
