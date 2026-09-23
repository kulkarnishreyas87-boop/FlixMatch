"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { TitleCardData } from "@/lib/supabase/types";

export function SwipeCard({
  title,
  onSwiped,
  active,
  stackIndex,
}: {
  title: TitleCardData;
  onSwiped: (direction: "like" | "pass") => void;
  active: boolean;
  stackIndex: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 140], [0, 1]);
  const passOpacity = useTransform(x, [-140, -20], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120 || info.velocity.x > 700) {
      onSwiped("like");
    } else if (info.offset.x < -120 || info.velocity.x < -700) {
      onSwiped("pass");
    }
  }

  return (
    <motion.div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-[28px] bg-neutral-900 shadow-2xl shadow-black/50"
      style={active ? { x, rotate, zIndex: 100 - stackIndex } : { zIndex: 100 - stackIndex }}
      drag={active ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: 1 - stackIndex * 0.04, y: stackIndex * 10, opacity: stackIndex > 2 ? 0 : 1 }}
      animate={{ scale: 1 - stackIndex * 0.04, y: stackIndex * 10, opacity: stackIndex > 2 ? 0 : 1 }}
      exit={{ x: x.get() > 0 ? 500 : -500, opacity: 0, transition: { duration: 0.3 } }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="relative flex-1 min-h-0">
        {title.poster_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={title.poster_path} alt={title.title} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-white/30">
            No poster
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {active && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute right-5 top-6 rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-xl font-extrabold text-emerald-400"
            >
              LIKE
            </motion.div>
            <motion.div
              style={{ opacity: passOpacity }}
              className="absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-xl font-extrabold text-rose-400"
            >
              PASS
            </motion.div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5 text-white">
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold leading-tight">{title.title}</h3>
            {title.year && <span className="text-white/60">{title.year}</span>}
          </div>
          <div className="flex items-center gap-3 text-sm text-white/80">
            {title.imdb_rating != null && (
              <span className="flex items-center gap-1 font-semibold text-amber-400">
                ★ {title.imdb_rating.toFixed(1)}
              </span>
            )}
            {title.runtime && <span>{title.runtime} min</span>}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs uppercase tracking-wide">
              {title.media_type === "movie" ? "Movie" : "Series"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-white/70">{title.synopsis}</p>
        </div>
      </div>
    </motion.div>
  );
}
