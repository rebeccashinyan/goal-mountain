# Goal Mountain

## Project Overview

Goal Mountain is an AI-powered goal achievement companion that transforms long-term ambitions into personalized journeys.

Instead of tracking habits or checking off tasks, Goal Mountain helps users navigate the gap between where they are today and who they want to become.

Every goal becomes a mountain.
Every user becomes an explorer.

The AI acts as a guide, strategist, mentor, researcher, and companion throughout the journey.

The objective is not to complete tasks.
The objective is to reach meaningful life goals.

## Core Philosophy

Most productivity apps assume that people fail because they lack discipline.
Goal Mountain assumes that people fail because they become lost.

People often know what they want:
- Become an AI Product Designer
- Get into graduate school
- Lose weight
- Launch a startup
- Learn a language

But they often do not know:
- What to do next
- Which path is best
- Whether they are making progress
- What is slowing them down
- How to adapt when plans fail
- How to stay motivated over months or years

Goal Mountain helps users navigate uncertainty rather than simply track tasks.

## What Makes Goal Mountain Different

**Traditional Productivity Apps**
- Track tasks
- Track habits
- Track streaks
- Count completions

**Goal Mountain**
- Understands goals
- Generates personalized mountains
- Creates adaptive plans
- Learns user behavior
- Detects obstacles
- Explains progress
- Provides strategic guidance
- Evolves alongside the user

The AI is an active participant, not a passive tracker.

## Core Design Principle

Goal Mountain is not a task manager.
Users do not primarily think in tasks.
Users think in goals.

The system visualizes progress through Mountains, Sub-Mountains, and Milestones rather than traditional task lists.

- Small goals are represented as a Mountain with Milestones.
- Complex goals are represented as a Mountain composed of multiple Sub-Mountains, each with their own Milestones.

This creates a flexible framework that can support both simple and highly complex life goals while preserving the core mountain-climbing metaphor.

## The Goal Mountain Framework

### Mountain

A meaningful goal the user wants to achieve.

Examples:
- Run a 10K Road Race
- Become an AI Product Designer
- Launch a Startup
- Learn Japanese

### Milestones

Milestones represent major stages of progress within a mountain.

They help users understand:
- Where they currently are
- What comes next
- How far they are from the summit

### Summit

The summit represents the final outcome the user wants to achieve.

Examples:
- 10K Road Race Mountain → Complete a 10K Road Race
- AI Product Designer Mountain → Land an AI Product Designer Role
- Startup Mountain → Launch a Startup
- Graduate School Mountain → Receive Admission Offer

### Simple Mountains

Some goals are relatively straightforward and can be represented using a single mountain with milestones.

**Structure**

Mountain → Milestones → Summit

**Example**

Run a 10K Road Race
1. Build Running Habit
2. Run 2K
3. Run 5K
4. Run 8K
5. Complete 10K Race

### Complex Mountains

Some goals are too large or too multidimensional to be represented as a single linear path. In these cases, Goal Mountain decomposes the goal into multiple Sub-Mountains.

**Structure**

Mountain → Sub-Mountains → Milestones

Each Sub-Mountain represents a major component of the larger goal.

**Example**

Mountain: Become an AI Product Designer

Sub-Mountains:
- 🏔 Portfolio
- 🏔 AI Product Skills
- 🏔 Industry Knowledge
- 🏔 Networking
- 🏔 Job Applications

Each Sub-Mountain contains its own milestones.

**Example**

Sub-Mountain: Portfolio

Milestones:
1. Complete First Case Study
2. Complete Second Case Study
3. Build AI Product Project
4. Launch Portfolio Website

## Core AI Agents

### Mountain Chat Agent

Conversational intake before a mountain is created. Extracts a structured goal from freeform conversation.

**Responsibilities**
- Ask clarifying questions one at a time
- Refine vague goals into specific, actionable ones
- Collect current level, target date, and constraints
- Confirm the goal with the user before handing off to the Generator

### Mountain Generator Agent

