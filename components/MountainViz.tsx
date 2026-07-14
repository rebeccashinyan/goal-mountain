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

// The route's x-positions come from the hand-tuned trail traced from the
// reference art: a gentle approach from the compass, wide switchbacks
// mid-mountain, a near-vertical final climb. It never rescales with the
// milestone count.
const BASE_CAMP: [number, number] = [318, 500]; // compass start — fixed
const PEAK: [number, number] = [680, 125]; // summit node — always exactly here
const BEND_X = [470, 602, 555, 665, 590, 686, 632, 654]; // the trail's 8 bends
const Y_FIRST = 455; // first milestone row; rows are evenly spaced up to the peak

const NODE_R = 7.5;
const MAX_LABEL_CHARS = 34;
// Labels form a staircase: the bottom label's right edge sits furthest
// left, and each label higher up steps rightward. The connector then runs
// from that right edge across to the (zig-zagging) node.
const LABEL_R_MIN = 250; // right edge of the bottom-most label
const LABEL_R_MAX = 548; // right edge of the summit label
const LABEL_GAP = 12; // space between label text and its connector

// x for milestone i of n, following the bend pattern: with ≤8 milestones
// each snaps to a real bend (evenly spread); with more, x is interpolated
// along the bend sequence.
function bendXFor(i: number, n: number): number {
  if (n <= 8) return BEND_X[Math.round(((i + 1) * 8) / n) - 1];
  const pos = Math.min(Math.max(((i + 1) * 8) / n - 1, 0), BEND_X.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return BEND_X[lo] + (BEND_X[hi] - BEND_X[lo]) * (pos - lo);
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

  // Every node is a bend of the route. Vertical gaps between consecutive
  // milestones are all equal (evenly spaced from the first row to the
  // peak); x follows the trail's bend pattern, so the segment lengths
  // vary like the reference. The summit node sits exactly on the peak.
  const total = n + 1; // milestones + the summit node
  const nodes: [number, number][] = Array.from({ length: total }, (_, i) => {
    if (i === total - 1) return PEAK;
    const y = Y_FIRST - ((Y_FIRST - PEAK[1]) * i) / (total - 1);
    return [bendXFor(i, n), y];
  });

  const routeD = [BASE_CAMP, ...nodes]
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");
  const traveledEnd = allDone ? total - 1 : completedIdx;
  const traveledD =
    n > 0
      ? [BASE_CAMP, ...nodes.slice(0, traveledEnd + 1)]
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
          .join(" ")
      : "";

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
        {nodes.map(([x, y], i) => {
          const meta = metas[i];
          // Staircase right edge for this label, climbing rightward with height
          const labelRight =
            LABEL_R_MIN + ((LABEL_R_MAX - LABEL_R_MIN) * i) / (total - 1);
          const connStart = Math.min(labelRight + LABEL_GAP, x - NODE_R - 20);
          return (
            <g key={i}>
              <title>{meta.tooltip}</title>
              <line x1={connStart} y1={y} x2={x - NODE_R - 4} y2={y} stroke={LEADER} strokeWidth="1.2" />
              <text
                x={labelRight}
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
        <g transform={`translate(${BASE_CAMP[0]}, ${BASE_CAMP[1]})`}>
          <circle r="22" fill="#FFFFFF" stroke={PATH_DONE} strokeWidth="3" />
          <path d="M 0 -12 L 3.2 -3.2 L 12 0 L 3.2 3.2 L 0 12 L -3.2 3.2 L -12 0 L -3.2 -3.2 Z" fill={PATH_DONE} />
          <circle r="2.4" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
}
