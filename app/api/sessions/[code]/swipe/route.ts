import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, getParticipants, jsonError, touchSession } from "@/lib/api-utils";

const bodySchema = z.object({
  deviceId: z.string().min(1),
  tmdbId: z.number(),
  mediaType: z.enum(["movie", "tv"]),
  direction: z.enum(["like", "pass"]),
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
  if (session.status === "matched" || session.status === "completed") {
    return NextResponse.json({ matched: false });
  }

  const participants = await getParticipants(session.id);
  const me = participants.find((p) => p.device_id === body.deviceId);
  if (!me) return jsonError("You haven't joined this session", 403);
  const other = participants.find((p) => p.role !== me.role);

  const { error: swipeError } = await supabaseServer.from("swipes").upsert(
    {
      session_id: session.id,
      participant_id: me.id,
      round: session.round,
      tmdb_id: body.tmdbId,
      media_type: body.mediaType,
      direction: body.direction,
    },
    { onConflict: "session_id,participant_id,round,tmdb_id" }
  );
  if (swipeError) return jsonError(swipeError.message, 500);

  if (body.direction !== "like" || !other) {
    return NextResponse.json({ matched: false });
  }

  const { data: otherLike } = await supabaseServer
    .from("swipes")
    .select("id")
    .eq("session_id", session.id)
    .eq("participant_id", other.id)
    .eq("round", session.round)
    .eq("tmdb_id", body.tmdbId)
    .eq("direction", "like")
    .maybeSingle();

  if (!otherLike) return NextResponse.json({ matched: false });

  const { data: match, error: matchError } = await supabaseServer
    .from("matches")
    .insert({
      session_id: session.id,
      round: session.round,
      tmdb_id: body.tmdbId,
      media_type: body.mediaType,
    })
    .select("*")
    .maybeSingle();

  // Unique constraint violation just means another request already recorded
  // the match first — that's fine, not an error.
  if (matchError && !matchError.message.includes("duplicate")) {
    return jsonError(matchError.message, 500);
  }

  await touchSession(session.id, { status: "matched" });

  return NextResponse.json({ matched: true, match: match ?? null });
}
