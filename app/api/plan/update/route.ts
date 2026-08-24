import { supabase } from "@/lib/supabase";
import {
  applyPlanOperations,
  diffSchedules,
  isEmptyDiff,
  type PlanDay,
  type PlanOperation,
  type PlanRow,
} from "@/lib/plans";

// A small, explicit, unambiguous edit ("move Thursday's task to Friday",
// "add a task Monday") applies immediately with an undo path — the same
// direct-manipulation tier inline Edit/Replace/Remove already use. Anything
// bigger, or anything the model itself wasn't sure was a direct instruction,
// still goes through the existing pending_revision preview used by
// /api/plan/steer, never applied blind.
const LOW_RISK_MAX_DAYS = 2;
const LOW_RISK_MAX_OPS = 4;

// Structured, task-level counterpart to /api/plan/steer: instead of asking
// the model to rewrite whole open days from a free-text instruction, the
// Guide Agent sends discrete add/remove/move/update/replace operations
// naming an exact existing task. Every operation is re-validated here
// against the CURRENT schedule before anything is written — a model saying
// "done" is never enough on its own (the same lesson this project has
// applied to mid-week plan generation, rebase, and Replace).
export async function POST(request: Request) {
  const { plan_id, mountain_id, operations, intent, note } = await request.json();

  if (!plan_id || !mountain_id || !Array.isArray(operations) || !operations.length) {
    return Response.json(
      { error: "plan_id, mountain_id, and a non-empty operations array are required" },
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

  const row = planRow as PlanRow;
  if (row.mountain_id !== mountain_id) {
    return Response.json({ error: "Plan does not belong to this mountain" }, { status: 403 });
  }

  const schedule: PlanDay[] = row.plan?.schedule || [];
  const result = applyPlanOperations(schedule, operations as PlanOperation[]);

  // No partial application: if any operation couldn't be validated, nothing
  // is written and nothing is claimed as done — the caller (the Guide chat)
  // surfaces these specifics instead of a generic failure.
  if (result.errors.length) {
    return Response.json(
      { error: "Couldn't apply these changes", details: result.errors },
      { status: 400 }
    );
  }

  const diff = diffSchedules(schedule, result.schedule);
  if (isEmptyDiff(diff)) {
    return Response.json({ ...row, mode: "unchanged", note: "No changes needed — your plan already matches that." });
  }

  const isLowRisk =
    intent === "apply" &&
    !result.overCapacityDays.length &&
    result.affectedDays.length <= LOW_RISK_MAX_DAYS &&
    (operations as PlanOperation[]).length <= LOW_RISK_MAX_OPS &&
    !row.plan?.pending_revision;

  const summaryNote =
    typeof note === "string" && note.trim()
      ? note.trim().slice(0, 200)
      : `${diff.added.length + diff.removed.length + diff.moved.length + diff.retimed.length} change(s) to ${result.affectedDays.join(", ") || "the plan"}`;

  if (isLowRisk) {
    const { data, error } = await supabase
      .from("weekly_plans")
      .update({ plan: { ...row.plan, schedule: result.schedule } })
      .eq("id", plan_id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ...data, mode: "applied", note: summaryNote, diff, previous_plan: row.plan });
  }

  // Same reviewable shape /api/plan/steer already writes — PlanView's
  // existing revision card renders this with no changes needed on its side.
  const { data, error } = await supabase
    .from("weekly_plans")
    .update({
      plan: {
        ...row.plan,
        pending_revision: {
          schedule: result.schedule,
          focus_area: row.plan?.focus_area,
          priority_recommendation: row.priority_recommendation,
          note: summaryNote,
          diff,
          created_at: new Date().toISOString(),
        },
      },
    })
    .eq("id", plan_id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ...data, mode: "revision", note: summaryNote, diff });
}
