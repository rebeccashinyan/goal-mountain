"use client";

interface Milestone {
  name: string;
  description: string;
  completed: boolean;
  current?: boolean;
}

interface MountainVizProps {
  milestones: Milestone[];
  summit: string;
  currentMilestoneIndex: number;
}

const PATH_BLUE = "#4A6E96";
const PATH_DONE = "#2C4E74";
const SCENERY = "#C5D5E6";
const SCENERY_SOFT = "#DCE6F0";
const AMBER = "#E9B24A";
const MUTED = "#66707D";
const LEADER = "#DDE6EF";
const ACCENT = "#46698F";

// The route is a fixed, hand-tuned trail traced from the reference art:
// a long gentle approach, wide switchbacks mid-mountain, near-vertical
// at the top. Milestone nodes are placed along it by arc length, so the
// trail keeps its shape no matter how many milestones a mountain has.
const TRAIL: [number, number][] = [
  [318, 500], [470, 455], [602, 424], [555, 376], [665, 340],
  [590, 296], [686, 260], [632, 228], [654, 170],
];
const PEAK: [number, number] = [680, 125];

const SEG_LENS = TRAIL.slice(0, -1).map((p, s) =>
  Math.hypot(TRAIL[s + 1][0] - p[0], TRAIL[s + 1][1] - p[1])
);
const TRAIL_LEN = SEG_LENS.reduce((a, b) => a + b, 0);

// Point at arc distance d along the trail
function trailPoint(d: number): [number, number] {
  let s = 0;
  while (s < SEG_LENS.length - 1 && d > SEG_LENS[s]) {
    d -= SEG_LENS[s];
    s++;
  }
  const f = Math.min(Math.max(d / SEG_LENS[s], 0), 1);
  return [
    TRAIL[s][0] + (TRAIL[s + 1][0] - TRAIL[s][0]) * f,
    TRAIL[s][1] + (TRAIL[s + 1][1] - TRAIL[s][1]) * f,
  ];
}

// Path from the trail start up to arc distance d (for the traveled overlay)
function trailPathTo(dist: number): string {
  let d = `M ${TRAIL[0][0]} ${TRAIL[0][1]}`;
  let remaining = dist;
  for (let s = 0; s < SEG_LENS.length; s++) {
    if (remaining <= SEG_LENS[s]) {
      const [cx, cy] = trailPoint(dist);
      return d + ` L ${cx} ${cy}`;
    }
    remaining -= SEG_LENS[s];
    d += ` L ${TRAIL[s + 1][0]} ${TRAIL[s + 1][1]}`;
  }
  return d;
}

// First node clears the compass; the last lands exactly on the final
// bend below the peak, like the reference's summit-stage node
const nodeDist = (i: number, count: number) => (TRAIL_LEN * (i + 1.5)) / (count + 0.5);

function pineTree(x: number, y: number, s: number) {
  return [
    `M ${x} ${y - 3 * s} L ${x - s} ${y - s}`,
    `M ${x} ${y - 3 * s} L ${x + s} ${y - s}`,
    `M ${x} ${y - 2.1 * s} L ${x - 1.35 * s} ${y}`,
    `M ${x} ${y - 2.1 * s} L ${x + 1.35 * s} ${y}`,
    `M ${x} ${y} L ${x} ${y + s * 0.9}`,
  ].join(" ");
}

