# Goal Mountain — Agent Architecture

This document describes every AI agent in the system: what it does, what it reads, what it writes, and how agents chain together.

---

## Architecture Overview

```
User creates goal
      │
      ▼
┌─────────────────────┐
│  Mountain Chat      │  Conversational intake → extracts goal_data
│  /api/create-       │
│  mountain-chat      │
└──────────┬──────────┘
           │ goal_data confirmed
           ▼
┌─────────────────────┐
│  Research Agent     │  Pre-mountain mode: external knowledge,
│  /api/research      │  no mountain_id required
│  (POST, pre-mode)   │  → proven_stages, key_skills, pitfalls
└──────────┬──────────┘
           │ research_context
           ▼
┌─────────────────────┐
│  Mountain Generator │  Creates mountain + saves research to DB
│  /api/generate-     │
│  mountain           │
└──────────┬──────────┘
           │ mountain created
           ▼
    ┌──────┴──────┐
    │             │
    ▼             ▼
Planning      Research
Agent         Agent
/api/plan     /api/research
              (POST, post-mode)
    │             │
    └──────┬──────┘
           ▼
┌─────────────────────┐
│  Progress Tracking  │  Logs activity, updates milestones
│  /api/track-        │
│  progress           │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Reflection Agent   │  Weekly review → writes memories
│  /api/reflect       │
└──────────┬──────────┘
           │ auto-writes
           ▼
┌─────────────────────┐
│  Memory Agent       │  Long-term personalization store
│  /api/memory        │
└──────────┬──────────┘
           │ feeds into
           ▼
┌──────────────────────────────────┐
│  Guide Agent    /api/guide       │  Single AI companion, context-aware
│  Strategic Intel /api/insights   │  Deep analysis on demand
└──────────────────────────────────┘
```

---

## 1. Mountain Chat Agent

**Route:** `POST /api/create-mountain-chat`

**Purpose:** Conversational intake before a mountain is created. Extracts a structured goal from a freeform conversation.

**Input:**
```json
{ "conversation_history": [{ "role": "user|assistant", "content": "..." }] }
```

**Output:**
```json
{
  "analysis": "private per-turn reasoning — never shown to the user",
  "reply": "message to show the user",
  "status": "gathering | confirming | ready",
  "goal_data": {
    "goal": "refined goal string",
    "current_level": "dense summary incl. facts learned in conversation",
    "target_date": "YYYY-MM-DD or null — the real pacing deadline (e.g. application season), not just the stated goal date",
    "constraints": "everything shaping the plan: time, visa, region, preferences"
  }
}
```

**Behavior:**
- Expert-interviewer, not form-filler (model: `gpt-5-mini`; one-shot generator/research/insights agents use `gpt-5.1`, all other agents `gpt-5-mini`): every turn it must fill `analysis` first — what's known + implied (e.g. "summer 2027 internship → applications open fall 2026"), what success at this goal depends on, which deciding factor is still unknown — then ask the ONE highest-value question. Only factual questions about the user's situation (school year, visa status, hours, preferences); never domain judgments ("what skills do you think matter?").
- Uncertainty handling: "not sure" / a range counts as an answer — the agent adopts a stated assumption and moves on; it only asks for precision when different answers within the plausible range would change the plan.
- Scope boundary: intake ONLY — its single deliverable is confirmed `goal_data`. It never produces content/artifacts (reviews, code, CSVs, templates), never gives how-to instructions or commands, never designs plans or milestones (that's the Generator/Planning/Guide agents' work). Side questions mid-intake get a 1-2 sentence orientation + "your mountain will map this out" + steer back to confirming.
- Depth rule: gathers enough to shape the mountain (camps, ordering, pacing) — not enough to execute tasks. Execution-level details (e.g. "does your repo contain API keys") are left as notes in `constraints` for downstream agents. Hard cap: 7 questions, then it must move to confirming.
- `gathering` — still asking questions, one answerable chunk per reply (may bundle 2-3 tightly-related micro-facts; 3-5 turns total is the norm)
- `confirming` — has enough info, summarizes including derived implications, asks user to confirm
- `ready` — user confirmed, `goal_data` is final and can be sent to Research + Generator

