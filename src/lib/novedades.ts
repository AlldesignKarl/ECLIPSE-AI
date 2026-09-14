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
    version: "2.31",
    // Las fotos viejas dejan de reenviarse en cada mensaje.
    nombre: "Sin repetirse",
    titulo: "Las conversaciones con fotos duran mucho más",
    entrada:
      "Cada foto que mandabas se volvía a enviar entera en todos los mensajes siguientes. Era lo más caro de la conversación y no se veía.",
    puntos: [
      "Una foto del primer mensaje se re-subía y se re-cobraba en el segundo, el tercero y el décimo. Con tres o cuatro fotos, el cupo por minuto se agotaba antes de empezar a escribir.",
      "Ahora solo viajan las fotos de las dos últimas veces que adjuntaste algo. De las demás queda una línea diciendo que existieron, que es lo único que hace falta para no perder el hilo.",
      "Se nota en tres sitios: las conversaciones con fotos duran mucho más, cada mensaje sube menos datos desde el móvil, y con Google ECLIPSE CODE ya no corta el archivo a la cuarta parte.",
    ],
  },
  {
    version: "2.30",
    // Que se lea mientras se escribe.
    nombre: "A su ritmo",
    titulo: "Ahora se le ve escribir",
    entrada:
      "La respuesta ya no aparece de golpe: se escribe a un ritmo que se puede seguir, como cuando alguien te está contestando.",
    puntos: [
      "El texto del motor llega a borbotones —a veces un párrafo entero de una vez— y aparecía como un muro en el que había que buscar por dónde ibas. Ahora se guarda entero según llega y se enseña a su ritmo.",
      "Va más rápido cuanto más se acumula, así que nunca se queda atrás; y en cuanto el motor termina, acelera para no hacerte esperar por una animación.",
      "Si le das a parar, se enseña al momento lo que haya. Y en ECLIPSE CODE va más suelto: ahí lo que miras es la vista previa, no las letras.",
    ],
  },
  {
    version: "2.29",
    // Dejar de dar consejos y meterse dentro a hacerlos.
    nombre: "Conexiones",
    titulo: "Ahora entra en tu tienda y lo hace",
    entrada:
      "Enchufa Shopify, WooCommerce, Wix, IONOS o tu cuenta de Binance, y ECLIPSE deja de contarte lo que habría que hacer para hacerlo. Es del plan Pro.",
    puntos: [
      "Tu tienda: te lista los productos, te abre los pedidos y te reescribe las fichas importadas del proveedor, con su título y su descripción para Google.",
      "Tus dominios: te lee el DNS entero, te dice qué falta y te crea el registro para conectar el dominio con la tienda.",
      "El SEO de cualquier página, mirada de verdad: título, descripción, encabezados, imágenes sin alt, robots.txt y sitemap. Sin auditar, no da consejos.",
      "Tus mercados en solo lectura: te lee la cartera, los precios y las velas, y te los analiza. Órdenes no pone ninguna, y no puede: el permiso ni existe.",
      "Todo empieza mirando y sin tocar. Para que cambie algo hay que darle permiso a propósito, y borrar no puede nunca. Las claves van cifradas y no las ve ni la IA.",
    ],
  },
  {
    version: "2.28",
    // Que te llame por tu nombre y que mire de una vez la foto.
    nombre: "Por tu nombre",
    titulo: "Ahora sabe cómo te llamas",
    entrada:
      "Te pregunta cómo quieres que te llame y te habla de tú, como una persona. Y la excusa de «no puedo ver imágenes» ya no llega a tu pantalla.",
    puntos: [
      "Al crear la cuenta eliges cómo quieres que te llame, y puedes cambiarlo cuando quieras en Ajustes.",
      "Habla más cercano, sin discursos ni «como modelo de lenguaje». Directo igual, pero de persona a persona.",
      "Si un motor empieza a decirte que no puede ver tu foto, ECLIPSE le corta y se la manda a otro que sí la ve. Tú solo ves la respuesta buena.",
      "Con una foto delante contesta siempre el modelo que mejor ve, también en ECLIPSE CODE cuando le pides algo en 3D a partir de una imagen.",
      "La pantalla de inicio, despejada: sin preguntas de ejemplo. Y el logo de la app, más grande.",
    ],
  },
  {
    version: "2.27",
    // Construir en vez de preguntar, y no inventarse lo que no se ve.
    nombre: "Sin preguntas",
    titulo: "Construye en vez de interrogarte",
    entrada:
      "Pedías una iglesia «como sea» y te soltaba treinta preguntas. Y al preguntar por una foto tuya, se inventaba otra. Las dos cosas, fuera.",
    puntos: [
      "En ECLIPSE CODE ya no se pregunta: se construye. Lo que falte lo decide él y te lo dice en una línea al final, para que lo cambies si no era eso.",
      "Con una foto tuya delante ya no puede crear imágenes, salvo que se lo pidas. Antes podía devolverte una foto inventada de Nueva York como si fuera la respuesta a tu pregunta.",
      "Y si se queda enganchado repitiendo la misma frase, se corta solo y te lo dice, en vez de llenar la pantalla mientras esperas.",
    ],
  },
  {
    version: "2.26",
    // Preguntar antes, en vez de intentarlo y fallar.
    nombre: "Antes de mandar",
    titulo: "Las fotos van directas a quien puede verlas",
    entrada:
      "Seguía fallando el primer mensaje después de abrir la app. Ya no lo intenta a ciegas: comprueba quién puede ver la foto y se la manda a ese.",
    puntos: [
      "Antes de enviar nada, ECLIPSE mira qué motor tiene un modelo capaz de ver imágenes, y la foto va directa ahí. Se acabó el viaje perdido y el mensaje de disculpa.",
      "Y distingue «este motor no puede» de «no he podido comprobarlo»: si es lo segundo, lo intenta igual en vez de descartarlo por una consulta que falló.",
    ],
  },
  {
    version: "2.25",
    // El método, no la receta.
    nombre: "Método",
    titulo: "Cualquier cosa en 3D, no solo lo que ya sabía",
    entrada:
      "Hasta ahora sabía hacer bien lo que se le había explicado pieza a pieza. Ahora tiene el método para construir lo que sea.",
    puntos: [
      "Cuatro pasos que valen igual para una vaca, una catedral, un satélite o un pulpo: averigua cómo es, despiézalo, constrúyelo con piezas agrupadas y dale superficie y luz.",
      "Si lo que pides existe de verdad, lo busca antes de empezar: proporciones, materiales, colores. Y ya no busca a medias: con el motor nuevo hay sitio de sobra para enterarse bien.",
      "Con nueve formas básicas se hace cualquier objeto, y las tiene todas a mano: cápsulas, esferas deformadas, cajas redondeadas, cilindros, conos, roscas, piezas de torno, siluetas con grosor y terreno irregular.",
    ],
  },
  {
    version: "2.24",
    // La superficie: lo que separa una bola gris de una luna.
    nombre: "Superficie",
    titulo: "Lunas, planetas y rocas que lo parecen",
    entrada:
      "Pedías la Luna y salía una pelota blanca con bolas negras pegadas. El detalle de una superficie no se hace con más piezas: se dibuja.",
    puntos: [
      "Los cráteres, las vetas de la madera, el poro de una pared: ahora se dibujan sobre la piel del objeto y se usan también como relieve. Sirve igual para un planeta, una roca o un suelo de tierra.",
      "Y para el espacio, su luz: un sol fuerte y todo lo demás casi a oscuras, con estrellas detrás. Una luna sola sobre negro liso parece un botón.",
      "Además, nunca más una respuesta en blanco. Si algo sale mal por el camino, te lo dice; antes podía quedarse callado y parecía que se había colgado.",
    ],
  },
  {
    version: "2.23",
    // Aclarar: nada nuevo, pero ahora se entiende lo que pone.
    nombre: "Aclarado",
    titulo: "El aviso del plan Pro decía lo que no era",
    entrada:
      "En Ajustes salía «Activación del plan Pro · Falta PRO_ACCESS_CODE» con un punto apagado, y parecía que algo estaba roto. No lo estaba.",
    puntos: [
      "Eso no tiene nada que ver con tu plan: es la forma de que OTRAS personas consigan el Pro, con un código o pagándolo.",
      "Ahora lo dice así, y se da por resuelto si el cobro con tarjeta está conectado, que es la otra manera de conseguirlo.",
    ],
  },
  {
    version: "2.22",
    // Mirada: lo que hacía falta para que las fotos se vean a la primera.
    nombre: "Mirada",
    titulo: "Las fotos, a la primera y sin excusas",
    entrada:
      "Mandabas una foto y te decía que cambiaras el motor a Google. Eso ya no existe: si el motor de turno no puede verla, se pasa a otro y ya está.",
    puntos: [
      "Prueba todos los motores que tengas puestos hasta que uno vea la imagen, no solo Google.",
      "Y en el chat ya no contesta un modelo de programar. Con una cuenta de Mistral acababa respondiendo Codestral —que es para completar código en un editor— a preguntas como «¿de dónde son estos edificios?». De ahí venía todo.",
      "Si aun así ninguno pudiera, lo dice en una frase y sigue ayudando, sin mandarte a configurar nada.",
    ],
  },
  {
    version: "2.21",
    // Los seis colores, cada uno en su cara.
    nombre: "Seis caras",
    titulo: "Los colores clásicos son los clásicos",
    entrada:
      "Pedías un cubo de Rubik con los colores de siempre y se los inventaba. Ahora los tiene escritos, uno por cara.",
    puntos: [
      "Blanco contra amarillo, rojo contra naranja, verde contra azul: las parejas de caras opuestas de un cubo de verdad, con los colores oficiales exactos.",
      "Y si le pides otros —negro entero, los de una marca— manda lo que tú digas. Lo de la tabla solo vale para «los clásicos», «los normales» o «los de siempre».",
    ],
  },
  {
    version: "2.20",
    // Afinar: el instrumento ya está, ahora suena como debe.
    nombre: "Afinado",
    titulo: "Todo apuntando al motor nuevo",
    entrada:
      "Con Mistral puesto, el resto se ajusta para aprovecharlo: mejor modelo para programar y más memoria de lo que llevas hecho.",
    puntos: [
      "Para escribir archivos ECLIPSE CODE usa Devstral, que está hecho para eso. Codestral, que es para completar líneas sueltas en un editor, se queda de recambio.",
      "Y ahora recuerda las dos últimas versiones de lo que te ha hecho, no solo la última. Al pedir un cambio ve de dónde viene el archivo, y eso es la diferencia entre corregirlo y rehacerlo entero.",
    ],
  },
  {
    version: "2.19",
    // El mistral: el viento que despeja el cielo del todo.
    nombre: "Mistral",
    titulo: "Un motor nuevo, hecho para programar",
    entrada:
      "Buscando cuál da más margen gratis, gana uno por goleada: Mistral. Sesenta veces más sitio por minuto que el de ahora, y con modelos hechos para programar.",
    puntos: [
      "Medio millón de tokens por minuto frente a los ocho mil de Groq. Ese número es el techo de lo largo que puede salir un archivo, así que se acabaron los cortes.",
      "Trae Codestral y Devstral, que están hechos para escribir código, y ECLIPSE CODE los elige solo.",
      "Es gratis y no pide tarjeta: solo verificar un teléfono. Lo pones en Ajustes como cualquier otra clave.",
      "Y también ve imágenes, con Pixtral, así que sirve para todo: en cuanto haya clave suya pasa a ser el motor de la casa, sin tener que elegir nada.",
      "Y si algún día se agota el cupo de un motor, ECLIPSE se pasa solo al siguiente que tenga clave en vez de quedarse parado.",
    ],
  },
  {
    version: "2.18",
    // Dos soles: uno para conversar y otro para programar.
    nombre: "Dos soles",
    titulo: "ECLIPSE CODE puede tener su propio motor",
    entrada:
      "Programar y conversar no piden lo mismo. Ahora se puede poner un motor distinto para el código, y es lo que más cambia lo largo que sale un archivo.",
    puntos: [
      "En Ajustes, «Motor de ECLIPSE CODE»: eliges cuál de tus motores escribe el código, sin tocar el del chat.",
      "El techo de lo que puede escribir de una vez sube al doble. Con el motor de siempre no cambia nada —manda su cupo por minuto—, pero con uno que tenga más margen, el archivo sale entero de una tacada.",
      "Y las cuentas del cupo ahora son por modelo, no por motor. Cada modelo tiene el suyo y no se parecen: mezclarlos hacía que el hueco para escribir se calculara mal.",
    ],
  },
  {
    version: "2.17",
    // La corona completa: el anillo entero, sin el trozo que faltaba.
    nombre: "Completa",
    titulo: "Los archivos largos salen enteros",
    entrada:
      "Si el código era largo se quedaba a medias, y al darle a continuar empezaba otra vez desde cero. Ahora sigue donde lo dejó y lo termina en el mismo mensaje.",
    puntos: [
      "Ya no hace falta pulsar nada: si se queda a medias, sigue solo hasta terminarlo, hasta dos veces.",
      "Y sigue de verdad: retoma por el carácter exacto donde se cortó y las dos mitades se cosen en un solo archivo. Antes volvía a empezar y se cortaba por el mismo sitio.",
      "Para continuar usa instrucciones mínimas. Los cuatro mil tokens que se ahorra ahí son los que le faltaban para llegar al final del archivo.",
    ],
  },
  {
    version: "2.16",
    // El disco: el sol tapado entero, sin agujeros. Como el logo ahora.
    nombre: "Disco",
    titulo: "Convertir a la primera, y un logo como debe ser",
    entrada:
      "Le pedías pasar una foto a PDF y te decía que no podía; se lo repetías y lo hacía. Eso se acabó.",
    puntos: [
      "Convertir ya no depende de que la IA lo entienda: la app reconoce «pásala a pdf» y lo hace. Da igual lo que conteste el modelo, el archivo aparece.",
      "El logo de las imágenes ya no tiene el agujero del medio: es un disco blanco macizo, que es lo que parece un eclipse de verdad.",
      "Y las imágenes se pueden ver en grande. Pulsa una y ocupa la pantalla entera; antes había que descargarla para verla bien.",
    ],
  },
  {
    version: "2.15",
    // El encuadre: lo que separa una foto de un recorte mal hecho.
    nombre: "Encuadre",
    titulo: "Las escenas 3D se colocan solas",
    entrada:
      "La figura salía diminuta, descentrada o con medio cuadro en negro. Ya no: la cámara se coloca midiendo lo que hay.",
    puntos: [
      "ECLIPSE ya no coloca la cámara a ojo. Mide la figura y se sitúa donde se ve entera, centrada y grande, sea del tamaño que sea.",
      "Probado con figuras desde 0,05 hasta 120 de tamaño, alargadas y fuera del centro, en una ventana estrecha de móvil: en todos los casos entra entera y ocupa más de la mitad de la pantalla.",
      "Y se acabó el «html index.html» escrito encima de la página. Algunos modelos repetían ahí la cabecera del bloque y se pintaba dentro del diseño.",
    ],
  },
  {
    version: "2.14",
    // El mismo sol, visto a través de otro filtro: no cambia nada, solo cómo
    // llega. Aquí, la misma imagen en otro archivo.
    nombre: "Filtro",
    titulo: "Pásame esta foto a PDF",
    entrada:
      "Le mandas una imagen, le dices a qué formato la quieres, y te la devuelve. La misma, sin un píxel de diferencia.",
    puntos: [
      "PNG, JPG, WEBP y PDF. Se lo pides hablando —«pásala a pdf»— y te aparece el archivo debajo para descargar.",
      "Sin pérdida de verdad: un PNG sale idéntico píxel a píxel, y si la foto ya era JPEG, dentro del PDF va ese mismo archivo sin tocar.",
      "Se hace en tu propio móvil, así que es instantáneo, no gasta cupo y la imagen no sale del teléfono.",
      "Y las capturas de pantalla ya no se guardan como JPEG: se quedan en PNG, que es lo que mantiene las letras nítidas.",
    ],
  },
  {
    version: "2.13",
    // La primera luz que vuelve tras la totalidad: ya se ve lo que hay.
    nombre: "Primera luz",
    titulo: "Ahora mira cómo son las cosas antes de construirlas",
    entrada:
      "Le pedías una pirámide egipcia y salía un prisma con textura de pared. No es que no supiera hacerla: es que no podía mirar cómo es.",
    puntos: [
      "ECLIPSE CODE ya busca en internet. Cuando lo que le pides existe de verdad —un monumento, un coche, un animal, un escudo— mira sus proporciones y de qué está hecho antes de empezar.",
      "Busca poco y corto, a propósito: lo que ocupa la búsqueda es sitio que le quita al archivo. Para una calculadora o un juego no busca nada, que no hace falta.",
      "Y la cámara ya no se pone de frente. De frente una pirámide es un triángulo y un cubo es un cuadrado: el volumen desaparecía y parecía un dibujo plano.",
    ],
  },
  {
    version: "2.12",
    // La totalidad vista desde el otro lado: ya no queda sombra que explicar.
    nombre: "Sin sombra",
    titulo: "Las fotos, a la primera",
    entrada:
      "Se acabó el mensaje de \"este motor no puede ver imágenes\". Si el motor de turno no puede, ECLIPSE se cambia a uno que sí, y tú ni te enteras.",
    puntos: [
      "El cambio ocurre antes de escribir una sola palabra, así que ya no hay un primer mensaje que sobra ni una explicación que nadie ha pedido.",
      "Y ahora sí retoca. Le mandas una foto, habláis de ella, y aunque le preguntes dos mensajes después si le cambiaría algo, te dice qué y te la devuelve cambiada. Antes perdía la foto en cuanto dejaba de ser el último mensaje.",
      "Si te dice que subiría el contraste, lo sube. Ya no se queda en \"¿quieres que te la retoque?\" cuando es justo lo que le has pedido.",
    ],
  },
  {
    version: "2.11",
    // El tercer contacto: cuando el sol vuelve a asomar y se acaba la
    // oscuridad. Aquí, que ECLIPSE deje de contradecirse con las fotos.
    nombre: "Tercer contacto",
    titulo: "Responde a las fotos sin rodeos",
    entrada:
      "Decía que no podía ver la imagen y al mensaje siguiente la leía entera. Y a veces contestaba con trozos de código raros en vez de con una respuesta.",
    puntos: [
      "Ya no se le escapan sus notas internas. Esos <tool_code> con búsquedas que no venían a cuento eran maquinaria suya hablando sola: ahora van al panel de razonamiento, donde se pueden mirar si interesa.",
      "Y si al quitarlas no quedaba respuesta, la vuelve a pedir en vez de dejarte un mensaje en blanco.",
      "Una foto va siempre al motor que sabe verla, desde el primer mensaje. Y si a ese motor se le ha acabado la cuota del día, vuelve al de siempre y lo intenta, en vez de dejarte con un error.",
    ],
  },
  {
    version: "2.10",
    // El anillo: cuando la luna está dentro del sol y se ve el borde entero.
    // Aquí, que ECLIPSE vuelva a tener ojos.
    nombre: "Anillo",
    titulo: "ECLIPSE vuelve a ver tus fotos",
    entrada:
      "Le mandabas una foto y te decía que no podía verla. No era verdad: la estaba viendo, pero sus propias instrucciones le decían que no.",
    puntos: [
      "Ya mira las fotos que le mandas: te las describe, te aconseja sobre ellas y te las retoca.",
      "Y ahora caben. Una foto del móvil pasa de los 3 MB con facilidad y se rechazaba entera; se reduce sola en tu teléfono antes de salir —de 9 MB a 700 KB en dos décimas de segundo— y se ve exactamente igual de bien.",
      "También dejan de comerse el sitio de la respuesta: una foto se contaba como si fuera un texto de doscientas mil palabras.",
      "Y si el motor que tienes puesto no sabe mirar imágenes, ECLIPSE cambia solo al que sí sabe para ese mensaje. Antes te contestaba pidiéndote que le describieras la foto que le acababas de mandar.",
    ],
  },
  {
    version: "2.8",
    // La banda de sombra: las franjas de luz y oscuridad que cruzan el suelo
    // justo antes de la totalidad. Aquí, que los colores dejen de bailar.
    nombre: "Bandas",
    titulo: "Los colores se quedan donde están",
    entrada:
      "Cada giro cambiaba los colores de sitio. No era el azar: había un hueco en las instrucciones y cada modelo lo rellenaba a su manera.",
    puntos: [
      "La función que gira las caras va ahora entera y probada, sin huecos que rellenar. Aguanta sesenta giros seguidos con el cubo entero y cada color en su sitio.",
      "Las piezas se llevan su orientación al moverse. Sin eso enseñaban hacia fuera una cara interior, que es negra, y de ahí las manchas que cambiaban solas.",
      "Y el nombre del archivo ya no se cuela dentro de la página. Salía escrito arriba del todo, encima del diseño.",
    ],
  },
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
