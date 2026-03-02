#!/usr/bin/env python3
"""
Button Execution Module - Click discovered buttons on screen
Used by advisor/live modes to execute decisions by clicking button coordinates.
"""

import pyautogui
import time
import json
from pathlib import Path

class ButtonExecutor:
    """Execute button clicks from discovered button coordinates."""
    
    def __init__(self, session_id=None):
        self.button_map = {}
        self.click_delay = 0.5  # Delay between clicks
        self.move_duration = 0.2  # Time to move mouse
        self.failed_clicks = []
        
        if session_id:
            self.load_button_map(session_id)
    
    def load_button_map(self, session_id):
        """Load button coordinates from discovered buttons."""
        kb_file = Path("training_data/gameplay_recordings") / session_id / "ui_knowledge_base.json"
        
        if not kb_file.exists():
            print(f"⚠ Button map not found: {kb_file}")
            return False
        
        try:
            with open(kb_file, 'r') as f:
                kb = json.load(f)
            
            for btn in kb.get('discovered_buttons', []):
                btn_id = btn['button_id']
                loc = btn['location']
                self.button_map[btn_id] = {
                    'x': loc['center_x'],
                    'y': loc['center_y'],
                    'width': loc.get('width', 80),
                    'height': loc.get('height', 25),
                }
            
            print(f"✓ Loaded {len(self.button_map)} button coordinates")
            return True
        
        except Exception as e:
            print(f"❌ Failed to load button map: {e}")
            return False
    
    def click_button(self, button_id, verify=True):
        """
        Click a button by its ID.
        
        Args:
            button_id: Button identifier (e.g., 'btn_005')
            verify: Whether to verify click was successful
        
        Returns:
            True if click successful, False otherwise
        """
        if button_id not in self.button_map:
            print(f"❌ Unknown button: {button_id}")
            self.failed_clicks.append(button_id)
            return False
        
        btn_info = self.button_map[button_id]
        x, y = btn_info['x'], btn_info['y']
        
        try:
            print(f"  🖱 Clicking {button_id} at ({x}, {y})")
            
            # Move mouse to button
            pyautogui.moveTo(x, y, duration=self.move_duration)
            time.sleep(0.1)
            
            # Click
            pyautogui.click()
            time.sleep(self.click_delay)
            
            return True
        
        except Exception as e:
            print(f"  ❌ Click failed: {e}")
            self.failed_clicks.append(button_id)
            return False
    
    def execute_sequence(self, button_sequence, delay_between=1.0):
        """
        Execute a sequence of button clicks.
        
        Args:
            button_sequence: List of button IDs to click in order
            delay_between: Delay between each click (seconds)
        
        Returns:
            Number of successful clicks
        """
        successful = 0
        
        for i, btn_id in enumerate(button_sequence):
            print(f"\n[{i+1}/{len(button_sequence)}] Executing {btn_id}")
            
            if self.click_button(btn_id):
                successful += 1
            
            if i < len(button_sequence) - 1:
                time.sleep(delay_between)
        
        return successful
    
    def suggest_and_click(self, button_id):
        """
        Suggest and execute a button click.
        
        Returns:
            (success, button_id)
        """
        if button_id not in self.button_map:
            return False, button_id
        
        success = self.click_button(button_id)
        return success, button_id
    
    def get_button_coords(self, button_id):
        """Get coordinates for a button."""
        if button_id in self.button_map:
            btn = self.button_map[button_id]
            return btn['x'], btn['y']
        return None, None
    
    def random_click(self):
        """Click a random button (for testing)."""
        import random
        btn_id = random.choice(list(self.button_map.keys()))
        return self.click_button(btn_id)


def test_executor():
    """Test the button executor."""
    print("\n" + "="*80)
    print("BUTTON EXECUTOR TEST")
    print("="*80)
    
    executor = ButtonExecutor(session_id="20260301_204002")
    
    if not executor.button_map:
        print("❌ No buttons loaded")
        return
    
    print(f"\n✓ Loaded {len(executor.button_map)} buttons")
    print("\nAvailable buttons:")
    for btn_id in sorted(executor.button_map.keys())[:10]:
        x, y = executor.get_button_coords(btn_id)
        print(f"  - {btn_id}: ({x}, {y})")
    
    print("\n" + "="*80)
    print("READY TO CLICK!")
    print("="*80)
    print("\nTo test clicking:")
    print("  executor = ButtonExecutor('20260301_204002')")
    print("  executor.click_button('btn_005')")
    print("\nTo test a sequence:")
    print("  executor.execute_sequence(['btn_005', 'btn_007', 'btn_009'])")


if __name__ == "__main__":
    test_executor()
