"use client";

import { useState } from "react";
import type { TitleCardData } from "@/lib/supabase/types";

export function FinalCallDecision({
  titles,
  onChoose,
}: {
  titles: TitleCardData[];
  onChoose: (title: TitleCardData) => void;
}) {
  const [choosing, setChoosing] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
      <div>
        <h2 className="text-2xl font-bold text-white">Down to the wire</h2>
        <p className="mt-1 text-sm text-white/60">
          No mutual match yet — these are your combined top picks. Talk it over and tap the one you&apos;ll watch.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        {titles.map((t) => {
          const key = `${t.tmdb_id}-${t.media_type}`;
          return (
            <button
              key={key}
              disabled={choosing !== null}
              onClick={() => {
                setChoosing(key);
                onChoose(t);
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-rose-400/50 hover:bg-white/10 disabled:opacity-60"
            >
              {t.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.poster_path} alt={t.title} className="h-20 w-14 rounded-lg object-cover" />
              ) : (
                <div className="h-20 w-14 rounded-lg bg-neutral-800" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-white">{t.title}</p>
                <p className="text-xs text-white/50">
                  {t.year} {t.imdb_rating != null && <>· ★ {t.imdb_rating.toFixed(1)}</>}
                </p>
              </div>
              <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300">
                {choosing === key ? "Locking in…" : "We'll watch this"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
