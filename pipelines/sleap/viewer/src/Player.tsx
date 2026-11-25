import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { trackColor } from './colors';
import type { Poses } from './types';

const SPEEDS = [0.25, 0.5, 1, 2, 4];

interface Props {
  poses: Poses;
  src: string;
  hidden: Set<number>;
  showLabels: boolean;
  showNodes: boolean;
  minScore: number;
}

export function Player({ poses, src, hidden, showLabels, showNodes, minScore }: Props) {
  const { meta, data } = poses;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const timeline = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const stride = meta.slots * meta.nodes.length * 3;
  const scale = meta.previewWidth / meta.width;   // poses are in original-video pixels

  const frameAt = (seconds: number) => Math.min(meta.frames - 1, Math.max(0, Math.round(seconds * meta.fps)));

  const draw = useCallback((f: number) => {
    const c = canvas.current;
    const v = video.current;
    if (!c || !v || !v.videoWidth) return;
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const unit = Math.max(1.5, c.width / 640);
    const base = f * stride;
    for (let s = 0; s < meta.slots; s += 1) {
      if (hidden.has(s)) continue;
      const at = (n: number) => {
        const i = base + (s * meta.nodes.length + n) * 3;
        const x = data[i]!, y = data[i + 1]!, score = data[i + 2]!;
        return Number.isNaN(x) || (Number.isFinite(score) && score < minScore) ? undefined : [x * scale, y * scale] as const;
      };
      const color = trackColor(s);
      ctx.lineCap = 'round';
      for (const [a, b] of meta.edges) {
        const p = at(a), q = at(b);
        if (!p || !q) continue;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = unit * 2.6; ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = unit * 1.4; ctx.stroke();
      }
      let label: readonly [number, number] | undefined;
      for (let n = 0; n < meta.nodes.length; n += 1) {
        const p = at(n);
        if (!p) continue;
        if (!label || p[1] < label[1]) label = p;
        ctx.beginPath(); ctx.arc(p[0], p[1], unit * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.lineWidth = unit; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.stroke();
        if (showNodes) {
          ctx.font = `${Math.round(unit * 6)}px Geist Variable, system-ui, sans-serif`;
          ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = unit * 1.6;
          ctx.strokeText(meta.nodes[n]!, p[0] + unit * 4, p[1] - unit * 3);
          ctx.fillText(meta.nodes[n]!, p[0] + unit * 4, p[1] - unit * 3);
        }
      }
      if (showLabels && label) {
        const text = meta.tracks[s]?.name ?? `instance ${s + 1}`;
        ctx.font = `600 ${Math.round(unit * 7)}px Geist Variable, system-ui, sans-serif`;
        const w = ctx.measureText(text).width + unit * 8;
        const h = unit * 11;
        const x = label[0] - w / 2, y = label[1] - h - unit * 7;
        ctx.fillStyle = 'rgba(20,22,26,0.82)';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, unit * 3); ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(x + unit * 3, y + unit * 3, unit * 2, h - unit * 6);
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x + unit * 7, y + h / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }, [data, meta, stride, scale, hidden, showLabels, showNodes, minScore]);

  // Draw on every presented video frame (requestVideoFrameCallback), else on animation frames.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let handle = 0;
    let stopped = false;
    const rvfc = 'requestVideoFrameCallback' in v;
    const tick = (_now: number, info?: { mediaTime: number }) => {
      if (stopped) return;
      const f = frameAt(info ? info.mediaTime : v.currentTime);
      setFrame(f);
      draw(f);
      handle = rvfc ? (v as any).requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
    };
    handle = rvfc ? (v as any).requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
    return () => { stopped = true; rvfc ? (v as any).cancelVideoFrameCallback(handle) : cancelAnimationFrame(handle); };
  }, [draw, src]);

  useEffect(() => { draw(frame); }, [draw]);  // redraw when toggles change while paused
  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed]);

  const seek = (f: number) => {
    const v = video.current;
    if (!v) return;
    const target = Math.min(meta.frames - 1, Math.max(0, f));
    v.currentTime = (target + 0.5) / meta.fps;   // middle of the frame, so rounding lands on it
    setFrame(target);
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  };

  // Track presence timeline: one row per track, a tick where the track has a pose.
  const presence = useMemo(() => {
    const rows: Uint8Array[] = [];
    for (let s = 0; s < meta.slots; s += 1) {
      const row = new Uint8Array(meta.frames);
      for (let f = 0; f < meta.frames; f += 1) {
        const i = f * stride + s * meta.nodes.length * 3;
        for (let n = 0; n < meta.nodes.length; n += 1) {
          if (!Number.isNaN(data[i + n * 3]!)) { row[f] = 1; break; }
        }
      }
      rows.push(row);
    }
    return rows;
  }, [data, meta, stride]);

  useEffect(() => {
    const c = timeline.current;
    if (!c) return;
    const width = c.clientWidth * devicePixelRatio;
    const rowH = Math.max(4, Math.min(10, Math.floor(80 / Math.max(1, meta.slots)))) * devicePixelRatio;
    const gap = devicePixelRatio;
    c.width = width;
    c.height = meta.slots * (rowH + gap);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    presence.forEach((row, s) => {
      ctx.fillStyle = hidden.has(s) ? 'rgba(128,128,128,0.25)' : trackColor(s);
      const y = s * (rowH + gap);
      let start = -1;
      for (let f = 0; f <= meta.frames; f += 1) {
        const on = f < meta.frames && row[f] === 1;
        if (on && start < 0) start = f;
        if (!on && start >= 0) {
          const x0 = (start / meta.frames) * width, x1 = (f / meta.frames) * width;
          ctx.fillRect(x0, y, Math.max(1, x1 - x0), rowH);
          start = -1;
        }
      }
    });
  }, [presence, hidden, meta]);

  const seekFromTimeline = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    seek(Math.floor(((event.clientX - bounds.left) / bounds.width) * meta.frames));
  };

  const seconds = frame / meta.fps;
  const clock = `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

  return (
    <div className="player">
      <div className="stage" style={{ aspectRatio: `${meta.width} / ${meta.height}` }}>
        <video ref={video} src={src} playsInline muted preload="auto"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onLoadedData={() => draw(frameAt(video.current?.currentTime ?? 0))}
          onSeeked={() => { const f = frameAt(video.current?.currentTime ?? 0); setFrame(f); draw(f); }}
          onClick={toggle} />
        <canvas ref={canvas} aria-hidden="true" />
      </div>
      <div className="controls">
        <button type="button" className="icon-button" onClick={() => seek(frame - 1)} aria-label="Previous frame" title="Previous frame (←)">
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <button type="button" className="icon-button primary" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (space)' : 'Play (space)'}>
          {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
        </button>
        <button type="button" className="icon-button" onClick={() => seek(frame + 1)} aria-label="Next frame" title="Next frame (→)">
          <ChevronRightIcon aria-hidden="true" />
        </button>
        <input className="scrub" type="range" min={0} max={meta.frames - 1} value={frame}
          aria-label="Frame" onChange={(e) => seek(Number(e.target.value))} />
        <span className="frame-readout">{clock} · frame {frame.toLocaleString()} / {(meta.frames - 1).toLocaleString()}</span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>
      <div className="timeline" onPointerDown={seekFromTimeline} role="slider" tabIndex={0}
        aria-label="Track presence over time; click to jump" aria-valuemin={0} aria-valuemax={meta.frames - 1} aria-valuenow={frame}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); seek(frame - (e.shiftKey ? 10 : 1)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); seek(frame + (e.shiftKey ? 10 : 1)); }
          if (e.key === ' ') { e.preventDefault(); toggle(); }
        }}>
        <canvas ref={timeline} />
        <span className="playhead" style={{ left: `${(frame / Math.max(1, meta.frames - 1)) * 100}%` }} />
      </div>
    </div>
  );
}
