// index.json (scripts/build_index.py) and videos/<name>/meta.json (scripts/export_poses.py).
export interface VideoMeta {
  name: string;
  frames: number;
  width: number;
  height: number;
  fps: number;
  previewWidth: number;
  slots: number;
  tracked: boolean;
  tracks: { name: string; frames: number }[];
  nodes: string[];
  edges: [number, number][];
  framesWithPoses: number;
  meanScore: number | null;
  files: { slp: string; h5: string; csv: string };
}

export interface Index {
  title: string;
  generatedAt: string;
  run: Record<string, string>;
  models: string[];
  videos: { name: string; dir: string }[];
}

export interface Poses {
  meta: VideoMeta;
  data: Float32Array; // [frame][slot][node][x, y, score]
}
