import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, getParticipants, jsonError, touchSession } from "@/lib/api-utils";
import { buildRefinedPool } from "@/lib/pool";
import type { PreferencesRow, TitleCardData, TitlePoolRow } from "@/lib/supabase/types";

const bodySchema = z.object({ deviceId: z.string().min(1) });

async function getPool(sessionId: string, round: number): Promise<TitlePoolRow | null> {
  const { data } = await supabaseServer
    .from("title_pools")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round", round)
    .maybeSingle();
  return (data as TitlePoolRow) ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("deviceId is required");

  const session = await getSessionByCode(code);
  if (!session) return jsonError("Session not found", 404);
  if (session.status === "matched" || session.status === "completed") {
    return NextResponse.json({ status: session.status });
  }

  const participants = await getParticipants(session.id);
  const me = participants.find((p) => p.device_id === parsed.data.deviceId);
  if (!me) return jsonError("You haven't joined this session", 403);

  if (me.finished_round < session.round) {
    await supabaseServer
      .from("participants")
      .update({ finished_round: session.round })
      .eq("id", me.id);
  }

  const { data: freshParticipants } = await supabaseServer
    .from("participants")
    .select("*")
    .eq("session_id", session.id);
  const bothFinished = (freshParticipants ?? []).every((p) => p.finished_round >= session.round);

  if (!bothFinished) return NextResponse.json({ status: session.status, waiting: true });

  // Double-check no match slipped in (e.g. a swipe request still in flight).
  const { data: match } = await supabaseServer
    .from("matches")
    .select("id")
    .eq("session_id", session.id)
    .maybeSingle();
  if (match) return NextResponse.json({ status: "matched" });

  if (session.round === 3) {
    // Final-call round also produced no mutual like: hand it back to the
    // partners to decide together (see /final-choice).
    return NextResponse.json({ status: "final_call", exhausted: true });
  }

  const { data: prefRows } = await supabaseServer
    .from("preferences")
    .select("*")
    .eq("session_id", session.id);
  const preferences = (prefRows as PreferencesRow[]) ?? [];
  const roleOf = (pid: string) => participants.find((p) => p.id === pid)?.role;
  const prefA = preferences.find((p) => roleOf(p.participant_id) === "A")!;
  const prefB = preferences.find((p) => roleOf(p.participant_id) === "B")!;

  if (session.round === 1) {
    const pool1 = await getPool(session.id, 1);
    const { data: swipeRows } = await supabaseServer
      .from("swipes")
      .select("*")
      .eq("session_id", session.id)
      .eq("round", 1)
      .eq("direction", "like");

    const titleByKey = new Map((pool1?.titles ?? []).map((t) => [`${t.tmdb_id}:${t.media_type}`, t]));
    const participantById = new Map(participants.map((p) => [p.id, p]));
    const likedByA: { title: string; genres: string[] }[] = [];
    const likedByB: { title: string; genres: string[] }[] = [];
    for (const s of swipeRows ?? []) {
      const t = titleByKey.get(`${s.tmdb_id}:${s.media_type}`);
      if (!t) continue;
      const role = participantById.get(s.participant_id)?.role;
      const entry = { title: t.title, genres: t.genres };
      if (role === "A") likedByA.push(entry);
      else if (role === "B") likedByB.push(entry);
    }

    const excludeIds = (pool1?.titles ?? []).map((t) => t.tmdb_id);
    const built = await buildRefinedPool(prefA, prefB, likedByA, likedByB, excludeIds);

    await supabaseServer.from("title_pools").upsert(
      { session_id: session.id, round: 2, brief: built.brief, titles: built.titles },
      { onConflict: "session_id,round" }
    );
    await touchSession(session.id, { status: "round_2", round: 2 });
    return NextResponse.json({ status: "round_2" });
  }

  // session.round === 2, still no match: compute top 5 by combined like-score
  // across both rounds and hand them over as the final-call deck.
  const [pool1, pool2] = await Promise.all([getPool(session.id, 1), getPool(session.id, 2)]);
  const allTitles = new Map<string, TitleCardData>();
  for (const t of [...(pool1?.titles ?? []), ...(pool2?.titles ?? [])]) {
    allTitles.set(`${t.tmdb_id}:${t.media_type}`, t);
  }

  const { data: allLikes } = await supabaseServer
    .from("swipes")
    .select("participant_id, tmdb_id, media_type")
    .eq("session_id", session.id)
    .eq("direction", "like");

  const scoreByKey = new Map<string, Set<string>>();
  for (const s of allLikes ?? []) {
    const key = `${s.tmdb_id}:${s.media_type}`;
    if (!scoreByKey.has(key)) scoreByKey.set(key, new Set());
    scoreByKey.get(key)!.add(s.participant_id);
  }

  let ranked = [...scoreByKey.entries()]
    .map(([key, participantSet]) => ({ key, score: participantSet.size }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => allTitles.get(x.key))
    .filter((t): t is TitleCardData => Boolean(t));

  if (ranked.length < 5) {
    const already = new Set(ranked.map((t) => `${t.tmdb_id}:${t.media_type}`));
    const backfill = [...allTitles.values()]
      .filter((t) => !already.has(`${t.tmdb_id}:${t.media_type}`))
      .sort((a, b) => (b.imdb_rating ?? 0) - (a.imdb_rating ?? 0));
    ranked = [...ranked, ...backfill].slice(0, 5);
  }

  await supabaseServer.from("title_pools").upsert(
    { session_id: session.id, round: 3, brief: { note: "Top picks from both rounds" }, titles: ranked },
    { onConflict: "session_id,round" }
  );
  await touchSession(session.id, { status: "final_call", round: 3 });
  return NextResponse.json({ status: "final_call" });
}
