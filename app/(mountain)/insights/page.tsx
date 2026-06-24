"use client";

import { useEffect, useState, useCallback } from "react";

interface Insight {
  title: string;
  detail: string;
}

interface Resource {
  name: string;
  type: string;
  url?: string;
  reason: string;
}

interface SkillGap {
  skill: string;
  priority: string;
  current_level?: string;
  target_level?: string;
  suggestion: string;
}

interface MarketTrend {
  trend: string;
  impact: string;
}

interface BestPractice {
  practice: string;
  why: string;
}

interface OpportunityRisk {
  type: string;
  description: string;
  action: string;
}

interface CareerBenchmark {
  benchmark: string;
  relevance: string;
}

interface ResearchData {
  id: string;
  insights: Insight[];
  resources: Resource[];
  skill_gaps: SkillGap[];
  market_trends?: MarketTrend[];
  career_benchmarks?: CareerBenchmark[];
  best_practices?: BestPractice[];
  opportunities_and_risks?: OpportunityRisk[];
  created_at: string;
}

interface MountainData {
  id: string;
  goal: string;
  summit: string;
  progress: number;
  current_milestone_index: number;
  milestones: { name: string; completed: boolean }[];
}

const cardShadow = "0 1px 4px rgba(20,60,35,0.04)";

const priorityColor: Record<string, string> = {
  high: "text-summit font-medium",
  medium: "text-amber-600 font-medium",
  low: "text-forest-600 font-medium",
};

const typeLabel: Record<string, string> = {
  course: "Course",
  book: "Book",
  tool: "Tool",
  community: "Community",
  practice: "Practice",
};

