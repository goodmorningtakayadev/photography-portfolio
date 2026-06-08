import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getSiteSettings, updateSiteSettings } from "@/db/queries/settings";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  heroPhotoId: z.string().uuid().nullable().optional(),
  heroFocalX: z.number().int().min(0).max(100).optional(),
  heroFocalY: z.number().int().min(0).max(100).optional(),
});

/** GET /api/settings — current site settings. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }
  try {
    const data = await getSiteSettings();
    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

/** PATCH /api/settings — update hero photo / focal point. */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateSiteSettings(parsed.data);
    revalidatePath("/");
    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error("PATCH /api/settings error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
