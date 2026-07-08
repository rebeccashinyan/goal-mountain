import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { mountain_id } = await request.json();

  if (!mountain_id) return Response.json({ created: false });

  // Check if a proactive message was already created today for this mountain
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await supabase
    .from("guide_chats")
    .select("id")
    .eq("mountain_id", mountain_id)
    .eq("type", "ai_proactive")
    .gte("created_at", `${today}T00:00:00Z`)
    .limit(1);

  if (existing && existing.length > 0) return Response.json({ created: false });

  // Gather context
  const { data: mountain } = await supabase.from("mountains").select("*").eq("id", mountain_id).single();
  if (!mountain) return Response.json({ created: false });

  const { data: recentLogs } = await supabase
    .from("progress_logs")
    .select("log_type, created_at")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(14);

  const { data: recentPlan } = await supabase
    .from("weekly_plans")
    .select("plan, next_best_action")
    .eq("mountain_id", mountain_id)
    .order("created_at", { ascending: false })
    .limit(1);

  // Detect conditions
  const lastLogDate = recentLogs?.[0]?.created_at;
  const daysSinceLastLog = lastLogDate
    ? Math.floor((Date.now() - new Date(lastLogDate).getTime()) / (1000 * 60 * 60 * 24))
    : 99;

  const missedCount = (recentLogs || []).filter((l) => l.log_type === "missed_activity").length;
  const recentActivityCount = (recentLogs || []).filter((l) => {
    const daysAgo = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7 && l.log_type === "activity";
  }).length;

  // Only create proactive message if there's something worth flagging
  const shouldNotify = daysSinceLastLog >= 3 || missedCount >= 2 || recentActivityCount === 0;
  if (!shouldNotify) return Response.json({ created: false });

  // Generate proactive message
  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the AI Guide for Goal Mountain. Generate a short, warm proactive check-in message based on the user's recent activity patterns.

Return JSON:
{
  "title": "short title for this notification (e.g. 'Progress Check', 'Missed Activities Detected', 'Time to Reconnect')",
  "message": "2-3 sentences. Be warm and specific. Reference the actual data. End with an open question or 2-3 options for the user.",
  "suggested_replies": ["up to 3 reply options"]
}

Keep it supportive, never judgmental.`,
      },
      {
        role: "user",
        content: `Goal: ${mountain.goal}
Progress: ${mountain.progress}%
Current stage: ${mountain.milestones[mountain.current_milestone_index]?.name || "Getting started"}
Days since last log: ${daysSinceLastLog}
Missed activities in last 14 logs: ${missedCount}
Activities logged this week: ${recentActivityCount}
Current plan next action: ${recentPlan?.[0]?.next_best_action || "Not set"}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: { title: string; message: string; suggested_replies: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ created: false });
  }

  // Create the proactive chat
  const { data: chat } = await supabase
    .from("guide_chats")
    .insert({
      mountain_id,
      title: parsed.title || "Check-in",
      type: "ai_proactive",
      unread: true,
      last_message: parsed.message.slice(0, 100),
    })
    .select()
    .single();

  if (!chat) return Response.json({ created: false });

  // Save the AI message
  await supabase.from("guide_messages").insert({
    chat_id: chat.id,
    role: "ai",
    content: parsed.message,
    suggested_replies: parsed.suggested_replies || [],
    actions: [],
  });

  return Response.json({ created: true, chat });
}
