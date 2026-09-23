"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/device";
import { api } from "@/lib/api-client";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const deviceId = getDeviceId();
      const { code } = await api.createSession(deviceId);
      router.push(`/session/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[radial-gradient(circle_at_top,_#2a1730,_#0d0710)] px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/50">
          Two people. One remote. Zero arguments.
        </span>
        <h1 className="max-w-sm text-4xl font-extrabold leading-tight text-white sm:text-5xl">
          Match <span className="text-rose-400">Night</span>
        </h1>
        <p className="max-w-xs text-white/60">
          Swipe together, find the one thing you both actually want to watch tonight — and exactly where to stream it in India.
        </p>
      </div>

      <button
        onClick={handleStart}
        disabled={loading}
        className="rounded-full bg-rose-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-400 disabled:opacity-50"
      >
        {loading ? "Starting…" : "Start a Match Night"}
      </button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </main>
  );
}
