"""
Quick Launcher Script
=====================
Standalone script to test game launching without running the full bot.
Useful for testing and debugging the launcher.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.game_launcher import quick_launch
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def main():
    print("\n" + "=" * 70)
    print("  TOWER 3D PRO - QUICK LAUNCHER")
    print("=" * 70)
    print()
    print("This script will:")
    print("  1. Find Tower.exe in your installation")
    print("  2. Launch the game")
    print("  3. Wait for it to load")
    print("  4. Prompt you to click through menus")
    print("  5. Confirm when ready for bot control")
    print()
    print("Usage:")
    print("  - Default (KJFK):   python launch_game.py")
    print("  - Custom airport:   python launch_game.py KLAX")
    print("  - Auto navigation:  python launch_game.py KJFK --auto")
    print()
    print("Press Ctrl+C to cancel")
    print("=" * 70)
    print()
    
    import time
    time.sleep(2)
    
    # Parse arguments
    airport = "KJFK"
    auto_nav = False
    
    if len(sys.argv) > 1:
        airport = sys.argv[1].upper()
    
    if len(sys.argv) > 2 and sys.argv[2] == "--auto":
        auto_nav = True
        print("⚠ AUTO-NAVIGATION ENABLED (experimental)")
        print("If it doesn't work, run without --auto flag\n")
    
    print(f"Selected airport: {airport}")
    print(f"Auto-navigate: {'Yes (experimental)' if auto_nav else 'No (you click menus)'}")
    print()
    
    try:
        # Launch!
        launcher = quick_launch(airport, auto_navigate=auto_nav)
        
        print("\n" + "=" * 70)
        print("  ✓ SUCCESS - GAME IS READY!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("  1. Verify the game session is running")
        print("  2. Run the bot:")
        print("     python run_atc_bot.py --mode interactive")
        print()
        print("  Or with auto-launch next time:")
        print(f"     python run_atc_bot.py --mode interactive --launch --airport {airport}")
        print()
        print("Leave this window open to keep the game running.")
        print("Close this window or press Ctrl+C to exit.")
        print("=" * 70)
        
        # Keep running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nShutting down...")
            
            response = input("Close Tower 3D? (y/n): ")
            if response.lower() == 'y':
                launcher.close_game()
                print("Game closed. Goodbye!")
            else:
                print("Game left running. Goodbye!")
        
    except KeyboardInterrupt:
        print("\n\nCancelled by user. Goodbye!")
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        print("\nTroubleshooting:")
        print("  - Make sure Tower 3D Pro is installed")
        print("  - Check the game path in utils/game_launcher.py")
        print("  - Try closing any existing instances")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
