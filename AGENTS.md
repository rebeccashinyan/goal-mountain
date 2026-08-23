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
- Expert-interviewer, not form-filler (model: `gpt-5-mini`; one-shot generator/research/insights agents use `gpt-5.1`, all other agents `gpt-5-mini`): every turn it must fill `analysis` first — what's known + implied (e.g. "summer 2027 internship → applications open fall 2026"), what success at this goal depends on, which deciding factor is still unknown — then ask the ONE highest-value question. Only factual questions about the user's situation (school year, visa status, hours, preferences); never domain judgments ("what skills do you think matter?"), and never questions the user cannot answer yet (e.g. retail price before unit cost is known) — those get derived, recommended, or deferred to `constraints`.
- Uncertainty handling: "not sure" / a range counts as an answer — the agent adopts a stated assumption and moves on; it only asks for precision when different answers within the plausible range would change the plan.
- Recommend, don't re-ask: if the user says "not sure" / "I don't understand" about a choice (selling platform, method, tool), the agent briefly explains the options, recommends ONE with a one-line reason, adopts it as a revisitable assumption in `constraints`, and moves on. A decision the user lacks expertise to make is the agent's call; the same decision is never asked twice.
- Scope boundary: intake ONLY — its single deliverable is confirmed `goal_data`. It never produces content/artifacts (reviews, code, CSVs, templates), never gives how-to instructions or commands, never designs plans or milestones (that's the Generator/Planning/Guide agents' work). Side questions mid-intake get a 1-2 sentence orientation + "your mountain will map this out" + steer back to confirming.
- Depth rule: gathers enough to shape the mountain (camps, ordering, pacing) — not enough to execute tasks. Execution-level details (e.g. "does your repo contain API keys", "do you have a business entity", "will you carry or ship the inventory") are left as notes in `constraints` for downstream agents — test: would different answers change which camps exist or their order?
- Minimum viable understanding: the aim is a useful first mountain fast, not maximum information. Planning, Guide, Reflection, and Memory learn finer preferences later, while the user is climbing — so every extra question must justify itself as friction.
- Five question categories — every question must map to one, and only when it would materially change milestones, ordering, pacing, or a major constraint: (1) goal / success condition when the goal is vague, (2) deadline / timing, (3) current starting point, (4) available capacity, (5) major constraints (budget, location, eligibility, visa, health/safety) when relevant to that goal.
- Never asks: domain judgments, preferences that wouldn't change the initial mountain, execution detail, anything the Research Agent can determine, anything inferable from what's already said, or the same question twice.
- Question budget: 3-4 follow-up turns is the target. Stop condition evaluated after every reply — would another answer materially change structure, order, pacing, or a critical constraint? If yes, ask the single highest-value remaining question; if no, move to confirming. The model counts its own questions at the top of `analysis` ("Questions asked so far: N"), but the cap is **enforced server-side**, not by the prompt: the route counts assistant turns in `conversation_history` and injects a budget directive — a soft reminder at 3, and at 4+ a hard "do not ask another question, summarize now" that forces `confirming` (or `ready` if the user just confirmed). Prompt-only budgets were tested and did not hold — `gpt-5-mini` counted correctly to 7 and kept gathering anyway.
- No backsliding: a turn that summarizes and asks for confirmation must be `confirming`, never `gathering` with a summary attached, and `confirming` never returns to `gathering` — once the user confirms it goes straight to `ready` without one last question. Late-tempting but immaterial questions ("how polished is that draft?", "do you have a resume yet?") are assumed and noted, since the mountain has a camp for them either way.
- `gathering` — still asking questions, one answerable chunk per reply (may bundle 2-3 tightly-related micro-facts; 3-4 turns is the target)
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
  "mapLabel": "short 2-4 word display name shown on the mountain map (e.g. 'Ship 3 AI Projects')",
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

**Route:** `POST /api/plan`, `GET /api/plan`, `PATCH /api/plan`, `DELETE /api/plan`, `POST /api/plan/steer`, `POST /api/plan/revision`, `POST /api/plan/replace-task`, `POST /api/plan/rebase`

**Purpose:** Generates an adaptive weekly schedule. Accounts for past performance, user constraints, and behavioral patterns from memory.

### Plan lifecycle — draft → active

