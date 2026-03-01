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
# Lightweight version - no PyTorch/GPU required
from vision.vision_bot_lightweight import VisionBot
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
    
    def __init__(self, mode="live"):
        print("=== Tower 3D AI ATC Bot v3 ===")
        print(f"Mode: {mode}")
        print()
        
        self.mode = mode
        self.vision = VisionBot()
        self.world = ATCWorldModel()
        self.reasoning = ATCReasoningEngine()
        self.logger = TrainingLogger(os.path.dirname(os.path.abspath(__file__)))
        self.is_running = False
        self.command_count = 0
        self.last_decision_time = 0
        self.decision_interval = 2.0  # Make decision every 2 seconds
        
        # Load schedule for better aircraft ID
        schedule_path = r"d:\Tower.3D.Pro.v7927862\Tower.3D.Pro.v7927862\Extensions\Airfields\KJFK\cyvr_schedule.txt"
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
        if not game_state or not game_state['available_commands']:
            return None
        
        # Update world model
        self.world.update(game_state)
        
        # Get decision from reasoning engine
        decision = self.reasoning.decide(game_state)
        
        return decision
    
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


def main():
    parser = argparse.ArgumentParser(description="Tower 3D AI ATC Bot")
    parser.add_argument(
        "--mode",
        choices=["live", "interactive", "training"],
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
        bot = TowerAIBot(mode=args.mode)
        
        if args.mode == "live":
            bot.run_live_mode()
        elif args.mode == "interactive":
            bot.run_interactive_mode()
        elif args.mode == "training":
            bot.run_training_mode()
    
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
