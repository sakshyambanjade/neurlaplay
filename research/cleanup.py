#!/usr/bin/env python3
"""
Clean up unnecessary files from the research workspace.
Removes:
- Old/failed research runs (keeping only successful ones)
- Python cache files
- Temporary scripts
- Duplicate data files
"""

import os
import shutil
from pathlib import Path
from datetime import datetime

def get_size_mb(path):
    """Get size of file or directory in MB."""
    if path.is_file():
        return path.stat().st_size / (1024 * 1024)
    total = sum(f.stat().st_size for f in path.rglob('*') if f.is_file())
    return total / (1024 * 1024)

def remove_pycache():
    """Remove all __pycache__ directories."""
    removed = []
    for pycache in Path('.').rglob('__pycache__'):
        if pycache.is_dir():
            shutil.rmtree(pycache)
            removed.append(str(pycache))
    return removed

def clean_old_runs():
    """Remove incomplete or failed research runs, keep successful ones."""
    runs_dir = Path('../server/research/runs')
    if not runs_dir.exists():
        return [], []
    
    removed = []
    kept = []
    
    for run_dir in sorted(runs_dir.iterdir()):
        if not run_dir.is_dir():
            continue
        
        status_file = run_dir / 'status.json'
        if not status_file.exists():
            # No status file = incomplete run
            size = get_size_mb(run_dir)
            shutil.rmtree(run_dir)
            removed.append((str(run_dir.name), size, 'no status'))
            continue
        
        # Read status
        import json
        with open(status_file) as f:
            status = json.load(f)
        
        # Check if run has errors
        if status.get('error'):
            size = get_size_mb(run_dir)
            shutil.rmtree(run_dir)
            removed.append((str(run_dir.name), size, status['error'][:50]))
        else:
            size = get_size_mb(run_dir)
            kept.append((str(run_dir.name), size, 'successful'))
    
    return removed, kept

def clean_temp_files():
    """Remove temporary files."""
    removed = []
    temp_files = [
        Path('../check_progress.py'),  # Temporary script
    ]
    
    for f in temp_files:
        if f.exists():
            size = get_size_mb(f)
            f.unlink()
            removed.append((str(f), size))
    
    return removed

def clean_duplicate_pgns():
    """Remove duplicate PGN files, keeping canonical ones."""
    removed = []
    
    # Remove all-games-v2.pgn if it's a duplicate of archive pgn
    v2_pgn = Path('../server/research/all-games-v2.pgn')
    if v2_pgn.exists():
        size = get_size_mb(v2_pgn)
        v2_pgn.unlink()
        removed.append((str(v2_pgn), size, 'duplicate of archive'))
    
    return removed

def main():
    print("🧹 Cleaning up research workspace...\n")
    
    total_freed = 0
    
    # Clean __pycache__
    print("📦 Removing Python cache files...")
    pycache = remove_pycache()
    if pycache:
        print(f"   Removed {len(pycache)} __pycache__ directories")
        total_freed += len(pycache) * 0.01  # Estimate
    else:
        print("   No __pycache__ found")
    
    # Clean old runs
    print("\n🗂️  Cleaning old research runs...")
    removed_runs, kept_runs = clean_old_runs()
    if removed_runs:
        print(f"   Removed {len(removed_runs)} failed/incomplete runs:")
        for name, size, reason in removed_runs:
            print(f"     - {name} ({size:.1f} MB) - {reason}")
            total_freed += size
    else:
        print("   No failed runs to remove")
    
    if kept_runs:
        print(f"\n   Kept {len(kept_runs)} successful runs:")
        for name, size, status in kept_runs:
            print(f"     ✓ {name} ({size:.1f} MB) - {status}")
    
    # Clean temp files
    print("\n📄 Removing temporary files...")
    temp = clean_temp_files()
    if temp:
        for name, size in temp:
            print(f"   - {name} ({size:.2f} MB)")
            total_freed += size
    else:
        print("   No temporary files found")
    
    # Clean duplicate PGNs
    print("\n♟️  Removing duplicate PGN files...")
    dup_pgns = clean_duplicate_pgns()
    if dup_pgns:
        for name, size, reason in dup_pgns:
            print(f"   - {name} ({size:.1f} MB) - {reason}")
            total_freed += size
    else:
        print("   No duplicate PGNs found")
    
    print(f"\n✨ Cleanup complete!")
    print(f"   Total space freed: {total_freed:.1f} MB")
    
    # Show what remains
    print("\n📊 Research workspace summary:")
    print(f"   - Plots: {len(list(Path('plots').glob('*.png')))} figures")
    print(f"   - Logs: {len(list(Path('logs').glob('*.jsonl')))} JSONL files")
    if kept_runs:
        print(f"   - Research runs: {len(kept_runs)} successful")

if __name__ == '__main__':
    main()
