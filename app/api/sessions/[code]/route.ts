import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, getParticipants, jsonError } from "@/lib/api-utils";
import type { MatchRow, PreferencesRow, TitlePoolRow } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const deviceId = request.nextUrl.searchParams.get("deviceId");

  const session = await getSessionByCode(code);
  if (!session) return jsonError("Session not found", 404);

  const participants = await getParticipants(session.id);
  const me = participants.find((p) => p.device_id === deviceId) ?? null;

  const { data: prefRows } = await supabaseServer
    .from("preferences")
    .select("*")
    .eq("session_id", session.id);
  const preferences = (prefRows as PreferencesRow[]) ?? [];

  let pool: TitlePoolRow | null = null;
  if (session.round > 0) {
    const { data } = await supabaseServer
      .from("title_pools")
      .select("*")
      .eq("session_id", session.id)
      .eq("round", session.round)
      .maybeSingle();
    pool = (data as TitlePoolRow) ?? null;
  }

  const { data: matchData } = await supabaseServer
    .from("matches")
    .select("*")
    .eq("session_id", session.id)
    .maybeSingle();
  const match = (matchData as MatchRow) ?? null;

  let matchTitle = null;
  if (match) {
    const fromPool = pool?.titles.find(
      (t) => t.tmdb_id === match.tmdb_id && t.media_type === match.media_type
    );
    matchTitle = fromPool ?? null;
  }

  const bothFinishedRound =
    participants.length === 2 && participants.every((p) => p.finished_round >= session.round);

  return NextResponse.json({
    session,
    participants: participants.map((p) => ({ role: p.role, joined: true, finishedRound: p.finished_round })),
    myRole: me?.role ?? null,
    myFinishedRound: me?.finished_round ?? 0,
    bothFinishedRound,
    preferencesSubmitted: {
      A: preferences.some((p) => p.participant_id === participants.find((x) => x.role === "A")?.id),
      B: preferences.some((p) => p.participant_id === participants.find((x) => x.role === "B")?.id),
    },
    pool,
    match,
    matchTitle,
  });
}
