"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { diffAffectedDayCount, type PlanDiff } from "@/lib/plans";

interface GuideChat {
  id: string;
  mountain_id: string | null;
  title: string;
  type: "user_initiated" | "ai_proactive";
  unread: boolean;
  last_message: string | null;
  created_at: string;
  updated_at: string;
}

interface GuideMessage {
  id: string;
  chat_id: string;
  role: "user" | "ai";
  content: string;
  suggested_replies: string[];
  actions: Record<string, unknown>[];
  created_at: string;
}

interface PlanDay {
  day: string;
  tasks: { task: string; duration?: string; priority?: string }[];
}

interface PlanProposal {
  plan: { schedule: PlanDay[]; focus_area: string };
  next_best_action: string;
  priority_recommendation: string;
  confirmed: boolean;
}

// One card, two mutually exclusive states — never both a "propose" and a
// "done" CTA at once:
// - "proposal": nothing has changed yet. Shows the diff plus Apply changes /
//   Keep discussing. Only reachable when the backend genuinely couldn't
//   apply directly (ambiguous, large, or the user was exploring a
//   hypothetical) — never a case the model itself decided.
// - "updated": the backend already wrote the change. Shows ✓ Draft updated
//   plus View updated plan / Undo (Undo only when a pre-change snapshot is
//   actually available — never a button that can't do anything).
// "neutral" is a reload-only fallback for an OLDER message whose proposal
// has since been superseded by a later one — nothing to act on, so it only
// ever states the fact, never claims success or asks for confirmation.
interface PlanUpdateCard {
  status: "proposal" | "updated" | "neutral" | "error";
  planId?: string;
  message: string;
  diff?: PlanDiff;
  previousPlan?: unknown;
  undone?: boolean;
  resolving?: boolean;
}

interface MountainOption {
  id: string;
  goal: string;
}

