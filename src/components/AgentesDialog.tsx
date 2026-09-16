"use client";

import { useCallback, useEffect, useState } from "react";

import Modal from "./Modal";
import * as Icon from "./Icons";

/**
 * El Catálogo de Agentes y el panel de cada uno.
 *
 * La regla de esta pantalla es la misma que la del servidor, y por eso se
 * parecen tanto: **nada se pinta como hecho si no se ha hecho**. Un agente al
 * que le falta una conexión no sale "listo" con una nota pequeña debajo; sale
 * en su color de aviso y con lo que falta escrito. Una acción esperando
 * aprobación no aparece en el registro como una acción realizada. Y "Contratar"
 * no dice "contratado y funcionando" cuando no hay cobro configurado: dice lo
 * que ha pasado de verdad.
 *
 * Todo lo que se ve aquí sale del servidor. Esta pantalla no decide nada: ni si
 * un agente puede trabajar, ni si puede escribir, ni si algo se ejecutó. Lo
 * pregunta y lo enseña.
 */

interface Integracion {
  servicio: string;
  nombre: string;
  necesaria: boolean;
  pendiente?: boolean;
}

interface Diagnostico {
  estado: "listo" | "requiere_conexion" | "sin_conector";
  faltan: Integracion[];
  sinConector: Integracion[];
  listas: Integracion[];
  dice: string;
}

interface Contrato {
  agenteId: string;
  /** El de ESTA contratación. Uno distinto por cada compra. */
  instancia: string;
  estado: "activo" | "pausado" | "pendiente_de_pago";
  desde: number;
  suscripcion?: string;
  config: { apagadas: string[]; puedeEscribir: boolean; apruebaAntes: boolean };
}

interface EnLista {
  id: string;
  nombre: string;
  precio: number;
  conPro?: boolean;
  periodo: string;
  resumen: string;
  tono: string;
  integraciones: Integracion[];
  diagnostico: Diagnostico;
  contrato: Contrato | null;
}

interface Ficha {
  id: string;
  nombre: string;
  precio: number;
  conPro?: boolean;
  resumen: string;
  descripcion: string;
  funciones: string[];
  ejemplos: string[];
  integraciones: Integracion[];
  herramientas: string[];
}

/**
 * Cómo se conecta una cosa concreta que este agente necesita.
 *
 * Viene del conector de verdad, no de un texto escrito a mano: sus pasos, lo
 * que te va a pedir y dónde se saca. Por eso puede decir la verdad de cada uno
 * en vez de una frase genérica que sirve para ninguno.
 */
interface Conector {
  servicio: string;
  nombre: string;
  necesaria: boolean;
  pendiente: boolean;
  conectado: boolean;
  cuenta?: string;
  permiso?: string;
  oauth?: string;
  oauthListo?: boolean;
  pide: string[];
  pasos: string[];
  enlace?: string;
}

interface Apunte {
  id: string;
  cuando: number;
  tipo: "encargo" | "accion" | "error" | "aprobacion" | "estado";
  texto: string;
  detalle?: string;
  ok: boolean;
}

interface Pendiente {
  id: string;
  agenteId: string;
  cuando: number;
  servicio: string;
  accion: string;
  porque: string;
}

const TONOS: Record<string, string> = {
  pro: "text-pro",
  ok: "text-ok",
  halo: "text-halo",
  tuyo: "text-ink",
};

/** El color de un estado. Verde solo cuando de verdad puede trabajar. */
function colorDe(d: Diagnostico): string {
  if (d.estado === "listo") return "text-ok";
  if (d.estado === "requiere_conexion") return "text-pro";
  return "text-faint";
}

