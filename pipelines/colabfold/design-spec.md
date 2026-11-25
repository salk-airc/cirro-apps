---
workflow:
  name: Predict Protein Structure (ColabFold)
  repository: salk-airc/cirro-apps
  entrypoint: pipelines/colabfold/main.nf
  version: main
  executor: NEXTFLOW
  executor_version: null
inputs:
  - name: input
    description: Protein FASTA file(s). Pick one or more files.
    type: file
    required: true
    multiple: true
    pattern: '\.(fa|fasta|faa|fas|FA|FASTA|FAA|FAS)$'
parameters:
  - name: mode
    type: string
    group: prediction
    required: true
    default: monomer
    choices: [monomer, complex]
    description: "monomer: predict every sequence on its own. complex: each FASTA file is one complex, its sequences the chains."
  - name: num_models
    type: integer
    group: prediction
    required: true
    default: 5
    choices: [1, 5]
    description: AlphaFold2 models per prediction. 1 is a quick check; 5 ranks five models.
  - name: title
    type: string
    group: prediction
    required: true
    default: Structure predictions
    description: Title shown at the top of the results viewer
  - name: num_recycles
    type: integer
    group: advanced
    required: true
    default: 3
    description: Recycling iterations per model
  - name: msa_mode
    type: string
    group: advanced
    required: true
    default: mmseqs2_uniref_env
    choices: [mmseqs2_uniref_env, mmseqs2_uniref, single_sequence]
    description: MSA search. single_sequence sends nothing to the MSA server but gives much weaker predictions.
  - name: pair_mode
    type: string
    group: advanced
    required: true
    default: unpaired_paired
    choices: [unpaired_paired, paired, unpaired]
    description: How MSAs of different chains are paired for complexes
  - name: max_residues
    type: integer
    group: advanced
    required: true
    default: 2500
    description: Largest prediction allowed (total residues). Larger ones need more GPU memory.
  - name: colabfold_version
    type: string
    group: advanced
    required: true
    default: 1.6.2
    description: ColabFold release installed at run time
  - name: jax_version
    type: string
    group: advanced
    required: true
    default: 0.10.2
    description: JAX release installed with ColabFold
outputs:
  - path: index.html
    description: Results viewer. Open with Visualize → Web Viewer.
    required: true
  - path: results.json
    description: Summary of every prediction and model (pLDDT, pTM, ipTM, max PAE, file paths)
    required: true
  - path: jobs/
    description: Ranked structures (PDB) and ColabFold score files per prediction
    required: true
  - path: raw/
    description: Unmodified ColabFold outputs and MSAs (.a3m)
    required: true
constraints:
  - applies_to: input
    description: Protein sequences only (amino-acid letters). Nucleotide FASTA is rejected by the PREP step.
    verify: |-
      grep -v '^>' "$FASTA" | tr -d '\n' | grep -qiE '[^ACDEFGHIKLMNPQRSTVWYXBZUO*]' && echo "non-protein characters"
  - applies_to: msa
    description: Sequences are sent to the public ColabFold MMseqs2 server (api.colabfold.com) unless msa_mode is single_sequence. The MSA task needs internet access.
    verify: |-
      curl -s -o /dev/null -w '%{http_code}' https://api.colabfold.com/queue   # any HTTP code means reachable
  - applies_to: compute
    description: PREDICT needs one GPU (process_gpu label → Cirro GPU queue). The project must allow GPU instances.
    verify: |-
      echo "check the project's GPU limit in Cirro project settings"
cirro:
  process_id: null
  category: Protein Structure
  input_mode: browse
  managed_parameters:
    - name: outdir
      role: output_directory
      note: Set by Cirro at launch
---

# Predict Protein Structure (ColabFold)

AlphaFold2 structure prediction through ColabFold, with the result viewer from
Simon Dräger's Fold app (salk-airc/fold, MIT): structure colored by pLDDT, interactive PAE
matrix linked to the structure, ranked-model table, downloads.

Workflow: `pipelines/colabfold/` in github.com/salk-airc/cirro-apps.
PREP (FASTA → one query per prediction) → MSA (public MMseqs2 server, CPU) → PREDICT
(AlphaFold2, one GPU, no network) → REPORT (results.json + static viewer).
Container `python:3.12-bookworm` with ColabFold pip-installed at run time (the official ColabFold image lacks `ps`, which Nextflow on AWS Batch needs). Same ColabFold 1.6.2 / JAX 0.10.2 that Fold validated on Kaggle.

Judgment calls:
- The FASTA pick is the primary input (no group); a run is one batch of sequences.
- Complexes are one FASTA file per complex (mode=complex), or a single record with chains joined by `:` (ColabFold notation) in either mode.
- cirro-config/process-form.json was edited by hand after generation (file-path picker, titles, enumNames) and the GPU queue added to process-compute.config; regenerate with care.
- Model weights are downloaded each run (~5 GB, a few minutes). Store them as a Cirro reference or bake an image before wide use.
