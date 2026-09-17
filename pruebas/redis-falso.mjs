// Un Redis de mentira: solo entiende lo que usa la app (GET/SET/INCR/EXPIRE)
// y el endpoint /pipeline. Suficiente para comprobar que los topes se aplican.
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const datos = new Map();

function ejecutar(cmd) {
  const [nombre, clave, ...resto] = cmd.map(String);
  switch (nombre.toUpperCase()) {
    case "INCR": {
      const v = (Number(datos.get(clave)) || 0) + 1;
      datos.set(clave, String(v));
      return v;
    }
    case "EXPIRE": return 1;
    case "DEL": return datos.delete(clave) ? 1 : 0;
    // Para poder mirar DESDE FUERA qué ha quedado escrito de verdad: sin esto,
    // una prueba de "la clave no está en claro" se cumple mirando una lista
    // vacía, que es no comprobar nada.
    case "KEYS": {
      const re = new RegExp("^" + clave.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      return [...datos.keys()].filter((k) => re.test(k));
    }
    case "GET": return datos.has(clave) ? datos.get(clave) : null;
    case "SET": {
      if (resto.includes("NX") && datos.has(clave)) return null;
      datos.set(clave, resto[0]);
      return "OK";
    }
    default: return null;
  }
}

const server = createServer((req, res) => {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    const parsed = JSON.parse(cuerpo || "[]");
    res.setHeader("content-type", "application/json");
    if (req.url === "/pipeline") {
      res.end(JSON.stringify(parsed.map((c) => ({ result: ejecutar(c) }))));
    } else {
      res.end(JSON.stringify({ result: ejecutar(parsed) }));
    }
  });
});
server.listen(0, () => {
  writeFileSync(process.argv[2], String(server.address().port));
  console.log("redis falso en", server.address().port);
});