**DB reads:** none  
**DB writes:** none  
**Calls next:** Research Agent (pre-mountain mode) → Mountain Generator

---

## 2. Research Agent

**Route:** `POST /api/research`, `GET /api/research`

**Purpose:** Gathers external, real-world knowledge about a goal. Has two modes.

### Pre-Mountain Mode
Called before the mountain exists. Triggered by `CreateMountainModal` immediately after the Mountain Chat Agent confirms a goal.

**Input:**
```json
{ "goal": "the goal string" }
```

**Output:**
```json
{
  "proven_stages": [{ "stage": "", "description": "", "typical_duration": "" }],
  "key_skills": ["..."],
  "common_pitfalls": ["..."],
  "best_resources": [{ "name": "", "type": "course|book|tool|community|practice", "why": "" }],
  "insights": [{ "title": "", "detail": "" }],
  "skill_gaps": [{ "skill": "", "priority": "high|medium|low", "suggestion": "" }]
}
```

**DB reads:** none  
**DB writes:** none (saved to `research` table by the Generator, not here)

### Post-Mountain Mode
Called after a mountain exists. Used by the Overview page and Planning Agent.

**Input:**
```json
{ "mountain_id": "uuid", "planning_requests": "optional", "skill_gaps": "optional" }
```

**Output:** Full research object saved to `research` table + additional fields:
- `market_trends`, `career_benchmarks`, `best_practices`, `opportunities_and_risks`

**DB reads:** `mountains`, `research` (past research to avoid repeating), `memory`  
**DB writes:** `research`

**GET:** `GET /api/research?mountain_id=uuid` — returns all past research for a mountain, ordered by date descending.

---

## 3. Mountain Generator Agent

**Route:** `POST /api/generate-mountain`

**Purpose:** Transforms a confirmed goal into a structured mountain: a single sequence of 5–8 named milestones leading to a summit. Uses research context when available to ground milestones in real-world knowledge.

**Input:**
```json
{
  "goal": "...",
  "current_level": "optional",
  "target_date": "optional YYYY-MM-DD",
  "constraints": "optional",
  "research_context": { } // output from Research Agent pre-mountain mode
}
```

**Output:** The newly created mountain row from Supabase.

**Milestone structure:**
```json
{
  "name": "specific stage name (a concrete capability or outcome, never generic labels)",
  "description": "1-sentence description",
  "type": "camp",
  "estimated_duration": "e.g. 2 weeks",
  "completed": false,
  "current": true (first only),
  "order_index": 0
}
```

**DB reads:** `memory` (past goal/preference memories for personalization)  
**DB writes:**
- `mountains` — new row with goal, summit, milestones array, progress = 0
- `research` — pre-mountain research data linked to the new mountain_id (so Insights page can display it)

**Research integration:** When `research_context` is present, the system prompt explicitly instructs the model to:
- Use `proven_stages` as the basis for milestones
- Use `skill_gaps` as milestone focus areas
- Use realistic duration estimates from research
- Use industry-standard terminology

---

## 4. Planning + Strategy Agent

**Route:** `POST /api/plan`, `GET /api/plan`, `PATCH /api/plan`

**Purpose:** Generates an adaptive weekly schedule. Accounts for past performance, user constraints, and behavioral patterns from memory.

**Input:**
```json
{
  "mountain_id": "uuid",
  "available_time": "optional e.g. 1 hour/day",
  "user_constraints": "optional"
}
```

**Output:**
```json
{
  "plan": {
    "schedule": [{ "day": "Monday", "tasks": [{ "task": "", "duration": "", "priority": "high|medium|low" }] }],
    "focus_area": "what to focus on this week",
    "difficulty_level": "easy|moderate|challenging|intense"
  },
  "priority_recommendation": "the single most important thing this week",
  "next_best_action": "the very next thing to do right now",
  "strategy_notes": "broader strategic thinking",
  "adjustments": ["adjustments made based on past performance"]
}
```

**DB reads:** `mountains`, `weekly_plans` (last 3 for learning), `progress_logs` (last 10), `memory` (motivation, obstacle, behavior_pattern)  
**DB writes:** `weekly_plans`

