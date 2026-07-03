"use client";

interface MiniMountainProps {
  progress: number;
  totalSteps: number;
  currentStep: number;
}

export default function MiniMountain({ progress, totalSteps, currentStep }: MiniMountainProps) {
  const viewW = 200;
  const viewH = 140;
  const baseY = 118;
  const peakY = 24;
  const startX = 24;
  const peakX = 148;
  const rightX = 184;

  const steps = Math.max(totalSteps, 3);
  const stepH = (baseY - peakY - 10) / steps;
  const stepW = (peakX - startX) / steps;

  const stairPoints: [number, number][] = [[startX, baseY]];
  for (let i = 0; i < steps; i++) {
    const x = startX + stepW * (i + 1);
    const yBottom = baseY - stepH * i;
    const yTop = baseY - stepH * (i + 1);
    stairPoints.push([x, yBottom]);
    stairPoints.push([x, yTop]);
  }

  const lastX = stairPoints[stairPoints.length - 1][0];
  let outline = `M ${startX} ${baseY}`;
  for (let i = 1; i < stairPoints.length; i++) {
    outline += ` L ${stairPoints[i][0]} ${stairPoints[i][1]}`;
  }
  outline += ` L ${lastX + 10} ${peakY} L ${rightX} ${baseY} Z`;

  const completedEnd = Math.min(currentStep * 2 + 2, stairPoints.length - 1);
  let completedRoute = `M ${stairPoints[0][0]} ${stairPoints[0][1]}`;
  for (let i = 1; i <= completedEnd; i++) {
    completedRoute += ` L ${stairPoints[i][0]} ${stairPoints[i][1]}`;
  }

  const starStepIdx = Math.min(currentStep * 2 + 1, stairPoints.length - 1);
  const starTopIdx = Math.min(currentStep * 2 + 2, stairPoints.length - 1);
  const starX = stairPoints[starStepIdx][0] + stepW * 0.25;
  const starY = stairPoints[starTopIdx][1] + stepH * 0.35;

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full">
      <defs>
        <linearGradient id="miniSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4FBF7" />
          <stop offset="100%" stopColor="#F8F5EF" />
        </linearGradient>
        <linearGradient id="miniMountainFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EEF7F1" />
          <stop offset="100%" stopColor="#F7EFE7" />
        </linearGradient>
      </defs>

      <rect width={viewW} height={viewH} rx="18" fill="url(#miniSky)" />
      <path d="M0 112 C40 100 68 108 103 96 C140 84 166 92 200 78 L200 140 L0 140 Z" fill="#EAF4EE" opacity="0.9" />
      <path d="M0 123 C38 116 74 122 112 111 C147 101 170 106 200 96 L200 140 L0 140 Z" fill="#F0E8DE" opacity="0.65" />

      <path d={outline} fill="url(#miniMountainFill)" stroke="#C8C0B7" strokeWidth="1.3" />

      {stairPoints.map((pt, i) => {
        if (i === 0) return null;
        const prev = stairPoints[i - 1];
        return (
          <line
            key={i}
            x1={prev[0]}
            y1={prev[1]}
            x2={pt[0]}
            y2={pt[1]}
            stroke="#BDB6AE"
            strokeWidth="1.2"
          />
        );
      })}

      <path d={completedRoute} fill="none" stroke="#1E5235" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

      {stairPoints
        .filter((_, i) => i > 0 && i % 2 === 0)
        .map((pt, i) => (
          <circle
            key={i}
            cx={pt[0]}
            cy={pt[1]}
            r={i <= currentStep ? 3 : 2.4}
            fill={i <= currentStep ? "#1E5235" : "#FFFFFF"}
            stroke={i <= currentStep ? "#1E5235" : "#C8C0B7"}
            strokeWidth="1.2"
          />
        ))}

      <g transform={`translate(${starX - 8}, ${starY - 8})`}>
        <circle cx="8" cy="8" r="7" fill="#FFFFFF" stroke="#1E5235" strokeWidth="1.5" />
        <path d="M8 3.5L9.4 7L13 8.2L9.4 9.4L8 13L6.6 9.4L3 8.2L6.6 7L8 3.5Z" fill="#E7B85B" />
      </g>

      <g transform={`translate(${lastX + 10}, ${peakY})`}>
        <line x1="0" y1="0" x2="0" y2="-20" stroke="#544A42" strokeWidth="1.5" />
        <path d="M1 -20 L25 -14 L1 -8 Z" fill="#E07A6E" />
      </g>

      <text x="166" y="22" textAnchor="end" fill="#1E5235" fontSize="12" fontWeight="700" fontFamily="var(--font-body), system-ui, sans-serif">
        {progress}%
      </text>
    </svg>
  );
}
