#!/usr/bin/env python3
"""
Generate research report on human decision-making patterns.
Exports data in formats suitable for neurology research analysis.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
import numpy as np
from datetime import datetime

def generate_research_report(session_id):
    """Generate comprehensive research report."""
    
    session_dir = Path("training_data/gameplay_recordings") / session_id
    
    if not session_dir.exists():
        print(f"❌ Session not found: {session_dir}")
        return
    
    print(f"\n{'='*80}")
    print("NEUROLOGICAL DECISION-MAKING RESEARCH REPORT")
    print('='*80)
    print(f"Session ID: {session_id}")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Load data
    with open(session_dir / "session_metadata.json") as f:
        metadata = json.load(f)
    
    with open(session_dir / "ui_knowledge_base.json") as f:
        kb = json.load(f)
    
    with open(session_dir / "decision_patterns.json") as f:
        patterns = json.load(f)
    
    # Extract key metrics
    events = metadata.get('events', [])
    clicks = [e for e in events if e.get('type') == 'click']
    screenshots = [e for e in events if e.get('type') == 'screenshot']
    
    duration_min = metadata['duration_minutes']
    total_decisions = len(clicks)
    decision_rate = total_decisions / duration_min
    
    # Timing analysis
    click_times = [e['timestamp'] for e in clicks]
    inter_decision_times = np.diff(click_times)
    
    print(f"\n{'='*80}")
    print("Executive Summary")
    print('='*80)
    
    print(f"""
