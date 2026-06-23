import TabNav, { dashboardTabs } from "@/components/TabNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="flex items-center justify-between px-6 pt-5 pb-3">
        <TabNav tabs={dashboardTabs} />
        <h1 className="text-xl font-bold tracking-tight text-forest-900">Goal Mountain</h1>
      </header>
      <main className="px-6 pb-10">{children}</main>
    </div>
  );
}
