import { useEffect, useMemo, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, DownloadIcon, MoonIcon, SunIcon, XIcon } from 'lucide-react';
import { Histogram } from './Histogram';
import { formatNumber, prettyColumn } from './format';
import type { ImageSet, Results, Table } from './types';

type Tab = 'images' | 'measurements' | 'downloads';
const PAGE = 100;

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('cirro-apps-theme', theme); } catch { /* storage blocked */ }
  }, [theme]);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')] as const;
}

function StatTiles({ data }: { data: Results }) {
  const objects = data.tables.filter((t) => t.name !== 'Image');
  return (
    <dl className="tiles">
      <div><dt>Image sets</dt><dd>{data.imageSets.toLocaleString()}</dd></div>
      {objects.map((t) => (
        <div key={t.name}><dt>{t.name}</dt><dd>{t.rows.toLocaleString()}</dd></div>
      ))}
    </dl>
  );
}

function ImagesView({ data }: { data: Results }) {
  const metaKeys = useMemo(() => [...new Set(data.images.flatMap((i) => Object.keys(i.metadata)))], [data]);
  const countKeys = useMemo(() => [...new Set(data.images.flatMap((i) => Object.keys(i.counts)))], [data]);
  const firstChannel = useMemo(() => Object.keys(data.images[0]?.files ?? {})[0], [data]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: '#', dir: 1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<ImageSet>();

  const value = (img: ImageSet, key: string): string | number => {
    if (key === '#') return img.number;
    if (key.startsWith('count:')) return img.counts[key.slice(6)] ?? -Infinity;
    if (key.startsWith('meta:')) return img.metadata[key.slice(5)] ?? '';
    return firstChannel ? img.files[firstChannel] ?? '' : '';
  };
  const sorted = useMemo(() => [...data.images].sort((a, b) => {
    const x = value(a, sort.key), y = value(b, sort.key);
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
  }), [data, sort]);
  const rows = sorted.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.ceil(sorted.length / PAGE);

  const header = (key: string, label: string, numeric = false) => (
    <th className={numeric ? 'num' : undefined}
      aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="sort" onClick={() => setSort({ key, dir: sort.key === key ? (-sort.dir as 1 | -1) : 1 })}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUpIcon aria-hidden="true" /> : <ArrowDownIcon aria-hidden="true" />)}
      </button>
    </th>
  );

  return (
    <section>
      {open && (
        <div className="detail" role="region" aria-label={`Image set ${open.number}`}>
          <header>
            <h2>Image set {open.number}</h2>
            <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={() => setOpen(undefined)}>
              <XIcon aria-hidden="true" />
            </button>
          </header>
          <dl className="detail-facts">
            {Object.entries(open.files).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            {Object.entries(open.counts).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{formatNumber(v)}</dd></div>)}
          </dl>
          {open.thumbs.length > 0 ? (
            <div className="detail-images">
              {open.thumbs.map((t) => {
                const full = data.saved.find((s) => s.thumb === t)?.file ?? t;
                return <a key={t} href={full} target="_blank" rel="noreferrer"><img src={t} alt={`Saved image ${full.split('/').pop()}`} /></a>;
              })}
            </div>
          ) : <p className="muted">The pipeline saved no images for this set. Add a SaveImages module (for example after OverlayOutlines) to see overlays here.</p>}
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {header('#', '#', true)}
              {metaKeys.map((k) => header(`meta:${k}`, k))}
              {firstChannel && header('file', firstChannel)}
              {countKeys.map((k) => header(`count:${k}`, k, true))}
              <th><span className="visually-hidden">Preview</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((img) => (
              <tr key={img.number} aria-current={open?.number === img.number ? 'true' : undefined}>
                <td className="num">{img.number}</td>
                {metaKeys.map((k) => <td key={k}>{img.metadata[k] ?? ''}</td>)}
                {firstChannel && <td className="file">{img.files[firstChannel]}</td>}
                {countKeys.map((k) => <td key={k} className="num">{formatNumber(img.counts[k])}</td>)}
                <td><button type="button" className="link" onClick={() => setOpen(img)}>
                  {img.thumbs.length ? 'View' : 'Details'}
                </button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          <button type="button" className="quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button type="button" className="quiet" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}

function MeasurementsView({ data }: { data: Results }) {
  const [tableName, setTableName] = useState(() => data.tables.find((t) => t.name !== 'Image')?.name ?? data.tables[0]?.name);
  const table: Table | undefined = data.tables.find((t) => t.name === tableName);
  const [query, setQuery] = useState('');
  const [columnName, setColumnName] = useState<string>();
  useEffect(() => {
    const preferred = table?.columns.find((c) => c.name === 'AreaShape_Area') ?? table?.columns.find((c) => !c.name.startsWith('Location_')) ?? table?.columns[0];
    setColumnName(preferred?.name);
    setQuery('');
  }, [tableName]);
  if (!table) return <p className="muted">No measurement tables were written.</p>;
  const column = table.columns.find((c) => c.name === columnName);
  const matches = table.columns.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const unit = table.name === 'Image' ? 'image sets' : table.name.toLowerCase();

  return (
    <section className="measure">
      <div className="filters">
        <label>Objects
          <select value={tableName} onChange={(e) => setTableName(e.target.value)}>
            {data.tables.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.rows.toLocaleString()})</option>)}
          </select>
        </label>
        <label className="grow">Measurement
          <input type="search" placeholder={`Search ${table.columns.length} measurements`} value={query}
            onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <div className="measure-grid">
        <ul className="column-list" aria-label="Measurements">
          {matches.map((c) => (
            <li key={c.name}>
              <button type="button" aria-pressed={c.name === columnName} onClick={() => setColumnName(c.name)}>
                {prettyColumn(c.name)}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="muted">No measurement matches “{query}”.</li>}
        </ul>
        {column && (
          <div className="chart-card">
            <h2>{prettyColumn(column.name)}</h2>
            <p className="muted">{table.name}, all image sets</p>
            <dl className="mini-stats">
              <div><dt>{unit}</dt><dd>{column.n.toLocaleString()}</dd></div>
              <div><dt>Mean</dt><dd>{formatNumber(column.mean)}</dd></div>
              <div><dt>Min</dt><dd>{formatNumber(column.min)}</dd></div>
              <div><dt>Max</dt><dd>{formatNumber(column.max)}</dd></div>
            </dl>
            <Histogram column={column} unit={unit} />
            <p className="muted small">Every {unit.replace(/s$/, '')} in the run, in {column.bins.length} equal bins. The full values are in <a href={table.file} download>{table.file.split('/').pop()}</a>.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function DownloadsView({ data }: { data: Results }) {
  return (
    <section className="downloads">
      <h2>Merged tables</h2>
      <ul>
        {data.tables.map((t) => (
          <li key={t.name}><a href={t.file} download><DownloadIcon aria-hidden="true" />{t.file.replace(/^tables\//, '')}</a>
            <span className="muted">{t.rows.toLocaleString()} rows · {t.columns.length} numeric columns</span></li>
        ))}
        {data.experiment && <li><a href={data.experiment} download><DownloadIcon aria-hidden="true" />Experiment.csv</a><span className="muted">pipeline settings and run info</span></li>}
      </ul>
      <h2>Pipeline</h2>
      <ul>
        <li><a href={`pipeline/${data.pipeline}`} download><DownloadIcon aria-hidden="true" />{data.pipeline}</a><span className="muted">open in CellProfiler to reproduce</span></li>
      </ul>
      <p className="muted small">Saved images are in <code>outputs/</code> and CellProfiler logs in <code>logs/</code> in this dataset.</p>
    </section>
  );
}

export function App() {
  const [data, setData] = useState<Results>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>('images');
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    fetch('data.json')
      .then((r) => { if (!r.ok) throw new Error('data.json could not be loaded.'); return r.json(); })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main>
      <header className="top">
        <div>
          <p className="eyebrow">CellProfiler{data?.run.CellProfiler ? ` ${data.run.CellProfiler}` : ''}{data?.pipeline ? ` · ${data.pipeline}` : ''}</p>
          <h1>{data?.title ?? 'CellProfiler results'}</h1>
        </div>
        <button type="button" className="icon-button" onClick={toggleTheme}
          aria-label={`Theme: ${theme}. Switch to ${theme === 'dark' ? 'light' : 'dark'}.`}
          title={theme === 'dark' ? 'Dark. Click for light.' : 'Light. Click for dark.'}>
          {theme === 'dark' ? <MoonIcon aria-hidden="true" /> : <SunIcon aria-hidden="true" />}
        </button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading results…</p>}
      {data && (
        <>
          <StatTiles data={data} />
          <nav className="tabs" role="tablist" aria-label="Views">
            {(['images', 'measurements', 'downloads'] as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
          {tab === 'images' && <ImagesView data={data} />}
          {tab === 'measurements' && <MeasurementsView data={data} />}
          {tab === 'downloads' && <DownloadsView data={data} />}
        </>
      )}
    </main>
  );
}
