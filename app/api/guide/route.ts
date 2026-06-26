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
    currentStage:
      m.milestones[m.current_milestone_index]?.name || "Getting started",
    totalMilestones: m.milestones.length,
    completedMilestones: m.milestones.filter(
      (ms: { completed: boolean }) => ms.completed
    ).length,
  })) || []
)}

Known patterns across all goals:
${allMemories?.map((m) => m.content).join("; ") || "None yet"}

In this mode you can:
- Help prioritize between mountains
- Identify which mountain needs attention
- Spot overcommitment risks
- Suggest where to invest limited time
- Provide life-strategy-level guidance`;
  } else {
    const { data: mountain } = await supabase
      .from("mountains")
      .select("*")
      .eq("id", mountain_id)
      .single();

    if (!mountain) {
      return Response.json({ error: "Mountain not found" }, { status: 404 });
    }

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

    const currentMilestone =
      mountain.milestones[mountain.current_milestone_index];

    systemContext = `You are the AI Guide for Goal Mountain — a single companion who helps users navigate their goals.

Current context: ${mountain.goal}

Mountain details:
- Goal: ${mountain.goal}
- Summit: ${mountain.summit}
- Progress: ${mountain.progress}%
- Current stage: ${currentMilestone?.name || "Getting started"} — ${currentMilestone?.description || ""}
- Target date: ${mountain.race_date || "Not set"}
- Milestones completed: ${mountain.milestones.filter((m: { completed: boolean }) => m.completed).length} / ${mountain.milestones.length}

${recentPlan?.[0] ? `Current plan:\n- Priority: ${recentPlan[0].priority_recommendation}\n- Next action: ${recentPlan[0].next_best_action}\n- Strategy: ${recentPlan[0].strategy_notes}` : "No plan generated yet."}

${recentReflection?.[0] ? `Latest reflection:\n- Summary: ${recentReflection[0].summary}\n- Blockers: ${JSON.stringify(recentReflection[0].blockers)}` : "No reflections yet."}

Recent activity:
${JSON.stringify(recentLogs?.map((l) => ({ type: l.log_type, data: l.data, date: l.created_at })) || [])}

User patterns from memory:
${memories?.map((m) => `[${m.category}] ${m.content}`).join("\n") || "None yet"}

In this mode you can:
- Coach on the current mountain
- Explain what to do next and why
- Help diagnose why the user is stuck
- Suggest plan adjustments
- Provide motivation based on their patterns`;
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      {
        role: "system",
        content: `${systemContext}

Rules:
- You are ONE guide, not a chatbot — speak with continuity and personality
- Be warm, direct, and specific — never generic
- Reference the user's actual data, not hypotheticals
- Keep responses concise (2-4 paragraphs max)
- If you recommend an action, be specific: "Complete the first case study draft by Wednesday" not "work on your portfolio"
- If you don't have enough data, say so and suggest what would help
- Never break character — you are their mountain guide`,
      },
    ];

  if (initial_context) {
    messages.push({
      role: "user",
      content: `[Context passed from another page: ${initial_context}]`,
    });
    messages.push({
      role: "assistant",
      content:
        "I see what you're looking at. What would you like to discuss about this?",
    });
  }

  if (conversation_history?.length) {
    for (const msg of conversation_history) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }
  }

  messages.push({ role: "user", content: message });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  const reply = completion.choices[0]?.message?.content;
  if (!reply) {
    return Response.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }

  return Response.json({ reply });
}
