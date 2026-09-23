import "server-only";
import {
  discoverTitles,
  getDetailsWithImdb,
  posterUrl,
  resolveGenreIds,
  type TmdbDiscoverResult,
} from "./tmdb";
import { readCachedOnly } from "./title-enrichment";
import { generateSearchBrief, refineFromLikes, type SearchBrief, type PartnerProfileInput, type LikedTitleInput } from "./ai/brief";
import { combinePreferences, ERA_RANGES, LANGUAGE_TMDB_CODES } from "./preferences";
import type { MediaType, PreferencesRow, TitleCardData } from "./supabase/types";

interface Candidate extends TmdbDiscoverResult {
  mediaType: MediaType;
}

function mediaTypesFor(contentType: string): MediaType[] {
  return contentType === "movies_only" ? ["movie"] : ["movie", "tv"];
}

async function gatherCandidates(
  brief: SearchBrief,
  contentType: string,
  languages: string[],
  eras: string[],
  minRating: number,
  excludeIds: Set<number>
): Promise<Candidate[]> {
  const languageCodes = languages
    .map((l) => LANGUAGE_TMDB_CODES[l])
    .filter((c): c is string => Boolean(c));
  const eraRanges = eras.length > 0 ? eras.map((e) => ERA_RANGES[e]) : [{}];
  const mediaTypes = mediaTypesFor(contentType);

  const all: Candidate[] = [];
  for (const mediaType of mediaTypes) {
    const genreIds = await resolveGenreIds(mediaType, brief.genres);
    for (const era of eraRanges) {
      for (const page of [1, 2]) {
        const results = await discoverTitles(mediaType, {
          genreIds,
          languageCodes,
          dateGte: era.gte,
          dateLte: era.lte,
          minRating,
          page,
          excludeIds: [...excludeIds],
        });
        for (const r of results) {
          if (excludeIds.has(r.id)) continue;
          excludeIds.add(r.id);
          all.push({ ...r, mediaType });
        }
      }
    }
  }
  return all;
}

function keywordScore(overview: string, keywords: string[]): number {
  const lower = overview.toLowerCase();
  return keywords.reduce((n, kw) => (lower.includes(kw.toLowerCase()) ? n + 1 : n), 0);
}

async function toCardData(c: Candidate): Promise<TitleCardData> {
  const [{ runtime }, cached] = await Promise.all([
    getDetailsWithImdb(c.mediaType, c.id),
    readCachedOnly(c.id, c.mediaType),
  ]);
  const year = (c.release_date || c.first_air_date || "").slice(0, 4);
  return {
    tmdb_id: c.id,
    media_type: c.mediaType,
    title: c.title || c.name || "Untitled",
    year: year ? Number(year) : null,
    poster_path: posterUrl(c.poster_path),
    runtime,
    synopsis: cached?.synopsis || c.overview || "No synopsis available.",
    imdb_rating: cached?.imdbRating ?? c.vote_average ?? null,
    genres: cached?.genres ?? [],
  };
}

export interface BuiltPool {
  brief: SearchBrief;
  titles: TitleCardData[];
}

async function buildFromBrief(
  brief: SearchBrief,
  prefA: PreferencesRow,
  prefB: PreferencesRow,
  excludeIds: Set<number>,
  count: number
): Promise<BuiltPool> {
  const combined = combinePreferences(prefA, prefB);
  const candidates = await gatherCandidates(
    brief,
    combined.contentType,
    combined.languages,
    combined.eras,
    combined.minRating,
    excludeIds
  );

  const ranked = candidates
    .map((c) => ({ c, score: keywordScore(c.overview, brief.keywords) }))
    .sort((a, b) => b.score - a.score || b.c.vote_average - a.c.vote_average)
    .map((x) => x.c);

  const chosen = ranked.slice(0, count);
  const titles = await Promise.all(chosen.map(toCardData));
  return { brief, titles };
}

function toProfileInputs(prefA: PreferencesRow, prefB: PreferencesRow): PartnerProfileInput[] {
  return [
    { role: "A", moods: prefA.moods, moodFreeText: prefA.mood_free_text },
    { role: "B", moods: prefB.moods, moodFreeText: prefB.mood_free_text },
  ];
}

export async function buildInitialPool(
  prefA: PreferencesRow,
  prefB: PreferencesRow,
  historyNote?: string
): Promise<BuiltPool> {
  const brief = await generateSearchBrief(toProfileInputs(prefA, prefB), historyNote);
  return buildFromBrief(brief, prefA, prefB, new Set(), 30);
}

export async function buildRefinedPool(
  prefA: PreferencesRow,
  prefB: PreferencesRow,
  likedByA: LikedTitleInput[],
  likedByB: LikedTitleInput[],
  excludeIds: number[]
): Promise<BuiltPool> {
  const brief = await refineFromLikes(toProfileInputs(prefA, prefB), likedByA, likedByB);
  return buildFromBrief(brief, prefA, prefB, new Set(excludeIds), 30);
}
