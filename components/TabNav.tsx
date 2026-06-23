"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function MountainsIcon({ active }: { active: boolean }) {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
      <path
        d="M8 18L14 4L20 18"
        stroke={active ? "#1E5235" : "#78716c"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "#D0ECDD" : "none"}
      />
      <path
        d="M2 18L7 8L12 18"
        stroke={active ? "#1E5235" : "#78716c"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "#EDF8F1" : "none"}
      />
    </svg>
  );
}

function AnalysisIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="4" y="10" width="3.5" height="8" rx="0.8" fill={active ? "#1E5235" : "#78716c"} />
      <rect x="9.25" y="6" width="3.5" height="12" rx="0.8" fill={active ? "#1E5235" : "#78716c"} />
      <rect x="14.5" y="3" width="3.5" height="15" rx="0.8" fill={active ? "#1E5235" : "#78716c"} />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const c = active ? "#1E5235" : "#78716c";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="3" stroke={c} strokeWidth="1.6" />
      <path
        d="M11 2v2M11 18v2M2 11h2M18 11h2M4.93 4.93l1.41 1.41M15.66 15.66l1.41 1.41M4.93 17.07l1.41-1.41M15.66 6.34l1.41-1.41"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MountainIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
      <path
        d="M2 18L11 3L20 18"
        stroke={active ? "#1E5235" : "#78716c"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "#D0ECDD" : "none"}
      />
    </svg>
  );
}

function GuideIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect
        x="2"
        y="2"
        width="18"
        height="14"
        rx="3"
        stroke={active ? "#1E5235" : "#78716c"}
        strokeWidth="1.8"
        fill={active ? "#D0ECDD" : "none"}
      />
      <path
        d="M7 19L11 16L15 19"
        stroke={active ? "#1E5235" : "#78716c"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line x1="7" y1="7" x2="15" y2="7" stroke={active ? "#1E5235" : "#78716c"} strokeWidth="1.5" />
      <line x1="7" y1="11" x2="13" y2="11" stroke={active ? "#1E5235" : "#78716c"} strokeWidth="1.5" />
    </svg>
  );
}

function InsightsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect
        x="2"
        y="2"
        width="18"
        height="18"
        rx="3"
        stroke={active ? "#1E5235" : "#78716c"}
        strokeWidth="1.8"
        fill={active ? "#D0ECDD" : "none"}
      />
      <rect x="6" y="10" width="2.5" height="6" rx="0.5" fill={active ? "#1E5235" : "#78716c"} />
      <rect x="10" y="7" width="2.5" height="9" rx="0.5" fill={active ? "#1E5235" : "#78716c"} />
      <rect x="14" y="5" width="2.5" height="11" rx="0.5" fill={active ? "#1E5235" : "#78716c"} />
    </svg>
  );
}

export type TabConfig = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ active: boolean }>;
};

export const dashboardTabs: TabConfig[] = [
  { href: "/", label: "Mountains", Icon: MountainsIcon },
  { href: "/analysis", label: "Analysis", Icon: AnalysisIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export const mountainDetailTabs: TabConfig[] = [
  { href: "/", label: "Mountains", Icon: MountainsIcon },
  { href: "/mountain", label: "Mountain", Icon: MountainIcon },
  { href: "/guide", label: "Guide", Icon: GuideIcon },
  { href: "/insights", label: "Insights", Icon: InsightsIcon },
];

export default function TabNav({ tabs }: { tabs: TabConfig[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 p-1.5 bg-stone-100 rounded-2xl w-fit" style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}>
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center justify-center w-12 h-10 rounded-xl transition-colors duration-200 ${
              isActive ? "bg-white" : "hover:bg-stone-200/60"
            }`}
            style={
              isActive
                ? { boxShadow: "0 1px 4px rgba(20,60,35,0.1), 0 0 1px rgba(20,60,35,0.08)" }
                : undefined
            }
            aria-label={tab.label}
          >
            <tab.Icon active={isActive} />
          </Link>
        );
      })}
    </nav>
  );
}
