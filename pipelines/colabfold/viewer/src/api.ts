// Static stand-in for Fold's /api routes: every file sits next to index.html.
import type { Results } from './types';

let results: Promise<Results> | undefined;

export function getResults(): Promise<Results> {
  results ??= fetch('results.json').then((response) => {
    if (!response.ok) throw new Error('results.json could not be loaded.');
    return response.json() as Promise<Results>;
  });
  return results;
}

async function modelFiles(jobId: string, rank: number) {
  const data = await getResults();
  const model = data.jobs.find((job) => job.id === jobId)?.models.find((m) => m.rank === rank);
  if (!model) throw new Error(`No rank ${rank} model for ${jobId}.`);
  return model;
}

export async function getPae(jobId: string, rank: number, signal?: AbortSignal): Promise<{ pae: number[][]; maxPae: number }> {
  const model = await modelFiles(jobId, rank);
  const response = await fetch(model.scores, { signal });
  if (!response.ok) throw new Error('The PAE matrix could not be loaded.');
  const scores = await response.json() as { pae: number[][]; max_pae?: number };
  return { pae: scores.pae, maxPae: scores.max_pae ?? model.maxPae };
}

export async function getStructure(jobId: string, rank: number, signal?: AbortSignal): Promise<string> {
  const model = await modelFiles(jobId, rank);
  const response = await fetch(model.structure, { signal });
  if (!response.ok) throw new Error('The structure could not be loaded.');
  return response.text();
}
