import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

interface ScheduleDay {
  day: string;
  tasks: { task: string; duration: string; priority: string; status?: string }[];
  finished?: boolean;
  load_feel?: string;
}

const ACTION_INSTRUCTIONS: Record<string, string> = {
  lighter:
    "Reduce the load for the remaining days — fewer tasks and/or shorter durations. Don't punish the user, just make it lighter.",
  different_approach:
    "Keep the same goal and remaining time, but restructure the remaining tasks around a meaningfully different strategy or method than what's there now.",
  regenerate:
    "Throw out the current remaining tasks and generate a fresh, different set of tasks for the remaining days.",
  availability:
    "The user's available time for the rest of the week has changed. Re-distribute the remaining tasks to fit the new available time.",
};

// One-click plan steering: revises only the days that haven't been
// finished yet (locked/logged days are left untouched) in response to a
// single quick-action click, no chat round-trip required.
export async function POST(request: Request) {
  const { plan_id, mountain_id, action, available_time } = await request.json();

  if (!plan_id || !mountain_id || !action || !ACTION_INSTRUCTIONS[action]) {
    return Response.json(
      { error: "plan_id, mountain_id, and a valid action are required" },
      { status: 400 }
    );
  }

  const { data: planRow, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("id", plan_id)
    .single();

  if (planError || !planRow) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const { data: mountain, error: mountainError } = await supabase
    .from("mountains")
    .select("*")
    .eq("id", mountain_id)
    .single();

  if (mountainError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  const schedule: ScheduleDay[] = planRow.plan?.schedule || [];
  const finishedDays = schedule.filter((d) => d.finished);
  const openDays = schedule.filter((d) => !d.finished);

  if (!openDays.length) {
    return Response.json({ error: "Nothing left in this week to revise" }, { status: 400 });
  }

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain, making a targeted revision to an existing weekly plan in response to a single user reaction (a one-click "steer" action, not a conversation).

Instruction: ${ACTION_INSTRUCTIONS[action]}

Rules:
- Only revise the days listed under "Days to revise" — return exactly that set of day names, nothing more, nothing less.
- Never reference or reintroduce the finished/locked days — those are done and out of scope.
- Be specific with tasks: "Complete chapter 3 exercises" not "Study more".

Return a JSON object:
{
  "schedule": [ { "day": "Monday", "tasks": [ { "task": "...", "duration": "...", "priority": "high|medium|low" } ] } ],
  "focus_area": "what to focus on for the rest of this week",
  "priority_recommendation": "the single most important thing to do with the remaining days",
  "note": "one short sentence, shown to the user, explaining what just changed"
}`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}
${available_time ? `New available time: ${available_time}` : ""}
Days already finished (locked, do not touch): ${JSON.stringify(finishedDays)}
Days to revise: ${JSON.stringify(openDays)}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Failed to revise plan" }, { status: 500 });
  }

  const result = JSON.parse(content);
  const revisedDays: { day: string; tasks: ScheduleDay["tasks"] }[] = result.schedule || [];

  const mergedSchedule = schedule.map((d) => {
    if (d.finished) return d;
    const revised = revisedDays.find((r) => r.day === d.day);
    return revised ? { day: d.day, tasks: revised.tasks } : d;
  });

  const updatedPlan = {
    ...planRow.plan,
    schedule: mergedSchedule,
    focus_area: result.focus_area || planRow.plan?.focus_area,
  };

  const { data, error } = await supabase
    .from("weekly_plans")
    .update({
      plan: updatedPlan,
      priority_recommendation: result.priority_recommendation || planRow.priority_recommendation,
    })
    .eq("id", plan_id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ...data, note: result.note || "Plan updated" });
}
