import MountainViz from "@/components/MountainViz";
import { mountains } from "@/lib/mock-data";

export default function MountainPage() {
  const mountain = mountains[0];

  return (
    <div className="max-w-[960px] mx-auto mt-2">
      <MountainViz
        milestones={mountain.milestones}
        summit={mountain.summit}
        currentMilestoneIndex={mountain.currentMilestoneIndex}
      />
    </div>
  );
}
