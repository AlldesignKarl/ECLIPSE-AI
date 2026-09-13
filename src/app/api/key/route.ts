import { NextRequest } from "next/server";
import {
  CLEAR_ENGINE_COOKIE,
  clearKeyCookie,
  codeEngineCookieHeader,
  engineCookieHeader,
  isKeyProvider,
  keyCookieHeader,
  keySources,
  preferredCodeEngine,
  preferredEngine,
  verifyGoogleKey,
  type KeyProvider,
} from "@/lib/keys";
import { verifyCompatKey } from "@/lib/openai-compat";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ¿Hay clave y de dónde sale? Nunca se devuelve la clave en sí. */
export async function GET() {
  const sources = await keySources();
  return Response.json({
    sources,
    engine: await preferredEngine(),
    engineCode: await preferredCodeEngine(),
    // El campo de siempre, para no romper nada que aún lo lea.
    source: sources.google,
  });
}

async function verify(provider: KeyProvider, key: string) {
  if (provider === "google") return verifyGoogleKey(key);
  return verifyCompatKey(provider, key);
}

/**
 * Guarda la clave del motor elegido en una cookie HttpOnly de este dispositivo.
 * Antes la comprueba contra el proveedor, para no guardar algo que no sirve.
 */
export async function POST(req: NextRequest) {
  const { key, provider, use, paraCodigo } = (await req.json().catch(() => ({}))) as {
    key?: string;
    provider?: string;
    use?: boolean;
    /** Elegir el motor de ECLIPSE CODE, no el del chat. */
    paraCodigo?: boolean;
  };

  // Elegir el motor de código no necesita clave: es decir cuál de los que ya
  // hay se usa para programar. Y cadena vacía significa "el mismo que el chat".
  if (paraCodigo) {
    const sinMotor = !isKeyProvider(provider);
    if (!sinMotor) {
      const sources = await keySources();
      if (sources[provider as KeyProvider] === "ninguna")
        return Response.json({ error: "Ese motor todavía no tiene clave." }, { status: 400 });
    }
    const elegido = Response.json({ engineCode: sinMotor ? null : provider });
    elegido.headers.append(
      "Set-Cookie",
      codeEngineCookieHeader(sinMotor ? "" : (provider as KeyProvider)),
    );
    return elegido;
  }

  const engine: KeyProvider = isKeyProvider(provider) ? provider : "google";
  const clean = (key ?? "").trim();

  // Cambiar de motor sin volver a pegar la clave que ya está guardada.
  if (use && !clean) {
    const sources = await keySources();
    if (sources[engine] === "ninguna")
      return Response.json({ error: "Ese motor todavía no tiene clave." }, { status: 400 });

    const chosen = Response.json({ source: sources[engine], engine });
    chosen.headers.append("Set-Cookie", engineCookieHeader(engine));
    return chosen;
  }

  if (!clean) return Response.json({ error: "Pega aquí tu clave." }, { status: 400 });
  if (clean.length > 300 || /\s/.test(clean))
    return Response.json(
      { error: "Eso no parece una clave. Debe ser una sola línea, sin espacios." },
      { status: 400 },
    );

  const check = await verify(engine, clean);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  const res = Response.json({ source: "dispositivo", engine });
  res.headers.append("Set-Cookie", keyCookieHeader(engine, clean));
  // Si acabas de pegar esta clave, es la que quieres usar.
  res.headers.append("Set-Cookie", engineCookieHeader(engine));
  return res;
}

/** Olvida la clave guardada en este dispositivo. */
export async function DELETE(req: NextRequest) {
  const asked = new URL(req.url).searchParams.get("provider");
  const engine: KeyProvider = isKeyProvider(asked) ? asked : "google";

  const res = Response.json({ source: "ninguna", engine: null });
  res.headers.append("Set-Cookie", clearKeyCookie(engine));
  if ((await preferredEngine()) === engine)
    res.headers.append("Set-Cookie", CLEAR_ENGINE_COOKIE);
  return res;
}
