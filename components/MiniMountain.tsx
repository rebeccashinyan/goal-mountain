"use client";

interface MiniMountainProps {
  progress: number;
  totalSteps: number;
  currentStep: number;
}

const PATH_GREEN = "#4A9D6F";
const PATH_DONE = "#2D6A48";
const SCENERY = "#B8D4C0";
const SCENERY_SOFT = "#D8E6DC";
const SUMMIT_FLAG = "#F4D03F";

// Same fixed trail geometry as MountainViz — this is the label-free,
// card-sized rendering of the same expedition map. The viewBox crops to
// the art itself (the full map reserves x < 240 for labels).
const BASE_CAMP: [number, number] = [318, 500];
const PEAK: [number, number] = [680, 125];
const BEND_X = [470, 602, 555, 665, 590, 686, 632, 654];
const Y_FIRST = 455;

const VIEW = { x: 245, y: 45, w: 815, h: 520 };
const NODE_R = 9;

function bendXFor(i: number, n: number): number {
  if (n <= 8) return BEND_X[Math.round(((i + 1) * 8) / n) - 1];
  const pos = Math.min(Math.max(((i + 1) * 8) / n - 1, 0), BEND_X.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return BEND_X[lo] + (BEND_X[hi] - BEND_X[lo]) * (pos - lo);
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

export default function MiniMountain({ progress, totalSteps, currentStep }: MiniMountainProps) {
  const n = Math.max(totalSteps, 1);
  const allDone = progress >= 100;
  const completedIdx = Math.max(0, Math.min(currentStep, n - 1));

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
  const traveledD = [BASE_CAMP, ...nodes.slice(0, traveledEnd + 1)]
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ");

  return (
    <svg
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      className="w-full h-auto"
      aria-hidden="true"
    >
      {/* Left shoulder — slope line the upper trail climbs across */}
      <path
        d="M 660 160 C 610 240 545 300 470 350 C 400 392 300 435 240 460"
        fill="none"
        stroke={SCENERY_SOFT}
        strokeWidth="2.5"
      />

      {/* Foothill lines, bottom left and right */}
      <path d="M 245 520 C 340 542 430 568 560 592" fill="none" stroke={SCENERY_SOFT} strokeWidth="2.5" />
      <path d="M 480 620 C 600 565 760 545 1060 450" fill="none" stroke={SCENERY_SOFT} strokeWidth="2.5" />
      <path d="M 650 620 C 780 588 920 580 1060 522" fill="none" stroke={SCENERY_SOFT} strokeWidth="2.5" />

      {/* Mountain silhouette — right ridge from the peak */}
      <path
        d={`M ${PEAK[0]} ${PEAK[1]} L 707 173 L 719 159 L 790 300 L 806 283 L 872 430 L 886 415 L 950 585`}
        fill="none"
        stroke={SCENERY}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />

      {/* Pine trees — on the face and in the foothills */}
      {[
        [775, 400, 7], [806, 420, 9], [838, 395, 7],
        [706, 520, 9], [748, 548, 11], [792, 522, 9], [828, 560, 10],
      ].map(([x, y, s], i) => (
        <path key={i} d={pineTree(x, y, s)} fill="none" stroke={SCENERY} strokeWidth="2" strokeLinecap="round" />
      ))}

      {/* Cloud */}
      <path
        d="M 838 230 q 3 -13 17 -12 q 5 -11 18 -8 q 11 -9 21 1 q 13 0 14 13 q 0 7 -9 7 l -52 0 q -9 0 -9 -7 Z"
        fill="#FFFFFF"
        stroke={SCENERY}
        strokeWidth="2"
      />

      {/* Route */}
      <path d={routeD} fill="none" stroke={PATH_GREEN} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={traveledD} fill="none" stroke={PATH_DONE} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

      {/* Summit flag — rises from the summit node */}
      <line x1={PEAK[0]} y1={PEAK[1]} x2={PEAK[0]} y2={PEAK[1] - 62} stroke="#2B3442" strokeWidth="3" />
      <polygon
        points={`${PEAK[0] + 1},${PEAK[1] - 62} ${PEAK[0] + 36},${PEAK[1] - 52} ${PEAK[0] + 1},${PEAK[1] - 42}`}
        fill={SUMMIT_FLAG}
      />

      {/* Milestone nodes */}
      {nodes.map(([x, y], i) => {
        const isSummit = i === total - 1;
        const isDone = allDone || (!isSummit && i < completedIdx);
        const isCurrent = !allDone && !isSummit && i === completedIdx;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={NODE_R}
              fill={isDone ? PATH_GREEN : isCurrent ? SUMMIT_FLAG : "#FFFFFF"}
              stroke={isDone || isCurrent ? PATH_GREEN : "#8BA894"}
              strokeWidth="2.8"
            />
            {isDone && <circle cx={x} cy={y} r={NODE_R * 0.34} fill="#FFFFFF" />}
          </g>
        );
      })}

      {/* Compass — base camp start */}
      <g transform={`translate(${BASE_CAMP[0]}, ${BASE_CAMP[1]})`}>
        <circle r="24" fill="#FFFFFF" stroke={PATH_DONE} strokeWidth="4" />
        <path d="M 0 -13 L 3.5 -3.5 L 13 0 L 3.5 3.5 L 0 13 L -3.5 3.5 L -13 0 L -3.5 -3.5 Z" fill={PATH_DONE} />
        <circle r="2.6" fill="#FFFFFF" />
      </g>
    </svg>
  );
}
