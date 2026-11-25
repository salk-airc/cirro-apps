import { useEffect, useState } from 'react';
import { getResults } from './api';
import { LoadingState } from './components/LoadingState';
import { ResultView } from './results/ResultView';
import type { JobSummary, Results } from './types';

function jobFromHash(): string | undefined {
  const match = /^#job=(.+)$/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]!) : undefined;
}

function JobList({ data, onOpen }: { data: Results; onOpen: (id: string) => void }) {
  const best = (job: JobSummary) => job.models[0];
  return (
    <section className="jobs-view">
      <header className="jobs-heading">
        <div>
          <p>ColabFold · AlphaFold2</p>
          <h1>{data.title}</h1>
        </div>
        <span>{data.jobs.length} {data.jobs.length === 1 ? 'prediction' : 'predictions'}</span>
      </header>
      <div className="model-comparison">
        <table>
          <thead>
            <tr><th>Name</th><th>Kind</th><th>Residues</th><th>Mean pLDDT</th><th>pTM</th><th>ipTM</th><th>Max PAE</th><th /></tr>
          </thead>
          <tbody>
            {data.jobs.map((job) => {
              const model = best(job);
              return (
                <tr key={job.id}>
                  <td>{job.name}</td>
                  <td>{job.kind}</td>
                  <td>{job.chains.map((chain) => chain.length).join(' + ')}</td>
                  <td>{model ? model.meanPlddt.toFixed(1) : '—'}</td>
                  <td>{model ? model.ptm.toFixed(2) : '—'}</td>
                  <td>{model?.iptm != null ? model.iptm.toFixed(2) : '—'}</td>
                  <td>{model ? `${model.maxPae.toFixed(1)} Å` : '—'}</td>
                  <td><button className="topbar-link" type="button" onClick={() => onOpen(job.id)}>View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.failed && data.failed.length > 0 && (
        <div className="message warning">
          <strong>{data.failed.length} {data.failed.length === 1 ? 'sequence' : 'sequences'} did not produce a model</strong>
          <ul>{data.failed.map((item) => <li key={item.id}>{item.name}: {item.reason}</li>)}</ul>
        </div>
      )}
      <nav className="result-downloads" aria-label="Downloads">
        <a href="results.json" download>Summary JSON</a>
      </nav>
    </section>
  );
}

export function App() {
  const [data, setData] = useState<Results>();
  const [error, setError] = useState<string>();
  const [jobId, setJobId] = useState(jobFromHash());

  useEffect(() => {
    getResults().then(setData).catch((err) => setError(err instanceof Error ? err.message : String(err)));
    const onHash = () => setJobId(jobFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = (id: string | undefined) => {
    window.location.hash = id ? `job=${encodeURIComponent(id)}` : '';
    setJobId(id);
  };

  const job = data?.jobs.find((candidate) => candidate.id === jobId);
  return (
    <main>
      {error && <p className="jobs-error" role="alert">{error}</p>}
      {!data && !error && <LoadingState label="Loading results" rows={3} />}
      {data && job && <ResultView job={job} run={data.run} onBack={() => open(undefined)} />}
      {data && !job && <JobList data={data} onOpen={open} />}
    </main>
  );
}