export default function MountainViz({ milestones, summit, currentMilestoneIndex }: MountainVizProps) {
  const viewW = 980;
  const viewH = 620;
  const n = milestones.length;
  const dense = n > 9;
  const completedIdx = Math.max(0, Math.min(currentMilestoneIndex, Math.max(n - 1, 0)));

  const nodes = milestones.map((_, i) => trailPoint(nodeDist(i, n)));

  // Like the reference, only label nodes with breathing room — skipped
  // nodes stay as plain dots (full name in tooltip). The current
  // milestone is always labeled.
  const gap = dense ? 24 : 0;
  const labeled: boolean[] = new Array(n).fill(false);
  if (n > 0) labeled[completedIdx] = true;
  let lastLabelY = Infinity;
  for (let i = 0; i < n; i++) {
    if (i === completedIdx) {
      lastLabelY = nodes[i][1];
      continue;
    }
    const y = nodes[i][1];
    const clearsPrev = lastLabelY - y >= gap;
    const clearsCurrent = Math.abs(y - nodes[completedIdx][1]) >= gap;
    if (clearsPrev && clearsCurrent) {
      labeled[i] = true;
      lastLabelY = y;
    }
  }

  const fullRoute =
    TRAIL.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") +
    ` L ${PEAK[0]} ${PEAK[1]}`;

  const nodeR = dense ? 7 : 8.5;
  const labelSize = dense ? 13 : 14;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-auto min-w-[760px]">
        <title>{summit}</title>

        <rect width={viewW} height={viewH} rx="28" fill="#F6F8FB" />

        {/* Left shoulder — slope line the upper trail climbs across */}
        <path
          d="M 660 160 C 610 240 545 300 470 350 C 400 392 300 435 160 483"
          fill="none"
          stroke={SCENERY_SOFT}
          strokeWidth="2"
        />

        {/* Foothill lines, bottom right */}
        <path d="M 480 620 C 600 565 740 545 980 470" fill="none" stroke={SCENERY_SOFT} strokeWidth="2" />
        <path d="M 650 620 C 760 590 880 585 980 545" fill="none" stroke={SCENERY_SOFT} strokeWidth="2" />

        {/* Mountain silhouette — right ridge from the peak */}
        <path
          d={`M ${PEAK[0]} ${PEAK[1]} L 707 173 L 719 159 L 790 300 L 806 283 L 872 430 L 886 415 L 950 585`}
          fill="none"
          stroke={SCENERY}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Pine trees — on the face and in the foothills */}
        {[
          [775, 400, 6], [806, 420, 8], [838, 395, 6],
          [706, 520, 8], [748, 548, 10], [792, 522, 8], [828, 560, 9],
        ].map(([x, y, s], i) => (
          <path key={i} d={pineTree(x, y, s)} fill="none" stroke={SCENERY} strokeWidth="1.5" strokeLinecap="round" />
        ))}

        {/* Cloud */}
        <path
          d="M 838 230 q 3 -13 17 -12 q 5 -11 18 -8 q 11 -9 21 1 q 13 0 14 13 q 0 7 -9 7 l -52 0 q -9 0 -9 -7 Z"
          fill="#FFFFFF"
          stroke={SCENERY}
          strokeWidth="1.5"
        />

        {/* Route */}
        <path d={fullRoute} fill="none" stroke={PATH_BLUE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {n > 0 && (
          <path
            d={trailPathTo(nodeDist(completedIdx, n))}
            fill="none"
            stroke={PATH_DONE}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Milestone nodes + labels */}
        {milestones.map((m, i) => {
          const [x, y] = nodes[i];
          const isCurrent = i === completedIdx && !m.completed;
          const isDone = m.completed || i < completedIdx;
          const shortName = m.name.split(":")[0].trim();
          return (
            <g key={i}>
              <title>{`${m.name} — ${m.description}`}</title>
              {labeled[i] && (
                <>
                  <line x1={x - 92} y1={y} x2={x - nodeR - 4} y2={y} stroke={LEADER} strokeWidth="1.2" />
                  <text
                    x={x - 100}
                    y={y + labelSize * 0.34}
                    textAnchor="end"
                    fill={isCurrent ? "#1F3A5F" : MUTED}
                    fontSize={labelSize}
                    fontFamily="var(--font-body), system-ui, sans-serif"
                    fontWeight={isCurrent ? "700" : "500"}
                  >
                    {i + 1}. {shortName}
                  </text>
                </>
              )}
              <circle
                cx={x}
                cy={y}
                r={nodeR}
                fill={isDone ? PATH_BLUE : isCurrent ? AMBER : "#FFFFFF"}
                stroke={isDone || isCurrent ? PATH_BLUE : "#7C99B8"}
                strokeWidth="2.4"
              />
              {isDone && <circle cx={x} cy={y} r={nodeR * 0.34} fill="#FFFFFF" />}
            </g>
          );
        })}

        {/* Compass — base camp start */}
        <g transform={`translate(${TRAIL[0][0]}, ${TRAIL[0][1]})`}>
          <circle r="22" fill="#FFFFFF" stroke={PATH_BLUE} strokeWidth="3" />
          <path d="M 0 -12 L 3.2 -3.2 L 12 0 L 3.2 3.2 L 0 12 L -3.2 3.2 L -12 0 L -3.2 -3.2 Z" fill={AMBER} />
          <circle r="2.4" fill="#2B3442" />
        </g>

        {/* Summit flag */}
        <line x1={PEAK[0]} y1={PEAK[1]} x2={PEAK[0]} y2={PEAK[1] - 62} stroke="#2B3442" strokeWidth="2.5" />
        <polygon
          points={`${PEAK[0] + 1},${PEAK[1] - 62} ${PEAK[0] + 36},${PEAK[1] - 52} ${PEAK[0] + 1},${PEAK[1] - 42}`}
          fill={AMBER}
        />
        <text
          x={PEAK[0] + 58}
          y={PEAK[1] - 27}
          fill={ACCENT}
          fontSize="17"
          fontWeight="700"
          fontFamily="var(--font-body), system-ui, sans-serif"
        >
          summit
        </text>

        {/* Base camp legend */}
        <rect x="50" y="548" width="56" height="5" rx="2.5" fill={ACCENT} />
        <rect x="240" y="548" width="66" height="5" rx="2.5" fill={ACCENT} />
        <text x="50" y="588" fill={MUTED} fontSize="15" fontFamily="var(--font-body), system-ui, sans-serif">
          Base camp – begin your journey
        </text>
      </svg>
    </div>
  );
}
