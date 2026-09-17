"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * El movimiento de la web: aparecer al entrar en pantalla y parallax.
 * ---------------------------------------------------------------------------
 * Todo el scroll de la página pasa por aquí, y está escrito con tres reglas:
 *
 * 1. UN solo observador y UN solo escuchador de scroll para toda la página. Con
 *    treinta componentes registrando cada uno el suyo, el móvil se arrastra.
 * 2. Se LEEN todas las posiciones y DESPUÉS se escriben todos los estilos. Leer
 *    y escribir alternando obliga al navegador a recalcular la página en cada
 *    vuelta del bucle, que es el clásico que convierte un parallax bonito en
 *    una web a tirones.
 * 3. Quien pide menos movimiento no entra en ningún registro: ni observador ni
 *    scroll. No es que se le apague el efecto, es que no se enciende.
 */

function menosMovimiento(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------- Aparecer al entrar ----------------------------- */

const alVerse = new WeakMap<Element, () => void>();
let observador: IntersectionObserver | null = null;

function observadorUnico(): IntersectionObserver {
  if (observador) return observador;
  observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        alVerse.get(entrada.target)?.();
        // Una vez visto, se deja de mirar: lo que ya ha aparecido no vuelve a
        // desaparecer al subir, que es lo que hace que una web se sienta
        // nerviosa en vez de cinematográfica.
        observador?.unobserve(entrada.target);
        alVerse.delete(entrada.target);
      }
    },
    // Se dispara un poco antes de que el elemento llegue al borde: así entra
    // ya en movimiento y no "de golpe" justo en la línea de abajo.
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );
  return observador;
}

