import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import type { PlanDay } from "@/lib/plans";

// Two-step AI-assisted replacement for a single task — no chat round-trip,
// and never touches any task but the one being replaced:
//
// 1. mode: "directions" — read the task in context (goal, current camp,
//    rest of the week) to understand what it was actually FOR, then
//    propose 2-3 concrete alternative directions. Not finished tasks yet —
//    a menu the user picks from (or types their own).
// 2. mode: "generate" — turn the chosen direction (AI-suggested or typed
//    by the user) into one concrete task, and flag any OTHER tasks already
//    in the plan that the direction makes inconsistent, so the caller can
//    offer a review rather than changing them silently.
export async function POST(request: Request) {
  const { plan_id, mountain_id, task, day, mode, direction } = await request.json();

  if (!plan_id || !mountain_id || !task?.task || !day || !mode) {
    return Response.json(
      { error: "plan_id, mountain_id, task, day, and mode are required" },
      { status: 400 }
    );
  }
  if (mode === "generate" && !direction?.trim()) {
    return Response.json({ error: 'direction is required for mode: "generate"' }, { status: 400 });
  }

  const { data: mountain, error: mountainError } = await supabase
    .from("mountains")
    .select("goal, summit, milestones, current_milestone_index")
    .eq("id", mountain_id)
    .single();

  if (mountainError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  const { data: planRow, error: planError } = await supabase
    .from("weekly_plans")
    .select("plan")
    .eq("id", plan_id)
    .single();

  if (planError || !planRow) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const schedule: PlanDay[] = (planRow.plan?.schedule || []) as PlanDay[];
  const otherTasks = schedule.flatMap((d) =>
    (d.tasks || [])
      .filter((t) => !(d.day === day && t.task === task.task))
      .map((t) => ({ day: d.day, task: t.task }))
  );

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];
  const sharedContext = `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages:
      mode === "directions"
        ? [
            {
              role: "system",
              content: `You are the Planning + Strategy Agent for Goal Mountain. The user doesn't want to do one task as written and wants a different direction for it — this is a quick menu of concrete alternatives, not a conversation.

First understand what the task is actually FOR (e.g. "compare DIY CAD vs hiring a freelancer" is really about deciding how to get a 3D model made). Then propose 2-3 concrete, meaningfully different directions the user could take instead.

Return a JSON object: { "directions": ["...", "...", "..."] }

Rules:
- 2 to 3 directions, never more or fewer
- Each must be genuinely different from the others — not reworded restatements of the same idea
- Short phrases (4-8 words) naming a real path forward — this is a menu, not finished tasks yet
- Don't suggest a direction that duplicates another task already elsewhere in this week's plan`,
            },
            {
              role: "user",
              content: `${sharedContext}
Task to replace: "${task.task}" (${task.duration}, priority: ${task.priority}), on ${day}
${otherTasks.length ? `\nRest of this week's plan (for context — don't duplicate any of these): ${JSON.stringify(otherTasks)}` : ""}`,
            },
          ]
        : [
            {
              role: "system",
              content: `You are the Planning + Strategy Agent for Goal Mountain. The user is replacing one task in their weekly plan with a specific direction they chose (or typed themselves). Turn it into ONE concrete, specific, actionable task with a realistic duration for a single sitting, matching the style of the rest of the plan.

Then check the REST of this week's schedule: does this new direction make any OTHER task inconsistent or redundant (e.g. choosing "build it myself" when the schedule still has a "find a freelancer" task later)? List only genuine conflicts — never just thematic overlap, and never the task being replaced itself.

Return a JSON object:
{
  "task": "specific task text",
  "duration": "e.g. 30 min",
  "priority": "high|medium|low",
  "affected": [ { "day": "Tuesday", "task": "exact existing task text, copied verbatim" } ]
}`,
            },
            {
              role: "user",
              content: `${sharedContext}
Task being replaced: "${task.task}" (${task.duration}, priority: ${task.priority}), on ${day}
Chosen direction: ${direction.trim()}
${otherTasks.length ? `\nRest of this week's plan: ${JSON.stringify(otherTasks)}` : ""}`,
            },
          ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Failed to generate replacement" }, { status: 500 });
  }

  const result = JSON.parse(content);

  if (mode === "directions") {
    return Response.json({ directions: (result.directions || []).slice(0, 3) });
  }

  // Deterministic check — only ever flag tasks that actually exist in this
  // plan, so "Review changes" can never point at something hallucinated.
  const affected = (result.affected || []).filter(
    (a: { day: string; task: string }) =>
      a?.day && a?.task && otherTasks.some((t) => t.day === a.day && t.task === a.task)
  );

  return Response.json({
    replacement: {
      task: result.task || task.task,
      duration: result.duration || task.duration,
      priority: result.priority || task.priority,
    },
    affected,
  });
}
