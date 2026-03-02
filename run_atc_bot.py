#!/usr/bin/env python3
"""
Tower 3D AI ATC Bot - Main Entry Point
=======================================
A self-learning AI system that plays Tower 3D, logging gameplay data for neurology research.

Usage:
    python run_atc_bot.py [--mode live|interactive|training] [--launch] [--airport KJFK]

Modes:
    - live: Fully autonomous mode (AI makes all decisions)
    - interactive: User confirms each ATC decision
    - training: Record human decisions for imitation learning

Options:
    --launch: Automatically launch Tower 3D Pro (optional)
    --airport: Airport code to load (default: KJFK)
    --auto-nav: Try to click through menus automatically (experimental)
"""

import sys
import os
import argparse
import time
import logging

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.atc_world_model import ATCWorldModel
from core.reasoning_engine import ATCReasoningEngine
from core.action_module import send_command
from reasoning.decide import decide_command
# Lightweight version - no PyTorch/GPU required
from vision.vision_bot_lightweight import VisionBot
from vision.full_ui_parser import parse_full_screen
from vision.radar_tracking import find_aircraft_blips
from vision.strip_reader import read_strips
from utils.training_logger import TrainingLogger
from utils.human_feedback_logger import HumanFeedbackLogger
from utils.game_launcher import GameLauncher

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class TowerAIBot:
    """Main AI bot controller for Tower 3D."""
    
    def __init__(self, mode="live", session_id=None):
        print("=== Tower 3D AI ATC Bot v3 ===")
        print(f"Mode: {mode}")
        print()
        
        self.mode = mode
        self.session_id = session_id
        self.advisor_model = None
        self.current_button = None
        self.vision = VisionBot()
        self.world = ATCWorldModel()
        self.reasoning = ATCReasoningEngine()
        self.logger = TrainingLogger(os.path.dirname(os.path.abspath(__file__)))
        self.is_running = False
        self.command_count = 0
        self.last_decision_time = 0
        self.decision_interval = 2.0  # Make decision every 2 seconds
        
        # Load advisor model if in advisor mode
        if mode == "advisor" and session_id:
            self._load_advisor_model()
        
        # Load schedule for better aircraft ID
        schedule_path = r"d:\Tower.3D.Pro.v7927862\Extensions\Airfields\KJFK\cyvr_schedule.txt"
        try:
            self.vision.load_schedule_callsigns(schedule_path)
            print("✓ Schedule loaded")
        except:
            print("⚠ Schedule not loaded (optional)")
        
        print()
        print("READY! Starting in 5 seconds...")
        print("(Keep Tower 3D window in focus)")
        time.sleep(5)
    
    def capture_game_state(self):
        """Capture and extract current game state."""
        try:
            vision_state = parse_full_screen()
            if vision_state and not vision_state.get("error"):
                strip_list = vision_state.get('strip_list', [])
                aircraft = [
                    strip.get('callsign') for strip in strip_list
                    if isinstance(strip, dict)
                ]
                return {
                    'available_commands': vision_state.get(
                        'visible_buttons', []
                    ),
                    'aircraft': aircraft,
                    'radar_blips': vision_state.get('radar_blips', []),
                    'strip_list': strip_list,
                    'adirs_taxiways': vision_state.get('adirs_taxiways', []),
                    'safety_assessment': vision_state.get(
                        'safety_assessment', ''
                    ),
                    'recommended_command': vision_state.get(
                        'recommended_command', ''
                    ),
                    'callsign': vision_state.get('callsign', ''),
                    'progress_bar': vision_state.get('progress_bar', {}),
                    'timestamp': time.time()
                }

            available_commands = self.vision.get_available_commands()
            aircraft = self.vision.get_active_aircraft()
            radar_blips = self.vision.detect_radar_blips()
            
            return {
                'available_commands': available_commands,
                'aircraft': aircraft,
                'radar_blips': radar_blips,
                'timestamp': time.time()
            }
        except Exception as e:
            print(f"⚠ Vision error: {e}")
            return None
    
    def make_decision(self, game_state):
        """Use reasoning engine to decide best ATC command."""
        if not game_state:
            return None

        rule_decision = decide_command(game_state)
        if rule_decision and rule_decision != "STANDBY":
            return rule_decision

        if not game_state.get('available_commands'):
            return rule_decision
        
        # Update world model
        self.world.update(game_state)
        
        # Get decision from reasoning engine
        decision = self.reasoning.decide(game_state)
        
        return decision

    def print_debug_summary(self, state, command):
        """Print concise state + decision debugging info."""
        progress = (
            state.get('progress_bar', {})
            if isinstance(state, dict) else {}
        )
        green = progress.get('green', '?')
        white = progress.get('white', '?')
        safety = (
            str(state.get('safety_assessment', ''))
            if isinstance(state, dict) else ''
        )
        safety_short = (safety[:50] + '...') if len(safety) > 50 else safety

        radar_blips = (
            state.get('radar_blips', [])
            if isinstance(state, dict) else []
        )
        radar_conflicts = any(
            isinstance(blip, dict) and blip.get('conflict')
            for blip in radar_blips
        )

        recommended_command = ''
        if isinstance(state, dict):
            recommended_command = str(
                state.get('recommended_command', '')
            ).strip()

        decision_source = (
            'LLM rec'
            if recommended_command and recommended_command == command
            else 'rules/fallback'
        )

        print(
            "[DEBUG] State summary: "
            f"callsign={(
                state.get('callsign') if isinstance(state, dict) else None
            )}, "
            f"progress={green}/{white}, "
            f"safety={safety_short}, "
            f"radar_conflicts={radar_conflicts}"
        )
        print(f"[DECISION] Chose: '{command}'  (from {decision_source})")
    
    def execute_command(self, command):
        """Issue the ATC command to the game."""
        if not command:
            return False
        
        try:
            print(f"  → Issuing: {command}")
            send_command(command)
            self.command_count += 1
            return True
        except Exception as e:
            print(f"  ✗ Command failed: {e}")
            return False
    
    def run_live_mode(self):
        """Fully autonomous mode - AI makes all decisions."""
        print("\n=== LIVE MODE (Autonomous) ===")
        print("AI will automatically make all ATC decisions.")
        print("Press Ctrl+C to stop.\n")
        
        self.is_running = True
        
        try:
            while self.is_running:
                # Check if it's time for next decision
                now = time.time()
                if now - self.last_decision_time < self.decision_interval:
                    time.sleep(0.1)
                    continue
                
                # Capture game state
                game_state = self.capture_game_state()
                if not game_state:
                    continue
                
                # Make decision
                decision = self.make_decision(game_state)
                if not decision:
                    continue

                self.print_debug_summary(game_state, decision)
                
                # Execute command
                self.execute_command(decision)
                
                # Log the event for learning
                self.logger.log_event(
                    screenshot=None,  # TODO: capture screenshot
                    state_data=game_state,
                    action_type="AI_DECISION",
                    action_content=decision
                )
                
                self.last_decision_time = now
        
        except KeyboardInterrupt:
            print("\n\n⊠ Stopped by user")
        
        finally:
            self.is_running = False
            print(f"\nTotal decisions made: {self.command_count}")
            print("Goodbye!")
    
    def run_interactive_mode(self):
        """Interactive mode - user confirms each decision."""
        print("\n=== INTERACTIVE MODE ===")
        print("AI suggests decisions, you confirm or skip.")
        print("Type 'y' to confirm, 'n' to skip, 'q' to quit.\n")
        
        self.is_running = True
        
        try:
            while self.is_running:
                # Capture game state
                game_state = self.capture_game_state()
                if not game_state:
                    time.sleep(1)
                    continue
                
                # Make decision
                decision = self.make_decision(game_state)
                if not decision:
                    time.sleep(1)
                    continue

                self.print_debug_summary(game_state, decision)
                
                # Ask user
                print(f"Suggestion: {decision}")
                response = input("Confirm? (y/n/q): ").strip().lower()
                
                if response == 'q':
                    break
                elif response == 'y':
                    self.execute_command(decision)
                    self.logger.log_event(
                        screenshot=None,
                        state_data=game_state,
                        action_type="USER_CONFIRMED",
                        action_content=decision
                    )
                else:
                    print("  → Skipped")
                    self.logger.log_event(
                        screenshot=None,
                        state_data=game_state,
                        action_type="USER_SKIPPED",
                        action_content=decision
                    )
                
                time.sleep(1)
        
        except KeyboardInterrupt:
            print("\n⊠ Stopped by user")
        finally:
            self.is_running = False
            print(f"\nTotal decisions made: {self.command_count}")
    
    def run_training_mode(self):
        """Training mode - record human gameplay for imitation learning."""
        print("\n=== TRAINING MODE ===")
        print("Record YOUR gameplay for AI to learn from.")
        print("Press Ctrl+C when done.\n")
        
        from pynput import keyboard as kb
        
        def on_press(key):
            try:
                if key == kb.Key.enter:
                    game_state = self.capture_game_state()
                    if game_state:
                        print(f"  ✓ Action logged ({self.command_count + 1})")
                        self.logger.log_event(
                            screenshot=None,
                            state_data=game_state,
                            action_type="HUMAN_ACTION",
                            action_content="User issued command"
                        )
                        self.command_count += 1
            except:
                pass
        
        print("When you issue an ATC command, press ENTER to log it.")
        print("The system will record game state for learning.\n")
        
        listener = kb.Listener(on_press=on_press)
        listener.start()
        
        try:
            while True:
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\n⊠ Training session ended")
            listener.stop()
        
        print(f"Recorded {self.command_count} interactions.")
        print("Data saved. Next, retrain the model with: python ml/train_from_human.py")

    def _load_advisor_model(self):
        """Load pre-trained decision advisor model."""
        import pickle
        from pathlib import Path
        
        model_path = Path("models") / f"decision_advisor_{self.session_id}.pkl"
        
        if not model_path.exists():
            print(f"❌ Advisor model not found: {model_path}")
            print(f"   Run this first: python training/train_decision_advisor.py {self.session_id}")
            return False
        
        try:
            with open(model_path, 'rb') as f:
                self.advisor_model = pickle.load(f)
            print(f"✓ Advisor model loaded from {model_path}")
            print(f"  - Trained on {self.advisor_model['decision_rate']:.1f} decisions/minute")
            print(f"  - Knows {len(self.advisor_model['sequences'])} decision patterns")
            return True
        except Exception as e:
            print(f"❌ Failed to load advisor: {e}")
            return False
    
    def run_advisor_mode(self):
        """Advisor mode - AI suggests decisions based on learned patterns."""
        print("\n=== ADVISOR MODE (Learning-Based) ===")
        print("AI suggests next action based on your learned decision patterns.")
        print("Type 'y' to execute suggestion, 'n' to skip, 'q' to quit.\n")
        
        if not self.advisor_model:
            print("❌ Advisor model not loaded")
            return
        
        self.is_running = True
        suggestions_correct = 0
        suggestions_total = 0
        
        try:
            while self.is_running:
                # Capture game state
                game_state = self.capture_game_state()
                if not game_state:
                    time.sleep(1)
                    continue
                
                # If we know the last button clicked, suggest the next one
                if self.current_button:
                    sequences = self.advisor_model['sequences']
                    if self.current_button in sequences:
                        next_options = sequences[self.current_button]
                        if next_options:
                            # Get most likely next button
                            best_next = max(next_options.items(), 
                                           key=lambda x: x[1]['count'])
                            suggested_btn = best_next[0]
                            confidence = best_next[1]['count'] / sum(
                                info['count'] for info in next_options.values()
                            )
                            
                            print(f"\n💡 AI Suggestion:")
                            print(f"   Next: {suggested_btn}")
                            print(f"   Confidence: {confidence:.1%}")
                            print(f"   (Average timing: {best_next[1]['avg_timing']:.1f}s)")
                            
                            response = input("Execute? (y/n/q): ").strip().lower()
                            
                            if response == 'q':
                                break
                            elif response == 'y':
                                # Simulate button click at recorded location
                                btn_info = self.advisor_model['button_info'].get(
                                    suggested_btn, {}
                                )
                                if btn_info.get('location'):
                                    x, y = btn_info['location']
                                    print(f"   ✓ Clicking at ({x}, {y})")
                                    self.current_button = suggested_btn
                                    suggestions_correct += 1
                                    self.command_count += 1
                            
                            suggestions_total += 1
        
        except KeyboardInterrupt:
            print("\n⊠ Stopped by user")
        
        finally:
            self.is_running = False
            if suggestions_total > 0:
                accuracy = suggestions_correct / suggestions_total * 100
                print(f"\n{'='*60}")
                print(f"Advisor Accuracy: {accuracy:.1f}% ({suggestions_correct}/{suggestions_total})")
                print(f"Total clicks: {self.command_count}")
                print('='*60)


