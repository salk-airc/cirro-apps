// Shape of data.json, written by scripts/report.py.
export interface ColumnStats {
  name: string;
  n: number;
  min: number;
  max: number;
  mean: number;
  bins: number[];
}

export interface Table {
  name: string;   // Image, Nuclei, Cells, ...
  file: string;   // merged CSV
  rows: number;
  columns: ColumnStats[];
}

export interface ImageSet {
  number: number;
  metadata: Record<string, string>;
  files: Record<string, string>;   // channel name -> file name
  counts: Record<string, number | null>;
  thumbs: string[];
}

export interface SavedImage {
  file: string;
  thumb: string | null;
  image?: number;
}

export interface Results {
  title: string;
  pipeline: string;
  generatedAt: string;
  run: Record<string, string>;
  imageSets: number;
  chunks: number;
  tables: Table[];
  images: ImageSet[];
  saved: SavedImage[];
  experiment: string | null;
}
