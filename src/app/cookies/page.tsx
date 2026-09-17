import type { Metadata } from "next";

import PaginaLegal from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Qué se guarda en tu navegador al visitar esta web.",
  robots: { index: false, follow: true },
};

/**
 * Política de cookies.
 *
 * Y dice la verdad: esta web NO pone cookies propias ni de terceros. No hay
 * cartel de "acepto" porque no hay nada que aceptar, y esa es justo la razón
 * por la que no lo hay. El día que se añada una medición con cookies, aquí hay
 * que contarlo y habrá que poner el aviso de consentimiento: son las dos cosas
 * a la vez, no una.
 */
export default function Page() {
  return (
    <PaginaLegal
      titulo="Política de cookies"
      entradilla="Lo corto: esta web no instala cookies para seguirte."
    >
      <h2>1. Qué es una cookie</h2>
      <p>
        Un archivo pequeño que una web guarda en tu navegador para reconocerte en visitas
        posteriores, recordar preferencias o medir el uso del sitio.
      </p>

      <h2>2. Qué cookies usa esta web</h2>
      <p>
        <strong>Ninguna cookie propia ni publicitaria.</strong> Esta web no necesita que inicies
        sesión, no guarda un carrito y no te sigue por otros sitios. Por eso no verás un cartel de
        consentimiento: no hay nada que consentir.
      </p>
      <p>
        Para saber cuántas visitas recibe cada página usamos una medición agregada y sin cookies,
        que no identifica a ningún visitante ni cruza datos con otras webs. El proveedor de
        alojamiento puede además registrar datos técnicos de la conexión (dirección IP, fecha y
        hora) por seguridad y para que el servicio funcione, como hace cualquier servidor.
      </p>

      <h2>3. Cómo controlar el almacenamiento de tu navegador</h2>
      <p>
        Aunque aquí no haga falta, puedes borrar o bloquear cookies y almacenamiento local desde
        los ajustes de tu navegador (Chrome, Safari, Firefox y Edge lo llaman «Privacidad y
        seguridad» o «Datos de sitios»).
      </p>

      <h2>4. Si esto cambia</h2>
      <p>
        Si en el futuro se añade una herramienta que sí instale cookies, se actualizará esta página
        y aparecerá el aviso de consentimiento correspondiente antes de instalarla.
      </p>

      <h2>5. Más información</h2>
      <p>
        Sobre el tratamiento de datos personales, mira la{" "}
        <a href="/privacidad">política de privacidad</a>; sobre el titular de la web, el{" "}
        <a href="/aviso-legal">aviso legal</a>.
      </p>
    </PaginaLegal>
  );
}
