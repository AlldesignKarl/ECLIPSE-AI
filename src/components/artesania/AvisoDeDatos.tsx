import { EMPRESA, loQueFalta } from "@/lib/artesania/config";
import { hayDondeEntregar } from "@/lib/artesania/entrega";

/**
 * La nota de "esto todavía no está puesto", SOLO en desarrollo.
 * ---------------------------------------------------------------------------
 * En producción devuelve `null` y no llega ni al HTML. Es para quien monta la
 * web, no para quien la visita, y existe por un motivo concreto: los datos que
 * faltan (el teléfono, el correo, el CIF) no se inventan, así que los enlaces
 * que dependen de ellos simplemente NO se pintan. Sin esta nota, eso se ve
 * igual que si el botón estuviera roto.
 *
 * Va en un `<details>` cerrado: HTML de toda la vida, sin una línea de
 * JavaScript, y no tapa la web mientras se trabaja.
 */
export default function AvisoDeDatos() {
  if (process.env.NODE_ENV === "production") return null;

  const falta = loQueFalta();
  const buzon = hayDondeEntregar();
  if (falta.length === 0 && buzon) return null;

  return (
    <details className="fixed bottom-4 left-4 z-[70] max-w-sm rounded-xl border border-amber-400/40 bg-[#1a1408]/95 text-amber-100 shadow-xl backdrop-blur">
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-semibold">
        Pendiente de configurar ({falta.length + (buzon ? 0 : 1)})
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1 text-xs leading-relaxed">
        {falta.length > 0 && (
          <div>
            <p className="font-semibold">
              Datos sin rellenar en <code>src/lib/artesania/config.ts</code>:
            </p>
            <p className="mt-1 text-amber-200/80">{falta.join(" · ")}</p>
          </div>
        )}
        {!buzon && (
          <div>
            <p className="font-semibold">El formulario no tiene dónde entregar.</p>
            <p className="mt-1 text-amber-200/80">
              Pon <code>ARTESANIA_WEBHOOK_URL</code>, o <code>RESEND_API_KEY</code> con{" "}
              <code>ARTESANIA_EMAIL_DESTINO</code>, o conecta la base de datos. Mientras tanto el
              formulario avisa de que no ha podido enviarse en vez de dar las gracias.
            </p>
          </div>
        )}
        <p className="text-amber-200/60">
          Esta nota solo se ve en desarrollo. {EMPRESA.nombre}
        </p>
      </div>
    </details>
  );
}
