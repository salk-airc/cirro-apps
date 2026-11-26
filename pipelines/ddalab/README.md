# Delay Differential Analysis (DDALAB)

Runs [DDALAB](https://github.com/sdraeger/DDALAB)'s Delay Differential Analysis on EEG, iEEG and
other physiological recordings in Cirro, and opens a viewer (dataset → **Visualize → Web Viewer**)
that draws each variant as a row × time heatmap:

- **Heatmap:** one row per channel (ST) or channel group (CT, CD, DE, SY), one column per window;
  hover to read a value. Signed results use a blue–red scale centered on 0 (gray); one-signed
  results use a single-hue scale.
- **Rows:** mean and peak absolute value per row
- **Downloads:** a CSV of every window per variant, and DDALAB's result JSON, which opens in
  DDALAB (Import) and records the settings and the input file's hash

Long recordings are averaged into at most 2000 columns in the viewer; the CSV and JSON keep every
window.

## Steps

| Step | Runs on | Does |
|---|---|---|
| `DDA` | 4 CPUs, 8 GB (more on retry) | `ddalab run` per recording |
| `REPORT` | 1 CPU | `index.json`, the viewer's copies, CSVs, the viewer |

`python:3.12-bookworm` with `ddalab` from PyPI installed at run time (the wheel holds the engine and
the CLI). CPU only: DDALAB's own benchmark has CUDA slower than multicore CPU for this workload.

## What you need

- Recordings: `.edf`, `.bdf`, `.vhdr` (with its `.eeg` and `.vmrk` in the same folder), `.set`,
  `.fif`, `.nwb`, or a text table with `sr` set.
- For CT and CD, channel pairs as 0-based indices (`0,1 0,2`). DE and SY use the selected channels.

## Run outside Cirro

```bash
pipelines/ddalab/test/fetch_test_data.sh
nextflow run pipelines/ddalab/main.nf -profile docker \
  --recordings pipelines/ddalab/test/data/S001R01.edf,pipelines/ddalab/test/data/test.vhdr \
  --ct true --ct_pairs "0,1 2,3" --sy true --channels "0 1 2 3 4 5 6 7" --outdir out
```

Open `out/index.html` through any static web server.

## Viewer

Source in `viewer/` (Vite + React). The built `viewer/dist` is committed because the pipeline copies
it into every output; after changing the source run `npm ci && npm run build` in `viewer/` and commit
`dist/`.
