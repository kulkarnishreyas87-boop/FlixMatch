import "server-only";
import type { MediaType } from "./supabase/types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;

if (!TOKEN) {
  throw new Error("Missing TMDB_READ_ACCESS_TOKEN env var.");
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
    },
    // Discovery results can shift day to day (new releases); avoid stale caching.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

interface TmdbGenre {
  id: number;
  name: string;
}

let genreCache: { movie: TmdbGenre[]; tv: TmdbGenre[] } | null = null;

export async function getGenreCatalog() {
  if (genreCache) return genreCache;
  const [movie, tv] = await Promise.all([
    tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list"),
    tmdbFetch<{ genres: TmdbGenre[] }>("/genre/tv/list"),
  ]);
  genreCache = { movie: movie.genres, tv: tv.genres };
  return genreCache;
}

/** Best-effort match of free-form genre names (from the AI brief) to TMDB ids. */
export async function resolveGenreIds(
  mediaType: MediaType,
  names: string[]
): Promise<number[]> {
  const catalog = await getGenreCatalog();
  const list = mediaType === "movie" ? catalog.movie : catalog.tv;
  const ids = new Set<number>();
  for (const name of names) {
    const needle = name.trim().toLowerCase();
    const found = list.find(
      (g) =>
        g.name.toLowerCase() === needle ||
        g.name.toLowerCase().includes(needle) ||
        needle.includes(g.name.toLowerCase())
    );
    if (found) ids.add(found.id);
  }
  return [...ids];
}

export interface TmdbDiscoverResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids: number[];
}

export interface DiscoverOptions {
  genreIds: number[];
  languageCodes: string[]; // TMDB discover only accepts one at a time; we fan out
  dateGte?: string;
  dateLte?: string;
  minRating: number;
  page?: number;
  excludeIds?: number[];
}

export async function discoverTitles(
  mediaType: MediaType,
  opts: DiscoverOptions
): Promise<TmdbDiscoverResult[]> {
  const dateField =
    mediaType === "movie" ? "primary_release_date" : "first_air_date";
  const langs = opts.languageCodes.length > 0 ? opts.languageCodes : [undefined];

  const pages = await Promise.all(
    langs.map((lang) =>
      tmdbFetch<{ results: TmdbDiscoverResult[] }>(`/discover/${mediaType}`, {
        with_genres: opts.genreIds.join(",") || undefined,
        with_original_language: lang,
        [`${dateField}.gte`]: opts.dateGte,
        [`${dateField}.lte`]: opts.dateLte,
        "vote_average.gte": opts.minRating,
        "vote_count.gte": opts.minRating >= 9 ? 20 : 50,
        sort_by: "popularity.desc",
        include_adult: false,
        page: opts.page ?? 1,
      })
    )
  );

  const seen = new Set(opts.excludeIds ?? []);
  const merged: TmdbDiscoverResult[] = [];
  for (const page of pages) {
    for (const item of page.results) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export interface TmdbDetails {
  runtime: number | null;
  imdb_id: string | null;
}

export async function getDetailsWithImdb(
  mediaType: MediaType,
  tmdbId: number
): Promise<TmdbDetails> {
  const data = await tmdbFetch<{
    runtime?: number;
    episode_run_time?: number[];
    external_ids?: { imdb_id?: string };
  }>(`/${mediaType}/${tmdbId}`, { append_to_response: "external_ids" });

  const runtime =
    mediaType === "movie"
      ? (data.runtime ?? null)
      : (data.episode_run_time?.[0] ?? null);

  return {
    runtime: runtime ?? null,
    imdb_id: data.external_ids?.imdb_id ?? null,
  };
}

export function posterUrl(path: string | null, size: "w342" | "w500" = "w500") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Minimal title lookup used to describe a couple's watch history to the AI brief. */
export async function getBasicTitle(
  mediaType: MediaType,
  tmdbId: number
): Promise<{ title: string; genres: string[] } | null> {
  try {
    const data = await tmdbFetch<{
      title?: string;
      name?: string;
      genres?: { name: string }[];
    }>(`/${mediaType}/${tmdbId}`);
    return {
      title: data.title || data.name || "Unknown title",
      genres: (data.genres ?? []).map((g) => g.name),
    };
  } catch {
    return null;
  }
}
