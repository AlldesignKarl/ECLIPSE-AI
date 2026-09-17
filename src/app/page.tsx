import Catalogo from "@/components/Catalogo";
import Ciudad from "@/components/Ciudad";
import Contacto from "@/components/Contacto";
import Historia from "@/components/Historia";
import Pilar from "@/components/Pilar";
import Portada from "@/components/Portada";
import PorMayor from "@/components/PorMayor";
import Proceso from "@/components/Proceso";
import Taller from "@/components/Taller";

/**
 * La web corporativa, de arriba abajo.
 *
 * El orden no es decorativo: es el recorrido de quien entra. Primero quiénes
 * somos (portada, historia), luego cómo se hace lo que vendemos (taller), de
 * dónde sale (el Pilar dibujándose y la ciudad), qué vendemos (catálogo), por
 * qué le interesa a una empresa (por mayor), cómo se trabaja con nosotros
 * (proceso) y por último el formulario, cuando ya tiene motivos para
 * rellenarlo.
 *
 * Las dos escenas largas —`Taller` y `Pilar`— van seguidas y en el primer
 * tercio a propósito: es donde alguien todavía está decidiendo si esto merece
 * su tiempo.
 */
export default function Page() {
  return (
    <>
      <Portada />
      <Historia />
      <Taller />
      <Pilar />
      <Ciudad />
      <Catalogo />
      <PorMayor />
      <Proceso />
      <Contacto />
    </>
  );
}
