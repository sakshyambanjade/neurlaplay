# Figure Data

The pipeline writes `figures_data.json` into each run directory. This file is the canonical input for figure generation.

Current figure families:

- `modelComparison`
- `reliability`
- `quality`

The included `paper/scripts/build_figures.py` script reads `figures_data.json` and emits a simple textual summary if plotting dependencies are unavailable.
