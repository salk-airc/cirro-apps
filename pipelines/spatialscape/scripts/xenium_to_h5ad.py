#!/usr/bin/env python3
"""Turn a Xenium output folder (cell_feature_matrix.h5 + cells.parquet + analysis/) into an AnnData .h5ad
that spatialscape can build from. Gene expression only (control probes dropped), coordinates in microns,
graph-based clusters from Xenium Onboard Analysis as the cell annotation.

    python xenium_to_h5ad.py <xenium_dir> <out.h5ad> [--condition X] [--age Y]
"""
import argparse
from pathlib import Path

import anndata as ad
import h5py
import numpy as np
import pandas as pd
import scipy.sparse as sp


def read_10x_h5(path):
    with h5py.File(path, "r") as f:
        m = f["matrix"]
        X = sp.csc_matrix((m["data"][:], m["indices"][:], m["indptr"][:]), shape=tuple(m["shape"][:])).T.tocsr()
        barcodes = [b.decode() for b in m["barcodes"][:]]
        feat = m["features"]
        var = pd.DataFrame({
            "gene_ids": [x.decode() for x in feat["id"][:]],
            "feature_type": [x.decode() for x in feat["feature_type"][:]],
        }, index=[x.decode() for x in feat["name"][:]])
    return X, barcodes, var


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xenium_dir", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--condition")
    ap.add_argument("--age")
    a = ap.parse_args()
    d = a.xenium_dir

    X, barcodes, var = read_10x_h5(d / "cell_feature_matrix.h5")
    keep = (var["feature_type"] == "Gene Expression").to_numpy()
    X, var = X[:, keep], var[keep]
    var.index = var.index.astype(str)
    var = var[~var.index.duplicated()] if var.index.duplicated().any() else var

    cells = pd.read_parquet(d / "cells.parquet")
    cells["cell_id"] = cells["cell_id"].map(lambda v: v.decode() if isinstance(v, bytes) else str(v))
    cells = cells.set_index("cell_id").reindex(barcodes)

    obs = pd.DataFrame(index=pd.Index(barcodes, name="cell_id"))
    for col in ("transcript_counts", "total_counts", "cell_area", "nucleus_area"):
        if col in cells:
            obs[col] = cells[col].to_numpy()

    clust = d / "analysis/clustering/gene_expression_graphclust/clusters.csv"
    if clust.exists():
        c = pd.read_csv(clust).set_index("Barcode")["Cluster"]
        obs["cluster"] = pd.Categorical(c.reindex(barcodes).fillna(-1).astype(int).map(lambda v: f"C{v:02d}"))
    if a.condition:
        obs["condition"] = pd.Categorical([a.condition] * len(obs))
    if a.age:
        obs["age"] = pd.Categorical([a.age] * len(obs))

    adata = ad.AnnData(X=X.astype(np.float32), obs=obs, var=var)
    adata.obsm["spatial"] = cells[["x_centroid", "y_centroid"]].to_numpy(dtype=np.float64)

    umap = d / "analysis/umap/gene_expression_2_components/projection.csv"
    if umap.exists():
        u = pd.read_csv(umap).set_index("Barcode").reindex(barcodes)
        adata.obsm["X_umap"] = u.to_numpy(dtype=np.float32)

    a.out.parent.mkdir(parents=True, exist_ok=True)
    adata.write_h5ad(a.out, compression="gzip")
    print(f"{a.out}: {adata.n_obs:,} cells x {adata.n_vars} genes, "
          f"{obs['cluster'].nunique() if 'cluster' in obs else 0} clusters")


if __name__ == "__main__":
    main()