Transforms a confirmed goal into a structured mountain journey. Uses Research Agent output to ground milestones in real-world knowledge.

**Responsibilities**
- Define camps (major stages)
- Create checkpoints within each camp
- Establish summit criteria
- Incorporate proven industry stages from the Research Agent
- Set realistic duration estimates based on research

### Research Agent

Provides external, real-world knowledge about a goal. Operates in two modes:

**Pre-mountain mode** — called before the mountain exists. Returns proven stages, key skills, common pitfalls, and resources. Output is passed to the Generator to ground milestone structure in real-world knowledge. Also saved to DB so the Insights page can display it.

**Post-mountain mode** — called after a mountain exists. Adds market trends, career benchmarks, best practices, and opportunities/risks specific to the user's current stage.

**Responsibilities**
- Analyze industry stages and real-world benchmarks
- Recommend specific, actionable learning resources
- Identify skill gaps at the user's current stage
- Surface opportunities and risks
- Avoid repeating past research — always find new angles

### Planning + Strategy Agent

Creates adaptive weekly schedules and decides the highest-impact next action.

**Responsibilities**
- Build weekly plans adapted to the goal type
- Learn from past plan performance — reduce load after missed activity, level up when ahead
- Surface the single most important action this week
- Identify the very next thing to do right now
- Provide broader strategic thinking about trajectory

### Progress Tracking Agent

Records activity and updates the mountain state.

**Responsibilities**
- Accept activity logs (activity, completed_task, missed_activity, milestone_reached, rest_day)
- Update progress percentage
- Advance milestones when complete
- Detect trends (ahead / on track / behind)
- Surface risk signals early

### Reflection Agent

Turns weekly experience into learning. Auto-writes insights to the Memory Agent.

**Responsibilities**
- Process the user's weekly self-reflection
- Identify recurring blockers across past reflections (flags if seen 3+ times)
- Extract lessons learned and what worked vs. what failed
- Suggest concrete plan adjustments
- Write behavior patterns, motivations, and obstacles to memory automatically

### Memory Agent

Stores and retrieves long-term knowledge about the user. Most writes come from the Reflection Agent automatically.

**Memory categories:**
- `goal` — stated goals and ambitions
- `preference` — how the user likes to work
- `motivation` — what energizes or drives them
- `obstacle` — recurring blockers
- `behavior_pattern` — observed patterns (e.g. "works best in morning sessions")

Memory personalizes every other agent — Planning, Research, Reflection, Guide, and Strategic Intelligence all inject relevant memories into their context.

### Guide Agent

The single AI companion the user converses with. Context switches based on whether a specific mountain is selected.

**All Mountains mode** — cross-mountain strategy: prioritization, overcommitment risks, life-strategy guidance.

**Single Mountain mode** — mountain-specific coaching: what to do next, why stuck, how to accelerate.

**Responsibilities**
- Maintain one consistent persona across all contexts
- Reference the user's actual data, never speak in hypotheticals
- When accessed from Insights, receive the insight as initial context

### Strategic Intelligence Agent

Runs a deep, on-demand analysis of the user's goal journey. Triggered from the Insights page. Stateless — no DB writes.

**Responsibilities**
- Estimate summit probability and consistency score
- Recommend the highest-leverage action
- Identify the true bottleneck (vs. what is not the bottleneck)
- Analyze skill gaps, opportunities, and trade-offs
- Generate three scenarios: current pace / increased effort / stopped
- Provide a mentor-level insight from someone who has achieved this goal

## AI Strategic Intelligence

One of Goal Mountain's key differentiators is its ability to provide strategic guidance rather than simple progress tracking.

The Strategic Intelligence Agent is triggered on demand from the Insights page. It analyzes the full picture of the user's journey in one call:

- **Skill Gap Analysis** — Where the user is today versus where they need to be.
- **Bottleneck Analysis** — What is actually preventing progress (and what is not).
- **Opportunity Analysis** — External opportunities and emerging trends.
- **Trade-Off Analysis** — How to allocate limited time and effort.
- **Highest Leverage Actions** — The single action most likely to accelerate progress.
- **Scenario Planning** — Three forecasts: current pace, increased effort, stopped.
- **Mentor Insights** — One piece of wisdom from someone who has achieved this goal.

