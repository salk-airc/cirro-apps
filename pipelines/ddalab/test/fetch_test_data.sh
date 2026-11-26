#!/bin/sh
# Public test recordings into test/data/ (git-ignored):
# - EDF: PhysioNet EEG Motor Movement/Imagery, subject 1 run 1 (64 channels, 160 Hz, 1 min; ODC-By)
# - BrainVision: MNE's test file (.vhdr + .eeg + .vmrk, 32 channels; BSD-3), to check the sidecars stage
set -eu
cd "$(dirname "$0")" && mkdir -p data && cd data
curl -fsSLO https://physionet.org/files/eegmmidb/1.0.0/S001/S001R01.edf
for f in test.vhdr test.eeg test.vmrk; do
  curl -fsSLO "https://raw.githubusercontent.com/mne-tools/mne-python/v1.8.0/mne/io/brainvision/tests/data/$f"
done
ls -l
