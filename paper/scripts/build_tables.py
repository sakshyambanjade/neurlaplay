import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python build_tables.py <run_dir>")
        return 1

    run_dir = Path(sys.argv[1]).resolve()
    stats_path = run_dir / "stats.json"
    if not stats_path.exists():
        print(f"Missing {stats_path}")
        return 1

    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    output = run_dir / "tables" / "table-summary.md"
    output.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "# Run Summary",
        "",
        f"- totalGames: {stats.get('totalGames', 0)}",
        f"- matchupCount: {stats.get('matchupCount', 0)}",
        f"- overallFallbackRate: {stats.get('overallFallbackRate', 0):.4f}",
        f"- overallRetrySuccessRate: {stats.get('overallRetrySuccessRate', 0):.4f}",
        f"- overallIllegalMoveAttemptRate: {stats.get('overallIllegalMoveAttemptRate', 0):.4f}",
    ]
    output.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Table summary written to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