**GET:** `GET /api/plan?mountain_id=uuid` — returns all plans ordered by date descending.

**PATCH:** `PATCH /api/plan` with `{ plan_id, plan }` — overwrites a plan's `plan` jsonb. Used by the daily check-in UI to persist per-task `status: "done"|"missed"`, per-day `finished: true`, and `load_feel: "lighter"|"about_right"|"heavier"`.

**Daily check-in flow (frontend `PlanView`):**
1. User labels each task with ✓ Done / ✗ Missed chips (persisted via PATCH on every tap)
2. "Finish today" on today's card → one-tap load-feel question (skippable)
3. Unlabeled tasks become missed, day locks (`finished: true`), one log written via Progress Tracking Agent (`data.source: "daily_checkin"`, with `completed`, `missed`, `load_feel`)
4. All done (and load not "heavier") → "Day complete" celebration, no conversation. Tasks missed OR load felt heavier → the `MiniGuideChat` panel opens on the overview page itself: a "Daily check-in — {day}" `guide_chats` row is created and the guide asks what got in the way (or, on a clean-but-heavy day, one light "which task ran long?" question), stores reasons as memories, and can propose a plan adjustment. The panel's expand icon opens the same conversation in the full AI Guide (`/guide?mountain_id=…&chat_id=…`).

---

## 5. Progress Tracking Agent

**Route:** `POST /api/track-progress`, `GET /api/track-progress`

**Purpose:** Records an activity log, then runs AI analysis to update progress percentage, advance milestones, detect trends, and surface risk signals.

**Input:**
```json
{
  "mountain_id": "uuid",
  "log_type": "activity | missed_activity",
  "data": { } // freeform log payload
}
```

**Output:**
```json
{
  "progress_percentage": 42,
  "current_camp": "milestone name",
  "milestone_updates": [{ "index": 2, "should_complete": true, "reason": "..." }],
  "trend": "ahead | on_track | behind",
  "trend_detail": "...",
  "risk_signals": ["..."],
  "streak": { "current": 5, "longest": 12 },
  "summary": "short progress summary for the user"
}
```

**DB reads:** `mountains`, `progress_logs` (last 20)  
**DB writes:**
- `progress_logs` — new log entry
- `mountains` — updates `progress`, `current_milestone_index`, `milestones` (completed flags), `updated_at`

**GET:** `GET /api/track-progress?mountain_id=uuid` — returns all logs ordered by date descending.

---

## 6. Reflection Agent

**Route:** `POST /api/reflect`, `GET /api/reflect`

**Purpose:** Reviews the week automatically — there is no manual reflection form anymore. Synthesizes what worked, what failed, and blockers from the week's data: plan task statuses + load-feel feedback (inside the latest `weekly_plans.plan` jsonb), progress logs, and memories. Writes insights to the Memory Agent.

**Input (auto mode — the default flow):**
```json
{ "mountain_id": "uuid", "auto": true }
```
Triggered server-side by `POST /api/plan` at week rollover: before generating, the plan route checks whether the latest plan already has a newer reflection — if not, it calls `/api/reflect { auto: true }` first (best-effort), so every plan-generation path (first-plan form, mini plan chat, full guide) learns from the finished week. Stores `user_input` as `{ "auto": true }`.

**Input (legacy manual mode, still accepted):**
```json
{
  "mountain_id": "uuid",
  "user_input": { "went_well": "...", "blockers": "...", "energy": "...", ... }
}
```

**Output:**
```json
{
  "summary": "2-3 sentence reflection",
  "lessons_learned": ["..."],
  "what_worked": ["..."],
  "what_failed": ["..."],
  "blockers": [{ "blocker": "", "frequency": 3, "suggestion": "" }],
  "adjustments": ["..."],
  "motivation_insight": "...",
  "memories_to_store": [{ "category": "behavior_pattern|motivation|obstacle", "content": "..." }]
}
```

**DB reads:** `mountains`, `reflections` (last 4), `progress_logs` (last 14), `memory` (motivation, obstacle, behavior_pattern), `weekly_plans` (latest, auto mode only — for task statuses + load_feel)  
**DB writes:**
- `reflections` — new reflection row
- `memory` — auto-writes all entries from `memories_to_store` with `source: "reflection"`