def main():
    parser = argparse.ArgumentParser(description="Tower 3D AI ATC Bot")
    parser.add_argument(
        "--mode",
        choices=["live", "interactive", "training", "advisor"],
        default="live",
        help="Operating mode"
    )
    parser.add_argument(
        "--launch",
        action="store_true",
        help="Automatically launch Tower 3D Pro"
    )
    parser.add_argument(
        "--airport",
        default="KJFK",
        help="Airport code to load (default: KJFK)"
    )
    parser.add_argument(
        "--auto-nav",
        action="store_true",
        help="Try automatic menu navigation (experimental)"
    )
    parser.add_argument(
        "--session",
        help="Session ID for advisor mode (e.g., 20260301_204002)"
    )
    args = parser.parse_args()
    
    # Launch game if requested
    launcher = None
    if args.launch:
        print("\n" + "=" * 60)
        print("LAUNCHING TOWER 3D PRO")
        print("=" * 60)
        
        try:
            launcher = GameLauncher()
            success = launcher.full_auto_launch(
                airport_code=args.airport,
                auto_navigate=args.auto_nav
            )
            
            if not success:
                print("\n⚠ Game launch may have failed")
                response = input("Continue anyway? (y/n): ")
                if response.lower() != 'y':
                    print("Aborted")
                    return
            
            print("\n✓ Game is running and ready")
            print("Starting bot in 3 seconds...\n")
            time.sleep(3)
            
        except Exception as e:
            print(f"\n✗ Failed to launch game: {e}")
            print("Please start Tower 3D manually and try again.")
            return
    else:
        print("\n⚠ Running without auto-launch")
        print("Make sure Tower 3D Pro is already running with a session started!\n")
        time.sleep(2)
    
    # Start the bot
    try:
        bot = TowerAIBot(mode=args.mode, session_id=args.session)
        
        if args.mode == "live":
            bot.run_live_mode()
        elif args.mode == "interactive":
            bot.run_interactive_mode()
        elif args.mode == "training":
            bot.run_training_mode()
        elif args.mode == "advisor":
            if not args.session:
                print("❌ Advisor mode requires --session argument")
                print("   Example: python run_atc_bot.py --mode advisor --session 20260301_204002")
                return
            bot.run_advisor_mode()
    
    except KeyboardInterrupt:
        print("\n\n⊠ Bot stopped by user")
    except Exception as e:
        print(f"\n\n✗ Bot error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up: optionally close game
        if launcher:
            print("\n" + "=" * 60)
            response = input("Close Tower 3D Pro? (y/n): ")
            if response.lower() == 'y':
                launcher.close_game()
                print("Game closed")
            else:
                print("Game left running")


if __name__ == "__main__":
    main()
