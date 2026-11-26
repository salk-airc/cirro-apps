export type Recording = {
  name: string;
  stem: string;
  result: string;
  view: string;
  start: number | null;
  end: number | null;
  windows: number;
  binned: boolean;
  channels: string[];
  variants: { id: string; label: string; rows: number; csv: string }[];
  diagnostics: unknown[];
};

export type Index = {
  title: string;
  ddalab: string;
  settings: Record<string, string | number | null>;
  recordings: Recording[];
};

export type Variant = {
  id: string;
  label: string;
  rows: string[];
  min: number | null;
  max: number | null;
  meanAbs: (number | null)[];
  peakAbs: (number | null)[];
  matrix: (number | null)[][];
};

export type View = { t: number[]; variants: Variant[] };
