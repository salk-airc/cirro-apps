#!/usr/bin/env bash
# Browser-playable preview of a video: H.264, yuv420p, at most 1280 px wide, no audio,
# moov atom first so it streams. Prints "<fps> <preview width>" for export_poses.py.
set -euo pipefail
in="$1"
out="$2"
fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$in" \
  | python3 -c "import sys; from fractions import Fraction as F; t=sys.stdin.read().strip(); print(float(F(t)) if t and t != '0/0' else 0)")
ffmpeg -v error -y -i "$in" -vf "scale='min(1280,iw)':-2" -c:v libx264 -preset veryfast -crf 23 \
  -pix_fmt yuv420p -movflags +faststart -an "$out"
width=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$out")
echo "$fps $width"