export default function InsightsPage() {
  const [mountain, setMountain] = useState<MountainData | null>(null);
  const [research, setResearch] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);

  const fetchData = useCallback(async () => {
    const mountainsRes = await fetch("/api/mountains");
    if (!mountainsRes.ok) {
      setLoading(false);
      return;
    }

    const mountains = await mountainsRes.json();
    if (!mountains.length) {
      setLoading(false);
      return;
    }

    const m = mountains[0];
    setMountain(m);

    const researchRes = await fetch(
      `/api/research?mountain_id=${m.id}`
    );
    if (researchRes.ok) {
      const researchList = await researchRes.json();
      if (researchList.length) {
        setResearch(researchList[0]);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function runResearch() {
    if (!mountain || researching) return;
    setResearching(true);

    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mountain_id: mountain.id }),
    });

    if (res.ok) {
      const data = await res.json();
      setResearch(data);
    }

    setResearching(false);
  }

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto mt-20 text-center">
        <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-stone-400 mt-3">Loading insights...</p>
      </div>
    );
  }

  if (!mountain) {
    return (
      <div className="max-w-[1100px] mx-auto mt-20 text-center">
        <p className="text-stone-500">Create a mountain first to see insights.</p>
      </div>
    );
  }

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];
  const completedCount = mountain.milestones.filter((m) => m.completed).length;

  return (
    <div className="max-w-[1100px] mx-auto mt-2 space-y-10">
      {/* Journey Health */}
      <section>
        <h2 className="text-lg font-semibold text-stone-800 mb-3">
          Journey Health
        </h2>
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.06)" }}
        >
          {[
            {
              label: "Current Camp",
              value: currentMilestone?.name || "Base Camp",
            },
            { label: "Progress", value: `${mountain.progress}%` },
            {
              label: "Milestones Done",
              value: `${completedCount} / ${mountain.milestones.length}`,
            },
            { label: "Goal", value: mountain.goal },
          ].map((item) => (
            <div key={item.label} className="bg-stone-50 px-5 py-4">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">
                {item.label}
              </p>
              <p className="text-base font-semibold text-stone-800 mt-1 truncate">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Research header + trigger */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">
              Research &amp; Intelligence
            </h2>
            {research && (
              <p className="text-xs text-stone-400 mt-0.5">
                Last updated{" "}
                {new Date(research.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <button
            onClick={runResearch}
            disabled={researching}
            className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
            type="button"
          >
            {researching ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-forest-600 rounded-full animate-spin" />
                Researching...
              </span>
            ) : research ? (
              "Run New Research"
            ) : (
              "Run Research"
            )}
          </button>
        </div>

        {!research && !researching && (
          <div
            className="bg-stone-50 rounded-2xl p-8 border border-stone-200 text-center"
            style={{ boxShadow: cardShadow }}
          >
            <p className="text-sm text-stone-500">
              No research yet. Hit &ldquo;Run Research&rdquo; to gather
              insights, resources, and skill gaps for your current stage.
            </p>
          </div>
        )}
      </section>

      {research && (
        <>
          {/* Insights + Skill Gaps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Insights */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">
                Industry Insights
              </h2>
              <div
                className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4"
                style={{ boxShadow: cardShadow }}
              >
                {research.insights.length ? (
                  research.insights.map((insight, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-stone-800">
                        {insight.title}
                      </p>
                      <p className="text-sm text-stone-600 mt-0.5 leading-relaxed">
                        {insight.detail}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-400">No insights yet.</p>
                )}
              </div>
            </section>

            {/* Skill Gaps */}
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-3">
                Skill Gaps
              </h2>
              <div className="space-y-3">
                {research.skill_gaps.length ? (
                  research.skill_gaps.map((gap, i) => (
                    <div
                      key={i}
                      className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
                      style={{ boxShadow: cardShadow }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-semibold text-stone-800">
                          {gap.skill}
                        </p>
                        <span
                          className={`text-xs uppercase tracking-wide ${priorityColor[gap.priority] || "text-stone-500"}`}
                        >
                          {gap.priority}
                        </span>
                      </div>
                      {gap.current_level && (
                        <p className="text-xs text-stone-500">
                          <span className="text-stone-400">Now:</span>{" "}
                          {gap.current_level}
                          {gap.target_level && (
                            <>
                              {" "}
                              <span className="text-stone-300 mx-1">→</span>{" "}
                              <span className="text-stone-400">Need:</span>{" "}
                              {gap.target_level}
                            </>
                          )}
                        </p>
                      )}
                      <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
                        {gap.suggestion}
                      </p>
                    </div>
                  ))
                ) : (
                  <div
                    className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
                    style={{ boxShadow: cardShadow }}
                  >
                    <p className="text-sm text-stone-400">
                      No skill gaps identified.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Resources */}
          <section>
            <h2 className="text-lg font-semibold text-stone-800 mb-3">
              Recommended Resources
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {research.resources.length ? (
                research.resources.map((resource, i) => (
                  <div
                    key={i}
                    className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
                    style={{ boxShadow: cardShadow }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-forest-600 bg-forest-50 px-2 py-0.5 rounded-md">
                        {typeLabel[resource.type] || resource.type}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-stone-800">
                      {resource.name}
                    </p>
                    <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                      {resource.reason}
                    </p>
                  </div>
                ))
              ) : (
                <div
                  className="bg-stone-50 rounded-2xl p-5 border border-stone-200 col-span-full"
                  style={{ boxShadow: cardShadow }}
                >
                  <p className="text-sm text-stone-400">
                    No resources recommended yet.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Market Trends + Best Practices */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Market Trends */}
            {research.market_trends && research.market_trends.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-stone-800 mb-3">
                  Market Trends
                </h2>
                <div
                  className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4"
                  style={{ boxShadow: cardShadow }}
                >
                  {research.market_trends.map((trend, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-stone-800">
                        {trend.trend}
                      </p>
                      <p className="text-sm text-stone-600 mt-0.5 leading-relaxed">
                        {trend.impact}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Best Practices */}
            {research.best_practices && research.best_practices.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-stone-800 mb-3">
                  Best Practices
                </h2>
                <div
                  className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4"
                  style={{ boxShadow: cardShadow }}
                >
                  {research.best_practices.map((bp, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-stone-800">
                        {bp.practice}
                      </p>
                      <p className="text-sm text-stone-600 mt-0.5 leading-relaxed">
                        {bp.why}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Opportunities & Risks */}
          {research.opportunities_and_risks &&
            research.opportunities_and_risks.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-stone-800 mb-3">
                  Opportunities &amp; Risks
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {research.opportunities_and_risks.map((item, i) => (
                    <div
                      key={i}
                      className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
                      style={{ boxShadow: cardShadow }}
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                          item.type === "opportunity"
                            ? "text-forest-700 bg-forest-50"
                            : "text-summit bg-red-50"
                        }`}
                      >
                        {item.type}
                      </span>
                      <p className="text-sm font-semibold text-stone-800 mt-2">
                        {item.description}
                      </p>
                      <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                        {item.action}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Career Benchmarks */}
          {research.career_benchmarks &&
            research.career_benchmarks.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-stone-800 mb-3">
                  Career Benchmarks
                </h2>
                <div
                  className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4"
                  style={{ boxShadow: cardShadow }}
                >
                  {research.career_benchmarks.map((cb, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-stone-800">
                        {cb.benchmark}
                      </p>
                      <p className="text-sm text-stone-600 mt-0.5 leading-relaxed">
                        {cb.relevance}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </>
      )}
    </div>
  );
}
