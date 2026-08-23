import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import { diffSchedules, WEEK_DAYS, type PlanDay, type PlanRow } from "@/lib/plans";

function addDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Commits a draft — the moment tracking becomes possible. If the draft has
// tasks on days that have already passed (started later than its own
// Monday, or than the day it was generated), those tasks are rescued in the
// same call: necessary ones moved to today or later, optional ones delayed
// or dropped, capped so today doesn't get overloaded. Only ever touches the
// affected span — days with nothing expired are untouched — and activates
// immediately after, with no separate confirmation step. If nothing has
// expired, this is just a plain draft-to-active flip.
export async function POST(request: Request) {
  const { plan_id, mountain_id } = await request.json();

  if (!plan_id || !mountain_id) {
    return Response.json({ error: "plan_id and mountain_id are required" }, { status: 400 });
  }

  const { data: planRow, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("id", plan_id)
    .single();

  if (planError || !planRow) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const row = planRow as PlanRow;
  if (row.plan?.status !== "draft") {
    return Response.json({ error: "Plan is not a draft" }, { status: 400 });
  }

  const { data: mountain, error: mountainError } = await supabase
    .from("mountains")
    .select("goal, summit, milestones, current_milestone_index")
    .eq("id", mountain_id)
    .single();

  if (mountainError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  // Local calendar date — consistent with how POST /api/plan computes "today".
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const schedule: PlanDay[] = row.plan?.schedule || [];
  const dateOf = (dayName: string) => addDaysISO(row.week_start, WEEK_DAYS.indexOf(dayName));

  const expiredDays = schedule.filter((d) => dateOf(d.day) < todayISO && (d.tasks || []).length > 0);
  // Every calendar day today-or-later THIS WEEK — not just ones the
  // original schedule happened to fill in. A day with no tasks yet (e.g.
  // an untouched Wednesday, or a Sunday the plan never scheduled) is a
  // perfectly valid place to land a rescued task, and must not be treated
  // as invalid just because it was empty before.
  const remainingDayNames = WEEK_DAYS.filter((day) => dateOf(day) >= todayISO);
  const onOrAfterDays = schedule.filter((d) => dateOf(d.day) >= todayISO);

  // Nothing to rescue — either starting on time, or starting into a week
  // that's already fully over with nowhere left this week to move work to
  // (an edge case outside normal use; the safest thing is to just drop it
  // rather than invent a day for it).
  if (!expiredDays.length || !remainingDayNames.length) {
    const newSchedule = onOrAfterDays;
    const { data, error } = await supabase
      .from("weekly_plans")
      .update({
        plan: {
          ...row.plan,
          status: "active",
          activated_from: todayISO,
          schedule: expiredDays.length ? newSchedule : schedule,
        },
      })
      .eq("id", plan_id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ...data, rebased: false });
  }

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain. The user is starting a weekly plan later than intended — some of its days have already passed without being started, and their tasks need to be rescued without dumping everything onto today.

For each task on an expired day, decide:
- Necessary / high-priority: still has to happen this week. Move it to today, or to a later day this week if today is already full. Never delete a necessary task.
- Optional / lower-value: may slip to a later day with room, or be dropped entirely if the week doesn't have room. Dropping optional work is the correct move when there's too much to fit — don't force everything in.

Today's resulting workload must stay close to what a normal day in this plan already looks like — do not overload today just because multiple days expired. Prefer spreading rescued tasks across open days (ones with no tasks listed below) over stacking them all on today. When moving a task, keep its task text, duration, and priority EXACTLY as they were — only the day changes. Never reword a task, never invent a new one, never touch a day that has no expired tasks and isn't receiving moved work. A rescued task MUST land on one of the days listed under "Remaining days" below — never on a day that isn't listed there, and never on an expired day.

Return a JSON object: { "schedule": [ { "day": "...", "tasks": [ { "task": "...", "duration": "...", "priority": "high|medium|low" } ] } ] } — include ONLY the days you changed (today, and any later day you moved something onto or already had). Omit every day you didn't touch.`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}
Today: ${WEEK_DAYS[(today.getDay() + 6) % 7]} (${todayISO})

Expired days — already passed, tasks need rescuing:
${JSON.stringify(expiredDays.map((d) => ({ day: d.day, date: dateOf(d.day), tasks: d.tasks })))}

Remaining days this week (today through Sunday) — every valid destination, including open ones with no tasks yet:
${JSON.stringify(
  remainingDayNames.map((day) => ({
    day,
    date: dateOf(day),
    tasks: onOrAfterDays.find((d) => d.day === day)?.tasks || [],
  }))
)}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Failed to rebase plan" }, { status: 500 });
  }

  const result = JSON.parse(content);

  // Deterministic backstop — the prompt says "only today or later", but
  // only a code-level filter guarantees an expired day can't sneak back in.
  // Any calendar day today-or-later is valid, whether or not it already
  // had tasks (an open day is a legitimate destination for rescued work).
  const validTargetDayNames = new Set(remainingDayNames);
  const changedDays: PlanDay[] = (result.schedule || []).filter(
    (d: { day: string }) => validTargetDayNames.has(d.day)
  );
  const changedDayNames = new Set(changedDays.map((d) => d.day));

  // Untouched remaining days keep their exact original tasks; touched days
  // (including a "today" that had no tasks before) take the model's output.
  const newSchedule: PlanDay[] = [
    ...onOrAfterDays.filter((d) => !changedDayNames.has(d.day)),
    ...changedDays.map((d) => ({ day: d.day, tasks: d.tasks || [] })),
  ].sort((a, b) => WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day));

  // Deterministic diff (never model-narrated) — same mechanism the steer
  // revision card uses — so the feedback message can't misreport itself.
  const diff = diffSchedules(schedule, newSchedule);

  const { data, error } = await supabase
    .from("weekly_plans")
    .update({
      plan: {
        ...row.plan,
        status: "active",
        activated_from: todayISO,
        schedule: newSchedule,
      },
    })
    .eq("id", plan_id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    ...data,
    rebased: true,
    moved: diff.moved.length,
    removed: diff.removed.length,
  });
}
