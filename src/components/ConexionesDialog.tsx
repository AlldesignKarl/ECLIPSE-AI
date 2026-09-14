"use client";

import { useCallback, useEffect, useState } from "react";
import { logoDe } from "@/lib/conexiones/logos";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { Plan } from "@/lib/types";

/**
 * Conexiones: enchufar ECLIPSE a donde está el negocio.
 *
 * La pantalla tiene un trabajo que no es el de enseñar botones. Quien llega
 * aquí quiere que su tienda se arregle sola, y lo que se encuentra es que hay
 * que ir a Shopify, crear una app, marcar unos permisos y copiar un token. Ese
 * salto es donde se cae la gente. Por eso cada servicio trae sus pasos escritos
 * en cristiano y el enlace directo al sitio: no es documentación, es la mitad
 * del producto.
 *
 * Y una decisión de diseño que es en realidad de seguridad: el interruptor de
 * «dejar que haga cambios» está apagado, separado del formulario y con su
 * consecuencia escrita al lado. Conectar y dar permiso de escritura son dos
 * decisiones distintas, y se toman por separado.
 */

interface Campo {
  id: string;
  etiqueta: string;
  ayuda: string;
  placeholder?: string;
  secreto?: boolean;
}

interface Servicio {
  id: string;
  nombre: string;
  color: string;
  marca: string;
  familia: "tienda" | "web" | "dominio" | "mercado" | "trabajo" | "dinero" | "mensajes";
  resumen: string;
  pasos: string[];
  enlace: string;
  campos: Campo[];
  conectado: boolean;
  cuenta?: string;
  permiso?: "leer" | "escribir";
  conectadoEl?: number;
  admiteEscritura: boolean;
  acciones: { nombre: string; descripcion: string; escribe: boolean }[];
}

interface Estado {
  pro: boolean;
  conCuenta: boolean;
  almacen: boolean;
  servicios: Servicio[];
}

/**
 * Las categorías, como se llaman de cara afuera.
 *
 * Por lo que HACE cada cosa y no por lo que es técnicamente: nadie busca "APIs
 * REST de comercio electrónico", busca "mi tienda". Y en el mismo orden en que
 * la gente los va a querer.
 */