Every generated week is a **draft** first: an AI proposal the user reviews and adjusts before committing. Nothing is tracked until they press "Start this week", which flips it to **active** via `POST /api/plan/rebase` (see below — same button, no separate step). Draft is a property of the *plan*, not of the mountain — the second, fifth, and fiftieth week all start as drafts, not just the first.

Status lives in the plan jsonb as `plan.status` (no extra column). Rows written before this lifecycle existed carry no status; those count as legacy **active** plans, so anything not explicitly `"draft"` is treated as active. `lib/plans.ts` is the single source of truth for this rule — `planStatus()`, `isActivePlan()`, `effectivePlans()`, `activeHistory()`.

Two selection rules every consumer must follow:
- **Effective plan for a week** = the *newest row for that `week_start`* (regenerating a draft leaves superseded rows behind). Never "newest row overall" — that may be a next-week draft the user hasn't accepted.
- **Behavioural history** = effective plans filtered to active only. A draft the user never started is not evidence of anything; reading one as performance would invent missed tasks. Enforced via `activeHistory()` in the Planning, Reflection, Guide, and Proactive agents.

Only an active plan can produce daily tracking, done/missed statuses, "not logged" days, progress logs, daily check-ins, or a week reflection. And within an active plan, only days on or after `plan.activated_from` (the date "Start this week" was actually pressed) count — days before it render as a muted **"Before you started"** column, the same treatment a draft gives any already-past day before it's even started. See `POST /api/plan/rebase` below.

### Interaction hierarchy — how a plan changes

One rule decides which tier a change belongs to: **how big is the thing being changed, and does the AI rewrite work the user didn't ask it to touch?**

| Tier | Situation | Mechanism | Result |
|------|-----------|-----------|--------|
| 1. Direct manipulation | One task is wrong | inline **Edit / Replace / Remove**, `+ Add task` | Still scoped to one task, never a chat, never a whole-plan rewrite. Edit and Remove apply **immediately** with an undo toast — Edit changes text, duration **and day** with no AI call at all. Replace previews an AI-suggested direction first (see below) and only applies on an explicit "Replace task" confirm, since — unlike Edit — the user hasn't already decided the replacement text themselves. |
| 2. Simple whole-plan preference | The whole week needs a nudge | **Make it lighter**, **Change strategy**, **Change my availability** (and `Regenerate` in the `···` menu) → `POST /api/plan/steer` | **Always previews.** Stored as `plan.pending_revision`; the live schedule is untouched until resolved via `POST /api/plan/revision`. Applies to drafts as well as active weeks. |
| 3. Complex reasoning / new context | The user has something to explain ("I don't want to find a niche first, I want to test the market with three projects") | **Discuss with AI** → guide `propose_plan` → same `/api/plan/steer` endpoint with `action: "custom"` | Same preview-then-apply path as tier 2. |

Tier 2 previews on drafts too: a draft the user has already hand-tuned is *their* plan, and an AI rewrite of it deserves the same "see it before it lands" treatment as an active week.

**Regenerate is deliberately demoted** out of the chip row into a `···` overflow menu, labelled with what it costs ("Replaces every remaining task, including ones you like"). Re-rolling the whole week discards parts the user may already be happy with, so targeted change is always the more prominent path.

**Contextual follow-on (`POST /api/plan/fill-time`):** when a tier-1 edit *shortens* or *removes* a task by ≥10 minutes, the freed time is offered back — "You freed up 20 min on Tuesday. Want to get ahead on {current camp}?" with `+ Add a task` / `Leave it open`. Only on click does it call the AI for one concrete execution task sized to the freed time and scoped to the **current** camp (never pulled forward from a later one). It applies inline with undo, so it stays in tier 1. Durations are parsed with `parseDurationMinutes()` from `lib/plans.ts`, which tolerates the free-text the model produces ("1 hr", "20–25 min", "40 min (total)").

**Note on generation timing:** there is no scheduler in this project, so next-week drafts are not auto-generated at rollover — the user triggers generation, which (as before) runs auto-reflection first, then produces the draft. The rollover chain is preserved; only the trigger is manual.

