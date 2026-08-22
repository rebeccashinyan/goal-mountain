import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import {
  diffSchedules,
  isEmptyDiff,
  mergeKeepingFinished,
  type PlanDay,
  type PlanRow,
} from "@/lib/plans";

const ACTION_INSTRUCTIONS: Record<string, string> = {
  lighter:
    "Reduce the load for the remaining days by DROPPING whole tasks and/or SHORTENING durations. Never split one task into several — that adds load, it doesn't reduce it. Each remaining day must end up with the same number of tasks or fewer than it has now. Don't punish the user, just make it lighter.",
  regenerate:
    "Throw out the current remaining tasks and generate a fresh, different set of tasks for the remaining days.",
  availability:
    "The user's available time for the rest of the week has changed. Re-distribute the remaining tasks to fit the new available time — adjust durations and drop or keep whole tasks rather than fragmenting them.",
};

// What each steering action teaches us about how this user likes to work.
// Written as a `preference` memory so future planning starts closer to
// what they'd have adjusted it to anyway.
const PREFERENCE_SIGNAL: Record<string, string> = {
  lighter: "Asked the AI to lighten a weekly plan — may prefer a lower task load than proposed",
  regenerate: "Regenerated a whole weekly plan — the proposal missed what they wanted",
  availability: "Adjusted their stated availability mid-plan — capacity estimates may be off",
};

// Whole-plan AI changes always land here — quick-action chips, a chosen
// strategy, and the guide's plan proposals alike. The result is ALWAYS a
// proposed revision the user previews and applies; no AI-driven rewrite of
// a whole week takes effect without being seen first, draft or active.
// (Single-task Edit/Replace/Remove bypass this route entirely and apply
// immediately — that's direct manipulation, not an AI rewrite.)
export async function POST(request: Request) {
  const { plan_id, mountain_id, action, available_time, instruction } = await request.json();

  const isFreeform = action === "custom" || action === "strategy";
  if (!plan_id || !mountain_id || !action || (!isFreeform && !ACTION_INSTRUCTIONS[action])) {
    return Response.json(
      { error: "plan_id, mountain_id, and a valid action are required" },
      { status: 400 }
    );
  }
  if (isFreeform && !instruction?.trim()) {
    return Response.json(
      { error: `instruction is required for action: "${action}"` },
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

  const row = planRow as PlanRow;
  const schedule: PlanDay[] = row.plan?.schedule || [];
  const finishedDays = schedule.filter((d) => d.finished);
  const openDays = schedule.filter((d) => !d.finished);

  if (!openDays.length) {
    return Response.json({ error: "Nothing left in this week to revise" }, { status: 400 });
  }

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];
  const directive =
    action === "strategy"
      ? `The user chose a new strategy for the rest of this week: "${instruction.trim()}". Reshape the remaining days to follow that strategy — reorder, retime, drop, or add tasks as that strategy actually requires. Keep anything that already serves it.`
      : isFreeform
        ? instruction.trim()
        : ACTION_INSTRUCTIONS[action];

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain, making a targeted revision to an existing weekly plan in response to a single user reaction (a one-click "steer" action or a short request from the guide conversation, not an open-ended replan).

Instruction: ${directive}

Rules:
- Only revise the days listed under "Days to revise" — return exactly that set of day names, nothing more, nothing less.
- Never reference or reintroduce the finished/locked days — those are done and out of scope.
- Change only what the instruction actually calls for. For any task that should survive the change, REUSE ITS EXACT ORIGINAL TEXT, character for character — the user is shown a precise before/after diff, and needlessly rewording an unchanged task makes it look like work was removed and replaced.
- Do not split one task into several, and do not merge several into one, unless the instruction explicitly asks for that.
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
  const revisedDays: { day: string; tasks: PlanDay["tasks"] }[] = result.schedule || [];
  const proposedSchedule = mergeKeepingFinished(schedule, revisedDays as PlanDay[]);
  const note = result.note || "Plan updated";

  // Preference signal — recorded when the change is requested, whether or
  // not the user ends up applying it. Asking is itself the signal.
  const signal =
    action === "strategy"
      ? `Chose the strategy "${instruction.trim().slice(0, 120)}" for a weekly plan`
      : action === "custom"
        ? `Asked the AI to adjust a weekly plan: "${instruction.trim().slice(0, 160)}"`
        : PREFERENCE_SIGNAL[action];
  if (signal) {
    const content = available_time ? `${signal} (stated availability: ${available_time})` : signal;
    // Repeating the same steer is the signal getting stronger, not a new
    // preference — bump the existing row instead of stacking duplicates
    // that would crowd out other context.
    const { data: existing } = await supabase
      .from("memory")
      .select("id")
      .eq("mountain_id", mountain_id)
      .eq("category", "preference")
      .eq("content", content)
      .limit(1);

    if (existing?.length) {
      await supabase
        .from("memory")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existing[0].id)
        .then(undefined, () => {});
    } else {
      await supabase
        .from("memory")
        .insert({
          mountain_id,
          category: "preference",
          content,
          metadata: { source: "plan_steering", action },
        })
        .then(undefined, () => {});
    }
  }

  // Always propose, never overwrite — the current schedule stays exactly as
  // it is until the user applies the revision. This holds for drafts too:
  // a draft the user has already hand-tuned is theirs, and an AI rewrite of
  // it deserves the same "see it before it lands" treatment as an active week.
  const diff = diffSchedules(schedule, proposedSchedule);
  if (isEmptyDiff(diff)) {
    return Response.json({ ...row, mode: "unchanged", note: "No changes needed — your plan already fits." });
  }

  const { data, error } = await supabase
    .from("weekly_plans")
    .update({
      plan: {
        ...row.plan,
        pending_revision: {
          schedule: proposedSchedule,
          focus_area: result.focus_area || row.plan?.focus_area,
          priority_recommendation: result.priority_recommendation || row.priority_recommendation,
          note,
          diff,
          created_at: new Date().toISOString(),
        },
      },
    })
    .eq("id", plan_id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ...data, mode: "revision", note, diff });
}
