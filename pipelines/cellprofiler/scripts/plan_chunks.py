#!/usr/bin/env python3
"""Count a CellProfiler pipeline's image sets for a file list and plan chunks.

Uses CellProfiler's own matching (Images / Metadata / NamesAndTypes / Groups), so a chunk
never splits the channels of one image set. Pipelines with grouping enabled run as one
chunk per group, because grouped modules (illumination correction, tracking) need the
whole group in one run.

Matching uses file names only, so the files may be empty placeholders: planning never
needs the image data. Writes chunks/<first>-<last>.txt (1-based image set numbers,
inclusive, zero-padded) listing the file names each chunk needs, and summary.json.
"""
import argparse
import json
import os
import sys
from urllib.parse import unquote, urlparse

import cellprofiler_core.preferences as prefs

prefs.set_headless()
prefs.set_awt_headless(True)

from cellprofiler_core.measurement import Measurements  # noqa: E402
from cellprofiler_core.pipeline import Pipeline  # noqa: E402
from cellprofiler_core.utilities.java import start_java, stop_java  # noqa: E402
from cellprofiler_core.workspace import Workspace  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pipeline")
    ap.add_argument("file_list")
    ap.add_argument("--chunk-size", type=int, default=50)
    args = ap.parse_args()

    start_java()
    try:
        pipeline = Pipeline()
        pipeline.load(args.pipeline)
        enabled = [m.module_name for m in pipeline.modules() if m.enabled]
        if "LoadData" in enabled:
            sys.exit("This pipeline loads images with LoadData (a CSV of paths). Use the Images, "
                     "Metadata and NamesAndTypes modules instead so it can run on the picked folders.")
        if "ExportToSpreadsheet" not in enabled:
            sys.exit("The pipeline has no enabled ExportToSpreadsheet module, so it would produce no "
                     "measurements here. Add ExportToSpreadsheet (default settings are fine).")
        with open(args.file_list) as handle:
            urls = [line.strip() for line in handle if line.strip()]
        pipeline.add_urls(urls)
        measurements = Measurements()
        workspace = Workspace(pipeline, None, None, None, measurements, None)
        if not pipeline.prepare_run(workspace):
            sys.exit("CellProfiler could not match any image sets. Check that the pipeline's "
                     "NamesAndTypes rules fit the file names.")
        n_sets = measurements.image_set_count
        groups = pipeline.get_groupings(workspace)
        grouping_keys, grouping_list = groups if groups else ((), [])
        url_features = [f for f in measurements.get_feature_names("Image")
                        if f.startswith(("URL_", "ObjectsURL_"))]

        def files_for(first, last):
            names = set()
            for number in range(first, last + 1):
                for feature in url_features:
                    url = measurements.get_measurement("Image", feature, number)
                    if url:
                        names.add(os.path.basename(unquote(urlparse(url).path)))
            return sorted(names)

        chunks = []
        if grouping_keys:
            # One chunk per group: grouped modules need the whole group in one run.
            for _, numbers in grouping_list:
                chunks.append((min(numbers), max(numbers)))
        else:
            for first in range(1, n_sets + 1, args.chunk_size):
                chunks.append((first, min(first + args.chunk_size - 1, n_sets)))
        os.makedirs("chunks")
        for first, last in chunks:
            with open(f"chunks/{first:06d}-{last:06d}.txt", "w") as out:
                out.write("\n".join(files_for(first, last)) + "\n")
    finally:
        stop_java()

    summary = {"image_sets": n_sets, "files": len(urls), "chunks": len(chunks),
               "grouped_by": list(grouping_keys)}
    json.dump(summary, open("summary.json", "w"), indent=1)
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
