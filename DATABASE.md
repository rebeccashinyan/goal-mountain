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
  "name": "Milestone name (a concrete capability or outcome)",
  "description": "1-sentence description",
  "type": "camp",
  "estimated_duration": "e.g. 2 weeks",
  "completed": false,
  "current": true,
  "order_index": 0
}
```

**Notes:**
- Milestones are single-tier as of 2026-07-09: the generator emits 5–8 named stages, all `type: "camp"`. Mountains created earlier may still contain `type: "checkpoint"` entries — treat both types identically when reading. No migration needed.
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
| `plan` | jsonb | `{}` | Full schedule + lifecycle state — see the breakdown below |
| `priority_recommendation` | text | null | The single most important thing to do this week. Also revised by `POST /api/plan/steer` and by applying a revision |
| `next_best_action` | text | null | The very next thing to do right now |
| `strategy_notes` | text | null | Broader strategic thinking about the user's trajectory |
| `created_at` | timestamptz | now() | — |

**`plan` jsonb shape:**

| Key | Description |
|-----|-------------|
| `schedule` | `[{ day, tasks: [{ task, duration, priority, status? }], finished?, load_feel? }]`. The daily check-in writes `status: "done"\|"missed"` per task, plus `finished: true` and `load_feel: "lighter"\|"about_right"\|"heavier"` per day |
| `focus_area`, `difficulty_level` | From the Planning Agent |
| `status` | `"draft"` \| `"active"`. **Every** generated week starts as `"draft"`; "Start this week" flips it to `"active"`. Rows predating this lifecycle have no `status` — those count as legacy active plans (anything not explicitly `"draft"` is active) |
| `what_changed` | Short phrases describing how this week adapted to the last one. Populated from the second week onward; empty on a first week |
| `pending_revision` | `{ schedule, focus_area, priority_recommendation, note, diff, created_at }` — a proposed whole-plan change awaiting the user's decision. Written by `/api/plan/steer` on **drafts and active weeks alike**, and cleared by `POST /api/plan/revision`. While present, the live `schedule` is authoritative and untouched |
| `plan_start_date` | date string (`YYYY-MM-DD`) — the first day this plan actually covers. Equal to `week_start` unless generation happened mid-week, in which case it's the generation date. `schedule` never has entries for days before it — see the Planning Agent's mid-week generation behavior in AGENTS.md. Absent on rows written before this existed; the UI treats a missing value as "not before the plan" (no muting), so old rows render exactly as they always have |
| `activated_from` | date string (`YYYY-MM-DD`) — the date "Start this week" was actually pressed, set once by `POST /api/plan/rebase` in the same write that flips `status` to `"active"`. Days before it are never tracking evidence, even if the schedule once had tasks there (they're rescued or dropped at that same moment — see AGENTS.md → Planning Agent). Absent on draft rows and on legacy active rows predating this field; the UI treats a missing value as "not before activation" (no muting) |

**Notes:**
- **`week_start` is not unique.** Regenerating a draft inserts another row for the same week, so the *effective* plan for a week is the **newest row for that `week_start`** — never simply the newest row overall, which may be a next-week draft the user hasn't accepted.
- **Only active plans are behavioural evidence.** The Planning, Reflection, Guide, and Proactive agents filter to active plans before reading history; a draft the user never started must never be interpreted as tasks they missed. Both rules live in [lib/plans.ts](lib/plans.ts) (`effectivePlans()`, `activeHistory()`) — use them rather than re-deriving the filter.
- Only an active plan can produce daily tracking, progress logs, daily check-ins, or a week reflection.
- **`schedule` may cover fewer than 7 days.** A day before `plan_start_date` was never generated for; a day before `activated_from` (on an active plan) was rescued or dropped when the draft was finally started. Neither is a rest day, neither is "not logged" — `PlanView` renders both as a muted column ("Before this plan" / "Before you started") instead of a trackable one.
- `POST /api/plan/steer` (quick actions + guide requests), `POST /api/plan/revision` (apply/discard a proposed change), `POST /api/plan/replace-task` (the two-step AI-assisted single-task Replace flow — directions, then a concrete task), and `POST /api/plan/rebase` (what "Start this week" actually calls — rescues any already-passed tasks before activating) are companions to `POST /api/plan` — see AGENTS.md → Planning + Strategy Agent. None of them insert rows: `steer`, `revision`, and `rebase` update the existing plan in place, and `replace-task` is stateless (it reads `weekly_plans` by `plan_id` for schedule context, but the client applies the confirmed replacement via `PATCH /api/plan`).

---

### `progress_logs`

Raw activity log entries from the Progress Tracking Agent. Append-only — never updated.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `mountain_id` | uuid FK → mountains.id ON DELETE CASCADE | — | — |
| `log_type` | text NOT NULL | — | One of: `activity`, `missed_activity` |
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
| `user_input` | jsonb NOT NULL | `{}` | `{ auto: true }` for automatic weekly reviews (the default flow — synthesized from plan statuses + logs); legacy rows hold raw manual form input |
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

### `guide_chats`

Persistent Guide Agent conversations. One row per conversation session (user-initiated or AI-proactive).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `mountain_id` | uuid FK → mountains.id ON DELETE CASCADE | null | null = All Mountains context |
| `title` | text NOT NULL | — | Short label shown in the sidebar |
| `type` | text | `'user_initiated'` | `'user_initiated'` or `'ai_proactive'` |
| `unread` | boolean | `false` | True for new AI-proactive chats until opened |
| `last_message` | text | null | Preview shown in sidebar (first 100 chars of latest message) |
| `created_at` | timestamptz | now() | — |
| `updated_at` | timestamptz | now() | Updated when a new message is sent |

**Notes:**
- AI-proactive chats are created by `POST /api/proactive` when inactivity conditions are met (daysSinceLastLog ≥ 3, missedCount ≥ 2, or zero activities this week). Deduped per mountain per day.
- `mountain_id` is null for "All Mountains" context chats.

---

### `guide_messages`

Individual messages within a guide chat.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid PK | gen_random_uuid() | — |
| `chat_id` | uuid FK → guide_chats.id ON DELETE CASCADE | — | Parent chat |
| `role` | text NOT NULL | — | `'user'` or `'ai'` |
| `content` | text NOT NULL | — | Message text |
| `suggested_replies` | jsonb | `[]` | Array of up to 3 short reply strings (AI messages only) |
| `actions` | jsonb | `[]` | Client-side actions returned by AI: `advance_milestone`, `propose_plan` |
| `created_at` | timestamptz | now() | — |

**Notes:**
- Server-side actions (`store_memory`, `log_progress`) are executed inside the route before saving — they do not appear in `actions`.
- `suggested_replies` are rendered as clickable chips below the AI message in the sidebar chat.

---

## Relationships

```
mountains (1)
  ├── (many) research         → mountain_id FK, cascade delete
  ├── (many) weekly_plans     → mountain_id FK, cascade delete
  ├── (many) progress_logs    → mountain_id FK, cascade delete
  ├── (many) reflections      → mountain_id FK, cascade delete
  ├── (many) memory           → mountain_id FK, cascade delete
  └── (many) guide_chats      → mountain_id FK, cascade delete (nullable)
        └── (many) guide_messages → chat_id FK, cascade delete
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
| POST | `/api/plan` | weekly_plans (always as a draft) | mountains, weekly_plans, progress_logs, memory |
| PATCH | `/api/plan` | weekly_plans (plan jsonb, optionally priority_recommendation) | — |
| GET | `/api/plan` | — | weekly_plans |
| POST | `/api/plan/steer` | weekly_plans (always as a pending revision), memory (preference) | weekly_plans, mountains, memory |
| POST | `/api/plan/revision` | weekly_plans (apply/discard a pending revision) | weekly_plans |
| POST | `/api/plan/strategies` | — | weekly_plans, mountains, memory |
| POST | `/api/plan/fill-time` | — | weekly_plans, mountains |
| POST | `/api/plan/replace-task` | — | mountains, weekly_plans |
| POST | `/api/plan/rebase` | weekly_plans (rescues expired tasks if any, sets status active + activated_from) | mountains, weekly_plans |
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
| GET | `/api/chats` | — | guide_chats |
| POST | `/api/chats` | guide_chats | — |
| GET | `/api/chats/[id]/messages` | — | guide_messages |
| POST | `/api/chats/[id]/messages` | guide_messages, memory, progress_logs | guide_chats, guide_messages, mountains, memory, weekly_plans, reflections, progress_logs |
| POST | `/api/proactive` | guide_chats, guide_messages | mountains, progress_logs, weekly_plans |

---

## Running the Schema

Open Supabase Dashboard → SQL Editor → New Query, paste `supabase-schema.sql`, run.

**If migrating from an older schema** (mountains table already exists), run only the ALTER statements at the bottom of the file, then create the 5 new tables.
