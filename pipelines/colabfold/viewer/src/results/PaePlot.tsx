import { useEffect, useRef, useState } from 'react';
import { getPae } from '../api';
import type { PaePoint } from './paeSelection';

function color(value: number, max: number): [number, number, number] {
  const ratio = Math.max(0, Math.min(1, value / Math.max(max, 1)));
  return [
    Math.round(245 - ratio * 205),
    Math.round(249 - ratio * 88),
    Math.round(247 - ratio * 83),
  ];
}

function cssColor(value: number, max: number): string {
  const [red, green, blue] = color(value, max);
  return `rgb(${red}, ${green}, ${blue})`;
}

function drawMatrix(
  context: CanvasRenderingContext2D,
  data: { pae: number[][]; maxPae: number },
  size: number,
  left = 0,
  top = 0,
): void {
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    const sourceY = Math.min(data.pae.length - 1, Math.floor(y * data.pae.length / size));
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(data.pae.length - 1, Math.floor(x * data.pae.length / size));
      const [red, green, blue] = color(data.pae[sourceY]![sourceX]!, data.maxPae);
      const offset = (y * size + x) * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, left, top);
}

export function PaePlot({ jobId, rank, selection, onSelect }: {
  jobId: string; rank: number; selection?: PaePoint; onSelect: (point: PaePoint | undefined) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<{ pae: number[][]; maxPae: number }>();
  const [error, setError] = useState<string>();
  const [hover, setHover] = useState<PaePoint>();
  const point = selection ?? hover;

  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError(undefined);
    setHover(undefined);
    onSelect(undefined);
    void getPae(jobId, rank, controller.signal)
      .then(setData)
      .catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setError(requestError instanceof Error ? requestError.message : 'PAE could not be loaded.');
        }
      });
    return () => controller.abort();
  }, [jobId, rank, onSelect]);

  useEffect(() => {
    if (!data || !canvas.current) return;
    const size = Math.min(700, data.pae.length);
    const context = canvas.current.getContext('2d');
    if (!context) return;
    canvas.current.width = size;
    canvas.current.height = size;
    drawMatrix(context, data, size);
  }, [data]);

  const selectPoint = (clientX: number, clientY: number, target: HTMLCanvasElement, persist = false) => {
    if (!data) return;
    const bounds = target.getBoundingClientRect();
    const x = Math.max(0, Math.min(data.pae.length - 1, Math.floor((clientX - bounds.left) / bounds.width * data.pae.length)));
    const y = Math.max(0, Math.min(data.pae.length - 1, Math.floor((clientY - bounds.top) / bounds.height * data.pae.length)));
    const next = { x, y, value: data.pae[y]![x]! };
    setHover(persist ? undefined : next);
    if (persist) onSelect(next);
  };

  const moveSelection = (deltaX: number, deltaY: number) => {
    if (!data) return;
    const x = Math.max(0, Math.min(data.pae.length - 1, (point?.x ?? 0) + deltaX));
    const y = Math.max(0, Math.min(data.pae.length - 1, (point?.y ?? 0) + deltaY));
    setHover(undefined);
    onSelect({ x, y, value: data.pae[y]![x]! });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const movement = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    moveSelection(movement[0]!, movement[1]!);
  };

  const saveImage = () => {
    if (!data) return;
    const output = document.createElement('canvas');
    output.width = 2200;
    output.height = 2100;
    const context = output.getContext('2d');
    if (!context) return;
    const plotSize = 1700;
    const left = 210;
    const top = 110;
    const font = getComputedStyle(document.documentElement).getPropertyValue('--sans');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    drawMatrix(context, data, plotSize, left, top);
    context.strokeStyle = '#1e2428';
    context.lineWidth = 3;
    context.strokeRect(left, top, plotSize, plotSize);
    context.fillStyle = '#1e2428';
    context.font = `48px ${font}`;
    context.textAlign = 'center';
    context.fillText('Scored residue', left + plotSize / 2, 1990);
    context.save();
    context.translate(62, top + plotSize / 2);
    context.rotate(-Math.PI / 2);
    context.fillText('Aligned residue', 0, 0);
    context.restore();
    const barLeft = 1970;
    const barWidth = 60;
    for (let y = 0; y < plotSize; y += 1) {
      const value = y / Math.max(1, plotSize - 1) * data.maxPae;
      const [red, green, blue] = color(value, data.maxPae);
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fillRect(barLeft, top + y, barWidth, 1);
    }
    context.fillStyle = '#1e2428';
    context.font = `38px ${font}`;
    context.textAlign = 'left';
    context.fillText('0 Å', barLeft + 78, top + 28);
    context.fillText(`${data.maxPae.toFixed(1)} Å`, barLeft + 78, top + plotSize);
    const link = document.createElement('a');
    link.href = output.toDataURL('image/png');
    link.download = `${jobId}-rank-${rank}-pae.png`;
    link.click();
  };

  return (
    <section className="pae-panel" aria-labelledby="pae-heading">
      <div className="panel-heading">
        <div>
          <h2 id="pae-heading">Predicted aligned error</h2>
          <p>Uncertainty in the relative placement of two residues. Lower values mean greater confidence.</p>
        </div>
        <button className="quiet-button" type="button" disabled={!data} onClick={saveImage}>Save PNG</button>
      </div>
      <div className="pae-wrap">
        <canvas
          ref={canvas}
          className="pae-canvas"
          role="img"
          tabIndex={data ? 0 : -1}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.focus({ preventScroll: true });
            selectPoint(event.clientX, event.clientY, event.currentTarget, true);
          }}
          onPointerMove={(event) => {
            if (!selection && event.pointerType === 'mouse') {
              selectPoint(event.clientX, event.clientY, event.currentTarget);
            }
          }}
          onPointerLeave={() => setHover(undefined)}
          onFocus={() => {
            if (data && !selection && !hover) setHover({ x: 0, y: 0, value: data.pae[0]![0]! });
          }}
          onKeyDown={handleKeyDown}
          aria-label={`Rank ${rank} predicted aligned error matrix. Use arrow keys to inspect cells.`}
          aria-describedby="pae-instructions"
        />
        {data && point && (
          <svg className="pae-selection" viewBox={`0 0 ${data.pae.length} ${data.pae.length}`} aria-hidden="true">
            <path className="pae-crosshair" vectorEffect="non-scaling-stroke"
              d={`M 0 ${point.y + 0.5} H ${data.pae.length} M ${point.x + 0.5} 0 V ${data.pae.length}`} />
            <rect className="pae-cell-halo" vectorEffect="non-scaling-stroke"
              x={point.x} y={point.y} width="1" height="1" />
            <rect className="pae-cell-outline" vectorEffect="non-scaling-stroke"
              x={point.x} y={point.y} width="1" height="1" />
          </svg>
        )}
        {data && (
          <output className="pae-readout" aria-live="polite">
            {point ? `${point.y + 1} → ${point.x + 1}: ${point.value.toFixed(1)} Å` : 'Select a cell'}
          </output>
        )}
      </div>
      {data && <>
        <div className="pae-axis-labels"><span>Rows: aligned residue</span><span>Columns: scored residue</span></div>
        <div className="pae-selection-tools">
          <p className="pae-guidance" id="pae-instructions">Click or tap to highlight two residues in the structure. Arrow keys move the selection.</p>
          <button className="topbar-link" type="button" disabled={!selection} onClick={() => {
            setHover(undefined);
            onSelect(undefined);
          }}>Clear selection</button>
        </div>
        <p className="pae-guidance">The value is expected positional error, not the distance between the residues.</p>
      </>}
      {data && (
        <div className="plddt-legend" aria-label="PAE color scale">
          <span><i style={{ background: cssColor(0, data.maxPae) }} />0 Å · more certain</span>
          <span><i style={{ background: cssColor(data.maxPae / 2, data.maxPae) }} />{(data.maxPae / 2).toFixed(1)} Å</span>
          <span><i style={{ background: cssColor(data.maxPae, data.maxPae) }} />{data.maxPae.toFixed(1)} Å · less certain</span>
        </div>
      )}
      {!data && !error && <p className="viewer-status" role="status">Loading PAE…</p>}
      {error && <p className="jobs-error" role="alert">{error}</p>}
    </section>
  );
}
