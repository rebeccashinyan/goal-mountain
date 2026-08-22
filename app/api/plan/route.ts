import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import { activeHistory, effectivePlans, isActivePlan, WEEK_DAYS, type PlanRow } from "@/lib/plans";

export async function POST(request: Request) {
  const { mountain_id, available_time, user_constraints, week_start } =
    await request.json();

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data: mountain, error: fetchError } = await supabase
    .from("mountains")
    .select("*")
    .eq("id", mountain_id)
    .single();

  if (fetchError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  // Local calendar fields — toISOString() would convert to UTC and shift
  // the date back a day in timezones ahead of UTC.
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const currentWeekStart = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, "0")}-${String(currentMonday.getDate()).padStart(2, "0")}`;
  const weekStart = week_start || currentWeekStart;
  // Planning ahead of the real current week — the week being planned hasn't
  // happened yet, so there's nothing to reflect on.
  const isFutureWeek = weekStart > currentWeekStart;

  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayWeekdayIndex = (today.getDay() + 6) % 7; // 0=Monday ... 6=Sunday

  // The first day this plan can actually schedule tasks for. Generating
  // ahead of the real week, or right on its Monday, covers the full week —
  // generating mid-week only covers what's still ahead. Days that have
  // already passed must never receive tasks, in the AI's output or the UI.
  const planStartWeekdayIndex = weekStart === currentWeekStart ? todayWeekdayIndex : 0;
  const planStartDate = weekStart === currentWeekStart ? todayISO : weekStart;
  const remainingDayNames = WEEK_DAYS.slice(planStartWeekdayIndex);
  const skippedDayNames = WEEK_DAYS.slice(0, planStartWeekdayIndex);

  // Fetch generously, then narrow to real behavioural history: superseded
  // rows and never-started drafts are not evidence of how the user performs.
  const { data: planRows } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const allRows = (planRows || []) as PlanRow[];
  const pastPlans = activeHistory(allRows, 3);

  // An active week is revised through /api/plan/steer (which creates a
  // reviewable revision), never by silently stacking a fresh plan on top.
  const existingForWeek = effectivePlans(allRows).find((p) => p.week_start === weekStart);
  if (existingForWeek && isActivePlan(existingForWeek)) {
    return Response.json(
      {
        error: "This week already has an active plan. Use /api/plan/steer to propose a revision.",
        plan_id: existingForWeek.id,
      },
      { status: 409 }
    );
  }

  // Week rollover: if the previous plan hasn't been reflected on yet, run the
  // Reflection Agent first (auto mode) so this plan learns from that week.
  // Fires for every plan-generation path — form, guide chat, mini chat.
  if (pastPlans.length && !isFutureWeek) {
    const { data: latestReflections } = await supabase
      .from("reflections")
      .select("created_at")
      .eq("mountain_id", mountain_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const needsReflection =
      !latestReflections?.length ||
      new Date(latestReflections[0].created_at) < new Date(pastPlans[0].created_at);
    if (needsReflection) {
      try {
        await fetch(new URL("/api/reflect", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mountain_id, auto: true }),
        });
      } catch {
        // reflection is best-effort — planning proceeds without it
      }
    }
  }

  const { data: progressLogs } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(10);

  // `preference` carries what the user's own plan edits have taught us
  // (lightened weeks, hands-on swaps). Capped so accumulated signals can't
  // crowd out the rest of the context.
  const { data: memories } = await supabase
    .from("memory")
    .select("content, category")
    .eq("mountain_id", mountain_id)
    .in("category", ["motivation", "obstacle", "behavior_pattern", "preference"])
    .order("created_at", { ascending: false })
    .limit(25);

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];
  const previousPlan = pastPlans[0];

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Planning + Strategy Agent for Goal Mountain. You create adaptive plans and decide the highest-impact next action for any type of goal.

Your job:
- Generate a weekly schedule based on available time and current progress
- Adjust difficulty based on performance history
- Recommend what the user should focus on next
- Consider the user's energy, obstacles, and motivation patterns from memory
- Adapt your planning style to the goal type (fitness, career, learning, creative, financial, etc.)

Return a JSON object:
{
  "plan": {
    "schedule": [
      {
        "day": "Monday",
        "tasks": [
          { "task": "task description", "duration": "30 min", "priority": "high|medium|low" }
        ]
      }
    ],
    "focus_area": "what to focus on this week",
    "difficulty_level": "easy|moderate|challenging|intense"
  },
  "priority_recommendation": "the single most important thing to do this week and why",
  "next_best_action": "the very next thing the user should do right now",
  "strategy_notes": "broader strategic thinking about the user's trajectory",
  "what_changed": ["short phrases naming what you changed vs last week and why"]
}

Rules:
- If past plans exist, learn from what worked and what didn't
- If progress logs show missed activities, reduce load — don't punish
- If user is ahead of schedule, consider leveling up
- Distribute effort across the week, not front-loaded
- Rest and recovery days are strategic — include them when appropriate
- The "schedule" array must only contain "day" entries for days that have not passed yet this week — never a day that's already gone, not even as an empty or rest-day placeholder
- Be specific with tasks: "Complete chapter 3 exercises" not "Study more", "Write 500 words of case study draft" not "Work on portfolio"

About "what_changed" — this is shown to the user before they commit to the week, so they can see the plan adapted to their last week rather than being regenerated at random:
- ${previousPlan ? 'Write 2-4 SHORT phrases (under ~8 words each) naming concrete differences from last week and, where useful, the reason. Good: "Reduced 6 tasks to 4", "Shortened research sessions", "Moved portfolio work earlier", "Dropped Wednesday — missed it twice". Bad: long sentences, vague claims, or anything the data does not support.' : 'This is the user\'s FIRST week — there is no previous week to compare against. Return an empty array for what_changed.'}
- Never invent a change you did not actually make.`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Current camp: ${currentMilestone?.name || "Getting started"}
Progress: ${mountain.progress}%
Target date: ${mountain.race_date || "Not set"}
Week being planned: ${weekStart}${isFutureWeek ? " (being planned in advance, before this week starts)" : ""}
Available time: ${available_time || "Not specified"}
User constraints: ${user_constraints || "None"}
${skippedDayNames.length ? `\nIMPORTANT — this plan is being generated MID-WEEK, on ${WEEK_DAYS[todayWeekdayIndex]} (${todayISO}). ${skippedDayNames.join(", ")} ${skippedDayNames.length > 1 ? "have" : "has"} already passed — do NOT include ${skippedDayNames.length > 1 ? "them" : "it"} in "schedule" at all: no tasks, no empty entry, no rest-day placeholder. Only include "day" entries for: ${remainingDayNames.join(", ")}.\n${remainingDayNames.length <= 2 ? `Only ${remainingDayNames.length} day(s) remain this week — do NOT compress a full week of work into them. Generate a light, low-pressure "getting started" plan scoped realistically to just ${remainingDayNames.join(" and ")}. A complete plan for the rest of this camp follows next week.` : `Only ${remainingDayNames.length} days remain this week — scale total workload down to match that, rather than keeping full-week task density packed onto fewer days.`}` : ""}
${pastPlans.length ? `\nRecent plan history (weeks the user actually committed to and ran — never-started drafts are excluded): ${JSON.stringify(pastPlans.map((p) => ({ recommendation: p.priority_recommendation, notes: p.strategy_notes })))}` : ""}
${previousPlan ? `\nLAST WEEK'S ACTUAL SCHEDULE with per-task done/missed statuses and daily load feedback — base "what_changed" on the difference between this and the week you are about to write. If it has fewer than 7 days, that plan itself started mid-week; the missing days were never part of it and are not missed work: ${JSON.stringify(previousPlan.plan?.schedule || [])}` : ""}
${progressLogs?.length ? `\nRecent progress: ${JSON.stringify(progressLogs.map((l: { log_type: string; data: Record<string, unknown> }) => ({ type: l.log_type, data: l.data })))}` : ""}
${memories?.length ? `\nUser patterns: ${memories.map((m: { content: string }) => m.content).join("; ")}` : ""}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }

  const result = JSON.parse(content);

  // Deterministic backstop — the prompt asks the model not to schedule days
  // that have already passed, but a prompt-only rule isn't a guarantee (the
  // mountain-chat question budget taught the same lesson: models can count
  // correctly and still not stop on their own). Strip any anyway.
  if (skippedDayNames.length && Array.isArray(result.plan?.schedule)) {
    result.plan.schedule = result.plan.schedule.filter(
      (d: { day: string }) => !skippedDayNames.includes(d.day)
    );
  }

  // EVERY generated week starts as a draft — an AI proposal the user reviews
  // and adjusts before committing. Nothing is tracked until they start it,
  // so an untouched draft can never be misread as missed work.
  // `what_changed` only exists from the second week onward; for the first
  // week there's no previous week to have adapted from.
  const planToSave = {
    ...(result.plan || {}),
    status: "draft",
    what_changed: previousPlan ? result.what_changed || [] : [],
    plan_start_date: planStartDate,
  };

  const { data, error } = await supabase
    .from("weekly_plans")
    .insert({
      mountain_id,
      week_start: weekStart,
      plan: planToSave,
      priority_recommendation: result.priority_recommendation || "",
      next_best_action: result.next_best_action || "",
      strategy_notes: result.strategy_notes || "",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

// Update a plan in place — used by the daily check-in to persist per-task
// done/missed statuses, day finished flags, and load feedback, and by the
// quick-action steering + undo flow to persist revised schedules (and,
// when a steering action changes it, the priority recommendation text).
export async function PATCH(request: Request) {
  const { plan_id, plan, priority_recommendation } = await request.json();

  if (!plan_id || !plan) {
    return Response.json(
      { error: "plan_id and plan are required" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { plan };
  if (priority_recommendation !== undefined) {
    updates.priority_recommendation = priority_recommendation;
  }

  const { data, error } = await supabase
    .from("weekly_plans")
    .update(updates)
    .eq("id", plan_id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
