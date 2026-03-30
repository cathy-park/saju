import React from "react";

export interface RadarAxis {
  label: string;
  value: number; // 0–100
  color: string;
}

interface Props {
  axes: RadarAxis[];
  size?: number;
  /** ring color */
  gridColor?: string;
}

const DEFAULT_FILL = "rgba(74, 144, 217, 0.15)";
const DEFAULT_STROKE = "#4A90D9";

/**
 * Pure-SVG radar chart. No external dependency.
 * axes[i].value ∈ [0, 100].
 */
export function RadarChart({ axes, size = 220, gridColor = "rgba(0,0,0,0.07)" }: Props) {
  if (!axes || axes.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.36;        // outer ring radius
  const labelR = size * 0.48;    // label ring radius
  const rings  = [0.33, 0.66, 1];
  const n = axes.length;

  function polarToXY(angle: number, radius: number) {
    // Start from top (-π/2), go clockwise
    const a = angle - Math.PI / 2;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  // Grid ring polygon points
  function ringPoints(fraction: number) {
    return axes
      .map((_, i) => {
        const { x, y } = polarToXY((2 * Math.PI * i) / n, r * fraction);
        return `${x},${y}`;
      })
      .join(" ");
  }

  // Data polygon points
  const dataPoints = axes
    .map((axis, i) => {
      const { x, y } = polarToXY((2 * Math.PI * i) / n, r * Math.max(0.06, axis.value / 100));
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      {/* Grid rings */}
      {rings.map((f) => (
        <polygon
          key={f}
          points={ringPoints(f)}
          fill="none"
          stroke={gridColor}
          strokeWidth={1}
        />
      ))}

      {/* Axis spokes */}
      {axes.map((_, i) => {
        const outer = polarToXY((2 * Math.PI * i) / n, r);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={outer.x} y2={outer.y}
            stroke={gridColor}
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints}
        fill={DEFAULT_FILL}
        stroke={DEFAULT_STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {axes.map((axis, i) => {
        const { x, y } = polarToXY((2 * Math.PI * i) / n, r * Math.max(0.06, axis.value / 100));
        return (
          <circle
            key={i}
            cx={x} cy={y} r={3.5}
            fill={axis.color || DEFAULT_STROKE}
            stroke="#FFF"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Labels */}
      {axes.map((axis, i) => {
        const angle = (2 * Math.PI * i) / n;
        const lp = polarToXY(angle, labelR);
        const lax = Math.abs(Math.cos(angle - Math.PI / 2));
        let textAnchor: "start" | "middle" | "end" = "middle";
        if (lp.x < cx - 4) textAnchor = "end";
        else if (lp.x > cx + 4) textAnchor = "start";

        // Move label slightly away from center for small values
        const yOffset = lp.y < cy - 8 ? -4 : lp.y > cy + 8 ? 4 : 0;

        return (
          <g key={i}>
            <text
              x={lp.x}
              y={lp.y + yOffset}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill={axis.color || "#555"}
              fontFamily="Pretendard, -apple-system, sans-serif"
            >
              {axis.label}
            </text>
            <text
              x={lp.x}
              y={lp.y + yOffset + 13}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fontSize={10}
              fill="#AAA"
              fontFamily="Pretendard, -apple-system, sans-serif"
            >
              {axis.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
