#!/usr/bin/env bash
# Turns the captured frame folders into the mp4 clips Remotion plays (public/footage/<shot>.mp4).
# usage: scripts/encode-footage.sh [shot ...]   (default: every folder in frames/)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/footage
for fmt in mobile desktop; do
  fps=$([ "$fmt" = mobile ] && echo 30 || echo 24)
  for dir in frames/$fmt/*/; do
    name=$(basename "$dir")
    if [ "$#" -gt 0 ] && ! printf '%s\n' "$@" | grep -qx "$name"; then continue; fi
    ffmpeg -loglevel error -y -framerate "$fps" -i "$dir/f%05d.jpg" -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -movflags +faststart "public/footage/$name.mp4"
    echo "encoded $name ($(ls "$dir" | wc -l) frames @${fps}fps)"
  done
done
