import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import type { PlanDay, PlanRow } from "@/lib/plans";

// "Change strategy" — instead of silently re-rolling the week, offer 2-3
// concrete, plan-aware directions the user can recognise and pick from.
// Choosing one goes to /api/plan/steer (action: "strategy"), which proposes
// a revision for preview. This route only reads.
export async function POST(request: Request) {
  const { plan_id, mountain_id } = await request.json();

  if (!plan_id || !mountain_id) {
    return Response.json({ error: "plan_id and mountain_id are required" }, { status: 400 });
  }

  const [{ data: planRow }, { data: mountain }] = await Promise.all([
    supabase.from("weekly_plans").select("*").eq("id", plan_id).single(),
    supabase.from("mountains").select("*").eq("id", mountain_id).single(),
  ]);

  if (!planRow) return Response.json({ error: "Plan not found" }, { status: 404 });
  if (!mountain) return Response.json({ error: "Mountain not found" }, { status: 404 });

  const row = planRow as PlanRow;
  const openDays: PlanDay[] = (row.plan?.schedule || []).filter((d) => !d.finished);
  const currentMilestone = mountain.milestones[mountain.current_milestone_index];
  const nextMilestone = mountain.milestones[mountain.current_milestone_index + 1];

  const { data: memories } = await supabase
    .from("memory")
    .select("content")
    .eq("mountain_id", mountain_id)
    .in("category", ["preference", "obstacle", "behavior_pattern"])
    .order("created_at", { ascending: false })
    .limit(15);

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain. The user wants to change the STRATEGY behind the rest of this week — not to re-roll it at random, but to pick a different emphasis.

Offer exactly 2 or 3 options. Each must be:
- A recognisable, concrete shift in emphasis that makes sense given the tasks actually in this plan right now — reference what's really there, not generic advice.
- Genuinely different from each other, and different from what the plan already does. Never offer the strategy the plan is already following.
- Written as a short imperative the user could have said themselves: "Start building sooner", "Spend less time planning", "Focus on getting clients sooner", "Practise out loud instead of reading".
- Realistic for the days that remain in the week.

Return JSON:
{ "strategies": [ { "label": "4-7 word imperative", "detail": "one short sentence on what would concretely change in this week's tasks" } ] }

Rules:
- label: under 40 characters, no trailing period.
- detail: one sentence, under ~110 characters, naming what would actually shift in these specific tasks.`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}${currentMilestone?.description ? ` — ${currentMilestone.description}` : ""}
Next camp: ${nextMilestone?.name || "Summit"}
Progress: ${mountain.progress}%

This week's focus: ${row.plan?.focus_area || "not set"}
Priority: ${row.priority_recommendation || "not set"}
Remaining days and their tasks: ${JSON.stringify(openDays)}
${memories?.length ? `\nWhat we know about this user: ${memories.map((m: { content: string }) => m.content).join("; ")}` : ""}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Failed to generate strategies" }, { status: 500 });
  }

  const result = JSON.parse(content);
  return Response.json({ strategies: (result.strategies || []).slice(0, 3) });
}
