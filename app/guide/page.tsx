"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  suggestedReplies?: string[];
  pendingActions?: PendingAction[];
}

interface PendingAction {
  type: "advance_milestone";
  nextMilestoneName: string;
}

interface PlanTask {
  task: string;
  duration?: string;
  priority?: string;
}

interface PlanDay {
  day: string;
  tasks: PlanTask[];
}

interface PlanProposal {
  id: string;
  plan: {
    schedule: PlanDay[];
    focus_area: string;
  };
  next_best_action: string;
  priority_recommendation: string;
  strategy_notes: string;
  confirmed: boolean;
}

interface MountainOption {
  id: string;
  goal: string;
}

function GuideContent() {
  const searchParams = useSearchParams();
  const paramMountainId = searchParams.get("mountain_id");
  const paramContext = searchParams.get("context");

  const [mountains, setMountains] = useState<MountainOption[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>("all");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [executingAction, setExecutingAction] = useState(false);
  const [planProposals, setPlanProposals] = useState<Record<string, PlanProposal>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialContextSent = useRef(false);

  const fetchMountains = useCallback(async () => {
    const res = await fetch("/api/mountains");
    if (res.ok) {
      const data = await res.json();
      setMountains(data);
      if (paramMountainId) setSelectedContext(paramMountainId);
    }
    setLoading(false);
  }, [paramMountainId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMountains();
  }, [fetchMountains]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading && paramContext && !initialContextSent.current) {
      initialContextSent.current = true;
      setMessages([{
        id: "ctx-0",
        role: "ai",
        content: "I see what you're looking at. What would you like to discuss about this?",
        suggestedReplies: [],
        pendingActions: [],
      }]);
    }
  }, [loading, paramContext]);

  async function sendMessage(text?: string, e?: React.FormEvent) {
    e?.preventDefault();
    const userMessage = (text ?? input).trim();
    if (!userMessage || sending) return;

    setInput("");
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: userMessage };

    // Clear suggested replies from the previous AI message
    setMessages((prev) => [
      ...prev.map((m) => m.role === "ai" ? { ...m, suggestedReplies: [], pendingActions: [] } : m),
      userMsg,
    ]);
    setSending(true);

    const history = messages
      .filter((m) => m.id !== "ctx-0")
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

    const body: Record<string, unknown> = {
      message: userMessage,
      mountain_id: selectedContext === "all" ? "all" : selectedContext,
      conversation_history: history,
    };

    if (paramContext && !initialContextSent.current) {
      body.initial_context = paramContext;
    }

    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const msgId = `a-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            role: "ai",
            content: data.reply,
            suggestedReplies: data.suggested_replies || [],
            pendingActions: (data.actions || []).filter((a: Record<string, unknown>) => a.type !== "propose_plan"),
          },
        ]);

        // Fetch plan in background for propose_plan actions
        const planAction = (data.actions || []).find((a: Record<string, unknown>) => a.type === "propose_plan");
        if (planAction && selectedContext !== "all") {
          fetchPlanProposal(msgId, planAction.user_constraints as string, planAction.available_time as string);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "ai", content: "Something went wrong. Try again.", suggestedReplies: [], pendingActions: [] },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "ai", content: "Something went wrong. Try again.", suggestedReplies: [], pendingActions: [] },
      ]);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  async function executeAdvanceMilestone(msgId: string, nextName: string) {
    if (executingAction || selectedContext === "all") return;
    setExecutingAction(true);

    try {
      const mountainRes = await fetch(`/api/mountains/${selectedContext}`);
      if (!mountainRes.ok) throw new Error();
      const mountain = await mountainRes.json();

      const updatedMilestones = [...mountain.milestones];
      const idx = mountain.current_milestone_index;

      if (updatedMilestones[idx]) {
        updatedMilestones[idx].completed = true;
        updatedMilestones[idx].current = false;
      }
      const nextIdx = Math.min(idx + 1, updatedMilestones.length - 1);
      if (updatedMilestones[nextIdx]) {
        updatedMilestones[nextIdx].current = true;
      }

      const completedCount = updatedMilestones.filter((m: { completed: boolean }) => m.completed).length;
      const progress = Math.round((completedCount / updatedMilestones.length) * 100);

      await fetch(`/api/mountains/${selectedContext}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_milestone_index: nextIdx,
          milestones: updatedMilestones,
          progress,
        }),
      });

      // Replace the pending action with a confirmation note
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, pendingActions: [], confirmedAction: `Advanced to: ${nextName}` as unknown as PendingAction[] }
            : m
        )
      );

      // Add a system note in chat
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "ai",
          content: `✓ Moved to **${nextName}**. Your mountain has been updated.`,
          suggestedReplies: ["What should I focus on now?", "Generate a new plan"],
          pendingActions: [],
        },
      ]);
    } catch {
      // silent fail
    }

    setExecutingAction(false);
  }

  async function fetchPlanProposal(msgId: string, userConstraints?: string, availableTime?: string) {
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mountain_id: selectedContext,
          user_constraints: userConstraints || undefined,
          available_time: availableTime || undefined,
        }),
      });
      if (!res.ok) return;
      const plan = await res.json();
      setPlanProposals((prev) => ({
        ...prev,
        [msgId]: { id: msgId, plan: plan.plan, next_best_action: plan.next_best_action, priority_recommendation: plan.priority_recommendation, strategy_notes: plan.strategy_notes, confirmed: false },
      }));
    } catch {
      // silent
    }
  }

  function confirmPlan(msgId: string) {
    setPlanProposals((prev) => ({
      ...prev,
      [msgId]: { ...prev[msgId], confirmed: true },
    }));
    // Plan is already saved by /api/plan POST — just send a confirmation message
    sendMessage("Looks good, let's go with this plan.");
  }

  function handleContextChange(value: string) {
    setSelectedContext(value);
    setMessages([]);
    initialContextSent.current = false;
  }

  const selectedLabel =
    selectedContext === "all"
      ? "All Mountains"
      : mountains.find((m) => m.id === selectedContext)?.goal || "Unknown";

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto mt-20 text-center">
        <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-stone-400 mt-3">Loading guide...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1180px] mx-auto mt-8 flex flex-col" style={{ height: "calc(100vh - 100px)" }}>
      {/* Header */}
      <div
        className="mb-5 flex flex-col gap-4 rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] px-6 py-5 md:flex-row md:items-center md:justify-between shrink-0"
        style={{ boxShadow: "0 10px 28px rgba(43, 58, 42, 0.08), 0 1px 2px rgba(43, 58, 42, 0.06)" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100 shrink-0"
            style={{ boxShadow: "0 8px 18px rgba(30,82,53,0.08)" }}
          >
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <circle cx="15" cy="15" r="11" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.6" />
              <path d="M15 5.5L18.1 12L24.5 15L18.1 18L15 24.5L11.9 18L5.5 15L11.9 12L15 5.5Z" fill="#E7B85B" stroke="#1E5235" strokeWidth="1.2" />
              <circle cx="15" cy="15" r="2.2" fill="#1E5235" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">AI Compass Guide</p>
            <h2 className="mt-1 text-3xl font-bold text-forest-950">Ask for your next best move</h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              One guide, different context. Choose all mountains for life strategy or one mountain for focused coaching.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-stone-400 uppercase tracking-[0.14em] shrink-0">Context</label>
          <select
            value={selectedContext}
            onChange={(e) => handleContextChange(e.target.value)}
            className="min-w-[220px] text-sm bg-white rounded-xl px-4 py-3 border border-stone-200 text-stone-700 font-semibold focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
          >
            <option value="all">All Mountains</option>
            {mountains.map((m) => (
              <option key={m.id} value={m.id}>{m.goal}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="flex-1 flex flex-col overflow-hidden rounded-3xl border border-[#E7E0D7] bg-white"
        style={{ boxShadow: "0 10px 28px rgba(43, 58, 42, 0.07)" }}
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 space-y-4">
          {messages.length === 0 && (
            <div className="mx-auto mt-14 max-w-3xl text-center">
              <div
                className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100"
                style={{ boxShadow: "0 8px 18px rgba(30,82,53,0.08)" }}
              >
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                  <circle cx="17" cy="17" r="12" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.6" />
                  <path d="M17 7L20.2 14L27 17L20.2 20L17 27L13.8 20L7 17L13.8 14L17 7Z" fill="#E7B85B" stroke="#1E5235" strokeWidth="1.2" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest-600">{selectedLabel}</p>
              <p className="mt-2 text-lg font-semibold text-stone-700">
                {selectedContext === "all"
                  ? "Ask about your overall strategy, priorities, or any mountain."
                  : `Ask about your ${selectedLabel} journey.`}
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(selectedContext === "all"
                  ? ["What should I prioritize?", "Am I taking on too much?", "Which mountain needs attention?"]
                  : ["What should I do next?", "Why am I stuck?", "How can I reach my summit faster?"]
                ).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="min-h-[72px] rounded-2xl border border-[#E7E0D7] bg-white px-4 py-3 text-left text-sm font-semibold leading-snug text-stone-700 transition-colors duration-200 hover:border-forest-300 hover:bg-forest-50 hover:text-forest-800 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} gap-2`}>
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                  msg.role === "user" ? "bg-forest-700 text-white" : "bg-white text-stone-800"
                }`}
                style={{
                  boxShadow: msg.role === "user"
                    ? "0 2px 8px rgba(20,60,35,0.2)"
                    : "0 1px 3px rgba(20,60,35,0.06)",
                }}
              >
                <p className="text-sm whitespace-pre-line leading-relaxed">{msg.content}</p>
              </div>

              {/* Pending milestone action */}
              {msg.role === "ai" && msg.pendingActions && msg.pendingActions.length > 0 && (
                <div className="max-w-[75%] w-full space-y-2">
                  {msg.pendingActions.map((action, i) =>
                    action.type === "advance_milestone" ? (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-100 shrink-0">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7L6 10L11 4" stroke="#1E5235" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-forest-700">Advance to: {action.nextMilestoneName}</p>
                          <p className="text-[11px] text-stone-500">This will mark your current stage complete</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => executeAdvanceMilestone(msg.id, action.nextMilestoneName)}
                          disabled={executingAction}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-forest-700 text-white hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] transition-colors duration-200"
                        >
                          {executingAction ? "..." : "Confirm"}
                        </button>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Plan proposal card */}
              {msg.role === "ai" && planProposals[msg.id] && (
                <div className="max-w-[75%] w-full">
                  {planProposals[msg.id].confirmed ? (
                    <div className="flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-xs font-semibold text-forest-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-200 text-forest-800 text-[10px]">✓</span>
                      Plan applied — your Overview has been updated.
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl border border-[#E7E0D7] bg-white overflow-hidden"
                      style={{ boxShadow: "0 4px 14px rgba(20,60,35,0.07)" }}
                    >
                      {/* Plan header */}
                      <div className="px-4 pt-4 pb-3 border-b border-[#F0ECE6]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-600 mb-0.5">New Plan</p>
                        <p className="text-sm font-semibold text-stone-800">{planProposals[msg.id].plan?.focus_area || planProposals[msg.id].priority_recommendation}</p>
                      </div>

                      {/* Schedule */}
                      <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
                        {planProposals[msg.id].plan?.schedule?.map((dayPlan, i) => (
                          <div key={i}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 mb-1">{dayPlan.day}</p>
                            <div className="space-y-1">
                              {dayPlan.tasks.map((task, j) => (
                                <div key={j} className="flex items-start gap-2">
                                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                                    task.priority === "high" ? "bg-summit" :
                                    task.priority === "medium" ? "bg-amber-400" : "bg-forest-400"
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-stone-700 leading-snug">{task.task}</p>
                                    {task.duration && <p className="text-[10px] text-stone-400">{task.duration}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {planProposals[msg.id].next_best_action && (
                          <div className="pt-2 border-t border-[#F0ECE6]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-600 mb-1">Start here</p>
                            <p className="text-xs text-stone-700">{planProposals[msg.id].next_best_action}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="px-4 pb-4 pt-3 border-t border-[#F0ECE6] flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmPlan(msg.id)}
                          className="flex-1 text-xs font-semibold py-2 rounded-lg bg-forest-700 text-white hover:bg-forest-600 active:scale-[0.97] transition-colors duration-200"
                          style={{ boxShadow: "0 2px 6px rgba(20,60,35,0.18)" }}
                        >
                          Looks good ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInput("Can you adjust the plan to ");
                            inputRef.current?.focus();
                          }}
                          className="flex-1 text-xs font-semibold py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 active:scale-[0.97] transition-colors duration-200"
                        >
                          Make changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Suggested replies */}
              {msg.role === "ai" && msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 max-w-[75%]">
                  {msg.suggestedReplies.map((reply, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(reply)}
                      disabled={sending}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border border-forest-200 bg-white text-forest-700 hover:bg-forest-50 hover:border-forest-300 active:scale-[0.97] disabled:opacity-40 transition-colors duration-200"
                      style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-5 py-3.5" style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}>
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={(e) => sendMessage(undefined, e)} className="border-t border-[#E7E0D7] bg-white p-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedContext === "all"
                  ? "Ask about your goals..."
                  : `Ask about ${selectedLabel}...`
              }
              disabled={sending}
              className="w-full bg-white rounded-2xl px-5 py-3.5 pr-12 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-60 transition-colors duration-200"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-forest-700 text-white flex items-center justify-center hover:bg-forest-600 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.2)" }}
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[800px] mx-auto mt-20 text-center">
          <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-400 mt-3">Loading guide...</p>
        </div>
      }
    >
      <GuideContent />
    </Suspense>
  );
}
