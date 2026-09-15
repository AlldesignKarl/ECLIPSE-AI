"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import ChatApp from "./ChatApp";
import InstalarApp from "./InstalarApp";
import Novedades from "./Novedades";
import Landing from "./Landing";
import { VERSION } from "@/lib/novedades";

/** Para no recargar dos veces seguidas si la versión no cuadrara nunca. */
const RECARGADO = "eclipse.recargado";

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
  const [auth, setAuth] = useState<{
    enabled: boolean;
    user: string | null;
    nombre: string;
    foto: string;
  }>({
    enabled: false,
    user: null,
    nombre: "",
    foto: "",
  });

  const remember = useCallback(() => {
    try {
      window.localStorage.setItem(ENTERED, "1");
    } catch {
      /* da igual: entrará igual, solo que verá la portada otra vez */
    }
  }, []);

  useEffect(() => {
    /*
      Una invitación a un grupo entra directa.

      Quien recibe el enlace por WhatsApp no ha visto esta aplicación en su
      vida: enseñarle primero la portada y obligarle a buscar dónde se entra es
      perderlo ahí mismo. Si la dirección trae una invitación, va dentro.
    */
    try {
      if (new URLSearchParams(window.location.search).get("grupo")) setWantsIn(true);
    } catch {
      /* dirección rara: se sigue como siempre */
    }

    try {
      if (window.localStorage.getItem(ENTERED) === "1") setWantsIn(true);
    } catch {
      /* navegador sin almacenamiento: se queda en la portada */
    }

    void fetch("/api/auth")
      .then((r) => r.json())
      .catch(() => ({ enabled: false, user: null }))
      .then((a: {
        enabled?: boolean;
        user?: string | null;
        nombre?: string;
        foto?: string;
        version?: string;
      }) => {
        /*
          Si el servidor tiene otra versión, se recarga sola. Una vez.

          Pasó de verdad y costó entender por qué: en el móvil de Carlos salían
          las conexiones nuevas —que vienen del servidor— con los logos viejos,
          que viven en el JavaScript de la página. Era la página de antes,
          guardada en el navegador, hablando con el servidor de ahora. Desde
          fuera eso no se ve como "tengo una versión vieja", se ve como "esto
          está mal hecho".

          La marca en `sessionStorage` es la red de seguridad: si por lo que
          fuera la versión no coincidiera nunca, esto recargaría en bucle, y un
          bucle de recargas es peor que cualquier versión vieja.
        */
        try {
          if (a.version && a.version !== VERSION && !window.sessionStorage.getItem(RECARGADO)) {
            window.sessionStorage.setItem(RECARGADO, a.version);
            window.location.reload();
            return;
          }
        } catch {
          /* sin sessionStorage no se recarga: mejor viejo que en bucle */
        }

        setAuth({
          enabled: Boolean(a.enabled),
          user: a.user ?? null,
          nombre: a.nombre ?? "",
          foto: a.foto ?? "",
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
        foto={auth.foto}
        onNombre={(nombre) => setAuth((a) => ({ ...a, nombre }))}
        onInicio={() => setView("portada")}
        onSignOut={() => {
          setAuth((a) => ({ ...a, user: null, nombre: "", foto: "" }));
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
