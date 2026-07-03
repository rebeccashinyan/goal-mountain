"use client";

import { useEffect, useState, useCallback } from "react";

interface UserProfile {
  behavior_patterns: string[];
  motivation_profile: string[];
  journey_history_summary: string;
  personalized_context: string[];
}

interface MemoryEntry {
  id: string;
  mountain_id: string;
  category: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface MountainSummary {
  id: string;
  goal: string;
  progress: number;
}

const cardShadow = "0 10px 28px rgba(43, 58, 42, 0.07), 0 1px 2px rgba(43, 58, 42, 0.05)";

const categoryStyle: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  goal: { label: "Goal", color: "text-forest-700", bg: "bg-forest-50" },
  behavior_pattern: {
    label: "Behavior",
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
  motivation: {
    label: "Motivation",
    color: "text-forest-600",
    bg: "bg-forest-50",
  },
  obstacle: { label: "Obstacle", color: "text-summit", bg: "bg-red-50" },
  preference: {
    label: "Preference",
    color: "text-stone-600",
    bg: "bg-stone-100",
  },
  milestone_context: {
    label: "Milestone",
    color: "text-forest-700",
    bg: "bg-forest-50",
  },
  reflection_insight: {
    label: "Insight",
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
};

export default function AnalysisPage() {
  const [mountains, setMountains] = useState<MountainSummary[]>([]);
  const [selectedMountain, setSelectedMountain] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const fetchMountains = useCallback(async () => {
    const res = await fetch("/api/mountains");
    if (res.ok) {
      const data = await res.json();
      setMountains(data);
      if (data.length) {
        setSelectedMountain(data[0].id);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMountains();
  }, [fetchMountains]);

  const fetchMemories = useCallback(async () => {
    if (!selectedMountain) return;

    const res = await fetch(`/api/memory?mountain_id=${selectedMountain}`);
    if (res.ok) {
      setMemories(await res.json());
    }
  }, [selectedMountain]);

  const fetchProfile = useCallback(async () => {
    if (!selectedMountain) return;
    setProfileLoading(true);

    const res = await fetch(
      `/api/memory/profile?mountain_id=${selectedMountain}`
    );
    if (res.ok) {
      setProfile(await res.json());
    }
    setProfileLoading(false);
  }, [selectedMountain]);

  useEffect(() => {
    if (selectedMountain) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchMemories();
      fetchProfile();
    }
  }, [selectedMountain, fetchMemories, fetchProfile]);

  async function deleteMemory(id: string) {
    const res = await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
    }
  }

  async function refreshProfile() {
    await fetchProfile();
  }

  const filteredMemories =
    filterCategory === "all"
      ? memories
      : memories.filter((m) => m.category === filterCategory);

  const categories = Array.from(new Set(memories.map((m) => m.category)));

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto mt-20 text-center">
        <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-stone-400 mt-3">Loading...</p>
      </div>
    );
  }

  if (!mountains.length) {
    return (
      <div className="max-w-[1100px] mx-auto mt-20 text-center">
        <p className="text-stone-500">
          Create a mountain first to build your profile.
        </p>
      </div>
    );
  }

  const currentMountain = mountains.find((m) => m.id === selectedMountain);

