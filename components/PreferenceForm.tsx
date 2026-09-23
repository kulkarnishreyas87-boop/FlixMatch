"use client";

import { useState } from "react";
import { ERA_OPTIONS, LANGUAGE_OPTIONS, MOOD_OPTIONS } from "@/lib/preferences";
import type { ContentType } from "@/lib/supabase/types";

export interface PreferenceFormValues {
  moods: string[];
  moodFreeText: string;
  languages: string[];
  contentType: ContentType;
  minRating: 6 | 7 | 8 | 9;
  eras: string[];
}

function toggleInList(list: string[], value: string, anyValue?: string): string[] {
  if (anyValue && value === anyValue) return list.includes(anyValue) ? [] : [anyValue];
  const withoutAny = anyValue ? list.filter((v) => v !== anyValue) : list;
  return withoutAny.includes(value)
    ? withoutAny.filter((v) => v !== value)
    : [...withoutAny, value];
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-500/30"
          : "border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

export function PreferenceForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (values: PreferenceFormValues) => void;
  submitting: boolean;
}) {
  const [moods, setMoods] = useState<string[]>([]);
  const [moodFreeText, setMoodFreeText] = useState("");
  const [languages, setLanguages] = useState<string[]>(["Any"]);
  const [contentType, setContentType] = useState<ContentType>("include_series");
  const [minRating, setMinRating] = useState<6 | 7 | 8 | 9>(6);
  const [eras, setEras] = useState<string[]>(["Any"]);

  const canSubmit = moods.length > 0 && languages.length > 0 && eras.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit || submitting) return;
        onSubmit({ moods, moodFreeText, languages, contentType, minRating, eras });
      }}
      className="flex w-full max-w-xl flex-col gap-8"
    >
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Mood</h2>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map((m) => (
            <Chip key={m} label={m} active={moods.includes(m)} onClick={() => setMoods(toggleInList(moods, m))} />
          ))}
        </div>
        <textarea
          value={moodFreeText}
          onChange={(e) => setMoodFreeText(e.target.value)}
          placeholder="Describe what you're in the mood for tonight (optional)"
          rows={2}
          className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-rose-400"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Language</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((l) => (
            <Chip
              key={l}
              label={l}
              active={languages.includes(l)}
              onClick={() => setLanguages(toggleInList(languages, l, "Any"))}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Content type</h2>
        <div className="flex gap-2">
          {(
            [
              { value: "movies_only", label: "Movies only" },
              { value: "include_series", label: "Include series" },
            ] as const
          ).map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={contentType === opt.value}
              onClick={() => setContentType(opt.value)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Minimum IMDb rating</h2>
        <div className="flex flex-wrap items-center gap-2">
          {([6, 7, 8, 9] as const).map((r) => (
            <Chip key={r} label={`${r}+`} active={minRating === r} onClick={() => setMinRating(r)} />
          ))}
          {minRating === 9 && (
            <span className="text-xs italic text-white/40">very few titles</span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Era</h2>
        <div className="flex flex-wrap gap-2">
          {ERA_OPTIONS.map((e) => (
            <Chip key={e} label={e} active={eras.includes(e)} onClick={() => setEras(toggleInList(eras, e, "Any"))} />
          ))}
        </div>
      </section>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-2 rounded-full bg-rose-500 px-6 py-3.5 text-base font-semibold text-white transition-all hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Lock in my preferences"}
      </button>
    </form>
  );
}
