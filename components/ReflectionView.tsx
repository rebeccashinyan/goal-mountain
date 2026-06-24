"use client";

import { useEffect, useState, useCallback } from "react";

interface Blocker {
  blocker: string;
  frequency: number;
  suggestion: string;
}

interface ReflectionData {
  id: string;
  week_start: string;
  summary: string;
  lessons_learned: string[];
  blockers: Blocker[];
  adjustments: string[];
  what_worked?: string[];
  what_failed?: string[];
  motivation_insight?: string;
  created_at: string;
}

interface PastReflection {
  id: string;
  week_start: string;
  summary: string;
  created_at: string;
}

const cardShadow = "0 1px 4px rgba(20,60,35,0.04)";

export default function ReflectionView({
  mountainId,
}: {
  mountainId: string;
}) {
  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [pastReflections, setPastReflections] = useState<PastReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [weeklyProgress, setWeeklyProgress] = useState("");
  const [missedWorkouts, setMissedWorkouts] = useState("");
  const [obstacles, setObstacles] = useState("");
  const [feedback, setFeedback] = useState("");
  const [energyLevel, setEnergyLevel] = useState(3);
  const [motivationLevel, setMotivationLevel] = useState(3);

  const fetchReflections = useCallback(async () => {
    const res = await fetch(`/api/reflect?mountain_id=${mountainId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.length) {
        setReflection(data[0]);
        setPastReflections(data.slice(1, 5));
      }
    }
    setLoading(false);
  }, [mountainId]);

  useEffect(() => {
    fetchReflections();
  }, [fetchReflections]);

  function resetForm() {
    setWeeklyProgress("");
    setMissedWorkouts("");
    setObstacles("");
    setFeedback("");
    setEnergyLevel(3);
    setMotivationLevel(3);
    setShowForm(false);
  }

  async function submitReflection() {
    if (submitting) return;
    setSubmitting(true);

    const res = await fetch("/api/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mountain_id: mountainId,
        user_input: {
          weekly_progress: weeklyProgress,
          missed_workouts: missedWorkouts,
          energy_level: energyLevel,
          motivation_level: motivationLevel,
          obstacles,
          feedback,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (reflection) {
        setPastReflections((prev) => [reflection, ...prev].slice(0, 4));
      }
      setReflection(data);
      resetForm();
    }

    setSubmitting(false);
  }

  const inputClasses =
    "w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200";

  if (loading) {
    return (
      <div className="mt-10 text-center">
        <div className="w-6 h-6 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-400 mt-2">Loading reflections...</p>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">
          Weekly Reflection
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
          style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
          type="button"
        >
          {showForm ? "Cancel" : reflection ? "New Reflection" : "Reflect"}
        </button>
      </div>

      {/* Reflection Form */}
      {showForm && (
        <div
          className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-sm text-stone-600 leading-relaxed">
            Take a few minutes to look back on your week. Be honest — this is
            for you, not a grade.
          </p>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              How did this week go?
            </label>
            <textarea
              value={weeklyProgress}
              onChange={(e) => setWeeklyProgress(e.target.value)}
              placeholder="What did you accomplish? What felt good?"
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              What did you miss or skip?
            </label>
            <input
              type="text"
              value={missedWorkouts}
              onChange={(e) => setMissedWorkouts(e.target.value)}
              placeholder="e.g. Skipped Tuesday and Thursday runs"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              What got in the way?
            </label>
            <input
              type="text"
              value={obstacles}
              onChange={(e) => setObstacles(e.target.value)}
              placeholder="e.g. Work deadlines, bad weather, felt tired"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              Anything else on your mind?
            </label>
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. The plan felt too ambitious, want to try mornings"
              className={inputClasses}
            />
          </div>

          {/* Energy + Motivation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                Energy this week
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEnergyLevel(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-200 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                      energyLevel >= n
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
                Motivation this week
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMotivationLevel(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-200 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                      motivationLevel >= n
                        ? "bg-forest-500 text-white"
                        : "bg-white text-stone-400 border border-stone-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={submitReflection}
            disabled={submitting || !weeklyProgress.trim()}
            className="text-sm px-4 py-2 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Reflecting...
              </span>
            ) : (
              "Submit Reflection"
            )}
          </button>
        </div>
      )}

      {/* Latest Reflection */}
      {reflection && !showForm && (
        <div className="space-y-4">
          {/* Summary */}
          <div
            className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
            style={{ boxShadow: cardShadow }}
          >
            <p className="text-xs font-medium text-stone-400 mb-0.5">
              Week of{" "}
              {new Date(reflection.week_start + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" }
              )}
            </p>
            <p className="text-sm text-stone-800 leading-relaxed mt-2">
              {reflection.summary}
            </p>
          </div>

          {/* What Worked + What Failed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reflection.what_worked && reflection.what_worked.length > 0 && (
              <div
                className="bg-forest-50 rounded-2xl p-5 border border-forest-200"
                style={{ boxShadow: cardShadow }}
              >
                <p className="text-xs font-medium text-forest-600 uppercase tracking-wide mb-3">
                  What worked
                </p>
                <ul className="space-y-1.5">
                  {reflection.what_worked.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-forest-900 leading-relaxed flex gap-2"
                    >
                      <span className="text-forest-500 shrink-0">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reflection.what_failed && reflection.what_failed.length > 0 && (
              <div
                className="bg-red-50 rounded-2xl p-5 border border-red-200"
                style={{ boxShadow: cardShadow }}
              >
                <p className="text-xs font-medium text-summit uppercase tracking-wide mb-3">
                  What didn&rsquo;t work
                </p>
                <ul className="space-y-1.5">
                  {reflection.what_failed.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-stone-700 leading-relaxed flex gap-2"
                    >
                      <span className="text-summit shrink-0">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Lessons Learned */}
          {reflection.lessons_learned.length > 0 && (
            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
                Lessons learned
              </p>
              <ul className="space-y-1.5">
                {reflection.lessons_learned.map((lesson, i) => (
                  <li
                    key={i}
                    className="text-sm text-stone-700 leading-relaxed"
                  >
                    {lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blockers */}
          {reflection.blockers.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-stone-700 mb-3">
                Detected Blockers
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reflection.blockers.map((b, i) => (
                  <div
                    key={i}
                    className="bg-stone-50 rounded-2xl p-4 border border-stone-200"
                    style={{ boxShadow: cardShadow }}
                  >
                    <p className="text-sm font-semibold text-stone-800">
                      {b.blocker}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      Seen{" "}
                      <span
                        className={
                          b.frequency >= 3
                            ? "text-summit font-medium"
                            : "text-stone-500"
                        }
                      >
                        {b.frequency}x
                      </span>
                    </p>
                    <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                      {b.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Adjustments */}
          {reflection.adjustments.length > 0 && (
            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
                Suggested adjustments
              </p>
              <ul className="space-y-1.5">
                {reflection.adjustments.map((adj, i) => (
                  <li
                    key={i}
                    className="text-sm text-stone-700 leading-relaxed flex gap-2"
                  >
                    <span className="text-forest-500 shrink-0">→</span>
                    {adj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Motivation Insight */}
          {reflection.motivation_insight && (
            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Motivation insight
              </p>
              <p className="text-sm text-stone-700 leading-relaxed italic">
                {reflection.motivation_insight}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Past Reflections */}
      {pastReflections.length > 0 && !showForm && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-3">
            Past Reflections
          </h3>
          <div className="space-y-2">
            {pastReflections.map((r) => (
              <div
                key={r.id}
                className="bg-stone-50 rounded-xl px-4 py-3 border border-stone-100"
              >
                <p className="text-xs text-stone-400 mb-1">
                  Week of{" "}
                  {new Date(r.week_start + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )}
                </p>
                <p className="text-sm text-stone-600 leading-relaxed line-clamp-2">
                  {r.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!reflection && !showForm && (
        <div
          className="bg-stone-50 rounded-2xl p-8 border border-stone-200 text-center"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-sm text-stone-500">
            No reflections yet. Hit &ldquo;Reflect&rdquo; to review your week
            and get AI insights on what&rsquo;s working.
          </p>
        </div>
      )}
    </div>
  );
}
