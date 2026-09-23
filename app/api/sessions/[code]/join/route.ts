import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionByCode, getParticipants, jsonError, touchSession } from "@/lib/api-utils";

const bodySchema = z.object({ deviceId: z.string().min(1) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("deviceId is required");
  const { deviceId } = parsed.data;

  const session = await getSessionByCode(code);
  if (!session) return jsonError("Session not found", 404);

  const participants = await getParticipants(session.id);
  const existingA = participants.find((p) => p.role === "A");
  const existingB = participants.find((p) => p.role === "B");

  if (existingA?.device_id === deviceId) return NextResponse.json({ role: "A" });
  if (existingB?.device_id === deviceId) return NextResponse.json({ role: "B" });
  if (existingB) return jsonError("This session already has two partners", 409);

  const { error } = await supabaseServer
    .from("participants")
    .insert({ session_id: session.id, role: "B", device_id: deviceId });
  if (error) return jsonError(error.message, 500);

  await touchSession(session.id, { status: "waiting_for_partner" });

  return NextResponse.json({ role: "B" });
}
