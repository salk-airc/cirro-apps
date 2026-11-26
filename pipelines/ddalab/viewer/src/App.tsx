import { useEffect, useState } from 'react';
import { DownloadIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Heatmap } from './Heatmap';
import { formatNumber } from './format';
import type { Index, Recording, View } from './types';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('cirro-apps-theme', theme); } catch { /* storage blocked */ }
  }, [theme]);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')] as const;
}

function load<T>(url: string): Promise<T> {
  return fetch(url).then((r) => { if (!r.ok) throw new Error(`${url} could not be loaded.`); return r.json() as Promise<T>; });
}

function RecordingView({ rec, theme }: { rec: Recording; theme: 'light' | 'dark' }) {
  const [view, setView] = useState<View>();
  const [error, setError] = useState<string>();
  const [variantId, setVariantId] = useState(rec.variants[0]?.id);

  useEffect(() => {
    setView(undefined); setError(undefined);
    setVariantId((id) => rec.variants.some((v) => v.id === id) ? id : rec.variants[0]?.id);
    load<View>(rec.view).then(setView).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [rec]);

  const variant = view?.variants.find((v) => v.id === variantId);
  const csv = rec.variants.find((v) => v.id === variantId)?.csv;

  return (
    <section>
      <dl className="tiles">
        <div><dt>Duration</dt><dd>{formatNumber((rec.end ?? 0) - (rec.start ?? 0))} s</dd></div>
        <div><dt>Windows</dt><dd>{rec.windows.toLocaleString()}</dd></div>
        <div><dt>Channels</dt><dd>{rec.channels.length.toLocaleString()}</dd></div>
        <div><dt>Variants</dt><dd>{rec.variants.length}</dd></div>
      </dl>
      <nav className="tabs" role="tablist" aria-label="Variants">
        {rec.variants.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={v.id === variantId} onClick={() => setVariantId(v.id)}>
            {v.label}
          </button>
        ))}
      </nav>
      {error && <p className="error" role="alert">{error}</p>}
      {!view && !error && <p className="muted" role="status">Loading {rec.name}…</p>}
      {variant && view && (
        <>
          <div className="chart-card">
            <h2>{variant.label}</h2>
            <p className="muted">
              {rec.name}, {variant.rows.length} {variant.rows.length === 1 ? 'row' : 'rows'}
              {rec.binned ? `, ${rec.windows.toLocaleString()} windows averaged into ${view.t.length.toLocaleString()} columns` : ''}
            </p>
            <Heatmap variant={variant} t={view.t} theme={theme} />
          </div>
          {variant.meanAbs.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Row</th><th className="num">Mean |value|</th><th className="num">Peak |value|</th></tr></thead>
                <tbody>
                  {variant.rows.map((r, i) => (
                    <tr key={r + i}>
                      <td>{r}</td>
                      <td className="num">{formatNumber(variant.meanAbs[i], 4)}</td>
                      <td className="num">{formatNumber(variant.peakAbs[i], 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="downloads">
            {csv && <li><a href={csv} download><DownloadIcon aria-hidden="true" />{csv.split('/').pop()}</a><span className="muted">every window of this variant</span></li>}
            <li><a href={rec.result} download><DownloadIcon aria-hidden="true" />{rec.result.split('/').pop()}</a>
              <span className="muted">DDALAB result, opens in DDALAB (Import) and records the exact settings</span></li>
          </ul>
        </>
      )}
    </section>
  );
}

export function App() {
  const [index, setIndex] = useState<Index>();
  const [error, setError] = useState<string>();
  const [stem, setStem] = useState<string>();
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    load<Index>('index.json')
      .then((i) => { setIndex(i); setStem(i.recordings[0]?.stem); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const rec = index?.recordings.find((r) => r.stem === stem);

  return (
    <main>
      <header className="top">
        <div>
          <p className="eyebrow">DDALAB {index?.ddalab ?? ''}</p>
          <h1>{index?.title ?? 'DDA results'}</h1>
        </div>
        <button type="button" className="icon-button" onClick={toggleTheme}
          aria-label={`Theme: ${theme}. Switch to ${theme === 'dark' ? 'light' : 'dark'}.`}
          title={theme === 'dark' ? 'Dark. Click for light.' : 'Light. Click for dark.'}>
          {theme === 'dark' ? <MoonIcon aria-hidden="true" /> : <SunIcon aria-hidden="true" />}
        </button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!index && !error && <p className="muted" role="status">Loading results…</p>}
      {index && (
        <>
          <div className="filters">
            {index.recordings.length > 1 && (
              <label>Recording
                <select value={stem} onChange={(e) => setStem(e.target.value)}>
                  {index.recordings.map((r) => <option key={r.stem} value={r.stem}>{r.name}</option>)}
                </select>
              </label>
            )}
            <dl className="settings">
              {Object.entries(index.settings).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
          {rec ? <RecordingView rec={rec} theme={theme} /> : <p className="muted">This run has no recordings.</p>}
        </>
      )}
    </main>
  );
}
