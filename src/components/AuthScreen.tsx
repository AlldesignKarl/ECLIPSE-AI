"use client";

import { useState } from "react";
import EclipseMark from "./EclipseMark";
import * as Icon from "./Icons";

interface Props {
  onDone: (email: string) => void;
  onBack: () => void;
  /** Si el servidor todavía no tiene base de datos, no hay cuentas que crear. */
  enabled: boolean;
  onSkip: () => void;
}

export default function AuthScreen({ onDone, onBack, enabled, onSkip }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = mode === "signup";

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: signup ? "signup" : "login", email, password }),
      });
      const data = (await res.json()) as { user?: string; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error ?? "No se ha podido continuar.");
      onDone(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido continuar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-void">
      <div className="grid-lines pointer-events-none absolute inset-0" aria-hidden />
      <div className="aurora pointer-events-none absolute inset-0" aria-hidden />

      <nav className="relative mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] text-faint transition hover:text-ink"
        >
          <Icon.ChevronLeft width={16} height={16} />
          Volver
        </button>
      </nav>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-16">
        <div className="flex flex-col items-center">
          <EclipseMark size={92} />
          <h1 className="mt-6 font-serif text-[30px] font-medium leading-tight text-ink">
            {signup ? "Crea tu cuenta" : "Entra en ECLIPSE"}
          </h1>
          <p className="mt-2 text-center text-[13.5px] leading-relaxed text-muted">
            {signup
              ? "Con una cuenta tus conversaciones y tu plan te siguen a cualquier móvil u ordenador."
              : "Con el correo y la contraseña que usaste al crearla."}
          </p>
        </div>

        {!enabled ? (
          <div className="mt-8 rounded-2xl border border-line-soft bg-panel/40 p-5 text-center">
            <p className="text-[13.5px] leading-relaxed text-muted">
              Las cuentas todavía no están activadas en este servidor: falta conectar la base
              de datos donde se guardan.
            </p>
            <button
              onClick={onSkip}
              className="mt-4 w-full rounded-xl bg-ink py-3 text-[14px] font-medium text-void transition hover:opacity-90"
            >
              Entrar sin cuenta
            </button>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
              Funciona todo igual; lo único es que las conversaciones se quedan en este
              dispositivo.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-faint">Correo</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full rounded-xl border border-line bg-panel px-3.5 py-3 text-[15px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] text-faint">Contraseña</span>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    type={show ? "text" : "password"}
                    autoComplete={signup ? "new-password" : "current-password"}
                    placeholder={signup ? "8 caracteres, con números" : "Tu contraseña"}
                    className="w-full rounded-xl border border-line bg-panel py-3 pl-3.5 pr-16 text-[15px] text-ink outline-none transition placeholder:text-faint focus:border-halo/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-faint transition hover:text-muted"
                  >
                    {show ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>
            </div>

            {error && <p className="mt-3 text-[12.5px] leading-relaxed text-danger">{error}</p>}

            <button
              onClick={submit}
              disabled={busy || !email.trim() || !password}
              className="mt-5 w-full rounded-xl bg-ink py-3 text-[14.5px] font-medium text-void transition hover:opacity-90 disabled:bg-line disabled:text-faint"
            >
              {busy ? "Un momento…" : signup ? "Crear cuenta" : "Entrar"}
            </button>

            <button
              onClick={() => {
                setMode(signup ? "login" : "signup");
                setError(null);
              }}
              className="mt-4 text-center text-[13px] text-muted transition hover:text-ink"
            >
              {signup ? "Ya tengo cuenta. Entrar" : "No tengo cuenta. Crear una"}
            </button>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-faint">
              Solo se guarda tu correo y una huella de la contraseña, nunca la contraseña.
              Tus conversaciones siguen guardándose en tu dispositivo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
