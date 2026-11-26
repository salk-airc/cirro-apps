# Delay Differential Analysis (DDALAB) main

Source: salk-airc/cirro-apps at `main`

## Inputs

- **recordings** — Recording file(s) to analyze. EDF, BDF, BrainVision (.vhdr, with its .eeg and .vmrk beside it), EEGLAB (.set), FIF, NWB, or a text table (.csv, .tsv, .txt). Each is analyzed on its own and gets its own page in the viewer.

## Requirements on your input data

- **recordings** — A BrainVision .vhdr needs its .eeg and .vmrk, and an EEGLAB .set its .fdt, in the same folder with the same name; the pipeline stages every file that shares the recording's name.
- **recordings** — Text tables need sr set to their sampling rate.
