# Goal Mountain — UI Specification

---

## Design System

### Colors

Defined in `app/globals.css` as Tailwind CSS custom properties via `@theme inline`.

**Forest palette (primary brand):**

| Token | Hex | Usage |
|-------|-----|-------|
| `forest-950` | `#0B1F13` | Page headings, deepest text |
| `forest-900` | `#0F2A1A` | Secondary headings |
| `forest-800` | `#163B27` | Bold text, progress values |
| `forest-700` | `#1E5235` | Primary buttons, user chat bubbles |
| `forest-600` | `#2A6B46` | Eyebrow labels, icons, borders on hover |
| `forest-500` | `#378459` | Progress bars |
| `forest-400` | `#4A9B6E` | Accent dots, subtle highlights |
| `forest-300` | `#6DB88E` | Light accents |
| `forest-200` | `#9FD4B4` | Spinner rings, focus outlines |
| `forest-100` | `#D0ECDD` | Icon backgrounds, ring borders |
| `forest-50` | `#EDF8F1` | Chip backgrounds, tag fills |

**Summit (danger / accent):**

| Token | Hex | Usage |
|-------|-----|-------|
| `summit` | `#E07A6E` | Delete buttons, error states, obstacle tags |
| `summit-light` | `#F0ACA4` | Light danger tint |

**Neutral (stone-based):**
- Background base: `#F6F6F6` (all layouts)
- Card base: pure white `#FFFFFF`, borderless, soft shadow
- Muted inner panels / tints: `#F6F6F6` on white cards
- Hairline borders (controls, dropdown menus, internal dividers): `#ECECEC` / `stone-100`
- Body text: `#1c1917` (stone-900)
- Secondary text: stone-500 (`#78716c`)
- Placeholder: stone-400

**Gold accent:** `#E7B85B` — used for the summit star icon and camp markers.

### Typography

| Role | Font | CSS variable |
|------|------|-------------|
| Display / headings | Crimson Pro (serif) | `--font-display` |
| Body / UI | Outfit (sans) | `--font-body` |

**Heading style:**
- `font-family: var(--font-display)` (h1–h6 via global CSS)
- `letter-spacing: -0.03em` (tight tracking)
- `line-height: 1.2`

**Body style:**
- `font-family: var(--font-body)`
- `line-height: 1.7`

**Eyebrow labels** (section labels above headings):
```
text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600
```

### Background

All three layouts wrap the page in a flat `#F6F6F6` background (`min-h-screen bg-[#F6F6F6]`). (The legacy radial-gradient body background in globals.css is fully covered by the layout wrappers.)

### Shadows

Three shadow levels used consistently:

**Card shadow** (most common):
```css
box-shadow: 0 10px 28px rgba(43, 58, 42, 0.07), 0 1px 2px rgba(43, 58, 42, 0.05);
```

**Elevated card shadow** (header cards, modal):
```css
box-shadow: 0 10px 28px rgba(43, 58, 42, 0.08), 0 1px 2px rgba(43, 58, 42, 0.06);
```

**Button shadow** (primary CTA):
```css
box-shadow: 0 2px 8px rgba(20, 60, 35, 0.2);
```

**Icon shadow**:
```css
box-shadow: 0 8px 18px rgba(30, 82, 53, 0.08);
```

### Border Radius

| Component | Radius |
|-----------|--------|
| Large cards, modals | `rounded-3xl` (24px) |
| Inner cards, sections | `rounded-2xl` (16px) |
| Tags, pills | `rounded-full` or `rounded-md` |
| Buttons (primary) | `rounded-xl` (12px) |
| Small buttons, icon buttons | `rounded-lg` (8px) |
| Input fields | `rounded-2xl` (16px) |

### Interactive States

Every clickable element has all three states — no exceptions:

```
hover:   color shift + optional bg tint
active:  scale-[0.97] or scale-[0.98] (never scale-[1])
focus-visible:  outline-2 outline-offset-2 outline-forest-500
```

Transitions: `transition-colors duration-200` — never `transition-all`.

---

## Layout Structure

### Route Groups

```
app/
  (dashboard)/          → Dashboard layout (header + ContextNav)
    page.tsx            → /  (My Mountains)
    analysis/page.tsx   → /analysis
    settings/page.tsx   → /settings
  (mountain)/           → Mountain layout (header + ContextNav)
    mountain/page.tsx   → /mountain?id=uuid
    insights/page.tsx   → /insights?id=uuid
  guide/                → Guide layout (header + ContextNav)
    page.tsx            → /guide?mountain_id=uuid (optional)
```