/** Envuelve algo para que aparezca cuando entra en pantalla. */
export function Revelar({
  children,
  como,
  retraso = 0,
  className = "",
  as: Etiqueta = "div",
}: {
  children: ReactNode;
  como?: "lado" | "lado-derecho" | "escala" | "cortina";
  /** Milisegundos de espera. Escalonar una fila de tarjetas es lo que la hace
   *  parecer coreografiada en vez de simultánea. */
  retraso?: number;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (menosMovimiento()) {
      el.classList.add("es-visible");
      return;
    }

    // Si ya está en pantalla al cargar (la portada), se enseña en el siguiente
    // fotograma: así la transición se ve en vez de nacer terminada.
    const mostrar = () => el.classList.add("es-visible");
    const obs = observadorUnico();
    alVerse.set(el, mostrar);
    obs.observe(el);

    return () => {
      obs.unobserve(el);
      alVerse.delete(el);
    };
  }, []);

  return (
    <Etiqueta
      ref={ref}
      className={`arte-revelar ${className}`}
      data-como={como}
      style={retraso ? ({ "--retraso": `${retraso}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Etiqueta>
  );
}

/* -------------------------------- Parallax -------------------------------- */

const enParallax = new Map<HTMLElement, number>();
let pedido = false;

function pintar() {
  pedido = false;
  const alto = window.innerHeight;
  // En móvil el recorrido se acorta: la pantalla es más pequeña y el mismo
  // desplazamiento en píxeles se ve como un salto, además de costar más.
  const escala = window.innerWidth < 768 ? 0.45 : 1;

  const medidas: [HTMLElement, number][] = [];
  for (const [el, factor] of enParallax) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -240 || r.top > alto + 240) continue;
    // -1 arriba del todo, 0 en el centro, 1 abajo del todo.
    const centro = (r.top + r.height / 2 - alto / 2) / alto;
    medidas.push([el, centro * factor * escala]);
  }
  for (const [el, desplazo] of medidas) {
    el.style.setProperty("--desplazo", `${desplazo.toFixed(1)}px`);
  }
}

function alMover() {
  if (pedido) return;
  pedido = true;
  requestAnimationFrame(pintar);
}

/**
 * Registra un elemento para que se mueva al ritmo del scroll.
 * `factor` es cuántos píxeles se separa del resto a lo largo de una pantalla
 * entera: positivo va por detrás (más lento), negativo por delante.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(factor = 60) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || menosMovimiento()) return;

    enParallax.set(el, factor);
    if (enParallax.size === 1) {
      window.addEventListener("scroll", alMover, { passive: true });
      window.addEventListener("resize", alMover, { passive: true });
    }
    alMover();

    return () => {
      enParallax.delete(el);
      el.style.removeProperty("--desplazo");
      if (enParallax.size === 0) {
        window.removeEventListener("scroll", alMover);
        window.removeEventListener("resize", alMover);
      }
    };
  }, [factor]);

  return ref;
}

/* ------------------------- Cuánto llevas de sección ----------------------- */

/**
 * De 0 a 1 según lo que ha recorrido una sección por delante de la pantalla.
 *
 * Es lo que permite contar una historia con el scroll: la portada se desvanece,
 * el hilo del proceso se va llenando y el paso en el que estás se enciende. Se
 * guarda en un estado redondeado a centésimas para no repintar React sesenta
 * veces por segundo por un cambio que no se ve.
 */
export function useProgreso<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (menosMovimiento()) {
      setProgreso(1);
      return;
    }

    let pendiente = false;
    const medir = () => {
      pendiente = false;
      const r = el.getBoundingClientRect();
      const recorrido = r.height + window.innerHeight;
      const hecho = (window.innerHeight - r.top) / recorrido;
      setProgreso(Math.round(Math.min(1, Math.max(0, hecho)) * 100) / 100);
    };
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(medir);
    };

    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll, { passive: true });
    medir();

    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, []);

  return { ref, progreso };
}

/** ¿Ha bajado ya de la portada? Lo usa la cabecera para aparecer. */
export function useHaBajado(umbral = 80): boolean {
  const [bajado, setBajado] = useState(false);

  useEffect(() => {
    let pendiente = false;
    const mirar = () => {
      pendiente = false;
      setBajado(window.scrollY > umbral);
    };
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(mirar);
    };
    window.addEventListener("scroll", alScroll, { passive: true });
    mirar();
    return () => window.removeEventListener("scroll", alScroll);
  }, [umbral]);

  return bajado;
}

/* ------------------------- Escenas que se quedan fijas -------------------- */

/**
 * Una escena que se queda clavada en pantalla mientras sigues bajando.
 * ---------------------------------------------------------------------------
 * Es el "scroll que cuenta algo": un contenedor muy alto (varias pantallas) con
 * dentro un `sticky` que no se mueve. Lo que avanza no es la escena, es el
 * dedo: cada píxel de scroll es un trozo de la animación.
 *
 * El avance se escribe en la variable CSS `--p` (de 0 a 1) DIRECTAMENTE sobre el
 * elemento, sin pasar por React. Es la diferencia entre una animación fluida y
 * una que va a tirones: con estado de React, una escena de cinco pantallas
 * repintaría el árbol entero cientos de veces mientras bajas. En estado solo va
 * el número de paso, que cambia cinco veces en toda la escena.
 *
 * Con "reducir movimiento" no se registra nada y la escena se queda terminada
 * (`--p: 1`): se ve el dibujo acabado y el texto entero, sin bailes.
 */
export function useEscenaFija<T extends HTMLElement = HTMLDivElement>(pasos = 1) {
  const contenedor = useRef<T>(null);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;

    if (menosMovimiento()) {
      el.style.setProperty("--p", "1");
      setPaso(pasos - 1);
      return;
    }

    let pendiente = false;
    let ultimoPaso = -1;

    const pintar = () => {
      pendiente = false;
      const r = el.getBoundingClientRect();
      // Cuánto llevas recorrido DENTRO de la escena: 0 cuando su borde de
      // arriba toca el de la pantalla, 1 cuando el de abajo la abandona.
      const recorrido = Math.max(1, r.height - window.innerHeight);
      const avance = Math.min(1, Math.max(0, -r.top / recorrido));
      el.style.setProperty("--p", avance.toFixed(4));

      const cual = Math.min(pasos - 1, Math.floor(avance * pasos));
      if (cual !== ultimoPaso) {
        ultimoPaso = cual;
        setPaso(cual);
      }
    };

    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(pintar);
    };

    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll, { passive: true });
    pintar();

    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, [pasos]);

  return { contenedor, paso };
}

/**
 * Cuánto llevas leído de la página entera, de 0 a 1.
 *
 * Lo pinta la línea de oro de debajo de la cabecera. En una web larga como esta
 * es la única forma de saber por dónde vas sin una barra de scroll de escritorio
 * —en el móvil no hay— y además se mueve con el dedo, que es justo lo que se
 * pedía: que al bajar pase algo.
 */
export function useAvanceDePagina(): number {
  const [avance, setAvance] = useState(0);

  useEffect(() => {
    let pendiente = false;
    const medir = () => {
      pendiente = false;
      const alto = document.documentElement.scrollHeight - window.innerHeight;
      setAvance(alto <= 0 ? 0 : Math.round((window.scrollY / alto) * 1000) / 1000);
    };
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(medir);
    };
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll, { passive: true });
    medir();
    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, []);

  return avance;
}

/**
 * Llevar a una sección sin recargar y sin dejar la dirección llena de almohadillas.
 *
 * Se usa desde los botones que no son enlaces —"Solicitar catálogo" cambia
 * además el asunto del formulario— para que el scroll sea suave igual que el de
 * los enlaces del menú.
 */
export function irA(id: string) {
  const destino = document.getElementById(id);
  // Desde el aviso legal o la política de privacidad esa sección no está en la
  // página: entonces esto no es un salto, es un enlace a la portada. Sin esta
  // rama, el menú de esas páginas no haría nada al pulsarlo.
  if (!destino) {
    window.location.href = `/#${id}`;
    return;
  }
  const suave = !menosMovimiento();
  destino.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
}
