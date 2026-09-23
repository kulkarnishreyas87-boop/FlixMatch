"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, type MatchDetailsResponse } from "@/lib/api-client";
import { RatingPrompt } from "./RatingPrompt";

const PLATFORM_LABELS: Record<string, string> = {
  netflix: "Netflix",
  amazon: "Prime Video",
  hotstar: "Disney+ Hotstar",
  primevideo: "Prime Video",
  jiocinema: "JioCinema",
  sonyliv: "SonyLIV",
  zee5: "ZEE5",
  play: "Google Play",
  itunes: "Apple TV",
  youtube: "YouTube",
};

function platformLabel(provider: string) {
  return PLATFORM_LABELS[provider.toLowerCase()] || provider.replace(/(^\w)/, (c) => c.toUpperCase());
}

export function MatchReveal({ code, onRated }: { code: string; onRated: () => void }) {
  const [details, setDetails] = useState<MatchDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    api
      .getMatch(code)
      .then(setDetails)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load match"));
  }, [code]);

  if (error) return <p className="text-white/70">{error}</p>;
  if (!details) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/60">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-rose-400" />
        <p>Fetching where to watch it…</p>
      </div>
    );
  }

  const { title } = details;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <motion.span
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-full bg-gradient-to-r from-rose-500 to-amber-400 px-5 py-1.5 text-sm font-bold uppercase tracking-widest text-white"
      >
        It&apos;s a match
      </motion.span>

      {title.poster_path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={title.poster_path}
          alt={title.title}
          className="h-72 w-48 rounded-2xl object-cover shadow-2xl shadow-rose-500/30"
        />
      )}

      <div>
        <h2 className="text-3xl font-bold text-white">{title.title}</h2>
        <p className="mt-1 text-sm text-white/60">
          {title.year} · {title.runtime ? `${title.runtime} min` : ""}{" "}
          {title.imdb_rating != null && <>· ★ {title.imdb_rating.toFixed(1)} IMDb</>}
        </p>
      </div>

      <p className="text-white/70">{title.synopsis}</p>

      <div className="flex w-full flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">
          Watch it now in India
        </h3>
        {title.ottPlatformsIndia.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {title.ottPlatformsIndia.map((p) => (
              <a
                key={p.provider + p.url}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                {platformLabel(p.provider)} ↗
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/40">
            Not currently listed on a major Indian streaming platform — worth a quick search.
          </p>
        )}
      </div>

      {!rated ? (
        <RatingPrompt
          onSubmit={async (rating, note) => {
            await api.submitRating(code, {
              tmdbId: title.tmdb_id,
              mediaType: title.media_type,
              rating,
              note,
            });
            setRated(true);
            onRated();
          }}
          onSkip={onRated}
        />
      ) : (
        <p className="text-sm text-emerald-400">Thanks — saved for next time. Enjoy the movie!</p>
      )}
    </motion.div>
  );
}
