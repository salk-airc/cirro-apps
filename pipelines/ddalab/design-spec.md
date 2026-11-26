---
workflow:
  name: Delay Differential Analysis (DDALAB)
  repository: salk-airc/cirro-apps
  entrypoint: pipelines/ddalab/main.nf
  version: main
  executor: NEXTFLOW
  executor_version: null
inputs:
  - name: recordings
    description: Recording file(s) to analyze. EDF, BDF, BrainVision (.vhdr, with its .eeg and .vmrk beside it), EEGLAB (.set), FIF, NWB, or a text table (.csv, .tsv, .txt). Each is analyzed on its own and gets its own page in the viewer.
    type: file
    required: true
    multiple: true
    pattern: '\.(edf|bdf|vhdr|set|fif|nwb|csv|tsv|txt|ascii|dat|EDF|BDF|VHDR|SET|FIF|NWB|CSV|TSV|TXT)$'
parameters:
  - name: st
    type: boolean
    group: variants
    required: true
    default: true
    description: Single timeseries (ST), one row per channel
  - name: ct
    type: boolean
    group: variants
    required: true
    default: false
    description: Cross timeseries (CT), one row per channel pair in CT pairs
  - name: ct_pairs
    type: string
    group: variants
    required: false
    default: ''
    description: CT channel pairs as 0-based indices, such as "0,1 0,2". Required when CT is on.
  - name: cd
    type: boolean
    group: variants
    required: true
    default: false
    description: Cross dynamical (CD), directed, one row per pair in CD pairs
  - name: cd_pairs
    type: string
    group: variants
    required: false
    default: ''
    description: CD directed channel pairs, such as "0,1 1,0". Required when CD is on.
  - name: de
    type: boolean
    group: variants
    required: true
    default: false
    description: Dynamical ergodicity (DE), over the selected channels
  - name: sy
    type: boolean
    group: variants
    required: true
    default: false
    description: Synchronization (SY)
  - name: wl
    type: integer
    group: windows
    required: true
    default: 200
    description: Window length in samples
  - name: ws
    type: integer
    group: windows
    required: true
    default: 100
    description: Window step in samples
  - name: delays
    type: string
    group: windows
    required: true
    default: '7 10'
    description: Delays (tau) in samples, separated by spaces
  - name: channels
    type: string
    group: windows
    required: false
    default: ''
    description: 0-based channel indices to analyze, separated by spaces. Empty analyzes every channel.
  - name: reference
    type: string
    group: windows
    required: true
    default: none
    choices: [none, average, bipolar]
    description: Re-reference before DDA. The derived channels replace the originals, so channel indices count them.
  - name: start
    type: number
    group: windows
    required: true
    default: 0
    description: Start time in seconds
  - name: end
    type: number
    group: windows
    required: true
    default: 0
    description: End time in seconds; 0 analyzes to the end
  - name: title
    type: string
    group: windows
    required: true
    default: DDA results
    description: Title shown at the top of the viewer
  - name: sr
    type: number
    group: advanced
    required: true
    default: 0
    description: Sampling rate in Hz, for text tables only; 0 reads it from the file
  - name: ddalab_version
    type: string
    group: advanced
    required: true
    default: 2.9.0
    description: ddalab release installed from PyPI at run time
outputs:
  - path: index.html
    description: Viewer. Open with Visualize → Web Viewer.
    required: true
  - path: index.json
    description: Recordings in this run and the DDA settings used
    required: true
  - path: results/
    description: Per recording, DDALAB's result document (<name>.dda.json), which opens in DDALAB and records the exact settings and input hash
    required: true
  - path: tables/
    description: Per recording and variant, a CSV of every window (time_s, then one column per row)
    required: true
  - path: view/
    description: The viewer's compact copy of each result
    required: true
constraints:
  - applies_to: recordings
    description: A BrainVision .vhdr needs its .eeg and .vmrk, and an EEGLAB .set its .fdt, in the same folder with the same name; the pipeline stages every file that shares the recording's name.
    verify: |-
      ls "${REC%.*}".*
  - applies_to: recordings
    description: Text tables need sr set to their sampling rate.
    verify: |-
      echo "set sr for .csv/.tsv/.txt input"
cirro:
  process_id: null
  category: Neuroscience
  input_mode: browse
  managed_parameters:
    - name: outdir
      role: output_directory
      note: Set by Cirro at launch
---

# Delay Differential Analysis (DDALAB)

Runs [DDALAB](https://github.com/sdraeger/DDALAB)'s Delay Differential Analysis on EEG, iEEG and
other physiological recordings and opens a viewer that draws each variant as a row × time heatmap,
with per-row summaries and downloads (CSV, DDALAB result JSON).

Workflow: `pipelines/ddalab/` in github.com/salk-airc/cirro-apps. DDA per recording (CPU) →
REPORT (index, CSVs, viewer).

Tested locally 2026-11-25 (Nextflow 25.10.8, Docker, linux/amd64) on PhysioNet's S001R01.edf and
MNE's BrainVision test file, with ST, CT and SY on 8 channels.

Judgment calls:
- CPU only. DDALAB's own benchmark on an A40 has CUDA at 0.6-0.7x the speed of multicore CPU for
  this workload, so a GPU queue is not worth its setup.
- Variants are one switch each, and pairs are plain text, because channel names are not known
  until the file is read. The model (terms, dimension, order) keeps DDALAB's defaults; change it
  locally with `ddalab run`.
- Laplacian re-referencing is left out: it needs electrode positions beside the recording.
