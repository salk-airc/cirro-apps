#!/usr/bin/env python3
"""Merge CellProfiler chunk outputs and summarize them for the viewer.

Each chunk folder is named out_<first>-<last> (the image set numbers it covered). A chunk
ran on its own files, so CellProfiler numbered its image sets from 1; ImageNumber columns
are shifted back to the run-wide numbers here.

Writes:
  tables/<same path as CellProfiler wrote>.csv   merged spreadsheets
  outputs/<file>                                 images the pipeline saved (overlays, masks)
  thumbs/<file>.png                              small PNG previews of those images
  data.json                                      what the viewer loads
"""
import argparse
import csv
import json
import math
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

csv.field_size_limit(1 << 30)
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
BINS = 30
MAX_THUMBS = 2000
SKIP_STATS = re.compile(r"^(ImageNumber|ObjectNumber|Number_Object_Number)$|^ImageNumber_|_ImageNumber$|^ExecutionTime_|^ModuleError_")


def chunk_offset(folder: Path) -> int:
    match = re.match(r"out_(\d+)-(\d+)$", folder.name)
    if not match:
        raise SystemExit(f"Unexpected chunk folder name: {folder.name}")
    return int(match.group(1)) - 1


def is_image_number(column: str) -> bool:
    return column == "ImageNumber" or column.startswith("ImageNumber_") or column.endswith("_ImageNumber")


def merge_tables(chunks: list[Path]) -> dict[str, Path]:
    by_path: dict[str, list[tuple[Path, int]]] = {}
    for folder in chunks:
        offset = chunk_offset(folder)
        for path in sorted(folder.rglob("*.csv")):
            by_path.setdefault(str(path.relative_to(folder)), []).append((path, offset))

    merged = {}
    for rel, parts in sorted(by_path.items()):
        out = Path("tables") / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if Path(rel).name == "Experiment.csv":  # run-level settings: identical per chunk
            shutil.copy(parts[0][0], out)
            merged[rel] = out
            continue
        header: list[str] = []
        for path, _ in parts:
            with open(path, newline="") as handle:
                for column in next(csv.reader(handle), []):
                    if column not in header:
                        header.append(column)
        with open(out, "w", newline="") as target:
            writer = csv.DictWriter(target, fieldnames=header, restval="")
            writer.writeheader()
            for path, offset in parts:
                with open(path, newline="") as handle:
                    for row in csv.DictReader(handle):
                        if offset:
                            for column in row:
                                if is_image_number(column) and row[column]:
                                    try:
                                        row[column] = str(int(float(row[column])) + offset)
                                    except ValueError:
                                        pass
                        writer.writerow(row)
        merged[rel] = out
    return merged


def number(text: str):
    try:
        value = float(text)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def column_stats(path: Path) -> tuple[int, list[dict]]:
    """Two passes: range and totals, then a histogram per numeric column."""
    with open(path, newline="") as handle:
        reader = csv.DictReader(handle)
        columns = [c for c in (reader.fieldnames or []) if not SKIP_STATS.search(c)]
        acc = {c: {"n": 0, "bad": 0, "min": math.inf, "max": -math.inf, "sum": 0.0} for c in columns}
        rows = 0
        for row in reader:
            rows += 1
            for column in columns:
                text = row.get(column, "")
                if text in ("", "nan", "NaN"):
                    continue
                value = number(text)
                a = acc[column]
                if value is None:
                    a["bad"] += 1
                    continue
                a["n"] += 1
                a["sum"] += value
                a["min"] = min(a["min"], value)
                a["max"] = max(a["max"], value)
    numeric = [c for c in columns if acc[c]["n"] > 0 and acc[c]["bad"] == 0]
    bins = {c: [0] * BINS for c in numeric}
    with open(path, newline="") as handle:
        for row in csv.DictReader(handle):
            for column in numeric:
                value = number(row.get(column, ""))
                if value is None:
                    continue
                a = acc[column]
                span = a["max"] - a["min"]
                index = 0 if span == 0 else min(BINS - 1, int((value - a["min"]) / span * BINS))
                bins[column][index] += 1
    stats = []
    for column in numeric:
        a = acc[column]
        stats.append({
            "name": column,
            "n": a["n"],
            "min": a["min"],
            "max": a["max"],
            "mean": a["sum"] / a["n"],
            "bins": bins[column],
        })
    return rows, stats