function GuideContent() {
  const searchParams = useSearchParams();
  const paramMountainId = searchParams.get("mountain_id");

  const [mountains, setMountains] = useState<MountainOption[]>([]);
  const [chats, setChats] = useState<GuideChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [executingAction, setExecutingAction] = useState(false);
  const [planProposals, setPlanProposals] = useState<Record<string, PlanProposal>>({});
  const [planUpdates, setPlanUpdates] = useState<Record<string, PlanUpdateCard>>({});
  const [selectedMountainId, setSelectedMountainId] = useState<string | null>(paramMountainId);
  const [showAllProactive, setShowAllProactive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMountains = useCallback(async () => {
    const res = await fetch("/api/mountains");
    if (res.ok) setMountains(await res.json());
  }, []);

  const fetchChats = useCallback(async () => {
    const res = await fetch("/api/chats");
    if (res.ok) {
      const data: GuideChat[] = await res.json();
      setChats(data);
    }
    setLoading(false);
  }, []);

  const checkProactive = useCallback(async (mountainId: string) => {
    await fetch("/api/proactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mountain_id: mountainId }),
    });
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    fetchMountains();
    fetchChats();
  }, [fetchMountains, fetchChats]);

  useEffect(() => {
    if (paramMountainId) {
      setSelectedMountainId(paramMountainId);
      checkProactive(paramMountainId);
    }
  }, [paramMountainId, checkProactive]);

  // Expanded from the on-page mini check-in chat — open that conversation
  const openedFromParam = useRef(false);
  useEffect(() => {
    const chatIdParam = searchParams.get("chat_id");
    if (!chatIdParam || openedFromParam.current) return;
    openedFromParam.current = true;
    loadChat(chatIdParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // A structured plan edit already ran (or was proposed) server-side the
  // moment it was sent — it doesn't wait for this chat to stay open.
  // Reloading a conversation (switching chats, refreshing the page) must
  // never make that look like nothing happened, but it also can't just
  // replay the model's original suggested_replies — those were written
  // before the backend decided apply vs. preview, so they can flatly
  // contradict what actually happened (the exact bug this card replaces).
  // Only the MOST RECENT message touching a given plan can still be a real,
  // actionable proposal (a plan holds at most one pending_revision, and a
  // later proposal always supersedes an earlier one) — so that one gets a
  // live-checked, fully working card; anything earlier gets a neutral,
  // non-committal note.
  async function reconstructPlanUpdateCards(msgs: GuideMessage[]) {
    const updateMsgs = msgs
      .map((m) => ({ m, action: (m.actions || []).find((a) => (a as { type?: string })?.type === "update_weekly_plan") }))
      .filter((x): x is { m: GuideMessage; action: Record<string, unknown> } => !!x.action);
    if (!updateMsgs.length) return;

    const latestByPlan = new Map<string, GuideMessage>();
    for (const { m, action } of updateMsgs) {
      const planId = action.plan_id as string | undefined;
      if (!planId) continue;
      const existing = latestByPlan.get(planId);
      if (!existing || new Date(m.created_at) > new Date(existing.created_at)) latestByPlan.set(planId, m);
    }

    const cards: Record<string, PlanUpdateCard> = {};
    for (const { m } of updateMsgs) {
      cards[m.id] = { status: "neutral", message: "This message proposed a plan change." };
    }

    const chatId = msgs[0]?.chat_id;
    const mountainId = selectedMountainId || chats.find((c) => c.id === chatId)?.mountain_id;
    const planRows = mountainId
      ? await fetch(`/api/plan?mountain_id=${mountainId}`).then((r) => (r.ok ? r.json() : [])).catch(() => [])
      : [];

    for (const [planId, msg] of latestByPlan) {
      const row = (planRows as { id: string; plan: { pending_revision?: { note?: string; diff?: PlanDiff } } }[])
        .find((r) => r.id === planId);
      cards[msg.id] = row?.plan?.pending_revision
        ? {
            status: "proposal",
            planId,
            message: row.plan.pending_revision.note || "Proposed changes to your plan.",
            diff: row.plan.pending_revision.diff,
          }
        : { status: "updated", planId, message: "✓ Draft updated." };
    }

    setPlanUpdates(cards);
  }

  async function loadChat(chatId: string) {
    setSelectedChatId(chatId);
    setMessagesLoading(true);
    setPlanProposals({});
    setPlanUpdates({});

    const res = await fetch(`/api/chats/${chatId}/messages`);
    if (res.ok) {
      const data: GuideMessage[] = await res.json();
      setMessages(data);
      await reconstructPlanUpdateCards(data);
    }

    // Mark as read
    setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, unread: false } : c));
    setMessagesLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function createNewChat() {
    const title = selectedMountainId
      ? `Chat — ${mountains.find((m) => m.id === selectedMountainId)?.goal?.slice(0, 30) || "Mountain"}`
      : "Chat — All Mountains";

    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mountain_id: selectedMountainId || null, title, type: "user_initiated" }),
    });

    if (res.ok) {
      const chat: GuideChat = await res.json();
      setChats((prev) => [chat, ...prev]);
      setMessages([]);
      setSelectedChatId(chat.id);
      setPlanProposals({});
      setPlanUpdates({});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function sendMessage(text?: string) {
    const userContent = (text ?? input).trim();
    if (!userContent || sending || !selectedChatId) return;

    setInput("");
    setSending(true);

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev.map((m) => ({ ...m, suggested_replies: [] })), {
      id: tempId, chat_id: selectedChatId, role: "user", content: userContent,
      suggested_replies: [], actions: [], created_at: new Date().toISOString(),
    }]);

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`/api/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userContent }),
        signal: abortRef.current.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsgId = `ai-${Date.now()}`;

        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId, chat_id: selectedChatId, role: "ai", content: data.reply,
            suggested_replies: data.suggested_replies || [],
            actions: (data.actions || []).filter(
              (a: Record<string, unknown>) => a.type !== "propose_plan" && a.type !== "update_weekly_plan"
            ),
            created_at: new Date().toISOString(),
          },
        ]);

        // Handle a structured, task-level plan edit — explicit + low-risk
        // applies immediately (with undo); anything larger or ambiguous
        // comes back as a reviewable revision instead.
        const updateAction = (data.actions || []).find((a: Record<string, unknown>) => a.type === "update_weekly_plan");
        if (updateAction && Array.isArray(updateAction.operations) && updateAction.operations.length && selectedMountainId) {
          applyWeeklyPlanUpdate(aiMsgId, updateAction as {
            plan_id?: string; intent?: string; operations: unknown[]; note?: string;
          });
        } else {
          // Handle a full-plan proposal (only when no structured edit fired)
          const planAction = (data.actions || []).find((a: Record<string, unknown>) => a.type === "propose_plan");
          if (planAction && selectedMountainId) {
            fetchPlanProposal(aiMsgId, planAction.user_constraints as string, planAction.available_time as string);
          }
        }

        // Refresh chat list to update last_message
        fetchChats();
      }
    } catch {
      // silent
    }

    setSending(false);
    inputRef.current?.focus();
  }

  async function fetchPlanProposal(msgId: string, userConstraints?: string, availableTime?: string) {
    if (!selectedMountainId) return;
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mountain_id: selectedMountainId, user_constraints: userConstraints, available_time: availableTime }),
      });
      if (!res.ok) return;
      const plan = await res.json();
      setPlanProposals((prev) => ({ ...prev, [msgId]: { plan: plan.plan, next_best_action: plan.next_best_action, priority_recommendation: plan.priority_recommendation, confirmed: false } }));
    } catch { /* silent */ }
  }

  function confirmPlan(msgId: string) {
    setPlanProposals((prev) => ({ ...prev, [msgId]: { ...prev[msgId], confirmed: true } }));
    sendMessage("Looks good, let's go with this plan.");
  }

  // Runs the structured task-level edit the guide proposed. The backend —
  // not the model's own claim — decides whether it was safe to apply
  // directly; this only ever renders the ACTUAL outcome of that call, and
  // the two outcomes are mutually exclusive: either it's already done
  // ("updated") or it's waiting on a decision ("proposal"), never both.
  async function applyWeeklyPlanUpdate(
    msgId: string,
    action: { plan_id?: string; intent?: string; operations: unknown[]; note?: string }
  ) {
    if (!selectedMountainId || !action.plan_id) return;
    try {
      const res = await fetch("/api/plan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: action.plan_id,
          mountain_id: selectedMountainId,
          operations: action.operations,
          intent: action.intent,
          note: action.note,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPlanUpdates((prev) => ({
          ...prev,
          [msgId]: { status: "error", message: err.details?.[0] || err.error || "Couldn't apply that change." },
        }));
        return;
      }

      const data = await res.json();
      if (data.mode === "applied") {
        const days = diffAffectedDayCount(data.diff);
        setPlanUpdates((prev) => ({
          ...prev,
          [msgId]: {
            status: "updated",
            planId: action.plan_id,
            message: `✓ Draft updated — ${days} day${days === 1 ? "" : "s"} affected.`,
            previousPlan: data.previous_plan,
          },
        }));
      } else if (data.mode === "revision") {
        setPlanUpdates((prev) => ({
          ...prev,
          [msgId]: {
            status: "proposal",
            planId: action.plan_id,
            message: data.note || "Proposed changes to your plan.",
            diff: data.diff,
          },
        }));
      } else {
        setPlanUpdates((prev) => ({
          ...prev,
          [msgId]: { status: "updated", planId: action.plan_id, message: data.note || "Your plan already matches that — nothing changed." },
        }));
      }
    } catch {
      setPlanUpdates((prev) => ({
        ...prev,
        [msgId]: { status: "error", message: "Couldn't reach the plan just now — try again in a moment." },
      }));
    }
  }

  // "Apply changes" on a proposal card — resolves the SAME pending_revision
  // /api/plan/steer or the guide already created, through the normal
  // /api/plan/revision endpoint (no new mutation path). A pre-apply snapshot
  // is captured first purely so this path can offer Undo too, on the same
  // terms as a direct low-risk apply.
  async function applyProposalInChat(msgId: string) {
    const card = planUpdates[msgId];
    if (!card?.planId || card.resolving || !selectedMountainId) return;
    setPlanUpdates((prev) => ({ ...prev, [msgId]: { ...prev[msgId], resolving: true } }));
    try {
      const rows = await fetch(`/api/plan?mountain_id=${selectedMountainId}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      const previousPlan = (rows as { id: string; plan: unknown }[]).find((r) => r.id === card.planId)?.plan;

      const res = await fetch("/api/plan/revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: card.planId, decision: "apply" }),
      });
      if (!res.ok) {
        setPlanUpdates((prev) => ({ ...prev, [msgId]: { status: "error", message: "Couldn't apply those changes — try again in a moment." } }));
        return;
      }
      const days = card.diff ? diffAffectedDayCount(card.diff) : undefined;
      setPlanUpdates((prev) => ({
        ...prev,
        [msgId]: {
          status: "updated",
          planId: card.planId,
          message: `✓ Draft updated${days !== undefined ? ` — ${days} day${days === 1 ? "" : "s"} affected` : ""}.`,
          previousPlan,
        },
      }));
    } catch {
      setPlanUpdates((prev) => ({ ...prev, [msgId]: { status: "error", message: "Couldn't apply those changes — try again in a moment." } }));
    }
  }

  // "Keep discussing" — the user isn't deciding right now. The pending
  // revision itself is left exactly as-is (still resolvable later from the
  // plan page's own Apply/Keep current plan card); this only dismisses the
  // transient chat card so it stops presenting a stale decision point.
  function dismissProposal(msgId: string) {
    setPlanUpdates((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
  }

  async function undoWeeklyPlanUpdate(msgId: string) {
    const update = planUpdates[msgId];
    if (!update?.planId) return;
    try {
      await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: update.planId, plan: update.previousPlan }),
      });
      setPlanUpdates((prev) => ({ ...prev, [msgId]: { ...prev[msgId], undone: true } }));
    } catch {
      // best-effort — leave the confirmation card as-is on failure
    }
  }

  async function executeAdvanceMilestone(msgId: string, nextName: string) {
    if (executingAction || !selectedMountainId) return;
    setExecutingAction(true);
    try {
      const mountainRes = await fetch(`/api/mountains/${selectedMountainId}`);
      if (!mountainRes.ok) throw new Error();
      const mountain = await mountainRes.json();
      const updated = [...mountain.milestones];
      const idx = mountain.current_milestone_index;
      if (updated[idx]) { updated[idx].completed = true; updated[idx].current = false; }
      const nextIdx = Math.min(idx + 1, updated.length - 1);
      if (updated[nextIdx]) updated[nextIdx].current = true;
      const progress = Math.round((updated.filter((m: { completed: boolean }) => m.completed).length / updated.length) * 100);
      await fetch(`/api/mountains/${selectedMountainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_milestone_index: nextIdx, milestones: updated, progress }),
      });
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, actions: [] } : m));
      const confirmId = `sys-${Date.now()}`;
      setMessages((prev) => [...prev, {
        id: confirmId, chat_id: selectedChatId!, role: "ai",
        content: `✓ Advanced to **${nextName}**. Your mountain has been updated.`,
        suggested_replies: ["What should I focus on now?", "Generate a new plan"],
        actions: [], created_at: new Date().toISOString(),
      }]);
    } catch { /* silent */ }
    setExecutingAction(false);
  }

  // Sidebar follows the context selector: a specific mountain shows only its
  // conversations; "All Mountains" shows everything
  const contextChats = selectedMountainId
    ? chats.filter((c) => c.mountain_id === selectedMountainId)
    : chats;
  const proactiveChats = contextChats.filter((c) => c.type === "ai_proactive");
  const userChats = contextChats.filter((c) => c.type === "user_initiated");

  async function deleteChat(chatId: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/chats?id=${chatId}`, { method: "DELETE" });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setMessages([]);
        setPlanProposals({});
      }
    }
  }

  const PROACTIVE_PREVIEW = 4;
  const filteredProactive = search
    ? proactiveChats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : proactiveChats;
  const visibleProactive =
    search || showAllProactive ? filteredProactive : filteredProactive.slice(0, PROACTIVE_PREVIEW);
  const hiddenProactiveCount = filteredProactive.length - visibleProactive.length;
  const filteredUser = search
    ? userChats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : userChats;

  const selectedChat = chats.find((c) => c.id === selectedChatId);
  const selectedMountainLabel = selectedChat?.mountain_id
    ? mountains.find((m) => m.id === selectedChat.mountain_id)?.goal
    : "All Mountains";

  return (
    <div className="max-w-[1180px] mx-auto flex flex-col gap-3 mt-4" style={{ height: "calc(100vh - 80px)" }}>

      {/* ── Header — plain text, no card ── */}
      <div className="flex flex-col gap-4 px-1 shrink-0 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-forest-950">AI Guide</h2>
          <p className="mt-1.5 text-base font-semibold text-stone-800">Ask for your next best move</p>
        </div>
        {/* Context selector */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Mountain</span>
          <select
            value={selectedMountainId || "all"}
            onChange={(e) => {
              const next = e.target.value === "all" ? null : e.target.value;
              setSelectedMountainId(next);
              // Close the open chat if it doesn't belong to the new context
              const current = chats.find((c) => c.id === selectedChatId);
              if (next && current && current.mountain_id !== next) {
                setSelectedChatId(null);
                setMessages([]);
                setPlanProposals({});
              }
            }}
            className="max-w-[320px] truncate text-sm font-semibold text-forest-900 bg-white rounded-xl border border-[#E7E0D7] px-4 py-2.5 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-100 transition-colors duration-200 cursor-pointer"
            style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
            title={mountains.find((m) => m.id === selectedMountainId)?.goal}
          >
            <option value="all">All Mountains</option>
            {mountains.map((m) => (
              <option key={m.id} value={m.id}>
                {m.goal.length > 48 ? m.goal.slice(0, 47).trimEnd() + "…" : m.goal}
              </option>
            ))}
          </select>
        </div>
      </div>

    <div className="flex flex-1 gap-0 overflow-hidden rounded-3xl bg-white"
      style={{ boxShadow: "0 6px 20px rgba(43,58,42,0.06), 0 1px 2px rgba(43,58,42,0.05)" }}>

      {/* ── Sidebar ── */}
      <div className="w-[240px] shrink-0 flex flex-col border-r border-stone-100 bg-[#F6F6F6]">
        {/* Top actions */}
        <div className="px-3 pt-4 pb-3 space-y-1.5">
          <button
            type="button"
            onClick={createNewChat}
            className="w-full text-left text-sm font-semibold text-forest-800 px-3 py-2 rounded-xl hover:bg-white hover:shadow-sm active:scale-[0.98] transition-all duration-150 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="#1E5235" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            New Chat
          </button>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full pl-8 pr-3 py-2 text-sm bg-white rounded-xl border border-stone-200 text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-100 transition-colors duration-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
          {/* Messages from AI */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 px-1 mb-1.5">Messages from AI</p>
            {filteredProactive.length === 0 ? (
              <p className="text-[11px] text-stone-400 px-1">No messages yet — the AI will reach out if it detects you&apos;re off track.</p>
            ) : (
              <div className="space-y-0.5">
                {visibleProactive.map((chat) => (
                  <div key={chat.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => loadChat(chat.id)}
                      className={`w-full text-left px-3 py-2.5 pr-8 rounded-xl transition-colors duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                        selectedChatId === chat.id ? "bg-white shadow-sm" : "hover:bg-white/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-stone-700 truncate">{chat.title}</p>
                        {chat.unread && <span className="w-2 h-2 rounded-full bg-[#E07A6E] shrink-0" />}
                      </div>
                      {chat.last_message && (
                        <p className="text-[11px] text-stone-400 truncate mt-0.5 leading-snug">{chat.last_message}</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChat(chat.id, chat.title)}
                      aria-label={`Delete ${chat.title}`}
                      className="absolute right-1.5 top-1.5 rounded-md p-1 text-stone-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-summit hover:bg-red-50 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-summit transition-colors duration-150"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
                {(hiddenProactiveCount > 0 || (!search && showAllProactive && filteredProactive.length > PROACTIVE_PREVIEW)) && (
                  <button
                    type="button"
                    onClick={() => setShowAllProactive(!showAllProactive)}
                    className="w-full px-3 py-1.5 text-left text-[11px] font-semibold text-forest-700 hover:text-forest-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-150"
                  >
                    {showAllProactive ? "Show less" : `Show ${hiddenProactiveCount} more`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* User Chats */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 px-1 mb-1.5">Chats</p>
            {filteredUser.length === 0 ? (
              <p className="text-[11px] text-stone-400 px-1">
                {search ? "No chats match your search." : "No chats yet. Click \"New Chat\" to start."}
              </p>
            ) : (
              <div className="space-y-0.5">
                {filteredUser.map((chat) => (
                  <div key={chat.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => loadChat(chat.id)}
                      className={`w-full text-left px-3 py-2.5 pr-8 rounded-xl transition-colors duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 ${
                        selectedChatId === chat.id ? "bg-white shadow-sm" : "hover:bg-white/60"
                      }`}
                    >
                      <p className="text-xs font-semibold text-stone-700 truncate">{chat.title}</p>
                      {chat.last_message && (
                        <p className="text-[11px] text-stone-400 truncate mt-0.5 leading-snug">{chat.last_message}</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChat(chat.id, chat.title)}
                      aria-label={`Delete ${chat.title}`}
                      className="absolute right-1.5 top-1.5 rounded-md p-1 text-stone-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-summit hover:bg-red-50 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-summit transition-colors duration-150"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {!selectedChatId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#F6F6F6] px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100 mb-5"
              style={{ boxShadow: "0 8px 18px rgba(30,82,53,0.08)" }}>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                <circle cx="17" cy="17" r="12" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.6" />
                <path d="M17 7L20.2 14L27 17L20.2 20L17 27L13.8 20L7 17L13.8 14L17 7Z" fill="#E7B85B" stroke="#1E5235" strokeWidth="1.2" />
              </svg>
            </div>
            <p className="text-lg font-bold text-forest-950 text-center">Your AI Guide</p>
            <p className="mt-2 text-sm text-stone-500 text-center max-w-xs">
              Start a new chat to get coaching, adjust your plan, or ask anything about your mountains.
            </p>
            <button
              type="button"
              onClick={createNewChat}
              className="mt-6 text-sm px-5 py-2.5 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-600 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
            >
              + New Chat
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-stone-100 bg-white flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-forest-950">{selectedChat?.title}</p>
                {selectedMountainLabel && (
                  <p className="text-[11px] text-stone-400">{selectedMountainLabel}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-[#F6F6F6] px-6 py-5 space-y-4">
              {messagesLoading ? (
                <div className="flex justify-center pt-10">
                  <div className="w-6 h-6 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="mx-auto mt-10 max-w-sm text-center">
                  <p className="text-sm text-stone-400">Start the conversation — ask anything about your goal.</p>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {["What should I do next?", "Why am I stuck?", "How can I reach my summit faster?"].map((q) => (
                      <button key={q} type="button" onClick={() => sendMessage(q)}
                        className="text-xs font-semibold px-3 py-2 rounded-xl border border-[#E7E0D7] bg-white text-stone-600 hover:border-forest-300 hover:bg-forest-50 hover:text-forest-800 active:scale-[0.97] transition-colors duration-200">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} gap-2`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${msg.role === "user" ? "bg-forest-700 text-white" : "bg-white text-stone-800"}`}
                      style={{ boxShadow: msg.role === "user" ? "0 2px 8px rgba(20,60,35,0.2)" : "0 1px 3px rgba(20,60,35,0.06)" }}
                    >
                      <p className="text-sm whitespace-pre-line leading-relaxed">{msg.content}</p>
                    </div>

                    {/* Advance milestone action */}
                    {msg.role === "ai" && msg.actions?.filter((a) => a.type === "advance_milestone").map((action, i) => (
                      <div key={i} className="max-w-[75%] flex items-center gap-3 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-100 shrink-0">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7L6 10L11 4" stroke="#1E5235" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-forest-700">Advance to: {action.nextMilestoneName as string}</p>
                          <p className="text-[11px] text-stone-500">This will mark your current stage complete</p>
                        </div>
                        <button type="button" onClick={() => executeAdvanceMilestone(msg.id, action.nextMilestoneName as string)}
                          disabled={executingAction}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-forest-700 text-white hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] transition-colors duration-200">
                          {executingAction ? "..." : "Confirm"}
                        </button>
                      </div>
                    ))}

                    {/* Plan proposal */}
                    {msg.role === "ai" && planProposals[msg.id] && (
                      <div className="max-w-[75%] w-full">
                        {planProposals[msg.id].confirmed ? (
                          <div className="flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-xs font-semibold text-forest-700">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-200 text-[10px]">✓</span>
                            Plan applied — your Overview has been updated.
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-stone-100 bg-white overflow-hidden" style={{ boxShadow: "0 4px 14px rgba(20,60,35,0.07)" }}>
                            <div className="px-4 pt-4 pb-3 border-b border-[#F0ECE6]">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-600 mb-0.5">New Plan</p>
                              <p className="text-sm font-semibold text-stone-800">{planProposals[msg.id].plan?.focus_area || planProposals[msg.id].priority_recommendation}</p>
                            </div>
                            <div className="px-4 py-3 space-y-3 max-h-56 overflow-y-auto">
                              {planProposals[msg.id].plan?.schedule?.map((dayPlan, i) => (
                                <div key={i}>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 mb-1">{dayPlan.day}</p>
                                  {dayPlan.tasks.map((task, j) => (
                                    <div key={j} className="flex items-start gap-2 mb-1">
                                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${task.priority === "high" ? "bg-summit" : task.priority === "medium" ? "bg-amber-400" : "bg-forest-400"}`} />
                                      <div>
                                        <p className="text-xs text-stone-700">{task.task}</p>
                                        {task.duration && <p className="text-[10px] text-stone-400">{task.duration}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                              {planProposals[msg.id].next_best_action && (
                                <div className="pt-2 border-t border-[#F0ECE6]">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-600 mb-1">Start here</p>
                                  <p className="text-xs text-stone-700">{planProposals[msg.id].next_best_action}</p>
                                </div>
                              )}
                            </div>
                            <div className="px-4 pb-4 pt-3 border-t border-[#F0ECE6] flex gap-2">
                              <button type="button" onClick={() => confirmPlan(msg.id)}
                                className="flex-1 text-xs font-semibold py-2 rounded-lg bg-forest-700 text-white hover:bg-forest-600 active:scale-[0.97] transition-colors duration-200"
                                style={{ boxShadow: "0 2px 6px rgba(20,60,35,0.18)" }}>
                                Looks good ✓
                              </button>
                              <button type="button" onClick={() => { setInput("Can you adjust the plan to "); inputRef.current?.focus(); }}
                                className="flex-1 text-xs font-semibold py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 active:scale-[0.97] transition-colors duration-200">
                                Make changes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Structured weekly-plan edit — exactly one of two live
                        states (never both a "propose" and a "done" CTA):
                        "proposal" = nothing changed yet, Apply / Keep
                        discussing; "updated" = already written, View plan /
                        Undo. "neutral" only appears on a reloaded chat, for
                        an older proposal a later one has since superseded. */}
                    {msg.role === "ai" && planUpdates[msg.id] && (() => {
                      const card = planUpdates[msg.id];
                      const diffCount = card.diff
                        ? card.diff.added.length + card.diff.removed.length + card.diff.moved.length + card.diff.retimed.length
                        : 0;
                      return (
                        <div
                          className={`max-w-[75%] w-full rounded-xl border px-4 py-3 ${
                            card.status === "error"
                              ? "border-summit/30 bg-red-50"
                              : card.status === "neutral"
                                ? "border-stone-200 bg-stone-50"
                                : card.status === "proposal"
                                  ? "border-amber-200 bg-amber-50/70"
                                  : "border-forest-200 bg-forest-50"
                          }`}
                        >
                          <p className={`text-xs font-semibold ${
                            card.status === "error"
                              ? "text-summit"
                              : card.status === "neutral"
                                ? "text-stone-500"
                                : card.status === "proposal"
                                  ? "text-amber-800"
                                  : "text-forest-700"
                          }`}>
                            {card.status === "proposal" && <span className="uppercase tracking-wide text-[10px] block mb-1 text-amber-700">Not applied yet</span>}
                            {card.undone ? "Undone — your draft is back to how it was." : card.message}
                          </p>

                          {card.status === "proposal" && diffCount > 0 && (
                            <ul className="mt-2 space-y-1">
                              {card.diff!.removed.slice(0, 3).map((c, i) => (
                                <li key={`r${i}`} className="flex gap-1.5 text-[11px] text-stone-600">
                                  <span className="shrink-0 font-semibold text-summit">− Remove</span>
                                  <span className="shrink-0 text-stone-400">{c.day}:</span>
                                  <span className="truncate">{c.task}</span>
                                </li>
                              ))}
                              {card.diff!.added.slice(0, 3).map((c, i) => (
                                <li key={`a${i}`} className="flex gap-1.5 text-[11px] text-stone-600">
                                  <span className="shrink-0 font-semibold text-forest-700">+ Add</span>
                                  <span className="shrink-0 text-stone-400">{c.day}:</span>
                                  <span className="truncate">{c.task}</span>
                                </li>
                              ))}
                              {card.diff!.moved.slice(0, 3).map((c, i) => (
                                <li key={`m${i}`} className="flex gap-1.5 text-[11px] text-stone-600">
                                  <span className="shrink-0 font-semibold text-amber-700">→ Move</span>
                                  <span className="truncate">{c.task}</span>
                                  <span className="shrink-0 text-stone-400">({c.from} → {c.to})</span>
                                </li>
                              ))}
                              {card.diff!.retimed.slice(0, 3).map((c, i) => (
                                <li key={`t${i}`} className="flex gap-1.5 text-[11px] text-stone-600">
                                  <span className="shrink-0 font-semibold text-amber-700">◷ Change</span>
                                  <span className="truncate">{c.task}</span>
                                  <span className="shrink-0 text-stone-400">({c.from} → {c.to})</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {card.status === "proposal" && (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                disabled={card.resolving}
                                onClick={() => applyProposalInChat(msg.id)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-forest-700 text-white hover:bg-forest-600 disabled:opacity-40 active:scale-[0.97] transition-colors duration-200"
                              >
                                {card.resolving ? "Applying…" : "Apply changes"}
                              </button>
                              <button
                                type="button"
                                disabled={card.resolving}
                                onClick={() => dismissProposal(msg.id)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 active:scale-[0.97] transition-colors duration-200"
                              >
                                Keep discussing
                              </button>
                            </div>
                          )}

                          {(card.status === "updated" || card.status === "neutral") && !card.undone && selectedMountainId && (
                            <div className="mt-2 flex items-center gap-2">
                              <Link
                                href={`/mountain?id=${selectedMountainId}`}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-forest-700 text-white hover:bg-forest-600 active:scale-[0.97] transition-colors duration-200"
                              >
                                View updated plan
                              </Link>
                              {card.status === "updated" && card.previousPlan !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => undoWeeklyPlanUpdate(msg.id)}
                                  className="text-xs font-semibold px-2 py-1.5 text-stone-500 hover:text-summit active:scale-[0.97] transition-colors duration-200"
                                >
                                  Undo
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Suggested replies — suppressed once a plan-update card
                        owns this message's next step, since the model wrote
                        these before the backend decided apply vs. preview
                        and they can flatly contradict the real outcome. A
                        card in "updated" state gets exactly one deterministic
                        next step instead. */}
                    {msg.role === "ai" && !planUpdates[msg.id] && msg.suggested_replies?.length > 0 && (
                      <div className="flex flex-wrap gap-2 max-w-[75%]">
                        {msg.suggested_replies.map((reply, i) => (
                          <button key={i} type="button" onClick={() => sendMessage(reply)} disabled={sending}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-forest-200 bg-white text-forest-700 hover:bg-forest-50 hover:border-forest-300 active:scale-[0.97] disabled:opacity-40 transition-colors duration-200"
                            style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}>
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.role === "ai" && planUpdates[msg.id]?.status === "updated" && !planUpdates[msg.id]?.resolving && (
                      <div className="flex flex-wrap gap-2 max-w-[75%]">
                        <button type="button" onClick={() => { setInput(""); inputRef.current?.focus(); }}
                          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-forest-200 bg-white text-forest-700 hover:bg-forest-50 hover:border-forest-300 active:scale-[0.97] transition-colors duration-200"
                          style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}>
                          Make another adjustment
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

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
            <div className="border-t border-stone-100 bg-white p-4 shrink-0">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask your guide..."
                  disabled={sending}
                  className="w-full bg-white rounded-2xl px-5 py-3.5 pr-12 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-60 transition-colors duration-200"
                />
                {sending ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl border border-stone-300 bg-white text-stone-600 flex items-center justify-center hover:border-summit hover:text-summit active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                    aria-label="Stop reply"
                    title="Stop reply"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <rect x="1.5" y="1.5" width="9" height="9" rx="2" fill="currentColor" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-forest-700 text-white flex items-center justify-center hover:bg-forest-600 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                    style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.2)" }}
                    aria-label="Send"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense fallback={
      <div className="max-w-[800px] mx-auto mt-20 text-center">
        <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-stone-400 mt-3">Loading guide...</p>
      </div>
    }>
      <GuideContent />
    </Suspense>
  );
}
