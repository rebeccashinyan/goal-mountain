"use client";

import { useEffect, useState, useCallback } from "react";

interface UserProfile {
  behavior_patterns: string[];
  motivation_profile: string[];
  training_history_summary: string;
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

const cardShadow = "0 1px 4px rgba(20,60,35,0.04)";

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
    <div className="max-w-[1100px] mx-auto mt-2 space-y-10 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-800">
            What the AI Knows About You
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            Everything Goal Mountain has learned from your journey — this is how
            it personalizes your experience.
          </p>
        </div>

        {mountains.length > 1 && (
          <select
            value={selectedMountain}
            onChange={(e) => setSelectedMountain(e.target.value)}
            className="text-sm bg-white rounded-xl px-4 py-2 border border-stone-200 text-stone-700 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
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
          className="bg-stone-50 rounded-2xl p-5 border border-stone-200 flex items-center justify-between"
          style={{ boxShadow: cardShadow }}
        >
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
              Viewing memories for
            </p>
            <p className="text-sm font-semibold text-stone-800 mt-0.5">
              {currentMountain.goal}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
              Progress
            </p>
            <p className="text-sm font-semibold text-stone-800 mt-0.5">
              {currentMountain.progress}%
            </p>
          </div>
        </div>
      )}

      {/* AI Profile */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-800">
            Your Profile
          </h3>
          <button
            onClick={refreshProfile}
            disabled={profileLoading}
            className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
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
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200 lg:col-span-2"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Journey So Far
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {profile.training_history_summary}
              </p>
            </div>

            {/* Behavior Patterns */}
            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
                Behavior Patterns
              </p>
              {profile.behavior_patterns.length > 0 ? (
                <ul className="space-y-2">
                  {profile.behavior_patterns.map((p, i) => (
                    <li
                      key={i}
                      className="text-sm text-stone-700 leading-relaxed flex gap-2"
                    >
                      <span className="text-amber-500 shrink-0">·</span>
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
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
                Motivation Profile
              </p>
              {profile.motivation_profile.length > 0 ? (
                <ul className="space-y-2">
                  {profile.motivation_profile.map((m, i) => (
                    <li
                      key={i}
                      className="text-sm text-stone-700 leading-relaxed flex gap-2"
                    >
                      <span className="text-forest-500 shrink-0">·</span>
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
                className="bg-forest-50 rounded-2xl p-5 border border-forest-200 lg:col-span-2"
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
            className="bg-stone-50 rounded-2xl p-8 border border-stone-200 text-center"
            style={{ boxShadow: cardShadow }}
          >
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
            <h3 className="text-lg font-semibold text-stone-800">
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
                  className="flex items-start gap-3 bg-stone-50 rounded-xl px-4 py-3 border border-stone-100 group"
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
            className="bg-stone-50 rounded-2xl p-8 border border-stone-200 text-center"
            style={{ boxShadow: cardShadow }}
          >
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
