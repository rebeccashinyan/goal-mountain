import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

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

  const { data: pastPlans } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(3);

  // Week rollover: if the previous plan hasn't been reflected on yet, run the
  // Reflection Agent first (auto mode) so this plan learns from that week.
  // Fires for every plan-generation path — form, guide chat, mini chat.
  if (pastPlans?.length && !isFutureWeek) {
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

  const { data: memories } = await supabase
    .from("memory")
    .select("content, category")
    .eq("mountain_id", mountain_id)
    .in("category", ["motivation", "obstacle", "behavior_pattern"]);

  const currentMilestone = mountain.milestones[mountain.current_milestone_index];

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
  "adjustments": ["list of adjustments made based on past performance"]
}

Rules:
- If past plans exist, learn from what worked and what didn't
- If progress logs show missed activities, reduce load — don't punish
- If user is ahead of schedule, consider leveling up
- Distribute effort across the week, not front-loaded
- Rest and recovery days are strategic — include them when appropriate
- Be specific with tasks: "Complete chapter 3 exercises" not "Study more", "Write 500 words of case study draft" not "Work on portfolio"`,
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
${pastPlans?.length ? `\nRecent plan history: ${JSON.stringify(pastPlans.map((p: { priority_recommendation: string; strategy_notes: string }) => ({ recommendation: p.priority_recommendation, notes: p.strategy_notes })))}` : ""}
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

  // The mountain's very first plan is shown as an editable draft the user
  // must explicitly start, rather than a live/tracked schedule — every
  // plan after that goes straight to active, since by then the user has
  // already been through onboarding once.
  const planToSave = { ...(result.plan || {}) };
  if (!pastPlans?.length) {
    planToSave.status = "draft";
  }

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

  return Response.json({ ...data, adjustments: result.adjustments || [] });
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
