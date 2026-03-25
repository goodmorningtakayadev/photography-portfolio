import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { createSession, SESSION_COOKIE, COOKIE_CONFIG } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { data: null, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(
      password,
      process.env.ADMIN_PASSWORD_HASH!
    );

    if (!isValid) {
      return NextResponse.json(
        { data: null, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createSession(process.env.JWT_SECRET!);
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
