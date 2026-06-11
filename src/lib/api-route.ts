/**
 * Admin API route scaffold — owns what every admin route used to repeat:
 * the session check, JSON body parsing + validation, the { data, error }
 * response envelope, and last-resort error handling.
 *
 * Routes keep only domain logic (parse → call a lifecycle/pipeline module →
 * map result kinds to responses). Changing the envelope shape, adding
 * logging/metrics, or hardening auth is a one-file edit here.
 */

import { NextResponse } from "next/server";
import type { z } from "zod";
import { getSession } from "@/lib/session";

/** Success response in the { data, error: null } envelope. */
export function apiSuccess<T>(
  data: T,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json({ data, error: null }, init);
}

/** Error response in the { data: null, error } envelope. */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status });
}

/**
 * Wrap a route handler with the admin session check (→ 401) and a
 * last-resort try/catch (→ logged 500). errorMessage doubles as the 500
 * body and the log label; thrown errors never leak to the client.
 */
export function adminRoute<Ctx = unknown>(
  errorMessage: string,
  handler: (request: Request, context: Ctx) => Promise<NextResponse>,
): (request: Request, context: Ctx) => Promise<NextResponse> {
  return async (request, context) => {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", 401);

    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`[api] ${errorMessage}:`, error);
      return apiError(errorMessage, 500);
    }
  };
}

/**
 * Parse and validate a JSON request body. Returns either the validated
 * value or a ready-made 400 response (invalid JSON, or the schema's first
 * issue message — matching the historical route behavior).
 */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<
  { ok: true; value: z.infer<S> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: apiError("Invalid JSON body", 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(
        parsed.error.issues[0]?.message ?? "Invalid input",
        400,
      ),
    };
  }

  return { ok: true, value: parsed.data };
}
