"""
LLM Chess Research Visualizations
Generates publication-quality plots from paper results
"""

import json
import sys
from pathlib import Path

try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    import numpy as np
except ImportError:
    print("⚠️  Required packages not installed. Install with:")
    print("   pip install matplotlib seaborn numpy")
    sys.exit(1)

# Set style for publication quality
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 300
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['figure.figsize'] = (10, 6)

def load_results():
    """Load paper results from JSON"""
    results_path = Path(__file__).parent / 'paper-results.json'
    
    if not results_path.exists():
        print(f"❌ Results file not found: {results_path}")
        print("   Run a research batch first!")
        sys.exit(1)
    
    with open(results_path) as f:
        return json.load(f)

def plot_win_rates(data, output_dir):
    """Create win rate comparison bar chart"""
    fig, ax = plt.subplots(figsize=(10, 6))
    
    models = ['White (TinyLlama)', 'Black (Phi3)', 'Draws']
    values = [data['whiteWins'], data['blackWins'], data['draws']]
    colors = ['#3498db', '#e74c3c', '#95a5a6']
    
    bars = ax.bar(models, values, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
    
    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)}',
                ha='center', va='bottom', fontweight='bold', fontsize=12)
    
    ax.set_ylabel('Number of Games Won', fontsize=12, fontweight='bold')
    ax.set_title(f'LLM Chess Performance ({data["totalGames"]} games)', 
                 fontsize=14, fontweight='bold', pad=20)
    ax.set_ylim(0, max(values) * 1.2)
    
    # Add grid
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)
    
    plt.tight_layout()
    output_path = output_dir / 'win_rates.png'
    plt.savefig(output_path, bbox_inches='tight')
    print(f"✅ Saved: {output_path}")
    plt.close()

def plot_cpl_comparison(data, output_dir):
    """Create CPL comparison chart"""
    fig, ax = plt.subplots(figsize=(8, 6))
    
    models = ['White\n(TinyLlama)', 'Black\n(Phi3)']
    cpl_values = [data['avgCPL']['white'], data['avgCPL']['black']]
    colors = ['#3498db', '#e74c3c']
    
    bars = ax.barh(models, cpl_values, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
    
    # Add value labels
    for i, (bar, val) in enumerate(zip(bars, cpl_values)):
        ax.text(val + 1, i, f'{val:.1f}', 
                va='center', fontweight='bold', fontsize=11)
    
    ax.set_xlabel('Average Centipawn Loss (CPL)', fontsize=12, fontweight='bold')
    ax.set_title('Move Quality Comparison (Lower is Better)', 
                 fontsize=14, fontweight='bold', pad=20)
    ax.set_xlim(0, max(cpl_values) * 1.3)
    
    # Add grid
    ax.grid(axis='x', alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)
    
    plt.tight_layout()
    output_path = output_dir / 'cpl_comparison.png'
    plt.savefig(output_path, bbox_inches='tight')
    print(f"✅ Saved: {output_path}")
    plt.close()

def plot_game_phase_performance(data, output_dir):
    """Create game phase accuracy chart"""
    fig, ax = plt.subplots(figsize=(10, 6))
    
    phases = ['Opening\n(Moves 1-15)', 'Midgame\n(Moves 16-50)', 'Endgame\n(Moves 51+)']
    accuracies = [
        data['phasePerformance']['openingAccuracy'],
        data['phasePerformance']['midgameAccuracy'],
        data['phasePerformance']['endgameAccuracy']
    ]
    colors = ['#2ecc71', '#f39c12', '#9b59b6']
    
    bars = ax.bar(phases, accuracies, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
    
    # Add value labels
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.1f}%',
                ha='center', va='bottom', fontweight='bold', fontsize=11)
    
    ax.set_ylabel('Accuracy (%)', fontsize=12, fontweight='bold')
    ax.set_title('Performance Across Game Phases', 
                 fontsize=14, fontweight='bold', pad=20)
    ax.set_ylim(0, 100)
    
    # Add grid
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)
    
    plt.tight_layout()
    output_path = output_dir / 'phase_performance.png'
    plt.savefig(output_path, bbox_inches='tight')
    print(f"✅ Saved: {output_path}")
    plt.close()

