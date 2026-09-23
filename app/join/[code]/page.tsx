"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/device";
import { api } from "@/lib/api-client";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const deviceId = getDeviceId();
    api
      .joinSession(code, deviceId)
      .then(() => router.replace(`/session/${code}`))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not join session"));
  }, [code, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,_#2a1730,_#0d0710)] px-6 text-center">
      {error ? (
        <>
          <p className="text-white/80">{error}</p>
          <p className="text-sm text-white/40">Double-check the code or ask for a fresh link.</p>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-rose-400" />
          <p className="text-white/60">Joining Match Night…</p>
        </>
      )}
    </main>
  );
}
