import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

// Inline task swap: given one task, returns AI-generated alternatives for
// direct-manipulation replacement (no chat round-trip). "initial" returns
// a hands-on variant and a smaller/lower-effort variant; "more" (the
// "Something else" follow-up) returns one further, different option.
export async function POST(request: Request) {
  const { mountain_id, task, mode = "initial", exclude } = await request.json();

  if (!mountain_id || !task?.task) {
    return Response.json({ error: "mountain_id and task are required" }, { status: 400 });
  }

  const { data: mountain, error: mountainError } = await supabase
    .from("mountains")
    .select("goal, summit, milestones, current_milestone_index")
    .eq("id", mountain_id)
    .single();

  if (mountainError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];

  const instruction =
    mode === "more"
      ? "Suggest exactly 1 alternative task — a genuinely different way to spend this same time slot toward the same goal, distinct from anything already suggested. Not specifically a hands-on or smaller variant, just a different angle."
      : "Suggest exactly 2 alternative tasks for this same time slot: one that is a more hands-on/practical version of the original, and one that is a smaller/lower-effort version of the original.";

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain, replacing a single task in a weekly plan with alternatives the user can pick from in place — no conversation, just direct swap options.

${instruction}

Keep each alternative's duration close to the original unless the variant specifically calls for shorter (the "smaller" version should be shorter).
Be specific: "Complete chapter 3 exercises" not "Study more".

Return a JSON object: { "alternatives": [ { "task": "...", "duration": "...", "priority": "high|medium|low" } ] }`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}
Original task: ${task.task} (${task.duration}, priority: ${task.priority})
${exclude?.length ? `Already suggested, don't repeat: ${JSON.stringify(exclude)}` : ""}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Failed to generate alternatives" }, { status: 500 });
  }

  const result = JSON.parse(content);
  return Response.json({ alternatives: result.alternatives || [] });
}
