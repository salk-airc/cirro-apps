import { useEffect, useState } from 'react';
import { CheckIcon, DownloadIcon, MoonIcon, SunIcon } from 'lucide-react';
import { LossChart, type Point } from './LossChart';
import { PartAccuracy, type PartScore } from './PartAccuracy';

interface Part {
  name: string;
  dir: string;
  epochs: number;
  bestValLoss: number | null;
  bestEpoch: number | null;
  curve: Point[];
  nodes: string[];
  files: string[];
  hasCheckpoint: boolean;
  evaluation: {
    frames: number;
    errorMedian: number | null;
    errorP90: number | null;
    mOKS: number | null;
    oksMAP: number | null;
    mPCK: number | null;
    visibleRecall: number | null;
    pckParts: PartScore[];
  } | null;
}

interface Summary {
  title: string;
  modelType: string;
  generatedAt: string;
  run: Record<string, string>;
  parts: Part[];
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
const px = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(1)} px`);

const PART_LABEL: Record<string, string> = {
  single_instance: 'Single instance',
  centroid: 'Centroid (finds each animal)',
  centered_instance: 'Centered instance (poses each animal)',
  bottomup: 'Bottom-up',
};
const TYPE_LABEL: Record<string, string> = {
  single_instance: 'Single animal',
  topdown: 'Top-down (multi-animal)',
  bottomup: 'Bottom-up (multi-animal)',
};

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('cirro-apps-theme', theme); } catch { /* storage blocked */ }
  }, [theme]);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')] as const;
}

function fmt(v: number | null): string {
  if (v === null) return '—';
  return Math.abs(v) < 1e-3 ? v.toExponential(2) : Number(v.toPrecision(3)).toString();
}

export function App() {
  const [data, setData] = useState<Summary>();
  const [error, setError] = useState<string>();
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    fetch('summary.json')
      .then((r) => { if (!r.ok) throw new Error('summary.json could not be loaded.'); return r.json(); })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const nodes = data?.parts.find((p) => p.nodes.length)?.nodes ?? [];
  return (
    <main>
      <header className="top">
        <div>
          <p className="eyebrow">SLEAP training{data?.run['sleap-nn'] ? ` · sleap-nn ${data.run['sleap-nn']}` : ''}</p>
          <h1>{data?.title ?? 'SLEAP model training'}</h1>
        </div>
        <button type="button" className="icon-button" onClick={toggleTheme}
          aria-label={`Theme: ${theme}. Switch to ${theme === 'dark' ? 'light' : 'dark'}.`}
          title={theme === 'dark' ? 'Dark. Click for light.' : 'Light. Click for dark.'}>
          {theme === 'dark' ? <MoonIcon aria-hidden="true" /> : <SunIcon aria-hidden="true" />}
        </button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading…</p>}
      {data && (
        <>
          <dl className="tiles">
            <div><dt>Model</dt><dd>{TYPE_LABEL[data.modelType] ?? data.modelType}</dd></div>
            <div><dt>Parts trained</dt><dd>{data.parts.length}</dd></div>
            <div><dt>Epochs</dt><dd>{Math.max(...data.parts.map((p) => p.epochs))}</dd></div>
            <div><dt>Body parts</dt><dd>{nodes.length || '—'}</dd></div>
          </dl>

          <section className="use">
            <h2><CheckIcon aria-hidden="true" />Use this model</h2>
            <p>
              Run <strong>Track Animal Poses (SLEAP)</strong> on your videos and, under <em>Trained model folder(s)</em>,
              pick {data.parts.length > 1 ? 'both of these folders' : 'this folder'} from this dataset:
            </p>
            <ul className="folders">{data.parts.map((p) => <li key={p.name}><code>{p.dir}</code></li>)}</ul>
            {nodes.length > 0 && <p className="muted small">Skeleton: {nodes.join(', ')}</p>}
          </section>

          {data.parts.map((p) => (
            <section key={p.name} className="part">
              <header>
                <h2>{PART_LABEL[p.name] ?? p.name}</h2>
                <dl className="mini">
                  <div><dt>Best validation loss</dt><dd>{fmt(p.bestValLoss)}</dd></div>
                  <div><dt>at epoch</dt><dd>{p.bestEpoch ?? '—'}</dd></div>
                  <div><dt>Epochs run</dt><dd>{p.epochs}</dd></div>
                </dl>
              </header>
              {p.evaluation && (
                <div className="eval">
                  <h3>How well it does on {p.evaluation.frames} held-out frames</h3>
                  <dl className="eval-tiles">
                    <div><dt>Typical error</dt><dd>{px(p.evaluation.errorMedian)}</dd><span>median distance from the label</span></div>
                    <div><dt>Worst 10%</dt><dd>{px(p.evaluation.errorP90)}</dd><span>90th percentile error</span></div>
                    <div><dt>Points found</dt><dd>{pct(p.evaluation.visibleRecall)}</dd><span>of labeled, visible points</span></div>
                    <div><dt>mOKS</dt><dd>{p.evaluation.mOKS === null ? '—' : p.evaluation.mOKS.toFixed(2)}</dd><span>0–1, pose similarity (1 = perfect)</span></div>
                  </dl>
                  <PartAccuracy parts={p.evaluation.pckParts} />
                </div>
              )}
              <h3 className="curve-title">Training curves</h3>
              <LossChart points={p.curve} bestEpoch={p.bestEpoch} />
              <p className="muted small">
                Lower is better. Validation loss flattening while training loss keeps falling means more labels would
                help more than more epochs. Training stops early when validation stops improving.
              </p>
              <details className="files">
                <summary>Files in <code>{p.dir}</code></summary>
                <ul>
                  {p.files.map((f) => (
                    <li key={f}><a href={`${p.dir}/${f}`} download><DownloadIcon aria-hidden="true" />{f}</a></li>
                  ))}
                </ul>
              </details>
            </section>
          ))}

          <details className="run">
            <summary>Run details</summary>
            <dl>{Object.entries(data.run).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </details>
        </>
      )}
    </main>
  );
}
