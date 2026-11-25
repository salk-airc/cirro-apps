# Track Animal Poses (SLEAP)

Runs a lab's trained [SLEAP](https://sleap.ai) model on videos in Cirro with
[sleap-nn](https://github.com/talmolab/sleap-nn) (the PyTorch engine behind SLEAP, from the
Pereira lab), tracks identities, and opens a viewer (dataset → **Visualize → Web Viewer**) that plays
each video with the skeletons drawn on it:

- **Player:** the video with every animal's skeleton and name, frame stepping, 0.25–4× speed
- **Track timeline:** when each track is present, to spot identity swaps and dropouts; click to jump
- **Tracks:** show or hide each animal; hide low-confidence points
- **Downloads:** predictions `.slp` (open in SLEAP to proofread), SLEAP analysis HDF5, CSV

Styled with the [salk-ui](https://github.com/salk-airc/salk-ui) colors. Track colors are the
validated categorical palette in fixed order. Tracks past the eighth are gray, and every animal
also carries a name label, so color is never the only cue.

## Steps

| Step | Runs on | Does |
|---|---|---|
| `PREDICT` | 1 GPU (`gpu`, default on) or CPU | `sleap-nn predict` with the picked model folder(s), plus tracking |
| `EXPORT` | CPU | `.slp` copy, analysis HDF5 and CSV (sleap-io), an H.264 preview at most 1280 px wide (ffmpeg), and `poses.f32` + `meta.json` for the viewer |
| `REPORT` | CPU | `index.json` and the viewer |

`python:3.12-bookworm` with sleap-nn 0.3.5 installed by `uv tool install --torch-backend cu126` (or
`cpu`) at run time, plus `libegl1`/`libgl1` (sleap-nn needs them) and ffmpeg. Bake an image before
wide use.

## What you need

- Videos (`.mp4`, `.avi`, `.mov`, …).
- A **trained model**: the folder(s) `sleap-nn train` writes (`best.ckpt` + `training_config.yaml`),
  or SLEAP 1.x model folders. Top-down models need **both** folders, centroid and centered
  instance. Training is not part of this pipeline.
- With `gpu` on, the project's GPU limit ("Maximum vCPUs for GPU-enabled instances") above 0. The
  first raise can take AWS 1–2 business days. Without it, set `gpu` off; CPU is fine for short
  clips.

## Run outside Cirro

```bash
nextflow run pipelines/sleap/main.nf -profile docker --gpu false \
  --videos a.mp4,b.mp4 --models models/centroid,models/centered_instance --max_instances 2 --outdir out
```

Open `out/index.html` through any static web server.

## Viewer

Source in `viewer/` (Vite + React). The built `viewer/dist` is committed because the pipeline copies
it into every output; after changing the source run `npm ci && npm run build` in `viewer/` and commit
`dist/`.
