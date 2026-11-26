import { useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber } from './format';
import type { Variant } from './types';

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
// Diverging blue <-> red with a gray midpoint; sequential is one hue from that gray. Dark mode
// has its own steps (validated against the dark surface), not an inverted light ramp.
const RAMPS = {
  light: { neg: hex('#184f95'), mid: hex('#f0efec'), pos: hex('#b3302f') },
  dark: { neg: hex('#5b9cf0'), mid: hex('#383835'), pos: hex('#f07474') },
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgb;

export type Scale = { diverging: boolean; lo: number; hi: number };

export function scaleFor(v: Variant): Scale {
  const lo = v.min ?? 0, hi = v.max ?? 0;
  if (lo < 0 && hi > 0) { const m = Math.max(-lo, hi); return { diverging: true, lo: -m, hi: m }; }
  return { diverging: false, lo, hi: hi > lo ? hi : lo + 1 };
}

function colorAt(value: number, s: Scale, theme: 'light' | 'dark'): Rgb {
  const r = RAMPS[theme];
  const t = Math.min(1, Math.max(0, (value - s.lo) / (s.hi - s.lo)));
  if (!s.diverging) return mix(r.mid, r.neg, t);
  return t < 0.5 ? mix(r.neg, r.mid, t * 2) : mix(r.mid, r.pos, t * 2 - 1);
}

export function Legend({ scale, theme }: { scale: Scale; theme: 'light' | 'dark' }) {
  const stops = Array.from({ length: 11 }, (_, i) => {
    const [r, g, b] = colorAt(scale.lo + (scale.hi - scale.lo) * (i / 10), scale, theme);
    return `rgb(${r} ${g} ${b}) ${i * 10}%`;
  });
  return (
    <div className="legend" aria-label={`Color scale from ${formatNumber(scale.lo)} to ${formatNumber(scale.hi)}`}>
      <span>{formatNumber(scale.lo)}</span>
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
      <span>{formatNumber(scale.hi)}</span>
      {scale.diverging && <span className="muted small">gray is 0</span>}
    </div>
  );
}

function ticks(lo: number, hi: number, count: number): number[] {
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0 || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let x = Math.ceil(lo / step) * step; x <= hi; x += step) out.push(x);
  return out;
}

export function Heatmap({ variant, t, theme }: { variant: Variant; t: number[]; theme: 'light' | 'dark' }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<{ row: number; col: number }>();
  const scale = useMemo(() => scaleFor(variant), [variant]);
  const rows = variant.rows.length, cols = t.length;
  const rowH = Math.max(4, Math.min(24, Math.floor(480 / rows)));
  const labelEvery = Math.ceil(12 / rowH);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.floor(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !cols) return;
    const img = new ImageData(cols, rows);
    const none = RAMPS[theme].mid;
    variant.matrix.forEach((row, i) => row.forEach((v, j) => {
      const [r, g, b] = v === null ? none : colorAt(v, scale, theme);
      const k = (i * cols + j) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = v === null ? 90 : 255;
    }));
    const src = document.createElement('canvas');
    src.width = cols; src.height = rows;
    src.getContext('2d')!.putImageData(img, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = rows * rowH * dpr;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }, [variant, scale, theme, width, rowH, rows, cols]);

  const t0 = t[0] ?? 0, t1 = t[cols - 1] ?? 1;
  const x = (s: number) => ((s - t0) / (t1 - t0 || 1)) * width;
  const value = hover ? variant.matrix[hover.row]?.[hover.col] : undefined;

  return (
    <div className="heatmap">
      <p className="readout" aria-live="polite">
        {hover ? <>{variant.rows[hover.row]} at {formatNumber(t[hover.col], 4)} s: <strong>{formatNumber(value ?? null, 4)}</strong></>
          : 'Hover the heatmap to read a value.'}
      </p>
      <div className="heatmap-grid">
        <ol className="row-labels" style={{ gridTemplateRows: `repeat(${rows}, ${rowH}px)` }} aria-label="Rows">
          {variant.rows.map((r, i) => (
            <li key={r + i} data-active={hover?.row === i || undefined}>{i % labelEvery === 0 ? r : ''}</li>
          ))}
        </ol>
        <div ref={wrap} className="plot">
          <canvas ref={canvas} role="img" style={{ width, height: rows * rowH }}
            aria-label={`${variant.label}: ${rows} rows over ${formatNumber(t0)} to ${formatNumber(t1)} seconds. Values are in the CSV download.`}
            onMouseLeave={() => setHover(undefined)}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const col = Math.min(cols - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * cols)));
              const row = Math.min(rows - 1, Math.max(0, Math.floor((e.clientY - box.top) / rowH)));
              setHover({ row, col });
            }} />
          {hover && <div className="crosshair" style={{ left: ((hover.col + 0.5) / cols) * width }} />}
          <div className="axis">
            {ticks(t0, t1, Math.max(2, Math.floor(width / 110))).map((s) => (
              <span key={s} style={{ left: x(s) }}>{formatNumber(s)}</span>
            ))}
          </div>
          <p className="axis-title muted small">Time (s), window centers</p>
        </div>
      </div>
      <Legend scale={scale} theme={theme} />
    </div>
  );
}
