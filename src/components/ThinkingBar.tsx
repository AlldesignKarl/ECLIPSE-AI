"use client";

import { useEffect, useState } from "react";
import EclipseLogo from "./EclipseLogo";
import { STATUS_LABEL, type Status } from "@/lib/types";

/**
 * El eclipse animado con lo que la IA está haciendo en cada momento.
 * Es lo que el usuario mira mientras espera, así que cuenta el tiempo.
 */
export default function ThinkingBar({ status }: { status: Status }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status === "idle") {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
    // Solo reiniciamos el contador al empezar, no en cada cambio de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === "idle"]);

  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-3 py-1 animate-fade-up">
      <EclipseLogo size={30} active />
      <div className="flex items-baseline gap-2">
        <span className="status-shimmer text-[13.5px] font-medium">{STATUS_LABEL[status]}</span>
        {seconds > 2 && <span className="text-[11.5px] tabular-nums text-faint">{seconds}s</span>}
      </div>
    </div>
  );
}