## Insights System

Goal Mountain continuously generates insights to help users better understand their journey.

**Journey Health**
- Progress
- Consistency
- Current camp
- Summit probability

**Patterns & Learnings**
- Productive behaviors
- Motivation triggers
- Performance trends
- Behavioral insights

**Obstacles & Risks**
- Recurring blockers
- Risk factors
- Suggested interventions

**Progress Timeline**
- Weekly progress
- Monthly progress
- Yearly progress
- Camp completion history

**AI Predictions**
- Summit ETA
- Camp ETA
- Success probability
- Future projections

## User Journey

1. User describes their goal in the Mountain Chat (conversational intake)
2. Research Agent gathers real-world knowledge about the goal (pre-mountain mode)
3. Mountain Generator creates camps and checkpoints grounded in the research
4. "About Your Plan" shows the user what the research found and how the plan is structured
5. User navigates to their mountain and starts climbing
6. Planning Agent generates adaptive weekly schedules
7. User logs activity; Progress Tracking Agent updates milestones and detects trends
8. Reflection Agent processes weekly reviews and writes patterns to memory
9. Research Agent surfaces new knowledge as the user advances through stages (post-mountain mode)
10. Strategic Intelligence Agent provides on-demand deep analysis from the Insights page
11. Guide Agent coaches throughout the journey — specific to one mountain or across all mountains
12. User reaches the summit; AI helps define the next mountain

## Future Vision

### Multiple Mountains

Users can pursue multiple life goals simultaneously.

Examples:
- AI Product Designer
- Run a Marathon
- Learn Japanese

### Life Strategy Layer

The AI helps users decide:
- Which mountain deserves attention
- Where to invest limited time
- Which opportunities to pursue
- Which goals should be delayed

### AI Mentor Personalities

Examples:
- Explorer
- Coach
- Founder
- Strategist
- Professor
- Athlete

### Social Expeditions

Friends can climb mountains together.
The AI coordinates accountability, planning, and team progress.

## Portfolio Goal

Goal Mountain is not a productivity app.
It is an AI-native goal achievement system.

The project demonstrates:
- AI Product Design
- Agent Architecture
- Long-Term Human-AI Interaction
- Personalization Systems
- Behavioral Design
- Memory Systems
- Strategic Decision Support
- Human-AI Collaboration

The core challenge is designing how an AI can guide someone through a journey that may last months or years while continuously adapting to changing circumstances.

## AI Guide

There is one AI Guide in the app. The AI Guide changes its context based on where the user enters from.

### Context Selector

At the top of the Guide page, a dropdown selects the context:
- All Mountains — cross-mountain strategy
- [Specific Mountain] — mountain-specific coaching

**All Mountains context:**
- What should I prioritize?
- Am I taking on too many goals?
- Which mountain is at risk?

**Single Mountain context:**
- What should I do next?
- Why am I stuck?
- How can I reach my summit faster?

### Navigation Flows

**Path 1:** AI Guide → Context = All Mountains

**Path 2:** My Mountains → Mountain Details → Ask AI → AI Guide → Auto-select that mountain

**Path 3:** Insights → Discuss With AI → AI Guide → Auto-select that mountain and pass the selected insight into the conversation

The user should feel like they have one AI companion, not multiple AI chatbots. Only the AI's context changes.

## App Structure

**Main Pages**
- My Mountains (dashboard)
- Analysis (memory profile + stored memories)
- AI Guide (context-aware chat)

**Mountain Detail Pages**
- Overview (mountain visualization + weekly plan + progress tracker + reflection)
- Insights (research agent data)

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **AI:** OpenAI API (GPT-4o-mini)
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel (planned)

## Database Tables

