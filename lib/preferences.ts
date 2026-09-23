import type { ContentType, PreferencesRow } from "./supabase/types";

export const MOOD_OPTIONS = [
  "Light & fun",
  "Intense & gripping",
  "Scary",
  "Romantic",
  "Other",
] as const;

export const LANGUAGE_OPTIONS = [
  "Hindi",
  "English",
  "Tamil",
  "Telugu",
  "Kannada",
  "Any",
] as const;

export const ERA_OPTIONS = [
  "Any",
  "Classic (pre-2000)",
  "2000–2020",
  "Recent (2021–2026)",
] as const;

export const LANGUAGE_TMDB_CODES: Record<string, string> = {
  Hindi: "hi",
  English: "en",
  Tamil: "ta",
  Telugu: "te",
  Kannada: "kn",
};

export const ERA_RANGES: Record<string, { gte?: string; lte?: string }> = {
  "Classic (pre-2000)": { lte: "1999-12-31" },
  "2000–2020": { gte: "2000-01-01", lte: "2020-12-31" },
  "Recent (2021–2026)": { gte: "2021-01-01", lte: "2026-12-31" },
};

export interface CombinedPreferences {
  languages: string[]; // TMDB language codes; empty = no constraint (Any)
  eras: string[]; // subset of ERA_OPTIONS keys (excluding "Any"); empty = no constraint
  minRating: number; // stricter of the two (max)
  contentType: ContentType; // movies_only if either partner restricted to movies
}

function effectiveSet(values: string[], anyValue: string): string[] {
  if (values.length === 0 || values.includes(anyValue)) return [];
  return values;
}

/** Both partners must be satisfied: intersect selections, "Any" = wildcard. */
export function combinePreferences(
  a: PreferencesRow,
  b: PreferencesRow
): CombinedPreferences {
  const langsA = effectiveSet(a.languages, "Any");
  const langsB = effectiveSet(b.languages, "Any");
  const languages =
    langsA.length === 0
      ? langsB
      : langsB.length === 0
        ? langsA
        : langsA.filter((l) => langsB.includes(l));

  const erasA = effectiveSet(a.eras, "Any");
  const erasB = effectiveSet(b.eras, "Any");
  const eras =
    erasA.length === 0
      ? erasB
      : erasB.length === 0
        ? erasA
        : erasA.filter((e) => erasB.includes(e));

  return {
    languages,
    eras,
    minRating: Math.max(a.min_rating, b.min_rating),
    contentType:
      a.content_type === "movies_only" || b.content_type === "movies_only"
        ? "movies_only"
        : "include_series",
  };
}
