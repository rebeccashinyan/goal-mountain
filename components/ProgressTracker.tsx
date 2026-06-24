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

const cardShadow = "0 1px 4px rgba(20,60,35,0.04)";

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

  const [logType, setLogType] = useState("workout");
  const [description, setDescription] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(1);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/track-progress?mountain_id=${mountainId}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data);
    }
    setLoading(false);
  }, [mountainId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function resetForm() {
    setLogType("workout");
    setDescription("");
    setDistance("");
    setDuration("");
    setEnergy(3);
    setSoreness(1);
    setShowForm(false);
  }

  async function submitLog() {
    if (logging) return;
    setLogging(true);

    const logData: Record<string, unknown> = {
      description: description || undefined,
      energy_level: energy,
      soreness_level: soreness,
    };
    if (distance) logData.distance = distance;
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
    "w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200";

  const logTypes = [
    { value: "workout", label: "Workout" },
    { value: "completed_run", label: "Completed Run" },
    { value: "missed_workout", label: "Missed Workout" },
    { value: "milestone_task", label: "Task Done" },
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
    <div className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">Progress</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
          style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
          type="button"
        >
          {showForm ? "Cancel" : "+ Log Progress"}
        </button>
      </div>

      {/* Log Form */}
      {showForm && (
        <div
          className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4"
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
                logType === "missed_workout"
                  ? "e.g. Skipped — too tired after work"
                  : "e.g. Morning 5K run in the park"
              }
              className={inputClasses}
            />
          </div>

          {/* Distance + Duration */}
          {logType !== "missed_workout" && logType !== "rest_day" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                  Distance
                </label>
                <input
                  type="text"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="e.g. 5km"
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                  Duration
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 30 min"
                  className={inputClasses}
                />
              </div>
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
                Soreness
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSoreness(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-200 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                      soreness >= n
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
              className="lg:col-span-2 bg-stone-50 rounded-2xl p-5 border border-stone-200"
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
              className="bg-stone-50 rounded-2xl p-4 border border-stone-200"
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
              className="bg-stone-50 rounded-2xl p-4 border border-stone-200"
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
              className="bg-stone-50 rounded-2xl p-4 border border-stone-200"
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
              className="bg-stone-50 rounded-2xl p-4 border border-stone-200"
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
          <h3 className="text-sm font-semibold text-stone-700 mb-3">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {logs.slice(0, 10).map((log) => {
              const data = log.data as Record<string, string>;
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 bg-stone-50 rounded-xl px-4 py-3 border border-stone-100"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      log.log_type === "missed_workout"
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
                    {data.distance && (
                      <span className="text-xs text-stone-500">
                        {data.distance}
                      </span>
                    )}
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
          className="bg-stone-50 rounded-2xl p-8 border border-stone-200 text-center"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-sm text-stone-500">
            No progress logged yet. Hit &ldquo;+ Log Progress&rdquo; to record
            a workout, completed task, or rest day.
          </p>
        </div>
      )}
    </div>
  );
}
