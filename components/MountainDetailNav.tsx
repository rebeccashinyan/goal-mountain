"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TabNav, { mountainBackTab, mountainContextTabs } from "./TabNav";
import type { TabConfig } from "./TabNav";

function MountainDetailNavInner() {
  const searchParams = useSearchParams();
  const mountainId = searchParams.get("id");

  const contextTabs: TabConfig[] = mountainContextTabs.map((tab) => {
    if (tab.href === "/guide" && mountainId) {
      return { ...tab, href: `/guide?mountain_id=${mountainId}` };
    }
    if (mountainId && tab.href !== "/guide") {
      return { ...tab, href: `${tab.href}?id=${mountainId}` };
    }
    return tab;
  });

  return (
    <div className="flex items-center gap-2">
      <TabNav tabs={mountainBackTab} />
      <div className="w-px h-6 bg-stone-300/60 rounded-full" />
      <TabNav tabs={contextTabs} />
    </div>
  );
}

export default function MountainDetailNav() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-2">
        <TabNav tabs={mountainBackTab} />
        <div className="w-px h-6 bg-stone-300/60 rounded-full" />
        <TabNav tabs={mountainContextTabs} />
      </div>
    }>
      <MountainDetailNavInner />
    </Suspense>
  );
}
