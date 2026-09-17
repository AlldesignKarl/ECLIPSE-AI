import Catalogo from "@/components/artesania/Catalogo";
import Ciudad from "@/components/artesania/Ciudad";
import Contacto from "@/components/artesania/Contacto";
import Historia from "@/components/artesania/Historia";
import Portada from "@/components/artesania/Portada";
import PorMayor from "@/components/artesania/PorMayor";
import Proceso from "@/components/artesania/Proceso";

/**
 * La web corporativa, de arriba abajo.
 *
 * El orden no es decorativo: es el recorrido de quien entra. Primero quiénes
 * somos y de dónde venimos (portada, historia, ciudad), luego qué vendemos
 * (catálogo), luego por qué a una empresa le interesa (por mayor), luego cómo
 * se trabaja con nosotros (proceso) y por último el formulario, cuando ya tiene
 * motivos para rellenarlo.
 */
export default function Page() {
  return (
    <>
      <Portada />
      <Historia />
      <Ciudad />
      <Catalogo />
      <PorMayor />
      <Proceso />
      <Contacto />
    </>
  );
}
