"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface Milestone {
  name: string;
  description: string;
  completed: boolean;
  current?: boolean;
}

interface MountainData {
  id: string;
  goal: string;
  summit: string;
  progress: number;
  current_milestone_index: number;
  milestones: Milestone[];
}

interface MemoryEntry {
  category: string;
  content: string;
  created_at: string;
}

interface Blocker {
  blocker: string;
  frequency: number;
  suggestion: string;
}

interface Reflection {
  summary: string;
  blockers: Blocker[];
  lessons_learned: string[];
  week_start: string;
}

interface ProgressLog {
  log_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

interface StrategicIntelligence {
  summit_probability: number;
  consistency_score: number;
  recommended_strategy: { focus: string; reason: string };
  skill_gap_analysis: { goal: string; current_skills: string[]; missing_skills: string[] };
  highest_leverage: { action: string; expected_impact: string; estimated_time: string };
  bottleneck: { findings: string[]; main_bottleneck: string };
  opportunity: { market_trends: string[] };
  trade_off: { available_hours: number; best_option: string; impact: string; risk: string };
  scenario: { current_pace: string; increased_hours: string; stopped: string };
  mentor_insight: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const cardShadow = "0 10px 28px rgba(43, 58, 42, 0.07), 0 1px 2px rgba(43, 58, 42, 0.05)";
const raisedShadow = "0 1px 3px rgba(20,60,35,0.06)";

function computeConsistency(logs: ProgressLog[]): number {
  if (!logs.length) return 0;
  const days = new Set(logs.map((l) => l.created_at.slice(0, 10)));
  const now = new Date();
  let activeDays = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) activeDays++;
  }
  return Math.round((activeDays / 30) * 100);
}

function buildWeek(logs: ProgressLog[]) {
  const activeDates = new Set(logs.map((l) => l.created_at.slice(0, 10)));
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return dayNames.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      day,
      date: d.getDate(),
      active: activeDates.has(d.toISOString().slice(0, 10)),
    };
  });
}

// ── Main content ───────────────────────────────────────────────────────────

function InsightsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mountainId = searchParams.get("id");

  const [mountain, setMountain] = useState<MountainData | null>(null);
  const [allMountains, setAllMountains] = useState<{ id: string; goal: string }[]>([]);

  useEffect(() => {
    fetch("/api/mountains").then(async (res) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (res.ok) setAllMountains(await res.json());
    });
  }, []);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [obstacles, setObstacles] = useState<Blocker[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [intelligence, setIntelligence] = useState<StrategicIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Fetch mountain
    let m: MountainData | null = null;
    if (mountainId) {
      const res = await fetch(`/api/mountains/${mountainId}`);
      if (res.ok) m = await res.json();
    } else {
      const res = await fetch("/api/mountains");
      if (res.ok) {
        const list = await res.json();
        if (list.length) m = list[0];
      }
    }

    if (!m) {
      setLoading(false);
      return;
    }
    setMountain(m);

    // Parallel: memory + reflections + logs
    const [memRes, reflRes, logRes] = await Promise.all([
      fetch(`/api/memory?mountain_id=${m.id}`),
      fetch(`/api/reflect?mountain_id=${m.id}`),
      fetch(`/api/track-progress?mountain_id=${m.id}`),
    ]);

    if (memRes.ok) {
      const memories: MemoryEntry[] = await memRes.json();
      setPatterns(
        memories.filter((x) => x.category === "behavior_pattern").map((x) => x.content)
      );
    }

    if (reflRes.ok) {
      const reflections: Reflection[] = await reflRes.json();
      const blockerMap = new Map<string, Blocker>();
      reflections.forEach((r) => {
        (r.blockers || []).forEach((b) => {
          const key = b.blocker.toLowerCase().slice(0, 30);
          if (blockerMap.has(key)) {
            blockerMap.get(key)!.frequency += b.frequency;
          } else {
            blockerMap.set(key, { ...b });
          }
        });
      });
      const sorted = Array.from(blockerMap.values()).sort(
        (a, b) => b.frequency - a.frequency
      );
      setObstacles(sorted.slice(0, 4));
    }

    if (logRes.ok) {
      setLogs(await logRes.json());
    }

    setLoading(false);
  }, [mountainId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function generateIntelligence() {
    if (!mountain || generating) return;
    setGenerating(true);
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mountain_id: mountain.id }),
    });
    if (res.ok) {
      setIntelligence(await res.json());
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="max-w-[1180px] mx-auto mt-20 text-center">
        <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-stone-400 mt-3">Loading insights...</p>
      </div>
    );
  }

  if (!mountain) {
    return (
      <div className="max-w-[1180px] mx-auto mt-20 text-center">
        <p className="text-stone-500">Create a mountain first to view insights.</p>
      </div>
    );
  }

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];
  const completedCamps = mountain.milestones.filter((m) => m.completed).length;
  const consistency = intelligence?.consistency_score ?? computeConsistency(logs);
  const summitProbability = intelligence?.summit_probability ?? null;
  const weekDays = buildWeek(logs);
  const activeDayNames = weekDays.filter((d) => d.active).map((d) => d.day);
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });

  const impactColor: Record<string, string> = {
    High: "text-summit",
    Medium: "text-amber-600",
    Low: "text-forest-600",
  };

  return (
    <div className="max-w-[1180px] mx-auto mt-8 space-y-8 pb-10">

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-4 rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] px-6 py-5 md:flex-row md:items-center md:justify-between"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <rect x="6" y="7" width="18" height="16" rx="4" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.6" />
              <path d="M11 18V14M15 18V11M19 18V13" stroke="#1E5235" strokeWidth="2" strokeLinecap="round" />
              <path d="M22 4.5L23 7L25.5 8L23 9L22 11.5L21 9L18.5 8L21 7L22 4.5Z" fill="#E7B85B" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">
              Research Agent
            </p>
            <h2 className="mt-1 text-3xl font-bold text-forest-950">
              Insights for {mountain.goal}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {allMountains.length > 1 && (
            <>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Mountain</span>
              <select
                value={mountain.id}
                onChange={(e) => router.push(`/insights?id=${e.target.value}`)}
                className="max-w-[280px] truncate text-sm font-semibold text-forest-900 bg-white rounded-xl border border-[#E7E0D7] px-4 py-2.5 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-100 transition-colors duration-200 cursor-pointer"
                style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
                title={mountain.goal}
              >
                {allMountains.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.goal.length > 48 ? m.goal.slice(0, 47).trimEnd() + "…" : m.goal}
                  </option>
                ))}
              </select>
            </>
          )}
          <Link
            href={`/guide?mountain_id=${mountain.id}&context=${encodeURIComponent("Research insights for " + mountain.goal)}`}
            className="text-sm px-4 py-2 rounded-xl bg-white text-forest-800 font-semibold border border-forest-200 hover:bg-forest-50 hover:border-forest-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: raisedShadow }}
          >
            Discuss With AI
          </Link>
        </div>
      </div>

      {/* ── Journey Health ───────────────────────────────────────────────── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 mb-3">
          Journey Health
        </p>
        <div
          className="grid grid-cols-2 divide-x divide-[#E7E0D7] lg:grid-cols-4 rounded-2xl border border-[#E7E0D7] bg-white overflow-hidden"
          style={{ boxShadow: raisedShadow }}
        >
          {[
            {
              label: "Current Camp",
              value: currentMilestone
                ? `Camp ${mountain.current_milestone_index + 1} — ${currentMilestone.name}`
                : "Base Camp",
            },
            { label: "Progress", value: `${mountain.progress}%` },
            { label: "Consistency", value: `${consistency}%` },
            {
              label: "Summit Probability",
              value: summitProbability !== null ? `${summitProbability}%` : "—",
            },
          ].map((item, i) => (
            <div key={i} className="px-5 py-4">
              <p className="text-xs text-stone-400 mb-1">{item.label}</p>
              <p className="text-sm font-semibold text-stone-800">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Patterns & Risks row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patterns & Learnings */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 mb-3">
            Patterns &amp; Learnings
          </p>
          <div
            className="rounded-2xl border border-[#E7E0D7] bg-white px-5 py-4 space-y-2.5 min-h-[120px]"
            style={{ boxShadow: raisedShadow }}
          >
            {patterns.length > 0 ? (
              patterns.map((p, i) => (
                <p key={i} className="text-sm text-stone-700 leading-snug">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-sm text-stone-400 pt-2">
                No patterns detected yet — log more progress and reflections to build up behavioral insights.
              </p>
            )}
          </div>
        </section>

        {/* Obstacles & Risks */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 mb-3">
            Obstacles &amp; Risks
          </p>
          {obstacles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {obstacles.map((obs, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4"
                  style={{ boxShadow: raisedShadow }}
                >
                  <p className="text-xs text-stone-400 mb-1">Risk #{i + 1}</p>
                  <p className="text-sm font-semibold text-stone-800 mb-3">{obs.blocker}</p>
                  <div className="space-y-1 text-xs text-stone-600">
                    <p>
                      <span className="text-stone-400">Detected: </span>
                      {obs.frequency} {obs.frequency === 1 ? "time" : "times"}
                    </p>
                    <p>
                      <span className="text-stone-400">Suggested Fix: </span>
                      {obs.suggestion}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white px-5 py-4 min-h-[120px] flex items-center"
              style={{ boxShadow: raisedShadow }}
            >
              <p className="text-sm text-stone-400">
                No obstacles recorded yet — complete a weekly reflection to surface blockers.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── AI Strategic Intelligence ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
            AI Strategic Intelligence
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/guide?mountain_id=${mountain.id}`}
              className="text-xs px-4 py-2 rounded-xl bg-white text-stone-700 font-semibold border border-[#E7E0D7] hover:bg-stone-50 hover:border-stone-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: raisedShadow }}
            >
              Discuss With AI
            </Link>
            <button
              onClick={generateIntelligence}
              disabled={generating}
              className="text-xs px-4 py-2 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
              type="button"
            >
              {generating ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-forest-200 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </span>
              ) : intelligence ? (
                "Refresh Analysis"
              ) : (
                "Generate Analysis"
              )}
            </button>
          </div>
        </div>

        {intelligence ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 4.1 Recommended Strategy */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.1 Recommended Strategy</p>
              <p className="text-xs text-stone-400 mb-0.5">Current Focus</p>
              <p className="text-sm font-semibold text-stone-800 mb-2">{intelligence.recommended_strategy.focus}</p>
              <p className="text-xs text-stone-400 mb-0.5">Reason</p>
              <p className="text-xs text-stone-600 leading-relaxed">{intelligence.recommended_strategy.reason}</p>
            </div>

            {/* 4.2 Skill Gap Analysis */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.2 Skill Gap Analysis</p>
              <p className="text-xs text-stone-400 mb-0.5">Goal</p>
              <p className="text-xs font-semibold text-stone-800 mb-2">{intelligence.skill_gap_analysis.goal}</p>
              <p className="text-xs text-stone-400 mb-1">Current Skills</p>
              <div className="space-y-0.5 mb-2">
                {intelligence.skill_gap_analysis.current_skills.slice(0, 4).map((s, i) => (
                  <p key={i} className="text-xs text-stone-600">✓ {s}</p>
                ))}
              </div>
              <p className="text-xs text-stone-400 mb-1">Missing Skills</p>
              <div className="space-y-0.5">
                {intelligence.skill_gap_analysis.missing_skills.slice(0, 4).map((s, i) => (
                  <p key={i} className="text-xs text-stone-600">✗ {s}</p>
                ))}
              </div>
            </div>

            {/* 4.3 Highest Leverage Actions */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.3 Highest Leverage Actions</p>
              <p className="text-xs text-stone-400 mb-0.5">Highest Leverage Action</p>
              <p className="text-xs font-semibold text-stone-800 mb-2">{intelligence.highest_leverage.action}</p>
              <p className="text-xs text-stone-400 mb-0.5">Expected Impact</p>
              <p className="text-xs text-stone-600 mb-2">{intelligence.highest_leverage.expected_impact}</p>
              <p className="text-xs text-stone-400 mb-0.5">Estimated Time</p>
              <p className="text-xs text-stone-600">{intelligence.highest_leverage.estimated_time}</p>
            </div>

            {/* 4.4 Bottleneck Analysis */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.4 Bottleneck Analysis</p>
              <p className="text-xs text-stone-400 mb-1">Current Bottleneck</p>
              <div className="space-y-0.5 mb-2">
                {intelligence.bottleneck.findings.map((f, i) => (
                  <p key={i} className="text-xs text-stone-600">{f}</p>
                ))}
              </div>
              <p className="text-xs text-stone-400 mb-0.5">Main bottleneck:</p>
              <p className="text-xs font-semibold text-stone-800">{intelligence.bottleneck.main_bottleneck}</p>
            </div>

            {/* 4.5 Opportunity Analysis */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.5 Opportunity Analysis</p>
              <p className="text-xs text-stone-400 mb-1">Current Market Trends</p>
              <p className="text-xs text-stone-600 mb-1">Most requested skills:</p>
              <div className="space-y-0.5">
                {intelligence.opportunity.market_trends.slice(0, 4).map((t, i) => (
                  <p key={i} className="text-xs text-stone-600">{i + 1}. {t}</p>
                ))}
              </div>
            </div>

            {/* 4.6 Trade-Off Analysis */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.6 Trade-Off Analysis</p>
              <p className="text-xs text-stone-600 mb-2">You have {intelligence.trade_off.available_hours} hours this week.</p>
              <p className="text-xs text-stone-400 mb-0.5">Option A</p>
              <p className="text-xs font-semibold text-stone-800 mb-2">{intelligence.trade_off.best_option}</p>
              <p className={`text-xs mb-0.5 ${impactColor[intelligence.trade_off.impact] || "text-stone-600"}`}>
                Impact: {intelligence.trade_off.impact}
              </p>
              <p className="text-xs text-stone-600 mb-2">Risk: {intelligence.trade_off.risk}</p>
              <p className="text-xs font-semibold text-forest-700">Recommended</p>
            </div>

            {/* 4.7 Scenario Planning */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.7 Scenario Planning</p>
              <p className="text-xs text-stone-400 mb-0.5">If You Continue Current Pace</p>
              <p className="text-xs text-stone-600 mb-2">{intelligence.scenario.current_pace}</p>
              <p className="text-xs text-stone-400 mb-0.5">If You Increase Weekly Hours</p>
              <p className="text-xs text-stone-600 mb-2">{intelligence.scenario.increased_hours}</p>
              <p className="text-xs text-stone-400 mb-0.5">If You Stop Building</p>
              <p className="text-xs text-stone-600">{intelligence.scenario.stopped}</p>
            </div>

            {/* 4.8 Mentor Insights */}
            <div className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4" style={{ boxShadow: raisedShadow }}>
              <p className="text-[10px] font-semibold text-stone-400 mb-2">4.8 Mentor Insights</p>
              <p className="text-xs text-stone-400 mb-1">Mentor Insight</p>
              <p className="text-xs text-stone-600 leading-relaxed">{intelligence.mentor_insight}</p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl border border-[#E7E0D7] bg-white px-6 py-8 text-center"
            style={{ boxShadow: raisedShadow }}
          >
            <p className="text-sm font-semibold text-stone-700 mb-1">No analysis yet</p>
            <p className="text-xs text-stone-400">
              Hit &ldquo;Generate Analysis&rdquo; to run a deep AI analysis on your current stage.
            </p>
          </div>
        )}
      </section>

      {/* ── Progress Timeline + AI Predictions ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Progress Timeline */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 mb-3">
            Progress Timeline
          </p>
          <div
            className="rounded-2xl border border-[#E7E0D7] bg-white px-5 py-5"
            style={{ boxShadow: raisedShadow }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-stone-700">{monthName}</p>
              <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
                <span className="text-xs px-3 py-1 rounded-lg bg-white text-stone-700 font-semibold" style={{ boxShadow: raisedShadow }}>
                  Week
                </span>
              </div>
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-7 gap-1 mb-5">
              {weekDays.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      d.active ? "bg-forest-500" : "bg-transparent"
                    }`}
                  >
                    {d.active && <span className="w-2.5 h-2.5 rounded-full bg-white opacity-90" />}
                  </div>
                  <p className="text-[10px] font-semibold text-stone-400">{d.day}</p>
                  <p className="text-[10px] text-stone-400">{d.date}</p>
                </div>
              ))}
            </div>

            {/* Nav arrows */}
            <div className="flex items-center justify-between mb-4">
              <button type="button" className="w-7 h-7 rounded-full border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 active:scale-[0.95] transition-colors duration-200">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6.5 2L3.5 5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" className="w-7 h-7 rounded-full border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 active:scale-[0.95] transition-colors duration-200">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L6.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>

            {/* Stats */}
            <div className="rounded-xl border border-[#E7E0D7] bg-[#FAFAF8] px-4 py-3 space-y-1.5">
              <p className="text-xs text-stone-600">
                <span className="text-stone-400">Completed Camps: </span>
                {completedCamps}
              </p>
              <p className="text-xs text-stone-600">
                <span className="text-stone-400">Total Milestones: </span>
                {mountain.milestones.length}
              </p>
              <p className="text-xs text-stone-600">
                <span className="text-stone-400">Active Days this week: </span>
                {activeDayNames.length > 0 ? activeDayNames.join(" ") : "None yet"}
              </p>
            </div>
          </div>
        </section>

        {/* AI Predictions */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 mb-3">
            AI Predictions
          </p>
          {intelligence ? (
            <div className="space-y-3">
              <div
                className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4"
                style={{ boxShadow: raisedShadow }}
              >
                <p className="text-xs text-stone-400 mb-2">If Current Pattern Continues</p>
                <p className="text-xs text-stone-600 leading-relaxed">{intelligence.scenario.current_pace}</p>
              </div>
              <div
                className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-4"
                style={{ boxShadow: raisedShadow }}
              >
                <p className="text-xs text-stone-400 mb-2">If Consistency Drops 20%</p>
                <p className="text-xs text-stone-600 leading-relaxed">{intelligence.scenario.stopped}</p>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl border border-[#E7E0D7] bg-white px-4 py-6 text-center"
              style={{ boxShadow: raisedShadow }}
            >
              <p className="text-xs text-stone-400">
                Generate analysis to see AI predictions.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1180px] mx-auto mt-20 text-center">
          <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-400 mt-3">Loading insights...</p>
        </div>
      }
    >
      <InsightsContent />
    </Suspense>
  );
}
