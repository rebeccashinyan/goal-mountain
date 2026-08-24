import { openai } from "@/lib/openai";
import { supabase } from "@/lib/supabase";
import { effectivePlans, isoMondayOf, type PlanRow } from "@/lib/plans";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("guide_messages")
    .select("*")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chat_id } = await params;
  const { content, initial_context, plan_id } = await request.json();

  if (!content) return Response.json({ error: "content is required" }, { status: 400 });

  // Get chat to know its mountain context
  const { data: chat } = await supabase
    .from("guide_chats")
    .select("*")
    .eq("id", chat_id)
    .single();

  if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });

  // Save user message
  await supabase.from("guide_messages").insert({
    chat_id,
    role: "user",
    content,
  });

  // Load conversation history
  const { data: history } = await supabase
    .from("guide_messages")
    .select("role, content")
    .eq("chat_id", chat_id)
    .order("created_at", { ascending: true });

  const conversation_history = (history || [])
    .slice(0, -1) // exclude the message we just inserted
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

  // Build AI context
  const mountain_id = chat.mountain_id;
  const isAllMountains = !mountain_id;

  let systemContext = "";
  let milestones: { name: string; completed: boolean }[] = [];
  let currentMilestoneIndex = 0;
  // The plan the update_weekly_plan action would target — resolved once so
  // both the prompt and the returned action agree on which row it is.
  let contextPlan: PlanRow | null = null;

  if (isAllMountains) {
    const { data: mountains } = await supabase
      .from("mountains")
      .select("id, goal, summit, progress, current_milestone_index, milestones")
      .order("created_at", { ascending: false });

    const { data: allMemories } = await supabase
      .from("memory")
      .select("content, category")
      .order("created_at", { ascending: false })
      .limit(30);

    systemContext = `You are the AI Guide for Goal Mountain — a single companion who helps users navigate all their goals.
Context: ALL MOUNTAINS

Mountains: ${JSON.stringify(mountains?.map((m) => ({
  goal: m.goal, summit: m.summit, progress: m.progress,
  currentStage: m.milestones[m.current_milestone_index]?.name || "Getting started",
})) || [])}

Known patterns: ${allMemories?.map((m) => m.content).join("; ") || "None yet"}`;
  } else {
    const { data: mountain } = await supabase.from("mountains").select("*").eq("id", mountain_id).single();
    if (!mountain) return Response.json({ error: "Mountain not found" }, { status: 404 });

    milestones = mountain.milestones;
    currentMilestoneIndex = mountain.current_milestone_index;

    const [{ data: memories }, { data: planRows }, { data: recentReflection }, { data: recentLogs }] =
      await Promise.all([
        supabase.from("memory").select("content, category").eq("mountain_id", mountain_id).order("created_at", { ascending: false }).limit(20),
        supabase.from("weekly_plans").select("*").eq("mountain_id", mountain_id).order("created_at", { ascending: false }).limit(20),
        supabase.from("reflections").select("summary, blockers").eq("mountain_id", mountain_id).order("created_at", { ascending: false }).limit(1),
        supabase.from("progress_logs").select("log_type, data, created_at").eq("mountain_id", mountain_id).order("created_at", { ascending: false }).limit(10),
      ]);

    // The plan being discussed — a draft the user hasn't started counts too,
    // since that's exactly what "adjust this week's plan" usually means.
    // An explicit plan_id (the mini plan-talk chat always has one, since it
    // opens from a specific week on screen) wins over guessing "this week".
    const allPlanRows = (planRows || []) as PlanRow[];
    const effective = effectivePlans(allPlanRows);
    contextPlan =
      (plan_id ? allPlanRows.find((p) => p.id === plan_id) : null) ||
      effective.find((p) => p.week_start === isoMondayOf(new Date())) ||
      effective[0] ||
      null;

    const currentMilestone = mountain.milestones[mountain.current_milestone_index];
    const nextMilestone = mountain.milestones[mountain.current_milestone_index + 1];

    systemContext = `You are the AI Guide for Goal Mountain.
Context: ${mountain.goal}
- Summit: ${mountain.summit}
- Progress: ${mountain.progress}%
- Current stage: ${currentMilestone?.name || "Getting started"} — ${currentMilestone?.description || ""}
- Next stage: ${nextMilestone?.name || "Summit"}
- Target date: ${mountain.race_date || "Not set"}
- Milestones: ${mountain.milestones.filter((m: { completed: boolean }) => m.completed).length} / ${mountain.milestones.length} completed
${contextPlan ? `\nCurrent plan (${contextPlan.plan?.status === "draft" ? "DRAFT — not started yet" : "active"}, week of ${contextPlan.week_start}): Priority: ${contextPlan.priority_recommendation} | Next: ${contextPlan.next_best_action}
Current plan schedule (use EXACT task text from here in any update_weekly_plan operation — day "finished: true" is locked and cannot be edited): ${JSON.stringify(contextPlan.plan?.schedule || [])}` : "\nNo weekly plan exists yet for this mountain."}
${recentReflection?.[0] ? `\nLatest reflection: ${recentReflection[0].summary}` : ""}
Recent activity: ${JSON.stringify(recentLogs?.map((l) => ({ type: l.log_type, date: l.created_at })) || [])}
User patterns: ${memories?.map((m: { category: string; content: string }) => `[${m.category}] ${m.content}`).join("\n") || "None yet"}`;
  }

  const actionDocs = isAllMountains
    ? `Actions: { "type": "store_memory", "category": "motivation|obstacle|behavior_pattern|preference", "content": "..." }`
    : `Actions:
- { "type": "store_memory", "category": "motivation|obstacle|behavior_pattern|preference", "content": "..." }
- { "type": "advance_milestone" } — only when user explicitly confirms completing the current stage
- { "type": "log_progress", "log_type": "activity|missed_activity", "description": "..." }
- { "type": "propose_plan", "user_constraints": "...", "available_time": "..." } — ONLY when no plan exists yet for the relevant week, or the user explicitly wants an entirely new plan from scratch (a full reroll). If a current plan schedule is shown above, prefer update_weekly_plan instead.
- { "type": "update_weekly_plan", "intent": "apply" | "preview", "operations": [ { "op": "add", "day": "Thursday", "task": "...", "duration": "20 min", "priority": "medium" } | { "op": "remove", "day": "Monday", "task": "<exact existing task text>" } | { "op": "move", "day": "Thursday", "task": "<exact existing task text>", "to_day": "Friday" } | { "op": "update", "day": "Monday", "task": "<exact existing task text>", "duration": "30 min", "priority": "high" } | { "op": "replace", "day": "Monday", "task": "<exact existing task text>", "new_task": "...", "duration": "30 min" } ], "note": "one short sentence describing the change" }
  — use this whenever the user wants to add, remove, move, retime, reprioritize, or replace SPECIFIC task(s) in the current plan schedule shown above.
  Rules for this action:
  - Every operation's "task" (and "day") MUST be copied verbatim from the "Current plan schedule" above — never paraphrase, never invent a task that isn't listed, never target a day marked "finished": true.
  - Only emit this once you have a concrete, complete set of operations to propose — not while you're still asking clarifying questions.
  - "intent": "apply" ONLY when the user gave an explicit, unambiguous instruction to make the change now — e.g. "move it to Friday", "update the draft", "add a task Thursday for X", "yes, do that". Default to "intent": "preview" whenever the user is exploring a hypothetical ("what if...", "could I...", "how about...") or you are not fully certain which existing task(s) they mean — the app will show them a preview to confirm instead of changing anything blind.
  - The app validates and applies (or previews) this after your reply — it will tell the user the outcome. Never say "Updated!" or "Done!" in your own reply for this action; phrase it as proposing/working on it (e.g. "Got it — updating your draft now." or "Here's what I'd change — take a look below.").`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `${systemContext}

${actionDocs}

Return JSON: { "reply": "...", "suggested_replies": ["up to 3 short options"], "actions": [] }
Be warm, direct, specific. Reference real data. Keep replies concise (2–4 short paragraphs max).`,
    },
  ];

  if (initial_context) {
    messages.push({ role: "user", content: `[Context: ${initial_context}]` });
    messages.push({ role: "assistant", content: JSON.stringify({ reply: "I see what you're looking at. What would you like to discuss?", suggested_replies: [], actions: [] }) });
  }

  for (const msg of conversation_history) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.role === "user" ? msg.content : JSON.stringify({ reply: msg.content, suggested_replies: [], actions: [] }),
    });
  }

  messages.push({ role: "user", content });

  // Forward the client's abort signal so a stopped reply truly cancels the
  // model call and never gets written to the chat history
  let completion;
  try {
    completion = await openai.chat.completions.create(
      {
        model: "gpt-5-mini",
        response_format: { type: "json_object" },
        messages,
      },
      { signal: request.signal }
    );
  } catch (err) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    throw err;
  }

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: { reply: string; suggested_replies: string[]; actions: Record<string, unknown>[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reply: raw, suggested_replies: [], actions: [] };
  }

  const reply = parsed.reply || "";
  const suggestedReplies: string[] = Array.isArray(parsed.suggested_replies) ? parsed.suggested_replies.slice(0, 3) : [];
  const actions: Record<string, unknown>[] = Array.isArray(parsed.actions) ? parsed.actions : [];

  // Execute server-side actions
  for (const action of actions) {
    if (action.type === "store_memory" && mountain_id) {
      await supabase.from("memory").insert({
        mountain_id,
        category: action.category || "behavior_pattern",
        content: action.content,
        metadata: { source: "guide", chat_id },
      });
    }
    if (action.type === "log_progress" && mountain_id) {
      await supabase.from("progress_logs").insert({
        mountain_id,
        log_type: action.log_type || "activity",
        data: { description: action.description || "", source: "guide" },
      });
    }
  }

  // Client actions
  const clientActions = actions
    .filter((a) => a.type === "advance_milestone" || a.type === "propose_plan" || a.type === "update_weekly_plan")
    .map((a) => {
      if (a.type === "advance_milestone") {
        return { ...a, nextMilestoneName: milestones[currentMilestoneIndex + 1]?.name || "Summit" };
      }
      if (a.type === "update_weekly_plan") {
        // Resolved server-side from context, not the model — the model never
        // sees or names a plan_id, so it can't get it wrong.
        return contextPlan ? { ...a, plan_id: contextPlan.id } : null;
      }
      return a;
    })
    .filter((a): a is Record<string, unknown> => a !== null);

  // Save AI message
  await supabase.from("guide_messages").insert({
    chat_id,
    role: "ai",
    content: reply,
    suggested_replies: suggestedReplies,
    actions: clientActions,
  });

  // Update chat metadata
  await supabase.from("guide_chats").update({
    last_message: reply.slice(0, 100),
    updated_at: new Date().toISOString(),
  }).eq("id", chat_id);

  return Response.json({ reply, suggested_replies: suggestedReplies, actions: clientActions });
}
