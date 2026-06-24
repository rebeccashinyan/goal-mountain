-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- If migrating from old schema, run the migration at the bottom instead.

-- ============================================================
-- 1. Mountains (Mountain Generator Agent)
-- ============================================================
create table mountains (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  summit text not null,
  current_task text default '',
  progress integer default 0,
  current_milestone_index integer default 0,
  milestones jsonb not null default '[]',
  running_level text,
  race_date date,
  constraints text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table mountains enable row level security;
create policy "Allow all operations" on mountains
  for all using (true) with check (true);

-- ============================================================
-- 2. Research Cache (Research Agent)
-- ============================================================
create table research (
  id uuid primary key default gen_random_uuid(),
  mountain_id uuid references mountains(id) on delete cascade,
  query text not null,
  insights jsonb not null default '[]',
  resources jsonb not null default '[]',
  skill_gaps jsonb not null default '[]',
  created_at timestamptz default now()
);

alter table research enable row level security;
create policy "Allow all operations" on research
  for all using (true) with check (true);

-- ============================================================
-- 3. Weekly Plans (Planning + Strategy Agent)
-- ============================================================
create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  mountain_id uuid references mountains(id) on delete cascade,
  week_start date not null,
  plan jsonb not null default '{}',
  priority_recommendation text,
  next_best_action text,
  strategy_notes text,
  created_at timestamptz default now()
);

alter table weekly_plans enable row level security;
create policy "Allow all operations" on weekly_plans
  for all using (true) with check (true);

-- ============================================================
-- 4. Progress Logs (Progress Tracking Agent)
-- ============================================================
create table progress_logs (
  id uuid primary key default gen_random_uuid(),
  mountain_id uuid references mountains(id) on delete cascade,
  log_type text not null,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table progress_logs enable row level security;
create policy "Allow all operations" on progress_logs
  for all using (true) with check (true);

-- ============================================================
-- 5. Reflections (Reflection Agent)
-- ============================================================
create table reflections (
  id uuid primary key default gen_random_uuid(),
  mountain_id uuid references mountains(id) on delete cascade,
  week_start date not null,
  user_input jsonb not null default '{}',
  summary text,
  lessons_learned jsonb not null default '[]',
  blockers jsonb not null default '[]',
  adjustments jsonb not null default '[]',
  created_at timestamptz default now()
);

alter table reflections enable row level security;
create policy "Allow all operations" on reflections
  for all using (true) with check (true);

-- ============================================================
-- 6. Memory (Memory Agent)
-- ============================================================
create table memory (
  id uuid primary key default gen_random_uuid(),
  mountain_id uuid references mountains(id) on delete cascade,
  category text not null,
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table memory enable row level security;
create policy "Allow all operations" on memory
  for all using (true) with check (true);

-- ============================================================
-- Migration from old schema (if mountains table already exists)
-- ============================================================
-- Run these ALTER statements instead of creating fresh:
--
-- ALTER TABLE mountains ADD COLUMN IF NOT EXISTS running_level text;
-- ALTER TABLE mountains ADD COLUMN IF NOT EXISTS race_date date;
-- ALTER TABLE mountains ADD COLUMN IF NOT EXISTS constraints text;
--
-- Then create the 5 new tables above (research, weekly_plans,
-- progress_logs, reflections, memory).
