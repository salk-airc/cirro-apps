# Measure Cells (CellProfiler)

Runs a lab's own [CellProfiler](https://cellprofiler.org) pipeline on folders of microscope images
as a Cirro pipeline, in parallel, and opens the merged measurements as an interactive viewer
(dataset → **Visualize → Web Viewer**):

- **Images:** every image set with its per-object counts, sortable, and the overlays the pipeline saved
- **Measurements:** a histogram of any measurement for any object type, across the whole run
- **Downloads:** CellProfiler's spreadsheets merged into one CSV per object type, and the pipeline

Styled with the [salk-ui](https://github.com/salk-airc/salk-ui) colors.

## Steps

| Step | Does |
|---|---|
| `PLAN` | CellProfiler matches **file names** into image sets using its own Images / Metadata / NamesAndTypes / Groups rules, on empty placeholder files, so nothing is downloaded. Writes one file list per chunk (`chunk_size` image sets, or one per group if Groups is on). Refuses LoadData pipelines and pipelines without ExportToSpreadsheet. |
| `RUN` | One task per chunk (1 CPU, 6 GB, retried with more memory), staging only that chunk's images. |
| `REPORT` | Merges the CSVs and makes `ImageNumber` run-wide, computes per-measurement histograms, makes thumbnails of saved images (16-bit stretched to 1st–99th percentile), adds the viewer. |

Container: `quay.io/biocontainers/cellprofiler:4.2.8.1--pyhdfd78af_0`. The official
`cellprofiler/cellprofiler` image sets `cellprofiler` as its entrypoint, which breaks Nextflow,
and is 4.9 GB against 0.7 GB.

## What a pipeline needs

- Exported as `.cppipe` (File → Export → Pipeline), not a `.cpproj` project.
- Images loaded with **Images + NamesAndTypes** (the default), not LoadData.
- An enabled **ExportToSpreadsheet** module (default settings are fine).
- A **SaveImages** module (e.g. after OverlayOutlines) if you want pictures in the viewer.
- Unique file names across the picked folders.

## Run outside Cirro

```bash
nextflow run pipelines/cellprofiler/main.nf -profile docker \
  --images path/to/images --pipeline path/to/pipeline.cppipe --outdir out
```

Open `out/index.html` through any static web server.

## Viewer

Source in `viewer/` (Vite + React). The built `viewer/dist` is committed because the pipeline copies
it into every output; after changing the source run `npm ci && npm run build` in `viewer/` and commit
`dist/`.
