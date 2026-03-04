#!/usr/bin/env python3
"""
Research Data Analyzer for LLMArena
Analyzes Centipawn Loss (CPL) metrics from exported match data
"""

import json
import csv
import sys
from pathlib import Path
from typing import List, Dict
from collections import defaultdict
import statistics


class ResearchAnalyzer:
    def __init__(self, data_file: str):
        """Load research data from JSON or CSV"""
        self.data_file = Path(data_file)
        self.moves = []
        self.load_data()

    def load_data(self):
        """Load data from JSON or CSV file"""
        if self.data_file.suffix == '.json':
            with open(self.data_file, 'r') as f:
                self.moves = json.load(f)
        elif self.data_file.suffix == '.csv':
            with open(self.data_file, 'r') as f:
                reader = csv.DictReader(f)
                self.moves = [row for row in reader]
                # Convert numeric strings to floats
                for move in self.moves:
                    move['cpLoss'] = float(move['cpLoss']) if move.get('cpLoss') else 0
                    move['sfEvalBefore'] = int(move['sfEvalBefore']) if move.get('sfEvalBefore') else 0
                    move['sfEvalAfter'] = int(move['sfEvalAfter']) if move.get('sfEvalAfter') else 0
        else:
            raise ValueError("File must be .json or .csv")

    def get_summary_stats(self) -> Dict:
        """Get overall statistics"""
        if not self.moves:
            return {}

        cpl_values = [float(m.get('cpLoss', 0)) for m in self.moves]

        return {
            'total_moves': len(self.moves),
            'average_cpl': round(statistics.mean(cpl_values), 2),
            'median_cpl': round(statistics.median(cpl_values), 2),
            'stdev_cpl': round(statistics.stdev(cpl_values), 2) if len(cpl_values) > 1 else 0,
            'max_cpl': round(max(cpl_values), 2),
            'min_cpl': round(min(cpl_values), 2),
            'total_cpl': round(sum(cpl_values), 2),
        }

    def get_model_comparison(self) -> Dict:
        """Compare move quality between models"""
        by_model = defaultdict(list)

        for move in self.moves:
            color = move.get('playerColor')
            if color == 'white':
                model = move.get('whiteModel', 'unknown')
            else:
                model = move.get('blackModel', 'unknown')

            cpl = float(move.get('cpLoss', 0))
            by_model[model].append(cpl)

        comparison = {}
        for model, cpl_list in by_model.items():
            if cpl_list:
                comparison[model] = {
                    'avg_cpl': round(statistics.mean(cpl_list), 2),
                    'median_cpl': round(statistics.median(cpl_list), 2),
                    'best_cpl': round(min(cpl_list), 2),
                    'worst_cpl': round(max(cpl_list), 2),
                    'blunders': sum(1 for cpl in cpl_list if cpl > 5.0),
                    'moves': len(cpl_list)
                }

        return comparison

    def get_blunder_analysis(self, blunder_threshold: float = 5.0) -> Dict:
        """Identify and categorize blunders"""
        blunders = []

        for i, move in enumerate(self.moves, 1):
            cpl = float(move.get('cpLoss', 0))
            if cpl > blunder_threshold:
                blunders.append({
                    'move_number': i,
                    'player_color': move.get('playerColor'),
                    'uci': move.get('uci'),
                    'reasoning': move.get('reasoning', 'N/A'),
                    'cpl': round(cpl, 2),
                    'eval_before': int(move.get('sfEvalBefore', 0)),
                    'eval_after': int(move.get('sfEvalAfter', 0))
                })

        return {
            'blunder_threshold': blunder_threshold,
            'total_blunders': len(blunders),
            'blunder_percentage': round(100 * len(blunders) / len(self.moves), 2) if self.moves else 0,
            'blunders': blunders
        }

    def export_for_paper(self, output_file: str = None):
        """Export data in academic paper format"""
        output = output_file or self.data_file.stem + "_paper.json"

        stats = self.get_summary_stats()
        models = self.get_model_comparison()
        blunders = self.get_blunder_analysis()

        paper_data = {
            "metadata": {
                "dataset": "LLMArena Bot Match Analysis",
                "source_file": str(self.data_file),
                "total_matches": 1  # Single match analysis
            },
            "summary_statistics": stats,
            "model_comparison": models,
            "blunder_analysis": blunders,
            "raw_moves": self.moves
        }

        with open(output, 'w') as f:
            json.dump(paper_data, f, indent=2)

        print(f"✓ Paper export saved to: {output}")
        return output

    def print_report(self):
        """Print analysis report to console"""
        print("\n" + "=" * 60)
        print("LLMARENA RESEARCH DATA ANALYSIS")
        print("=" * 60)

        # Summary stats
        stats = self.get_summary_stats()
        print("\n📊 SUMMARY STATISTICS")
        print(f"  Total moves: {stats.get('total_moves', 0)}")
        print(f"  Average CPL: {stats.get('average_cpl', 0)} centipawns")
        print(f"  Median CPL: {stats.get('median_cpl', 0)} centipawns")
        print(f"  Std Dev: {stats.get('stdev_cpl', 0)}")
        print(f"  Range: {stats.get('min_cpl', 0)} - {stats.get('max_cpl', 0)}")
        print(f"  Total CPL: {stats.get('total_cpl', 0)}")

        # Model comparison
        models = self.get_model_comparison()
        print("\n🤖 MODEL COMPARISON")
        for model, data in models.items():
            print(f"\n  {model}:")
            print(f"    Average CPL: {data['avg_cpl']}")
            print(f"    Best move: {data['best_cpl']} CPL")
            print(f"    Worst move: {data['worst_cpl']} CPL")
            print(f"    Blunders (>5 CPL): {data['blunders']}")
            print(f"    Total moves: {data['moves']}")

        # Blunder analysis
        blunders = self.get_blunder_analysis()
        print(f"\n⚠️  BLUNDER ANALYSIS (threshold: {blunders['blunder_threshold']} CPL)")
        print(f"  Total blunders: {blunders['total_blunders']}")
        print(f"  Blunder rate: {blunders['blunder_percentage']}%")

        if blunders['blunders']:
            print("\n  Top 5 worst moves:")
            for blunder in blunders['blunders'][:5]:
                print(f"    Move {blunder['move_number']}: {blunder['uci']} " +
                      f"({blunder['player_color']}) - CPL: {blunder['cpl']} " +
                      f"(reasoning: {blunder['reasoning'][:40]}...)")

        print("\n" + "=" * 60 + "\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_research.py <data_file.json|csv> [--paper]")
        print("\nExample:")
        print("  python analyze_research.py research-match-123.json")
        print("  python analyze_research.py research-match-456.csv --paper")
        sys.exit(1)

    data_file = sys.argv[1]
    paper_export = '--paper' in sys.argv

    try:
        analyzer = ResearchAnalyzer(data_file)
        analyzer.print_report()

        if paper_export:
            analyzer.export_for_paper()

    except FileNotFoundError:
        print(f"❌ Error: File '{data_file}' not found")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
