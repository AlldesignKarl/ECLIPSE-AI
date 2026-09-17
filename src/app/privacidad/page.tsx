import type { Metadata } from "next";

import PaginaLegal, { Pendiente } from "@/components/PaginaLegal";
import { EMPRESA } from "@/lib/config";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos se recogen en el formulario, para qué y durante cuánto tiempo.",
  robots: { index: false, follow: true },
};

/**
 * Política de privacidad.
 *
 * Cuenta lo que el formulario hace DE VERDAD, campo a campo, y nombra los tres
 * destinos posibles (correo, automatización y base de datos) porque son los que
 * puede tener configurados `lib/entrega.ts`. Una política que no se
 * parece a lo que hace el código no protege a nadie.
 */
export default function Page() {
  const responsable = EMPRESA.legal.razonSocial;
  const correoPrivacidad = EMPRESA.legal.emailPrivacidad ?? EMPRESA.email;

  return (
    <PaginaLegal
      titulo="Política de privacidad"
      entradilla="Qué datos nos das, qué hacemos con ellos y cómo los recuperas o los borras."
    >
      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>
          <strong>Responsable:</strong> {responsable ?? <Pendiente>razón social</Pendiente>}
        </li>
        <li>
          <strong>CIF/NIF:</strong> {EMPRESA.legal.cif ?? <Pendiente>CIF</Pendiente>}
        </li>
        <li>
          <strong>Dirección:</strong>{" "}
          {EMPRESA.legal.domicilioSocial ?? <Pendiente>domicilio social</Pendiente>}
        </li>
        <li>
          <strong>Contacto para privacidad:</strong>{" "}
          {correoPrivacidad ?? <Pendiente>email de privacidad</Pendiente>}
        </li>
      </ul>

      <h2>2. Qué datos recogemos</h2>
      <p>Solo los que escribes tú en el formulario de contacto:</p>
      <ul>
        <li>Nombre.</li>
        <li>Empresa.</li>
        <li>Correo electrónico.</li>
        <li>Teléfono, si decides dejarlo (es opcional).</li>
        <li>El mensaje y, si has entrado desde una ficha, el producto por el que preguntas.</li>
      </ul>
      <p>
        No usamos perfiles publicitarios, no compramos listas y no hay decisiones automatizadas ni
        elaboración de perfiles con tus datos.
      </p>

      <h2>3. Para qué los usamos</h2>
      <p>
        Para responder a tu consulta, prepararte un presupuesto o enviarte el catálogo mayorista, y
        para mantener el contacto comercial derivado de esa petición. Nada más. No te apuntamos a
        ninguna lista de correo por haber escrito.
      </p>

      <h2>4. Base legal</h2>
      <p>
        Tu consentimiento al enviar el formulario y, cuando la relación avanza, la aplicación de
        medidas precontractuales y la ejecución del contrato (artículo 6.1.a y 6.1.b del RGPD).
      </p>

      <h2>5. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras dure la conversación comercial y, después, el plazo que exija la normativa fiscal
        y mercantil si llega a haber pedido. Si no hay relación comercial, se eliminan cuando
        dejan de ser necesarios para atenderte.
      </p>

      <h2>6. A quién se los comunicamos</h2>
      <p>
        No vendemos ni cedemos tus datos. Para que el mensaje nos llegue intervienen proveedores
        técnicos que actúan como encargados del tratamiento: el servicio de alojamiento de la web,
        el servicio de correo o de automatización con el que se entrega el formulario y, en su
        caso, la base de datos donde queda registrada la solicitud. Todos ellos tratan los datos
        siguiendo nuestras instrucciones.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Puedes pedirnos acceso a tus datos, su rectificación o su supresión, limitar u oponerte al
        tratamiento y solicitar la portabilidad, escribiendo a{" "}
        {correoPrivacidad ?? <Pendiente>email de privacidad</Pendiente>}. También puedes retirar tu
        consentimiento en cualquier momento y presentar una reclamación ante la Agencia Española de
        Protección de Datos (<a href="https://www.aepd.es">www.aepd.es</a>).
      </p>

      <h2>8. Seguridad</h2>
      <p>
        La web se sirve cifrada (HTTPS) y el formulario incorpora medidas contra el envío
        automatizado. Aplicamos medidas técnicas y organizativas razonables para proteger la
        información, aunque ningún sistema puede garantizar una seguridad absoluta.
      </p>

      <h2>9. Cambios</h2>
      <p>
        Si cambiamos esta política, publicaremos aquí la versión nueva. Consúltala de vez en cuando
        si te interesa.
      </p>
    </PaginaLegal>
  );
}
