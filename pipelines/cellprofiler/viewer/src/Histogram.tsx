// One-series histogram: single blue (validated light #2d46b9 / dark #6f82ea), 2px gaps,
// 4px rounded tops on the baseline, recessive grid, hover tooltip per bin.
import { useEffect, useRef, useState } from 'react';
import { formatNumber } from './format';
import type { ColumnStats } from './types';

const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 34, left: 52 };

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let value = 0; value <= max + 1e-9; value += step) ticks.push(value);
  return ticks;
}

export function Histogram({ column, unit }: { column: ColumnStats; unit: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number>();

  useEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry!.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const bins = column.bins;
  const peak = Math.max(...bins, 1);
  const ticks = niceTicks(peak);
  const top = ticks[ticks.length - 1]!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / bins.length;
  const gap = Math.min(2, slot / 3);
  const span = column.max - column.min;
  const edge = (i: number) => column.min + (span * i) / bins.length;
  const y = (count: number) => PAD.top + plotH - (count / top) * plotH;

  const bar = (i: number, count: number) => {
    const x = PAD.left + i * slot + gap / 2;
    const w = Math.max(1, slot - gap);
    const yTop = y(count);
    const h = PAD.top + plotH - yTop;
    if (h <= 0) return null;
    const r = Math.min(4, w / 2, h);
    return (
      <path
        key={i}
        className="hist-bar"
        data-hover={hover === i ? 'true' : undefined}
        d={`M${x},${PAD.top + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${PAD.top + plotH} Z`}
      />
    );
  };

  const hovered = hover !== undefined ? { from: edge(hover), to: edge(hover + 1), count: bins[hover]! } : undefined;

  return (
    <div className="histogram" ref={wrap}>
      <svg width={width} height={HEIGHT} role="img"
        aria-label={`Histogram of ${column.name}: ${column.n} ${unit}, from ${formatNumber(column.min)} to ${formatNumber(column.max)}`}
        onPointerLeave={() => setHover(undefined)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="hist-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="hist-tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{formatNumber(t)}</text>
          </g>
        ))}
        {bins.map((count, i) => bar(i, count))}
        <line className="hist-axis" x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />
        {[0, 0.5, 1].map((f) => (
          <text key={f} className="hist-tick" x={PAD.left + f * plotW} y={HEIGHT - 12}
            textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>
            {formatNumber(column.min + f * span)}
          </text>
        ))}
        {bins.map((_, i) => (
          <rect key={i} className="hist-hit" x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH}
            onPointerEnter={() => setHover(i)} />
        ))}
      </svg>
      {hovered && (
        <div className="hist-tip" role="status"
          style={{ left: Math.min(width - 170, Math.max(0, PAD.left + (hover! + 0.5) * slot - 85)) }}>
          <strong>{hovered.count.toLocaleString()} {unit}</strong>
          <span>{formatNumber(hovered.from)} to {formatNumber(hovered.to)}</span>
        </div>
      )}
    </div>
  );
}