function cuandoDe(t: number): string {
  const d = new Date(t);
  return `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AgentesDialog({
  open,
  onClose,
  onConectar,
}: {
  open: boolean;
  onClose: () => void;
  /** Llevar a Conexiones abriendo ESE servicio, que es donde se hace de verdad. */
  onConectar: (servicio: string) => void;
}) {
  const [lista, setLista] = useState<EnLista[]>([]);
  const [mensual, setMensual] = useState(0);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinCuenta, setSinCuenta] = useState(false);
  const [cobroListo, setCobroListo] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/agentes");
      const d = (await r.json()) as {
        agentes?: EnLista[];
        mensual?: number;
        sinCuenta?: boolean;
        cobroListo?: boolean;
        almacen?: boolean;
        error?: string;
      };
      if (d.error) return setProblema(d.error);
      setLista(d.agentes ?? []);
      setMensual(d.mensual ?? 0);
      setSinCuenta(Boolean(d.sinCuenta));
      setCobroListo(Boolean(d.cobroListo));
      setProblema(d.almacen === false ? "Los agentes necesitan la base de datos, y este servidor no la tiene." : null);
    } catch {
      setProblema("No se ha podido cargar. Mira la conexión.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    void cargar();
  }, [open, cargar]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={abierto ? (lista.find((a) => a.id === abierto)?.nombre ?? "Agente") : "Catálogo de Agentes"}
      subtitle={
        abierto
          ? undefined
          : mensual
            ? `${mensual} €/mes contratados`
            : "Agentes de IA que trabajan dentro de tus cuentas."
      }
      wide
    >
      {abierto && (
        <button
          onClick={() => {
            setAbierto(null);
            void cargar();
          }}
          className="mb-3 flex items-center gap-1 text-[12.5px] text-faint transition hover:text-ink"
        >
          <Icon.ChevronLeft width={14} height={14} />
          Catálogo
        </button>
      )}

      {problema && (
        <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5 text-[12.5px] leading-relaxed text-muted">
          {problema}
        </div>
      )}

      {!problema && !abierto && (
        <Catalogo
          lista={lista}
          cargando={cargando}
          sinCuenta={sinCuenta}
          cobroListo={cobroListo}
          onAbrir={setAbierto}
        />
      )}

      {!problema && abierto && <Panel id={abierto} onCambio={cargar} onConectar={onConectar} />}
    </Modal>
  );
}

/* ------------------------------- Catálogo -------------------------------- */

function Catalogo({
  lista,
  cargando,
  sinCuenta,
  cobroListo,
  onAbrir,
}: {
  lista: EnLista[];
  cargando: boolean;
  sinCuenta: boolean;
  cobroListo: boolean;
  onAbrir: (id: string) => void;
}) {
  /*
    Los tuyos arriba, y el catálogo debajo.

    Lo pidió Carlos: "una sección donde estén tus agentes comprados". Y tiene
    razón en que sea así y no una pestaña aparte: quien ya tiene dos agentes
    entra a MIRARLOS, no a comprar el tercero. Lo que se usa a diario va
    primero.
  */
  const mios = lista.filter((a) => a.contrato);
  const resto = lista.filter((a) => !a.contrato);

  return (
    <div className="space-y-3">
      {mios.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11.5px] uppercase tracking-wide text-faint">
            Tus agentes
          </div>
          {mios.map((a) => (
            <button
              key={a.id}
              onClick={() => onAbrir(a.id)}
              className="block w-full rounded-xl border border-line bg-panel p-3.5 text-left transition hover:border-halo/30 hover:bg-raised"
            >
              <div className="flex items-baseline gap-2">
                <span className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${TONOS[a.tono] ?? "text-ink"}`}>
                  {a.nombre}
                </span>
                <span
                  className={`shrink-0 text-[11px] ${
                    a.contrato?.estado === "activo"
                      ? "text-ok"
                      : a.contrato?.estado === "pausado"
                        ? "text-faint"
                        : "text-pro"
                  }`}
                >
                  {a.contrato?.estado === "activo"
                    ? "● Activo"
                    : a.contrato?.estado === "pausado"
                      ? "❙❙ En pausa"
                      : "● Pendiente de pago"}
                </span>
              </div>
              <p className={`mt-0.5 text-[12px] leading-relaxed ${colorDe(a.diagnostico)}`}>
                {a.diagnostico.dice}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="text-[11.5px] uppercase tracking-wide text-faint">
        {mios.length ? "Añadir otro" : "Catálogo"}
      </div>

      <p className="text-[12.5px] leading-relaxed text-muted">
        Cada agente trabaja dentro de las cuentas que le conectes: lee, escribe si le das permiso, y
        deja constancia de lo que ha hecho. No son chats con otro nombre.
      </p>

      {/*
        Lo del cobro, dicho arriba y sin rodeos.

        Un catálogo con precios en el que el pago no funciona tiene que decirlo
        antes de que alguien pulse Contratar, no después.
      */}
      {!cobroListo && (
        <div className="flex items-start gap-2.5 rounded-xl border border-pro/25 bg-pro/[0.06] px-3.5 py-3">
          <Icon.Bolt width={15} height={15} className="mt-0.5 shrink-0 text-pro" />
          <p className="text-[12px] leading-relaxed text-muted">
            El cobro todavía no está configurado en este servidor. Puedes contratar para reservar la
            configuración de un agente, pero el contrato quedará <span className="text-ink">pendiente de pago</span> y
            no ejecutará encargos. Nadie te cobra nada.
          </p>
        </div>
      )}

      {sinCuenta && (
        <div className="rounded-xl border border-line-soft bg-panel/40 p-3 text-[12px] leading-relaxed text-muted">
          Puedes mirar el catálogo sin cuenta. Para contratar y conectar servicios hay que entrar con
          la cuenta de la empresa.
        </div>
      )}

      {cargando && <p className="text-[12.5px] text-faint">Un momento…</p>}

      {resto.map((a) => (
        <button
          key={a.id}
          onClick={() => onAbrir(a.id)}
          className="block w-full rounded-xl border border-line-soft bg-panel/40 p-3.5 text-left transition hover:border-line hover:bg-panel"
        >
          <div className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${TONOS[a.tono] ?? "text-ink"}`}>
              {a.nombre}
            </span>
            <span className="shrink-0 text-[13px] font-medium text-ink">
              {a.conPro ? (
                <span className="text-ok">Con Pro</span>
              ) : (
                <>
                  {a.precio} €<span className="text-[11px] text-faint">/mes</span>
                </>
              )}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{a.resumen}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-[11px] ${colorDe(a.diagnostico)}`}>
              {a.diagnostico.estado === "listo"
                ? "● Listo"
                : a.diagnostico.estado === "requiere_conexion"
                  ? "● Requiere conexión"
                  : "● Falta construir la integración"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* --------------------------- Ficha y panel ------------------------------- */

function Panel({
  id,
  onCambio,
  onConectar,
}: {
  id: string;
  onCambio: () => void;
  onConectar: (servicio: string) => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [conectores, setConectores] = useState<Conector[]>([]);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [registro, setRegistro] = useState<Apunte[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [cobroListo, setCobroListo] = useState(false);
  const [vista, setVista] = useState<"ficha" | "ajustes" | "registro">("ficha");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [encargo, setEncargo] = useState("");
  const [respuesta, setRespuesta] = useState<{ texto: string; acciones: { nombre: string; detalle: string; ok: boolean }[]; enEspera: number } | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/agentes?id=${id}`);
    const d = (await r.json()) as {
      agente?: Ficha;
      contrato?: Contrato | null;
      diagnostico?: Diagnostico;
      conectores?: Conector[];
      registro?: Apunte[];
      pendientes?: Pendiente[];
      cobroListo?: boolean;
    };
    if (d.agente) setFicha(d.agente);
    setConectores(d.conectores ?? []);
    setContrato(d.contrato ?? null);
    setDiagnostico(d.diagnostico ?? null);
    setRegistro(d.registro ?? []);
    setPendientes(d.pendientes ?? []);
    setCobroListo(Boolean(d.cobroListo));
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const mandar = async (cuerpo: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/agentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, id }),
      });
      const d = (await r.json()) as Record<string, unknown>;
      if (!r.ok) setError(String(d.error ?? "No se ha podido."));
      if (typeof d.aviso === "string") setAviso(d.aviso);
      await cargar();
      onCambio();
      return { ok: r.ok, d };
    } catch {
      setError("No se ha podido. Mira la conexión.");
      return { ok: false, d: {} as Record<string, unknown> };
    } finally {
      setBusy(false);
    }
  };

  if (!ficha || !diagnostico) return <p className="text-[12.5px] text-faint">Un momento…</p>;

  const activo = contrato?.estado === "activo";
  const puedeTrabajar = activo && diagnostico.estado === "listo";

  const pestaña = (v: typeof vista, texto: string) => (
    <button
      key={v}
      onClick={() => setVista(v)}
      className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] transition ${
        vista === v ? "bg-raised text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="space-y-3.5">
      {/* Estado, arriba del todo y sin adornos. */}
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
        <div className="flex items-baseline gap-2">
          {/* Un agente incluido en Pro poniendo "0 € al mes" se lee como una
              tarifa rara, no como un regalo. Se dice lo que es. */}
          {ficha.conPro ? (
            <>
              <span className="text-[16px] font-semibold text-ok">Incluido</span>
              <span className="text-[11.5px] text-faint">con tu plan Pro</span>
            </>
          ) : (
            <>
              <span className="text-[16px] font-semibold text-ink">{ficha.precio} €</span>
              <span className="text-[11.5px] text-faint">al mes</span>
            </>
          )}
          {contrato && (
            <span className="ml-auto rounded-md bg-raised px-2 py-0.5 text-[11px] text-muted">
              {contrato.estado === "activo" ? "Activo" : contrato.estado === "pausado" ? "En pausa" : "Pendiente de pago"}
            </span>
          )}
        </div>
        <p className={`mt-1.5 text-[12px] leading-relaxed ${colorDe(diagnostico)}`}>{diagnostico.dice}</p>
        {contrato && (
          <p className="mt-1.5 font-mono text-[10px] text-faint" title="El identificador de esta contratación">
            {contrato.instancia}
          </p>
        )}
      </div>

      {aviso && (
        <div className="rounded-xl border border-pro/25 bg-pro/[0.06] p-3 text-[12px] leading-relaxed text-ink">
          {aviso}
        </div>
      )}
      {error && <p className="text-[12.5px] leading-relaxed text-danger">{error}</p>}

      {/* Lo que espera aprobación va SIEMPRE arriba: es lo único que está parado
          por alguien y que nadie más va a mirar. */}
      {pendientes.length > 0 && (
        <div className="rounded-xl border border-pro/30 bg-pro/[0.06] p-3.5">
          <div className="text-[12.5px] font-medium text-ink">
            {pendientes.length === 1 ? "Una acción espera tu aprobación" : `${pendientes.length} acciones esperan tu aprobación`}
          </div>
          <div className="mt-2 space-y-2">
            {pendientes.map((p) => (
              <div key={p.id} className="rounded-lg border border-line-soft bg-void/30 p-2.5">
                <p className="text-[12px] leading-relaxed text-ink">{p.porque}</p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {p.servicio} · {p.accion.replace(/_/g, " ")} · {cuandoDe(p.cuando)}
                </p>
                <div className="mt-1.5 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => void mandar({ accion: "aprobar", pendiente: p.id })}
                    className="rounded-lg bg-ink px-3 py-1 text-[11.5px] font-medium text-void transition hover:opacity-90 disabled:opacity-50"
                  >
                    Aprobar y ejecutar
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void mandar({ accion: "descartar", pendiente: p.id })}
                    className="text-[11.5px] text-faint transition hover:text-danger"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {contrato && (
        <div className="flex gap-1.5 rounded-xl border border-line-soft bg-panel p-1">
          {pestaña("ficha", "Qué hace")}
          {pestaña("ajustes", "Ajustes")}
          {pestaña("registro", "Registro")}
        </div>
      )}

      {(!contrato || vista === "ficha") && (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-ink">{ficha.descripcion}</p>

          <div>
            <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">Lo que hace</div>
            <ul className="space-y-0.5">
              {ficha.funciones.map((f) => (
                <li key={f} className="text-[12.5px] leading-relaxed text-muted">· {f}</li>
              ))}
            </ul>
          </div>

          {/*
            Las integraciones, y CÓMO se conecta cada una.

            Antes esto era una lista de puntitos: "Gmail · requiere conexión" y
            se acababa ahí. Carlos lo dijo así: *"te dice que no está conectado
            a Google, pero tampoco aparece nada de cómo hacerlo"*. Y cada una se
            conecta distinto —Gmail con un permiso, Shopify con un dominio y un
            token, Telegram con el token del bot—, así que lo que se enseña es
            lo de CADA una, sacado de su conector, con el botón que lleva al
            sitio donde se hace.
          */}
          <div>
            <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">
              Qué hay que conectarle
            </div>
            <div className="space-y-1.5">
              {(conectores.length ? conectores : []).map((c) => (
                <div
                  key={c.servicio}
                  className={`rounded-lg border px-3 py-2 ${
                    c.conectado
                      ? "border-line-soft bg-panel/30"
                      : c.pendiente
                        ? "border-line-soft bg-panel/20"
                        : "border-pro/25 bg-pro/[0.05]"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={c.pendiente ? "text-faint" : c.conectado ? "text-ok" : "text-pro"}>
                      {c.conectado ? "●" : "○"}
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-ink">{c.nombre}</span>
                    <span className="shrink-0 text-[11px] text-faint">
                      {c.necesaria ? "necesaria" : "opcional"}
                    </span>
                  </div>

                  {c.conectado ? (
                    <p className="mt-0.5 pl-5 text-[11.5px] leading-relaxed text-faint">
                      Conectada{c.cuenta ? ` a ${c.cuenta}` : ""}
                      {c.permiso === "escribir" ? " · puede hacer cambios" : " · solo mirar"}.
                    </p>
                  ) : c.pendiente ? (
                    <p className="mt-0.5 pl-5 text-[11.5px] leading-relaxed text-faint">
                      Todavía no se puede conectar: nos falta construir esa integración. No es que
                      te falte a ti nada.
                    </p>
                  ) : (
                    <div className="mt-1 pl-5">
                      <p className="text-[11.5px] leading-relaxed text-muted">
                        {c.oauth
                          ? c.oauthListo === false
                            ? "Se conecta dando permiso a Google, pero este servidor todavía no lo tiene configurado."
                            : "Se conecta con tu cuenta de Google, en dos toques y sin darle ninguna contraseña."
                          : c.pide.length
                            ? `Te va a pedir: ${c.pide.join(", ").toLowerCase()}.`
                            : "Se conecta desde Conexiones."}
                      </p>
                      {/* El primer paso, que es el que dice DÓNDE se saca. Los
                          demás están enteros en su ficha de Conexiones, que es
                          adonde lleva el botón. */}
                      {!c.oauth && c.pasos[0] && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{c.pasos[0]}</p>
                      )}
                      {/*
                        Y el botón hace lo que dice.

                        En los de permiso va DIRECTO a la pantalla del
                        proveedor: no hay nada que rellenar, así que pasar antes
                        por Conexiones es un toque de más para leer lo mismo. En
                        los de clave sí lleva a Conexiones, que es donde está el
                        formulario y los pasos para conseguirla.
                      */}
                      {c.oauth && c.oauthListo ? (
                        <a
                          href={`/api/conexiones/oauth/${c.servicio}?empezar=1`}
                          className="mt-1.5 inline-block rounded-lg bg-ink px-3 py-1 text-[11.5px] font-medium text-void transition hover:opacity-90"
                        >
                          Conectar {c.nombre} con Google
                        </a>
                      ) : (
                        <button
                          onClick={() => onConectar(c.servicio)}
                          className="mt-1.5 rounded-lg bg-ink px-3 py-1 text-[11.5px] font-medium text-void transition hover:opacity-90"
                        >
                          {c.oauth ? `Ver por qué no se puede todavía` : `Conectar ${c.nombre}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">
              Encargos de ejemplo
            </div>
            <ul className="space-y-0.5">
              {ficha.ejemplos.map((e) => (
                <li key={e} className="text-[12.5px] leading-relaxed text-muted">«{e}»</li>
              ))}
            </ul>
          </div>

          {!contrato ? (
            <button
              disabled={busy}
              onClick={async () => {
                const { d } = await mandar({ accion: "contratar" });
                /*
                  Si el servidor abre la pasarela, se va a Stripe.

                  El navegador no decide nada aquí: si hay dirección de pago es
                  porque el servidor la ha creado con Stripe, y si no la hay es
                  porque no se puede cobrar y el contrato se queda pendiente.
                */
                if (typeof d.url === "string") window.location.href = d.url;
              }}
              className="w-full rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? "Un momento…"
                : ficha.conPro
                  ? "Activar · incluido con tu plan Pro"
                  : `Contratar · ${ficha.precio} €/mes`}
            </button>
          ) : (
            <Probar
              puede={puedeTrabajar}
              porque={
                !activo
                  ? contrato.estado === "pausado"
                    ? "Está en pausa. Reactívalo en Ajustes."
                    : "El contrato está pendiente de pago, así que no ejecuta encargos."
                  : diagnostico.dice
              }
              encargo={encargo}
              setEncargo={setEncargo}
              respuesta={respuesta}
              busy={busy}
              onProbar={async () => {
                setRespuesta(null);
                const { d } = await mandar({ accion: "encargar", encargo });
                if (typeof d.texto === "string")
                  setRespuesta({
                    texto: d.texto,
                    acciones: (d.acciones as { nombre: string; detalle: string; ok: boolean }[]) ?? [],
                    enEspera: Number(d.enEspera) || 0,
                  });
              }}
            />
          )}

          {!cobroListo && !contrato && (
            <p className="text-[11px] leading-relaxed text-faint">
              El cobro no está configurado: contratar dejará el agente pendiente de pago y no te
              cobrará nada.
            </p>
          )}
        </div>
      )}

      {contrato && vista === "ajustes" && (
        <div className="space-y-3">
          <Interruptor
            puesto={contrato.config.puedeEscribir}
            titulo="Dejar que cambie cosas"
            explica="Sin esto solo mira. Aun activándolo, cada conexión tiene su propio permiso: si la cuenta está en solo lectura, no la toca."
            onCambio={(v) => void mandar({ accion: "config", puedeEscribir: v })}
          />
          <Interruptor
            puesto={contrato.config.apruebaAntes}
            titulo="Pedir aprobación antes de escribir"
            explica="Lo que cambie algo fuera se queda esperando a que alguien lo apruebe aquí. No se ejecuta y luego se avisa: no se ejecuta."
            onCambio={(v) => void mandar({ accion: "config", apruebaAntes: v })}
          />

          <div>
            <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">Herramientas</div>
            <div className="space-y-1.5">
              {ficha.herramientas.map((h) => {
                const apagada = contrato.config.apagadas.includes(h);
                return (
                  <label key={h} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={!apagada}
                      onChange={() =>
                        void mandar({
                          accion: "config",
                          apagadas: apagada
                            ? contrato.config.apagadas.filter((x) => x !== h)
                            : [...contrato.config.apagadas, h],
                        })
                      }
                      className="h-4 w-4 accent-white"
                    />
                    <span className="text-[12.5px] text-ink">{h.replace(/_/g, " ")}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
            {contrato.estado === "activo" && (
              <button
                disabled={busy}
                onClick={() => void mandar({ accion: "pausar" })}
                className="rounded-xl border border-line px-4 py-2 text-[12.5px] text-muted transition hover:text-ink"
              >
                Pausar
              </button>
            )}
            {contrato.estado === "pausado" && (
              <button
                disabled={busy}
                onClick={() => void mandar({ accion: "reactivar" })}
                className="rounded-xl border border-line px-4 py-2 text-[12.5px] text-muted transition hover:text-ink"
              >
                Reactivar
              </button>
            )}
            <button
              disabled={busy}
              onClick={async () => {
                if (!confirm("¿Rescindir el contrato? Se va con su registro y lo que tuviera pendiente.")) return;
                await fetch(`/api/agentes?id=${id}`, { method: "DELETE" });
                await cargar();
                onCambio();
              }}
              className="text-[12px] text-faint transition hover:text-danger"
            >
              Rescindir
            </button>
          </div>
        </div>
      )}

      {contrato && vista === "registro" && (
        <div className="space-y-2">
          {registro.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-muted">
              Todavía no ha hecho nada. Aquí queda todo: lo que sale bien, lo que falla y lo que se
              queda esperando aprobación.
            </p>
          ) : (
            registro.map((a) => (
              <div key={a.id} className="rounded-lg border border-line-soft bg-panel/40 p-2.5">
                <div className="flex items-baseline gap-2">
                  <span className={a.ok ? "text-ok" : a.tipo === "error" ? "text-danger" : "text-pro"}>
                    {a.ok ? "✓" : a.tipo === "error" ? "✗" : "⏸"}
                  </span>
                  <span className="min-w-0 flex-1 text-[12.5px] text-ink">{a.texto}</span>
                  <span className="shrink-0 text-[10.5px] text-faint">{cuandoDe(a.cuando)}</span>
                </div>
                {a.detalle && (
                  <p className="mt-0.5 pl-5 text-[11.5px] leading-relaxed text-muted">{a.detalle}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Piezas ---------------------------------- */

function Interruptor({
  puesto,
  titulo,
  explica,
  onCambio,
}: {
  puesto: boolean;
  titulo: string;
  explica: string;
  onCambio: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-soft bg-panel/40 p-3">
      <input
        type="checkbox"
        checked={puesto}
        onChange={(e) => onCambio(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-white"
      />
      <span>
        <span className="block text-[13px] text-ink">{titulo}</span>
        <span className="block text-[11.5px] leading-relaxed text-faint">{explica}</span>
      </span>
    </label>
  );
}

/**
 * Probar el agente. De verdad o nada.
 *
 * Si puede trabajar, se le da el encargo y se enseña lo que ha hecho, con sus
 * acciones y sus fallos. Si NO puede, no se finge una ejecución bonita: se dice
 * qué falta. Un botón de probar que siempre devuelve algo es un anuncio, no una
 * prueba.
 */
function Probar({
  puede,
  porque,
  encargo,
  setEncargo,
  respuesta,
  busy,
  onProbar,
}: {
  puede: boolean;
  porque: string;
  encargo: string;
  setEncargo: (v: string) => void;
  respuesta: { texto: string; acciones: { nombre: string; detalle: string; ok: boolean }[]; enEspera: number } | null;
  busy: boolean;
  onProbar: () => void;
}) {
  if (!puede)
    return (
      <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
        <div className="text-[12.5px] font-medium text-ink">No se puede probar todavía</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">{porque}</p>
      </div>
    );

  return (
    <div className="space-y-2">
      <textarea
        value={encargo}
        onChange={(e) => setEncargo(e.target.value)}
        placeholder="Dile lo que quieres que haga…"
        rows={3}
        maxLength={2000}
        className="w-full resize-none rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
      />
      <button
        disabled={busy || !encargo.trim()}
        onClick={onProbar}
        className="w-full rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
      >
        {busy ? "Trabajando…" : "Ponérselo"}
      </button>

      {respuesta && (
        <div className="space-y-2 rounded-xl border border-line-soft bg-panel/40 p-3.5">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{respuesta.texto}</p>
          {respuesta.acciones.length > 0 && (
            <div className="border-t border-line-soft pt-2">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-faint">Lo que ha tocado</div>
              {respuesta.acciones.map((a, i) => (
                <div key={i} className="text-[11.5px] text-muted">
                  <span className={a.ok ? "text-ok" : "text-danger"}>{a.ok ? "✓" : "✗"}</span>{" "}
                  {a.nombre} {a.detalle && `· ${a.detalle}`}
                </div>
              ))}
            </div>
          )}
          {respuesta.enEspera > 0 && (
            <p className="text-[11.5px] leading-relaxed text-pro">
              {respuesta.enEspera === 1
                ? "Una acción ha quedado esperando tu aprobación. NO se ha ejecutado."
                : `${respuesta.enEspera} acciones han quedado esperando tu aprobación. NO se han ejecutado.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
