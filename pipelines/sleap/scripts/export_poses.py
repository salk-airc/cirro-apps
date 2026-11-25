#!/usr/bin/env python3
"""Export one video's SLEAP predictions for downloads and for the viewer.

Writes into <out>/:
  <name>.predictions.slp   the predictions as SLEAP saved them (open in the SLEAP GUI)
  <name>.analysis.h5       SLEAP analysis HDF5 (tracks x nodes x xy x frames), for MATLAB/Python
  <name>.csv               one row per frame x instance, every node's x, y and score
  poses.f32                float32 little-endian [frames][slots][nodes][x, y, score], NaN when absent
  meta.json                skeleton, tracks, sizes and fps the viewer needs
"""
import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import sleap_io as sio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("predictions", type=Path)
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--fps", type=float, default=0)
    ap.add_argument("--preview-width", type=int, default=0, help="width of the transcoded preview video")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    labels = sio.load_slp(str(args.predictions))
    video = labels.videos[0]
    frames, height, width = video.shape[0], video.shape[1], video.shape[2]
    tracked = len(labels.tracks) > 0
    poses = labels.numpy(video=0, untracked=not tracked, return_confidence=True).astype("<f4")
    slots = poses.shape[1]

    shutil.copy(args.predictions, args.out / f"{args.name}.predictions.slp")
    sio.save_analysis_h5(labels, str(args.out / f"{args.name}.analysis.h5"))
    sio.save_csv(labels, str(args.out / f"{args.name}.csv"))
    poses.tofile(args.out / "poses.f32")

    present = ~np.all(np.isnan(poses[..., 0]), axis=2)  # frames x slots
    names = [t.name for t in labels.tracks] if tracked else [f"instance {i + 1}" for i in range(slots)]
    scores = poses[..., 2]
    meta = {
        "name": args.name,
        "frames": int(frames),
        "width": int(width),
        "height": int(height),
        "fps": args.fps or float(getattr(video, "fps", 0) or 30),
        "previewWidth": args.preview_width or int(width),
        "slots": int(slots),
        "tracked": tracked,
        "tracks": [{"name": names[i], "frames": int(present[:, i].sum())} for i in range(slots)],
        "nodes": [n.name for n in labels.skeleton.nodes],
        "edges": [list(e) for e in labels.skeleton.edge_inds],
        "framesWithPoses": int(present.any(axis=1).sum()),
        "meanScore": float(np.nanmean(scores)) if np.isfinite(scores).any() else None,
        "files": {
            "slp": f"{args.name}.predictions.slp",
            "h5": f"{args.name}.analysis.h5",
            "csv": f"{args.name}.csv",
        },
    }
    (args.out / "meta.json").write_text(json.dumps(meta))
    print(json.dumps({k: meta[k] for k in ("name", "frames", "slots", "framesWithPoses")}))


if __name__ == "__main__":
    main()
