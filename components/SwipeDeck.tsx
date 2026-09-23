"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { SwipeCard } from "./SwipeCard";
import { seededShuffle } from "@/lib/shuffle";
import type { TitleCardData } from "@/lib/supabase/types";

export function SwipeDeck({
  titles,
  seed,
  onSwipe,
  onComplete,
}: {
  titles: TitleCardData[];
  seed: string;
  onSwipe: (title: TitleCardData, direction: "like" | "pass") => void;
  onComplete: () => void;
}) {
  const ordered = useMemo(() => seededShuffle(titles, seed), [titles, seed]);
  const [index, setIndex] = useState(0);

  const remaining = ordered.slice(index, index + 4);
  const isDone = index >= ordered.length;

  function handleSwipe(title: TitleCardData, direction: "like" | "pass") {
    onSwipe(title, direction);
    const next = index + 1;
    setIndex(next);
    if (next >= ordered.length) onComplete();
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative aspect-[3/4.6] w-full max-w-sm">
        {isDone ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[28px] border border-white/10 bg-white/5 text-center text-white/60">
            <p className="text-lg font-medium">That&apos;s everyone for this round.</p>
            <p className="text-sm">Waiting on your partner to finish…</p>
          </div>
        ) : (
          <AnimatePresence>
            {remaining.map((title, i) => (
              <SwipeCard
                key={`${title.tmdb_id}-${title.media_type}`}
                title={title}
                active={i === 0}
                stackIndex={i}
                onSwiped={(direction) => handleSwipe(title, direction)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {!isDone && (
        <div className="flex items-center gap-6">
          <button
            aria-label="Pass"
            onClick={() => handleSwipe(remaining[0], "pass")}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl text-rose-400 transition hover:bg-white/10"
          >
            ✕
          </button>
          <span className="text-xs text-white/40">
            {index + 1} / {ordered.length}
          </span>
          <button
            aria-label="Like"
            onClick={() => handleSwipe(remaining[0], "like")}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-2xl text-emerald-400 transition hover:bg-emerald-400/20"
          >
            ♥
          </button>
        </div>
      )}
    </div>
  );
}
