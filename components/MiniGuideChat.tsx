"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface DailyReviewContext {
  kind: "daily_review";
  day: string;
  completed: string[];
  missed: string[];
  load_feel?: string;
}

export interface PlanTalkContext {
  kind: "plan_talk";
  summary: string;
}

export type MiniChatContext = DailyReviewContext | PlanTalkContext;

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  suggested_replies: string[];
  needsGuide?: boolean;
  note?: boolean;
}

const loadFeelText = (feel?: string) =>
  feel === "lighter" ? "The day's load felt lighter than planned."
  : feel === "heavier" ? "The day's load felt heavier than planned."
  : feel === "about_right" ? "The day's load felt about right."
  : "";

export default function MiniGuideChat({
  mountainId,
  context,
  onClose,
  onPlanUpdated,
}: {
  mountainId: string;
  context: MiniChatContext;
  onClose: () => void;
  onPlanUpdated?: () => void;
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const startedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtitle =
    context.kind === "daily_review"
      ? `Daily check-in — ${context.day}`
      : "Adjusting your weekly plan";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      setSending(true);
      try {
        const title =
          context.kind === "daily_review"
            ? `Daily check-in — ${context.day}`
            : "Plan discussion";
        const chatRes = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mountain_id: mountainId, title, type: "user_initiated" }),
        });
        if (!chatRes.ok) throw new Error();
        const chat = await chatRes.json();
        setChatId(chat.id);

        let content: string;
        let initial_context: string;
        if (context.kind === "daily_review") {
          content = `Finished ${context.day}. Completed: ${context.completed.length ? context.completed.join("; ") : "nothing"}.${context.missed.length ? ` Missed: ${context.missed.join("; ")}.` : ""}`;
          initial_context = context.missed.length
            ? `Daily check-in for ${context.day}. Completed tasks: ${context.completed.join("; ") || "none"}. Missed tasks: ${context.missed.join("; ")}. ${loadFeelText(context.load_feel)} Warmly acknowledge what got done, then ask what got in the way of the missed tasks — one question at a time, not an interrogation. Store the reason as a memory, and if the plan needs adjusting based on what the user says, propose a plan adjustment.`
            : `Daily check-in for ${context.day}. The user completed every task: ${context.completed.join("; ")}. ${loadFeelText(context.load_feel)} Congratulate them briefly, then ask ONE light question: which task ran longer than planned? Keep it short and celebratory — they had a good day. Store what they say as a memory for future plan sizing.`;
        } else {
          content = "I'd like to adjust this week's plan.";
          initial_context = `The user wants to discuss and adjust their weekly plan. Current plan: ${context.summary}. Ask what they'd like to change — pacing, which days, task load, or focus — one question at a time. Once you understand what they want, use the propose_plan action with their constraints to regenerate the plan. Keep it conversational and brief.`;
        }

        setMessages([{ id: "u0", role: "user", content, suggested_replies: [] }]);

        const res = await fetch(`/api/chats/${chat.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, initial_context }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        appendAiReply(data);
      } catch {
        setMessages((prev) => [...prev, {
          id: "err",
          role: "ai",
          content: "Your guide couldn't connect right now. Your changes are saved — open the AI Guide to talk it through later.",
          suggested_replies: [],
        }]);
      }
      setSending(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function appendAiReply(data: {
    reply: string;
    suggested_replies?: string[];
    actions?: { type?: string; user_constraints?: string; available_time?: string }[];
  }) {
    const needsGuide = (data.actions || []).some((a) => a.type === "advance_milestone");
    setMessages((prev) => [...prev, {
      id: `ai-${Date.now()}`,
      role: "ai",
      content: data.reply,
      suggested_replies: data.suggested_replies || [],
      needsGuide,
    }]);

    const planAction = (data.actions || []).find((a) => a.type === "propose_plan");
    if (planAction) regeneratePlan(planAction.user_constraints, planAction.available_time);
  }

  // The guide proposed a plan change — regenerate it right here so the
  // schedule on this page updates while the conversation continues
  async function regeneratePlan(userConstraints?: string, availableTime?: string) {
    setSending(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mountain_id: mountainId,
          user_constraints: userConstraints,
          available_time: availableTime,
        }),
      });
      if (!res.ok) throw new Error();
      onPlanUpdated?.();
      setMessages((prev) => [...prev, {
        id: `note-${Date.now()}`,
        role: "ai",
        content: "✓ Your weekly plan is updated — take a look at the schedule on this page.",
        suggested_replies: [],
        note: true,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `note-${Date.now()}`,
        role: "ai",
        content: "I couldn't update the plan just now — try again in a moment.",
        suggested_replies: [],
        note: true,
      }]);
    }
    setSending(false);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending || !chatId) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, suggested_replies: [] })),
      { id: `u-${Date.now()}`, role: "user" as const, content, suggested_replies: [] },
    ]);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) appendAiReply(await res.json());
    } catch {
      // silent
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function expand() {
    router.push(
      chatId
        ? `/guide?mountain_id=${mountainId}&chat_id=${chatId}`
        : `/guide?mountain_id=${mountainId}`
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex h-[480px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[#E7E0D7] bg-white"
      style={{ boxShadow: "0 24px 60px rgba(43, 58, 42, 0.18), 0 4px 12px rgba(43, 58, 42, 0.08)" }}
      role="dialog"
      aria-label="Guide chat"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[#E7E0D7] bg-[#FBF8F1] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-700 text-white">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1.5L8.5 5.5L12.5 7L8.5 8.5L7 12.5L5.5 8.5L1.5 7L5.5 5.5L7 1.5Z" fill="currentColor" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-forest-950 leading-tight">Your guide</p>
          <p className="truncate text-[11px] text-stone-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={expand}
          aria-label="Open in AI Guide"
          title="Open in AI Guide"
          className="rounded-lg p-1.5 text-stone-400 hover:bg-white hover:text-forest-700 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M9 1.5H13.5V6M13.5 1.5L8.5 6.5M6 13.5H1.5V9M1.5 13.5L6.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-lg p-1.5 text-stone-400 hover:bg-white hover:text-stone-700 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
        {messages.map((m) => (
          <div key={m.id}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "ml-auto bg-forest-700 text-white rounded-br-md"
                  : m.note
                    ? "border border-forest-200 bg-forest-50 text-forest-800 font-medium rounded-bl-md"
                    : "bg-[#F4F1EA] text-stone-700 rounded-bl-md"
              }`}
            >
              {m.content}
            </div>
            {m.needsGuide && (
              <button
                type="button"
                onClick={expand}
                className="mt-2 flex items-center gap-1.5 rounded-xl border border-forest-200 bg-forest-50 px-3 py-2 text-[12px] font-semibold text-forest-800 hover:bg-forest-100 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
              >
                Your guide has a proposal — review it in the AI Guide →
              </button>
            )}
            {m.suggested_replies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.suggested_replies.slice(0, 3).map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(r)}
                    className="rounded-full border border-forest-200 bg-white px-2.5 py-1 text-[11px] font-medium text-forest-800 hover:bg-forest-50 hover:border-forest-300 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-[#F4F1EA] px-3.5 py-2.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:240ms]" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2 border-t border-[#E7E0D7] px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Reply to your guide..."
          className="min-w-0 flex-1 rounded-xl border border-[#E7E0D7] bg-white px-3 py-2 text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending || !chatId}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-700 text-white hover:bg-forest-600 disabled:opacity-40 active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-500 transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 7H12M12 7L7.5 2.5M12 7L7.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}
