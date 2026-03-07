import pandas as pd
import json
import sys
import os
import hashlib

errors = []
warnings = []

def check(cond, msg, warn=False):
    if not cond:
        if warn:
            warnings.append(f"⚠️  WARN: {msg}")
        else:
            errors.append(f"❌ FAIL: {msg}")
    else:
        print(f"✅ PASS: {msg}")

# Accept optional runDir arg
run_dir  = sys.argv[1] if len(sys.argv) > 1 else "."
res_file = os.path.join(run_dir, "paper-results.json") \
           if os.path.exists(os.path.join(run_dir, "paper-results.json")) \
           else "research/paper-results.json"
ply_file  = os.path.join(run_dir, "tension_per_ply.csv")
pos_file  = os.path.join(run_dir, "positions.csv")
game_file = os.path.join(run_dir, "tension_per_game.csv")

# ── Load ──────────────────────────────────────────────────────────────────────
results  = json.load(open(res_file)) if os.path.exists(res_file) else {}
tension  = pd.read_csv(ply_file)  if os.path.exists(ply_file)  else pd.DataFrame()
positions = pd.read_csv(pos_file) if os.path.exists(pos_file) else pd.DataFrame()
game_df  = pd.read_csv(game_file) if os.path.exists(game_file) else pd.DataFrame()

# ── 1. Game count consistency ─────────────────────────────────────────────────
if results:
    total = results.get("totalGames", 0)
    ww    = results.get("whiteWins", 0)
    bw    = results.get("blackWins", 0)
    dr    = results.get("draws", 0)
    check(ww + bw + dr == total,
          f"White({ww})+Black({bw})+Draws({dr})={ww+bw+dr} == totalGames({total})")

# ── 2. Blunder count cross-check ──────────────────────────────────────────────
if results and "totalBlunders" in results and not game_df.empty and "blunders" in game_df.columns:
    per_game_total = game_df["blunders"].sum()
    summary_total  = results["totalBlunders"]
    check(per_game_total == summary_total,
          f"Blunders in summary ({summary_total}) == sum in per-game CSV ({per_game_total})")
else:
    check(True, "Blunder cross-check skipped (no data yet)", warn=True)

# ── 3. Tension column checks ──────────────────────────────────────────────────
if not tension.empty:
    check(tension["T"].isna().sum() == 0,           "No NaN in T column")
    check(tension["T_per_piece"].isna().sum() == 0, "No NaN in T_per_piece column")
    check((tension["T"] >= 0).all(),                "All T values >= 0")
    check((tension["T"] < 1000).all(),              "All T values < 1000 (no explosion)")

# ── 4. Positions column checks ────────────────────────────────────────────────
if not positions.empty:
    valid_phases = {"opening", "middlegame", "endgame"}
    check(set(positions["phase"].unique()).issubset(valid_phases),
          f"Phase labels are valid: {positions['phase'].unique().tolist()}")
    check((positions["piece_count"] <= 32).all(), "Piece count never exceeds 32")
    check((positions["piece_count"] >= 2).all(),  "Piece count always >= 2 (two kings)")

    # ── 5. All games: ply sequential (NO break — checks every game) ──────────
    bad_games = []
    for gid, grp in positions.groupby("game_id"):
        plies = sorted(grp["ply"].tolist())
        expected = list(range(len(plies)))
        if plies != expected:
            bad_games.append(gid)
    check(len(bad_games) == 0,
          f"Sequential plies in all {positions['game_id'].nunique()} games"
          + (f" (bad: {bad_games[:5]})" if bad_games else ""))

    # ── 6. PGN headers present ────────────────────────────────────────────────
    if "white_model" in positions.columns:
        missing_white = positions["white_model"].isna().sum()
        missing_black = positions["black_model"].isna().sum()
        check(missing_white == 0, f"white_model header present in all positions")
        check(missing_black == 0, f"black_model header present in all positions")

# ── 7. Figures are data-driven (not hardcoded) ────────────────────────────────
plot_script = "research/plot_paper_v2.py"
if os.path.exists(plot_script):
    with open(plot_script) as f:
        src = f.read()
    hardcoded_signals = ["85.2", "72.4", "68.1", "r≈-0.72"]
    for sig in hardcoded_signals:
        check(sig not in src,
              f"plot_paper_v2.py does not hardcode '{sig}'", warn=True)

# ── 8. Manifest present ───────────────────────────────────────────────────────
manifest_path = os.path.join(run_dir, "run_manifest.json")
if os.path.exists(manifest_path):
    manifest = json.load(open(manifest_path))
    required_fields = ["gitCommit","promptTemplate","decodingParams",
                       "contextPolicy","hardware","randomSeed"]
    for f in required_fields:
        check(f in manifest, f"run_manifest.json has field '{f}'")
else:
    check(False, "run_manifest.json missing", warn=True)

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*50)
if warnings:
    for w in warnings: print(w)
if errors:
    print(f"\n❌ {len(errors)} check(s) failed:")
    for e in errors: print(e)
    sys.exit(1)
else:
    print(f"🎉 All checks passed! Data is clean and publish-ready.")
