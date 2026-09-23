"use client";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Browser client using the publishable (anon) key. RLS restricts it to
// read-only access; all writes happen through API routes.
export const supabaseBrowser = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