### Header Navigation (all layouts)

All three layouts render the same `ContextNav` header: a 3-tab icon nav + a context dropdown pill beside it.

- **Tabs (always exactly 3):**
  - Tab 1 — "All Mountains" (double-mountain icon, → `/`) in All Mountains context; becomes "Mountain Overview" (single-mountain icon, → `/mountain?id=…`) when a mountain is selected
  - Tab 2 — "Insights" (→ `/analysis` in All Mountains context; `/insights?id=…` in mountain context)
  - Tab 3 — "AI Guide" (→ `/guide` or `/guide?mountain_id=…`)
- **Context dropdown** (white pill, chevron left, next to the tab nav): lists "All Mountains" + every mountain (fetched from `GET /api/mountains`). Switching keeps the current tab section — e.g. on Insights, picking a mountain goes to `/insights?id=…`; picking "All Mountains" goes to `/analysis`.
- Context is derived from the URL: `?id=` or `?mountain_id=` present → mountain context; otherwise All Mountains.
- Max content width: `max-w-[1180px] mx-auto`; top padding `px-6 pt-5 pb-3`; main padding `px-6 pb-10`.

---

## Pages

### My Mountains (`/`)

**Purpose:** Dashboard showing all the user's mountains as cards.

**Empty state:** Centered message + "Create Mountain" CTA button.

**Loaded state:**
- Header row: h2 "My Mountains" + "+ Create Mountain" button (right-aligned on desktop)
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`

**Mountain card structure:**
1. Above card: goal title + delete button — the title row reserves a fixed two-line height (`min-h-[44px]`, `line-clamp-2`, full goal in `title` tooltip) so all cards in a row start at the same y; cards stretch to equal height (`flex-1`, progress row pinned with `mt-auto`)
2. Card body (rounded-2xl, borderless, bg-white, soft shadow — sits on the `#F6F6F6` dashboard background):
   - "Today" label (bold, sentence case — no camp pill)
   - Current task text (or plain placeholder if empty)
   - `MiniMountain` SVG — full card width, intrinsic aspect ratio (no framed box)
   - One row: progress bar (flex-1, `#6FBE8B` fill on `#EDEDEA` track) + bold percentage at right
3. Card hover: `-translate-y-1`

**Create Mountain Modal:** Triggered by "+ Create Mountain" button. Full modal with chat interface.

---

### Mountain Overview (`/mountain?id=uuid`)

**Purpose:** The main working view for an individual mountain.

**Sections (top to bottom):**

1. **Header (plain text, no card)**
   - Left: h2 "Mountain Overview" (text-3xl bold — the largest text) + goal as smaller subtitle below (text-base semibold)
   - Right: "Discuss With AI" button → `/guide?mountain_id=uuid`

2. **Mountain Visualization** (full-width, rounded-3xl, bg-white, p-3 md:p-5)
   - `MountainViz` component — SVG mountain with milestone markers

3. **This Week's Plan** — `PlanView` component (includes daily check-in + automatic week-in-review; there is no manual reflection form or manual progress log anymore)

---

### Insights (`/insights?id=uuid`)

**Purpose:** Research Agent data, behavioral patterns, and strategic analysis for one mountain.

**Sections:**

1. **Header card** — "Research Agent" eyebrow, "Insights for [goal]", "Discuss With AI" button (mountain switching happens via the global context dropdown in the header nav)

2. **Journey Health** — 4-stat bordered row:
   - Current Camp
   - Progress (%)
   - Consistency (computed from logs)
   - Summit Probability (from Strategic Intelligence)

3. **Patterns & Learnings** — `behavior_pattern` memories from Memory Agent

4. **Obstacles & Risks** — aggregated blockers from all reflections, deduplicated, top 4

5. **AI Strategic Intelligence** — 4×2 grid of 8 numbered cards (4.1–4.8):
   - 4.1 Recommended Strategy
   - 4.2 Skill Gap Analysis
   - 4.3 Highest Leverage Actions
   - 4.4 Bottleneck Analysis
   - 4.5 Opportunity Analysis
   - 4.6 Trade-Off Analysis
   - 4.7 Scenario Planning
   - 4.8 Mentor Insights
   - Triggered on demand via "Generate Analysis" button → `POST /api/insights`

6. **Progress Timeline** — weekly calendar built from `progress_logs`, active days shown as green dots

7. **AI Predictions** — two scenario cards, populated when analysis is generated

---

### Analysis (`/analysis`)

**Purpose:** Shows what the AI knows about the user — Memory Profile + stored memories.

