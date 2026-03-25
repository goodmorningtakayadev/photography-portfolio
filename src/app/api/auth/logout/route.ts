import { NextResponse } from "next/server";
import { SESSION_COOKIE, COOKIE_CONFIG } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ data: null, error: null });
  response.cookies.set(SESSION_COOKIE, "", { ...COOKIE_CONFIG, maxAge: 0 });
  return response;
}