const FAMILIAS: { id: Servicio["familia"] | "todo"; titulo: string }[] = [
  { id: "todo", titulo: "Todo" },
  { id: "tienda", titulo: "Comercio" },
  { id: "dinero", titulo: "Dinero" },
  { id: "trabajo", titulo: "Trabajo" },
  { id: "web", titulo: "Webs" },
  { id: "dominio", titulo: "Dominios" },
  { id: "mensajes", titulo: "Mensajes" },
  { id: "mercado", titulo: "Mercados" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  onUpgrade: () => void;
}

export default function ConexionesDialog({ open, onClose, plan, onUpgrade }: Props) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<Servicio["familia"] | "todo">("todo");

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/conexiones");
      setEstado((await r.json()) as Estado);
    } catch {
      setEstado(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (open) void recargar();
  }, [open, recargar]);

  const conectados = estado?.servicios.filter((s) => s.conectado).length ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conexiones"
      subtitle={
        conectados
          ? `${conectados} cuenta(s) conectada(s). ECLIPSE puede trabajar en ellas.`
          : "Enchufa tu tienda, tu web o tus dominios y ECLIPSE trabaja dentro."
      }
      wide
    >
      <div className="space-y-5">
        {plan !== "pro" ? (
          <Cerrado onUpgrade={onUpgrade} />
        ) : estado && !estado.almacen ? (
          <Aviso texto="Las conexiones necesitan la base de datos, y este servidor todavía no la tiene conectada." />
        ) : estado && !estado.conCuenta ? (
          <Aviso texto="Para conectar una cuenta hay que haber entrado con la tuya: es donde se guardan las claves cifradas, y así te siguen del móvil al ordenador." />
        ) : null}

        {cargando && !estado && <p className="text-[13px] text-faint">Un momento…</p>}

        {estado && (
          <>
            {/* Buscar. Con nueve servicios ya se agradece; con treinta, manda. */}
            <div className="relative">
              <Icon.Search
                width={15}
                height={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar conexiones"
                className="w-full rounded-xl border border-line bg-panel py-2.5 pl-9 pr-3 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
              />
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {FAMILIAS.filter(
                (f) => f.id === "todo" || estado.servicios.some((s) => s.familia === f.id),
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCategoria(f.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] transition ${
                    categoria === f.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {f.titulo}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {estado.servicios
                .filter((s) => categoria === "todo" || s.familia === categoria)
                .filter((s) => {
                  const q = busca.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    s.nombre.toLowerCase().includes(q) || s.resumen.toLowerCase().includes(q)
                  );
                })
                .map((s) => (
                  <Tarjeta
                    key={s.id}
                    servicio={s}
                    puede={plan === "pro" && Boolean(estado.conCuenta && estado.almacen)}
                    abierto={abierto === s.id}
                    onAbrir={() => setAbierto(abierto === s.id ? null : s.id)}
                    onCambio={recargar}
                  />
                ))}
            </div>
          </>
        )}

        <p className="border-t border-line-soft pt-4 text-[11.5px] leading-relaxed text-faint">
          Las claves se guardan cifradas y nunca salen del servidor: ni las ve la IA, ni vuelven a
          tu navegador, ni aparecen en la conversación. Cada conexión empieza en solo lectura, y
          ninguna acción borra nada.
        </p>
      </div>
    </Modal>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-panel/40 p-3.5">
      <p className="text-[12.5px] leading-relaxed text-muted">{texto}</p>
    </div>
  );
}

function Cerrado({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="rounded-xl border border-pro/25 bg-gradient-to-r from-pro/10 to-transparent p-4">
      <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
        <Icon.Sparkle width={15} height={15} className="text-pro" />
        Las conexiones son del plan Pro
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
        Con Pro, ECLIPSE deja de darte consejos sobre tu tienda y se mete dentro a hacerlos: te
        reescribe las fichas, te revisa el SEO, te arregla el DNS y te lee la cartera.
      </p>
      <button
        onClick={onUpgrade}
        className="mt-3 rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-void transition hover:opacity-90"
      >
        Ver el plan Pro
      </button>
    </div>
  );
}

/**
 * El logo de un servicio.
 *
 * Sobre pastilla blanca y no sobre el color de la marca, que es lo primero que
 * se prueba y lo que peor sale: con el fondo teñido, un logo oscuro como el de
 * Notion o GitHub desaparece, y dos marcas de color parecido dejan de
 * distinguirse a golpe de vista. En blanco se ve cada logo como su dueño lo
 * dibujó, y la fila entera queda igual de legible con el tema claro que con el
 * oscuro.
 *
 * Si algún día se añade un servicio sin logo, no se queda un hueco: vuelven
 * las iniciales sobre su color, que para eso siguen guardadas.
 */
function LogoDe({ servicio }: { servicio: Servicio }) {
  const logo = logoDe(servicio.id);

  if (!logo)
    return (
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold text-white"
        style={{ background: servicio.color }}
        aria-hidden
      >
        {servicio.marca}
      </span>
    );

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/10">
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill={logo.color}
        role="img"
        aria-label={logo.titulo}
      >
        <path d={logo.trazo} />
      </svg>
    </span>
  );
}