  return (
    <div className="max-w-[1180px] mx-auto mt-8 space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] px-6 py-5 md:flex-row md:items-center md:justify-between" style={{ boxShadow: cardShadow }}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <path d="M8 24V8.5C8 6.6 9.6 5 11.5 5H22V21H11.5C9.6 21 8 22.3 8 24Z" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M12 10H18M12 14H19" stroke="#1E5235" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M20 4.5L21 7L23.5 8L21 9L20 11.5L19 9L16.5 8L19 7L20 4.5Z" fill="#E7B85B" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">
              Memory Profile
            </p>
            <h2 className="mt-1 text-3xl font-bold text-forest-950">
              What the AI knows about you
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              This is the long-term context Goal Mountain uses to personalize guidance, plans, and reflections.
            </p>
          </div>
        </div>

        {mountains.length > 1 && (
          <select
            value={selectedMountain}
            onChange={(e) => setSelectedMountain(e.target.value)}
            className="min-w-[220px] text-sm bg-white rounded-xl px-4 py-3 border border-stone-200 text-stone-700 font-semibold focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
          >
            {mountains.map((m) => (
              <option key={m.id} value={m.id}>
                {m.goal}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Mountain context */}
      {currentMountain && (
        <div
          className="rounded-3xl border border-[#E7E0D7] bg-white p-5"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs text-forest-600 font-semibold uppercase tracking-[0.16em]">
                Viewing memories for
              </p>
              <p className="mt-1 text-lg font-bold text-stone-800">
                {currentMountain.goal}
              </p>
            </div>
            <div className="w-full md:max-w-[260px]">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
                <span>Progress to summit</span>
                <span className="text-forest-800">{currentMountain.progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-stone-100 ring-1 ring-black/5">
                <div
                  className="h-full rounded-full bg-forest-600"
                  style={{ width: `${Math.max(0, Math.min(currentMountain.progress, 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Profile */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-forest-950">
            Your Profile
          </h3>
          <button
            onClick={refreshProfile}
            disabled={profileLoading}
            className="text-sm px-4 py-2 rounded-xl bg-white text-forest-800 font-semibold border border-forest-200 hover:bg-forest-50 hover:border-forest-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
            type="button"
          >
            {profileLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-forest-600 rounded-full animate-spin" />
                Synthesizing...
              </span>
            ) : (
              "Refresh Profile"
            )}
          </button>
        </div>

        {profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Training History */}
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-5 lg:col-span-2"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-semibold text-forest-600 uppercase tracking-[0.14em] mb-2">
                Journey So Far
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {profile.journey_history_summary}
              </p>
            </div>

            {/* Behavior Patterns */}
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-5"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-semibold text-forest-600 uppercase tracking-[0.14em] mb-3">
                Behavior Patterns
              </p>
              {profile.behavior_patterns.length > 0 ? (
                <ul className="space-y-2">
                  {profile.behavior_patterns.map((p, i) => (
                    <li
                      key={i}
                      className="text-sm text-stone-700 leading-relaxed flex gap-2"
                    >
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-400">
                  Not enough data yet — keep logging progress.
                </p>
              )}
            </div>

            {/* Motivation Profile */}
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white p-5"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-semibold text-forest-600 uppercase tracking-[0.14em] mb-3">
                Motivation Profile
              </p>
              {profile.motivation_profile.length > 0 ? (
                <ul className="space-y-2">
                  {profile.motivation_profile.map((m, i) => (
                    <li
                      key={i}
                      className="text-sm text-stone-700 leading-relaxed flex gap-2"
                    >
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-forest-400 shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-400">
                  Complete a few reflections to build your motivation profile.
                </p>
              )}
            </div>

            {/* Personalized Context */}
            {profile.personalized_context.length > 0 && (
              <div
                className="rounded-2xl border border-forest-200 bg-forest-50 p-5 lg:col-span-2"
                style={{ boxShadow: cardShadow }}
              >
                <p className="text-xs font-medium text-forest-600 uppercase tracking-wide mb-3">
                  What other agents know about you
                </p>
                <ul className="space-y-1.5">
                  {profile.personalized_context.map((c, i) => (
                    <li
                      key={i}
                      className="text-sm text-forest-900 leading-relaxed"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] p-8 text-center"
            style={{ boxShadow: cardShadow }}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <path d="M7 20V7.5C7 5.8 8.3 4.5 10 4.5H19V17.5H10C8.3 17.5 7 18.6 7 20Z" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M11 9H16M11 12.5H17" stroke="#1E5235" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-stone-500">
              No profile built yet. Log progress, complete reflections, and
              generate plans — the AI learns from all of it.
            </p>
          </div>
        )}
      </section>

      {/* Stored Memories */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-forest-950">
              Stored Memories
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {memories.length} memories stored
            </p>
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                filterCategory === "all"
                  ? "bg-forest-700 text-white"
                  : "bg-white text-stone-600 border border-stone-200 hover:border-forest-300"
              }`}
            >
              All
            </button>
            {categories.map((cat) => {
              const style = categoryStyle[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                    filterCategory === cat
                      ? "bg-forest-700 text-white"
                      : "bg-white text-stone-600 border border-stone-200 hover:border-forest-300"
                  }`}
                >
                  {style?.label || cat}
                </button>
              );
            })}
          </div>
        )}

        {filteredMemories.length > 0 ? (
          <div className="space-y-2">
            {filteredMemories.map((mem) => {
              const style = categoryStyle[mem.category];
              return (
                <div
                  key={mem.id}
                  className="flex items-start gap-3 rounded-2xl border border-[#E7E0D7] bg-white px-4 py-3 group"
                  style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.04)" }}
                >
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${style?.color || "text-stone-600"} ${style?.bg || "bg-stone-100"}`}
                  >
                    {style?.label || mem.category}
                  </span>
                  <p className="text-sm text-stone-700 leading-relaxed flex-1">
                    {mem.content}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-stone-400">
                      {new Date(mem.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <button
                      onClick={() => deleteMemory(mem.id)}
                      className="text-xs text-stone-300 hover:text-summit opacity-0 group-hover:opacity-100 transition-opacity duration-200 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 focus-visible:opacity-100"
                      type="button"
                      aria-label="Delete memory"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] p-8 text-center"
            style={{ boxShadow: cardShadow }}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <path d="M13 4L15.2 9.8L21 12L15.2 14.2L13 20L10.8 14.2L5 12L10.8 9.8L13 4Z" fill="#E7B85B" stroke="#1E5235" strokeWidth="1.4" />
              </svg>
            </div>
            <p className="text-sm text-stone-500">
              {memories.length > 0
                ? "No memories in this category."
                : "No memories stored yet. The AI stores memories automatically as you log progress, reflect, and generate plans."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
