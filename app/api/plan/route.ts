import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { mountain_id, available_time, user_constraints } =
    await request.json();

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

  const { data: pastPlans } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: progressLogs } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: memories } = await supabase
    .from("memory")
    .select("content, category")
    .eq("mountain_id", mountain_id)
    .in("category", ["motivation", "obstacle", "behavior_pattern"]);

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain. You create adaptive plans and decide the highest-impact next action.

Your job:
- Generate a weekly schedule based on available time and current progress
- Adjust difficulty based on performance history
- Prioritize consistency, endurance, speed, or recovery based on context
- Recommend what the user should focus on next
- Consider injury, soreness, or motivation patterns from memory

Return a JSON object:
{
  "plan": {
    "schedule": [
      {
        "day": "Monday",
        "tasks": [
          { "task": "task description", "duration": "30 min", "priority": "high|medium|low" }
        ]
      }
    ],
    "focus_area": "what to focus on this week",
    "difficulty_level": "easy|moderate|challenging|intense"
  },
  "priority_recommendation": "the single most important thing to do this week and why",
  "next_best_action": "the very next thing the user should do right now",
  "strategy_notes": "broader strategic thinking about the user's trajectory",
  "adjustments": ["list of adjustments made based on past performance"]
}

Rules:
- If past plans exist, learn from what worked and what didn't
- If progress logs show missed tasks, reduce load — don't punish
- If user is ahead of schedule, consider leveling up
- Distribute effort across the week, not front-loaded
- Rest days are strategic, not lazy — include them
- Be specific with tasks: "Run 3K at conversational pace" not "Go running"`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}
Progress: ${mountain.progress}%
Race date: ${mountain.race_date || "Not set"}
Available time: ${available_time || "Not specified"}
User constraints: ${user_constraints || "None"}
${pastPlans?.length ? `\nRecent plan history: ${JSON.stringify(pastPlans.map((p: { priority_recommendation: string; strategy_notes: string }) => ({ recommendation: p.priority_recommendation, notes: p.strategy_notes })))}` : ""}
${progressLogs?.length ? `\nRecent progress: ${JSON.stringify(progressLogs.map((l: { log_type: string; data: Record<string, unknown> }) => ({ type: l.log_type, data: l.data })))}` : ""}
${memories?.length ? `\nUser patterns: ${memories.map((m: { content: string }) => m.content).join("; ")}` : ""}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }

  const result = JSON.parse(content);
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("weekly_plans")
    .insert({
      mountain_id,
      week_start: weekStart,
      plan: result.plan || {},
      priority_recommendation: result.priority_recommendation || "",
      next_best_action: result.next_best_action || "",
      strategy_notes: result.strategy_notes || "",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ...data, adjustments: result.adjustments || [] });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
