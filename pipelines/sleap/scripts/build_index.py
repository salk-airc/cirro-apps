#!/usr/bin/env python3
"""Write index.json for the viewer: the run's title and settings, and one entry per
videos/<name>/ folder that export_poses.py filled."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("videos_dir", type=Path)
    ap.add_argument("--title", default="SLEAP pose tracking")
    ap.add_argument("--model", action="append", default=[], help="model folder name, repeatable")
    ap.add_argument("--run", action="append", default=[], help="key=value shown in the header")
    args = ap.parse_args()

    videos = []
    for meta_path in sorted(args.videos_dir.glob("*/meta.json")):
        meta = json.loads(meta_path.read_text())
        videos.append({"name": meta["name"], "dir": meta_path.parent.as_posix()})
    if not videos:
        raise SystemExit("No exported videos found.")
    Path("index.json").write_text(json.dumps({
        "title": args.title,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run": dict(item.split("=", 1) for item in args.run),
        "models": args.model,
        "videos": videos,
    }, indent=1))
    print(f"{len(videos)} videos")


if __name__ == "__main__":
    main()
