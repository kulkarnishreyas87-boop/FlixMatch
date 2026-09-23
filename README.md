# Match Night

Two people, one remote, zero arguments. Both partners set preferences independently, Gemini turns both profiles into a search brief, TMDB supplies a 30-title pool, both swipe, and a mutual like reveals the match with live India OTT links (RapidAPI). No match after two rounds → a top-5 shortlist to decide together. Everything is saved to Supabase so returning couples get smarter picks over time.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Realtime) — schema in `supabase/migrations/0001_init.sql`
- Gemini — search-brief / pool-refinement (`lib/ai/brief.ts`; swap in Claude later by rewriting that one file)
- TMDB — catalog, posters, metadata
- RapidAPI `ott-details` — real IMDb rating + India streaming links, cached in `title_cache` to respect its free-tier quota

## Setup

```bash
npm install
cp .env.example .env.local   # fill in real keys — never commit .env.local
npm run dev
```

The schema is already pushed to the Supabase project referenced in `.env.local`. To (re)push it elsewhere, run the SQL in `supabase/migrations/0001_init.sql` against your project (e.g. via the Supabase SQL editor, or the Management API's `database/query` endpoint with a `SUPABASE_ACCESS_TOKEN`).

## Notes

- RapidAPI's free plan caps out around 120 requests/month on this endpoint, so it's only called for the confirmed match (and cached forever after, benefiting every future session). The 30-card pool shows TMDB's rating instead of a live IMDb lookup for that reason.
- Couples are recognized by pairing two anonymous per-browser device IDs — no accounts. History only reattaches if both partners reopen the app on the same browsers.
