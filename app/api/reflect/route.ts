import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { mountain_id, user_input } = await request.json();

  if (!mountain_id || !user_input) {
    return Response.json(
      { error: "mountain_id and user_input are required" },
      { status: 400 }
    );
  }

  const { data: mountain, error: fetchError } = await supabase
    .from("mountains")
    .select("*")
    .eq("id", mountain_id)
    .single();

  if (fetchError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  const { data: pastReflections } = await supabase
    .from("reflections")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(4);

  const { data: recentLogs } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(14);

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
        content: `You are the Reflection Agent for Goal Mountain. You help the user learn from each week and adapt their journey toward any type of goal.

Your job:
- Ask reflection questions (if not already answered)
- Summarize what worked and what failed this week
- Identify repeated blockers across past reflections
- Detect patterns in missed activities, energy, and motivation
- Suggest concrete adjustments to the plan
- Send insights back into the planning system

Return a JSON object:
{
  "summary": "2-3 sentence reflection summary — warm, honest, constructive",
  "lessons_learned": ["specific lesson from this week"],
  "what_worked": ["things that went well"],
  "what_failed": ["things that didn't go well"],
  "blockers": [
    { "blocker": "description", "frequency": number_of_times_seen, "suggestion": "how to address it" }
  ],
  "adjustments": ["specific plan adjustments to recommend"],
  "motivation_insight": "what motivates or demotivates this user based on patterns",
  "memories_to_store": [
    { "category": "behavior_pattern|motivation|obstacle", "content": "insight to remember for future" }
  ]
}

Rules:
- Be warm and encouraging, never judgmental
- "You missed 3 days" → "This was a tough week — let's figure out what got in the way"
- Look for PATTERNS across multiple reflections, not just this week
- If a blocker appears 3+ times, flag it as a recurring issue
- Adjustments should be specific and actionable
- Store memories that will help personalize future interactions
- Adapt your language to the goal type — a career goal needs different reflection than a fitness goal`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}
Progress: ${mountain.progress}%

User's weekly reflection input:
${JSON.stringify(user_input)}

Recent activity (last 14 logs):
${JSON.stringify(recentLogs?.map((l: { log_type: string; data: Record<string, unknown>; created_at: string }) => ({ type: l.log_type, data: l.data, date: l.created_at })) || [])}

Past reflections:
${JSON.stringify(pastReflections?.map((r: { summary: string; blockers: unknown[]; lessons_learned: string[] }) => ({ summary: r.summary, blockers: r.blockers, lessons: r.lessons_learned })) || [])}

Known user patterns:
${memories?.map((m: { content: string }) => m.content).join("; ") || "None yet"}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Failed to generate reflection" },
      { status: 500 }
    );
  }

  const result = JSON.parse(content);
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("reflections")
    .insert({
      mountain_id,
      week_start: weekStart,
      user_input,
      summary: result.summary || "",
      lessons_learned: result.lessons_learned || [],
      blockers: result.blockers || [],
      adjustments: result.adjustments || [],
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (result.memories_to_store?.length) {
    const memoryRows = result.memories_to_store.map(
      (m: { category: string; content: string }) => ({
        mountain_id,
        category: m.category,
        content: m.content,
        metadata: { source: "reflection", reflection_id: data.id },
      })
    );
    await supabase.from("memory").insert(memoryRows);
  }

  return Response.json({
    ...data,
    what_worked: result.what_worked || [],
    what_failed: result.what_failed || [],
    motivation_insight: result.motivation_insight || "",
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reflections")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
