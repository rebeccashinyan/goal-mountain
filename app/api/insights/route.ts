import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { mountain_id } = await request.json();

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data: mountain, error: fetchError } = await supabase
    .from("mountains")
    .select("*")
    .eq("id", mountain_id)
    .single();

  if (fetchError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  const [{ data: memories }, { data: reflections }, { data: logs }] =
    await Promise.all([
      supabase
        .from("memory")
        .select("category, content")
        .eq("mountain_id", mountain_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reflections")
        .select("summary, blockers, lessons_learned, adjustments")
        .eq("mountain_id", mountain_id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("progress_logs")
        .select("log_type, data, created_at")
        .eq("mountain_id", mountain_id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];
  const completedCount = mountain.milestones.filter((m: { completed: boolean }) => m.completed).length;
  const remainingMilestones = mountain.milestones.length - completedCount;

  const behaviorPatterns = (memories || [])
    .filter((m: { category: string }) => m.category === "behavior_pattern")
    .map((m: { content: string }) => m.content);
  const obstacles = (memories || [])
    .filter((m: { category: string }) => m.category === "obstacle")
    .map((m: { content: string }) => m.content);
  const allBlockers = (reflections || [])
    .flatMap((r: { blockers: { blocker: string; frequency: number; suggestion: string }[] }) => r.blockers || []);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Strategic Intelligence Agent for Goal Mountain. Generate deep analysis for a user's goal journey.

Return a JSON object with this exact shape:
{
  "summit_probability": <number 0-100>,
  "consistency_score": <number 0-100, estimate from available data>,
  "recommended_strategy": {
    "focus": "<short focus label, e.g. Consistency > Speed>",
    "reason": "<1-2 sentences explaining why this focus matters now>"
  },
  "skill_gap_analysis": {
    "goal": "<the summit/goal>",
    "current_skills": ["<skill>"],
    "missing_skills": ["<skill>"]
  },
  "highest_leverage": {
    "action": "<the single most impactful thing to do>",
    "expected_impact": "<measurable outcome, e.g. +25% portfolio quality>",
    "estimated_time": "<e.g. 20 hours>"
  },
  "bottleneck": {
    "findings": ["<what is NOT the bottleneck>", "<what is NOT the bottleneck>"],
    "main_bottleneck": "<the actual bottleneck>"
  },
  "opportunity": {
    "market_trends": ["<trend 1>", "<trend 2>", "<trend 3>", "<trend 4>"]
  },
  "trade_off": {
    "available_hours": <estimated weekly hours>,
    "best_option": "<what to focus on>",
    "impact": "High|Medium|Low",
    "risk": "High|Medium|Low"
  },
  "scenario": {
    "current_pace": "<outcome if current pace continues>",
    "increased_hours": "<outcome if effort increases>",
    "stopped": "<consequence of stopping>"
  },
  "mentor_insight": "<wisdom from someone who has done this before, 1-2 sentences>"
}`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Base Camp"}
Progress: ${mountain.progress}%
Completed milestones: ${completedCount} / ${mountain.milestones.length}
Remaining milestones: ${remainingMilestones}
Recent logs: ${logs?.length || 0} entries
Behavior patterns: ${behaviorPatterns.join("; ") || "None yet"}
Known obstacles: ${obstacles.join("; ") || "None yet"}
Recent blockers from reflections: ${allBlockers.slice(0, 5).map((b: { blocker: string }) => b.blocker).join("; ") || "None yet"}
Reflection summaries: ${(reflections || []).slice(0, 3).map((r: { summary: string }) => r.summary).join(" | ") || "None yet"}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Failed to generate insights" }, { status: 500 });
  }

  return Response.json(JSON.parse(content));
}
