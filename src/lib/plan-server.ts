import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Plan } from "./types";

export const PLAN_COOKIE = "eclipse_plan";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 año

function secret(): string {
  return (
    process.env.PRO_SECRET ||
    process.env.ANTHROPIC_API_KEY ||
    "eclipse-dev-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Token con formato `pro.<expira>.<firma>` para que no se pueda falsificar. */
export function issueProToken(): string {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const payload = `pro.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyProToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "pro") return false;
  const [, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = sign(`pro.${exp}`);
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

/** Plan real del usuario según la cookie firmada. Nunca confíes en el cliente. */
export async function currentPlan(): Promise<Plan> {
  const jar = await cookies();
  return verifyProToken(jar.get(PLAN_COOKIE)?.value) ? "pro" : "free";
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
