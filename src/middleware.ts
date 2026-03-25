import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE, COOKIE_CONFIG } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("JWT_SECRET is not configured — denying access (fail closed)");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await verifySession(sessionCookie.value, jwtSecret);
    return NextResponse.next();
  } catch {
    // Expired or invalid JWT — clear stale cookie and redirect
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(SESSION_COOKIE, "", { ...COOKIE_CONFIG, maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
