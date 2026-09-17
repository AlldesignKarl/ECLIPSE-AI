# AlldesignKarl

Web corporativa de **AlldesignKarl**: elaboración y distribución al por mayor de
producto artesanal de Zaragoza para tiendas, museos, distribuidores y empresas.

No es una tienda en línea. Es una web de marca y de captación: cuenta quién hay
detrás, enseña el catálogo y termina en un formulario que llega de verdad.

---

## Qué tiene

- **Portada** con movimiento por capas: *"Tradición que llega más lejos."*
- **Historia**: *"La artesanía no se fabrica. Se crea."*
- **El taller**: cinco escenas que se relevan mientras bajas y cuentan cómo se
  hace una pieza, con la ilustración dibujándose sola en cada paso.
- **El Pilar**, que se traza línea a línea según bajas —con el ratón o con el
  dedo— hasta encenderse en oro. Son caminos SVG movidos por el scroll: ni
  vídeo, ni foto, ni librería de animación.
- **Zaragoza y El Pilar**, con la silueta de la ciudad dibujada en SVG.
- **Catálogo** filtrable por categoría, con destacados y botón de solicitar
  información en cada pieza.
- **Venta al por mayor** y la llamada grande: *"¿Quieres trabajar con nosotros?"*
- **Proceso** de cinco pasos que se enciende al bajar.
- **Contacto**: correo, teléfono, WhatsApp y formulario funcional.
- **Aviso legal, privacidad y cookies**.

Todo responde en móvil, tablet, ordenador y pantalla grande, y quien tenga
activado "reducir movimiento" en su sistema ve la web entera sin animaciones.

---

## Lo que hay que rellenar

Dos archivos, y ninguno es código difícil:

| Qué | Dónde |
|---|---|
| Nombre, correo, teléfono, WhatsApp, dirección, horario, redes y datos fiscales | `src/lib/config.ts` |
| Productos: nombre, categoría, descripción, detalle y **foto** | `src/lib/productos.ts` |
| El logotipo | deja el archivo en `public/logo.svg` (o .png/.webp/.jpg) |

Dos reglas que conviene no romper:

- **Lo que no esté puesto no se pinta.** Sin teléfono no sale el botón de
  llamar; sin número de WhatsApp no sale WhatsApp. Nunca hay un botón que no
  hace nada, y nunca hay un dato inventado. En desarrollo sale abajo a la
  izquierda una nota con la lista de lo que falta; en producción no existe.
- **El logotipo** no se configura: se detecta. En cuanto exista `public/logo.svg`
  —o .png, .webp, .jpg— aparece en la cabecera y en el pie. Mientras no exista se
  pinta el sello con el monograma.
- **Las fotos**: deja el archivo en `public/fotos/` y pon la ruta en el producto
  (`imagen: "/fotos/ceramica.webp"`). Mientras sea `null` se pinta una lámina de
  color con el motivo del oficio, no un hueco gris.

---

## El formulario

`POST /api/contacto` valida con la misma función que el navegador, tiene campo
trampa para robots y un freno de un envío cada 30 segundos por visitante.

Prueba **tres caminos** y usa todos los que estén configurados:

1. `WEBHOOK_SOLICITUDES` — un POST con el JSON entero (Zapier, Make, n8n, tu CRM).
2. `RESEND_API_KEY` + `EMAIL_DESTINO` — un correo de verdad.
3. Redis por API REST (Upstash o el de Vercel) — una copia guardada.

**Si no hay ninguno configurado, el formulario NO da las gracias**: dice que no
ha podido entregarse y ofrece el mismo mensaje por correo. Un "gracias, te
contestamos pronto" sobre un mensaje perdido es el peor fallo que puede tener
una web de ventas, porque nadie se entera nunca.

Todo está explicado en `.env.example`.

---

## Comandos

```bash
npm install
npm run dev              # desarrollo en http://localhost:3000
npm run build            # compilar
npm start                # producción
npm run typecheck        # comprobar tipos
npm run prueba           # las 2 pruebas (una abre un navegador de verdad)
npm run prueba:ligeras   # solo la rápida
```

---

## Los colores

Los siete colores de la marca están juntos en `src/app/globals.css`, al
principio: azul noche, azul profundo, azul cielo, oro, terracota, marfil y gris
azulado. Cambiar uno cambia la web entera.

La web va cambiando de color según se baja —noche, amanecer, marfil, anochecer,
el Pilar encendiéndose, azul luminoso, marfil otra vez, azul profundo y negro
azulado—, y cada sección arranca en el color donde terminó la anterior. Cada una
tiene su clase `.fondo-*`, así que retocar un acto es tocar un sitio.

## Cómo está hecho

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Sin base de
datos obligatoria, sin ORM y sin dependencias de más: dos fuentes servidas desde
el propio dominio y ni una petición a terceros por abrir la página.

El movimiento (aparecer al entrar en pantalla, parallax y el hilo del proceso)
está en `src/components/movimiento.tsx`: un solo observador y un solo escuchador
de scroll para toda la web.
