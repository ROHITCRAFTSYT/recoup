// Node-runtime session auth: bcrypt-checked login that mints a signed JWT
// stored in an httpOnly cookie. Login is required across the app — the support
// desk is a logged-in workflow tool, not a public page.
//
// Edge-safe primitives (token verify, cookie name, secret) live in auth-edge.ts
// so middleware can import them without pulling in Prisma/bcrypt.

import { cookies } from "next/headers";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, JWT_ALG, authSecret } from "@/lib/auth-edge";

export type SessionUser = { userId: string; email: string; name: string };

export async function verifyLogin(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  return { userId: user.id, email: user.email, name: user.name };
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(authSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read the current user from the cookie, or null if not signed in. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, authSecret());
    return {
      userId: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}