**Sections:**

1. **Header (plain text, no card)** — h2 "Memory Profile" + "What the AI knows about you" subtitle + description, with the mountain selector dropdown at right (if multiple mountains)

2. **Mountain context bar** — goal name + progress bar for selected mountain

3. **Your Profile** — AI-synthesized from memories:
   - Journey So Far (full-width, narrative summary)
   - Behavior Patterns (bullet list)
   - Motivation Profile (bullet list)
   - What other agents know about you (forest-50 tinted block)
   - "Refresh Profile" button → `GET /api/memory/profile`

4. **Stored Memories** — list of all memory entries with:
   - Category chip (color-coded: goal=forest, behavior=amber, motivation=forest, obstacle=summit/red, preference=stone)
   - Memory content text
   - Date (short format)
   - Delete button (appears on hover)
   - Category filter chips above the list

---

### AI Guide (`/guide`)

**Purpose:** Context-aware conversational AI coach with persistent chat history.

**Layout:** Stacked — plain-text header on top, two-column sidebar+chat below (white rounded-3xl container, borderless, soft shadow). Total height: `calc(100vh - 80px)`.

**Header (plain text, no card):**
- h2 "AI Guide" (`text-3xl font-bold text-forest-950`) + "Ask for your next best move" subtitle (`text-base font-semibold text-stone-800`)
- Context selector dropdown (right, "MOUNTAIN" label): "All Mountains" or specific mountain goal — controls which mountain new chats are scoped to

