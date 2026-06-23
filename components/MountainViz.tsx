"use client";

import type { Milestone } from "@/lib/mock-data";

interface MountainVizProps {
  milestones: Milestone[];
  summit: string;
  currentMilestoneIndex: number;
}

export default function MountainViz({ milestones, summit, currentMilestoneIndex }: MountainVizProps) {
  const totalSteps = milestones.length;
  const viewW = 920;
  const viewH = 620;
  const baseY = 570;
  const peakY = 60;
  const startX = 70;
  const peakX = 680;
  const rightX = 870;

  const stepH = (baseY - peakY - 40) / totalSteps;
  const stepW = (peakX - startX) / totalSteps;

  const stairPoints: [number, number][] = [[startX, baseY]];
  for (let i = 0; i < totalSteps; i++) {
    const x = startX + stepW * (i + 1);
    const yBottom = baseY - stepH * i;
    const yTop = baseY - stepH * (i + 1);
    stairPoints.push([x, yBottom]);
    stairPoints.push([x, yTop]);
  }

  const lastStairX = stairPoints[stairPoints.length - 1][0];
  const lastStairY = stairPoints[stairPoints.length - 1][1];

  const completedIdx = currentMilestoneIndex;
  const completedStairEnd = Math.min(completedIdx * 2 + 2, stairPoints.length - 1);

  let completedPath = `M ${stairPoints[0][0]} ${stairPoints[0][1]}`;
  for (let i = 1; i <= completedStairEnd; i++) {
    completedPath += ` L ${stairPoints[i][0]} ${stairPoints[i][1]}`;
  }
  const cEndX = stairPoints[completedStairEnd][0];
  const cEndY = stairPoints[completedStairEnd][1];
  completedPath += ` L ${cEndX} ${baseY} L ${startX} ${baseY} Z`;

  let outlinePath = `M ${stairPoints[0][0]} ${stairPoints[0][1]}`;
  for (let i = 1; i < stairPoints.length; i++) {
    outlinePath += ` L ${stairPoints[i][0]} ${stairPoints[i][1]}`;
  }
  outlinePath += ` L ${lastStairX + 20} ${peakY}`;
  outlinePath += ` L ${rightX} ${baseY}`;
  outlinePath += ` L ${startX} ${baseY} Z`;

  const starStep = currentMilestoneIndex;
  const starX = stairPoints[Math.min(starStep * 2 + 1, stairPoints.length - 1)][0] + stepW * 0.3;
  const starY = stairPoints[Math.min(starStep * 2 + 2, stairPoints.length - 1)][1] + stepH * 0.4;

  const flagX = lastStairX + 20;
  const flagY = peakY;

  const milestoneLabels = milestones.map((m, i) => {
    const labelX = stairPoints[Math.min(i * 2 + 1, stairPoints.length - 1)][0] - 16;
    const labelY = stairPoints[Math.min(i * 2 + 2, stairPoints.length - 1)][1] - 4;
    return { ...m, x: labelX, y: labelY, index: i };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-auto min-w-[600px]">
        <defs>
          <linearGradient id="completedGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#D0ECDD" />
            <stop offset="100%" stopColor="#EDF8F1" />
          </linearGradient>
        </defs>

        <path d={outlinePath} fill="none" stroke="#c4c0bb" strokeWidth="1.5" />

        <path d={completedPath} fill="url(#completedGrad)" stroke="none" />

        {stairPoints.map((pt, i) => {
          if (i === 0) return null;
          const prev = stairPoints[i - 1];
          const isCompleted = i <= completedStairEnd;
          return (
            <line
              key={i}
              x1={prev[0]}
              y1={prev[1]}
              x2={pt[0]}
              y2={pt[1]}
              stroke={isCompleted ? "#2A6B46" : "#c4c0bb"}
              strokeWidth={isCompleted ? "2" : "1.5"}
            />
          );
        })}

        <line
          x1={lastStairX}
          y1={lastStairY}
          x2={lastStairX + 20}
          y2={peakY}
          stroke="#c4c0bb"
          strokeWidth="1.5"
        />
        <line
          x1={lastStairX + 20}
          y1={peakY}
          x2={rightX}
          y2={baseY}
          stroke="#c4c0bb"
          strokeWidth="1.5"
        />

        {milestoneLabels.map((m) => (
          <g key={m.index}>
            <line
              x1={m.x - 4}
              y1={m.y + 6}
              x2={m.x - 30}
              y2={m.y + 6}
              stroke="#d6d3d1"
              strokeWidth="1"
            />
            <text
              x={m.x - 36}
              y={m.y + 10}
              textAnchor="end"
              fill={m.completed ? "#2A6B46" : m.current ? "#1E5235" : "#78716c"}
              fontSize="13"
              fontFamily="var(--font-body), system-ui, sans-serif"
              fontWeight={m.current ? "600" : "400"}
            >
              {m.current ? "★ " : ""}milestone {m.index}: {m.name}
            </text>
          </g>
        ))}

        <text
          x={startX - 10}
          y={baseY + 20}
          textAnchor="start"
          fill="#78716c"
          fontSize="13"
          fontFamily="var(--font-body), system-ui, sans-serif"
        >
          Start: Begin your journey
        </text>

        <text
          x={lastStairX - 16}
          y={lastStairY - 24}
          textAnchor="end"
          fill="#1E5235"
          fontSize="14"
          fontWeight="600"
          fontFamily="var(--font-body), system-ui, sans-serif"
        >
          Goal: {summit}
        </text>

        <g transform={`translate(${starX - 14}, ${starY - 14})`}>
          <polygon
            points="14,0 17.5,10 28,10 19.5,16.5 22.5,27 14,20 5.5,27 8.5,16.5 0,10 10.5,10"
            fill="#2A6B46"
            opacity="0.85"
          />
        </g>

        <g transform={`translate(${flagX}, ${flagY})`}>
          <line x1="0" y1="0" x2="0" y2="-40" stroke="#44403c" strokeWidth="2" />
          <polygon points="2,-40 32,-32 2,-22" fill="#E07A6E" opacity="0.9" />
        </g>
      </svg>
    </div>
  );
}
