#!/usr/bin/env python3
"""
Generate publication-ready figures from chess research data.
Creates three core figures:
1. Fallback Rate Bar Chart (by model)
2. Failure Mode Distribution
3. Binding Profile Heatmap
"""

import json
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from collections import defaultdict
from pathlib import Path

# Set publication-quality style
plt.style.use('seaborn-v0_8-paper')
plt.rcParams['font.size'] = 11
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['xtick.labelsize'] = 10
plt.rcParams['ytick.labelsize'] = 10
plt.rcParams['legend.fontsize'] = 10
plt.rcParams['figure.titlesize'] = 14

def load_games_from_jsonl(jsonl_path):
    """Load all games from JSONL log file."""
    games = []
    with open(jsonl_path, 'r') as f:
        for line in f:
            if line.strip():
                data = json.loads(line)
                games.append(data['game'])
    return games

def load_games_from_raw_json(raw_dir):
    """Load games from raw JSON match files."""
    games = []
    raw_path = Path(raw_dir)
    
    for json_file in raw_path.glob('*.json'):
        with open(json_file, 'r') as f:
            data = json.load(f)
            games.extend(data.get('games', []))
    
    return games

def figure1_fallback_rate(games, output_path):
    """
    Figure 1: Fallback Rate Bar Chart
    Shows percentage of moves requiring fallback (illegal move correction) by model
    """
    model_stats = defaultdict(lambda: {'fallback': 0, 'total': 0})
    
    for game in games:
        audit = game.get('ruleAudit', {})
        fallback = audit.get('fallbackMovesUsed', 0)
        total = game.get('moveCount', 0)
        
        # Track both white and black models
        white = game.get('whiteModel', 'unknown')
        black = game.get('blackModel', 'unknown')
        
        # Approximate: half the moves are white, half are black
        white_moves = total // 2 + (total % 2)
        black_moves = total // 2
        
        # Distribute fallback moves proportionally (approximation)
        white_fallback = fallback * white_moves // total if total > 0 else 0
        black_fallback = fallback - white_fallback
        
        model_stats[white]['fallback'] += white_fallback
        model_stats[white]['total'] += white_moves
        model_stats[black]['fallback'] += black_fallback
        model_stats[black]['total'] += black_moves
    
    # Calculate percentages
    models = []
    percentages = []
    
    for model, stats in sorted(model_stats.items()):
        if stats['total'] > 0:
            pct = (stats['fallback'] / stats['total']) * 100
            models.append(model.split(':')[0])  # Remove tag like ':latest'
            percentages.append(pct)
    
    # Create horizontal bar chart
    fig, ax = plt.subplots(figsize=(10, 6))
    colors = ['#e74c3c', '#3498db', '#2ecc71'][:len(models)]
    
    y_pos = np.arange(len(models))
    bars = ax.barh(y_pos, percentages, color=colors, edgecolor='black', linewidth=1.2)
    
    ax.set_yticks(y_pos)
    ax.set_yticklabels(models)
    ax.set_xlabel('Fallback Rate (%)', fontweight='bold')
    ax.set_title('LLM Move Generation Fallback Rate', fontweight='bold', pad=20)
    ax.grid(axis='x', alpha=0.3, linestyle='--')
    
    # Add percentage labels on bars
    for i, (bar, pct) in enumerate(zip(bars, percentages)):
        ax.text(pct + 1, bar.get_y() + bar.get_height()/2, 
                f'{pct:.1f}%', va='center', fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 1 saved: {output_path}")

def figure2_failure_modes(games, output_path):
    """
    Figure 2: Failure Mode Distribution
    Pie chart or bar chart showing distribution of illegal move types
    """
    failure_counts = defaultdict(int)
    
    for game in games:
        audit = game.get('ruleAudit', {})
        modes = audit.get('invalidMoveFailureModes', {})
        
        for mode, count in modes.items():
            failure_counts[mode] += count
    
    # Sort by frequency
    sorted_modes = sorted(failure_counts.items(), key=lambda x: x[1], reverse=True)
    modes, counts = zip(*sorted_modes) if sorted_modes else ([], [])
    
    # Clean up mode names for display
    mode_labels = {
        'timeout_or_abort': 'Timeout/Abort',
        'unparseable': 'Unparseable Output',
        'wrong_format': 'Wrong Format',
        'pseudo_legal_or_illegal': 'Illegal Move',
        'empty_output': 'Empty Output',
        'request_failed': 'Request Failed',
        'non_chess_text': 'Non-Chess Text'
    }
    
    labels = [mode_labels.get(m, m.replace('_', ' ').title()) for m in modes]
    
    # Create bar chart (clearer than pie for many categories)
    fig, ax = plt.subplots(figsize=(12, 7))
    
    colors = plt.cm.Set3(np.linspace(0, 1, len(labels)))
    bars = ax.bar(range(len(labels)), counts, color=colors, edgecolor='black', linewidth=1.2)
    
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha='right')
    ax.set_ylabel('Frequency', fontweight='bold')
    ax.set_title('Distribution of Model Move Generation Failures', fontweight='bold', pad=20)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    
    # Add count labels on top of bars
    for bar, count in zip(bars, counts):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, height + max(counts)*0.01,
                f'{count}', ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 2 saved: {output_path}")

