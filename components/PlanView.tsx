"use client";

import { useEffect, useState, useCallback } from "react";
import type { DailyReviewContext } from "./MiniGuideChat";

type TaskStatus = "done" | "missed";

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
  };
  priority_recommendation: string;
  next_best_action: string;
  strategy_notes: string;
  adjustments?: string[];
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

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const loadFeelOptions: { value: string; label: string }[] = [
  { value: "lighter", label: "Lighter than planned" },
  { value: "about_right", label: "About right" },
  { value: "heavier", label: "Heavier than planned" },
];

export default function PlanView({
  mountainId,
  onDailyReview,
}: {
  mountainId: string;
  onDailyReview?: (ctx: DailyReviewContext) => void;
}) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [availableTime, setAvailableTime] = useState("");
  const [constraints, setConstraints] = useState("");
  const [finishingDay, setFinishingDay] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const fetchPlan = useCallback(async () => {
    const res = await fetch(`/api/plan?mountain_id=${mountainId}`);
    if (res.ok) {
      const plans = await res.json();
      if (plans.length) {
        setPlan(plans[0]);
      }
    }
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
  }, [fetchPlan, fetchReflection]);

  async function generatePlan() {
    if (generating) return;
    setGenerating(true);

    // Week rollover: before planning, let the Reflection Agent review the
    // finished week automatically from its data — the planner reads the
    // fresh reflection + memories when building the new week
    if (plan) {
      try {
        await fetch("/api/reflect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mountain_id: mountainId, auto: true }),
        });
        fetchReflection();
      } catch {
        // reflection is best-effort — planning proceeds without it
      }
    }

    const body: Record<string, string> = { mountain_id: mountainId };
    if (availableTime.trim()) body.available_time = availableTime.trim();
    if (constraints.trim()) body.user_constraints = constraints.trim();

    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setPlan(data);
      setShowForm(false);
    }

    setGenerating(false);
  }

  function updatePlanJson(updated: PlanData) {
    setPlan(updated);
    fetch("/api/plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: updated.id, plan: updated.plan }),
    });
  }

  function setTaskStatus(dayName: string, taskIndex: number, status: TaskStatus) {
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
    updatePlanJson({ ...plan, plan: { ...plan.plan, schedule } });
  }

  async function finishDay(dayName: string, loadFeel?: string) {
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
    // missed, and also on a clean day that felt heavier than planned
    if (missed.length || loadFeel === "heavier") {
      onDailyReview?.({ day: dayName, completed, missed, load_feel: loadFeel });
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
    "w-full bg-white rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 border border-[#E7E0D7] focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200";

  const reflectionIsFresh =
    reflection &&
    Date.now() - new Date(reflection.created_at).getTime() < 10 * 24 * 60 * 60 * 1000;

  return (
    <section className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] px-6 py-5 md:flex-row md:items-center md:justify-between" style={{ boxShadow: cardShadow }}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <rect x="5" y="6" width="16" height="15" rx="3" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.5" />
              <path d="M9 11H17M9 15H14" stroke="#1E5235" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M19 3.5L20 6L22.5 7L20 8L19 10.5L18 8L15.5 7L18 6L19 3.5Z" fill="#E7B85B" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-forest-950">Weekly Plan</h2>
          {plan && (
            <p className="text-xs text-stone-400 mt-0.5">
              Week of{" "}
              {new Date(plan.week_start + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" }
              )}
            </p>
          )}
          {!plan && (
            <p className="mt-1 text-sm text-stone-500">
              Turn your current camp into a focused route for the week.
            </p>
          )}
          </div>
        </div>
        <button
          onClick={() => (plan && !showForm ? setShowForm(true) : generatePlan())}
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
          ) : plan ? (
            "New Plan"
          ) : (
            "Generate Plan"
          )}
        </button>
      </div>

      {/* Form */}
      {(showForm || !plan) && !generating && (
        <div
          className="rounded-3xl border border-[#E7E0D7] bg-white p-5 space-y-3"
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
            {plan && (
              <button
                onClick={() => setShowForm(false)}
                className="text-sm px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 active:scale-[0.97] transition-colors duration-200"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {plan && !showForm && (
        <>
          {/* Week in review — written automatically by the Reflection Agent */}
          {reflectionIsFresh && (
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-[#FBF8F1] p-5"
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

          {/* Priority */}
          <div
            className="rounded-2xl border border-[#E7E0D7] bg-white p-5"
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
                  const tasks = day?.tasks ?? [];
                  const isRest =
                    !tasks.length ||
                    (tasks.length === 1 &&
                      tasks[0].task.toLowerCase().includes("rest"));
                  const isToday = dayName === todayName;
                  const canCheckIn = !!day && !isRest && !day.finished;

                  return (
                    <div
                      key={dayName}
                      className={`rounded-2xl p-3 border bg-white ${
                        isToday
                          ? "border-forest-300 ring-2 ring-forest-100"
                          : "border-[#E7E0D7]"
                      }`}
                      style={{ boxShadow: isRest ? "none" : cardShadow }}
                    >
                      <div className="mb-2.5 flex items-center justify-center gap-1.5">
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
                      {!isRest ? (
                        <div className="space-y-2">
                          {tasks.map((task, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-[#E7E0D7] bg-white p-2.5"
                            >
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
                                ) : (
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
                                          className="absolute left-0 top-full z-20 mt-1 w-28 overflow-hidden rounded-xl border border-[#E7E0D7] bg-white"
                                          style={{ boxShadow: "0 12px 32px rgba(43, 58, 42, 0.14), 0 2px 6px rgba(43, 58, 42, 0.08)" }}
                                        >
                                          <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => setTaskStatus(dayName, i, "done")}
                                            className="block w-full border-b border-[#E7E0D7] px-3 py-2 text-left text-[11px] font-semibold text-forest-700 hover:bg-forest-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
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
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                                <p className="shrink-0 text-[10px] text-stone-400">
                                  {task.duration}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-[#E7E0D7] bg-[#FBF8F1] px-2 py-2.5 text-center text-[11px] text-stone-400">
                          {tasks.length ? tasks[0].task : "No task today"}
                        </div>
                      )}

                      {/* Day footer: finish flow */}
                      {day?.finished && !isRest && (
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-forest-700">
                            ✓ Day complete — nice climbing
                          </p>
                          {isToday && (
                            <button
                              type="button"
                              onClick={() => reopenDay(dayName)}
                              className="shrink-0 text-[10px] font-medium text-stone-400 hover:text-forest-700 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
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

          {/* Adjustments */}
          {plan.adjustments && plan.adjustments.length > 0 && (
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-5"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Adjustments from last week
              </p>
              <ul className="space-y-1.5">
                {plan.adjustments.map((adj, i) => (
                  <li
                    key={i}
                    className="text-sm text-stone-600 leading-relaxed"
                  >
                    {adj}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
