import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python build_figures.py <run_dir>")
        return 1

    run_dir = Path(sys.argv[1]).resolve()
    figures_path = run_dir / "figures_data.json"
    if not figures_path.exists():
        print(f"Missing {figures_path}")
        return 1

    data = json.loads(figures_path.read_text(encoding="utf-8"))
    output = run_dir / "figures" / "figure-summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"[OK] Figure-ready data copied to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
