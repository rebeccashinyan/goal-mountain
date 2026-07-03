"use client";

import { useEffect, useState, useCallback } from "react";

interface ProgressLog {
  id: string;
  log_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

interface ProgressAnalysis {
  progress_percentage: number;
  current_camp: string;
  trend: "ahead" | "on_track" | "behind";
  trend_detail: string;
  risk_signals: string[];
  streak: { current: number; longest: number };
  summary: string;
}

const cardShadow = "0 10px 28px rgba(43, 58, 42, 0.07), 0 1px 2px rgba(43, 58, 42, 0.05)";

const trendStyle: Record<string, { label: string; color: string; bg: string }> =
  {
    ahead: {
      label: "Ahead",
      color: "text-forest-700",
      bg: "bg-forest-50 border-forest-200",
    },
    on_track: {
      label: "On Track",
      color: "text-forest-600",
      bg: "bg-forest-50 border-forest-200",
    },
    behind: {
      label: "Behind",
      color: "text-summit",
      bg: "bg-red-50 border-red-200",
    },
  };

export default function ProgressTracker({
  mountainId,
  onProgressLogged,
}: {
  mountainId: string;
  onProgressLogged?: () => void;
}) {
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [analysis, setAnalysis] = useState<ProgressAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [logType, setLogType] = useState("activity");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [energy, setEnergy] = useState(3);
  const [effort, setEffort] = useState(3);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/track-progress?mountain_id=${mountainId}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data);
    }
    setLoading(false);
  }, [mountainId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, [fetchLogs]);

  function resetForm() {
    setLogType("activity");
    setDescription("");
    setDuration("");
    setEnergy(3);
    setEffort(3);
    setShowForm(false);
  }

  async function submitLog() {
    if (logging) return;
    setLogging(true);

    const logData: Record<string, unknown> = {
      description: description || undefined,
      energy_level: energy,
      effort_level: effort,
    };
    if (duration) logData.duration = duration;

    const res = await fetch("/api/track-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mountain_id: mountainId,
        log_type: logType,
        data: logData,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      setAnalysis(result);
      resetForm();
      fetchLogs();
      onProgressLogged?.();
    }

    setLogging(false);
  }

  const inputClasses =
    "w-full bg-white rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 border border-[#E7E0D7] focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200";

  const logTypes = [
    { value: "activity", label: "Activity" },
    { value: "completed_task", label: "Task Done" },
    { value: "missed_activity", label: "Missed" },
    { value: "milestone_reached", label: "Milestone" },
    { value: "rest_day", label: "Rest Day" },
  ];

  if (loading) {
    return (
      <div className="mt-10 text-center">
        <div className="w-6 h-6 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-400 mt-2">Loading progress...</p>
      </div>
    );
  }

  return (
    <section className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] px-6 py-5 md:flex-row md:items-center md:justify-between" style={{ boxShadow: cardShadow }}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <path d="M5 19H21" stroke="#1E5235" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M7 16L11 12L14 14L20 7" stroke="#1E5235" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="20" cy="7" r="2.5" fill="#E7B85B" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">
              Progress Tracker
            </p>
            <h2 className="mt-1 text-2xl font-bold text-forest-950">Progress</h2>
            <p className="mt-1 text-sm text-stone-500">
              Log what happened so your guide can read the terrain.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-4 py-2 rounded-xl bg-white text-forest-800 font-semibold border border-forest-200 hover:bg-forest-50 hover:border-forest-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
          style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
          type="button"
        >
          {showForm ? "Cancel" : "+ Log Progress"}
        </button>
      </div>

      {/* Log Form */}
      {showForm && (
        <div
          className="rounded-3xl border border-[#E7E0D7] bg-white p-5 space-y-4"
          style={{ boxShadow: cardShadow }}
        >
          {/* Log Type */}
          <div className="flex flex-wrap gap-2">
            {logTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setLogType(t.value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                  logType === t.value
                    ? "bg-forest-700 text-white"
                    : "bg-white text-stone-600 border border-stone-200 hover:border-forest-300 hover:text-forest-700"
                }`}
                style={
                  logType === t.value
                    ? { boxShadow: "0 1px 4px rgba(20,60,35,0.2)" }
                    : undefined
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              What did you do?
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                logType === "missed_activity"
                  ? "e.g. Skipped — too tired after work"
                  : "e.g. Completed draft of chapter 3, Studied for 2 hours"
              }
              className={inputClasses}
            />
          </div>

          {/* Duration */}
          {logType !== "missed_activity" && logType !== "rest_day" && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                Time Spent
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 30 min, 2 hours"
                className={inputClasses}
              />
            </div>
          )}

          {/* Energy + Soreness */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                Energy Level
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEnergy(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-200 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                      energy >= n
                        ? "bg-forest-500 text-white"
                        : "bg-white text-stone-400 border border-stone-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                Effort
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEffort(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-200 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                      effort >= n
                        ? "bg-summit text-white"
                        : "bg-white text-stone-400 border border-stone-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={submitLog}
            disabled={logging}
            className="text-sm px-4 py-2 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
          >
            {logging ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              "Log & Analyze"
            )}
          </button>
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="space-y-4">
          {/* Summary + Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div
              className="lg:col-span-2 rounded-2xl border border-[#E7E0D7] bg-white p-5"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Progress Summary
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {analysis.summary}
              </p>
            </div>

            <div
              className={`rounded-2xl p-5 border ${trendStyle[analysis.trend]?.bg || "bg-stone-50 border-stone-200"}`}
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">
                Trend
              </p>
              <p
                className={`text-2xl font-bold ${trendStyle[analysis.trend]?.color || "text-stone-700"}`}
              >
                {trendStyle[analysis.trend]?.label || analysis.trend}
              </p>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                {analysis.trend_detail}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
                Progress
              </p>
              <p className="text-xl font-bold text-stone-800 mt-1">
                {analysis.progress_percentage}%
              </p>
            </div>
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
                Current Camp
              </p>
              <p className="text-sm font-semibold text-stone-800 mt-1 truncate">
                {analysis.current_camp}
              </p>
            </div>
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
                Current Streak
              </p>
              <p className="text-xl font-bold text-stone-800 mt-1">
                {analysis.streak?.current ?? 0}{" "}
                <span className="text-xs font-normal text-stone-400">days</span>
              </p>
            </div>
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
                Longest Streak
              </p>
              <p className="text-xl font-bold text-stone-800 mt-1">
                {analysis.streak?.longest ?? 0}{" "}
                <span className="text-xs font-normal text-stone-400">days</span>
              </p>
            </div>
          </div>

          {/* Risk Signals */}
          {analysis.risk_signals && analysis.risk_signals.length > 0 && (
            <div
              className="bg-red-50 rounded-2xl p-5 border border-red-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-summit uppercase tracking-wide mb-2">
                Risk Signals
              </p>
              <ul className="space-y-1.5">
                {analysis.risk_signals.map((risk, i) => (
                  <li
                    key={i}
                    className="text-sm text-stone-700 leading-relaxed"
                  >
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-forest-950 mb-3">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {logs.slice(0, 10).map((log) => {
              const data = log.data as Record<string, string>;
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#E7E0D7] bg-white px-4 py-3"
                  style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.04)" }}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      log.log_type === "missed_activity"
                        ? "bg-summit"
                        : log.log_type === "rest_day"
                          ? "bg-stone-300"
                          : "bg-forest-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 truncate">
                      <span className="font-medium capitalize">
                        {log.log_type.replace(/_/g, " ")}
                      </span>
                      {data.description && (
                        <span className="text-stone-500">
                          {" "}
                          — {data.description}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {data.duration && (
                      <span className="text-xs text-stone-500">
                        {data.duration}
                      </span>
                    )}
                    <span className="text-xs text-stone-400">
                      {new Date(log.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysis && logs.length === 0 && !showForm && (
        <div
          className="rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] p-8 text-center"
          style={{ boxShadow: cardShadow }}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <path d="M5 18H21" stroke="#1E5235" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M7 15L11 11L14 13L20 6" stroke="#1E5235" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-base font-semibold text-stone-700">
            No trail notes yet
          </p>
          <p className="mt-1 text-sm text-stone-500">
            No progress logged yet. Hit &ldquo;+ Log Progress&rdquo; to record
            an activity, completed task, or rest day.
          </p>
        </div>
      )}
    </section>
  );
}