- `mountains` — goals, milestones, progress
- `research` — Research Agent results
- `weekly_plans` — Planning + Strategy Agent output
- `progress_logs` — Progress Tracking Agent logs
- `reflections` — Reflection Agent weekly reviews
- `memory` — Memory Agent long-term storage
- `guide_chats` — persistent Guide Agent conversations (user-initiated + AI-proactive)
- `guide_messages` — messages within a guide chat

## Recent Updates

### Agent Refinement: Goal-Agnostic (2026-06-25)

All agents have been updated to support any goal type (career, fitness, learning, creative, financial, personal growth), removing previous running-specific bias.

**Changes:**
- **Mountain Generator** — frontend sends `current_level`/`target_date`, mapped to existing DB columns
- **Planning Agent** — generic prompt (no workout/soreness/injury language)
- **Progress Tracking Agent** — generic activity types (`activity`, `completed_task`, `missed_activity`, `milestone_reached`, `rest_day`), `soreness` → `effort`
- **Reflection Agent** — generic prompt (no missed workout patterns)
- **Guide Agent** — generic examples, labels "Target date" in prompts
- **Memory Agent** — `training_history_summary` → `journey_history_summary`
- **CreateMountainModal** — "Current Level" / "Target Date" labels (generic)

No DB migration needed — API routes map generic frontend names to existing DB columns (`running_level`, `race_date`).

---

### Navigation: AI Guide Stays in Mountain Context (2026-07-03)

**Problem:** Clicking "AI Guide" from inside an individual mountain sent the user to `/guide` which used the dashboard layout (Mountains, Analysis, AI Guide), breaking the mountain nav context.

**Fix:**
- Moved `/guide` page out of the `(dashboard)` route group into its own `app/guide/` directory with a dedicated adaptive layout
- `app/guide/GuideNav.tsx` (client component) reads `mountain_id` from the URL — if present, renders `MountainDetailNav`; otherwise renders dashboard tabs
- `MountainDetailNav` updated to fall back to `mountain_id` param when `id` is not in the URL, so Overview/Insights links retain the correct mountain ID when navigating from the guide page

---

### Insights Page: Full Rebuild (2026-07-03)

The Insights page was rebuilt to match the intended design with 6 sections:

1. **Header card** — "Research Agent" label, "Insights for [goal]", Discuss With AI button (restored to original style)
2. **Journey Health** — 4-stat row: Current Camp, Progress, Consistency (computed from logs), Summit Probability (from AI)
3. **Patterns & Learnings** — pulls `behavior_pattern` memories from the Memory Agent
4. **Obstacles & Risks** — aggregates blockers from all reflections, deduplicates, shows top 4 with detected count and fix
5. **AI Strategic Intelligence** — 4×2 grid of numbered cards (4.1–4.8): Recommended Strategy, Skill Gap Analysis, Highest Leverage Actions, Bottleneck Analysis, Opportunity Analysis, Trade-Off Analysis, Scenario Planning, Mentor Insights. Triggered on demand via "Generate Analysis" button.
6. **Progress Timeline + AI Predictions** — weekly calendar from progress logs; AI Predictions populated when analysis is generated

**New API:** `POST /api/insights` — takes `mountain_id`, aggregates mountain + memory + reflection + log data, calls GPT to generate all 8 strategic cards + predictions in one structured call. Stateless (no DB save).

---

### Research Agent: Now Feeds Mountain Generator (2026-07-03)

**Problem:** The Mountain Generator created camps/milestones from training data alone, without grounding them in real-world domain knowledge.

**Fix — two-phase mountain creation:**

1. **Research Agent runs first** (`/api/research` now supports pre-mountain mode): called with just a `goal` string (no `mountain_id`). Returns proven stages, key skills, common pitfalls, best resources, and insights. Does not save to DB.

2. **Generator uses research context** (`/api/generate-mountain` now accepts `research_context`): the system prompt explicitly instructs the generator to use proven stages as camp structure, incorporate skill gaps as checkpoint focus areas, use realistic duration estimates from research, and use industry-standard terminology.

