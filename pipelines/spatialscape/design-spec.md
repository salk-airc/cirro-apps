---
workflow:
  name: Spatial Browser (spatialscape)
  repository: salk-airc/cirro-apps
  entrypoint: pipelines/spatialscape/main.nf
  version: main
  executor: NEXTFLOW
  executor_version: null
inputs:
  - name: samplesheet
    description: One row per Xenium section. Pick each section's Xenium output folder (the folder holding cell_feature_matrix.h5 and cells.parquet).
    type: file
    required: true
    structured:
      name: samplesheet
      file_format: CSV
      columns:
        - name: sample
          type: string
          title: Section name
          description: Label shown above the section in the browser
          required: true
          pattern: '^[A-Za-z0-9_.-]+$'
          error_message: Letters, digits, dots, dashes and underscores only
        - name: xenium_dir
          type: folder
          title: Xenium output folder
          description: The Xenium Onboard Analysis output folder for this section
          required: true
        - name: condition
          type: string
          title: Condition
          description: Optional, e.g. genotype or treatment. The browser can split sections by it.
        - name: age
          type: string
          title: Age / timepoint
          description: Optional. The browser can split sections by it.
parameters:
  - name: dataset_name
    type: string
    group: browser
    required: true
    default: Spatial browser
    description: Title shown at the top of the browser
  - name: description
    type: string
    group: browser
    required: false
    description: One sentence describing the dataset
  - name: default_gene
    type: string
    group: browser
    required: false
    description: Gene to color by when the browser opens (e.g. Gfap). Leave empty to color by cluster.
  - name: spatialscape_version
    type: string
    group: advanced
    required: true
    default: 1.0.0
    description: spatialscape release to build with
outputs:
  - path: site/index.html
    description: The browser. Open it to view the sections.
    required: true
  - path: site/spatial/manifest.json
    description: Built spatialscape bundle (static Zarr data the browser reads)
    required: true
  - path: dataset.yaml
    description: spatialscape config used for the build; rebuild locally with `spatialscape build dataset.yaml`
    required: true
constraints:
  - applies_to: samplesheet.xenium_dir
    description: Each folder must contain cell_feature_matrix.h5 and cells.parquet (Xenium Onboard Analysis v1.4+ output). cell_boundaries.parquet and analysis/ (clusters, UMAP) are used when present. Morphology images are not read.
    verify: |-
      for f in cell_feature_matrix.h5 cells.parquet; do test -s "$XENIUM_DIR/$f" || echo "missing $f"; done
  - applies_to: viewer
    description: The browser reads its data with HTTP range requests. It works from S3 or any static host that honours Range; a host that ignores Range breaks gene loading (checked 2026-11-24 with python http.server).
    verify: |-
      curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-99' "$URL/spatial/manifest.json"   # expect 206
cirro:
  process_id: null
  category: Spatial Transcriptomics
  input_mode: browse
  managed_parameters:
    - name: outdir
      role: output_directory
      note: Set by Cirro at launch
---

# Spatial Browser (spatialscape)

Turns one or more 10x Xenium sections into an interactive spatialscape browser
(https://github.com/MicTott/spatialscape, MIT): every section side by side, any gene in milliseconds,
cluster colors, cell outlines, and split-by condition/age.

Workflow: `pipelines/spatialscape/` in github.com/salk-airc/cirro-apps.
Two processes: `TO_H5AD` per section (Xenium files → AnnData), then `BUILD_SITE`
(`spatialscape build` + `site build` + `validate`). Container `python:3.12-bookworm` (not -slim: Nextflow on AWS Batch needs `ps`), spatialscape installed with pip at
run time; bake an image before wide use.

Tested locally 2026-11-24 (Nextflow 26.10.7, Docker) on 4 public 10x Xenium TgCRND8/wildtype mouse brain sections:
4 TO_H5AD + 1 BUILD_SITE succeeded, 65 MB site, validate ok, viewer loads all genes with a Range-capable server.

Judgment calls:
- The samplesheet is the primary input (no group) because a run is several sections, each a picked folder.
- Clusters come from each section's own Xenium clustering, so cluster IDs are not comparable across sections.
