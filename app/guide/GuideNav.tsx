"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TabNav, { dashboardTabs } from "@/components/TabNav";
import MountainDetailNav from "@/components/MountainDetailNav";

function GuideNavInner() {
  const searchParams = useSearchParams();
  const mountainId = searchParams.get("mountain_id");

  if (mountainId) {
    return <MountainDetailNav />;
  }
  return <TabNav tabs={dashboardTabs} />;
}

export default function GuideNav() {
  return (
    <Suspense fallback={<TabNav tabs={dashboardTabs} />}>
      <GuideNavInner />
    </Suspense>
  );
}
