"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MountainViz from "@/components/MountainViz";
import PlanView from "@/components/PlanView";
import ProgressTracker from "@/components/ProgressTracker";
import ReflectionView from "@/components/ReflectionView";

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
    <div className="max-w-[960px] mx-auto mt-2 pb-10">
      <div className="flex justify-end mb-2">
        <Link
          href={`/guide?mountain_id=${mountain.id}`}
          className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
          style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
        >
          Discuss With AI
        </Link>
      </div>
      <MountainViz
        milestones={mountain.milestones}
        summit={mountain.summit}
        currentMilestoneIndex={mountain.current_milestone_index}
      />
      <PlanView mountainId={mountain.id} />
      <ProgressTracker
        mountainId={mountain.id}
        onProgressLogged={fetchMountain}
      />
      <ReflectionView mountainId={mountain.id} />
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
