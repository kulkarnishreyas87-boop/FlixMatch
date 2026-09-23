import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer } from "./supabase/server";
import type { ParticipantRow, SessionRow } from "./supabase/types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getSessionByCode(code: string): Promise<SessionRow | null> {
  const { data } = await supabaseServer
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return (data as SessionRow) ?? null;
}

export async function getParticipants(sessionId: string): Promise<ParticipantRow[]> {
  const { data } = await supabaseServer
    .from("participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("role", { ascending: true });
  return (data as ParticipantRow[]) ?? [];
}

export async function touchSession(sessionId: string, patch: Partial<SessionRow>) {
  await supabaseServer
    .from("sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}
