"use client";

import { useState, useRef, useEffect } from "react";

interface CreateMountainModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

interface GoalData {
  goal: string;
  current_level: string | null;
  target_date: string | null;
  constraints: string | null;
}

export default function CreateMountainModal({
  open,
  onClose,
  onCreated,
}: CreateMountainModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [goalData, setGoalData] = useState<GoalData | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([
        {
          id: "welcome",
          role: "ai",
          content:
            "What goal do you want to climb toward? Tell me what you want to achieve — big or small.",
        },
      ]);
      setInput("");
      setGoalData(null);
      setError("");
      setGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setMessages([]);
      setInput("");
      setGoalData(null);
      setError("");
      setGenerating(false);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || sending || generating) return;

    const userMessage = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setError("");

    const history = [
      ...messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
      { role: "user", content: userMessage },
    ];

    const welcomeMsg = messages.find((m) => m.id === "welcome");
    if (welcomeMsg) {
      history.unshift({ role: "assistant", content: welcomeMsg.content });
    }

    try {
      const res = await fetch("/api/create-mountain-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_history: history }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "ai", content: data.reply },
      ]);

      if (data.status === "confirming" || data.status === "ready") {
        setGoalData(data.goal_data);
      }

      if (data.status === "ready") {
        generateMountain(data.goal_data);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "ai",
          content: "Something went wrong. Try sending that again.",
        },
      ]);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  async function generateMountain(data: GoalData) {
    setGenerating(true);
    setError("");

    try {
      const body: Record<string, string> = { goal: data.goal };
      if (data.current_level) body.current_level = data.current_level;
      if (data.target_date) body.target_date = data.target_date;
      if (data.constraints) body.constraints = data.constraints;

      const res = await fetch("/api/generate-mountain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate mountain");
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={generating ? undefined : onClose}
      />

      <div
        className="relative bg-white rounded-3xl w-full max-w-lg mx-4 flex flex-col"
        style={{
          height: "min(580px, 85vh)",
          boxShadow:
            "0 8px 40px rgba(20,60,35,0.12), 0 2px 8px rgba(20,60,35,0.06)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">
              Create a New Mountain
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-40 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-forest-700 text-white"
                    : "bg-stone-100 text-stone-800"
                }`}
                style={{
                  boxShadow:
                    msg.role === "user"
                      ? "0 1px 4px rgba(20,60,35,0.2)"
                      : undefined,
                }}
              >
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-stone-100 rounded-2xl px-4 py-2.5">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" />
                  <span
                    className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              </div>
            </div>
          )}

          {generating && (
            <div className="flex justify-start">
              <div className="bg-forest-50 border border-forest-200 rounded-2xl px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm text-forest-700 font-medium">
                  <span className="w-3.5 h-3.5 border-2 border-forest-300 border-t-forest-700 rounded-full animate-spin" />
                  Building your mountain...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5">
                <p className="text-sm text-summit">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Generate button when confirming */}
        {goalData && !generating && (
          <div className="px-6 pb-2">
            <button
              type="button"
              onClick={() => generateMountain(goalData)}
              className="w-full text-sm py-2.5 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
            >
              Generate Mountain
            </button>
          </div>
        )}

        {/* Input */}
        <form onSubmit={sendMessage} className="px-6 pb-5 pt-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your goal..."
              disabled={sending || generating}
              className="w-full bg-stone-50 rounded-2xl px-4 py-3 pr-11 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-50 transition-colors duration-200"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || generating}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-forest-700 text-white flex items-center justify-center hover:bg-forest-600 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              aria-label="Send"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 7h12M8 2l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
