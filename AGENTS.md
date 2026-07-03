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
  "reply": "message to show the user",
  "status": "gathering | confirming | ready",
  "goal_data": {
    "goal": "refined goal string",
    "current_level": "where they are now",
    "target_date": "YYYY-MM-DD or null",
    "constraints": "any limits or null"
  }
}
```

**Behavior:**
- `gathering` — still asking questions, asks one at a time
- `confirming` — has enough info, summarizes and asks user to confirm
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

**Purpose:** Transforms a confirmed goal into a structured mountain (camps, checkpoints, summit). Uses research context when available to ground milestones in real-world knowledge.

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
  "name": "camp or checkpoint name",
  "description": "1-sentence description",
  "type": "camp | checkpoint",
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
- Use `proven_stages` as the basis for camps
- Use `skill_gaps` as checkpoint focus areas
- Use realistic duration estimates from research
- Use industry-standard terminology

---

## 4. Planning + Strategy Agent

**Route:** `POST /api/plan`, `GET /api/plan`

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

---

## 5. Progress Tracking Agent

**Route:** `POST /api/track-progress`, `GET /api/track-progress`

**Purpose:** Records an activity log, then runs AI analysis to update progress percentage, advance milestones, detect trends, and surface risk signals.

**Input:**
```json
{
  "mountain_id": "uuid",
  "log_type": "activity | completed_task | missed_activity | milestone_reached | rest_day",
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

**Purpose:** Processes a user's weekly self-reflection. Identifies patterns, blockers, and lessons. Automatically writes insights to the Memory Agent.

**Input:**
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

**DB reads:** `mountains`, `reflections` (last 4), `progress_logs` (last 14), `memory` (motivation, obstacle, behavior_pattern)  
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

**Route:** `POST /api/guide`

**Purpose:** The single AI companion the user converses with. Context switches between two modes based on whether a `mountain_id` is provided.

**Input:**
```json
{
  "message": "user's message",
  "mountain_id": "uuid or 'all'",
  "conversation_history": [{ "role": "user|assistant", "content": "..." }],
  "initial_context": "optional — passed from Insights page when clicking 'Discuss With AI'"
}
```

**All Mountains mode** (no mountain_id or `"all"`):
- Loads all mountains + cross-mountain memories
- Can discuss prioritization, overcommitment, life strategy

**Single Mountain mode** (mountain_id provided):
- Loads full mountain data, current plan, latest reflection, recent logs, and memories
- Coaches on the specific mountain: what to do next, why stuck, how to accelerate

**Output:** `{ "reply": "text response" }`

**DB reads:** `mountains`, `memory`, `weekly_plans`, `reflections`, `progress_logs`  
**DB writes:** none

**Navigation flows:**
- Dashboard → AI Guide tab → All Mountains mode
- Mountain detail → "Discuss With AI" button → Single Mountain mode with `mountain_id` in URL
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
| Guide | mountains, memory, weekly_plans, reflections, progress_logs | — |
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
