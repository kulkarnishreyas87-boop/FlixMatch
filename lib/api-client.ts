"use client";

import type {
  MatchRow,
  ParticipantRole,
  SessionRow,
  TitleCardData,
  TitlePoolRow,
} from "./supabase/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  createSession: (deviceId: string) =>
    request<{ code: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),

  joinSession: (code: string, deviceId: string) =>
    request<{ role: "A" | "B" }>(`/api/sessions/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),

  getSession: (code: string, deviceId: string) =>
    request<SessionStateResponse>(
      `/api/sessions/${code}?deviceId=${encodeURIComponent(deviceId)}`
    ),

  submitPreferences: (code: string, payload: Record<string, unknown>) =>
    request<{ status: string }>(`/api/sessions/${code}/preferences`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  swipe: (
    code: string,
    payload: { deviceId: string; tmdbId: number; mediaType: "movie" | "tv"; direction: "like" | "pass" }
  ) =>
    request<{ matched: boolean }>(`/api/sessions/${code}/swipe`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  completeRound: (code: string, deviceId: string) =>
    request<{ status: string }>(`/api/sessions/${code}/complete-round`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),

  finalChoice: (
    code: string,
    payload: { deviceId: string; tmdbId: number; mediaType: "movie" | "tv" }
  ) =>
    request<{ matched: boolean }>(`/api/sessions/${code}/final-choice`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMatch: (code: string) =>
    request<MatchDetailsResponse>(`/api/sessions/${code}/match`),

  submitRating: (
    code: string,
    payload: { tmdbId: number; mediaType: "movie" | "tv"; rating: number; note?: string }
  ) =>
    request<{ ok: boolean }>(`/api/sessions/${code}/rating`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export interface SessionStateResponse {
  session: SessionRow;
  participants: { role: ParticipantRole; joined: boolean; finishedRound: number }[];
  myRole: ParticipantRole | null;
  myFinishedRound: number;
  bothFinishedRound: boolean;
  preferencesSubmitted: { A: boolean; B: boolean };
  pool: TitlePoolRow | null;
  match: MatchRow | null;
  matchTitle: TitleCardData | null;
}

export interface MatchDetailsResponse {
  match: MatchRow;
  title: TitleCardData & { ottPlatformsIndia: { provider: string; url: string }[] };
}
