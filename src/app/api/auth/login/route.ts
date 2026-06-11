import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { createSession, SESSION_COOKIE, COOKIE_CONFIG } from "@/lib/session";

export async function POST(request: Request) {
  try {
    // Fail closed and loud on misconfig — without these, bcrypt.compare
    // throws on undefined and the catch below would hide it behind a
    // generic 401, leaving a broken deploy looking like a wrong password.
    // The response stays generic; only the server log names the cause.
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;
    if (!passwordHash || !jwtSecret) {
      console.error(
        "Auth misconfigured:",
        !passwordHash ? "ADMIN_PASSWORD_HASH unset" : "JWT_SECRET unset"
      );
      return NextResponse.json(
        { data: null, error: "Authentication is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { data: null, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { data: null, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createSession(jwtSecret);
    const response = NextResponse.json({ data: null, error: null });
    response.cookies.set(SESSION_COOKIE, token, COOKIE_CONFIG);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { data: null, error: "Invalid credentials" },
      { status: 401 }
    );
  }
}
