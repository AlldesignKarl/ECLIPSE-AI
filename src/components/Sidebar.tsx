"use client";

import { useEffect, useMemo, useState } from "react";
import EclipseLogo from "./EclipseLogo";
import * as Icon from "./Icons";
import { groupByDate } from "@/lib/storage";
import type { Conversation, Plan } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  plan: Plan;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Abre una conversación nueva de ECLIPSE CODE. */
  onCode: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onUpgrade: () => void;
  onSettings: () => void;
  /** Abre Conexiones: la tienda, la web y los dominios de quien pregunta. */
  onConexiones: () => void;
  onInicio: () => void;
  /** Correo de la sesión abierta, si la app lleva cuentas. */
  user?: string | null;
  onSignOut?: () => void;
}

export default function Sidebar({
  open,
  onClose,
  conversations,
  activeId,
  plan,
  onSelect,
  onNew,
  onCode,
  onDelete,
  onRename,
  onUpgrade,
  onSettings,
  onConexiones,
  onInicio,
  user = null,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  // Al cerrar el menú se olvida la pregunta: si no, al volver a abrirlo
  // aparecería un "¿Borrarla?" que nadie acaba de pedir.
  useEffect(() => {
    if (!open) setBorrando(null);
  }, [open]);
  const [draft, setDraft] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.messages.some((m) => m.content.toLowerCase().includes(q)),
        )
      : conversations;
    return groupByDate([...filtered].sort((a, b) => b.updatedAt - a.updatedAt));
  }, [conversations, query]);

  const commitRename = (id: string) => {
    const title = draft.trim();
    if (title) onRename(id, title.slice(0, 80));
    setEditing(null);
  };

  return (
    <>
      {/* Fondo oscuro en móvil */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[288px] flex-col border-r border-line-soft bg-surface transition-transform duration-250 ease-out lg:static lg:z-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menú lateral"
      >
        {/* Cabecera */}
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <EclipseLogo size={26} title="ECLIPSE" />
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[0.14em]">ECLIPSE</div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-faint">
              {plan === "pro" ? "Plan Pro" : "Plan Gratis"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition hover:bg-raised hover:text-ink lg:hidden"
            aria-label="Cerrar menú"
          >
            <Icon.Close />
          </button>
        </div>

        <div className="space-y-2 px-3">
          <button
            onClick={() => {
              onNew();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm font-medium text-ink transition hover:border-halo/30 hover:bg-raised"
          >
            <Icon.Plus width={17} height={17} />
            Nueva conversación
          </button>

          {/*
            ECLIPSE CODE vive aquí y no entre los modos del chat porque no es
            una forma de conversar: lo que devuelve son archivos de un proyecto.
            Metido en la caja de escribir era una pestaña más que había que
            acordarse de pulsar; aquí es lo que es, un sitio al que se entra.
          */}
          <button
            onClick={() => {
              onCode();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-pro/25 bg-gradient-to-r from-pro/10 to-transparent px-3.5 py-2.5 text-sm font-medium text-ink transition hover:border-pro/45"
          >
            <Icon.Code width={17} height={17} className="text-pro" />
            <span className="flex-1 text-left tracking-[0.04em]">ECLIPSE CODE</span>
            {plan !== "pro" && <span className="text-[10px] font-semibold text-pro">PRO</span>}
          </button>

          <div className="relative">
            <Icon.Search
              width={15}
              height={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en tus chats"
              className="w-full rounded-xl border border-line-soft bg-panel/60 py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-line focus:bg-panel"
            />
          </div>
        </div>

        {/* Historial */}
        <nav className="scroll-thin mt-3 flex-1 overflow-y-auto px-2 pb-2">
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] leading-relaxed text-faint">
              {query ? "Sin resultados." : "Aquí aparecerán tus conversaciones."}
            </p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="px-3 pb-1 pt-3 text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">
                {group.label}
              </div>
              <ul>
                {group.items.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <li key={c.id} className="group relative">
                      {editing === c.id ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commitRename(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(c.id);
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            onSelect(c.id);
                            onClose();
                          }}
                          onDoubleClick={() => {
                            setEditing(c.id);
                            setDraft(c.title);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg py-2 pl-3 pr-16 text-left text-[13px] transition ${
                            active
                              ? "bg-raised text-ink"
                              : "text-muted hover:bg-panel hover:text-ink"
                          }`}
                        >
                          <span className="truncate">{c.title}</span>
                        </button>
                      )}

                      {/* Siempre a la vista: en un móvil no hay ratón sobre el
                          que pasar, y así estos botones no existían. */}
                      {editing !== c.id && borrando !== c.id && (
                        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5">
                          <button
                            onClick={() => {
                              setEditing(c.id);
                              setDraft(c.title);
                            }}
                            className="rounded-md p-2 text-faint transition hover:bg-line hover:text-ink"
                            aria-label={`Renombrar ${c.title}`}
                          >
                            <Icon.Pencil width={14} height={14} />
                          </button>
                          <button
                            onClick={() => setBorrando(c.id)}
                            className="rounded-md p-2 text-faint transition hover:bg-line hover:text-danger"
                            aria-label={`Eliminar ${c.title}`}
                          >
                            <Icon.Trash width={14} height={14} />
                          </button>
                        </div>
                      )}

                      {/* Un toque de más no puede costar una conversación. */}
                      {borrando === c.id && (
                        <div className="absolute inset-0 flex items-center gap-1.5 rounded-lg bg-panel px-2.5">
                          <span className="flex-1 truncate text-[12px] text-muted">¿Borrarla?</span>
                          <button
                            onClick={() => {
                              onDelete(c.id);
                              setBorrando(null);
                            }}
                            className="rounded-md px-2 py-1 text-[12px] font-medium text-danger transition hover:bg-danger/10"
                          >
                            Borrar
                          </button>
                          <button
                            onClick={() => setBorrando(null)}
                            className="rounded-md px-2 py-1 text-[12px] text-faint transition hover:text-ink"
                          >
                            No
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Pie */}
        <div className="space-y-1 border-t border-line-soft p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {plan === "free" ? (
            <button
              onClick={onUpgrade}
              className="flex w-full items-center gap-2.5 rounded-xl border border-pro/25 bg-gradient-to-r from-pro/12 to-transparent px-3 py-2.5 text-left transition hover:border-pro/45"
            >
              <Icon.Sparkle width={17} height={17} className="text-pro" />
              <span className="flex-1">
                <span className="block text-[13px] font-medium text-ink">Mejorar plan</span>
                <span className="block text-[11px] text-muted">Bots, modo Profundo y velocidad</span>
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-pro/25 bg-pro/8 px-3 py-2.5">
              <Icon.Sparkle width={17} height={17} className="text-pro" />
              <span className="text-[13px] font-medium text-ink">Plan Pro activo</span>
            </div>
          )}

          {/*
            Conexiones va aquí arriba y no escondido dentro de Ajustes.

            Ajustes es donde se toca la aplicación; esto es donde se enchufa el
            negocio de alguien. Es la diferencia entre una casilla y una razón
            para pagar el plan Pro, y una razón para pagar no se guarda en un
            cajón.
          */}
          <button
            onClick={onConexiones}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted transition hover:bg-panel hover:text-ink"
          >
            <Icon.Plug width={16} height={16} />
            <span className="flex-1 text-left">Conexiones</span>
            {plan !== "pro" && <span className="text-[10px] font-semibold text-pro">PRO</span>}
          </button>

          <button
            onClick={onSettings}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted transition hover:bg-panel hover:text-ink"
          >
            <Icon.Settings width={16} height={16} />
            Ajustes
          </button>

          <button
            onClick={onInicio}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted transition hover:bg-panel hover:text-ink"
          >
            <Icon.Home width={16} height={16} />
            Qué es ECLIPSE
          </button>

          {user && (
            <div className="mt-1 border-t border-line-soft pt-2">
              <div className="flex items-center gap-2.5 px-3 py-1.5">
                <Icon.User width={16} height={16} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{user}</span>
              </div>
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-faint transition hover:bg-panel hover:text-ink"
              >
                <Icon.LogOut width={16} height={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
