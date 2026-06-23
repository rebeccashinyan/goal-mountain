"use client";

import { useState } from "react";
import { chatMessages, sidebarMessages, sidebarChats } from "@/lib/mock-data";

export default function GuidePage() {
  const [input, setInput] = useState("");

  return (
    <div
      className="max-w-[1100px] mx-auto mt-2 flex rounded-2xl bg-stone-100 overflow-hidden"
      style={{
        height: "calc(100vh - 120px)",
        boxShadow: "0 1px 4px rgba(20,60,35,0.06), 0 4px 14px rgba(20,60,35,0.03)",
      }}
    >
      {/* Sidebar */}
      <aside className="w-[260px] border-r border-stone-200 p-5 flex flex-col overflow-y-auto shrink-0">
        <button
          className="text-sm font-medium text-forest-800 hover:text-forest-600 text-left mb-1 transition-colors duration-200"
          type="button"
        >
          New Chats
        </button>
        <button
          className="text-sm text-stone-500 hover:text-stone-700 text-left mb-5 transition-colors duration-200"
          type="button"
        >
          Search Chats
        </button>

        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
            Messages from AI
          </h3>
          <ul className="space-y-1.5">
            {sidebarMessages.map((msg) => (
              <li key={msg.label}>
                <button
                  className={`flex items-center gap-2 text-sm w-full text-left px-2 py-1.5 rounded-lg transition-colors duration-200 ${
                    msg.hasNotification
                      ? "font-semibold text-forest-900 bg-white"
                      : "text-stone-600 hover:bg-stone-200/60"
                  }`}
                  type="button"
                  style={
                    msg.hasNotification
                      ? { boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }
                      : undefined
                  }
                >
                  {msg.label}
                  {msg.hasNotification && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            className="text-xs text-stone-400 hover:text-stone-600 mt-2 pl-2 transition-colors duration-200"
            type="button"
          >
            show more
          </button>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
            Chats
          </h3>
          <ul className="space-y-1">
            {sidebarChats.map((chat) => (
              <li key={chat}>
                <button
                  className="text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-200/60 w-full text-left px-2 py-1.5 rounded-lg transition-colors duration-200"
                  type="button"
                >
                  {chat}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-stone-50">
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {chatMessages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "ai" && (
                <div
                  className="bg-stone-200/70 rounded-2xl px-5 py-4 max-w-[600px]"
                  style={{
                    boxShadow: "0 1px 2px rgba(20,60,35,0.04)",
                  }}
                >
                  <p className="text-sm text-stone-800 whitespace-pre-line leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              )}

              {msg.actions && (
                <div className="flex justify-end mt-3 gap-2">
                  {msg.actions.map((action) => (
                    <button
                      key={action.id}
                      className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
                      type="button"
                      style={{
                        boxShadow: "0 1px 3px rgba(20,60,35,0.06)",
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 pt-2">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your AI guide..."
              className="w-full bg-stone-200/50 rounded-2xl px-5 py-3.5 text-sm text-stone-800 placeholder:text-stone-400 border border-stone-200 focus:outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 transition-colors duration-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
