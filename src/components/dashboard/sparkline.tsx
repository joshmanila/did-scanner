interface SparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}

export default function Sparkline({
  values,
  color,
  width = 160,
  height = 28,
}: SparklineProps) {
  if (values.length === 0) return null;

  const max = Math.max(...values);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const padY = 2;
  const innerH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = max === 0 ? height - padY : padY + innerH * (1 - v / max);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    points.length > 1
      ? `${linePath} L${(points[points.length - 1][0]).toFixed(2)},${height} L0,${height} Z`
      : "";

  const gradientId = `sparkline-fill-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}88)` }}
      />
    </svg>
  );
}
