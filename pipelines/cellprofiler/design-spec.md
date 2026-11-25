---
workflow:
  name: Measure Cells (CellProfiler)
  repository: salk-airc/cirro-apps
  entrypoint: pipelines/cellprofiler/main.nf
  version: main
  executor: NEXTFLOW
  executor_version: null
inputs:
  - name: images
    description: Folder(s) of microscope images. Every image file inside (any depth) is offered to the pipeline; its own Images and NamesAndTypes rules decide what is used.
    type: folder
    required: true
    multiple: true
  - name: pipeline
    description: Your CellProfiler pipeline (.cppipe, from File > Export > Pipeline). It must use Images/NamesAndTypes (not LoadData) and have an ExportToSpreadsheet module.
    type: file
    group: analysis
    required: true
    pattern: '\.cppipe$'
parameters:
  - name: title
    type: string
    group: analysis
    required: true
    default: CellProfiler results
    description: Title shown at the top of the results viewer
  - name: chunk_size
    type: integer
    group: advanced
    required: true
    default: 50
    description: Image sets per parallel task. Pipelines with Groups enabled run one task per group instead.
  - name: cellprofiler_container
    type: string
    group: advanced
    required: true
    default: quay.io/biocontainers/cellprofiler:4.2.8.1--pyhdfd78af_0
    description: CellProfiler container image
outputs:
  - path: index.html
    description: Results viewer. Open with Visualize → Web Viewer.
    required: true
  - path: data.json
    description: Summary the viewer reads (counts, per-measurement histograms)
    required: true
  - path: tables/
    description: CellProfiler's spreadsheets (Image.csv and one per object type), merged across tasks with run-wide ImageNumber
    required: true
  - path: outputs/
    description: Images the pipeline saved (SaveImages), with thumbs/ previews
    required: false
  - path: pipeline/
    description: The .cppipe that ran and the chunk plan (summary.json)
    required: true
  - path: logs/
    description: CellProfiler log per task
    required: true
constraints:
  - applies_to: pipeline
    description: Exported .cppipe (not .cpproj). Images come in through Images/Metadata/NamesAndTypes; LoadData is refused. ExportToSpreadsheet must be enabled. Checked by PLAN before any image is downloaded.
    verify: |-
      grep -q '^ExportToSpreadsheet:.*enabled:True' "$CPPIPE" && ! grep -q '^LoadData:.*enabled:True' "$CPPIPE"
  - applies_to: images
    description: File names must be unique across the picked folders (a chunk stages files flat).
    verify: |-
      find "$IMAGES" -type f | xargs -n1 basename | sort | uniq -d   # expect no output
cirro:
  process_id: null
  category: Image Analysis
  input_mode: browse
  managed_parameters:
    - name: outdir
      role: output_directory
      note: Set by Cirro at launch
---

# Measure Cells (CellProfiler)

Runs a lab's own CellProfiler pipeline on folders of microscope images in Cirro, in parallel,
and opens the merged measurements in a viewer: image sets with counts and saved overlays,
a histogram of any measurement, and downloads.

Workflow: `pipelines/cellprofiler/` in github.com/salk-airc/cirro-apps.
PLAN (CellProfiler matches file names into image sets using empty placeholder files: no
image is downloaded) → RUN (one task per chunk, staging only its images) → REPORT (merge,
renumber ImageNumber run-wide, histograms, thumbnails, viewer).
Container: the Bioconda CellProfiler 4.2.8.1 image (the official Docker image's
`cellprofiler` entrypoint breaks Nextflow).

Tested locally 2026-11-25 (Nextflow, Docker) on Broad's ExampleHuman pipeline with 5 copies
of its image set and chunk_size 2: 3 tasks, 1,445 cells/nuclei, ImageNumber 1–5 after merge.

Judgment calls:
- The image folders are the primary input (no group); the .cppipe is a picked file.
- Pipelines with Groups run one task per group, since grouped modules (illumination correction,
  tracking) need the whole group.
- cirro-config/process-form.json is edited by hand after generation; regenerate with care.
