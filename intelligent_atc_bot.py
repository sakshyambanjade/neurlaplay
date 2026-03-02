#!/usr/bin/env python3
"""
Intelligent ATC Bot - Uses Vision + Reasoning + Action
Actually understands the game instead of blindly clicking coordinates.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from vision.vision_bot_lightweight import VisionBot
from core.atc_world_model import ATCWorldModel
from core.reasoning_engine import ATCReasoningEngine
from core.action_module import send_command

class IntelligentATCBot:
    """
    ATC bot that actually understands the game.
    Uses: Vision (OCR) → Reasoning (rules) → Action (commands)
    """
    
    def __init__(self):
        print("\n" + "="*80)
        print("INTELLIGENT ATC BOT")
        print("="*80)
        
        # Three core systems
        self.vision = VisionBot()
        self.world = ATCWorldModel()
        self.reasoning = ATCReasoningEngine()
        
        self.decisions_made = 0
        self.last_decision_time = 0
        self.decision_interval = 5.0  # Check every 5 seconds
        
        print("\n✓ Vision system loaded (OCR for flight strips)")
        print("✓ World model loaded (tracks aircraft state)")
        print("✓ Reasoning engine loaded (ATC decision rules)")
    
    def observe_game_state(self):
        """Use vision to see what's happening in the game."""
        print("\n[VISION] Observing game state...")
        
        # Read flight strips (aircraft callsigns)
        aircraft = self.vision.get_active_aircraft()
        print(f"  → Found {len(aircraft)} aircraft: {aircraft[:5]}")
        
        # Detect radar blips (aircraft positions)
        blips = self.vision.detect_radar_blips()
        print(f"  → Radar shows {len(blips)} targets")
        
        # Read message log (pilot requests, clearances)
        messages = self.vision.read_message_log()
        if messages:
            print(f"  → Recent message: {messages[-1]}")
        
        # Get available ATC commands
        available_commands = self.vision.get_available_commands()
        
        return {
            'aircraft': aircraft,
            'radar_blips': blips,
            'messages': messages,
            'available_commands': available_commands,
            'timestamp': time.time()
        }
    
    def decide_action(self, game_state):
        """Use reasoning to decide what ATC command to give."""
        print("\n[REASONING] Deciding best action...")
        
        # Update world model with observations
        self.world.update(game_state)
        
        # Get ATC decision from reasoning engine
        decision = self.reasoning.decide(game_state)
        
        if decision:
            print(f"  → Decision: {decision}")
        else:
            print(f"  → No action needed")
        
        return decision
    
    def execute_command(self, command, aircraft_callsign=None):
        """Execute ATC command by typing it into the game."""
        print("\n[ACTION] Executing command...")
        
        # Build full command with callsign if needed
        if aircraft_callsign:
            full_command = f"{aircraft_callsign} {command}"
        else:
            full_command = command
        
        print(f"  → Typing: {full_command}")
        
        try:
            send_command(full_command)
            print(f"  ✓ Command sent")
            return True
        except Exception as e:
            print(f"  ❌ Failed: {e}")
            return False
    
    def run_intelligent_mode(self, duration_minutes=5):
        """
        Run the intelligent ATC bot.
        Continuously observes, decides, and acts.
        """
        print("\n" + "="*80)
        print("STARTING INTELLIGENT ATC OPERATIONS")
        print("="*80)
        print(f"\nRunning for {duration_minutes} minutes...")
        print("Bot will:")
        print("  1. READ flight strips to see aircraft")
        print("  2. DECIDE which aircraft needs attention")
        print("  3. ISSUE appropriate ATC commands")
        print("\nPress Ctrl+C to stop\n")
        
        start_time = time.time()
        
        try:
            while time.time() - start_time < duration_minutes * 60:
                # Check if it's time for next decision
                now = time.time()
                if now - self.last_decision_time < self.decision_interval:
                    time.sleep(0.5)
                    continue
                
                # OBSERVE: Use vision to see game
                game_state = self.observe_game_state()
                
                # DECIDE: Use reasoning to choose action
                decision = self.decide_action(game_state)
                
                # ACT: Execute the command
                if decision:
                    # Find which aircraft needs this command
                    if game_state['aircraft']:
                        aircraft = game_state['aircraft'][0]  # Pick first for now
                        self.execute_command(decision, aircraft)
                    else:
                        self.execute_command(decision)
                    
                    self.decisions_made += 1
                
                self.last_decision_time = now
                
                # Brief status update
                print(f"\n{'─'*80}")
                print(f"Time: {(now - start_time)/60:.1f}min | Decisions: {self.decisions_made}")
                print('─'*80)
        
        except KeyboardInterrupt:
            print("\n\n⊠ Stopped by user")
        
        finally:
            print(f"\n{'='*80}")
            print("SESSION COMPLETE")
            print('='*80)
            print(f"Duration: {(time.time() - start_time)/60:.1f} minutes")
            print(f"Decisions made: {self.decisions_made}")
    
    def demo_vision_system(self):
        """Demo the vision capabilities."""
        print("\n" + "="*80)
        print("VISION SYSTEM DEMO")
        print("="*80)
        print("\nCapturing screen in 3 seconds...")
        print("(Make sure Tower 3D is visible!)\n")
        time.sleep(3)
        
        state = self.observe_game_state()
        
        print("\n" + "="*80)
        print("VISION RESULTS")
        print("="*80)
        print(f"\nAircraft detected: {len(state['aircraft'])}")
        for i, ac in enumerate(state['aircraft'][:10], 1):
            print(f"  {i}. {ac}")
        
        print(f"\nRadar targets: {len(state['radar_blips'])}")
        
        print(f"\nRecent messages: {len(state['messages'])}")
        for msg in state['messages'][:5]:
            print(f"  - {msg}")
        
        print(f"\nAvailable commands: {len(state['available_commands'])}")
        for cmd in state['available_commands'][:10]:
            print(f"  - {cmd}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Intelligent ATC Bot - Actually understands Tower 3D"
    )
    parser.add_argument(
        "--mode",
        choices=["run", "demo"],
        default="demo",
        help="run: Full autonomous play | demo: Just test vision"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=5,
        help="Play duration in minutes (default: 5)"
    )
    
    args = parser.parse_args()
    
    try:
        bot = IntelligentATCBot()
        
        if args.mode == "demo":
            print("\n⚠ DEMO MODE - Testing vision only")
            bot.demo_vision_system()
        else:
            print("\n⚠ IMPORTANT: Make sure Tower 3D is running!")
            print("Click the game window now...")
            time.sleep(3)
            
            bot.run_intelligent_mode(duration_minutes=args.duration)
    
    except KeyboardInterrupt:
        print("\n⊠ Interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
