import { borrarUsuario, contrasenaCorrecta, currentUser } from "./auth";
import { olvidarTodasLasDe } from "./conexiones/almacen";
import { olvidarExamenesDe } from "./examen/almacen";
import { salirDeTodos } from "./grupos/almacen";
import { olvidarTodo as olvidarMemoriaDe } from "./memoria/almacen";
import { olvidarTareasDe } from "./tareas/almacen";

/**
 * Irse del todo.
 *
 * Una aplicación que promete que tus cosas son tuyas tiene que dejarte llevarte
 * la promesa hasta el final: si te vas, no se queda nada. Aquí está todo lo que
 * hay de una persona en el servidor, en un solo sitio, para que el día que se
 * añada algo nuevo se vea de un vistazo que falta borrarlo.
 *
 * Lo que NO está aquí es lo que nunca estuvo en el servidor: las
 * conversaciones, que viven en el móvil y se borran desde Ajustes, y las claves
 * de motor, que están en una cookie de ese navegador.
 */
export async function borrarTodoLoMio(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await currentUser();
  if (!email) return { ok: false, error: "Hay que haber entrado con tu cuenta." };

  // Se pide la contraseña porque esto no tiene vuelta atrás y porque un móvil
  // desbloqueado encima de una mesa no puede bastar para borrarle la cuenta a
  // nadie.
  if (!(await contrasenaCorrecta(password)))
    return { ok: false, error: "Esa no es tu contraseña." };

  // Primero lo que es solo suyo, y la cuenta al final: si algo falla por el
  // camino, se puede volver a intentar entrando otra vez.
  await olvidarMemoriaDe(email).catch(() => {});
  await olvidarTareasDe(email).catch(() => {});
  // Los apuntes del Modo Examen son lo más suyo que hay aquí dentro: son los
  // apuntes de alguien. Si se va, se van con él.
  await olvidarExamenesDe(email).catch(() => {});
  await olvidarTodasLasDe(email).catch(() => {});
  await salirDeTodos(email).catch(() => {});
  await borrarUsuario(email).catch(() => {});

  return { ok: true };
}
