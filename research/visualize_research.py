#!/usr/bin/env python3
"""
Chess Performance Visualizer for LLMArena
Generates charts and visualizations from research data
Requires: matplotlib, seaborn (install with: pip install matplotlib seaborn)
"""

import json
import sys
from pathlib import Path
from typing import Dict, List
import statistics

try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("⚠️  Warning: matplotlib not installed. Visualizations disabled.")
    print("   Install with: pip install matplotlib seaborn")


class ChessVisualizer:
    def __init__(self, paper_data_file: str):
        """Load paper-format JSON data"""
        self.data_file = Path(paper_data_file)
        with open(self.data_file, 'r') as f:
            self.data = json.load(f)
        
        self.output_dir = self.data_file.parent / f"{self.data_file.stem}_charts"
        self.output_dir.mkdir(exist_ok=True)

    def plot_accuracy_distribution(self):
        """Bar chart showing distribution of move quality"""
        if not MATPLOTLIB_AVAILABLE:
            return
        
        accuracy = self.data.get('accuracy_metrics', {})
        
        categories = ['Excellent\n<0.5', 'Good\n0.5-1.0', 'OK\n1.0-2.0', 
                     'Inaccurate\n2.0-5.0', 'Mistake\n5.0-10.0', 'Blunder\n>10.0']
        counts = [
            accuracy.get('excellent', {}).get('count', 0),
            accuracy.get('good', {}).get('count', 0),
            accuracy.get('ok', {}).get('count', 0),
            accuracy.get('inaccuracies', {}).get('count', 0),
            accuracy.get('mistakes', {}).get('count', 0),
            accuracy.get('blunders', {}).get('count', 0)
        ]
        colors = ['#2ecc71', '#27ae60', '#f39c12', '#e67e22', '#e74c3c', '#c0392b']
        
        plt.figure(figsize=(10, 6))
        bars = plt.bar(categories, counts, color=colors, alpha=0.8, edgecolor='black')
        plt.xlabel('Move Quality Category (CPL Range)', fontsize=12, fontweight='bold')
        plt.ylabel('Number of Moves', fontsize=12, fontweight='bold')
        plt.title('Move Quality Distribution', fontsize=14, fontweight='bold')
        plt.grid(axis='y', alpha=0.3, linestyle='--')
        
        # Add count labels on bars
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                plt.text(bar.get_x() + bar.get_width()/2., height,
                        f'{int(height)}',
                        ha='center', va='bottom', fontweight='bold')
        
        plt.tight_layout()
        output_path = self.output_dir / 'accuracy_distribution.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"  ✓ Saved: {output_path}")

    def plot_game_phase_comparison(self):
        """Compare performance across game phases"""
        if not MATPLOTLIB_AVAILABLE:
            return
        
        phases_data = self.data.get('game_phase_analysis', {})
        
        phases = []
        avg_cpls = []
        accuracies = []
        
        for phase_key in ['opening', 'middlegame', 'endgame']:
            phase = phases_data.get(phase_key, {})
            if phase.get('moves', 0) > 0:
                phases.append(phase.get('phase', phase_key).split('(')[0].strip())
                avg_cpls.append(phase.get('avg_cpl', 0))
                accuracies.append(phase.get('accuracy_pct', 0))
        
        if not phases:
            return
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # CPL by phase
        colors = ['#3498db', '#9b59b6', '#e74c3c']
        ax1.bar(phases, avg_cpls, color=colors, alpha=0.7, edgecolor='black')
        ax1.set_ylabel('Average CPL', fontsize=11, fontweight='bold')
        ax1.set_title('Average Centipawn Loss by Game Phase', fontsize=12, fontweight='bold')
        ax1.grid(axis='y', alpha=0.3, linestyle='--')
        for i, v in enumerate(avg_cpls):
            ax1.text(i, v + 0.1, f'{v:.2f}', ha='center', va='bottom', fontweight='bold')
        
        # Accuracy by phase
        ax2.bar(phases, accuracies, color=colors, alpha=0.7, edgecolor='black')
        ax2.set_ylabel('Accuracy %', fontsize=11, fontweight='bold')
        ax2.set_title('Accuracy Percentage by Game Phase', fontsize=12, fontweight='bold')
        ax2.set_ylim([0, 100])
        ax2.grid(axis='y', alpha=0.3, linestyle='--')
        for i, v in enumerate(accuracies):
            ax2.text(i, v + 1, f'{v:.1f}%', ha='center', va='bottom', fontweight='bold')
        
        plt.tight_layout()
        output_path = self.output_dir / 'game_phase_comparison.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"  ✓ Saved: {output_path}")

    def plot_model_comparison(self):
        """Compare models head-to-head"""
        if not MATPLOTLIB_AVAILABLE:
            return
        
        models_data = self.data.get('head_to_head_comparison', {})
        
        if len(models_data) < 2:
            print("  ⚠️  Skipping model comparison (need 2+ models)")
            return
        
        models = list(models_data.keys())
        avg_cpls = [models_data[m]['avg_cpl'] for m in models]
        accuracies = [models_data[m]['accuracy_pct'] for m in models]
        blunders = [models_data[m]['blunders'] for m in models]
        
        fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(16, 5))
        
        colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12']
        
        # Average CPL
        ax1.bar(range(len(models)), avg_cpls, color=colors[:len(models)], alpha=0.7, edgecolor='black')
        ax1.set_xticks(range(len(models)))
        ax1.set_xticklabels([m[:15] for m in models], rotation=15, ha='right')
        ax1.set_ylabel('Average CPL', fontsize=11, fontweight='bold')
        ax1.set_title('Average Centipawn Loss', fontsize=12, fontweight='bold')
        ax1.grid(axis='y', alpha=0.3, linestyle='--')
        
        # Accuracy
        ax2.bar(range(len(models)), accuracies, color=colors[:len(models)], alpha=0.7, edgecolor='black')
        ax2.set_xticks(range(len(models)))
        ax2.set_xticklabels([m[:15] for m in models], rotation=15, ha='right')
        ax2.set_ylabel('Accuracy %', fontsize=11, fontweight='bold')
        ax2.set_title('Overall Accuracy', fontsize=12, fontweight='bold')
        ax2.set_ylim([0, 100])
        ax2.grid(axis='y', alpha=0.3, linestyle='--')
        
        # Blunders
        ax3.bar(range(len(models)), blunders, color=colors[:len(models)], alpha=0.7, edgecolor='black')
        ax3.set_xticks(range(len(models)))
        ax3.set_xticklabels([m[:15] for m in models], rotation=15, ha='right')
        ax3.set_ylabel('Blunder Count', fontsize=11, fontweight='bold')
        ax3.set_title('Total Blunders (>10 CPL)', fontsize=12, fontweight='bold')
        ax3.grid(axis='y', alpha=0.3, linestyle='--')
        
        plt.tight_layout()
        output_path = self.output_dir / 'model_comparison.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"  ✓ Saved: {output_path}")

    def plot_cpl_timeline(self):
        """Plot CPL over the course of the game"""
        if not MATPLOTLIB_AVAILABLE:
            return
        
        raw_moves = self.data.get('raw_moves', [])
        if not raw_moves:
            return
        
        move_numbers = [m.get('moveNumber', i+1) for i, m in enumerate(raw_moves)]
        cpl_values = [float(m.get('cpLoss', 0)) for m in raw_moves]
        colors_list = [m.get('playerColor', 'white') for m in raw_moves]
        
        # Separate by color
        white_moves = [(move_numbers[i], cpl_values[i]) for i in range(len(raw_moves)) if colors_list[i] == 'white']
        black_moves = [(move_numbers[i], cpl_values[i]) for i in range(len(raw_moves)) if colors_list[i] == 'black']
        
        plt.figure(figsize=(14, 6))
        
        if white_moves:
            white_x, white_y = zip(*white_moves)
            plt.scatter(white_x, white_y, color='#ecf0f1', edgecolor='black', s=60, alpha=0.8, label='White', zorder=3)
        
        if black_moves:
            black_x, black_y = zip(*black_moves)
            plt.scatter(black_x, black_y, color='#34495e', edgecolor='black', s=60, alpha=0.8, label='Black', zorder=3)
        
        # Add trend line
        plt.plot(move_numbers, cpl_values, color='#3498db', alpha=0.3, linewidth=1, zorder=1)
        
        # Highlight blunders
        blunders = [(move_numbers[i], cpl_values[i]) for i in range(len(raw_moves)) if cpl_values[i] > 10.0]
        if blunders:
            blunder_x, blunder_y = zip(*blunders)
            plt.scatter(blunder_x, blunder_y, color='red', s=200, alpha=0.3, marker='o', 
                       label='Blunder', zorder=2)
        
        plt.xlabel('Move Number', fontsize=12, fontweight='bold')
        plt.ylabel('Centipawn Loss', fontsize=12, fontweight='bold')
        plt.title('CPL Timeline Throughout the Game', fontsize=14, fontweight='bold')
        plt.legend(loc='upper right', fontsize=10)
        plt.grid(True, alpha=0.3, linestyle='--')
        plt.tight_layout()
        
        output_path = self.output_dir / 'cpl_timeline.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"  ✓ Saved: {output_path}")

    def generate_all_charts(self):
        """Generate all available visualizations"""
        if not MATPLOTLIB_AVAILABLE:
            print("\n❌ Cannot generate charts: matplotlib not installed")
            print("   Install with: pip install matplotlib seaborn")
            return
        
        print(f"\n📊 Generating visualizations...")
        print(f"   Output directory: {self.output_dir}")
        
        self.plot_accuracy_distribution()
        self.plot_game_phase_comparison()
        self.plot_model_comparison()
        self.plot_cpl_timeline()
        
        print(f"\n✓ All charts saved to: {self.output_dir}\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python visualize_research.py <paper_data.json>")
        print("\nExample:")
        print("  python visualize_research.py research-match-123_paper.json")
        print("\nNote: This requires the paper-format JSON output from analyze_research.py")
        print("      Run with --paper flag first: python analyze_research.py data.json --paper")
        sys.exit(1)

    paper_file = sys.argv[1]
    
    if not Path(paper_file).exists():
        print(f"❌ Error: File '{paper_file}' not found")
        sys.exit(1)

    try:
        visualizer = ChessVisualizer(paper_file)
        visualizer.generate_all_charts()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
