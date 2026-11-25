// Adapted from salk-airc/fold src/client/results/ResultView.tsx (MIT): the Fold API,
// retention and queue controls are removed; files are read from the dataset folder.
import { useState } from 'react';
import { PaePlot } from './PaePlot';
import { StructureViewer } from './StructureViewer';
import type { PaePoint } from './paeSelection';
import type { JobSummary, Results } from '../types';

function ResultPanels({ jobId, rank, residueCount }: { jobId: string; rank: number; residueCount: number }) {
  const [selection, setSelection] = useState<PaePoint>();
  return (
    <div className="result-grid">
      <StructureViewer jobId={jobId} rank={rank} residueCount={residueCount} selection={selection} />
      <PaePlot jobId={jobId} rank={rank} selection={selection} onSelect={setSelection} />
    </div>
  );
}

export function ResultView({ job, run, onBack }: { job: JobSummary; run: Results['run']; onBack: () => void }) {
  const [rank, setRank] = useState(1);
  const model = job.models.find((candidate) => candidate.rank === rank) ?? job.models[0];
  if (!model) {
    return (
      <section className="result-view">
        <button className="back-button" type="button" onClick={onBack}>← All predictions</button>
        <p className="jobs-error" role="alert">No model was produced for {job.name}.</p>
      </section>
    );
  }

  return (
    <section className="result-view">
      <button className="back-button" type="button" onClick={onBack}>← All predictions</button>
      <header className="result-heading">
        <div>
          <p>{job.kind} · {job.chains.map((chain) => chain.length).join(' + ')} residues</p>
          <h1>{job.name}</h1>
        </div>
        {job.models.length > 1 && (
          <label className="rank-select">
            Ranked model
            <select value={model.rank} onChange={(event) => setRank(Number(event.target.value))}>
              {job.models.map((candidate) => (
                <option key={candidate.rank} value={candidate.rank}>Rank {candidate.rank}</option>
              ))}
            </select>
          </label>
        )}
      </header>
      <dl className={`result-metrics result-metrics-${job.kind}`}>
        <div><dt>Mean pLDDT</dt><dd>{model.meanPlddt.toFixed(1)}</dd></div>
        <div><dt>pTM</dt><dd>{model.ptm.toFixed(2)}</dd></div>
        {job.kind === 'complex' && <div><dt>ipTM</dt><dd>{model.iptm?.toFixed(2) ?? '—'}</dd></div>}
        <div><dt>Max PAE</dt><dd>{model.maxPae.toFixed(1)} Å</dd></div>
      </dl>
      <p className="viewer-status">
        {job.kind === 'complex'
          ? 'pLDDT of 90 or more is very high local confidence; below 50 is very low. Use ipTM and PAE to judge chain placement.'
          : 'pLDDT of 90 or more is very high local confidence; below 50 is very low. Lower PAE supports relative domain placement.'}
      </p>
      {job.models.length > 1 && (
        <div className="model-comparison">
          <table>
            <thead>
              <tr><th>Rank</th><th>Mean pLDDT</th><th>pTM</th>{job.kind === 'complex' && <th>ipTM</th>}<th>Max PAE</th><th /></tr>
            </thead>
            <tbody>
              {job.models.map((candidate) => (
                <tr key={candidate.rank} aria-current={candidate.rank === model.rank ? 'true' : undefined}>
                  <td>{candidate.rank}</td>
                  <td>{candidate.meanPlddt.toFixed(1)}</td>
                  <td>{candidate.ptm.toFixed(2)}</td>
                  {job.kind === 'complex' && <td>{candidate.iptm?.toFixed(2) ?? '—'}</td>}
                  <td>{candidate.maxPae.toFixed(1)} Å</td>
                  <td><button className="topbar-link" type="button" onClick={() => setRank(candidate.rank)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ResultPanels key={`${job.id}:${model.rank}`} jobId={job.id} rank={model.rank}
        residueCount={job.chains.reduce((sum, chain) => sum + chain.length, 0)} />
      <nav className="result-downloads" aria-label="Result downloads">
        <a href={model.structure} download>Structure PDB</a>
        <a href={model.scores} download>Scores JSON</a>
        {job.log && <a href={job.log} download>Run log</a>}
      </nav>
      <details className="run-details">
        <summary>Run details</summary>
        <dl>
          {Object.entries(run).map(([key, value]) => (
            <div key={key}><dt>{key}</dt><dd>{value === null ? 'Not reported' : String(value)}</dd></div>
          ))}
          <div><dt>Model</dt><dd><code>{model.modelId}</code></dd></div>
        </dl>
      </details>
    </section>
  );
}
