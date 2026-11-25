---
workflow:
  name: Track Animal Poses (SLEAP)
  repository: salk-airc/cirro-apps
  entrypoint: pipelines/sleap/main.nf
  version: main
  executor: NEXTFLOW
  executor_version: null
inputs:
  - name: videos
    description: Video file(s) to track (.mp4, .avi, .mov, ...). Each is predicted on its own and gets its own page in the viewer.
    type: file
    required: true
    multiple: true
    pattern: '\.(mp4|avi|mov|mkv|mpg|mpeg|m4v|wmv|webm|MP4|AVI|MOV|MKV)$'
  - name: models
    description: Trained SLEAP model folder(s), each holding best.ckpt and training_config.yaml. One folder for single-instance or bottom-up models; two (centroid and centered instance) for top-down.
    type: folder
    group: model
    required: true
    multiple: true
parameters:
  - name: tracking
    type: boolean
    group: model
    required: true
    default: true
    description: Link poses across frames into tracks (identities). Off for single-animal videos.
  - name: max_instances
    type: integer
    group: model
    required: true
    default: 0
    description: Most animals per frame; 0 means no limit. Set it to the number of animals in the arena for cleaner tracks.
  - name: title
    type: string
    group: model
    required: true
    default: SLEAP pose tracking
    description: Title shown at the top of the viewer
  - name: gpu
    type: boolean
    group: advanced
    required: true
    default: true
    description: Run inference on a GPU (needs the project's GPU limit above 0). Off runs on CPU, much slower for long videos.
  - name: tracker
    type: string
    group: advanced
    required: true
    default: classic
    choices: [classic, sort, bytetrack, botsort, ocsort]
    description: Tracking algorithm (sleap-nn --tracker)
  - name: batch_size
    type: integer
    group: advanced
    required: true
    default: 4
    description: Frames per inference batch
  - name: sleap_nn_version
    type: string
    group: advanced
    required: true
    default: 0.3.5
    description: sleap-nn release installed at run time
outputs:
  - path: index.html
    description: Viewer. Open with Visualize → Web Viewer.
    required: true
  - path: index.json
    description: Videos in this run and the settings used
    required: true
  - path: videos/
    description: Per video, the SLEAP predictions (.slp), analysis HDF5, CSV, a browser preview and the viewer's pose file
    required: true
constraints:
  - applies_to: models
    description: Folders written by sleap-nn train (best.ckpt + training_config.yaml), or SLEAP 1.x model folders (best_model.h5 + training_config.json), which sleap-nn also reads. A top-down model needs both its centroid and centered-instance folders.
    verify: |-
      ls "$MODEL"/best.ckpt "$MODEL"/training_config.yaml 2>/dev/null || ls "$MODEL"/best_model.h5 "$MODEL"/training_config.json
  - applies_to: compute
    description: With gpu on, PREDICT uses Cirro's GPU queue; the project's "Maximum vCPUs for GPU-enabled instances" must be above 0 (the first raise can take AWS 1-2 business days).
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

# Track Animal Poses (SLEAP)

Runs a lab's trained [SLEAP](https://sleap.ai) model on videos with sleap-nn (the PyTorch engine
behind SLEAP, talmolab/sleap-nn), tracks identities, and opens a viewer that plays each video
with the skeletons drawn on it, a track timeline, and downloads (.slp, analysis HDF5, CSV).

Workflow: `pipelines/sleap/` in github.com/salk-airc/cirro-apps. PREDICT per video (GPU or CPU)
→ EXPORT per video (preview video + pose file + HDF5/CSV) → REPORT (index + viewer).

Tested locally 2026-11-25 (Nextflow, Docker, CPU) on sleap-nn's test videos and test checkpoints
(centered_pair_small.mp4 with the minimal top-down models; small_robot.mp4).

Judgment calls:
- Videos are the primary input (no group); models are picked folders.
- Training is not part of this pipeline: labs train in SLEAP (or with Talmo's lab) and bring the model.
- GPU is a parameter, defaulting on, so a project without a GPU queue can still run short videos on CPU.
