"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import ChatApp from "./ChatApp";
import Landing from "./Landing";

const ENTERED = "eclipse.entered";

type View = "portada" | "entrar" | "app";

/**
 * Quién ve qué.
 *
 * La portada es lo primero que se dibuja, también en el servidor: es lo que
 * lee Google, y una página que solo se monta en el navegador llega al buscador
 * en blanco. Quien ya entró alguna vez pasa de largo en cuanto se sabe si hay
 * sesión abierta.
 *
 * Con las cuentas activadas se entra con correo y contraseña. Si el servidor
 * todavía no tiene base de datos, no se puede obligar a nadie a registrarse en
 * algo que no existe: entonces se pasa de largo.
 */
export default function Shell() {
  const [view, setView] = useState<View>("portada");
  const [price, setPrice] = useState("10,00 €");
  const [ready, setReady] = useState(false);
  const [wantsIn, setWantsIn] = useState(false);
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
    try {
      if (window.localStorage.getItem(ENTERED) === "1") setWantsIn(true);
    } catch {
      /* navegador sin almacenamiento: se queda en la portada */
    }

    void Promise.all([
      fetch("/api/auth")
        .then((r) => r.json())
        .catch(() => ({ enabled: false, user: null })),
      fetch("/api/pro")
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(
      ([a, p]: [{ enabled?: boolean; user?: string | null }, { billing?: { price?: string } }]) => {
        setAuth({ enabled: Boolean(a.enabled), user: a.user ?? null });
        if (p.billing?.price) setPrice(p.billing.price);
        setReady(true);
      },
    );
  }, []);

  // Solo se sale de la portada sabiendo si hay cuentas y si hay sesión: si no,
  // se colaría en el chat quien debería estar identificándose.
  useEffect(() => {
    if (!ready || !wantsIn) return;
    setView(auth.enabled && !auth.user ? "entrar" : "app");
  }, [ready, wantsIn, auth]);

  if (view === "portada")
    return (
      <Landing
        price={price}
        onEnter={() => {
          remember();
          setWantsIn(true);
        }}
      />
    );

  if (view === "entrar")
    return (
      <AuthScreen
        enabled={auth.enabled}
        onBack={() => {
          setWantsIn(false);
          setView("portada");
        }}
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
