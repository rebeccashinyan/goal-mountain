// Shared weekly-plan lifecycle helpers.
//
// A weekly_plans row is either a DRAFT (an AI proposal the user hasn't
// committed to yet) or ACTIVE (the plan they're actually climbing). Only
// active plans count as behavioural evidence — a draft the user never
// started must never be read as "tasks they missed".
//
// Status lives in the plan jsonb (`plan.status`). Rows written before the
// draft lifecycle existed have no status at all; those are legacy active
// plans, so anything that isn't explicitly "draft" is treated as active.

export type PlanStatus = "draft" | "active";

export interface PlanTask {
  task: string;
  duration: string;
  priority: string;
  status?: "done" | "missed";
}

export interface PlanDay {
  day: string;
  tasks: PlanTask[];
  finished?: boolean;
  load_feel?: string;
}

export interface PlanJson {
  schedule?: PlanDay[];
  focus_area?: string;
  difficulty_level?: string;
  status?: PlanStatus;
  what_changed?: string[];
  pending_revision?: PendingRevision;
  // The first calendar date (YYYY-MM-DD) this plan covers. Equal to
  // week_start unless the plan was generated mid-week, in which case it's
  // today's date at generation time — days before it were never part of
  // this plan and must render as "Before this plan", not as missed work.
  plan_start_date?: string;
  // The date (YYYY-MM-DD) "Start this week" was actually pressed — set once,
  // at activation. Days before it are never tracking evidence even though
  // the schedule may once have had tasks there (see POST /api/plan/rebase),
  // and render as "Before you started" rather than missed/not-logged.
  activated_from?: string;
  // What the user told the Planning Agent when this week was generated.
  // Persisted so "Change plan setup" can pre-fill the form with their real
  // answers instead of making them retype what they already said.
  setup?: { available_time?: string; user_constraints?: string };
}

export interface PendingRevision {
  schedule: PlanDay[];
  focus_area?: string;
  priority_recommendation?: string;
  note: string;
  diff: PlanDiff;
  created_at: string;
}

export interface PlanRow {
  id: string;
  mountain_id: string;
  week_start: string;
  plan: PlanJson;
  priority_recommendation: string;
  next_best_action: string;
  strategy_notes: string;
  created_at: string;
}

export function planStatus(plan: PlanJson | null | undefined): PlanStatus {
  return plan?.status === "draft" ? "draft" : "active";
}

export function isActivePlan(row: { plan: PlanJson }): boolean {
  return planStatus(row.plan) === "active";
}

// The effective plan for a week is the newest row for that week_start —
// regenerating a draft leaves the superseded rows behind.
export function effectivePlans(rows: PlanRow[]): PlanRow[] {
  const seen = new Set<string>();
  const out: PlanRow[] = [];
  for (const row of [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
    if (seen.has(row.week_start)) continue;
    seen.add(row.week_start);
    out.push(row);
  }
  return out;
}

// Behavioural history: only weeks the user actually committed to and ran.
export function activeHistory(rows: PlanRow[], limit?: number): PlanRow[] {
  const active = effectivePlans(rows).filter(isActivePlan);
  return limit ? active.slice(0, limit) : active;
}

export const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Durations are free-text from the model ("30 min", "1 hour", "20–25 min",
// "40 min (total)"), so this is deliberately forgiving — it only needs to be
// good enough to tell the user roughly how much time they just freed up.
export function parseDurationMinutes(text?: string): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  let total = 0;
  const hours = t.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hr|hour)/);
  if (hours) total += parseFloat(hours[1]) * 60;
  const mins = t.match(/(\d+)\s*(?:m\b|min)/);
  if (mins) total += parseInt(mins[1], 10);
  if (total) return Math.round(total);
  const bare = t.match(/\d+/);
  return bare ? parseInt(bare[0], 10) : 0;
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export interface PlanDiff {
  added: { day: string; task: string }[];
  removed: { day: string; task: string }[];
  moved: { task: string; from: string; to: string }[];
  retimed: { day: string; task: string; from: string; to: string }[];
}

export function isEmptyDiff(diff: PlanDiff | undefined): boolean {
  if (!diff) return true;
  return !diff.added.length && !diff.removed.length && !diff.moved.length && !diff.retimed.length;
}

// Deterministic diff (never model-generated, so the review card can't
// misreport what will actually happen). Tasks are matched by exact text.
export function diffSchedules(before: PlanDay[], after: PlanDay[]): PlanDiff {
  const index = (schedule: PlanDay[]) => {
    const map = new Map<string, { day: string; duration: string }>();
    for (const day of schedule) {
      for (const task of day.tasks || []) {
        if (!map.has(task.task)) map.set(task.task, { day: day.day, duration: task.duration });
      }
    }
    return map;
  };

  const beforeIdx = index(before);
  const afterIdx = index(after);
  const diff: PlanDiff = { added: [], removed: [], moved: [], retimed: [] };

  for (const [text, b] of beforeIdx) {
    const a = afterIdx.get(text);
    if (!a) {
      diff.removed.push({ day: b.day, task: text });
      continue;
    }
    if (a.day !== b.day) diff.moved.push({ task: text, from: b.day, to: a.day });
    if (a.duration !== b.duration) {
      diff.retimed.push({ day: a.day, task: text, from: b.duration, to: a.duration });
    }
  }

  for (const [text, a] of afterIdx) {
    if (!beforeIdx.has(text)) diff.added.push({ day: a.day, task: text });
  }

  return diff;
}

// Applies a proposed schedule without ever disturbing a day the user has
// already logged — re-checked at apply time, since a day can be finished
// between proposing and applying.
export function mergeKeepingFinished(live: PlanDay[], proposed: PlanDay[]): PlanDay[] {
  return live.map((day) => {
    if (day.finished) return day;
    const next = proposed.find((p) => p.day === day.day);
    return next ? { ...day, tasks: next.tasks } : day;
  });
}
