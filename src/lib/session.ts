import { SignJWT, jwtVerify, type JWTPayload } from "jose";

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
    new TextEncoder().encode(secret)
  );
  return payload;
}
