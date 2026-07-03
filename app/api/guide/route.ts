import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { message, mountain_id, conversation_history, initial_context } =
    await request.json();

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const isAllMountains = !mountain_id || mountain_id === "all";

  let systemContext = "";
  let milestones: { name: string; completed: boolean; current?: boolean }[] = [];
  let currentMilestoneIndex = 0;

  if (isAllMountains) {
    const { data: mountains } = await supabase
      .from("mountains")
      .select("id, goal, summit, progress, current_milestone_index, milestones")
      .order("created_at", { ascending: false });

    const { data: allMemories } = await supabase
      .from("memory")
      .select("content, category, mountain_id")
      .order("created_at", { ascending: false })
      .limit(30);

    systemContext = `You are the AI Guide for Goal Mountain — a single companion who helps users navigate all their goals.

Current context: ALL MOUNTAINS (cross-mountain strategy mode)

The user's mountains:
${JSON.stringify(
  mountains?.map((m) => ({
    goal: m.goal,
    summit: m.summit,
    progress: m.progress,
    currentStage: m.milestones[m.current_milestone_index]?.name || "Getting started",
    totalMilestones: m.milestones.length,
    completedMilestones: m.milestones.filter((ms: { completed: boolean }) => ms.completed).length,
  })) || []
)}

Known patterns across all goals:
${allMemories?.map((m) => m.content).join("; ") || "None yet"}`;
  } else {
    const { data: mountain } = await supabase
      .from("mountains")
      .select("*")
      .eq("id", mountain_id)
      .single();

    if (!mountain) {
      return Response.json({ error: "Mountain not found" }, { status: 404 });
    }

    milestones = mountain.milestones;
    currentMilestoneIndex = mountain.current_milestone_index;

    const { data: memories } = await supabase
      .from("memory")
      .select("content, category")
      .eq("mountain_id", mountain_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: recentPlan } = await supabase
      .from("weekly_plans")
      .select("plan, priority_recommendation, next_best_action, strategy_notes")
      .eq("mountain_id", mountain_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: recentReflection } = await supabase
      .from("reflections")
      .select("summary, lessons_learned, blockers, adjustments")
      .eq("mountain_id", mountain_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: recentLogs } = await supabase
      .from("progress_logs")
      .select("log_type, data, created_at")
      .eq("mountain_id", mountain_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const currentMilestone = mountain.milestones[mountain.current_milestone_index];
    const nextMilestone = mountain.milestones[mountain.current_milestone_index + 1];

    systemContext = `You are the AI Guide for Goal Mountain — a single companion who helps users navigate their goals.

Current context: ${mountain.goal}

Mountain details:
- Goal: ${mountain.goal}
- Summit: ${mountain.summit}
- Progress: ${mountain.progress}%
- Current stage: ${currentMilestone?.name || "Getting started"} — ${currentMilestone?.description || ""}
- Next stage: ${nextMilestone?.name || "Summit"} — ${nextMilestone?.description || ""}
- Target date: ${mountain.race_date || "Not set"}
- Milestones completed: ${mountain.milestones.filter((m: { completed: boolean }) => m.completed).length} / ${mountain.milestones.length}

${recentPlan?.[0] ? `Current plan:\n- Priority: ${recentPlan[0].priority_recommendation}\n- Next action: ${recentPlan[0].next_best_action}\n- Strategy: ${recentPlan[0].strategy_notes}` : "No plan generated yet."}

${recentReflection?.[0] ? `Latest reflection:\n- Summary: ${recentReflection[0].summary}\n- Blockers: ${JSON.stringify(recentReflection[0].blockers)}` : "No reflections yet."}

Recent activity:
${JSON.stringify(recentLogs?.map((l) => ({ type: l.log_type, data: l.data, date: l.created_at })) || [])}

User patterns from memory:
${memories?.map((m) => `[${m.category}] ${m.content}`).join("\n") || "None yet"}`;
  }

  const actionDocs = isAllMountains
    ? `Available actions (only include when clearly appropriate):
- { "type": "store_memory", "category": "motivation|obstacle|behavior_pattern|preference", "content": "plain text insight to remember" }`
    : `Available actions (only include when clearly appropriate):
- { "type": "store_memory", "category": "motivation|obstacle|behavior_pattern|preference", "content": "plain text insight to remember" }
- { "type": "advance_milestone" } — only when the user explicitly confirms they completed the current stage or want to move forward
- { "type": "log_progress", "log_type": "activity|missed_activity", "description": "what happened" } — when the user tells you what they did or missed today
- { "type": "propose_plan", "user_constraints": "...", "available_time": "..." } — when the user wants to adjust their schedule, change their pace, or update their plan. Extract their constraints and available time from the conversation. Your reply should end with a preview message like "I'll put together an updated plan — does this look good?"
`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `${systemContext}

Rules:
- You are ONE guide — speak with continuity and personality
- Be warm, direct, and specific — never generic
- Reference the user's actual data, not hypotheticals
- Keep responses concise (2–4 short paragraphs max)
- If you recommend an action, be specific

${actionDocs}

Return a JSON object:
{
  "reply": "your conversational response to the user",
  "suggested_replies": ["up to 3 short reply options the user might want to send next — or empty array"],
  "actions": [] // array of action objects to execute, or empty array
}

Only include actions when the user has clearly expressed intent or given you information worth storing. Never fabricate actions. Memory should capture genuine insights about the user — not generic observations.`,
    },
  ];

  if (initial_context) {
    messages.push({
      role: "user",
      content: `[Context passed from another page: ${initial_context}]`,
    });
    messages.push({
      role: "assistant",
      content: JSON.stringify({
        reply: "I see what you're looking at. What would you like to discuss about this?",
        suggested_replies: [],
        actions: [],
      }),
    });
  }

  if (conversation_history?.length) {
    for (const msg of conversation_history) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.role === "user" ? msg.content : JSON.stringify({ reply: msg.content, suggested_replies: [], actions: [] }),
      });
    }
  }

  messages.push({ role: "user", content: message });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return Response.json({ error: "Failed to generate response" }, { status: 500 });
  }

  let parsed: { reply: string; suggested_replies: string[]; actions: Record<string, unknown>[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ reply: raw, suggested_replies: [], actions: [] });
  }

  const reply = parsed.reply || "";
  const suggestedReplies: string[] = Array.isArray(parsed.suggested_replies) ? parsed.suggested_replies.slice(0, 3) : [];
  const actions: Record<string, unknown>[] = Array.isArray(parsed.actions) ? parsed.actions : [];

  // Execute store_memory and log_progress actions server-side
  for (const action of actions) {
    if (action.type === "store_memory" && mountain_id && mountain_id !== "all") {
      await supabase.from("memory").insert({
        mountain_id,
        category: action.category || "behavior_pattern",
        content: action.content,
        metadata: { source: "guide" },
      });
    }

    if (action.type === "log_progress" && mountain_id && mountain_id !== "all") {
      await supabase.from("progress_logs").insert({
        mountain_id,
        log_type: action.log_type || "activity",
        data: { description: action.description || "", source: "guide" },
      });
    }
  }

  // Return client-side actions (advance_milestone and propose_plan need UI confirmation)
  const clientActions = actions
    .filter((a) => a.type === "advance_milestone" || a.type === "propose_plan")
    .map((a) => {
      if (a.type === "advance_milestone") {
        return { ...a, nextMilestoneName: milestones[currentMilestoneIndex + 1]?.name || "Summit" };
      }
      return a;
    });

  return Response.json({ reply, suggested_replies: suggestedReplies, actions: clientActions });
}
