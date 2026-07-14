"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MountainViz from "@/components/MountainViz";
import PlanView from "@/components/PlanView";
import MiniGuideChat, { type MiniChatContext } from "@/components/MiniGuideChat";

interface MountainMilestone {
  name: string;
  description: string;
  completed: boolean;
  current?: boolean;
}

interface MountainData {
  id: string;
  goal: string;
  summit: string;
  current_milestone_index: number;
  milestones: MountainMilestone[];
}

function MountainContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [mountain, setMountain] = useState<MountainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [miniChat, setMiniChat] = useState<MiniChatContext | null>(null);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);

  const fetchMountain = useCallback(async () => {
    if (id) {
      const res = await fetch(`/api/mountains/${id}`);
      if (res.ok) {
        setMountain(await res.json());
      }
    } else {
      const res = await fetch("/api/mountains");
      if (res.ok) {
        const list = await res.json();
        if (list.length) {
          setMountain(list[0]);
        }
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMountain();
  }, [fetchMountain]);

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto mt-20 text-center">
        <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-stone-400 mt-3">Loading mountain...</p>
      </div>
    );
  }

  if (!mountain) {
    return (
      <div className="max-w-[960px] mx-auto mt-20 text-center">
        <p className="text-stone-500">
          Mountain not found. Create one from the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1180px] mx-auto mt-8 pb-10">
      <div className="mb-6 flex flex-col gap-4 px-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-forest-950">
            Mountain Overview
          </h2>
          <p className="mt-1.5 text-base font-semibold text-stone-800">
            {mountain.goal}
          </p>
        </div>
        <Link
          href={`/guide?mountain_id=${mountain.id}`}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-forest-200 bg-white px-5 py-3 text-sm font-semibold text-forest-800 transition-colors duration-200 hover:bg-forest-50 hover:border-forest-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500"
          style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-50 text-forest-700">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5L8.5 5.5L12.5 7L8.5 8.5L7 12.5L5.5 8.5L1.5 7L5.5 5.5L7 1.5Z" fill="currentColor" />
            </svg>
          </span>
          Discuss With AI
        </Link>
      </div>

      <div className="rounded-3xl border border-[#E7E0D7] bg-white p-3 md:p-5" style={{ boxShadow: "0 10px 28px rgba(43, 58, 42, 0.07)" }}>
        <MountainViz
          milestones={mountain.milestones}
          summit={mountain.summit}
          currentMilestoneIndex={mountain.current_milestone_index}
        />
      </div>
      <PlanView
        mountainId={mountain.id}
        onDailyReview={setMiniChat}
        onPlanTalk={(summary) => setMiniChat({ kind: "plan_talk", summary })}
        refreshKey={planRefreshKey}
      />
      {miniChat && (
        <MiniGuideChat
          mountainId={mountain.id}
          context={miniChat}
          onClose={() => setMiniChat(null)}
          onPlanUpdated={() => setPlanRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

export default function MountainPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[960px] mx-auto mt-20 text-center">
          <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-400 mt-3">Loading mountain...</p>
        </div>
      }
    >
      <MountainContent />
    </Suspense>
  );
}
