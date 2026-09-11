"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import ChatApp from "./ChatApp";
import Landing from "./Landing";

const ENTERED = "eclipse.entered";

type View = "cargando" | "portada" | "entrar" | "app";

/**
 * Quién ve qué.
 *
 * Con las cuentas activadas, a la aplicación se entra con correo y contraseña.
 * Si el servidor todavía no tiene base de datos, no se puede obligar a nadie a
 * registrarse en algo que no existe: entonces se pasa de largo, como antes.
 */
export default function Shell() {
  const [view, setView] = useState<View>("cargando");
  const [price, setPrice] = useState("10,00 €");
  const [auth, setAuth] = useState<{ enabled: boolean; user: string | null }>({
    enabled: false,
    user: null,
  });

  const remember = useCallback(() => {
    try {
      window.localStorage.setItem(ENTERED, "1");
    } catch {
      /* da igual: entrará igual, solo que verá la portada otra vez */
    }
  }, []);

  useEffect(() => {
    let entered = false;
    try {
      entered = window.localStorage.getItem(ENTERED) === "1";
    } catch {
      /* navegador sin almacenamiento: enseñamos la portada */
    }

    void Promise.all([
      fetch("/api/auth")
        .then((r) => r.json())
        .catch(() => ({ enabled: false, user: null })),
      fetch("/api/pro")
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(([a, p]: [{ enabled?: boolean; user?: string | null }, { billing?: { price?: string } }]) => {
      const enabled = Boolean(a.enabled);
      const user = a.user ?? null;
      setAuth({ enabled, user });
      if (p.billing?.price) setPrice(p.billing.price);

      // Con cuentas activadas y sin sesión, toca identificarse antes de entrar.
      if (enabled && !user) setView(entered ? "entrar" : "portada");
      else setView(entered ? "app" : "portada");
    });
  }, []);

  // Sin parpadeo: no pintamos nada hasta saber qué toca.
  if (view === "cargando") return <div className="h-dvh bg-void" />;

  if (view === "portada")
    return (
      <Landing
        price={price}
        onEnter={() => {
          remember();
          setView(auth.enabled && !auth.user ? "entrar" : "app");
        }}
      />
    );

  if (view === "entrar")
    return (
      <AuthScreen
        enabled={auth.enabled}
        onBack={() => setView("portada")}
        onSkip={() => setView("app")}
        onDone={(user) => {
          setAuth((a) => ({ ...a, user }));
          remember();
          setView("app");
        }}
      />
    );

  return (
    <ChatApp
      user={auth.user}
      onSignOut={() => {
        setAuth((a) => ({ ...a, user: null }));
        setView("entrar");
      }}
    />
  );
}
