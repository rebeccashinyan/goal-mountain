"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import MiniMountain from "@/components/MiniMountain";
import CreateMountainModal from "@/components/CreateMountainModal";

interface MountainMilestone {
  name: string;
  description: string;
  completed: boolean;
  current?: boolean;
  order_index: number;
}

interface MountainRow {
  id: string;
  goal: string;
  summit: string;
  current_task: string;
  progress: number;
  current_milestone_index: number;
  milestones: MountainMilestone[];
  created_at: string;
}

export default function DashboardPage() {
  const [mountains, setMountains] = useState<MountainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchMountains = useCallback(async () => {
    const res = await fetch("/api/mountains");
    if (res.ok) {
      const data = await res.json();
      setMountains(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMountains();
  }, [fetchMountains]);

  async function handleDelete(id: string, goal: string) {
    if (!confirm(`Delete "${goal}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/mountains/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMountains((prev) => prev.filter((m) => m.id !== id));
    }
  }

  return (
    <div className="max-w-[1180px] mx-auto">
      {loading ? (
        <div className="mt-20 text-center">
          <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-400 mt-3">Loading your mountains...</p>
        </div>
      ) : mountains.length === 0 ? (
        <div className="mt-20 text-center">
          <p className="text-lg text-stone-600 mb-2">No mountains yet</p>
          <p className="text-sm text-stone-400 mb-6">
            Create your first mountain to start your journey.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm px-6 py-3 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
          >
            + Create Mountain
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mt-8 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-forest-950">
                My Mountains
              </h2>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="w-fit text-sm px-5 py-3 rounded-xl bg-forest-700 text-white font-semibold hover:bg-forest-600 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
            >
              + Create Mountain
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {mountains.map((m) => (
              <div key={m.id} className="group relative flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3 px-1 min-h-[44px]">
                  <div>
                    <p className="text-base text-stone-800 font-semibold leading-snug line-clamp-2" title={m.goal}>
                      {m.goal}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id, m.goal)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-summit hover:bg-red-50 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit transition-colors duration-200"
                    aria-label={`Delete ${m.goal}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <Link
                  href={`/mountain?id=${m.id}`}
                  className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white transition-all duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 active:scale-[0.99]"
                  style={{
                    boxShadow:
                      "0 6px 20px rgba(43, 58, 42, 0.06), 0 1px 2px rgba(43, 58, 42, 0.05)",
                  }}
                >
                  <div className="px-5 pt-5">
                    <p className="text-sm font-bold text-stone-900">Today</p>
                    <p className="mt-1.5 min-h-[44px] text-[13px] font-medium leading-relaxed text-stone-800">
                      {!m.current_task ? (
                        <span>No task today. Check in with your guide for the next best move.</span>
                      ) : (
                        m.current_task
                      )}
                    </p>
                  </div>

                  <div className="px-6 pt-1">
                    <MiniMountain
                      progress={m.progress}
                      totalSteps={m.milestones.length}
                      currentStep={m.current_milestone_index}
                    />
                  </div>

                  <div className="mt-auto flex items-center gap-3 px-5 pb-5 pt-3">
                    <div className="h-2 flex-1 rounded-full bg-[#EDEDEA]">
                      <div
                        className="h-full rounded-full bg-[#6FBE8B]"
                        style={{ width: `${Math.max(0, Math.min(m.progress, 100))}%` }}
                      />
                    </div>
                    <span className="text-[13px] font-bold text-forest-900">{m.progress}%</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <CreateMountainModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchMountains}
      />
    </div>
  );
}