RESEARCH SUBJECT BEHAVIOR:
• Task Duration: {duration_min:.1f} minutes ({int(duration_min // 60)}h {int(duration_min % 60)}m)
• Total Decisions Made: {total_decisions} clicks
• Decision Rate: {decision_rate:.2f} decisions/minute (one decision every {60/decision_rate:.1f}s)
• Unique Actions Identified: {len(kb['discovered_buttons'])} distinct buttons

TEMPORAL METRICS (Decision Timing):
• Mean Decision Interval: {inter_decision_times.mean():.2f} seconds
• Median Decision Interval: {np.median(inter_decision_times):.2f} seconds
• Std Deviation: {inter_decision_times.std():.2f} seconds (variability measure)
• Range: {inter_decision_times.min():.2f}s (fast) to {inter_decision_times.max():.2f}s (slow)
• Percentiles:
  - 25th: {np.percentile(inter_decision_times, 25):.2f}s (reflex decisions)
  - 50th: {np.percentile(inter_decision_times, 50):.2f}s (practiced decisions)
  - 75th: {np.percentile(inter_decision_times, 75):.2f}s (deliberate decisions)
  - 95th: {np.percentile(inter_decision_times, 95):.2f}s (strategic pauses)
""")
    
    # Decision patterns
    print(f"\n{'='*80}")
    print("Decision Pattern Analysis")
    print('='*80)
    
    # Most frequent decisions
    button_clicks = defaultdict(int)
    for btn in kb['discovered_buttons']:
        button_clicks[btn['button_id']] = btn['usage_stats']['click_count']
    
    top_buttons = sorted(button_clicks.items(), key=lambda x: x[1], reverse=True)
    
    print(f"\nMOST FREQUENTLY USED ACTIONS (Top 10):")
    print("-" * 80)
    for i, (btn_id, count) in enumerate(top_buttons[:10], 1):
        pct = (count / total_decisions) * 100
        freq_per_min = count / duration_min
        print(f"{i}. {btn_id}: {count} clicks ({pct:.1f}% of total, {freq_per_min:.2f}/min)")
    
    # Action impact analysis
    print(f"\n\nACTION IMPACT CLASSIFICATION:")
    print("-" * 80)
    high_impact = sum(1 for b in kb['discovered_buttons'] if b['effect']['type'] == 'high_impact')
    low_impact = sum(1 for b in kb['discovered_buttons'] if b['effect']['type'] == 'low_impact')
    
    print(f"High-Impact Actions: {high_impact} ({high_impact/len(kb['discovered_buttons'])*100:.1f}%)")
    print(f"  └ Major decision points that significantly change system state")
    print(f"Low-Impact Actions: {low_impact} ({low_impact/len(kb['discovered_buttons'])*100:.1f}%)")
    print(f"  └ Minor adjustments and fine-tuning decisions")
    
    # Cognition model
    print(f"\n{'='*80}")
    print("Cognitive Processing Model")
    print('='*80)
    
    hist, bins = np.histogram(inter_decision_times, bins=[0, 1, 3, 5, 60])
    
    print(f"""
DECISION TYPE DISTRIBUTION (by reaction time):

1. REFLEXIVE DECISIONS (< 1 second): {hist[0]} decisions ({hist[0]/len(inter_decision_times)*100:.1f}%)
   - Automated/habitual responses
   - No conscious deliberation
   - System 1 thinking (fast, automatic)

2. PRACTICED DECISIONS (1-3 seconds): {hist[1]} decisions ({hist[1]/len(inter_decision_times)*100:.1f}%)
   - Trained/learned responses
   - Pattern recognition active
   - Minimal cognitive load

3. DELIBERATE DECISIONS (3-5 seconds): {hist[2]} decisions ({hist[2]/len(inter_decision_times)*100:.1f}%)
   - Conscious choice making
   - Multiple option evaluation
   - System 2 thinking (slow, analytical)

4. STRATEGIC PAUSES (> 5 seconds): {hist[3]} decisions ({hist[3]/len(inter_decision_times)*100:.1f}%)
   - Major decision points
   - Analysis/planning phase
   - Task reassessment
""")
    
    # Sequence learning
    print(f"\n{'='*80}")
    print("Learned Decision Sequences")
    print('='*80)
    
    sequences = defaultdict(lambda: defaultdict(int))
    for i in range(len(clicks) - 1):
        # Map clicks to buttons
        x1, y1 = clicks[i]['x'], clicks[i]['y']
        x2, y2 = clicks[i+1]['x'], clicks[i+1]['y']
        
        # Find nearest button for each click
        def find_nearest_button(x, y):
            nearest = None
            nearest_dist = float('inf')
            for btn in kb['discovered_buttons']:
                loc = btn['location']
                cx, cy = loc['center_x'], loc['center_y']
                dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest = btn['button_id']
            return nearest if nearest_dist < 100 else None
        
        btn1 = find_nearest_button(x1, y1)
        btn2 = find_nearest_button(x2, y2)
        
        if btn1 and btn2:
            sequences[btn1][btn2] += 1
    
    print(f"\nTOP ACTION SEQUENCES (Button A → Button B):")
    print("-" * 80)
    
    seq_list = []
    for btn_a, next_dict in sequences.items():
        for btn_b, count in next_dict.items():
            seq_list.append((btn_a, btn_b, count))
    
    seq_list.sort(key=lambda x: x[2], reverse=True)
    
    for i, (btn_a, btn_b, count) in enumerate(seq_list[:15], 1):
        pct = (count / (len(clicks) - 1)) * 100
        print(f"{i}. {btn_a} → {btn_b}: {count} times ({pct:.1f}%)")
    
    print(f"\nSequence Complexity: {len(seq_list)} unique transitions")
    print(f"  → High complexity indicates flexible decision-making")
    
    # Export summary for statistical analysis
    report_data = {
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(),
        "task_duration_minutes": duration_min,
        "total_decisions": total_decisions,
        "decision_rate": decision_rate,
        "timing_metrics": {
            "mean_interval": float(inter_decision_times.mean()),
            "median_interval": float(np.median(inter_decision_times)),
            "std_interval": float(inter_decision_times.std()),
            "min_interval": float(inter_decision_times.min()),
            "max_interval": float(inter_decision_times.max()),
            "percentile_25": float(np.percentile(inter_decision_times, 25)),
            "percentile_50": float(np.percentile(inter_decision_times, 50)),
            "percentile_75": float(np.percentile(inter_decision_times, 75)),
            "percentile_95": float(np.percentile(inter_decision_times, 95)),
        },
        "decision_type_distribution": {
            "reflexive": int(hist[0]),
            "practiced": int(hist[1]),
            "deliberate": int(hist[2]),
            "strategic": int(hist[3]),
        },
        "unique_actions": len(kb['discovered_buttons']),
        "high_impact_actions": high_impact,
        "low_impact_actions": low_impact,
        "unique_sequences": len(seq_list),
    }
    
    # Save report
    report_file = session_dir / "research_report.json"
    with open(report_file, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"\n{'='*80}")
    print("Report Generation Complete")
    print('='*80)
    print(f"\n✓ Full report exported to: {report_file}")
    print(f"✓ Ready for statistical analysis and visualization")
    
    print(f"\n\nNEXT STEPS FOR NEUROLOGY RESEARCH:")
    print("-" * 80)
    print("""
1. STATISTICAL ANALYSIS:
   - Use timing distributions to identify decision-making styles
   - Correlate decision intervals with task complexity
   - Identify learning effects (improving decision speed)

2. NEURAL CORRELATES:
   - Map decisio types to brain regions (reflex vs deliberate)
   - Analyze sequence complexity = working memory load
   - Decision rate = cognitive processing speed

3. COMPARATIVE ANALYSIS:
   - Collect data from multiple subjects
   - Compare decision patterns across skill levels
   - Identify expert vs novice decision-making signatures
""")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_research_report.py <session_id>")
        print("Example: python generate_research_report.py 20260301_204002")
        sys.exit(1)
    
    session_id = sys.argv[1]
    generate_research_report(session_id)
