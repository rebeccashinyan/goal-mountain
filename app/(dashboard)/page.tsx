import Link from "next/link";
import { mountains } from "@/lib/mock-data";
import MiniMountain from "@/components/MiniMountain";

export default function DashboardPage() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 mt-4">
        {mountains.map((m) => (
          <div key={m.id}>
            <p className="text-sm text-stone-600 mb-2 pl-1 font-medium">
              Goal: {m.goal}
            </p>
            <Link
              href="/mountain"
              className="block rounded-2xl bg-stone-100 p-4 pb-3 transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 active:scale-[0.99]"
              style={{
                boxShadow:
                  "0 1px 4px rgba(20,60,35,0.06), 0 4px 14px rgba(20,60,35,0.03)",
              }}
            >
              <p className="text-sm font-medium text-stone-700 mb-1 min-h-[40px]">
                {m.currentTask === "No Task Today" ? (
                  <span className="text-stone-400 italic">No Task Today</span>
                ) : m.currentTask === "Today's Task Completed" ? (
                  <span className="text-forest-600 italic">Today&apos;s Task Completed</span>
                ) : (
                  <>Today&apos;s Task: {m.currentTask}</>
                )}
              </p>

              <div className="h-[110px] mt-1">
                <MiniMountain
                  progress={m.progress}
                  totalSteps={m.milestones.length}
                  currentStep={m.currentMilestoneIndex}
                />
              </div>

              <p className="text-right text-lg font-semibold text-stone-700 mt-1">
                {m.progress}%
              </p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
