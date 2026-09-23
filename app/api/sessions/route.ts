import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { generateSessionCode } from "@/lib/codes";
import { jsonError } from "@/lib/api-utils";

const bodySchema = z.object({ deviceId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("deviceId is required");
  const { deviceId } = parsed.data;

  let code = generateSessionCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabaseServer
      .from("sessions")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateSessionCode();
  }

  const { data: session, error } = await supabaseServer
    .from("sessions")
    .insert({ code })
    .select("*")
    .single();
  if (error || !session) return jsonError(error?.message || "Could not create session", 500);

  const { error: participantError } = await supabaseServer
    .from("participants")
    .insert({ session_id: session.id, role: "A", device_id: deviceId });
  if (participantError) return jsonError(participantError.message, 500);

  return NextResponse.json({ code: session.code });
}
