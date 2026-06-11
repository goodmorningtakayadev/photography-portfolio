import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "session";

export const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function createSession(secret: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

export async function verifySession(
  token: string,
  secret: string
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(secret),
    // Pin the algorithm to the one we sign with. jose already rejects
    // alg:none for a symmetric key, but pinning closes algorithm-confusion
    // entirely and documents the contract.
    { algorithms: ["HS256"] }
  );
  return payload;
}

/**
 * Auth guard for API routes. Returns JWT payload if authenticated, null otherwise.
 * Uses process.env directly (not env.ts) to maintain Edge compatibility
 * and avoid coupling to R2 env vars.
 */
export async function getSession(): Promise<JWTPayload | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifySession(token, jwtSecret);
  } catch {
    return null;
  }
}
