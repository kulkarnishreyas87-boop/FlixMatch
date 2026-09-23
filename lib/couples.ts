import "server-only";
import { supabaseServer } from "./supabase/server";

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function findCoupleId(deviceA: string, deviceB: string): Promise<string | null> {
  const [x, y] = sortedPair(deviceA, deviceB);
  const { data } = await supabaseServer
    .from("couples")
    .select("id")
    .eq("device_x", x)
    .eq("device_y", y)
    .maybeSingle();
  return data?.id ?? null;
}

export async function upsertCouple(deviceA: string, deviceB: string): Promise<string> {
  const [x, y] = sortedPair(deviceA, deviceB);
  const { data, error } = await supabaseServer
    .from("couples")
    .upsert(
      { device_x: x, device_y: y, last_session_at: new Date().toISOString() },
      { onConflict: "device_x,device_y" }
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to upsert couple");
  return data.id;
}

export interface CoupleHistoryTitle {
  tmdb_id: number;
  media_type: string;
  rating: number | null;
}

/** Titles this couple has matched + rated before, used to bias future pools. */
export async function getCoupleHistory(coupleId: string): Promise<CoupleHistoryTitle[]> {
  const { data: sessions } = await supabaseServer
    .from("sessions")
    .select("id")
    .eq("couple_id", coupleId);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return [];

  const { data: matches } = await supabaseServer
    .from("matches")
    .select("session_id, tmdb_id, media_type")
    .in("session_id", sessionIds);

  const { data: ratings } = await supabaseServer
    .from("ratings")
    .select("session_id, rating")
    .in("session_id", sessionIds);

  const ratingBySession = new Map((ratings ?? []).map((r) => [r.session_id, r.rating]));

  return (matches ?? []).map((m) => ({
    tmdb_id: m.tmdb_id,
    media_type: m.media_type,
    rating: ratingBySession.get(m.session_id) ?? null,
  }));
}
