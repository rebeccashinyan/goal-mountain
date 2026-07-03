export default function SettingsPage() {
  return (
    <div className="max-w-[1180px] mx-auto mt-8 pb-10">
      <div className="rounded-3xl border border-[#E7E0D7] bg-[#FBF8F1] px-6 py-5" style={{ boxShadow: "0 10px 28px rgba(43, 58, 42, 0.08), 0 1px 2px rgba(43, 58, 42, 0.06)" }}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-forest-100">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <circle cx="15" cy="15" r="4" fill="#EDF8F1" stroke="#1E5235" strokeWidth="1.6" />
              <path d="M15 5V8M15 22V25M5 15H8M22 15H25M8 8L10.2 10.2M19.8 19.8L22 22M8 22L10.2 19.8M19.8 10.2L22 8" stroke="#1E5235" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M23 4.5L24 7L26.5 8L24 9L23 11.5L22 9L19.5 8L22 7L23 4.5Z" fill="#E7B85B" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">
              Preferences
            </p>
            <h2 className="mt-1 text-3xl font-bold text-forest-950">Settings</h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Guide personality, notifications, privacy, and journey preferences will live here.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-[#E7E0D7] bg-white p-8 text-center" style={{ boxShadow: "0 10px 28px rgba(43, 58, 42, 0.07)" }}>
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
