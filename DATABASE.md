# Goal Mountain — Database Reference

Database: Supabase (PostgreSQL). All tables use UUIDs as primary keys and have Row Level Security enabled with open policies (auth is handled at the application layer).

Schema source: `supabase-schema.sql`

---

## Tables

### `mountains`

One row per user goal. The central table — all other tables reference this via `mountain_id`.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | Primary key |
| `goal` | text NOT NULL | — | The user's goal, refined by the Mountain Chat Agent |
| `summit` | text NOT NULL | — | The measurable success condition for this goal |
| `current_task` | text | `''` | Current task shown on the dashboard card (legacy field, often empty) |
| `progress` | integer | `0` | Progress percentage 0–100, updated by the Progress Tracking Agent |
| `current_milestone_index` | integer | `0` | Index into `milestones` array pointing to the active milestone |
| `milestones` | jsonb | `[]` | Ordered array of milestone objects (see Milestone Shape below) |
| `running_level` | text | null | Generic "current level" field (named from original running use case) |
| `race_date` | date | null | Generic "target date" field (named from original running use case) |
| `constraints` | text | null | Any constraints the user mentioned (time, budget, location, etc.) |
| `created_at` | timestamptz | now() | — |
| `updated_at` | timestamptz | now() | Updated when progress or milestones change |

**Milestone shape (each element of `milestones` jsonb array):**
```json
{
  "name": "Camp / checkpoint name",
  "description": "1-sentence description",
  "type": "camp | checkpoint",
  "estimated_duration": "e.g. 2 weeks",
  "completed": false,
  "current": true,
  "order_index": 0
}
```

**Notes:**
- `running_level` and `race_date` are legacy column names — they store generic `current_level` and `target_date` values for any goal type. No migration needed.
- `milestones` is mutated in-place by the Progress Tracking Agent when milestones complete.
- `current_milestone_index` is advanced when a milestone completes.

---

### `research`

Research Agent results, scoped to a mountain. One mountain can have many research rows (multiple sessions over time).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `mountain_id` | uuid FK → mountains.id ON DELETE CASCADE | — | — |
| `query` | text NOT NULL | — | Describes what was researched (e.g. `"Learn Spanish — initial research"`) |
| `insights` | jsonb | `[]` | Array of `{ title, detail }` objects |
| `resources` | jsonb | `[]` | Array of `{ name, type, reason }` objects |
| `skill_gaps` | jsonb | `[]` | Array of `{ skill, priority, suggestion }` objects |
| `created_at` | timestamptz | now() | — |

**Notes:**
- Pre-mountain research is saved here by `/api/generate-mountain` (not by `/api/research`) after the mountain is created.
- Post-mountain research (from `/api/research` POST) also saves here.
- The Research Agent reads past rows to avoid repeating the same topics.
- The Insights page reads via `GET /api/research?mountain_id=uuid`.

---

### `weekly_plans`

Planning + Strategy Agent output. One row per planning session (multiple per mountain over time).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `mountain_id` | uuid FK → mountains.id ON DELETE CASCADE | — | — |
| `week_start` | date NOT NULL | — | Monday of the week this plan was generated for |
| `plan` | jsonb | `{}` | Full schedule — `{ schedule: [{ day, tasks: [{ task, duration, priority }] }], focus_area, difficulty_level }` |
| `priority_recommendation` | text | null | The single most important thing to do this week |
| `next_best_action` | text | null | The very next thing to do right now |
| `strategy_notes` | text | null | Broader strategic thinking about the user's trajectory |
| `created_at` | timestamptz | now() | — |

**Notes:**
- The Planning Agent reads the last 3 plans to learn from past performance before generating a new one.
- The Overview page reads the most recent plan via `GET /api/plan?mountain_id=uuid`.

---

### `progress_logs`

Raw activity log entries from the Progress Tracking Agent. Append-only — never updated.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `mountain_id` | uuid FK → mountains.id ON DELETE CASCADE | — | — |
| `log_type` | text NOT NULL | — | One of: `activity`, `completed_task`, `missed_activity`, `milestone_reached`, `rest_day` |
| `data` | jsonb | `{}` | Freeform log payload (effort level, description, duration, etc.) |
| `created_at` | timestamptz | now() | — |

**Notes:**
- Each write to `progress_logs` triggers an AI analysis that may update `mountains.progress`, `mountains.current_milestone_index`, and `mountains.milestones`.
- The Insights page builds the weekly progress calendar from this table.
- The Reflection Agent reads the last 14 logs for context.
- The Strategic Intelligence Agent reads the last 30 logs.

