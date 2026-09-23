import "server-only";
import type { OttPlatform } from "./supabase/types";

const HOST = process.env.RAPID_API_HOST;
const KEY = process.env.RAPID_API_KEY;

if (!HOST || !KEY) {
  throw new Error("Missing RAPID_API_HOST or RAPID_API_KEY env vars.");
}

interface RawTitleDetails {
  genre?: string[];
  imageurl?: string[];
  imdbid?: string;
  imdbrating?: number | null;
  language?: string[];
  released?: number;
  runtime?: string | null; // e.g. "92 min"
  synopsis?: string;
  title?: string;
  type?: string;
  streamingAvailability?: {
    country?: Record<string, { platform: string; url: string }[]>;
  };
}

export interface RapidTitleDetails {
  imdbRating: number | null;
  synopsis: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  ottPlatformsIndia: OttPlatform[];
}

function parseRuntime(runtime: string | null | undefined): number | null {
  if (!runtime) return null;
  const match = runtime.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

// The RapidAPI free plan enforces a strict per-second rate limit (and a
// ~120/month hard cap on this endpoint), so every call is serialized with a
// small delay through this in-process queue. Callers should also cache
// results (see lib/title-enrichment.ts) rather than call this repeatedly.
let queue: Promise<unknown> = Promise.resolve();
const MIN_GAP_MS = 1200;
let lastCallAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function fetchTitleDetailsByImdbId(
  imdbId: string
): Promise<RapidTitleDetails | null> {
  return throttled(async () => {
    const res = await fetch(
      `https://${HOST}/gettitleDetails?imdbid=${encodeURIComponent(imdbId)}`,
      {
        headers: {
          "x-rapidapi-key": KEY!,
          "x-rapidapi-host": HOST!,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as RawTitleDetails;

    const india = data.streamingAvailability?.country?.IN ?? [];

    return {
      imdbRating: data.imdbrating ?? null,
      synopsis: data.synopsis ?? null,
      runtimeMinutes: parseRuntime(data.runtime),
      genres: data.genre ?? [],
      ottPlatformsIndia: india.map((p) => ({
        provider: p.platform,
        url: p.url,
      })),
    };
  });
}
