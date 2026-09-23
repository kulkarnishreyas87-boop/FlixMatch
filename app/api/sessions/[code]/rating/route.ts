import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, jsonError, touchSession } from "@/lib/api-utils";

const bodySchema = z.object({
  tmdbId: z.number(),
  mediaType: z.enum(["movie", "tv"]),
  rating: z.number().min(1).max(5),
  note: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.message);
  const body = parsed.data;

  const session = await getSessionByCode(code);
  if (!session) return jsonError("Session not found", 404);

  const { error } = await supabaseServer.from("ratings").insert({
    session_id: session.id,
    tmdb_id: body.tmdbId,
    media_type: body.mediaType,
    rating: body.rating,
    note: body.note || null,
  });
  if (error) return jsonError(error.message, 500);

  await touchSession(session.id, { status: "completed" });
  return NextResponse.json({ ok: true });
}
