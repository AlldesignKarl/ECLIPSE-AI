"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import * as Icon from "./Icons";
import type { GeneratedFile, Plan } from "@/lib/types";

export interface GithubStatus {
  connected: boolean;
  user: { login: string; name: string | null; avatar_url: string } | null;
  oauthAvailable: boolean;
}

interface Repo {
  full_name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  status: GithubStatus;
  onStatusChange: (s: GithubStatus) => void;
  pending: { files: GeneratedFile[]; title: string } | null;
  plan: Plan;
  onNeedPro: () => void;
}

export default function GithubDialog({
  open,
  onClose,
  status,
  onStatusChange,
  pending,
  plan,
  onNeedPro,
}: Props) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [target, setTarget] = useState("");
  const [newRepo, setNewRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ url: string; repo: string } | null>(null);

  const loadRepos = useCallback(async () => {
    try {
      const res = await fetch("/api/github/repos");
      const data = (await res.json()) as { repos?: Repo[]; error?: string };
      if (res.ok && data.repos) setRepos(data.repos);
    } catch {
      /* la lista es opcional */
    }
  }, []);

  useEffect(() => {
    if (open && status.connected) void loadRepos();
  }, [open, status.connected, loadRepos]);

  useEffect(() => {
    if (pending && !message) setMessage(`Añadir ${pending.title} generado con ECLIPSE`);
    if (pending && !newRepo) setNewRepo(pending.title);
  }, [pending, message, newRepo]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { user?: GithubStatus["user"]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo conectar.");
      onStatusChange({ ...status, connected: true, user: data.user ?? null });
      setToken("");
      void loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await fetch("/api/github", { method: "DELETE" }).catch(() => {});
    onStatusChange({ ...status, connected: false, user: null });
    setRepos([]);
  };

  const push = async () => {
    if (plan !== "pro") {
      onNeedPro();
      return;
    }
    if (!pending) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: target || undefined,
          newRepo: target ? undefined : newRepo,
          branch,
          message,
          files: pending.files,
        }),
      });
      const data = (await res.json()) as { url?: string; repo?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir.");
      setResult({ url: data.url ?? "", repo: data.repo ?? "" });
      void loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="GitHub"
      subtitle={
        status.connected
          ? `Conectado como ${status.user?.login ?? "usuario"}`
          : "Conecta tu cuenta para guardar los proyectos que genere ECLIPSE."
      }
      wide={Boolean(pending)}
    >
      {!status.connected ? (
        <div className="space-y-3">
          {status.oauthAvailable && (
            <>
              <a
                href="/api/github/oauth"
                className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-void transition hover:opacity-90"
              >
                <Icon.Github width={16} height={16} />
                Entrar con GitHub
              </a>
              <div className="flex items-center gap-3 text-[11px] text-faint">
                <span className="h-px flex-1 bg-line-soft" />o usa un token
                <span className="h-px flex-1 bg-line-soft" />
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] text-muted">
              Token de acceso personal (permiso <code className="text-ink">repo</code>)
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder="ghp_…"
              className="w-full rounded-xl border border-line bg-panel px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
            />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
              Créalo en github.com → Settings → Developer settings → Personal access tokens. Se guarda
              en una cookie del servidor, nunca queda expuesto en el navegador.
            </p>
          </div>

          <button
            onClick={connect}
            disabled={busy || !token.trim()}
            className="w-full rounded-xl bg-ink py-2.5 text-[13.5px] font-medium text-void transition disabled:bg-line disabled:text-faint"
          >
            {busy ? "Verificando…" : "Conectar"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pending && (
            <div className="space-y-3 rounded-xl border border-line-soft bg-panel/40 p-3.5">
              <div className="flex items-center gap-2 text-[12.5px] text-ink">
                <Icon.Code width={14} height={14} className="text-halo" />
                Subir <strong className="font-medium">{pending.title}</strong> ·{" "}
                {pending.files.length} archivos
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] text-muted">Repositorio</label>
                <select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    const repo = repos.find((r) => r.full_name === e.target.value);
                    if (repo) setBranch(repo.default_branch);
                  }}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none focus:border-halo/40"
                >
                  <option value="">➕ Crear uno nuevo</option>
                  {repos.map((r) => (
                    <option key={r.full_name} value={r.full_name}>
                      {r.full_name}
                      {r.private ? " (privado)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!target && (
                <div>
                  <label className="mb-1 block text-[11.5px] text-muted">Nombre del repositorio</label>
                  <input
                    value={newRepo}
                    onChange={(e) => setNewRepo(e.target.value)}
                    className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none focus:border-halo/40"
                  />
                  <p className="mt-1 text-[11px] text-faint">Se creará como privado.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11.5px] text-muted">Rama</label>
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none focus:border-halo/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11.5px] text-muted">Mensaje</label>
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none focus:border-halo/40"
                  />
                </div>
              </div>

              <button
                onClick={push}
                disabled={busy || (!target && !newRepo.trim())}
                className="w-full rounded-xl bg-ink py-2.5 text-[13.5px] font-medium text-void transition disabled:bg-line disabled:text-faint"
              >
                {busy ? "Subiendo…" : "Subir a GitHub"}
              </button>

              {result && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-ok/25 bg-ok/8 px-3 py-2 text-[12.5px] text-ok"
                >
                  <Icon.Check width={14} height={14} />
                  Subido a {result.repo}
                  <Icon.External width={12} height={12} />
                </a>
              )}
            </div>
          )}

          {!pending && repos.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11.5px] uppercase tracking-wide text-faint">
                Tus repositorios
              </div>
              <ul className="scroll-thin max-h-64 space-y-0.5 overflow-y-auto">
                {repos.map((r) => (
                  <li key={r.full_name}>
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-muted transition hover:bg-panel hover:text-ink"
                    >
                      <Icon.Github width={14} height={14} />
                      <span className="flex-1 truncate">{r.full_name}</span>
                      {r.private && <span className="text-[10px] text-faint">privado</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={disconnect} className="text-[12.5px] text-faint transition hover:text-danger">
            Desconectar cuenta
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
    </Modal>
  );
}
