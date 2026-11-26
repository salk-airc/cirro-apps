---
workflow:
  name: Train Pose Model (SLEAP)
  repository: salk-airc/cirro-apps
  entrypoint: pipelines/sleap-train/main.nf
  version: main
  executor: NEXTFLOW
  executor_version: null
inputs:
  - name: labels
    description: Your labeled frames as a SLEAP labels package (.pkg.slp). In SLEAP, File → Export Labels Package (include the images), so the file holds the frames it was labeled on.
    type: file
    required: true
    pattern: '\.slp$'
  - name: val_labels
    description: Optional separate validation labels (.pkg.slp). Leave empty to hold out 10% of the labeled frames.
    type: file
    group: model
    required: false
    pattern: '\.slp$'
parameters:
  - name: model_type
    type: string
    group: model
    required: true
    default: single_instance
    choices: [single_instance, topdown, bottomup]
    description: "single_instance: one animal per frame. topdown: several animals, trains a centroid and a centered-instance model (best when animals are well separated). bottomup: several animals in one model (better when animals touch or overlap)."
  - name: model_size
    type: string
    group: model
    required: true
    default: medium
    choices: [medium, large]
    description: Receptive field of sleap-nn's preset. Large sees more context; use it for large animals relative to the frame.
  - name: max_epochs
    type: integer
    group: model
    required: true
    default: 200
    description: Upper limit; training stops early when validation loss stops improving.
  - name: title
    type: string
    group: model
    required: true
    default: SLEAP model training
    description: Title shown at the top of the viewer
  - name: gpu
    type: boolean
    group: advanced
    required: true
    default: true
    description: Train on a GPU (needs the project's GPU limit above 0). Off trains on CPU, which takes hours for real datasets.
  - name: batch_size
    type: integer
    group: advanced
    required: true
    default: 4
    description: Frames per training batch
  - name: input_scale
    type: number
    group: advanced
    required: true
    default: 0
    description: Resize frames by this factor before training (e.g. 0.5 for large frames); 0 keeps the preset's scale.
  - name: sleap_nn_version
    type: string
    group: advanced
    required: true
    default: 0.3.5
    description: sleap-nn release installed at run time
outputs:
  - path: index.html
    description: Viewer (training curves, which folders to use). Open with Visualize → Web Viewer.
    required: true
  - path: models/
    description: One folder per trained part (best.ckpt, training_config.yaml, training_log.csv). Pick these in Track Animal Poses (SLEAP).
    required: true
  - path: summary.json
    description: Loss curves and best epochs per part
    required: true
constraints:
  - applies_to: labels
    description: Must contain its images (a .pkg.slp labels package). A plain .slp points at videos on the labeler's computer, which the run cannot reach.
    verify: |-
      python3 -c "import sleap_io as s,sys; l=s.load_slp(sys.argv[1]); print(len(l.labeled_frames), 'labeled frames')" "$LABELS"
  - applies_to: compute
    description: With gpu on, TRAIN uses Cirro's GPU queue; the project's GPU limit must be above 0.
    verify: |-
      echo "check the project's GPU limit in Cirro project settings"
cirro:
  process_id: null
  category: Behavior
  input_mode: browse
  managed_parameters:
    - name: outdir
      role: output_directory
      note: Set by Cirro at launch
---

# Train Pose Model (SLEAP)

Trains a SLEAP pose model with sleap-nn from a lab's labeled frames and publishes model folders that
Track Animal Poses (SLEAP) takes directly. Labeling stays in the SLEAP desktop app.

Workflow: `pipelines/sleap-train/` in github.com/salk-airc/cirro-apps. TRAIN per model part (top-down
trains centroid and centered instance in parallel) from sleap-nn v0.3.5's sample configs in `configs/`
→ REPORT (summary + viewer with loss curves).

Judgment calls:
- The labels package is the primary input (no group).
- Presets come from sleap-nn's own sample configs rather than exposing every setting; a custom config
  upload can come later if labs ask.
- Training is checked by `best.ckpt` existing; quality is the lab's call from the curves.
