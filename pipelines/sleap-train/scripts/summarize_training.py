#!/usr/bin/env python3
"""Summarize trained sleap-nn model folders for the viewer.

Per models/<part>/:
  training_log.csv     loss curves (sleap-nn 0.3.x writes train/loss and val/loss; older
                       versions train_loss and val_loss; both are read)
  training_config.yaml skeleton node names
  metrics.val.0.json   sleap-nn's evaluation on the validation frames: pixel error
                       percentiles, mOKS, OKS mAP, PCK per body part, visible-point recall
Writes summary.json.
"""
import argparse
import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import yaml


def number(text):
    try:
        value = float(text)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def curve(log: Path):
    epochs = {}
    with open(log, newline="") as handle:
        for row in csv.DictReader(handle):
            epoch = number(row.get("epoch"))
            if epoch is None:
                continue
            entry = epochs.setdefault(int(epoch), {"epoch": int(epoch), "train": None, "val": None})
            for key, columns in (("train", ("train/loss", "train_loss")), ("val", ("val/loss", "val_loss"))):
                for column in columns:
                    value = number(row.get(column))
                    if value is not None:
                        entry[key] = value
    return [epochs[e] for e in sorted(epochs)]


def nodes_from(config: Path):
    if not config.exists():
        return []
    data = yaml.safe_load(config.read_text()) or {}
    skeletons = (data.get("data_config") or {}).get("skeletons") or []
    if isinstance(skeletons, dict):  # some versions key skeletons by name
        skeletons = list(skeletons.values())
    for skeleton in skeletons:
        nodes = (skeleton or {}).get("nodes") or []
        names = [n.get("name") if isinstance(n, dict) else str(n) for n in nodes]
        if names:
            return [n for n in names if n]
    return []


def evaluation(path: Path, nodes):
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    dist = data.get("distance_metrics", {})
    pck = data.get("pck_metrics", {})
    voc = data.get("voc_metrics", {})
    # sleap-nn 0.3.x writes flat keys ("oks_voc.mAP"); allow a nested layout too
    oks = voc.get("oks_voc") or {k.split(".", 1)[1]: v for k, v in voc.items() if k.startswith("oks_voc.")}
    vis = data.get("visibility_metrics", {})
    parts = pck.get("mPCK_parts") or []
    return {
        "frames": len(dist.get("frame_idxs") or []),
        "errorMedian": number(dist.get("p50")),
        "errorP90": number(dist.get("p90")),
        "errorMean": number(dist.get("avg")),
        "mOKS": number((data.get("mOKS") or {}).get("mOKS")),
        "oksMAP": number(oks.get("mAP")),
        "mPCK": number(pck.get("mPCK")),
        "visibleRecall": number(vis.get("recall")),
        "pckParts": [
            {"name": nodes[i] if i < len(nodes) else f"part {i + 1}", "pck": number(v)}
            for i, v in enumerate(parts)
        ],
        "pckThresholds": pck.get("thresholds") or [],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("models", type=Path)
    ap.add_argument("--title", default="SLEAP model training")
    ap.add_argument("--model-type", default="")
    ap.add_argument("--run", action="append", default=[])
    args = ap.parse_args()

    order = {"centroid": 0, "centered_instance": 1}
    parts = []
    for folder in sorted(args.models.iterdir(), key=lambda p: (order.get(p.name, 9), p.name)):
        if not folder.is_dir():
            continue
        points = curve(folder / "training_log.csv") if (folder / "training_log.csv").exists() else []
        vals = [(p["val"], p["epoch"]) for p in points if p["val"] is not None]
        best = min(vals) if vals else (None, None)
        nodes = nodes_from(folder / "training_config.yaml")
        parts.append({
            "name": folder.name,
            "dir": folder.as_posix(),
            "epochs": max((p["epoch"] for p in points), default=0),
            "bestValLoss": best[0],
            "bestEpoch": best[1],
            "curve": points,
            "nodes": nodes,
            "evaluation": evaluation(folder / "metrics.val.0.json", nodes),
            "files": sorted(f.name for f in folder.iterdir() if f.is_file()),
            "hasCheckpoint": (folder / "best.ckpt").exists(),
        })
    if not parts:
        raise SystemExit("No trained model folders found.")
    Path("summary.json").write_text(json.dumps({
        "title": args.title,
        "modelType": args.model_type,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run": dict(item.split("=", 1) for item in args.run),
        "parts": parts,
    }, indent=1))
    print(json.dumps([{k: p[k] for k in ("name", "epochs", "bestValLoss", "hasCheckpoint")} for p in parts]))


if __name__ == "__main__":
    main()
