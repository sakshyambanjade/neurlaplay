#!/usr/bin/env python3
"""
Autonomous Game Play Mode
Uses learned decision patterns to play the game completely by itself.
"""

import sys
import time
import pickle
import json
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.button_executor import ButtonExecutor

class AutonomousPlayer:
    """AI that plays the game completely by itself using learned patterns."""
    
    def __init__(self, session_id):
        """
        Initialize autonomous player with trained decision model.
        
        Args:
            session_id: Session ID with trained decision patterns
        """
        self.session_id = session_id
        self.advisor_model = None
        self.executor = None
        self.current_button = None
        self.decision_history = []
        self.correct_predictions = 0
        self.total_decisions = 0
        
        # Load decision model
        if not self._load_advisor_model():
            raise RuntimeError("Failed to load advisor model")
        
        # Load button executor
        self.executor = ButtonExecutor(session_id)
        if not self.executor.button_map:
            raise RuntimeError("Failed to load button coordinates")
        
        print(f"\n✓ Autonomous Player Ready!")
        print(f"  - Decision model: {len(self.advisor_model['sequences'])} patterns")
        print(f"  - Button executor: {len(self.executor.button_map)} buttons")
        print(f"  - Decision rate: {self.advisor_model['decision_rate']:.1f}/min")
    
    def _load_advisor_model(self):
        """Load pre-trained decision model."""
        model_path = Path("models") / f"decision_advisor_{self.session_id}.pkl"
        
        if not model_path.exists():
            print(f"❌ Model not found: {model_path}")
            return False
        
        try:
            with open(model_path, 'rb') as f:
                self.advisor_model = pickle.load(f)
            print(f"✓ Loaded advisor model")
            return True
        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            return False
    
    def decide_next_button(self):
        """
        Decide next button using learned patterns.
        
        Returns:
            (button_id, confidence)
        """
        # First decision: pick most-used button
        if self.current_button is None:
            # Get most frequently clicked button from training
            btn_freq = [
                (btn_id, info['clicks']) 
                for btn_id, info in self.advisor_model['button_info'].items()
            ]
            btn_freq.sort(key=lambda x: x[1], reverse=True)
            
            if btn_freq:
                next_btn = btn_freq[0][0]
                confidence = 1.0
                return next_btn, confidence
        
        # Subsequent decisions: use learned patterns
        sequences = self.advisor_model['sequences']
        if self.current_button not in sequences:
            # No pattern for this button, pick random high-frequency button
            btn_freq = [
                (btn_id, info['clicks']) 
                for btn_id, info in self.advisor_model['button_info'].items()
            ]
            btn_freq.sort(key=lambda x: x[1], reverse=True)
            next_btn = btn_freq[0][0]
            confidence = 0.3
            return next_btn, confidence
        
        # Get most likely next button
        next_options = sequences[self.current_button]
        if not next_options:
            return None, 0
        
        best_next = max(next_options.items(), key=lambda x: x[1]['count'])
        next_btn = best_next[0]
        total = sum(info['count'] for info in next_options.values())
        confidence = best_next[1]['count'] / total
        
        return next_btn, confidence
    
    def play_autonomous(self, duration_minutes=5, max_decisions=None):
        """
        Play the game completely autonomously.
        
        Args:
            duration_minutes: How long to play
            max_decisions: Maximum number of decisions to make (None = unlimited)
        """
        print(f"\n{'='*80}")
        print("AUTONOMOUS GAMEPLAY MODE")
        print('='*80)
        print(f"\nPlaying for up to {duration_minutes} minutes...")
        print("Press Ctrl+C to stop\n")
        
        start_time = time.time()
        decision_interval = 60 / self.advisor_model['decision_rate']  # Time between decisions
        
        try:
            while True:
                # Check time limit
                elapsed = time.time() - start_time
                if elapsed > duration_minutes * 60:
                    print(f"\n✓ Duration limit reached ({duration_minutes} minutes)")
                    break
                
                # Check decision limit
                if max_decisions and self.total_decisions >= max_decisions:
                    print(f"\n✓ Decision limit reached ({max_decisions} decisions)")
                    break
                
                # Decide next button
                next_btn, confidence = self.decide_next_button()
                
                if not next_btn:
                    print("⚠ No valid next button, pausing...")
                    time.sleep(2)
                    continue
                
                # Display decision
                print(f"\n[Decision #{self.total_decisions + 1}] "
                      f"Next: {next_btn} (confidence: {confidence:.1%})")
                
                # Execute click
                success = self.executor.click_button(next_btn)
                
                if success:
                    self.current_button = next_btn
                    self.decision_history.append({
                        'decision_num': self.total_decisions + 1,
                        'button': next_btn,
                        'confidence': confidence,
                        'timestamp': time.time()
                    })
                    
                    # Track prediction accuracy
                    if self.total_decisions > 0 and confidence > 0.5:
                        self.correct_predictions += 1
                    
                    self.total_decisions += 1
                else:
                    print(f"  ❌ Click failed")
                
                # Wait before next decision
                time.sleep(decision_interval)
        
        except KeyboardInterrupt:
            print("\n\n⊠ Stopped by user")
        
        finally:
            self._print_summary()
    
    def play_with_validation(self, duration_seconds=60):
        """
        Play while attempting to validate clicks worked.
        (Requires vision module to verify state changes)
        """
        print(f"\n{'='*80}")
        print("AUTONOMOUS GAMEPLAY WITH VALIDATION")
        print('='*80)
        print(f"Playing for {duration_seconds} seconds with state verification...\n")
        
        start_time = time.time()
        
        try:
            while time.time() - start_time < duration_seconds:
                # Decide
                next_btn, confidence = self.decide_next_button()
                
                if not next_btn:
                    time.sleep(1)
                    continue
                
                print(f"→ Clicking {next_btn} (confidence: {confidence:.1%})")
                
                # Execute
                success = self.executor.click_button(next_btn)
                
                if success:
                    self.current_button = next_btn
                    self.total_decisions += 1
                    
                    # Wait for game to respond
                    time.sleep(1)
                    
                    # TODO: Add vision-based validation here
                    # Check if UI changed after click
                    # If yes: continue
                    # If no: mark as failed click, try different button
        
        except KeyboardInterrupt:
            print("\n⊠ Stopped")
        
        finally:
            self._print_summary()
    
    def _print_summary(self):
        """Print gameplay summary."""
        elapsed = sum(
            self.decision_history[i+1]['timestamp'] - self.decision_history[i]['timestamp']
            for i in range(len(self.decision_history) - 1)
            if self.decision_history
        ) if self.decision_history else 0
        
        print(f"\n{'='*80}")
        print("GAMEPLAY SUMMARY")
        print('='*80)
        print(f"Decisions made: {self.total_decisions}")
        print(f"Duration: {elapsed:.1f} seconds")
        if self.total_decisions > 0:
            print(f"Decision rate: {self.total_decisions / (elapsed/60):.1f} decisions/minute")
            print(f"High-confidence predictions: {self.correct_predictions}/{self.total_decisions}")
        print(f"Failed clicks: {len(self.executor.failed_clicks)}")
        
        if self.decision_history:
            print(f"\nFirst 10 decisions:")
            for i, decision in enumerate(self.decision_history[:10]):
                print(f"  {i+1}. {decision['button']}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Autonomous game player using learned decision patterns"
    )
    parser.add_argument(
        "session_id",
        help="Session ID with trained decision patterns (e.g., 20260301_204002)"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=5,
        help="Play duration in minutes (default: 5)"
    )
    parser.add_argument(
        "--max-decisions",
        type=int,
        help="Maximum number of decisions to make (optional)"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: load model and buttons, don't play"
    )
    
    args = parser.parse_args()
    
    try:
        player = AutonomousPlayer(args.session_id)
        
        if args.test:
            print("\n✓ Test mode: model and buttons loaded successfully")
            print(f"✓ Ready to play! Use:")
            print(f"  python autonomous_play.py {args.session_id} --duration 5")
        else:
            print("\n⚠ IMPORTANT: Make sure Tower 3D is running and in focus!")
            print("Click the game window now...")
            time.sleep(3)
            
            player.play_autonomous(
                duration_minutes=args.duration,
                max_decisions=args.max_decisions
            )
    
    except RuntimeError as e:
        print(f"\n❌ {e}")
        print("\nFix:")
        print(f"1. Ensure you've trained the decision advisor:")
        print(f"   python training/train_decision_advisor.py {args.session_id}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n⊠ Interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
