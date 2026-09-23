"use client";

import { useState } from "react";

export function RatingPrompt({
  onSubmit,
  onSkip,
}: {
  onSubmit: (rating: number, note?: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-2 flex w-full flex-col items-center gap-3 border-t border-white/10 pt-5">
      <p className="text-sm text-white/50">Watched it already? Rate it for next time.</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            aria-label={`${n} stars`}
            className={`text-2xl transition ${n <= rating ? "text-amber-400" : "text-white/20"}`}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="One line about it (optional)"
          className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-rose-400"
        />
      )}
      <div className="flex gap-2">
        <button onClick={onSkip} className="text-sm text-white/40 hover:text-white/70">
          Skip for now
        </button>
        {rating > 0 && (
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSubmit(rating, note || undefined);
              setSaving(false);
            }}
            className="rounded-full bg-rose-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save rating"}
          </button>
        )}
      </div>
    </div>
  );
}
