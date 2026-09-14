/**
 * Claro, oscuro, o el que tenga puesto el móvil.
 *
 * Tres opciones y no dos. "El del sistema" no es un adorno: mucha gente lleva
 * el móvil en automático y espera que las aplicaciones la sigan, y quien
 * prefiere uno fijo lo elige y se acabó.
 *
 * Se guarda en el propio dispositivo y no en la cuenta, a propósito: el tema
 * es de la pantalla en la que estás, no tuyo. El móvil de noche y el ordenador
 * de día no tienen por qué ir igual.
 */

export type Tema = "claro" | "oscuro" | "sistema";

export const TEMA_GUARDADO = "eclipse.tema";

export function esTema(v: unknown): v is Tema {
  return v === "claro" || v === "oscuro" || v === "sistema";
}

/** El tema elegido, o el del sistema si no se ha elegido ninguno. */
export function temaGuardado(): Tema {
  try {
    const v = window.localStorage.getItem(TEMA_GUARDADO);
    return esTema(v) ? v : "sistema";
  } catch {
    // Navegador sin almacenamiento: se usa el del sistema y no se guarda nada.
    return "sistema";
  }
}

/** Cuál toca de verdad ahora mismo, resolviendo "sistema". */
export function temaEfectivo(tema: Tema): "claro" | "oscuro" {
  if (tema !== "sistema") return tema;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "oscuro";
  } catch {
    return "oscuro";
  }
}

/**
 * Pintarlo.
 *
 * El atributo se pone en <html> y no en <body> porque el color de fondo de la
 * página lo decide <html>: puesto más abajo, al estirar la página en el móvil
 * asoma una franja del color anterior.
 */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (temaEfectivo(tema) === "claro") raiz.setAttribute("data-tema", "claro");
  else raiz.removeAttribute("data-tema");
}

export function guardarTema(tema: Tema): void {
  try {
    window.localStorage.setItem(TEMA_GUARDADO, tema);
  } catch {
    /* se aplica igual, solo que no se recuerda */
  }
  aplicarTema(tema);
}

/**
 * El guion que corre ANTES de pintar nada.
 *
 * Sin esto se ve el parpadeo: la página arranca oscura —es lo que dice el CSS—
 * y cuando React monta y lee la preferencia, cambia a claro de golpe. Ese
 * fogonazo blanco en un móvil a oscuras es de las cosas que peor sientan.
 *
 * Va como texto para poder meterlo en el <head>, antes de cualquier pintado.
 */
export const GUION_ANTES_DE_PINTAR = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(TEMA_GUARDADO)})||"sistema";
var claro=t==="claro"||(t==="sistema"&&matchMedia("(prefers-color-scheme: light)").matches);
if(claro)document.documentElement.setAttribute("data-tema","claro");
}catch(e){}})();`;
