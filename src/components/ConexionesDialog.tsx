"use client";

import { useCallback, useEffect, useState } from "react";
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
  familia: "tienda" | "web" | "dominio" | "mercado" | "trabajo";
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

const FAMILIAS: { id: Servicio["familia"]; titulo: string; entrada: string }[] = [
  {
    id: "tienda",
    titulo: "Tu tienda",
    entrada: "Catálogo, pedidos, stock y los textos que lee Google en cada ficha.",
  },
  { id: "web", titulo: "Tu web", entrada: "Los textos, los productos y el blog, sin entrar al editor." },
  {
    id: "dominio",
    titulo: "Tus dominios",
    entrada: "El DNS, que es donde todo el mundo se atasca y donde un error deja la web caída.",
  },
  {
    id: "trabajo",
    titulo: "Tu trabajo",
    entrada: "Donde tienes apuntado lo que hay que hacer, y el código en el que trabajas.",
  },
  {
    id: "mercado",
    titulo: "Tus mercados",
    entrada: "La cartera y los precios, para analizarlos. Las órdenes las das tú, siempre.",
  },
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

        {estado &&
          FAMILIAS.map((familia) => {
            const lista = estado.servicios.filter((s) => s.familia === familia.id);
            if (!lista.length) return null;
            return (
              <div key={familia.id}>
                <div className="mb-1 text-[11.5px] uppercase tracking-wide text-faint">
                  {familia.titulo}
                </div>
                <p className="mb-2.5 text-[12px] leading-relaxed text-muted">{familia.entrada}</p>
                <div className="space-y-2">
                  {lista.map((s) => (
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
              </div>
            );
          })}

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
      className={`rounded-xl border p-3.5 transition ${
        servicio.conectado ? "border-ok/30 bg-ok/5" : "border-line-soft bg-panel/40"
      }`}
    >
      <button onClick={onAbrir} className="flex w-full items-start gap-2.5 text-left">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${servicio.conectado ? "bg-ok" : "bg-line"}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[13.5px] font-medium text-ink">{servicio.nombre}</span>
            {servicio.conectado && (
              <span className="rounded-md bg-panel px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                {servicio.permiso === "escribir" ? "puede cambiar" : "solo lectura"}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
            {servicio.conectado ? servicio.cuenta : servicio.resumen}
          </span>
        </span>
        <Icon.ChevronLeft
          width={15}
          height={15}
          className={`mt-1 shrink-0 text-faint transition ${abierto ? "rotate-90" : "-rotate-90"}`}
        />
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
