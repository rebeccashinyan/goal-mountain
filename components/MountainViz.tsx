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

export default function MountainViz({ milestones, summit, currentMilestoneIndex }: MountainVizProps) {
  const totalSteps = Math.max(milestones.length, 1);
  const viewW = 980;
  const viewH = 620;
  const baseY = 550;
  const peakY = 78;
  const startX = 280;
  const peakX = 740;
  const rightX = 930;

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

  const completedIdx = Math.max(0, Math.min(currentMilestoneIndex, totalSteps - 1));
  const completedStairEnd = Math.min(completedIdx * 2 + 2, stairPoints.length - 1);

  let completedPath = `M ${stairPoints[0][0]} ${stairPoints[0][1]}`;
  for (let i = 1; i <= completedStairEnd; i++) {
    completedPath += ` L ${stairPoints[i][0]} ${stairPoints[i][1]}`;
  }
  const cEndX = stairPoints[completedStairEnd][0];
  completedPath += ` L ${cEndX} ${baseY} L ${startX} ${baseY} Z`;

  let outlinePath = `M ${stairPoints[0][0]} ${stairPoints[0][1]}`;
  for (let i = 1; i < stairPoints.length; i++) {
    outlinePath += ` L ${stairPoints[i][0]} ${stairPoints[i][1]}`;
  }
  outlinePath += ` L ${lastStairX + 20} ${peakY}`;
  outlinePath += ` L ${rightX} ${baseY}`;
  outlinePath += ` L ${startX} ${baseY} Z`;

  const starStep = completedIdx;
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
      <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-auto min-w-[760px]">
        <title>{summit}</title>
        <defs>
          <linearGradient id="journeySky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2FAF6" />
            <stop offset="58%" stopColor="#FBF7EF" />
            <stop offset="100%" stopColor="#FAFAF8" />
          </linearGradient>
          <linearGradient id="mountainSurface" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F3FBF6" />
            <stop offset="100%" stopColor="#F2EAE0" />
          </linearGradient>
          <linearGradient id="completedGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#CFEBDD" />
            <stop offset="100%" stopColor="#EEF8F2" />
          </linearGradient>
          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={viewW} height={viewH} rx="28" fill="url(#journeySky)" />
        <path d="M0 468 C118 420 206 445 330 398 C444 354 534 388 646 320 C786 235 868 274 980 216 L980 620 L0 620 Z" fill="#E9F4EE" opacity="0.9" />
        <path d="M0 520 C128 486 230 512 360 468 C484 426 594 456 724 398 C838 346 910 358 980 322 L980 620 L0 620 Z" fill="#EFE6DA" opacity="0.65" />

        <path d={outlinePath} fill="url(#mountainSurface)" stroke="#C7BFB5" strokeWidth="1.5" />

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
              stroke={isCompleted ? "#1E5235" : "#BFB8AF"}
              strokeWidth={isCompleted ? "3" : "1.5"}
              strokeLinecap="round"
            />
          );
        })}

        <line
          x1={lastStairX}
          y1={lastStairY}
          x2={lastStairX + 20}
          y2={peakY}
          stroke="#BFB8AF"
          strokeWidth="1.5"
        />
        <line
          x1={lastStairX + 20}
          y1={peakY}
          x2={rightX}
          y2={baseY}
          stroke="#BFB8AF"
          strokeWidth="1.5"
        />

        {milestoneLabels.map((m) => (
          <g key={m.index}>
            <circle
              cx={m.x + 16}
              cy={m.y + 6}
              r={m.completed || m.current ? 5 : 4}
              fill={m.completed ? "#1E5235" : m.current ? "#E7B85B" : "#FFFFFF"}
              stroke={m.completed || m.current ? "#1E5235" : "#C7BFB5"}
              strokeWidth="1.2"
            />
            <line
              x1={m.x + 10}
              y1={m.y + 6}
              x2={m.x - 18}
              y2={m.y + 6}
              stroke="#d6d3d1"
              strokeWidth="1"
            />
            <text
              x={m.x - 24}
              y={m.y + 10}
              textAnchor="end"
              fill={m.completed ? "#2A6B46" : m.current ? "#1E5235" : "#78716c"}
              fontSize="12.5"
              fontFamily="var(--font-body), system-ui, sans-serif"
              fontWeight={m.current ? "700" : "500"}
            >
              {m.current ? "Current camp - " : ""}{m.index + 1}. {m.name}
            </text>
          </g>
        ))}

        <text
          x={startX}
          y={baseY + 20}
          textAnchor="start"
          fill="#78716c"
          fontSize="13"
          fontFamily="var(--font-body), system-ui, sans-serif"
        >
          Base camp - begin your journey
        </text>

        <text
          x={startX}
          y={56}
          textAnchor="start"
          fill="#1E5235"
          fontSize="15"
          fontWeight="700"
          fontFamily="var(--font-body), system-ui, sans-serif"
        >
          Expedition map
        </text>

        <text
          x={startX}
          y={78}
          textAnchor="start"
          fill="#78716c"
          fontSize="12"
          fontFamily="var(--font-body), system-ui, sans-serif"
        >
          Climb one camp at a time. Your guide updates the route as you learn.
        </text>

        <text
          x={lastStairX - 12}
          y={lastStairY - 22}
          textAnchor="end"
          fill="#1E5235"
          fontSize="12"
          fontWeight="700"
          fontFamily="var(--font-body), system-ui, sans-serif"
        >
          summit
        </text>

        <g transform={`translate(${starX - 18}, ${starY - 18})`} filter="url(#softGlow)">
          <circle cx="18" cy="18" r="15" fill="#FFFFFF" stroke="#1E5235" strokeWidth="2" />
          <path d="M18 8L20.6 15.4L28 18L20.6 20.6L18 28L15.4 20.6L8 18L15.4 15.4L18 8Z" fill="#E7B85B" />
          <circle cx="18" cy="18" r="3" fill="#1E5235" />
        </g>

        <g transform={`translate(${flagX}, ${flagY})`}>
          <line x1="0" y1="0" x2="0" y2="-40" stroke="#44403c" strokeWidth="2" />
          <polygon points="2,-40 32,-32 2,-22" fill="#E07A6E" opacity="0.9" />
        </g>
      </svg>
    </div>
  );
}
