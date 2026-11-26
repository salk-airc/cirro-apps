"""Build the viewer's files from DDALAB result documents (ddalab.result/2).

    python3 report.py results/*.dda.json --title "DDA results"

Writes, in the working directory:
  index.json             the run: title, DDA settings, and per recording its files and variants
  view/<stem>.json       per recording, each variant's matrix (rows x windows) for the heatmap,
                         averaged into at most MAX_COLUMNS column bins so the page stays small
  tables/<stem>.<V>.csv  per recording and variant, every window: time_s, then one column per row
"""
import csv
import json
import math
import sys
from pathlib import Path

MAX_COLUMNS = 2000


def bin_means(values, n):
    """Average consecutive values into n bins (None and NaN skipped)."""
    if len(values) <= n:
        return values
    out = []
    for i in range(n):
        chunk = [v for v in values[i * len(values) // n:(i + 1) * len(values) // n] if v is not None and not math.isnan(v)]
        out.append(sum(chunk) / len(chunk) if chunk else None)
    return out


def finite(v):
    return v if v is not None and math.isfinite(v) else None


def main(paths, title):
    Path('view').mkdir(exist_ok=True)
    Path('tables').mkdir(exist_ok=True)
    recordings, settings, version = [], {}, ''
    for path in sorted(paths, key=lambda p: Path(p).name.lower()):
        doc = json.loads(Path(path).read_text())
        stem = Path(path).name.removesuffix('.dda.json')
        rep = doc.get('reproduction', {})
        version = rep.get('ddalab_version', version)
        settings = settings or {
            'Window length (samples)': rep.get('window_length_samples'),
            'Window step (samples)': rep.get('window_step_samples'),
            'Delays (samples)': ' '.join(map(str, rep.get('delays', []))),
            'Model terms': ' '.join(map(str, rep.get('model_terms', []))),
            'Model dimension': rep.get('model_dimension'),
            'Polynomial order': rep.get('polynomial_order'),
        }
        t = doc['window_centers_seconds']
        n = min(len(t), MAX_COLUMNS)
        variants, view = [], []
        for v in doc['variants']:
            table = f"tables/{stem}.{v['id']}.csv"
            with open(table, 'w', newline='') as f:
                w = csv.writer(f)
                w.writerow(['time_s', *v['row_labels']])
                w.writerows([t[j], *(row[j] for row in v['matrix'])] for j in range(len(t)))
            view.append({
                'id': v['id'], 'label': v['label'], 'rows': v['row_labels'],
                'min': finite(v.get('min_value')), 'max': finite(v.get('max_value')),
                'meanAbs': [finite(x) for x in v.get('row_mean_absolute', [])],
                'peakAbs': [finite(x) for x in v.get('row_peak_absolute', [])],
                'matrix': [[finite(x) for x in bin_means(row, n)] for row in v['matrix']],
            })
            variants.append({'id': v['id'], 'label': v['label'], 'rows': len(v['row_labels']), 'csv': table})
        Path(f'view/{stem}.json').write_text(json.dumps({'t': bin_means(t, n), 'variants': view}, separators=(',', ':')))
        recordings.append({
            'name': doc.get('file_name', stem), 'stem': stem,
            'result': f'results/{Path(path).name}', 'view': f'view/{stem}.json',
            'start': rep.get('start_time_seconds'), 'end': rep.get('end_time_seconds'),
            'windows': len(t), 'binned': len(t) > MAX_COLUMNS,
            'channels': rep.get('selected_channel_names', []),
            'variants': variants, 'diagnostics': doc.get('diagnostics', []),
        })
    Path('index.json').write_text(json.dumps(
        {'title': title, 'ddalab': version, 'settings': settings, 'recordings': recordings}, indent=1))


if __name__ == '__main__':
    args = sys.argv[1:]
    i = args.index('--title')
    main(args[:i] + args[i + 2:], args[i + 1])
