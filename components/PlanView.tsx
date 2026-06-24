"use client";

import { useEffect, useState, useCallback } from "react";

interface Task {
  task: string;
  duration: string;
  priority: string;
}

interface DaySchedule {
  day: string;
  tasks: Task[];
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

const cardShadow = "0 1px 4px rgba(20,60,35,0.04)";

const priorityDot: Record<string, string> = {
  high: "bg-summit",
  medium: "bg-amber-400",
  low: "bg-forest-300",
};

const difficultyLabel: Record<string, { text: string; color: string }> = {
  easy: { text: "Easy", color: "text-forest-600 bg-forest-50" },
  moderate: { text: "Moderate", color: "text-amber-700 bg-amber-50" },
  challenging: { text: "Challenging", color: "text-summit bg-red-50" },
  intense: { text: "Intense", color: "text-red-700 bg-red-50" },
};

export default function PlanView({ mountainId }: { mountainId: string }) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [availableTime, setAvailableTime] = useState("");
  const [constraints, setConstraints] = useState("");

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

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  async function generatePlan() {
    if (generating) return;
    setGenerating(true);

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

  if (loading) {
    return (
      <div className="mt-10 text-center">
        <div className="w-6 h-6 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-400 mt-2">Loading plan...</p>
      </div>
    );
  }

  const inputClasses =
    "w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200";

  return (
    <div className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-800">Weekly Plan</h2>
          {plan && (
            <p className="text-xs text-stone-400 mt-0.5">
              Week of{" "}
              {new Date(plan.week_start + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" }
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => (plan && !showForm ? setShowForm(true) : generatePlan())}
          disabled={generating}
          className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
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
          className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-3"
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
          {/* Priority + Next Action */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className="bg-forest-50 rounded-2xl p-5 border border-forest-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-forest-600 uppercase tracking-wide mb-2">
                Next Best Action
              </p>
              <p className="text-sm font-semibold text-forest-900 leading-relaxed">
                {plan.next_best_action}
              </p>
            </div>

            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Priority This Week
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {plan.priority_recommendation}
              </p>
            </div>
          </div>

          {/* Schedule */}
          {plan.plan.schedule && plan.plan.schedule.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold text-stone-700">
                  Schedule
                </h3>
                {plan.plan.focus_area && (
                  <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                    Focus: {plan.plan.focus_area}
                  </span>
                )}
                {plan.plan.difficulty_level && (
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md ${difficultyLabel[plan.plan.difficulty_level]?.color || "text-stone-500 bg-stone-100"}`}
                  >
                    {difficultyLabel[plan.plan.difficulty_level]?.text ||
                      plan.plan.difficulty_level}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {plan.plan.schedule.map((day) => {
                  const isRest =
                    !day.tasks.length ||
                    (day.tasks.length === 1 &&
                      day.tasks[0].task.toLowerCase().includes("rest"));

                  return (
                    <div
                      key={day.day}
                      className={`rounded-2xl p-4 border ${isRest ? "bg-stone-50/50 border-stone-100" : "bg-stone-50 border-stone-200"}`}
                      style={{ boxShadow: isRest ? "none" : cardShadow }}
                    >
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide mb-2.5 ${isRest ? "text-stone-300" : "text-stone-500"}`}
                      >
                        {day.day.slice(0, 3)}
                      </p>
                      {day.tasks.length ? (
                        <div className="space-y-2">
                          {day.tasks.map((task, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span
                                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${priorityDot[task.priority] || "bg-stone-300"}`}
                              />
                              <div>
                                <p
                                  className={`text-xs leading-relaxed ${isRest ? "text-stone-400" : "text-stone-700"}`}
                                >
                                  {task.task}
                                </p>
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                  {task.duration}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-300 italic">Rest</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strategy Notes */}
          {plan.strategy_notes && (
            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Strategy
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {plan.strategy_notes}
              </p>
            </div>
          )}

          {/* Adjustments */}
          {plan.adjustments && plan.adjustments.length > 0 && (
            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
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
    </div>
  );
}
