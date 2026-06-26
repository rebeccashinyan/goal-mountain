"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialContextSent = useRef(false);

  const fetchMountains = useCallback(async () => {
    const res = await fetch("/api/mountains");
    if (res.ok) {
      const data = await res.json();
      setMountains(data);

      if (paramMountainId) {
        setSelectedContext(paramMountainId);
      }
    }
    setLoading(false);
  }, [paramMountainId]);

  useEffect(() => {
    fetchMountains();
  }, [fetchMountains]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading && paramContext && !initialContextSent.current) {
      initialContextSent.current = true;
      setMessages([
        {
          id: "ctx-0",
          role: "ai",
          content:
            "I see what you're looking at. What would you like to discuss about this?",
        },
      ]);
    }
  }, [loading, paramContext]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    const history = messages
      .filter((m) => m.id !== "ctx-0")
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      message: userMessage,
      mountain_id: selectedContext === "all" ? "all" : selectedContext,
      conversation_history: history,
    };

    if (paramContext && !initialContextSent.current) {
      body.initial_context = paramContext;
    }

    const res = await fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const { reply } = await res.json();
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "ai", content: reply },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "ai",
          content: "Something went wrong. Try again.",
        },
      ]);
    }

    setSending(false);
    inputRef.current?.focus();
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
    <div
      className="max-w-[800px] mx-auto mt-2 flex flex-col"
      style={{ height: "calc(100vh - 100px)" }}
    >
      {/* Context Selector */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs font-medium text-stone-400 uppercase tracking-wide shrink-0">
          Mountain
        </label>
        <select
          value={selectedContext}
          onChange={(e) => handleContextChange(e.target.value)}
          className="text-sm bg-white rounded-xl px-4 py-2 border border-stone-200 text-stone-700 font-medium focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
        >
          <option value="all">All Mountains</option>
          {mountains.map((m) => (
            <option key={m.id} value={m.id}>
              {m.goal}
            </option>
          ))}
        </select>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 flex flex-col rounded-2xl bg-stone-100 overflow-hidden"
        style={{
          boxShadow:
            "0 1px 4px rgba(20,60,35,0.06), 0 4px 14px rgba(20,60,35,0.03)",
        }}
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center mt-16 space-y-4">
              <p className="text-stone-400 text-sm">
                {selectedContext === "all"
                  ? "Ask about your overall strategy, priorities, or any mountain."
                  : `Ask about your ${selectedLabel} journey.`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {selectedContext === "all"
                  ? [
                      "What should I prioritize?",
                      "Am I taking on too much?",
                      "Which mountain needs attention?",
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setInput(q);
                          inputRef.current?.focus();
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white text-stone-600 border border-stone-200 hover:border-forest-300 hover:text-forest-700 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                      >
                        {q}
                      </button>
                    ))
                  : [
                      "What should I do next?",
                      "Why am I stuck?",
                      "How can I reach my summit faster?",
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setInput(q);
                          inputRef.current?.focus();
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white text-stone-600 border border-stone-200 hover:border-forest-300 hover:text-forest-700 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                      >
                        {q}
                      </button>
                    ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                  msg.role === "user"
                    ? "bg-forest-700 text-white"
                    : "bg-white text-stone-800"
                }`}
                style={{
                  boxShadow:
                    msg.role === "user"
                      ? "0 2px 8px rgba(20,60,35,0.2)"
                      : "0 1px 3px rgba(20,60,35,0.06)",
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
              <div
                className="bg-white rounded-2xl px-5 py-3.5"
                style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
              >
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-stone-300 rounded-full animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="w-2 h-2 bg-stone-300 rounded-full animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 pt-2">
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
