/**
 * Los datos con los que se graba el anuncio.
 *
 * No hay ni una pantalla dibujada a mano en este vídeo: todas las capturas son
 * la aplicación de verdad corriendo en un navegador de verdad. Lo único que se
 * sustituye son las respuestas del servidor —el modelo cuesta dinero y aquí no
 * hay red—, así que estos objetos tienen que respetar exactamente las formas de
 * `src/lib/types.ts` y `src/lib/examen/tipos.ts`. Si una de esas formas cambia,
 * esto deja de pintar y hay que venir aquí.
 *
 * El contenido es de un examen real de instituto (Biología, genética) porque un
 * "Lorem ipsum" en la pantalla de un anuncio se ve a la legua.
 */

/** El resumen del Modo Examen, en el mismo Markdown que pinta el chat. */
export const RESUMEN = [
  "## Meiosis",
  "",
  "Dos divisiones seguidas y **una sola** copia del ADN: de una célula salen",
  "**cuatro** con la mitad de cromosomas.",
  "",
  "- El entrecruzamiento ocurre en la **profase I**.",
  "- De ahí sale la variabilidad genética.",
  "",
  "## Leyes de Mendel",
  "",
  "1. Uniformidad de los híbridos.",
  "2. Segregación: los alelos se separan al formarse los gametos.",
  "3. Transmisión independiente.",
].join("\n");

/** El texto que ECLIPSE contesta en el chat. Corto: cabe en una pantalla. */
export const RESPUESTA_CHAT = [
  "En la meiosis hay **dos divisiones** seguidas y una sola copia del ADN, así",
  "que de una célula salen **cuatro** con la mitad de cromosomas. En la mitosis",
  "hay una división y salen **dos** idénticas a la madre.",
  "",
  "La clave del examen suele ser esta: el entrecruzamiento —cuando las",
  "cromátidas intercambian trozos— pasa en la **profase I**, y es de donde sale",
  "la variabilidad genética.",
].join("\n");

export const FUENTES_CHAT = [
  {
    url: "https://www.nature.com/scitable/topicpage/meiosis-genetic-recombination-and-sexual-reproduction-210/",
    title: "Meiosis, recombinación genética y reproducción sexual",
    domain: "nature.com",
    trust: 95,
    label: "Revista científica",
  },
  {
    url: "https://www.ncbi.nlm.nih.gov/books/NBK9931/",
    title: "Meiosis — Molecular Biology of the Cell",
    domain: "nih.gov",
    trust: 93,
    label: "Organismo oficial",
  },
  {
    url: "https://bio.libretexts.org/Bookshelves/Introductory_and_General_Biology",
    title: "Comparación entre mitosis y meiosis",
    domain: "libretexts.org",
    trust: 82,
    label: "Universidad",
  },
];

const TROZOS = [
  {
    id: "t1",
    tema: "Meiosis",
    texto:
      "En la profase I las cromátidas homólogas intercambian fragmentos. Ese intercambio se llama entrecruzamiento o sobrecruzamiento y es el origen de la variabilidad genética.",
    fuente: { archivo: "apuntes-tema4.png", pagina: 3 },
  },
  {
    id: "t2",
    tema: "Leyes de Mendel",
    texto:
      "Segunda ley de Mendel o ley de la segregación: los dos alelos de un gen se separan durante la formación de los gametos y cada gameto recibe solo uno.",
    fuente: { archivo: "apuntes-tema4.png", pagina: 5 },
  },
  {
    id: "t3",
    tema: "ADN y genes",
    texto:
      "Un gen es un fragmento de ADN que contiene la información para fabricar una proteína. El conjunto de todos los genes de un individuo es su genotipo.",
    fuente: { archivo: "libro-genetica.pdf", pagina: 112 },
  },
];

