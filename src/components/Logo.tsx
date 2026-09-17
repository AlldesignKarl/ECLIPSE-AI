import { EMPRESA } from "@/lib/config";
import Sello from "./Sello";

/**
 * La marca, en su versión pintable.
 *
 * Con logotipo, el logotipo. Sin él, el sello con el monograma. Quien lo usa no
 * tiene que saber cuál de los dos hay: pasa la ruta que le dé el servidor y ya.
 */
export default function Logo({
  ruta,
  tamano = 36,
  className = "",
}: {
  ruta: string | null;
  tamano?: number;
  className?: string;
}) {
  if (!ruta) return <Sello tamano={tamano} className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ruta}
      alt={EMPRESA.nombre}
      className={`w-auto object-contain ${className}`}
      style={{ height: tamano }}
      // La cabecera es lo primero que se ve: este no espera a nada.
      loading="eager"
      decoding="async"
    />
  );
}
