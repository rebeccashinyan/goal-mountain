"use client";

interface MiniMountainProps {
  progress: number;
  totalSteps: number;
  currentStep: number;
}

export default function MiniMountain({ totalSteps, currentStep }: MiniMountainProps) {
  const viewW = 200;
  const viewH = 140;
  const baseY = 125;
  const peakY = 20;
  const startX = 15;
  const peakX = 155;
  const rightX = 185;

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
  const lastY = stairPoints[stairPoints.length - 1][1];

  let outline = `M ${startX} ${baseY}`;
  for (let i = 1; i < stairPoints.length; i++) {
    outline += ` L ${stairPoints[i][0]} ${stairPoints[i][1]}`;
  }
  outline += ` L ${lastX + 10} ${peakY} L ${rightX} ${baseY} Z`;

  const starStepIdx = Math.min(currentStep * 2 + 1, stairPoints.length - 1);
  const starTopIdx = Math.min(currentStep * 2 + 2, stairPoints.length - 1);
  const starX = stairPoints[starStepIdx][0] + stepW * 0.25;
  const starY = stairPoints[starTopIdx][1] + stepH * 0.35;

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full">
      <path d={outline} fill="none" stroke="#c4c0bb" strokeWidth="1.2" />

      <g transform={`translate(${starX - 8}, ${starY - 8})`}>
        <polygon
          points="8,0 10,6 16,6 11,9.5 13,16 8,12 3,16 5,9.5 0,6 6,6"
          fill="#44403c"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}
