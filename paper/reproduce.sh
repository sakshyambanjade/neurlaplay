#!/bin/bash
set -e
echo "=== Neurlaplay Full Reproduce Pipeline ==="
echo "Git commit: $(git rev-parse HEAD)"
echo "Date: $(date -u)"

# ── Step 1: Sanity check tension module ──────────────────────────────────────
echo ""
echo "▶ Step 1: Tension sanity checks"
python research/tension/tension_graph.py

# ── Step 2: Parse PGN → positions ────────────────────────────────────────────
echo ""
echo "▶ Step 2: Parse PGN → positions.csv"
if [ -f "research/all-games-v2.pgn" ]; then
  PGN_INPUT="research/all-games-v2.pgn"
elif [ -f "research/all-games.pgn" ]; then
  PGN_INPUT="research/all-games.pgn"
else
  echo "  ❌ No PGN found. Expected research/all-games-v2.pgn or research/all-games.pgn"
  exit 1
fi

python research/tension/pgn_to_positions.py \
  "$PGN_INPUT" \
  research/data/positions.csv

# ── Step 3: Compute tension ───────────────────────────────────────────────────
echo ""
echo "▶ Step 3: Compute tension dataset"
cd research/tension
python compute_tension_dataset.py \
  ../data/positions.csv \
  ../data/tension_per_ply.csv \
  ../data/tension_per_game.csv
cd ../..

# ── Step 4: Human baseline ────────────────────────────────────────────────────
echo ""
echo "▶ Step 4: Human baseline tension"
if [ -f "research/baselines/humans/lichess_1400_1600_rapid.pgn" ]; then
  python research/tension/pgn_to_positions.py \
    research/baselines/humans/lichess_1400_1600_rapid.pgn \
    research/data/human_positions.csv
  cd research/tension
  python compute_tension_dataset.py \
    ../data/human_positions.csv \
    ../data/human_tension_per_ply.csv \
    ../data/human_tension_per_game.csv
  cd ../..
else
  echo "  ⚠️  Human PGN not found — run: python research/baselines/download_human_pgn.py"
fi

# ── Step 5: Validate ──────────────────────────────────────────────────────────
echo ""
echo "▶ Step 5: Validate metrics"
python research/validate_metrics.py research/data

# ── Step 6: Generate figures ──────────────────────────────────────────────────
echo ""
echo "▶ Step 6: Generate all 5 paper figures"
python research/plot_paper_v2.py research/data

# ── Step 7: Compile LaTeX PDF ─────────────────────────────────────────────────
echo ""
echo "▶ Step 7: Compile PDF"
if [ -f "paper/paper.tex" ]; then
  cd paper
  pdflatex paper.tex && bibtex paper && pdflatex paper.tex && pdflatex paper.tex
  echo "✅ PDF compiled → paper/paper.pdf"
  cd ..
else
  echo "  ⚠️  paper/paper.tex not found yet — write the LaTeX source first"
fi

echo ""
echo "=== ✅ Full reproduce pipeline complete ==="
echo "Outputs: research/data/*.csv, research/plots/*.png"
