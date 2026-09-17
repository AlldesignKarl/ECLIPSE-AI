import { EMPRESA, enlaceCorreo, enlaceTelefono, enlaceWhatsApp } from "@/lib/artesania/config";
import Sello from "./Sello";

/**
 * El pie.
 * ---------------------------------------------------------------------------
 * Aquí abajo es donde una empresa comprueba que hay alguien detrás: datos de
 * contacto, aviso legal y privacidad. Por eso NO es una línea de copyright.
 *
 * Todo sale de `lib/artesania/config.ts`, y lo que no está configurado no se
 * pinta. Un icono de Instagram que lleva a ninguna parte hace más daño que no
 * tener Instagram.
 */

const SECCIONES = [
  { id: "historia", texto: "Quiénes somos" },
  { id: "ciudad", texto: "Zaragoza y El Pilar" },
  { id: "productos", texto: "Productos" },
  { id: "mayoristas", texto: "Venta al por mayor" },
  { id: "proceso", texto: "Cómo trabajamos" },
  { id: "contacto", texto: "Contacto" },
];

const LEGALES = [
  { ruta: "/artesania/aviso-legal", texto: "Aviso legal" },
  { ruta: "/artesania/privacidad", texto: "Política de privacidad" },
  { ruta: "/artesania/cookies", texto: "Cookies" },
];

const REDES: { clave: keyof typeof EMPRESA.redes; nombre: string; trazo: string }[] = [
  {
    clave: "instagram",
    nombre: "Instagram",
    trazo:
      "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4 1 .5.4.8.8 1 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-1 1.4-.4.5-.8.8-1.4 1-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-1-.5-.4-.8-.8-1-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.4.4-.5.8-.8 1.4-1 .4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1Zm0 3.1a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4Zm0 11a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6Zm6.9-11.3a1.6 1.6 0 1 1-3.1 0 1.6 1.6 0 0 1 3.1 0Z",
  },
  {
    clave: "facebook",
    nombre: "Facebook",
    trazo:
      "M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.2-1.5 1.5-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.2H7.4V13h2.8v8h3.3Z",
  },
  {
    clave: "linkedin",
    nombre: "LinkedIn",
    trazo:
      "M6.9 21H3.6V9.4h3.3V21ZM5.2 8a1.9 1.9 0 1 1 0-3.9 1.9 1.9 0 0 1 0 3.9ZM21 21h-3.3v-5.6c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21H10V9.4h3.2V11h.1a3.5 3.5 0 0 1 3.1-1.7c3.3 0 3.9 2.2 3.9 5V21Z",
  },
];

export default function Pie() {
  const correo = enlaceCorreo("Consulta desde la web");
  const tel = enlaceTelefono();
  const wa = enlaceWhatsApp("Hola, os escribo desde la web.");
  const redes = REDES.filter((r) => EMPRESA.redes[r.clave]);

  return (
    <footer className="arte-noche arte-grano relative overflow-hidden pt-20">
      <div className="arte-filo absolute inset-x-0 top-0 h-px" />

      <div className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <span className="flex items-center gap-3 text-[var(--arte-oro-claro)]">
              <Sello tamano={44} />
              <span className="font-serif text-2xl text-[var(--arte-texto-claro)]">
                {EMPRESA.nombreCorto}
              </span>
            </span>
            <p className="arte-cuerpo mt-5 max-w-sm text-sm">{EMPRESA.descripcion}</p>

            {redes.length > 0 && (
              <ul className="mt-7 flex gap-3">
                {redes.map((r) => (
                  <li key={r.clave}>
                    <a
                      href={EMPRESA.redes[r.clave] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={r.nombre}
                      className="grid h-10 w-10 place-items-center rounded-full border border-[var(--arte-borde-claro)] text-[var(--arte-texto-claro-suave)] transition-colors hover:border-[var(--arte-oro)] hover:text-[var(--arte-oro-claro)]"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d={r.trazo} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <nav aria-label="Secciones">
            <h2 className="arte-etiqueta">La web</h2>
            <ul className="space-y-2.5">
              {SECCIONES.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/artesania#${s.id}`}
                    className="text-sm text-[var(--arte-texto-claro-suave)] transition-colors hover:text-[var(--arte-oro-claro)]"
                  >
                    {s.texto}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="arte-etiqueta">Contacto</h2>
            <ul className="space-y-2.5 text-sm text-[var(--arte-texto-claro-suave)]">
              {correo && EMPRESA.email && (
                <li>
                  <a href={correo} className="transition-colors hover:text-[var(--arte-oro-claro)]">
                    {EMPRESA.email}
                  </a>
                </li>
              )}
              {tel && (
                <li>
                  <a href={tel} className="transition-colors hover:text-[var(--arte-oro-claro)]">
                    {EMPRESA.telefono}
                  </a>
                </li>
              )}
              {wa && (
                <li>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--arte-oro-claro)]"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
              {EMPRESA.direccion && (
                <li>
                  {EMPRESA.direccion}
                  <br />
                  {EMPRESA.ciudad}
                </li>
              )}
              {EMPRESA.horario && <li>{EMPRESA.horario}</li>}
              {/* Sin ningún dato puesto, esta columna quedaba vacía y parecía
                  un fallo. Mejor decir qué pasa y llevar al formulario, que sí
                  funciona. */}
              {!EMPRESA.email && !tel && !wa && !EMPRESA.direccion && (
                <li>
                  Publicaremos el teléfono y el correo en cuanto estén confirmados. Mientras tanto,{" "}
                  <a
                    href="/artesania#contacto"
                    className="underline underline-offset-2 transition-colors hover:text-[var(--arte-oro-claro)]"
                  >
                    escríbenos por el formulario
                  </a>
                  .
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-[var(--arte-borde-claro)] pt-7 text-xs text-[var(--arte-texto-claro-suave)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {EMPRESA.nombre}. Todos los derechos reservados.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGALES.map((l) => (
              <li key={l.ruta}>
                <a href={l.ruta} className="transition-colors hover:text-[var(--arte-oro-claro)]">
                  {l.texto}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
