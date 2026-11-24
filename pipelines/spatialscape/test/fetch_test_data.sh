#!/usr/bin/env bash
# Download the small per-cell files of 4 public 10x Xenium mouse brain sections (TgCRND8 Alzheimer's model
# vs wildtype, FFPE) into test/data/, ~190 MB. The multi-GB morphology images are skipped.
set -euo pipefail
cd "$(dirname "$0")"
B=https://cf.10xgenomics.com/samples/xenium/1.4.0
for s in Xenium_V1_FFPE_TgCRND8_2_5_months Xenium_V1_FFPE_wildtype_2_5_months \
         Xenium_V1_FFPE_TgCRND8_17_9_months Xenium_V1_FFPE_wildtype_13_4_months; do
  mkdir -p "data/$s"
  for f in cell_feature_matrix.h5 cells.parquet cell_boundaries.parquet analysis.tar.gz; do
    [ -s "data/$s/$f" ] || curl -fsSL -o "data/$s/$f" "$B/$s/${s}_$f"
  done
  [ -d "data/$s/analysis" ] || tar xzf "data/$s/analysis.tar.gz" -C "data/$s"
done
echo "ready: run from pipelines/spatialscape with --samplesheet test/samplesheet.csv"
