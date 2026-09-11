"use client";

import { useEffect, useState } from "react";
import ChatApp from "./ChatApp";
import Landing from "./Landing";

const ENTERED = "eclipse.entered";

/**
 * Quien llega por primera vez ve la portada; quien ya ha entrado alguna vez
 * va directo a la conversación, que es lo que viene a hacer.
 */
export default function Shell() {
  const [view, setView] = useState<"cargando" | "portada" | "app">("cargando");
  const [price, setPrice] = useState("10,00 €");

  useEffect(() => {
    let entered = false;
    try {
      entered = window.localStorage.getItem(ENTERED) === "1";
    } catch {
      /* navegador sin almacenamiento: enseñamos la portada */
    }
    setView(entered ? "app" : "portada");

    void fetch("/api/pro")
      .then((r) => r.json())
      .then((d: { billing?: { price?: string } }) => {
        if (d.billing?.price) setPrice(d.billing.price);
      })
      .catch(() => {});
  }, []);

  // Sin parpadeo: no pintamos nada hasta saber qué toca.
  if (view === "cargando") return <div className="h-dvh bg-void" />;

  if (view === "portada")
    return (
      <Landing
        price={price}
        onEnter={() => {
          try {
            window.localStorage.setItem(ENTERED, "1");
          } catch {
            /* da igual: entrará igual, solo que verá la portada otra vez */
          }
          setView("app");
        }}
      />
    );

  return <ChatApp />;
}
