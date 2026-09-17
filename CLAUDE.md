# AlldesignKarl — instrucciones del proyecto

Léete esto entero antes de tocar nada. Está escrito para que una sesión nueva
pueda continuar sin haber visto las anteriores.

## 1. Qué es

La web corporativa de **AlldesignKarl**: producto artesanal de Zaragoza (El
Pilar, cerámica, textil, papelería, gourmet, recuerdo) vendido **al por mayor a
empresas**: tiendas, museos, distribuidores, hoteles y regalo corporativo.

La hace **Carlos Lafuente Pueyo**; es el dueño y quien decide. Escribe desde el
móvil, en castellano, rápido y con erratas; se entiende perfectamente, así que
no le pidas que aclare lo que ya se entiende. Quiere las cosas **funcionando y
comprobadas**, no explicadas: si hay un problema, se arregla y se cuenta en dos
líneas, sin devolverle una lista de opciones.

No es una tienda en línea: no hay carrito, ni pagos, ni cuentas. Es marca y
captación, y termina siempre en el formulario.

## 2. Tecnología

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Sin ORM, sin
SQL y sin base de datos obligatoria. Lo único que puede persistir son solicitudes
del formulario, y solo si hay Redis configurado.

```
src/
  app/
    layout.tsx        Fuentes, metadatos, cabecera, pie y datos para Google
    page.tsx          Las siete secciones, en orden
    globals.css       TODA la piel de la marca, colgando de `.sitio`
    icon.tsx          El favicon, dibujado con el monograma
    api/contacto/     El formulario
    aviso-legal/ privacidad/ cookies/
  components/         Una sección por archivo + movimiento.tsx y peticion.ts
  lib/
    config.ts         LOS DATOS DE LA EMPRESA. Se toca esto, no los componentes
    productos.ts      El catálogo entero
    solicitud.ts      Validación pura: la usan el navegador Y el servidor
    entrega.ts        Los tres caminos por los que sale una solicitud
    almacen.ts        Redis por REST, opcional
    sitio.ts          La dirección pública
pruebas/              2 pruebas. `npm run prueba`
```

## 3. Reglas que hay que respetar

1. **No inventes datos de la empresa.** Correo, teléfono, WhatsApp, dirección,
   redes, CIF y razón social salen de `config.ts`. Lo que no está va como `null`
   y **el enlace que lo necesita no se pinta**. Un CIF inventado en un aviso
   legal no es un detalle pendiente, es una mentira publicada.
2. **El formulario no da las gracias si no ha entregado nada** (`entrega.ts` y
   el 503 de `api/contacto`). Es la regla que sostiene todo lo demás.
3. **Ni un botón falso.** Si algo no lleva a ninguna parte, no se pinta.
4. **Todo en castellano**: variables, funciones, archivos y comentarios.
5. **Los comentarios explican POR QUÉ**, no qué. Un comentario que repite lo que
   dice la línea sobra.
6. **Los mensajes de error se leen como los diría una persona** y dicen qué
   hacer. Nunca un código de estado en la cara de quien entra.
7. **`maxDuration` de una ruta no pasa de 60.** El plan gratuito de Vercel corta
   ahí pase lo que pase.
8. **Nunca escribas claves en el código**: variables de entorno siempre.
9. **Antes de dar algo por hecho: `npm run build` y `npm run prueba`.**

## 4. Lo que NO debes romper

- **Que el movimiento use UN observador y UN escuchador de scroll para toda la
  web** (`components/movimiento.tsx`), leyendo todas las posiciones antes de
  escribir ningún estilo, y que la portada escriba su salida en una variable CSS
  y no en el estado de React. Un `setState` por fotograma es exactamente el
  parallax a tirones que se quería evitar.
- **Que `clip-path` solo lo abra la cortina** (`.arte-revelar[data-como="cortina"]`).
  Puesto en todos los reveals, la caja se recorta a sí misma para siempre y lo
  que sobresale a propósito —la cita sobre la foto, el sello bajo la imagen— se
  queda cortado.
- **Que la validación del formulario sea la MISMA función en el navegador y en
  el servidor** (`solicitud.ts`). Dos validaciones distintas es un formulario
  que deja pasar en el móvil lo que luego rechaza el servidor, sin decir por qué.
- **Que el campo trampa conteste 200 y no entregue nada.** Decirle a un robot
  que le hemos pillado es enseñarle a colarse.
- **Que la tarjeta destacada del catálogo no deje crecer al texto**
  (`flex-1` solo en la foto). Si crecen los dos, se reparten el hueco y la
  tarjeta grande termina en medio metro de papel en blanco bajo el botón.
- **Que `pedir()` llegue al formulario por un evento del navegador**
  (`peticion.ts`). Subir ese estado a la página convertiría en cliente secciones
  enteras que hoy se pintan en el servidor sin una línea de JavaScript.
- **Que lo que se pinta sin fotografía sea una lámina de color con su motivo**
  (`Marco.tsx`), no un rectángulo gris. Un sitio con huecos grises parece roto, y
  a una empresa que entra a comprar al por mayor le importa lo que parece.
- **Las 2 pruebas.** Si una falla después de un cambio tuyo, el roto es el
  cambio, no la prueba.

## 5. Sin red

En el contenedor de desarrollo casi todo internet está bloqueado. Por eso la
prueba de navegador levanta servidores de mentira (el buzón del formulario y
Redis). Si hace falta comprobar algo contra un servicio real, no se podrá:
dilo claramente en vez de suponer que funciona.