**Modal UI:** `generateMountain()` in `CreateMountainModal` now chains both steps with a two-step progress indicator (Research → Generate). Research failure is silent and non-blocking.

---

### Overview Page: Restructured Layout (2026-07-03)

The mountain Overview page was restructured based on the principle that the Mountain Visualization is the star, and the rest of the page supports the user's "doing" workflow.

**New structure:**
1. **Header card** — goal, summit, progress pills, Discuss With AI
2. **Mountain Visualization** — full width, prominent, unchanged
3. **This Week's Plan** (wide left column) — next best action highlighted, 3–5 tasks from schedule with priority dots, "AI Generated" label, Regenerate button
4. **Progress** (right column, compact) — progress bar, current camp, next milestone, last activity date, milestone count, inline quick-log form
5. **Weekly Reflection** (right column, compact) — last reflection date + 2-line summary, single "Open Reflection" / "Start Reflection" button linking to Insights

Design principle: reflection is not the first thing users need every time — it's an entry point, not a primary section.

---

### AI Guide: Actions + Suggested Replies (2026-07-03)

The Guide Agent can now take actions during conversation and offer suggested reply chips.

**API changes (`/api/guide`):**
- Now returns structured JSON: `{ reply, suggested_replies, actions }`
- `suggested_replies`: up to 3 short reply options shown as chips below the AI message
- `actions`: array of actions the AI decided to take based on the conversation

**Action types:**
- `store_memory` — executed server-side automatically, silently stores an insight about the user into the `memory` table (category: motivation / obstacle / behavior_pattern / preference)
- `log_progress` — executed server-side automatically, logs an activity or missed session to `progress_logs`
- `advance_milestone` — returned to the client as a pending action with a confirmation card; user must click "Confirm" before the milestone advances

**Frontend changes (`/app/guide/page.tsx`):**
- Suggested reply chips render below the most recent AI message; clicking one auto-sends it
- `advance_milestone` renders as a green confirmation card with the next milestone name; confirmed via `PATCH /api/mountains/[id]`
- After milestone advance, a system message appears: "✓ Moved to [next stage]" with new suggested replies
- Previous AI message's chips are cleared when the user sends a new message

**Plan proposal flow:**
- When the user wants to adjust their schedule or pace, the AI returns `propose_plan` action with extracted `user_constraints` and `available_time`
- Frontend immediately calls `POST /api/plan` with those constraints (plan is generated and saved to DB)
- A structured plan card appears inline in chat showing: weekly schedule grouped by day, task priorities (color-coded dots), focus area, and "Start here" next action
- "Looks good ✓" — marks plan as confirmed in chat state and sends a confirmation message
- "Make changes" — pre-fills the input with "Can you adjust the plan to " so user can specify the change

---

### Progress Tracker: Simplified to Minimal Log Form (2026-07-03)

**Problem:** The ProgressTracker on the Overview page had too much — 5 log types (activity, completed_task, missed_activity, milestone_reached, rest_day), energy + effort 1–5 sliders, full AI analysis output (summary, trend badge, 4 stat cards, risk signals), and a recent activity list. This made the Overview feel like a dashboard, not a doing tool.

**Fix:** Replaced with a minimal inline form:
- Collapsed by default — just a dashed "+ Log Progress" button
- Expands to: 3 type chips (Did it / Missed / Rest day) + one optional description field + Log button
- On success: "✓ Logged" confirmation, auto-collapses after 1.8s
- No analysis output on the Overview — AI analysis belongs on the Insights page
- No recent activity list — that's the Insights progress timeline's job
- `milestone_reached` and `rest_day` removed as manual types — the Progress Tracking Agent infers milestone completion from description and mountain state; rest day distinction is handled via the description field on a "Missed" log

---

### "About Your Plan" Modal: Post-Generation Summary (2026-07-03)

After the Research + Generate flow completes, instead of immediately navigating to the mountain, the `CreateMountainModal` now shows an "About Your Plan" overlay inside the same modal.

