#!/usr/bin/env python3
"""Write a spatialscape dataset.yaml for the sections converted by xenium_to_h5ad.py.

    make_dataset_yaml.py --id ID --name NAME [--description TEXT] [--default-gene GENE] samples.tsv > dataset.yaml

samples.tsv has a header row: sample, h5ad, polygons, condition, age (condition/age may be empty).
"""
import argparse
import csv
import re
import sys

import yaml


def slug(s):
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", s).strip("_") or "sample"


def build(rows, dataset_id, name, description=None, default_gene=None):
    meta_cols = [c for c in ("condition", "age") if any((r.get(c) or "").strip() for r in rows)]
    doc = {
        "id": slug(dataset_id),
        "name": name,
        "default_color": {"gene": default_gene} if default_gene else {"field": "domain"},
        "layout": {"mode": "grid"},
        "fields": [
            {"id": "domain", "name": "Xenium cluster", "type": "categorical"},
            {"id": "total_counts", "name": "Transcripts per cell", "type": "continuous"},
            {"id": "cell_area", "name": "Cell area (µm²)", "type": "continuous"},
        ],
        "samples": [],
    }
    if description:
        doc["description"] = description
    if meta_cols:
        doc["meta"] = [{"id": c, "name": {"condition": "Condition", "age": "Age"}[c]} for c in meta_cols]
    for r in rows:
        s = {
            "path": r["h5ad"],
            "platform": "xenium",
            "id": slug(r["sample"]),
            "name": r["sample"],
            "fields": {"domain": "cluster", "total_counts": "transcript_counts", "cell_area": "cell_area"},
        }
        if (r.get("polygons") or "").strip():
            s["polygons"] = {"path": r["polygons"], "id_column": "cell_id", "x_column": "vertex_x", "y_column": "vertex_y"}
        if meta_cols:
            s["meta"] = {c: {"column": c} for c in meta_cols}
        doc["samples"].append(s)
    return doc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("samples")
    ap.add_argument("--id", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--description")
    ap.add_argument("--default-gene")
    a = ap.parse_args()
    with open(a.samples) as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    if not rows:
        sys.exit("no samples")
    yaml.safe_dump(build(rows, a.id, a.name, a.description, a.default_gene), sys.stdout, sort_keys=False, allow_unicode=True)


if __name__ == "__main__":
    main()
