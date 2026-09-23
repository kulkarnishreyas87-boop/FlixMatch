import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, getParticipants, jsonError, touchSession } from "@/lib/api-utils";

const bodySchema = z.object({
  deviceId: z.string().min(1),
  tmdbId: z.number(),
  mediaType: z.enum(["movie", "tv"]),
});

// Used only when even the top-5 final-call deck produced no mutual like:
// the shortlist is shown to both partners together, and whoever taps first
// (after they've talked it over) locks it in as the match.
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

  const participants = await getParticipants(session.id);
  const me = participants.find((p) => p.device_id === body.deviceId);
  if (!me) return jsonError("You haven't joined this session", 403);

  const { data: match, error } = await supabaseServer
    .from("matches")
    .insert({
      session_id: session.id,
      round: session.round,
      tmdb_id: body.tmdbId,
      media_type: body.mediaType,
    })
    .select("*")
    .maybeSingle();

  if (error && !error.message.includes("duplicate")) {
    return jsonError(error.message, 500);
  }

  await touchSession(session.id, { status: "matched" });
  return NextResponse.json({ matched: true, match: match ?? null });
}
