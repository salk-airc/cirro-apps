# cirro-apps

Tools the Salk AIRC builds for [Cirro](https://salk.cirro.bio): pipelines, workspace images and apps
that let Salk researchers explore and analyze their own data.

| Path | What | Kind |
|---|---|---|
| [`pipelines/spatialscape`](pipelines/spatialscape) | 10x Xenium sections → interactive [spatialscape](https://github.com/MicTott/spatialscape) browser | Nextflow pipeline |
| [`pipelines/colabfold`](pipelines/colabfold) | Protein FASTA → AlphaFold2 structures (ColabFold) with an interactive pLDDT/PAE viewer | Nextflow pipeline (GPU) |
| [`pipelines/sleap`](pipelines/sleap) | Videos + a lab's trained SLEAP model → tracked poses (sleap-nn) with a video/skeleton viewer | Nextflow pipeline (GPU or CPU) |
| [`pipelines/cellprofiler`](pipelines/cellprofiler) | Folders of microscope images + a lab's CellProfiler pipeline → merged per-cell measurements with an image/histogram viewer | Nextflow pipeline |

## Layout

```
pipelines/<name>/      Nextflow (or WDL) pipeline, runnable outside Cirro too
  main.nf              entrypoint Cirro runs (pipelines/<name>/main.nf)
  scripts/             helper scripts, passed into processes as inputs
  cirro-config/        Cirro form, input map, outputs (generated from design-spec.md)
  design-spec.md       the pipeline's Cirro contract: inputs, parameters, outputs
workspaces/<name>/     custom Cirro workspace images (Dockerfile + docs)
apps/<name>/           OAuth apps that sign in with Cirro
```

Pipelines keep everything they need inside their own folder: containers and resources are set in
`main.nf`, not a root `nextflow.config`, so many pipelines can share this repo.
