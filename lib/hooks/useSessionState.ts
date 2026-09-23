"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api, type SessionStateResponse } from "@/lib/api-client";

export function useSessionState(code: string, deviceId: string) {
  const [data, setData] = useState<SessionStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    if (!code || !deviceId) return;
    try {
      const res = await api.getSession(code, deviceId);
      setData(res);
      sessionIdRef.current = res.session.id;
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    }
  }, [code, deviceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    refetch();
  }, [refetch]);

  // Realtime: refetch whenever anything about this session changes.
  useEffect(() => {
    if (!code || !deviceId) return;
    let cancelled = false;

    const channel = supabaseBrowser
      .channel(`session:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `code=eq.${code.toUpperCase()}` },
        () => !cancelled && refetch()
      )
      .subscribe();

    // participants/preferences/matches are keyed by session_id, which we
    // only learn after the first fetch; a light poll covers the gap and
    // also acts as a fallback if Realtime isn't reachable.
    const interval = setInterval(refetch, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabaseBrowser.removeChannel(channel);
    };
  }, [code, deviceId, refetch]);

  return { data, error, refetch };
}
