"use client";

import { useEffect, useRef, useState } from "react";

import { EMPRESA, enlaceCorreo, enlaceTelefono, enlaceWhatsApp } from "@/lib/artesania/config";
import {
  ASUNTOS,
  comoTexto,
  errores as revisar,
  limpiar,
  type Asunto,
  type Solicitud,
} from "@/lib/artesania/solicitud";
import { Revelar } from "./movimiento";
import { alPedir } from "./peticion";
import Sello from "./Sello";

/**
 * El formulario y las formas de contacto.
 * ---------------------------------------------------------------------------
 * Reglas que se cumplen aquí:
 *
 * - No hay ni un botón falso. El teléfono, el correo y WhatsApp SOLO se pintan
 *   si están configurados; lo que no está, no aparece.
 * - Se valida con la MISMA función que el servidor (`lib/artesania/solicitud`).
 *   Una validación distinta en cada lado es un formulario que deja pasar en el
 *   navegador lo que luego rechaza el servidor, sin decir por qué.
 * - Los errores se enseñan al enviar y se limpian al escribir. Marcar en rojo
 *   mientras alguien todavía está tecleando su correo es regañar a destiempo.
 * - Si el servidor no tiene dónde entregar el mensaje, NO se da las gracias: se
 *   dice, y se ofrece el mismo texto ya escrito en un correo. Un "gracias" por
 *   algo que se ha perdido es el peor fallo posible aquí.
 */

const VACIO: Solicitud = {
  nombre: "",
  empresa: "",
  email: "",
  telefono: "",
  mensaje: "",
  asunto: "informacion",
};

type Estado = "quieto" | "enviando" | "enviado" | "fallo";

