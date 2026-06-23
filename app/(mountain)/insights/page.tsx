import { patterns, risks, strategicCards, weekDays } from "@/lib/mock-data";

export default function InsightsPage() {
  const journeyHealth = {
    currentCamp: "Camp 2 — Run 5K",
    progress: 42,
    consistency: 82,
    summitProbability: 87,
  };

  return (
    <div className="max-w-[1100px] mx-auto mt-2 space-y-10">
      {/* Journey Health */}
      <section>
        <h2 className="text-lg font-semibold text-stone-800 mb-3">Journey Health</h2>
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.06)" }}
        >
          {[
            { label: "Current Camp", value: journeyHealth.currentCamp },
            { label: "Progress", value: `${journeyHealth.progress}%` },
            { label: "Consistency", value: `${journeyHealth.consistency}%` },
            { label: "Summit Probability", value: `${journeyHealth.summitProbability}%` },
          ].map((item) => (
            <div key={item.label} className="bg-stone-50 px-5 py-4">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">
                {item.label}
              </p>
              <p className="text-base font-semibold text-stone-800 mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Patterns & Learnings + Obstacles & Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-3">
            Patterns &amp; Learnings
          </h2>
          <div
            className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
            style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.04)" }}
          >
            <ul className="space-y-2.5">
              {patterns.map((p) => (
                <li key={p} className="text-sm text-stone-700 leading-relaxed">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-3">
            Obstacles &amp; Risks
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {risks.map((risk, i) => (
              <div
                key={risk.title}
                className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
                style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.04)" }}
              >
                <p className="text-xs text-stone-400 font-medium mb-2">Risk #{i + 1}</p>
                <p className="text-sm font-semibold text-stone-800 mb-3">{risk.title}</p>
                <div className="space-y-1.5 text-xs text-stone-600">
                  <p>
                    <span className="text-stone-400">Detected:</span> {risk.detected} times
                  </p>
                  <p>
                    <span className="text-stone-400">Impact:</span>{" "}
                    <span
                      className={
                        risk.impact === "High"
                          ? "text-summit font-medium"
                          : "text-amber-600 font-medium"
                      }
                    >
                      {risk.impact}
                    </span>
                  </p>
                  <p>
                    <span className="text-stone-400">Suggested Fix:</span>{" "}
                    {risk.suggestedFix}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* AI Strategic Intelligence */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-800">
            AI Strategic Intelligence
          </h2>
          <button
            className="text-sm px-4 py-2 rounded-xl bg-white text-stone-700 font-medium border border-stone-200 hover:bg-forest-50 hover:border-forest-300 hover:text-forest-800 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 transition-colors duration-200"
            style={{ boxShadow: "0 1px 3px rgba(20,60,35,0.06)" }}
            type="button"
          >
            Discuss With AI
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {strategicCards.map((card) => (
            <div
              key={card.number}
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.04)" }}
            >
              <p className="text-sm font-semibold text-stone-800 mb-3">
                {card.number} {card.title}
              </p>
              <div className="space-y-0.5">
                {card.lines.map((line, i) => (
                  <p
                    key={i}
                    className={`text-xs leading-relaxed ${
                      line === "" ? "h-2" : "text-stone-600"
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Progress Timeline + AI Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-3">
            Progress Timeline
          </h2>
          <div
            className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
            style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.04)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-stone-700">June</p>
              <div className="flex gap-1">
                <span className="text-xs px-2.5 py-1 bg-stone-200 rounded-lg text-stone-500">
                  Month
                </span>
                <span className="text-xs px-2.5 py-1 bg-white rounded-lg text-stone-700 font-medium border border-stone-200">
                  Week
                </span>
              </div>
            </div>

            <div className="flex items-end gap-0 justify-between mb-4">
              {weekDays.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-full ${
                      d.active ? "bg-forest-500" : "bg-stone-200"
                    }`}
                  />
                  <p className="text-[10px] text-stone-500 font-medium">{d.day}</p>
                  <p className="text-[10px] text-stone-400">{d.date}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <button className="text-stone-400 hover:text-stone-600 transition-colors duration-200" type="button">
                ←
              </button>
              <button className="text-stone-400 hover:text-stone-600 transition-colors duration-200" type="button">
                →
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-stone-200 space-y-1.5">
              <p className="text-xs text-stone-600">
                <span className="text-stone-400">Completed Camps:</span> 1
              </p>
              <p className="text-xs text-stone-600">
                <span className="text-stone-400">Completed Checkpoints:</span> 5
              </p>
              <p className="text-xs text-stone-600">
                <span className="text-stone-400">Active Days:</span> Mon Tue Thu Sat
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-3">AI Predictions</h2>
          <div className="space-y-4">
            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.04)" }}
            >
              <p className="text-xs text-stone-400 font-medium mb-3">
                If Current Pattern Continues
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Camp 3</span>
                  <span className="text-forest-700 font-medium">2 weeks early</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Summit</span>
                  <span className="text-forest-700 font-medium">3 weeks early</span>
                </div>
              </div>
            </div>

            <div
              className="bg-stone-50 rounded-2xl p-5 border border-stone-200"
              style={{ boxShadow: "0 1px 4px rgba(20,60,35,0.04)" }}
            >
              <p className="text-xs text-stone-400 font-medium mb-3">
                If Consistency Drops 20%
              </p>
              <p className="text-sm text-summit font-medium">
                Summit delayed by 1 month
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