def plot_summary_stats(data, output_dir):
    """Create summary statistics panel"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(12, 10))
    
    # 1. Win Rate Pie Chart
    sizes = [data['whiteWins'], data['blackWins'], data['draws']]
    labels = ['White Wins', 'Black Wins', 'Draws']
    colors = ['#3498db', '#e74c3c', '#95a5a6']
    explode = (0.05, 0.05, 0.05)
    
    ax1.pie(sizes, explode=explode, labels=labels, colors=colors, autopct='%1.1f%%',
            shadow=True, startangle=90, textprops={'fontweight': 'bold'})
    ax1.set_title('Game Outcomes', fontweight='bold', fontsize=12)
    
    # 2. Average Game Length
    ax2.bar(['Avg Moves'], [data['avgMoves']], color='#1abc9c', alpha=0.8, edgecolor='black', linewidth=1.5)
    ax2.text(0, data['avgMoves'], f"{data['avgMoves']:.1f}", 
             ha='center', va='bottom', fontweight='bold', fontsize=14)
    ax2.set_ylabel('Number of Moves', fontweight='bold')
    ax2.set_title('Average Game Length', fontweight='bold', fontsize=12)
    ax2.set_ylim(0, data['avgMoves'] * 1.3)
    ax2.grid(axis='y', alpha=0.3, linestyle='--')
    
    # 3. Blunder Statistics
    blunder_rate_pct = data['blunderRate'] * 100
    ax3.bar(['Blunder Rate'], [blunder_rate_pct], color='#e67e22', alpha=0.8, edgecolor='black', linewidth=1.5)
    ax3.text(0, blunder_rate_pct, f"{blunder_rate_pct:.2f}%", 
             ha='center', va='bottom', fontweight='bold', fontsize=14)
    ax3.set_ylabel('Percentage (%)', fontweight='bold')
    ax3.set_title('Blunder Rate (CPL > 200)', fontweight='bold', fontsize=12)
    ax3.set_ylim(0, max(blunder_rate_pct * 1.5, 5))
    ax3.grid(axis='y', alpha=0.3, linestyle='--')
    
    # 4. Game Duration
    ax4.bar(['Avg Duration'], [data['avgGameDuration']], color='#8e44ad', alpha=0.8, edgecolor='black', linewidth=1.5)
    ax4.text(0, data['avgGameDuration'], f"{data['avgGameDuration']:.1f}s", 
             ha='center', va='bottom', fontweight='bold', fontsize=14)
    ax4.set_ylabel('Seconds', fontweight='bold')
    ax4.set_title('Average Game Duration', fontweight='bold', fontsize=12)
    ax4.set_ylim(0, data['avgGameDuration'] * 1.3)
    ax4.grid(axis='y', alpha=0.3, linestyle='--')
    
    plt.suptitle(f'LLM Chess Research Summary ({data["totalGames"]} games)', 
                 fontsize=16, fontweight='bold', y=1.00)
    plt.tight_layout()
    
    output_path = output_dir / 'summary_stats.png'
    plt.savefig(output_path, bbox_inches='tight')
    print(f"✅ Saved: {output_path}")
    plt.close()

def main():
    """Main execution"""
    print("\n📊 Generating LLM Chess Research Visualizations...")
    print("=" * 50)
    
    # Load data
    data = load_results()
    print(f"📁 Loaded results: {data['totalGames']} games")
    
    # Create output directory
    output_dir = Path(__file__).parent / 'plots'
    output_dir.mkdir(exist_ok=True)
    print(f"📂 Output directory: {output_dir}\n")
    
    # Generate plots
    plot_win_rates(data, output_dir)
    plot_cpl_comparison(data, output_dir)
    plot_game_phase_performance(data, output_dir)
    plot_summary_stats(data, output_dir)
    
    print("\n" + "=" * 50)
    print("🎉 All visualizations generated successfully!")
    print(f"📁 Check: {output_dir}/")
    print("\nReady to include in your paper! 📄\n")

if __name__ == '__main__':
    main()
