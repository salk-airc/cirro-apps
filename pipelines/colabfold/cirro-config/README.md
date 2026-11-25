# Predict Protein Structure (ColabFold) main

Source: salk-airc/cirro-apps at `main`

## Inputs

- **input** — Protein FASTA file(s). Pick one or more files, or a folder of .fasta/.fa/.faa files.

## Requirements on your input data

- **input** — Protein sequences only (amino-acid letters). Nucleotide FASTA is rejected by the PREP step.
- **msa** — Sequences are sent to the public ColabFold MMseqs2 server (api.colabfold.com) unless msa_mode is single_sequence. The MSA task needs internet access.
- **compute** — PREDICT needs one GPU (process_gpu label → Cirro GPU queue). The project must allow GPU instances.
