"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { DailyReviewContext } from "./MiniGuideChat";
import {
  WEEK_DAYS,
  effectivePlans,
  formatMinutes,
  isActivePlan,
  parseDurationMinutes,
  planStatus,
  type PendingRevision,
} from "@/lib/plans";

type TaskStatus = "done" | "missed";
type SteerAction = "lighter" | "strategy" | "regenerate" | "availability" | "custom";

interface StrategyOption {
  label: string;
  detail: string;
}

interface Task {
  task: string;
  duration: string;
  priority: string;
  status?: TaskStatus;
}

interface DaySchedule {
  day: string;
  tasks: Task[];
  finished?: boolean;
  load_feel?: string;
}

interface PlanData {
  id: string;
  mountain_id: string;
  week_start: string;
  plan: {
    schedule?: DaySchedule[];
    focus_area?: string;
    difficulty_level?: string;
    status?: "draft" | "active";
    what_changed?: string[];
    pending_revision?: PendingRevision;
    plan_start_date?: string;
    activated_from?: string;
  };
  priority_recommendation: string;
  next_best_action: string;
  strategy_notes: string;
  created_at: string;
}

interface ReflectionData {
  id: string;
  summary: string;
  lessons_learned: string[];
  created_at: string;
}

const cardShadow = "0 10px 28px rgba(43, 58, 42, 0.07), 0 1px 2px rgba(43, 58, 42, 0.05)";

const priorityDot: Record<string, string> = {
  high: "bg-summit",
  medium: "bg-amber-400",
  low: "bg-forest-300",
};

const loadFeelOptions: { value: string; label: string }[] = [
  { value: "lighter", label: "Lighter than planned" },
  { value: "about_right", label: "About right" },
  { value: "heavier", label: "Heavier than planned" },
];

const availabilityPresets = ["Less time this week", "About the same", "More time this week"];

const quickActionClasses =
  "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-forest-200 bg-white text-forest-800 hover:bg-forest-50 hover:border-forest-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200";

const taskIconButtonClasses =
  "flex h-5 w-5 items-center justify-center rounded-md text-stone-400 hover:bg-forest-50 hover:text-forest-700 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200";

// Formats using local calendar fields — avoids the UTC-conversion day-shift
// that toISOString() causes in timezones ahead of UTC.
function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOf(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalISODate(d);
}

