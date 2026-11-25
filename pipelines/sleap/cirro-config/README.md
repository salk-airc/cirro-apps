# Track Animal Poses (SLEAP) main

Source: salk-airc/cirro-apps at `main`

## Inputs

- **videos** — Video file(s) to track (.mp4, .avi, .mov, ...). Each is predicted on its own and gets its own page in the viewer.
- **models** — Trained SLEAP model folder(s), each holding best.ckpt and training_config.yaml. One folder for single-instance or bottom-up models; two (centroid and centered instance) for top-down.

## Requirements on your input data

- **models** — Folders written by sleap-nn train (best.ckpt + training_config.yaml), or SLEAP 1.x model folders (best_model.h5 + training_config.json), which sleap-nn also reads. A top-down model needs both its centroid and centered-instance folders.
- **compute** — With gpu on, PREDICT uses Cirro's GPU queue; the project's "Maximum vCPUs for GPU-enabled instances" must be above 0 (the first raise can take AWS 1-2 business days).