**Sidebar (240px, bg-[#F6F6F6], border-r border-stone-100):**
- "New Chat" button (+ icon, creates a `user_initiated` chat in Supabase)
- Search input (filters both sections by title)
- **"Messages from AI" section** — always visible; shows `ai_proactive` chats with orange unread dot (`#E07A6E`) and last_message preview, collapsed to the 4 most recent with a "Show N more" / "Show less" toggle (search always covers all). If empty: "No messages yet — the AI will reach out if it detects you're off track."
- **Mountain selector** (header, labeled "Mountain") — goals truncate at ~48 chars with ellipsis; full goal on hover via `title`. (Intake agent now also keeps `goal` a short headline ≤ ~50 chars; details live in constraints/current_level.)
- **The mountain selector filters the sidebar**: selecting a mountain shows only that mountain's chats + AI messages; "All Mountains" shows everything. Switching context away from the open chat's mountain closes the chat pane.
- **Chat deletion**: every sidebar item (AI messages and chats) reveals a trash icon on hover → `window.confirm` → `DELETE /api/chats?id=` (messages cascade). Deleting the open chat clears the pane.
- **"Chats" section** — always visible; shows `user_initiated` chats with title + last_message preview. If empty: "No chats yet. Click 'New Chat' to start."
- Selected chat highlighted with white bg + shadow

**Chat panel (flex-1, bg-white):**
- **Chat header** (border-b): selected chat title + gray mountain goal subtitle (no pill)
- **Messages area** (bg-[#F6F6F6]):
  - Empty state: 3 starter question chips
  - User bubbles: right-aligned, forest-700 bg, white text
  - AI bubbles: left-aligned, white bg, stone-800 text
  - **Suggested reply chips**: render below the most recent AI message as rounded-full pills (forest-700 border/text); clicking auto-sends
  - **Advance milestone card**: green (forest-50 bg, forest-200 border) with next milestone name + "Confirm" button
  - **Plan proposal card**: rounded-2xl card showing day-by-day schedule with priority dots, focus area, "Start here" action; "Looks good ✓" / "Make changes" buttons
  - Sending indicator: 3 bouncing dots (stone-300)
- **Input bar**: full-width rounded-2xl text input; send button (forest-700, rounded-xl) embedded right side; Enter to submit
- **Empty state** (no chat selected): centered icon + heading + 3 starter chips + "New Chat" button

**Proactive AI messages:** On page load when `mountain_id` param is present, page calls `POST /api/proactive`. If inactivity conditions are met, a new chat appears in "Messages from AI" with orange unread dot.

---

## Components

### `TabNav`

Renders a set of icon tab links (pill container, tooltip labels). Exports two 3-tab configs: `allMountainsTabs` (All Mountains `/`, Insights `/analysis`, AI Guide `/guide`) and `mountainContextTabs` (Mountain Overview `/mountain`, Insights `/insights`, AI Guide `/guide`). Each tab carries a `section` (`overview | insights | guide`).

### `ContextNav`

The single header nav used by every layout. Picks the tab set from URL context (`?id=` / `?mountain_id=` → mountain context) and renders the context dropdown pill beside the tabs ("All Mountains" + every mountain from `GET /api/mountains`). Switching context navigates to the same section under the new context.

### `MiniMountain`

Card-sized, label-free rendering of the same expedition map as `MountainViz` (identical fixed trail geometry: compass base camp, bend-pattern route, evenly spaced nodes, summit flag, right ridge, pines, cloud, foothill lines). ViewBox crops to the art (`245 45 815 520` — wider than tall, matching the reference component) with foothill lines extended to fill the wider frame. Node states: completed = green fill + white dot, current = yellow, upcoming = white. No labels, no progress text inside the SVG. Props: `progress` (only to detect 100% = all done), `totalSteps`, `currentStep`.

### `MountainViz`

Full-size SVG "Expedition map" visualization used on the Overview page. Props: `milestones`, `summit`, `currentMilestoneIndex`.

Design (green expedition-map style, data-driven route on a fixed canvas):
- Fixed 980×650 viewBox — the canvas, mountain silhouette, peak, trees, cloud and background never move or scale with milestone count
- Warm off-white card background (`#F9F7F3`), rounded corners
- Route: follows the hand-tuned trail traced from the reference art (980×620 canvas) — compass at (318, 500), gentle approach, wide switchbacks mid-mountain, near-vertical final climb, summit node always exactly on the peak (680, 125) under the flag. The mountain and scenery never rescale, move, or restretch with milestone count
- Node placement: vertical gaps between consecutive milestones are all equal (y evenly spaced from the first row at y=455 up to the peak); x follows the trail's bend pattern (snapped to the 8 reference bends when ≤8 milestones, interpolated along them when more), so segment lengths vary naturally. Every node is a bend of the route; the summit is appended as the final node
- Labels are a pure SVG overlay that never affects the map's layout: one label + one horizontal connector per node, drawn at the node's exact y, text right-anchored (`textAnchor="end"`). Label right edges form a staircase — the bottom label sits furthest left (x≈250) and each label higher up steps rightward (summit at x≈548); the connector stretches from that right edge across to the zig-zagging node, so connector lengths vary
- Label text: single line, `{index+1}. {mapLabel}` — `mapLabel` is a short 2-4 word display name the Generator produces per milestone (falls back to the full name for older mountains), truncated at ~34 chars with an ellipsis; full name + description shown as native tooltip. 13.5px, regular weight; current milestone bold dark-green. The summit's visible label is always `{n}. Summit` — the full summit statement lives in its tooltip, never rendered in the map
- Node states: upcoming = white with sage stroke (`#8BA894`), current = yellow fill (`#F4D03F`), completed = green fill (`#4A9D6F`) with white center dot; traveled route renders darker/thicker (`#2D6A48`)
- Scenery (all fixed): left shoulder slope line, green-tinted right ridge silhouette from the peak, foothill lines, pine trees, cloud
- Peak: dark flag pole rising from the summit node + yellow triangle flag
- No bottom legend or extra captions

### `PlanView`

Weekly plan display for the Overview page. Reads from `GET /api/plan`, can trigger `POST /api/plan` to generate a week. Header is plain text (no card, no icon tile): "Weekly Plan" h2 — or "Your first week" / "Your next week" + amber "DRAFT" badge, see **Draft state** below — plus a "Week of …" subtitle with prev/next navigation arrows, and a "Generate Plan" button at right only when the viewed week has no plan yet.

Section order: "Week in Review" card (latest auto-reflection summary + up to 3 lessons, only when < 10 days old) → "What changed from last week" card (drafts only) → pending-revision review card *or* the quick-action steering row → freed-time suggestion banner (when applicable) → "Priority This Week" card → day-by-day schedule (no difficulty chip) → "Start this week" bar (drafts only). (Next best action and strategy notes are returned by the API but not displayed.)

The former "Adjustments from last week" card is gone — it read `plan.adjustments`, which the API returned but never persisted, so it silently vanished on reload. Its role is now filled by the persisted **What changed from last week** card.

**Draft state (every week, not just the first):** every generated weekly plan is created with `plan.status: "draft"` — an AI proposal, reviewed and adjusted before it becomes a commitment. While draft:
- h2 reads **"Your first week"** (user has never started a week) or **"Your next week"** (they have) with an amber "DRAFT" badge
- Subtext: "I prepared a starting plan for this week. Adjust anything before you begin." (first week keeps the goal-oriented wording: "I made a starting plan based on your goal…")
- A **"What changed from last week"** card sits above the quick actions when `plan.what_changed` is non-empty — 2-4 short phrases ("Reduced total weekly time (~3.25h)", "Consolidated vocab into Tuesday"). Absent on a first week, which has nothing to compare against.
- **All tracking controls are hidden:** day status pills ("Upcoming" / "In progress" / "Not logged" / "Day complete"), the per-task Status ▾ picker, "Finish today", and "Log this day". Nothing about an unstarted week can be recorded as done or missed.
- **All plan-changing controls remain:** quick-action chips, per-task Edit / Replace / Skip, "+ Add task", and Discuss with AI.
- A green bar below the schedule ("Nothing is tracked until you start — take as long as you need to adjust it." + **Start this week →**) commits it via `PATCH` setting `plan.status: "active"`. Tracking begins at that moment and the view becomes a normal active week.

**Plan selection:** `PlanView` never treats the newest `weekly_plans` row as the current plan — the newest row may be an unaccepted next-week draft. It resolves the *effective* plan per week via `effectivePlans()` from [lib/plans.ts](lib/plans.ts) (newest row per `week_start`), and derives `hasStartedAWeek` from `isActivePlan()` for the first-week/next-week wording. A given week is therefore in exactly one of three states: **draft** (review), **active** (tracking), or **active with a pending revision** (review of a proposed change).

**Interaction hierarchy.** Every way of changing a plan sits in one of three tiers, and the UI makes the cheapest one the most prominent:

| Tier | For | Control | Behaviour |
|------|-----|---------|-----------|
| 1 | One task is wrong | inline **Edit / Replace / Remove**, `+ Add task` | applies instantly, undo toast |
| 2 | The week needs a nudge | **Make it lighter**, **Change strategy**, **Change my availability**, (`···` → Regenerate) | previews first, then Apply |
| 3 | Something to explain | **Discuss with AI** | previews first, then Apply |

**Quick-action steering (tier 2):** a row of chips sits above "Priority This Week" whenever the viewed week has an unfinished day and no pending revision:
- **🪶 Make it lighter** — calls `POST /api/plan/steer` directly, no input.
- **Change strategy** — opens a popover headed "WHAT SHOULD CHANGE?" that fetches 2-3 plan-specific options from `POST /api/plan/strategies` (label + one-line detail, e.g. "Begin outreach and offer testing — Keep Monday tool tests and 1-2 clips, then Thu-Sun send targeted outreach"). Picking one steers with `action: "strategy"`. A final **"Something else… (talk it through)"** row hands off to Discuss with AI. This replaced the old "Different approach" chip, which named no outcome and re-rolled the week blind.
- **Change my availability** — small popover with three presets ("Less time this week" / "About the same" / "More time this week") plus a free-text field + Apply.
- **`···` overflow menu** — holds **Regenerate the whole week**, subtitled "Replaces every remaining task, including ones you like." Deliberately demoted from the chip row: re-rolling discards parts the user may already be happy with, so it must not compete with targeted change.
- Right-aligned text link: **"Rethinking your approach? Discuss with AI"** — worded to signal tier 3 (new context, rethinking direction), not a general edit entry point.

A chip shows a spinner in place of its icon while any steer call is in flight; all chips disable together. Steering only rewrites days that aren't `finished`, so logged history is never touched.

**Every tier-2/3 change previews** (`mode: "revision"`) — including on drafts. A hand-tuned draft is the user's plan, and an AI rewrite of it gets the same "see it before it lands" treatment as a started week. There's no undo toast on these, because declining the revision *is* the undo. `mode: "unchanged"` means the model found nothing to change and nothing was written.

**Freed-time suggestion:** when a tier-1 edit shortens or removes a task by ≥10 minutes, a green banner appears above "Priority This Week": *"You freed up 20 min on Tuesday. Want to get ahead on {current camp}?"* with **+ Add a task** and **Leave it open**. The camp name comes from the milestone's short `mapLabel` (passed in as `currentMilestoneName`), not its full `name`, which is a sentence and would wreck the line. Only on click does it call `POST /api/plan/fill-time` for one execution-focused task sized to the freed time; it lands inline with an undo toast, keeping the whole loop in tier 1. Hidden while a revision is pending.

**Pending revision review card (drafts and active weeks alike):** an amber card headed "SUGGESTED CHANGES — NOT APPLIED YET", showing the AI's one-sentence note plus a deterministic diff (computed in code, never model-narrated, so it can't misreport itself). Rows are single-line and truncated: `− Remove {day}: {task}`, `+ Add {day}: {task}`, `→ Move {task} ({from} → {to})`, `◷ Retime {task} ({from} → {to})` — capped at 4 per category with a "Showing the first few of N changes" line. Two buttons: **Apply changes** (primary) and **Keep current plan**, both calling `POST /api/plan/revision`. A footnote reads "Days you've already logged stay exactly as they are" — and that's enforced server-side at apply time, re-merged against the plan's current state so a day finished while the card was open keeps its tasks, statuses, `finished`, and `load_feel`.

**Per-task Edit / Replace / Remove (tier 1):** on any task in a day that isn't `finished` (draft or active alike), hovering — or focusing, for keyboard users — the task card reveals three icons top-right:
- **✎ Edit** — inline fields for task text, **duration**, and **day**. The day is a `<select>` listing every day that isn't already finished, so "this is on the wrong day" and "this should take 30 min not 60" are both fixed in place, with **no AI call and nothing to explain**. Enter or Save commits, Escape or Cancel discards. Changing the day moves the task; changing the duration may trigger the freed-time suggestion.
- **↻ Replace** — a two-step AI-assisted flow in a "Replace with…" panel below the card, never a jump to Discuss with AI:
  1. **Directions.** `POST /api/plan/replace-task` (`mode: "directions"`) reads the task in context (goal, current camp, rest of the week) and returns 2-3 concrete alternative directions as plain buttons, e.g. "Start learning CAD basics" / "Begin a rough CAD model" / "Plan the DIY build workflow". A fixed dashed **"Something else…"** row always sits below them (client-side, not AI-generated) — picking it swaps the panel for a single `What would you rather do?` text input with **Continue** / **Back**, for a direction the user types themselves (e.g. "I want to build it myself, not hire anyone").
  2. **Preview.** Either path calls `mode: "generate"` with the chosen direction, which returns one concrete task (text + duration) shown in a bordered preview card headed "PREVIEW REPLACEMENT" — nothing has changed yet. **"Replace task"** (primary) commits it via `PATCH /api/plan`, scoped to only this one task; **"Back"** returns to the direction list (no re-fetch — the original 2-3 directions are kept) without discarding the panel.
  3. **Multi-task impact.** The `generate` call also flags any *other* task already in the plan that the new direction makes inconsistent (`affected`). If non-empty, confirming the replacement surfaces an amber banner above "Priority This Week": *"This choice also affects N later task(s). Update them too?"* with **Review changes** (calls the same `POST /api/plan/steer` the quick-action chips use, `action: "custom"`, scoped to only the flagged tasks — surfacing as the normal pending-revision card) and **Not now** (dismisses; those tasks are left untouched). The affected tasks are never changed by the replace itself.
- **✕ Remove** — deletes the task immediately.

Remove and a confirmed Replace trigger the one-step undo toast; Edit does not (it's the user's own typed change, not an AI action to second-guess). Each unfinished day also gets a dashed **+ Add task** button that inserts a blank task already in edit mode. All of these autosave via `PATCH /api/plan`.

Single-task changes apply **immediately even on an active week** — Edit and Remove on the click itself, Replace on its explicit "Replace task" confirm (it's still one task, no chat, no whole-plan rewrite; it previews because, unlike Edit, the user hasn't already decided the exact replacement text). Routing these through the whole-plan review card would reintroduce exactly the friction direct manipulation exists to remove. Only whole-week AI rewrites — and the optional multi-task follow-up from Replace's impact banner — use the revision gate.

The hover icon row is absolutely positioned over the card's top-right corner with a white backdrop, and reserves no layout space — an earlier version padded every task permanently, which squeezed long task text into a narrow column on the 7-column grid.

**Daily check-in flow** (active weeks only — none of this renders while the plan is still a draft):
- Every task in a non-rest day card has one compact "Status ▾" button; clicking it opens a small dropdown menu below it — "✓ Done" (forest), "✗ Missed" (summit red), and "↺ Clear" (only when a status is set; resets to neutral) — with click-outside to close. After picking, the button shows the chosen state in its color (still clickable to change until the day is finished). Selections persist immediately via `PATCH /api/plan` (statuses live inside the plan JSON).
- Today's card (matched by weekday name) is highlighted (forest border + ring) with a "TODAY" badge and a "Finish today" button.
- "Finish today" → one-tap load question ("Today's load felt: lighter / about right / heavier than planned", skippable). Then: unlabeled tasks are marked missed, the day is locked (`finished: true`), and one log is written via `POST /api/track-progress` (`data.source: "daily_checkin"` with completed/missed lists + load_feel).
- If nothing was missed (and load wasn't "heavier") → footer shows "✓ Day complete — nice climbing", no conversation. If tasks were missed OR the load felt heavier → the `MiniGuideChat` panel opens on the same page (no navigation): the guide auto-creates a "Daily check-in — {day}" chat and asks what got in the way (one question at a time; on a clean-but-heavy day, one light "which task ran long?" question instead), stores reasons as memories, and can propose a plan adjustment.
- Schedule grid always shows all 7 day columns (Mon–Sun, `lg:grid-cols-7`), centered day name at top (+ inline TODAY badge). Days without planned tasks show a muted "No task today" mini-card; rest days show the rest task in the same muted style. Each task renders as its own bordered mini-card (rounded-xl): priority dot + task text on top, bottom row = status control (left) + duration (right). No strikethrough on done tasks — the tag carries the state.
- **Before-this-plan columns:** a day whose calendar date falls before `plan.plan_start_date` (set when the plan was generated mid-week — see AGENTS.md's Planning Agent) renders as a distinct fourth state, checked before all the logic below: dashed stone border, `bg-stone-50/60`, day label in `text-stone-300`, no pill, no tasks, no add-task button, no check-in controls of any kind — just centered muted text reading **"Before this plan"**. This holds whether the plan is a draft or already active, and regardless of week navigation; it never shows "Not logged" or any other status, since these days were never part of this plan and are not evidence of anything. A plan generated exactly on its Monday (or any full week planned ahead) has no such columns at all.
- Day status pill, centered under each day name: "✓ Day complete" (forest tint — when finished, or a rest/no-task day that has arrived/passed), "In progress" (amber — today, unfinished), "Upcoming" (muted — future days), "Not logged" (muted — past days with tasks never checked in, and on/after `plan_start_date`).
- On finished non-rest days (today or past) the pill is interactive: "✓ Day complete ▾" opens a dropdown with "✓ Day complete" (keep) and "↺ Relog day" — relogging unlocks the day's task statuses for re-choosing, then the day is closed again via "Finish today" (today) or "Log this day" (past). There is no separate "Reopen day" link.
- Past unfinished days show a bordered "Log this day" button: closes the day quietly — unlabeled tasks become missed, one progress log is written, but no load-feel question and no guide chat (catch-up shouldn't trigger an interrogation).
- Finished days render read-only status tags. Today's finished card shows a subtle "Reopen" link next to "✓ Day complete" — it unlocks the day (clears `finished` + `load_feel`, keeps task statuses) so statuses can be corrected and the day re-finished. Re-finishing writes an additional progress log; earlier logs are not removed.

**Changing the plan:** the primary path is the quick-action row and per-task Edit/Replace/Skip described above — no chat round-trip. "Discuss with AI" (the demoted text link) remains for changes that need explaining rather than reacting to: it opens `MiniGuideChat` in plan-talk mode with a summary of the current week *and its `plan_id`*; the guide asks what to change, then its `propose_plan` action calls `POST /api/plan/steer` with `action: "custom"`. Because that's the same endpoint the chips use, a guide-driven change to an already-started week also becomes a reviewable revision instead of overwriting the live plan. The chat's confirmation note reflects which happened ("I've put together suggested changes — review them on the schedule" vs "✓ Your draft is updated"), and the schedule refreshes live (`refreshKey` prop bumped by the overview page).

**Week rollover:** auto-reflection runs server-side inside `POST /api/plan` — if the previous *active* plan has no reflection newer than it, the Reflection Agent runs first (best-effort), so every plan-generation path learns from the finished week before proposing the next one. The generated week then arrives as a draft with its "What changed" summary. There is no scheduler in this project, so the rollover chain is triggered by the user generating the week rather than firing automatically.

### ~~`ProgressTracker`~~ (removed)

The manual "+ Log Progress" form is gone. Progress logging now happens automatically through the daily check-in in `PlanView` (one log per finished day) and silently via the Guide Agent's `log_progress` action when the user describes activity in chat.

### `MiniGuideChat`

Docked chat panel on the Mountain Overview page — the guide "comes to the user" instead of forcing a jump to the AI Guide page. Two modes, passed as a `context` prop:
- `daily_review` — opened by the daily check-in (missed tasks or heavier load); guide asks what got in the way
- `plan_talk` — opened by the "Discuss plan with AI" button; guide receives a summary of the current week, asks what to change, and its `propose_plan` action regenerates the plan **inline** (POST `/api/plan` from the panel), fires `onPlanUpdated` so the schedule refreshes behind the chat, and shows a "✓ plan updated" note bubble. `advance_milestone` still defers to the full AI Guide via the proposal button.

- Fixed bottom-right, 360×480, rounded-2xl, deep layered shadow, z-50
- Header (muted `#F6F6F6`): forest circle guide icon + "Your guide" + "Daily check-in — {day}" subtitle + **expand icon** (top-right, arrows-out → navigates to `/guide?mountain_id=…&chat_id=…`, which auto-opens the same conversation) + close (×)
- On open: creates a real `guide_chats` row ("Daily check-in — {day}") and sends the day summary with `initial_context`, so the AI speaks first; the full history is visible later in the AI Guide
- Messages: user bubbles forest-700/white right-aligned, AI bubbles `#F4F1EA` left-aligned; typing indicator (3 bouncing dots); up to 3 suggested-reply chips
- `propose_plan` / `advance_milestone` actions render as a "Your guide has a proposal — review it in the AI Guide →" button (complex action cards live only in the full guide)
- Connection failure → friendly fallback bubble; input disabled
- While a reply is pending, the send arrow becomes a **stop button** (square icon) — aborts the request, and the API route forwards the abort signal to OpenAI, so a stopped reply is truly cancelled and never written to chat history. Same control exists in the full AI Guide composer.

### ~~`ReflectionView`~~ (removed)

The manual weekly reflection form is gone. Reflection now runs automatically: `PlanView` calls `POST /api/reflect { auto: true }` before generating a new week's plan, and shows the result as a "Week in Review" card. See `PlanView`.

### `CreateMountainModal`

Two-view modal:

**Chat view (default):**
- Header with mountain icon + "Mountain Generator" eyebrow
- Message list (user + AI bubbles) + bouncing dots while sending
- Two-step generation progress indicator (Research → Generate)
- Input field at bottom
- "Generate Mountain" button appears when `goalData` is confirmed

**About Your Plan view (after generation):**
- Header: "About Your Plan" eyebrow + goal title + summit
- Scrollable body with two sections:
  1. What the Research Agent Found: proven stages (numbered), skills (tag chips), pitfalls (warning icons)
  2. Your Mountain: full milestone list — uniform rows (forest bg, numbered), summit (gold star)
- Footer: "Start Climbing →" (navigates to `/mountain?id=`) + "Close" button

---

## Patterns

### Page Headers (plain text — header cards are retired)

Every main page opens with the same plain-text header on the page background (no card, no icon tile, no eyebrow):

```
flex px-1 md:flex-row md:items-center md:justify-between
  └── Left: h2 page title (text-3xl font-bold text-forest-950)
           + subtitle (text-base font-semibold text-stone-800)
           + optional description (sm, stone-500)
  └── Right: CTA button or dropdown selector
```

Current titles: "My Mountains", "Mountain Overview", "Insights", "Memory Profile", "AI Guide", "Settings". The page title is always larger than the goal/subtitle.

### Eyebrow Labels

Appear above section headings throughout the app:
```
text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600
```

### Progress Bars

```
h-2 rounded-full bg-white ring-1 ring-black/5 (track)
  └── h-full rounded-full bg-forest-600 (fill, width = progress%)
```

### Pill / Tag chips

```
rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-forest-100 text-forest-700
```

### Primary CTA Button

```
bg-forest-700 text-white font-semibold rounded-xl px-5 py-3 text-sm
hover:bg-forest-600
active:scale-[0.97] or active:scale-[0.98]
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500
transition-colors duration-200
box-shadow: 0 2px 8px rgba(20,60,35,0.2)
```

### Secondary / Ghost Button

```
bg-white border border-forest-200 text-forest-800 font-semibold rounded-xl px-5 py-3 text-sm
hover:bg-forest-50 hover:border-forest-300
active:scale-[0.97]
transition-colors duration-200
box-shadow: 0 1px 3px rgba(20,60,35,0.06)
```

### Loading Spinner

```
w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin
```

### Icon Container (header cards)

```
flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100
box-shadow: 0 8px 18px rgba(30,82,53,0.08)
```

---

## Responsive Strategy

- Mobile-first using Tailwind breakpoints
- `sm:` — 2-column grids (640px+)
- `md:` — side-by-side header card layouts (768px+)
- `lg:` — 3-column mountain grid, 2-column profile cards (1024px+)
- Max content width: `max-w-[1180px] mx-auto` on all pages
- Modals: `max-w-lg` (chat view) or `max-w-2xl` (About Your Plan) with `mx-4`