function Tarjeta({
  servicio,
  puede,
  abierto,
  onAbrir,
  onCambio,
}: {
  servicio: Servicio;
  puede: boolean;
  abierto: boolean;
  onAbrir: () => void;
  onCambio: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [escribir, setEscribir] = useState(servicio.permiso === "escribir");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEscribir(servicio.permiso === "escribir");
  }, [servicio.permiso]);

  const completo = servicio.campos.every((c) => (valores[c.id] ?? "").trim());

  const conectar = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/conexiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicio: servicio.id,
          campos: valores,
          permiso: escribir ? "escribir" : "leer",
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "No se ha podido conectar.");
      setValores({});
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido conectar.");
    } finally {
      setBusy(false);
    }
  };

  const cambiarPermiso = async (quiere: boolean) => {
    setEscribir(quiere);
    setBusy(true);
    try {
      await fetch("/api/conexiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicio: servicio.id, permiso: quiere ? "escribir" : "leer" }),
      });
      onCambio();
    } finally {
      setBusy(false);
    }
  };

  const desconectar = async () => {
    if (!confirm(`¿Desconectar ${servicio.nombre}? La clave se borra del todo.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/conexiones?servicio=${servicio.id}`, { method: "DELETE" });
      onCambio();
    } finally {
      setBusy(false);
    }
  };


  return (
    <div
      className={`rounded-xl border p-3 transition ${
        abierto ? "border-line bg-panel/60" : "border-line-soft bg-panel/30 hover:border-line"
      }`}
    >
      <button onClick={onAbrir} className="flex w-full items-center gap-3 text-left">
        <LogoDe servicio={servicio} />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-ink">{servicio.nombre}</span>
            {servicio.conectado && (
              <span className="shrink-0 rounded-md bg-panel px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                {servicio.permiso === "escribir" ? "puede cambiar" : "solo lee"}
              </span>
            )}
          </span>
          {/*
            Dos líneas y punto. `block` sobra aquí y además estorbaba: pisaba
            el `display` que necesita el recorte, y cada fila se estiraba a
            cinco líneas hasta dejar el catálogo en cuatro servicios por
            pantalla. Lo largo se lee al abrir el servicio.
          */}
          <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">
            {servicio.conectado ? servicio.cuenta : servicio.resumen}
          </span>
        </span>

        {/*
          El botón a la derecha, como en cualquier catálogo de aplicaciones: es
          donde la mano lo busca, y dice de un vistazo qué está puesto y qué no
          sin tener que leer nada.
        */}
        <span
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition ${
            servicio.conectado
              ? "border border-ok/40 text-ok"
              : "bg-ink text-void"
          }`}
        >
          {servicio.conectado ? "Conectado" : "Conectar"}
        </span>
      </button>

      {abierto && (
        <div className="mt-3.5 space-y-3.5 border-t border-line-soft pt-3.5">
          <div>
            <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">Qué sabe hacer</div>
            <ul className="space-y-1">
              {servicio.acciones.map((a) => (
                <li key={a.nombre} className="flex items-start gap-2 text-[12px] leading-relaxed">
                  <span className="mt-[3px] text-faint">{a.escribe ? "✎" : "👁"}</span>
                  <span className="text-muted">{a.descripcion}</span>
                </li>
              ))}
            </ul>
          </div>

          {servicio.conectado ? (
            <>
              {servicio.admiteEscritura && (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={escribir}
                    disabled={busy}
                    onChange={(e) => void cambiarPermiso(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-white"
                  />
                  <span>
                    <span className="block text-[13px] text-ink">Dejar que haga cambios</span>
                    <span className="block text-[11.5px] leading-relaxed text-faint">
                      Sin esto solo mira. Con esto puede crear y modificar cosas en tu cuenta.
                      Borrar no puede nunca.
                    </span>
                  </span>
                </label>
              )}
              <button
                onClick={() => void desconectar()}
                disabled={busy}
                className="flex items-center gap-2 text-[12.5px] text-faint transition hover:text-danger"
              >
                <Icon.Trash width={14} height={14} />
                Desconectar y borrar la clave
              </button>
            </>
          ) : (
            <>
              <div>
                <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">
                  Cómo se conecta
                </div>
                <ol className="space-y-1.5">
                  {servicio.pasos.map((paso, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-muted">
                      <span className="shrink-0 text-faint">{i + 1}.</span>
                      <span>{paso}</span>
                    </li>
                  ))}
                </ol>
                <a
                  href={servicio.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-ink underline decoration-line underline-offset-2 transition hover:decoration-ink"
                >
                  Abrir {servicio.nombre}
                  <Icon.External width={13} height={13} />
                </a>
              </div>

              <div className="space-y-2.5">
                {servicio.campos.map((c) => (
                  <label key={c.id} className="block">
                    <span className="mb-1 block text-[12px] text-faint">{c.etiqueta}</span>
                    <input
                      value={valores[c.id] ?? ""}
                      onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                      type={c.secreto ? "password" : "text"}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={c.placeholder}
                      disabled={!puede || busy}
                      className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40 disabled:opacity-50"
                    />
                    <span className="mt-1 block text-[11px] leading-relaxed text-faint">{c.ayuda}</span>
                  </label>
                ))}
              </div>

              {servicio.admiteEscritura && (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={escribir}
                    onChange={(e) => setEscribir(e.target.checked)}
                    disabled={!puede || busy}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-white"
                  />
                  <span>
                    <span className="block text-[13px] text-ink">Dejar que haga cambios</span>
                    <span className="block text-[11.5px] leading-relaxed text-faint">
                      Puedes conectarlo sin esto y activarlo después, cuando veas que acierta.
                    </span>
                  </span>
                </label>
              )}

              {error && <p className="text-[12.5px] leading-relaxed text-danger">{error}</p>}

              <button
                onClick={() => void conectar()}
                disabled={!puede || busy || !completo}
                className="w-full rounded-xl bg-ink py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
              >
                {busy ? "Comprobando la clave…" : `Conectar ${servicio.nombre}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
