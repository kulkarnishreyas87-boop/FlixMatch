import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, getParticipants, jsonError, touchSession } from "@/lib/api-utils";
import { buildInitialPool } from "@/lib/pool";
import { upsertCouple, getCoupleHistory } from "@/lib/couples";
import { getBasicTitle } from "@/lib/tmdb";
import type { PreferencesRow } from "@/lib/supabase/types";

const bodySchema = z.object({
  deviceId: z.string().min(1),
  moods: z.array(z.string()),
  moodFreeText: z.string().nullable().optional(),
  languages: z.array(z.string()),
  contentType: z.enum(["movies_only", "include_series"]),
  minRating: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]),
  eras: z.array(z.string()),
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

  const participants = await getParticipants(session.id);
  const me = participants.find((p) => p.device_id === body.deviceId);
  if (!me) return jsonError("You haven't joined this session", 403);

  const { error: upsertError } = await supabaseServer.from("preferences").upsert(
    {
      session_id: session.id,
      participant_id: me.id,
      moods: body.moods,
      mood_free_text: body.moodFreeText || null,
      languages: body.languages,
      content_type: body.contentType,
      min_rating: body.minRating,
      eras: body.eras,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "participant_id" }
  );
  if (upsertError) return jsonError(upsertError.message, 500);

  const other = participants.find((p) => p.role !== me.role);
  if (!other) {
    return NextResponse.json({ status: "waiting_for_partner" });
  }

  const { data: otherPrefData } = await supabaseServer
    .from("preferences")
    .select("*")
    .eq("participant_id", other.id)
    .maybeSingle();

  if (!otherPrefData) {
    return NextResponse.json({ status: "waiting_for_partner_submission" });
  }

  const myPrefRow: PreferencesRow = {
    id: "",
    session_id: session.id,
    participant_id: me.id,
    moods: body.moods,
    mood_free_text: body.moodFreeText || null,
    languages: body.languages,
    content_type: body.contentType,
    min_rating: body.minRating,
    eras: body.eras,
    submitted_at: new Date().toISOString(),
  };
  const aRow = me.role === "A" ? myPrefRow : (otherPrefData as PreferencesRow);
  const bRow = me.role === "B" ? myPrefRow : (otherPrefData as PreferencesRow);

  // Both submitted: link/find this couple and pull their history (if any)
  // before generating round 1, so returning couples get a personalized brief.
  const deviceA = me.role === "A" ? me.device_id : other.device_id;
  const deviceB = me.role === "B" ? me.device_id : other.device_id;
  const coupleId = await upsertCouple(deviceA, deviceB);
  await touchSession(session.id, { couple_id: coupleId });

  const history = await getCoupleHistory(coupleId);
  let historyNote: string | undefined;
  if (history.length > 0) {
    const resolved = await Promise.all(
      history.slice(0, 5).map(async (h) => {
        const basic = await getBasicTitle(h.media_type as "movie" | "tv", h.tmdb_id);
        if (!basic) return null;
        return `${basic.title}${h.rating ? ` (rated ${h.rating}/5)` : ""}`;
      })
    );
    const named = resolved.filter((x): x is string => Boolean(x));
    if (named.length > 0) historyNote = `Previously matched and watched: ${named.join(", ")}.`;
  }

  const built = await buildInitialPool(aRow, bRow, historyNote);

  const { error: poolError } = await supabaseServer.from("title_pools").upsert(
    {
      session_id: session.id,
      round: 1,
      brief: built.brief,
      titles: built.titles,
    },
    { onConflict: "session_id,round" }
  );
  if (poolError) return jsonError(poolError.message, 500);

  await touchSession(session.id, { status: "round_1", round: 1 });

  return NextResponse.json({ status: "round_1" });
}
