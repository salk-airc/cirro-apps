#!/usr/bin/env python3
"""Collect ColabFold outputs into the viewer's layout.

Reads predictions/ (colabfold_batch output) and jobs.tsv, writes:
  results.json                     summary the viewer loads
  jobs/<job>/rank_<n>.pdb          structures
  jobs/<job>/rank_<n>_scores.json  ColabFold scores (plddt, pae, max_pae, ptm, iptm)
"""
import argparse
import csv
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

PATTERN = re.compile(r"^(?P<job>.+)_(?P<kind>scores|unrelaxed|relaxed)_rank_(?P<rank>\d+)_(?P<model>.+?)\.(?P<ext>json|pdb)$")


def chains_from_pdb(pdb: Path):
    lengths: dict[str, int] = {}
    for line in pdb.read_text().splitlines():
        if line.startswith("ATOM") and line[12:16].strip() == "CA":
            chain = line[21].strip() or "A"
            lengths[chain] = lengths.get(chain, 0) + 1
    return [{"id": k, "length": v} for k, v in lengths.items()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("predictions", type=Path)
    ap.add_argument("jobs_tsv", type=Path)
    ap.add_argument("--title", default="Structure predictions")
    ap.add_argument("--run", action="append", default=[], help="key=value shown under Run details")
    args = ap.parse_args()

    files: dict[str, dict[int, dict]] = {}
    for path in args.predictions.iterdir():
        m = PATTERN.match(path.name)
        if not m:
            continue
        entry = files.setdefault(m["job"], {}).setdefault(int(m["rank"]), {"model": m["model"]})
        if m["kind"] == "scores":
            entry["scores"] = path
        elif m["kind"] == "relaxed" or "pdb" not in entry:
            entry["pdb"] = path  # prefer relaxed when present

    jobs, failed = [], []
    with open(args.jobs_tsv) as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            job, name = row["job"], row["name"]
            ranks = files.get(job, {})
            models = []
            for rank in sorted(ranks):
                entry = ranks[rank]
                if "scores" not in entry or "pdb" not in entry:
                    continue
                scores = json.loads(entry["scores"].read_text())
                dest = Path("jobs") / job
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy(entry["pdb"], dest / f"rank_{rank}.pdb")
                shutil.copy(entry["scores"], dest / f"rank_{rank}_scores.json")
                plddt = scores.get("plddt") or [0]
                pae = scores.get("pae") or [[0]]
                models.append({
                    "rank": rank,
                    "modelId": entry["model"].replace("_seed_000", "").removesuffix(".pdb"),
                    "meanPlddt": sum(plddt) / len(plddt),
                    "ptm": scores.get("ptm", 0.0),
                    "iptm": scores.get("iptm"),
                    "maxPae": scores.get("max_pae", max(max(r) for r in pae)),
                    "structure": f"jobs/{job}/rank_{rank}.pdb",
                    "scores": f"jobs/{job}/rank_{rank}_scores.json",
                })
            if not models:
                failed.append({"id": job, "name": name, "reason": "ColabFold produced no model; see the run log."})
                continue
            chains = chains_from_pdb(Path("jobs") / job / "rank_1.pdb") if (Path("jobs") / job / "rank_1.pdb").exists() else []
            jobs.append({
                "id": job,
                "name": name,
                "kind": "complex" if len(chains) > 1 else "monomer",
                "chains": chains,
                "models": models,
            })

    log = args.predictions / "log.txt"
    if log.exists():
        shutil.copy(log, "log.txt")
        for job in jobs:
            job["log"] = "log.txt"

    run = dict(item.split("=", 1) for item in args.run)
    Path("results.json").write_text(json.dumps({
        "title": args.title,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run": run,
        "jobs": jobs,
        "failed": failed,
    }, indent=1))
    print(f"{len(jobs)} predictions, {len(failed)} failed")


if __name__ == "__main__":
    main()
