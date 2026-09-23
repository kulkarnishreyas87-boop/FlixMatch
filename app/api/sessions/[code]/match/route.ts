import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, jsonError } from "@/lib/api-utils";
import { getOrFetchEnrichedTitle } from "@/lib/title-enrichment";
import type { MatchRow, TitleCardData, TitlePoolRow } from "@/lib/supabase/types";

// The one place that calls RapidAPI live (cached afterward): the confirmed
// match, revealed once per session, not the 30-card pool.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const session = await getSessionByCode(code);
  if (!session) return jsonError("Session not found", 404);

  const { data: matchData } = await supabaseServer
    .from("matches")
    .select("*")
    .eq("session_id", session.id)
    .maybeSingle();
  const match = matchData as MatchRow | null;
  if (!match) return jsonError("No match yet for this session", 404);

  const { data: poolData } = await supabaseServer
    .from("title_pools")
    .select("*")
    .eq("session_id", session.id)
    .eq("round", match.round)
    .maybeSingle();
  const pool = poolData as TitlePoolRow | null;
  const card =
    pool?.titles.find((t) => t.tmdb_id === match.tmdb_id && t.media_type === match.media_type) ??
    null;

  const enriched = await getOrFetchEnrichedTitle(match.tmdb_id, match.media_type);

  const merged: TitleCardData & { ottPlatformsIndia: unknown[] } = {
    tmdb_id: match.tmdb_id,
    media_type: match.media_type,
    title: card?.title ?? "",
    year: card?.year ?? null,
    poster_path: card?.poster_path ?? null,
    runtime: enriched?.runtimeMinutes ?? card?.runtime ?? null,
    synopsis: enriched?.synopsis ?? card?.synopsis ?? "",
    imdb_rating: enriched?.imdbRating ?? card?.imdb_rating ?? null,
    genres: enriched?.genres?.length ? enriched.genres : (card?.genres ?? []),
    ottPlatformsIndia: enriched?.ottPlatformsIndia ?? [],
  };

  return NextResponse.json({ match, title: merged });
}
