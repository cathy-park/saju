-- Run this in your Supabase dashboard → SQL Editor

-- ── profiles (mirrors auth.users) ────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "Users can read own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- ── my_saju_profiles ─────────────────────────────────────────────
create table if not exists my_saju_profiles (
  id                   text primary key,
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  gender               text,
  birth_date           date not null,
  birth_time           text,
  birth_calendar_type  text not null default 'solar',
  birthplace           text,
  saju_payload         jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table my_saju_profiles enable row level security;
create policy "Users can read own saju profile"   on my_saju_profiles for select using (auth.uid() = user_id);
create policy "Users can insert own saju profile" on my_saju_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own saju profile" on my_saju_profiles for update using (auth.uid() = user_id);
create policy "Users can delete own saju profile" on my_saju_profiles for delete using (auth.uid() = user_id);

-- ── partner_profiles ─────────────────────────────────────────────
create table if not exists partner_profiles (
  id                   text primary key,
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  gender               text,
  birth_date           date not null,
  birth_time           text,
  birth_calendar_type  text not null default 'solar',
  memo                 text,
  saju_payload         jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table partner_profiles enable row level security;
create policy "Users can read own partner profiles"   on partner_profiles for select using (auth.uid() = user_id);
create policy "Users can insert own partner profiles" on partner_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own partner profiles" on partner_profiles for update using (auth.uid() = user_id);
create policy "Users can delete own partner profiles" on partner_profiles for delete using (auth.uid() = user_id);

-- ── compatibility_history ─────────────────────────────────────────
create table if not exists compatibility_history (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  person1_id      text not null,
  person2_id      text not null,
  person1_name    text not null,
  person2_name    text not null,
  total_score     integer not null,
  grade           text not null,
  keywords        text[],
  subscores       jsonb,
  domains         jsonb,
  summary         text,
  strengths       text[],
  cautions        text[],
  advice          text[],
  result_payload  jsonb,
  created_at      timestamptz not null default now()
);
alter table compatibility_history enable row level security;
create policy "Users can read own compatibility history"   on compatibility_history for select using (auth.uid() = user_id);
create policy "Users can insert own compatibility history" on compatibility_history for insert with check (auth.uid() = user_id);
create policy "Users can delete own compatibility history" on compatibility_history for delete using (auth.uid() = user_id);
