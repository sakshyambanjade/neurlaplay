#!/usr/bin/env python3
"""
Generate all 8 publication figures for the chess LLM research paper.
Figures 1-3: Already generated (fallback rate, failure modes, binding profile)
Figures 4-8: New strategic analysis figures
"""

import json
import sys
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, 'research/tension')
from tension_graph import compute_tension

# Publication style
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

def load_datapoints(json_path):
    """Load position-level datapoints with move-level metrics."""
    with open(json_path, 'r') as f:
        return json.load(f)

def load_tension_data(tension_path='research/tension_computed.json'):
    """Load precomputed spectral tension (λ_max) values."""
    with open(tension_path, 'r') as f:
        return json.load(f)

def attach_tension_to_datapoints(datapoints, tension_data):
    """
    Align λ_max values onto datapoints.
    Supports either list-aligned data or fen-keyed dict/list entries.
    """
    def extract(entry):
        if isinstance(entry, dict):
            if 'T' in entry:
                return entry['T']
            if 'tension' in entry:
                return entry['tension']
            if 'lambda' in entry:
                return entry['lambda']
        return entry

    # If data is a list with same length, align by index.
    if isinstance(tension_data, list) and len(tension_data) == len(datapoints):
        for dp, td in zip(datapoints, tension_data):
            dp['tension'] = extract(td)
        return

    # If dict keyed by FEN.
    if isinstance(tension_data, dict):
        for dp in datapoints:
            fen_key = dp.get('fenAfter') or dp.get('fenBefore')
            if fen_key and fen_key in tension_data:
                dp['tension'] = extract(tension_data[fen_key])
        return

    # If list of dicts with fen keys.
    if isinstance(tension_data, list) and tension_data and isinstance(tension_data[0], dict):
        lookup = {}
        for entry in tension_data:
            fen_key = entry.get('fen') or entry.get('fenAfter') or entry.get('fenBefore')
            if fen_key:
                lookup[fen_key] = extract(entry)
        if lookup:
            for dp in datapoints:
                fen_key = dp.get('fenAfter') or dp.get('fenBefore')
                if fen_key in lookup:
                    dp['tension'] = lookup[fen_key]
            return

    raise ValueError("Unable to align tension data with datapoints; check tension_computed.json format.")

