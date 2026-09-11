import { NextRequest } from "next/server";
import {
  CLEAR_KEY_COOKIE,
  googleKeySource,
  keyCookieHeader,
  verifyGoogleKey,
} from "@/lib/keys";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ¿Hay clave y de dónde sale? Nunca se devuelve la clave en sí. */
export async function GET() {
  return Response.json({ source: await googleKeySource() });
}

/**
 * Guarda la clave de Google en una cookie HttpOnly de este dispositivo.
 * Antes la comprueba contra Google, para no guardar algo que no sirve.
 */
export async function POST(req: NextRequest) {
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  const clean = (key ?? "").trim();

  if (!clean) return Response.json({ error: "Pega tu clave de Google." }, { status: 400 });
  if (clean.length > 200 || /\s/.test(clean))
    return Response.json(
      { error: "Eso no parece una clave. Debe ser una sola línea, sin espacios." },
      { status: 400 },
    );

  const check = await verifyGoogleKey(clean);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  const res = Response.json({ source: "dispositivo" });
  res.headers.append("Set-Cookie", keyCookieHeader(clean));
  return res;
}

/** Olvida la clave guardada en este dispositivo. */
export async function DELETE() {
  const res = Response.json({ source: "ninguna" });
  res.headers.append("Set-Cookie", CLEAR_KEY_COOKIE);
  return res;
}
