import type { Metadata } from "next";

import PaginaLegal, { Pendiente } from "@/components/artesania/PaginaLegal";
import { EMPRESA } from "@/lib/artesania/config";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: "Datos identificativos y condiciones de uso del sitio web.",
  // No tiene sentido que un aviso legal compita en Google con el catálogo.
  robots: { index: false, follow: true },
};

/**
 * Aviso legal.
 *
 * Los datos que exige la LSSI (titular, CIF, domicilio, contacto) NO están
 * inventados: salen de `config.ts` y, mientras no estén, se ven marcados. Una
 * web B2B con un CIF de mentira es peor que una sin aviso legal.
 */
export default function Page() {
  const L = EMPRESA.legal;

  return (
    <PaginaLegal
      titulo="Aviso legal"
      entradilla="Quién hay detrás de esta web y en qué condiciones se puede usar."
    >
      <h2>1. Datos identificativos</h2>
      <p>
        En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de
        comercio electrónico (LSSI-CE), se facilitan los siguientes datos:
      </p>
      <ul>
        <li>
          <strong>Titular:</strong> {L.razonSocial ?? <Pendiente>razón social</Pendiente>}
        </li>
        <li>
          <strong>CIF/NIF:</strong> {L.cif ?? <Pendiente>CIF</Pendiente>}
        </li>
        <li>
          <strong>Domicilio social:</strong>{" "}
          {L.domicilioSocial ?? <Pendiente>domicilio social</Pendiente>}
        </li>
        <li>
          <strong>Correo electrónico:</strong> {EMPRESA.email ?? <Pendiente>email</Pendiente>}
        </li>
        <li>
          <strong>Teléfono:</strong> {EMPRESA.telefono ?? <Pendiente>teléfono</Pendiente>}
        </li>
        {L.registroMercantil && (
          <li>
            <strong>Datos registrales:</strong> {L.registroMercantil}
          </li>
        )}
      </ul>

      <h2>2. Objeto</h2>
      <p>
        Este sitio web tiene carácter informativo y comercial. Presenta el catálogo de producto
        artesanal del titular y permite solicitar información, catálogo y presupuesto para la
        venta al por mayor a empresas, tiendas y distribuidores. No es una tienda en línea: no se
        realizan compras ni pagos a través de esta web.
      </p>

      <h2>3. Condiciones de uso</h2>
      <p>
        El acceso a esta web es gratuito y supone la aceptación de este aviso legal. El usuario se
        compromete a hacer un uso adecuado de los contenidos y a no emplearlos para actividades
        ilícitas, ni para introducir virus o cualquier código que pueda dañar el sitio o a
        terceros.
      </p>
      <p>
        El formulario de contacto es para consultas comerciales. El envío masivo de mensajes
        automatizados o publicitarios a través de él está prohibido.
      </p>

      <h2>4. Propiedad intelectual e industrial</h2>
      <p>
        Los textos, diseños, imágenes, ilustraciones, logotipos y demás elementos de esta web son
        titularidad del titular del sitio o se usan con autorización, y están protegidos por la
        normativa de propiedad intelectual e industrial. Queda prohibida su reproducción,
        distribución o transformación sin autorización expresa y por escrito.
      </p>

      <h2>5. Responsabilidad</h2>
      <p>
        El titular procura que la información publicada sea correcta y esté actualizada, pero no
        garantiza la ausencia de errores ni la disponibilidad continua del servicio. Las
        características, precios, mínimos y plazos que figuren en la web o en el catálogo tienen
        carácter orientativo y se confirman por escrito en cada presupuesto.
      </p>
      <p>
        Esta web puede enlazar a sitios de terceros. El titular no se responsabiliza de sus
        contenidos ni de sus políticas.
      </p>

      <h2>6. Protección de datos</h2>
      <p>
        El tratamiento de los datos personales facilitados a través del formulario se explica en
        la <a href="/artesania/privacidad">política de privacidad</a>.
      </p>

      <h2>7. Legislación aplicable</h2>
      <p>
        Esta relación se rige por la legislación española. Para cualquier controversia, las partes
        se someten a los juzgados y tribunales que correspondan conforme a derecho.
      </p>
    </PaginaLegal>
  );
}
