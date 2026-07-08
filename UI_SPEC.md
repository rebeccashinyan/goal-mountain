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
- Background base: `#FAFAF8`
- Card base: `#FBF8F1`
- Card border: `#E7E0D7`
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

Layered radial gradients applied to `body`:
```css
background:
  radial-gradient(circle at 18% 16%, rgba(208, 236, 221, 0.38), transparent 28rem),
  radial-gradient(circle at 86% 8%, rgba(240, 172, 164, 0.16), transparent 24rem),
  #FAFAF8;
```

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
  (dashboard)/          → Dashboard layout (header + TabNav)
    page.tsx            → /  (My Mountains)
    analysis/page.tsx   → /analysis
    settings/page.tsx   → /settings
  (mountain)/           → Mountain layout (header + MountainDetailNav)
    mountain/page.tsx   → /mountain?id=uuid
    insights/page.tsx   → /insights?id=uuid
  guide/                → Guide layout (adaptive nav via GuideNav client component)
    page.tsx            → /guide?mountain_id=uuid (optional)
```

### Dashboard Layout

- Header: `TabNav` (Mountains | Analysis | AI Guide)
- Max content width: `max-w-[1180px] mx-auto`
- Top padding: `px-6 pt-5 pb-3`
- Main padding: `px-6 pb-10`

### Mountain Layout

- Header: `MountainDetailNav` (Overview | Insights | AI Guide)
- Nav reads `?id=` or `?mountain_id=` from URL
- Same max-width and padding as dashboard

### Guide Layout

- Header nav is adaptive: uses `GuideNav` client component
  - If `?mountain_id=` in URL → renders `MountainDetailNav`
  - Otherwise → renders `TabNav` (dashboard tabs)

---

## Pages

### My Mountains (`/`)

**Purpose:** Dashboard showing all the user's mountains as cards.

**Empty state:** Centered message + "Create Mountain" CTA button.

**Loaded state:**
- Header row: h2 "My Mountains" + "+ Create Mountain" button (right-aligned on desktop)
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`

