import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { currentUser } from "./auth";
import { stripeAvailable, subscriptionActive } from "./stripe";
import type { Plan } from "./types";

export const PLAN_COOKIE = "eclipse_plan";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 año

function secret(): string {
  return (
    process.env.PRO_SECRET ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    "eclipse-dev-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/**
 * Token con formato `pro.<caduca>.<suscripción>.<firma>`.
 * La suscripción vale `-` cuando el Pro se ha activado con el código manual.
 */
export function issueProToken(subscriptionId?: string): string {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const sub = subscriptionId || "-";
  const payload = `pro.${exp}.${sub}`;
  return `${payload}.${sign(payload)}`;
}

interface TokenInfo {
  valid: boolean;
  subscriptionId: string | null;
}

export function readProToken(token: string | undefined): TokenInfo {
  const nope: TokenInfo = { valid: false, subscriptionId: null };
  if (!token) return nope;

  const parts = token.split(".");
  // Formato antiguo (`pro.exp.firma`) y nuevo (`pro.exp.sub.firma`).
  let exp: string, sub: string, sig: string;
  if (parts.length === 3) {
    [, exp, sig] = parts;
    sub = "-";
  } else if (parts.length === 4) {
    [, exp, sub, sig] = parts;
  } else {
    return nope;
  }

  if (parts[0] !== "pro" || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return nope;

  const expected = sign(parts.length === 3 ? `pro.${exp}` : `pro.${exp}.${sub}`);
  if (expected.length !== sig.length) return nope;

  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return nope;
  } catch {
    return nope;
  }

  return { valid: true, subscriptionId: sub === "-" ? null : sub };
}

/**
 * Cuentas con el plan Pro regalado.
 *
 * Van por huella, no en claro: este repositorio es público y no hay ninguna
 * razón para publicar el correo de nadie. La sal fija impide además buscar la
 * huella en una lista de correos conocidos.
 *
 * Se pueden añadir más con PRO_EMAILS, separados por comas.
 */
const PRO_REGALADO = new Set([
  // El dueño de la aplicación.
  "7da4a76317ba2e4cf075ecd5514e2f67dd6b1976e6b5927fcf6732804cf7191e",
]);

function huella(email: string): string {
  return createHash("sha256")
    .update(`eclipse:${email.trim().toLowerCase()}`)
    .digest("hex");
}

function tieneProRegalado(email: string): boolean {
  const suya = huella(email);
  if (PRO_REGALADO.has(suya)) return true;

  return (process.env.PRO_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .some((e) => huella(e) === suya);
}

/** ¿El Pro de quien está entrando es de regalo, y no una suscripción? */
export async function proEsRegalado(): Promise<boolean> {
  const email = await currentUser();
  return Boolean(email && tieneProRegalado(email));
}

/**
 * Plan real del usuario. Nunca se confía en el cliente: la cookie va firmada
 * y, si viene de una suscripción, se comprueba con Stripe que siga activa.
 */
export async function currentPlan(): Promise<Plan> {
  // Quien tiene el Pro regalado lo tiene siempre, haya pagado o no.
  const email = await currentUser();
  if (email && tieneProRegalado(email)) return "pro";

  const jar = await cookies();
  const info = readProToken(jar.get(PLAN_COOKIE)?.value);
  if (!info.valid) return "free";

  if (info.subscriptionId && stripeAvailable()) {
    return (await subscriptionActive(info.subscriptionId)) ? "pro" : "free";
  }
  return "pro";
}

export function proCodeMatches(code: string): boolean {
  const expected = process.env.PRO_ACCESS_CODE;
  if (!expected) return false;
  const a = Buffer.from(code.trim());
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};

export function planCookieHeader(subscriptionId?: string): string {
  return `${PLAN_COOKIE}=${issueProToken(subscriptionId)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${
    COOKIE_OPTIONS.secure ? "; Secure" : ""
  }`;
}

export const CLEAR_PLAN_COOKIE = `${PLAN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
