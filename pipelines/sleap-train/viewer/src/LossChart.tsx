// Training vs validation loss by epoch. Two series in fixed categorical order (validated:
// blue = training, orange = validation, light and dark), 2px lines, log y-axis because
// losses fall by orders of magnitude, legend + end labels, crosshair readout on hover.
import { useEffect, useRef, useState } from 'react';

export interface Point { epoch: number; train: number | null; val: number | null }

const H = 260;
const PAD = { top: 14, right: 78, bottom: 32, left: 58 };

function fmt(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  return a < 1e-3 || a >= 1e4 ? v.toExponential(1) : Number(v.toPrecision(3)).toString();
}

export function LossChart({ points, bestEpoch }: { points: Point[]; bestEpoch: number | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<Point>();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const values = points.flatMap((p) => [p.train, p.val]).filter((v): v is number => v !== null && v > 0);
  if (points.length === 0 || values.length === 0) return <p className="muted">No training log was written.</p>;
  const lo = Math.log10(Math.min(...values));
  const hi = Math.log10(Math.max(...values));
  const yMin = Math.floor(lo), yMax = Math.max(Math.ceil(hi), yMin + 1);
  const eMin = points[0]!.epoch, eMax = Math.max(points[points.length - 1]!.epoch, eMin + 1);
  const plotW = width - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
  const x = (e: number) => PAD.left + ((e - eMin) / (eMax - eMin)) * plotW;
  const y = (v: number) => PAD.top + (1 - (Math.log10(v) - yMin) / (yMax - yMin)) * plotH;
  const path = (key: 'train' | 'val') => points
    .filter((p) => p[key] !== null && p[key]! > 0)
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.epoch).toFixed(1)},${y(p[key]!).toFixed(1)}`).join(' ');
  const last = (key: 'train' | 'val') => [...points].reverse().find((p) => p[key] !== null && p[key]! > 0);
  const decades = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i);
  const xTicks = [eMin, -1, eMax];  // middle slot holds the "Epoch" axis title

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const epoch = eMin + ((event.clientX - box.left - PAD.left) / plotW) * (eMax - eMin);
    let best = points[0]!;
    for (const p of points) if (Math.abs(p.epoch - epoch) < Math.abs(best.epoch - epoch)) best = p;
    setHover(best);
  };

  const ends = (['train', 'val'] as const).map((k) => ({ k, p: last(k) })).filter((e) => e.p);
  // keep the two end labels at least 14px apart
  const endY = ends.map((e) => y(e.p![e.k]!));
  if (endY.length === 2 && Math.abs(endY[0]! - endY[1]!) < 14) {
    const mid = (endY[0]! + endY[1]!) / 2, up = endY[0]! < endY[1]! ? -7 : 7;
    endY[0] = mid + up; endY[1] = mid - up;
  }

  return (
    <div className="loss-chart" ref={wrap}>
      <div className="chart-head">
        <ul className="legend" aria-label="Series">
          <li><i className="s-train" />Training loss</li>
          <li><i className="s-val" />Validation loss</li>
          {bestEpoch !== null && <li><i className="s-best" />Best epoch ({bestEpoch})</li>}
        </ul>
        <p className="readout" aria-live="polite">
          {hover
            ? <>Epoch <strong>{hover.epoch}</strong> · training {hover.train === null ? '—' : fmt(hover.train)} · validation {hover.val === null ? '—' : fmt(hover.val)}</>
            : <span className="muted">Point at the chart for values</span>}
        </p>
      </div>
      <svg width={width} height={H} role="img" onPointerMove={onMove} onPointerLeave={() => setHover(undefined)}
        aria-label={`Loss by epoch, log scale, epochs ${eMin} to ${eMax}`}>
        {decades.map((d) => (
          <g key={d}>
            <line className="grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(10 ** d)} y2={y(10 ** d)} />
            <text className="tick" x={PAD.left - 8} y={y(10 ** d)} dy="0.32em" textAnchor="end">{fmt(10 ** d)}</text>
          </g>
        ))}
        {xTicks.map((e, i) => e >= 0 && (
          <text key={i} className="tick" x={x(e)} y={H - 10} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{e}</text>
        ))}
        <text className="tick axis-title" x={PAD.left + plotW / 2} y={H - 10} textAnchor="middle">Epoch</text>
        {bestEpoch !== null && <line className="best" x1={x(bestEpoch)} x2={x(bestEpoch)} y1={PAD.top} y2={PAD.top + plotH} />}
        <path className="line s-train" d={path('train')} />
        <path className="line s-val" d={path('val')} />
        {points.length <= 30 && (['train', 'val'] as const).flatMap((k) => points
          .filter((p) => p[k] !== null && p[k]! > 0)
          .map((p) => <circle key={`${k}${p.epoch}`} className={`pt s-${k}`} cx={x(p.epoch)} cy={y(p[k]!)} r={3} />))}
        {ends.map((e, i) => (
          <text key={e.k} className="end-label" x={PAD.left + plotW + 6} y={endY[i]} dy="0.32em">
            {e.k === 'train' ? 'training' : 'validation'}
          </text>
        ))}
        {hover && <line className="crosshair" x1={x(hover.epoch)} x2={x(hover.epoch)} y1={PAD.top} y2={PAD.top + plotH} />}
        {hover && (['train', 'val'] as const).map((k) => hover[k] !== null && hover[k]! > 0 && (
          <circle key={k} className={`dot s-${k}`} cx={x(hover.epoch)} cy={y(hover[k]!)} r={4} />
        ))}
      </svg>
    </div>
  );
}
