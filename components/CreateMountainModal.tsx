"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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

interface ProvenStage {
  stage: string;
  description: string;
  typical_duration?: string;
}

interface ResearchData {
  proven_stages?: ProvenStage[];
  key_skills?: string[];
  common_pitfalls?: string[];
  insights?: { title: string; detail: string }[];
}

interface MilestoneData {
  name: string;
  description: string;
  type?: string;
  estimated_duration?: string;
}

interface MountainResult {
  id: string;
  goal: string;
  summit: string;
  milestones: MilestoneData[];
}

export default function CreateMountainModal({
  open,
  onClose,
  onCreated,
}: CreateMountainModalProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<"researching" | "building" | null>(null);
  const [goalData, setGoalData] = useState<GoalData | null>(null);
  const [error, setError] = useState("");

  // About Your Plan state
  const [showPlan, setShowPlan] = useState(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [mountainResult, setMountainResult] = useState<MountainResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([
        {
          id: "welcome",
          role: "ai",
          content: "What goal do you want to climb toward? Tell me what you want to achieve — big or small.",
        },
      ]);
      setInput("");
      setGoalData(null);
      setError("");
      setGenerating(false);
      setGeneratingStep(null);
      setShowPlan(false);
      setResearchData(null);
      setMountainResult(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setMessages([]);
      setInput("");
      setGoalData(null);
      setError("");
      setGenerating(false);
      setGeneratingStep(null);
      setShowPlan(false);
      setResearchData(null);
      setMountainResult(null);
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

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: userMessage };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setError("");

    const history = [
      ...messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
      { role: "user", content: userMessage },
    ];

    const welcomeMsg = messages.find((m) => m.id === "welcome");
    if (welcomeMsg) history.unshift({ role: "assistant", content: welcomeMsg.content });

    try {
      const res = await fetch("/api/create-mountain-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_history: history }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();

      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "ai", content: data.reply }]);

      if (data.status === "confirming" || data.status === "ready") setGoalData(data.goal_data);
      if (data.status === "ready") generateMountain(data.goal_data);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "ai", content: "Something went wrong. Try sending that again." },
      ]);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  async function generateMountain(data: GoalData) {
    setGenerating(true);
    setError("");

    try {
      // Step 1: Research
      setGeneratingStep("researching");
      let research: ResearchData | null = null;
      try {
        const researchRes = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: data.goal }),
        });
        if (researchRes.ok) research = await researchRes.json();
      } catch {
        // non-blocking
      }

      // Step 2: Generate mountain with research context
      setGeneratingStep("building");
      const body: Record<string, unknown> = { goal: data.goal };
      if (data.current_level) body.current_level = data.current_level;
      if (data.target_date) body.target_date = data.target_date;
      if (data.constraints) body.constraints = data.constraints;
      if (research) body.research_context = research;

      const res = await fetch("/api/generate-mountain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate mountain");
      }

      const mountain: MountainResult = await res.json();

      // Show "About Your Plan" instead of closing immediately
      setResearchData(research);
      setMountainResult(mountain);
      setGenerating(false);
      setGeneratingStep(null);
      setShowPlan(true);
      onCreated(); // refresh parent list in background
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
      setGeneratingStep(null);
    }
  }

  function startClimbing() {
    if (!mountainResult) return;
    onClose();
    router.push(`/mountain?id=${mountainResult.id}`);
  }

  if (!open) return null;

  // ── About Your Plan view ────────────────────────────────────────────────
  if (showPlan && mountainResult) {
    const pitfalls = researchData?.common_pitfalls?.slice(0, 3) || [];
    const skills = researchData?.key_skills?.slice(0, 5) || [];
    const stages = researchData?.proven_stages?.slice(0, 5) || [];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-3xl w-full max-w-2xl mx-4 flex flex-col overflow-hidden border border-[#E7E0D7]"
          style={{
            maxHeight: "88vh",
            boxShadow: "0 8px 40px rgba(20,60,35,0.14), 0 2px 8px rgba(20,60,35,0.06)",
          }}
        >
          {/* Header */}
          <div className="bg-[#FBF8F1] px-6 pt-6 pb-5 border-b border-[#E7E0D7] shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600 mb-1">
                  About Your Plan
                </p>
                <h2 className="text-2xl font-bold text-forest-950 leading-tight">
                  {mountainResult.goal}
                </h2>
                <p className="mt-1.5 text-sm text-stone-500">
                  Summit: {mountainResult.summit}
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100"
                style={{ boxShadow: "0 4px 12px rgba(20,60,35,0.08)" }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                  <path d="M3 22L13 4L23 22H3Z" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.6" strokeLinejoin="round" />
                  <circle cx="13" cy="14" r="2" fill="#E7B85B" />
                </svg>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* What the research found */}
            {(stages.length > 0 || skills.length > 0 || pitfalls.length > 0) && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600 mb-3">
                  What the Research Agent Found
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stages.length > 0 && (
                    <div className="rounded-2xl border border-[#E7E0D7] bg-[#FAFAF8] px-4 py-3">
                      <p className="text-xs font-semibold text-stone-500 mb-2">Proven Stages</p>
                      <div className="space-y-1.5">
                        {stages.map((s, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[10px] font-bold text-forest-600 bg-forest-50 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-stone-700">{s.stage}</p>
                              {s.typical_duration && (
                                <p className="text-[10px] text-stone-400">{s.typical_duration}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {skills.length > 0 && (
                      <div className="rounded-2xl border border-[#E7E0D7] bg-[#FAFAF8] px-4 py-3">
                        <p className="text-xs font-semibold text-stone-500 mb-2">Skills You&rsquo;ll Build</p>
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map((s, i) => (
                            <span key={i} className="text-[10px] font-semibold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-md">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {pitfalls.length > 0 && (
                      <div className="rounded-2xl border border-[#E7E0D7] bg-[#FAFAF8] px-4 py-3">
                        <p className="text-xs font-semibold text-stone-500 mb-2">Watch Out For</p>
                        <div className="space-y-1">
                          {pitfalls.map((p, i) => (
                            <p key={i} className="text-xs text-stone-600 flex gap-1.5">
                              <span className="text-amber-400 shrink-0">⚠</span>
                              {p}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* How the plan was structured */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600 mb-3">
                Your Mountain — {mountainResult.milestones.length} steps to the summit
              </p>
              <div className="space-y-1.5">
                {mountainResult.milestones.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-forest-50 border border-forest-100"
                  >
                    <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center mt-0.5 text-[9px] font-bold bg-forest-600 text-white">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-forest-800">
                          {m.name}
                        </p>
                        {m.estimated_duration && (
                          <span className="text-[10px] text-stone-400">{m.estimated_duration}</span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{m.description}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Summit */}
                <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-[#FBF8F1] border border-[#E7E0D7] mt-1">
                  <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center mt-0.5 bg-[#E7B85B]">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1L6.2 4L9 5L6.2 6L5 9L3.8 6L1 5L3.8 4L5 1Z" fill="white" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-700">Summit</p>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{mountainResult.summit}</p>
                  </div>
                </div>
              </div>
            </section>

            <p className="text-[10px] text-stone-400 text-center">
              {mountainResult.milestones.length} stages to the summit · grounded in real-world research
            </p>
          </div>

          {/* Footer CTA */}
          <div className="px-6 py-4 border-t border-[#E7E0D7] bg-white shrink-0 flex items-center gap-3">
            <button
              onClick={startClimbing}
              className="flex-1 text-sm py-3 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
              type="button"
            >
              Start Climbing →
            </button>
            <button
              onClick={onClose}
              className="text-sm px-4 py-3 rounded-xl text-stone-500 hover:bg-stone-100 active:scale-[0.97] transition-colors duration-200"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat view (default) ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={generating ? undefined : onClose}
      />

      <div
        className="relative bg-white rounded-3xl w-full max-w-lg mx-4 flex flex-col overflow-hidden border border-[#E7E0D7]"
        style={{
          height: "min(580px, 85vh)",
          boxShadow: "0 8px 40px rgba(20,60,35,0.12), 0 2px 8px rgba(20,60,35,0.06)",
        }}
      >
        {/* Header */}
        <div className="bg-[#FBF8F1] px-6 pt-6 pb-4 border-b border-[#E7E0D7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
                <svg width="23" height="23" viewBox="0 0 23 23" fill="none" aria-hidden="true">
                  <path d="M3 19L11.5 5L20 19H3Z" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M11.5 5L8.8 19" stroke="#1E5235" strokeWidth="1.2" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-600">
                  Mountain Generator
                </p>
                <h2 className="text-lg font-bold text-stone-900">Create a New Mountain</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-40 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user" ? "bg-forest-700 text-white" : "bg-stone-100 text-stone-800"
                }`}
                style={msg.role === "user" ? { boxShadow: "0 1px 4px rgba(20,60,35,0.2)" } : undefined}
              >
                <p className="text-sm whitespace-pre-line leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-stone-100 rounded-2xl px-4 py-2.5">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}

          {generating && (
            <div className="flex justify-start">
              <div className="bg-forest-50 border border-forest-200 rounded-2xl px-4 py-3 space-y-2">
                <span className="flex items-center gap-2 text-sm text-forest-700 font-medium">
                  <span className="w-3.5 h-3.5 border-2 border-forest-300 border-t-forest-700 rounded-full animate-spin" />
                  {generatingStep === "researching" ? "Researching your goal..." : "Building your mountain..."}
                </span>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md ${generatingStep === "researching" ? "text-forest-700 bg-forest-100" : "text-forest-500 bg-forest-50"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${generatingStep === "researching" ? "bg-forest-500 animate-pulse" : "bg-forest-400"}`} />
                    Research
                  </div>
                  <span className="text-stone-300 text-xs">→</span>
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md ${generatingStep === "building" ? "text-forest-700 bg-forest-100" : "text-stone-400 bg-stone-100"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${generatingStep === "building" ? "bg-forest-500 animate-pulse" : "bg-stone-300"}`} />
                    Generate
                  </div>
                </div>
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
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
