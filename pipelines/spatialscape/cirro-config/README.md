# Spatial Browser (spatialscape) main

Source: REPLACE_WITH_GITHUB_OWNER/spatialscape-cirro at `main`

## Inputs

- **samplesheet** — One row per Xenium section. Pick each section's Xenium output folder (the folder holding cell_feature_matrix.h5 and cells.parquet).

## Requirements on your input data

- **samplesheet.xenium_dir** — Each folder must contain cell_feature_matrix.h5 and cells.parquet (Xenium Onboard Analysis v1.4+ output). cell_boundaries.parquet and analysis/ (clusters, UMAP) are used when present. Morphology images are not read.
- **viewer** — The browser reads its data with HTTP range requests. It works from S3 or any static host that honours Range; a host that ignores Range breaks gene loading (checked 2026-11-24 with python http.server).
