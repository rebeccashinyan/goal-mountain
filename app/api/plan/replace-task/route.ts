import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import { parseDurationMinutes, type PlanDay } from "@/lib/plans";

// Two-step AI-assisted replacement for a single task — no chat round-trip,
// and never touches any task but the one being replaced:
//
// 1. mode: "directions" — read the task in context (goal, current camp,
//    rest of the week) to understand what it was actually FOR, then
//    propose 2-3 concrete alternative directions. Not finished tasks yet —
//    a menu the user picks from (or types their own).
// 2. mode: "generate" — turn the chosen direction (AI-suggested or typed
//    by the user) into a task that fits the ORIGINAL duration, day, and
//    priority — Replace changes what the task is, never how much time or
//    capacity it consumes, unless the user explicitly opts into a longer
//    "full version" the model also proposes when the direction genuinely
//    doesn't compress. Also flags any OTHER tasks the direction makes
//    inconsistent, so the caller can offer a review rather than changing
//    them silently.
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
  const otherTasksOnDay = (schedule.find((d) => d.day === day)?.tasks || []).filter(
    (t) => t.task !== task.task
  );
  const remainingDayCapacityMin = otherTasksOnDay.reduce(
    (sum, t) => sum + parseDurationMinutes(t.duration),
    0
  );
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

First understand what the task is actually FOR (e.g. "compare DIY CAD vs hiring a freelancer" is really about deciding how to get a 3D model made). Then propose 2-3 concrete, meaningfully different directions the user could take instead — each one realistic to attempt within the task's existing time budget, not a bigger undertaking.

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
              content: `You are the Planning + Strategy Agent for Goal Mountain. The user is replacing one task's CONTENT with a specific direction they chose (or typed themselves) — this changes WHAT the task is, not how much time it takes. The task's duration, day, and priority are fixed constraints you must design within, not suggestions.

Fit the chosen direction into the task's EXISTING duration by narrowing scope — fewer items, a smaller sample, a lighter pass — not by describing a maximal or "proper" version of it and hoping it's fine. Be concrete about the reduced scope (e.g. "analyze 2 competitors and note 3 takeaways", not "analyze competitors"). This fitted version is what actually replaces the task, so it must be genuinely achievable in the original time, matching the style of the rest of the plan.

Separately and honestly, judge: would a thorough, complete version of this direction reasonably need meaningfully more time than the original duration? Most directions fit fine and don't need this. Only when it genuinely doesn't compress, also describe that fuller version with a realistic duration estimate — the user may choose to expand into it, but that is their call to make, not yours to assume.

Then check the REST of this week's schedule: does this new direction make any OTHER task inconsistent or redundant (e.g. choosing "build it myself" when the schedule still has a "find a freelancer" task later)? List only genuine conflicts — never just thematic overlap, and never the task being replaced itself.

Return a JSON object:
{
  "task": "the fitted version — achievable within the original duration",
  "needs_more_time": true | false,
  "full_version": { "task": "the fuller, more thorough version", "duration": "realistic estimate, e.g. '2 hours'" },
  "affected": [ { "day": "Tuesday", "task": "exact existing task text, copied verbatim" } ]
}
Omit "full_version" (or leave it null) when needs_more_time is false. Never include a duration or priority for the fitted "task" — those are fixed and supplied by the caller, not yours to set.`,
            },
            {
              role: "user",
              content: `${sharedContext}
Task being replaced: "${task.task}" — fixed duration ${task.duration}, fixed priority ${task.priority}, on ${day}
Chosen direction: ${direction.trim()}
Already scheduled on ${day} besides this task (${remainingDayCapacityMin} min): ${otherTasksOnDay.length ? JSON.stringify(otherTasksOnDay.map((t) => t.task)) : "nothing else"}
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

  // Deterministic backstop on the constraint itself — the prompt asks the
  // model to respect the original duration and priority, but only pinning
  // them here in code guarantees Replace can never silently grow a task,
  // the same lesson this project has applied everywhere a model was asked
  // to hold a hard rule on its own.
  const fullVersion =
    result.needs_more_time && result.full_version?.task
      ? {
          task: result.full_version.task,
          duration: result.full_version.duration || "more time",
        }
      : null;

  return Response.json({
    replacement: {
      task: result.task || task.task,
      duration: task.duration,
      priority: task.priority,
    },
    fullVersion,
    affected,
  });
}
