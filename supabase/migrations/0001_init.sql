-- Match Night schema
create extension if not exists pgcrypto;

-- Two anonymous browser device-ids that have completed a session together.
create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  device_x text not null,
  device_y text not null,
  created_at timestamptz not null default now(),
  last_session_at timestamptz not null default now(),
  constraint couples_pair_unique unique (device_x, device_y),
  constraint couples_sorted check (device_x < device_y)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  couple_id uuid references couples(id) on delete set null,
  status text not null default 'waiting_for_partner'
    check (status in (
      'waiting_for_partner', 'both_submitted', 'round_1', 'round_2',
      'final_call', 'matched', 'completed'
    )),
  round int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('A', 'B')),
  device_id text not null,
  joined_at timestamptz not null default now(),
  finished_round int not null default 0,
  constraint participants_session_role_unique unique (session_id, role)
);

create table if not exists preferences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  moods text[] not null default '{}',
  mood_free_text text,
  languages text[] not null default '{}',
  content_type text not null check (content_type in ('movies_only', 'include_series')),
  min_rating int not null check (min_rating in (6, 7, 8, 9)),
  eras text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  constraint preferences_participant_unique unique (participant_id)
);

create table if not exists title_pools (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round int not null,
  brief jsonb,
  titles jsonb not null default '[]',
  created_at timestamptz not null default now(),
  constraint title_pools_session_round_unique unique (session_id, round)
);

create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  round int not null,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  direction text not null check (direction in ('like', 'pass')),
  created_at timestamptz not null default now(),
  constraint swipes_unique unique (session_id, participant_id, round, tmdb_id)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round int not null,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  matched_at timestamptz not null default now(),
  constraint matches_session_unique unique (session_id)
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  rating int not null check (rating between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);

-- Cache-through layer in front of RapidAPI ott-details, keyed by TMDB id.
create table if not exists title_cache (
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  imdb_id text,
  imdb_rating numeric,
  synopsis text,
  runtime int,
  poster_path text,
  genres text[] not null default '{}',
  ott_platforms jsonb not null default '[]',
  fetched_at timestamptz not null default now(),
  primary key (tmdb_id, media_type)
);

create index if not exists idx_sessions_code on sessions(code);
create index if not exists idx_participants_session on participants(session_id);
create index if not exists idx_preferences_session on preferences(session_id);
create index if not exists idx_swipes_session on swipes(session_id);
create index if not exists idx_couples_devices on couples(device_x, device_y);

-- Row Level Security: anon role can only read. All writes go through the
-- server (Next.js API routes) using the service-role key, which bypasses RLS.
alter table couples enable row level security;
alter table sessions enable row level security;
alter table participants enable row level security;
alter table preferences enable row level security;
alter table title_pools enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table ratings enable row level security;
alter table title_cache enable row level security;

drop policy if exists "anon read couples" on couples;
create policy "anon read couples" on couples for select using (true);

drop policy if exists "anon read sessions" on sessions;
create policy "anon read sessions" on sessions for select using (true);

drop policy if exists "anon read participants" on participants;
create policy "anon read participants" on participants for select using (true);

drop policy if exists "anon read preferences" on preferences;
create policy "anon read preferences" on preferences for select using (true);

drop policy if exists "anon read title_pools" on title_pools;
create policy "anon read title_pools" on title_pools for select using (true);

drop policy if exists "anon read swipes" on swipes;
create policy "anon read swipes" on swipes for select using (true);

drop policy if exists "anon read matches" on matches;
create policy "anon read matches" on matches for select using (true);

drop policy if exists "anon read ratings" on ratings;
create policy "anon read ratings" on ratings for select using (true);

drop policy if exists "anon read title_cache" on title_cache;
create policy "anon read title_cache" on title_cache for select using (true);

-- Enable Realtime for the tables clients subscribe to.
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table preferences;
alter publication supabase_realtime add table title_pools;
alter publication supabase_realtime add table matches;