**What it shows:**
1. **What the Research Agent found** — Proven stages (numbered, with typical duration), skills to build (tag chips), and top 3 pitfalls to watch out for
2. **Your Mountain** — Full ordered milestone list with camps highlighted (green bg, "Camp" badge) and checkpoints (white bg), summit shown with gold star
3. **Summary line** — "X major camps · Y checkpoints · grounded in real-world research"

**CTA:**
- "Start Climbing →" — navigates to `/mountain?id=${mountainId}` via `useRouter`, closes modal
- "Close" — dismisses modal without navigating

**Data flow:**
- `onCreated()` is called immediately after generation (before showing the plan) so the parent list refreshes in the background
- `researchData` and `mountainResult` are stored in component state during generation
- Research findings shown in "About Your Plan" come from the pre-mountain research call (first step of two-step generation)
- The same research data was already saved to the `research` DB table inside `/api/generate-mountain`, so the Insights page automatically shows it via the existing GET endpoint

---

### Create Mountain: Conversational Chat Flow (2026-07-03)

The static form (goal, experience, target date, constraints fields) was replaced with a conversational AI modal.

**New API:** `POST /api/create-mountain-chat` — takes `conversation_history`, returns `{ reply, status: "gathering"|"confirming"|"ready", goal_data }`. The AI asks one question at a time, refines vague goals, and only signals ready when it has enough context.

**Modal:** `CreateMountainModal` is now a chat UI. When AI returns `status: "ready"`, generation triggers automatically. A "Generate Mountain" button appears at `status: "confirming"` for manual override.

**Date normalization:** AI may return partial dates (e.g. `"2028-05"`). The generate route normalizes to full ISO before Supabase insert — `YYYY-MM` → `YYYY-MM-01`, `YYYY` → `YYYY-01-01`.

---

### Dashboard: Delete Mountain (2026-07-03)

Each mountain card on the dashboard has a trash icon button. Clicking shows a confirm dialog, then calls `DELETE /api/mountains/[id]`.

---

### AI Guide: Sidebar Layout + Persistent Chat History (2026-07-03)

The AI Guide page was completely redesigned with a two-column sidebar layout and persistent chat storage in Supabase.

**Layout:**
- Left sidebar (240px): "New Chat" button, search input, "Messages from AI" section (AI-proactive chats with orange unread dot), "Chats" section (user-initiated history)
- Right: selected chat conversation with messages, suggested reply chips, action cards (advance milestone, plan proposal), typing indicator

**Persistent chat architecture (new tables):**
- `guide_chats` — one row per conversation: `mountain_id`, `title`, `type` (`user_initiated` | `ai_proactive`), `unread`, `last_message`
- `guide_messages` — one row per message: `chat_id`, `role`, `content`, `suggested_replies` (jsonb), `actions` (jsonb)

**New API routes:**
- `GET /api/chats` — list all chats, optionally filtered by mountain_id
- `POST /api/chats` — create a new chat
- `GET /api/chats/[id]/messages` — fetch all messages in a chat
- `POST /api/chats/[id]/messages` — save user message → call OpenAI (with full context + conversation history) → execute server-side actions → save AI message → return `{ reply, suggested_replies, actions }`
- `POST /api/proactive` — check inactivity conditions (daysSinceLastLog ≥ 3, missedCount ≥ 2, zero activities this week), generate AI check-in via GPT, create `ai_proactive` chat with `unread: true`. Deduped per mountain per day.

**Proactive AI messages:** On page load (when `mountain_id` param present), frontend calls `/api/proactive`. If conditions are met, a new "Messages from AI" entry appears in the sidebar with an orange unread dot. The AI writes a contextual check-in message with suggested replies.

**All mountains support:** New Chat from the guide page can be scoped to a specific mountain (via the header mountain switcher) or left unscoped for cross-mountain strategy discussions.

**ProgressTracker log types:** Simplified from 5 → 2: `activity` ("Did it") and `missed_activity` ("Missed"). No energy/effort sliders, no analysis output, no activity list. Auto-collapses 1.8s after logging.