def figure3_binding_profile(games, output_path):
    """
    Figure 3: Binding Component Profile Heatmap
    Shows which UCI components (piece, origin, destination, legal constraint) 
    were successfully parsed in illegal move attempts, by model
    """
    model_binding = defaultdict(lambda: defaultdict(int))
    
    for game in games:
        audit = game.get('ruleAudit', {})
        binding_hits = audit.get('bindingComponentHits', {})
        binding_attempts = audit.get('bindingAttemptCount', 0)
        
        if binding_attempts == 0:
            continue
        
        white = game.get('whiteModel', 'unknown').split(':')[0]
        black = game.get('blackModel', 'unknown').split(':')[0]
        
        # Distribute binding hits equally between models (approximation)
        for component, hits in binding_hits.items():
            model_binding[white][component] += hits // 2
            model_binding[black][component] += hits - (hits // 2)
    
    # Prepare data for heatmap
    models = sorted(model_binding.keys())
    components = ['piece', 'origin', 'destination', 'legalConstraint']
    
    # Create matrix
    matrix = []
    for model in models:
        row = [model_binding[model].get(comp, 0) for comp in components]
        matrix.append(row)
    
    matrix = np.array(matrix)
    
    # Normalize to percentages if needed
    row_sums = matrix.sum(axis=1, keepdims=True)
    matrix_pct = np.divide(matrix, row_sums, where=row_sums!=0) * 100
    
    # Create grouped bar chart (clearer than heatmap for small dataset)
    fig, ax = plt.subplots(figsize=(12, 7))
    
    x = np.arange(len(components))
    width = 0.25
    colors = ['#e74c3c', '#3498db', '#2ecc71']
    
    for i, (model, color) in enumerate(zip(models, colors[:len(models)])):
        offset = (i - len(models)/2 + 0.5) * width
        bars = ax.bar(x + offset, matrix_pct[i], width, label=model, 
                     color=color, edgecolor='black', linewidth=1.2)
        
        # Add percentage labels
        for bar, pct in zip(bars, matrix_pct[i]):
            height = bar.get_height()
            if pct > 1:  # Only label if visible
                ax.text(bar.get_x() + bar.get_width()/2, height + 1,
                       f'{pct:.0f}%', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    component_labels = ['Piece', 'Origin', 'Destination', 'Legal Constraint']
    ax.set_xticks(x)
    ax.set_xticklabels(component_labels)
    ax.set_ylabel('Binding Success Rate (%)', fontweight='bold')
    ax.set_title('UCI Binding Component Presence in Illegal Move Attempts', fontweight='bold', pad=20)
    ax.legend(title='Model', frameon=True, shadow=True)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 3 saved: {output_path}")

def main():
    # Find game data
    jsonl_path = Path('logs/games-2026-03-08T05-38-03.jsonl')
    raw_dirs = list(Path('..').glob('server/research/runs/*/raw'))
    
    print("🔍 Loading game data...")
    
    # Try JSONL first, then raw JSON files
    games = []
    if jsonl_path.exists():
        games = load_games_from_jsonl(jsonl_path)
        print(f"   Loaded {len(games)} games from JSONL")
    
    if not games and raw_dirs:
        for raw_dir in raw_dirs:
            games.extend(load_games_from_raw_json(raw_dir))
        print(f"   Loaded {len(games)} games from raw JSON")
    
    if not games:
        print("❌ No game data found!")
        return
    
    # Create output directory
    output_dir = Path('plots')
    output_dir.mkdir(exist_ok=True)
    
    print(f"\n📊 Generating figures from {len(games)} games...")
    
    # Generate all three figures
    figure1_fallback_rate(games, output_dir / 'fig1_fallback_rate.png')
    figure2_failure_modes(games, output_dir / 'fig2_failure_modes.png')
    figure3_binding_profile(games, output_dir / 'fig3_binding_profile.png')
    
    print(f"\n✨ All figures generated successfully in {output_dir}/")
    print("\nFigure Summary:")
    print("  - fig1_fallback_rate.png: Model fallback rates")
    print("  - fig2_failure_modes.png: Failure mode distribution")
    print("  - fig3_binding_profile.png: UCI binding component analysis")

if __name__ == '__main__':
    main()
