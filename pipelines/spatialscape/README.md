# spatialscape pipeline

Nextflow pipeline that turns 10x Xenium output folders into a [spatialscape](https://github.com/MicTott/spatialscape)
browser: a static website showing every section side by side, any gene in milliseconds.

Built for Cirro (salk.cirro.bio), runs anywhere Nextflow runs.

```bash
test/fetch_test_data.sh            # 4 public 10x Xenium sections, ~190 MB
nextflow run main.nf -profile docker \
  --samplesheet test/samplesheet.csv --outdir test-out \
  --dataset_name "Alzheimer's mouse brain (Xenium)" --default_gene Gfap
```

**Viewing in Cirro:** open the output dataset → **Visualize → Web Viewer**. Cirro serves `site/index.html` as a
dataset app (range requests supported), so the browser runs inside Cirro with each viewer's own access. Verified 2026-11-24.

In Cirro: pipeline "Spatial Browser (spatialscape)", entrypoint `pipelines/spatialscape/main.nf`,
config in `cirro-config/` (generated from `design-spec.md`).

`samples.csv` columns: `sample, xenium_dir, condition, age` (condition and age optional).
Each `xenium_dir` needs `cell_feature_matrix.h5` and `cells.parquet`; `cell_boundaries.parquet` and `analysis/`
are used when present. Morphology images are never read.

Output: `out/site/` (open `index.html` from any static host that supports HTTP range requests, e.g. S3)
and `out/dataset.yaml`.
