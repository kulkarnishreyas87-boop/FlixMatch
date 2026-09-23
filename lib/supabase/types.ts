export type SessionStatus =
  | "waiting_for_partner"
  | "both_submitted"
  | "round_1"
  | "round_2"
  | "final_call"
  | "matched"
  | "completed";

export type ContentType = "movies_only" | "include_series";
export type MediaType = "movie" | "tv";
export type SwipeDirection = "like" | "pass";
export type ParticipantRole = "A" | "B";

export interface SessionRow {
  id: string;
  code: string;
  couple_id: string | null;
  status: SessionStatus;
  round: number;
  created_at: string;
  updated_at: string;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  role: ParticipantRole;
  device_id: string;
  joined_at: string;
  finished_round: number;
}

export interface PreferencesRow {
  id: string;
  session_id: string;
  participant_id: string;
  moods: string[];
  mood_free_text: string | null;
  languages: string[];
  content_type: ContentType;
  min_rating: number;
  eras: string[];
  submitted_at: string;
}

export interface TitleCardData {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  year: number | null;
  poster_path: string | null;
  runtime: number | null;
  synopsis: string;
  imdb_rating: number | null;
  genres: string[];
}

export interface TitlePoolRow {
  id: string;
  session_id: string;
  round: number;
  brief: unknown;
  titles: TitleCardData[];
  created_at: string;
}

export interface SwipeRow {
  id: string;
  session_id: string;
  participant_id: string;
  round: number;
  tmdb_id: number;
  media_type: MediaType;
  direction: SwipeDirection;
  created_at: string;
}

export interface OttPlatform {
  provider: string;
  url: string;
  logo?: string | null;
}

export interface MatchRow {
  id: string;
  session_id: string;
  round: number;
  tmdb_id: number;
  media_type: MediaType;
  matched_at: string;
}

export interface RatingRow {
  id: string;
  session_id: string;
  tmdb_id: number;
  media_type: MediaType;
  rating: number;
  note: string | null;
  created_at: string;
}

export interface TitleCacheRow {
  tmdb_id: number;
  media_type: MediaType;
  imdb_id: string | null;
  imdb_rating: number | null;
  synopsis: string | null;
  runtime: number | null;
  poster_path: string | null;
  genres: string[];
  ott_platforms: OttPlatform[];
  fetched_at: string;
}
