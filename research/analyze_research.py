#!/usr/bin/env python3
"""
Research Data Analyzer for LLMArena
Analyzes Centipawn Loss (CPL) metrics and chess-specific performance from exported match data
"""

import json
import csv
import sys
from pathlib import Path
from typing import List, Dict, Tuple
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

    def get_game_phase_analysis(self) -> Dict:
        """Analyze performance by game phase (opening, middlegame, endgame)"""
        opening_moves = []  # Moves 1-10
        middlegame_moves = []  # Moves 11-40
        endgame_moves = []  # Moves 41+

        for move in self.moves:
            move_num = move.get('moveNumber', 0)
            cpl = float(move.get('cpLoss', 0))
            
            if move_num <= 10:
                opening_moves.append(cpl)
            elif move_num <= 40:
                middlegame_moves.append(cpl)
            else:
                endgame_moves.append(cpl)

        def phase_stats(moves: List[float], phase_name: str) -> Dict:
            if not moves:
                return {'phase': phase_name, 'moves': 0}
            return {
                'phase': phase_name,
                'moves': len(moves),
                'avg_cpl': round(statistics.mean(moves), 2),
                'median_cpl': round(statistics.median(moves), 2),
                'blunders': sum(1 for cpl in moves if cpl > 5.0),
                'excellent_moves': sum(1 for cpl in moves if cpl < 0.5),
                'accuracy_pct': round(100 * sum(1 for cpl in moves if cpl < 2.0) / len(moves), 1)
            }

        return {
            'opening': phase_stats(opening_moves, 'Opening (1-10)'),
            'middlegame': phase_stats(middlegame_moves, 'Middlegame (11-40)'),
            'endgame': phase_stats(endgame_moves, 'Endgame (41+)')
        }

    def get_accuracy_metrics(self) -> Dict:
        """Calculate chess-specific accuracy metrics"""
        cpl_values = [float(m.get('cpLoss', 0)) for m in self.moves]
        
        # Accuracy categories based on CPL
        excellent = sum(1 for cpl in cpl_values if cpl < 0.5)  # Book moves / best moves
        good = sum(1 for cpl in cpl_values if 0.5 <= cpl < 1.0)  # Good alternative
        ok = sum(1 for cpl in cpl_values if 1.0 <= cpl < 2.0)  # Acceptable
        inaccuracies = sum(1 for cpl in cpl_values if 2.0 <= cpl < 5.0)  # Inaccurate
        mistakes = sum(1 for cpl in cpl_values if 5.0 <= cpl < 10.0)  # Mistake
        blunders = sum(1 for cpl in cpl_values if cpl >= 10.0)  # Blunder

        total = len(cpl_values)
        
        return {
            'total_moves': total,
            'excellent': {'count': excellent, 'percentage': round(100 * excellent / total, 1) if total else 0},
            'good': {'count': good, 'percentage': round(100 * good / total, 1) if total else 0},
            'ok': {'count': ok, 'percentage': round(100 * ok / total, 1) if total else 0},
            'inaccuracies': {'count': inaccuracies, 'percentage': round(100 * inaccuracies / total, 1) if total else 0},
            'mistakes': {'count': mistakes, 'percentage': round(100 * mistakes / total, 1) if total else 0},
            'blunders': {'count': blunders, 'percentage': round(100 * blunders / total, 1) if total else 0},
            'overall_accuracy': round(100 * (excellent + good + ok) / total, 1) if total else 0
        }

    def get_critical_moments(self) -> Dict:
        """Identify critical moments where evals changed significantly"""
        critical_moments = []
        
        for i, move in enumerate(self.moves):
            eval_before = move.get('sfEvalBefore', 0)
            eval_after = move.get('sfEvalAfter', 0)
            cpl = float(move.get('cpLoss', 0))
            
            # Critical if: large eval swing (>200cp) or high CPL in close position
            eval_change = abs(eval_after - eval_before)
            
            if eval_change > 200 or (abs(eval_before) < 200 and cpl > 3.0):
                critical_moments.append({
                    'move_number': move.get('moveNumber', i+1),
                    'color': move.get('playerColor'),
                    'uci': move.get('uci'),
                    'cpl': round(cpl, 2),
                    'eval_before': eval_before,
                    'eval_after': eval_after,
                    'eval_swing': eval_change,
                    'was_winning': abs(eval_before) > 200,
                    'reasoning': move.get('reasoning', 'N/A')[:60]
                })
        
        return {
            'total_critical_moments': len(critical_moments),
            'moments': sorted(critical_moments, key=lambda x: x['cpl'], reverse=True)[:10]  # Top 10
        }

    def get_time_analysis(self) -> Dict:
        """Analyze time usage patterns"""
        time_data = []
        
        for move in self.moves:
            time_ms = move.get('timeTakenMs', 0)
            if time_ms:
                time_data.append({
                    'time_ms': time_ms,
                    'cpl': float(move.get('cpLoss', 0)),
                    'move_num': move.get('moveNumber', 0)
                })
        
        if not time_data:
            return {'available': False}
        
        times = [d['time_ms'] for d in time_data]
        
        # Correlation between time and accuracy
        fast_moves = [d for d in time_data if d['time_ms'] < statistics.median(times)]
        slow_moves = [d for d in time_data if d['time_ms'] >= statistics.median(times)]
        
        return {
            'available': True,
            'total_time_ms': sum(times),
            'avg_time_ms': round(statistics.mean(times), 0),
            'median_time_ms': round(statistics.median(times), 0),
            'fast_moves': {
                'count': len(fast_moves),
                'avg_cpl': round(statistics.mean([m['cpl'] for m in fast_moves]), 2) if fast_moves else 0
            },
            'slow_moves': {
                'count': len(slow_moves),
                'avg_cpl': round(statistics.mean([m['cpl'] for m in slow_moves]), 2) if slow_moves else 0
            }
        }

    def get_model_head_to_head(self) -> Dict:
        """Direct comparison between two models in the match"""
        by_model = defaultdict(lambda: {'moves': [], 'colors': []})
        
        for move in self.moves:
            color = move.get('playerColor')
            if color == 'white':
                model = move.get('whiteModel', 'unknown')
            else:
                model = move.get('blackModel', 'unknown')
            
            by_model[model]['moves'].append(float(move.get('cpLoss', 0)))
            by_model[model]['colors'].append(color)
        
        comparison = {}
        for model, data in by_model.items():
            moves = data['moves']
            if moves:
                comparison[model] = {
                    'total_moves': len(moves),
                    'avg_cpl': round(statistics.mean(moves), 2),
                    'median_cpl': round(statistics.median(moves), 2),
                    'best_move_cpl': round(min(moves), 2),
                    'worst_move_cpl': round(max(moves), 2),
                    'blunders': sum(1 for cpl in moves if cpl > 10.0),
                    'mistakes': sum(1 for cpl in moves if 5.0 <= cpl < 10.0),
                    'inaccuracies': sum(1 for cpl in moves if 2.0 <= cpl < 5.0),
                    'excellent_moves': sum(1 for cpl in moves if cpl < 0.5),
                    'accuracy_pct': round(100 * sum(1 for cpl in moves if cpl < 2.0) / len(moves), 1),
                    'colors_played': list(set(data['colors']))
                }
        
        return comparison

    def export_for_paper(self, output_file: str = None):
        """Export data in academic paper format with comprehensive chess metrics"""
        output = output_file or self.data_file.stem + "_paper.json"

        stats = self.get_summary_stats()
        models = self.get_model_comparison()
        blunders = self.get_blunder_analysis()
        phases = self.get_game_phase_analysis()
        accuracy = self.get_accuracy_metrics()
        critical = self.get_critical_moments()
        time_analysis = self.get_time_analysis()
        head_to_head = self.get_model_head_to_head()

        paper_data = {
            "metadata": {
                "dataset": "LLMArena Chess Performance Analysis",
                "source_file": str(self.data_file),
                "total_matches": 1,
                "analysis_version": "2.0"
            },
            "summary_statistics": stats,
            "model_comparison": models,
            "head_to_head_comparison": head_to_head,
            "accuracy_metrics": accuracy,
            "game_phase_analysis": phases,
            "critical_moments": critical,
            "time_management": time_analysis,
            "blunder_analysis": blunders,
            "raw_moves": self.moves
        }

        with open(output, 'w') as f:
            json.dump(paper_data, f, indent=2)

        print(f"✓ Paper export saved to: {output}")
        return output

    def print_report(self):
        """Print comprehensive analysis report to console"""
        print("\n" + "=" * 70)
        print("🏆 LLMARENA CHESS PERFORMANCE ANALYSIS")
        print("=" * 70)

        # Summary stats
        stats = self.get_summary_stats()
        print("\n📊 SUMMARY STATISTICS")
        print(f"  Total moves: {stats.get('total_moves', 0)}")
        print(f"  Average CPL: {stats.get('average_cpl', 0)} centipawns")
        print(f"  Median CPL: {stats.get('median_cpl', 0)} centipawns")
        print(f"  Std Dev: {stats.get('stdev_cpl', 0)}")
        print(f"  Range: {stats.get('min_cpl', 0)} - {stats.get('max_cpl', 0)}")
        print(f"  Total CPL: {stats.get('total_cpl', 0)}")

        # Accuracy metrics
        accuracy = self.get_accuracy_metrics()
        print("\n🎯 ACCURACY BREAKDOWN")
        print(f"  Excellent (<0.5 CPL): {accuracy['excellent']['count']} ({accuracy['excellent']['percentage']}%)")
        print(f"  Good (0.5-1.0 CPL): {accuracy['good']['count']} ({accuracy['good']['percentage']}%)")
        print(f"  OK (1.0-2.0 CPL): {accuracy['ok']['count']} ({accuracy['ok']['percentage']}%)")
        print(f"  Inaccuracies (2.0-5.0 CPL): {accuracy['inaccuracies']['count']} ({accuracy['inaccuracies']['percentage']}%)")
        print(f"  Mistakes (5.0-10.0 CPL): {accuracy['mistakes']['count']} ({accuracy['mistakes']['percentage']}%)")
        print(f"  Blunders (>10.0 CPL): {accuracy['blunders']['count']} ({accuracy['blunders']['percentage']}%)")
        print(f"  ➜ Overall Accuracy: {accuracy['overall_accuracy']}%")

        # Game phase analysis
        phases = self.get_game_phase_analysis()
        print("\n♟️  GAME PHASE ANALYSIS")
        for phase_name in ['opening', 'middlegame', 'endgame']:
            phase = phases[phase_name]
            if phase.get('moves', 0) > 0:
                print(f"\n  {phase['phase']}:")
                print(f"    Moves: {phase['moves']}")
                print(f"    Avg CPL: {phase['avg_cpl']}")
                print(f"    Accuracy: {phase['accuracy_pct']}%")
                print(f"    Excellent moves: {phase['excellent_moves']}")
                print(f"    Blunders: {phase['blunders']}")

        # Model head-to-head comparison
        models = self.get_model_head_to_head()
        print("\n🤖 HEAD-TO-HEAD MODEL COMPARISON")
        for model, data in models.items():
            print(f"\n  {model}:")
            print(f"    Colors: {', '.join(data['colors_played'])}")
            print(f"    Total moves: {data['total_moves']}")
            print(f"    Accuracy: {data['accuracy_pct']}%")
            print(f"    Average CPL: {data['avg_cpl']}")
            print(f"    Excellent moves: {data['excellent_moves']}")
            print(f"    Inaccuracies: {data['inaccuracies']}")
            print(f"    Mistakes: {data['mistakes']}")
            print(f"    Blunders: {data['blunders']}")

        # Critical moments
        critical = self.get_critical_moments()
        print(f"\n⚡ CRITICAL MOMENTS")
        print(f"  Total critical positions: {critical['total_critical_moments']}")
        if critical['moments']:
            print(f"\n  Top 5 most critical moves:")
            for moment in critical['moments'][:5]:
                print(f"    Move {moment['move_number']} ({moment['color']}): {moment['uci']}")
                print(f"      CPL: {moment['cpl']}, Eval: {moment['eval_before']} → {moment['eval_after']}")
                print(f"      {moment['reasoning']}")

        # Time analysis
        time_data = self.get_time_analysis()
        if time_data.get('available'):
            print(f"\n⏱️  TIME MANAGEMENT")
            print(f"  Total time: {time_data['total_time_ms']/1000:.1f}s")
            print(f"  Avg per move: {time_data['avg_time_ms']/1000:.2f}s")
            print(f"  Median time: {time_data['median_time_ms']/1000:.2f}s")
            print(f"  Fast moves avg CPL: {time_data['fast_moves']['avg_cpl']}")
            print(f"  Slow moves avg CPL: {time_data['slow_moves']['avg_cpl']}")

        # Blunder analysis
        blunders = self.get_blunder_analysis()
        print(f"\n⚠️  BLUNDER ANALYSIS (threshold: {blunders['blunder_threshold']} CPL)")
        print(f"  Total blunders: {blunders['total_blunders']}")
        print(f"  Blunder rate: {blunders['blunder_percentage']}%")

        if blunders['blunders']:
            print("\n  Top 5 worst moves:")
            for blunder in blunders['blunders'][:5]:
                print(f"    Move {blunder['move_number']}: {blunder['uci']} " +
                      f"({blunder['player_color']}) - CPL: {blunder['cpl']}")
                print(f"      {blunder['reasoning'][:60]}...")

        print("\n" + "=" * 70 + "\n")


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
