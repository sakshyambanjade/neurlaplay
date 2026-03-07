"""Paper-grade validation for chess benchmark artifacts.

This validator enforces cross-artifact consistency, provenance completeness,
statistical reporting presence, and rule-audit integrity.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

errors: list[str] = []
warnings: list[str] = []


def check(cond: bool, msg: str, warn: bool = False) -> None:
    if cond:
        print(f"PASS: {msg}")
        return
    if warn:
        warnings.append(f"WARN: {msg}")
    else:
        errors.append(f"FAIL: {msg}")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def resolve_file(run_dir: Path, name: str) -> Path | None:
    direct = run_dir / name
    if direct.exists():
        return direct

    # Common archive layout: research/archive/<timestamp>/<artifact>
    if run_dir.name == "archive":
        subdirs = [p for p in run_dir.iterdir() if p.is_dir()]
        subdirs.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        for subdir in subdirs:
            candidate = subdir / name
            if candidate.exists():
                return candidate

    return None


def find_manifest(run_dir: Path) -> Path | None:
    direct = run_dir / "run_manifest.json"
    if direct.exists():
        return direct

    candidates: list[Path] = [run_dir, run_dir.parent]
    if run_dir.parent != run_dir.parent.parent:
        candidates.append(run_dir.parent.parent)

    for base in candidates:
        if not base.exists():
            continue
        for found in base.rglob("run_manifest.json"):
            return found

    return None


def parse_latex_rows(latex: str) -> list[dict[str, float | str]]:
    rows: list[dict[str, float | str]] = []
    for line in latex.splitlines():
        stripped = line.strip()
        if "&" not in stripped or "\\\\" not in stripped:
            continue
        if stripped.startswith("Model") or stripped.startswith("\\"):
            continue

        parts = [part.strip() for part in stripped.split("&")]
        if len(parts) < 5:
            continue

        model = parts[0]
        win_rate_percent = to_float(parts[1].replace("\\%", "").strip())
        avg_cpl = to_float(parts[2].strip())
        blunders_per_game = to_float(parts[3].strip())
        acc_field = parts[4].replace("\\\\", "").replace("\\%", "").strip()
        accuracy_percent = to_float(acc_field)

        rows.append(
            {
                "model": model,
                "win_rate_percent": win_rate_percent,
                "avg_cpl": avg_cpl,
                "blunders_per_game": blunders_per_game,
                "accuracy_percent": accuracy_percent,
            }
        )
    return rows


def validate_tension_csvs(run_dir: Path) -> None:
    ply_path = run_dir / "tension_per_ply.csv"
    pos_path = run_dir / "positions.csv"
    game_path = run_dir / "tension_per_game.csv"

    tension = load_csv_rows(ply_path) if ply_path.exists() else []
    positions = load_csv_rows(pos_path) if pos_path.exists() else []
    game_rows = load_csv_rows(game_path) if game_path.exists() else []

    if not tension and not positions and not game_rows:
        check(
            False,
            "No tension CSV artifacts found (positions.csv / tension_per_ply.csv / tension_per_game.csv)",
            warn=True,
        )
        return

    if tension:
        header = set(tension[0].keys())
        check("T" in header, "tension_per_ply.csv has T column")
        check("T_per_piece" in header, "tension_per_ply.csv has T_per_piece column")
        if "T" in header:
            t_values = [to_float(row.get("T"), default=float("nan")) for row in tension]
            has_nan = any(str(v) == "nan" for v in t_values)
            check(not has_nan, "No NaN in T column")
            check(all(v >= 0 for v in t_values if str(v) != "nan"), "All T values >= 0")
            check(all(v < 1000 for v in t_values if str(v) != "nan"), "All T values < 1000")

        if "T_per_piece" in header:
            tp_values = [to_float(row.get("T_per_piece"), default=float("nan")) for row in tension]
            has_nan_tp = any(str(v) == "nan" for v in tp_values)
            check(not has_nan_tp, "No NaN in T_per_piece column")

    if positions:
        header = set(positions[0].keys())
        if "phase" in header:
            phases = {str(row.get("phase", "")) for row in positions}
            valid = {"opening", "middlegame", "endgame"}
            check(phases.issubset(valid), f"positions.csv phase labels valid (found={sorted(phases)})")

        if "piece_count" in header:
            piece_counts = [to_int(row.get("piece_count"), default=-1) for row in positions]
            check(all(v <= 32 for v in piece_counts), "piece_count <= 32")
            check(all(v >= 2 for v in piece_counts), "piece_count >= 2")

        if "game_id" in header and "ply" in header:
            plies_by_game: dict[str, list[int]] = defaultdict(list)
            for row in positions:
                gid = str(row.get("game_id", ""))
                plies_by_game[gid].append(to_int(row.get("ply"), default=-1))

            bad_games: list[str] = []
            for gid, plies in plies_by_game.items():
                observed = sorted(plies)
                expected = list(range(len(observed)))
                if observed != expected:
                    bad_games.append(gid)

            check(
                len(bad_games) == 0,
                f"Sequential plies in positions.csv for all games (bad={bad_games[:5]})",
            )

    if positions and game_rows:
        pos_header = set(positions[0].keys())
        game_header = set(game_rows[0].keys())
        if "game_id" in pos_header and "game_id" in game_header:
            n_pos = len({row["game_id"] for row in positions})
            n_game = len({row["game_id"] for row in game_rows})
            check(
                n_pos == n_game,
                f"positions.csv unique game_id ({n_pos}) equals tension_per_game.csv ({n_game})",
            )


def validate_paper_artifacts(run_dir: Path) -> None:
    results_path = resolve_file(run_dir, "paper-results.json")
    stats_path = resolve_file(run_dir, "paper-stats.json")
    datapoints_path = resolve_file(run_dir, "paper-datapoints.json")
    raw_games_path = resolve_file(run_dir, "raw-games.json")
    audit_path = resolve_file(run_dir, "rule-audit-summary.json")

    check(results_path is not None, "paper-results.json exists")
    check(stats_path is not None, "paper-stats.json exists")
    check(datapoints_path is not None, "paper-datapoints.json exists")
    check(raw_games_path is not None, "raw-games.json exists")

    if not (results_path and stats_path and datapoints_path and raw_games_path):
        return

    paper_results = load_json(results_path)
    paper_stats = load_json(stats_path)
    datapoints = load_json(datapoints_path)
    raw_games = load_json(raw_games_path)

    if not isinstance(datapoints, list):
        datapoints = []
    if not isinstance(raw_games, list):
        raw_games = []

    stats_obj = paper_stats.get("stats", {}) if isinstance(paper_stats, dict) else {}
    stats_games = paper_stats.get("games", []) if isinstance(paper_stats, dict) else []
    if not isinstance(stats_games, list):
        stats_games = []

    total_games = to_int(paper_results.get("totalGames"), default=0)
    check(total_games > 0, f"paper-results totalGames > 0 (found {total_games})")

    white_wins = to_int(paper_results.get("whiteWins"), default=0)
    black_wins = to_int(paper_results.get("blackWins"), default=0)
    draws = to_int(paper_results.get("draws"), default=0)
    check(
        white_wins + black_wins + draws == total_games,
        "paper-results wins+draws equals totalGames",
    )

    # Cross-file total game consistency.
    datapoint_games = {str(d.get("gameId", "")) for d in datapoints if isinstance(d, dict)}
    raw_game_ids = {str(g.get("gameId", "")) for g in raw_games if isinstance(g, dict)}
    stats_game_ids = {str(g.get("gameId", "")) for g in stats_games if isinstance(g, dict)}

    if datapoint_games:
        check(
            len(datapoint_games) == total_games,
            f"paper-datapoints unique gameId ({len(datapoint_games)}) == totalGames ({total_games})",
        )
    if raw_game_ids:
        check(
            len(raw_game_ids) == total_games,
            f"raw-games unique gameId ({len(raw_game_ids)}) == totalGames ({total_games})",
        )
    if stats_game_ids:
        check(
            len(stats_game_ids) == total_games,
            f"paper-stats games unique gameId ({len(stats_game_ids)}) == totalGames ({total_games})",
        )

    # Recompute CPL and blunders from move-level data.
    white_cpl = [
        to_float(d.get("cpl"))
        for d in datapoints
        if isinstance(d, dict) and str(d.get("side")) == "white"
    ]
    black_cpl = [
        to_float(d.get("cpl"))
        for d in datapoints
        if isinstance(d, dict) and str(d.get("side")) == "black"
    ]

    if white_cpl and black_cpl:
        avg_cpl = paper_results.get("avgCPL", {})
        avg_white = to_float(avg_cpl.get("white"))
        avg_black = to_float(avg_cpl.get("black"))
        check(
            abs(avg_white - mean(white_cpl)) < 1e-6,
            "paper-results avgCPL.white matches recompute from paper-datapoints",
        )
        check(
            abs(avg_black - mean(black_cpl)) < 1e-6,
            "paper-results avgCPL.black matches recompute from paper-datapoints",
        )

    blunder_threshold = 200
    if isinstance(paper_stats, dict):
        eval_settings = paper_stats.get("eval_settings", {})
        if isinstance(eval_settings, dict):
            blunder_threshold = to_int(
                eval_settings.get("blunder_threshold_cp"),
                default=blunder_threshold,
            )

    recomputed_blunders = sum(
        1
        for d in datapoints
        if isinstance(d, dict) and to_float(d.get("cpl")) >= blunder_threshold
    )
    check(
        to_int(paper_results.get("totalBlunders"), default=-1) == recomputed_blunders,
        f"paper-results totalBlunders matches datapoints at threshold {blunder_threshold}",
    )

    # LaTeX internal contradiction checks.
    latex_rows = parse_latex_rows(str(paper_results.get("latexTable3", "")))
    check(len(latex_rows) >= 2, "latexTable3 has at least two model rows")

    if latex_rows:
        total_blunders = to_int(paper_results.get("totalBlunders"), default=0)
        if total_blunders == 0:
            all_zero = all(abs(to_float(row["blunders_per_game"])) < 1e-12 for row in latex_rows)
            check(
                all_zero,
                "latexTable3 blunders/game are zero when totalBlunders is zero",
            )

        avg_cpl = paper_results.get("avgCPL", {})
        white_val = to_float(avg_cpl.get("white"))
        black_val = to_float(avg_cpl.get("black"))
        table_cpl = [to_float(row["avg_cpl"]) for row in latex_rows]
        check(
            any(abs(v - white_val) < 1e-6 for v in table_cpl),
            "latexTable3 includes avgCPL.white from summary",
        )
        check(
            any(abs(v - black_val) < 1e-6 for v in table_cpl),
            "latexTable3 includes avgCPL.black from summary",
        )

    # Statistical reporting checks (including effect sizes).
    check("confidenceInterval95" in stats_obj, "paper-stats includes confidenceInterval95")
    check("pValueWhiteVsBlack" in stats_obj, "paper-stats includes pValueWhiteVsBlack")
    has_effect = "effectSizes" in stats_obj or "effectSize" in stats_obj
    check(has_effect, "paper-stats includes effect size reporting")

    # Summary consistency between paper-results and paper-stats.
    if isinstance(stats_obj, dict):
        check(
            to_int(stats_obj.get("totalGames"), default=-1) == total_games,
            "paper-stats totalGames matches paper-results",
        )
        check(
            to_int(stats_obj.get("whiteWins"), default=-1) == white_wins,
            "paper-stats whiteWins matches paper-results",
        )
        check(
            to_int(stats_obj.get("blackWins"), default=-1) == black_wins,
            "paper-stats blackWins matches paper-results",
        )
        check(
            to_int(stats_obj.get("draws"), default=-1) == draws,
            "paper-stats draws matches paper-results",
        )

    # Rule audit checks.
    check(audit_path is not None, "rule-audit-summary.json exists")
    if audit_path is not None:
        rule_audit = load_json(audit_path)
        audited_games = to_int(rule_audit.get("gamesWithRuleAudit"), default=0)
        check(audited_games > 0, "rule-audit has non-zero gamesWithRuleAudit")
        check(
            audited_games == total_games,
            "rule-audit gamesWithRuleAudit equals totalGames",
        )

    # Duplicate/corrupted game checks.
    if stats_games:
        pgns = [str(g.get("pgn", "")) for g in stats_games if isinstance(g, dict)]
        duplicates = len(pgns) - len(set(pgns))
        check(
            duplicates == 0,
            f"paper-stats contains no duplicate PGNs (duplicates={duplicates})",
        )

        valid_terminations = {
            "checkmate",
            "stalemate",
            "draw",
            "threefold_repetition",
            "insufficient_material",
            "timeout",
            "max_moves_white_ahead",
            "max_moves_black_ahead",
            "max_moves_draw",
            "timeout_white_ahead",
            "timeout_black_ahead",
            "timeout_draw",
        }
        found_terminations = {
            str(g.get("termination", ""))
            for g in stats_games
            if isinstance(g, dict) and g.get("termination") is not None
        }
        bad_terminations = sorted(found_terminations - valid_terminations)
        check(
            len(bad_terminations) == 0,
            f"termination labels valid (unexpected={bad_terminations})",
        )

    # Repeated-position loops (heuristic): flag if same FEN repeats > 12x in one game.
    fens_by_game: dict[str, list[str]] = defaultdict(list)
    for d in datapoints:
        if not isinstance(d, dict):
            continue
        gid = str(d.get("gameId", ""))
        fen_after = str(d.get("fenAfter", ""))
        if gid and fen_after:
            fens_by_game[gid].append(fen_after)

    loopy_games: list[tuple[str, int]] = []
    for gid, fen_list in fens_by_game.items():
        if not fen_list:
            continue
        max_repeat = max(Counter(fen_list).values())
        if max_repeat > 12:
            loopy_games.append((gid, max_repeat))

    check(
        len(loopy_games) == 0,
        f"no suspected stuck-loop games via repeated FENs (sample={loopy_games[:3]})",
    )

    # Time-control evidence checks.
    move_time_keys = {"thinkTimeMs", "moveTimeMs"}
    has_move_time_field = any(
        isinstance(d, dict) and any(k in d for k in move_time_keys)
        for d in datapoints
    )
    check(
        has_move_time_field,
        "paper-datapoints includes explicit per-move time field (thinkTimeMs/moveTimeMs)",
    )

    rows_by_game: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for d in datapoints:
        if isinstance(d, dict):
            rows_by_game[str(d.get("gameId", ""))].append(d)

    bad_time_games: list[str] = []
    for gid, rows in rows_by_game.items():
        rows_sorted = sorted(rows, key=lambda r: to_int(r.get("moveNumber"), default=-1))
        timestamps = [to_int(r.get("timestamp"), default=-1) for r in rows_sorted]
        if any(timestamps[i] < timestamps[i - 1] for i in range(1, len(timestamps))):
            bad_time_games.append(gid)

    check(
        len(bad_time_games) == 0,
        f"datapoint timestamps are monotonic within each game (bad={bad_time_games[:5]})",
    )


def validate_manifest(run_dir: Path) -> None:
    manifest_path = find_manifest(run_dir)
    check(manifest_path is not None, "run_manifest.json exists and is discoverable")
    if manifest_path is None:
        return

    manifest = load_json(manifest_path)
    required = [
        "gitCommit",
        "promptTemplate",
        "decodingParams",
        "contextPolicy",
        "hardware",
        "randomSeed",
    ]
    for key in required:
        check(key in manifest, f"run_manifest has '{key}'")

    engine_required = ["stockfishEvalDepth", "blunderThresholdCp"]
    for key in engine_required:
        check(key in manifest, f"run_manifest has engine setting '{key}'")

    has_engine_options = "uciOptions" in manifest or "engineOptions" in manifest
    check(
        has_engine_options,
        "run_manifest includes UCI/engine options (MultiPV/Hash/Threads/Skill)",
    )

    has_matchups = (
        "config" in manifest
        and isinstance(manifest.get("config"), dict)
        and "matchups" in manifest["config"]
    )
    check(
        has_matchups,
        "run_manifest config.matchups exists with exact model identifiers",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate benchmark artifacts for paper-grade integrity"
    )
    parser.add_argument(
        "run_dir",
        nargs="?",
        default=".",
        help="Path to run folder or archive folder",
    )
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    check(run_dir.exists(), f"Input directory exists: {run_dir}")
    if not run_dir.exists():
        print("\nValidation aborted.")
        sys.exit(1)

    validate_tension_csvs(run_dir)
    validate_paper_artifacts(run_dir)
    validate_manifest(run_dir)

    print("\n" + "=" * 64)
    for warning in warnings:
        print(warning)

    if errors:
        print(f"\nValidation failed with {len(errors)} error(s):")
        for error in errors:
            print(error)
        sys.exit(1)

    print("All required checks passed.")


if __name__ == "__main__":
    main()
