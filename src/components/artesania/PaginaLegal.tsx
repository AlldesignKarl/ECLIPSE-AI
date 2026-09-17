import type { ReactNode } from "react";

import { EMPRESA } from "@/lib/artesania/config";

/**
 * El molde de las páginas legales.
 *
 * Las tres —aviso legal, privacidad y cookies— son la misma página con otro
 * texto, así que la cabecera, el ancho de lectura y el aire viven aquí y no
 * repetidos tres veces.
 */
export default function PaginaLegal({
  titulo,
  entradilla,
  children,
}: {
  titulo: string;
  entradilla: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="arte-noche arte-grano relative overflow-hidden px-5 pb-16 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
        <div className="mx-auto max-w-7xl">
          <p className="arte-ojal">{EMPRESA.nombreCorto}</p>
          <h1 className="arte-titulo mt-5 max-w-[18ch] text-[var(--arte-texto-claro)]">{titulo}</h1>
          <p className="arte-cuerpo mt-5 max-w-xl">{entradilla}</p>
        </div>
      </header>

      <div className="arte-crema-fondo px-5 py-16 sm:px-8 sm:py-24">
        <article className="arte-prosa mx-auto">{children}</article>
      </div>
    </>
  );
}

/** Un dato de la empresa que todavía no tenemos. Ni se inventa ni se calla. */
export function Pendiente({ children }: { children: ReactNode }) {
  return <span className="arte-pendiente">[{children}]</span>;
}
