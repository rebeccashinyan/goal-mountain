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
    <div className="max-w-[1100px] mx-auto">
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
          <div className="flex justify-end mb-4 mt-2">
            <button
              onClick={() => setModalOpen(true)}
              className="text-sm px-4 py-2 rounded-xl bg-forest-700 text-white font-medium hover:bg-forest-600 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
              style={{ boxShadow: "0 2px 8px rgba(20,60,35,0.2)" }}
            >
              + Create Mountain
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {mountains.map((m) => (
              <div key={m.id}>
                <div className="flex items-center justify-between mb-2 pl-1">
                  <p className="text-sm text-stone-600 font-medium">
                    Goal: {m.goal}
                  </p>
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
                  className="block rounded-2xl bg-stone-100 p-4 pb-3 transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 active:scale-[0.99]"
                  style={{
                    boxShadow:
                      "0 1px 4px rgba(20,60,35,0.06), 0 4px 14px rgba(20,60,35,0.03)",
                  }}
                >
                  <p className="text-sm font-medium text-stone-700 mb-1 min-h-[40px]">
                    {!m.current_task ? (
                      <span className="text-stone-400 italic">No Task Today</span>
                    ) : (
                      <>Today&apos;s Task: {m.current_task}</>
                    )}
                  </p>

                  <div className="h-[110px] mt-1">
                    <MiniMountain
                      progress={m.progress}
                      totalSteps={m.milestones.length}
                      currentStep={m.current_milestone_index}
                    />
                  </div>

                  <p className="text-right text-lg font-semibold text-stone-700 mt-1">
                    {m.progress}%
                  </p>
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
