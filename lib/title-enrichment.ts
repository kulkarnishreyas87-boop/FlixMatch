import "server-only";
import { supabaseServer } from "./supabase/server";
import { fetchTitleDetailsByImdbId } from "./rapidapi";
import { getDetailsWithImdb } from "./tmdb";
import type { MediaType, OttPlatform, TitleCacheRow } from "./supabase/types";

const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // OTT availability shifts; refresh every 3 days

export interface EnrichedTitle {
  imdbRating: number | null;
  synopsis: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  ottPlatformsIndia: OttPlatform[];
}

async function getCached(
  tmdbId: number,
  mediaType: MediaType
): Promise<TitleCacheRow | null> {
  const { data } = await supabaseServer
    .from("title_cache")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .maybeSingle();
  return (data as TitleCacheRow) ?? null;
}

function isFresh(row: TitleCacheRow): boolean {
  return Date.now() - new Date(row.fetched_at).getTime() < CACHE_TTL_MS;
}

function fromCache(row: TitleCacheRow): EnrichedTitle {
  return {
    imdbRating: row.imdb_rating,
    synopsis: row.synopsis,
    runtimeMinutes: row.runtime,
    genres: row.genres,
    ottPlatformsIndia: row.ott_platforms,
  };
}

/**
 * Cache-through lookup for real IMDb rating + India OTT platforms. Reserved
 * for the match reveal / final-call shortlist, never the full 30-card pool
 * (RapidAPI's free plan hard-caps at ~120 requests/month) — bulk pool cards
 * use `readCachedOnly` instead, which never calls RapidAPI live.
 */
export async function getOrFetchEnrichedTitle(
  tmdbId: number,
  mediaType: MediaType
): Promise<EnrichedTitle | null> {
  const cached = await getCached(tmdbId, mediaType);
  if (cached && isFresh(cached)) return fromCache(cached);

  const { imdb_id } = await getDetailsWithImdb(mediaType, tmdbId);
  if (!imdb_id) return cached ? fromCache(cached) : null;

  const live = await fetchTitleDetailsByImdbId(imdb_id);
  if (!live) return cached ? fromCache(cached) : null;

  await supabaseServer.from("title_cache").upsert({
    tmdb_id: tmdbId,
    media_type: mediaType,
    imdb_id,
    imdb_rating: live.imdbRating,
    synopsis: live.synopsis,
    runtime: live.runtimeMinutes,
    poster_path: null,
    genres: live.genres,
    ott_platforms: live.ottPlatformsIndia,
    fetched_at: new Date().toISOString(),
  });

  return {
    imdbRating: live.imdbRating,
    synopsis: live.synopsis,
    runtimeMinutes: live.runtimeMinutes,
    genres: live.genres,
    ottPlatformsIndia: live.ottPlatformsIndia,
  };
}

/** Cheap, no-quota lookup used when building the 30-card swipe pool. */
export async function readCachedOnly(
  tmdbId: number,
  mediaType: MediaType
): Promise<EnrichedTitle | null> {
  const cached = await getCached(tmdbId, mediaType);
  return cached ? fromCache(cached) : null;
}
