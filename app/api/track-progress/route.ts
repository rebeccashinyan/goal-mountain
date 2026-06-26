import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { mountain_id, log_type, data: logData } = await request.json();

  if (!mountain_id || !log_type || !logData) {
    return Response.json(
      { error: "mountain_id, log_type, and data are required" },
      { status: 400 }
    );
  }

  const { data: mountain, error: fetchError } = await supabase
    .from("mountains")
    .select("*")
    .eq("id", mountain_id)
    .single();

  if (fetchError || !mountain) {
    return Response.json({ error: "Mountain not found" }, { status: 404 });
  }

  const { error: logError } = await supabase.from("progress_logs").insert({
    mountain_id,
    log_type,
    data: logData,
  });

  if (logError) {
    return Response.json({ error: logError.message }, { status: 500 });
  }

  const { data: recentLogs } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Progress Tracking Agent for Goal Mountain. You track the user's progress toward their summit for any type of goal.

Your job:
- Analyze activity logs, completed tasks, and progress data
- Calculate progress percentage toward the summit
- Check if any milestones should be marked as completed
- Detect trends (improving, maintaining, declining)
- Identify whether the user is ahead, on track, or falling behind
- Surface risk signals early

Return a JSON object:
{
  "progress_percentage": number (0-100),
  "current_camp": "name of current camp/milestone",
  "milestone_updates": [
    { "index": number, "should_complete": true, "reason": "why this milestone is now complete" }
  ],
  "trend": "ahead" | "on_track" | "behind",
  "trend_detail": "explanation of the trend",
  "risk_signals": ["list of risk signals if any"],
  "streak": { "current": number, "longest": number },
  "summary": "1-2 sentence progress summary for the user"
}

Rules:
- Be encouraging but honest about progress
- A missed day is not a crisis — look at weekly patterns
- Progress should reflect actual achievement, not just activity
- If multiple milestones are now complete, mark them all
- Risk signals should be actionable, not anxiety-inducing
- Adapt your analysis to the goal type — a career goal, a fitness goal, and a learning goal have different progress signals`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Summit: ${mountain.summit}
Milestones: ${JSON.stringify(mountain.milestones)}
Current milestone index: ${mountain.current_milestone_index}
Current progress: ${mountain.progress}%
Target date: ${mountain.race_date || "Not set"}

New log entry:
Type: ${log_type}
Data: ${JSON.stringify(logData)}

Recent activity (last 20 logs):
${JSON.stringify(recentLogs?.map((l: { log_type: string; data: Record<string, unknown>; created_at: string }) => ({ type: l.log_type, data: l.data, date: l.created_at })) || [])}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Failed to analyze progress" },
      { status: 500 }
    );
  }

  const analysis = JSON.parse(content);

  const updatedMilestones = [...mountain.milestones];
  let newMilestoneIndex = mountain.current_milestone_index;

  if (analysis.milestone_updates) {
    for (const update of analysis.milestone_updates) {
      if (
        update.should_complete &&
        update.index >= 0 &&
        update.index < updatedMilestones.length
      ) {
        updatedMilestones[update.index].completed = true;
        updatedMilestones[update.index].current = false;
        if (update.index >= newMilestoneIndex) {
          newMilestoneIndex = Math.min(
            update.index + 1,
            updatedMilestones.length - 1
          );
        }
      }
    }
    if (newMilestoneIndex < updatedMilestones.length) {
      updatedMilestones[newMilestoneIndex].current = true;
    }
  }

  const { error: updateError } = await supabase
    .from("mountains")
    .update({
      progress: analysis.progress_percentage ?? mountain.progress,
      current_milestone_index: newMilestoneIndex,
      milestones: updatedMilestones,
      updated_at: new Date().toISOString(),
    })
    .eq("id", mountain_id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json(analysis);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mountain_id = searchParams.get("mountain_id");

  if (!mountain_id) {
    return Response.json({ error: "mountain_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
