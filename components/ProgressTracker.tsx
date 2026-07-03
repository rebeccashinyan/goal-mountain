"use client";

import { useState } from "react";

type LogType = "activity" | "missed_activity";

const logOptions: { value: LogType; label: string; icon: string }[] = [
  { value: "activity", label: "Did it", icon: "✓" },
  { value: "missed_activity", label: "Missed", icon: "✗" },
];

export default function ProgressTracker({
  mountainId,
  onProgressLogged,
}: {
  mountainId: string;
  onProgressLogged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [logType, setLogType] = useState<LogType>("activity");
  const [description, setDescription] = useState("");
  const [logging, setLogging] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setLogType("activity");
    setDescription("");
    setDone(false);
    setOpen(false);
  }

  async function submit() {
    if (logging) return;
    setLogging(true);

    const res = await fetch("/api/track-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mountain_id: mountainId,
        log_type: logType,
        data: { description: description.trim() || undefined },
      }),
    });

    if (res.ok) {
      setDone(true);
      onProgressLogged?.();
      setTimeout(reset, 1800);
    }

    setLogging(false);
  }

  return (
    <div className="mt-6">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-sm py-2.5 rounded-xl border border-dashed border-forest-300 text-forest-700 font-semibold bg-white hover:bg-forest-50 hover:border-forest-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
        >
          + Log Progress
        </button>
      ) : (
        <div
          className="rounded-2xl border border-[#E7E0D7] bg-white p-4 space-y-3"
          style={{ boxShadow: "0 4px 14px rgba(20,60,35,0.07)" }}
        >
          {done ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-forest-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-100 text-forest-700 text-xs">✓</span>
              Logged
            </div>
          ) : (
            <>
              {/* Type selector */}
              <div className="flex gap-2">
                {logOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLogType(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                      logType === opt.value
                        ? opt.value === "activity"
                          ? "bg-forest-700 text-white"
                          : "bg-summit text-white"
                        : "bg-stone-50 text-stone-500 border border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Description */}
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={
                  logType === "activity"
                    ? "What did you work on? (optional)"
                    : "What got in the way? (optional)"
                }
                className="w-full bg-stone-50 rounded-xl px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
                autoFocus
              />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={logging}
                  className="flex-1 text-sm py-2 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                  style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.18)" }}
                >
                  {logging ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Logging...
                    </span>
                  ) : (
                    "Log"
                  )}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 py-2 text-sm text-stone-400 hover:text-stone-600 active:scale-[0.97] transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