**GET:** `GET /api/reflect?mountain_id=uuid` — returns all reflections ordered by date descending.

---

## 7. Memory Agent

**Route:** `POST /api/memory`, `GET /api/memory`, `DELETE /api/memory`

**Purpose:** Stores and retrieves long-term user knowledge that personalizes all other agents. Most writes come from the Reflection Agent automatically. Manual writes are also supported.

**Memory categories:**
- `goal` — stated goals and ambitions
- `preference` — how the user likes to work
- `motivation` — what energizes or drives them
- `obstacle` — recurring blockers
- `behavior_pattern` — observed patterns (e.g. "consistent on weekday mornings")

**POST input:**
```json
{
  "mountain_id": "uuid",
  "category": "behavior_pattern",
  "content": "User works best in morning sessions",
  "metadata": { "source": "reflection", "reflection_id": "..." }
}
```

**GET:** `GET /api/memory?mountain_id=uuid&category=optional` — filtered memory fetch.

**DELETE:** `DELETE /api/memory?id=uuid`

**DB reads:** none  
**DB writes:** `memory`

**Who reads memory:** Planning Agent, Research Agent (post-mode), Reflection Agent, Guide Agent, Strategic Intelligence Agent — all inject relevant memories into their context.

---

## 8. Guide Agent

**Routes:**
- `GET /api/chats` — list all guide chats (optionally filter by `?mountain_id=uuid`)
- `POST /api/chats` — create a new guide chat (`{ mountain_id, title, type }`)
- `DELETE /api/chats?id=uuid` — delete a chat (its messages cascade)
- `GET /api/chats/[id]/messages` — fetch all messages in a chat
- `POST /api/chats/[id]/messages` — send a message, get AI reply with actions
- `POST /api/proactive` — detect inactivity, create AI-proactive chat if conditions met

**Purpose:** The single AI companion the user converses with. Conversations are persisted in Supabase (`guide_chats` + `guide_messages`). Context switches between two modes based on the chat's `mountain_id`.

**Chat architecture:**
- Each conversation is a `guide_chat` row. Messages are `guide_messages` rows.
- `type: "user_initiated"` — started by user via "New Chat"
- `type: "ai_proactive"` — created automatically by `/api/proactive` when inactivity is detected; shows with orange unread dot in sidebar

**POST /api/chats/[id]/messages input:**
```json
{ "content": "user's message", "initial_context": "optional — from Insights page" }
```

**All Mountains mode** (chat has no `mountain_id`):
- Loads all mountains + cross-mountain memories
- Can discuss prioritization, overcommitment, life strategy
- Only `store_memory` action available

**Single Mountain mode** (chat has `mountain_id`):
- Loads full mountain data, current plan, latest reflection, recent logs, memories
- All 4 action types available

**Output:**
```json
{
  "reply": "conversational response",
  "suggested_replies": ["up to 3 short reply chips"],
  "actions": []
}
```

**Action types:**

| Action | Executed by | When |
|--------|-------------|------|
| `store_memory` | Server-side (silent) | User reveals insight about motivation, obstacle, or behavior |
| `log_progress` | Server-side (silent) | User describes what they did or missed |
| `advance_milestone` | Client-side (requires confirm) | User explicitly says they completed the current stage |
| `propose_plan` | Client-side (fetches plan, shows card) | User wants to adjust their schedule or pace |

**Server-side actions** (`store_memory`, `log_progress`) are executed inside the messages route before returning — no round-trip needed. Memories written with `source: "guide"` in metadata.

**Client-side actions** are returned in the `actions` array:
- `advance_milestone` → returns `nextMilestoneName`, rendered as green confirmation card; on confirm calls `PATCH /api/mountains/[id]`
- `propose_plan` → returns `user_constraints` and `available_time`; frontend calls `POST /api/plan`, renders plan card; "Looks good ✓" confirms, "Make changes" pre-fills input

