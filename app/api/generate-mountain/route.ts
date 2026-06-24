import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { goal, running_level, race_date, constraints } = await request.json();

  if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
    return Response.json({ error: "Goal is required" }, { status: 400 });
  }

  const { data: memories } = await supabase
    .from("memory")
    .select("content, category")
    .in("category", ["goal", "preference", "behavior_pattern", "motivation"]);

  const userContext = [
    running_level && `Current running level: ${running_level}`,
    race_date && `Target race date: ${race_date}`,
    constraints && `User constraints: ${constraints}`,
    memories?.length &&
      `Known user context from past goals: ${memories.map((m: { content: string }) => m.content).join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Mountain Generator Agent for Goal Mountain, an AI-powered goal achievement companion.

When a user shares their goal, you turn it into a structured mountain journey with camps, milestones, checkpoints, and a summit definition.

Return a JSON object with this exact shape:
{
  "goal": "the user's goal, cleaned up",
  "summit": "a clear, specific description of what reaching the summit looks like — the measurable success condition",
  "milestones": [
    {
      "name": "camp or checkpoint name",
      "description": "1-sentence description of what this milestone involves",
      "type": "camp" or "checkpoint",
      "estimated_duration": "e.g. 2 weeks"
    }
  ]
}

Rules:
- Create the mountain structure with 4-6 camps (major stages) and 2-3 checkpoints within each camp
- Order milestones from base camp (earliest/easiest) to summit (latest/hardest)
- Each camp should be a meaningful stage of the journey
- Checkpoints are smaller steps within a camp
- The last milestone should lead directly to the summit
- Make milestones specific and actionable, not vague
- Set a clear summit success condition
- If user context is provided (running level, race date, constraints), adapt the mountain accordingly
- Adapt the number and detail of milestones to the goal's complexity`,
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
        type?: string;
        estimated_duration?: string;
      },
      i: number
    ) => ({
      name: m.name,
      description: m.description,
      type: m.type || "checkpoint",
      estimated_duration: m.estimated_duration || "",
      completed: false,
      current: i === 0,
      order_index: i,
    })
  );

  const { data, error } = await supabase
    .from("mountains")
    .insert({
      goal: mountain.goal,
      summit: mountain.summit,
      current_task: "",
      progress: 0,
      current_milestone_index: 0,
      milestones,
      running_level: running_level || null,
      race_date: race_date || null,
      constraints: constraints || null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
