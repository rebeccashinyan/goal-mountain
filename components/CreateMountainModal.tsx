"use client";

import { useState, useRef, useEffect } from "react";

interface CreateMountainModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateMountainModal({
  open,
  onClose,
  onCreated,
}: CreateMountainModalProps) {
  const [goal, setGoal] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [runningLevel, setRunningLevel] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [constraints, setConstraints] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setGoal("");
      setShowDetails(false);
      setRunningLevel("");
      setRaceDate("");
      setConstraints("");
      setError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const body: Record<string, string> = { goal: goal.trim() };
      if (runningLevel.trim()) body.running_level = runningLevel.trim();
      if (raceDate) body.race_date = raceDate;
      if (constraints.trim()) body.constraints = constraints.trim();

      const res = await fetch("/api/generate-mountain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate mountain");
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inputClasses =
    "w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative bg-white rounded-3xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          boxShadow:
            "0 8px 40px rgba(20,60,35,0.12), 0 2px 8px rgba(20,60,35,0.06)",
        }}
      >
        <h2 className="text-2xl font-bold text-stone-900 mb-2">
          Create a New Mountain
        </h2>
        <p className="text-sm text-stone-500 mb-6">
          What do you want to achieve? Describe your goal, dream, or ambition.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Become an AI Product Designer, Run a marathon, Learn Japanese, Launch a startup..."
            rows={3}
            className={`${inputClasses} rounded-2xl resize-none`}
            disabled={loading}
          />

          {!showDetails && (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="text-sm text-forest-600 hover:text-forest-700 mt-3 font-medium active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            >
              + Add details (optional)
            </button>
          )}

          {showDetails && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                  Current Level
                </label>
                <input
                  type="text"
                  value={runningLevel}
                  onChange={(e) => setRunningLevel(e.target.value)}
                  placeholder="e.g. Beginner, can run 2K comfortably"
                  className={inputClasses}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
                  Target Date
                </label>
                <input
                  type="date"
                  value={raceDate}
                  onChange={(e) => setRaceDate(e.target.value)}
                  className={inputClasses}
                  disabled={loading}
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
                  placeholder="e.g. Only free on weekends, have a knee injury"
                  className={inputClasses}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-summit mt-3">{error}</p>}

          <div className="flex gap-3 mt-6 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-sm px-5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!goal.trim() || loading}
              className="text-sm px-5 py-2.5 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{
                boxShadow: "0 2px 8px rgba(20,60,35,0.2)",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Mountain"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