**Mid-week generation never schedules past days.** If a week's first-ever plan is generated after its Monday (e.g. a first plan generated on Saturday), the days that already passed are not the AI's to plan — they get no tasks, not even a rest placeholder. The route computes `plan_start_date` (today's date, clamped to the week being planned) and:
- tells the model exactly which weekdays are already gone and which remain, with an explicit instruction not to include the gone ones in `schedule` at all
- scales the ask down with how little of the week is left — 1-2 remaining days get an explicitly "light, low-pressure getting-started" plan instead of a compressed full week, with the normal full week resuming next generation
- **strips any schedule entries for the skipped days server-side after the model responds**, regardless of what the prompt achieved — the same lesson as the mountain-chat question budget: a model can be told a rule and still not hold it, so the hard guarantee lives in code, not the prompt
- persists `plan_start_date` on the saved plan (`weekly_plans.plan.plan_start_date`) so the UI and Reflection Agent both know which days were genuinely never part of this plan

Generating exactly on a week's Monday, or generating a future week ahead of time, sets `plan_start_date` to that week's Monday — i.e. no day is treated as skipped, identical to pre-existing behavior. See `PlanView`'s **"Before this plan"** columns in UI_SPEC.md and the `weekly_plans.plan.plan_start_date` field in DATABASE.md.

**Changing a draft's inputs — "Change plan setup":** the draft footer carries the primary **Start this week →** plus a deliberately quiet **Change plan setup**, which reopens the generation form pre-filled from `plan.setup` (the `available_time` / `user_constraints` the user gave when this week was generated, persisted by `POST /api/plan` for exactly this purpose). Regenerating from there is an ordinary `POST /api/plan` — it **inserts a new row**, and the newest-row-per-week selection rule swaps it in only after it succeeds. That's what makes the old draft safe: entering setup deletes nothing, a failed generation leaves the previous draft (and every Edit/Replace/Remove in it) exactly as it was, and Cancel simply closes the form. Destroying a draft is a separate, explicitly-confirmed action (`DELETE /api/plan`) kept out of the footer and behind the `···` menu, since unlike a regenerate there's nothing to come back to.

**Starting a draft late — `POST /api/plan/rebase`:** a draft can sit unstarted past its own days (generated on time, but "Start this week" isn't pressed until later — a different situation from mid-week generation above, and independently possible: a plan generated exactly on Monday can still be started on Thursday). This is the *only* thing "Start this week" does — same button, no separate "rebase" feature or extra confirmation step:

**Input:** `{ plan_id, mountain_id }`

1. Compares each scheduled day's calendar date against today. If nothing is expired (starting on time, or the only expired days were already empty), it's a plain `status: "draft" → "active"` flip — no AI call, identical to the old behavior.
2. If some days *with tasks* have already passed, it rescues them in the same request: necessary/high-priority tasks move to today or a later day this week (never deleted); optional/lower-value tasks may move or be dropped entirely — with an explicit instruction not to overload today just because several days expired, preferring to spread rescued work across open days first. The model sees every remaining day (today through Sunday), including ones with no tasks yet, as a valid destination — not just days that already happened to have something scheduled.
3. Expired days are dropped from `schedule` entirely (never left as empty placeholders); a **deterministic code-level filter** rejects any model output naming a day outside "today through this week's Sunday" — the same "don't trust the prompt alone" pattern as mid-week generation's day-skipping.
4. Only then does it write `status: "active"` and `activated_from: <today>` — in the same database update as the rescue, so there's never a moment where a rebased-but-not-yet-active state exists.

**Output:** the updated (now active) `weekly_plans` row, plus `rebased: boolean` and, when `true`, `moved`/`removed` counts computed with `diffSchedules()` from `lib/plans.ts` (the same deterministic diff the steer revision card uses — never model-narrated, so the feedback text can't misreport itself).

The frontend shows nothing extra when `rebased` is false (silent activation, exactly as before this feature existed). When `true`, it surfaces the existing undo-toast pattern already used elsewhere in `PlanView` — *"Plan adjusted to start today · 2 tasks moved · 1 optional task removed"* with **Undo** — reusing the pre-rebase plan snapshot already held in client state, so undo reverts both the schedule *and* the status back to draft in one action. No new UI surface, no new confirmation dialog.

**DB reads:** `mountains`, `weekly_plans` (the draft being started)
**DB writes:** `weekly_plans`

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
  "what_changed": ["short phrases naming what changed vs last week"]
}
```

**DB reads:** `mountains`, `weekly_plans` (last 20 rows, narrowed to the 3 most recent *active* weeks), `progress_logs` (last 10), `memory` (motivation, obstacle, behavior_pattern, **preference** — capped at 25 most recent)  
**DB writes:** `weekly_plans`

**Always saves as a draft:** `plan.status` is set to `"draft"` on every generated week, unconditionally. Committing happens in the UI via `PATCH` setting `plan.status: "active"`.

**`what_changed`:** 2-4 short phrases ("Reduced 6 tasks to 4", "Shortened research sessions", "Moved portfolio work earlier"), persisted in the plan jsonb and shown on the draft before the user commits — so an adapted plan is visibly a response to last week rather than a random re-roll. The prompt receives last week's *actual* schedule including per-task done/missed statuses and load feedback, and is told to return an empty array for a first week (nothing to compare against). Replaces the old `adjustments` field, which was returned but never persisted and so vanished on reload.

**409 guard:** if the target `week_start` already has an *active* effective plan, generation is rejected with `409` and the existing `plan_id`. An in-progress week is revised through `/api/plan/steer`, never by silently stacking a newer row that the "newest row wins" selection would then pick up.

**GET:** `GET /api/plan?mountain_id=uuid` — returns all plans ordered by date descending. Consumers must apply the selection rules above (`effectivePlans` / `activeHistory`) rather than treating row 0 as the current plan.

**PATCH:** `PATCH /api/plan` with `{ plan_id, plan, priority_recommendation? }` — overwrites a plan's `plan` jsonb, and optionally its `priority_recommendation` text column. Used by: the daily check-in UI (per-task `status: "done"|"missed"`, per-day `finished: true`, `load_feel`), inline task Edit/Add/Skip/Replace, **starting a week** (`plan.status: "active"`), and the one-step undo toast (restores a full pre-action snapshot, including `priority_recommendation` since steering can change it).

**Daily check-in flow (frontend `PlanView`, active weeks only):**
1. User labels each task with ✓ Done / ✗ Missed chips (persisted via PATCH on every tap)
2. "Finish today" on today's card → one-tap load-feel question (skippable)
3. Unlabeled tasks become missed, day locks (`finished: true`), one log written via Progress Tracking Agent (`data.source: "daily_checkin"`, with `completed`, `missed`, `load_feel`)
4. All done (and load not "heavier") → "Day complete" celebration, no conversation. Tasks missed OR load felt heavier → the `MiniGuideChat` panel opens on the overview page itself: a "Daily check-in — {day}" `guide_chats` row is created and the guide asks what got in the way (or, on a clean-but-heavy day, one light "which task ran long?" question), stores reasons as memories, and can propose a plan adjustment. The panel's expand icon opens the same conversation in the full AI Guide (`/guide?mountain_id=…&chat_id=…`).

**Quick-action steering — `POST /api/plan/steer`:** one-click plan reactions, no chat round-trip. Sits above the schedule on both draft and active weeks (whenever the viewed week has an unfinished day and no revision already pending). The guide's `propose_plan` action routes here too, so conversational replanning gets the same review semantics.

**Input:**
```json
{
  "plan_id": "uuid",
  "mountain_id": "uuid",
  "action": "lighter | strategy | regenerate | availability | custom",
  "available_time": "optional — mainly for action: \"availability\"",
  "instruction": "required for \"strategy\" (the chosen strategy label) and \"custom\" (free-form ask from the guide)"
}
```

**Behavior:** loads the plan and mountain, splits the schedule into finished (locked, untouched) and open days, and asks the model to revise only the open days per the action's instruction. The prompt requires unchanged tasks to be returned with their **exact original text** — otherwise harmless rewording shows up in the diff as mass remove+add — and forbids splitting one task into several (which would *increase* load when the user asked for less).

It then **always proposes, never applies** — draft or active alike. It computes a diff and stores it as `plan.pending_revision`, leaving the live schedule untouched, and returns `mode: "revision"` with the diff. If the model produced no actual difference it returns `mode: "unchanged"` and writes nothing.

**Output:** the updated `weekly_plans` row plus `mode`, `note` (one-sentence user-facing summary), and `diff` when a revision was created.

**Preference learning:** every steer writes a `preference` memory naming the signal ("Asked the AI to lighten a weekly plan — may prefer a lower task load than proposed"; for a strategy, the chosen label). Repeating the same steer touches `updated_at` on the existing row rather than inserting a duplicate, so a strengthening signal doesn't flood the memory table.

**DB reads:** `weekly_plans` (the plan being steered), `mountains`, `memory`  
**DB writes:** `weekly_plans`, `memory` (preference)

**Strategy options — `POST /api/plan/strategies`:** `{ plan_id, mountain_id }` → `{ strategies: [{ label, detail }] }`, 2-3 of them. Backs the **Change strategy** chip: rather than re-rolling the week and hoping, it names concrete directions the user can recognise — "Begin outreach and offer testing", "Focus on 2 polished portfolio pieces" — each grounded in the tasks actually in this plan, each meaningfully different from the others and from what the plan already does. Picking one calls `/steer` with `action: "strategy"`; "Something else…" hands off to Discuss with AI. Read-only (reads `weekly_plans`, `mountains`, `memory`; writes nothing).

**Freed-time fill — `POST /api/plan/fill-time`:** `{ plan_id, mountain_id, day, minutes }` → `{ task }`. One task, scoped to the current camp, biased to execution over setup/admin/research, capped at one short sentence, sized to the time freed. Reads `weekly_plans`, `mountains`; writes nothing (the client inserts it via `PATCH /api/plan`).

**Resolving a revision — `POST /api/plan/revision`:** `{ plan_id, decision: "apply" | "discard" }`. No AI call — the revision was already generated by `/steer`.
- `discard` → drops `pending_revision`, current plan stands
- `apply` → merges the proposed schedule into the live one and clears `pending_revision`

The merge is re-computed against the plan's **current** schedule at apply time, not the snapshot taken when the revision was proposed — a day may have been finished and logged in between, and completed work (task text, `status`, `finished`, `load_feel`) must survive the revision untouched.

**DB reads:** `weekly_plans`  
**DB writes:** `weekly_plans`

**Inline task replacement — `POST /api/plan/replace-task`:** per-task direct manipulation (the ↻ Replace icon), no chat round-trip. A two-step AI-assisted flow, not a single "swap for a ready task" click.

**The interaction contract — which control owns which kind of change:**

| Control | The user is saying | What may change |
|---------|-------------------|-----------------|
| **Edit** | "I know exactly what I want this to be" | anything they type — text, duration, day |
| **Replace** | "I want to do something else in this slot" | **content only** — duration, day, priority and the day's capacity are preserved |
| **Remove** | "This isn't needed at all" | the task is deleted |
| **Change my availability** | "My overall time this week is different" | durations/load across the remaining week |
| **Change strategy** | "My whole approach is wrong" | multiple tasks / the week's shape |

**Replace preserves the time budget.** Changing *what* a task is must never silently change *how much* it costs — a 20-minute slot that comes back as a 2-hour task is an unrequested workload increase and a schedule overload. So the duration, day, and priority are treated as fixed constraints the new content is designed within, and they are **re-applied from the original task server-side after the model responds** rather than taken from its output at all — the model literally cannot widen the slot, the same deterministic-backstop pattern used for mid-week generation and the rebase day filter. Growing a task is only ever possible through an explicit user choice (below), or through Edit / Change my availability, which is where deliberately changing time belongs.

Replace never opens a chat and never touches any task but the one being replaced.

**Step 1 — `mode: "directions"`:** reads the task in context (goal, current camp, and the rest of the week's schedule, fetched server-side from `plan_id` — not trusted from the client) to understand what the task was actually *for*, then proposes 2-3 concrete, meaningfully different directions, each required to be realistic within the task's existing time budget rather than a larger undertaking. These are short phrases, not finished tasks yet — the frontend appends a fixed **"Something else…"** as a 4th, always-present option that opens a small `What would you rather do?` text input instead of calling the AI again.

**Input:** `{ "plan_id", "mountain_id", "task": { "task", "duration", "priority" }, "day", "mode": "directions" }`
**Output:** `{ "directions": ["...", "...", "..."] }` (2-3 items)

**Step 2 — `mode: "generate"`:** turns the chosen direction — one of the AI's own suggestions, or the user's typed text — into one concrete task that **fits the original duration by narrowing scope** (fewer items, a smaller sample, a lighter pass), stated concretely: "analyze 2 competitors and note 3 takeaways", not "analyze competitors". The prompt receives `original_duration`, `day`, `priority`, and the day's `remaining_day_capacity` (minutes already committed to that day's *other* tasks) as fixed constraints, and is told the fitted version is what actually replaces the task, so it must be genuinely achievable in that time.

The model separately judges whether a thorough version of the direction would genuinely need meaningfully more time — most directions compress fine and don't. When it wouldn't, it also returns `full_version` with a realistic estimate. **That is an offer, never an assumption**: the fitted version is what's pre-selected, and the caller decides.

It also checks the rest of the week's schedule for tasks the new direction makes genuinely inconsistent (e.g. choosing "print-on-demand" when a "hire a CAD freelancer" task still exists later), returned as `affected`. This is filtered server-side against the plan's actual tasks after the model responds — the same "deterministic backstop over a prompt-only rule" pattern used for mid-week plan generation — so `affected` can never point at something hallucinated.

**Input:** `{ "plan_id", "mountain_id", "task", "day", "mode": "generate", "direction": "..." }`
**Output:** `{ "replacement": { "task", "duration", "priority" }, "fullVersion": { "task", "duration" } | null, "affected": [{ "day", "task" }] }` — `replacement.duration` and `replacement.priority` are **always copied from the input task server-side**, never read from the model's response.

The frontend shows the replacement as a **preview** — nothing is written until the user presses **"Replace task"**. When `fullVersion` is present, an amber card inside the preview reads *"A full version would take ~2 hours."* with two toggle buttons — **Fit into 20 min** (pre-selected, using the original duration) and **Use full 2 hours** (secondary) — plus a live capacity line, *"Using the full version makes Monday total 4h 45m."*, computed client-side from the day's other tasks with `parseDurationMinutes()`. Switching the toggle swaps which version the preview shows; only the selected one is applied on confirm. Choosing the full version is the *only* path by which Replace changes a task's duration, and even then it changes **only that task** — no other task is moved, shortened, or rescheduled to make room, since silently reflowing the day is exactly the behavior this design exists to prevent. If the longer task overloads the day, the capacity line says so before the user commits and the fix stays in their hands (Edit, Change my availability, or Make it lighter).

Confirming applies only that single task via the existing `PATCH /api/plan` and writes a `preference` memory naming the swap and the chosen direction (noting when the user opted into the longer version). If `affected` is non-empty, a banner offers **"This choice also affects N later tasks. Update them too?"** with **Review changes** (routes to `POST /api/plan/steer` with `action: "custom"` and an instruction scoped to exactly those tasks — surfacing as the normal pending-revision review card, same as any tier-2/3 change) and **Not now** (dismisses; those tasks are never changed silently). This route itself is stateless (no DB write) — the client writes the `preference` memory and applies the confirmed task via `PATCH /api/plan`.

**DB reads (this route):** `mountains`, `weekly_plans` (the plan being read for context, by `plan_id`)
**DB writes (this route):** none

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

**DB reads:** `mountains`, `reflections` (last 4), `progress_logs` (last 14), `memory` (motivation, obstacle, behavior_pattern), `weekly_plans` (auto mode only — the latest **active** week via `activeHistory()`, for task statuses + load_feel; a never-started draft is skipped, since reflecting on work the user never agreed to do would manufacture failures). If that plan's `schedule` has fewer than 7 days (it was generated mid-week — see `plan_start_date` in the Planning Agent section), the prompt is told explicitly that the missing days were never part of the plan, so it doesn't read the gap as missed or skipped work.  
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
| Planning | mountains, weekly_plans (active only), progress_logs, memory (incl. preference) | weekly_plans |
| Progress Tracking | mountains, progress_logs | progress_logs, mountains |
| Reflection | mountains, reflections, progress_logs, memory, weekly_plans (latest active, auto mode) | reflections, memory |
| Memory | — | memory |
| Guide | mountains, memory, weekly_plans (active only), reflections, progress_logs, guide_chats, guide_messages | guide_chats, guide_messages, memory, progress_logs |
| Proactive | mountains, progress_logs, weekly_plans (active only) | guide_chats, guide_messages |
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