**Proactive message conditions** (`POST /api/proactive`):
- `daysSinceLastLog >= 3` OR `missedCount >= 2` (in last 14 logs) OR `recentActivityCount == 0` (this week)
- Deduped: only one proactive chat created per mountain per day
- Creates a `guide_chats` row (type: `ai_proactive`, unread: true) + initial AI message

**DB reads:** `mountains`, `memory`, `weekly_plans`, `reflections`, `progress_logs`, `guide_chats`, `guide_messages`  
**DB writes:** `guide_chats`, `guide_messages`, `memory` (store_memory), `progress_logs` (log_progress)

**Navigation flows:**
- Dashboard → AI Guide tab → All Mountains mode (no mountain_id)
- Mountain detail → "Discuss With AI" button → Single Mountain mode (`mountain_id` in URL)
- Insights page → "Discuss With AI" link → Single Mountain mode with `initial_context` prefilled

---

## 9. Strategic Intelligence Agent

**Route:** `POST /api/insights`

**Purpose:** Runs a deep, one-shot analysis of the user's goal journey and returns 8 strategic cards + scenario predictions. Stateless — no DB writes.

**Input:**
```json
{ "mountain_id": "uuid" }
```

**Output:**
```json
{
  "summit_probability": 72,
  "consistency_score": 68,
  "recommended_strategy": { "focus": "Consistency > Speed", "reason": "..." },
  "skill_gap_analysis": { "goal": "...", "current_skills": [], "missing_skills": [] },
  "highest_leverage": { "action": "...", "expected_impact": "...", "estimated_time": "..." },
  "bottleneck": { "findings": [], "main_bottleneck": "..." },
  "opportunity": { "market_trends": [] },
  "trade_off": { "available_hours": 10, "best_option": "...", "impact": "High", "risk": "Medium" },
  "scenario": { "current_pace": "...", "increased_hours": "...", "stopped": "..." },
  "mentor_insight": "..."
}
```

**DB reads:** `mountains`, `memory`, `reflections`, `progress_logs`  
**DB writes:** none (stateless — triggered on demand from the Insights page)

---

## Agent Data Flow Summary

| Agent | Reads | Writes |
|-------|-------|--------|
| Mountain Chat | — | — |
| Research (pre) | — | — |
| Research (post) | mountains, research, memory | research |
| Generator | memory | mountains, research |
| Planning | mountains, weekly_plans, progress_logs, memory | weekly_plans |
| Progress Tracking | mountains, progress_logs | progress_logs, mountains |
| Reflection | mountains, reflections, progress_logs, memory | reflections, memory |
| Memory | — | memory |
| Guide | mountains, memory, weekly_plans, reflections, progress_logs, guide_chats, guide_messages | guide_chats, guide_messages, memory, progress_logs |
| Proactive | mountains, progress_logs, weekly_plans | guide_chats, guide_messages |
| Strategic Intelligence | mountains, memory, reflections, progress_logs | — |

---

## Mountain Creation Flow (Step by Step)

1. User opens `CreateMountainModal`
2. **Mountain Chat Agent** converses with user until `status: "ready"`, returns `goal_data`
3. **Research Agent** (pre-mountain mode) receives `goal_data.goal`, returns research findings
4. **Mountain Generator** receives `goal_data` + `research_context`, creates mountain in DB, saves research to DB
5. Modal shows **"About Your Plan"** view — displays research findings + full milestone list
6. User clicks "Start Climbing" → navigated to `/mountain?id=<uuid>`

---

## Insights Page Flow

1. Page loads for a specific mountain
2. Fetches `/api/memory?mountain_id=uuid&category=behavior_pattern` → Patterns section
3. Fetches `GET /api/reflect?mountain_id=uuid` → aggregates blockers for Obstacles section
4. Fetches `GET /api/track-progress?mountain_id=uuid` → builds weekly calendar
5. User clicks "Generate Analysis" → calls `POST /api/insights` → populates 8 strategic cards + AI Predictions
6. "Discuss With AI" link → navigates to `/guide?mountain_id=uuid` with Insights context

---

## Next.js Note

This project uses Next.js App Router. Before editing any route or layout, check `node_modules/next/dist/docs/` for current API conventions — they may differ from training data.