---

### `reflections`

Weekly reflection entries, one per week per mountain.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `mountain_id` | uuid FK → mountains.id ON DELETE CASCADE | — | — |
| `week_start` | date NOT NULL | — | Monday of the week being reflected on |
| `user_input` | jsonb NOT NULL | `{}` | Raw reflection input from the user (freeform questions + answers) |
| `summary` | text | null | 2–3 sentence AI-generated reflection summary |
| `lessons_learned` | jsonb | `[]` | Array of strings |
| `blockers` | jsonb | `[]` | Array of `{ blocker, frequency, suggestion }` objects |
| `adjustments` | jsonb | `[]` | Array of strings — plan adjustments to recommend |
| `created_at` | timestamptz | now() | — |

**Notes:**
- After each reflection, the Reflection Agent writes new memories to the `memory` table automatically.
- The Insights page aggregates `blockers` from all reflections for the "Obstacles & Risks" section.
- The Guide Agent reads the most recent reflection for context.

---

### `memory`

Long-term personalization store for the Memory Agent. Written automatically by the Reflection Agent; can also be written manually.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `mountain_id` | uuid FK → mountains.id ON DELETE CASCADE | — | — |
| `category` | text NOT NULL | — | One of: `goal`, `preference`, `motivation`, `obstacle`, `behavior_pattern` |
| `content` | text NOT NULL | — | The memory in plain text |
| `metadata` | jsonb | `{}` | Source info — e.g. `{ source: "reflection", reflection_id: "uuid" }` |
| `created_at` | timestamptz | now() | — |
| `updated_at` | timestamptz | now() | — |

**Memory categories:**

| Category | What it stores | Written by |
|----------|---------------|-----------|
| `goal` | Stated goals, ambitions | Manual or Reflection Agent |
| `preference` | How user likes to work | Reflection Agent |
| `motivation` | What energizes or drives them | Reflection Agent |
| `obstacle` | Recurring blockers | Reflection Agent |
| `behavior_pattern` | Observed patterns (e.g. "works best mornings") | Reflection Agent |

**Notes:**
- The Analysis page (`/analysis`) displays all memories and lets users delete individual entries.
- The Memory Profile endpoint (`GET /api/memory/profile`) synthesizes memories into a structured profile using GPT.
- Injected as context into: Planning Agent, Research Agent (post-mode), Reflection Agent, Guide Agent, Strategic Intelligence Agent.

---

## Relationships

```
mountains (1)
  ├── (many) research         → mountain_id FK, cascade delete
  ├── (many) weekly_plans     → mountain_id FK, cascade delete
  ├── (many) progress_logs    → mountain_id FK, cascade delete
  ├── (many) reflections      → mountain_id FK, cascade delete
  └── (many) memory           → mountain_id FK, cascade delete
```

All child rows are deleted when a mountain is deleted (ON DELETE CASCADE).

---

## API Routes

| Method | Route | Table(s) written | Table(s) read |
|--------|-------|-----------------|---------------|
| GET | `/api/mountains` | — | mountains |
| POST | `/api/mountains` | — | — |
| GET | `/api/mountains/[id]` | — | mountains |
| DELETE | `/api/mountains/[id]` | — (cascade) | mountains |
| POST | `/api/generate-mountain` | mountains, research | memory |
| POST | `/api/research` | research (post-mode only) | mountains, research, memory |
| GET | `/api/research` | — | research |
| POST | `/api/plan` | weekly_plans | mountains, weekly_plans, progress_logs, memory |
| GET | `/api/plan` | — | weekly_plans |
| POST | `/api/track-progress` | progress_logs, mountains | mountains, progress_logs |
| GET | `/api/track-progress` | — | progress_logs |
| POST | `/api/reflect` | reflections, memory | mountains, reflections, progress_logs, memory |
| GET | `/api/reflect` | — | reflections |
| POST | `/api/memory` | memory | — |
| GET | `/api/memory` | — | memory |
| DELETE | `/api/memory` | — (delete by id) | memory |
| GET | `/api/memory/profile` | — | memory |
| POST | `/api/guide` | — | mountains, memory, weekly_plans, reflections, progress_logs |
| POST | `/api/insights` | — | mountains, memory, reflections, progress_logs |
| POST | `/api/create-mountain-chat` | — | — |

---

## Running the Schema

Open Supabase Dashboard → SQL Editor → New Query, paste `supabase-schema.sql`, run.

**If migrating from an older schema** (mountains table already exists), run only the ALTER statements at the bottom of the file, then create the 5 new tables.
