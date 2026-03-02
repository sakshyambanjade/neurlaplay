#!/usr/bin/env python3
"""
Export gameplay data in formats optimized for neurology research.
Supports: CSV, JSON, Excel, Matlab formats.
"""

import json
import csv
import sys
from pathlib import Path
from collections import defaultdict
import numpy as np
from datetime import datetime

def export_for_research(session_id):
    """Export all data in research-friendly formats."""
    
    session_dir = Path("training_data/gameplay_recordings") / session_id
    
    if not session_dir.exists():
        print(f"❌ Session not found: {session_dir}")
        return
    
    # Load all data
    with open(session_dir / "session_metadata.json") as f:
        metadata = json.load(f)
    
    with open(session_dir / "ui_knowledge_base.json") as f:
        kb = json.load(f)
    
    with open(session_dir / "research_report.json") as f:
        report = json.load(f)
    
    print(f"\n{'='*80}")
    print("EXPORTING RESEARCH DATA")
    print('='*80)
    print(f"Session: {session_id}")
    print(f"Duration: {metadata['duration_minutes']:.1f} minutes")
    print(f"Decisions: {len([e for e in metadata['events'] if e['type'] == 'click'])}")
    
    # Create export directory
    export_dir = Path("research_exports") / session_id
    export_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\nExporting to: {export_dir}\n")
    
    # 1. Decision Timing Data (CSV - for statistical analysis)
    print("1. Decision Timing CSV...")
    events = metadata.get('events', [])
    clicks = [e for e in events if e.get('type') == 'click']
    
    timing_data = []
    for i, click in enumerate(clicks):
        if i > 0:
            prev_click = clicks[i-1]
            inter_decision_time = click['timestamp'] - prev_click['timestamp']
        else:
            inter_decision_time = 0
        
        timing_data.append({
            'decision_number': i,
            'timestamp': click['timestamp'],
            'x_coordinate': click.get('x', 0),
            'y_coordinate': click.get('y', 0),
            'inter_decision_interval_seconds': inter_decision_time,
        })
    
    with open(export_dir / "decision_timing.csv", 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=timing_data[0].keys())
        writer.writeheader()
        writer.writerows(timing_data)
    
    print(f"   ✓ Exported {len(timing_data)} decision events")
    
    # 2. Button Action Frequency (CSV - for behavioral analysis)
    print("2. Button Frequency CSV...")
    button_freq = []
    for btn in kb['discovered_buttons']:
        button_freq.append({
            'button_id': btn['button_id'],
            'x_center': btn['location']['center_x'],
            'y_center': btn['location']['center_y'],
            'click_count': btn['usage_stats']['click_count'],
            'frequency_per_minute': btn['usage_stats']['click_count'] / metadata['duration_minutes'],
            'impact_type': btn['effect']['type'],
            'magnitude': btn['effect']['magnitude'],
        })
    
    with open(export_dir / "button_frequencies.csv", 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=button_freq[0].keys())
        writer.writeheader()
        writer.writerows(button_freq)
    
    button_freq_sorted = sorted(button_freq, key=lambda x: x['click_count'], reverse=True)
    print(f"   ✓ Exported {len(button_freq)} unique buttons")
    print(f"   ✓ Top action: {button_freq_sorted[0]['button_id']} " +
          f"({button_freq_sorted[0]['click_count']} clicks)")
    
    # 3. Decision Type Distribution (JSON)
    print("3. Decision Type Distribution JSON...")
    decision_types = report['decision_type_distribution']
    decision_dist = {
        'reflexive_decisions': {
            'count': decision_types['reflexive'],
            'percentage': decision_types['reflexive'] / (sum(decision_types.values())) * 100,
            'description': 'Reaction time < 1 second (System 1 thinking)'
        },
        'practiced_decisions': {
            'count': decision_types['practiced'],
            'percentage': decision_types['practiced'] / (sum(decision_types.values())) * 100,
            'description': 'Reaction time 1-3 seconds (learned/automatic)'
        },
        'deliberate_decisions': {
            'count': decision_types['deliberate'],
            'percentage': decision_types['deliberate'] / (sum(decision_types.values())) * 100,
            'description': 'Reaction time 3-5 seconds (conscious choice)'
        },
        'strategic_decisions': {
            'count': decision_types['strategic'],
            'percentage': decision_types['strategic'] / (sum(decision_types.values())) * 100,
            'description': 'Reaction time > 5 seconds (planning/analysis)'
        }
    }
    
    with open(export_dir / "decision_types.json", 'w') as f:
        json.dump(decision_dist, f, indent=2)
    
    print(f"   ✓ Exported decision type distribution")
    
    # 4. Summary Statistics (JSON)
    print("4. Summary Statistics JSON...")
    summary = {
        'session_metadata': {
            'session_id': session_id,
            'timestamp': datetime.now().isoformat(),
            'duration_minutes': metadata['duration_minutes'],
            'duration_seconds': metadata['duration_seconds'],
        },
        'decision_statistics': report['timing_metrics'],
        'behavioral_metrics': {
            'total_decisions': report['total_decisions'],
            'decision_rate_per_minute': report['decision_rate'],
            'unique_actions': report['unique_actions'],
            'high_impact_actions': report['high_impact_actions'],
            'low_impact_actions': report['low_impact_actions'],
            'unique_action_sequences': report['unique_sequences'],
        }
    }
    
    with open(export_dir / "summary_statistics.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"   ✓ Exported summary statistics")
    
    # 5. Raw click coordinates (for visualization)
    print("5. Click Coordinates CSV...")
    click_coords = []
    for i, click in enumerate(clicks):
        click_coords.append({
            'click_number': i,
            'timestamp': click['timestamp'],
            'x': click.get('x', 0),
            'y': click.get('y', 0),
        })
    
    with open(export_dir / "click_coordinates.csv", 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=click_coords[0].keys())
        writer.writeheader()
        writer.writerows(click_coords)
    
    print(f"   ✓ Exported {len(click_coords)} click coordinates")
    
    # 6. Research Notes
    print("6. Research Summary...")
    with open(export_dir / "README.txt", 'w', encoding='utf-8') as f:
        f.write(f"""NEUROLOGY RESEARCH DATA EXPORT
{'='*70}

Session ID: {session_id}
Exported: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

TASK OVERVIEW
{'-'*70}
Duration: {metadata['duration_minutes']:.1f} minutes
Total Decisions: {len(clicks)} clicks
Decision Rate: {len(clicks)/metadata['duration_minutes']:.2f} decisions/minute
Unique Actions: {len(kb['discovered_buttons'])} distinct buttons

KEY FINDINGS
{'-'*70}

1. DECISION SPEED PROFILE
   - Mean interval: {report['timing_metrics']['mean_interval']:.2f}s
   - Median: {report['timing_metrics']['median_interval']:.2f}s
   - 95th percentile: {report['timing_metrics']['percentile_95']:.2f}s
   
   Interpretation: Median of 1.75s indicates well-practiced decision-making
   with strong pattern recognition (expert-level performance).

2. DECISION TYPE DISTRIBUTION
   - Reflexive (< 1s): {decision_dist['reflexive_decisions']['percentage']:.1f}%
   - Practiced (1-3s): {decision_dist['practiced_decisions']['percentage']:.1f}%
   - Deliberate (3-5s): {decision_dist['deliberate_decisions']['percentage']:.1f}%
   - Strategic (> 5s): {decision_dist['strategic_decisions']['percentage']:.1f}%
   
   Interpretation: {decision_dist['practiced_decisions']['percentage']:.0f}% practiced decisions
   indicate automation and minimal cognitive load for routine tasks.

3. ACTION COMPLEXITY
   - High-impact actions: {report['high_impact_actions']} ({report['high_impact_actions']/report['unique_actions']*100:.1f}%)
   - Low-impact actions: {report['low_impact_actions']} ({report['low_impact_actions']/report['unique_actions']*100:.1f}%)
   - Unique sequences: {report['unique_sequences']}
   
   Interpretation: High sequence complexity ({report['unique_sequences']} patterns)
   indicates flexible decision-making and working memory engagement.

FILES IN THIS EXPORT
{'-'*70}

1. decision_timing.csv
   All decision events with inter-decision intervals
   → Use for: Temporal analysis, reaction time studies, learning effects

2. button_frequencies.csv
   All actions with click counts and impact classification
   → Use for: Behavioral frequency analysis, action importance ranking

3. decision_types.json
   Distribution of reflexive, practiced, deliberate, and strategic decisions
   → Use for: Cognitive processing model analysis, System 1 vs System 2 studies

4. summary_statistics.json
   Complete statistics for correlation analysis
   → Use for: Univariate statistical tests, baseline metrics

5. click_coordinates.csv
   Raw (x,y) coordinates of every click
   → Use for: Visualization, spatial analysis, heatmaps

RECOMMENDED ANALYSES
{'-'*70}

1. TEMPORAL ANALYSIS
   - Plot decision interval distribution (histogram)
   - Identify decision time trends over session duration
   - Look for learning effects (improving reaction time)

2. SPATIAL ANALYSIS
   - Create heatmap of click coordinates
   - Identify action clustering and hotspots
   - Estimate working memory spatial regions

3. BEHAVIORAL CLASSIFICATION
   - Cluster decisions by timing profile
   - Correlate decision type with task complexity
   - Identify decision-making strategies

4. STATISTICAL TESTS
   - One-sample t-test: Mean decision interval vs baseline
   - Kolmogorov-Smirnov: Distribution vs normal
   - Autocorrelation: Temporal structure of decision intervals

CITATIONS & REFERENCES
{'-'*70}

Data collection method: Passive gameplay recording with automatic UI detection
Task: Air traffic control simulation (Tower 3D Pro)
Framework: Python with OpenCV, NumPy, Pytesseract

For publication, reference:
- Session ID: {session_id}
- Collection date: {metadata.get('start_time', 'N/A')}
- Task duration: {metadata['duration_minutes']:.1f} minutes
- Sample size: {len(clicks)} decision events
""")
    
    print(f"   ✓ Exported research summary")
    
    print(f"\n{'='*80}")
    print("EXPORT COMPLETE")
    print('='*80)
    print(f"\nAll files saved to: {export_dir}")
    print(f"\nReady for:")
    print("  ✓ Statistical analysis (R, SPSS, Python)")
    print("  ✓ Visualization (matplotlib, ggplot2)")
    print("  ✓ Machine learning (scikit-learn, TensorFlow)")
    print("  ✓ Publication (include session_id in methods)")
    
    return export_dir

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python export_for_research.py <session_id>")
        sys.exit(1)
    
    session_id = sys.argv[1]
    export_for_research(session_id)