**Mountain card structure:**
1. Above card: goal title + delete button (top-right, hidden until hover)
2. Card body (rounded-2xl, border, bg-[#FBF8F1]):
   - Header row: "Today" label + "Camp X/Y" pill
   - Current task text (or italic placeholder if empty)
   - `MiniMountain` SVG visualization (h-[150px], rounded inner)
   - Progress bar + right-aligned percentage (no label)
3. Card hover: `-translate-y-1`, border changes to `forest-200`

**Create Mountain Modal:** Triggered by "+ Create Mountain" button. Full modal with chat interface.

---

### Mountain Overview (`/mountain?id=uuid`)

**Purpose:** The main working view for an individual mountain.

**Sections (top to bottom):**

1. **Header card** (rounded-3xl, bg-[#FBF8F1])
   - Left: eyebrow "Mountain Overview" + h2 (goal) + summit description + pills (progress %, current camp)
   - Right: "Discuss With AI" button → `/guide?mountain_id=uuid`

2. **Mountain Visualization** (full-width, rounded-3xl, bg-white, p-3 md:p-5)
   - `MountainViz` component — SVG mountain with milestone markers

3. **This Week's Plan** — `PlanView` component

4. **Progress Tracker** — `ProgressTracker` component

5. **Reflection** — `ReflectionView` component

---

### Insights (`/insights?id=uuid`)

**Purpose:** Research Agent data, behavioral patterns, and strategic analysis for one mountain.

**Sections:**

1. **Header card** — "Research Agent" eyebrow, "Insights for [goal]", description, "Discuss With AI" button

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

1. **Header card** — book icon, "Memory Profile" eyebrow, title, description + mountain selector dropdown (if multiple mountains)

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

**Layout:** Stacked — header card on top, two-column sidebar+chat below. Total height: `calc(100vh - 80px)`.

**Header card** (matches other page header cards: `rounded-3xl bg-[#FBF8F1] px-6 py-5`):
- Compass icon (SVG, h-12 w-12, `bg-white rounded-2xl border border-[#D0ECDD]`)
- "AI COMPASS GUIDE" eyebrow (`text-xs font-semibold uppercase tracking-[0.18em] text-forest-600`)
- "Ask for your next best move" heading (`text-3xl font-bold text-forest-950`)
- Subtitle: `text-sm text-stone-500`
- Context selector dropdown (right, `text-xs uppercase` "CONTEXT" label): "All Mountains" or specific mountain goal — controls which mountain new chats are scoped to

**Sidebar (240px, bg-[#FAFAF8], border-r):**
- "New Chat" button (+ icon, creates a `user_initiated` chat in Supabase)
- Search input (filters both sections by title)
- **"Messages from AI" section** — always visible; shows `ai_proactive` chats with orange unread dot (`#E07A6E`) and last_message preview. If empty: "No messages yet — the AI will reach out if it detects you're off track."
- **"Chats" section** — always visible; shows `user_initiated` chats with title + last_message preview. If empty: "No chats yet. Click 'New Chat' to start."
- Selected chat highlighted with white bg + shadow

**Chat panel (flex-1, bg-white):**
- **Chat header** (border-b): selected chat title + small mountain name pill (forest-50 bg)
- **Messages area** (bg-[#FAFAF8]):
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

Dashboard navigation tabs. Defined tabs: Mountains (`/`), Analysis (`/analysis`), AI Guide (`/guide`).

### `MountainDetailNav`

Mountain-scoped navigation. Reads `?id=` or `?mountain_id=` from URL. Links: Overview (`/mountain?id=`), Insights (`/insights?id=`), AI Guide (`/guide?mountain_id=`).

### `MiniMountain`

Small SVG mountain visualization used on dashboard cards. Props: `progress`, `totalSteps`, `currentStep`.

### `MountainViz`

Full-size SVG "Expedition map" visualization used on the Overview page. Props: `milestones`, `summit`, `currentMilestoneIndex`.

Design (blue expedition-map style):
- Light blue-gray card background (`#F7F9FC`), rounded corners
- Beside the peak flag: "summit:" prefix (bold accent blue) followed by the mountain's summit statement in muted gray, word-wrapped to ~32 chars/line, max 5 lines with ellipsis (the overview header card shows only the goal title, not the summit line)
- Right side: light-blue outlined mountain silhouette with scenery (foothill ridge lines, pine trees, cloud)
- Fixed hand-tuned trail in slate blue (`#4A6E96`) traced from the reference art: long gentle approach from the compass, wide switchbacks mid-mountain, near-vertical final climb onto the peak. Milestone nodes are placed along the trail by arc length, so the trail shape never distorts regardless of milestone count; the last milestone lands on the final bend below the peak
- Node states: upcoming = white with blue stroke, current = amber fill (`#E9B24A`) with bold navy label, completed = blue fill with white center dot; completed segments render darker/thicker (`#2E5075`)
- Labels: thin leader line to a right-aligned short label on the left: `{index+1}. {stage}`, where stage is the milestone name up to the colon (e.g. "4. Camp 2"). Like the reference, labels are skipped where vertical space is tight (< 24px when > 9 milestones) — skipped nodes stay as plain dots; the current milestone is always labeled. Full name + description shown as native tooltip on every node.
- Start point: compass marker (white circle, amber 4-point star) at base camp
- Peak: dark flag pole with amber triangle flag + blue bold "summit" label
- Bottom-left legend: two slate dashes + "Base camp – begin your journey"

### `PlanView`

Weekly plan display for the Overview page. Reads from `GET /api/plan`, can trigger `POST /api/plan` to regenerate. Shows: "Priority This Week" card (full-width), day-by-day schedule with priority dots + difficulty chip, and "Adjustments from last week" when present. (Next best action, strategy notes, and focus area are returned by the API but not displayed.)

### `ProgressTracker`

Minimal inline log form on the Overview page. Collapsed by default — shows only a dashed "+ Log Progress" button. On click, expands to:
- 2 type buttons: "✓ Did it" (green), "✗ Missed" (red)
- Optional description field (placeholder adapts to selected type)
- "Log" + "Cancel" buttons. Enter key submits.
- On success: brief "✓ Logged" confirmation, auto-collapses after 1.8s
- Posts to `POST /api/track-progress`. `onProgressLogged` callback refreshes the parent mountain page (updates header card progress %, MountainViz).
- No analysis output shown here — that belongs on Insights.

### `ReflectionView`

Reflection entry point on the Overview page. Shows last reflection date + 2-line summary. "Open Reflection" / "Start Reflection" button. Full reflection form posts to `POST /api/reflect`.

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
  2. Your Mountain: full milestone list — camps (forest bg + "Camp" badge), checkpoints (white), summit (gold star)
- Footer: "Start Climbing →" (navigates to `/mountain?id=`) + "Close" button

---

## Patterns

### Header Cards

Used at the top of every main page and section. Consistent structure:

```
rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] px-6 py-5
box-shadow: elevated card shadow
  └── Left: icon (h-14 w-14, rounded-2xl, white bg, forest-100 ring)
           + eyebrow label (10px, uppercase, tracking, forest-600)
           + h2 (bold, forest-950)
           + description (sm, stone-500)
  └── Right: CTA button or dropdown selector
```

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
