export default function SettingsPage() {
  return (
    <div className="max-w-[1180px] mx-auto mt-8 pb-10">
      <div className="px-1">
        <h2 className="text-3xl font-bold text-forest-950">Settings</h2>
        <p className="mt-1.5 max-w-2xl text-base font-semibold text-stone-800">
          Guide personality, notifications, privacy, and journey preferences will live here.
        </p>
      </div>

      <div className="mt-8 rounded-3xl bg-white p-8 text-center" style={{ boxShadow: "0 6px 20px rgba(43, 58, 42, 0.06), 0 1px 2px rgba(43, 58, 42, 0.05)" }}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-50 ring-1 ring-forest-100">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M13 4L15.2 9.8L21 12L15.2 14.2L13 20L10.8 14.2L5 12L10.8 9.8L13 4Z" fill="#E7B85B" stroke="#1E5235" strokeWidth="1.4" />
          </svg>
        </div>
        <p className="text-base font-semibold text-stone-700">Settings are coming soon</p>
        <p className="mt-1 text-sm text-stone-500">
          For now, Goal Mountain is focused on generating mountains, planning, tracking, reflection, and AI guidance.
        </p>
      </div>
    </div>
  );
}
