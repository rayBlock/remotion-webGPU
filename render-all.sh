#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="out"
mkdir -p "$OUT_DIR"

COMPOSITIONS=(
  "WebGPUScene"
  "ExtraordinaryWebGPUScene"
  "CrazyWebGPUScene"
  "LimitBreaker"
  "ParticleForge"
  "BoidsWebGPUScene"
  "SPHFluidWebGPUScene"
)

echo "Rendering ${#COMPOSITIONS[@]} compositions to $OUT_DIR/"
echo "==========================================="

for comp in "${COMPOSITIONS[@]}"; do
  echo ""
  echo ">>> Rendering $comp..."
  npx remotion render "$comp" "$OUT_DIR/$comp.mp4"
  echo ">>> Done: $OUT_DIR/$comp.mp4"
done

echo ""
echo "==========================================="
echo "All ${#COMPOSITIONS[@]} compositions rendered to $OUT_DIR/"
ls -lh "$OUT_DIR"/*.mp4