/** Un examen ya analizado, tal y como lo devolvería `GET /api/examen?id=`. */
export const EXAMEN = {
  id: "ex-demo",
  asignatura: "Biología",
  titulo: "Tema 4 · Genética",
  fecha: "2026-10-21",
  temas: ["Meiosis", "Leyes de Mendel", "ADN y genes", "Mutaciones"],
  materiales: [
    { id: "m1", nombre: "apuntes-tema4.png", tipo: "imagen", cuando: 1, legible: true },
    { id: "m2", nombre: "pizarra-clase.jpg", tipo: "imagen", cuando: 2, legible: true },
    { id: "m3", nombre: "libro-genetica.pdf", tipo: "pdf", cuando: 3, legible: true },
  ],
  mapa: [
    { nombre: "Meiosis", emoji: "🧬", cobertura: 92 },
    { nombre: "Leyes de Mendel", emoji: "🌱", cobertura: 78 },
    { nombre: "ADN y genes", emoji: "🔬", cobertura: 64 },
    { nombre: "Mutaciones", emoji: "⚡", cobertura: 41 },
  ],
  extracto: TROZOS,
  resumen: { rapido: "", completo: "" },
  analizado: true,
  intentos: [
    {
      id: "i1",
      tipo: "quiz",
      cuando: 1,
      nota: 7.5,
      aciertos: 6,
      total: 8,
      porTema: { Meiosis: { bien: 3, total: 3 }, "Leyes de Mendel": { bien: 2, total: 3 }, Mutaciones: { bien: 1, total: 2 } },
      falladas: ["Leyes de Mendel", "Mutaciones"],
    },
    {
      id: "i2",
      tipo: "quiz",
      cuando: 2,
      nota: 8.8,
      aciertos: 7,
      total: 8,
      porTema: { Meiosis: { bien: 3, total: 3 }, "Leyes de Mendel": { bien: 3, total: 3 }, Mutaciones: { bien: 1, total: 2 } },
      falladas: ["Mutaciones"],
    },
    {
      id: "i3",
      tipo: "quiz",
      cuando: 3,
      nota: 9.4,
      aciertos: 8,
      total: 8,
      porTema: { Meiosis: { bien: 3, total: 3 }, "Leyes de Mendel": { bien: 3, total: 3 }, Mutaciones: { bien: 2, total: 2 } },
      falladas: [],
    },
  ],
};

/** Las preguntas del test. Cada una dice de qué trozo sale: es lo que las hace comprobables. */
export const PREGUNTAS = [
  {
    id: "p1",
    enunciado: "¿En qué fase de la meiosis ocurre el entrecruzamiento?",
    opciones: ["Profase I", "Metafase II", "Anafase I", "Telofase II"],
    correcta: 0,
    explicacion: "En la profase I las cromátidas homólogas intercambian fragmentos, y de ahí sale la variabilidad genética.",
    tema: "Meiosis",
    fuente: { archivo: "apuntes-tema4.png", pagina: 3 },
    trozo: "t1",
  },
  {
    id: "p2",
    enunciado: "¿Qué dice la segunda ley de Mendel?",
    opciones: [
      "Que los alelos de un gen se separan al formarse los gametos",
      "Que todos los hijos son iguales al padre",
      "Que los genes están siempre en el mismo cromosoma",
      "Que las mutaciones son siempre perjudiciales",
    ],
    correcta: 0,
    explicacion: "Es la ley de la segregación: cada gameto recibe solo uno de los dos alelos.",
    tema: "Leyes de Mendel",
    fuente: { archivo: "apuntes-tema4.png", pagina: 5 },
    trozo: "t2",
  },
  {
    id: "p3",
    enunciado: "¿Qué es un gen?",
    opciones: [
      "Un fragmento de ADN con la información para fabricar una proteína",
      "Una célula sin núcleo",
      "Un tipo de cromosoma sexual",
      "El conjunto de todos los cromosomas",
    ],
    correcta: 0,
    explicacion: "El conjunto de todos los genes de un individuo es su genotipo.",
    tema: "ADN y genes",
    fuente: { archivo: "libro-genetica.pdf", pagina: 112 },
    trozo: "t3",
  },
];
