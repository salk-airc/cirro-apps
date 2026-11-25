# Predict Protein Structure (ColabFold)

AlphaFold2 structure prediction through [ColabFold](https://github.com/sokrypton/ColabFold) as a
Cirro pipeline. The output dataset opens as an interactive viewer (dataset → **Visualize → Web
Viewer**): every prediction in a table, then per prediction the structure colored by pLDDT, the PAE
matrix linked to the structure, ranked models and downloads.

The viewer's result panels come from Simon Dräger's [Fold](https://github.com/salk-airc/fold) app
(MIT), styled with the [salk-ui](https://github.com/salk-airc/salk-ui) colors.

## Steps

| Step | Runs on | Does |
|---|---|---|
| `PREP` | CPU | FASTA → one query per prediction (`mode`: each sequence alone, or each file one complex) |
| `MSA` | CPU, internet | ColabFold `--msa-only` against the public MMseqs2 server (api.colabfold.com). **Sequences leave Salk.** |
| `PREDICT` | 1 GPU, no network | AlphaFold2 (`alphafold2_ptm` / `alphafold2_multimer_v3`), weights downloaded at start |
| `REPORT` | CPU | `results.json`, structures, scores, raw outputs, and the viewer |

ColabFold 1.6.2 and JAX 0.10.2, the versions Fold validated, are pip-installed into
`python:3.12-bookworm` at run time (the official ColabFold image lacks `ps`, which Nextflow on AWS Batch
needs). Before wide use: bake an image and keep the weights as a Cirro reference.

## Run outside Cirro

```bash
nextflow run pipelines/colabfold/main.nf -profile docker \
  --input pipelines/colabfold/test/barnase-barstar.fasta --mode complex --outdir out
```

needs a CUDA GPU for `PREDICT`. Open `out/index.html` through any static web server.

## Viewer

Source in `viewer/` (Vite + React + 3Dmol). The built `viewer/dist` is committed because the pipeline
copies it into every output; after changing the source run `npm ci && npm run build` in `viewer/` and
commit `dist/`.
