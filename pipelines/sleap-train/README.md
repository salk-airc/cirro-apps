# Train Pose Model (SLEAP)

Trains a [SLEAP](https://sleap.ai) pose model in Cirro with
[sleap-nn](https://github.com/talmolab/sleap-nn) from a lab's labeled frames, and publishes the model
folders that [Track Animal Poses (SLEAP)](../sleap) takes as its model input. The viewer (dataset →
**Visualize → Web Viewer**) shows the training and validation loss per model part, the best epoch,
and exactly which folders to pick for tracking.

## The SLEAP loop

1. **Label** a few hundred frames in the SLEAP desktop app, then **File → Export Labels Package**
   (with images) to get a `.pkg.slp`.
2. **Train** here: upload the `.pkg.slp`, run *Train Pose Model (SLEAP)*.
3. **Track** with *Track Animal Poses (SLEAP)*, picking the `models/…` folder(s) from the training result.
4. **Proofread** the predictions `.slp` back in the SLEAP app, and add labels where it struggled.

## Model types

| `model_type` | Trains | Use when |
|---|---|---|
| `single_instance` | one model | one animal per frame |
| `topdown` | `centroid` + `centered_instance`, in parallel | several animals, usually apart |
| `bottomup` | one model | several animals that touch or overlap |

Presets are sleap-nn v0.3.5's own sample configs (`configs/`, medium or large receptive field). Training
stops early when validation loss stops improving (`max_epochs` is the ceiling).

## Compute

`python:3.12-bookworm` with sleap-nn installed by `uv tool install --torch-backend cu126` (or `cpu`),
plus `libegl1`/`libgl1`. Training needs a GPU to be practical: with `gpu` on, the project's GPU limit
must be above 0. CPU works for a smoke test only.

## Run outside Cirro

```bash
nextflow run pipelines/sleap-train/main.nf -profile docker --gpu false \
  --labels train.pkg.slp --model_type single_instance --max_epochs 5 --outdir out
```

Use Nextflow **25.10.8** to match Cirro (see the repository README).

## Viewer

Source in `viewer/` (Vite + React). The built `viewer/dist` is committed because the pipeline copies it
into every output; after changing the source run `npm ci && npm run build` in `viewer/` and commit `dist/`.
