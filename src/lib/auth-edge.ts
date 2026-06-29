// Edge-safe auth helpers (no Prisma, no bcrypt, no next/headers).
// Imported by middleware, which runs in the Edge runtime. Keep this file free
// of any Node-only dependency.

import { jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const JWT_ALG = "HS256";

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

/** Edge-safe check used by middleware: is the token a valid, unexpired JWT? */
export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, authSecret());
    return true;
  } catch {
    return false;
  }
}
