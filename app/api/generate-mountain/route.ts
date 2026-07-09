import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { goal, current_level, target_date, constraints, research_context } = await request.json();

  if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
    return Response.json({ error: "Goal is required" }, { status: 400 });
  }

  const { data: memories } = await supabase
    .from("memory")
    .select("content, category")
    .in("category", ["goal", "preference", "behavior_pattern", "motivation"]);

  const userContext = [
    current_level && `Current level: ${current_level}`,
    target_date && `Target date: ${target_date}`,
    constraints && `User constraints: ${constraints}`,
    memories?.length &&
      `Known user context from past goals: ${memories.map((m: { content: string }) => m.content).join("; ")}`,
    research_context && `\n--- External Research (use this to ground the milestones in real-world knowledge) ---\n${
      typeof research_context === "string"
        ? research_context
        : JSON.stringify(research_context, null, 2)
    }`,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Mountain Generator Agent for Goal Mountain, an AI-powered goal achievement companion.

When a user shares their goal, you turn it into a structured mountain journey: a single sequence of named milestones (camps) leading to a summit.

Return a JSON object with this exact shape:
{
  "goal": "the user's goal, cleaned up",
  "summit": "a clear, specific description of what reaching the summit looks like — the measurable success condition",
  "milestones": [
    {
      "name": "specific stage name",
      "description": "1-sentence description of what this milestone involves",
      "type": "camp",
      "estimated_duration": "e.g. 2 weeks"
    }
  ]
}

Rules:
- Create 5-8 milestones. Each one is a meaningful stage of the journey — a real capability or outcome worth celebrating
- Every milestone name must state the concrete capability or outcome it represents (e.g. "Hold a 15-minute everyday conversation") — never generic labels like "Checkpoint 3" or "Phase 2"
- Order milestones from base camp (earliest/easiest) to summit (latest/hardest)
- The last milestone should lead directly to the summit
- Make milestones specific and actionable, not vague
- Set a clear summit success condition
- If user context is provided (current level, target date, constraints), adapt the mountain accordingly
- Adapt the number and detail of milestones to the goal's complexity, staying within 5-8
- This system supports ANY goal type: career, fitness, learning, creative, financial, personal growth, etc.
- If external research context is provided, use it to ground the milestones in real-world knowledge: use the proven stages as the basis for milestones, incorporate the identified skill gaps as milestone focus areas, use realistic duration estimates from the research, and name things using industry-standard terminology where appropriate`,
      },
      {
        role: "user",
        content: userContext
          ? `${goal.trim()}\n\n${userContext}`
          : goal.trim(),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Failed to generate mountain" },
      { status: 500 }
    );
  }

  const mountain = JSON.parse(content);

  const milestones = mountain.milestones.map(
    (
      m: {
        name: string;
        description: string;
        estimated_duration?: string;
      },
      i: number
    ) => ({
      name: m.name,
      description: m.description,
      type: "camp",
      estimated_duration: m.estimated_duration || "",
      completed: false,
      current: i === 0,
      order_index: i,
    })
  );

  let normalizedDate: string | null = null;
  if (target_date) {
    const d = target_date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      normalizedDate = d;
    } else if (/^\d{4}-\d{2}$/.test(d)) {
      normalizedDate = `${d}-01`;
    } else if (/^\d{4}$/.test(d)) {
      normalizedDate = `${d}-01-01`;
    }
  }

  const { data, error } = await supabase
    .from("mountains")
    .insert({
      goal: mountain.goal,
      summit: mountain.summit,
      current_task: "",
      progress: 0,
      current_milestone_index: 0,
      milestones,
      running_level: current_level || null,
      race_date: normalizedDate,
      constraints: constraints || null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Save pre-mountain research to the research table so Insights can display it
  if (research_context && data?.id) {
    const rc = typeof research_context === "string"
      ? JSON.parse(research_context)
      : research_context;
    await supabase.from("research").insert({
      mountain_id: data.id,
      query: `${mountain.goal} — initial research`,
      insights: rc.insights || [],
      resources: rc.best_resources?.map((r: { name: string; type: string; why: string }) => ({
        name: r.name,
        type: r.type,
        reason: r.why,
      })) || [],
      skill_gaps: rc.skill_gaps || [],
    });
  }

  return Response.json(data);
}
