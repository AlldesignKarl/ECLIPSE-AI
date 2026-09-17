---
name: frontend-design
description: Criterios de diseño de interfaz para este proyecto. Úsala SIEMPRE que toques frontend - UI, interfaz, componentes, CSS, Tailwind, layout, tipografía, color, espaciado, animaciones, responsive, estados (hover, focus, loading, error) o accesibilidad - y antes de crear o rediseñar cualquier pantalla, sección o componente. El objetivo es que el resultado parezca diseñado por un profesional, no generado.
---

# Diseño de interfaz

Guía permanente de diseño de este proyecto. No es un manual de estilo de código:
es el criterio con el que se decide si una pantalla está terminada.

La vara de medir es una sola: **¿esto parece hecho por un estudio de diseño, o
parece generado?** Si parece generado, no está terminado.

---

## 0. Antes de tocar nada

Cuatro cosas, en este orden, y ninguna se salta:

1. **Mira lo que ya hay.** Abre la hoja de estilo, mira los componentes vecinos y
   entiende el sistema: qué variables de color existen, qué escala de espaciado
   se usa, cómo se llaman las clases, qué curva de animación se repite.
2. **Quédate con lo que funciona.** Un rediseño que tira una identidad ya
   trabajada empieza en negativo. Se mejora lo que hay; solo se sustituye lo que
   está roto, y entonces se dice por qué.
3. **No toques la lógica.** Rutas, APIs, nombres de campos, validaciones, datos,
   estado, textos legales: no son tuyos. Si un cambio visual obliga a tocar
   lógica, párate y dilo.
4. **Decide qué NO vas a hacer.** La mitad del diseño es quitar.

---

## 1. Identidad antes que decoración

- Una sola identidad para todo el proyecto: mismos colores, misma letra, mismos
  radios, mismas sombras, misma curva de animación. Dos secciones con dos
  personalidades distintas es lo que delata una web generada a trozos.
- **Los valores viven en un sitio** (variables CSS o el tema de Tailwind) y todo
  lo demás los usa. Un color escrito a mano dentro de un componente es una
  bomba de relojería: el día que cambie la marca, ese trozo se queda antiguo.
- Cada elemento decorativo tiene que poder explicarse en una frase. Si la
  explicación es "quedaba bonito", sobra.

---

## 2. Composición, jerarquía y espacio

- **En cada pantalla manda UNA cosa.** Si todo grita, no se oye nada: decide
  cuál es el primer elemento que tiene que leer alguien y hunde el resto.
- Escala tipográfica con saltos claros (título, subtítulo, cuerpo, nota). Dos
  tamaños casi iguales se leen como un error, no como jerarquía.
- **El espacio es el material principal.** Usa una escala (4/8/12/16/24/32/48/64)
  y respétala; el aire que rodea algo es lo que le da importancia. Más espacio
  entre bloques que dentro de un bloque: así se ve qué va con qué.
- Alineación: todo cuelga de una rejilla. Un elemento suelto dos píxeles fuera
  de eje se nota aunque nadie sepa decir por qué.
- Medida de lectura: entre 60 y 75 caracteres por línea. Un párrafo a lo ancho
  de una pantalla de 27 pulgadas no lo lee nadie.

---

## 3. Tipografía

- Dos familias como mucho: una para titulares y otra para texto (una tercera
  solo si hay código). Cada familia extra es tiempo de carga y ruido visual.
- Combina por contraste real (serif editorial + grotesca, por ejemplo), no por
  parecido: dos sans parecidas se ven como un fallo.
- Titulares con `letter-spacing` ligeramente negativo e interlineado corto;
  texto con interlineado de 1,6-1,75. Los títulos se miran, los párrafos se leen.
- `clamp()` para los tamaños grandes: entre un móvil y un monitor grande hay
  veinte tamaños intermedios y ninguno debería quedar mal.
- Sirve las fuentes desde el propio dominio (`next/font` o equivalente): ni una
  petición a un tercero por abrir la página, y ningún salto de letra al cargar.

---

## 4. Color

- Paleta corta y mandada: un color de fondo, uno de marca, uno de acento y los
  neutros. Todo lo demás sale de mezclarlos.
- **Contraste medido, no intuido**: 4,5:1 para texto normal y 7:1 para lo que
  tiene que leerse sí o sí. Un gris elegante sobre un fondo oscuro que se ve
  bien en una captura puede ser ilegible en un móvil a pleno sol.
- El color del texto depende del FONDO sobre el que cae, no del componente.
  Cuando hay secciones claras y oscuras, cada una define su color de texto.
- Los metales (oro, plata, cobre) necesitan al menos tres tonos —sombra, color,
  luz— para parecer metal. Un dorado plano es amarillo.
- Un acento cálido fuerte (terracota, rojo, naranja) es un DETALLE: si ocupa
  media pantalla deja de ser acento y se come la marca.

---

## 5. Componentes

- **Botones**: jerarquía clara (principal, secundario, terciario). Profundidad
  con intención —un filo de luz arriba, una sombra corta debajo— y no con cinco
  sombras. Al pulsar tiene que notarse que se ha pulsado.
