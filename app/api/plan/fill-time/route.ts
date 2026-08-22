import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import { formatMinutes, type PlanDay, type PlanRow } from "@/lib/plans";

// The user shortened or removed a task and freed up time. If they choose to
// use it, this proposes ONE task that moves the current milestone forward —
// sized to the time actually freed. Single task, applied inline by the
// client (with undo), so it stays in the direct-manipulation tier.
export async function POST(request: Request) {
  const { plan_id, mountain_id, day, minutes } = await request.json();

  if (!plan_id || !mountain_id || !day || !minutes) {
    return Response.json(
      { error: "plan_id, mountain_id, day, and minutes are required" },
      { status: 400 }
    );
  }

  const [{ data: planRow }, { data: mountain }] = await Promise.all([
    supabase.from("weekly_plans").select("*").eq("id", plan_id).single(),
    supabase.from("mountains").select("*").eq("id", mountain_id).single(),
  ]);

  if (!planRow) return Response.json({ error: "Plan not found" }, { status: 404 });
  if (!mountain) return Response.json({ error: "Mountain not found" }, { status: 404 });

  const row = planRow as PlanRow;
  const schedule: PlanDay[] = row.plan?.schedule || [];
  const targetDay = schedule.find((d) => d.day === day);
  const currentMilestone = mountain.milestones[mountain.current_milestone_index];

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain. The user just freed up time on one day by shortening or removing a task, and asked you to use it.

Propose exactly ONE task that:
- Fits in about ${formatMinutes(minutes)} — no longer.
- Belongs to the CURRENT camp named below. Do not pull work forward from a later camp, however useful it looks.
- Within that camp, moves it forward through REAL EXECUTION — producing, practising, drafting, testing. The user just chose to spend less time on something; do not hand that time back to more setup, admin, file organising, asset gathering, research, or reading.
- Does not duplicate or overlap anything already scheduled that day or elsewhere in the week.
- Is concrete enough to start without deciding anything else first: "Record a 30s draft of the intro clip", not "Work on video".
- Is written as ONE short sentence, under 140 characters. No multi-step instructions, no semicolon-chained checklists, no file naming conventions.

Return JSON: { "task": { "task": "...", "duration": "...", "priority": "high|medium|low" } }`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Current camp: ${currentMilestone?.name || "Getting started"}${currentMilestone?.description ? ` — ${currentMilestone.description}` : ""}
This week's focus: ${row.plan?.focus_area || "not set"}
Time freed on ${day}: ${formatMinutes(minutes)}
Already scheduled that day: ${JSON.stringify(targetDay?.tasks || [])}
Rest of the week: ${JSON.stringify(schedule.filter((d) => d.day !== day))}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Failed to suggest a task" }, { status: 500 });
  }

  const result = JSON.parse(content);
  if (!result.task?.task) {
    return Response.json({ error: "Failed to suggest a task" }, { status: 500 });
  }

  return Response.json({
    task: {
      task: result.task.task,
      duration: result.task.duration || formatMinutes(minutes),
      priority: result.task.priority || "medium",
    },
  });
}