function addDays(weekStart: string, days: number): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function PlanView({
  mountainId,
  onDailyReview,
  onPlanTalk,
  refreshKey = 0,
  currentMilestoneName,
}: {
  mountainId: string;
  onDailyReview?: (ctx: DailyReviewContext) => void;
  onPlanTalk?: (planSummary: string, planId: string) => void;
  refreshKey?: number;
  currentMilestoneName?: string;
}) {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [viewedWeekStart, setViewedWeekStart] = useState<string | null>(null);
  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [availableTime, setAvailableTime] = useState("");
  const [constraints, setConstraints] = useState("");
  const [finishingDay, setFinishingDay] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [openDayMenu, setOpenDayMenu] = useState<string | null>(null);

  // Quick-action steering (one-click plan reactions above the schedule)
  const [steering, setSteering] = useState<SteerAction | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilityInput, setAvailabilityInput] = useState("");
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // "You freed up N min" — offered after an edit or removal creates slack
  const [freedTime, setFreedTime] = useState<{ day: string; minutes: number } | null>(null);
  const [fillingTime, setFillingTime] = useState(false);

  // Per-task Edit / Replace / Remove
  const [editingTask, setEditingTask] = useState<{ day: string; index: number } | null>(null);
  const [editDraft, setEditDraft] = useState({ task: "", duration: "", day: "" });

  // Replace: a two-step AI-assisted flow — pick a direction (or type one),
  // preview the concrete task it becomes, then confirm. Never applies on
  // click, and never touches any task but this one.
  const [replacingTask, setReplacingTask] = useState<{ day: string; index: number } | null>(null);
  const [replaceStep, setReplaceStep] = useState<"directions" | "custom" | "preview">("directions");
  const [replaceDirections, setReplaceDirections] = useState<string[]>([]);
  const [replaceDirectionsLoading, setReplaceDirectionsLoading] = useState(false);
  const [customDirectionInput, setCustomDirectionInput] = useState("");
  const [generatingReplacement, setGeneratingReplacement] = useState(false);
  const [replacePreview, setReplacePreview] = useState<{
    // The fitted version always keeps the original duration and priority —
    // Replace changes what a task is, never how much time it costs, unless
    // the user explicitly opts into the full version below.
    fitted: { task: string };
    full: { task: string; duration: string } | null;
    duration: string;
    priority: string;
    direction: string;
    affected: { day: string; task: string }[];
    selectedVersion: "fitted" | "full";
  } | null>(null);
  // Set once a replacement is confirmed if it makes other tasks elsewhere
  // in the plan inconsistent — offered as a review, never applied silently.
  const [taskImpact, setTaskImpact] = useState<{
    day: string;
    originalTask: string;
    newTask: string;
    direction: string;
    affected: { day: string; task: string }[];
  } | null>(null);

  // One-step undo for AI steering + skip/replace actions
  const [undoToast, setUndoToast] = useState<{ message: string; previousPlan: PlanData } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [startingWeek, setStartingWeek] = useState(false);
  const [resolvingRevision, setResolvingRevision] = useState(false);

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayWeekStart = mondayOf(new Date());
  const todayISO = toLocalISODate(new Date());

  // One plan per week: regenerating a draft leaves superseded rows behind,
  // so the newest row for a week_start is the one that counts.
  const weekPlans = effectivePlans(plans);
  const plan = viewedWeekStart
    ? weekPlans.find((p) => p.week_start === viewedWeekStart) ?? null
    : null;
  const isCurrentCalendarWeek = viewedWeekStart === todayWeekStart;
  const isWeekInFuture = !!viewedWeekStart && viewedWeekStart > todayWeekStart;
  const isDraft = !!plan && planStatus(plan.plan) === "draft";
  const hasOpenDay = plan?.plan.schedule?.some((d) => !d.finished) ?? false;
  const revision = plan?.plan.pending_revision ?? null;
  const totalDiffCount = revision
    ? revision.diff.removed.length +
      revision.diff.added.length +
      revision.diff.moved.length +
      revision.diff.retimed.length
    : 0;
  const whatChanged = isDraft ? plan?.plan.what_changed ?? [] : [];
  // "First week" only while the user has never actually started one.
  const hasStartedAWeek = weekPlans.some(isActivePlan);

  const weekStarts = weekPlans.map((p) => p.week_start);
  const minWeekStart = weekStarts.length
    ? weekStarts.reduce((a, b) => (a < b ? a : b))
    : todayWeekStart;
  const frontierWeekStart = [...weekStarts, todayWeekStart].reduce((a, b) =>
    a > b ? a : b
  );
  const maxNavigableWeekStart = addDays(frontierWeekStart, 7);
  const canGoPrev = !!viewedWeekStart && plans.length > 0 && viewedWeekStart > minWeekStart;
  const canGoNext = !!viewedWeekStart && viewedWeekStart < maxNavigableWeekStart;

  const fetchPlan = useCallback(async () => {
    const res = await fetch(`/api/plan?mountain_id=${mountainId}`);
    if (res.ok) {
      const data: PlanData[] = await res.json();
      setPlans(data);
    }
    setViewedWeekStart(mondayOf(new Date()));
    setLoading(false);
  }, [mountainId]);

  const fetchReflection = useCallback(async () => {
    const res = await fetch(`/api/reflect?mountain_id=${mountainId}`);
    if (res.ok) {
      const reflections = await res.json();
      if (reflections.length) setReflection(reflections[0]);
    }
  }, [mountainId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPlan();
    fetchReflection();
  }, [fetchPlan, fetchReflection, refreshKey]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  async function generatePlan() {
    if (generating || !viewedWeekStart) return;
    setGenerating(true);

    const body: Record<string, string> = {
      mountain_id: mountainId,
      week_start: viewedWeekStart,
    };
    if (availableTime.trim()) body.available_time = availableTime.trim();
    if (constraints.trim()) body.user_constraints = constraints.trim();

    // Week rollover reflection runs server-side inside POST /api/plan
    // (skipped automatically when planning a week ahead of the real one)
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setPlans((prev) => [data, ...prev]);
      if (isCurrentCalendarWeek) fetchReflection();
    }

    setGenerating(false);
  }

  function startPlanTalk() {
    if (!plan) return;
    const days = plan.plan.schedule
      ?.map((d) => `${d.day}: ${d.tasks.map((t) => `${t.task} (${t.duration})`).join(", ")}`)
      .join(" | ");
    const summary = `Week of ${plan.week_start}. Focus: ${plan.plan.focus_area || "not set"}. Schedule: ${days || "empty"}`.slice(0, 700);
    onPlanTalk?.(summary, plan.id);
  }

  // opts.persistPriority also writes priority_recommendation — needed when
  // restoring a full pre-action snapshot (undo), since steering can change
  // that text alongside the schedule.
  function updatePlanJson(updated: PlanData, opts?: { persistPriority?: boolean }) {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    const body: Record<string, unknown> = { plan_id: updated.id, plan: updated.plan };
    if (opts?.persistPriority) body.priority_recommendation = updated.priority_recommendation;
    fetch("/api/plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function showUndoToast(message: string, previousPlan: PlanData) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, previousPlan });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 8000);
  }

  function undoLastChange() {
    if (!undoToast) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    updatePlanJson(undoToast.previousPlan, { persistPriority: true });
    setUndoToast(null);
  }

  // Whole-plan AI changes. These never land directly — the server returns a
  // proposed revision to preview, on drafts and active weeks alike.
  async function runSteerAction(
    action: SteerAction,
    opts?: { availableTime?: string; instruction?: string }
  ) {
    if (!plan || steering) return;
    setSteering(action);

    try {
      const body: Record<string, unknown> = { plan_id: plan.id, mountain_id: mountainId, action };
      if (opts?.availableTime) body.available_time = opts.availableTime;
      if (opts?.instruction) body.instruction = opts.instruction;

      const res = await fetch("/api/plan/steer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data: PlanData & { note?: string; mode?: string } = await res.json();
        setPlans((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)));
      }
    } finally {
      setSteering(null);
      setAvailabilityOpen(false);
      setAvailabilityInput("");
      setStrategyOpen(false);
      setStrategies([]);
      setMoreOpen(false);
    }
  }

  // "Change strategy" doesn't re-roll the week — it asks what *kind* of
  // change the user wants, in terms of this plan's actual tasks.
  async function openStrategies() {
    if (!plan) return;
    setStrategyOpen(true);
    if (strategies.length || strategiesLoading) return;
    setStrategiesLoading(true);
    try {
      const res = await fetch("/api/plan/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id, mountain_id: mountainId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategies(data.strategies || []);
      }
    } finally {
      setStrategiesLoading(false);
    }
  }

  // Commit the draft — this is the moment tracking becomes possible. If the
  // draft has tasks on days that already passed (started later than its own
  // Monday, or than the day it was generated), the server rescues them —
  // moving necessary tasks forward, dropping optional ones — before
  // activating, in the same call. No separate step, no extra confirmation:
  // "Start this week" always does exactly one thing.
  async function startWeek() {
    if (!plan || startingWeek) return;
    setStartingWeek(true);
    const previousPlan = plan;
    try {
      const res = await fetch("/api/plan/rebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id, mountain_id: mountainId }),
      });
      if (res.ok) {
        const data: PlanData & { rebased?: boolean; moved?: number; removed?: number } = await res.json();
        setPlans((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)));
        if (data.rebased) {
          const parts: string[] = [];
          if (data.moved) parts.push(`${data.moved} task${data.moved === 1 ? "" : "s"} moved`);
          if (data.removed) parts.push(`${data.removed} optional task${data.removed === 1 ? "" : "s"} removed`);
          showUndoToast(
            `Plan adjusted to start today${parts.length ? " · " + parts.join(" · ") : ""}`,
            previousPlan
          );
        }
      }
    } catch {
      // starting is best-effort from the UI's perspective — a failed call
      // just leaves the draft as a draft, nothing to roll back
    }
    setStartingWeek(false);
  }

  async function resolveRevision(decision: "apply" | "discard") {
    if (!plan || resolvingRevision) return;
    setResolvingRevision(true);
    try {
      const res = await fetch("/api/plan/revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id, decision }),
      });
      if (res.ok) {
        const data: PlanData = await res.json();
        setPlans((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)));
      }
    } finally {
      setResolvingRevision(false);
    }
  }

  function startEditTask(dayName: string, index: number, task: Task) {
    setReplacingTask(null);
    setEditingTask({ day: dayName, index });
    setEditDraft({ task: task.task, duration: task.duration, day: dayName });
  }

  // Edits task text, duration AND which day it sits on — all inline, no AI.
  // Shortening a task offers the freed time back to the user.
  function commitEditTask() {
    if (!editingTask || !plan?.plan.schedule) return;
    const { day, index } = editingTask;
    const original = plan.plan.schedule.find((d) => d.day === day)?.tasks[index];
    if (!original) {
      setEditingTask(null);
      return;
    }

    const targetDay = editDraft.day || day;
    const dayIsOpen = !plan.plan.schedule.find((d) => d.day === targetDay)?.finished;
    const moveTo = dayIsOpen ? targetDay : day;
    const updated: Task = {
      ...original,
      task: editDraft.task.trim() || original.task,
      duration: editDraft.duration.trim() || original.duration,
    };

    let schedule = plan.plan.schedule.map((d) =>
      d.day === day ? { ...d, tasks: d.tasks.filter((_, i) => i !== index) } : d
    );
    schedule = schedule.map((d) =>
      d.day === moveTo ? { ...d, tasks: [...d.tasks, updated] } : d
    );

    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });
    setEditingTask(null);

    const freed = parseDurationMinutes(original.duration) - parseDurationMinutes(updated.duration);
    if (moveTo === day && freed >= 10) setFreedTime({ day, minutes: freed });
  }

  function addTask(dayName: string) {
    if (!plan?.plan.schedule) return;
    const schedule = plan.plan.schedule.map((d) =>
      d.day === dayName ? { ...d, tasks: [...d.tasks, { task: "", duration: "30 min", priority: "medium" }] } : d
    );
    const newIndex = (schedule.find((d) => d.day === dayName)?.tasks.length ?? 1) - 1;
    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });
    setReplacingTask(null);
    setEditingTask({ day: dayName, index: newIndex });
    setEditDraft({ task: "", duration: "30 min", day: dayName });
  }

  // Uses the time an edit or removal freed up — one AI-suggested task,
  // inserted inline with undo. Stays in the direct-manipulation tier.
  async function fillFreedTime() {
    if (!plan || !freedTime || fillingTime) return;
    setFillingTime(true);
    const previousPlan = plan;
    try {
      const res = await fetch("/api/plan/fill-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: plan.id,
          mountain_id: mountainId,
          day: freedTime.day,
          minutes: freedTime.minutes,
        }),
      });
      if (res.ok) {
        const { task } = await res.json();
        const schedule = (plan.plan.schedule || []).map((d) =>
          d.day === freedTime.day ? { ...d, tasks: [...d.tasks, task] } : d
        );
        updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });
        showUndoToast(`Added to ${freedTime.day}`, previousPlan);
      }
    } finally {
      setFillingTime(false);
      setFreedTime(null);
    }
  }

  function removeTask(dayName: string, index: number) {
    if (!plan?.plan.schedule) return;
    const previousPlan = plan;
    const removed = plan.plan.schedule.find((d) => d.day === dayName)?.tasks[index];
    const schedule = plan.plan.schedule.map((d) =>
      d.day === dayName ? { ...d, tasks: d.tasks.filter((_, i) => i !== index) } : d
    );
    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });

    if (removed) {
      recordPreference(`Removed the planned task "${removed.task.slice(0, 110)}"`, "task_remove");
      const freed = parseDurationMinutes(removed.duration);
      if (freed >= 10) setFreedTime({ day: dayName, minutes: freed });
    }

    showUndoToast("Task removed", previousPlan);
    setOpenPicker(null);
    setEditingTask(null);
  }

  // Direct-manipulation preference signals. Steering writes its own from the
  // server; these are the ones only the client knows about.
  function recordPreference(content: string, source: string) {
    fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mountain_id: mountainId,
        category: "preference",
        content,
        metadata: { source },
      }),
    }).catch(() => {});
  }

  // Step 1: read the task in context (goal, camp, rest of the week) and
  // propose 2-3 concrete alternative directions — not finished tasks yet.
  async function openReplace(dayName: string, index: number, task: Task) {
    if (!plan) return;
    setEditingTask(null);
    setReplacingTask({ day: dayName, index });
    setReplaceStep("directions");
    setReplaceDirections([]);
    setReplacePreview(null);
    setCustomDirectionInput("");
    setReplaceDirectionsLoading(true);
    try {
      const res = await fetch("/api/plan/replace-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: plan.id,
          mountain_id: mountainId,
          task: { task: task.task, duration: task.duration, priority: task.priority },
          day: dayName,
          mode: "directions",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplaceDirections(data.directions || []);
      }
    } finally {
      setReplaceDirectionsLoading(false);
    }
  }

  // Step 2: turn the chosen direction (AI-suggested or the user's own
  // typed text) into a task that fits the ORIGINAL duration and priority —
  // Replace changes content, not workload. If the direction genuinely
  // doesn't compress, the server also proposes a longer "full version",
  // offered but never pre-selected. Nothing is applied until "Replace
  // task" is pressed.
  async function chooseDirection(dayName: string, task: Task, direction: string) {
    if (!plan || generatingReplacement) return;
    setGeneratingReplacement(true);
    try {
      const res = await fetch("/api/plan/replace-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: plan.id,
          mountain_id: mountainId,
          task: { task: task.task, duration: task.duration, priority: task.priority },
          day: dayName,
          mode: "generate",
          direction,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplacePreview({
          fitted: { task: data.replacement?.task || task.task },
          full: data.fullVersion || null,
          duration: data.replacement?.duration || task.duration,
          priority: data.replacement?.priority || task.priority,
          direction,
          affected: data.affected || [],
          selectedVersion: "fitted",
        });
        setReplaceStep("preview");
      }
    } finally {
      setGeneratingReplacement(false);
    }
  }

  function submitCustomDirection(dayName: string, task: Task) {
    const text = customDirectionInput.trim();
    if (!text) return;
    chooseDirection(dayName, task, text);
  }

  function closeReplace() {
    setReplacingTask(null);
    setReplaceStep("directions");
    setReplaceDirections([]);
    setReplacePreview(null);
    setCustomDirectionInput("");
  }

  // Step 3: commit the previewed task. Only this one task changes — no
  // other day is touched here, regardless of what "affected" flagged. If
  // the user picked the full version, its own AI-estimated duration is
  // used; otherwise duration and priority are always the original ones.
  function confirmReplace(dayName: string, index: number) {
    if (!plan?.plan.schedule || !replacePreview) return;
    const usingFull = replacePreview.selectedVersion === "full" && replacePreview.full;
    const chosenTask = usingFull ? replacePreview.full!.task : replacePreview.fitted.task;
    const chosenDuration = usingFull ? replacePreview.full!.duration : replacePreview.duration;

    const previousPlan = plan;
    const original = plan.plan.schedule.find((d) => d.day === dayName)?.tasks[index];
    const schedule = plan.plan.schedule.map((d) => {
      if (d.day !== dayName) return d;
      const tasks = d.tasks.map((t, i) =>
        i === index
          ? { task: chosenTask, duration: chosenDuration, priority: replacePreview.priority }
          : t
      );
      return { ...d, tasks };
    });
    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });

    // Which direction they chose is a preference signal worth keeping —
    // it's a real decision between framings of the same work.
    if (original) {
      recordPreference(
        `Swapped the planned task "${original.task.slice(0, 90)}" for "${chosenTask.slice(0, 90)}" — chose to ${replacePreview.direction.slice(0, 80)}${usingFull ? " (opted into the longer full version)" : ""}`,
        "task_replace"
      );
      // Only ever offers freed time back — picking the full (longer)
      // version never triggers it, since nothing was actually freed.
      const freed = parseDurationMinutes(original.duration) - parseDurationMinutes(chosenDuration);
      if (freed >= 10) setFreedTime({ day: dayName, minutes: freed });
    }

    showUndoToast("Task updated", previousPlan);

    // Other tasks the new direction makes inconsistent are only ever
    // offered for review — never changed as a side effect of this replace.
    if (original && replacePreview.affected.length) {
      setTaskImpact({
        day: dayName,
        originalTask: original.task,
        newTask: chosenTask,
        direction: replacePreview.direction,
        affected: replacePreview.affected,
      });
    }

    closeReplace();
  }

  // "Review changes" on the impact banner routes through the same steer
  // endpoint as the quick-action chips, scoped to only the flagged tasks —
  // so it previews as the familiar revision card, never applies blind.
  function reviewTaskImpact() {
    if (!taskImpact) return;
    const instruction = `The user just replaced the task "${taskImpact.originalTask}" with "${taskImpact.newTask}" because they chose to ${taskImpact.direction}. Update ONLY these specific tasks to stay consistent with that change — leave every other task on these days exactly as it is, character for character: ${JSON.stringify(taskImpact.affected)}`;
    runSteerAction("custom", { instruction });
    setTaskImpact(null);
  }

  function setTaskStatus(dayName: string, taskIndex: number, status: TaskStatus | undefined) {
    if (!plan?.plan.schedule) return;
    const schedule = plan.plan.schedule.map((d) => {
      if (d.day !== dayName || d.finished) return d;
      const tasks = d.tasks.map((t, i) => (i === taskIndex ? { ...t, status } : t));
      return { ...d, tasks };
    });
    setOpenPicker(null);
    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });
  }

  function reopenDay(dayName: string) {
    if (!plan?.plan.schedule) return;
    const schedule = plan.plan.schedule.map((d) =>
      d.day === dayName ? { ...d, finished: false, load_feel: undefined } : d
    );
    setOpenDayMenu(null);
    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });
  }

  async function finishDay(dayName: string, loadFeel?: string, quiet = false) {
    if (!plan?.plan.schedule || savingDay) return;
    setSavingDay(true);

    const completed: string[] = [];
    const missed: string[] = [];
    const schedule = plan.plan.schedule.map((d) => {
      if (d.day !== dayName) return d;
      const tasks = d.tasks.map((t) => {
        const status: TaskStatus = t.status === "done" ? "done" : "missed";
        (status === "done" ? completed : missed).push(t.task);
        return { ...t, status };
      });
      return { ...d, tasks, finished: true, load_feel: loadFeel };
    });

    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });

    await fetch("/api/track-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mountain_id: mountainId,
        log_type: completed.length ? "activity" : "missed_activity",
        data: { source: "daily_checkin", day: dayName, completed, missed, load_feel: loadFeel },
      }),
    }).catch(() => {});

    setFinishingDay(null);
    setSavingDay(false);

    // The guide checks in right here on the page: always when something was
    // missed, and also on a clean day that felt heavier than planned.
    // Quiet mode (catching up on past days) never opens the chat.
    if (!quiet && (missed.length || loadFeel === "heavier")) {
      onDailyReview?.({ kind: "daily_review", day: dayName, completed, missed, load_feel: loadFeel });
    }
  }

  if (loading) {
    return (
      <div className="mt-10 text-center">
        <div className="w-6 h-6 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-400 mt-2">Loading plan...</p>
      </div>
    );
  }

  const inputClasses =
    "w-full bg-white rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 border border-[#ECECEC] focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200";

  const reflectionIsFresh =
    reflection &&
    Date.now() - new Date(reflection.created_at).getTime() < 10 * 24 * 60 * 60 * 1000;

  return (
    <section className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-forest-950">
            {isDraft ? (hasStartedAWeek ? "Your next week" : "Your first week") : "Weekly Plan"}
            {isDraft && (
              <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                Draft
              </span>
            )}
          </h2>
          {plans.length > 0 && viewedWeekStart && (
            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous week"
                onClick={() =>
                  setViewedWeekStart((w) => (w ? addDays(w, -7) : w))
                }
                disabled={!canGoPrev}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-forest-50 hover:text-forest-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-400 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
              >
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
                  <path d="M5.25 1L1 5L5.25 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p className="min-w-[86px] text-center text-xs text-stone-400">
                {isCurrentCalendarWeek ? "This week" : `Week of ${formatWeekLabel(viewedWeekStart)}`}
              </p>
              <button
                type="button"
                aria-label="Next week"
                onClick={() =>
                  setViewedWeekStart((w) => (w ? addDays(w, 7) : w))
                }
                disabled={!canGoNext}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-forest-50 hover:text-forest-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-400 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
              >
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
                  <path d="M0.75 1L5 5L0.75 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
          {!plan && (
            <p className="mt-1 text-sm text-stone-500">
              {plans.length === 0
                ? "Turn your current camp into a focused route for the week."
                : isWeekInFuture
                  ? "Get a head start — plan this week now."
                  : isCurrentCalendarWeek
                    ? "Ready to plan this week? Add your available time below."
                    : "No plan was made for this week."}
            </p>
          )}
          {isDraft && (
            <p className="mt-1 text-sm text-stone-500">
              {hasStartedAWeek
                ? "I prepared a starting plan for this week. Adjust anything before you begin."
                : "I made a starting plan based on your goal. Adjust anything before you begin."}
            </p>
          )}
        </div>
        {!plan && (
          <button
            onClick={generatePlan}
            disabled={generating}
            className="text-sm px-4 py-2 rounded-xl bg-white text-forest-800 font-semibold border border-forest-200 hover:bg-forest-50 hover:border-forest-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
            type="button"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-forest-600 rounded-full animate-spin" />
                Planning...
              </span>
            ) : (
              "Generate Plan"
            )}
          </button>
        )}
      </div>

      {/* Form — only for the very first plan; changes go through quick actions or the guide chat */}
      {!plan && !generating && (
        <div
          className="rounded-3xl border border-[#ECECEC] bg-white p-5 space-y-3"
          style={{ boxShadow: cardShadow }}
        >
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              Available time this week
            </label>
            <input
              type="text"
              value={availableTime}
              onChange={(e) => setAvailableTime(e.target.value)}
              placeholder="e.g. 5 hours, weekday evenings + Saturday morning"
              className={inputClasses}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              Constraints
            </label>
            <input
              type="text"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="e.g. Feeling sore, busy on Wednesday"
              className={inputClasses}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={generatePlan}
              disabled={generating}
              className="text-sm px-4 py-2 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
            >
              Generate
            </button>
          </div>
        </div>
      )}

      {plan && (
        <>
          {/* Week in review — written automatically by the Reflection Agent */}
          {reflectionIsFresh && isCurrentCalendarWeek && (
            <div
              className="rounded-2xl border border-[#ECECEC] bg-[#F6F6F6] p-5"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Week in Review
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {reflection.summary}
              </p>
              {reflection.lessons_learned?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {reflection.lessons_learned.slice(0, 3).map((lesson, i) => (
                    <li key={i} className="text-xs text-stone-500 leading-relaxed">
                      · {lesson}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* What changed — how this draft adapted to the week just finished */}
          {whatChanged.length > 0 && (
            <div
              className="rounded-2xl border border-forest-200 bg-forest-50/60 p-5"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-forest-700 uppercase tracking-wide mb-2">
                What changed from last week
              </p>
              <ul className="space-y-1.5">
                {whatChanged.slice(0, 4).map((change, i) => (
                  <li key={i} className="flex gap-2 text-sm text-forest-900 leading-relaxed">
                    <span className="text-forest-500" aria-hidden="true">→</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Proposed revision — an active week is never rewritten without review */}
          {revision && (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-amber-800 uppercase tracking-wide mb-1.5">
                Suggested changes — not applied yet
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">{revision.note}</p>

              <ul className="mt-3 space-y-1">
                {revision.diff.removed.slice(0, 4).map((c, i) => (
                  <li key={`r${i}`} className="flex gap-1.5 text-xs text-stone-600">
                    <span className="shrink-0 font-semibold text-summit">− Remove</span>
                    <span className="shrink-0 text-stone-400">{c.day}:</span>
                    <span className="truncate">{c.task}</span>
                  </li>
                ))}
                {revision.diff.added.slice(0, 4).map((c, i) => (
                  <li key={`a${i}`} className="flex gap-1.5 text-xs text-stone-600">
                    <span className="shrink-0 font-semibold text-forest-700">+ Add</span>
                    <span className="shrink-0 text-stone-400">{c.day}:</span>
                    <span className="truncate">{c.task}</span>
                  </li>
                ))}
                {revision.diff.moved.slice(0, 4).map((c, i) => (
                  <li key={`m${i}`} className="flex gap-1.5 text-xs text-stone-600">
                    <span className="shrink-0 font-semibold text-amber-700">→ Move</span>
                    <span className="truncate">{c.task}</span>
                    <span className="shrink-0 text-stone-400">({c.from} → {c.to})</span>
                  </li>
                ))}
                {revision.diff.retimed.slice(0, 4).map((c, i) => (
                  <li key={`t${i}`} className="flex gap-1.5 text-xs text-stone-600">
                    <span className="shrink-0 font-semibold text-amber-700">◷ Retime</span>
                    <span className="truncate">{c.task}</span>
                    <span className="shrink-0 text-stone-400">({c.from} → {c.to})</span>
                  </li>
                ))}
                {totalDiffCount > 4 && (
                  <li className="pt-0.5 text-[11px] text-stone-500">
                    Showing the first few of {totalDiffCount} changes — apply to see the full week.
                  </li>
                )}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={resolvingRevision}
                  onClick={() => resolveRevision("apply")}
                  className="text-sm px-4 py-2 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                  style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
                >
                  Apply changes
                </button>
                <button
                  type="button"
                  disabled={resolvingRevision}
                  onClick={() => resolveRevision("discard")}
                  className="text-sm px-4 py-2 rounded-xl bg-white text-stone-600 font-semibold border border-stone-200 hover:bg-stone-50 hover:text-stone-800 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                >
                  Keep current plan
                </button>
              </div>
              <p className="mt-2.5 text-[11px] text-stone-500">
                Days you&apos;ve already logged stay exactly as they are.
              </p>
            </div>
          )}

          {/* Quick-action steering — one-click reactions to the plan, no chat required */}
          {hasOpenDay && !revision && (
            <div
              className="rounded-2xl border border-[#ECECEC] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!!steering}
                  onClick={() => runSteerAction("lighter")}
                  className={quickActionClasses}
                >
                  {steering === "lighter" ? (
                    <span className="w-3 h-3 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
                  ) : (
                    "🪶"
                  )}
                  Make it lighter
                </button>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!!steering}
                    onClick={() => (strategyOpen ? setStrategyOpen(false) : openStrategies())}
                    aria-haspopup="dialog"
                    aria-expanded={strategyOpen}
                    className={quickActionClasses}
                  >
                    {steering === "strategy" && (
                      <span className="w-3 h-3 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
                    )}
                    Change strategy
                  </button>
                  {strategyOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setStrategyOpen(false)}
                      />
                      <div
                        role="dialog"
                        className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-[#ECECEC] bg-white p-3 space-y-1.5"
                        style={{ boxShadow: "0 12px 32px rgba(43, 58, 42, 0.14), 0 2px 6px rgba(43, 58, 42, 0.08)" }}
                      >
                        <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">
                          What should change?
                        </p>
                        {strategiesLoading ? (
                          <div className="flex items-center gap-2 py-2">
                            <span className="w-3.5 h-3.5 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
                            <span className="text-xs text-stone-400">Reading your plan...</span>
                          </div>
                        ) : (
                          strategies.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              disabled={!!steering}
                              onClick={() => runSteerAction("strategy", { instruction: s.label })}
                              className="block w-full rounded-lg border border-[#ECECEC] bg-white px-2.5 py-2 text-left hover:border-forest-300 hover:bg-forest-50 disabled:opacity-40 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                            >
                              <span className="block text-xs font-semibold text-forest-800">{s.label}</span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-stone-500">{s.detail}</span>
                            </button>
                          ))
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setStrategyOpen(false);
                            startPlanTalk();
                          }}
                          className="block w-full rounded-lg px-2.5 py-2 text-left text-xs font-medium text-stone-500 hover:bg-stone-50 hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                        >
                          Something else… <span className="text-stone-400">(talk it through)</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!!steering}
                    onClick={() => setAvailabilityOpen((v) => !v)}
                    aria-haspopup="dialog"
                    aria-expanded={availabilityOpen}
                    className={quickActionClasses}
                  >
                    {steering === "availability" && (
                      <span className="w-3 h-3 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
                    )}
                    Change my availability
                  </button>
                  {availabilityOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setAvailabilityOpen(false)}
                      />
                      <div
                        role="dialog"
                        className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-[#ECECEC] bg-white p-3 space-y-2"
                        style={{ boxShadow: "0 12px 32px rgba(43, 58, 42, 0.14), 0 2px 6px rgba(43, 58, 42, 0.08)" }}
                      >
                        <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">
                          Rest of this week...
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {availabilityPresets.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => runSteerAction("availability", { availableTime: preset })}
                              className="text-[11px] font-medium px-2 py-1 rounded-lg border border-stone-200 text-stone-600 hover:border-forest-300 hover:bg-forest-50 hover:text-forest-800 active:scale-[0.97] transition-colors duration-200"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            value={availabilityInput}
                            onChange={(e) => setAvailabilityInput(e.target.value)}
                            placeholder="e.g. 3 hours"
                            className="flex-1 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-[#ECECEC] focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
                          />
                          <button
                            type="button"
                            disabled={!availabilityInput.trim()}
                            onClick={() => runSteerAction("availability", { availableTime: availabilityInput.trim() })}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-forest-700 text-white hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] transition-colors duration-200"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {/* Regenerate is deliberately buried — it re-rolls parts the
                    user may already be happy with. Targeted edits come first. */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={!!steering}
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                    aria-label="More plan options"
                    className="flex h-[34px] w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-400 hover:border-forest-300 hover:text-forest-700 disabled:opacity-40 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                  >
                    {steering === "regenerate" ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-forest-200 border-t-forest-600" />
                    ) : (
                      <span className="text-sm leading-none tracking-widest">···</span>
                    )}
                  </button>
                  {moreOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close menu"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setMoreOpen(false)}
                      />
                      <div
                        role="menu"
                        className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-[#ECECEC] bg-white p-1.5"
                        style={{ boxShadow: "0 12px 32px rgba(43, 58, 42, 0.14), 0 2px 6px rgba(43, 58, 42, 0.08)" }}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => runSteerAction("regenerate")}
                          className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                        >
                          <span className="block text-xs font-semibold text-stone-700">Regenerate the whole week</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-stone-500">
                            Replaces every remaining task, including ones you like.
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startPlanTalk}
                  className="ml-auto text-xs text-stone-400 hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                >
                  Rethinking your approach?{" "}
                  <span className="underline underline-offset-2">Discuss with AI</span>
                </button>
              </div>
            </div>
          )}

          {/* Freed-up time — the contextual follow-on to shortening or
              removing a task, offered rather than auto-filled. */}
          {freedTime && !revision && (
            <div className="flex flex-col gap-3 rounded-2xl border border-forest-200 bg-forest-50/70 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-forest-900">
                You freed up {formatMinutes(freedTime.minutes)} on {freedTime.day}.
                {currentMilestoneName ? ` Want to get ahead on ${currentMilestoneName}?` : " Want to use it?"}
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={fillingTime}
                  onClick={fillFreedTime}
                  className="rounded-xl bg-forest-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                  style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.18)" }}
                >
                  {fillingTime ? "Finding one..." : "+ Add a task"}
                </button>
                <button
                  type="button"
                  disabled={fillingTime}
                  onClick={() => setFreedTime(null)}
                  className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-800 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                >
                  Leave it open
                </button>
              </div>
            </div>
          )}

          {/* A single-task Replace can make other tasks elsewhere in the
              plan inconsistent (e.g. dropping outsourcing tasks after
              choosing to build something yourself). Only ever offered as a
              review — those tasks are never touched by the replace itself. */}
          {taskImpact && !revision && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-stone-700">
                This choice also affects {taskImpact.affected.length}{" "}
                later task{taskImpact.affected.length === 1 ? "" : "s"}. Update{" "}
                {taskImpact.affected.length === 1 ? "it" : "them"} too?
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={!!steering}
                  onClick={reviewTaskImpact}
                  className="rounded-xl bg-forest-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                  style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.18)" }}
                >
                  Review changes
                </button>
                <button
                  type="button"
                  disabled={!!steering}
                  onClick={() => setTaskImpact(null)}
                  className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-800 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {/* Priority */}
          <div
            className="rounded-2xl border border-[#ECECEC] bg-white p-5"
            style={{ boxShadow: cardShadow }}
          >
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
              Priority This Week
            </p>
            <p className="text-sm text-stone-700 leading-relaxed">
              {plan.priority_recommendation}
            </p>
          </div>

          {/* Schedule */}
          {plan.plan.schedule && plan.plan.schedule.length > 0 && (
            <div>
              <h3 className="mb-3 text-xl font-bold text-forest-950">
                Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {WEEK_DAYS.map((dayName) => {
                  const day = plan.plan.schedule?.find((d) => d.day === dayName);

                  // Dates before this plan's own start never had tasks —
                  // never blank/rest, never trackable. Keeps the 7-column
                  // grid without implying the user missed something that
                  // was never asked of them.
                  const columnDate = addDays(plan.week_start, WEEK_DAYS.indexOf(dayName));
                  const isBeforePlanStart =
                    !!plan.plan.plan_start_date && columnDate < plan.plan.plan_start_date;

                  if (isBeforePlanStart) {
                    return (
                      <div
                        key={dayName}
                        className="rounded-2xl p-3 border border-dashed border-stone-200 bg-stone-50/60"
                      >
                        <div className="mb-1.5 flex items-center justify-center gap-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-stone-300">
                            {dayName.slice(0, 3)}
                          </p>
                        </div>
                        <div className="rounded-xl px-2 py-2.5 text-center text-[11px] text-stone-400">
                          Before this plan
                        </div>
                      </div>
                    );
                  }

                  // A day this plan DID schedule tasks for, but that has
                  // already passed while the plan sat unstarted. While
                  // still a draft this is just "today" moving past it —
                  // nothing gets rebased until Start is actually pressed.
                  // Once active, `activated_from` is the permanent record
                  // of that moment, so this stays muted forever rather
                  // than reading as a missed day.
                  const startBoundary = isDraft ? todayISO : plan.plan.activated_from;
                  const isBeforeYouStarted = !!startBoundary && columnDate < startBoundary;

                  if (isBeforeYouStarted) {
                    return (
                      <div
                        key={dayName}
                        className="rounded-2xl p-3 border border-dashed border-stone-200 bg-stone-50/60"
                      >
                        <div className="mb-1.5 flex items-center justify-center gap-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-stone-300">
                            {dayName.slice(0, 3)}
                          </p>
                        </div>
                        <div className="rounded-xl px-2 py-2.5 text-center text-[11px] text-stone-400">
                          Before you started
                        </div>
                      </div>
                    );
                  }

                  const tasks = day?.tasks ?? [];
                  const isRest =
                    !tasks.length ||
                    (tasks.length === 1 &&
                      tasks[0].task.toLowerCase().includes("rest"));
                  const isToday = isCurrentCalendarWeek && dayName === todayName;
                  const canCheckIn = !!day && !isRest && !day.finished && !isDraft;
                  const canEditTasks = !!day && !isRest && !day.finished;
                  const isFuture =
                    isWeekInFuture ||
                    (isCurrentCalendarWeek &&
                      WEEK_DAYS.indexOf(dayName) > WEEK_DAYS.indexOf(todayName));

                  const pill = day?.finished || (isRest && !isFuture)
                    ? { text: "✓ Day complete", cls: "bg-forest-50 text-forest-700" }
                    : isFuture
                      ? { text: "Upcoming", cls: "bg-stone-100 text-stone-400" }
                      : isToday
                        ? { text: "In progress", cls: "bg-amber-50 text-amber-700" }
                        : { text: "Not logged", cls: "bg-stone-100 text-stone-500" };

                  return (
                    <div
                      key={dayName}
                      className={`rounded-2xl p-3 border bg-white ${
                        isToday
                          ? "border-forest-300 ring-2 ring-forest-100"
                          : "border-[#ECECEC]"
                      }`}
                      style={{ boxShadow: isRest ? "none" : cardShadow }}
                    >
                      <div className="mb-1.5 flex items-center justify-center gap-1.5">
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${isRest ? "text-stone-300" : "text-stone-500"}`}
                        >
                          {dayName.slice(0, 3)}
                        </p>
                        {isToday && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-forest-700 bg-forest-50 px-1.5 py-0.5 rounded">
                            Today
                          </span>
                        )}
                      </div>
                      {!isDraft && (
                        <div className="mb-2.5 flex justify-center">
                          {day?.finished && !isRest ? (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenDayMenu(openDayMenu === dayName ? null : dayName)}
                                aria-haspopup="menu"
                                aria-expanded={openDayMenu === dayName}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold hover:ring-1 hover:ring-forest-300 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200 ${pill.cls}`}
                              >
                                {pill.text} ▾
                              </button>
                              {openDayMenu === dayName && (
                                <>
                                  <button
                                    type="button"
                                    aria-label="Close menu"
                                    className="fixed inset-0 z-10 cursor-default"
                                    onClick={() => setOpenDayMenu(null)}
                                  />
                                  <div
                                    role="menu"
                                    className="absolute left-1/2 top-full z-20 mt-1 w-32 -translate-x-1/2 overflow-hidden rounded-xl border border-[#ECECEC] bg-white"
                                    style={{ boxShadow: "0 12px 32px rgba(43, 58, 42, 0.14), 0 2px 6px rgba(43, 58, 42, 0.08)" }}
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => setOpenDayMenu(null)}
                                      className="block w-full border-b border-[#ECECEC] px-3 py-2 text-left text-[11px] font-semibold text-forest-700 bg-forest-50/60 hover:bg-forest-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                                    >
                                      ✓ Day complete
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => reopenDay(dayName)}
                                      className="block w-full px-3 py-2 text-left text-[11px] font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                                    >
                                      ↺ Relog day
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${pill.cls}`}>
                              {pill.text}
                            </span>
                          )}
                        </div>
                      )}
                      {!isRest ? (
                        <div className="space-y-2">
                          {tasks.map((task, i) => {
                            const isEditingThis = editingTask?.day === dayName && editingTask.index === i;
                            const isReplacingThis = replacingTask?.day === dayName && replacingTask.index === i;

                            return (
                              <div key={i}>
                                <div className="group relative rounded-xl border border-[#ECECEC] bg-white p-2.5">
                                  {canEditTasks && !isEditingThis && (
                                    <div
                                      className="absolute right-1 top-1 flex items-center gap-0.5 rounded-lg bg-white/95 pl-1 opacity-0 backdrop-blur-[1px] group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200"
                                      style={{ boxShadow: "0 1px 4px rgba(43,58,42,0.12)" }}
                                    >
                                      <button
                                        type="button"
                                        title="Edit"
                                        aria-label="Edit task"
                                        onClick={() => startEditTask(dayName, i, task)}
                                        className={taskIconButtonClasses}
                                      >
                                        <span className="text-[10px]">✎</span>
                                      </button>
                                      <button
                                        type="button"
                                        title="Replace"
                                        aria-label="Replace task"
                                        onClick={() => openReplace(dayName, i, task)}
                                        className={taskIconButtonClasses}
                                      >
                                        <span className="text-[10px]">↻</span>
                                      </button>
                                      <button
                                        type="button"
                                        title="Remove"
                                        aria-label="Remove task"
                                        onClick={() => removeTask(dayName, i)}
                                        className={`${taskIconButtonClasses} hover:bg-red-50 hover:text-summit`}
                                      >
                                        <span className="text-[10px]">✕</span>
                                      </button>
                                    </div>
                                  )}

                                  {isEditingThis ? (
                                    <div className="space-y-1.5">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editDraft.task}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, task: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") commitEditTask();
                                          if (e.key === "Escape") setEditingTask(null);
                                        }}
                                        placeholder="Task"
                                        className="w-full text-xs font-medium text-stone-700 bg-[#F6F6F6] rounded-lg px-2 py-1.5 border border-forest-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
                                      />
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          value={editDraft.duration}
                                          onChange={(e) => setEditDraft((d) => ({ ...d, duration: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") commitEditTask();
                                            if (e.key === "Escape") setEditingTask(null);
                                          }}
                                          placeholder="Duration"
                                          className="w-[4.5rem] text-[10px] text-stone-500 bg-[#F6F6F6] rounded-lg px-2 py-1 border border-[#ECECEC] focus:outline-none focus:border-forest-400 transition-colors duration-200"
                                        />
                                        {/* Reschedule inline — no AI, no explaining why */}
                                        <select
                                          value={editDraft.day}
                                          onChange={(e) => setEditDraft((d) => ({ ...d, day: e.target.value }))}
                                          aria-label="Day"
                                          className="min-w-0 flex-1 text-[10px] text-stone-500 bg-[#F6F6F6] rounded-lg px-1.5 py-1 border border-[#ECECEC] focus:outline-none focus:border-forest-400 transition-colors duration-200"
                                        >
                                          {WEEK_DAYS.filter(
                                            (d) => !plan.plan.schedule?.find((s) => s.day === d)?.finished
                                          ).map((d) => (
                                            <option key={d} value={d}>
                                              {d.slice(0, 3)}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={commitEditTask}
                                          className="text-[10px] font-semibold px-2 py-1 rounded-md bg-forest-700 text-white hover:bg-forest-600 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingTask(null)}
                                          className="text-[10px] font-medium text-stone-400 hover:text-stone-600 transition-colors duration-200"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-xs font-medium leading-relaxed text-stone-700">
                                        <span
                                          className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${priorityDot[task.priority] || "bg-stone-300"}`}
                                        />
                                        {task.task}
                                      </p>
                                      <div className="mt-2 flex items-center justify-between gap-2">
                                        {day?.finished ? (
                                          task.status ? (
                                            <span
                                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${task.status === "done" ? "bg-forest-50 text-forest-700" : "bg-red-50 text-summit"}`}
                                            >
                                              {task.status === "done" ? "✓ Done" : "✗ Missed"}
                                            </span>
                                          ) : (
                                            <span />
                                          )
                                        ) : canCheckIn ? (
                                          <div className="relative w-fit">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setOpenPicker(openPicker === `${dayName}-${i}` ? null : `${dayName}-${i}`)
                                              }
                                              aria-haspopup="menu"
                                              aria-expanded={openPicker === `${dayName}-${i}`}
                                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border transition-colors duration-200 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 ${
                                                task.status === "done"
                                                  ? "bg-forest-50 border-forest-200 text-forest-700 hover:border-forest-300"
                                                  : task.status === "missed"
                                                    ? "bg-red-50 border-red-200 text-summit hover:border-red-300"
                                                    : "border-stone-200 text-stone-400 hover:border-forest-300 hover:text-forest-700"
                                              }`}
                                            >
                                              {task.status === "done" ? "✓ Done" : task.status === "missed" ? "✗ Missed" : "Status"} ▾
                                            </button>
                                            {openPicker === `${dayName}-${i}` && (
                                              <>
                                                <button
                                                  type="button"
                                                  aria-label="Close menu"
                                                  className="fixed inset-0 z-10 cursor-default"
                                                  onClick={() => setOpenPicker(null)}
                                                />
                                                <div
                                                  role="menu"
                                                  className="absolute left-0 top-full z-20 mt-1 w-28 overflow-hidden rounded-xl border border-[#ECECEC] bg-white"
                                                  style={{ boxShadow: "0 12px 32px rgba(43, 58, 42, 0.14), 0 2px 6px rgba(43, 58, 42, 0.08)" }}
                                                >
                                                  <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => setTaskStatus(dayName, i, "done")}
                                                    className="block w-full border-b border-[#ECECEC] px-3 py-2 text-left text-[11px] font-semibold text-forest-700 hover:bg-forest-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                                                  >
                                                    ✓ Done
                                                  </button>
                                                  <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => setTaskStatus(dayName, i, "missed")}
                                                    className="block w-full px-3 py-2 text-left text-[11px] font-semibold text-summit hover:bg-red-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                                                  >
                                                    ✗ Missed
                                                  </button>
                                                  {task.status && (
                                                    <button
                                                      type="button"
                                                      role="menuitem"
                                                      onClick={() => setTaskStatus(dayName, i, undefined)}
                                                      className="block w-full border-t border-[#ECECEC] px-3 py-2 text-left text-[11px] font-medium text-stone-400 hover:bg-stone-50 hover:text-stone-600 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                                                    >
                                                      ↺ Clear
                                                    </button>
                                                  )}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        ) : (
                                          <span />
                                        )}
                                        <p className="shrink-0 text-[10px] text-stone-400">
                                          {task.duration}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {isReplacingThis && (
                                  <div className="mt-1.5 rounded-xl border border-forest-200 bg-forest-50/60 p-2 space-y-1.5">
                                    <p className="text-[10px] font-semibold text-forest-700 uppercase tracking-wide">
                                      {replaceStep === "preview" ? "Preview replacement" : "Replace with..."}
                                    </p>

                                    {replaceStep === "preview" && replacePreview ? (
                                      <>
                                        <div className="rounded-lg border border-forest-300 bg-white p-2">
                                          <p className="text-[11px] font-medium text-stone-700 leading-relaxed">
                                            {replacePreview.selectedVersion === "full" && replacePreview.full
                                              ? replacePreview.full.task
                                              : replacePreview.fitted.task}
                                          </p>
                                          <p className="mt-1 text-[10px] text-stone-400">
                                            {replacePreview.selectedVersion === "full" && replacePreview.full
                                              ? replacePreview.full.duration
                                              : replacePreview.duration}
                                          </p>
                                        </div>

                                        {replacePreview.full && (
                                          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 space-y-1.5">
                                            <p className="text-[10px] leading-snug text-amber-800">
                                              A full version would take ~{replacePreview.full.duration}.
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setReplacePreview((p) => (p ? { ...p, selectedVersion: "fitted" } : p))
                                                }
                                                className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors duration-200 ${
                                                  replacePreview.selectedVersion === "fitted"
                                                    ? "border-forest-700 bg-forest-700 text-white"
                                                    : "border-stone-200 bg-white text-stone-600 hover:border-forest-300"
                                                }`}
                                              >
                                                Fit into {replacePreview.duration}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setReplacePreview((p) => (p ? { ...p, selectedVersion: "full" } : p))
                                                }
                                                className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors duration-200 ${
                                                  replacePreview.selectedVersion === "full"
                                                    ? "border-forest-700 bg-forest-700 text-white"
                                                    : "border-stone-200 bg-white text-stone-600 hover:border-forest-300"
                                                }`}
                                              >
                                                Use full {replacePreview.full.duration}
                                              </button>
                                            </div>
                                            <p className="text-[10px] text-amber-700">
                                              {(() => {
                                                const otherMin = (day?.tasks || [])
                                                  .filter((_, ti) => ti !== i)
                                                  .reduce((sum, t) => sum + parseDurationMinutes(t.duration), 0);
                                                const total = formatMinutes(
                                                  otherMin + parseDurationMinutes(replacePreview.full.duration)
                                                );
                                                return `Using the full version makes ${dayName} total ${total}.`;
                                              })()}
                                            </p>
                                          </div>
                                        )}

                                        <div className="flex items-center gap-2 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={() => confirmReplace(dayName, i)}
                                            className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-forest-700 text-white hover:bg-forest-600 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                                          >
                                            Replace task
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setReplaceStep("directions")}
                                            className="text-[10px] font-medium text-stone-400 hover:text-stone-600 transition-colors duration-200"
                                          >
                                            Back
                                          </button>
                                        </div>
                                      </>
                                    ) : generatingReplacement ? (
                                      <div className="flex items-center gap-1.5 py-1">
                                        <span className="w-3 h-3 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
                                        <span className="text-[10px] text-stone-400">Thinking...</span>
                                      </div>
                                    ) : replaceStep === "custom" ? (
                                      <div className="space-y-1.5">
                                        <label className="block text-[10px] font-medium text-stone-500">
                                          What would you rather do?
                                        </label>
                                        <input
                                          type="text"
                                          autoFocus
                                          value={customDirectionInput}
                                          onChange={(e) => setCustomDirectionInput(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") submitCustomDirection(dayName, task);
                                            if (e.key === "Escape") setReplaceStep("directions");
                                          }}
                                          placeholder="e.g. I want to build it myself, not hire anyone"
                                          className="w-full text-[11px] bg-white rounded-lg px-2 py-1.5 border border-[#ECECEC] focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
                                        />
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={!customDirectionInput.trim()}
                                            onClick={() => submitCustomDirection(dayName, task)}
                                            className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-forest-700 text-white hover:bg-forest-600 disabled:opacity-40 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                                          >
                                            Continue
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setReplaceStep("directions")}
                                            className="text-[10px] font-medium text-stone-400 hover:text-stone-600 transition-colors duration-200"
                                          >
                                            Back
                                          </button>
                                        </div>
                                      </div>
                                    ) : replaceDirectionsLoading ? (
                                      <div className="flex items-center gap-1.5 py-1">
                                        <span className="w-3 h-3 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
                                        <span className="text-[10px] text-stone-400">Reading this task...</span>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="space-y-1">
                                          {replaceDirections.map((direction, di) => (
                                            <button
                                              key={di}
                                              type="button"
                                              onClick={() => chooseDirection(dayName, task, direction)}
                                              className="block w-full text-left text-[11px] font-medium text-stone-700 bg-white rounded-lg px-2 py-1.5 border border-[#ECECEC] hover:border-forest-300 hover:bg-forest-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                                            >
                                              {direction}
                                            </button>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() => setReplaceStep("custom")}
                                            className="block w-full text-left text-[11px] font-medium text-stone-500 bg-white rounded-lg px-2 py-1.5 border border-dashed border-stone-300 hover:border-forest-300 hover:text-forest-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                                          >
                                            Something else…
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={closeReplace}
                                          className="text-[10px] font-medium text-stone-400 hover:text-stone-600 pt-0.5 transition-colors duration-200"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {canEditTasks && (
                            <button
                              type="button"
                              onClick={() => addTask(dayName)}
                              className="w-full text-[10px] font-semibold text-stone-400 hover:text-forest-700 border border-dashed border-stone-200 hover:border-forest-300 rounded-lg py-1.5 transition-colors duration-200"
                            >
                              + Add task
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-[#ECECEC] bg-[#F6F6F6] px-2 py-2.5 text-center text-[11px] text-stone-400">
                          {tasks.length ? tasks[0].task : "No task today"}
                        </div>
                      )}

                      {/* Day footer: finish flow (not shown while the plan is still a draft) */}
                      {canCheckIn && !isToday && !isFuture && (
                        <button
                          type="button"
                          disabled={savingDay}
                          onClick={() => finishDay(dayName, undefined, true)}
                          className="mt-3 w-full text-[11px] font-semibold px-2 py-1.5 rounded-lg border border-forest-200 text-forest-700 hover:bg-forest-50 hover:border-forest-300 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                        >
                          Log this day
                        </button>
                      )}
                      {canCheckIn && isToday && finishingDay !== dayName && (
                        <button
                          type="button"
                          onClick={() => setFinishingDay(dayName)}
                          className="mt-3 w-full text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-forest-700 text-white hover:bg-forest-600 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                        >
                          Finish today
                        </button>
                      )}
                      {canCheckIn && finishingDay === dayName && (
                        <div className="mt-3 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            Today&apos;s load felt:
                          </p>
                          {loadFeelOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={savingDay}
                              onClick={() => finishDay(dayName, opt.value)}
                              className="w-full text-[11px] font-medium px-2 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:border-forest-300 hover:text-forest-800 hover:bg-forest-50 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={savingDay}
                            onClick={() => finishDay(dayName)}
                            className="w-full text-[11px] text-stone-400 hover:text-stone-600 py-1 disabled:opacity-40 transition-colors duration-200"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Start this week — commits the draft; tracking begins here */}
          {isDraft && (
            <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl border border-forest-200 bg-forest-50 p-4">
              <p className="flex-1 text-sm text-forest-800">
                Nothing is tracked until you start — take as long as you need to adjust it.
              </p>
              <button
                type="button"
                onClick={startWeek}
                disabled={startingWeek}
                className="w-full sm:w-auto text-sm px-5 py-2.5 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
              >
                {startingWeek ? "Starting..." : "Start this week →"}
              </button>
            </div>
          )}
        </>
      )}

      {undoToast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-forest-950 text-white px-4 py-3 text-sm"
          style={{ boxShadow: "0 12px 32px rgba(20,60,35,0.28), 0 2px 8px rgba(20,60,35,0.16)" }}
        >
          <span>{undoToast.message}</span>
          <button
            type="button"
            onClick={undoLastChange}
            className="font-semibold text-forest-200 hover:text-white underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors duration-200"
          >
            Undo
          </button>
        </div>
      )}
    </section>
  );
}
