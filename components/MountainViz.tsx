"use client";

interface Milestone {
  name: string;
  mapLabel?: string;
  description: string;
  completed: boolean;
  current?: boolean;
}

interface MountainVizProps {
  milestones: Milestone[];
  summit: string;
  currentMilestoneIndex: number;
}

const PATH_GREEN = "#4A9D6F";
const PATH_DONE = "#2D6A48";
const SCENERY = "#B8D4C0";
const SCENERY_SOFT = "#D8E6DC";
const SUMMIT_FLAG = "#F4D03F";
const MUTED = "#5A7363";
const LEADER = "#D4E0D8";
const CURRENT = "#1E3A2A";

// Fixed canvas and fixed reference geometry — labels are an overlay and
// never influence the mountain's size, position, or proportions.
const VIEW_W = 980;
const VIEW_H = 620;

// The route is the hand-tuned trail traced from the reference art: a long
// gentle approach from the compass, wide switchbacks mid-mountain, and a
// near-vertical final climb. It never rescales with the milestone count.
const TRAIL: [number, number][] = [
  [318, 500], [470, 455], [602, 424], [555, 376], [665, 340],
  [590, 296], [686, 260], [632, 228], [654, 170],
];
const PEAK: [number, number] = [680, 125]; // summit node — always exactly here
const FULL: [number, number][] = [...TRAIL, PEAK];

const SEG_LENS = FULL.slice(0, -1).map((p, s) =>
  Math.hypot(FULL[s + 1][0] - p[0], FULL[s + 1][1] - p[1])
);
const CUM: number[] = SEG_LENS.reduce<number[]>((acc, len) => {
  acc.push(acc[acc.length - 1] + len);
  return acc;
}, [0]);
const TRAIL_LEN = CUM[TRAIL.length - 1]; // up to the last bend below the peak
const TOTAL_LEN = CUM[CUM.length - 1]; // including the final climb to the peak

const NODE_R = 7.5;
const CONNECTOR_LEN = 86; // short leader, stops just before the node
const MAX_LABEL_CHARS = 34;

// Point at arc distance d along the full route
function trailPoint(d: number): [number, number] {
  let s = 0;
  while (s < SEG_LENS.length - 1 && d > CUM[s + 1]) s++;
  const f = Math.min(Math.max((d - CUM[s]) / SEG_LENS[s], 0), 1);
  return [
    FULL[s][0] + (FULL[s + 1][0] - FULL[s][0]) * f,
    FULL[s][1] + (FULL[s + 1][1] - FULL[s][1]) * f,
  ];
}

// Path from the route start up to arc distance d (for the traveled overlay)
function trailPathTo(dist: number): string {
  let d = `M ${FULL[0][0]} ${FULL[0][1]}`;
  for (let s = 0; s < SEG_LENS.length; s++) {
    if (dist <= CUM[s + 1]) {
      const [cx, cy] = trailPoint(dist);
      return d + ` L ${cx} ${cy}`;
    }
    d += ` L ${FULL[s + 1][0]} ${FULL[s + 1][1]}`;
  }
  return d;
}

function truncate(text: string): string {
  return text.length > MAX_LABEL_CHARS
    ? text.slice(0, MAX_LABEL_CHARS - 1).trimEnd() + "…"
    : text;
}

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
  const n = milestones.length;
  const completedIdx = Math.max(0, Math.min(currentMilestoneIndex, n - 1));
  const allDone = n > 0 && milestones.every((m) => m.completed);

  // Milestone nodes live on the fixed trail. With up to 8 milestones each
  // node snaps to one of the trail's real bends (evenly spread); with more,
  // nodes are spaced along the trail by arc length. The summit is appended
  // as the final node, always exactly on the peak.
  const mNodes: { p: [number, number]; d: number }[] =
    n <= 8
      ? milestones.map((_, i) => {
          const idx = Math.round(((i + 1) * 8) / n);
          return { p: TRAIL[idx], d: CUM[idx] };
        })
      : milestones.map((_, i) => {
          const d = (TRAIL_LEN * (i + 1.5)) / (n + 0.5);
          return { p: trailPoint(d), d };
        });
  const nodes = [...mNodes, { p: PEAK, d: TOTAL_LEN }];

  const routeD = FULL.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const traveledEnd = allDone ? nodes.length - 1 : completedIdx;
  const traveledD = n > 0 ? trailPathTo(nodes[traveledEnd].d) : "";

  const metas = [
    ...milestones.map((m, i) => ({
      label: truncate(`${i + 1}. ${m.mapLabel?.trim() || m.name}`),
      tooltip: `${m.name} — ${m.description}`,
      isDone: m.completed || i < completedIdx,
      isCurrent: i === completedIdx && !m.completed,
    })),
    {
      label: `${n + 1}. Summit`,
      tooltip: `Summit — ${summit}`,
      isDone: allDone,
      isCurrent: false,
    },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto min-w-[760px]">
        <title>{summit}</title>

        <rect width={VIEW_W} height={VIEW_H} rx="28" fill="#F9F7F3" />

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
        <path d={routeD} fill="none" stroke={PATH_GREEN} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {traveledD && (
          <path d={traveledD} fill="none" stroke={PATH_DONE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Summit flag — rises from the summit node */}
        <line x1={PEAK[0]} y1={PEAK[1]} x2={PEAK[0]} y2={PEAK[1] - 62} stroke="#2B3442" strokeWidth="2.5" />
        <polygon
          points={`${PEAK[0] + 1},${PEAK[1] - 62} ${PEAK[0] + 36},${PEAK[1] - 52} ${PEAK[0] + 1},${PEAK[1] - 42}`}
          fill={SUMMIT_FLAG}
        />

        {/* Label overlay — one label + short connector per node, anchored to
            the node's exact position; never moves the route or mountain */}
        {nodes.map(({ p: [x, y] }, i) => {
          const meta = metas[i];
          const connEnd = x - NODE_R - 4;
          return (
            <g key={i}>
              <title>{meta.tooltip}</title>
              <line x1={connEnd - CONNECTOR_LEN} y1={y} x2={connEnd} y2={y} stroke={LEADER} strokeWidth="1.2" />
              <text
                x={connEnd - CONNECTOR_LEN - 8}
                y={y + 4.7}
                textAnchor="end"
                fill={meta.isCurrent ? CURRENT : MUTED}
                fontSize="13.5"
                fontFamily="var(--font-body), system-ui, sans-serif"
                fontWeight={meta.isCurrent ? "700" : "500"}
              >
                {meta.label}
              </text>
              <circle
                cx={x}
                cy={y}
                r={NODE_R}
                fill={meta.isDone ? PATH_GREEN : meta.isCurrent ? SUMMIT_FLAG : "#FFFFFF"}
                stroke={meta.isDone || meta.isCurrent ? PATH_GREEN : "#8BA894"}
                strokeWidth="2.2"
              />
              {meta.isDone && <circle cx={x} cy={y} r={NODE_R * 0.34} fill="#FFFFFF" />}
            </g>
          );
        })}

        {/* Compass — base camp start */}
        <g transform={`translate(${TRAIL[0][0]}, ${TRAIL[0][1]})`}>
          <circle r="22" fill="#FFFFFF" stroke={PATH_DONE} strokeWidth="3" />
          <path d="M 0 -12 L 3.2 -3.2 L 12 0 L 3.2 3.2 L 0 12 L -3.2 3.2 L -12 0 L -3.2 -3.2 Z" fill={PATH_DONE} />
          <circle r="2.4" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
}