def figure4_tension_distribution(datapoints, output_path):
    """
    Figure 4: Strategic Tension Score Distribution
    Uses spectral tension (λ_max) computed from tension_graph.
    """
    tensions = [dp['tension'] for dp in datapoints if dp.get('tension') is not None]
    
    # Cap extreme outliers for better visualization
    tensions_capped = [min(t, 1000) for t in tensions]
    
    fig, ax = plt.subplots(figsize=(12, 7))
    
    # Create histogram with KDE overlay
    n, bins, patches = ax.hist(tensions_capped, bins=50, density=True, 
                                alpha=0.7, color='#3498db', edgecolor='black', linewidth=0.5)
    
    # Add KDE curve
    from scipy.stats import gaussian_kde
    kde = gaussian_kde(tensions_capped)
    x_range = np.linspace(min(tensions_capped), max(tensions_capped), 200)
    ax.plot(x_range, kde(x_range), 'r-', linewidth=2, label='KDE')
    
    ax.set_xlabel('Strategic Tension Score (λ_max)', fontweight='bold')
    ax.set_ylabel('Density', fontweight='bold')
    ax.set_title('Strategic Tension Score Distribution Across All Positions', fontweight='bold', pad=20)
    ax.legend()
    ax.grid(alpha=0.3, linestyle='--')
    
    # Add statistics box
    stats_text = f'Mean: {np.mean(tensions_capped):.1f}\\nMedian: {np.median(tensions_capped):.1f}\\nStd: {np.std(tensions_capped):.1f}'
    ax.text(0.95, 0.95, stats_text, transform=ax.transAxes,
            fontsize=10, verticalalignment='top', horizontalalignment='right',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 4 saved: {output_path}")

def figure5_accuracy_vs_tension(datapoints, output_path):
    """
    Figure 5: Model Accuracy vs. Strategic Tension Score
    Shows how model success rate varies with position complexity
    """
    # Group by model and tension bins
    model_data = defaultdict(lambda: defaultdict(lambda: {'valid': 0, 'total': 0}))
    
    # Define tension bins (λ_max ranges)
    bins = [0, 50, 100, 200, 400, 800, 10000]
    bin_labels = ['0-50', '50-100', '100-200', '200-400', '400-800', '800+']
    
    for dp in datapoints:
        model = dp.get('model', '').split(':')[0]
        tension = dp.get('tension', 0)
        
        # Determine bin
        bin_idx = np.digitize([tension], bins)[0] - 1
        if bin_idx >= len(bin_labels):
            bin_idx = len(bin_labels) - 1
        
        bin_label = bin_labels[bin_idx]
        
        # Check if move was valid (reasoning doesn't contain "invalid" or "timeout")
        reasoning = dp.get('reasoning', '').lower()
        is_valid = 'invalid' not in reasoning and 'timeout' not in reasoning
        
        model_data[model][bin_label]['total'] += 1
        if is_valid:
            model_data[model][bin_label]['valid'] += 1
    
    # Calculate accuracy for each model/bin
    fig, ax = plt.subplots(figsize=(12, 7))
    
    colors = {'tinyllama': '#e74c3c', 'phi3': '#3498db', 'mistral': '#2ecc71'}
    markers = {'tinyllama': 'o', 'phi3': 's', 'mistral': '^'}
    
    for model in sorted(model_data.keys()):
        accuracies = []
        for bin_label in bin_labels:
            stats = model_data[model][bin_label]
            if stats['total'] > 0:
                acc = (stats['valid'] / stats['total']) * 100
            else:
                acc = 0
            accuracies.append(acc)
        
        ax.plot(bin_labels, accuracies, marker=markers.get(model, 'o'), 
                linewidth=2, markersize=8, label=model.capitalize(),
                color=colors.get(model, '#000000'))
    
    ax.set_xlabel('Strategic Tension Score (λ_max bins)', fontweight='bold')
    ax.set_ylabel('Valid Move Generation Rate (%)', fontweight='bold')
    ax.set_title('Model Accuracy vs. Strategic Tension Score', fontweight='bold', pad=20)
    ax.legend(title='Model', frameon=True, shadow=True)
    ax.grid(alpha=0.3, linestyle='--')
    ax.set_ylim(0, 100)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 5 saved: {output_path}")

def figure6_tension_by_phase(datapoints, output_path):
    """
    Figure 6: Strategic Tension Across Game Phases
    Shows mean tension in opening, middlegame, endgame
    """
    phase_cpls = defaultdict(list)
    
    for dp in datapoints:
        phase = dp.get('gamePhase', 'unknown')
        tension = dp.get('tension')
        if tension is not None:
            phase_cpls[phase].append(min(tension, 1000))  # Cap outliers
    
    phases = ['opening', 'middlegame', 'endgame']
    means = [np.mean(phase_cpls[p]) if phase_cpls[p] else 0 for p in phases]
    stds = [np.std(phase_cpls[p]) if phase_cpls[p] else 0 for p in phases]
    
    fig, ax = plt.subplots(figsize=(10, 7))
    
    colors = ['#3498db', '#e74c3c', '#2ecc71']
    bars = ax.bar(phases, means, yerr=stds, capsize=10, 
                   color=colors, edgecolor='black', linewidth=1.5, alpha=0.8)
    
    ax.set_ylabel('Mean Strategic Tension Score (λ_max)', fontweight='bold')
    ax.set_title('Strategic Tension Across Game Phases', fontweight='bold', pad=20)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    
    # Add value labels on bars
    for bar, mean, std in zip(bars, means, stds):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, height + std + 10,
                f'{mean:.1f}±{std:.1f}', ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 6 saved: {output_path}")

def figure7_failure_modes_per_model(games, output_path):
    """
    Figure 7: Failure Mode Breakdown Per Model
    Grouped/stacked bar chart of failure modes by model
    """
    model_failures = defaultdict(lambda: defaultdict(int))
    
    for game in games:
        audit = game.get('ruleAudit', {})
        modes = audit.get('invalidMoveFailureModes', {})
        
        # Attribute failures to both models (approximate split)
        white = game.get('whiteModel', '').split(':')[0]
        black = game.get('blackModel', '').split(':')[0]
        
        for mode, count in modes.items():
            model_failures[white][mode] += count // 2
            model_failures[black][mode] += count - (count // 2)
    
    # Prepare data
    mode_labels = {
        'timeout_or_abort': 'Timeout/Abort',
        'unparseable': 'Unparseable',
        'wrong_format': 'Wrong Format',
        'pseudo_legal_or_illegal': 'Illegal Move',
        'empty_output': 'Empty Output',
        'request_failed': 'Request Failed',
        'non_chess_text': 'Non-Chess'
    }
    
    models = sorted(model_failures.keys())
    modes = sorted(set(k for m in model_failures.values() for k in m.keys()))
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    x = np.arange(len(modes))
    width = 0.25
    colors = ['#e74c3c', '#3498db', '#2ecc71']
    
    for i, model in enumerate(models):
        counts = [model_failures[model].get(mode, 0) for mode in modes]
        offset = (i - len(models)/2 + 0.5) * width
        ax.bar(x + offset, counts, width, label=model.capitalize(),
               color=colors[i], edgecolor='black', linewidth=1)
    
    labels = [mode_labels.get(m, m.replace('_', ' ').title()) for m in modes]
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=45, ha='right')
    ax.set_ylabel('Failure Count', fontweight='bold')
    ax.set_title('Failure Mode Breakdown by Model', fontweight='bold', pad=20)
    ax.legend(title='Model', frameon=True, shadow=True)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 7 saved: {output_path}")

def figure8_legal_constraint_gap(games, output_path):
    """
    Figure 8: Legal Constraint Comprehension Gap
    Focused comparison of Piece vs. Legal Constraint binding
    """
    model_binding = defaultdict(lambda: {'piece': 0, 'legalConstraint': 0, 'total': 0})
    
    for game in games:
        audit = game.get('ruleAudit', {})
        binding_hits = audit.get('bindingComponentHits', {})
        binding_attempts = audit.get('bindingAttemptCount', 0)
        
        if binding_attempts == 0:
            continue
        
        white = game.get('whiteModel', '').split(':')[0]
        black = game.get('blackModel', '').split(':')[0]
        
        # Split between models
        for model in [white, black]:
            model_binding[model]['piece'] += binding_hits.get('piece', 0) // 2
            model_binding[model]['legalConstraint'] += binding_hits.get('legalConstraint', 0) // 2
            model_binding[model]['total'] += binding_attempts // 2
    
    # Calculate percentages
    models = sorted(model_binding.keys())
    piece_rates = []
    legal_rates = []
    
    for model in models:
        total = model_binding[model]['total']
        if total > 0:
            piece_rates.append((model_binding[model]['piece'] / total) * 100)
            legal_rates.append((model_binding[model]['legalConstraint'] / total) * 100)
        else:
            piece_rates.append(0)
            legal_rates.append(0)
    
    # Create grouped bar chart
    fig, ax = plt.subplots(figsize=(10, 8))
    
    x = np.arange(len(models))
    width = 0.35
    
    bars1 = ax.bar(x - width/2, piece_rates, width, label='Piece Identification',
                   color='#2ecc71', edgecolor='black', linewidth=1.5)
    bars2 = ax.bar(x + width/2, legal_rates, width, label='Legal Constraint',
                   color='#e74c3c', edgecolor='black', linewidth=1.5)
    
    ax.set_ylabel('Binding Success Rate (%)', fontweight='bold')
    ax.set_title('Legal Constraint Comprehension Gap:\\nModels Identify Pieces But Ignore Chess Rules',
                 fontweight='bold', pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels([m.capitalize() for m in models])
    ax.legend(frameon=True, shadow=True)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    
    # Add value labels
    for bars in [bars1, bars2]:
        for bar in bars:
            height = bar.get_height()
            if height > 1:
                ax.text(bar.get_x() + bar.get_width()/2, height + 1,
                       f'{height:.1f}%', ha='center', va='bottom', fontweight='bold')
    
    # Add gap annotation
    avg_gap = np.mean(piece_rates) - np.mean(legal_rates)
    ax.annotate(f'Average Gap: {avg_gap:.1f}%',
                xy=(len(models)/2, max(piece_rates)/2),
                fontsize=12, fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.3))
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Figure 8 saved: {output_path}")

def main():
    print("🎨 Generating Figures 4-8 for publication...\n")
    
    # Load data
    print("📂 Loading data...")
    jsonl_path = Path('logs/games-2026-03-08T05-38-03.jsonl')
    datapoints_path = Path('archive/20260307-235227/paper-datapoints.json')
    
    games = []
    if jsonl_path.exists():
        games = load_games_from_jsonl(jsonl_path)
        print(f"   ✓ Loaded {len(games)} games from JSONL")
    
    datapoints = []
    if datapoints_path.exists():
        datapoints = load_datapoints(datapoints_path)
        print(f"   ✓ Loaded {len(datapoints)} position datapoints")
    
    tension_data = []
    tension_path = Path('research/tension_computed.json')
    if tension_path.exists():
        tension_data = load_tension_data(tension_path)
        print(f"   ✓ Loaded {len(tension_data)} tension datapoints from {tension_path}")
    else:
        print("❌ Missing tension data file: research/tension_computed.json")

    if not games or not datapoints or not tension_data:
        print("❌ Missing required data files!")
        return

    attach_tension_to_datapoints(datapoints, tension_data)
    print("   ✓ Attached spectral tension (λ_max) to datapoints")
    
    # Create output directory
    output_dir = Path('plots')
    output_dir.mkdir(exist_ok=True)
    
    print(f"\n📊 Generating figures...")
    
    # Generate figures 4-8
    figure4_tension_distribution(datapoints, output_dir / 'fig4_tension_distribution.png')
    figure5_accuracy_vs_tension(datapoints, output_dir / 'fig5_accuracy_vs_tension.png')
    figure6_tension_by_phase(datapoints, output_dir / 'fig6_tension_by_phase.png')
    figure7_failure_modes_per_model(games, output_dir / 'fig7_failures_per_model.png')
    figure8_legal_constraint_gap(games, output_dir / 'fig8_legal_constraint_gap.png')
    
    print(f"\n✨ All figures (4-8) generated successfully!")
    print(f"\nComplete figure set now includes:")
    print("  Fig 1: Fallback Rate Bar Chart")
    print("  Fig 2: Failure Mode Distribution")
    print("  Fig 3: Binding Component Profile")
    print("  Fig 4: Strategic Tension Distribution")
    print("  Fig 5: Model Accuracy vs. Tension Score ⭐")
    print("  Fig 6: Tension Across Game Phases")
    print("  Fig 7: Failure Modes by Model")
    print("  Fig 8: Legal Constraint Gap ⭐")

if __name__ == '__main__':
    main()
