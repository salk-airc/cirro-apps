#!/usr/bin/env bash
# Download sleap-nn's own test assets (github.com/talmolab/sleap-nn, tests/assets): two short
# videos and the minimal top-down checkpoints. The checkpoints are barely trained, so the poses
# are rough; they exercise the pipeline, not the science. Run from pipelines/sleap/.
set -euo pipefail
base=https://raw.githubusercontent.com/talmolab/sleap-nn/main/tests/assets
mkdir -p test/data/models
curl -sfL -o test/data/centered_pair_small.mp4 "$base/datasets/centered_pair_small.mp4"
curl -sfL -o test/data/small_robot.mp4 "$base/datasets/small_robot.mp4"
for m in minimal_instance_centroid minimal_instance_centered_instance; do
  mkdir -p "test/data/models/$m"
  for f in best.ckpt training_config.yaml initial_config.yaml; do
    curl -sfL -o "test/data/models/$m/$f" "$base/model_ckpts/$m/$f"
  done
done
echo "Run: nextflow run main.nf -profile docker --gpu false --videos test/data/centered_pair_small.mp4 \\"
echo "       --models test/data/models/minimal_instance_centroid,test/data/models/minimal_instance_centered_instance \\"
echo "       --max_instances 2 --outdir test-out"
