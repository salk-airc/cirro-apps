import { useEffect, useState } from 'react';
import { DownloadIcon, EyeIcon, EyeOffIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Player } from './Player';
import { trackColor } from './colors';
import type { Index, Poses, VideoMeta } from './types';

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('cirro-apps-theme', theme); } catch { /* storage blocked */ }
  }, [theme]);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')] as const;
}

async function loadPoses(dir: string): Promise<Poses> {
  const meta: VideoMeta = await fetch(`${dir}/meta.json`).then((r) => {
    if (!r.ok) throw new Error(`${dir}/meta.json could not be loaded.`);
    return r.json();
  });
  const buffer = await fetch(`${dir}/poses.f32`).then((r) => {
    if (!r.ok) throw new Error(`${dir}/poses.f32 could not be loaded.`);
    return r.arrayBuffer();
  });
  return { meta, data: new Float32Array(buffer) };
}

export function App() {
  const [index, setIndex] = useState<Index>();
  const [selected, setSelected] = useState(0);
  const [poses, setPoses] = useState<Poses>();
  const [error, setError] = useState<string>();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [showNodes, setShowNodes] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    fetch('index.json')
      .then((r) => { if (!r.ok) throw new Error('index.json could not be loaded.'); return r.json(); })
      .then(setIndex)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const video = index?.videos[selected];
  useEffect(() => {
    if (!video) return;
    setPoses(undefined);
    setHidden(new Set());
    loadPoses(video.dir).then(setPoses).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [video?.dir]);

  const toggleTrack = (slot: number) => {
    const next = new Set(hidden);
    if (next.has(slot)) next.delete(slot); else next.add(slot);
    setHidden(next);
  };

  const meta = poses?.meta;
  return (
    <main>
      <header className="top">
        <div>
          <p className="eyebrow">SLEAP{index?.run['sleap-nn'] ? ` · sleap-nn ${index.run['sleap-nn']}` : ''}{index?.models.length ? ` · ${index.models.join(' + ')}` : ''}</p>
          <h1>{index?.title ?? 'SLEAP pose tracking'}</h1>
        </div>
        <button type="button" className="icon-button" onClick={toggleTheme}
          aria-label={`Theme: ${theme}. Switch to ${theme === 'dark' ? 'light' : 'dark'}.`}
          title={theme === 'dark' ? 'Dark. Click for light.' : 'Light. Click for dark.'}>
          {theme === 'dark' ? <MoonIcon aria-hidden="true" /> : <SunIcon aria-hidden="true" />}
        </button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!index && !error && <p className="muted" role="status">Loading…</p>}
      {index && (
        <>
          {index.videos.length > 1 && (
            <nav className="video-tabs" aria-label="Videos">
              {index.videos.map((v, i) => (
                <button key={v.dir} type="button" aria-pressed={i === selected} onClick={() => setSelected(i)}>{v.name}</button>
              ))}
            </nav>
          )}
          {meta && (
            <dl className="tiles">
              <div><dt>Frames</dt><dd>{meta.frames.toLocaleString()}</dd></div>
              <div><dt>With poses</dt><dd>{Math.round((meta.framesWithPoses / Math.max(1, meta.frames)) * 100)}%</dd></div>
              <div><dt>{meta.tracked ? 'Tracks' : 'Instances (max)'}</dt><dd>{meta.slots}</dd></div>
              <div><dt>Body parts</dt><dd>{meta.nodes.length}</dd></div>
              <div><dt>Mean score</dt><dd>{meta.meanScore === null ? '—' : meta.meanScore.toFixed(2)}</dd></div>
            </dl>
          )}
          {!poses && !error && <p className="muted" role="status">Loading poses…</p>}
          {poses && meta && video && (
            <div className="layout">
              <Player poses={poses} src={`${video.dir}/preview.mp4`} hidden={hidden}
                showLabels={showLabels} showNodes={showNodes} minScore={minScore} />
              <aside className="side">
                <section>
                  <h2>{meta.tracked ? 'Tracks' : 'Instances'}</h2>
                  <ul className="tracks">
                    {meta.tracks.map((t, s) => (
                      <li key={s}>
                        <button type="button" aria-pressed={!hidden.has(s)} onClick={() => toggleTrack(s)}
                          title={hidden.has(s) ? `Show ${t.name}` : `Hide ${t.name}`}>
                          <i style={{ background: trackColor(s) }} />
                          <span className="track-name">{t.name}</span>
                          <span className="track-frames">{Math.round((t.frames / Math.max(1, meta.frames)) * 100)}%</span>
                          {hidden.has(s) ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {meta.slots > 8 && <p className="muted small">Tracks after the eighth are drawn in gray; their labels still name them.</p>}
                  <div className="track-actions">
                    <button type="button" className="link" onClick={() => setHidden(new Set())}>Show all</button>
                    <button type="button" className="link" onClick={() => setHidden(new Set(meta.tracks.map((_, i) => i)))}>Hide all</button>
                  </div>
                </section>
                <section>
                  <h2>Display</h2>
                  <label className="check"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Track labels</label>
                  <label className="check"><input type="checkbox" checked={showNodes} onChange={(e) => setShowNodes(e.target.checked)} /> Body part names</label>
                  <label className="range">Hide points scored below <strong>{minScore.toFixed(2)}</strong>
                    <input type="range" min={0} max={1} step={0.05} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
                  </label>
                </section>
                <section>
                  <h2>Downloads</h2>
                  <ul className="downloads">
                    <li><a href={`${video.dir}/${meta.files.slp}`} download><DownloadIcon aria-hidden="true" />Predictions (.slp)</a><span className="muted">open in SLEAP to proofread</span></li>
                    <li><a href={`${video.dir}/${meta.files.h5}`} download><DownloadIcon aria-hidden="true" />Analysis HDF5</a><span className="muted">tracks × parts × xy × frames</span></li>
                    <li><a href={`${video.dir}/${meta.files.csv}`} download><DownloadIcon aria-hidden="true" />CSV</a><span className="muted">one row per frame and animal</span></li>
                  </ul>
                </section>
              </aside>
            </div>
          )}
        </>
      )}
    </main>
  );
}
