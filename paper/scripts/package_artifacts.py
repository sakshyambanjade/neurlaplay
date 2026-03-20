import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python package_artifacts.py <run_dir>")
        return 1

    run_dir = Path(sys.argv[1]).resolve()
    files = sorted(str(path.relative_to(run_dir)) for path in run_dir.rglob("*") if path.is_file())
    manifest_path = run_dir / "artifacts_manifest.json"
    manifest_path.write_text(
        json.dumps({"createdAt": "manual", "files": files}, indent=2),
        encoding="utf-8",
    )
    print(f"[OK] Artifact manifest written to {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
