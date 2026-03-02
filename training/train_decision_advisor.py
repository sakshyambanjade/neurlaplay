#!/usr/bin/env python3
"""
Train a Decision Advisor from recorded gameplay.
Analyzes button sequences to learn decision patterns.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
import numpy as np
import pickle

class DecisionAdvisor:
    """Learn decision patterns from raw click data."""
    
    def __init__(self):
        self.sequences = defaultdict(list)
        self.button_info = {}
        self.decision_rate = 0
        self.timing_stats = {}
        
    def train(self, session_dir):
        """Train advisor from raw session data."""
        print(f"\n{'='*80}")
        print("DECISION ADVISOR TRAINING")
        print('='*80)
        
        session_dir = Path(session_dir)
        
        # Load session metadata (raw click data)
        metadata_file = session_dir / "session_metadata.json"
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        events = metadata.get('events', [])
        clicks = [e for e in events if e.get('type') == 'click']
        print(f"\n✓ Loaded {len(clicks)} clicks from session")
        
        # Load UI knowledge base for button mappings
        kb_file = session_dir / "ui_knowledge_base.json"
        button_coords_to_id = {}  # Map (x, y) -> button_id
        if kb_file.exists():
            with open(kb_file, 'r') as f:
                kb = json.load(f)
                for btn in kb.get('discovered_buttons', []):
                    btn_id = btn['button_id']
                    loc = btn.get('location', {})
                    center_x = loc.get('center_x')
                    center_y = loc.get('center_y')
                    if center_x and center_y:
                        button_coords_to_id[(center_x, center_y)] = btn_id
                    
                    self.button_info[btn_id] = {
                        'location': (center_x, center_y),
                        'clicks': btn.get('usage_stats', {}).get('click_count', 0),
                        'impact': btn.get('effect', {}).get('type', 'unknown'),
                    }
        
        print(f"✓ Found {len(self.button_info)} unique buttons")
        
        # Build button sequences from raw clicks
        print("\nBuilding button sequences...")
        button_sequence = []
        for click in clicks:
            x, y = click.get('x', 0), click.get('y', 0)
            # Find nearest button (within tolerance)
            nearest_btn = None
            nearest_dist = float('inf')
            for (bx, by), btn_id in button_coords_to_id.items():
                dist = ((x - bx) ** 2 + (y - by) ** 2) ** 0.5
                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest_btn = btn_id
            
            if nearest_btn and nearest_dist < 100:  # Within 100px
                button_sequence.append({
                    'button_id': nearest_btn,
                    'timestamp': click.get('timestamp', 0),
                    'x': x,
                    'y': y
                })
        
        print(f"✓ Mapped {len(button_sequence)} clicks to {len(set(b['button_id'] for b in button_sequence))} buttons")
        
        # Find recurring sequences
        for i in range(len(button_sequence) - 1):
            btn_a = button_sequence[i]['button_id']
            btn_b = button_sequence[i + 1]['button_id']
            
            if btn_a not in self.sequences:
                self.sequences[btn_a] = defaultdict(list)
            
            # Record timing
            timing = button_sequence[i + 1]['timestamp'] - button_sequence[i]['timestamp']
            self.sequences[btn_a][btn_b].append(timing)
        
        # Aggregate sequences
        print("\nAnalyzing decision patterns...")
        decision_graph = {}
        for btn_a, next_dict in self.sequences.items():
            decision_graph[btn_a] = {}
            for btn_b, timings in next_dict.items():
                valid_timings = [t for t in timings if 0 < t < 60]  # Filter outliers
                if valid_timings:
                    avg_timing = np.mean(valid_timings)
                else:
                    avg_timing = np.mean(timings) if timings else 0
                    
                decision_graph[btn_a][btn_b] = {
                    'count': len(timings),
                    'avg_timing': float(avg_timing),
                    'min_timing': float(min(timings)) if timings else 0,
                    'max_timing': float(max(timings)) if timings else 0,
                }
        
        self.sequences = decision_graph
        
        # Compute timing statistics
        all_timings = []
        for next_dict in decision_graph.values():
            for seq_info in next_dict.values():
                all_timings.append(seq_info['avg_timing'])
        
        if all_timings:
            self.timing_stats = {
                'mean': float(np.mean(all_timings)),
                'median': float(np.median(all_timings)),
                'std': float(np.std(all_timings)),
                'min': float(min(all_timings)),
                'max': float(max(all_timings)),
            }
        else:
            self.timing_stats = {
                'mean': 0.0,
                'median': 0.0,
                'std': 0.0,
                'min': 0.0,
                'max': 0.0,
            }
        
        self.decision_rate = len(clicks) / (metadata.get('duration_minutes', 1))
        
        # Generate insights
        self._generate_insights(decision_graph)
        
        return self
    
    def _generate_insights(self, decision_graph):
        """Extract and display decision rules."""
        print("\n" + "="*80)
        print("DECISION RULES LEARNED")
        print("="*80)
        
        # Find most frequent transitions
        print("\n1. TOP BUTTON SEQUENCES (What happens after button clicks):")
        print("-" * 80)
        
        top_sequences = []
        for btn_a, next_dict in decision_graph.items():
            for btn_b, info in next_dict.items():
                top_sequences.append({
                    'from': btn_a,
                    'to': btn_b,
                    'count': info['count'],
                    'avg_timing': info['avg_timing']
                })
        
        top_sequences.sort(key=lambda x: x['count'], reverse=True)
        
        for i, seq in enumerate(top_sequences[:15]):
            pct = (seq['count'] / sum(s['count'] for s in top_sequences)) * 100
            print(f"\n   #{i+1}. {seq['from']} → {seq['to']}")
            print(f"       Frequency: {seq['count']} times ({pct:.1f}%)")
            print(f"       Timing: {seq['avg_timing']:.1f}s between clicks")
        
        # Timing analysis
        print(f"\n\n2. DECISION TIMING ANALYSIS:")
        print("-" * 80)
        print(f"   Average time between decisions: {self.timing_stats['mean']:.2f}s")
        print(f"   Median: {self.timing_stats['median']:.2f}s")
        print(f"   Range: {self.timing_stats['min']:.2f}s - {self.timing_stats['max']:.2f}s")
        print(f"   Decision rate: {self.decision_rate:.1f} decisions/minute")
        
        # Button connectivity
        print(f"\n\n3. BUTTON ROLES (by connectivity):")
        print("-" * 80)
        
        in_degree = defaultdict(int)
        out_degree = defaultdict(int)
        
        for btn_a, next_dict in decision_graph.items():
            out_degree[btn_a] += len(next_dict)
            for btn_b in next_dict:
                in_degree[btn_b] += 1
        
        # Hub buttons (central to workflow)
        hubs = []
        for btn in self.button_info:
            total_connections = in_degree[btn] + out_degree[btn]
            if total_connections >= 3:
                hubs.append((btn, total_connections, in_degree[btn], out_degree[btn]))
        
        hubs.sort(key=lambda x: x[1], reverse=True)
        
        print(f"\n   HUB BUTTONS (central to workflow):")
        for btn, degree, in_deg, out_deg in hubs[:5]:
            if btn in self.button_info:
                loc = self.button_info[btn]['location']
                clicks = self.button_info[btn]['clicks']
                print(f"   - {btn} at {loc}: {clicks} total clicks")
                print(f"     └ Links to {out_deg} buttons / Linked from {in_deg} buttons")
        
        self.rules = {
            'top_sequences': top_sequences[:20],
            'timing_stats': self.timing_stats,
            'hubs': [(h[0], h[1], h[2], h[3]) for h in hubs[:5]],
            'decision_rate': self.decision_rate
        }
    
    def suggest_next_action(self, current_button):
        """Suggest next button based on learned patterns."""
        if current_button not in self.sequences:
            return None, 0.0
        
        next_options = self.sequences[current_button]
        if not next_options:
            return None, 0.0
        
        # Return most likely next button
        best = max(next_options.items(), key=lambda x: x[1]['count'])
        total = sum(info['count'] for info in next_options.values())
        confidence = best[1]['count'] / total if total > 0 else 0
        
        return best[0], float(confidence)
    
    def save(self, filepath):
        """Save advisor model."""
        data = {
            'sequences': self.sequences,
            'button_info': self.button_info,
            'timing_stats': self.timing_stats,
            'decision_rate': self.decision_rate,
            'rules': self.rules
        }
        with open(filepath, 'wb') as f:
            pickle.dump(data, f)
        print(f"\n✓ Advisor model saved to {filepath}")
    
    def load(self, filepath):
        """Load advisor model."""
        with open(filepath, 'rb') as f:
            data = pickle.load(f)
        self.sequences = data['sequences']
        self.button_info = data['button_info']
        self.timing_stats = data['timing_stats']
        self.decision_rate = data['decision_rate']
        self.rules = data.get('rules', {})
        return self


def main():
    if len(sys.argv) < 2:
        print("Usage: python train_decision_advisor.py <session_id>")
        print("Example: python train_decision_advisor.py 20260301_204002")
        sys.exit(1)
    
    session_id = sys.argv[1]
    session_dir = Path(__file__).parent.parent / "training_data" / "gameplay_recordings" / session_id
    
    if not session_dir.exists():
        print(f"❌ Session not found: {session_dir}")
        sys.exit(1)
    
    # Train
    advisor = DecisionAdvisor()
    advisor.train(session_dir)
    
    # Save
    model_dir = Path(__file__).parent.parent / "models"
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / f"decision_advisor_{session_id}.pkl"
    advisor.save(model_path)
    
    print(f"\n{'='*80}")
    print("ADVISOR READY!")
    print('='*80)
    print(f"\nModel saved: {model_path}")
    print(f"\nTo use the advisor in live gameplay:")
    print(f"  python run_atc_bot.py --mode advisor --advisor-model {model_path}")


if __name__ == "__main__":
    main()