def image_rows(image_csv: Path) -> list[dict]:
    rows = []
    with open(image_csv, newline="") as handle:
        for row in csv.DictReader(handle):
            files = {k[len("FileName_"):]: v for k, v in row.items() if k.startswith("FileName_") and v}
            rows.append({
                "number": int(float(row["ImageNumber"])),
                "metadata": {k[len("Metadata_"):]: v for k, v in row.items()
                             if k.startswith("Metadata_") and k not in ("Metadata_Frame", "Metadata_Series") and v},
                "files": files,
                "counts": {k[len("Count_"):]: number(v) for k, v in row.items() if k.startswith("Count_")},
                "thumbs": [],
            })
    return sorted(rows, key=lambda r: r["number"])


def preview(picture):
    """8-bit image for a thumbnail. 16-bit and float images are stretched to their
    1st-99th percentile, or a microscope image would look black."""
    import numpy as np
    from PIL import Image

    if picture.mode in ("RGB", "L"):
        return picture
    if picture.mode in ("RGBA", "P", "LA", "1", "CMYK"):
        return picture.convert("RGB")
    data = np.asarray(picture, dtype=np.float64)
    low, high = np.percentile(data, (1, 99))
    scaled = np.clip((data - low) / (high - low or 1) * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(scaled, mode="L")


def collect_images(chunks: list[Path], images: list[dict]) -> list[dict]:
    from PIL import Image

    Path("outputs").mkdir(exist_ok=True)
    Path("thumbs").mkdir(exist_ok=True)
    stems = [(img, [Path(f).stem for f in img["files"].values()]) for img in images]
    saved = []
    for folder in chunks:
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXT:
                continue
            rel = path.relative_to(folder)
            target = Path("outputs") / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(path, target)
            entry = {"file": str(target), "thumb": None}
            if len(saved) < MAX_THUMBS:
                try:
                    with Image.open(path) as picture:
                        picture.seek(0)
                        picture = preview(picture)
                        picture.thumbnail((640, 640))
                        thumb = Path("thumbs") / (rel.with_suffix("").as_posix().replace("/", "__") + ".png")
                        picture.save(thumb)
                        entry["thumb"] = str(thumb)
                except Exception as error:  # an unreadable file still gets copied
                    entry["error"] = str(error)[:200]
            name = path.stem
            for img, file_stems in stems:
                if any(stem and stem in name for stem in file_stems):
                    img["thumbs"].append(entry["thumb"] or entry["file"])
                    entry["image"] = img["number"]
                    break
            saved.append(entry)
    return saved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chunks", nargs="+", type=Path)
    ap.add_argument("--title", default="CellProfiler results")
    ap.add_argument("--pipeline-name", default="")
    ap.add_argument("--run", action="append", default=[], help="key=value shown under Run details")
    args = ap.parse_args()

    chunks = sorted(args.chunks, key=chunk_offset)
    merged = merge_tables(chunks)
    image_csv = next((p for rel, p in merged.items() if Path(rel).name == "Image.csv"), None)
    images = image_rows(image_csv) if image_csv else []
    saved = collect_images(chunks, images)

    tables = []
    for rel, path in merged.items():
        if Path(rel).name == "Experiment.csv":
            continue
        rows, stats = column_stats(path)
        tables.append({"name": Path(rel).stem, "file": str(path), "rows": rows, "columns": stats})
    tables.sort(key=lambda t: (t["name"] != "Image", t["name"]))

    Path("data.json").write_text(json.dumps({
        "title": args.title,
        "pipeline": args.pipeline_name,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run": dict(item.split("=", 1) for item in args.run),
        "imageSets": len(images),
        "chunks": len(chunks),
        "tables": tables,
        "images": images,
        "saved": saved,
        "experiment": next((str(p) for rel, p in merged.items() if Path(rel).name == "Experiment.csv"), None),
    }, separators=(",", ":")))
    print(f"{len(images)} image sets, {len(tables)} tables, {len(saved)} saved images")


if __name__ == "__main__":
    main()