export default function Contacto() {
  const [datos, setDatos] = useState<Solicitud>(VACIO);
  const [fallos, setFallos] = useState<Partial<Record<keyof Solicitud, string>>>({});
  const [estado, setEstado] = useState<Estado>("quieto");
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinBuzon, setSinBuzon] = useState(false);
  const [trampa, setTrampa] = useState("");
  const primerCampo = useRef<HTMLInputElement>(null);

  // Cuando alguien pulsa "Solicitar catálogo" arriba, llega aquí el asunto y el
  // producto, y el cursor se pone en el primer campo: quien ha pulsado ya ha
  // dicho lo que quiere, no tiene que volver a elegirlo.
  useEffect(
    () =>
      alPedir(({ asunto, producto }) => {
        setDatos((d) => ({ ...d, asunto, producto }));
        setEstado("quieto");
        window.setTimeout(() => primerCampo.current?.focus({ preventScroll: true }), 650);
      }),
    [],
  );

  const escribir = (campo: keyof Solicitud) => (v: string) => {
    setDatos((d) => ({ ...d, [campo]: v }));
    setFallos((f) => (f[campo] ? { ...f, [campo]: undefined } : f));
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "enviando") return;

    const encontrados = revisar(datos);
    if (Object.keys(encontrados).length > 0) {
      setFallos(encontrados);
      setAviso("Faltan cosas por rellenar.");
      setEstado("quieto");
      return;
    }

    setEstado("enviando");
    setAviso(null);
    setSinBuzon(false);

    try {
      const res = await fetch("/api/artesania/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...limpiar(datos), web: trampa }),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as {
        error?: string;
        campos?: Partial<Record<keyof Solicitud, string>>;
        sinBuzon?: boolean;
      };

      if (!res.ok) {
        setEstado("fallo");
        setFallos(cuerpo.campos ?? {});
        setSinBuzon(Boolean(cuerpo.sinBuzon));
        setAviso(cuerpo.error ?? "No hemos podido enviar tu mensaje. Inténtalo otra vez.");
        return;
      }

      setEstado("enviado");
      setDatos(VACIO);
    } catch {
      // Sin conexión o servidor caído. No se pierde lo escrito: sigue en los
      // campos, y debajo aparece el correo directo con el mismo texto dentro.
      setEstado("fallo");
      setSinBuzon(true);
      setAviso("No hemos podido conectar. Revisa tu conexión o escríbenos directamente.");
    }
  }

  /** El mismo mensaje, pero por correo. El plan B cuando el envío falla. */
  const correoDeRespaldo = enlaceCorreo(
    `${ASUNTOS[datos.asunto]}${datos.empresa ? ` · ${datos.empresa}` : ""}`,
    comoTexto(limpiar(datos)),
  );

  const tel = enlaceTelefono();
  const wa = enlaceWhatsApp("Hola, os escribo desde la web sobre venta al por mayor.");
  const correo = enlaceCorreo("Consulta desde la web");

  return (
    <section
      id="contacto"
      className="arte-noche arte-grano relative overflow-hidden py-24 sm:py-32"
      aria-labelledby="contacto-titulo"
    >
      <div className="arte-filo absolute inset-x-0 top-0 h-px" />

      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        {/* --------------------------- Las vías directas --------------------
            Se queda fija mientras se rellena el formulario: el correo y el
            teléfono siguen a la vista si alguien prefiere llamar a mitad de
            escribir, y de paso no queda media pantalla vacía a la izquierda. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Revelar>
            <p className="arte-ojal">Contacto profesional</p>
          </Revelar>
          <Revelar retraso={90}>
            <h2 id="contacto-titulo" className="arte-titulo mt-6 max-w-[13ch]">
              Hablemos de tu <em className="arte-realce">pedido</em>.
            </h2>
          </Revelar>
          <Revelar retraso={160}>
            <p className="arte-cuerpo mt-6 max-w-md">
              Atendemos solo a empresas: tiendas, distribuidores, museos, hoteles y compras
              corporativas. Cuéntanos qué necesitas y te contestamos con una propuesta.
            </p>
          </Revelar>

          <Revelar retraso={220}>
            <ul className="mt-10 space-y-4">
              {correo && EMPRESA.email && (
                <li>
                  <a
                    href={correo}
                    className="arte-cristal-oscuro flex items-center gap-4 rounded-2xl px-5 py-4 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <span className="text-[var(--arte-oro-claro)]">
                      <Sello tamano={36} />
                    </span>
                    <span>
                      <span className="block text-xs uppercase tracking-[0.2em] text-[var(--arte-texto-claro-suave)]">
                        Email
                      </span>
                      <span className="block text-[var(--arte-texto-claro)]">{EMPRESA.email}</span>
                    </span>
                  </a>
                </li>
              )}
              {tel && (
                <li>
                  <a
                    href={tel}
                    className="arte-cristal-oscuro flex items-center gap-4 rounded-2xl px-5 py-4 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--arte-borde-claro)] text-[var(--arte-oro-claro)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />
                      </svg>
                    </span>
                    <span>
                      <span className="block text-xs uppercase tracking-[0.2em] text-[var(--arte-texto-claro-suave)]">
                        Teléfono
                      </span>
                      <span className="block text-[var(--arte-texto-claro)]">{EMPRESA.telefono}</span>
                    </span>
                  </a>
                </li>
              )}
              {wa && (
                <li>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="arte-cristal-oscuro flex items-center gap-4 rounded-2xl px-5 py-4 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--arte-borde-claro)] text-[var(--arte-oro-claro)]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6a11 11 0 0 1-4.2-3.9c-.3-.5-.8-1.4-.8-2.6 0-1.2.6-1.8.9-2 .2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.3.4-.3.3c-.1.1-.2.3 0 .5a8 8 0 0 0 3.7 3.2c.3.1.4.1.6-.1l.8-1c.2-.2.3-.2.5-.1l2 .9c.2.1.3.2.4.3 0 .1 0 .6-.2 1.1Z" />
                      </svg>
                    </span>
                    <span>
                      <span className="block text-xs uppercase tracking-[0.2em] text-[var(--arte-texto-claro-suave)]">
                        WhatsApp
                      </span>
                      <span className="block text-[var(--arte-texto-claro)]">Escribir por WhatsApp</span>
                    </span>
                  </a>
                </li>
              )}
            </ul>
          </Revelar>

          {!EMPRESA.email && !tel && !wa && (
            <Revelar retraso={260}>
              <p className="arte-cuerpo mt-8 rounded-2xl border border-dashed border-[var(--arte-borde-claro)] px-5 py-4">
                El teléfono y el correo se publicarán en cuanto estén confirmados. Mientras tanto,
                el formulario funciona y lo leemos igual.
              </p>
            </Revelar>
          )}

          {(EMPRESA.direccion || EMPRESA.horario) && (
            <Revelar retraso={300}>
              <div className="mt-8 border-t border-[var(--arte-borde-claro)] pt-6 text-sm text-[var(--arte-texto-claro-suave)]">
                {EMPRESA.direccion && (
                  <p>
                    {EMPRESA.direccion}
                    <br />
                    {EMPRESA.ciudad}
                  </p>
                )}
                {EMPRESA.horario && <p className="mt-3">{EMPRESA.horario}</p>}
              </div>
            </Revelar>
          )}
        </div>

        {/* ------------------------------ El formulario --------------------- */}
        <Revelar como="escala" retraso={120}>
          <div className="arte-cristal-oscuro rounded-[1.5rem] p-6 sm:p-10">
            {estado === "enviado" ? (
              <div className="py-10 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[var(--arte-oro)] text-[var(--arte-oro-claro)]">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                </span>
                <h3 className="arte-subtitulo mt-6 text-[var(--arte-texto-claro)]">
                  Mensaje enviado.
                </h3>
                <p className="arte-cuerpo mx-auto mt-3 max-w-sm">
                  Lo leemos y te contestamos con una propuesta. Si es urgente, llámanos y vamos
                  directos al grano.
                </p>
                <button
                  type="button"
                  onClick={() => setEstado("quieto")}
                  className="arte-boton-fantasma mt-8 text-[var(--arte-texto-claro)]"
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={enviar} noValidate>
                <fieldset className="border-0 p-0">
                  <legend className="arte-etiqueta mb-3">Para qué escribes</legend>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ASUNTOS) as Asunto[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setDatos((d) => ({ ...d, asunto: a }))}
                        aria-pressed={datos.asunto === a}
                        className={`rounded-full border px-4 py-2 text-sm transition-all duration-300 ${
                          datos.asunto === a
                            ? "border-[var(--arte-oro)] bg-[var(--arte-oro)]/15 text-[var(--arte-oro-claro)]"
                            : "border-[var(--arte-borde-claro)] text-[var(--arte-texto-claro-suave)] hover:border-[var(--arte-oro)]"
                        }`}
                      >
                        {ASUNTOS[a]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {datos.producto && (
                  <p className="mt-4 inline-flex items-center gap-3 rounded-full border border-[var(--arte-borde-claro)] px-4 py-2 text-sm text-[var(--arte-texto-claro)]">
                    Sobre: <strong className="font-semibold">{datos.producto}</strong>
                    <button
                      type="button"
                      onClick={() => setDatos((d) => ({ ...d, producto: undefined }))}
                      className="text-[var(--arte-texto-claro-suave)] transition-colors hover:text-[var(--arte-oro-claro)]"
                      aria-label="Quitar el producto"
                    >
                      ✕
                    </button>
                  </p>
                )}

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Campo
                    id="nombre"
                    etiqueta="Nombre"
                    valor={datos.nombre}
                    alEscribir={escribir("nombre")}
                    fallo={fallos.nombre}
                    autoComplete="name"
                    refCampo={primerCampo}
                    requerido
                  />
                  <Campo
                    id="empresa"
                    etiqueta="Empresa"
                    valor={datos.empresa}
                    alEscribir={escribir("empresa")}
                    fallo={fallos.empresa}
                    autoComplete="organization"
                    requerido
                  />
                  <Campo
                    id="email"
                    etiqueta="Email"
                    tipo="email"
                    valor={datos.email}
                    alEscribir={escribir("email")}
                    fallo={fallos.email}
                    autoComplete="email"
                    modo="email"
                    requerido
                  />
                  <Campo
                    id="telefono"
                    etiqueta="Teléfono (opcional)"
                    tipo="tel"
                    valor={datos.telefono}
                    alEscribir={escribir("telefono")}
                    fallo={fallos.telefono}
                    autoComplete="tel"
                    modo="tel"
                  />
                </div>

                <div className="mt-5">
                  <label htmlFor="mensaje" className="arte-etiqueta">
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    rows={5}
                    value={datos.mensaje}
                    onChange={(e) => escribir("mensaje")(e.target.value)}
                    aria-invalid={Boolean(fallos.mensaje)}
                    aria-describedby={fallos.mensaje ? "mensaje-error" : undefined}
                    className="arte-campo resize-y"
                    placeholder="Qué producto te interesa, para qué tipo de negocio y qué cantidad manejas."
                    required
                  />
                  {fallos.mensaje && (
                    <p id="mensaje-error" className="mt-2 text-sm text-[#f0a9a9]">
                      {fallos.mensaje}
                    </p>
                  )}
                </div>

                {/* El campo trampa. Para una persona no existe. */}
                <div className="arte-trampa" aria-hidden="true">
                  <label htmlFor="web">No rellenar</label>
                  <input
                    id="web"
                    name="web"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={trampa}
                    onChange={(e) => setTrampa(e.target.value)}
                  />
                </div>

                <div className="mt-7 flex flex-col gap-4">
                  <button type="submit" disabled={estado === "enviando"} className="arte-boton w-full">
                    {estado === "enviando" ? "Enviando…" : "Enviar solicitud"}
                  </button>

                  {/* `aria-live`: quien no ve la pantalla se entera igual de que
                      ha habido un problema, sin tener que buscarlo. */}
                  <p aria-live="polite" className="min-h-[1.25rem] text-sm text-[#f0a9a9]">
                    {aviso}
                  </p>

                  {sinBuzon && correoDeRespaldo && (
                    <a href={correoDeRespaldo} className="arte-boton-claro w-full">
                      Enviarlo por correo
                    </a>
                  )}

                  <p className="text-xs leading-relaxed text-[var(--arte-texto-claro-suave)]">
                    Al enviar aceptas que tratemos tus datos para responderte. Puedes leer cómo en
                    la{" "}
                    <a href="/artesania/privacidad" className="underline underline-offset-2">
                      política de privacidad
                    </a>
                    .
                  </p>
                </div>
              </form>
            )}
          </div>
        </Revelar>
      </div>
    </section>
  );
}

/** Un campo del formulario, con su etiqueta, su error y su accesibilidad. */
function Campo({
  id,
  etiqueta,
  valor,
  alEscribir,
  fallo,
  tipo = "text",
  autoComplete,
  modo,
  requerido,
  refCampo,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alEscribir: (v: string) => void;
  fallo?: string;
  tipo?: string;
  autoComplete?: string;
  /** El teclado que sale en el móvil: el de correo trae la arroba puesta. */
  modo?: "email" | "tel";
  requerido?: boolean;
  refCampo?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <label htmlFor={id} className="arte-etiqueta">
        {etiqueta}
      </label>
      <input
        ref={refCampo}
        id={id}
        name={id}
        type={tipo}
        inputMode={modo}
        value={valor}
        onChange={(e) => alEscribir(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(fallo)}
        aria-describedby={fallo ? `${id}-error` : undefined}
        required={requerido}
        className="arte-campo"
      />
      {fallo && (
        <p id={`${id}-error`} className="mt-2 text-sm text-[#f0a9a9]">
          {fallo}
        </p>
      )}
    </div>
  );
}
