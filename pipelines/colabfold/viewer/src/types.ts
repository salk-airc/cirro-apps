// Shape of results.json, written by scripts/summarize.py.
export interface ModelSummary {
  rank: number;
  modelId: string;
  meanPlddt: number;
  ptm: number;
  iptm: number | null;
  maxPae: number;
  structure: string; // relative path to the PDB
  scores: string;    // relative path to ColabFold's scores JSON (plddt, pae, max_pae, ptm, iptm)
}

export interface JobSummary {
  id: string;
  name: string;
  kind: 'monomer' | 'complex';
  chains: { id: string; length: number }[];
  models: ModelSummary[];
  log?: string;
}

export interface Results {
  title: string;
  generatedAt: string;
  run: Record<string, string | number | null>;
  jobs: JobSummary[];
  failed?: { id: string; name: string; reason: string }[];
}
