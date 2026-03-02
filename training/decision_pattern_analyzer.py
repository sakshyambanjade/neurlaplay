"""
Decision Pattern Analyzer
Learns WHEN and WHY you click buttons based on gameplay sequence
"""
import json
from pathlib import Path
import sys
from collections import defaultdict, Counter
import numpy as np

class DecisionPatternAnalyzer:
    """Analyzes click sequences to discover decision patterns"""
    
    def __init__(self, session_dir):
        self.session_dir = Path(session_dir)
        
        # Load metadata
        metadata_file = self.session_dir / "session_metadata.json"
        with open(metadata_file, 'r') as f:
            self.metadata = json.load(f)
        
        # Load knowledge base for button info
        kb_file = self.session_dir / "ui_knowledge_base.json"
        with open(kb_file, 'r') as f:
            self.kb = json.load(f)
        
        self.button_map = {
            (b['location']['center_x'], b['location']['center_y']): b 
            for b in self.kb['discovered_buttons']
        }
        
        self.patterns = []
        
        print(f"✓ Loaded session: {self.metadata['session_id']}")
    
    def extract_sequences(self, window_size=5):
        """Extract button click sequences"""
        clicks = [e for e in self.metadata['events'] if e['type'] == 'click']
        
        sequences = []
        for i in range(len(clicks) - window_size):
            sequence = [
                (c['x'], c['y'], c['timestamp'])
                for c in clicks[i:i+window_size]
            ]
            sequences.append(sequence)
        
        return sequences, clicks
    
    def find_button_pair_patterns(self):
        """Find common button pairs (A → B patterns)"""
        clicks = [e for e in self.metadata['events'] if e['type'] == 'click']
        
        if len(clicks) < 2:
            return {}
        
        # Look for sequential patterns
        transitions = defaultdict(list)
        
        for i in range(len(clicks) - 1):
            click1 = clicks[i]
            click2 = clicks[i + 1]
            
            # Find closest button for each click
            btn1 = self.find_closest_button(click1['x'], click1['y'])
            btn2 = self.find_closest_button(click2['x'], click2['y'])
            
            if btn1 and btn2 and btn1 != btn2:
                time_diff = click2['timestamp'] - click1['timestamp']
                transitions[btn1].append({
                    'next_button': btn2,
                    'time_gap': time_diff
                })
        
        # Analyze patterns
        patterns = {}
        for btn_id, next_buttons in transitions.items():
            if len(next_buttons) >= 2:  # Pattern must occur at least twice
                most_common = Counter([nb['next_button'] for nb in next_buttons])
                patterns[btn_id] = {
                    'followed_by': most_common.most_common(3),
                    'frequency': len(next_buttons),
                    'avg_time_gap': np.mean([nb['time_gap'] for nb in next_buttons])
                }
        
        return patterns
    
    def find_closest_button(self, x, y, threshold=50):
        """Find closest button to coordinates"""
        closest = None
        min_dist = threshold
        
        for (bx, by), btn in self.button_map.items():
            dist = np.sqrt((bx - x)**2 + (by - y)**2)
            if dist < min_dist:
                min_dist = dist
                closest = btn['button_id']
        
        return closest
    
    def analyze_timing_patterns(self):
        """Analyze timing between decisions"""
        clicks = [e for e in self.metadata['events'] if e['type'] == 'click']
        
        if len(clicks) < 2:
            return {}
        
        # Calculate inter-click times
        gaps = []
        for i in range(len(clicks) - 1):
            gap = clicks[i+1]['timestamp'] - clicks[i]['timestamp']
            gaps.append(gap)
        
        return {
            'min_gap': min(gaps),
            'max_gap': max(gaps),
            'avg_gap': np.mean(gaps),
            'median_gap': np.median(gaps),
            'std_gap': np.std(gaps)
        }
    
    def generate_report(self):
        """Generate full analysis report"""
        print("\n" + "="*80)
        print("DECISION PATTERN ANALYSIS")
        print("="*80)
        
        # Button sequences
        print("\n" + "-"*80)
        print("COMMON BUTTON SEQUENCES (A → B patterns):")
        print("-"*80)
        
        pair_patterns = self.find_button_pair_patterns()
        
        if pair_patterns:
            count = 0
            for btn_id, pattern in sorted(pair_patterns.items(), 
                                         key=lambda x: x[1]['frequency'], 
                                         reverse=True)[:10]:
                button = next((b for b in self.kb['discovered_buttons'] 
                             if b['button_id'] == btn_id), None)
                if button:
                    print(f"\n{btn_id}: You click ({button['location']['center_x']}, "
                          f"{button['location']['center_y']}) {pattern['frequency']} times")
                    print(f"  Then typically click:")
                    
                    for next_btn_id, count in pattern['followed_by'][:3]:
                        next_btn = next((b for b in self.kb['discovered_buttons'] 
                                       if b['button_id'] == next_btn_id), None)
                        if next_btn:
                            avg_delay = pattern['avg_time_gap']
                            print(f"    → {next_btn_id} at ({next_btn['location']['center_x']}, "
                                  f"{next_btn['location']['center_y']}) [{avg_delay:.1f}s later]")
        else:
            print("\n⚠ No consistent pair patterns found")
        
        # Timing analysis
        print("\n" + "-"*80)
        print("DECISION TIMING ANALYSIS:")
        print("-"*80)
        
        timing = self.analyze_timing_patterns()
        print(f"\nTime between decisions:")
        print(f"  Average: {timing['avg_gap']:.1f} seconds")
        print(f"  Median: {timing['median_gap']:.1f} seconds")
        print(f"  Range: {timing['min_gap']:.1f}s - {timing['max_gap']:.1f}s")
        print(f"  Std Dev: {timing['std_gap']:.1f}s")
        
        if timing['avg_gap'] < 2:
            print(f"  → You make RAPID decisions (reflexive)")
        elif timing['avg_gap'] < 5:
            print(f"  → You make QUICK decisions (practiced)")
        else:
            print(f"  → You take TIME with decisions (deliberate)")
        
        # Most important insights
        print("\n" + "-"*80)
        print("KEY INSIGHTS FOR NEUROLOGY RESEARCH:")
        print("-"*80)
        
        clicks = [e for e in self.metadata['events'] if e['type'] == 'click']
        session_duration = self.metadata['duration_minutes']
        total_decisions = len(clicks)
        decision_rate = total_decisions / session_duration
        
        print(f"\n1. DECISION RATE")
        print(f"   {total_decisions} decisions in {session_duration:.1f} minutes")
        print(f"   = {decision_rate:.1f} decisions/minute")
        print(f"   = 1 decision every {60/decision_rate:.1f} seconds")
        
        if pair_patterns:
            print(f"\n2. DECISION PATTERNS")
            print(f"   Found {len(pair_patterns)} recurring decision patterns")
            print(f"   → Suggests LEARNED/AUTOMATED behaviors")
        
        print(f"\n3. RESPONSE TIME")
        print(f"   Median decision interval: {timing['median_gap']:.1f} seconds")
        print(f"   → This is reaction time to game events")
        
        # Save report
        report = {
            'session_id': self.metadata['session_id'],
            'total_decisions': total_decisions,
            'session_duration_minutes': session_duration,
            'decision_rate': decision_rate,
            'timing_analysis': timing,
            'common_sequences': len(pair_patterns),
            'decision_type': self._classify_decision_type(timing['avg_gap'])
        }
        
        report_file = self.session_dir / "decision_patterns.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n✓ Report saved: {report_file}")
        
        return report
    
    def _classify_decision_type(self, avg_gap):
        if avg_gap < 1.5:
            return "reflexive"
        elif avg_gap < 4:
            return "practiced"
        else:
            return "deliberate"


def main():
    if len(sys.argv) < 2:
        print("\nUsage: python training/decision_pattern_analyzer.py <session_id>")
        print("\nExample:")
        print("  python training/decision_pattern_analyzer.py 20260301_204002")
        sys.exit(1)
    
    session_id = sys.argv[1]
    session_dir = Path("training_data/gameplay_recordings") / session_id
    
    if not session_dir.exists():
        print(f"✗ Session not found: {session_dir}")
        sys.exit(1)
    
    analyzer = DecisionPatternAnalyzer(session_dir)
    analyzer.generate_report()


if __name__ == "__main__":
    main()
