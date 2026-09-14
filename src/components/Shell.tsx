"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import ChatApp from "./ChatApp";
import InstalarApp from "./InstalarApp";
import Novedades from "./Novedades";
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
  const [ready, setReady] = useState(false);
  const [wantsIn, setWantsIn] = useState(false);
  /*
    Acaba de crear la cuenta: es el mejor momento para ofrecerle instalarla.

    Ahí es cuando ha decidido que esto le sirve. Media hora después ya está
    metido en otra cosa y el aviso es una interrupción; justo al terminar de
    darse de alta, es el paso siguiente natural.
  */
  const [reciénRegistrado, setReciénRegistrado] = useState(false);
  const [auth, setAuth] = useState<{ enabled: boolean; user: string | null; nombre: string }>({
    enabled: false,
    user: null,
    nombre: "",
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

    void fetch("/api/auth")
      .then((r) => r.json())
      .catch(() => ({ enabled: false, user: null }))
      .then((a: { enabled?: boolean; user?: string | null; nombre?: string }) => {
        setAuth({
          enabled: Boolean(a.enabled),
          user: a.user ?? null,
          nombre: a.nombre ?? "",
        });
        setReady(true);
      });
  }, []);

  // Solo se sale de la portada sabiendo si hay cuentas y si hay sesión: si no,
  // se colaría en el chat quien debería estar identificándose.
  useEffect(() => {
    if (!ready || !wantsIn) return;
    setView(auth.enabled && !auth.user ? "entrar" : "app");
  }, [ready, wantsIn, auth]);

  const pantalla =
    view === "portada" ? (
      <Landing
        onEnter={() => {
          remember();
          setWantsIn(true);
          // Quien llega aquí desde dentro de la app ya tenía `wantsIn` puesto,
          // así que el efecto no se dispararía: hay que mandarle de vuelta.
          if (ready) setView(auth.enabled && !auth.user ? "entrar" : "app");
        }}
      />
    ) : view === "entrar" ? (
      <AuthScreen
        enabled={auth.enabled}
        onBack={() => {
          setWantsIn(false);
          setView("portada");
        }}
        onSkip={() => setView("app")}
        onDone={(user, nombre) => {
          setAuth((a) => ({ ...a, user, nombre }));
          remember();
          setReciénRegistrado(true);
          setView("app");
        }}
      />
    ) : (
      <ChatApp
        user={auth.user}
        nombre={auth.nombre}
        onNombre={(nombre) => setAuth((a) => ({ ...a, nombre }))}
        onInicio={() => setView("portada")}
        onSignOut={() => {
          setAuth((a) => ({ ...a, user: null, nombre: "" }));
          setView("entrar");
        }}
      />
    );

  // El aviso de instalar vive fuera de las tres pantallas: se cuenta su espera
  // una sola vez, y no se reinicia cada vez que alguien entra o sale del chat.
  return (
    <>
      {pantalla}
      <Novedades />
      <InstalarApp forzar={reciénRegistrado} />
    </>
  );
}
