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

// Monday of the given date's week, as a local-calendar YYYY-MM-DD string.
// Used server-side to find "the plan for the current week" when a caller
// (e.g. the Guide Agent) hasn't named a specific plan_id.
export function isoMondayOf(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    const map = new Map<string, { day: string; duration: string; priority: string }>();
    for (const day of schedule) {
      for (const task of day.tasks || []) {
        if (!map.has(task.task)) map.set(task.task, { day: day.day, duration: task.duration, priority: task.priority });
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
    const durationChanged = a.duration !== b.duration;
    const priorityChanged = a.priority !== b.priority;
    // Duration-only changes keep the plain "30 min → 45 min" text callers
    // already render; a priority change (alone or alongside duration) adds
    // the priority so it isn't silently invisible in the diff.
    if (durationChanged || priorityChanged) {
      const from = priorityChanged ? `${b.duration} (${b.priority})` : b.duration;
      const to = priorityChanged ? `${a.duration} (${a.priority})` : a.duration;
      diff.retimed.push({ day: a.day, task: text, from, to });
    }
  }

  for (const [text, a] of afterIdx) {
    if (!beforeIdx.has(text)) diff.added.push({ day: a.day, task: text });
  }

  return diff;
}

// How many distinct days a diff actually touches — used to tell the user
// "N days affected" without making them count bullet points themselves.
export function diffAffectedDayCount(diff: PlanDiff): number {
  const days = new Set<string>();
  diff.added.forEach((c) => days.add(c.day));
  diff.removed.forEach((c) => days.add(c.day));
  diff.moved.forEach((c) => { days.add(c.from); days.add(c.to); });
  diff.retimed.forEach((c) => days.add(c.day));
  return days.size;
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

// Structured, task-level edits the AI Guide can propose against an existing
// plan — the counterpart to /api/plan/steer's whole-open-days rewrite, for
// requests scoped to one or a few specific tasks ("move Thursday's task to
// Friday", "add a 20-minute task Monday"). Each op names the day and the
// EXACT existing task text it targets (verbatim from the current schedule)
// so it can never be ambiguous which task is meant.
export type PlanOpType = "add" | "remove" | "move" | "update" | "replace";

export interface PlanOperation {
  op: PlanOpType;
  day: string;
  task?: string; // exact existing task text — required for remove/move/update/replace
  to_day?: string; // required for move
  new_task?: string; // required for replace
  duration?: string; // required for add; optional override elsewhere
  priority?: string; // required for add; optional override elsewhere
}

export interface ApplyOperationsResult {
  schedule: PlanDay[];
  errors: string[];
  overCapacityDays: string[];
  affectedDays: string[];
}

// Sanity ceilings, not a precise availability model — this app has no
// machine-parseable "hours per day" input anywhere else either, so these
// exist purely to catch obviously broken output (a 6-hour "quick task", a
// day stacked past a normal working day) rather than to enforce a budget
// the user actually specified.
const MAX_TASK_MINUTES = 240;
const MAX_DAY_MINUTES = 480;

// Deterministic, never model-trusted application of structured plan edits.
// Every op is validated against the CURRENT schedule (open days only, exact
// task-text match) before anything is written — partial success is not an
// option here, so the caller checks `errors` and applies nothing on failure.
export function applyPlanOperations(
  schedule: PlanDay[],
  operations: PlanOperation[]
): ApplyOperationsResult {
  const errors: string[] = [];
  const affectedDays = new Set<string>();
  // A day with no tasks yet (e.g. Wednesday in a Mon/Tue/Thu/Fri plan) is
  // simply absent from `schedule` — still a valid, open target for "add",
  // not a day outside this week. Every weekday gets an entry to operate on;
  // days that stay empty and were never in the original schedule are
  // dropped again at the end so this never pollutes the saved plan with
  // empty placeholder days the rest of the app doesn't expect.
  const originalDayNames = new Set(schedule.map((d) => d.day));
  const days = WEEK_DAYS.map((name) => {
    const existing = schedule.find((d) => d.day === name);
    return existing
      ? { ...existing, tasks: existing.tasks.map((t) => ({ ...t })) }
      : { day: name, tasks: [] };
  });
  const dayMap = new Map(days.map((d) => [d.day, d]));

  const isOpen = (d?: PlanDay) => !!d && !d.finished;
  const findTaskIndex = (d: PlanDay, text: string) => {
    let idx = d.tasks.findIndex((t) => t.task === text);
    if (idx === -1) {
      const needle = text.trim().toLowerCase();
      idx = d.tasks.findIndex((t) => t.task.trim().toLowerCase() === needle);
    }
    return idx;
  };
  const validDuration = (duration: string) => {
    const minutes = parseDurationMinutes(duration);
    return minutes > 0 && minutes <= MAX_TASK_MINUTES ? minutes : null;
  };

  for (const raw of operations || []) {
    const op = raw as PlanOperation;
    if (!op || !op.day || !WEEK_DAYS.includes(op.day)) {
      errors.push(`Unknown day "${op?.day ?? ""}"`);
      continue;
    }
    const day = dayMap.get(op.day);
    if (!day) {
      errors.push(`"${op.day}" is not part of this week's schedule`);
      continue;
    }

    switch (op.op) {
      case "add": {
        if (!isOpen(day)) { errors.push(`${op.day} is already finished — can't add tasks there`); break; }
        const text = op.task?.trim();
        if (!text) { errors.push(`Missing task text to add on ${op.day}`); break; }
        if (!op.duration || validDuration(op.duration) === null) {
          errors.push(`"${text}" needs a valid duration under 4 hours`);
          break;
        }
        if (findTaskIndex(day, text) !== -1) { errors.push(`"${text}" is already on ${op.day}`); break; }
        day.tasks.push({ task: text, duration: op.duration.trim(), priority: op.priority || "medium" });
        affectedDays.add(op.day);
        break;
      }
      case "remove": {
        if (!isOpen(day)) { errors.push(`${op.day} is already finished — can't remove tasks there`); break; }
        const idx = op.task ? findTaskIndex(day, op.task) : -1;
        if (idx === -1) { errors.push(`Couldn't find "${op.task ?? ""}" on ${op.day}`); break; }
        day.tasks.splice(idx, 1);
        affectedDays.add(op.day);
        break;
      }
      case "move": {
        if (!isOpen(day)) { errors.push(`${op.day} is already finished — can't move tasks from it`); break; }
        if (!op.to_day || !WEEK_DAYS.includes(op.to_day)) { errors.push(`"move" needs a valid to_day`); break; }
        if (op.to_day === op.day) { errors.push(`Task is already on ${op.day}`); break; }
        const targetDay = dayMap.get(op.to_day);
        if (!isOpen(targetDay)) { errors.push(`${op.to_day} is already finished — can't move tasks there`); break; }
        const idx = op.task ? findTaskIndex(day, op.task) : -1;
        if (idx === -1) { errors.push(`Couldn't find "${op.task ?? ""}" on ${op.day}`); break; }
        if (findTaskIndex(targetDay!, day.tasks[idx].task) !== -1) {
          errors.push(`"${day.tasks[idx].task}" is already on ${op.to_day}`);
          break;
        }
        const [moved] = day.tasks.splice(idx, 1);
        if (op.duration?.trim()) {
          if (validDuration(op.duration) === null) { errors.push(`"${moved.task}" duration (${op.duration}) is invalid`); break; }
          moved.duration = op.duration.trim();
        }
        if (op.priority) moved.priority = op.priority;
        targetDay!.tasks.push(moved);
        affectedDays.add(op.day);
        affectedDays.add(op.to_day);
        break;
      }
      case "update": {
        if (!isOpen(day)) { errors.push(`${op.day} is already finished — can't edit tasks on it`); break; }
        const idx = op.task ? findTaskIndex(day, op.task) : -1;
        if (idx === -1) { errors.push(`Couldn't find "${op.task ?? ""}" on ${op.day}`); break; }
        if (!op.duration?.trim() && !op.priority) { errors.push(`"update" on "${op.task}" needs a new duration or priority`); break; }
        if (op.duration?.trim()) {
          if (validDuration(op.duration) === null) { errors.push(`"${op.task}" duration (${op.duration}) is invalid`); break; }
          day.tasks[idx].duration = op.duration.trim();
        }
        if (op.priority) day.tasks[idx].priority = op.priority;
        affectedDays.add(op.day);
        break;
      }
      case "replace": {
        if (!isOpen(day)) { errors.push(`${op.day} is already finished — can't edit tasks on it`); break; }
        const idx = op.task ? findTaskIndex(day, op.task) : -1;
        if (idx === -1) { errors.push(`Couldn't find "${op.task ?? ""}" on ${op.day}`); break; }
        const newText = op.new_task?.trim();
        if (!newText) { errors.push(`"replace" on "${op.task}" needs new_task text`); break; }
        if (newText !== op.task && findTaskIndex(day, newText) !== -1) {
          errors.push(`"${newText}" is already on ${op.day}`);
          break;
        }
        const original = day.tasks[idx];
        let duration = original.duration;
        if (op.duration?.trim()) {
          if (validDuration(op.duration) === null) { errors.push(`"${newText}" duration (${op.duration}) is invalid`); break; }
          duration = op.duration.trim();
        }
        day.tasks[idx] = { task: newText, duration, priority: op.priority || original.priority };
        affectedDays.add(op.day);
        break;
      }
      default:
        errors.push(`Unknown operation "${(op as { op?: string })?.op ?? ""}"`);
    }
  }

  const overCapacityDays: string[] = [];
  for (const d of days) {
    const total = d.tasks.reduce((sum, t) => sum + parseDurationMinutes(t.duration), 0);
    if (total > MAX_DAY_MINUTES) overCapacityDays.push(d.day);
  }

  const finalSchedule = days.filter((d) => originalDayNames.has(d.day) || d.tasks.length > 0);

  return { schedule: finalSchedule, errors, overCapacityDays, affectedDays: [...affectedDays] };
}
