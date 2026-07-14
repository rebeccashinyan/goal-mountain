"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TabNav, { allMountainsTabs, mountainContextTabs } from "./TabNav";
import type { TabConfig } from "./TabNav";

type MountainOption = { id: string; goal: string };

type Section = "overview" | "insights" | "guide";

function sectionFromPathname(pathname: string): Section {
  if (pathname.startsWith("/analysis") || pathname.startsWith("/insights")) return "insights";
  if (pathname.startsWith("/guide")) return "guide";
  return "overview";
}

function hrefFor(section: Section, mountainId: string | null): string {
  if (mountainId) {
    if (section === "insights") return `/insights?id=${mountainId}`;
    if (section === "guide") return `/guide?mountain_id=${mountainId}`;
    return `/mountain?id=${mountainId}`;
  }
  if (section === "insights") return "/analysis";
  if (section === "guide") return "/guide";
  return "/";
}

function ContextNavInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountainId = searchParams.get("id") || searchParams.get("mountain_id");
  const [mountains, setMountains] = useState<MountainOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mountains")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setMountains(data.map((m) => ({ id: m.id, goal: m.goal })));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const section = sectionFromPathname(pathname);

  const tabs: TabConfig[] = (mountainId ? mountainContextTabs : allMountainsTabs).map((tab) => ({
    ...tab,
    href: hrefFor(tab.section, mountainId),
  }));

  return (
    <div className="flex items-center gap-3">
      <TabNav tabs={tabs} />
      <div
        className="relative flex items-center bg-white rounded-2xl"
        style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="pointer-events-none absolute left-3.5"
          aria-hidden="true"
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#57534e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <select
          value={mountainId ?? "all"}
          onChange={(e) => {
            const value = e.target.value;
            router.push(hrefFor(section, value === "all" ? null : value));
          }}
          aria-label="Switch context"
          className="appearance-none cursor-pointer bg-transparent rounded-2xl pl-8 pr-4 h-[52px] w-[230px] truncate text-[13px] font-semibold text-forest-950 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 transition-colors duration-200"
        >
          <option value="all">All Mountains</option>
          {mountains.map((m) => (
            <option key={m.id} value={m.id}>
              {m.goal.length > 40 ? m.goal.slice(0, 39).trimEnd() + "…" : m.goal}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function ContextNav() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-3">
          <TabNav tabs={allMountainsTabs} />
        </div>
      }
    >
      <ContextNavInner />
    </Suspense>
  );
}
