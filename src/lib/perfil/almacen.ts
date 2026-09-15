import { get, set, del, storeAvailable } from "../store";
import { acumular, observar, perfilVacio, type Perfil } from "./tipos";

/**
 * Dónde vive el perfil de comunicación.
 *
 * Colgando de la cuenta y no del navegador, por lo mismo que la memoria: si
 * ECLIPSE aprende cómo te gusta que te hablen y eso se queda en un móvil, el
 * primer día que abres el ordenador vuelve a hablarte como a un desconocido.
 *
 * Va en su propia clave y no dentro de la memoria a propósito. Son dos cosas
 * distintas: la memoria son frases sobre TI —tienes una tienda, te llamas
 * así—, y esto son números sobre cómo te gusta que te CONTESTEN. Mezclarlos
 * habría metido seis contadores en la lista que se le enseña a la gente en
 * Ajustes, que es justo donde no pintan nada.
 *
 * Obedece el mismo interruptor que la memoria y se borra con ella. Quien apaga
 * la memoria no espera que se le siga aprendiendo el estilo en silencio.
 */

function clave(email: string): string {
  return `eclipse:perfil:${email}`;
}

export async function perfilDe(email: string): Promise<Perfil> {
  if (!storeAvailable()) return perfilVacio();
  try {
    const raw = await get(clave(email));
    if (!raw) return perfilVacio();
    const v = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as Partial<Perfil>;
    return {
      ejes: v.ejes && typeof v.ejes === "object" ? v.ejes : {},
      idiomas: v.idiomas && typeof v.idiomas === "object" ? v.idiomas : {},
      mensajes: typeof v.mensajes === "number" ? v.mensajes : 0,
      actualizado: typeof v.actualizado === "number" ? v.actualizado : 0,
    };
  } catch {
    // Un perfil ilegible es un perfil que no hay. No es motivo para no contestar.
    return perfilVacio();
  }
}

/**
 * Aprender de UN mensaje: el último, y solo ese.
 *
 * Es importante que sea uno y no la conversación entera. El chat manda todo el
 * historial en cada petición, así que aprender de todo lo que llega contaría el
 * primer mensaje treinta veces y el perfil se clavaría en lo que alguien
 * escribió el primer día. Uno por turno es además exactamente el ritmo gradual
 * que se buscaba.
 */
export async function aprenderDelMensaje(email: string, mensaje: string): Promise<Perfil | null> {
  if (!storeAvailable()) return null;
  const obs = observar(mensaje);
  // Un mensaje que no dice nada de nadie no se guarda: escribir en la base de
  // datos para no cambiar nada es gastar por gastar.
  if (!Object.keys(obs).length) return null;

  const perfil = acumular(await perfilDe(email), obs);
  await set(clave(email), JSON.stringify(perfil));
  return perfil;
}

/** Olvidar cómo habla alguien. Lo llama el botón de borrar la memoria. */
export async function olvidarPerfil(email: string): Promise<void> {
  if (!storeAvailable()) return;
  await del(clave(email));
}