- **Tarjetas**: sobre fondo claro se separan por la sombra; sobre fondo oscuro,
  por la luz de su canto. No es lo mismo y se nota.
- **Formularios**: etiqueta siempre visible (el `placeholder` no es etiqueta),
  error debajo del campo y en palabras que digan qué hacer, foco muy visible, y
  el teclado correcto en móvil (`inputMode`, `autocomplete`).
- **Navegación**: dice dónde estás, no solo a dónde puedes ir. En móvil, área
  táctil de 44 píxeles como mínimo.
- Radios, bordes y sombras: tres valores de cada uno para todo el proyecto. Más
  variedad no es riqueza, es descuido.

---

## 6. Movimiento

- Toda animación responde a una pregunta: **¿qué le cuenta esto a quien mira?**
  (algo apareció, algo cambió, algo se puede tocar). Si no responde a ninguna,
  fuera.
- Entradas de 300-600 ms; microinteracciones de 120-250 ms. Curvas de salida
  suave (`cubic-bezier(0.22, 1, 0.36, 1)`), nunca `linear` salvo para algo que
  gira sin parar.
- Anima `transform` y `opacity`. Animar `width`, `top`, `height` o `margin`
  obliga al navegador a recalcular la página en cada fotograma: ahí nacen los
  tirones.
- Escalona lo que va en grupo (60-90 ms entre elementos): una fila de tarjetas
  que entra a la vez parece un parpadeo; escalonada, parece coreografía.
- Nada de rebotes, giros ni zooms porque sí. El movimiento premium es sobrio.
- **`prefers-reduced-motion` no es opcional**: quien lo pide se queda sin
  movimiento, no sin web.

---

## 7. Estados: la mitad del trabajo

Una pantalla no está hecha hasta que existen sus estados:

- **hover** y **active**: solo en lo que se puede tocar (y `hover` no existe en
  móvil: nada esencial puede depender de él).
- **focus-visible**: SIEMPRE visible. Quitar el anillo de foco deja a quien
  navega con teclado sin saber dónde está.
- **loading**: espacio ya reservado (esqueleto), sin saltos de maquetación.
- **vacío**: dice qué es esto y cuál es el siguiente paso. Un hueco en blanco
  parece una web rota.
- **error**: en cristiano, diciendo qué hacer, y sin perder lo que la persona ya
  había escrito.
- **deshabilitado**: se ve que no se puede y se intuye por qué.

---

## 8. Responsive

- Se diseña desde el móvil. Lo que sobra en una pantalla de 390 px sobra en
  todas.
- Puntos de corte por el contenido, no por modelos de teléfono: se cambia la
  maquetación cuando el contenido se rompe.
- `100svh` en vez de `100vh` para pantallas completas: con `vh`, la barra del
  navegador del móvil corta el contenido de abajo.
- Nada de scroll horizontal. Nunca. Compruébalo de verdad.
- En móvil, animaciones más cortas y recorridos más cortos: el mismo
  desplazamiento se ve como un salto en una pantalla pequeña.

---

## 9. Lo que delata a una web generada (evítalo)

- Degradados por todas partes, y morados/azules de plantilla.
- Cristal esmerilado en todo lo que se mueve. El cristal es para un panel que
  flota sobre algo, no para una página entera.
- Secciones clónicas: mismo título centrado, mismo párrafo, misma rejilla de
  tres tarjetas, cinco veces seguidas.
- Emojis como iconos, iconos genéricos sin relación con lo que dicen.
- Sombras enormes y difusas en todo, bordes de 2 px por todas partes.
- Animaciones en bucle que no aportan nada.
- Texto de relleno con palabras grandilocuentes y sin información.
- Datos inventados (cifras, testimonios, logos de clientes) para rellenar.

---

## 10. Antes de dar algo por terminado

- [ ] Se ve en móvil, tablet, portátil y pantalla grande, y no se sale por los
      lados en ninguna.
- [ ] Contrastes comprobados en las combinaciones reales de texto y fondo.
- [ ] Se puede recorrer entera con el tabulador y se ve siempre dónde está el
      foco.
- [ ] Todos los estados existen (hover, focus, active, loading, vacío, error).
- [ ] Ningún botón ni enlace lleva a ninguna parte; lo que no funciona, no se
      pinta.
- [ ] Con "reducir movimiento" activado la web se ve entera y quieta.
- [ ] Los colores y medidas salen de las variables del proyecto, no escritos a
      mano.
- [ ] Nada de lógica, rutas, APIs ni datos ha cambiado.
- [ ] Lo has mirado con los ojos de alguien que entra por primera vez: ¿qué es
      esto, para quién es y qué tengo que hacer ahora?

---

## 11. Inspiración, no copia

Estos criterios son para decidir, no para calcar. **No se copia la
implementación de ninguna web concreta**: ni su maquetación, ni su código, ni su
composición. Se entiende por qué algo funciona y se resuelve con la identidad de
este proyecto.
