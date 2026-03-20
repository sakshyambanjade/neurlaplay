#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./paper/reproduce.sh <paper-run-dir>"
  exit 1
fi

RUN_DIR="$1"

echo "=== Neurlaplay Paper Reproduce Helpers ==="
echo "Run dir: ${RUN_DIR}"

python paper/scripts/build_figures.py "${RUN_DIR}"
python paper/scripts/build_tables.py "${RUN_DIR}"
python paper/scripts/package_artifacts.py "${RUN_DIR}"

echo "=== Done ==="
